/**
 * ⭐ Chèn link sản phẩm vào câu trả lời của bot.
 *
 * VÌ SAO CẦN:
 * Bot nhắc tên sản phẩm (VD "OrCam Read") nhưng câu trả lời không kèm link →
 * người dùng không biết tìm mua ở đâu. Yêu cầu nghiệp vụ: tên sản phẩm phải
 * có link NGAY DƯỚI nó.
 *
 * NGUYÊN TẮC:
 * Chỉ gắn link cho tên sản phẩm CÓ THẬT trong danh mục MADA. Tên bịa
 * (VD "OrCam Advance") không có trong DB → không gắn link, và bị loại khỏi
 * danh sách khuyến nghị để tránh giới thiệu sản phẩm không tồn tại.
 */

import { buildProductCatalog, findMentionedProducts, normalizeProductName } from './productLinker';
import { botsForProduct } from './productTaxonomy';

/**
 * ⭐ Bot này có được nhắc sản phẩm này không?
 *
 * ⚠️ FAIL-OPEN: sản phẩm KHÔNG có trong taxonomy → coi như được phép (giữ).
 * Lý do: taxonomy chỉ phủ 349/349 sản phẩm `kb_products`, nhưng catalog còn
 * lấy từ `knowledge_items` (web-scraped) — có thể có URL chưa có trong file
 * taxonomy. Nếu fail-closed thì những sản phẩm hợp lệ đó sẽ bị xoá khỏi
 * câu trả lời → mất sản phẩm thật (regression nghiêm trọng hơn leak).
 */
function isInBotScope(
  entry: { product_url?: string; source_url?: string; title?: string; title_en?: string },
  botId: string | null | undefined,
  allowTitles?: Set<string> | null
): boolean {
  if (!botId) return true;
  // Bot 7 (Thông tin bổ trợ) được xem TOÀN BỘ danh mục.
  if (botId === 'bot-regulatory') return true;
  // ⚠️ CHỈ lọc cho bot MADA dựng sẵn (`bot-*`). Custom agent không có
  // taxonomy → mọi sản phẩm đều "ngoài chuyên môn" theo cách tính này → nếu
  // lọc, custom agent sẽ mất sạch tên sản phẩm khỏi câu trả lời.
  if (!botId.startsWith('bot-')) return true;

  // Sản phẩm được phép nhắc dù ngoài chuyên môn (user hỏi thẳng tên).
  if (allowTitles && allowTitles.size > 0) {
    const t = normalizeProductName(entry.title || '');
    const te = normalizeProductName(entry.title_en || '');
    if ((t && allowTitles.has(t)) || (te && allowTitles.has(te))) return true;
  }

  const url = entry.product_url || entry.source_url || '';
  const bots = botsForProduct(url);
  if (bots.length === 0) return true; // fail-open
  return bots.includes(botId);
}

/**
 * Tìm các sản phẩm ĐƯỢC NHẮC trong câu trả lời mà bot KHÔNG được phép nhắc.
 *
 * ⚠️ CHỈ xét sản phẩm THỰC SỰ xuất hiện trong câu trả lời (dùng
 * `findMentionedProducts`) — không quét toàn bộ catalog. Nếu quét toàn bộ
 * catalog thì mỗi lượt chat sẽ gỡ hàng chục tên không có trong câu → hỏng
 * nội dung.
 */
function findOutOfScopeProducts(
  answer: string,
  botId: string | null | undefined,
  catalog: ReturnType<typeof buildProductCatalog>,
  allowTitles?: Set<string> | null
): Array<{ name: string; url: string }> {
  const out: Array<{ name: string; url: string }> = [];
  if (!answer || !botId || botId === 'bot-regulatory') return out;

  const mentioned = findMentionedProducts(answer, catalog);
  for (const entry of mentioned) {
    if (isInBotScope(entry, botId, allowTitles)) continue;
    const name = entry.title || entry.title_en || '';
    if (!name || name.length < 4) continue;
    const url = entry.product_url || entry.source_url || '';
    if (!url) continue;
    out.push({ name, url });
  }
  return out;
}

/**
 * Tìm tên sản phẩm hợp lệ (có trong DB) chưa có link trong câu trả lời.
 *
 * @returns Danh sách { name, url } cần chèn link.
 */
