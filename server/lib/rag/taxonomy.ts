/**
 * MADA AT Taxonomy — Phân loại 7 nhóm Công nghệ Hỗ trợ
 * Mapping theo ISO 9999:2022, WCAG 2.2, WHO GATE Priority APL
 */

export type ATCategory =
  | 'vision'         // Thị giác — Khiếm thị, low vision
  | 'hearing'        // Thính giác — Khiếm thính, điếc
  | 'mobility'       // Vận động — Xe lăn, nạng, khung đi
  | 'cognition'      // Nhận thức — Trí nhớ, học tập, tự kỷ
  | 'communication'  // Giao tiếp — AAC, ngôn ngữ ký hiệu
  | 'daily_living'   // Sinh hoạt — Ăn uống, vệ sinh, mặc đồ
  | 'education'      // Giáo dục — Học tập, sách nói
  | 'web_accessibility' // Tiếp cận web — WCAG
  | 'general';       // Tổng quát / chưa phân loại

export const AT_CATEGORIES: Record<ATCategory, { vi: string; en: string; icon: string }> = {
  vision: { vi: 'Hỗ trợ Thị giác', en: 'Vision', icon: '👁️' },
  hearing: { vi: 'Hỗ trợ Thính giác', en: 'Hearing', icon: '👂' },
  mobility: { vi: 'Hỗ trợ Vận động', en: 'Mobility', icon: '🦽' },
  cognition: { vi: 'Hỗ trợ Nhận thức', en: 'Cognition', icon: '🧠' },
  communication: { vi: 'Hỗ trợ Giao tiếp', en: 'Communication', icon: '💬' },
  daily_living: { vi: 'Hỗ trợ Sinh hoạt', en: 'Daily Living', icon: '🏠' },
  education: { vi: 'Hỗ trợ Giáo dục', en: 'Education', icon: '📚' },
  web_accessibility: { vi: 'Tiếp cận Web', en: 'Web Accessibility', icon: '🌐' },
  general: { vi: 'Tổng quát', en: 'General', icon: '📋' },
};

/**
 * ISO 9999:2022 codes — Ánh xạ category → mã phân loại ISO
 */
export const ISO_9999_CODES: Record<string, { code: string; description: string }[]> = {
  vision: [
    { code: '22.03.06', description: 'Thiết bị phóng to hình ảnh' },
    { code: '22.06.12', description: 'Phần mềm đọc màn hình' },
    { code: '22.06.15', description: 'Màn hình Braille' },
    { code: '22.06.18', description: 'Thiết bị nhận diện khuôn mặt/vật thể' },
    { code: '22.06.21', description: 'Máy in Braille' },
    { code: '22.30.15', description: 'Phần mềm phóng to' },
    { code: '22.36.12', description: 'Sách nói / DAISY' },
  ],
  hearing: [
    { code: '22.06.06', description: 'Máy trợ thính' },
    { code: '22.06.09', description: 'Thiết bị FM/Loop' },
    { code: '22.06.12', description: 'Thiết bị RTT (Real-Time Text)' },
    { code: '22.09.06', description: 'Hệ thống báo động bằng ánh sáng' },
    { code: '22.18.03', description: 'Phụ đề / Closed Captions' },
    { code: '22.18.06', description: 'Ngôn ngữ ký hiệu / VRS' },
  ],
  mobility: [
    { code: '12.21.06', description: 'Xe lăn tay' },
    { code: '12.21.09', description: 'Xe lăn điện' },
    { code: '12.21.15', description: 'Xe lăn leo cầu thang' },
    { code: '12.03.03', description: 'Nạng' },
    { code: '12.03.06', description: 'Khung đi (Walker)' },
    { code: '12.06.12', description: 'Thiết bị giả chi (Prosthetics)' },
    { code: '12.31.03', description: 'Bàn phím / chuột thích ứng' },
  ],
  cognition: [
    { code: '05.06.15', description: 'Thiết bị nhắc nhở (Reminders)' },
    { code: '05.09.03', description: 'Phần mềm huấn luyện nhận thức' },
    { code: '05.15.12', description: 'Bảng giao tiếp không điện tử' },
    { code: '05.18.06', description: 'Sách/hình ảnh thích ứng' },
  ],
  communication: [
    { code: '05.15.06', description: 'Thiết bị phát âm (SGD)' },
    { code: '05.15.12', description: 'Bảng giao tiếp hình ảnh (PECS)' },
    { code: '22.21.09', description: 'Bàn phím giao tiếp' },
    { code: '22.21.12', description: 'Phần mềm AAC (Proloquo2Go...)' },
  ],
  daily_living: [
    { code: '15.03.06', description: 'Dụng cụ ăn uống thích ứng' },
    { code: '15.09.03', description: 'Dụng cụ mặc quần áo' },
    { code: '09.12.03', description: 'Ghế tắm / tay vịn' },
    { code: '18.12.15', description: 'Bàn chải / vòi sen cầm tay' },
    { code: '12.31.12', description: 'Thiết bị hỗ trợ nhà bếp' },
  ],
  education: [
    { code: '05.18.06', description: 'Sách thích ứng / sách nói' },
    { code: '05.18.09', description: 'Phần mềm giáo dục' },
    { code: '05.21.03', description: 'Bảng chữ cái / dấu' },
  ],
  web_accessibility: [
    { code: '22.30.18', description: 'Trình đọc màn hình web' },
    { code: '22.30.21', description: 'Tiêu chuẩn WCAG' },
  ],
  general: [
    { code: '22.99.99', description: 'Khác' },
  ],
};

