/**
 * ⭐⭐⭐ LÕI NHẬN DIỆN BỘ 4 CÂU HỎI TƯ VẤN — NGUỒN SỰ THẬT DUY NHẤT.
 *
 * ⚠️ File này KHÔNG được import React/DOM/Node API — để cả `src/` (Vite) và
 * `server/` (esbuild) dùng chung MỘT bản logic. Nếu 2 bên dùng 2 bộ regex
 * khác nhau thì client và server lệch trạng thái → server gửi card nhưng
 * client vứt (hoặc ngược lại).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VÌ SAO CẦN "CHUẨN HOÁ BỎ DẤU"?
 *
 * BUG THẬT (đã tái hiện trên production):
 *   Khách nói: "mình bị mờ mắt khi đọc sách"
 *   - Regex cũ chỉ biết chữ "tôi" → không khớp "mình".
 *   - Regex cũ dùng `\w{2,}` — trong JS `\w` KHÔNG match chữ có dấu
 *     ("mờ", "mắt") → không khớp.
 *   - Thiếu từ khoá "mờ" (chỉ có "mỏi").
 *   → `answered = ['duration']`, thiếu 3 câu → `hasCompletedConsultQuestions`
 *     = false → server KHÔNG đưa catalog (noProductRecommendation = true) →
 *     bot bị gỡ tên sản phẩm + client không gắn card.
 *
 * → Ở đây MỌI so khớp diễn ra trên chuỗi ĐÃ BỎ DẤU, nên "mờ mắt" → "mo mat",
 *   "45 tuổi" → "45 tuoi"… không còn lỗi do dấu.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VÌ SAO CẦN "NHẬN DIỆN THEO THỨ TỰ HỘI THOẠI"?
 *
 * Yêu cầu nghiệp vụ: bot hỏi câu 4 → khách trả lời → PHẢI ra sản phẩm.
 * Nếu chỉ dựa vào regex thì khách trả lời kiểu lạ ("vẫn ổn", "khoảng năm
 * nay rồi") có thể không khớp mẫu nào → mãi không đủ 4 câu → mãi không ra
 * sản phẩm. Đây chính là bug user báo: "hỏi xong câu 4 rồi mà không ra SP".
 *
 * → Nếu bot ĐÃ HỎI câu X và khách nói tiếp ngay sau đó → câu X coi như ĐÃ
 *   TRẢ LỜI (bất kể dùng từ gì). Đây là tín hiệu mạnh hơn regex.
 */

export type ConsultQuestionType = 'needHelp' | 'age' | 'condition' | 'duration';

export type ConsultLang = 'vi' | 'en' | 'ar' | 'fr';

/** Thứ tự cố định — luôn hỏi theo thứ tự này. */
export const CONSULT_QUESTION_ORDER: ConsultQuestionType[] = [
  'needHelp',
  'age',
  'condition',
  'duration',
];

/** Câu hỏi chuẩn (mọi ngôn ngữ, mọi biến thể). */
export const CONSULT_QUESTIONS: Record<
  ConsultLang,
  Record<ConsultQuestionType, string[]>
