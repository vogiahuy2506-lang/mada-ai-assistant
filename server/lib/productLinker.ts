/**
 * Product Linker — gắn link sản phẩm MADA vào câu trả lời của bot.
 *
 * ⚠️ VÌ SAO CẦN:
 * Bot có thể nhắc đúng tên sản phẩm có trong danh mục MADA (VD: "A-200 Personal
 * Sound Amplifier") nhưng danh sách `suggestedProducts` gửi kèm lại chứa sản
 * phẩm KHÁC (do RAG không match tên). Frontend chỉ gắn link khi tên trong text
 * trùng khớp tên trong `suggestedProducts` → tên sản phẩm bị "mồ côi", không
 * có link.
 *
 * Cách xử lý ở đây:
 * 1. `buildProductCatalog()` — nạp danh mục sản phẩm thật từ DB (kb_products +
 *    knowledge_items), chuẩn hoá tên để so khớp không phân biệt hoa/thường và
 *    không phân biệt dấu tiếng Việt.
 * 2. `findMentionedProducts()` — quét câu trả lời, tìm các tên sản phẩm MADA
 *    được nhắc tới (kể cả khi chỉ nhắc 1 phần tên, VD "A-200").
 * 3. `enrichProductsWithMentions()` — bảo đảm mọi sản phẩm được nhắc tới đều
 *    có mặt trong danh sách sản phẩm gửi kèm → frontend sẽ tự gắn link vào
 *    đúng dòng đang nhắc tên.
 */

import db from './db';
import { resolveProductOwner } from './categoryMapping';
import { productBelongsToBot, isExclusiveToBot } from './productTaxonomy';

// ============== CHUẨN HOÁ TÊN ==============

/** Bỏ dấu tiếng Việt + lowercase + gộp khoảng trắng. */
export function normalizeProductName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/[\u00ae\u2122\u00a9\u00b0]/g, ' ') // bỏ ký hiệu đặc biệt
    .replace(/[\u2013\u2014]/g, '-') // gạch dài → gạch ngang
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============== CATALOG ==============

export interface CatalogProduct {
  id: string;
  title: string;
  title_en: string;
  brand: string;
  category: string;
  price_range: string;
  description: string;
  image_url: string;
  product_url: string;
  source_url: string;
}

interface CatalogEntry extends CatalogProduct {
  /** Tên đã chuẩn hoá (để so khớp) */
  norm: string;
  /** Các key phụ để match một phần (VD "A-200") */
  altNorms: string[];
}

let _catalogCache: CatalogEntry[] | null = null;
let _catalogCacheAt = 0;
const CATALOG_TTL_MS = 60_000;

/**
 * Nạp danh mục sản phẩm từ kb_products + knowledge_items (web-scraped).
 * Cache 60s để không query DB mỗi lượt chat.
 */