/**
 * WCAG 2.2 — Ánh xạ category → principles & success criteria chính
 */
export const WCAG_MAPPING: Record<string, { level: 'A' | 'AA' | 'AAA'; principles: string[]; criteria: string[] }> = {
  vision: {
    level: 'AA',
    principles: ['Perceivable'],
    criteria: ['1.1.1 Non-text Content', '1.4.3 Contrast Minimum', '1.4.4 Resize Text', '1.4.10 Reflow', '1.4.11 Non-text Contrast'],
  },
  hearing: {
    level: 'AA',
    principles: ['Perceivable'],
    criteria: ['1.2.2 Captions (Prerecorded)', '1.2.4 Captions (Live)', '1.2.5 Audio Description'],
  },
  mobility: {
    level: 'AA',
    principles: ['Operable'],
    criteria: ['2.1.1 Keyboard', '2.4.3 Focus Order', '2.5.1 Pointer Gestures', '2.5.2 Pointer Cancellation'],
  },
  cognition: {
    level: 'AA',
    principles: ['Understandable'],
    criteria: ['3.1.1 Language of Page', '3.1.2 Language of Parts', '3.1.3 Unusual Words', '3.1.4 Abbreviations', '3.1.5 Reading Level'],
  },
  communication: {
    level: 'AA',
    principles: ['Robust', 'Understandable'],
    criteria: ['4.1.2 Name, Role, Value', '3.1.1 Language of Page'],
  },
  web_accessibility: {
    level: 'AA',
    principles: ['Perceivable', 'Operable', 'Understandable', 'Robust'],
    criteria: ['All WCAG 2.2 Level AA criteria'],
  },
  general: {
    level: 'AA',
    principles: ['POUR'],
    criteria: ['Cross-cutting'],
  },
  daily_living: {
    level: 'AA',
    principles: ['Perceivable', 'Operable'],
    criteria: ['N/A — Physical product, not web'],
  },
  education: {
    level: 'AA',
    principles: ['Perceivable', 'Understandable'],
    criteria: ['1.3.1 Info and Relationships', '3.1.1 Language of Page'],
  },
};

/**
 * WHO GATE — Priority Assistive Products List (APL)
 */
export const WHO_GATE_CATEGORIES: Record<string, { apl: boolean; area: string }> = {
  vision: { apl: true, area: 'Vision products' },
  hearing: { apl: true, area: 'Hearing products' },
  mobility: { apl: true, area: 'Mobility products' },
  cognition: { apl: true, area: 'Cognition products' },
  communication: { apl: true, area: 'Communication products' },
  daily_living: { apl: true, area: 'Self-care products' },
  education: { apl: false, area: 'Education' },
  web_accessibility: { apl: false, area: 'Web/Digital' },
  general: { apl: false, area: 'General' },
};

/**
 * Keyword sets cho auto-classification
 * Mỗi category có danh sách keywords (tiếng Việt + English) với trọng số
 */
