/**
 * ⭐ NGUỒN PHÂN LOẠI SẢN PHẨM DUY NHẤT — đọc từ file MADA crawl.
 *
 * ⚠️ VÌ SAO CẦN FILE NÀY:
 *
 * `kb_products.category` chỉ lưu MỘT category, nhưng MADA khai báo sản phẩm thuộc
 * NHIỀU nhóm. Ví dụ thực tế từ file:
 *   - `proloquo2go`      → [cognition, voice-and-speech]
 *   - `esight-4`         → [vision, daily_living]
 *   - `tobii-pceye-5`    → [mobility, daily_living]
 *   - `boardmaker`       → [mobility, cognition, voice-and-speech]
 *
 * Nếu chỉ tin `kb_products.category`, sản phẩm bị gán nhầm về một bot duy nhất
 * → ví dụ `proloquo2go` bị đưa cho bot-cognitive, bot-speech không thấy, và
 * bot-cognitive lại gợi ý sản phẩm giao tiếp (đúng chuyên môn Bot 3).
 *
 * File `data/mada-product-categories.json` được sinh bởi
 * `scripts/crawl-product-categories.ts` bằng cách đọc danh mục MADA hiển thị trên
 * từng trang chuyên môn. Đã đối chiếu: 349/349 sản phẩm trong `kb_products`
 * đều có URL khớp 100% với file này.
 *
 * ⭐ HAI KHÁI NIỆM (rất quan trọng — đừng gộp làm một):
 *
 * 1. `botsForProduct(url)` → bot nào ĐƯỢC PHÉP nhắc sản phẩm này (đa nhãn).
 *    MADA khai 1 sản phẩm thuộc N danh mục → N bot đều có quyền nhắc.
 *    Ví dụ `tobii-pceye-5` → bot-neuro + bot-mobility.
 *
 * 2. `primaryOwnerForProduct(url)` → bot CHỦ SỞ HỮU CHÍNH (đơn nhãn).
 *    Dùng để XẾP HẠNG: mỗi bot phải dẫn đầu bằng sản phẩm CỦA RIÊNG nó.
 *    Không có khái niệm này thì bot-mobility dẫn đầu bằng eSight 4 (thị giác),
 *    Tobii PCEye 5 / Quha Dwell (nhập liệu thay thế) → tư vấn lệch chuyên môn.
 *
 * Bảng chủ sở hữu được sinh bởi `scripts/generate-product-owners.ts` và COMMIT
 * vào `data/mada-product-owners.json` → runtime KHÔNG phụ thuộc file crawl cache
 * (file cache bị git-ignore) nên deploy lên VPS vẫn đúng.
 *
 * Cách dùng:
 *   const bots = botsForProduct(productUrl);            // → ['bot-speech', …]
 *   if (bots.includes(myBotId)) → sản phẩm này thuộc chuyên môn của bot tôi
 *   const owner = primaryOwnerForProduct(productUrl);   // → 'bot-speech'
 *   if (owner === myBotId) → ưu tiên đưa lên đầu danh sách
 */

import fs from 'fs';
import path from 'path';

/** kb_products.category → botId */
const CATEGORY_TO_BOT: Record<string, string> = {
  hearing: 'bot-hearing',
  vision: 'bot-vision',
  'voice-and-speech': 'bot-speech',
  cognition: 'bot-cognitive',
  mobility: 'bot-neuro',
  daily_living: 'bot-mobility',
  education: 'bot-regulatory',
  web_accessibility: 'bot-regulatory',
  communication: 'bot-speech',
};

type Taxonomy = Record<string, string[]>;

let cache: Taxonomy | null = null;
let cachePath = '';

/** Nạp (và cache) file taxonomy. Trả về null nếu file không tồn tại. */
function load(): Taxonomy | null {
  const p = path.join(process.cwd(), 'data', 'mada-product-categories.json');
  if (cache && cachePath === p) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    cache = parsed;
    cachePath = p;
    return parsed;
  } catch {
    return null;
  }
}