function findProductsMissingLink(
  answer: string,
  catalog: ReturnType<typeof buildProductCatalog>
): Array<{ name: string; url: string }> {
  const mentions = findMentionedProducts(answer, catalog);
  const out: Array<{ name: string; url: string }> = [];

  for (const entry of mentions) {
    const url = entry.product_url || entry.source_url;
    if (!url || !url.startsWith('http')) continue;

    const name = entry.title || '';
    if (!name) continue;

    // ⭐ Nếu link này đã xuất hiện BẤT KỲ chỗ nào trong câu trả lời → bot đã
    // tự viết link đúng rồi → không chèn thêm (tránh link bị lặp).
    if (answer.includes(url)) continue;

    // Nếu tên sản phẩm xuất hiện nhiều lần mà chưa có link ở đâu, chỉ chèn
    // 1 lần cho tên đầu tiên — tránh lặp link theo số lần nhắc tên.
    out.push({ name, url });
  }

  // ⭐ Chống lặp: mỗi URL chỉ chèn đúng 1 lần.
  const seenUrls = new Set<string>();
  return out.filter((item) => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });
}

/**
 * ⭐ Gỡ tên sản phẩm khỏi câu trả lời khi người dùng CHƯA đủ 4 câu hỏi.
 *
 * VÌ SAO CẦN:
 * Chỉ dựa vào prompt là chưa đủ — mô hình vẫn hay tự liệt kê thiết bị vì
 * system prompt riêng của từng bot (bot-vision…) có sẵn danh sách sản phẩm
 * và chỉ thị "giới thiệu sản phẩm". Vì vậy cần lớp lọc bắt buộc ở server.
 *
 * CÁCH LÀM:
 * Bỏ các khối văn bản có liệt kê tên sản phẩm (dòng chứa tên trong DB của
 * MADA, hoặc URL sản phẩm). Giữ nguyên phần còn lại của câu trả lời.
 *
 * @param answer Câu trả lời gốc.
 * @returns Câu trả lời đã loại bỏ phần nhắc tên sản phẩm.
 */
