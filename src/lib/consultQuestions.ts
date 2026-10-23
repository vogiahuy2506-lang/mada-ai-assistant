/**
 * ⭐ Bộ 4 câu hỏi tiêu chuẩn trước khi tư vấn sản phẩm.
 *
 * YÊU CẦU NGHIỆP VỤ: không tư vấn sản phẩm cho tới khi đã hỏi đủ 4 câu.
 * Câu hỏi hỏi TỪNG CÂU MỘT, và BỎ QUA câu đã có câu trả lời trong lịch sử
 * (người dùng có thể đã nói sẵn → không hỏi lại).
 *
 * Thứ tự 4 câu (anh đã chốt):
 *   1. Bạn cần tôi giúp gì hôm nay?
 *   2. Năm nay bạn bao nhiêu tuổi rồi?
 *   3. Bạn gặp tình trạng như thế nào, hãy diễn đạt để tôi hiểu rõ?
 *   4. Bạn đã gặp tình trạng này bao lâu rồi? (kèm 3 cấp độ nặng nề)
 *
 * Sau khi đủ 4 câu → bot chuyển sang vai trò TRỢ LÝ NGANG NGỰA BÁC SĨ.
 */

export type ConsultQuestionType = 'needHelp' | 'age' | 'condition' | 'duration';

type Lang = 'vi' | 'en' | 'ar' | 'fr';

/** Thứ tự cố định — luôn hỏi theo thứ tự này. */
export const CONSULT_QUESTION_ORDER: ConsultQuestionType[] = [
  'needHelp',
  'age',
  'condition',
  'duration',
];

