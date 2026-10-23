/**
 * Ánh xạ category ↔ botId ↔ madaCategory — nguồn duy nhất (single source of truth).
 *
 * ⚠️ VÌ SAO CẦN:
 * Vector store lọc theo `metadata.botId` + `metadata.madaCategory`
 * (xem `ragEngine.retrieveDocuments`). Nếu docs không có 2 field này thì
 * filter khớp 0 docs → RAG không có context → bot trả lời
 * "không có thông tin chi tiết trong cơ sở dữ liệu".
 *
 * Trước đây mapping bị rải rác ở `chat.ts` (MADA_CATEGORY_TO_DB,
 * AGENT_TO_MADA) và `scripts/update-knowledge-items-botid.ts`, dẫn tới
 * lệch nhau. File này gom lại để dùng chung.
 */

/** kb_products.category (DB) → { madaCategory (MADA site), botId } */
export const DB_CATEGORY_TO_MADA: Record<string, { madaCategory: string; botId: string }> = {
  hearing: { madaCategory: 'sensory-hearing', botId: 'bot-hearing' },
  vision: { madaCategory: 'sensory-vision', botId: 'bot-vision' },
  'voice-and-speech': { madaCategory: 'voice-and-speech', botId: 'bot-speech' },
  // `communication` KHÔNG có dòng nào trong `kb_products` (đếm = 0) nhưng ĐÚNG là
  // category đang dùng trong `knowledge_items` (vd `kb-aac-grid` — "AAC — Bảng giao
  // tiếp và ứng dụng"). Nếu bỏ hẳn alias này thì KB item đó mất botId → rơi khỏi
  // vector filter và bot-speech không nhìn thấy. Giữ lại alias cho knowledge_items.
  communication: { madaCategory: 'voice-and-speech', botId: 'bot-speech' },
  cognition: { madaCategory: 'mental-cognitive', botId: 'bot-cognitive' },
  mobility: { madaCategory: 'neuromusculoskeletal-movement', botId: 'bot-neuro' },
  daily_living: { madaCategory: 'mobility-and-transportation', botId: 'bot-mobility' },
  education: { madaCategory: 'regulatory-standards', botId: 'bot-regulatory' },
  web_accessibility: { madaCategory: 'regulatory-standards', botId: 'bot-regulatory' },
};

/**
 * ⚠️ THỰC TẾ VỀ NGUỒN DỮ LIỆU MADA:
 *
 * Bot 6 (Mobility & Transportation) trên lý thuyết phải có xe lăn / xe lăn điện /
 * khung đi / nạng. Nhưng đã kiểm tra trực tiếp trang
 * `at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/`
 * (12 trang phân trang, 59 URL) → danh mục này của MADA **không bán xe lăn**;
 * sản phẩm duy nhất đúng nghĩa "di chuyển" là `WeWALK Smart Cane`.
 *
 * Đây là giới hạn của nguồn, KHÔNG phải bug. Vì vậy:
 *   - `daily_living` (59 SP) → Bot 6: gậy thông minh + environment control
 *     + assistive switch dùng để điều khiển thiết bị trong nhà.
 *   - `mobility` (109 SP) → Bot 5: toàn bộ switch / keyboard / mouse / joystick /
 *     eye-gaze — đúng là thiết bị cơ xương khớp cho người liệt.
 *
 * `classifyMobilityProduct` dùng để tách category `mobility` khi một sản phẩm
 * bị gán nhầm, nhưng theo dữ liệu hiện tại mọi sản phẩm `mobility` đều là
 * thiết bị nhập liệu thay thế → về Bot 5.
 */
export const MOBILITY_BOT_CATEGORIES = ['daily_living', 'mobility'] as const;

/** madaCategory (MADA site) → kb_products.category (DB) */
export const MADA_CATEGORY_TO_DB: Record<string, string> = {
  'sensory-hearing': 'hearing',
  'sensory-vision': 'vision',
  'voice-and-speech': 'voice-and-speech',
  'mental-cognitive': 'cognition',
  'neuromusculoskeletal-movement': 'mobility',
  // ⭐ Bot 6 "Mobility & Transportation" = `daily_living` (theo kb_categories).
  // Trước đây map sai sang `mobility` (đó là Bot 5 Neuromusculoskeletal).
  'mobility-and-transportation': 'daily_living',
  'regulatory-standards': 'education',
  // cũng hỗ trợ tên category mới dùng trực tiếp
  hearing: 'hearing',
  vision: 'vision',
  cognition: 'cognition',
  mobility: 'mobility',
  daily_living: 'daily_living',
  communication: 'communication',
  web_accessibility: 'web_accessibility',
  education: 'education',
  general: 'general',
};