export function stripProductMentions(answer: string): string {
  if (!answer) return answer;

  const catalog = buildProductCatalog();
  if (catalog.length === 0) return answer;

  const lines = answer.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    // Bỏ hẳn dòng nào chứa URL sản phẩm MADA (dòng link riêng).
    if (/^\s*(?:🔗\s*)?https?:\/\/at\.mada\.org\.qa\/technology\/\S+\s*$/.test(line)) {
      continue;
    }

    kept.push(line);
  }

  let out = kept.join('\n');

  // Xóa các mục danh sách nhắc tên sản phẩm (dòng bắt đầu bằng -, *, •, số).
  out = out
    .split('\n')
    .filter((line) => {
      const isListItem = /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
      if (!isListItem) return true;
      if (/at\.mada\.org\.qa\/technology\//i.test(line)) return false;
      return !mentionsCatalogProduct(line, catalog);
    })
    .join('\n');

  // ⭐ Xóa tên sản phẩm NHÚNG TRONG CÂU (không phải list item).
  //
  // ⚠️ VÌ SAO CẦN: bot hay viết "Bạn đã - JAWS" hoặc "dùng OrCam MyEye nhé"
  // trên cùng một dòng với văn xuôi. Các tên này không bắt đầu bằng bullet nên
  // vòng lọc danh sách ở trên bỏ sót → sau khi xóa link, câu còn sót tên sản
  // phẩm vi phạm quy tắc "chưa đủ 4 câu thì cấm nhắc thiết bị".
  //
  // Cách làm: cắt phần tên sản phẩm ra khỏi dòng, kèm dấu nối phía trước
  // (bullet/dấu phẩy/gạch nối) cho sạch, rồi dọn khoảng trắng thừa.
  //
  // ⚠️ TÊN NGẮN (< 8 ký tự) PHẢI KHỚP HOA THƯỜNG:
  // "Pearl", "Clicker", "Pearl" vừa là tên sản phẩm vừa là từ tiếng Anh có
  // nghĩa ("viên ngọc", "cái bấm") — khớp không phân biệt hoa thường sẽ xóa
  // nhầm rồi làm câu nghĩa đổi. Danh sách chỉ có 33 tên dưới 8 ký tự và đều
  // là thương hiệu viết hoa (JAWS, Osmo, Mabot, Pearl…), nên khớp HOA THƯỜNG
  // vừa bắt được sản phẩm vừa không dính từ thường.
  for (const entry of catalog) {
    const name = (entry.title || '').trim();
    if (name.length < 4) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isShort = name.length < 8;
    // Tên ngắn: bỏ cờ 'i' (bắt buộc đúng hoa thường như DB).
    // Tên dài: cho phép không phân biệt hoa thường (người dùng hay gõ sai).
    const flags = isShort ? 'gm' : 'gim';
    const w = (p: string) => (isShort ? p : `${p}`);
    const wordStart = isShort ? '' : '\\b';
    const wordEnd = isShort ? '' : '\\b';

    // Dòng CHỈ CÒN tên sản phẩm (sau khi link đã bị xóa) → xóa cả dòng.
    out = out.replace(
      new RegExp(
        `^\\s*(?:[-–—•*]|\\d+[.)])?\\s*${w(wordStart)}${escaped}${w(wordEnd)}[,:;]?\\s*$`,
        flags
      ),
      ''
    );
    // Tên nằm GIỮA văn xuôi → gỡ ra cùng dấu nối đứng trước.
    out = out.replace(
      new RegExp(
        `(?:^|\\s)[-–—•*]?\\s*${w(wordStart)}${escaped}${w(wordEnd)}[,:;]?`,
        flags
      ),
      ''
    );
  }

  out = out
    // ⚠️ DÙNG CLASS [\t ] THAY VÌ \s, VÀ LOẠI TRỪ DÒNG RỖNG:
    // Regex cũ dùng \s* → \s khớp CẢ ký tự xuống dòng, nên dòng trống bị hiểu
    // là "dòng chỉ còn dấu câu" và bị XOÁ. Hậu quả: \n\n → \n → markdown gộp
    // header với câu đầu tiên vào cùng thẻ <p> → header dính liền câu.
    //
    // Ngoài ra `[\t ]*X?[\t ]*Y?[\t ]*` khớp CẢ CHUỖI RỖNG (mọi phần đều
    // optional) → dòng "" cũng bị xoá. Phải yêu cầu có ít nhất 1 ký tự thực.
    // Dòng rỗng / chỉ khoảng trắng → GIỮ (phân tách thẻ <p> trong markdown).
    // Dòng chỉ còn dấu câu hoặc bullet rỗng (---, ***, -, …) → XOÁ.
    .split('\n')
    .filter((line) => {
      if (/^[\t ]*$/.test(line)) return true; // dòng trống → giữ
      if (/^[\t ]*(?:[-–—•*][\t ]*){1,}[,.]?[\t ]*$/.test(line)) return false; // --- *** -
      if (/^[\t ]*[,.…;:]+[\t ]*$/.test(line)) return false; // , ; : …
      return true;
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Bảo toàn dòng trống (đây là thứ tách thẻ <p> trong markdown).
    .replace(/(?:^[ \t]*\n){2,}/gm, '\n\n')
    .trim();

  return out;
}

/**
 * ⭐ Dọn CÂU BỊ CẮT CỤT do việc xóa dòng sản phẩm.
 *
 * ⚠️ VÌ SAO CẦN: khi bot viết câu dài rồi nhắc tên sản phẩm ở DÒNG KẾ TIẾP
 * (ví dụ "Bạn đã\n- JAWS\nhttps://…"), hàm trên xóa dòng sản phẩm → biến
 * "Bạn đã" thành câu đứt dừng, người dùng thấy bot "trả lời cụt lủn" mà
 * không hiểu vì sao.
 *
 * Cách xử lý: phát hiện câu cuối không kết thúc bằng dấu câu (?!.…) VÀ quá
 * ngắn (≤ 60 ký tự), rồi ghép nó lại với câu kế tiếp — hoặc bỏ hẳn nếu bỏ đi
 * không còn ý nghĩa.
 */
export function repairTruncatedSentences(answer: string): string {
  if (!answer) return answer;

  const endsCleanly = /[?!.…"')\]]\s*$/.test(answer.trim());
  if (endsCleanly) return answer;

  const lines = answer.split('\n').map((l) => l.trim()).filter(Boolean);

  // Trường hợp 1: chỉ còn MỘT câu ngắn bị cắt.
  // ⚠️ KHÔNG trả về '' — bot im lặng còn tệ hơn trả lời sai. Thay bằng câu
  // có nghĩa, nói thẳng là chưa đủ thông tin để tư vấn thiết bị.
  if (lines.length === 1 && !/[?!.…]/.test(lines[0]) && lines[0].length <= 60) {
    return 'Bạn cần cho mình biết thêm một chút về tình trạng của bạn để mình có thể tư vấn chính xác hơn nhé.';
  }

  // Trường hợp 2: câu cuối bị cắt cụt → nối vào câu liền trước cho tự nhiên.
  const last = lines[lines.length - 1];
  const noPunctuation = !/[?!.…]/.test(last);
  if (noPunctuation && last.length <= 60 && lines.length > 1) {
    const prev = lines[lines.length - 2];
    // Câu trước đã có dấu kết → câu cắt là một mảnh rời, không nối vào được.
    if (!/[?!.…]\s*$/.test(prev)) {
      lines[lines.length - 2] = `${prev} ${last}`;
      lines.pop();
      const merged = lines.join('\n');
      return /[?!.…"')\]]\s*$/.test(merged) ? merged : `${merged}…`;
    }
  }

  return `${answer.replace(/\s+$/, '')}…`;
}

/** Dòng có chứa tên sản phẩm nào trong catalog MADA không. */
function mentionsCatalogProduct(line: string, catalog: ReturnType<typeof buildProductCatalog>): boolean {
  const lower = line.toLowerCase();
  for (const entry of catalog) {
    const name = (entry.title || '').toLowerCase().trim();
    // Tên quá ngắn (VD "VN", "ST") dễ khớp nhầm → bỏ qua.
    if (name.length < 5) continue;
    if (lower.includes(name)) return true;
  }
  return false;
}

/**
 * Chèn link MADA dưới mỗi tên sản phẩm hợp lệ trong câu trả lời.
 *
 * Thay vì dựa vào model tự viết link (không đáng tin), ta tự chèn link chính
 * xác từ DB. Nhờ vậy link luôn đúng và không bao giờ bị bịa.
 *
 * ⭐⭐ LỌC THEO CHUYÊN MÔN BOT:
 * Chỉ gắn link cho sản phẩm bot ĐƯỢC PHÉP nhắc. Nếu không lọc, bot-mobility
 * có thể gắn link sản phẩm của bot-speech (VD "CoughDrop AAC") vào câu trả
 * lời → người dùng thấy bot giới thiệu thiết bị không đúng chuyên môn.
 *
 * @param answer      Câu trả lời gốc.
 * @param botId       Bot đang trả lời (dùng để lọc chuyên môn).
 * @param allowTitles Tên sản phẩm được phép nhắc dù ngoài chuyên môn
 *                    (VD user hỏi thẳng "CoughDrop AAC là gì?").
 * @returns Câu trả lời đã chèn link dưới tên sản phẩm.
 */
export function appendProductLinks(
  answer: string,
  botId?: string | null,
  allowTitles?: Set<string> | null
): string {
  if (!answer) return answer;

  const catalog = buildProductCatalog();
  if (catalog.length === 0) return answer;

  // ⭐⭐⭐ LOẠI SẢN PHẨM NGOÀI CHUYÊN MÔN KHỎI CÂU TRẢ LỜI.
  //
  // VÌ SAO PHẢI LOẠI (không chỉ bỏ link):
  // Bot có thể tự nhắc tên sản phẩm của bot khác trong văn xuôi (không in đậm,
  // không kèm link). Chỉ bỏ link thì người dùng VẪN thấy tên sản phẩm sai
  // chuyên môn → đúng triệu chứng "bot giới thiệu thiết bị không đúng của
  // riêng nó". Phải gỡ cả TÊN khỏi câu trả lời.
  //
  // ⚠️ CHỈ gỡ tên sản phẩm ĐANG ĐƯỢC NHẮC trong câu (có mặt trong text),
  //    không gỡ mọi tên trong catalog (sẽ làm hỏng cả câu trả lời).
  const outOfScope = findOutOfScopeProducts(answer, botId, catalog, allowTitles);
  let out = answer;
  for (const { name } of outOfScope) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Tên nằm trong **bold** → gỡ cả dấu in đậm.
    out = out.replace(
      new RegExp(`\\*\\*\\s*${escaped}\\s*\\*\\*`, 'gi'),
      ''
    );
    // Tên nằm trong văn xuôi (không in đậm) → gỡ kèm dấu nối phía trước.
    out = out.replace(
      new RegExp(`(?:^|\\s)[-–—•*]?\\s*${escaped}[,:;]?`, 'gim'),
      ''
    );
  }
  out = out
    .split('\n')
    .filter((line) => {
      if (/^[\t ]*$/.test(line)) return true;
      if (/^[\t ]*(?:[-–—•*][\t ]*){1,}[,.]?[\t ]*$/.test(line)) return false;
      if (/^[\t ]*[,…;:]+[\t ]*$/.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ⭐ Sau khi gỡ tên ngoài chuyên môn, câu có thể bị cắt cụt → sửa lại.
  out = repairTruncatedSentences(out);

  const missing = findProductsMissingLink(out, catalog);

// ⭐ KHÔNG return sớm khi không thiếu link — vì câu trả lời vẫn có thể cần
  // BƯỚC CHUẨN HOÁ (thêm emoji 🔗 cho link bot tự viết). Nếu return ở đây thì
  // link trần sẽ không bao giờ được chuẩn hoá.

// ⭐⭐ CHUẨN HOÁ LINK SẴN CÓ: bot thường tự viết link MADA nhưng KHÔNG kèm
  // emoji "🔗" (thường là dòng ngay dưới tên sản phẩm). Người dùng cần link
  // nổi bật và nhất quán, nên ta thêm "🔗" cho mọi URL trần của MADA.
  //
  // ⚠️ CHỈ xử lý URL đứng RIÊNG một dòng (hoặc đứng sau 1 ký tự ngay trước).
  // Nếu quét mọi URL ở giữa văn bản, sẽ chèn "🔗" vào giữa câu tiếng Việt và
  // làm nội dung đọc lộn xộn.
  out = out.replace(
    /^([ \t]*)((?:https?:\/\/)at\.mada\.org\.qa\/technology\/\S+)[ \t]*$/gim,
    (_m, indent: string, url: string) =>
      /🔗/.test(indent) ? `${indent}${url}` : `${indent}🔗 ${url}`
  );

for (const { name, url } of missing) {
    // Escape các ký tự regex của tên sản phẩm
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Tìm dòng chứa tên sản phẩm (hỗ trợ **Tên** hoặc Tên)
    // Nếu dòng đó đã có link → bỏ qua
    const lineRegex = new RegExp(
      `^([^\\n]*\\b${escaped}\\b[^\\n]*)$`,
      'gmi'
    );

    out = out.replace(lineRegex, (fullLine, content: string) => {
      if (content.includes(url) || content.includes('http')) return fullLine;

      const indent = fullLine.match(/^\s*/)?.[0] ?? '';
      const trimmed = content.trimEnd();

      // Giữ định dạng list (-, *, •, số) nếu có
      const bulletMatch = trimmed.match(/^(\s*(?:[-*•]|\d+[.)])\s+)/);
      const bullet = bulletMatch ? bulletMatch[1] : indent;
      const body = bulletMatch ? trimmed.slice(bulletMatch[1].length) : trimmed;

      return `${bullet}${body}\n${indent}🔗 ${url}`;
    });

    // ⭐ Dòng vừa chèn link có thể ĐỨT RỜI vì tên sản phẩm nằm giữa câu
    // (VD: "Bạn đã gặp tình trạng mờ mắt, nên dùng JAWS giúp bạn đọc dễ hơn"
    // → link bị chèn ngay sau tên làm câu gãy). Sửa nối lại sau khi chèn.
    out = repairTruncatedSentences(out);
  }

  return out;
}