const QUESTIONS: Record<Lang, Record<ConsultQuestionType, string[]>> = {
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

/**
 * Từ khoá nhận diện user ĐÃ trả lời câu hỏi nào (để không hỏi lại).
 * So khớp theo nội dung lịch sử hội thoại.
 */
// ⚠️ Với tiếng Việt KHÔNG dùng ranh giới từ `\b`:
const ANSWER_SIGNALS: Record<ConsultQuestionType, RegExp[]> = {
  // ⭐ Câu 1 "Bạn cần tôi giúp gì hôm nay?" — user đã nêu nhu cầu/vấn đề.
  // ⚠️ KHÔNG dùng `hôm nay` trần: câu 4 (thời gian) và câu 3 hay chứa từ này.
  // Nếu khớp trần, bot sẽ tưởng đã xong câu 1 mà thực ra user chỉ nói triệu chứng.
  needHelp: [
    /(cần.{0,25}(giúp|hỏi|tư vấn|giải quyết|xem|chọn|mua|tìm))/i,
    /(tôi.{0,25}(muốn|cần|đang cần)|giúp.{0,20}tôi|cho tôi.{0,20}(xem|giúp|tư vấn))/i,
    /(cho tôi.{0,30}(giá|thông tin|tư vấn|gợi ý)|tư vấn.{0,20}(giúp|cho tôi))/i,
    /(bị.{0,25}(khó|ù|nhức|đau|yếu|mỏi)|làm sao.{0,20}(hết|khỏi|cải thiện)|có cách nào)/i,
    // ⭐ Nói thẳng triệu chứng ở câu đầu tiên VẪN LÀ câu trả lời cho câu 1.
    // "tôi bị mờ mắt khi đọc sách" → người dùng đã nói rõ mình cần gì (chính
    // là giải quyết chứng mờ mắt). Không có mẫu nào khớp → bot hỏi lại
    // "Bạn cần tôi giúp gì hôm nay?" dù khách đã trả lời xong. Rất vô duyên.
    /(tôi.{0,30}(bị|mắc|đang gặp|gặp|hay bị|thường bị))(?![^.]*\?$)/i,
    /(bị\s+\w{2,}(?:\s+\w{2,}){0,2}\s*(khi|lúc|mỗi khi|lúc nào|bao giờ))/i,
    /\b(i (?:have|am|get|suffer from))\b/i,
    /(أُعاني|أواجه|يعاني)/,
    /(je (?:suis|me sens|ai|souffre))/i,
    /\b(need help|can you help|i need|looking for|advise me|recommend)\b/i,
    /(تحتاج.{0,20}(مساعدة|إرشاد)|أحتاج|أريد|انصحني)/,
    /(besoin d'aide|pouvez-vous m'aider|j'ai besoin|conseillez-moi)/i,
  ],
  // "tuổi", số tuổi, "người già", "cao tuổi"
  // ⚠️ KHÔNG dùng `người lớn|trẻ em` trần: câu "bên tôi phụng vụ trẻ em bị tự
  // kỷ" hay "tôi cần thiết bị cho mẹ" sẽ bị đánh dấu đã trả lời tuổi → chốt tư vấn sớm.
  age: [
    /(\d{1,3}\s*tuổi|bao nhiêu tu\u1edbi|người già|cao tuổi|trung niên)/i,
    /\b(\d{1,3}\s*(years?\s*old|yo)|how old|elderly|senior)\b/i,
    // AR / FR
    /(\d{1,3}\s*سن|عمري\s*\d|كم\s*عمرك)/,
    /(\d{1,3}\s*ans|j'ai\s+\d{1,3}\s*ans|quel\s*âge)/i,
  ],
  // ⭐ Câu 3 "Bạn gặp tình trạng như thế nào?" — user mô tả triệu chứng.
  // ⚠️ KHÔNG thêm "mỏi" trần ở đây: "mỏi mắt" là TRIỆU CHỨNG và người dùng hay
  // nói "tôi mỏi mắt khi đọc" → đây CHÍNH LÀ câu trả lời hợp lệ cho câu 3.
  condition: [
    /(cảm thấy|cảm giác|khó chịu|mệt mỏi|lo lắng|khó khăn|chật hẹp|bất tiện|nhức)/i,
    /(thấy.{0,30}(khó|yếu|không\s+được|chậm|mệt|run|không\s+vận\s+động|mỏi))/i,
    /(yếu|run\s+rẩy).{0,25}(tay|chân|người|hết\s+hơi|không\s+ra\s+hơi)/i,
    /khó\s+(cầm|đi|lên|ngủ|ăn|uống|nói|thở|mở\s+mắt|đọc|nghe|thấy|nhìn)/i,
    // ⭐ "KHÔNG đọc được", "không nhìn thấy", "không nghe rõ" — cấu trúc "không
    // + động từ + được", KHÁC với "khó đọc". Mẫu cũ chỉ bắt "khó", nên gặp
    // câu rất phổ biến này là bot hỏi lại đúng câu khách vừa trả lời.
    /không\s+(đọc|nghe|nhìn|thấy|nói|hiểu|ghi|viết|đi|lên|ăn|uống|ngủ)(?:\s+(được|ra|ra rõ|thức))?/i,
    /mắt\s+(rất\s+)?(mờ|mỏi|không rõ|nhòe|kém)/i,
    /(rất\s+|khá\s+|hơi\s+)?(mờ mắt|khó đọc|khó nhìn|khó nghe|ù tai|khó chịu khi)/i,
    // "mệt", "đau", "yếu", "run", "mỏi" đứng riêng — người dùng hay trả lời
    // ngắn: "tôi mệt", "đau lưng", "chân tôi yếu" chứ không nói "cảm thấy".
    /(mệt|đau|yếu|run rẩy|khó chịu|mỏi mắt|ù tai|khó\s+nghe|khó\s+nhìn|chóng\s+mặt)/i,
    /\b(feel|feeling|uncomfortable|tired|frustrat\w*|difficult|struggl\w*|weak|pain|dizzy)\b/i,
    /\b(hard to|difficulty|cannot|can't|unable to)\b/i,
    // AR / FR
    /(أشعر|تعب|ألم|ضعيف|مشكلة|صعوبة)/,
    /(je\s+(me\s+sens|ressens|suis\s+fatigu)|fatigu|faible|douleur|mal\s+à)/i,
  ],
  // ⭐ Câu 4 "Bạn đã gặp bao lâu rồi / mức độ nặng nề?" — thời gian + mức độ.
  duration: [
    /(\d+\s*(ngày|tuần|tháng|năm|hôm|giờ)|bao lâu rồi|lâu rồi|lâu nay|vừa mới|hôm qua|mới\s+bị|đã\s+\d+)/i,
    /(nhẹ|vừa phải|trung bình|khá nặng|nặng|nghiêm trọng|tệ|nhẹ nhàng)/i,
    // ⚠️ "years old" là TUỔI, không phải THỜI LƯỢNG → dùng ranh giới \b+negative
    // lookahead để "45 years old" không bị tính nhầm là câu trả lời về thời gian.
    /\b(\d+\s*(days?|weeks?|months?|hours?)(?!\s+old)|how long|for a (while|month|year)|mild|moderate|severe)\b/i,
    /((\d+|بضعة|عدة)\s*(أيام|أسابيع|شهور|أشهر)|منذ\s+متى|خفيفة|متوسطة|شديدة)/,
    /((\d+|quelques)\s*(jours|semaines|mois|années)|depuis\s+combien|depuis\s+\d|léger|modéré|sévère)/i,
  ],
};

/**
 * Kiểm tra câu hỏi nào đã được user trả lời trong lịch sử.
 *
 * @param userMessages Danh sách nội dung các tin nhắn của user.
 * @returns Set các loại câu hỏi đã có câu trả lời.
 */
export function detectAnsweredQuestions(userMessages: string[]): Set<ConsultQuestionType> {
  const answered = new Set<ConsultQuestionType>();
  const text = userMessages.join('\n').toLowerCase();
  if (!text.trim()) return answered;

  for (const type of CONSULT_QUESTION_ORDER) {
    if (ANSWER_SIGNALS[type].some((re) => re.test(text))) {
      answered.add(type);
    }
  }
  return answered;
}

/**
 * Trả về câu hỏi tiếp theo cần hỏi (chưa có câu trả lời trong lịch sử).
 *
 * ⚠️ QUY TẮC TUYỆT ĐỐI: KHÔNG BAO GIỜ hỏi lại câu đã hỏi.
 * Có hai lớp kiểm soát:
 *   1. `askedMessages` — lịch sử tin nhắn của BOT. Nếu bot đã hỏi câu nào rồi
 *      thì tuyệt đối không hỏi lại, kể cả user chưa trả lời (user im lặng,
 *      trả lời lệch, hoặc bot tự hỏi sai thứ tự).
 *   2. `answered` — lịch sử tin nhắn của USER. Bỏ qua câu user đã nói sẵn.
 *
 * @param lang Ngôn ngữ hiển thị.
 * @param userMessages Lịch sử tin nhắn của user.
 * @param askedMessages Lịch sử tin nhắn của BOT (dùng để chặn hỏi lặp).
 * @returns Câu hỏi kế tiếp, hoặc null nếu đã đủ 4 câu / đã hỏi hết.
 */
export function getNextConsultQuestion(
  lang: Lang,
  userMessages: string[],
  askedMessages: string[] = []
): { question: string; type: ConsultQuestionType } | null {
  const answered = detectAnsweredQuestions(userMessages);
  // ⭐ Câu nào bot đã hỏi rồi → loại khỏi danh sách được hỏi.
  const alreadyAsked = detectAskedQuestions(askedMessages);
  const table = QUESTIONS[lang] || QUESTIONS.vi;

  for (const type of CONSULT_QUESTION_ORDER) {
    // User đã trả lời → bỏ qua.
    if (answered.has(type)) continue;
    // ⭐ Bot ĐÃ HỎI rồi → tuyệt đối không hỏi lại (yêu cầu cứng).
    if (alreadyAsked.has(type)) continue;
    const variants = table[type];
    return {
      question: variants[0],
      type,
    };
  }

  return null;
}

/** Đã hủy hết 4 câu (user đã trả lời đủ) → mới được tư vấn sản phẩm. */
export function hasCompletedConsultQuestions(userMessages: string[]): boolean {
  const answered = detectAnsweredQuestions(userMessages);
  return CONSULT_QUESTION_ORDER.every((type) => answered.has(type));
}

/**
 * ⭐ TẤT CẢ câu hỏi tiêu chuẩn (mọi ngôn ngữ, mọi biến thể).
 * Dùng để lọc/cắt bỏ mọi câu đã hỏi ra khỏi câu trả lời của LLM —
 * đảm bảo không câu nào lặp lại dù bot viết theo cách nào.
 */
export const ALL_CONSULT_QUESTION_TEXTS: string[] = Object.values(QUESTIONS)
  .flatMap((byType) => Object.values(byType).flat());

/** Bản phẳng kèm loại câu, lấy ĐỦ mọi biến thể, để cắt theo nhóm. */
const QUESTIONS_FLAT: { type: ConsultQuestionType; text: string }[] = (
  Object.keys(QUESTIONS) as Lang[]
).flatMap((lang) =>
  CONSULT_QUESTION_ORDER.flatMap((type) =>
    QUESTIONS[lang][type].map((text) => ({ type, text }))
  )
);

/**
 * ⭐ Mẫu câu hỏi dùng để NHẬN DIỆN và CẮT.
 *
 * Mỗi loại câu có nhiều mẫu; mẫu là các CỤM TỪ phải xuất hiện (không nhất
 * thiết liền nhau) để nhận ra câu hỏi đó. Nhờ vậy nhận diện được cả bản đầy đủ
 * lẫn bản LLM viết tắt ("Bạn cảm thấy sao?").
 */
const QUESTION_PATTERNS: Record<ConsultQuestionType, string[][]> = {
  // "Bạn cần tôi giúp gì hôm nay?"
  needHelp: [
    ['Bạn cần tôi giúp gì'],
    ['cần tôi giúp gì'],
    ['Hôm nay bạn cần tôi giúp'],
    // ⭐ Biến thể có ĐUÔI CÂU phía sau. Nếu thiếu, khi cắt chỉ ăn
    // "Bạn cần tôi giúp gì" rồi SÓT lại đoạn rác kiểu "hơn nữa không?".
    ['Bạn cần tôi giúp gì', 'hơn nữa không'],
    ['Bạn cần tôi giúp gì', 'hơn nữa'],
    ['Bạn cần tôi giúp gì', 'vậy'],
    ['Bạn cần tôi giúp gì', 'nhé'],
    ['Bạn cần tôi giúp gì', 'gì'],
    // ⚠️ Bot hay đổi đại từ: "tôi" → "mình". Thiếu các biến thể này thì bot
    // hỏi lại câu 1 ở lượt sau mà ta không nhận ra là đã hỏi.
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
  // "Năm nay bạn bao nhiêu tuổi rồi?"
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
  // "Bạn gặp tình trạng như thế nào? ... diễn đạt để tôi hiểu rõ?"
  condition: [
    ['Bạn gặp tình trạng như thế nào'],
    ['gặp tình trạng', 'thế nào'],
    ['Bạn đang gặp tình trạng'],
    ['diễn đạt', 'hiểu rõ hơn'],
    ['mô tả', 'triệu chứng'],
    ['What situation are you facing'],
    ['Describe your condition'],
    ['What are you experiencing'],
    ['ما。面对ه', 'وصف'],
    ['صف', 'أعراضك'],
    ['Quelle situation traversez'],
    ['Décrivez votre état'],
  ],
  // "Bạn đã gặp tình trống này bao lâu rồi?" + 3 cấp độ
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

/** Regex nhận diện (không bỏ dấu) cho từng loại câu hỏi. */
const QUESTION_FINGERPRINTS: Record<ConsultQuestionType, RegExp[]> =
  Object.fromEntries(
    Object.entries(QUESTION_PATTERNS).map(([type, patterns]) => [
      type,
      patterns.map((frags) => buildQuestionPattern(frags)),
    ])
  ) as Record<ConsultQuestionType, RegExp[]>;

/**
 * ⭐ Regex CHỈ DÙNG ĐỂ .test() — KHÔNG có cờ `g`.
 *
 * Lý do: `.test()` trên regex có cờ `g` sẽ GHI NHỚ `lastIndex`, nên lần gọi
 * thứ hai trở đi bắt đầu tìm từ vị trí cũ và có thể bỏ sót kết quả khớp
 * (rất dễ xảy ra vì các object regex ở trên được dùng lại nhiều lần).
 */
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
 * ⭐⭐⭐ TUYỆT ĐỐI KHÔNG LẶP CÂU HỎI.
 *
 * Cắt bỏ mọi câu hỏi tiêu chuẩn trong nội dung LLM vừa sinh ra mà KHÔNG
 * NÊN xuất hiện, theo 2 tiêu chí:
 *   1. ĐÃ HỎI — bot đã hỏi câu đó trước đó (tuyệt đối không hỏi lại).
 *   2. ĐÃ ĐƯỢC TRẢ LỜI — user vừa nói rồi, hỏi lại là vô nghĩa.
 *
 * ⭐ Dựng regex từ MẪU CÂU chứ không từ chuỗi câu — vì LLM thường viết tắt
 * ("Bạn cảm thấy sao?" thay vì "Bạn cảm thấy sao, và tình trạng hiện tại ra
 * sao?"). Nếu chỉ so chuỗi, bản viết tắt sẽ lọt và người dùng thấy câu lặp.
 */
export function stripAlreadyAskedQuestions(
  content: string,
  pastAssistantMessages: string[],
  userMessages: string[] = []
): string {
  if (!content) return content;
  let out = content;

  const history = (pastAssistantMessages || []).filter(Boolean);
  // ⭐ Câu user ĐÃ TRẢ LỜI → cũng không được hỏi lại.
  const answered = detectAnsweredQuestions(userMessages);
  const askedBefore = detectAskedQuestions(history);

  for (const type of CONSULT_QUESTION_ORDER) {
    if (!askedBefore.has(type) && !answered.has(type)) continue;

    // ⭐ THỨ TỰ BẮT BUỘC: cắt CÂU ĐẦY ĐỦ trước, rồi mới tới mẫu câu.
    // Nếu làm ngược, mẫu ngắn ("bao lâu rồi") sẽ cắt mất đoạn giữa trước khi
    // câu đầy đủ kịp khớp → sót lại mảnh vỡ như:
    //   "Bạn đã…rồi? Bạn thuộc…(3 cấp độ)"  ← đọc rất khó chịu.
    // 1) Cắt theo chuỗi câu đầy đủ (bắt câu chuẩn có dấu câu bị thêm/bớt).
    for (const qText of QUESTIONS_FLAT.filter((x) => x.type === type)) {
      out = out.replace(buildLoosePattern(qText.text), '');
    }
    // 2) Cắt theo mẫu câu (chịu được bản viết tắt của LLM).
    // Sắp xếp theo ĐỘ DÀI GIẢM DẦN: pattern dài khớp trước, nếu không pattern
    // ngắn sẽ "cắt dở" và để lọt phần còn lại của câu.
    const byLength = [...QUESTION_FINGERPRINTS[type]].sort(
      (a, b) => b.source.length - a.source.length
    );
    for (const pattern of byLength) {
      // Lặp lại cho tới khi không còn khớp — xử lý nhiều lần xuất hiện.
      let prev: string;
      do {
        prev = out;
        out = out.replace(pattern, '');
      } while (out !== prev);
    }
  }

  // Dọn dấu "*" rơi rãi còn sót lại sau khi cắt câu, và gộp dòng trống.
  return out
    // Chỉ dọn cặp ** rời rạc (markdown hỏng), KHÔNG xóa * đơn lẻ vì đó là
    // markdown in nghiêng hợp lệ.
    .replace(/\*{2,}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * ⭐ CHUẨN HÓA ĐỂ SO KHỚP — bỏ dấu, hạ chữ, bỏ dấu câu, gộp khoảng trắng.
 * Dùng để so khớp câu hỏi mà không vướng khác biệt về dấu câu hay emoji.
 */
function normalizeForCompare(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,;:"'`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tạo RegExp khớp được CẢ HAI dạng: có dấu và không dấu.
 *
 * Mọi câu hỏi tiếng Việt đều có dấu ("cảm thấy"), nhưng nội dung bot sinh ra
 * có thể thiếu dấu do mô hình, và câu trong lịch sử lại giữ dấu gốc. Nên với
 * mỗi đoạn chữ ta chấp nhận CẢ HAI biến thể.
 */
function buildLoosePattern(text: string): RegExp {
  const strip = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const variants = new Set<string>();
  variants.add(escape(text));
  const noAccent = strip(text);
  if (noAccent !== text) variants.add(escape(noAccent));
  // Cho phép "?" hoặc "？", và dấu nhấn mạnh *in nghiêng* quanh câu.
  const body = [...variants]
    .map((v) => v.replace(/\\\?/g, '[?？؟]'))
    .join('|');
  // KHÔNG nuốt xuống dòng (\\s trong JS khớp cả \n), để không ăn mất dấu "*"
  // mở đầu câu kế tiếp khi cắt câu nằm ngay trước một dòng mới.
  return new RegExp(`\\*?[ \\t]*(?:${body})[ \\t]*\\*?`, 'gi');
}

/**
 * Dựng RegExp nhận diện một CÂU HỎI (dùng để cắt khỏi text của LLM).
 *
 * ⭐ Quan trọng: phải KHỚP TRỌN CÂU, không chỉ khớp một từ khóa. Ví dụ mẫu
 * "hôm nay" chỉ khớp 2 từ đầu → cắt dở, để lọt phần ", bạn cần tôi giúp gì?".
 * Vì vậy ta ghép CẢ tất cả các cụm của một câu thành một mẫu liên tiếp,
 * cho phép chen khoảng trắng/dấu câu ở giữa — bắt được cả bản viết tắt lẫn bản đầy đủ.
 */
function buildQuestionPattern(fragments: string[]): RegExp {
  const each = fragments.map((f) => buildLoosePattern(f).source);
  if (!each.length) return /(?!)/;
  // Nối các cụm lại, cho phép tối đa ~40 ký tự xen kheo giữa chúng.
  const joiner = '[\\s\\S]{0,40}?';
  // ⭐ Phần đuôi KHÔNG được nuốt xuống dòng (\\s trong JS khớp cả \n). Nếu nuốt,
  // nó sẽ ăn luôn "\n\n*" mở đầu câu kế tiếp → câu đó mất dấu * mở đầu và
  // hiển thị lỗi trong khung chat.
  const WORD =
    '(?:hôm\\s+nay|ngày|không|vậy|nhé|nha|ạ|à|đã|rồi|hơn|thêm|nữa|đây)';
  const tail = `(?:[ \\t]*${WORD}){0,2}[ \\t*?!.。？！]*`;
  // ⭐⭐ LƯỠ CẮT DỞ: LLM hay thêm đuôi vào câu hỏi, ví dụ
  //   "Bạn cần tôi giúp gì hơn nữa không?"
  // Chỉ cắt "Bạn cần tôi giúp gì" sẽ SÓT lại "không?" rác rồi. Ở đây cho
  // phép hấp thụ thêm các từ bám dính ("không", "vậy", "nhé", "ạ", "đã", "rồi")
  // ngay sau câu — nhưng KHÔNG được nhảy qua dấu xuống dòng, để không ăn mất
  // câu kế tiếp.
  // ⚠️ KHÔNG dùng toán tử `+` ở đây — regex sẽ khớp quá rộng và cắt nhầm cả
  // những câu CHƯA hề bị hỏi. Thay vào đó mỗi biến thể đuôi đã được liệt kê
  // tường minh trong QUESTION_PATTERNS (ví dụ ['Bạn cần tôi giúp gì','hơn nữa']).
  // ⭐ Hấp thụ từ bám dính PHÍA TRƯỚC câu ("Vậy", "Thế", "Vậy thì") — nếu không,
  // cắt "…bạn cần tôi giúp gì hôm nay nhé?" sẽ để lại mảch rác "Vậy".
  const lead = `(?:[ \\t]*(?:vậy|thế|nào|nữa|nhé|ạ))?[ \\t*]*`;
  return new RegExp(`${lead}(?:${each.join(joiner)})${tail}`, 'gi');
}

/**
 * ⭐ Phát hiện câu nào BOT ĐÃ HỎI trong lịch sử.
 *
 * Mục đích: chặn hỏi lặp NGAY CẢ KHI:
 *   - user chưa trả lời (im lặng, hoặc trả lời không khớp mẫu nào)
 *   - bot/LLM diễn đạt lại câu hỏi theo cách khác (ví dụ "Bạn cảm thấy sao?"
 *     thay vì "Bạn cảm thấy sao, và tình trạng hiện tại ra sao?")
 *
 * Nhờ vậy mỗi câu tiêu chuẩn chỉ được hỏi ĐÚNG MỘT LẦN duy nhất.
 */
export function detectAskedQuestions(assistantMessages: string[]): Set<ConsultQuestionType> {
  const asked = new Set<ConsultQuestionType>();
  const texts = (assistantMessages || []).filter(Boolean);
  if (!texts.length) return asked;

  // So khớp trên BẢN GỐC (giữ dấu) với pattern đã hỗ trợ cả 2 dạng có/không dấu.
  // Nếu chuẩn hóa ở đây thì pattern giữ dấu sẽ không bao giờ khớp.
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

/**
 * ⭐ KIỂM TRA LẶP — dùng trực tiếp trong UI trước khi render.
 *
 * Trả về true nếu câu hỏi đã xuất hiện trong bất kỳ tin nhắn nào của bot
 * (dù chỉ khác nhau ở dấu câu, emoji, hay cách diễn đạt). Lớp phòng thủ cuối
 * cùng, đảm bảo câu hỏi KHÔNG BAO GIỜ hiện 2 lần trên màn hình.
 */
export function isQuestionAlreadyAsked(
  question: string,
  assistantMessages: string[]
): boolean {
  const target = normalizeForCompare(question);
  if (!target) return false;
  return (assistantMessages || [])
    .filter(Boolean)
    .some((raw) => normalizeForCompare(raw).includes(target));
}

/**
 * Lọc ra câu hỏi tiếp theo đã CHẮC CHẮN chưa từng được hỏi.
 * Lớp bảo vệ bậc cao nhất: dùng cả 3 lớp kiểm tra cùng lúc.
 *
 * @returns Câu hỏi an toàn để hỏi, hoặc null nếu không còn câu nào hợp lệ.
 */
export function getSafeNextConsultQuestion(
  lang: Lang,
  userMessages: string[],
  assistantMessages: string[]
): { question: string; type: ConsultQuestionType } | null {
  const candidate = getNextConsultQuestion(lang, userMessages, assistantMessages);
  if (!candidate) return null;
  // Lớp phòng thủ cuối: nếu lỡ câu này vẫn nằm trong lịch sử bot → bỏ qua.
  if (isQuestionAlreadyAsked(candidate.question, assistantMessages)) return null;
  return candidate;
}