> = {
  vi: {
    needHelp: [
      'Bạn cần tôi giúp gì hôm nay?',
      'Hôm nay bạn cần tôi giúp gì?',
    ],
    age: [
      'Năm nay bạn bao nhiêu tuổi rồi?',
      'Cho mình hỏi năm nay bạn bao nhiêu tuổi?',
    ],
    condition: [
      'Bạn gặp tình trạng như thế nào? Hãy diễn đạt cụ thể tình trạng bạn gặp phải để tôi có thể hiểu rõ hơn về vấn đề của bạn nhé.',
      'Bạn đang gặp tình trạng như thế nào? Bạn hãy mô tả triệu chứng của mình để tôi hiểu rõ hơn về tình trạng của bạn nhé.',
    ],
    duration: [
      'Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?',
      'Tình trạng này kéo dài bao lâu rồi? Xin cho tôi biết mức độ: nhẹ, trung bình, hay nặng để tôi tư vấn chính xác nhất nhé?',
    ],
  },
  en: {
    needHelp: [
      'What do you need help with today?',
      'How can I help you today?',
    ],
    age: [
      'How old are you this year?',
      'May I ask how old you are this year?',
    ],
    condition: [
      'What situation are you facing? Please describe your condition in detail so I can understand your situation clearly.',
      'What are you experiencing? Describe your symptoms so I can fully understand what you are going through.',
    ],
    duration: [
      'How long have you had this situation? Which level is it: mild (slightly affecting daily life), moderate (affecting everyday activities), or severe (greatly affecting daily activities and communication)?',
      'How long has this been going on? Please tell me the severity: mild, moderate, or severe, so I can advise you accurately.',
    ],
  },
  ar: {
    needHelp: [
      'ما الذي تحتاج مساعدة فيه اليوم؟',
      'كيف يمكنني مساعدتك اليوم؟',
    ],
    age: [
      'كم عمرك هذا العام؟',
      'هل يمكنني معرفة عمرك هذا العام؟',
    ],
    condition: [
      'ما الموقف الذي تواجهه؟ يرجى وصف حالتك بالتفصيل حتى أفهم موقفك بوضوح.',
      'ما الذي تعيشه؟ صف أعراضك حتى أفهم حالتك تماماً.',
    ],
    duration: [
      'منذ متى وهي هذه الحالة؟ ما درجتها: خفيفة (تؤثر قليلاً على الحياة اليومية)، متوسطة (تؤثر على الأنشطة اليومية)، أم شديدة (تؤثر بشدة على الأنشطة اليومية والتواصل)؟',
      'منذ متى وأنت تعيش هذه الحالة؟ أخبرني بدرجة الشدة: خفيفة، متوسطة، أم شديدة لأقدم لك أفضل نصيحة.',
    ],
  },
  fr: {
    needHelp: [
      'De quoi avez-vous besoin aujourd\'hui ?',
      'Comment puis-je vous aider aujourd\'hui ?',
    ],
    age: [
      'Quel âge avez-vous cette année ?',
      'Puis-je connaître votre âge cette année ?',
    ],
    condition: [
      'Quelle situation traversez-vous ? Décrivez votre état en détail afin que je puisse bien comprendre votre situation.',
      'Que ressentez-vous ? Décrivez vos symptômes pour que je comprenne clairement votre état.',
    ],
    duration: [
      'Depuis combien de temps cette situation dure-t-elle ? Quel est le niveau : léger (légèrement affectant la vie quotidienne), modéré (affectant les activités quotidiennes), ou sévère (affectant fortement les activités et la communication) ?',
      'Depuis combien de temps cela dure-t-il ? Indiquez le degré : léger, modéré ou sévère, afin que je puisse vous conseiller au mieux.',
    ],
  },
};

/** ⭐ CHUẨN HOÁ ĐỂ SO KHỚP — bỏ dấu, hạ chữ, bỏ dấu câu, gộp khoảng trắng. */
export function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Giữ chữ (tiếng Việt + Ả Rập) và số, bỏ dấu câu.
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ⭐ MẪU NHẬN DIỆN "USER ĐÃ TRẢ LỜI" — viết trên chuỗi ĐÃ BỎ DẤU.
 *
 * ⚠️ Mọi mẫu ở đây phải KHÔNG chứa dấu. Nếu quên, mẫu sẽ không bao giờ
 * khớp vì text đã được bỏ dấu trước khi test.
 */