export function buildProductCatalog(): CatalogEntry[] {
  const now = Date.now();
  if (_catalogCache && now - _catalogCacheAt < CATALOG_TTL_MS) {
    return _catalogCache;
  }

  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();

  const push = (p: CatalogProduct) => {
    if (!p.title && !p.title_en) return;
    const url = p.product_url || p.source_url || '';
    if (!url || !url.startsWith('http')) return;

    const key = normalizeProductName(p.title) || normalizeProductName(p.title_en);
    if (!key || seen.has(key)) return;
    seen.add(key);

    const norm = normalizeProductName(p.title);
    const normEn = normalizeProductName(p.title_en);

    // Key phụ: tên không có số thứ tự phía trước, hoặc cắt bớt hậu tố
    // (VD: "A-200 Personal Sound Amplifier" → "a 200")
    const altNorms: string[] = [];
    if (normEn && normEn !== norm) altNorms.push(normEn);
    const stripped = norm.replace(/^(the|a|an)\s+/, '');
    if (stripped !== norm && stripped.length >= 3) altNorms.push(stripped);
    // Cắt phần hậu tố mô tả: lấy 1-3 từ đầu nếu đủ dài
    const words = norm.split(' ').filter(Boolean);
    if (words.length >= 2) {
      const first2 = words.slice(0, 2).join(' ');
      if (first2.length >= 5) altNorms.push(first2);
    }

    entries.push({ ...p, norm, altNorms: [...new Set(altNorms)] });
  };

  try {
    const rows = db
      .prepare(
        `SELECT id, title, title_en, brand, category, price_range, description, image_url,
                product_url, source_url
         FROM kb_products
         WHERE status IN ('published', 'draft', 'archived')`
      )
      .all() as any[];

    for (const r of rows) {
      push({
        id: r.id,
        title: r.title || '',
        title_en: r.title_en || r.title || '',
        brand: r.brand || '',
        category: r.category || 'general',
        price_range: r.price_range || '',
        description: (r.description || '').substring(0, 300),
        image_url: r.image_url || '',
        product_url: r.product_url || r.source_url || '',
        source_url: r.source_url || r.product_url || '',
      });
    }
  } catch (err) {
    console.warn('[productLinker] Failed to load kb_products:', (err as Error).message);
  }

  try {
    const rows = db
      .prepare(
        `SELECT id, title, title_en, description, category, url, source, metadata
         FROM knowledge_items
         WHERE status = 'published' AND source_type = 'web'`
      )
      .all() as any[];

    for (const r of rows) {
      let img = '';
      try {
        const meta = r.metadata ? JSON.parse(r.metadata) : {};
        img = meta.thumbnailUrl || meta.image_url || '';
      } catch {
        /* ignore */
      }

      push({
        id: r.id,
        title: r.title || '',
        title_en: r.title_en || r.title || '',
        brand: '',
        category: r.category || 'general',
        price_range: '',
        description: (r.description || '').substring(0, 300),
        image_url: img,
        product_url: r.url || r.source || '',
        source_url: r.url || r.source || '',
      });
    }
  } catch (err) {
    console.warn('[productLinker] Failed to load knowledge_items:', (err as Error).message);
  }

  _catalogCache = entries;
  _catalogCacheAt = now;

  return entries;
}

/** Xoá cache (dùng khi admin cập nhật sản phẩm). */
export function invalidateProductCatalog(): void {
  _catalogCache = null;
  _catalogCacheAt = 0;
}

// ============== TÌM SẢN PHẨM ĐƯỢC NHẮC ==============

/** Chuẩn hoá văn bản câu trả lời để so khớp (giữ nguyên cấu trúc để map vị trí). */
function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

/**
 * Tìm các sản phẩm trong catalog được nhắc tới trong câu trả lời.
 *
 * @returns Danh sách sản phẩm tìm thấy, sắp xếp theo thứ tự xuất hiện trong text.
 */
export function findMentionedProducts(
  answer: string,
  catalog?: CatalogEntry[]
): CatalogEntry[] {
  if (!answer) return [];

  const entries = catalog || buildProductCatalog();
  if (entries.length === 0) return [];

  const haystack = normalizeForMatching(answer);
  if (!haystack.trim()) return [];

  const found: Array<{ entry: CatalogEntry; pos: number; len: number }> = [];

  for (const entry of entries) {
    // Ưu tiên tên đầy đủ; sau đó thử các key phụ
    const candidates = [entry.norm, ...entry.altNorms];

    for (const key of candidates) {
      // Bỏ qua key quá ngắn (dễ match nhầm, VD "tv")
      if (!key || key.length < 4) continue;

      const pos = haystack.indexOf(key);
      if (pos === -1) continue;

      // Đảm bảo match nằm trên ranh giới từ
      const before = pos > 0 ? haystack[pos - 1] : ' ';
      const after = haystack[pos + key.length] ?? ' ';
      const isWordish = (c: string) => c === ' ' || c === '';
      if (!isWordish(before) || !isWordish(after)) continue;

      found.push({ entry, pos, len: key.length });
      break; // chỉ lấy match tốt nhất (full name trước alt name)
    }
  }

  // Loại bỏ match trùng lặp (cùng sản phẩm match nhiều lần) — giữ match đầu tiên
  const seen = new Set<string>();
  const unique = found.filter((f) => {
    if (seen.has(f.entry.id)) return false;
    seen.add(f.entry.id);
    return true;
  });

  unique.sort((a, b) => a.pos - b.pos);
  return unique.map((f) => f.entry);
}

// ============== LÀM GIÀU DANH SÁCH SẢN PHẨM ==============

/**
 * Bảo đảm mọi sản phẩm được bot nhắc tới đều xuất hiện trong danh sách sản phẩm
 * gửi kèm → frontend gắn link đúng vào dòng đang nhắc tên.
 *
 * @param answer      Câu trả lời của bot
 * @param products    Danh sách sản phẩm hiện có (từ RAG / DB)
 * @param language    Ngôn ngữ hiển thị
 * @param maxProducts Số sản phẩm tối đa trả về
 */
