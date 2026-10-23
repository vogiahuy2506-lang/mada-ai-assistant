/**
 * Response Sanitizer — chống lộ prompt / nội dung nội bộ ra câu trả lời.
 *
 * ⚠️ VÌ SAO CẦN:
 * 1. RAG đưa raw context (đã scrape từ trang MADA) vào prompt. Raw context có
 *    các dòng metadata nội bộ kiểu "Mã SP: ...", "Stock: ...", "Link sản phẩm: ..."
 *    → model hay echo nguyên văn ra câu trả lời.
 * 2. Prompt có các marker định danh (📚 THÔNG TIN TỪ CƠ SỞ TRI THỨC, [Document N],
 *    ❓ Câu hỏi, CHỈ DẪN TRẢ LỜI…) → khi model "rò rỉ" chúng sẽ hiện ra
 *    cho khách hàng nhìn thấy, làm hỏng uy tín chatbot.
 *
 * THIẾT KẾ:
 * Toàn bộ quy tắc viết ở dạng "theo dòng" (line-based) để:
 *   • áp dụng được an toàn khi streaming (chunk có thể bị cắt giữa dòng)
 *   • không vô tình xoá nhầm nội dung hợp lệ của khách hàng
 *
 * API:
 *   • `sanitizeContextForPrompt()` — dọn context TRƯỚC khi đưa vào prompt.
 *   • `sanitizeAssistantAnswer()` — dọn câu trả lời SAU khi model sinh ra.
 *   • `createStreamingSanitizer()` — dọn theo luồng (giữ nguyên trải nghiệm streaming).
 */

// ============== QUY TẮC THEO DÒNG ==============

/** Marker nội bộ do hệ thống chèn vào prompt (đầu dòng). */
const INTERNAL_MARKER_LINE_PATTERNS: RegExp[] = [
  /^\s*📚.*$/, // 📚 THÔNG TIN TỪ CƠ SỞ TRI THỨC
  /^\s*📝.*$/, // 📝 LỊCH SỬ
  /^\s*❓.*$/, // ❓ Câu hỏi
  /^\s*🤖.*$/, // 🤖 Trả lời ngắn gọn…
  /^\s*🔧.*$/, // 🔧 KIẾN THỨC AT BỔ SUNG
  /^\s*🎨.*$/, // 🎨 CÀI ĐẶT CẢM XÚC…
  /^\s*📋\s*THÔNG TIN HỆ THỐNG.*$/,
  /^\s*📋\s*QUY TẮC ỨNG XỬ BỔ SUNG.*$/,
  /^\s*🎭\s*GIỌNG VĂN BỔ SUNG.*$/,
  /^\s*🤖\s*VAI TRÒ CHÍNH:.*$/,
  /^\s*CHỈ DẪN TRẢ LỜI.*$/i,
  /^\s*ANSWER GUIDELINES.*$/i,
  /^\s*CONSIGNES DE RÉPONSE.*$/i,
  /^\s*إرشادات الإجابة.*$/,
  /^\s*📋\s*BẮT BUỘC.*$/, // header bắt buộc của specialist bot
  /^\s*\[Document\s*\d+\].*$/i,
  /^\s*\[Tài liệu\s*\d+\].*$/i,
  /^\s*Mỗi lượt trả lời.*$/i,
  /^\s*Sau header, trình bày phần trả lời.*$/i,
  /^\s*KHÔNG được bỏ header này.*$/i,
];

