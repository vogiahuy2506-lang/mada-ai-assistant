/**
 * ⭐ Định tuyến chuyên môn: khi người dùng chat với Bot 7 (Thông tin bổ trợ —
 * "TRÒ CHUYỆN MỚI") mà câu hỏi thuộc lĩnh vực riêng của 1 chuyên gia
 * (thị giác, thính giác, …) thì chuyển sang đúng bot chuyên môn đó.
 *
 * LÝ DO CẦN:
 * Bot 7 được lập trình nắm toàn bộ kiến thức 6 chuyên gia, nên nó trả lời
 * đúng nội dung thị giác nhưng header vẫn ghi "6 CHUYÊN GIA CHUYÊN MÔN" →
 * người dùng tưởng bị gọi nhầm bot. Ở đây ta chuyển hẳn sang bot chuyên môn
 * để header + tên hiển thị khớp với nội dung trả lời.
 */

/** Từ khoá đặc trưng của từng chuyên môn. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'bot-hearing': [
    'máy trợ thính', 'trợ thính', 'thính giác', 'nghe kém', 'khó nghe', 'không nghe rõ',
    'ù tai', 've kêu', 'điếc', 'lãng tai', 'mất thính lực', 'thính lực kém',
    'khuếch đại âm thanh', 'hearing aid', 'hearing', 'tinnitus', 'deaf',
    'hard of hearing', 'amplifier', 'neckloop', 'fm system', 'sound field', 'cochlear',
  ],
  'bot-vision': [
    'mù', 'mù mắt', 'khiếm thị', 'mất thị lực', 'thị lực kém', 'thị giác',
    'mắt kém', 'mắt mờ', 'nhìn mờ', 'nhìn kém', 'đọc sách khó', 'đọc chữ khó',
    'chữ nhỏ', 'phóng to chữ', 'tương phản cao', 'kính lúp', 'kính mắt',
    'đọc màn hình', 'màn hình', 'braille', 'chữ nổi', 'magnifier', 'low vision',
    'vision loss', 'blind', 'visually impaired', 'sight', 'screen reader', 'jaws', 'nvda',
  ],
  'bot-speech': [
    'giao tiếp', 'sói khó', 'khó nói', 'không nói được', 'âm lượng yếu', 'giọng nói yếu',
    'mất giọng', 'khàn giọng', 'rối loạn ngôn ngữ', 'aac', 'nói lại',
    'speech', 'communication', 'voice', 'mute', 'voicemail', 'text to speech', 'aphasia',
  ],
  'bot-cognitive': [
    'trí nhớ', 'quên', 'ghi nhớ', 'nhận thức', 'tâm thần', 'hội chứng down', 'autism',
    'tự kỷ', 'suy sụp nhận thức', 'memory', 'cognitive', 'cognitive decline',
    'dementia', 'alzzheimer', 'attention', 'tập trung',
  ],
  'bot-neuro': [
    'nẹp', 'chỉnh hình', 'orthotic', 'thần kinh cơ', 'cơ xương khớp',
    'bàn phím thay thế', 'nẹp cổ tay', 'khuỷu tay', 'gỗ nâng đầu giữ xe',
    'neuromusculoskeletal', 'orthosis', 'prosthesis', 'wrist', 'headrest',
  ],
  'bot-mobility': [
    'xe lăn', 'xe điện', 'xe lăn điện', 'khung đi', 'gậy', 'gậy chống', 'nạng',
    'đi lại khó', 'khó đi lại', 'di chuyển', 'giao thông', 'xe', 'lên xe', 'thang máy',
    'wheelchair', 'walker', 'crutch', 'cane', 'mobility aid', 'transportation', 'vehicle',
  ],
};

/** Từ khoá riêng của Bot 7 (tiêu chuẩn/quy định) — giữ nguyên Bot 7. */
const REGULATORY_KEYWORDS = [
  'iso', 'wcag', 'iec', 'cen', 'ansi', 'tiêu chuẩn', 'quy chuẩn', 'quy định',
  'chứng nhận', 'ce mark', 'ce marking', 'fda', 'mdr', 'qatar', 'compliance',
  'standard', 'regulation', 'norm', 'certification', 'iso 9999',
];

/**
 * Chọn bot chuyên môn phù hợp với câu hỏi.
 *
 * @param message Tin nhắn người dùng.
 * @param currentBotId Bot đang chat (thường là 'bot-regulatory' ở "Trò chuyện mới").
 * @returns botId chuyên môn nếu nên chuyển, null nếu giữ nguyên bot hiện tại.
 */
export function routeToSpecialistBot(message: string, currentBotId: string | null): string | null {
  if (!message) return null;

  // Chỉ route khi đang chat với Bot 7. Nếu user đã chọn bot chuyên môn thì
  // không can thiệp — họ đang chủ động hỏi bot đó.
  if (currentBotId !== 'bot-regulatory') return null;

  const q = message.toLowerCase();

  // Câu hỏi thiên về tiêu chuẩn/quy định → giữ Bot 7 (đúng chuyên môn của nó).
  if (REGULATORY_KEYWORDS.some((k) => q.includes(k))) return null;

  let best: { botId: string; score: number } | null = null;

  for (const [botId, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const hits = keywords.filter((k) => q.includes(k)).length;
    if (hits > 0 && (!best || hits > best.score)) {
      best = { botId, score: hits };
    }
  }

  // Chỉ route khi có từ khoá đủ mạnh (≥2 từ khoá trùng) để tránh chuyển bot
  // do một từ đơn lệ, ví dụ chỉ nhắc "màn hình" trong câu hỏi chung.
  if (!best || best.score < 2) return null;

  return best.botId;
}