const KEYWORD_RULES: Record<ATCategory, { keywords: string[]; weight: number }[]> = {
  vision: [
    { keywords: ['khiếm thị', 'mù lòa', 'blind', 'low vision', 'thị lực', 'mắt'], weight: 5 },
    { keywords: ['braille', 'screen reader', 'đọc màn hình', 'jaws', 'nvda', 'voiceover'], weight: 5 },
    { keywords: ['kính lúp', 'magnifier', 'phóng to', 'zoomtext', 'cảm biến', 'orcam', 'envision'], weight: 4 },
    { keywords: ['màn hình braille', 'braille display', 'focus blue', 'brailliant'], weight: 5 },
    { keywords: ['chữ nổi', 'tactile', 'sách nói', 'audiobook', 'daisy'], weight: 3 },
  ],
  hearing: [
    { keywords: ['khiếm thính', 'điếc', 'deaf', 'hearing loss', 'thính giác', 'tai'], weight: 5 },
    { keywords: ['máy trợ thính', 'hearing aid', 'bte', 'ite', 'cic', 'cochlear', 'ốc tai điện tử'], weight: 5 },
    { keywords: ['fm system', 'phụ đề', 'caption', 'subtitles', 'rtt', 'real-time text', 'vrs'], weight: 4 },
    { keywords: ['ngôn ngữ ký hiệu', 'sign language', 'thông dịch', 't-coil', 'loop'], weight: 4 },
    { keywords: ['báo động', 'alerting', 'đèn nháy', 'rung'], weight: 3 },
  ],
  mobility: [
    { keywords: ['xe lăn', 'wheelchair', 'ngồi xe', 'đi lại'], weight: 5 },
    { keywords: ['nạng', 'crutch', 'gậy', 'cane', 'khung đi', 'walker', 'rollator'], weight: 5 },
    { keywords: ['leo cầu thang', 'stair climbing', 'scalamobil', 'ibot'], weight: 5 },
    { keywords: ['chân giả', 'tay giả', 'prosthetic', 'prosthesis', 'myoelectric'], weight: 5 },
    { keywords: ['bàn phím thích ứng', 'adaptive keyboard', 'chuột thích ứng', 'head mouse', 'eye-tracking'], weight: 4 },
    { keywords: ['vận động', 'mobility', 'đứng', 'standing'], weight: 2 },
  ],
  cognition: [
    { keywords: ['nhận thức', 'cognition', 'trí nhớ', 'memory', 'alzheimer', 'sa sút trí tuệ'], weight: 5 },
    { keywords: ['tự kỷ', 'autism', 'asd', 'tăng động', 'adhd'], weight: 5 },
    { keywords: ['nhắc nhở', 'reminder', 'neuropage', 'mediminder', 'lịch'], weight: 4 },
    { keywords: ['học tập', 'learning', 'dyslexia', 'chứng khó đọc'], weight: 3 },
  ],
  communication: [
    { keywords: ['aac', 'giao tiếp thay thế', 'augmentative', 'alternative communication'], weight: 5 },
    { keywords: ['sgd', 'speech generating', 'proloquo', 'touchchat', 'aacorn', 'avaz', 'tobii dynavox', 'prentke'], weight: 5 },
    { keywords: ['pecs', 'picture exchange', 'bảng giao tiếp', 'communication board'], weight: 5 },
    { keywords: ['phát âm', 'nói', 'speech', 'lightwriter'], weight: 3 },
  ],
  daily_living: [
    { keywords: ['sinh hoạt', 'daily living', 'ăn uống', 'vệ sinh', 'tắm', 'mặc quần áo'], weight: 4 },
    { keywords: ['ghế tắm', 'shower chair', 'tay vịn', 'grab bar', 'vòi sen'], weight: 5 },
    { keywords: ['nĩa', 'dĩa', 'thìa', 'cốc', 'cốc uống', 'kẹp thức ăn'], weight: 4 },
    { keywords: ['móc áo', 'dressing stick', 'nút áo', 'velcro'], weight: 4 },
    { keywords: ['giường', 'gối', 'chống loét', 'bed rail'], weight: 3 },
  ],
  education: [
    { keywords: ['giáo dục', 'education', 'học sinh', 'lớp học', 'trường học'], weight: 4 },
    { keywords: ['abcmouse', 'starfall', 'reading bear', 'marlee signs'], weight: 5 },
    { keywords: ['sách nói trẻ em', 'bookshare', 'learning ally'], weight: 4 },
    { keywords: ['đồ chơi', 'toy', 'toca boca'], weight: 2 },
  ],
  web_accessibility: [
    { keywords: ['wcag', 'accessibility', 'tiếp cận web', 'web a11y'], weight: 5 },
    { keywords: ['aria', 'screen reader', 'keyboard navigation'], weight: 4 },
    { keywords: ['contrast', 'tương phản', 'alt text', 'semantic html'], weight: 3 },
  ],
  general: [],
};

/**
 * Auto-classify nội dung thành AT category dựa trên keyword matching
 */
export function classifyContent(text: string): {
  category: ATCategory;
  confidence: number;
  scores: Record<ATCategory, number>;
  matchedKeywords: string[];
  isoCodes: { code: string; description: string }[];
  wcag: { level: 'A' | 'AA' | 'AAA'; principles: string[]; criteria: string[] };
  whoGATE: { apl: boolean; area: string };
} {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {
    vision: 0, hearing: 0, mobility: 0, cognition: 0,
    communication: 0, daily_living: 0, education: 0,
    web_accessibility: 0, general: 0,
  };
  const matched: string[] = [];

  for (const [category, rules] of Object.entries(KEYWORD_RULES)) {
    for (const rule of rules) {
      for (const kw of rule.keywords) {
        if (textLower.includes(kw)) {
          scores[category] += rule.weight;
          matched.push(`${category}:${kw}`);
        }
      }
    }
  }

  // Tìm category có score cao nhất
  let bestCategory: ATCategory = 'general';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat as ATCategory;
    }
  }

  // Confidence = score cao nhất / tổng score có liên quan
  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
  const confidence = totalScore > 0 ? Math.min(0.99, bestScore / Math.max(totalScore, bestScore * 1.2)) : 0.3;

  return {
    category: bestCategory,
    confidence: Number(confidence.toFixed(2)),
    scores: scores as Record<ATCategory, number>,
    matchedKeywords: matched,
    isoCodes: ISO_9999_CODES[bestCategory] || ISO_9999_CODES.general,
    wcag: WCAG_MAPPING[bestCategory] || WCAG_MAPPING.general,
    whoGATE: WHO_GATE_CATEGORIES[bestCategory] || WHO_GATE_CATEGORIES.general,
  };
}
