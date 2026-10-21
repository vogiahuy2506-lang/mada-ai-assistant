// ===================================================================
// ============== AI ASSISTANTS — 7 BOT CỐ ĐỊNH CỦA HỆ THỐNG ==========
// ===================================================================
// Danh sách 7 trợ lý là HẰNG SỐ của hệ thống — không cho tạo/xoá, chỉ
// cấu hình. ID khớp với `admin_agents.id` + `MADA_BOTS[].id` nên mọi
// dữ liệu đã seed sẽ khớp ngay.

export interface FixedBot {
  /** Khớp `admin_agents.id` và `bot_id`. */
  id: string;
  /** Tên hiển thị trong UI. */
  name: string;
  /** Tên ngắn để hiển thị trong sidebar hẹp. */
  shortName: string;
  emoji: string;
  /** Màu accent cho avatar/header. */
  accent: string;
  /** Nhóm khuyết tật — dùng để filter câu hỏi gợi ý. */
  category: string;
  /** Mô tả domain dùng cho tooltip + placeholder. */
  domain: string;
  /** URL MADA gốc, dùng làm knowledge URL mặc định khi cần cào. */
  madaUrl: string;
}

export const FIXED_BOTS: FixedBot[] = [
  {
    id: 'bot-hearing',
    name: 'Trợ lý Thính giác',
    shortName: 'Thính giác',
    emoji: '👂',
    accent: '#f59e0b',
    category: 'hearing',
    domain: 'Máy trợ thính, cảnh báo âm thanh/ánh sáng, FM/Loop, RTT, phụ đề',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/',
  },
  {
    id: 'bot-vision',
    name: 'Trợ lý Thị giác',
    shortName: 'Thị giác',
    emoji: '👁️',
    accent: '#0ea5e9',
    category: 'vision',
    domain: 'Phần mềm đọc màn hình, kính lúp, Braille, sách nói/DAISY',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/',
  },
  {
    id: 'bot-speech',
    name: 'Trợ lý Giọng nói & Lời nói',
    shortName: 'Giọng nói',
    emoji: '💬',
    accent: '#8b5cf6',
    category: 'communication',
    domain: 'Thiết bị AAC, SGD, PECS, bàn phím giao tiếp, speech-to-text',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/',
  },
  {
    id: 'bot-cognitive',
    name: 'Trợ lý Nhận thức',
    shortName: 'Nhận thức',
    emoji: '🧠',
    accent: '#ec4899',
    category: 'cognition',
    domain: 'Nhắc nhở thuốc, hỗ trợ trí nhớ, huấn luyện nhận thức, autism apps',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/',
  },
  {
    id: 'bot-neuro',
    name: 'Trợ lý Vận động thần kinh',
    shortName: 'Vận động',
    emoji: '🦴',
    accent: '#10b981',
    category: 'mobility',
    domain: 'Chuột miệng, bàn phím thích ứng, nẹp chỉnh hình, exoskeleton',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/',
  },
  {
    id: 'bot-mobility',
    name: 'Trợ lý Di chuyển & Giao thông',
    shortName: 'Di chuyển',
    emoji: '🦽',
    accent: '#3b82f6',
    category: 'daily_living',
    domain: 'Xe lăn tay/điện/leo cầu thang, khung tập đi, gậy thông minh',
    madaUrl: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/',
  },
  {
    id: 'bot-regulatory',
    name: 'Trợ lý Quy định & Tiêu chuẩn',
    shortName: 'Tiêu chuẩn',
    emoji: '📋',
    accent: '#64748b',
    category: 'education',
    domain: 'ISO 9999, WHO GATE, WCAG, EU MDR, FDA 510(k), CE Marking',
    madaUrl: 'https://at.mada.org.qa/assistive-technology-portal/',
  },
];

export const BOT_BY_ID: Record<string, FixedBot> = Object.fromEntries(
  FIXED_BOTS.map((b) => [b.id, b]),
);

// ---------- Categories cho câu hỏi gợi ý ----------

export const SQ_CATEGORIES = [
  { value: 'vision', label: 'Thị giác' },
  { value: 'hearing', label: 'Thính giác' },
  { value: 'communication', label: 'Giao tiếp' },
  { value: 'cognition', label: 'Nhận thức' },
  { value: 'mobility', label: 'Vận động' },
  { value: 'daily_living', label: 'Sinh hoạt' },
  { value: 'education', label: 'Giáo dục / Tiêu chuẩn' },
  { value: 'general', label: 'Tổng quát' },
] as const;

export const VIEW_MODES = [
  { value: 'end_user', label: 'Người dùng' },
  { value: 'at_specialist', label: 'Chuyên gia CNHT' },
] as const;

export const LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['value'];

// ---------- Widget config options ----------

export const WIDGET_POSITIONS = [
  { value: 'bottom-right', label: 'Góc dưới phải' },
  { value: 'bottom-left', label: 'Góc dưới trái' },
  { value: 'top-right', label: 'Góc trên phải' },
  { value: 'top-left', label: 'Góc trên trái' },
] as const;

export const WIDGET_THEMES = [
  { value: 'mada-blue', label: 'MADA Blue', swatch: '#0058be' },
  { value: 'soft-green', label: 'Soft Green', swatch: '#22c55e' },
  { value: 'warm-amber', label: 'Warm Amber', swatch: '#f59e0b' },
  { value: 'neutral-gray', label: 'Neutral Gray', swatch: '#6b7280' },
  { value: 'accent-violet', label: 'Accent Violet', swatch: '#5e6ad2' },
] as const;

// ---------- Capability tools ----------

export const CAPABILITIES = [
  { id: 'chat', label: '💬 Chat cơ bản' },
  { id: 'rag', label: '📚 RAG — tra tri thức nội bộ' },
  { id: 'device_recommendation', label: '🎯 Gợi ý thiết bị' },
  { id: 'iso_lookup', label: '📖 Tra cứu ISO/WHO' },
  { id: 'web_search', label: '🌐 Tìm kiếm web' },
  { id: 'translation', label: '🌍 Dịch thuật' },
  { id: 'calculator', label: '🔢 Tính toán' },
  { id: 'file_reader', label: '📄 Đọc tệp đính kèm' },
  { id: 'image_analysis', label: '🖼️ Phân tích hình ảnh' },
  { id: 'safety_certification', label: '🛡️ Kiểm chứng an toàn' },
  { id: 'wcag_compliance', label: '♿ Kiểm tra WCAG' },
  { id: 'aac_integration', label: '🔗 Tích hợp AAC / HL7' },
] as const;

export const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gpt-4o-mini',
] as const;

/** Emoji gợi ý để admin chọn nhanh avatar. */
export const AVATAR_EMOJI = [
  '🤖', '👂', '👁️', '💬', '🧠', '🦴', '🦽', '📋',
  '🎧', '🔊', '🔤', '🗣️', '👋', '🙋', '💡', '📚',
  '🏥', '🛠️', '⚙️', '✨', '🌟', '🎓', '🔬', '🧭',
];

export const DEFAULT_MODEL = 'gemini-2.0-flash';