const ANSWER_PATTERNS: Record<ConsultQuestionType, RegExp[]> = {
  // ── Câu 1: "Bạn cần tôi giúp gì hôm nay?" ──────────────────────────────
  needHelp: [
    // "bạn cần tôi giúp gì" / "cho tôi xem..." / "tôi cần tư vấn..."
    /\b(toi|minh|ban|anh|chi)\b[^.?!]{0,30}\b(can|muon|giup|hoi|tu van|giai quyet)\b/,
    // "tôi bị mờ mắt khi đọc sách" → đã nêu vấn đề = đã trả lời câu 1
    /\b(toi|minh|ban)\b[^.?!]{0,40}\b(bi|mac|dang gap|gap|hay bi|thuong bi|khong the|khong duoc|lam sao)\b/,
    // "bị ù tai khi ngủ" (không có đại từ) — "bị/mắc + triệu chứng + khi/lúc"
    // ⚠️ Cờ `u` BẮT BUỘC: `\p{L}` (chữ Unicode) chỉ hoạt động khi có cờ `u`.
    // Không có cờ `u`, `\p` bị hiểu là literal "p" → mẫu KHÔNG BAO GIỜ khớp.
    /\b(bi|mac)\b\s+\p{L}{2,}(?:\s+\p{L}{2,}){0,2}\s*\b(khi|luc|moi khi|luc nao|bao gio|hoac)\b/u,
    // "làm sao chữa mờ mắt", "có cách nào ..."
    /\b(lam sao|co cach nao|bang cach)\b[^.?!]{0,40}\b(giai quyet|khac phuc|hoan|chua|giai)\b/,
    // "cho tôi gợi ý" / "tôi cần thiết bị cho mẹ"
    /\b(cho|giup|goi y)\b[^.?!]{0,20}\b(gia|thiet bi|giai phap|cong cu|dung cu)\b/,
    /\b(can|co)\b[^.?!]{0,20}\b(thiet bi|giai phap|cong cu|dung cu)\b/,
    // EN
    /\b(i (?:have|am|get|suffer from|need|would like))\b/,
    /\b(need help|can you help|looking for|recommend|advise me|which device|what device)\b/,
    // AR / FR
    /(أعاني|أواجه|يعاني|أحتاج|أريد|انصحني|تحتاج|مساعدة)/,
    /(je (?:suis|me sens|ai|souffre)|besoin d aide|j ai besoin|conseillez moi)/,
  ],
  // ── Câu 2: "Năm nay bạn bao nhiêu tuổi rồi?" ────────────────────────────
  age: [
    /\b\d{1,3}\s*(tuoi|years old|year old|yo)\b/,
    /\b(tuoi cua toi|tuoi cua ban|tuoi cua minh|nguoi gia|cao tuoi|trung nien)\b/,
    /\b(tuoi|aged)\b[^.?!]{0,20}\b\d{1,3}\b/,
    // EN / AR / FR
    /\b\d{1,3}\s*(ans|years old|yo)\b/,
    /(\d{1,3}\s*سن|عمري|كم عمرك)/,
    /\b(quel age|combien d ans)\b/,
  ],
  // ── Câu 3: "Bạn gặp tình trạng như thế nào?" ───────────────────────────
  condition: [
    /\b(mo mat|moi mat|mat mo|mat lai mo|mat khong ro|mat nho|mat kem)\b/,
    /\b(mat|mat meo|thinh giac)\b[^.?!]{0,20}\b(mo|moi|khong ro|nho|kem|khong thay)\b/,
    /\b(kho doc|kho nhin|kho nghe|kho noi|kho thay|kho khan|khong hieu)\b/,
    /\b(khong doc duoc|khong nhin thay|khong nhin duoc|khong nghe ro|khong noi duoc|khong nghe duoc)\b/,
    /\b(u tai|ung tai|te tai)\b/,
    /\b(dau|me moi|met moi|chong mat|khong len duoc|khong di duoc|khong ngu duoc|khong an duoc|khong ham duoc)\b/,
    /\b(run ray|run tay|run chan|yeu|met moi)\b/,
    /\b(ho han|lo lang|so hai|kho chiu|bat an)\b/,
    /\b(mat ngu|khong ngu duoc|ngu khong)\b/,
    // EN
    /\b(feel|feeling|uncomfortable|tired|frustrat\w*|difficult|struggl\w*|weak|pain|dizzy|blurry|hard to read)\b/,
    /\b(hard to|difficulty|cannot|can t|unable to)\b/,
    // AR / FR
    /(أشعر|ألم|ضعيف|مشكلة|صعوبة|تعاني)/,
    /(je (?:me sens|ressens|suis fatigu)|fatigu|faible|douleur|mal a)/,
  ],
  // ── Câu 4: "Bạn đã gặp tình trạng này bao lâu rồi? + 3 mức độ" ────────
  duration: [
    /\b(bao lau|lau roi|lau nay|lau da|ke tu|tinh tu|tu khi)\b/,
    /\b(vua moi|hom qua|moi bi|moi xay ra|gan day)\b/,
    // "2 năm rồi", "3 tháng nay", "một tuần trở lại"
    /\b\d{1,3}\s*(ngay|tuan|thang|nam|gio|phut)\b/,
    /\b(mot|hai|ba|bon|nam|muoi)\s*(ngay|tuan|thang|nam|gio)\b/,
    // mức độ: nhẹ / trung bình / nặng
    /\b(nhe|vua phai|trung binh|kha nang|nghiem trong|te|khong the|lam rat kho)\b/,
    // EN
    /\b(how long|for a (?:while|month|year|week)|mild|moderate|severe|since)\b/,
    /\b\d{1,3}\s*(days?|weeks?|months?|years?|hours?)\b/,
    // AR / FR
    /(منذ متى|خفيفة|متوسطة|شديدة|بضعة|عدة)/,
    /(depuis combien|leger|modere|severe|quelques jours|quelques semaines)/,
  ],
};