/** agentId (bot-hearing…) → { botId, madaCategory } */
export const AGENT_TO_MADA: Record<string, { botId: string; madaCategory: string }> = {
  'bot-hearing': { botId: 'bot-hearing', madaCategory: 'sensory-hearing' },
  'bot-vision': { botId: 'bot-vision', madaCategory: 'sensory-vision' },
  'bot-speech': { botId: 'bot-speech', madaCategory: 'voice-and-speech' },
  'bot-cognitive': { botId: 'bot-cognitive', madaCategory: 'mental-cognitive' },
  'bot-neuro': { botId: 'bot-neuro', madaCategory: 'neuromusculoskeletal-movement' },
  'bot-mobility': { botId: 'bot-mobility', madaCategory: 'mobility-and-transportation' },
  'bot-regulatory': { botId: 'bot-regulatory', madaCategory: 'regulatory-standards' },
};

/**
 * Phân loại sản phẩm `mobility` cho đúng bot nào.
 *
 * ⚠️ VÌ SAO CẦN MỘT BẢNG PHÂN LOẠI:
 * Category `mobility` trong kb_products trộn HAI nhóm khác nhau về mặt chuyên môn:
 *   - Thiết bị di chuyển (xe lăn, xe lăn điện, gậy, khung đi, nạng, xe điện…)
 *     → thuộc Bot 6 "Mobility & Transportation"
 *   - Thiết bị cơ xương khớp (nẹp, chuột thay thế, bàn phím thay thế, joystick…)
 *     → thuộc Bot 5 "Neuromusculoskeletal Movement"
 *
 * Nếu cả 2 bot cùng kéo category `mobility` thì mỗi bot nhận trùng ~109 sản
 * phẩm, phần lớn không liên quan tới chuyên môn của nó → bot tư vấn sai.
 * Bảng dưới tách theo từ khoá trong tên sản phẩm.
 */
export type MobilityKind = 'transport' | 'orthopedic';

/**
 * Từ khoá nhận diện thiết bị DI CHUYỂN thật.
 *
 * ⚠️ Không được thêm từ khoá chung chung như "mobility", "transfer", "tilt",
 * "vehicle", "car" — chúng khớp cả assistive switch / eye-gaze (thuộc Bot 5)
 * và gây sai phân bổ. Chỉ giữ từ khoá đặc thù: xe lăn, xe điện, gậy, nạng,
 * khung đi, leo cầu thang.
 */
const TRANSPORT_KEYWORDS = [
  'wheelchair', 'wheel chair', 'mobility scooter', 'rollator',
  'walking frame', 'rollator walker', 'crutch', 'walking cane', 'smart cane',
  'walking stick', 'stair climber', 'stairlift', 'stair lift',
  'mobility vehicle', 'mobility scooter', 'gokart', 'go-kart', 'tricycle',
];

/** Từ khoá nhận diện thiết bị CƠ XƯƠNG KHỚP / NHẬP LIỆU THAY THẾ (Bot 5). */
const ORTHOPEDIC_KEYWORDS = [
  'orthosis', 'orthotic', 'orthosis', 'brace', 'splint', 'prosthesis', 'prosthetic',
  'keyboard', 'mouse', 'joystick', 'switch', 'headrest', 'arm support',
  'wrist', 'elbow', 'shoulder', 'ankle', 'foot rest', 'leg rest',
  'posture', 'seating', 'in-cuff', 'hand orthosis', 'eye gaze', 'eyegaze',
  'head tracker', 'dwell', 'scanning', 'sip and puff', 'touch screen',
];

/**
 * Quyết định nhóm của một sản phẩm `mobility`.
 * Trả 'transport' nếu tên sản phẩm nghiêng về di chuyển, ngược lại 'orthopedic'.
 */