export function enrichProductsWithMentions(
  answer: string,
  products: any[],
  language: string = 'vi',
  maxProducts = 12
): any[] {
  const catalog = buildProductCatalog();
  if (catalog.length === 0) return products;

  const mentioned = findMentionedProducts(answer, catalog);
  if (mentioned.length === 0) return products;

  // Map các sản phẩm đang có theo tên chuẩn hoá
  const existingNorms = new Set<string>();
  const existingUrls = new Set<string>();
  for (const p of products || []) {
    const n = normalizeProductName(p.title || '');
    if (n) existingNorms.add(n);
    const ne = normalizeProductName(p.title_en || '');
    if (ne) existingNorms.add(ne);
    const u = p.product_url || p.source_url || '';
    if (u) existingUrls.add(u);
  }

  const additions: any[] = [];

  for (const entry of mentioned) {
    const url = entry.product_url || entry.source_url;
    if (!url || !url.startsWith('http')) continue;
    if (existingUrls.has(url)) continue;
    if (existingNorms.has(entry.norm)) continue;

    const isEn = language === 'en';
    const title = isEn && entry.title_en ? entry.title_en : entry.title;

    additions.push({
      id: entry.id,
      title,
      title_en: entry.title_en || entry.title,
      description: entry.description || '',
      category: entry.category || 'general',
      brand: entry.brand || '',
      price_range: entry.price_range || '',
      product_url: url,
      source_url: entry.source_url || url,
      image_url: entry.image_url || '',
      confidence: 0.9,
      match_reason: '',
      in_stock: true,
      galleryImages: [],
      features: [],
      specifications: {},
    });

    existingUrls.add(url);
    existingNorms.add(entry.norm);
  }

  if (additions.length === 0) return products;

  // Sản phẩm được nhắc tới ưu tiên lên đầu → khớp thứ tự người dùng đọc
  return [...additions, ...(products || [])].slice(0, maxProducts);
}

// ============== CATALOG CHO PROMPT ==============

/**
 * Sinh danh sách tên sản phẩm THẬT của MADA theo category để đưa vào prompt.
 *
 * ⚠️ VÌ SAO CẦN:
 * Khi không có catalog trong prompt, model tự bịa tên sản phẩm (VD "Phonak
 * Audeo Lumity" — không hề có trong DB MADA). Tên bịa đó không có trong
 * `suggestedProducts` → không được gắn link → khách hàng thấy sản phẩm "mồ côi".
 *
 * Khi có catalog, model chỉ được nhắc tên trong danh sách này → luôn tìm thấy
 * sản phẩm tương ứng → luôn có link.
 *
* @param category  Category của bot (kb_products.category). null = tất cả.
 * @param language  Ngôn ngữ hiển thị
 * @param limit     Số sản phẩm tối đa
 * @param botId     Bot sở hữu các sản phẩm này. Lọc theo BOT chặt chẽ hơn lọc
 *                  theo category: bot-mobility và bot-neuro đều quét `mobility`,
 *                  nếu chỉ lọc category thì mỗi bot thấy sản phẩm của bot kia.
 */