/**
 * Phát hiện câu nào user ĐÃ trả lời (chỉ dựa vào nội dung lời nói).
 */
export function detectAnsweredQuestions(
  userMessages: string[]
): Set<ConsultQuestionType> {
  const answered = new Set<ConsultQuestionType>();
  const text = normalizeForMatch((userMessages || []).join('\n'));
  if (!text) return answered;

  for (const type of CONSULT_QUESTION_ORDER) {
    if (ANSWER_PATTERNS[type].some((re) => re.test(text))) {
      answered.add(type);
    }
  }
  return answered;
}

/* ────────────────────────────────────────────────────────────────────────
 * NHẬN DIỆN CÂU HỎI MÀ BOT ĐÃ HỎI (vân tay câu hỏi)
 * ──────────────────────────────────────────────────────────────────────── */

type Lang = ConsultLang;

/** Escape + hỗ trợ CẢ HAI dạng có dấu / không dấu. */
function buildLoosePattern(text: string): RegExp {
  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const variants = new Set<string>();
  variants.add(escape(text));
  const noAccent = strip(text);
  if (noAccent !== text) variants.add(escape(noAccent));

  const body = [...variants]
    .map((v) => v.replace(/\\\?/g, '[?？؟]'))
    .join('|');
  return new RegExp(`\\*?[ \\t]*(?:${body})[ \\t]*\\*?`, 'gi');
}

/**
 * Dựng RegExp nhận diện một CÂU HỎI (dùng để cắt khỏi text của LLM).
 * Nối các cụm lại, cho phép chen khoảng trắng/dấu câu ở giữa.
 */
function buildQuestionPattern(fragments: string[]): RegExp {
  const each = fragments.map((f) => buildLoosePattern(f).source);
  if (!each.length) return /(?!)/;
  const joiner = '[\\s\\S]{0,40}?';
  const WORD =
    '(?:hôm\\s+nay|ngày|không|vậy|nhé|nha|ạ|à|đã|rồi|hơn|thêm|nữa|đây)';
  const tail = `(?:[ \\t]*${WORD}){0,2}[ \\t*?!.。？！]*`;
  const lead = `(?:[ \\t]*(?:vậy|thế|nào|nữa|nhé|ạ))?[ \\t*]*`;
  return new RegExp(`${lead}(?:${each.join(joiner)})${tail}`, 'gi');
}

/**
 * ⭐ Mẫu câu hỏi dùng để NHẬN DIỆN và CẮT.
 * Mỗi loại câu có nhiều mẫu; mẫu là các CỤM TỪ phải xuất hiện (không nhất
 * thiết liền nhau) để nhận ra câu hỏi đó.
 */
const QUESTION_PATTERNS: Record<ConsultQuestionType, string[][]> = {
  needHelp: [
    ['Bạn cần tôi giúp gì'],
    ['cần tôi giúp gì'],
    ['Hôm nay bạn cần tôi giúp'],
    ['Bạn cần tôi giúp gì', 'hơn nữa không'],
    ['Bạn cần tôi giúp gì', 'hơn nữa'],
    ['Bạn cần tôi giúp gì', 'vậy'],
    ['Bạn cần tôi giúp gì', 'nhé'],
    ['Bạn cần mình giúp gì'],
    ['cần mình giúp gì'],
    ['cần mình hỗ trợ gì'],
    ['Bạn cần mình hỗ trợ gì'],
    ['cần tôi giúp gì', 'hôm nay'],
    ['Bạn cần mình hỗ trợ', 'gì'],
    ['What do you need help with'],
    ['How can I help you today'],
    ['What do you need help with', 'today'],
    ['ما الذي تحتاج مساعدة فيه'],
    ['كيف يمكنني مساعدتك'],
    ['De quoi avez-vous besoin'],
    ['Comment puis-je vous aider'],
  ],
  age: [
    ['bao nhiêu tuổi'],
    ['tuổi rồi'],
    ['tuổi của bạn'],
    ['How old are you'],
    ['how old you are'],
    ['your age', 'device'],
    ['كم عمرك'],
    ['Quel âge avez'],
  ],
  condition: [
    ['Bạn gặp tình trạng như thế nào'],
    ['gặp tình trạng', 'thế nào'],
    ['Bạn đang gặp tình trạng'],
    ['diễn đạt', 'hiểu rõ hơn'],
    ['mô tả', 'triệu chứng'],
    ['What situation are you facing'],
    ['Describe your condition'],
    ['What are you experiencing'],
    ['وصف', 'حالتك'],
    ['صف', 'أعراضك'],
    ['Quelle situation traversez'],
    ['Décrivez votre état'],
  ],
  duration: [
    ['bao lâu rồi'],
    ['gặp tình trạng này bao lâu'],
    ['Tình trạng này kéo dài bao lâu'],
    ['mức độ', 'nhẹ'],
    ['mức nào', 'nhẹ'],
    ['How long have you had this'],
    ['how long', 'mild'],
    ['severity', 'moderate'],
    ['منذ متى', 'خفيفة'],
    ['درجة', 'متوسطة'],
    ['Depuis combien de temps', 'léger'],
    ['degré', 'sévère'],
  ],
};

