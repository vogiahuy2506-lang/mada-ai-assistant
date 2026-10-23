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
 * Cách dùng:
 *   const bots = botsForProduct(productUrl, title);  // → ['bot-speech', …]
 *   if (bots.includes(myBotId)) → sản phẩm này thuộc chuyên môn của bot tôi
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
 * sản phẩm nào độc quyền (0/123) vì danh mục "Mobility & Transportation" của
 * MADA gần như chỉ gồm assistive switch / eye-gaze / environment control — vốn
 * đã được khai ở nhóm cơ xương khớp.
 *
 * Nếu cứ sắp xếp theo thứ tự DB, bot-mobility sẽ dẫn đầu bằng eSight 4, Tobii
 * PCEye 5 (thị giác) và Quha Dwell (cơ xương khớp) → tư vấn lệch chuyên môn.
 * Ưu tiên sản phẩm độc quyền giúp bot khác không tranh nhãn; khi bot không có
 * sản phẩm riêng thì dùng sản phẩm chung theo mức độ liên quan.
 */
export function isExclusiveToBot(
  url: string | null | undefined,
  botId: string | null | undefined
): boolean {
  if (!botId) return false;
  const bots = botsForProduct(url);
  return bots.length === 1 && bots[0] === botId;
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