export function buildCatalogPromptBlock(
  category: string | null,
  language: string = 'vi',
  limit = 40,
  /**
   * ⭐ HỎI RIÊNG 1 SẢN PHẨM: chỉ đưa ĐÚNG sản phẩm này vào danh mục.
   *
   * ⚠️ VÌ SAO CẦN: khi user hỏi "cho tôi xem OrCam MyEye", nếu vẫn đưa 40
   * tên sản phẩm thì model sẽ tự liệt kê thêm 3 sản phẩm khác. Chỉ đưa đúng 1
   * tên → model không có cách nào khác ngoài viết về sản phẩm đó.
   */
  singleProductTitle?: string | null,
  botId?: string | null
): string {
  const catalog = buildProductCatalog();
  if (catalog.length === 0) return '';

  let entries = catalog;

  // ⭐ Ưu tiên cao nhất: chỉ 1 sản phẩm được hỏi tới.
  if (singleProductTitle) {
    const want = singleProductTitle.trim().toLowerCase();
    const only = catalog.filter(
      (e) =>
        (e.title || '').trim().toLowerCase() === want ||
        (e.title_en || '').trim().toLowerCase() === want
    );
    if (only.length > 0) return buildBlock(only.slice(0, 1), language);
    // Không tìm thấy tên khớp → rơi xuống hành vi thường (danh mục theo category).
  }

  if (category) {
    const target = category.toLowerCase();
    const filtered = catalog.filter((e) => (e.category || '').toLowerCase() === target);
    // ⚠️ KHÔNG được fallback sang toàn bộ catalog khi category rỗng.
    // `entries = catalog` khiến bot-mobility (category `daily_living`) đề xuất
    // eSight 4 (thị giác), Proloquo2Go (giao tiếp)… → người dùng chọn đúng bot mà
    // vẫn nhận sản phẩm của bot khác. Rỗng thì trả rỗng, để lớp trên xử lý.
    if (filtered.length > 0) entries = filtered;
    else return '';
  }

  // ⭐ Lọc theo taxonomy MADA (nguồn chuẩn) thay vì suy đoán từ category.
  // MADA khai 1 sản phẩm thuộc NHIỀU nhóm (proloquo2go → cognition +
  // voice-and-speech), nên lọc theo `category` đơn thuần là thiếu.
  //
  // Ưu tiên sản phẩm ĐỘC QUYỀN của bot trước; chỉ dùng sản phẩm đa nhãn khi
  // bot không có sản phẩm riêng (bot-mobility thuộc trường hợp này — MADA
  // không bán xe lăn nên danh mục này gần như toàn sản phẩm chung).
  if (botId) {
    const owned = entries.filter((e) =>
      productBelongsToBot(e.product_url || e.source_url, botId)
    );
    const exclusive = owned.filter((e) =>
      isExclusiveToBot(e.product_url || e.source_url, botId)
    );
    if (exclusive.length > 0) entries = exclusive;
    else if (owned.length > 0) entries = owned;
  }

  // Ưu tiên sản phẩm có ảnh (đủ thông tin để gửi card) rồi tới tên ngắn gọn
  const sorted = [...entries].sort((a, b) => {
    const aImg = a.image_url ? 1 : 0;
    const bImg = b.image_url ? 1 : 0;
    if (aImg !== bImg) return bImg - aImg;
    return a.title.length - b.title.length;
  });

  const chosen = sorted.slice(0, limit);
  if (chosen.length === 0) return '';
  return buildBlock(chosen, language);
}

/** Format danh mục sản phẩm thành block prompt (tách riêng để dùng chung 2 nhánh). */
function buildBlock(chosen: any[], language: string = 'vi'): string {
  const isEn = language === 'en';
  const header = isEn
    ? 'CATALOG OF AVAILABLE MADA PRODUCTS (use these EXACT names when recommending a product):'
    : 'DANH MỤC SẢN PHẨM MADA HIỆN CÓ (chỉ được nhắc đúng tên trong danh sách này):';

  const lines = chosen.map((e) => {
    const name = isEn && e.title_en ? e.title_en : e.title;
    const extra = !isEn && e.title_en && e.title_en !== e.title ? ` / ${e.title_en}` : '';
    const brand = e.brand ? ` — ${e.brand}` : '';
    const url = e.product_url || e.source_url || '';
    // ⭐ Kèm link để bot ghi thẳng link dưới tên sản phẩm trong câu trả lời.
    // Chỉ ghi URL thuần — KHÔNG ghi chữ "LINK:" để bot không lộ marker nội bộ.
    const link = url ? ` — ${url}` : '';
    return `- ${name}${extra}${brand}${link}`;
  });

  const footer = isEn
    ? '\n⚠️ Only mention product names listed above. Never invent a product name.\n'
      + '⚠️ ALWAYS put each product URL on its own line, right under the product name, '
      + 'copied exactly as given above. Format:\n'
      + '**Product Name**\nhttps://exact-url\n'
      + 'Never omit or alter the URL.'
    : '\n⚠️ Chỉ được nhắc tên sản phẩm có trong danh sách trên. TUYỆT ĐỐI không bịa tên sản phẩm không có ở đây.\n'
      + '⚠️ PHẢI đặt link sản phẩm ở DÒNG RIÊNG ngay DƯỚI tên sản phẩm, chép y hệt như đã cho ở trên. '
      + 'Cách viết:\n'
      + '**Tên Sản Phẩm**\nhttps://link-chính-xác\n'
      + 'Không được bỏ sót hoặc tự chế link.';

  return `${header}\n${lines.join('\n')}${footer}`;
}