/** Regex nhận diện (không bỏ dấu) cho từng loại câu hỏi — CHỈ dùng .test()/exec(). */
const QUESTION_FINGERPRINTS_FOR_TEST: Record<ConsultQuestionType, RegExp[]> =
  Object.fromEntries(
    Object.entries(QUESTION_PATTERNS).map(([type, patterns]) => [
      type,
      patterns.map(
        (frags) => new RegExp(buildQuestionPattern(frags).source, 'i')
      ),
    ])
  ) as Record<ConsultQuestionType, RegExp[]>;

/**
 * ⭐ Phát hiện câu nào BOT ĐÃ HỎI trong lịch sử.
 * Chặn hỏi lặp NGAY CẢ KHI user chưa trả lời hoặc bot diễn đạt lại.
 */
export function detectAskedQuestions(
  assistantMessages: string[]
): Set<ConsultQuestionType> {
  const asked = new Set<ConsultQuestionType>();
  const texts = (assistantMessages || []).filter(Boolean);
  if (!texts.length) return asked;

  for (const raw of texts) {
    const text = raw || '';
    for (const type of CONSULT_QUESTION_ORDER) {
      if (asked.has(type)) continue;
      if (QUESTION_FINGERPRINTS_FOR_TEST[type].some((re) => re.test(text))) {
        asked.add(type);
      }
    }
  }
  return asked;
}

/* ────────────────────────────────────────────────────────────────────────
 * ⭐ NHẬN DIỆN THEO THỨ TỰ HỘI THOẠI (tín hiệu mạnh nhất)
 * ──────────────────────────────────────────────────────────────────────── */

export interface ConsultMessage {
  role: string;
  content: string;
}

export interface ConsultProgress {
  /** Các câu đã được user trả lời. */
  answered: Set<ConsultQuestionType>;
  /** Các câu bot đã hỏi. */
  asked: Set<ConsultQuestionType>;
  /** Đủ 4 câu → được phép tư vấn sản phẩm. */
  completed: boolean;
  /** Các câu còn thiếu (theo thứ tự chuẩn). */
  missing: ConsultQuestionType[];
  /** Câu tiếp theo cần hỏi (null nếu đã đủ). */
  nextType: ConsultQuestionType | null;
  /** Số lượt user đã nói. */
  userTurns: number;
}

/**
 * ⭐ Kiểm tra vị trí khớp có nằm trong một CÂU HỎI (dòng có dấu "?") hay không.
 *
 * Mục đích: tránh báo nhầm "bot đã hỏi câu X" khi bot chỉ nhắc lại cụm từ
 * giống câu hỏi trong lời giải thích (VD: "mức độ nhẹ" trong mô tả sản
 * phẩm) → sẽ chốt tư vấn sớm / bỏ sót câu cần hỏi.
 *
 * Cách kiểm tra: lấy DÒNG chứa vị trí khớp — nếu dòng đó có dấu "?" thì
 * đó là một câu hỏi. Câu hỏi tiêu chuẩn luôn nằm trên 1 dòng riêng.
 */