/** Dòng metadata nội bộ lẫn từ nội dung scrape của trang MADA. */
const INTERNAL_METADATA_LINE_PATTERNS: RegExp[] = [
  /^\s*[-*•]?\s*\**\s*(Mã SP|Mã sản phẩm|SKU|Mã số|Product Code|Item Code)\s*\**\s*[:：]/i,
  /^\s*[-*•]?\s*\**\s*(Stock|Tình trạng kho|Có hàng|Số lượng tồn)\s*\**\s*[:：]/i,
  /^\s*[-*•]?\s*\**\s*(Thời gian cập nhật|Updated|Ngày cập nhật|Last updated)\s*\**\s*[:：]/i,
  /^\s*[-*•]?\s*\**\s*(Link sản phẩm|Product Link|URL sản phẩm)\s*\**\s*[:：]/i,
  /^\s*[-*•]?\s*\**\s*(Nguồn|Source)\s*\**\s*[:：]\s*https?:\/\//i,
  /^\s*\[Nguồn:.*$/i,
];

/** Dòng "Nguồn:" đứng một mình — dấu cuối của một block context bị paste lại. */
const SOURCE_ONLY_LINE = /^\s*(\*\*)?(Nguồn|Source)(\*\*)?\s*[:：]\s*$/i;

/** Dấu phân cách context "---" (markdown horizontal rule lộ ra). */
const CONTEXT_SEPARATOR = /^\s*-{3,}\s*$/;

/** Dấu kẻ dài dùng trong prompt. */
const LONG_SEPARATOR_LINE = /^\s*━{3,}\s*$/;

/** Khối lịch sử hội thoại bị lọt vào. */
const HISTORY_LINE = /^\s*(Người dùng|User|MADA AI|المستخدم|Utilisateur)\s*:\s*.*$/;

/** Dòng câu hỏi bị lặp lại. */
const QUESTION_LINE = /^\s*❓\s*(Câu hỏi|Question|سؤال)\s*[:：]/i;

/** Hướng dẫn dạng inline cho chính model. */
const INLINE_INSTRUCTION_LINE =
  /^\s*(?:🤖\s*)?(?:Trả lời ngắn gọn[^\n]*|Đáp lại[^\n]*|Answer concisely[^\n]*|أجب بإيجاز[^\n]*)$/i;

/** Bullet hướng dẫn có marker ⚠️ / ⭐ (đặc trưng của prompt).
 *  ⚠️ (U+26A0 U+FE0F) gồm variation selector → không được đặt trong character
 *  class (eslint no-misleading-character-class). Dùng alternation + escape Unicode. */
const INLINE_GUIDANCE_BULLET =
  /^\s*(?:[-*]\s*)?(?:\u26A0\uFE0F?|\u2B50)\s*(?:IMPORTANT|QUAN TRỌNG|Ne JAMAIS|مهم)\b/iu;

/** Câu lệnh hướng dẫn dạng văn xuôi. */
const RULE_SENTENCE_LINE =
  /^\s*(?:Trả lời NGẮN GỌN|Nếu CÓ thông tin|Nếu KHÔNG CÓ|Dùng danh sách gạch đầu dòng)\b/i;

/** Tiêu đề danh sách nội bộ hay bị lộ. */
const INTERNAL_LIST_HEADING =
  /^\s*(?:\*\*)?DANH MỤC SẢN PHẨM( MADA)?( HIỆN CÓ)?(?:\*\*)?\s*:?\s*$/i;

// ============== TIỆN ÍCH ==============

/**
 * Gộp các dòng trống liên tiếp thành tối đa 1 dòng trống.
 *
 * ⚠️ VÌ SAO PHẢI GIỮ `\n\n`:
 * Markdown chỉ tách thành thẻ `<p>` riêng khi gặp DÒNG TRỐNG (tức `\n\n`).
 * Nếu gộp cả dòng trống về `\n`, header và câu đầu tiên rơi vào cùng một
 * `<p>` → hiển thị sát nhau, không xuống dòng (đúng lỗi trong ảnh người dùng).
 *
 * Vì vậy: `join('\n')` (1 dòng trống) + nối thêm 1 `\n` khi có khoảng trống.
 */
function collapseBlankLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/, ''))
    .filter((line, idx, arr) => {
      if (line.trim() !== '') return true;
      return idx === 0 || arr[idx - 1].trim() !== '';
    })
    .join('\n')
    // \n\n = dòng trống thật sự trong markdown → tách thẻ <p> đúng cách.
    .replace(/(?:^[ \t]*\n){2,}/gm, '\n\n');
}

/** Áp dụng toàn bộ quy tắc "loại dòng" lên một danh sách dòng. */
function filterInternalLines(lines: string[]): string[] {
  return lines.filter((line) => {
    if (INTERNAL_MARKER_LINE_PATTERNS.some((re) => re.test(line))) return false;
    if (INTERNAL_METADATA_LINE_PATTERNS.some((re) => re.test(line))) return false;
    if (SOURCE_ONLY_LINE.test(line)) return false;
    if (CONTEXT_SEPARATOR.test(line)) return false;
    if (LONG_SEPARATOR_LINE.test(line)) return false;
    if (HISTORY_LINE.test(line)) return false;
    if (QUESTION_LINE.test(line)) return false;
    if (INLINE_INSTRUCTION_LINE.test(line)) return false;
    if (INLINE_GUIDANCE_BULLET.test(line)) return false;
    if (RULE_SENTENCE_LINE.test(line)) return false;
    if (INTERNAL_LIST_HEADING.test(line)) return false;
    return true;
  });
}

// ============== API ==============

/**
 * Dọn context RAG trước khi đưa vào prompt.
 * - Bỏ dòng metadata nội bộ của trang MADA (Mã SP, Stock, …).
 * - Bỏ marker định danh nếu lọt vào content.
 * - Bỏ link thô (model được biết tên sản phẩm, nhưng KHÔNG được tự chế/tự chép URL —
 *    hệ thống sẽ gắn link chính xác sau khi sinh câu trả lời).
 */