export function classifyMobilityProduct(title: string | null | undefined): MobilityKind {
  const t = (title || '').toLowerCase();

  // Ưu tiên nhóm di chuyển nếu có từ khoá RÕ RÀNG (vd "Electric Wheelchair").
  for (const k of TRANSPORT_KEYWORDS) {
    if (t.includes(k)) return 'transport';
  }
  for (const k of ORTHOPEDIC_KEYWORDS) {
    if (t.includes(k)) return 'orthopedic';
  }
  // Mặc định: `mobility` trên MADA nặng vì thiết bị nhập liệu/switch/eye-gaze
  // hơn xe lăn (MADA không bán xe lăn) → chọn orthopedic (Bot 5).
  return 'orthopedic';
}

/**
 * Bot nào sở hữu sản phẩm này.
 * @param dbCategory kb_products.category
 * @param productTitle tên sản phẩm (dùng để tách nhóm khi category = 'mobility')
 */
export function resolveProductOwner(
  dbCategory: string,
  productTitle?: string | null
): { botId: string; madaCategory: string } | null {
  const cat = (dbCategory || '').toLowerCase();
  if (!cat) return null;

  if (cat === 'mobility') {
    const kind = classifyMobilityProduct(productTitle);
    return kind === 'transport'
      ? { botId: 'bot-mobility', madaCategory: 'mobility-and-transportation' }
      : { botId: 'bot-neuro', madaCategory: 'neuromusculoskeletal-movement' };
  }

  return DB_CATEGORY_TO_MADA[cat] || null;
}

/**
 * Danh sách category trong kb_products mà một bot cần quét khi gợi ý sản phẩm.
 *
 * Vì sao cần hàm này: mỗi bot có thể nhận N category (không phải đúng 1).
 * Rõ ràng nhất là Bot 5 (cơ xương khớp) + Bot 6 (di chuyển) cùng quét `mobility`,
 * sau đó `resolveProductOwner()` tách theo tên sản phẩm để mỗi bot chỉ nhận
 * đúng phần của mình.
 */
export function productCategoriesForBot(
  botId: string | null | undefined,
  madaCategory?: string | null
): string[] {
  const id = botId || (madaCategory ? AGENT_TO_MADA_LOOKUP[madaCategory] : undefined);
  if (!id) return [];

  // ⭐ Danh sách category bot cần QUÉT (không phải danh sách được sở hữu).
  // Vì MADA khai sản phẩm đa nhãn, `proloquo2go` nằm ở category `cognition`
  // nhưng cũng thuộc Bot 3 (voice-and-speech). Nếu chỉ quét category của bot
  // thì bot-speech không bao giờ thấy nó. Quét rộng rồi lọc bằng taxonomy.
  const BOT_SCAN_CATEGORIES: Record<string, string[]> = {
    'bot-hearing': ['hearing'],
    'bot-vision': ['vision'],
    'bot-speech': ['voice-and-speech', 'cognition', 'communication'],
    'bot-cognitive': ['cognition', 'voice-and-speech'],
    'bot-neuro': ['mobility', 'daily_living'],
    'bot-mobility': ['daily_living', 'mobility'],
    'bot-regulatory': [],
  };

  if (id && BOT_SCAN_CATEGORIES[id]) return BOT_SCAN_CATEGORIES[id];

  const primary = MADA_CATEGORY_TO_DB[madaCategory || ''] || '';
  // Ưu tiên tra theo botId để không phụ thuộc mada_category trong DB có đúng hay không
  for (const [cat, owner] of Object.entries(DB_CATEGORY_TO_MADA)) {
    if (owner.botId === id) return [cat];
  }
  return primary ? [primary] : [];
}

/** Đảo AGENT_TO_MADA: madaCategory → botId */
const AGENT_TO_MADA_LOOKUP: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_TO_MADA).map(([botId, v]) => [v.madaCategory, botId])
);

/**
 * Trả về { madaCategory, botId } cho một kb_products.category.
 * Category lạ → trả null (không gán filter, để bot tìm rộng).
 */
export function resolveMadaCategory(
  dbCategory: string | null | undefined
): { madaCategory: string; botId: string } | null {
  if (!dbCategory) return null;
  return DB_CATEGORY_TO_MADA[dbCategory.toLowerCase()] || null;
}