function looksLikeQuestion(text: string, matchIndex: number): boolean {
  const lineStart = text.lastIndexOf('\n', Math.max(0, matchIndex - 1)) + 1;
  let lineEnd = text.indexOf('\n', matchIndex);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  return line.includes('?');
}

/**
 * Tìm các câu hỏi có trong 1 message của bot + vị trí khớp.
 */
function findAskedTypes(
  text: string
): Map<ConsultQuestionType, number> {
  const found = new Map<ConsultQuestionType, number>();
  if (!text) return found;

  for (const type of CONSULT_QUESTION_ORDER) {
    let best = -1;
    for (const re of QUESTION_FINGERPRINTS_FOR_TEST[type]) {
      const m = re.exec(text);
      if (m && m.index > best) best = m.index;
    }
    if (best >= 0 && looksLikeQuestion(text, best)) found.set(type, best);
  }
  return found;
}

/**
 * ⭐⭐⭐ Phân tích tiến độ bộ 4 câu hỏi từ TOÀN BỘ hội thoại.
 *
 * Kết hợp 2 tín hiệu:
 *   1. REGEX — user đã nói nội dung khớp mẫu của câu nào.
 *   2. THỨ TỰ HỘI THOẠI — bot đã hỏi câu X, khách nói tiếp ngay sau đó
 *      → câu X ĐÃ TRẢ LỜI (bất kể dùng từ gì).
 *
 * ⭐ Tín hiệu (2) là thứ sửa bug "hỏi xong câu 4 rồi khách trả lời mà
 * không ra sản phẩm": trước đây chỉ dựa vào regex nên câu trả lời lạ
 * ("vẫn ổn", "khoảng năm nay rồi") không khớp mẫu nào → mãi thiếu.
 *
 * ⭐ Quy tắc "ĐỦ 4 CÂU": bot đã hỏi đủ 4 câu tiêu chuẩn → hoàn tất tư vấn.
 *   (Tương đương: user đã trả lời đủ 4 câu.)
 */
export function analyzeConsultProgress(
  messages: ConsultMessage[]
): ConsultProgress {
  const list = (messages || []).filter(
    (m) => m && typeof m.content === 'string'
  );

  const userTexts = list
    .filter((m) => m.role === 'user')
    .map((m) => m.content || '');
  const answered = detectAnsweredQuestions(userTexts);
  const asked = new Set<ConsultQuestionType>();

  // ── Tín hiệu thứ tự hội thoại ────────────────────────────────────────
  // `pending` = các câu bot đã hỏi nhưng chưa được trả lời, theo thứ tự.
  const pending: ConsultQuestionType[] = [];

  for (const m of list) {
    const content = m.content || '';
    if (m.role === 'assistant') {
      const matches = findAskedTypes(content);
      if (!matches.size) continue;

      // Câu hỏi bot KẾT THÚC bằng (vị trí khớp lớn nhất) là câu khách sẽ
      // trả lời tiếp theo → ưu tiên credit cho câu đó.
      let lastType: ConsultQuestionType | null = null;
      let lastIndex = -1;
      for (const [type, index] of matches) {
        asked.add(type);
        if (index > lastIndex) {
          lastIndex = index;
          lastType = type;
        }
      }
      if (lastType && !answered.has(lastType)) pending.push(lastType);
    } else if (m.role === 'user') {
      if (!pending.length) continue;
      // Khách vừa trả lời → câu bot hỏi gần nhất là câu được trả lời.
      const t = pending.shift()!;
      if (!answered.has(t)) answered.add(t);
    }
  }

  const missing = CONSULT_QUESTION_ORDER.filter((t) => !answered.has(t));
  // ⭐ Đủ 4 câu = TẤT CẢ 4 câu đã được RESOLVED (trả lời bằng lời nói hoặc
  // bằng thứ tự hội thoại).
  //
  // ⚠️ KHÔNG dùng `asked.size === 4` làm điều kiện đủ — vì khi đó bot vừa
  // HỎI câu 4 xong (khách chưa trả lời) cũng ra sản phẩm → vi phạm quy tắc
  // "hỏi đủ 4 câu rồi mới tư vấn". Đúng đắn là: bot hỏi câu 4 → KHÁCH TRẢ
  // LỜI → mới ra sản phẩm.
  const completed = missing.length === 0;

  let nextType: ConsultQuestionType | null = null;
  if (!completed) {
    // ⭐ TUYỆT ĐỐI không hỏi lại câu bot đã hỏi (yêu cầu cứng).
    // Nếu tất cả câu còn thiếu đều đã hỏi rồi → không hỏi thêm (im lặng
    // còn hơn hỏi lặp).
    nextType = missing.find((t) => !asked.has(t)) ?? null;
  }

  return {
    answered,
    asked,
    completed,
    missing,
    nextType,
    userTurns: userTexts.length,
  };
}