export function sanitizeContextForPrompt(context: string, maxLength = 6000): string {
  if (!context) return '';

  let out = collapseBlankLines(context);

  out = filterInternalLines(out.split('\n')).join('\n');

  // Bỏ link thô trong context → thay bằng placeholder
  out = out.replace(/https?:\/\/[^\s)>\]]+/g, '[link]');

  out = collapseBlankLines(out).trim();

  if (out.length > maxLength) {
    out = out.slice(0, maxLength);
  }

  return out;
}

// ============== DỌC MARKER NỘI BỘ "— LINK:" ==============

/**
 * Bot đôi khi để lộ marker nội bộ "— LINK: https://…" (do prompt catalog
 * yêu cầu ghi link kèm tên). Marker này vô nghĩa với người dùng và làm câu
 * trả lời trông như lộ kỹ thuật → chuyển thành link sạch, xuống dòng.
 *
 * "**ZoomText** — LINK: https://x" → "**ZoomText**\n🔗 https://x"
 */
const INLINE_LINK_MARKER =
  /(\*\*[^*\n]+\*\*)\s*—\s*LINK:\s*(https?:\/\/\S+)/g;

/** Bỏ dấu ** lạc lõng (VD "*****ZoomText" do bot chồng dấu). */
function fixOverlappingBold(text: string): string {
  return text
    .replace(/\*{4,}/g, '**')
    .replace(/\*\*([^*\n]+?)\*\*\s*\*/g, '**$1**');
}

/**
 * Dọn câu trả lời của model trước khi gửi cho khách hàng.
 * Lưới an toàn cuối cùng — áp dụng cho cả streaming và non-streaming.
 *
 * @param options.keepSpecialistHeader Giữ header định danh bot (📋 **CHUYÊN GIA …**)
 */
export function sanitizeAssistantAnswer(
  text: string,
  options: { keepSpecialistHeader?: boolean } = {}
): string {
  if (!text) return '';

  const { keepSpecialistHeader = true } = options;

  let out = text;

  // Tách & giữ header định danh bot nếu có (ở đầu câu trả lời)
  // Header không còn tiền tố "BOT N" — khớp theo phần sau 📋 **.
  let specialistHeader = '';
  // ⚠️ Regex này cố tình KHỚP CẢ KHI HEADER DÍNH LIỀN CÂU CHÀO.
  // Regex cũ bắt buộc header kết thúc bằng \n, nên khi model viết
  // "📋 **…** Chào bạn! Mình là MADA." trên cùng dòng thì header bị bỏ sót,
  // dính liền câu chào → trông rất bất lịch sự. Nay khớp phần header đóng
  // bằng ** rồi tự chèn xuống dòng phía dưới.
  const headerMatch = out.match(/^\s*(📋[ \t]*\*\*((?:[^*\n]|\*(?!\*))+?)\*\*)[ \t]*(?:\n+|(?=\S))?/);
  if (headerMatch && keepSpecialistHeader) {
    specialistHeader = headerMatch[1].trim();
    out = out.slice(headerMatch[0].length);
  }

  out = filterInternalLines(out.split('\n')).join('\n');
  out = collapseBlankLines(out).replace(/\n{3,}/g, '\n\n').trim();

  // ⭐ Dọc marker "— LINK:" và dấu ** chồng nhau
  out = fixOverlappingBold(out);
  out = out.replace(INLINE_LINK_MARKER, '$1\n🔗 $2');

  if (specialistHeader) {
    // ⚠️ PHẢI DÙNG \n\n (2 ký tự xuống dòng), KHÔNG PHẢI \n.
    // Markdown chỉ tách thẻ <p> khi gặp dòng trống. Với \n đơn, header và
    // câu đầu rơi vào CÙNG một <p> → hiển thị sát nhau, đúng lỗi trong ảnh.
    out = `${specialistHeader}\n\n${out}`;
  }

  return out;
}

/**
 * Tạo bộ sanitizer cho luồng streaming.
 *
 * Vì chunk có thể bị cắt giữa dòng, ta giữ buffer và chỉ "đẩy" ra khi gặp
 * newline (hoặc khi flush). Nhờ vậy quy tắc theo dòng luôn chính xác, mà
 * người dùng vẫn thấy nội dung hiện dần.
 */
