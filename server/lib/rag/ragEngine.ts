// @ts-nocheck
import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';
import { vectorStore } from './vectorStore';
import { rerankService, type RerankableItem } from './rerankService';
import db from '../db';
import { sanitizeContextForPrompt, sanitizeAssistantAnswer, createStreamingSanitizer } from '../responseSanitizer';
import { appendProductLinks, stripProductMentions, repairTruncatedSentences } from '../productLinkInjector';
import { removeFabricatedContent } from '../fabricationGuard';
import { CONSULT_4_QUESTIONS, CONSULT_NOW_RULES, SINGLE_PRODUCT_RULES } from '../prompts/systemPrompts';
import { productCategoriesForBot, resolveProductOwner } from '../categoryMapping';
import { productBelongsToBot, isExclusiveToBot } from '../productTaxonomy';

/**
 * ⭐⭐ TUYỆT ĐỐI KHÔNG LẶP HEADER ĐỊNH DANH.
 *
 * Header "📋 **6 CHUYÊN GIA CHUYÊN MÔN — TỔNG HỢP KIẾN THỨC**" hoặc
 * "📋 **CHUYÊN GIA THÍNH GIÁC MADA — TƯ VẤN CHUYÊN SÂU**" chỉ nên hiện ĐÚNG
 * 1 LẦN ở lượt đầu tiên. Nếu lặp ở mọi lượt, người dùng thấy nó "đọc nhức
 * đầu" và mất thiện cảm.
 *
 * Hàm này kiểm tra lịch sử hội thoại: nếu header đã từng xuất hiện ở một tin
 * nhắn nào của bot, trả về true để bỏ qua header ở lượt hiện tại.
 */
export function hasShownIdentityHeader(
  conversationHistory: Array<{ role: string; content: string }> = []
): boolean {
  // Dòng bắt đầu bằng 📋 ** và chứa từ khóa định danh của các bot.
  // ⚠️ Không bắt buộc kết thúc bằng \n: header có thể bị dính liền câu chào
  // ("📋 **…** Chào bạn!") — vẫn phải tính là đã hiện để chống lặp.
  const headerLine = /^\s*📋\s*\*\*[^\n]*(CHUYÊN GIA|خبراء|EXPERTS)/i;
  return (conversationHistory || []).some(
    (m) => m?.role === 'assistant' && headerLine.test(m.content || '')
  );
}

/**
 * Gỡ dòng header định danh ở đầu câu trả lời (nếu có).
 *
 * Chỉ xóa dòng header ở vị trí ĐẦU câu trả lời — không đụng vào nội dung thật
 * ở giữa bài, để không mất thông tin khi người dùng nhắc lại tên bot.
 *
 * ⚠️ VÌ SAO DÙNG NON-GREEDY `(?:[^*\n]|\*(?!\*))+`:
 * Regex cũ dùng `[^\n]*\*\*` (tham lam) → khớp tới dấu `**` CUỐI CÙNG trên
 * dòng, nuốt luôn câu chào phía sau nếu câu đó có bold:
 *   "📋 **6 CHUYÊN GIA** Chào bạn, mình là **MADA** nhé!" → chỉ còn "nhé!"
 * Bản non-greedy chỉ ăn tới dấu `**` ĐẦU TIÊN (đóng header) → câu chào giữ
 * nguyên. Đồng thời chấp nhận header dính liền câu chào trên cùng dòng.
 */
export function stripIdentityHeader(answer: string): string {
  if (!answer) return answer;
  return answer
    .replace(
      /^\s*📋[ \t]*\*\*((?:[^*\n]|\*(?!\*))+?)\*\*[ \t]*(?:\n+|(?=\S))/i,
      ''
    )
    .replace(/^\s*\n+/, '')
    .trimStart();
}

/**
 * ⭐⭐⭐ Gỡ lời CHÀO ở giữa cuộc trò chuyện.
 *
 * ⚠️ VÌ SAO CẦN (lớp phòng thủ SAU prompt):
 * Mỗi bot có lời mở đầu sẵn trong identity ("Chào bạn! Mình là MADA…"). Dù
 * đã có chỉ thị cấm trong prompt, model VẪN hay chào lại ở lượt thứ 5, thứ
 * 10. Hàm này xoá hẳn để người dùng không thấy bot "đọc nhức đầu".
 *
 * ⚠️ CHỈ gọi khi ĐÃ có lượt trước — lượt đầu tiên thì lời chào là đúng.
 *
 * @param answer Câu trả lời cần làm sạch.
 * @returns Câu trả lời đã bỏ lời chào + giới thiệu lại danh tính ở đầu.
 */