/** Đã trả lời đủ 4 câu → mới được tư vấn sản phẩm (chỉ dựa vào lời nói). */
export function hasCompletedConsultQuestions(
  userMessages: string[]
): boolean {
  return (
    detectAnsweredQuestions(userMessages).size === CONSULT_QUESTION_ORDER.length
  );
}

/**
 * ⭐ Phiên bản "đủ 4 câu" dựa trên TOÀN BỘ hội thoại (khuyên dùng).
 */
export function isConsultCompleted(messages: ConsultMessage[]): boolean {
  return analyzeConsultProgress(messages).completed;
}

/**
 * Lấy câu hỏi tiếp theo (chưa hỏi & chưa trả lời).
 *
 * @param lang Ngôn ngữ hiển thị.
 * @param userMessages Lịch sử tin nhắn của user.
 * @param askedMessages Lịch sử tin nhắn của BOT (chặn hỏi lặp).
 */
export function getNextConsultQuestion(
  lang: Lang,
  userMessages: string[],
  askedMessages: string[] = []
): { question: string; type: ConsultQuestionType } | null {
  const answered = detectAnsweredQuestions(userMessages);
  const alreadyAsked = detectAskedQuestions(askedMessages);
  const table = CONSULT_QUESTIONS[lang] || CONSULT_QUESTIONS.vi;

  for (const type of CONSULT_QUESTION_ORDER) {
    if (answered.has(type)) continue;
    if (alreadyAsked.has(type)) continue;
    const variants = table[type];
    return { question: variants[0], type };
  }
  return null;
}

/**
 * ⭐⭐ Lấy câu hỏi tiếp theo từ TOÀN BỘ hội thoại (khuyên dùng).
 *
 * Dùng `analyzeConsultProgress` nên tự động cả:
 *   - Bỏ qua câu user đã trả lời (kể cả trả lời kiểu không khớp regex,
 *     nhưng đúng thứ tự hội thoại).
 *   - Không hỏi lại câu bot đã hỏi.
 */
export function getNextConsultQuestionFromHistory(
  lang: Lang,
  messages: ConsultMessage[]
): { question: string; type: ConsultQuestionType } | null {
  const progress = analyzeConsultProgress(messages);
  if (!progress.nextType) return null;
  const table = CONSULT_QUESTIONS[lang] || CONSULT_QUESTIONS.vi;
  return { question: table[progress.nextType][0], type: progress.nextType };
}

/** ⭐ TẤT CẢ câu hỏi tiêu chuẩn (mọi ngôn ngữ, mọi biến thể). */
export const ALL_CONSULT_QUESTION_TEXTS: string[] = Object.values(
  CONSULT_QUESTIONS
).flatMap((byType) => Object.values(byType).flat());

/** Bản phẳng kèm loại câu (đủ mọi biến thể) để cắt theo nhóm. */
export const QUESTIONS_FLAT: { type: ConsultQuestionType; text: string }[] = (
  Object.keys(CONSULT_QUESTIONS) as Lang[]
).flatMap((lang) =>
  CONSULT_QUESTION_ORDER.flatMap((type) =>
    CONSULT_QUESTIONS[lang][type].map((text) => ({ type, text }))
  )
);

/**
 * ⭐ Dọn "rác" còn sót sau khi cắt câu hỏi.
 *
 * Khi LLM viết: "Bạn bao nhiêu tuổi rồi?" và ta cắt mẫu "bao nhiêu tuổi"
 * → còn lại mảnh vụn "Bạn ?" ở đầu câu → hiển thị rất khó chịu.
 *
 * → Xoá các mảnh "mồ côi" đứng dính ở đầu nội dung.
 */