/** Chuẩn hoá URL về dạng so khớp: bỏ query/hash và dấu `/` cuối. */
function norm(url: string | null | undefined): string {
  return (url || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Index tra cứu: URL đã chuẩn hoá → categories.
 * ⚠️ Bắt buộc chuẩn hoá CẢ key trong file. Key gốc giữ dấu `/` cuối
 * (vd ".../proloquo2go/") còn URL truyền vào có thể không có → tra cứu trượt,
 * `botsForProduct()` trả về [] và mọi lọc theo bot trở nên vô hiệu.
 */
let lookup: Map<string, string[]> | null = null;

function getLookup(): Map<string, string[]> {
  if (lookup) return lookup;
  lookup = new Map();
  const tax = load();
  if (tax) {
    for (const [url, cats] of Object.entries(tax)) {
      lookup.set(norm(url), cats);
    }
  }
  return lookup;
}

// ══════════════════════════════════════════════════════════════════════════
// ⭐ CHỦ SỞ HỮU CHÍNH
// ══════════════════════════════════════════════════════════════════════════

let ownerCache: Map<string, string> | null = null;
/** norm(url) → URL GỐC (giữ dấu `/` cuối) để query DB bằng tham số. */
let ownerUrlCache: Map<string, string> | null = null;

function getOwnerLookup(): Map<string, string> {
  if (ownerCache) return ownerCache;
  ownerCache = new Map();
  ownerUrlCache = new Map();
  try {
    const p = path.join(process.cwd(), 'data', 'mada-product-owners.json');
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string>;
    for (const [url, botId] of Object.entries(parsed)) {
      ownerCache.set(norm(url), botId);
      ownerUrlCache.set(norm(url), url);
    }
  } catch {
    // File thiếu → dùng fallback (chủ sở hữu = bot duy nhất trong taxonomy).
  }
  return ownerCache;
}

/**
 * ⭐ Danh sách URL gốc của các sản phẩm mà bot này là CHỦ SỞ HỮU CHÍNH.
 *
 * ⚠️ VÌ SAO CẦN:
 * `kb_products.category` chỉ lưu MỘT category. Category `mobility` chứa 109
 * sản phẩm, phần lớn thuộc Bot 5 (cơ xương khớp). Trong khi đó 4 sản phẩm
 * RIÊNG của Bot 6 (GEWA Control Prog, Primo+ Environment Control, Housemate,
 * Power Link 4) cũng nằm trong chính category `mobility` đó.
 *
 * → Query `WHERE category IN ('daily_living','mobility') ORDER BY featured,
 *   created_at LIMIT 12` bị cắt mất 4 sản phẩm RIÊNG của Bot 6 (vì chúng
 *   có `created_at` cũ hơn, không được `featured`) → Bot 6 chỉ còn 1 sản
 *   phẩm riêng (WeWALK Smart Cane) dù DB có đủ 6.
 *
 * → Hàm này trả về URL của sản phẩm RIÊNG của bot để dùng làm điều kiện
 *   `ORDER BY CASE WHEN ... THEN 0 ELSE 1 END` → sản phẩm riêng LUÔN nằm
 *   trong LIMIT, không bị cắt.
 */
export function ownedProductUrlsForBot(
  botId: string | null | undefined
): string[] {
  if (!botId) return [];
  getOwnerLookup();
  if (!ownerUrlCache) return [];
  const urls: string[] = [];
  for (const [key, owner] of ownerCache!.entries()) {
    if (owner !== botId) continue;
    const original = ownerUrlCache.get(key);
    if (original) urls.push(original);
  }
  return urls;
}

/**
 * ⭐ Bot CHỦ SỞ HỮU CHÍNH của sản phẩm này.
 *
 * Trả về `null` nếu sản phẩm không có trong bảng (chưa sinh) — khi đó lớp gọi
 * nên tự suy ra bằng `botsForProduct()`.
 */
export function primaryOwnerForProduct(
  url: string | null | undefined
): string | null {
  const key = norm(url);
  if (!key) return null;
  return getOwnerLookup().get(key) ?? null;
}

/**
 * ⭐ Bot này có phải CHỦ SỞ HỮU CHÍNH của sản phẩm không?
 *
 * Dùng để XẾP HẠNG danh sách sản phẩm: sản phẩm của riêng bot luôn được
 * ưu tiên đứng đầu, trước các sản phẩm đa nhãn dùng chung.
 */
export function isPrimaryOwner(
  url: string | null | undefined,
  botId: string | null | undefined
): boolean {
  if (!botId) return false;
  const owner = primaryOwnerForProduct(url);
  if (owner) return owner === botId;
  // Chưa có bảng chủ sở hữu → suy ra: nếu sản phẩm chỉ thuộc 1 bot thì bot
  // đó là chủ. Nếu đa nhãn thì không bot nào là chủ (fail-safe).
  const bots = botsForProduct(url);
  return bots.length === 1 && bots[0] === botId;
}

/**
 * Trả về danh sách botId mà sản phẩm này thực sự thuộc về, theo khai báo của MADA.
 *
 * @param url  product_url hoặc source_url của sản phẩm
 * @returns danh sách botId (có thể rỗng nếu không tìm thấy trong taxonomy)
 */
export function botsForProduct(url: string | null | undefined): string[] {
  const key = norm(url);
  if (!key) return [];

  const cats = getLookup().get(key);
  if (!cats) return [];

  const bots: string[] = [];
  for (const c of cats) {
    const b = CATEGORY_TO_BOT[c];
    if (b && !bots.includes(b)) bots.push(b);
  }

  // ⭐⭐ BẢNG CHỦ SỞ HỮU CŨNG LÀ TÍCH HỢP (membership).
  //
  // VÌ SAO CẦN:
  // 4 sản phẩm RIÊNG của Bot 6 nằm trong archive `mobility` của MADA —
  // mà archive `mobility` chính là "Neuromusculoskeletal Movement" (Bot 5):
  //
  //   GEWA Control Prog        → taxonomy: ["mobility"]  → chỉ map ra bot-neuro
  //   Primo+ Environment C.   → taxonomy: ["mobility"]  → chỉ map ra bot-neuro
  //   Housemate                → taxonomy: ["mobility"]  → chỉ map ra bot-neuro
  //   Power Link 4             → taxonomy: ["mobility"]  → chỉ map ra bot-neuro
  //
  // → `botsForProduct()` trả về ['bot-neuro'] cho cả 4 → `productBelongsToBot(
  //   url, 'bot-mobility')` = FALSE → bot-mobility KHÔNG BAO GIỜ thấy sản phẩm
  //   của chính nó, dù bảng chủ sở hữu đã gán bot-mobility làm chủ.
  //
  // → Sửa: chủ sở hữu CHÍNH luôn là 1 bot hợp lệ được nhắc sản phẩm này.
  const owner = primaryOwnerForProduct(url);
  if (owner && !bots.includes(owner)) bots.push(owner);

  return bots;
}

/**
 * Sản phẩm này có thuộc chuyên môn của `botId` không.
 *
 * ⚠️ Nếu sản phẩm không có trong taxonomy → coi như KHÔNG thuộc bot nào
 * (fail-closed) để tránh việc lọc quá rộng. Trường hợp này hiếm vì đã đối chiếu
 * 349/349 sản phẩm đều có trong file.
 */
export function productBelongsToBot(
  url: string | null | undefined,
  botId: string | null | undefined
): boolean {
  if (!botId) return false;
  const bots = botsForProduct(url);
  if (bots.length === 0) return false;
  return bots.includes(botId);
}

/**
 * Bot này có sản phẩm ĐỘC QUYỀN (không bị bot khác chia sẻ) không.
 *
 * ⚠️ VÌ SAO CẦN:
 * Trên MADA, phần lớn sản phẩm là ĐA NHIÃN. Đặc biệt `bot-mobility` không có
 * sản phẩm nào độc quyền (0/59) theo membership thuần vì danh mục "Mobility &
 * Transportation" của MADA gần như chỉ gồm assistive switch / eye-gaze /
 * environment control — vốn đã được khai ở nhóm cơ xương khớp.
 *
 * → Hàm này dùng BẢNG CHỦ SỞ HỮU (`data/mada-product-owners.json`): sản phẩm
 * mà bot này là chủ sở hữu CHÍNH được coi là "độc quyền" và được ưu tiên.
 * Nhờ vậy bot-mobility dẫn đầu bằng gậy thông minh / bộ điều khiển môi
 * trường thay vì eSight 4 (thị giác) hay Quha Dwell (nhập liệu thay thế).
 */
export function isExclusiveToBot(
  url: string | null | undefined,
  botId: string | null | undefined
): boolean {
  if (!botId) return false;
  return isPrimaryOwner(url, botId);
}

/**
 * Sản phẩm này có thuộc chuyên môn của bot nào trong danh sách không.
 * Dùng khi chỉ biết category (không có URL) → fallback về map category.
 */
export function productBelongsToAnyBot(
  url: string | null | undefined,
  category: string | null | undefined,
  botIds: string[]
): boolean {
  const bots = botsForProduct(url);
  if (bots.length > 0) return botIds.some((b) => bots.includes(b));
  const bot = CATEGORY_TO_BOT[(category || '').toLowerCase()];
  return bot ? botIds.includes(bot) : false;
}

/** Số lượng sản phẩm theo bot (dùng cho báo cáo/verify). */
export function taxonomyCountsByBot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cats of getLookup().values()) {
    for (const c of cats) {
      const b = CATEGORY_TO_BOT[c];
      if (!b) continue;
      out[b] = (out[b] || 0) + 1;
    }
  }
  return out;
}

/** ⭐ Số lượng sản phẩm mà bot là CHỦ SỞ HỮU CHÍNH (dùng cho báo cáo/verify). */
export function primaryOwnerCountsByBot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const botId of getOwnerLookup().values()) {
    out[botId] = (out[botId] || 0) + 1;
  }
  return out;
}