export function stripMidConversationGreeting(answer: string): string {
  if (!answer) return answer;
  let out = answer.trimStart();

  // Gỡ header định danh trước (nếu có) để lời chào nằm ở đầu tuyệt đối.
  out = stripIdentityHeader(out);

  // Tiền xử lý: gỡ markdown bao quanh lời chào. "**Chào bạn**," phải bỏ CẢ
  // cặp "**" đóng lại, nếu không sẽ còn sót "Chào bạn**" rác trong câu.
  out = out.replace(
    /^\s*(?:[-–—•>]\s*|\d+[.)]\s*)?\*{0,2}\s*(?:chào bạn|xin chào|chào|hello|hi|rất vui được hỗ trợ bạn|rất hân hạnh)\s*[,.!…]?\s*\*{0,2}\s*/i,
    ''
  );
  out = out.replace(/^\s*[,;:]+\s*/, '');
  // Markdown/bullet rơi vụn ở đầu.
  out = out.replace(/^\s*(?:[-–—•>#]+\s*|\d+[.)]\s*|\*{1,2})\s*/i, '');

  // Lời chào + tự giới thiệu. Áp dụng TỐI ĐA 2 lần: lời chào và khối giới
  // thiệu thường viết liền nhau ("Chào bạn! Mình là… Xin chào bạn!"), nhưng
  // không giới hạn thì sẽ cắn mất nội dung thật phía sau.
  const GREETINGS: RegExp[] = [
    /^\s*(?:chào bạn|xin chào|chào|hello|hi|good (?:morning|afternoon|evening))[!,.\s]*(?:mình là|chúng tôi là|chúng tôi có tên là|tôi là|this is|my name is|i am|i'm)[^\n.!?]{0,120}[.!?]?(?:\s*(?:xin\s+chào|chào)\s*b[aạ]n[.!?]?)?/i,
    /^\s*(?:rất vui được hỗ trợ bạn[^.!?\n]{0,80}[.!?]?|rất hân hạnh[^.!?\n]{0,80}[.!?]|rất vui khi được[^.!?\n]{0,80}[.!?]?|pleased to (?:help|assist)[^.!?\n]{0,80}[.!?]?|happy to help[^.!?\n]{0,80}[.!?]?)/i,
    // ⭐ "Chào bạn," / "Xin chào," CHỈ mà không kèm tự giới thiệu — rất hay gặp:
    // bot mở đầu mọi câu bằng "Chào bạn, mình hiểu bạn 45 tuổi…".
    // ⚠️ Cần ít nhất 1 ký tự đữ sau "chào" để KHÔNG khớp câu lời chào đứng
    // riêng ("Xin chào các bạn…") — loại đó vẫn phải giữ nguyên.
    /^\s*(?:chào bạn|hello|hi)[!,.]?\s+(?!$)/i,
  ];

  for (const re of GREETINGS) {
    out = out.replace(re, '').replace(/^\s*[,;:]+\s*/, '');
  }
  // Vòng lặp nhẹ cho trường hợp lời chào + giới thiệu viết liền nhiều lần.
  for (let i = 0; i < 2; i++) {
    const before = out;
    for (const re of GREETINGS) out = out.replace(re, '');
    if (out === before) break;
  }

  out = out.replace(/^\s*[*_~#>\-•\s]+/, '').trimStart();

  // ⚠️ Lời chào đứng RIÊNG một mình ("Chào bạn." / "Xin chào!") — gỡ nốt.
  // Nếu gỡ mà rỗng thì trả về rỗng (tin nhắn rỗng còn hơn hiện lời chào lặp).
  if (/^\s*\**\s*(?:chào bạn|xin chào|chào|hello|hi)\s*\**[.!?…]?\s*$/i.test(out)) {
    return '';
  }

  return out;
}

/**
 * ⭐ Đánh dấu câu trả lời bị cắt cụt do chạm trần token (finishReason=MAX_TOKENS).
 *
 * ⚠️ VÌ SAO CẦN: khi Gemini dừng giữa chừng, câu cuối thường bị cắt ở giữa từ
 * ("...tiếp tục tận hưởng"). Người dùng không biết là bot hết dữ liệu hay mất
 * kết nối. Gắn "…" + ghi chú ngắn giúp họ hiểu câu đang dang dở và hỏi tiếp.
 *
 * @param answer Câu trả lời đầy đủ (chưa chỉnh sửa).
 * @param lang   Ngôn ngữ để chọn ghi chú phù hợp.
 */
export function markTruncated(answer: string, lang: string = 'vi'): string {
  const out = (answer || '').replace(/\s+$/, '');
  if (!out) return out;

  // Đã có dấu kết hợp lệ → coi như trọn vẹn, không đụng vào.
  if (/[?!….""')\]]\s*$/.test(out)) return out;

  const note =
    lang === 'en'
      ? '\n\n_(This response was cut short due to length. Feel free to ask me to continue.)_'
      : '\n\n_(Câu trả lời bị ngắn do độ dài. Bạn có thể nhờ mình viết tiếp phần còn lại.)_';

  // Cắt đúng ranh giới từ gần nhất để không để lại mảnh chữ lơ lửng.
  const words = out.split(' ');
  if (words.length > 12) {
    const trimmed = words.slice(0, words.length - 2).join(' ');
    return `${trimmed}…${note}`;
  }

  return `${out}…${note}`;
}

// ============ PROXY-AWARE FETCH ============
// Use proxy if configured (respects HTTP_PROXY/HTTPS_PROXY env vars)
async function proxyAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Simply use regular fetch - Node.js 18+ respects HTTP_PROXY/HTTPS_PROXY env vars
  return fetch(input, init);
}

// Retry helper with exponential backoff — for handling 429 Too Many Requests from Gemini API
async function fetchWithRetry(
  fn: () => Promise<Response>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 1000, maxDelayMs = 16000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fn();

    // 429 (rate limit) và 500/502/503/504 (Gemini quá tải) — retry với backoff
    if (response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504) {
      if (attempt === retries) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API error: 429 Too Many Requests (after ${retries} retries). ${body}`);
      }

      // Read retry-after hint if present, otherwise use exponential backoff
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

      console.warn(`⚠️ [Gemini 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${retryDelay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }

    return response;
  }

  // Should not reach here, but satisfy TypeScript
  throw new Error('fetchWithRetry: unreachable');
}

// Direct Gemini API call that bypasses proxy, with automatic 429 retry
//
// ⚠️ maxOutputTokens PHẢI lớn: Gemini 2.5 dùng "thinking mode" — token suy nghĩ
// (`thoughtsTokenCount`) tính VÀO cùng maxOutputTokens. Đo thực tế: với
// maxOutputTokens=2048, model dùng 1963 token để suy nghĩ → chỉ còn 85 token
// cho câu trả lời → sinh ra 312 ký tự rồi CỤT giữa chừng, finishReason =
// MAX_TOKENS. Nên mốc tối thiểu là 8192, dùng 16384 cho chắc.
const GEMINI_MIN_OUTPUT_TOKENS = 16384;

async function callGeminiDirect(
  apiKey: string,
  modelName: string,
  prompt: string,
  tools?: any,
  opts?: { systemInstruction?: string; contents?: any[]; maxOutputTokens?: number }
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: opts?.contents && opts.contents.length > 0
      ? opts.contents
      : [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      // ⭐ maxOutputTokens bên dưới là trần của phần trả lời; phần suy nghĩ có
      // trần riêng (thinkingConfig) nên không tranh nhau ở đây.
      maxOutputTokens: Math.max(opts?.maxOutputTokens ?? GEMINI_MIN_OUTPUT_TOKENS, GEMINI_MIN_OUTPUT_TOKENS),
      topP: 0.8,
      topK: 20,
    },
  };

  // ⚠️ Tách "suy nghĩ" ra khỏi ngân sách trả lời. Không có dòng này, thinking
  // mode ăn hết maxOutputTokens và câu trả lời bị cắt cụt.
  body.generationConfig.thinkingConfig = {
    thinkingBudget: opts?.thinkingBudget ?? 2048,
  };

  if (opts?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  if (tools?.length > 0) {
    body.tools = tools;
  }

  const response = await fetchWithRetry(
    () => proxyAwareFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { retries: 3, baseDelayMs: 2000, maxDelayMs: 16000 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============ SCHEMA DEFINITIONS ============

/**
 * Structured output schema for RAG chat response (Task 5)
 * Ensures model returns JSON with predictable structure
 */
const RAG_RESPONSE_SCHEMA: FunctionDeclaration = {
  name: 'rag_response',
  description: 'MADA AI RAG response với cấu trúc JSON chuẩn',
  parameters: {
    type: 'object',
    properties: {
      replyText: {
        type: 'string',
        description: 'Câu trả lời chính bằng ngôn ngữ của user, tối đa 5 câu, có markdown formatting'
      },
      confidence: {
        type: 'number',
        description: 'Độ tin cậy từ 0.0 đến 1.0, dựa trên context và relevance'
      },
      devices: {
        type: 'array',
        description: 'Danh sách thiết bị AT được đề cập',
        items: { type: 'string' }
      },
      standardsHighlight: {
        type: 'array',
        description: 'Tiêu chuẩn ISO/WHO/WCAG được đề cập',
        items: { type: 'string' }
      }
    },
    required: ['replyText', 'confidence']
  }
};

// System prompt - Thân thiện, có dấu, tự nhiên như chuyên gia thật
const SYSTEM_PROMPT = `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT) cho người khuyết tật tại Việt Nam, được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).

🎯 CÁCH TRẢ LỜI:
- Trả lời bằng ngôn ngữ của người dùng (Việt/Anh/Pháp/Ár)
- Giọng văn thân thiện, ấm áp, chuyên nghiệp - như một chuyên gia đang tư vấn trực tiếp
- Dùng "mình" hoặc "tôi" cho tự nhiên (tùy ngữ cảnh)
- Trả lời NGẮN GỌN, SÚC TÍCH - tối đa 4-6 câu, đi thẳng vào vấn đề
- KHÔNG lặp lại câu hỏi của người dùng
- KHÔNG dùng ngôn ngữ máy móc, khô khan

⚠️ QUAN TRỌNG - VỀ LINK/SURL:
- KHÔNG BAO GIỜ tự tạo URL hay link trong câu trả lời
- KHÔNG bịa đặt URL như "https://at.mada.org.qa/technology/..." 
- Nếu cần gợi ý sản phẩm: CHỈ ghi TÊN SẢN PHẨM, KHÔNG ghi URL
- Link sản phẩm sẽ được hệ thống tự động gắn vào card sản phẩm bên dưới

📋 NỘI DUNG CẦN CÓ:
- Tên sản phẩm cụ thể (KHÔNG kèm link trong text)
- Giá tham khảo (VND/USD) - chỉ khi có trong dữ liệu
- Đối tượng phù hợp (trẻ em, người lớn, người cao tuổi...)
- Ưu điểm nổi bật 1-2 dòng
- Tiêu chuẩn/ISO codes nếu có (WCAG, ISO 9999, etc.)

🎨 FORMAT:
- Dùng danh sách gạch đầu dòng (-) hoặc đánh số (1., 2., 3.) khi liệt kê sản phẩm
- **In đậm** tên sản phẩm
- Có thể dùng bảng khi so sánh
- Emoji vừa phải (1-2 emoji/đoạn) cho sinh động

⚠️ GIỚI HẠN:
- KHÔNG đưa ra lời khuyên y tế, chẩn đoán bệnh
- KHÔNG tự xưng "bác sĩ" hay "chuyên gia y tế"
- KHÔNG trả lời các vấn đề ngoài phạm vi AT (giáo dục thông thường, y tế đại chúng, etc.)
- Nếu câu hỏi về y tế: "Xin lỗi, mình chỉ hỗ trợ tư vấn về Công nghệ Hỗ trợ (AT). Về các vấn đề y tế, bạn nên tham khảo ý kiến bác sĩ chuyên khoa nhé."

💡 VỀ DỮ LIỆU:
- Nếu CÓ thông tin trong [THÔNG TIN TỪ CƠ SỞ TRI THỨC]: dùng thông tin đó
- Nếu KHÔNG CÓ hoặc THÔNG TIN ÍT: DÙNG KIẾN THỨC CHUNG của bạn về Công nghệ Hỗ trợ để trả lời! Đừng nói "không tìm thấy" - hãy tư vấn dựa trên kiến thức AT của bạn
- Bạn có kiến thức rộng về: thiết bị hỗ trợ người khiếm thị, người khiếm hearing, xe lăn, thiết bị giao tiếp AAC, công nghệ hỗ trợ nhận thức, vật dụng sinh hoạt hàng ngày, v.v.

💡 VÍ DỤ MẪU:

Câu hỏi: "Cho tôi xin thiết bị hỗ trợ người khiếm thị đọc sách"

Trả lời mẫu (ĐÚNG - KHÔNG có URL):
Dưới đây là 3 thiết bị phổ biến cho người khiếm thị đọc sách:

1. **NVDA** (Miễn phí) - Phần mềm đọc màn hình mã nguồn mở, hỗ trợ tiếng Việt
   - Phù hợp: Người khiếm thị dùng máy tính
   - Ưu điểm: Miễn phí 100%, cộng đồng hỗ trợ lớn

2. **Ruby HD** - Kính lúp điện tử cầm tay
   - Phù hợp: Người già thị lực kém, học sinh
   - Ưu điểm: Phóng to 2-24x, gọn nhẹ, dễ mang theo

3. **BrailleSense Polaris** - Máy đọc chữ nổi
   - Phù hợp: Người khiếm thị thành thạo chữ Braille
   - Ưu điểm: Hiển thị chữ nổi, kết nối WiFi, đọc PDF

Bạn muốn mình tư vấn kỹ hơn về thiết bị nào không? 😊`;

/**
 * ⭐ i18n hóa phần "tail prompt" (CHỈ DẪN TRẢ LỜI) của buildPrompt.
 * Trước đây cứng tiếng Việt không dấu, nay đa ngôn ngữ.
 */
interface RagTailPrompt {
  userLabel: string;
  aiLabel: string;
  guidanceTitle: string;
  guidanceRules: string[];
  contextHeader: string;
  historyHeader: string;
  questionHeader: string;
  answerPrompt: string;
}

const RAG_TAIL_PROMPTS: Record<'vi' | 'en' | 'ar' | 'fr', RagTailPrompt> = {
  vi: {
    userLabel: 'Người dùng',
    aiLabel: 'MADA AI',
    guidanceTitle: 'CHỈ DẪN TRẢ LỜI',
    guidanceRules: [
      '⚠️ QUAN TRỌNG: KHÔNG BAO GIỜ tự tạo URL hay link trong câu trả lời',
      '⚠️ KHÔNG bịa đặt URL như "https://at.mada.org.qa/technology/..."',
      '⚠️ Chỉ ghi TÊN SẢN PHẨM, KHÔNG ghi URL. Link sẽ được hệ thống gắn tự động',
      'Trả lời NGẮN GỌN, ĐÚNG TRỌNG TÂM câu hỏi',
      'Nếu CÓ thông tin trong [THÔNG TIN TỪ CƠ SỞ TRI THỨC]: dùng thông tin đó',
      'Nếu KHÔNG CÓ hoặc ÍT thông tin: DÙNG KIẾN THỨC CHUNG về Công nghệ Hỗ trợ để trả lời!',
    ],
    contextHeader: '📚 THÔNG TIN TỪ CƠ SỞ TRI THỨC',
    historyHeader: '📝 LỊCH SỬ',
    questionHeader: '❓ Câu hỏi',
    answerPrompt: '🤖 Trả lời ngắn gọn, đúng trọng tâm (KHÔNG ghi URL):'
  },
  en: {
    userLabel: 'User',
    aiLabel: 'MADA AI',
    guidanceTitle: 'ANSWER GUIDELINES',
    guidanceRules: [
      '⚠️ IMPORTANT: NEVER invent or create URLs/links in your answer',
      '⚠️ DO NOT make up URLs like "https://at.mada.org.qa/technology/..."',
      '⚠️ Only write PRODUCT NAMES, NOT URLs. Links will be added automatically by the system',
      'Answer CONCISELY, FOCUSED on the question',
      'If information IS in [KNOWLEDGE BASE CONTEXT]: use that information',
      'If NO or LIMITED information: Use your GENERAL KNOWLEDGE about Assistive Technology to answer!',
    ],
    contextHeader: '📚 KNOWLEDGE BASE CONTEXT',
    historyHeader: '📝 HISTORY',
    questionHeader: '❓ Question',
    answerPrompt: '🤖 Answer concisely and focused (NO URLs):'
  },
  ar: {
    userLabel: 'المستخدم',
    aiLabel: 'MADA AI',
    guidanceTitle: 'إرشادات الإجابة',
    guidanceRules: [
      '⚠️ مهم: لا تقم بإنشاء عناوين URL أو روابط في إجابتك',
      '⚠️ لا تخترع عناوين URL مثل "https://at.mada.org.qa/technology/..."',
      '⚠️ اكتب فقط أسماء المنتجات، وليس عناوين URL. سيتم إضافة الروابط تلقائيًا',
      'أجب بإيجاز، مع التركيز على السؤال',
      'إذا كانت المعلومات موجودة في [سياق قاعدة المعرفة]: استخدم تلك المعلومات',
      'إذا لم تكن هناك معلومات كافية: استخدم معرفتك العامة حول التكنولوجيا المساعدة!',
    ],
    contextHeader: '📚 سياق قاعدة المعرفة',
    historyHeader: '📝 السجل',
    questionHeader: '❓ سؤال',
    answerPrompt: '🤖 أجب بإيجاز وبشكل مركّز (بدون روابط):'
  },
  fr: {
    userLabel: 'Utilisateur',
    aiLabel: 'MADA AI',
    guidanceTitle: 'CONSIGNES DE RÉPONSE',
    guidanceRules: [
      '⚠️ IMPORTANT: Ne JAMAIS inventer ou créer des URL/liens dans votre réponse',
      '⚠️ NE PAS inventer des URLs comme "https://at.mada.org.qa/technology/..."',
      '⚠️ Écrivez uniquement les NOMS DE PRODUITS, PAS les URLs. Les liens seront ajoutés automatiquement',
      'Répondez CONCISÉMENT, en vous concentrant sur la question',
      "Si AUCUNE ou PEU dinformation: Utilisez vos CONNAISSANCES GÉNÉRALES sur la Technologie d'Assistance!",
      "Si l'information EST dans [CONTEXTE BASE DE CONNAISSANCES], RÉPONDEZ immédiatement",
    ],
    contextHeader: '📚 CONTEXTE BASE DE CONNAISSANCES',
    historyHeader: '📝 HISTORIQUE',
    questionHeader: '❓ Question',
    answerPrompt: "🤖 Réponses concise et ciblée (PAS d'URLs):"
  }
};

interface RAGResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    content: string;
    source: string;
    metadata?: any;
    rerankScore?: number;
    rerankReason?: string;
  }>;
  contextUsed: boolean;
  usedRerank?: boolean;
}

interface RAGConfig {
  temperature?: number;
  topK?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  /** ⭐ Ngôn ngữ UI để i18n hóa tail prompt (mặc định 'vi') */
  language?: 'vi' | 'en' | 'ar' | 'fr';
  /** ⭐ MỚI: Filter RAG theo bot ID (e.g. 'bot-hearing') */
  botId?: string;
  /** ⭐ MỚI: Filter RAG theo MADA category slug (e.g. 'sensory-hearing') */
  madaCategory?: string;
  /** ⭐ MỚI: Filter RAG theo custom agent ID (for custom agents like 'kkkk') */
  agentId?: string;
  /** ⭐ MỚI: Nếu true → ưu tiên KB theo filter, nếu thiếu thì fallback toàn bộ KB */
  priority?: boolean;
  /**
   * ⭐ MỚI: Danh mục tên sản phẩm THẬT của MADA (đã format sẵn).
   * Chèn vào prompt để model KHÔNG bịa tên sản phẩm — mọi tên được nhắc
   * đều tồn tại trong DB → luôn gắn được link sản phẩm.
   */
  productCatalog?: string;
  /**
   * ⭐ Chưa đủ 4 câu hỏi tiêu chuẩn → cấm bot nhắc tên sản phẩm.
   * Bot phải tập trung trả lời và để người dùng bổ sung thông tin.
   */
  noProductRecommendation?: boolean;
  /**
   * ⭐ HỎI RIÊNG 1 SẢN PHẨM (đã khớp tên trong kb_products).
   * Khi có giá trị này: bot chỉ được tư vấn đúng sản phẩm đó, không ra thêm
   * sản phẩm khác — người dùng sẽ xem thẻ có ẢNH của chính sản phẩm hỏi.
   */
  singleProductFocus?: string | null;
}

/**
 * Post-process AI response de dam bao format hien thi dung
 */
function postProcessMarkdown(text: string): string {
  let result = text;

  // Pattern 1: "*Ten* - mo ta 1 - mo ta 2" tren 1 dong -> "- **Ten**: mo ta 1. mo ta 2"
  result = result.replace(
    /\*([^*\n]+)\*\s+-\s+([^-\n]+(?:\s+-\s+[^-\n]+)+)/g,
    (_match, name, desc) => {
      const parts = desc.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
      const formatted = parts.map((p) => p.replace(/^[a-z]/, (c) => c.toUpperCase())).join('. ');
      return `- **${name.trim()}**: ${formatted}`;
    }
  );

  // Pattern 2: Dau "-" khong co space truoc khi viet hoa -> ngat dong
  result = result.replace(/([a-z])\s+-\s+([A-Z])/g, '$1.\n- $2');

  // Pattern 3: Sau dau ":" co "*Ten*" ngay -> tach item
  result = result.replace(/(:\s+)\*([^*\n]+)\*/g, (_, _colon, content) => `\n\n- **${content.trim()}**`);

  // Pattern 4: Item "- **Ten**..." dinh lien nhau -> tach
  result = result.replace(/(\S)\s+(- \*\*[^*]+\*\*)/g, '$1\n$2');

  // Cleanup: gop nhieu newline thua
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

class RAGEngine {
  private genAI: GoogleGenerativeAI | null = null;
  private _isConfigured = false;

  get isConfigured(): boolean {
    return this._isConfigured;
  }

  initialize(): void {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is missing or invalid. Set it in .env to enable RAG.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this._isConfigured = true;
    
    // Keep proxy settings - Node.js 18+ respects HTTP_PROXY/HTTPS_PROXY
    console.log('✅ RAG Engine initialized with Gemini (using system proxy if configured)');
  }

  async query(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<RAGResponse> {
    const { topK = 10, systemInstruction, botId, madaCategory, agentId, priority = false } = config;

    try {
      // Initialize if not already
      if (!this._isConfigured) {
        this.initialize();
      }

      // ⚡ PERFORMANCE OPTIMIZATION: Reduce docs retrieved (was topK * 4, now topK * 2)
      let relevantDocs = await this.retrieveDocuments(userQuery, topK * 2, { botId, madaCategory, agentId, priority });

      // ⭐ FIX: Cho phép AI trả lời bằng kiến thức chung khi không có relevantDocs
      // AI có kiến thức về AT, không nên chặn trả lời
      // if (agentId && relevantDocs.length === 0) { ... return "không tìm thấy" ... } // DISABLED

      // Apply re-ranking only if top score is low (relevance uncertain)
      // Re-ranking costs ~2s extra per query. For seed/migration KB, vector search
      // is usually enough. Only rerank when top-1 score < 0.5 (uncertain relevance).
      let finalDocs = relevantDocs;
      let usedRerank = false;

      const topScore = relevantDocs[0]?.score || 0;
      const shouldRerank = topScore < 0.5 && relevantDocs.length > 3;

      if (shouldRerank && rerankService.isReady()) {
        try {
          const items: RerankableItem[] = relevantDocs.map((doc, idx) => ({
            id: doc.id || `doc_${idx}`,
            content: doc.content,
            score: doc.score || 0.5,
            metadata: doc.metadata,
          }));

          const reranked = await rerankService.rerank(userQuery, items, { topN: topK });

          if (reranked.length > 0) {
            finalDocs = reranked.map((r) => ({
              ...r.item,
              score: r.rerankScore,
              metadata: {
                ...r.item.metadata,
                rerankScore: r.rerankScore,
                rerankReason: r.reason,
              },
            }));
            usedRerank = true;
          }
        } catch (error) {
          console.warn('⚠️ Reranking failed, using original order:', error);
        }
      }

      // Build context from retrieved documents
      // ⭐ SANITIZE: loại bỏ metadata nội bộ (Mã SP, Stock, …) + marker prompt
      //    trước khi đưa vào prompt để model không echo nguyên văn ra ngoài.
      let context = '';
      if (finalDocs.length > 0) {
        context = sanitizeContextForPrompt(
          finalDocs
            .map((doc, index) => `[Document ${index + 1}] (Nguồn: ${doc.metadata?.title || doc.metadata?.source || 'Unknown'})\n${doc.content}`)
            .join('\n\n')
        );
      }

      // Build prompt
      const hasContext = context.length > 0;
      const prompt = this.buildPrompt(userQuery, context, conversationHistory, hasContext, systemInstruction, config.language, config.productCatalog, config.noProductRecommendation, config.singleProductFocus);
      const req = this.buildRequest(userQuery, context, conversationHistory, hasContext, systemInstruction, config.language, config.productCatalog, config.noProductRecommendation, config.singleProductFocus);

      // Generate response
      if (!this._isConfigured || !this.genAI) {
        throw new Error('RAG Engine is not initialized. Set GEMINI_API_KEY in .env.');
      }

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash', // ✅ Stable & Fast
        generationConfig: {
          temperature: 0.3, // Low temp = focused, faster
          maxOutputTokens: config.maxOutputTokens || 8192, // ⚠️ Không dùng mốc thấp (2048 cũ)
          topP: 0.8,
          topK: 20,
          // ⚠️ Tách token suy nghĩ khỏi ngân sách trả lời — Gemini 2.5 mặc định
          // dùng chung maxOutputTokens nên câu trả lời bị cắt cụt giữa chừng.
          thinkingConfig: { thinkingBudget: 2048 },
        },
        tools: [{
          functionDeclarations: [RAG_RESPONSE_SCHEMA]
        }],
      });

      // Use direct API call (bypasses proxy issues)
      let structuredResponse: any = null;
      let answer: string;
      let confidence: number;

      try {
        // Call Gemini API directly (no SDK, no proxy)
        const apiKey = process.env.GEMINI_API_KEY!;
        // Trả lời dạng text thuần (không dùng function-calling) để câu trả lời tự nhiên hơn
        const geminiResult = await callGeminiDirect(apiKey, 'gemini-2.5-flash', prompt, undefined, {
          systemInstruction: req.systemText,
          contents: req.contents,
          maxOutputTokens: config.maxOutputTokens,
        });

        // ⚠️ Phát hiện bị cắt vì hết token (non-stream).
        const finishReason = geminiResult?.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          console.warn(
            '[RAG query] ⚠️ Câu trả lời BỊ CẮT (finishReason=MAX_TOKENS) — ' +
            'tăng maxOutputTokens'
          );
        }
        
        // Parse the response
        const candidates = geminiResult?.candidates || [];
        const parts = candidates[0]?.content?.parts || [];
        
        // Try function call first (structured output)
        const functionCallPart = parts.find((p: any) => p.functionCall);
        if (functionCallPart?.functionCall) {
          const fnCall = functionCallPart.functionCall;
          if (fnCall.name === 'rag_response') {
            structuredResponse = fnCall.args;
            answer = postProcessMarkdown(structuredResponse.replyText || '');
            confidence = structuredResponse.confidence || this.calculateConfidence(finalDocs, hasContext);
          } else {
            // Fallback to text from function call args
            const rawAnswer = fnCall.args?.replyText || fnCall.args?.answer || fnCall.args?.text || '';
            answer = postProcessMarkdown(rawAnswer);
            confidence = this.calculateConfidence(finalDocs, hasContext);
          }
        } else {
          // Regular text response
          const textParts = parts.filter((p: any) => p.text);
          const rawAnswer = textParts.map((p: any) => p.text).join('\n');
          answer = postProcessMarkdown(rawAnswer);
          confidence = this.calculateConfidence(finalDocs, hasContext);
        }

        // ⚠️ Nếu bị cắt vì hết token → gắn dấu "…" để người dùng biết câu đang
        // dang dở, thay vì tưởng bot trả lời thiếu/thiếu ý.
        if (answer && finishReason === 'MAX_TOKENS') {
          answer = markTruncated(answer, config.language || 'vi');
        }
      } catch (schemaError: any) {
        console.warn('[RAG] Schema parsing failed, using text fallback:', schemaError.message?.slice(0, 80));
        try {
          // Retry without structured output
          const apiKey = process.env.GEMINI_API_KEY!;
          const geminiResult = await callGeminiDirect(apiKey, 'gemini-2.5-flash', prompt, undefined, {
            systemInstruction: req.systemText,
            contents: req.contents,
          });
          const parts = geminiResult?.candidates?.[0]?.content?.parts || [];
          const textParts = parts.filter((p: any) => p.text);
          const rawAnswer = textParts.map((p: any) => p.text).join('\n');
          answer = postProcessMarkdown(rawAnswer);
          confidence = this.calculateConfidence(finalDocs, hasContext);
        } catch (textError) {
          throw textError;
        }
      }

      // ⭐ SANITIZE: dọn câu trả lời cuối cùng trước khi trả về client
      answer = sanitizeAssistantAnswer(answer);
      // ⭐⭐ CHỐNG BỊA: gỡ tên/giá/URL/nhà bán lẻ không có thật trong DB MADA.
      // Đặt TRƯỚC appendProductLinks để link chèn vào chỉ dùng tên thật.
      // (Log thật đã ghi nhận bot bịa "WHILL Model F", "Hãng: Phonak, Widex",
      //  "3-5 triệu", "mua qua Shopee" — chỉ dựa vào prompt là không đủ.)
      answer = removeFabricatedContent(answer);

      // ⭐ Header định danh chỉ hiện 1 LẦN ở lượt đầu. Nếu đã hiện ở lượt trước
      // mà LLM lại viết lại → gỡ bỏ để không lặp gây khó chịu.
      if (hasShownIdentityHeader(conversationHistory)) {
        answer = stripIdentityHeader(answer);
      }
      // ⭐⭐⭐ Gỡ LỜI CHÀO ở giữa cuộc trò chuyện (thứ tự: sau header).
      // Đã có lượt trước → không được chào lại "Chào bạn! Mình là MADA…".
      if ((conversationHistory || []).some((m) => m?.role === 'user')) {
        answer = stripMidConversationGreeting(answer);
      }
      // Chưa đủ 4 câu hỏi → gỡ tên sản phẩm (prompt một mình không đủ tin cậy).
      if (config.noProductRecommendation) {
        // ⭐ Thứ tự quan trọng: cắt sản phẩm TRƯỚC, rồi mới sửa câu bị cụt.
        // Ngược lại sẽ sửa câu rồi lại cắt → lại còn câu đứt ("Bạn đã").
        answer = repairTruncatedSentences(stripProductMentions(answer));
      } else {
        // Đã đủ → chèn link MADA dưới tên sản phẩm (chỉ tên có thật trong DB).
        answer = appendProductLinks(answer);
      }

      return {
        answer,
        confidence,
        devices: structuredResponse?.devices || [],
        standardsHighlight: structuredResponse?.standardsHighlight || [],
        sources: finalDocs.map((doc) => ({
          content: doc.content?.slice(0, 200) + (doc.content?.length > 200 ? '...' : ''),
          source: doc.metadata?.source || 'Unknown',
          metadata: doc.metadata,
          rerankScore: doc.metadata?.rerankScore,
          rerankReason: doc.metadata?.rerankReason,
        })),
        contextUsed: hasContext,
        usedRerank,
      };
    } catch (error) {
      console.error('❌ RAG query failed:', error);
      throw error;
    }
  }

  /**
   * Fallback: parse raw response từ Gemini khi SDK không parse được.
   *
   * Issue: @google/generative-ai@0.24.x không parse functionCall trong một số trường hợp
   * → Method này parse thủ công từ raw response structure.
   *
   * Supported formats:
   *  1. functionCall.args.replyText (MADA RAG schema)
   *  2. functionCall.args.{answer,response,text} (custom schemas)
   *  3. Inline text trong parts[]
   *  4. response.text() như last resort
   *
   * Returns empty string nếu không tìm thấy content (để caller xử lý fallback).
   */
  private extractAnswerFromRawResponse(result: any): string {
    try {
      const response = result?.response;
      if (!response) return '';

      const candidates = response.candidates || [];
      if (candidates.length === 0) return '';

      const candidate = candidates[0];
      const parts = candidate?.content?.parts || [];

      // 1. Try functionCall.args (structured output)
      for (const part of parts) {
        if (part?.functionCall?.args) {
          const args = part.functionCall.args;
          // Priority order cho MADA schema
          if (args.replyText) return String(args.replyText);
          if (args.answer) return String(args.answer);
          if (args.response) return String(args.response);
          if (args.text) return String(args.text);
          if (args.content) return String(args.content);
          // Last: serialize all args as text
          const keys = Object.keys(args);
          if (keys.length > 0) {
            return keys.map((k) => `${k}: ${args[k]}`).join('\n');
          }
        }
      }

      // 2. Try inline text trong parts
      for (const part of parts) {
        if (part?.text) return String(part.text);
      }

      // 3. Try response.text() như last resort
      try {
        const text = response.text?.();
        if (text) return text;
      } catch {
        // Ignore
      }

      return '';
    } catch (err) {
      console.error('[RAG] Manual parse failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }

  /**
   * Stream query - returns streaming response for real-time updates
   */
  async queryStream(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<{
    stream: AsyncGenerator<{ text: () => string }>;
    sources: RAGResponse['sources'];
    confidence: number;
    answer: string;
  }> {
    if (!this._isConfigured) {
      this.initialize();
    }

    const topK = config.topK || 10;
    const { botId, madaCategory, agentId, priority = false } = config;

    // Retrieve relevant documents (với filter MADA nếu có)
    const rawDocs = await this.retrieveDocuments(userQuery, topK * 4, { botId, madaCategory, agentId, priority });

    // ⭐ FIX: Pinecone trả score=1.0 cho mọi doc (do metric config), không dùng được.
    // → BẮT BUỘC gọi rerankService (LLM-based) để có relevance score thật.
    // Nếu rerank fail → fallback dùng rawDocs nhưng đánh confidence thấp.
    let relevantDocs: any[] = rawDocs;
    let usedRerank = false;

    // ⭐ Custom agent KHÔNG có dữ liệu → tìm sản phẩm trong DB theo category làm context
    // Thay vì trả lời "không tìm thấy" → cho AI giới thiệu sản phẩm có sẵn
    if (agentId && relevantDocs.length === 0) {
      console.log(`⚠️ [RAG Stream] Agent "${agentId}" - no relevant docs found, fetching products as fallback`);

      const lang = config.language || 'vi';
      const labelHeader = lang === 'en' ? 'Available products in our database' : 'Các sản phẩm hiện có trong cơ sở dữ liệu';

      // Fetch top products từ kb_products theo botId / madaCategory
      let productContext = '';
      try {
        // Bot này nhận category nào trong kb_products.
        // ⚠️ KHÔNG map cứng 1 category: `mobility` trộn xe lăn (Bot 6) + nẹp/chuột
        // (Bot 5). Dùng `productCategoriesForBot()` để lấy đủ category, rồi lọc
        // theo `resolveProductOwner()` để mỗi bot chỉ nhận sản phẩm đúng chuyên môn.
        const wantedCats = productCategoriesForBot(config.botId || agentId, madaCategory);

        let products: any[] = [];
        if (wantedCats.length > 0) {
          const placeholders = wantedCats.map(() => '?').join(',');
          const selectRows = (limit: number) =>
            db.prepare(
              `SELECT title, title_en, description, category, brand, price_range,
                      product_url, source_url, image_url
               FROM kb_products
               WHERE category IN (${placeholders}) AND status = 'published'
               ORDER BY featured DESC, sort_order DESC, created_at DESC
               LIMIT ?`
            ).all(...wantedCats, limit) as any[];

          const owner = config.botId || agentId;
          // ⭐ Lọc theo taxonomy MADA (nguồn chuẩn, đa nhãn). Lọc bằng
          // `resolveProductOwner()` chỉ suy đoán từ tên sản phẩm và bỏ sót các
          // sản phẩm MADA khai thuộc nhiều nhóm (proloquo2go, esight-4…).
          const keep = (p: any) =>
            productBelongsToBot(p.product_url || p.source_url, owner) ||
            resolveProductOwner(p.category, p.title)?.botId === owner;

          const owned = selectRows(200).filter(keep);
          // ⭐ Ưu tiên sản phẩm ĐỘC QUYỀN. Bot nào có sản phẩm riêng thì không
          // gợi ý sản phẩm đa nhãn — nếu không bot-mobility sẽ dẫn đầu bằng
          // eSight 4 / Tobii PCEye 5 (thị giác) và Quha Dwell (cơ xương khớp).
          const exclusive = owned.filter((p) =>
            isExclusiveToBot(p.product_url || p.source_url, owner)
          );
          products = exclusive.length > 0 ? exclusive : owned;

          // ⭐ ANTI-REPEAT: Filter out already-recommended products
          const recommendedSet = getRecommendedProducts(conversationId || '');
          products = products.filter(p => !recommendedSet.has((p.title || '').toLowerCase()));

          // If all products were already recommended, fetch more (expand LIMIT and filter again)
          if (products.length === 0 && recommendedSet.size > 0) {
            const all = selectRows(400).filter(keep);
            const excl = all.filter((p) => isExclusiveToBot(p.product_url || p.source_url, owner));
            const pool = excl.length > 0 ? excl : all;
            products = pool.filter(
              (p) => !recommendedSet.has((p.title || '').toLowerCase())
            );
          }

          products = products.slice(0, 5);
        }
        // ⭐ FIX: KHÔNG fallback sang tất cả sản phẩm nếu category không match
        // Nếu không có sản phẩm đúng category → bỏ qua product fallback, trả lời "không tìm thấy"
        // Việc hiện sản phẩm không liên quan (vd: thính giác cho câu hỏi về thị giác) gây confusion

        if (products.length > 0) {
          const isEn = lang === 'en';
          productContext = products.map((p, i) => {
            const name = isEn ? (p.title_en || p.title) : p.title;
            return `${i + 1}. ${name}${p.brand ? ` (${p.brand})` : ''}${p.price_range ? ` — ${p.price_range}` : ''}${p.description ? `\n   ${p.description}` : ''}`;
          }).join('\n');
          console.log(`📦 [RAG Stream] Built product context from ${products.length} DB products`);
        }
      } catch (err) {
        console.warn('⚠️ [RAG Stream] Product fallback fetch failed:', (err as Error).message);
      }

      // Nếu có product context → cho AI giới thiệu sản phẩm
      if (productContext) {
        const intro = lang === 'en'
          ? `I don't have detailed information about this topic in my knowledge base yet, but here are some products from our database that may be relevant:`
          : `Tôi chưa có thông tin chi tiết về chủ đề này trong cơ sở kiến thức, nhưng dưới đây là một số sản phẩm từ cơ sở dữ liệu có thể phù hợp:`;

        const aiContext = `[${labelHeader}]\n${productContext}`;
        const fbReq = this.buildRequest(userQuery, aiContext, conversationHistory, true, config.systemInstruction, config.language, config.productCatalog, config.noProductRecommendation, config.singleProductFocus);
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: fbReq.systemText,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: config.maxOutputTokens || 8192,
            topP: 0.8,
            topK: 20,
            // ⚠️ Tách token suy nghĩ khỏi ngân sách trả lời (xem giải thích ở
            // nhánh query() chính) — không có thì câu bị cắt cụt.
            thinkingConfig: { thinkingBudget: 2048 },
          },
        });

        let fullAnswer = '';
        const productStream = (async function* () {
          // Stream intro trước
          yield { text: () => `${intro}\n\n` };
          fullAnswer += intro + '\n\n';

          // Stream AI response
          try {
            const result = await model.generateContentStream({ contents: fbReq.contents });
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) {
                fullAnswer += text;
                yield { text: () => text };
              }
            }
          } catch (e) {
            console.error('❌ [RAG Stream] product-fallback stream error:', e);
            // Fallback: stream raw product list
            const raw = `\n\n${productContext}`;
            fullAnswer += raw;
            yield { text: () => raw };
          }

          // ⭐⭐ Gắn link MADA cho từng sản phẩm được giới thiệu.
          // Nhánh fallback này stream trực tiếp nên phải gửi event "replace" để
          // client thay toàn bộ nội dung — nếu chỉ nối thêm phần chênh lệch thì
          // link (được chèn ngay dưới tên sản phẩm, tức ở GIỮA nội dung) sẽ bị
          // mất và người dùng không thấy link nào.
// ⭐⭐ CHỐNG BỊA (fallback branch): gỡ tên/giá/URL bịa trước khi gắn link.
        fullAnswer = removeFabricatedContent(fullAnswer);
        const linked = config.noProductRecommendation
          ? repairTruncatedSentences(stripProductMentions(fullAnswer))
          : appendProductLinks(fullAnswer);
          if (linked !== fullAnswer) {
            fullAnswer = linked;
            yield { text: () => '', __replaceFull: linked };
          }
        })();

        return {
          stream: productStream,
          sources: [],
          confidence: 50,
          answer: fullAnswer || intro,
        };
      }

      // ⭐ FIX: Thay vì return "không tìm thấy" → cho AI trả lời bằng kiến thức chung
      // Bỏ qua return ở đây để code tiếp tục xuống rerank và AI response
      // if (!productContext) { return "không tìm thấy" } // DISABLED
    }

    // ⭐ FIX: Pinecone trả score=1.0 cho mọi doc (do metric config), không dùng được.
    // → BẮT BUỘC gọi rerankService (LLM-based) để có relevance score thật.
    // Nếu rerank fail → fallback dùng rawDocs nhưng đánh confidence thấp.
    if (rerankService.isReady() && rawDocs.length > 0) {
      try {
        const items: RerankableItem[] = rawDocs.map((doc, idx) => ({
          id: doc.id || `doc_${idx}`,
          content: doc.content,
          score: doc.score || 0.5,
          metadata: doc.metadata,
        }));
        const reranked = await rerankService.rerank(userQuery, items, { topN: topK });
        if (reranked.length > 0) {
          relevantDocs = reranked.map((r) => ({
            ...r.item,
            score: r.rerankScore,
            metadata: {
              ...r.item.metadata,
              rerankScore: r.rerankScore,
              rerankReason: r.reason,
            },
          }));
          usedRerank = true;
          console.log(`🔄 [RAG Stream] Reranked: top rerank score = ${relevantDocs[0].score.toFixed(3)}`);
        }
      } catch (err) {
        console.warn('⚠️ [RAG Stream] Rerank failed, using raw docs:', (err as Error).message);
      }
    }

    // ⭐ FIX: Lọc docs có relevance score quá thấp (sau rerank) để tránh
    // Gemini bị ép trả lời khi context không thực sự match câu hỏi.
    // Rerank score 0..1. Threshold 0.5: docs < 0.5 rõ ràng không liên quan.
    // Threshold cao hơn (0.7) sẽ cắt nhầm paraphrase tốt.
    const RERANK_THRESHOLD = 0.5;
    const beforeFilter = relevantDocs.length;
    if (usedRerank) {
      relevantDocs = relevantDocs.filter((d: any) => (d.score ?? 0) >= RERANK_THRESHOLD);
      console.log(`🔍 [RAG Stream] After threshold: ${relevantDocs.length}/${beforeFilter} (best: ${(relevantDocs[0]?.score ?? 0).toFixed(3)})`);
    } else if (relevantDocs.length > 0) {
      console.log(`⚠️ [RAG Stream] No rerank; using all ${relevantDocs.length} raw docs (may be irrelevant)`);
    }

    // Build context
    // ⭐ SANITIZE: loại bỏ metadata nội bộ (Mã SP, Stock, …) + marker prompt
    //    trước khi đưa vào prompt để model không echo nguyên văn ra ngoài.
    let context = '';
    if (relevantDocs.length > 0) {
      context = sanitizeContextForPrompt(
        relevantDocs
          .map((doc, index) => `[Document ${index + 1}] (Nguồn: ${doc.metadata?.title || doc.metadata?.source || 'Unknown'})\n${doc.content}`)
          .join('\n\n')
      );
    }

    // Build prompt
    const hasContext = context.length > 0;
    const streamReq = this.buildRequest(userQuery, context, conversationHistory, hasContext, config.systemInstruction, config.language, config.productCatalog, config.noProductRecommendation, config.singleProductFocus);

    // Format sources
    const sources = relevantDocs.map((doc) => ({
      content: doc.content?.slice(0, 200) + (doc.content?.length > 200 ? '...' : ''),
      source: doc.metadata?.source || 'Unknown',
      metadata: doc.metadata,
      rerankScore: doc.metadata?.rerankScore,
      rerankReason: doc.metadata?.rerankReason,
    }));

    const confidence = this.calculateConfidence(relevantDocs, hasContext);

    // Generate streaming response
    if (!this._isConfigured || !this.genAI) {
      throw new Error('RAG Engine is not initialized. Set GEMINI_API_KEY in .env.');
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: streamReq.systemText,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: config.maxOutputTokens || 8192,
        topP: 0.8,
        topK: 20,
        // ⚠️ Tách token suy nghĩ khỏi ngân sách trả lời — thiếu dòng này thì
        // thinking mode ăn hết maxOutputTokens và câu bị cắt cụt.
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    // Retry wrapper for streaming — retry khi gặp 429/5xx trước khi stream bắt đầu
    async function streamWithRetry(model: any, contents: any[], retries = 3, baseDelayMs = 2000) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await model.generateContentStream({ contents });
          return result;
        } catch (error: any) {
          const msg = error?.message || '';
          const is429 = msg.includes('429') || msg.includes('Too Many Requests') || error?.status === 429
            || msg.includes('503') || msg.includes('Service Unavailable') || error?.status === 503
            || error?.status === 500 || error?.status === 502 || error?.status === 504;

          if (is429 && attempt < retries) {
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 16000);
            console.warn(`⚠️ [RAG Stream 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${delay}ms before retry...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw error;
        }
      }
      throw new Error('streamWithRetry: unreachable');
    }

    // Collect full answer for history
    let fullAnswer = '';
    // ⭐ Cờ báo câu trả lời bị Gemini cắt vì chạm trần token.
    let truncatedByTokenLimit = false;
    // ⭐ SANITIZE (streaming): lọc nội dung nội bộ theo luồng, giữ trải nghiệm hiện dần
    // ⭐ Nếu header định danh (📋 ...) đã xuất hiện trong các lượt TRƯỚC, không ghim
    // lại ở lượt này — chỉ hiện đúng 1 lần ở lượt đầu tiên.
    const headerAlreadyShown = hasShownIdentityHeader(conversationHistory);
    const sanitizer = createStreamingSanitizer({ headerAlreadyShown });
    // ⭐ Đã có lượt trước → cấm chào lại (prompt + gỡ bằng code).
    const isFollowUpTurn = (conversationHistory || []).some((m) => m?.role === 'user');

    const stream = (async function* () {
      try {
        const result = await streamWithRetry(model, streamReq.contents);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (!text) continue;
          const safeText = sanitizer.push(text);
          fullAnswer += text;
          if (safeText) {
            yield { text: () => safeText };
          }

          // ⚠️ PHẦN QUAN TRỌNG: phát hiện bị cắt cụt VÀ báo lại cho người dùng.
          //
          // VÌ SAO CẦN: trước đây finishReason bị bỏ qua hoàn toàn → khi model
          // chạm trần token, câu trả lời dừng giữa chừng ("...tận hưởng") mà
          // không có dấu hiệu gì cho người dùng lẫn developer.
          const fr = (chunk as any)?.candidates?.[0]?.finishReason;
          if (fr === 'MAX_TOKENS') {
            truncatedByTokenLimit = true;
            console.warn(
              `[RAG Stream] ⚠️ Câu trả lời BỊ CẮT (finishReason=MAX_TOKENS) ` +
              `sau ${fullAnswer.length} ký tự — tăng maxOutputTokens/thinkingBudget`
            );
          }
        }

        // Đẩy nốt phần buffer còn lại
        const tail = sanitizer.flush();
        if (tail) {
          yield { text: () => tail };
        }

        // ⚠️ Nếu bị cắt vì hết token → gắn dấu "…" cho người dùng biết câu
        // chưa trọn vẹn, thay vì im lặng dừng giữa chừng (như "…tận hưởng").
        if (truncatedByTokenLimit) {
          const withEllipsis = markTruncated(fullAnswer, config.language || 'vi');
          if (withEllipsis !== fullAnswer) {
            yield { text: () => '', __replaceFull: withEllipsis };
            fullAnswer = withEllipsis;
          }
        }

        // ⭐ Header định danh chỉ hiện 1 lần ở lượt đầu. Nếu đã hiện ở lượt
        // trước mà LLM lại viết lại → gỡ bỏ rồi gửi bản đã sửa (replace).
        if (headerAlreadyShown) {
          const noHeader = stripIdentityHeader(fullAnswer);
          if (noHeader !== fullAnswer) {
            yield { text: () => '', __replaceFull: noHeader };
            fullAnswer = noHeader;
          }
        }

        // ⭐⭐⭐ Gỡ LỜI CHÀO ở giữa cuộc trò chuyện. Stream đã gửi hết chunk ra
        // client nên phải gửi bản THAY THẾ (replace) để khách không thấy bot chào
        // lại ở giữa cuộc trò chuyện.
        if (isFollowUpTurn) {
          const noGreeting = stripMidConversationGreeting(fullAnswer);
          if (noGreeting !== fullAnswer) {
            yield { text: () => '', __replaceFull: noGreeting };
            fullAnswer = noGreeting;
          }
        }

        // ⭐⭐ CHỐNG BỊA: gỡ tên/giá/URL/nhà bán lẻ không có thật trong DB MADA.
        // Đặt TRƯỚC bước gắn link / gỡ tên sản phẩm để mọi tên còn lại đều thật.
        const noFake = removeFabricatedContent(fullAnswer);
        if (noFake !== fullAnswer) {
          console.warn('[RAG Stream] ⚠️ Đã gỡ nội dung bịa khỏi câu trả lời');
          yield { text: () => '', __replaceFull: noFake };
          fullAnswer = noFake;
        }

        // ⭐ Chưa đủ 4 câu hỏi → gỡ phần nhắc tên sản phẩm mà bot tự ý thêm vào.
        // Gửi phần còn lại sau khi đã lọc, không gửi lại phần đã stream.
        if (config.noProductRecommendation) {
          const cleaned = repairTruncatedSentences(stripProductMentions(fullAnswer));
          if (cleaned !== fullAnswer) {
            // Thay thế nội dung đã gửi bằng bản đã lọc qua event "replace".
            yield { text: () => '', __replaceFull: cleaned };
          }
        } else {
          // Đã đủ 4 câu → chèn link MADA dưới tên sản phẩm.
          const withLinks = appendProductLinks(fullAnswer);
          if (withLinks !== fullAnswer) {
            // ⭐⭐ BẮT BUỘC dùng event "replace", KHÔNG gửi phần chênh lệch.
            //
            // LÝ DO: appendProductLinks chèn link NGAY DƯỚI tên sản phẩm — tức
            // là chèn ở GIỪA nội dung, không phải nối thêm ở cuối. Nếu gửi
            // `withLinks.slice(fullAnswer.length)` (cách cũ) thì phần tính từ
            // độ dài bản gốc sẽ KHÔNG phải là link mà là đoạn văn bị lệch vị trí,
            // còn link thì bị mất sạch. Người dùng sẽ thấy câu bị cắt dở.
            //
            // → Gửi lại TOÀN BỘ bản đã chèn link qua __replaceFull để client thay
            // thế nội dung đã stream, nhờ vậy link luôn xuất hiện đúng chỗ.
            yield { text: () => '', __replaceFull: withLinks };
            fullAnswer = withLinks;
          }
        }
      } catch (error) {
        // ⭐ FIX: throw lỗi để caller xử lý (không nuốt lỗi như trước)
        // Trước đây yield chuỗi rỗng → AI "im lặng", sources rỗng → không gợi ý sản phẩm
        console.error('❌ Stream generation error:', error);
        throw error;
      }
    })();

    // Return stream with sources and confidence
    return {
      stream,
      sources,
      confidence,
      answer: '', // Will be populated as chunks come in
    };
  }

  private buildPrompt(
    userQuery: string,
    context: string,
    conversationHistory: Array<{ role: string; content: string }>,
    hasContext: boolean,
    systemInstruction?: string,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi',
    productCatalog?: string,
    noProductRecommendation?: boolean,
    singleProductFocus?: string | null
  ): string {
    const langCode: 'vi' | 'en' | 'ar' | 'fr' = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi');
    const tail = RAG_TAIL_PROMPTS[langCode];

    // Chuẩn hóa lịch sử: bỏ tin rỗng, bỏ câu hỏi hiện tại (đã được ghép ở cuối prompt), chỉ giữ 12 tin gần nhất
    const cleanedHistory = conversationHistory.filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0);
    const lastMsg = cleanedHistory[cleanedHistory.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.content.trim() === userQuery.trim()) {
      cleanedHistory.pop();
    }
    const recentHistory = cleanedHistory.slice(-12);

    const historyStr = recentHistory.length > 0
      ? recentHistory
          .map((msg) => {
            const roleLabel = msg.role === 'user' ? tail.userLabel : tail.aiLabel;
            return `${roleLabel}: ${msg.content}`;
          })
          .join('\n')
      : '';

    const basePrompt = systemInstruction || SYSTEM_PROMPT;

    // ⭐ Đã đủ thông tin + có catalog → bắt buộc tư vấn (xem buildRequest).
    const consultNow = (!noProductRecommendation && productCatalog)
      ? `\n\n${CONSULT_NOW_RULES[langCode] || CONSULT_NOW_RULES.vi}`
      : '';

    return `${basePrompt}

${tail.guidanceTitle}:
${tail.guidanceRules.map(r => `- ${r}`).join('\n')}

${productCatalog ? `${productCatalog}\n` : ''}${hasContext ? `${tail.contextHeader}:
${context}

---` : ''}
${historyStr ? `${tail.historyHeader}:
${historyStr}

---` : ''}
${tail.questionHeader}: ${userQuery}

${tail.answerPrompt}${consultNow}`;
  }

  /**
   * Tạo request đúng chuẩn Gemini: systemInstruction tách riêng, lịch sử là các lượt user/model,
   * lượt cuối là câu hỏi hiện tại kèm tri thức tham chiếu.
   */
  private buildRequest(
    userQuery: string,
    context: string,
    conversationHistory: Array<{ role: string; content: string }>,
    hasContext: boolean,
    systemInstruction?: string,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi',
    productCatalog?: string,
    noProductRecommendation?: boolean,
    singleProductFocus?: string | null
  ): { systemText: string; contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> } {
    const langCode: 'vi' | 'en' | 'ar' | 'fr' = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi');
    const tail = RAG_TAIL_PROMPTS[langCode];

    const cleaned = conversationHistory.filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0);
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === 'user' && last.content.trim() === userQuery.trim()) {
      cleaned.pop();
    }

    const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const m of cleaned.slice(-12)) {
      const role: 'user' | 'model' = m.role === 'user' ? 'user' : 'model';
      const prev = turns[turns.length - 1];
      if (prev && prev.role === role) {
        prev.parts[0].text += `\n${m.content}`;
      } else {
        turns.push({ role, parts: [{ text: m.content }] });
      }
    }
    // Gemini yêu cầu lượt đầu là user
    while (turns.length > 0 && turns[0].role !== 'user') turns.shift();

    const currentTurn = [
      hasContext ? `${tail.contextHeader}:\n${context}\n\n---` : '',
      `${tail.questionHeader}: ${userQuery}`,
    ].filter(Boolean).join('\n');

    // Chưa đủ 4 câu hỏi → nhắc lại yêu cầu NGAY TRƯỚC câu hỏi của user.
    // ⚠️ Vị trí này quan trọng: đặt ngay cạnh câu hỏi, model chú ý hơn nhiều
    // so với chỉ thị chung đặt trong system prompt (system prompt riêng của từng
    // bot có sẵn danh sách sản phẩm và khiến model hay tự liệt kê).
    const inlineReminder = noProductRecommendation
      ? `\n\n[QUY TẮC BẮT BUỘC — CHƯA ĐỦ THÔNG TIN, TUYỆT ĐỐI TUÂN THỦ]\n`
        + `- KHÔNG được nhắc tên bất kỳ sản phẩm, thiết bị, phần mềm hay thương hiệu cụ thể nào.\n`
        + `- KHÔNG được liệt kê hay mô tả sản phẩm (kể cả mô tả chức năng của sản phẩm).\n`
        + `- Hãy trả lời câu hỏi của người dùng một cách hữu ích, chung về triệu chứng / nguyên nhân / cách chăm sóc ban đầu.\n`
        + `- Kết thúc bằng đúng MỘT câu hỏi trong bộ 4 câu tiêu chuẩn, bỏ qua câu họ đã trả lời.`
      : '';

    // Chèn bộ 4 câu tiêu chuẩn vào system prompt (bổ sung cho inline reminder).
    const noProductRule = noProductRecommendation
      ? `\n\n${CONSULT_4_QUESTIONS[langCode] || CONSULT_4_QUESTIONS.vi}`
      : '';

    // ⭐⭐⭐ CHỐNG "ĐỌC NHỨC ĐẦU" — chỉ chào MỘT LẦN ở đầu cuộc trò chuyện.
    //
    // ⚠️ VÌ SAO CẦN: system instruction của từng bot mở đầu sẵn bằng lời
    // chào ("Chào bạn! Mình là MADA…"). Ở lượt thứ 5, thứ 10, model vẫn bám theo
    // và chào lại từ đầu → người dùng thấy bot "không nhớ mình đang nói chuyện",
    // đọc rất không thông minh. Đã có `stripIdentityHeader` gỡ HEADER (📋),
    // nhưng CÂU CHÀO ("Chào bạn!") thì không bị gỡ.
    const isFollowUpTurn = cleaned.some((m) => m?.role === 'user');
    const noReGreetRule = isFollowUpTurn
      ? (langCode === 'en'
        ? `\n\n[WELCOME — ONCE ONLY] This is NOT the first message of our conversation. We are ALREADY talking.`
          + `\n- NEVER greet again. NEVER say "Chào bạn", "Xin chào", "Hello", "Welcome", "Rất vui được hỗ trợ bạn".`
          + `\n- NEVER re-introduce yourself or repeat your name/role.`
          + `\n- NEVER say "Bạn cần tôi giúp gì hôm nay?" — that was question #1, already answered.`
        : `\n\n[XIN CHÀO — CHỈ MỘT LẦN] Đây KHÔNG phải tin nhắn đầu tiên của cuộc trò chuyện — chúng ta ĐANG nói chuyện rồi.`
          + `\n- TUYỆT ĐỐI KHÔNG chào lại. KHÔNG được nói "Chào bạn", "Xin chào", "Rất vui được hỗ trợ bạn".`
          + `\n- KHÔNG giới thiệu lại tên/vai trò của bạn.`
          + `\n- KHÔNG được hỏi "Bạn cần tôi giúp gì hôm nay?" — đó là câu 1, khách đã trả lời rồi.`
          + `\n- Trả lời THẲNG vào câu hỏi vừa hỏi, dựa trên những gì đã bàn bạc trước đó.`)
      : '';

    // ⭐ ĐÃ ĐỦ thông tin và ĐÃ có catalog → BẮT BUỘC phải tư vấn thật.
    // ⚠️ Thiếu chỉ thị này, model chỉ thấy danh sách tên sản phẩm rồi trả lời
    // kiểu "Để mình hỗ trợ bạn tốt nhất, cho mình hỏi thêm…" → không nêu sản
    // phẩm nào. Cần nhắc RÕ 3 phần: chuyên môn → sản phẩm thật → cách dùng.
    //
    // ⚠️ Khi hỏi RIÊNG 1 sản phẩm thì KHÔNG dùng rule này — nó bảo "liệt kê
    // 2-4 sản phẩm" sẽ khiến bot ra thêm hàng, trái yêu cầu của người dùng.
    const singleSystemRule = singleProductFocus
      ? `\n\n${SINGLE_PRODUCT_RULES[langCode].replace(/\{PRODUCT_NAME\}/g, singleProductFocus)}`
      : '';
    const consultNowRule = (!noProductRecommendation && productCatalog && !singleProductFocus)
      ? `\n\n${CONSULT_NOW_RULES[langCode] || CONSULT_NOW_RULES.vi}`
      : '';

    // ⚠️ QUAN TRỌNG: chỉ thị trong system prompt KHÔNG ĐỦ — Gemini vẫn bám theo
    // lời mở đầu "Chào bạn! ... Bạn cần mình hỗ trợ gì hôm nay?" có sẵn trong
    // identity của bot. Phải nhắc LẠI NGAY CẠNH câu hỏi (mới có hiệu lực).
    // ⭐ ĐƯỢC ƯU TIÊN CAO HƠN consultNowInline: khi hỏi riêng 1 sản phẩm,
    // KHÔNG được phép "ra thêm" danh sách sản phẩm khác.
    const singleProductInline = singleProductFocus
      ? SINGLE_PRODUCT_RULES[langCode].replace(/\{PRODUCT_NAME\}/g, singleProductFocus)
      : '';

    const consultNowInline = singleProductInline || (consultNowRule
      ? (langCode === 'en'
        ? `\n\n[MANDATORY — ENOUGH INFORMATION, CONSULT NOW]\n`
          + `- DO NOT ask any follow-up question. DO NOT say "to support you best" or "tell me more".\n`
          + `- Start by stating what you support best for their condition (2-3 sentences).\n`
          + `- Then list 2-4 REAL products taken ONLY from the catalog above, each with its URL on the line right under the bold name, plus one line "why it fits".\n`
          + `- End with a concrete tip on how to start using them.`
        : `\n\n[BẮT BUỘC — ĐÃ ĐỦ THÔNG TIN, TƯ VẤN NGAY]\n`
          + `- TUYỆT ĐỐI KHÔNG hỏi thêm. KHÔNG nói "để mình hỗ trợ bạn tốt nhất", "cho mình biết thêm".\n`
          + `- MỞ ĐẦU bằng 2-3 câu nói rõ bạn hỗ trợ tốt nhất về lĩnh vực nào và với tình trạng của họ thì giải pháp nào phù hợp.\n`
          + `- SAU ĐÓ liệt kê 2-4 sản phẩm THẬT lấy từ danh mục sản phẩm MADA ở trên, mỗi sản phẩm viết tên in đậm, link ở DÒNG RIÊNG ngay dưới tên (chép y hệt), kèm 1 dòng "phù hợp vì…".\n`
          + `- KẾT thúc bằng 1-2 câu gợi ý cụ thể về cách bắt đầu sử dụng.`)
      : '');

    const lastTurn = turns[turns.length - 1];
    // ⭐⭐⭐ "TRẢ LỜI THẲNG" — chỉ dẫn quan trọng nhất cho mọi lượt sau.
    //
    // ⚠️ VÌ SAO CẦN: Ở lượt tiếp theo, model hay trả lời hờ hững kiểu
    // "Cảm ơn bạn, để tôi hiểu rõ hơn về nhu cầu của bạn…", "Bạn vui lòng mô
    // tả thêm…" — tức là lại hỏi lại điều khách VỪA trả lời. Người dùng thấy
    // bot không nghe, rất mất thiện cảm.
    //
    // → Bắt buộc dựa trên lịch sử đã bàn bạc, trả lời ĐÚNG Ý hỏi, và chỉ hỏi
    //   thêm khi thực sự thiếu thông tin — không hỏi lại điều đã nói rồi.
    const directAnswerInline = isFollowUpTurn
      ? (langCode === 'en'
        ? `\n\n[ANSWER DIRECTLY — CONVERSATION IN PROGRESS]\n`
          + `- READ the conversation history. Do NOT ask the user to repeat anything they already told you.\n`
          + `- Answer the CURRENT question with specifics. Generic filler like "tell me more" is FORBIDDEN.\n`
          + `- Give real, concrete information — not meta-talk about needing more details.\n`
          + `- If you must ask something, make it ONE sharp, new question about information NOT yet given.`
        : `\n\n[TRẢ LỜI THẲNG — CUỘC TRÒ CHUYỆN ĐANG DIỄN RA]\n`
          + `- ĐỌC kỹ lịch sử hội thoại. TUYỆT ĐỐI KHÔNG hỏi lại điều khách đã nói.\n`
          + `- Trả lời TRỰC TIẾP câu hỏi vừa hỏi, có thông tin cụ thể.\n`
          + `- Cấm tuyệt đối câu hờ hững kiểu "để tôi hiểu rõ hơn", "cho tôi biết thêm", "bạn vui lòng mô tả thêm".\n`
          + `- Hãy đưa ra thông tin thật, cụ thể, hữu ích — đừng nói vòng vo về việc cần thêm thông tin.\n`
          + `- Nếu cần hỏi, chỉ hỏi MỘT câu mới, và chỉ hỏi điều chưa được nói.`)
      : '';

    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts[0].text += `\n\n${currentTurn}${inlineReminder}${consultNowInline}${directAnswerInline}`;
    } else {
      turns.push({ role: 'user', parts: [{ text: `${currentTurn}${inlineReminder}${consultNowInline}${directAnswerInline}` }] });
    }

    const systemText = `${systemInstruction || SYSTEM_PROMPT}\n\n${tail.guidanceTitle}:\n${tail.guidanceRules.map((r) => `- ${r}`).join('\n')}${productCatalog ? `\n\n${productCatalog}` : ''}${noReGreetRule}${noProductRule}${consultNowRule}${singleSystemRule}`;
    return { systemText, contents: turns };
  }

  private calculateConfidence(relevantDocs: any[], hasContext: boolean): number {
    if (!hasContext || relevantDocs.length === 0) return 30;

    // ⭐ FIX: Confidence dựa trên rerank score (range 0..1, từ rerankService).
    // Top rerank score càng cao → confidence càng cao.
    const scores = relevantDocs
      .map((d: any) => (typeof d.score === 'number' ? d.score : 0.5))
      .slice(0, 5);
    const top1 = scores[0] || 0;
    // Guard against division by zero: if scores.length is 0, use 1 as denominator
    const avgTop3 = scores.length > 0 
      ? scores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, scores.length))
      : 0;

    // ⭐ Rerank score 0.5-0.7 thường là "liên quan một phần" (trùng keyword nhưng
    // không match intent). Cần penalty mạnh.
    // Rerank score 0.7+ mới thực sự trả lời được câu hỏi.
    const toConfidence = (s: number) => {
      if (s >= 0.85) return 95;
      if (s >= 0.75) return 85;
      if (s >= 0.65) return 70;
      if (s >= 0.55) return 55;
      return 40; // < 0.55 thì coi như không match
    };
    const topConf = toConfidence(top1);
    const avgConf = toConfidence(avgTop3);

    // Weighted: 70% top1 + 30% avg top3
    return Math.round(topConf * 0.7 + avgConf * 0.3);
  }

  private detectCategory(query: string): string {
    const lowerQuery = query.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
      mobility: [
        'xe lan', 'xe lăn', 'wheelchair', 'nạng', 'nang', 'chống', 'gậy', 'gay',
        'di chuyen', 'van dong', 'đi lại', 'tay', 'chân', 'chân tay',
      ],
      hearing: [
        'de', 'de', 'nghe', 'thinh', ' Hearing', 'am thanh', 'tai',
        'suat nghe', 'may', 'bieu', 'ngôn ngữ ký hiệu',
      ],
      cognition: [
        'nao', 'óc', 'trí', 'nhớ', 'memory', 'cognit', 'Alzheimer',
        'dementia', 'tre em', 'autism', 'tự kỷ', 'hoc tap', 'learning',
      ],
      communication: [
        'noi', 'nói', 'speak', 'giao tiep', 'communication', 'ngôn ngữ',
        'language', 'bieu', 'symbol', 'ipad', 'tablet',
      ],
      daily_living: [
        'an', 'uong', 'nau', 'nấu', 'rua', 'tắm', 'bath', 'nha',
        'nha ve sinh', 'toilet', 'quan ao', 'clothes', 'giặt',
      ],
      education: [
        'hoc', 'học', 'school', 'study', 'giao duc', 'education',
        'sinh vien', 'student', 'sach', 'book', 'giao duc dac biet',
      ],
      general: [],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * ⭐ MỚI: Retrieve documents với priority mode
   *
   * Nếu priority=true và có filter (botId/madaCategory):
   *   - Pass 1: search với filter (chỉ lấy KB của bot đó)
   *   - Pass 2: nếu không đủ topK → fallback search toàn bộ KB
   *
   * Nếu priority=false (default):
   *   - Search toàn bộ KB với filter (nếu có)
   */
  private async retrieveDocuments(
    userQuery: string,
    topK: number,
    options: { botId?: string; madaCategory?: string; agentId?: string; priority?: boolean }
  ): Promise<any[]> {
    const { botId, madaCategory, agentId, priority = false } = options;
    // ⭐ Build filter: agentId (custom agents) > botId/madaCategory (MADA bots)
    const filter = (botId || madaCategory) ? { botId, madaCategory } : undefined;
    const agentFilter = agentId ? { agentId } : undefined;

    // Pass 1: search theo filter - Dùng hybrid search để kết hợp vector + keyword
    // ⭐ Ưu tiên agentFilter (custom agents) > filter (MADA bots) > no filter
    let primary: any[] = [];
    // Bot dựng sẵn của MADA (id dạng "bot-...") dùng filter botId/category và được fallback sang KB chung;
    // chỉ agent tùy chỉnh mới bị cô lập dữ liệu.
    const isBuiltInBot = !!agentId && agentId.startsWith('bot-');
    const searchFilter = isBuiltInBot ? (filter || agentFilter) : (agentFilter || filter);
    
    if (searchFilter) {
      try {
        // Hybrid search: kết hợp vector similarity + BM25 keyword matching
        primary = await vectorStore.hybridSearch(userQuery, topK, searchFilter, 0.7, 0.3);
        console.log(`🔍 [RAG] Hybrid search (filter) (agentId=${agentId}, botId=${botId}, madaCategory=${madaCategory}): ${primary.length} docs`);
      } catch (err) {
        console.warn('⚠️ [RAG] Hybrid filter search failed, falling back to vector:', err);
        try {
          primary = await vectorStore.search(userQuery, { topK, filter: searchFilter });
        } catch (err2) {
          console.warn('⚠️ [RAG] Vector filter search also failed:', err2);
        }
      }
    }

    // Nếu có agentId (custom agent) → KHÔNG BAO GIỜ fallback sang MADA KB
    // Custom agent phải dùng DỮ LIỆU RIÊNG, không trộn với MADA
    const hasAgentId = !!agentId && !isBuiltInBot;
    
    // Nếu priority mode VÀ chưa đủ → fallback hybrid search toàn bộ KB
    // NHƯNG: Nếu có agentId (custom agent), KHÔNG fallback - dùng kết quả hiện có
    if (priority && searchFilter && primary.length < topK && !hasAgentId) {
      const need = topK - primary.length;
      // ⚠️ KHÔNG được gọi `hybridSearch(..., undefined, ...)` ở đây.
      // Filter `undefined` = lấy docs TỪ MỌI BOT → bot-cognitive gợi ý Proloquo2Go
      // (bot-speech), bot-mobility gợi ý eSight 4 / Tobii PCEye 5 (bot-vision).
      // Người dùng chọn đúng bot mà vẫn nhận sản phẩm sai chuyên môn.
      //
      // Cách sửa: fallback vẫn giữ ranh giới bot, chỉ nới từ AND (botId+madaCategory)
      // xuống từng filter riêng lẻ để vẫn nằm trong chuyên môn của bot đó.
      console.log(`🔁 [RAG] Priority fallback: cần thêm ${need} docs (giữ filter bot ${botId || 'n/a'})`);
      const primaryIds = new Set(primary.map((d: any) => d.id || d.metadata?.source));
      const merged = [...primary];

      const relaxedFilters: Array<Record<string, string> | undefined> = [
        ...(botId ? [{ botId }] : []),
        ...(madaCategory ? [{ madaCategory }] : []),
      ];

      for (const rf of relaxedFilters) {
        if (merged.length >= topK) break;
        try {
          const fallback = await vectorStore.hybridSearch(userQuery, need * 2, rf, 0.7, 0.3);
          for (const doc of fallback) {
            const id = doc.id || doc.metadata?.source;
            if (!primaryIds.has(id)) {
              merged.push(doc);
              primaryIds.add(id);
            }
            if (merged.length >= topK) break;
          }
        } catch (err) {
          console.warn('⚠️ [RAG] Relaxed-filter fallback failed:', err);
        }
      }

      if (merged.length > 0) return merged;
      // Không còn gì trong phạm vi bot này → SQLite keyword search (cũng giữ filter bot)
      return await this.sqliteFallback(userQuery, topK, { botId, madaCategory, agentId });
    } else if (hasAgentId && primary.length === 0) {
      // ⭐ Custom agent KHÔNG có dữ liệu - log cảnh báo và trả về rỗng
      // KHÔNG fallback sang MADA để tránh trả lời sai
      console.log(`⚠️ [RAG] Agent "${agentId}" has no knowledge base data. Not falling back to MADA.`);
      return [];
    }

    // Nếu không có searchFilter hoặc không priority → trả về primary hoặc search toàn bộ
    if (!searchFilter) {
      try {
        // Hybrid search: kết hợp vector + BM25
        const noFilterResults = await vectorStore.hybridSearch(userQuery, topK, undefined, 0.7, 0.3);
        if (noFilterResults.length > 0) return noFilterResults;
      } catch (err) {
        console.warn('⚠️ [RAG] Hybrid search failed, falling back to vector:', err);
        try {
          const noFilterResults = await vectorStore.search(userQuery, topK);
          if (noFilterResults.length > 0) return noFilterResults;
        } catch (err2) {
          console.warn('⚠️ [RAG] Vector search also failed:', err2);
        }
      }
      return await this.sqliteFallback(userQuery, topK);
    }

    // Nếu filter search rỗng mà priority=false → fallback SQLite
    if (primary.length === 0) {
      return await this.sqliteFallback(userQuery, topK, { botId, madaCategory, agentId });
    }

    return primary;
  }

  /**
   * Fallback: SELECT trực tiếp từ SQLite knowledge_items bằng LIKE keyword
   * Dùng khi vector store rỗng hoặc không match được.
   * Score đơn giản: count keyword matches trong title + content.
   */
  private async sqliteFallback(
    userQuery: string,
    topK: number,
    filter?: { botId?: string; madaCategory?: string; agentId?: string }
  ): Promise<any[]> {
    try {
      const query = userQuery.trim();
      if (!query || query.length < 2) return [];

      // Tách keywords (loại bỏ stop words)
      const stopWords = new Set(['là', 'gì', 'có', 'cho', 'tôi', 'bạn', 'của', 'và', 'thì', 'mà', 'được', 'không', 'này', 'kia', 'với', 'từ', 'trong', 'một', 'những', 'các']);
      const lowerQuery = query.toLowerCase();
      const baseKeywords = lowerQuery
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
        .slice(0, 8);

      // Dữ liệu trong knowledge_items chủ yếu là tiếng Anh (dù nhãn language = 'vi'),
      // nên mở rộng cụm từ tiếng Việt sang từ khóa tiếng Anh tương ứng để tìm được kết quả.
      const viToEn: Array<[string, string[]]> = [
        ['khiếm thị', ['vision', 'blind', 'braille', 'screen reader']],
        ['mù', ['blind', 'braille']],
        ['mắt', ['vision', 'eye', 'magnif']],
        ['nhìn', ['vision', 'magnif']],
        ['đọc sách', ['reader', 'reading', 'book']],
        ['sách', ['book', 'reader']],
        ['phóng to', ['magnif', 'zoom']],
        ['kính lúp', ['magnif']],
        ['khiếm thính', ['hearing', 'deaf']],
        ['nghe', ['hearing', 'amplif']],
        ['điếc', ['deaf', 'hearing']],
        ['xe lăn', ['wheelchair']],
        ['di chuyển', ['mobility', 'wheelchair']],
        ['giao tiếp', ['communication', 'aac']],
        ['nói', ['speech', 'voice']],
        ['nhận thức', ['cognitive', 'memory']],
        ['trí nhớ', ['memory', 'cognitive']],
        ['học', ['learning', 'education']],
        ['tiêu chuẩn', ['standard', 'iso']],
      ];
      const expanded = new Set<string>(baseKeywords);
      for (const [vi, enWords] of viToEn) {
        if (lowerQuery.includes(vi)) enWords.forEach(w => expanded.add(w));
      }
      const keywords = Array.from(expanded).slice(0, 12);

      if (keywords.length === 0) return [];

      // Build SQL: mỗi keyword là 1 điều kiện LIKE, score = số match
      const likeConditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)').join(' OR ');
      const likeParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

      // Map botId/category/agentId từ filter (nếu có)
      let categoryFilter = '';
      const catFilterParams: string[] = [];
      if (filter?.madaCategory) {
        // Cho phép partial match vì DB có cả 'sensory-vision' và 'vision'
        const aliases = this.expandCategoryAliases(filter.madaCategory);
        if (aliases.length > 0) {
          categoryFilter = ` AND (${aliases.map(() => 'category = ?').join(' OR ')})`;
          catFilterParams.push(...aliases);
        }
      }

      // ⭐ Filter by agentId (stored in metadata as JSON)
      let agentFilter = '';
      const agentFilterParams: string[] = [];
      if (filter?.agentId) {
        agentFilter = ` AND (LOWER(metadata) LIKE ? OR LOWER(metadata) LIKE ?)`;
        agentFilterParams.push(`%"agentId":"${filter.agentId}"%`, `%agentId%${filter.agentId}%`);
      }

      // ⭐ Fix: Include ALL source types (web, manual, pdf, text, etc.) — imported products have source_type='manual'
      const sql = `
        SELECT id, title, content, source, category, metadata,
          (${keywords.map(() => 'CASE WHEN LOWER(title) LIKE ? THEN 2 ELSE 0 END + CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END').join(' + ')}) as score
        FROM knowledge_items
        WHERE source_type IN ('web', 'manual', 'pdf', 'text', 'image', 'docx', 'xlsx', 'csv')
          AND (${likeConditions})
          ${categoryFilter}
          ${agentFilter}
        ORDER BY score DESC, length(content) DESC
        LIMIT ?
      `;

      // Params: score weight params + like params + category params + agent filter params + limit
      const simpleSql = `
        SELECT id, title, content, source, category, metadata,
          (${keywords.map(() => '(CASE WHEN LOWER(title) LIKE ? THEN 2 ELSE 0 END + CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END)').join(' + ')}) as match_score
        FROM knowledge_items
        WHERE source_type IN ('web', 'manual', 'pdf', 'text', 'image', 'docx', 'xlsx', 'csv')
          AND (${likeConditions})
          ${categoryFilter}
          ${agentFilter}
        ORDER BY match_score DESC
        LIMIT ?
      `;
      const allParams: any[] = [];
      keywords.forEach(k => {
        allParams.push(`%${k}%`, `%${k}%`);
      });
      allParams.push(...likeParams);
      allParams.push(...catFilterParams);
      allParams.push(...agentFilterParams);
      allParams.push(topK);

      const rows = db.prepare(simpleSql).all(...allParams) as any[];

      console.log(`🗄️ [SQLite fallback] ${rows.length} docs for: "${query.slice(0, 50)}..."`);

      return rows.map((row, i) => {
        let meta: any = {};
        try {
          meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {});
        } catch { meta = {}; }

        return {
          id: row.id,
          content: row.content?.slice(0, 4000) || row.title,
          score: 0.3 + (i === 0 ? 0.2 : 0), // baseline score 0.3-0.5
          metadata: {
            source: row.source || '',
            type: 'web',
            title: row.title || '',
            category: row.category || 'general',
            ...meta,
          },
        };
      });
    } catch (err) {
      console.warn('⚠️ [SQLite fallback] failed:', (err as Error).message);
      return [];
    }
  }

  /**
   * Map filter category sang nhiều alias có thể có trong DB.
   *
   * ⚠️ Phải khớp với `lib/categoryMapping.ts` (DB_CATEGORY_TO_MADA):
   *   - Bot 5 "Neuromusculoskeletal Movement" → category DB `mobility`
   *   - Bot 6 "Mobility & Transportation"     → category DB `daily_living`
   * Trước đây alias của 'mobility-and-transportation' trỏ sang `mobility`
   * (thuộc Bot 5) và thiếu `daily_living` → SQLite fallback của bot
   * Mobility & Transportation không tìm được sản phẩm của chính nó.
   */
  private expandCategoryAliases(cat: string): string[] {
    const map: Record<string, string[]> = {
      // Hearing — Bot 1
      'sensory-hearing': ['hearing', 'sensory-hearing'],
      'hearing': ['hearing', 'sensory-hearing'],
      // Vision — Bot 2
      'sensory-vision': ['vision', 'sensory-vision'],
      'vision': ['vision', 'sensory-vision'],
      // Speech/Communication — Bot 3
      'voice-and-speech': ['voice-and-speech', 'communication', 'voice', 'speech', 'aac'],
      'voice-speech': ['voice-and-speech', 'communication', 'voice', 'speech', 'aac'],
      'communication': ['communication', 'voice-and-speech'],
      // Cognitive — Bot 4
      'mental-cognitive': ['cognition', 'mental-cognitive', 'cognitive', 'mental'],
      'cognitive': ['cognition', 'mental-cognitive', 'cognitive', 'mental'],
      // Neuromusculoskeletal Movement — Bot 5 (DB category: `mobility`)
      'neuromusculoskeletal-movement': ['mobility', 'neuromusculoskeletal-movement', 'neuro', 'movement', 'musculoskeletal'],
      'movement': ['mobility', 'neuromusculoskeletal-movement', 'neuro', 'movement'],
      // Mobility & Transportation — Bot 6 (DB category: `daily_living`)
      'mobility-and-transportation': ['daily_living', 'mobility-and-transportation', 'transport', 'physical'],
      'daily_living': ['daily_living', 'mobility-and-transportation', 'transport', 'physical'],
      // Regulatory & Standards — Bot 7
      'regulatory-standards': ['education', 'regulatory-standards', 'regulatory', 'standards', 'web_accessibility'],
      'education': ['education', 'regulatory-standards', 'web_accessibility'],
      // Fallback
      'general': ['general'],
    };
    return map[cat] || [cat];
  }
}

export const ragEngine = new RAGEngine();