function cleanOrphanFragments(text: string): string {
  return text
    // "Bạn ?" / "Bạn." / "Bạn\n\n" ở đầu → xoá hẳn.
    .replace(/^\s*(bạn ơi|bạn|ban|anh ơi|anh|chị ơi|chị|ok|vâng|ừ|được rồi)\s*(?=[?!.]|\n|$)/i, '')
    // "Dạ, tôi ghi nhận..." → giữ nguyên, chỉ bỏ dấu phẩy treo.
    .replace(/^\s*,\s*/, '')
    .replace(/[ \t]{2,}/g, ' ')
    // Dòng trống dẫn đầu (do cắt câu hỏi ở đầu nội dung).
    .replace(/^\s*\n+/, '')
    .trim();
}

/**
 * ⭐ Cắt bỏ mọi câu hỏi tiêu chuẩn trong nội dung LLM vừa sinh ra mà KHÔNG
 * NÊN xuất hiện (đã hỏi trước đó, hoặc user đã trả lời).
 */
export function stripAlreadyAskedQuestions(
  content: string,
  pastAssistantMessages: string[],
  userMessages: string[] = []
): string {
  if (!content) return content;
  let out = content;

  const history = (pastAssistantMessages || []).filter(Boolean);
  const answered = detectAnsweredQuestions(userMessages);
  const askedBefore = detectAskedQuestions(history);

  for (const type of CONSULT_QUESTION_ORDER) {
    if (!askedBefore.has(type) && !answered.has(type)) continue;

    // 1) Cắt theo chuỗi câu đầy đủ trước.
    for (const qText of QUESTIONS_FLAT.filter((x) => x.type === type)) {
      out = out.replace(buildLoosePattern(qText.text), '');
    }
    // 2) Cắt theo mẫu câu (chịu được bản viết tắt của LLM).
    const byLength = [...QUESTION_FINGERPRINTS_FOR_TEST[type]].sort(
      (a, b) => b.source.length - a.source.length
    );
    for (const pattern of byLength) {
      let prev: string;
      do {
        prev = out;
        out = out.replace(pattern, '');
      } while (out !== prev);
    }
  }

  return cleanOrphanFragments(
    out
      .replace(/\*{2,}/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * ⭐⭐⭐ Cắt câu hỏi dựa trên TIẾN ĐỘ HỘI THOẠI (nên dùng hàm này).
 *
 * Khác với `stripAlreadyAskedQuestions` ở chỗ dùng `progress.answered`
 * (đã bao gồm credit theo thứ tự hội thoại) + `progress.asked`.
 * → LLM tự hỏi lại câu mà user ĐÃ trả lời (kể cả bằng cách diễn đạt
 *   không khớp regex) cũng bị cắt sạch.
 */
export function stripConsultQuestions(
  content: string,
  progress: ConsultProgress,
  pastAssistantMessages: string[] = []
): string {
  if (!content) return content;
  let out = content;

  const askedBefore = detectAskedQuestions(
    (pastAssistantMessages || []).filter(Boolean)
  );

  for (const type of CONSULT_QUESTION_ORDER) {
    if (!askedBefore.has(type) && !progress.answered.has(type)) continue;

    for (const qText of QUESTIONS_FLAT.filter((x) => x.type === type)) {
      out = out.replace(buildLoosePattern(qText.text), '');
    }
    const byLength = [...QUESTION_FINGERPRINTS_FOR_TEST[type]].sort(
      (a, b) => b.source.length - a.source.length
    );
    for (const pattern of byLength) {
      let prev: string;
      do {
        prev = out;
        out = out.replace(pattern, '');
      } while (out !== prev);
    }
  }

  return cleanOrphanFragments(
    out
      .replace(/\*{2,}/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * ⭐ KIỂM TRA LẶP — dùng trực tiếp trong UI trước khi render.
 */
export function isQuestionAlreadyAsked(
  question: string,
  assistantMessages: string[]
): boolean {
  const target = normalizeForMatch(question);
  if (!target) return false;
  return (assistantMessages || [])
    .filter(Boolean)
    .some((raw) => normalizeForMatch(raw).includes(target));
}

/**
 * Lọc ra câu hỏi tiếp theo đã CHẮC CHẮN chưa từng được hỏi.
 */
export function getSafeNextConsultQuestion(
  lang: Lang,
  userMessages: string[],
  assistantMessages: string[]
): { question: string; type: ConsultQuestionType } | null {
  const candidate = getNextConsultQuestion(lang, userMessages, assistantMessages);
  if (!candidate) return null;
  if (isQuestionAlreadyAsked(candidate.question, assistantMessages)) return null;
  return candidate;
}