export function createStreamingSanitizer(
  options: { keepSpecialistHeader?: boolean; headerAlreadyShown?: boolean } = {}
) {
  const { keepSpecialistHeader = true, headerAlreadyShown = false } = options;

  let buffer = '';
  // ⭐ Nếu header định danh đã xuất hiện ở lượt TRƯỚC, coi như đã dùng → không
  // ghim lại. Đây là lớp chống lặp thật sự (prompt chỉ là lời nhắc).
  let headerTaken = headerAlreadyShown;
  let specialistHeader = '';

  /**
   * Xử lý một chunk → trả về phần text an toàn để gửi cho client.
   */
  function push(chunk: string): string {
    if (!chunk) return '';

    buffer += chunk;

    // Chỉ xử lý những dòng đã hoàn chỉnh
    const lastNewline = buffer.lastIndexOf('\n');
    if (lastNewline === -1) return '';

    const complete = buffer.slice(0, lastNewline + 1);
    buffer = buffer.slice(lastNewline + 1);

    return processBlock(complete);
  }

  /**
   * Đẩy nốt phần buffer còn lại khi kết thúc stream.
   */
  function flush(): string {
    if (!buffer) return '';
    const rest = buffer;
    buffer = '';
    // ⚠️ QUAN TRỌNG: keepTail=false → phần text cuối cùng (không kết thúc bằng
    // newline) PHẢI được trả về. Nếu keepTail=true, processBlock pop nó khỏi
    // `lines` rồi nhét lại vào buffer → câu trả lời bị nuốt mất hoàn toàn.
    return processBlock(rest, false);
  }

  function processBlock(block: string, keepTail = true): string {
    let lines = block.split('\n');
    // Giữ phần rỗng cuối để không mất newline khi ghép
    let tail = '';
    if (keepTail) {
      tail = lines.pop() ?? '';
    }

    // ⭐ Xử lý dòng header định danh bot (📋 **...**)
    //  • Chưa hiện header trước đó + muốn giữ → BẮT ra rồi ghim lại lên đầu.
    //  • Đã hiện header ở lượt trước → XÓA hẳn, không ghim lại (chống lặp).
    if (keepSpecialistHeader) {
      for (let i = 0; i < lines.length; i++) {
        // ⚠️ KHỚP CẢ KHI HEADER DÍNH LIỀN CÂU CHÀO (không chỉ dòng riêng).
        // Regex cũ yêu cầu dòng CHỈ CÓ header. Model hay viết
        // "📋 **…** Chào bạn! Mình là MADA." trên cùng dòng → không khớp →
        // header dính liền câu chào, trông rất bất lịch sự. Nay tách header
        // ra, phần văn xuôi sau đó giữ thành dòng riêng.
        const m = lines[i].match(/^\s*(📋[ \t]*\*\*((?:[^*\n]|\*(?!\*))+?)\*\*)[ \t]*(.*)$/);
        if (!m) continue;

        // Phần văn xuôi sau header phải được giữ lại (không nuốt mất).
        const rest = m[3].trim();

        if (!headerTaken) {
          // Lượt đầu → bắt header ra, ghim lại trên đầu câu trả lời.
          specialistHeader = m[1].trim();
          headerTaken = true;
        }

        if (rest) {
          lines.splice(i, 1, rest);
        } else {
          lines.splice(i, 1);
        }
        break;
      }
    }

    lines = filterInternalLines(lines);

    let out = lines.join('\n');
    if (out) out += '\n';

    // ⭐ Dọc marker "— LINK:" và dấu ** chồng nhau (streaming)
    out = fixOverlappingBold(out);
    out = out.replace(INLINE_LINK_MARKER, '$1\n🔗 $2');

    if (specialistHeader && out.trim()) {
      out = `${specialistHeader}\n\n${out}`;
      specialistHeader = '';
    }

    // Trả phần tail (chưa hoàn chỉnh) vào buffer
    if (keepTail && tail) buffer = tail + buffer;

    return out;
  }

  return { push, flush };
}

/**
 * Kiểm tra xem câu trả lời có dấu hiệu lộ nội bộ không (dùng để log cảnh báo).
 */
export function detectInternalLeak(text: string): string[] {
  if (!text) return [];
  const leaks: string[] = [];

  const checks: Array<[string, RegExp]> = [
    ['knowledge-context-header', /📚\s*THÔNG TIN TỪ CƠ SỞ TRI THỨC/i],
    ['document-marker', /\[Document\s*\d+\]/i],
    ['question-marker', /❓\s*Câu hỏi/i],
    ['guidance-title', /CHỈ DẪN TRẢ LỜI|ANSWER GUIDELINES/i],
    ['history-marker', /^\s*Người dùng\s*:/im],
    ['product-code-line', /^\s*[-*•]?\s*\**\s*(Mã SP|SKU)\s*\**\s*[:：]/im],
    ['raw-separator', /^\s*-{3,}\s*$/m],
  ];

  for (const [name, re] of checks) {
    if (re.test(text)) leaks.push(name);
  }

  return leaks;
}
