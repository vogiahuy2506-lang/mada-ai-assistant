/**
 * Chat Routes — AI/RAG powered conversational endpoints
 * Tuần 1 — AI/RAG Pipeline
 * 
 * Endpoints:
 * - POST /api/chat              → Basic chat with RAG
 * - POST /api/chat-with-file    → Chat with file attachments
 * - POST /api/chat/stream       → SSE streaming chat
 * - POST /api/chat/follow-up    → AI-powered follow-up questions
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ragEngine } from '../lib/rag/ragEngine';
import { guardrails } from '../lib/guardrails';
import { buildSystemPrompt } from '../lib/prompts/systemPrompts';
import { createConsultationSession, getConsultationQuestions } from '../lib/consultationEngine';
import db from '../lib/db';
import { getSystemSettings } from '../lib/db';
import { verifyAccessToken, requireAdmin } from '../lib/auth';
import { getFileUploadQuota, trackFileUpload } from '../lib/db';
import { chatHistory, waitForRagReady } from '../lib/chat-context';
import { parseAttachment } from '../lib/fileProcessor';
import { translateContent } from '../lib/translationService';
import { productExtractor, type ExtractedProduct } from '../lib/scraping/productExtractor';
import { buildCatalogPromptBlock, enrichProductsWithMentions } from '../lib/productLinker';
import {
  AGENT_TO_MADA as AGENT_TO_MADA_MAP,
  MADA_CATEGORY_TO_DB as MADA_CATEGORY_TO_DB_MAP,
  productCategoriesForBot,
} from '../lib/categoryMapping';
import { routeToSpecialistBot } from '../lib/specialistRouter';
import { shouldFetchProducts } from '../lib/productGating';
import {
  primaryOwnerForProduct,
  productBelongsToBot,
  ownedProductUrlsForBot,
} from '../lib/productTaxonomy';
import { logActivity } from '../index';

const router = express.Router();

// ============== HELPERS ==============

/**
 * ⭐ AUTO-SCRAPE URLS FROM MESSAGE
 * Khi user gửi message chứa URL, tự động scrape và trả về product cards
 */
async function autoScrapeUrlsFromMessage(
  message: string,
  language: string
): Promise<{ scrapedProducts: any[]; cleanedMessage: string }> {
  const scrapedProducts: any[] = [];
  
  // Extract URLs from message
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const urls = message.match(urlRegex) || [];
  
  // Only process if message is mostly a URL (90%+ of content is URL)
  const isUrlOnly = urls.length > 0 && urls.join('').length > message.length * 0.7;
  
  // Also check for explicit URL keywords
  const urlKeywords = ['xem sản phẩm', 'xem sp', 'link', 'url', 'trang', 'web', 'website'];
  const hasUrlKeyword = urlKeywords.some(kw => message.toLowerCase().includes(kw));
  
  if (urls.length === 0 || (!isUrlOnly && !hasUrlKeyword)) {
    return { scrapedProducts: [], cleanedMessage: message };
  }
  

  
  // Scrape each URL (limit to first 3 to avoid too many requests)
  for (const url of urls.slice(0, 3)) {
    try {

      
      const result = await productExtractor.extractFromUrl(url, undefined, {
        mode: 'preview',
        language: language === 'ar' ? 'ar' : 'en',
      });
      
      if (result.success && result.products.length > 0) {
        // Take first product from each URL (usually it's the main product)
        const product = result.products[0];
        
        // Get category color
        const categoryLower = (product.category || '').toLowerCase();
        let categoryColor = 'from-blue-500 to-cyan-500';
        if (categoryLower.includes('hearing')) categoryColor = 'from-cyan-500 to-blue-600';
        else if (categoryLower.includes('vision')) categoryColor = 'from-purple-500 to-pink-500';
        else if (categoryLower.includes('mobility')) categoryColor = 'from-emerald-500 to-teal-500';
        else if (categoryLower.includes('cognitive') || categoryLower.includes('mental')) categoryColor = 'from-amber-500 to-orange-500';
        
        // Build product card
        const productCard = {
          id: product.id || `scraped-${Date.now()}`,
          title: product.name,
          title_en: product.name,
          description: product.description || '',
          category: product.category || 'general',
          brand: product.brand || 'Unknown',
          price_range: product.price > 0 
            ? `${product.price.toLocaleString()} ${product.currency}` 
            : 'Liên hệ MADA Center',
          product_url: product.url || url,
          source_url: product.url || url,
          image_url: toProxyImageUrl(product.imageUrl || product.images?.[0] || ''),
          confidence: 1.0, // High confidence - direct scrape
          match_reason: 'Tự động trích xuất từ URL bạn cung cấp',
          mada_advice: '',
          warranty: '',
          features: [],
          specifications: product.specifications || {},
          in_stock: product.inStock,
          galleryImages: product.images?.length > 1 ? product.images.slice(1).map((img: string) => toProxyImageUrl(img)) : [],
          categoryColor,
          isScraped: true, // Flag to indicate this was auto-scraped
        };
        
        scrapedProducts.push(productCard);


      }
    } catch (err) {
      console.error(`❌ [AutoScrape] Error scraping ${url}:`, err);
    }
  }
  
  // Clean message: remove URLs for RAG processing
  const cleanedMessage = message.replace(urlRegex, '').trim();
  
  return { scrapedProducts, cleanedMessage };
}

/**
 * Convert MADA image URL to proxy URL
 * 
 * Logic giống hệt index.ts:
 * - cdn.at.mada.org.qa, cdn.mada.org.qa → proxy qua /api/mada-image
 * - at.mada.org.qa, mada.org.qa → load trực tiếp (server proxy không access được do sandbox)
 * - Shop VN, wikimedia → load trực tiếp
 * - Các URL khác → load trực tiếp
 */

function toProxyImageUrl(madaUrl: string): string {
  // Chỉ accept valid URLs
  if (!madaUrl || typeof madaUrl !== 'string' || !madaUrl.startsWith('http')) {
    return '';
  }

  // Proxy chỉ các domain cần thiết (cdn.at.mada.org.qa, cdn.mada.org.qa)
  // KHÔNG proxy at.mada.org.qa vì server proxy không hoạt động do sandbox restriction
  if (madaUrl.includes('cdn.at.mada.org.qa') || madaUrl.includes('cdn.mada.org.qa')) {
    return `/api/mada-image?url=${encodeURIComponent(madaUrl)}`;
  }

  // at.mada.org.qa: load trực tiếp (browser có thể access)
  if (madaUrl.includes('at.mada.org.qa') || madaUrl.includes('mada.org.qa')) {
    return madaUrl;
  }

  // Shop VN và các domain khác: load trực tiếp
  const shopDomains = ['tgdd.vn', 'cellphones.com.vn', 'fptshop.com.vn', 'dienmayxanh.com', 'hstatic.net', 'viettelstore.vn'];
  if (shopDomains.some(d => madaUrl.includes(d))) {
    return madaUrl;
  }

  // Wikimedia và các domain khác → load trực tiếp
  return madaUrl;
}

// ⭐ Helper: Map knowledge_items row to product card format
function knowledgeItemToProduct(row: any, effectiveLanguage: string = 'vi'): any {
  const meta = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
  const categoryLower = (row.category || '').toLowerCase();
  
  let categoryColor = 'from-blue-500 to-cyan-500';
  if (categoryLower.includes('hearing') || categoryLower.includes('thính')) {
    categoryColor = 'from-cyan-500 to-blue-600';
  } else if (categoryLower.includes('vision') || categoryLower.includes('thị')) {
    categoryColor = 'from-purple-500 to-pink-500';
  } else if (categoryLower.includes('mobility') || categoryLower.includes('vận')) {
    categoryColor = 'from-emerald-500 to-teal-500';
  } else if (categoryLower.includes('cognitive') || categoryLower.includes('nhận')) {
    categoryColor = 'from-amber-500 to-orange-500';
  }
  
  const title = row.title_en && effectiveLanguage === 'en' ? row.title_en : row.title;
  const description = row.description_en && effectiveLanguage === 'en' ? row.description_en : (row.description || '');

  // ⭐ Chuẩn hoá brand + price theo ngôn ngữ người dùng.
  // Hardcode tiếng Anh ("MADA Qatar AT Portal", "Contact MADA Center") khiến
  // card hiển thị sai ngôn ngữ với câu trả lời (VD hỏi tiếng Việt nhưng card
  // ghi "Contact MADA Center").
  const CONTACT_PRICE: Record<string, string> = {
    vi: 'Liên hệ MADA Center',
    en: 'Contact MADA Center',
    ar: 'تواصل مع مركز MADA',
    fr: 'Contactez le centre MADA',
  };
  const contactPrice = CONTACT_PRICE[effectiveLanguage] || CONTACT_PRICE.vi;
  const BRAND_LABEL: Record<string, string> = {
    vi: 'Cổng AT MADA Qatar',
    en: 'MADA Qatar AT Portal',
    ar: 'بوابة MADA Qatar للتقنية المساعدة',
    fr: 'Portail AT MADA Qatar',
  };
  const brandLabel = BRAND_LABEL[effectiveLanguage] || BRAND_LABEL.vi;

  return {
    id: row.id,
    title: title || '',
    title_en: row.title_en || row.title || '',
    description: description.substring(0, 300) + (description.length > 300 ? '...' : ''),
    category: row.category || 'general',
    brand: meta.brand || brandLabel,
    price_range: meta.priceRange || contactPrice,
    product_url: row.url || meta.productUrl || meta.sourceUrl || '',
    source_url: row.url || '',
    image_url: toProxyImageUrl(meta.imageUrl || meta.thumbnailUrl || ''),
    confidence: 0.85,
    match_reason: (MATCH_REASON_I18N[
      (['vi', 'en', 'ar', 'fr'].includes(effectiveLanguage) ? effectiveLanguage : 'vi') as 'vi' | 'en' | 'ar' | 'fr'
    ].category(row.category || '')),
    mada_advice: '',
    warranty: '',
    features: meta.features || [],
    specifications: {},
    in_stock: true,
    galleryImages: [],
    categoryColor,
  };
}

// ⭐ Helper: Map kb_products row to product card format
function kbProductToProduct(row: any, effectiveLanguage: string = 'vi'): any {
  const categoryLower = (row.category || '').toLowerCase();
  
  let categoryColor = 'from-blue-500 to-cyan-500';
  if (categoryLower.includes('hearing') || categoryLower.includes('thính')) {
    categoryColor = 'from-cyan-500 to-blue-600';
  } else if (categoryLower.includes('vision') || categoryLower.includes('thị')) {
    categoryColor = 'from-purple-500 to-pink-500';
  } else if (categoryLower.includes('mobility') || categoryLower.includes('vận')) {
    categoryColor = 'from-emerald-500 to-teal-500';
  } else if (categoryLower.includes('cognitive') || categoryLower.includes('nhận')) {
    categoryColor = 'from-amber-500 to-orange-500';
  }
  
  const title = row.title_en && effectiveLanguage === 'en' ? row.title_en : row.title;
  const description = row.description_en && effectiveLanguage === 'en' ? row.description_en : (row.description || '');

  // ⭐ Chuẩn hoá theo ngôn ngữ — xem knowledgeItemToProduct để biết lý do.
  const CONTACT_PRICE: Record<string, string> = {
    vi: 'Liên hệ MADA Center',
    en: 'Contact MADA Center',
    ar: 'تواصل مع مركز MADA',
    fr: 'Contactez le centre MADA',
  };
  const contactPrice = CONTACT_PRICE[effectiveLanguage] || CONTACT_PRICE.vi;
  const BRAND_LABEL: Record<string, string> = {
    vi: 'Cổng AT MADA Qatar',
    en: 'MADA Qatar AT Portal',
    ar: 'بوابة MADA Qatar للتقنية المساعدة',
    fr: 'Portail AT MADA Qatar',
  };
  const brandLabel = BRAND_LABEL[effectiveLanguage] || BRAND_LABEL.vi;

  return {
    id: row.id,
    title: title || '',
    title_en: row.title_en || row.title || '',
    description: description.substring(0, 300) + (description.length > 300 ? '...' : ''),
    category: row.category || 'general',
    brand: row.brand || brandLabel,
    price_range: row.price_range || contactPrice,
    product_url: row.source_url || row.product_url || row.url || '',
    source_url: row.source_url || row.url || '',
    image_url: toProxyImageUrl(row.image_url || ''),
    confidence: 0.85,
    match_reason: (MATCH_REASON_I18N[
      (['vi', 'en', 'ar', 'fr'].includes(effectiveLanguage) ? effectiveLanguage : 'vi') as 'vi' | 'en' | 'ar' | 'fr'
    ].category(row.category || '')),
    mada_advice: row.mada_advice || '',
    warranty: row.warranty || '',
    features: row.features ? JSON.parse(row.features) : [],
    specifications: {},
    in_stock: true,
    galleryImages: [],
    categoryColor,
  };
}

// MADA Agent to Category mapping
// ⭐ Dùng mapping dùng chung từ `lib/categoryMapping` (source-of-truth),
// tránh lệch với `kb_categories` và `syncKbProducts`.
const AGENT_TO_MADA = AGENT_TO_MADA_MAP;

// ⭐ Product Request Category Mapping (MADA bot category → kb_products.category)
const MADA_CATEGORY_TO_DB = MADA_CATEGORY_TO_DB_MAP;

// ⭐ Product request response templates
const PRODUCT_REQUEST_RESPONSES: Record<string, string> = {
  vi: 'Dựa trên nhu cầu của bạn, đây là các sản phẩm công nghệ hỗ trợ tôi gợi ý:',
  en: 'Based on your needs, here are the assistive technology products I recommend:',
  ar: 'بناءً على احتياجاتك، إليك منتجات تقنية المساعدة التي أوصي بها:',
  fr: "Basé sur vos besoins, voici les produits de technologie d'assistance que je recommande:",
};

// ⭐ Get products by category (for product request) - Query from knowledge_items
async function getProductsByCategory(madaCategory: string | null, language: string, limit: number = 6): Promise<any[]> {
  let products: any[] = [];
  
  try {
    let query: string;
    let params: any[];
    
    if (madaCategory && MADA_CATEGORY_TO_DB[madaCategory]) {
      // Lấy products theo category cụ thể từ knowledge_items
      // ⭐ Include cả 'web' (scraped) và 'manual' (admin imported từ kb_products)
      // để user thấy được sản phẩm thực tế (manual) lẫn crawled data
      const dbCategory = MADA_CATEGORY_TO_DB[madaCategory];
      query = `
        SELECT * FROM knowledge_items
        WHERE category = ? AND status = 'published' AND source_type IN ('web', 'manual')
        ORDER BY (source_type = 'manual') DESC, created_at DESC
        LIMIT ?
      `;
      params = [dbCategory, limit];
      // Fetching products for category
    } else {
      // Lấy tất cả products (bot tổng)
      query = `
        SELECT * FROM knowledge_items
        WHERE status = 'published' AND source_type IN ('web', 'manual')
        ORDER BY (source_type = 'manual') DESC, created_at DESC
        LIMIT ?
      `;
      params = [limit];
      // Fetching all products
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    // Products found
    
    // Map to product format using helper
    products = rows.map((row: any) => knowledgeItemToProduct(row, language));
    // Products mapped
    
    // Filter out invalid products
    products = products.filter((p: any) => {
      const hasTitle = p.title && p.title.length > 2;
      const hasUrl = p.product_url && (p.product_url.startsWith('http') || p.product_url.length > 0);
      return hasTitle;
    });
    
    // Returning valid products
  } catch (err) {
    console.error('❌ [ProductRequest] Error:', err);
  }
  
  return products;
}

// Multi-language match reason
const MATCH_REASON_I18N: Record<string, { found: string; category: (cat: string) => string }> = {
  vi: { found: 'Tìm thấy trong MADA Knowledge Base', category: (cat) => `Phù hợp category: ${cat}` },
  en: { found: 'Found in MADA Knowledge Base', category: (cat) => `Matched category: ${cat}` },
  ar: { found: 'تم العثور عليها في قاعدة معرفة MADA', category: (cat) => `فئة متطابقة: ${cat}` },
  fr: { found: 'Trouvé dans la base de connaissances MADA', category: (cat) => `Catégorie correspondante: ${cat}` },
};

function getMatchReason(lang: string, kind: 'found' | 'category', context?: string): string {
  const langCode = (['vi', 'en', 'ar', 'fr'].includes(lang) ? lang : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  const dict = MATCH_REASON_I18N[langCode];
  if (kind === 'found') return dict.found;
  return dict.category(context || '');
}

// ============== PRODUCT DETECTION ==============

// ============== PRODUCT DETECTION ==============

/**
 * ⭐ Tìm sản phẩm KHÁC CÙNG LOẠI với sản phẩm user vừa hỏi.
 *
 * DÙNG KHI NÀO:
 * User hỏi về 1 sản phẩm cụ thể (VD "VisionBuddy là gì?") nhưng sản phẩm đó
 * ĐÃ HIỂN THỊ ở lượt trước. Lúc này không nên im lặng, cũng không nên list 12
 * sản phẩm — chỉ gợi ý vài sản phẩm cùng nhóm để khách so sánh.
 *
 * @param product Sản phẩm gốc user đã hỏi.
 * @param effectiveLanguage Ngôn ngữ hiển thị (vi/en/ar/fr).
 * @param limit Số sản phẩm tối đa (mặc định 3 — đủ so sánh mà không rối).
 * @param shownProductIds Sản phẩm đã hiện, để không lặp lại.
 */
async function findSimilarProducts(
  product: any,
  effectiveLanguage: string = 'vi',
  limit = 3,
  shownProductIds: string[] = []
): Promise<any[]> {
  if (!product) return [];

  const category = (product.category || '').toLowerCase();

  try {
    // ⭐ better-sqlite3 dùng API đồng bộ: .all(...) trả về mảng rows trực tiếp.
    // (Bản cũ dùng callback kiểu node-sqlite3 → bị ném lỗi
    // "SQLite3 can only bind numbers, strings, bigints, buffers, and null"
    // vì callback bị bind như một tham số SQL.)
    const rows: any[] = category
      ? (db.prepare(`
          SELECT * FROM kb_products
          WHERE status = 'published' AND image_url IS NOT NULL AND image_url <> ''
            AND LOWER(category) = ?
          ORDER BY featured DESC, sort_order ASC, created_at DESC
          LIMIT 12
        `).all(category) as any[])
      : (db.prepare(`
          SELECT * FROM kb_products
          WHERE status = 'published' AND image_url IS NOT NULL AND image_url <> ''
          ORDER BY featured DESC, sort_order ASC, created_at DESC
          LIMIT 12
        `).all() as any[]);

    const out: any[] = [];
    const seen = new Set<string>([...(shownProductIds || []), product.id]);

    for (const row of rows) {
      const url = row.product_url || row.source_url || '';
      if (!url.startsWith('http')) continue;
      if (seen.has(row.id) || seen.has(url)) continue;
      seen.add(row.id);
      out.push(kbProductToProduct(row, effectiveLanguage));
      if (out.length >= limit) break;
    }

    return out;
  } catch (err) {
    console.warn('[findSimilarProducts] Error:', err);
    return [];
  }
}

/**
 * ⭐ FEATURE 1: Find a specific product by detecting product name in user message.
 * If user mentions a specific product (e.g. "Victor Reader", "OrCam MyEye"),
 * return ONLY that product instead of showing all products in the category.
 *
 * @param agentId Bot chuyên môn đang trả lời — dùng để ưu tiên sản phẩm đúng nhóm
 *                (người hỏi bot thị giác về "VisionBuddy" không nên nhận sản
 *                phẩm thính giác chỉ vì có chung từ chung).
 */
function findProductByMessage(message: string, _effectiveLanguage: string, agentId?: string): any | null {
  if (!message || message.length < 3) return null;

  try {
    // Remove common query words to isolate product name
    const cleaned = message
      .replace(/^(cho tôi|cho mình|tôi muốn|mình muốn|tìm|xem|hiển thị|show|find|what is|what's|what are|tell me|about|the|a|an|thiết bị|sản phẩm|máy|device|product|with|for|about|là gì|giá|demo|review|price|cost)/gi, ' ')
      .replace(/[?.,!;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key phrases (3-5 words) that might be product names
    const words = cleaned.split(' ').filter(w => w.length > 2);
    const phrases: string[] = [];

    // Generate 2-4 word phrases
    for (let i = 0; i < words.length; i++) {
      for (let len = 2; len <= Math.min(4, words.length - i); len++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length >= 5) phrases.push(phrase);
      }
    }

    // Also try full cleaned message as single phrase
    if (cleaned.length >= 4) phrases.unshift(cleaned);



    // Search knowledge_items for matching titles (products scraped from MADA portal)
    for (const phrase of phrases) {
      if (phrase.length < 3) continue;

      const searchTerms = [
        phrase,
        phrase.replace(/[®™©°]/g, '').trim(),
        phrase.replace(/[-_]/g, ' '),
      ];

      for (const term of searchTerms) {
        if (term.length < 3) continue;

        // Exact match first
        let item = db.prepare(`
          SELECT * FROM knowledge_items
          WHERE status = 'published' AND source_type = 'web'
            AND (title = ? COLLATE NOCASE OR title_en = ? COLLATE NOCASE
              OR REPLACE(title, '®', '') = ? COLLATE NOCASE
              OR REPLACE(title_en, '®', '') = ? COLLATE NOCASE)
          LIMIT 1
        `).get(term, term, term, term) as any;

        // Partial match
        if (!item) {
          item = db.prepare(`
            SELECT * FROM knowledge_items
            WHERE status = 'published' AND source_type = 'web'
              AND (title LIKE ? COLLATE NOCASE ESCAPE '/' OR title_en LIKE ? COLLATE NOCASE ESCAPE '/')
            ORDER BY created_at DESC
            LIMIT 1
          `).get(`%${term}%`, `%${term}%`) as any;
        }

        if (item) {

          return knowledgeItemToProduct(item, _effectiveLanguage);
        }
      }
    }

    // ⭐⭐ FALLBACK: tìm trong kb_products.
    //
    // VÌ SAO CẦN:
    // knowledge_items gần như trống với sản phẩm MADA (chỉ 9 dòng, 0 dòng
    // web/published) — danh mục thật nằm ở kb_products (349 sản phẩm, 100%
    // có image_url). Nếu chỉ query knowledge_items thì câu hỏi riêng về 1 tên
    // sản phẩm (VD "VisionBuddy là gì?") KHÔNG bao giờ ra được card → người
    // dùng chỉ thấy danh sách chung hoặc không thấy gì.
    const kbProduct = findKbProductByMessage(cleaned, message, _effectiveLanguage, agentId);
    if (kbProduct) {
      return kbProduct;
    }

    return null;
  } catch (err) {
    console.warn('[findProductByMessage] Error:', err);
    return null;
  }
}

/**
 * Tìm đúng 1 sản phẩm trong kb_products theo tên người dùng nhắc.
 *
 * ƯU TIÊN KHỚP DẦN (từ chính xác → rời rạc):
 *   1. Khớp CHÍNH XÁC toàn bộ tên  → thẻ card đúng tuyệt đối
 *   2. Khớp "tên nằm trọn trong câu" (VisionBuddy trong "... VisionBuddy ...")
 *   3. Khớp "tên viết tắt" — bỏ phần mô tả dài ở cuối
 *      ("Pocket Talker" → "Pocket Talker with Headphones or Neck Loop")
 *   → KHÔNG dùng LIKE '%tên%' trần: "Bell" sẽ khớp "BellBuds", "Google Home
 *     Mini" sẽ khớp hàng loạt → trả về sai sản phẩm.
 */
function findKbProductByMessage(
  cleaned: string,
  rawMessage: string,
  effectiveLanguage: string = 'vi',
  agentId?: string
): any | null {
  const candidates = db.prepare(`
    SELECT * FROM kb_products
    WHERE status = 'published' AND image_url IS NOT NULL AND image_url <> ''
    ORDER BY featured DESC, sort_order ASC, created_at DESC
  `).all() as any[];

  if (candidates.length === 0) return null;

  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[®™©°]/g, '')
      .replace(/[-_/]/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const messageNorm = norm(cleaned || rawMessage);
  // Câu hỏi tiếng Việt chứa rất nhiều từ bổ nghĩa không liên quan; chỉ dùng
  // chúng để đối chiếu chứ không để yêu cầu tên xuất hiện đúng trong câu.
  const STOP = new Set([
    'cho','cho toi','cho minh','toi','minh','ban','gia','bao','nhieu','gi',
    'san','pham','may','thiet','bi','la','gi','co','khong','nua','ve','cua',
    'mua','o','dau','link','ten','nay','do','hay','the','nao','ban','muon',
    'xem','tim','thong','tin','gioi','thieu','up','load','dung','ho','hop',
    'the','bao','lau','anh','hinh','product','device','price','cost','what','is',
    'how','much','show','find','me','my','this','that','the','a','an','about',
    'for','with','please','can','you','do','i','it','of','to','in','on',
  ]);
  const messageTokens = new Set(messageNorm.split(' ').filter(w => w && !STOP.has(w)));

  // ⭐ Ưu tiên sản phẩm đúng chuyên môn bot đang trả lời.
  //
  // VÌ SAO CẦN:
  // Tên sản phẩm AT hay trùng chữ ("Buddy" nằm trong cả VisionBuddy lẫn Big
  // Buddy Button; "Zoom" trong nhiều thiết bị). Nếu không ưu tiên đúng nhóm,
  // người dùng hỏi bot THỊ GIÁC về "VisionBuddy" có thể nhận card thiết bị
  // VẬN ĐỘNG → sai hoàn toàn.
  const dbCategory = agentId ? MADA_CATEGORY_TO_DB[agentId] : undefined;
  const inSpecialty = (p: any) => {
    if (!dbCategory) return true;
    const c = (p.category || '').toLowerCase();
    return c === dbCategory || c.includes(dbCategory) || dbCategory.includes(c);
  };

  /** Tên trong DB đã chuẩn hoá. */
  const productNames = candidates.map((p: any) => ({
    row: p,
    en: norm(p.title_en || ''),
    vi: norm(p.title || ''),
    specialty: inSpecialty(p),
  }));

  /** Sắp xếp: đúng chuyên môn trước, tên dài (cụ thể hơn) sau. */
  const bySpecificity = (a: any, b: any) =>
    Number(b.specialty) - Number(a.specialty) || b.len - a.len;

  // Tầng 1: tên khớp chính xác toàn bộ
  for (const { row, en, vi, specialty } of productNames) {
    if ((en && messageNorm === en) || (vi && messageNorm === vi)) {
      if (specialty || !dbCategory) return kbProductToProduct(row, effectiveLanguage);
    }
  }
  // Tầng 1b: nếu có khớp chính xác nhưng KHÔNG đúng chuyên môn → bỏ qua,
  //          để tầng dưới xử lý (an toàn hơn là trả nhầm nhóm).
  for (const { row, en, vi } of productNames) {
    if ((en && messageNorm === en) || (vi && messageNorm === vi)) {
      if (!inSpecialty(row)) return kbProductToProduct(row, effectiveLanguage);
    }
  }

  // Tầng 2: tên sản phẩm nằm TRỌN VEN trong câu hỏi.
  //
  // VÌ SAO KHÔNG DÙNG "tiền tố": câu "Victor Reader StreetBox giá?" có tên
  // "Victor Reader StreetBox" không tồn tại trong DB; các bản thật là
  // "Victor Reader Stratus4 M…", "Victor Reader Trek…". Khớp tiền tố sẽ bắt
  // đúng, nhưng câu "cho tôi xem VisionBuddy" có "VisionBuddy" ở GIỮA câu
  // (sau "xem") nên không khớp. → So khớp toàn bộ tên nằm trong câu.
  const padded = ` ${messageNorm} `;
  const contained: Array<{ row: any; len: number; specialty: boolean }> = [];
  for (const { row, en, vi, specialty } of productNames) {
    for (const name of [en, vi]) {
      if (!name || name.length < 4) continue;
      if (padded.includes(` ${name} `)) {
        contained.push({ row, len: name.length, specialty });
        break;
      }
    }
  }
  if (contained.length > 0) {
    contained.sort(bySpecificity);
    return kbProductToProduct(contained[0].row, effectiveLanguage);
  }

  // Tầng 3: TÊN VIẾT TẮT — user bỏ phần mô tả dài ở cuối tên sản phẩm.
  //
  // VÌ SAO CẦN:
  // "Pocket Talker with Headphones or Neck Loop" là tên đầy đủ trong DB, nhưng
  // ai cũng gọi tắt là "Pocket Talker". Khớp tiền tố kiểu cũ bỏ sót vì có thể
  // khớp nhầm "Pocket Sign Language Translator". Vì vậy chỉ nhận tên viết tắt
  // khi nó là TIỀN TỐ của tên đầy đủ VÀ câu hỏi không chứa phần bị cắt.
  const abbreviated: Array<{ row: any; len: number; specialty: boolean }> = [];
  for (const { row, en, vi, specialty } of productNames) {
    for (const name of [en, vi]) {
      const words = (name || '').split(' ').filter(Boolean);
      if (words.length < 2) continue;
      // Thử mọi vị trí cắt từ 2 đến trước hết; lấy cụm dài nhất khớp.
      for (let take = words.length - 1; take >= 2; take--) {
        const short = words.slice(0, take).join(' ');
        if (short.length < 5) continue;
        if (!padded.includes(` ${short} `)) continue;
        abbreviated.push({ row, len: short.length, specialty });
        break;
      }
    }
  }
  // ⚠️ Chỉ nhận tên viết tắt khi KHÔNG mơ hồ: đây là phương án cuối cùng,
  // nên yêu cầu tên khớp dài hơn (≥ 2 từ) và đúng chuyên môn bot.
  if (abbreviated.length > 0) {
    const viable = abbreviated.filter((a) => a.len >= 8 && (!dbCategory || a.specialty));
    const pool = viable.length > 0 ? viable : abbreviated;
    pool.sort((a, b) => Number(b.specialty) - Number(a.specialty) || b.len - a.len);
    return kbProductToProduct(pool[0].row, effectiveLanguage);
  }

  // Tầng 4: mọi từ trong tên đều xuất hiện trong câu hỏi (khớp cụm từ)
  const scored: Array<{ row: any; len: number; specialty: boolean }> = [];
  for (const { row, en, vi, specialty } of productNames) {
    for (const name of [en, vi]) {
      if (!name || name.length < 4) continue;
      const nameTokens = name.split(' ').filter((w: string) => w.length > 1 && !STOP.has(w));
      if (nameTokens.length === 0) continue;
      if (nameTokens.every((t: string) => messageTokens.has(t))) {
        scored.push({ row, len: name.length, specialty });
        break;
      }
    }
  }
  if (scored.length > 0) {
    scored.sort(bySpecificity);
    return kbProductToProduct(scored[0].row, effectiveLanguage);
  }

  return null;
}

/**
 * Detect if user message is explicitly asking about products/devices (high priority)
 * Returns true ONLY for explicit requests that should bypass conversation turns requirement
 */
function isExplicitProductRequest(message: string): boolean {
  const contentLower = message.toLowerCase();

  // EXPLICIT commands to show products - these should show products IMMEDIATELY
  const explicitCommands = [
    // Vietnamese
    'hiển thị sản phẩm', 'xem sản phẩm', 'show products', 'tìm sản phẩm',
    'gợi ý thiết bị', 'đề xuất sản phẩm', 'suggest devices', 'recommend products',
    'gợi ý sp', 'đề xuất sp', 'tìm thiết bị', 'tìm sp',
    'what products', 'what devices', 'which products', 'which devices',
    'có sản phẩm nào', 'có thiết bị nào', 'có gì', 'available products',
    'danh sách sản phẩm', 'danh sách thiết bị', 'list of products', 'list of devices',
    'cho xem', 'hiển thị', 'đưa ra', 'liệt kê', 'giới thiệu',
    'cho tôi xem', 'cho mình xem', 'show me', 'display', 'list them',
    // ⭐ CRITICAL: "có sp nào hỗ trợ không" pattern - VERY EXPLICIT
    'có sản phẩm nào', 'có sp nào', 'sản phẩm nào hỗ trợ', 'sp nào hỗ trợ',
    'sản phẩm gì', 'thiết bị gì', 'có gì không', 'có cái nào',
    // ⭐ User tự nhiên hay viết: "xin sản phẩm", "xin sp", "xin vài mẫu",
    // "xin link sản phẩm", "cho mình xin"…
    'xin sản phẩm', 'xin sp', 'xin thiết bị', 'xin link', 'xin vài',
    'cho mình xin', 'cho mình sản phẩm', 'cho mình sp',
    'vài mẫu', 'mẫu mã',
    // ⭐ SYMPTOM-BASED (tiếng Việt) - mô tả vấn đề AT → show sản phẩm ngay
    // THỊ LỰC
    'nhìn xa', 'nhìn gần', 'nhìn rõ', 'nhìn kém', 'nhìn mờ', 'mắt kém', 'mắt mờ',
    'lão hóa mắt', 'lão thị', 'viễn thị', 'cận thị', 'loạn thị', 'tật khúc xạ',
    'đục thủy tinh thể', 'thoái hóa điểm vàng',
    'đọc sách khó', 'đọc chữ khó', 'khó đọc', 'không đọc được',
    'tật mắt', 'tật thị', 'suy giảm thị lực', 'mất thị lực', 'thị lực kém',
    'khó khăn khi nhìn', 'khó nhìn',
    // THÍNH LỰC
    'nghe kém', 'nghe khó', 'khó nghe', 'không nghe rõ', 'ù tai',
    'điếc', 'lãng tai', 'suy giảm thính lực', 'mất thính lực', 'thính lực kém',
    // VẬN ĐỘNG
    'đi lại khó', 'khó đi lại', 'khó vận động', 'tay run', 'tay yếu', 'chân yếu',
    'chân run', 'liệt', 'bại liệt', 'phục hồi chức năng',
    // GIAO TIẾP
    'nói khó', 'khó nói', 'không nói được', 'mất giọng', 'khàn giọng',
    // NHẬN THỨC
    'mất trí nhớ', 'hay quên', 'khó tập trung', 'tự kỷ', 'autism',
    'chậm phát triển', 'rối loạn học tập', 'dyslexia',
    // ENGLISH symptoms
    'low vision', 'vision loss', 'visually impaired', 'blind',
    'hard of hearing', 'hearing loss', 'deaf', 'tinnitus',
    'mobility issues', 'walking difficulty', 'paralysis',
    'speech difficulty', 'speech impairment', 'mute',
    'memory loss', 'dementia', 'alzheimer',
    // English
    'show me products', 'show me devices', 'list products', 'list devices',
    'recommend something', 'any products', 'any devices',
  ];

  if (explicitCommands.some(cmd => contentLower.includes(cmd))) {
    return true;
  }

  // ⭐⭐ Nhắc đúng TÊN sản phẩm trong danh mục MADA (VD "VisionBuddy là gì?",
  // "Giá Pocket Talker bao nhiêu?") → coi như yêu cầu XEM SẢN PHẨM đó.
  //
  // VÌ SAO CẦN:
  // Danh sách explicitCommands ở trên thiếu các câu hỏi dạng "TÊN + là gì /
  // giá bao nhiêu / dùng thế nào". Người dùng hỏi riêng 1 sản phẩm là câu hỏi
  // tự nhiên và phổ biến nhất — nhưng vì không có mục nào khớp nên hệ thống
  // chỉ trả lời chữ, KHÔNG hiện card sản phẩm có ảnh.
  if (messageMentionsKnownProduct(message)) {
    return true;
  }

  return false;
}

/**
 * ⭐ Suy luận category sản phẩm từ câu hỏi của người dùng.
 *
 * Dùng khi chat KHÔNG có agentId (chat tổng quát) — lúc đó `getSuggestedProducts`
 * lấy sản phẩm từ MỌI category nên ra sản phẩm không liên quan
 * (VD: hỏi "máy trợ thính" lại ra "Dragon Professional", "Smyle Mouse").
 *
 * Trả về category của kb_products (hearing/vision/mobility/…) hoặc null nếu
 * không suy luận được.
 */
function inferProductCategory(message: string): string | null {
  if (!message) return null;
  const q = message.toLowerCase();

  const patterns: Array<{ category: string; keywords: string[] }> = [
    {
      category: 'hearing',
      keywords: [
        'máy trợ thính', 'trợ thính', 'thính giác', 'nghe kém', 'khó nghe', 'không nghe rõ',
        'ù tai', 've kêu', 'điếc', 'lãng tai', 'mất thính lực', 'thính lực kém',
        'tai nghe trợ thính', 'phục hồi thính', 'khuếch đại âm thanh',
        'hearing aid', 'hearing', 'tinnitus', 'deaf', 'hard of hearing', 'amplifier',
        'neckloop', 'fm system', 'sound field',
      ],
    },
    {
      category: 'vision',
      keywords: [
        'kính', 'kính mắt', 'kính nhìn', 'mắt kém', 'mắt mờ', 'nhìn mờ', 'nhìn kém',
        'thị giác', 'mù', 'mất thị lực', 'thị lực kém', 'đọc sách khó', 'đọc chữ khó',
        'chữ nhỏ', 'phóng to chữ', 'tăng độ tương phản', 'tương phản cao',
        'braille', 'magnifier', 'low vision', 'vision loss', 'blind', 'visually impaired',
        'sight', 'eye',
      ],
    },
    {
      category: 'mobility',
      keywords: [
        'xe lăn', 'xe điện', 'xe lăn điện', 'khung đi', 'gậy', 'gậy chống', 'nạng',
        'chân giả', 'tay giả', 'chân yếu', 'tay yếu', 'chân run', 'tay run',
        'bại liệt', 'liệt', 'đi lại khó', 'khó đi lại', 'vận động', 'phục hồi chức năng',
        'wheelchair', 'walker', 'crutch', 'cane', 'prosthetic', 'orthotic', 'mobility',
        'paralysis', 'walking difficulty',
      ],
    },
    {
      category: 'voice-and-speech',
      keywords: [
        'giao tiếp', 'nói khó', 'khó nói', 'không nói được', 'âm lượng yếu', 'giọng nói yếu',
        'mất giọng', 'khàn giọng', 'rối loạn ngôn ngữ', 'aphasia', 'aac', 'nói lại',
        'speech', 'communication', 'voice', 'mute', 'voicemail', 'text to speech',
      ],
    },
    {
      category: 'cognition',
      keywords: [
        'trí nhớ', 'hay quên', 'quên', 'nhận thức', 'tập trung', 'rối loạn tăng động',
        'adhd', 'tự kỷ', 'autism', 'học tập', 'đọc hiểu', 'ghi chép',
        'memory', 'cognitive', 'dementia', 'alzheimer', 'learning', 'note taker',
      ],
    },
    {
      category: 'daily_living',
      keywords: [
        'sinh hoạt', 'ăn uống', 'nhà tắm', 'nhà bếp', 'tự ăn', 'uống', 'thuốc',
        'mở nắp', 'mở hộp', 'dressing', 'bathing', 'eating', 'toilet', 'medication',
        'daily living', 'self-care',
      ],
    },
  ];

  for (const { category, keywords } of patterns) {
    if (keywords.some((kw) => q.includes(kw))) {
      return category;
    }
  }

  return null;
}

/**
 * Detect if user message is asking about products/devices
 * Returns true if products should be shown
 */
function shouldShowProducts(message: string): boolean {
  const contentLower = message.toLowerCase();
  
  // Explicit commands to show products (highest priority)
  const explicitCommands = [
    'hiển thị sản phẩm', 'xem sản phẩm', 'show products', 'tìm sản phẩm',
    'gợi ý thiết bị', 'đề xuất sản phẩm', 'suggest devices', 'recommend products',
    'gợi ý sp', 'đề xuất sp', 'tìm thiết bị', 'tìm sp',
    'what products', 'what devices', 'which products', 'which devices',
    'có sản phẩm nào', 'có thiết bị nào', 'có gì', 'available products',
    'danh sách sản phẩm', 'danh sách thiết bị', 'list of products', 'list of devices',
    // ⭐ THÊM: Đại từ chỉ định khi user yêu cầu hiển thị sản phẩm đã đề cập
    'cho xem', 'hiển thị', 'đưa ra', 'liệt kê', 'giới thiệu',
    'cho tôi xem', 'cho mình xem', 'show me', 'display', 'list them',
  ];
  
  if (explicitCommands.some(cmd => contentLower.includes(cmd))) {
    return true;
  }
  
  // Product-related keywords - MỞ RỘNG để bắt nhiều trường hợp hơn
  const productKeywords = [
    // Vietnamese - sản phẩm/thiết bị
    'sản phẩm', 'thiết bị', 'máy', 'mua', 'bán', 'shop', 'cửa hàng',
    'ở đâu', 'mua ở đâu', 'nơi bán', 'giá bao nhiêu', 'giá là bao nhiêu',
    'gợi ý', 'đề xuất', 'recommend', 'suggest', 'suggestion',
    'wheelchair', 'máy trợ', 'xe lăn', 'chân giả', 'tay giả', 'kính', 'nạng',
    'xe', 'ghế', 'giường', 'nệm', 'gậy', 'máy', 'thiết bị',
    // ⭐ ĐẠI TỪ CHỈ ĐỊNH - quan trọng để bắt "chúng", "nó", "đó", "mấy cái"
    // Khi user refer đến sản phẩm đã được nhắc đến trong conversation
    'chúng', 'nó', 'đó', 'mấy', 'cái', 'những', 'các', 'một số', 'tất cả',
    'cái đó', 'đồ này', 'thứ này', 'món này', 'sản phẩm đó', 'thiết bị đó',
    'those', 'them', 'these', 'it', 'this one', 'that one',
    // ⭐ HÌNH ẢNH - THÊM ĐỂ BẮT "xem hình", "hình ảnh sp"
    'hình ảnh', 'hình', 'ảnh', 'coi hình', 'xem hình', 'pic', 'image', 'photo',
    'link', 'url', 'web', 'website', 'xem thêm',
    'tư vấn', 'chi tiết hơn', 'kĩ hơn', 'cụ thể hơn', 'more details', 'detailed',
    'sp', 'mẫu mã', 'kiểu dáng',
    // ⭐ THÊM các từ khóa về thiết bị cụ thể của MADA
    'inspiration', 'victor reader', 'orcam', 'jaws', 'nvda', 'zoomtext',
    'braille', 'brailler', 'tactile', 'tời', 'caption', 'fm system', 'roger',
    'prosthetic', 'orthotic', 'orthopedic', 'crutch', 'cane', 'walker', 'stair',
    // ⭐ EDUCATION KEYWORDS - học tập cho người khuyết tật
    'học', 'học sinh', 'sinh viên', 'trường', 'bài tập', 'đọc sách',
    'sách nói', 'audiobook', 'tài liệu', 'bài giảng', 'học online',
    'student', 'learn', 'study', 'studying', 'school', 'textbook',
    'classroom', 'education', 'dyslexia', 'reading', 'writing',
    'người mù', 'người điếc', 'người khuyết tật', 'khiếm thị', 'khiếm thính',
    'visually impaired', 'blind', 'deaf', 'hard of hearing', 'disabled',
    // English
    'device', 'product', 'buy', 'purchase', 'price', 'cost', 'where to buy',
    'recommend', 'suggest', 'wheelchair', 'hearing aid', 'screen reader',
    'aac', 'prosthetic', 'orthotic', 'orthopedic', 'crutch', 'cane', 'walker',
    'braille', 'magnifier', 'amplifier', 'communication device',
    'assistive', 'assistive technology', 'at device', 'disability equipment',
    'specifications', 'features', 'models', 'brands', 'pictures', 'images',
    // ⭐ SYMPTOM-BASED KEYWORDS (tiếng Việt) - mô tả vấn đề người dùng gặp phải
    // THỊ LỰC
    'nhìn xa', 'nhìn gần', 'nhìn rõ', 'nhìn kém', 'nhìn mờ', 'mắt kém', 'mắt mờ',
    'lão hóa mắt', 'lão thị', 'viễn thị', 'cận thị', 'loạn thị', 'tật khúc xạ',
    'đục thủy tinh thể', 'thoái hóa điểm vàng', 'võng mạc',
    'đọc sách khó', 'đọc chữ khó', 'khó đọc', 'không đọc được', 'chữ nhỏ',
    'phóng to chữ', 'phóng to', 'tăng độ tương phản', 'tương phản cao',
    'tật mắt', 'tật thị', 'suy giảm thị lực', 'mất thị lực', 'thị lực kém',
    'khó khăn khi nhìn', 'khó nhìn',
    // THÍNH LỰC
    'nghe kém', 'nghe khó', 'khó nghe', 'không nghe rõ', 'ù tai', 've kêu',
    'điếc', 'lãng tai', 'suy giảm thính lực', 'mất thính lực', 'thính lực kém',
    'máy trợ thính', 'tai nghe trợ thính', 'phục hồi thính',
    // VẬN ĐỘNG
    'đi lại khó', 'khó đi lại', 'khó vận động', 'tay run', 'tay yếu', 'chân yếu',
    'chân run', 'liệt', 'bại liệt', 'phục hồi chức năng', 'tập đi', 'tập vận động',
    'xe lăn điện', 'xe điện', 'khung đi', 'gậy chống',
    // GIAO TIẾP
    'nói khó', 'khó nói', 'không nói được', 'âm lượng yếu', 'giọng nói yếu',
    'mất giọng', 'khàn giọng', 'rối loạn ngôn ngữ', 'aphasia',
    // NHẬN THỨC
    'mất trí nhớ', 'hay quên', 'khó tập trung', 'rối loạn tăng động', 'adhd',
    'tự kỷ', 'autism', 'chậm phát triển', 'rối loạn học tập', 'khó đọc hiểu',
    'khó viết', 'khó tính toán',
    // ENGLISH symptoms
    'low vision', 'vision loss', 'seeing difficulties',
    'hearing loss', 'tinnitus',
    'mobility issues', 'walking difficulty', 'paralysis', 'limb weakness',
    'speech difficulty', 'speech impairment', 'mute', 'voice disorder',
    'cognitive impairment', 'memory loss', 'dementia', 'alzheimer',
    'reading difficulty', 'adhd', 'autism',
    // Arabic - MỞ RỘNG: sản phẩm, triệu chứng, AT, shopping
    'منتج', 'جهاز', 'شراء', 'سعر', 'ينصح', 'يقت', 'كرسي متحرك', 'سماعة',
    'معينات سمعية', 'كرسي متحرك', 'مساعدة', 'إعاقة', 'ذوي الإعاقة', 'أجهزة مساعدة',
    'ضعف البصر', 'فقدان البصر', 'عمى', 'ضعف السمع', 'الصمم', 'طرفة أذن',
    'حركة', 'تنقل', 'مشية', 'شلل', 'تلفظ', 'توصيل', 'جهاز تواصل', 'AAC',
    'ذاكرة', 'خرف', 'زهايمر', 'توحد', 'عجز التعلم', 'عصبي', 'عضلي',
    'مساعد', 'مقترح', 'توصية', 'فحص', 'اختبار', 'عرض', 'طلب', 'ابحث', 'ابحث عن',
    'أريد أن أشتري', 'أريد جهاز', 'ما هو الجهاز', 'ما هي المعينات', 'معينات بصرية',
    'معينات سمعية', 'معينات حركية', 'معينات إدراكية', 'معينات تواصل', 'تقنية مساعدة',
    'wheeler', 'hearing aid', 'assistive', 'device', 'product', 'recommend',
    // French - MỞ RỘNG: sản phẩm, triệu chứng, AT, shopping
    'produit', 'appareil', 'dispositif', "siège d'aisance", 'fauteuil roulant',
    'appareil auditif', 'achat', 'prix', 'recommander', 'prothèse', 'orthèse',
    'handicap', 'invalidité', 'déficience', 'malvoyant', 'sourd', 'aveugle',
    'mobilité', 'marche', 'paralysie', 'fauteuil', 'canne', 'béquille', 'déambulateur',
    'trouble de la parole', 'trouble du langage', 'communication', 'AAC',
    'mémoire', 'démence', 'alzheimer', 'autisme', 'tdah', 'dyslexie',
    'aide auditive', 'amplificateur', 'loupe', 'lecteur d\'écran', 'braille',
    'technologie d\'assistance', 'matériel pédagogique', 'appareillage',
    'qu\'est-ce que', 'quel appareil', 'recommandez', 'suggérez', 'proposez',
    'je veux', 'je cherche', 'besoin', 'aide', 'assistance', 'accessibilité',
    'catalogue', 'liste', 'options', 'choix', 'acheter', 'où acheter', 'prix',
    'handicap visuel', 'handicap auditif', 'handicap moteur', 'handicap cognitif',
    'autre produit', 'autre appareil', 'autres options', 'plus d\'options',
    'fauteuils roulants', 'prothèses', 'orthèses', 'aides à la marche',
    'low vision', 'vision loss', 'hearing loss', 'assistive technology',
  ];

  if (productKeywords.some(kw => contentLower.includes(kw))) {
    return true;
  }

  // ⭐⭐ User nhắc ĐÚNG TÊN một sản phẩm có thật trong danh mục MADA
  // (VD "VisionBuddy là gì?", "Giá VisionBuddy bao nhiêu?") → coi như yêu
  // cầu xem sản phẩm đó.
  //
  // VÌ SAO CẦN:
  // Câu hỏi về 1 sản phẩm cụ thể thường chỉ chứa TÊN + "là gì"/"giá bao nhiêu",
  // không trùng từ khóa nào trong danh sách trên. Nếu không có nhánh này,
  // shouldShowProducts trả false → server KHÔNG gửi card → người dùng hỏi
  // riêng 1 sản phẩm thì không bao giờ thấy thẻ sản phẩm có ảnh.
  if (messageMentionsKnownProduct(message)) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra câu hỏi có chứa tên sản phẩm THẬT trong kb_products không.
 *
 * Dùng bộ cache trong RAM (5 phút) + so khớp có ranh giới TỪ để:
 *   • "Bell" KHÔNG khớp "BellBuds"; "Zoom" KHÔNG khớp "ZoomText"
 *   • không tốn query DB mỗi lượt chat
 */
const PRODUCT_NAME_MATCH_CACHE: { expires: number; names: string[] } = {
  expires: 0,
  names: [],
};

function getProductNameTokens(): string[] {
  const now = Date.now();
  if (PRODUCT_NAME_MATCH_CACHE.expires > now) return PRODUCT_NAME_MATCH_CACHE.names;

  try {
    const rows = db.prepare(`
      SELECT title, title_en FROM kb_products
      WHERE status = 'published'
    `).all() as any[];

    const names = new Set<string>();
    for (const r of rows) {
      for (const raw of [r.title, r.title_en]) {
        const name = (raw || '').trim();
        // Bỏ tên quá ngắn ("VN", "ST") vì dễ khớp nhầm với từ thường.
        if (name.length >= 5) names.add(name.toLowerCase());

        // ⭐ Thêm cả TÊN VIẾT TẮT (2 từ đầu) vì người dùng gọi tắt:
        // "Pocket Talker with Headphones or Neck Loop" → "Pocket Talker".
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          const short = words.slice(0, 2).join(' ');
          if (short.length >= 5) names.add(short.toLowerCase());
        }
      }
    }

    PRODUCT_NAME_MATCH_CACHE.names = [...names];
    PRODUCT_NAME_MATCH_CACHE.expires = now + 5 * 60 * 1000;
  } catch (err) {
    console.warn('[shouldShowProducts] Không đọc được danh mục sản phẩm:', err);
    return [];
  }

  return PRODUCT_NAME_MATCH_CACHE.names;
}

/** Chuẩn hoá để so khớp: bỏ ký tự đặc biệt, gộp khoảng trắng, hạ chữ thường. */
function normalizeForProductMatch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[®™©°]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function messageMentionsKnownProduct(message: string): boolean {
  const normalized = normalizeForProductMatch(message);
  if (!normalized) return false;

  const padded = ` ${normalized} `;
  const names = getProductNameTokens().map(normalizeForProductMatch);

  return names.some((name) => {
    if (!name) return false;
    // Tách bằng khoảng trắng → ranh giới từ, tránh "bell" khớp "bellbuds".
    return padded.includes(` ${name} `) || padded.endsWith(` ${name} `) || padded.startsWith(`${name} `);
  });
}

// Language detection
function detectMessageLanguage(message: string): 'vi' | 'en' | 'ar' | 'fr' {
  const text = message || '';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  const viDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (viDiacritics.test(text)) return 'vi';
  const frWords = /\b(je|tu|il|elle|nous|vous|ils|elles|bonjour|merci|oui|non|parce que|s'il vous plaît|désolé|excusez-moi|vous êtes|je suis|estre|être)\b/i;
  if (frWords.test(text)) return 'fr';
  return 'en';
}

function detectAnswerLanguage(answer: string): 'vi' | 'en' | 'ar' | 'fr' | 'unknown' {
  const text = (answer || '').trim();
  if (!text || text.length < 10) return 'unknown';
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicChars / text.length > 0.3) return 'ar';
  const viDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/;
  if (viDiacritics.test(text)) return 'vi';
  const frCommon = /\b(le|la|les|un|une|des|du|de|et|ou|est|sont|avec|pour|sans|dans|sur|sous|tres|aussi|etre|avoir|faire|aller|venir|voir|savoir|prendre|parler)\b/i;
  if ((text.match(frCommon) || []).length >= 2) return 'fr';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'unknown';
}

function isAnswerInExpectedLanguage(answer: string, expectedLang: 'vi' | 'en' | 'ar' | 'fr'): boolean {
  const detected = detectAnswerLanguage(answer);
  if (detected === 'unknown') return true;
  return detected === expectedLang;
}

// Build system instruction
function getSystemInstruction(
  lang: string,
  agentPrompt?: string,
  userMode: 'endUser' | 'specialist' = 'endUser',
  agentId?: string
): string {
  return buildSystemPrompt(lang, userMode, agentPrompt, agentId);
}

// Parse detailed metadata from knowledge item
function parseDetailedMetadata(meta: any): any {
  if (!meta) return {};
  
  // If metadata is a string, parse it
  const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
  
  return {
    patient_indications: parsed.patient_indications || parsed.medicalIndications || [],
    medical_indications: parsed.medical_indications || parsed.clinicalIndications || [],
    contraindications: parsed.contraindications || [],
    specifications: parsed.specifications || [],
    compatibility: parsed.compatibility || [],
    financial_support: parsed.financial_support || parsed.fundingOptions || [],
    insurance_coverage: parsed.insurance_coverage || [],
    mada_advice: parsed.mada_advice || parsed.expertAdvice || '',
    warranty: parsed.warranty || '',
    features: parsed.features || parsed.keyFeatures || [],
    standards: parsed.standards || [],
    rating: parsed.rating || 0,
    review_count: parsed.review_count || parsed.reviewCount || 0,
    availability: parsed.availability || '',
  };
}

// Extract structured data from content using regex patterns
function extractStructuredDataFromContent(content: string, lang: string): any {
  const result: any = {
    patient_indications: [],
    medical_indications: [],
    specifications: [],
    compatibility: [],
    financial_support: [],
    insurance_coverage: [],
  };
  
  if (!content) return result;
  
  // Language-specific patterns
  const patterns: Record<string, Record<string, RegExp[]>> = {
    vi: {
      patient_indications: [
        /chỉ định cho[:\s]*(.+?)(?:\n|$|•)/gi,
        /phù hợp với[:\s]*(.+?)(?:\n|$|•)/gi,
        /dành cho[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
      specifications: [
        /thông số[:\s]*(.+?)(?:\n|$|•)/gi,
        /kích thước[:\s]*(.+?)(?:\n|$|•)/gi,
        /trọng lượng[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
      financial_support: [
        /hỗ trợ tài chính[:\s]*(.+?)(?:\n|$|•)/gi,
        /bảo hiểm[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
    },
    en: {
      patient_indications: [
        /indicated for[:\s]*(.+?)(?:\n|$|•)/gi,
        /suitable for[:\s]*(.+?)(?:\n|$|•)/gi,
        /for patients[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
      specifications: [
        /specifications[:\s]*(.+?)(?:\n|$|•)/gi,
        /dimensions[:\s]*(.+?)(?:\n|$|•)/gi,
        /weight[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
      financial_support: [
        /financial support[:\s]*(.+?)(?:\n|$|•)/gi,
        /insurance[:\s]*(.+?)(?:\n|$|•)/gi,
      ],
    },
  };
  
  const langPatterns = patterns[lang] || patterns.vi;
  
  // Extract patient indications
  for (const pattern of langPatterns.patient_indications || []) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const items = match[1].split(/[,;•|]/).map((s: string) => s.trim()).filter(Boolean);
      result.patient_indications.push(...items);
    }
  }
  
  // Extract specifications
  for (const pattern of langPatterns.specifications || []) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const items = match[1].split(/[,;•|]/).map((s: string) => s.trim()).filter(Boolean);
      result.specifications.push(...items.map((v: string) => ({ label: 'Thông số', value: v })));
    }
  }
  
  // Extract financial support
  for (const pattern of langPatterns.financial_support || []) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const items = match[1].split(/[,;•|]/).map((s: string) => s.trim()).filter(Boolean);
      result.financial_support.push(...items);
    }
  }
  
  // Deduplicate arrays
  result.patient_indications = [...new Set(result.patient_indications)].slice(0, 5);
  result.specifications = result.specifications.slice(0, 5);
  result.financial_support = [...new Set(result.financial_support)].slice(0, 5);
  
  return result;
}

// Get suggested products from RAG sources (and agent category if specified)
async function getSuggestedProducts(ragSources: any[], message: string, effectiveLanguage: string, agentId?: string, shownProductIds: string[] = [], isAskingForOtherProducts: boolean = false): Promise<any[]> {
  let suggestedProducts: any[] = [];

  // ⭐ FEATURE 1: Try to detect a SPECIFIC product name from user message FIRST
  // If user mentions "Victor Reader", "OrCam", etc. → return ONLY that product
  const specificProduct = findProductByMessage(message, effectiveLanguage, agentId);
  if (specificProduct) {
    // ⭐ Nếu sản phẩm này đã hiển thị rồi → tìm sản phẩm KHÁC CÙNG LOẠI.
    // ⚠️ KHÔNG được rơi xuống nhánh list 12 sản phẩm bên dưới (bot-regulatory
    // luôn kéo tất cả) — khách hàng hỏi 1 sản phẩm mà thấy 12 card là rối.
    if (shownProductIds.includes(specificProduct.id)) {
      return (await findSimilarProducts(specificProduct, effectiveLanguage, 3, shownProductIds))
        .map((p) => ({ ...p, isSpecificProduct: true }));
    }
    return [{ ...specificProduct, isSpecificProduct: true }];
  }

  // ⭐ CRITICAL: Get agent's MADA category - lookup từ DB TRƯỚC, fallback sang hardcoded mapping
  // bot-regulatory (Thông tin bổ trợ) có quyền xem TẤT CẢ sản phẩm
  // Các bot khác chỉ xem sản phẩm thuộc category của mình
  let agentCategory: string | null = null;
  let agentBotId: string | null = null;
  let isRegulatoryBot = false;
  
  if (agentId) {
    // Bước 1: Lookup từ database (agentId là UUID)
    try {
      const agentRow = db.prepare('SELECT bot_id, mada_category, name FROM admin_agents WHERE id = ?').get(agentId) as any;
      if (agentRow) {
        agentBotId = agentRow.bot_id || null;
        agentCategory = agentRow.mada_category || null;
        const agentName = (agentRow.name || '').toLowerCase();
        // Check if this is the regulatory/education bot (Thông tin bổ trợ)
        isRegulatoryBot = agentBotId === 'bot-regulatory' || 
                         agentName.includes('regulatory') || 
                         agentName.includes('thông tin bổ trợ') ||
                         agentName.includes('education') ||
                         agentName.includes('standard');

      }
    } catch (err) {
      console.warn('⚠️ [getSuggestedProducts] DB lookup failed:', err);
    }
    
    // Bước 2: Fallback sang hardcoded AGENT_TO_MADA mapping
    if (!agentCategory && agentId) {
      const madaMapping = AGENT_TO_MADA[agentId];
      if (madaMapping) {
        agentCategory = madaMapping.madaCategory;
        agentBotId = madaMapping.botId;
        isRegulatoryBot = agentId === 'bot-regulatory';
      }
    }
  }

  // ⭐ Map MADA category slug → kb_products.category (products store MADA slugs directly)
  // e.g. 'mobility-and-transportation' → 'mobility-and-transportation'
  // ⭐ IMPORTANT: Lưu original MADA category TRƯỚC KHI mapping để dùng trong specific checks
  const originalMadaCategory = agentCategory;
  if (agentCategory && MADA_CATEGORY_TO_DB[agentCategory]) {
    const mapped = MADA_CATEGORY_TO_DB[agentCategory];

    agentCategory = mapped;
  }

  // ⭐ CHAT TỔNG QUÁT (không có agent): suy luận category từ câu hỏi.
  // Không có bước này thì lấy sản phẩm từ MỌI category → ra sản phẩm không
  // liên quan (VD: hỏi "máy trợ thính" lại ra "Dragon Professional", "Smyle Mouse").
  let inferredCategory: string | null = null;
  if (!agentCategory && !isRegulatoryBot) {
    inferredCategory = inferProductCategory(message);
    if (inferredCategory) {
      agentCategory = inferredCategory;
      console.log(
        `[getSuggestedProducts] Inferred category "${inferredCategory}" from user message`
      );
    }
  }

  // ⭐ Bot Thông tin bổ trợ được xem TẤT CẢ sản phẩm, các bot khác bị giới hạn theo category
  const shouldFilterByCategory = !isRegulatoryBot && agentCategory !== null;

  // ⭐⭐ DANH SÁCH CATEGORY CẦN QUÉT (nhiều hơn 1).
  //
  // VÌ SAO CẦN:
  // `kb_products.category` chỉ lưu MỘT category (lúc scrape), nên sản phẩm
  // RIÊNG của bot có thể nằm ở category KHÁC category chính của bot:
  //
  //   GEWA Control Prog       → category = `mobility`  (Bot 6 – Di chuyển)
  //   Primo+ Environment C.   → category = `mobility`  (Bot 6 – Di chuyển)
  //   Housemate               → category = `mobility`  (Bot 6 – Di chuyển)
  //   Power Link 4            → category = `mobility`  (Bot 6 – Di chuyển)
  //
  // → Query `WHERE category = 'daily_living'` (category chính của Bot 6) LOI
  //   mất 4 sản phẩm RIÊNG của Bot 6 → card chỉ hiện sản phẩm của bot khác.
  //
  // → Quét NHIỀU category (theo `productCategoriesForBot()`), rồi lọc chính
  //   xác bằng taxonomy + bảng chủ sở hữu (đã có ở phía dưới).
  const scanCategories: string[] = (() => {
    if (isRegulatoryBot) return [];
    const cats = productCategoriesForBot(agentBotId, originalMadaCategory);
    const set = new Set<string>();
    if (agentCategory) set.add(agentCategory);
    for (const c of cats) if (c) set.add(c);
    return [...set];
  })();



  // Helper: Check if URL is valid for product
  const isValidProductUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('manual:')) return false;
    if (url.startsWith('bot-') || url.startsWith('agent-')) return false;
    if (!url.startsWith('http')) return false;
    return true;
  };
  
  // Helper: Check if title is a bot/knowledge base entry (not a real product)
  //
  // ⚠️ KB entry của chính hệ thống (agent) hay bị lẫn vào danh sách sản phẩm vì
  // query lấy chung bảng knowledge_items với sản phẩm đã scrape. Title của các
  // entry này theo mẫu "Bot 1: Sensory – Hearing — KB" (hoặc "... — KB"),
  // "Regulatory & Standards — KB"… — đều là TRANG BOT, không phải thiết bị,
  // nhưng lại có url http hợp lệ nên các filter khác không loại được.
  const isBotEntry = (title: string): boolean => {
    if (!title) return false;
    const lower = title.toLowerCase();
    if (lower.includes('bot ') && lower.includes('kiến thức')) return true;
    if (lower.includes('regulatory & standards')) return true;
    if (lower.includes('bot ') && lower.includes('knowledge')) return true;
    // Mẫu "Bot 1: ... — KB" / "Bot 2 ... - KB": bắt theo cả hai vế
    if (/\bbot\s*\d*\s*[:\-–—]/.test(lower)) return true;
    // Kết thúc bằng "— KB" / "- KB" (nguồn MADA Knowledge Base)
    if (/[—–-]\s*kb\b/.test(lower)) return true;
    return false;
  };
  
  // Helper: Check if text contains AT (Assistive Technology) keywords
  const hasValidATKeywords = (text: string): boolean => {
    const lower = text.toLowerCase();
    const atKeywords = [
      'wheelchair', 'xe lăn', 'máy trợ', 'hearing', 'vision', 'braille', 'aac',
      'speech', 'communication', 'mobility', 'cognitive', 'assistive', 'disability',
      'prosthetic', 'orthotic', 'hearing aid', 'screen reader', 'magnifier',
      'người khuyết tật', 'công nghệ hỗ trợ', 'thiết bị hỗ trợ',
    ];
    return atKeywords.some(kw => lower.includes(kw));
  };
  
  // Helper: Get full product data from knowledge_items table
  const getProductFromDb = (productUrl: string): any => {
    if (!productUrl) return null;
    try {
      // Normalize URL (remove trailing slash)
      const normalizedUrl = productUrl.replace(/\/$/, '');
      
      // Try to find in knowledge_items by url (exact and normalized)
      const item = db.prepare(`
        SELECT * FROM knowledge_items 
        WHERE status = 'published' AND source_type = 'web'
          AND (url = ? OR url = ? OR source = ? OR source = ?)
        LIMIT 1
      `).get(normalizedUrl, productUrl, normalizedUrl, productUrl) as any;
      if (item) {

        return knowledgeItemToProduct(item, effectiveLanguage);
      }

    } catch (e) { 
      console.warn('[getProductFromDb] DB error:', (e as Error).message);
    }
    return null;
  };
  
  // Helper: Directly get product by title from knowledge_items
  const getProductByTitle = (title: string): any => {
    if (!title) return null;
    try {
      // Try exact match first
      let item = db.prepare(`
        SELECT * FROM knowledge_items 
        WHERE status = 'published' AND source_type = 'web'
          AND (title = ? OR title_en = ?)
        LIMIT 1
      `).get(title, title) as any;
      
      // Try partial match
      if (!item) {
        item = db.prepare(`
          SELECT * FROM knowledge_items 
          WHERE status = 'published' AND source_type = 'web'
            AND (title LIKE ? OR title_en LIKE ?)
          LIMIT 1
        `).get(`%${title}%`, `%${title}%`) as any;
      }
      
      // Try matching with special chars removed
      if (!item) {
        const cleanTitle = title.replace(/[®™©°]/g, '').trim();
        item = db.prepare(`
          SELECT * FROM knowledge_items 
          WHERE status = 'published' AND source_type = 'web'
            AND (title LIKE ? OR title_en LIKE ?)
          LIMIT 1
        `).get(`%${cleanTitle}%`, `%${cleanTitle}%`) as any;
      }
      
      if (item) {

        return knowledgeItemToProduct(item, effectiveLanguage);
      }

    } catch (e) { 
      console.warn('[getProductByTitle] DB error:', (e as Error).message);
    }
    return null;
  };
  
  // Strategy 1: From RAG sources
  if (ragSources.length > 0) {

    const sourceUrls = ragSources.slice(0, 8).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);

    let dbDataMap: Record<string, any> = {};
    
    // Helper: normalize URL (remove trailing slash)
    const normalizeUrl = (url: string) => url?.replace(/\/$/, '') || '';
    
    if (sourceUrls.length > 0) {
      try {
        // Lookup knowledge_items by URL (exact match and with trailing slash removed)
        // NOTE: We only remove trailing slash for matching, NOT all slashes
        const placeholders = sourceUrls.map(() => '?').join(',');
        const rows = db.prepare(`
          SELECT id, title, content, source, url, category, language, metadata
          FROM knowledge_items
          WHERE url IN (${placeholders}) OR source IN (${placeholders})
        `).all(...sourceUrls, ...sourceUrls) as any[];
        
        // Also try with trailing slash removed for both
        const normalizedSourceUrls = sourceUrls.map(url => url.replace(/\/$/, ''));
        const normalizedPlaceholders = normalizedSourceUrls.map(() => '?').join(',');
        const normalizedRows = db.prepare(`
          SELECT id, title, content, source, url, category, language, metadata
          FROM knowledge_items
          WHERE url IN (${normalizedPlaceholders}) OR source IN (${normalizedPlaceholders})
        `).all(...normalizedSourceUrls, ...normalizedSourceUrls) as any[];
        
        // Merge all rows
        const allRows = [...rows, ...normalizedRows];
        const seen = new Set<string>();
        
        for (const row of allRows) {
          const key = row.url || row.source || '';
          if (key && !seen.has(key)) {
            seen.add(key);
            dbDataMap[key] = row;
            dbDataMap[normalizeUrl(key)] = row; // Also store normalized
          }
        }
        

      } catch (e) { 
        console.error('[getSuggestedProducts] knowledge_items lookup error:', (e as Error).message);
      }
    }
    
    suggestedProducts = ragSources.slice(0, 8).map((src: any, idx: number) => {
      const meta = src.metadata || {};
      const rawSourceUrl = meta.source || meta.url || src.source || '';
      const sourceUrl = normalizeUrl(rawSourceUrl);
      const dbItem = dbDataMap[sourceUrl] || dbDataMap[rawSourceUrl] || {};
      
      // Get thumbnail: try metadata first (thumbnailUrl OR image_url), then kb_products table
      let thumbnail = meta.thumbnailUrl || meta.image_url || '';



      // Also get full product data from kb_products for additional fields
      // ⭐ LUÔN ƯU TIÊN URL từ kb_products nếu có, ngược lại dùng URL từ database hoặc metadata
      let kbProduct = getProductFromDb(dbItem.url || sourceUrl || meta.productUrl || '');


      // Fallback: try to find by title if URL lookup failed
      if (!kbProduct && meta.title) {

        kbProduct = getProductByTitle(meta.title);
      }

      // Get the final URL after we know if kbProduct exists
      const finalProductUrl = kbProduct?.source_url || kbProduct?.product_url || dbItem.url || sourceUrl || meta.productUrl || '';

      if (kbProduct) {

        // ⭐ FIX: Ưu tiên kbProduct.image_url, fallback về metadata thumbnailUrl
        thumbnail = kbProduct.image_url || thumbnail || '';
      } else {

        // Nếu không có kbProduct, vẫn giữ thumbnail từ metadata
        thumbnail = thumbnail || '';
      }



      // Parse detailed metadata
      const detailedMeta = parseDetailedMetadata(meta);
      const dbDetailedMeta = parseDetailedMetadata(dbItem.metadata);

      // Extract structured data from content
      const contentData = extractStructuredDataFromContent(src.content || '', effectiveLanguage);

      // Merge all data sources (kbProduct has priority for brand, price, etc.)
      const merged = {
        ...detailedMeta,
        ...dbDetailedMeta,
        ...contentData,
        brand: kbProduct?.brand || detailedMeta.brand || dbDetailedMeta.brand || 'MADA Qatar AT Portal',
        price_range: kbProduct?.price_range || detailedMeta.price_range || dbDetailedMeta.price_range || 'Contact MADA Center',
      };

      // Build full product object
      // Use actual image from MADA only - NO picsum fallback
      const actualImage = toProxyImageUrl(thumbnail);
      const image_url = actualImage || '';

      // ⭐ FIX: Get product ID - use dbItem.id or kbProduct.id or generate from URL
      const productId = kbProduct?.id || dbItem.id || `rag-${idx}`;

      return {
        id: productId,
        title: kbProduct?.title || meta.title || dbItem.title || 'Assistive Technology',
        title_en: kbProduct?.title_en || meta.title_en || meta.title || dbItem.title || 'Assistive Technology',
        description: kbProduct?.description || (src.content || dbItem.content || '').slice(0, 300),
        category: kbProduct?.category || dbItem.category || 'general',
        brand: merged.brand,
        price_range: merged.price_range,
        product_url: finalProductUrl,
        source_url: finalProductUrl,
        image_url,
        confidence: src.score || 0.7,
        match_reason: getMatchReason(effectiveLanguage, 'found'),
        // Detailed fields
        patient_indications: merged.patient_indications?.length > 0 ? merged.patient_indications : [],
        medical_indications: merged.medical_indications?.length > 0 ? merged.medical_indications : [],
        contraindications: merged.contraindications || [],
        specifications: merged.specifications?.length > 0 ? merged.specifications : [],
        compatibility: merged.compatibility || [],
        financial_support: merged.financial_support?.length > 0 ? merged.financial_support : [],
        insurance_coverage: merged.insurance_coverage || [],
        mada_advice: merged.mada_advice || '',
        warranty: merged.warranty || '',
        features: merged.features || [],
        standards: merged.standards || [],
        rating: merged.rating || 0,
        review_count: merged.review_count || 0,
        availability: merged.availability || '',
      };
    });

    // ⭐ Filter out already-shown products AND invalid products
    suggestedProducts = suggestedProducts.filter((p: any) => {
      // ⭐ EXCLUDE already-shown products
      if (shownProductIds.includes(p.id)) return false;
      
      const botCheck = isBotEntry(p.title);
      const urlCheck = isValidProductUrl(p.product_url);
      // Filter out garbage titles (repeated chars like "kkkk", "aaaa", etc.)
      const titleLower = (p.title || '').toLowerCase();
      const garbageTitle = /^(.)\1{3,}$/.test(titleLower); // 4+ same chars repeated
      // ⭐ Filter out non-AT products (category = 'general' without valid AT-related content)
      const isNonATCategory = (p.category || '').toLowerCase() === 'general';
      // ⭐ Filter out products from non-AT websites (e-commerce, cosmetics, etc.)
      const nonATDomains = ['hasaki.vn', 'thegioididong.com', 'cellphones.com.vn', 'fptshop.com.vn',
                           'dienmayxanh.com', 'tiki.vn', 'lazada.vn', 'shopee.vn', 'youtube.com',
                           'facebook.com', 'tiktok.com', 'instagram.com'];
      const productUrl = (p.product_url || p.source_url || '').toLowerCase();
      const isFromNonATSite = nonATDomains.some(domain => productUrl.includes(domain));
      // ⭐ Filter out products with generic titles
      const genericTitles = ['sản phẩm về da', 'sản phẩm công nghệ', 'thế giới di động', 'cổng thông tin'];
      const isGenericTitle = genericTitles.some(t => titleLower.includes(t));





      if (botCheck) return false;
      if (!urlCheck) return false;
      if (garbageTitle) return false;
      if (isNonATCategory && !hasValidATKeywords(titleLower)) return false;
      if (isFromNonATSite) return false;
      if (isGenericTitle) return false;

      // ⭐ STRATEGY 1 CATEGORY FILTER: Mỗi bot chỉ hiển thị sản phẩm thuộc category của mình
      // bot-regulatory (Thông tin bổ trợ) KHÔNG bị filter - được xem TẤT CẢ sản phẩm
      // ⭐ CRITICAL FIX: Dùng originalMadaCategory (chưa map) cho specific checks vì agentCategory đã bị remap rồi!
      if (shouldFilterByCategory && agentCategory) {
        const productCategory = (p.category || '').toLowerCase();
        const catLower = agentCategory.toLowerCase();
        let categoryMatch =
          productCategory.includes(catLower) ||
          (originalMadaCategory === 'sensory-hearing' && productCategory.includes('hearing')) ||
          (originalMadaCategory === 'sensory-vision' && productCategory.includes('vision')) ||
          (originalMadaCategory === 'voice-and-speech' && (
            productCategory.includes('voice') ||
            productCategory.includes('speech') ||
            productCategory.includes('communication') ||
            productCategory.includes('aac')
          )) ||
          (originalMadaCategory === 'mobility-and-transportation' && (
            productCategory.includes('mobility') ||
            productCategory.includes('physical')
          )) ||
          (originalMadaCategory === 'mental-cognitive' && (
            productCategory.includes('cognitive') ||
            productCategory.includes('mental')
          )) ||
          (originalMadaCategory === 'neuromusculoskeletal-movement' && (
            productCategory.includes('neuro') ||
            productCategory.includes('musculoskeletal')
          ));
        if (!categoryMatch) {

          return false;
        }
      }

      // ⭐⭐⭐ CHỦ SỞ HỮU CHÍNH (BẢNG MADA) — chặn sản phẩm của bot KHÁC.
      //
      // VÌ SAO CẦN:
      // MADA khai sản phẩm thuộc NHIỀU danh mục, nên lọc theo category thô
      // vẫn để lọt sản phẩm thuộc chuyên môn bot khác (VD bot-mobility dẫn
      // đầu bằng Tobii PCEye 5 — thiết bị nhập liệu thay thế của Bot 5).
      //
      // → Sản phẩm mà bot này KHÔNG phải chủ sở hữu chính VÀ không nằm trong
      //   danh mục MADA của bot này → loại.
      const owner = primaryOwnerForProduct(p.product_url || p.source_url);
      if (owner && agentBotId && !isRegulatoryBot) {
        p.isPrimaryOwner = owner === agentBotId;
        if (
          owner !== agentBotId &&
          !productBelongsToBot(p.product_url || p.source_url, agentBotId)
        ) {
          return false;
        }
      }

      return true;
    });
    

  }
  
  // ⭐ FIX: CHỈ gợi ý sản phẩm từ RAG sources - KHÔNG fallback random
  // Strategy 2 và 3 đã bị disable vì nó gợi ý sản phẩm không liên quan
  
  // ⭐ CRITICAL FIX: Đối với regulatory bot (Thông tin bổ trợ), LUÔN lấy TẤT CẢ sản phẩm từ database
  // vì RAG sources chỉ chứa sản phẩm từ 1 category duy nhất
  // Đối với các bot thường: fallback như bình thường
  const hasEnoughProducts = suggestedProducts.length >= 3;
  // ⭐ QUY TẮC MỚI: Nếu câu hỏi nhắc rõ 1 SẢN PHẨM CỤ THỂ thì chỉ được
  // hiện sản phẩm đó — TUYỆT ĐỐI KHÔNG list thêm sản phẩm khác.
  //
  // LÝ DO: Bot "Thông tin bổ trợ" (bot-regulatory) có `needsAllProducts = true`
  // nên trước đây LUÔN kéo 12 sản phẩm bất kể user hỏi gì. Khách hàng hỏi
  // "VisionBuddy là gì?" lại thấy 12 card → rối mắt, không ra sản phẩm họ hỏi.
  //
  // → Chặn fallback list hàng loạt; chỉ trả về đúng sản phẩm đã nhận diện.
  const askingSpecificProduct = !!specificProduct;
  const needsAllProducts = isRegulatoryBot && !askingSpecificProduct;

  if (!askingSpecificProduct && (needsAllProducts || suggestedProducts.length < 3)) {


    // Fetch directly from kb_products by category (or all if regulatory bot)
    try {
      let dbQuery: string;
      let dbParams: any[] = [];

      // ⭐ Build exclusion clause for already-shown products
      // Fix: Exclude by id AND url to catch ALL shown products (kb_products + scraped + knowledge_items)
      let excludeClause = '';
      const excludeIds = shownProductIds.filter((id: any) => id);
      if (excludeIds.length > 0) {
        const idPlaceholders = excludeIds.map(() => '?').join(',');
        const urlPlaceholders = excludeIds.map(() => '?').join(',');
        excludeClause = `AND id NOT IN (${idPlaceholders}) AND product_url NOT IN (SELECT product_url FROM kb_products WHERE id IN (${urlPlaceholders}))`;
        dbParams = [...excludeIds, ...excludeIds];
      }

      // ⭐ LIMIT: Always 12, let excludeClause handle deduplication (OFFSET was broken with category filter)
      const LIMIT = 12;

      if (isRegulatoryBot) {
        // ⭐ Regulatory bot: LẤY TẤT CẢ sản phẩm từ TẤT CẢ categories
        dbQuery = `
          SELECT * FROM kb_products
          WHERE status IN ('draft', 'published', 'archived')
          AND image_url IS NOT NULL AND image_url != ''
          ${excludeClause}
          ORDER BY category ASC, featured DESC, created_at DESC
          LIMIT ${LIMIT}
        `;

      } else if (shouldFilterByCategory && scanCategories.length > 0) {
        // Các bot THƯỜNG: quét TẤT CẢ category mà bot quét được (có thể > 1),
        // rồi lọc chính xác bằng taxonomy + bảng chủ sở hữu ở filter bên dưới.
        //
        // ⚠️ KHÔNG dùng `WHERE category = ?` với 1 category duy nhất:
        // sản phẩm RIÊNG của bot-mobility (GEWA Control Prog, Housemate,
        // Power Link 4, Primo+) đều nằm ở category `mobility`, trong khi
        // category chính của bot là `daily_living` → query cũ loi mất sạch.
        const catPlaceholders = scanCategories.map(() => '?').join(',');

        // ⭐⭐ ƯU TIÊN SẢN PHẨM RIÊNG CỦA BOT TRONG SQL.
        //
        // VÌ SAO CẦN:
        // Category `mobility` chứa 109 sản phẩm (đa số của Bot 5). Nếu chỉ
        // `ORDER BY featured DESC, created_at DESC LIMIT 12`, 4 sản phẩm RIÊNG
        // của Bot 6 (GEWA Control Prog, Primo+, Housemate, Power Link 4) — vốn
        // có `created_at` cũ hơn, `featured = 0` — bị cắt khỏi LIMIT → Bot 6
        // chỉ còn 1 sản phẩm riêng dù DB có đủ 6.
        //
        // → `CASE WHEN product_url IN (...) THEN 0 ELSE 1 END` đưa sản phẩm
        //   RIÊNG của bot lên đầu NGAY TRONG DB → luôn nằm trong LIMIT.
        const ownedUrls = ownedProductUrlsForBot(agentBotId);
        let ownedOrder = '';
        let ownedParams: string[] = [];
        if (ownedUrls.length > 0) {
          const ownedPlaceholders = ownedUrls.map(() => '?').join(',');
          ownedOrder = `CASE WHEN product_url IN (${ownedPlaceholders}) THEN 0 ELSE 1 END, `;
          ownedParams = ownedUrls;
        }

        dbQuery = `
          SELECT * FROM kb_products
          WHERE category IN (${catPlaceholders})
          AND status IN ('draft', 'published', 'archived')
          AND image_url IS NOT NULL AND image_url != ''
          ${excludeClause}
          ORDER BY ${ownedOrder}featured DESC, created_at DESC
          LIMIT ${LIMIT}
        `;
        // ⭐ Thứ tự tham số `?` PHẢI theo thứ tự xuất hiện trong SQL:
        //   1) `category IN (...)`          → scanCategories
        //   2) `${excludeClause}` (WHERE)   → excludeIds × 2
        //   3) `CASE WHEN product_url IN (...)` (ORDER BY) → ownedUrls
        dbParams = [...scanCategories, ...dbParams, ...ownedParams];

      } else {
        // Không có category → lấy tất cả từ kb_products
        dbQuery = `
          SELECT * FROM kb_products
          WHERE status IN ('draft', 'published', 'archived')
          AND image_url IS NOT NULL AND image_url != ''
          ${excludeClause}
          ORDER BY featured DESC, created_at DESC
          LIMIT ${LIMIT}
        `;

      }

      const dbProducts = db.prepare(dbQuery).all(...dbParams) as any[];


      // Map kb_products rows to product format using helper
      const mappedDbProducts: any[] = dbProducts.map((row: any) => kbProductToProduct(row, effectiveLanguage));

      // Filter mapped products
      const filteredDbProducts = mappedDbProducts.filter((p: any) => {
        // ⭐ EXCLUDE already-shown products
        if (shownProductIds.includes(p.id)) return false;

        // Phải có image_url hợp lệ (http OR proxy URL /api/mada-image)
        const hasImage = !!(p.image_url && (p.image_url.startsWith('http') || p.image_url.startsWith('/api/mada-image')));
        // URL phải là http(s)
        const url = p.product_url || '';
        const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
        // Không phải bot entry
        const isBot = isBotEntry(p.title);
        // Title không phải garbage
        const titleLower = (p.title || '').toLowerCase();
        const isGarbageTitle = /^(.)\1{3,}$/.test(titleLower) || /^(test|test123|abcd|qwerty)/i.test(titleLower);

        // ⭐ Category matching - MỖI BOT chỉ thấy sản phẩm thuộc danh mục của mình
        // bot-regulatory (Thông tin bổ trợ) KHÔNG bị filter - được xem TẤT CẢ sản phẩm
        // ⭐ CRITICAL FIX: Dùng originalMadaCategory (chưa map) cho specific checks
        let categoryMatch = true;
        if (shouldFilterByCategory && agentCategory) {
          const productCategory = (p.category || '').toLowerCase();
          const catLower = agentCategory.toLowerCase();
          categoryMatch =
            productCategory.includes(catLower) ||
            // ⭐ Chấp nhận MỌI category bot được phép quét (vd bot-mobility quét
            // cả `daily_living` + `mobility` → không bỏ sót sản phẩm RIÊNG của bot
            // đang nằm ở category khác).
            scanCategories.some((c) => c && productCategory.includes(c.toLowerCase())) ||
            (originalMadaCategory === 'sensory-hearing' && productCategory.includes('hearing')) ||
            (originalMadaCategory === 'sensory-vision' && productCategory.includes('vision')) ||
            (originalMadaCategory === 'voice-and-speech' && (
              productCategory.includes('voice') ||
              productCategory.includes('speech') ||
              productCategory.includes('communication') ||
              productCategory.includes('aac')
            )) ||
            (originalMadaCategory === 'mobility-and-transportation' && (
              productCategory.includes('mobility') ||
              productCategory.includes('physical')
            )) ||
            (originalMadaCategory === 'mental-cognitive' && (
              productCategory.includes('cognitive') ||
              productCategory.includes('mental')
            )) ||
            (originalMadaCategory === 'neuromusculoskeletal-movement' && (
              productCategory.includes('neuro') ||
              productCategory.includes('musculoskeletal')
            ));

        }

        // ⭐⭐⭐ CHỦ SỞ HỮU CHÍNH (BẢNG MADA) — ưu tiên sản phẩm RIÊNG của bot.
        //
        // VÌ SAO CẦN:
        // MADA khai sản phẩm thuộc NHIỀU danh mục, nên `kb_products.category`
        // chỉ giữ 1 category → lọc theo category vẫn để lọt sản phẩm của bot
        // khác. Ví dụ bot-mobility (category `daily_living`) dẫn đầu bằng
        // Tobii PCEye 5 / Quha Dwell (thiết bị nhập liệu thay thế → Bot 5) và
        // eSight 4 (thị giác → Bot 2) → tư vấn lệch hoàn toàn.
        //
        // → Sản phẩm mà bot này là CHỦ SỞ HỮU CHÍNH (`mada-product-owners.json`)
        //   được ưu tiên; sản phẩm thuộc CHÍNH một bot khác thì bị loại (trừ
        //   khi MADA cũng xếp nó vào danh mục của bot này → đa nhãn hợp lệ).
        const owner = primaryOwnerForProduct(p.product_url || p.source_url);
        if (owner && agentBotId) {
          p.isPrimaryOwner = owner === agentBotId;
          if (
            owner !== agentBotId &&
            !productBelongsToBot(p.product_url || p.source_url, agentBotId)
          ) {
            return false;
          }
        }

        return hasImage && isValidUrl && !isBot && !isGarbageTitle && categoryMatch;
      });



      // ⭐ THÊM filteredDbProducts vào suggestedProducts (tránh trùng lặp)
      for (const p of filteredDbProducts) {
        const exists = suggestedProducts.some(
          (sp: any) => sp.product_url === p.product_url || sp.source_url === p.source_url || sp.title === p.title
        );
        if (!exists) {
          suggestedProducts.push(p);
        }
      }

    } catch (err) {
      console.warn('⚠️ [getSuggestedProducts] DB fetch error:', err);
    }
  }
  

  // ⭐ HỎI VỀ SẢN PHẨM CỤ THỂ → chỉ trả về ĐÚNG sản phẩm đó (không kèm
  // sản phẩm khác). Đây là chốt chặn cuối: dù nhánh nào chạy trước, danh
  // sách cũng chỉ còn tối đa 1 sản phẩm → giao diện gọn, dễ đọc.
  if (askingSpecificProduct) {
    return [{ ...specificProduct, isSpecificProduct: true }];
  }

  // ⭐⭐ XẾP HẠNG: sản phẩm RIÊNG của bot (chủ sở hữu chính) đứng đầu.
  //
  // VÌ SAO CẦN:
  // Bot 5 và Bot 6 đều quét category `mobility` + `daily_living`. Nếu không
  // xếp hạng, thứ tự DB (`featured DESC, created_at DESC`) có thể đưa sản
  // phẩm đa nhãn của bot khác lên đầu → bot-mobility dẫn đầu bằng
  // eSight 4 (thị giác) thay vì gậy thông minh / bộ điều khiển môi trường.
  if (agentBotId && !isRegulatoryBot) {
    suggestedProducts.sort((a: any, b: any) => {
      const ao = primaryOwnerForProduct(a.product_url || a.source_url);
      const bo = primaryOwnerForProduct(b.product_url || b.source_url);
      const aMine = ao === agentBotId ? 1 : 0;
      const bMine = bo === agentBotId ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return 0;
    });
  }

  // ⭐ Regulatory bot: trả về nhiều hơn (12), các bot thường: 6
  const MAX_PRODUCTS = isRegulatoryBot ? 12 : 6;
  return suggestedProducts.slice(0, MAX_PRODUCTS);
}

router.post('/', async (req, res) => {
  try {
    const {
      message,
      conversationId,
      language: uiLanguage = 'vi',
      agentId,
      agentPrompt,
      userMode,
      missingContext = [],
      isReadyForProductSuggestion = false,
      conversationTurns = 0,
      // ⭐ NEW: Các tham số kiểm soát việc hiển thị sản phẩm
      triggersProductSuggestion = false,
      followUpQuestionsAsked = 0,
      shouldShowProductsNow = false,
      isInQuestionGatheringMode = false,
      userApprovedProducts = false,
      // ⭐ MỚI: Track sản phẩm đã hiển thị để không lặp lại
      shownProductIds = [],
    } = req.body;

    // ⭐ Detect nếu user hỏi về "sản phẩm khác" / "other products"
    const messageLower = (message || '').toLowerCase();
    const isAskingForOtherProducts = /((còn|co|khác|other|another|more|another)|(sản phẩm|sp|thiết bị|product|device)(khác|else|more|additional)|(có|gì|có gì)(khác|else|nữa|more)|(list|show|hiển thị|gợi ý)(thêm|more|additional)|more products|more devices|more options|additional products)/i.test(messageLower);

    // ⭐ Smart product suggestion: chỉ gợi ý sản phẩm khi đã đủ context
    // ⭐ NEW LOGIC: Chỉ suggest products khi:
    // 1. user đã approve (userApprovedProducts = true) VÀ
    // 2. Đã hỏi đủ câu hỏi (followUpQuestionsAsked >= 3) VÀ
    // 3. Message trigger product suggestion
    // HOẶC fallback: isReadyForProductSuggestion OR conversationTurns >= 3 OR isExplicitProductRequest
    const shouldSuggestProducts = (
      (userApprovedProducts && followUpQuestionsAsked >= 3 && triggersProductSuggestion) ||
      shouldShowProductsNow ||
      isReadyForProductSuggestion ||
      isExplicitProductRequest(message) ||
      conversationTurns >= 3
    );


    const detectedLanguage = detectMessageLanguage(message);
    // ⭐ Ưu tiên detect từ message - nếu người dùng hỏi tiếng Anh thì reply tiếng Anh
    const effectiveLanguage = uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage) ? uiLanguage : detectedLanguage;
    

    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const safetyScore = 100;
    
    // ⭐ AUTO-SCRAPE URLS: Nếu message chứa URL, tự động scrape và trả về product cards
    const { scrapedProducts, cleanedMessage } = await autoScrapeUrlsFromMessage(message, effectiveLanguage);
    
    // Nếu có scraped products và message chủ yếu là URL → trả về ngay không cần RAG
    const isUrlOnly = scrapedProducts.length > 0 && cleanedMessage.length < 10;
    if (isUrlOnly) {

      
      const responseTexts: Record<string, string> = {
        vi: 'Đây là thông tin sản phẩm tôi trích xuất từ URL bạn cung cấp:',
        en: 'Here is the product information I extracted from the URL you provided:',
        ar: 'فيما يلي معلومات المنتج التي استخرجتها من عنوان URL الذي قدمته:',
        fr: 'Voici les informations sur le produit que j\'ai extraites de l\'URL que vous avez fournie:',
      };
      
      return res.json({
        success: true,
        data: {
          answer: responseTexts[effectiveLanguage] || responseTexts.vi,
          confidence: 0.95,
          sources: scrapedProducts.map((p: any) => ({ content: p.title, source: p.product_url })),
          contextUsed: false,
          conversationId: conversationId || uuidv4(),
          detectedLanguage: effectiveLanguage,
          suggestedProducts: scrapedProducts,
          autoScraped: true,
        },
      });
    }
    
    // ⭐ Handle MADA_PRODUCT_REQUEST - Trả về sản phẩm theo category của bot
    const isProductRequest = message.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {

      
      // Get category from agent mapping
      const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
      const madaCategory = madaMapping?.madaCategory || null;
      
      // Fetch products
      const products = await getProductsByCategory(madaCategory, effectiveLanguage, 6);
      
      // Get response template
      const responseText = PRODUCT_REQUEST_RESPONSES[effectiveLanguage] || PRODUCT_REQUEST_RESPONSES.vi;
      
      // Store conversation
      const productConvId = conversationId || uuidv4();
      if (!chatHistory.has(productConvId)) {
        chatHistory.set(productConvId, []);
      }
      chatHistory.get(productConvId)!.push({ role: 'user', content: message });
      chatHistory.get(productConvId)!.push({ role: 'assistant', content: responseText });
      
      return res.json({
        success: true,
        data: {
          answer: responseText,
          confidence: 0.9,
          sources: [],
          contextUsed: false,
          conversationId: productConvId,
          detectedLanguage: effectiveLanguage,
          suggestedProducts: products,
        },
      });
    }
    
    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });
    
    // Build RAG config
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode, agentId);
    
    // ⭐ FIX: Lấy botId/madaCategory từ DATABASE (không chỉ từ hardcoded mapping)
    let botId: string | null = null;
    let madaCategory: string | null = null;
    
    if (agentId) {
      // Bước 1: Thử lấy từ DB của agent
      try {
        const agentRow = db.prepare('SELECT bot_id, mada_category FROM admin_agents WHERE id = ?').get(agentId) as any;
        if (agentRow) {
          botId = agentRow.bot_id || null;
          madaCategory = agentRow.mada_category || null;
        }
      } catch (err) {
        console.warn('⚠️ [Chat] Failed to lookup agent from DB:', err);
      }
      
      // Bước 2: Fallback sang AGENT_TO_MADA mapping nếu DB không có
      if (!botId || !madaCategory) {
        const madaMapping = AGENT_TO_MADA[agentId];
        if (madaMapping) {
          botId = botId || madaMapping.botId;
          madaCategory = madaCategory || madaMapping.madaCategory;
        }
      }
    }
    
    const ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (botId || madaCategory || agentId) {
      if (botId) ragConfig.botId = botId;
      if (madaCategory) ragConfig.madaCategory = madaCategory;
      ragConfig.agentId = agentId; // ⭐ Luôn pass agentId để filter chính xác
      ragConfig.priority = true;
    }

    // ⭐ Đưa danh mục tên sản phẩm THẬT của MADA vào prompt → bot không bịa
    // tên sản phẩm → mọi tên bot nhắc đều tồn tại trong DB → gắn được link.
    //
    // ⚠️ CHỈ đưa catalog khi đã đủ 4 câu hỏi (hoặc user hỏi thẳng về tên
    // sản phẩm cụ thể). Nếu luôn đưa, bot sẽ tự liệt kê sản phẩm ngay ở câu
    // đầu tiên → vi phạm quy tắc "hỏi đủ 4 câu rồi mới tư vấn".
    const consultedDone = req.body?.consultQuestionsCompleted === true;
    // ⭐ Server tự nhận diện tên sản phẩm (xem giải thích ở nhánh /stream:
    // cờ của client dựa trên danh sách hardcode nên thiếu tên sản phẩm mới).
    const explicitProductQuery =
      req.body?.isExplicitProductQuery === true ||
      !!findKbProductByMessage(message, message, effectiveLanguage, agentId || undefined);
    if (consultedDone || explicitProductQuery) {
      try {
        ragConfig.productCatalog = buildCatalogPromptBlock(
          madaCategory ? MADA_CATEGORY_TO_DB[madaCategory] || madaCategory : null,
          effectiveLanguage,
          40,
          (() => {
            // ⭐ HỎI RIÊNG 1 SẢN PHẨM (xem giải thích ở nhánh /stream).
            if (!explicitProductQuery) return null;
            const m = findKbProductByMessage(message, message, effectiveLanguage, agentId || undefined);
            if (!m) return null;
            const t = (effectiveLanguage === 'en' && m.title_en) || m.title;
            if (t) ragConfig.singleProductFocus = t;
            return t;
          })(),
          // ⭐ Lọc theo bot để không đưa sản phẩm của bot khác vào prompt
          agentId || null
        );
      } catch (catErr) {
        console.warn('[chat] Failed to build product catalog:', catErr);
      }
    } else {
      // Chưa đủ 4 câu → cấm bot nhắc tên sản phẩm.
      ragConfig.noProductRecommendation = true;
    }
    

    
    // Query RAG
    const ragResponse = await ragEngine.query(message, chatHistory.get(convId) || [], ragConfig);
    
    // Post-validation: ensure correct language
    let finalAnswer = ragResponse.answer;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount < maxRetries && finalAnswer && !isAnswerInExpectedLanguage(finalAnswer, effectiveLanguage as 'vi' | 'en' | 'ar' | 'fr')) {
      retryCount++;
      console.warn(`[Chat] ⚠️ Response not in expected language (${effectiveLanguage}), retry #${retryCount}`);
      const strongerInstruction = `${agentInstruction}\n\n⚠️ CRITICAL REMINDER: The UI language is ${effectiveLanguage.toUpperCase()}. Your previous response was in WRONG language. Respond ONLY in ${effectiveLanguage.toUpperCase()} NOW.`;
      const retryConfig = { ...ragConfig, systemInstruction: strongerInstruction };
      const retryResponse = await ragEngine.query(message, chatHistory.get(convId) || [], retryConfig);
      finalAnswer = retryResponse.answer;
      ragResponse.sources = retryResponse.sources;
      ragResponse.confidence = retryResponse.confidence;
    }
    
    ragResponse.answer = finalAnswer;
    
    // Guardrails DISABLED - validateResponse removed
    
    // ⭐ Tự động gợi ý sản phẩm khi user hỏi về thiết bị/sản phẩm
    // ⭐ CHỉ gửi products khi đã có đủ context HOẶC user EXPLICITLY yêu cầu
    const suggestedProducts: any[] = [];
    const isExplicitRequest = isExplicitProductRequest(message); // ⭐ CRITICAL FIX
    // ⭐ Chỉ gợi ý sản phẩm khi ĐÃ ĐỦ 4 CÂU HỎI, hoặc user hỏi thẳng về
    // tên sản phẩm cụ thể. Nếu không, bot sẽ tư vấn sản phẩm ngay ở câu 1.
    // ⭐⭐ Dùng CHUNG điều kiện với nhánh streaming (server/lib/productGating.ts).
    // Trước đây 2 nhánh lệch nhau → streaming không hiện card khi khách duyệt
    // bằng "có" sau khi đã trả lời đủ 4 câu hỏi tiêu chuẩn.
    const shouldFetch = shouldFetchProducts({
      keywordMatch: shouldShowProducts(message),
      isReadyForProductSuggestion,
      isExplicitRequest,
      consultedQuestionsCompleted: consultedDone,
      isExplicitProductQuery: explicitProductQuery,
      conversationTurns,
    });
    // ⭐⭐ Đủ 4 câu hỏi → KHÔNG được chặn bởi shouldShowProducts (xem giải thích
    // ở nhánh streaming: 3 câu cuối khách trả lời ngắn, không có từ khoá SP).
    if (shouldFetch) {
      // ⭐ Đợi user cung cấp đủ context trước khi gợi ý sản phẩm
      try {
        // ⭐ Truyền shownProductIds và isAskingForOtherProducts để không lặp lại sản phẩm
        const products = await getSuggestedProducts(ragResponse.sources || [], message, effectiveLanguage, agentId, shownProductIds, isAskingForOtherProducts);
        suggestedProducts.push(...products);
      } catch (suggErr) {

      }
    } else if (shouldShowProducts(message) && conversationTurns < 3 && !isExplicitRequest) {

    }
    
    // Store assistant response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    logActivity('info', `Chat: ${agentId || 'default'} - "${message.slice(0, 50)}..."`, 'Chat');
    
    // ⭐ Merge scraped products with suggested products (avoid duplicates by URL)
    let allProducts = [...scrapedProducts];
    for (const p of suggestedProducts) {
      const exists = allProducts.some((ap: any) => ap.product_url === p.product_url || ap.source_url === p.source_url);
      if (!exists) {
        allProducts.push(p);
      }
    }

    // ⭐ CRITICAL: Bảo đảm mọi sản phẩm bot ĐÃ NHẮC TÊN trong câu trả lời đều có
    // mặt trong danh sách → frontend gắn link ngay tên đó.
    //
    // ⚠️ HỎI RIÊNG 1 SẢN PHẨM → không thêm sản phẩm bot "kể thêm" (xem giải
    // thích ở nhánh /stream: bot nhắc Snow 12, Helix HD → thành card → rối).
    allProducts = ragConfig.singleProductFocus
      ? allProducts
      : enrichProductsWithMentions(
          ragResponse.answer,
          allProducts,
          effectiveLanguage,
          12,
          botId
        );

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        safetyScore,
        agentId,
        detectedLanguage: effectiveLanguage,
        suggestedProducts: allProducts,
        autoScraped: scrapedProducts.length > 0,
        // ⭐⭐ CỜ CHÍNH THỨC "user hỏi thẳng về 1 sản phẩm cụ thể" (xem giải
        // thích ở nhánh /stream): client dùng cờ này làm nguồn sự thật thay
        // vì tự suy đoán từ danh sách tên sản phẩm hardcode (thiếu tên mới).
        isExplicitProductQuery: explicitProductQuery,
        // ⭐ Trả về danh sách ID sản phẩm đã hiển thị để frontend track và gửi lại cho lần sau
        shownProductIds: allProducts.map((p: any) => p.id).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// POST /api/chat-with-file — Chat with file attachments
router.post('/with-file', async (req, res) => {
  try {
    const {
      message,
      conversationId,
      language: uiLanguage = 'vi',
      agentId,
      agentPrompt,
      attachments,
      isReadyForProductSuggestion = false,
      conversationTurns = 0,
      // ⭐ NEW: Các tham số kiểm soát việc hiển thị sản phẩm
      triggersProductSuggestion = false,
      followUpQuestionsAsked = 0,
      shouldShowProductsNow = false,
      isInQuestionGatheringMode = false,
      userApprovedProducts = false,
    } = req.body;

    // ⭐ Smart product suggestion: chỉ gợi ý sản phẩm khi đã đủ context
    // ⭐ NEW LOGIC: Chỉ suggest products khi:
    // 1. user đã approve (userApprovedProducts = true) VÀ
    // 2. Đã hỏi đủ câu hỏi (followUpQuestionsAsked >= 3) VÀ
    // 3. Message trigger product suggestion
    // HOẶC fallback: isReadyForProductSuggestion OR conversationTurns >= 3 OR isExplicitProductRequest
    const shouldSuggestProducts = (
      (userApprovedProducts && followUpQuestionsAsked >= 3 && triggersProductSuggestion) ||
      shouldShowProductsNow ||
      isReadyForProductSuggestion ||
      isExplicitProductRequest(message) ||
      conversationTurns >= 3
    );

    
    const ready = await waitForRagReady(15000);
    if (!ready) {
      const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
      const errMsgs: Record<string, string> = {
        vi: 'Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây.',
        en: 'System is initializing, please retry in a few seconds.',
        ar: 'النظام قيد التهيئة، يرجى إعادة المحاولة.',
        fr: "Le système s'initialise, veuillez réessayer.",
      };
      return res.status(503).json({ success: false, error: errMsgs[lang] || errMsgs.vi, retryable: true });
    }

    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage) ? uiLanguage : detectedLanguage;


    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // File upload quota check
    let fileUserId: string | null = null;
    let fileUserPlan: 'free' | 'pro' | 'enterprise' | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = verifyAccessToken(token) as any;
        if (payload?.userId) {
          const u = db.prepare('SELECT id, plan FROM users WHERE id = ?').get(payload.userId) as { id: string; plan: 'free' | 'pro' | 'enterprise' } | undefined;
          if (u) {
            fileUserId = u.id;
            fileUserPlan = u.plan;
          }
        }
      } catch { /* ignore */ }
    }
    
    if (attachments && Array.isArray(attachments) && attachments.length > 0 && fileUserId && fileUserPlan) {
      const preQuota = getFileUploadQuota(fileUserId, fileUserPlan);
      if (preQuota.limit !== -1 && preQuota.remaining < attachments.length) {
        const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
        const errMsgs: Record<string, string> = {
          vi: `Bạn chỉ còn ${preQuota.remaining}/${preQuota.limit} lượt tải file tháng này.`,
          en: `You only have ${preQuota.remaining}/${preQuota.limit} file uploads left this month.`,
          ar: `لديك ${preQuota.remaining}/${preQuota.limit} عمليات تحميل متبقية.`,
          fr: `Il ne vous reste que ${preQuota.remaining}/${preQuota.limit} téléchargements.`,
        };
        return res.status(402).json({ success: false, error: errMsgs[lang] || errMsgs.vi, code: 'FILE_UPLOAD_QUOTA_EXCEEDED', quota: preQuota });
      }
    }
    
    // Parse attachments — trích xuất nội dung từ PDF, DOCX, Ảnh, Audio, Video, etc.
    let fileContext = '';
    const attachmentResults: { name: string; type: string; success: boolean; preview?: string; error?: string; fileType?: string }[] = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (!att) continue;
        
        const name = att.name || 'unknown';
        const mimeType = att.type || 'application/octet-stream';
        
        // Nếu có content đã parse sẵn (từ frontend), dùng trực tiếp
        if (att.content && !att.content.includes('waiting to parse')) {
          const previewText = att.content.slice(0, 500);
          const displayName = name.length > 40 ? name.slice(0, 37) + '...' : name;
          fileContext += `\n\n📄 **${displayName}** (${mimeType})\n${previewText}${att.content.length > 500 ? '\n... (nội dung đã rút gọn)' : ''}`;
          attachmentResults.push({ name, type: mimeType, success: true, preview: previewText, fileType: mimeType });
          continue;
        }
        
        // Nếu có base64, parse để trích xuất nội dung
        if (att.base64) {
          try {
            const result = await parseAttachment(name, mimeType, att.base64);
            
            if (result.success && result.text) {
              // Limit context to avoid token overflow
              const maxChars = 8000;
              const truncatedText = result.text.length > maxChars 
                ? result.text.slice(0, maxChars) + '\n... (nội dung đã rút gọn để tránh quá tải)'
                : result.text;
              
              const displayName = name.length > 40 ? name.slice(0, 37) + '...' : name;
              const typeLabel = {
                pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV',
                txt: 'Text', image: 'Ảnh (OCR)', audio: 'Audio (transcription)', video: 'Video (transcription)', other: 'File'
              }[result.type] || 'File';
              
              fileContext += `\n\n📄 **${typeLabel}: ${displayName}**\n${truncatedText}`;
              attachmentResults.push({ 
                name, 
                type: mimeType, 
                success: true, 
                preview: truncatedText.slice(0, 200),
                fileType: result.type 
              });

            } else {
              // Parse failed — include error info
              const displayName = name.length > 40 ? name.slice(0, 37) + '...' : name;
              fileContext += `\n\n⚠️ Không thể đọc file "${displayName}": ${result.error || 'Lỗi không xác định'}`;
              attachmentResults.push({ name, type: mimeType, success: false, error: result.error, fileType: result.type });

            }
          } catch (attErr) {

            fileContext += `\n\n⚠️ Lỗi xử lý file "${name}": ${attErr instanceof Error ? attErr.message : 'Unknown'}`;
            attachmentResults.push({ name, type: mimeType, success: false, error: String(attErr) });
          }
        } else {
          // No base64 or content — just show file reference
          fileContext += `\n\n📎 File: ${name} (${mimeType})`;
          attachmentResults.push({ name, type: mimeType, success: false, error: 'No content provided' });
        }
      }
      
      // Track uploads
      if (fileUserId && attachments.length > 0) {
        for (const att of attachments) {
          trackFileUpload({
            userId: fileUserId,
            filename: att.name || 'unknown',
            fileSizeBytes: att.size || 0,
            fileType: att.type,
          });
        }
      }
    }
    
    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });
    
    // Build RAG config with file context
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, 'endUser', agentId);
    const ragConfig: any = {
      systemInstruction: agentInstruction,
      language: effectiveLanguage,
    };

    // ⭐ Danh mục tên sản phẩm THẬT của MADA → bot không bịa tên → luôn có link
    try {
      // ⚠️ KHÔNG truyền `null` (null = TOÀN BỘ catalog mọi bot) — bot sẽ nhắc tên
      // sản phẩm thuộc bot khác. Lọc theo category + botId của bot đang chat.
      // `with-file` không có sẵn biến `madaCategory` → derive từ agentId.
      const withFileMadaCategory = AGENT_TO_MADA[agentId || '']?.madaCategory;
      const cat = withFileMadaCategory
        ? MADA_CATEGORY_TO_DB[withFileMadaCategory] || withFileMadaCategory
        : null;
      ragConfig.productCatalog = buildCatalogPromptBlock(
        cat,
        effectiveLanguage,
        40,
        null,
        agentId || null
      );
    } catch (catErr) {
      console.warn('[chat/with-file] Failed to build product catalog:', catErr);
    }

    // Append file context to message if present
    const fullMessage = fileContext ? `${message}\n\n--- Attachment Context ---\n${fileContext}` : message;
    
    // Query RAG
    const ragResponse = await ragEngine.query(fullMessage, chatHistory.get(convId) || [], ragConfig);
    
    // Validate response
    let finalAnswer = ragResponse.answer;
    let retryCount = 0;
    while (retryCount < 2 && finalAnswer && !isAnswerInExpectedLanguage(finalAnswer, effectiveLanguage as 'vi' | 'en' | 'ar' | 'fr')) {
      retryCount++;
      const strongerInstruction = `${agentInstruction}\n\n⚠️ CRITICAL: Respond ONLY in ${effectiveLanguage.toUpperCase()}.`;
      const retryConfig = { ...ragConfig, systemInstruction: strongerInstruction };
      const retryResponse = await ragEngine.query(fullMessage, chatHistory.get(convId) || [], retryConfig);
      finalAnswer = retryResponse.answer;
      ragResponse.sources = retryResponse.sources;
      ragResponse.confidence = retryResponse.confidence;
    }
    ragResponse.answer = finalAnswer;
    
    // Guardrails DISABLED - validateResponse removed
    
    // ⭐ KHÔNG tự động gửi suggestedProducts - chỉ khi user yêu cầu qua /api/chat/products
    const suggestedProducts: any[] = [];
    
    // Store assistant response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        detectedLanguage: effectiveLanguage,
        suggestedProducts,
        attachmentsProcessed: attachments?.length || 0,
        attachmentResults: attachmentResults.length > 0 ? attachmentResults : undefined,
      },
    });
  } catch (error) {
    console.error('❌ Chat with file error:', error);
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// POST /api/chat/stream — SSE streaming chat
router.post('/stream', async (req: any, res: any) => {
  try {
    const {
      message,
      conversationId,
      language: uiLanguage = 'vi',
      agentId,
      agentPrompt,
      userMode,
      missingContext = [],
      isReadyForProductSuggestion = false,
      conversationTurns = 0,
      // ⭐ NEW: Các tham số kiểm soát việc hiển thị sản phẩm
      triggersProductSuggestion = false,
      followUpQuestionsAsked = 0,
      shouldShowProductsNow = false,
      isInQuestionGatheringMode = false,
      userApprovedProducts = false,
      // ⭐ MỚI: Track sản phẩm đã hiển thị để không lặp lại
      shownProductIds = [],
    } = req.body;

    // ⭐ Detect nếu user hỏi về "sản phẩm khác" / "other products"
    const messageLower = (message || '').toLowerCase();
    const isAskingForOtherProducts = /((còn|co|khác|other|another|more|another)|(sản phẩm|sp|thiết bị|product|device)(khác|else|more|additional)|(có|gì|có gì)(khác|else|nữa|more)|(list|show|hiển thị|gợi ý)(thêm|more|additional)|more products|more devices|more options|additional products)/i.test(messageLower);

    // ⭐ Smart product suggestion: chỉ gợi ý sản phẩm khi đã đủ context
    // ⭐ NEW LOGIC: Chỉ suggest products khi:
    // 1. user đã approve (userApprovedProducts = true) VÀ
    // 2. Đã hỏi đủ câu hỏi (followUpQuestionsAsked >= 3) VÀ
    // 3. Message trigger product suggestion
    // HOẶC fallback: isReadyForProductSuggestion OR conversationTurns >= 3 OR isExplicitProductRequest
    const shouldSuggestProducts = (
      (userApprovedProducts && followUpQuestionsAsked >= 3 && triggersProductSuggestion) ||
      shouldShowProductsNow ||
      isReadyForProductSuggestion ||
      isExplicitProductRequest(message) ||
      conversationTurns >= 3
    );

    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    sendEvent({ type: 'connected', timestamp: Date.now() });
    
    // Anonymous quota check
    const isAuthenticated = req.headers.authorization?.startsWith('Bearer ');
    if (!isAuthenticated) {
      const systemSettings = getSystemSettings();
      const anonymousLimit = systemSettings.anonymousLimit;
      
      if (anonymousLimit !== -1) {
        const anonQuotaHeader = req.headers['x-anon-quota'] ? parseInt(req.headers['x-anon-quota'] as string) : 0;
        
        if (anonQuotaHeader >= anonymousLimit) {
          sendEvent({
            type: 'done',
            answer: `⚠️ Bạn đã sử dụng hết ${anonymousLimit} lần trò chuyện miễn phí. Vui lòng đăng nhập để tiếp tục.`,
            sources: [],
            quotaExceeded: true,
          });
          return res.end();
        }
      }
    }
    
    // Language detection
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage) ? uiLanguage : detectedLanguage;
    
    // Guardrails DISABLED - allow all queries
    
    // ⭐ AUTO-SCRAPE URLS: Nếu message chứa URL, tự động scrape và trả về product cards
    const { scrapedProducts, cleanedMessage } = await autoScrapeUrlsFromMessage(message, effectiveLanguage);
    
    // Nếu có scraped products và message chủ yếu là URL → trả về ngay không cần RAG
    const isUrlOnly = scrapedProducts.length > 0 && cleanedMessage.length < 10;
    if (isUrlOnly) {

      
      const responseTexts: Record<string, string> = {
        vi: 'Đây là thông tin sản phẩm tôi trích xuất từ URL bạn cung cấp:',
        en: 'Here is the product information I extracted from the URL you provided:',
        ar: 'فيما يلي معلومات المنتج التي استخرجتها من عنوان URL الذي قدمته:',
        fr: 'Voici les informations sur le produit que j\'ai extraites de l\'URL que vous avez fournie:',
      };
      
      const responseText = responseTexts[effectiveLanguage] || responseTexts.vi;
      
      sendEvent({ type: 'chunk', chunk: responseText });
      
      if (scrapedProducts.length > 0) {
        sendEvent({ type: 'suggestedProducts', suggestedProducts: scrapedProducts, autoScraped: true });
      }
      
      sendEvent({
        type: 'done',
        conversationId: conversationId || uuidv4(),
        confidence: 0.95,
        sources: scrapedProducts.map((p: any) => ({ content: p.title, source: p.product_url })),
        detectedLanguage: effectiveLanguage,
        autoScraped: true,
      });
      
      return res.end();
    }
    
    // ⭐ Handle MADA_PRODUCT_REQUEST - Trả về sản phẩm theo category của bot
    const isProductRequest = message.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {
      // Get agent mapping for category
      const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
      const madaCategory = madaMapping?.madaCategory || null;
      

      
      // Fetch products
      const products = await getProductsByCategory(madaCategory, effectiveLanguage, 6);
      
      // Get response template
      const responseText = PRODUCT_REQUEST_RESPONSES[effectiveLanguage] || PRODUCT_REQUEST_RESPONSES.vi;
      
      // Store conversation first
      const productConvId = conversationId || uuidv4();
      if (!chatHistory.has(productConvId)) {
        chatHistory.set(productConvId, []);
      }
      chatHistory.get(productConvId)!.push({ role: 'user', content: message });
      
      // Send response
      sendEvent({ type: 'chunk', chunk: responseText });
      
      // Send products
      if (products.length > 0) {
        sendEvent({ type: 'suggestedProducts', suggestedProducts: products });
      }
      
      // Complete
      sendEvent({
        type: 'done',
        conversationId: productConvId,
        confidence: 0.9,
        detectedLanguage: effectiveLanguage,
      });
      
      chatHistory.get(productConvId)!.push({ role: 'assistant', content: responseText });
      
      return res.end();
    }
    
    // Store conversation
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // ⭐ ĐỊNH TUYẾN CHUYÊN MÔN: đang chat với Bot 7 (Thông tin bổ trợ) mà câu
    // hỏi thuộc lĩnh vực riêng (thị giác, thính giác…) thì chuyển sang đúng bot
    // chuyên môn, để header + tên bot khớp với nội dung trả lời.
    let activeAgentId = agentId;
    // ⭐ Client báo đã hỏi đủ 4 câu tiêu chuẩn chưa + user có hỏi thẳng về
    // tên sản phẩm cụ thể không → quyết định có đưa catalog cho bot hay không.
    const consultedQuestionsCompleted = req.body?.consultQuestionsCompleted === true;
    // ⭐ Server TỰ nhận diện tên sản phẩm trong câu hỏi, KHÔNG tin cờ của client.
    //
    // ⚠️ VÌ SAO CẦN: `isExplicitProductQuery` do frontend gửi lên dựa trên danh
    // sách TÊN SẢN PHẨM HARDCODED. Danh sách đó thiếu tên (VD "Luna Series"),
    // nên khi khách hỏi "Luna Series là gì?" → cờ = false → server coi như
    // câu hỏi chung → bot tự liệt kê Snow 12, Helix HD… dù khách chỉ hỏi 1 sản
    // phẩm. Cờ client chỉ dùng để BỔ SUNG, không quyết định một mình.
    const clientClaimsSpecific = req.body?.isExplicitProductQuery === true;
    const isExplicitProductQuery =
      clientClaimsSpecific || !!findKbProductByMessage(message, message, effectiveLanguage, agentId || undefined);
    const currentBotId = agentId
      ? (db.prepare('SELECT bot_id FROM admin_agents WHERE id = ?').get(agentId) as any)?.bot_id || agentId
      : null;
    const routedBotId = routeToSpecialistBot(message, currentBotId);
    if (routedBotId) {
      const routedAgent = db.prepare('SELECT id FROM admin_agents WHERE bot_id = ? AND is_active = 1').get(routedBotId) as any;
      if (routedAgent) {
        activeAgentId = routedAgent.id;
        console.log(`🔀 [chat/stream] Route Bot 7 → ${routedBotId} (${routedAgent.id}) cho: "${message.slice(0, 60)}"`);
        // Báo client để đổi header/label của khung chat cho khớp bot mới.
        sendEvent({ type: 'agentSwitched', botId: routedBotId, agentId: routedAgent.id });
      }
    }

    // Build RAG config
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode, activeAgentId);
    
    // ⭐ FIX: Lấy botId/madaCategory từ DATABASE (không chỉ từ hardcoded mapping)
    let botId: string | null = null;
    let madaCategory: string | null = null;
    
    if (activeAgentId) {
      // Bước 1: Thử lấy từ DB của agent
      try {
        const agentRow = db.prepare('SELECT bot_id, mada_category FROM admin_agents WHERE id = ?').get(activeAgentId) as any;
        if (agentRow) {
          botId = agentRow.bot_id || null;
          madaCategory = agentRow.mada_category || null;
        }
      } catch (err) {
        console.warn('⚠️ [chat/stream] Failed to lookup agent from DB:', err);
      }
      
      // Bước 2: Fallback sang AGENT_TO_MADA mapping nếu DB không có
      if (!botId || !madaCategory) {
        const madaMapping = AGENT_TO_MADA[activeAgentId];
        if (madaMapping) {
          botId = botId || madaMapping.botId;
          madaCategory = madaCategory || madaMapping.madaCategory;
        }
      }
    }
    
    let ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (botId || madaCategory || agentId) {
      if (botId) ragConfig.botId = botId;
      if (madaCategory) ragConfig.madaCategory = madaCategory;
      ragConfig.agentId = agentId; // ⭐ Luôn pass agentId để filter chính xác
      ragConfig.priority = true;
    }

    // ⭐ Đưa danh mục tên sản phẩm THẬT của MADA vào prompt.
    // Nhờ vậy bot không bịa tên sản phẩm (tên bịa sẽ không có trong DB → không
    // gắn được link) và mọi tên bot nhắc đều tồn tại → luôn có link sản phẩm.
    //
    // ⚠️ CHỈ đưa catalog khi client báo đã đủ 4 câu hỏi (hoặc user hỏi thẳng
    // về sản phẩm cụ thể). Nếu luôn đưa, bot sẽ tự liệt kê sản phẩm ngay ở
    // câu đầu tiên → vi phạm quy tắc "hỏi đủ 4 câu rồi mới tư vấn".
    const dbCategoryForCatalog = madaCategory
      ? MADA_CATEGORY_TO_DB[madaCategory] || madaCategory
      : null;
    // ⭐ Truyền botId để catalog chỉ chứa sản phẩm của ĐÚNG bot này
    // (lọc theo category là chưa đủ vì `mobility`/`daily_living` bị chia sẻ).
    const botIdForCatalog = activeAgentId || (madaCategory ? MADA_CATEGORY_TO_DB[madaCategory] : null);
    const canRecommendProducts = consultedQuestionsCompleted || isExplicitProductQuery;
    if (canRecommendProducts) {
      try {
        // ⭐ HỎI RIÊNG 1 SẢN PHẨM: tìm sản phẩm user nhắc tên. Nếu khớp được
        // thì chỉ đưa ĐÚNG sản phẩm đó vào catalog + dặn bot không ra thêm
        // sản phẩm khác (yêu cầu: hỏi gì tư vấn nấy, kèm ảnh).
        const matched = isExplicitProductQuery
          ? findKbProductByMessage(message, message, effectiveLanguage, activeAgentId || undefined)
          : null;
        const focusTitle = matched
          ? (effectiveLanguage === 'en' && matched.title_en) || matched.title
          : null;
        if (focusTitle) {
          ragConfig.singleProductFocus = focusTitle;
        }

        ragConfig.productCatalog = buildCatalogPromptBlock(
          dbCategoryForCatalog,
          effectiveLanguage,
          40,
          focusTitle,
          botIdForCatalog
        );
      } catch (catErr) {
        console.warn('[chat/stream] Failed to build product catalog:', catErr);
      }
    } else {
      // Chưa đủ 4 câu → cấm bot nhắc tên sản phẩm.
      ragConfig.noProductRecommendation = true;
    }

    // ⭐ Track product IDs sent in this response (for done event + dedup on next turn)
    let sentProductIds: string[] = [];


    // Check RAG engine
    if (!ragEngine.isConfigured) {
      const ready = await waitForRagReady(15000);
      if (!ready) {
        console.warn('[chat/stream] RAG engine not configured after 15s wait');
        const geminiErrors: Record<string, string> = {
          vi: '⚠️ Hệ thống đang khởi tạo, vui lòng thử lại.',
          en: '⚠️ System is initializing, please retry.',
          ar: '⚠️ النظام قيد التهيئة، يرجى إعادة المحاولة.',
          fr: "⚠️ Le système s'initialise, veuillez réessayer.",
        };
        sendEvent({ type: 'error', error: geminiErrors[effectiveLanguage] || geminiErrors.vi, retryable: true });
        return res.end();
      }
    }
    
    // Stream from RAG
    try {
      const streamResult = await ragEngine.queryStream(message, chatHistory.get(convId) || [], ragConfig);
      
      if (streamResult.sources && streamResult.sources.length > 0) {
        sendEvent({ type: 'sources', sources: streamResult.sources });
      }
      
      // ⭐ Tự động gửi suggestedProducts khi user hỏi về thiết bị/sản phẩm
      // ⭐ CHỈ gửi products khi đã có đủ context HOẶC user EXPLICITLY yêu cầu xem sản phẩm
      const shouldShow = shouldShowProducts(message);
      const isExplicitRequest = isExplicitProductRequest(message); // ⭐ CRITICAL FIX: User hỏi trực tiếp → show ngay!

      // ⭐ Đợi user cung cấp đủ context trước khi gợi ý sản phẩm
      // ⭐ NHƯNG: Nếu user EXPLICITLY yêu cầu xem sản phẩm → show NGAY LẬP TỨC
      // ⭐ Stream response TRƯỚC, gom toàn bộ câu trả lời (cần biết bot nhắc tên
      //    sản phẩm nào → gắn link đúng tên đó, không cần khách phải hỏi lại).
      let fullStreamedAnswer = '';
      if (streamResult.stream) {
        for await (const chunk of streamResult.stream) {
          // ⭐ Engine yêu cầu thay toàn bộ nội dung đã stream (dùng khi cần
          // gỡ tên sản phẩm vì người dùng chưa đủ 4 câu hỏi).
          if ((chunk as any).__replaceFull) {
            const replacement = String((chunk as any).__replaceFull || '');
            sendEvent({ type: 'replaceFull', content: replacement });
            fullStreamedAnswer = replacement;
            continue;
          }
          const chunkText = chunk.text();
          if (chunkText) {
            fullStreamedAnswer += chunkText;
            sendEvent({ type: 'chunk', chunk: chunkText });
          }
        }
      } else if (streamResult.answer) {
        fullStreamedAnswer = streamResult.answer;
        sendEvent({ type: 'chunk', chunk: streamResult.answer });
      }

      // ⭐ Đợi user cung cấp đủ context trước khi gợi ý sản phẩm
      // ⭐ NHƯNG: Nếu user EXPLICITLY yêu cầu xem sản phẩm → show NGAY LẬP TỨC
      // ⭐⭐ FIX: `shouldShow &&` khiến bot đủ 4 câu rồi VẪN không hiện sản phẩm.
      // 3 câu cuối khách chỉ trả lời ngắn ("45 tuổi", "2 năm rồi", "khó đọc
      // sách") → không chứa từ khoá "sản phẩm/thiết bị/máy/gợi ý" →
      // shouldShowProducts() = false → server KHÔNG gọi getSuggestedProducts.
      //
      // Đã đủ 4 câu hỏi (isReadyForProductSuggestion) là đủ điều kiện tư vấn:
      // mỗi bot chuyên môn đã hỏi đủ bối cảnh thì PHẢI ra sản phẩm.
      //
      // ⭐⭐ Dùng CHUNG điều kiện với nhánh non-streaming
      // (server/lib/productGating.ts) — trước đây 2 nhánh lệch nhau:
      // streaming KHÔNG dùng `consultQuestionsCompleted` → khách trả lời đủ
      // 4 câu rồi duyệt bằng "có" → KHÔNG có card sản phẩm.
      const shouldFetch = shouldFetchProducts({
        keywordMatch: shouldShow,
        isReadyForProductSuggestion,
        isExplicitRequest,
        consultedQuestionsCompleted: consultedQuestionsCompleted,
        isExplicitProductQuery: isExplicitProductQuery,
        conversationTurns,
      });

      if (shouldFetch) {
        // ⭐ Chỉ gợi ý sản phẩm KHI đã đủ context HOẶC user explicit yêu cầu
        try {
          let allProducts = [...scrapedProducts]; // Start with scraped products
          // ⭐ Truyền shownProductIds và isAskingForOtherProducts để không lặp lại sản phẩm
          const suggestedProducts = await getSuggestedProducts(streamResult.sources || [], message, effectiveLanguage, activeAgentId, shownProductIds, isAskingForOtherProducts);

          // Merge without duplicates
          for (const p of suggestedProducts) {
            const exists = allProducts.some((ap: any) => ap.product_url === p.product_url || ap.source_url === p.source_url);
            if (!exists) {
              allProducts.push(p);
            }
          }

          // ⭐ CRITICAL: Bảo đảm mọi sản phẩm bot ĐÃ NHẮC TÊN trong câu trả lời đều
          // có mặt trong danh sách → frontend gắn link ngay tên đó.
          // (Trước đây bot nhắc tên sản phẩm không nằm trong list → không có link.)
          //
          // ⚠️ HỎI RIÊNG 1 SẢN PHẨM → KHÔNG được thêm sản phẩm khác. Bot hay tự
          // kể "có thể tham khảo thêm Snow 12, Helix HD…" → hàm này biến mấy tên
          // đó thành card → khách hỏi riêng Luna Series lại thấy 4 card, rối.
          // Ở đây chỉ giữ đúng sản phẩm bot tập trung.
          allProducts = ragConfig.singleProductFocus
            ? allProducts
            : enrichProductsWithMentions(
                fullStreamedAnswer,
                allProducts,
                effectiveLanguage,
                12,
                botId
              );

          if (allProducts.length > 0) {
            sentProductIds = allProducts.map((p: any) => p.id).filter(Boolean);
            // ⭐ ANTI-REPEAT: Track recommended products
            sendEvent({ type: 'suggestedProducts', suggestedProducts: allProducts, autoScraped: scrapedProducts.length > 0 });
          }
        } catch (suggErr) {
          console.warn('[chat/stream] getSuggestedProducts error:', suggErr);
        }
      } else if (scrapedProducts.length > 0) {
        // Still send scraped products from URLs in message even if context not ready
        sentProductIds = scrapedProducts.map((p: any) => p.id).filter(Boolean);
        sendEvent({ type: 'suggestedProducts', suggestedProducts: scrapedProducts, autoScraped: true });
      } else if (!shouldSuggestProducts && !isExplicitRequest && missingContext.length > 0) {
        // ⭐ Chưa đủ context: gửi event để frontend biết cần hỏi thêm
        sendEvent({ type: 'contextNeeded', missingContext, message: 'Cần hỏi thêm thông tin trước khi gợi ý sản phẩm' });
      }
      
      sendEvent({
        type: 'done',
        conversationId: convId,
        confidence: streamResult.confidence || 0.5,
        detectedLanguage: effectiveLanguage,
        shownProductIds: sentProductIds,
        // ⭐⭐ CỜ CHÍNH THỨC "user hỏi thẳng về 1 sản phẩm cụ thể".
        //
        // VÌ SAO PHẢI GỬI TỪ SERVER:
        // Client có danh sách tên sản phẩm HARDCODED (KNOWN_PRODUCT_NAMES) —
        // danh sách này THIẾU tên sản phẩm mới (vd "EduMic", "VisionBuddy",
        // "TD Pilot", "WeWALK Smart Cane"). → client tưởng user hỏi chung,
        // bỏ qua card, trong khi SERVER đã tự nhận diện đúng từ DB và đã gửi
        // card về → người dùng chỉ thấy danh sách tên, KHÔNG thấy card.
        //
        // → Client dùng cờ này làm nguồn sự thật, thay vì tự suy đoán.
        isExplicitProductQuery,
      });
      
      chatHistory.get(convId)!.push({ role: 'assistant', content: fullStreamedAnswer || streamResult.answer || '' });

      // Giới hạn lịch sử để không phình bộ nhớ và prompt
      const convHistory = chatHistory.get(convId)!;
      if (convHistory.length > 40) {
        convHistory.splice(0, convHistory.length - 40);
      }
      
    } catch (streamError) {
      console.error('❌ Stream error:', streamError);
      const errorMsg = streamError instanceof Error ? streamError.message : 'Stream failed';
      
      // ⭐ FALLBACK: Khi RAG/AI fail, vẫn trả lời được với basic response
      const isNetworkError = errorMsg.includes('fetch failed') || 
                            errorMsg.includes('ENOTFOUND') ||
                            errorMsg.includes('getaddrinfo') ||
                            errorMsg.includes('ECONNREFUSED');
      
      // ⭐ 429 Too Many Requests — API rate limit
      // Gồm cả 503/UNAVAILABLE: Gemini quá tải cũng dùng chung câu fallback "hệ thống đang bận"
      const is429Error = errorMsg.includes('429') || 
                         errorMsg.includes('Too Many Requests') ||
                         errorMsg.includes('RESOURCE_EXHAUSTED') ||
                         errorMsg.includes('503') ||
                         errorMsg.includes('Service Unavailable') ||
                         errorMsg.includes('UNAVAILABLE');
      
      if (isNetworkError || is429Error) {
        const errorType = is429Error ? '429_RATE_LIMIT' : 'NETWORK_ERROR';

        
        // Tạo câu trả lời cơ bản dựa trên context của conversation
        const contextMessages = chatHistory.get(convId) || [];
        const hasHistory = contextMessages.length > 0;
        
        const fallbackResponses: Record<string, string> = {
          vi: is429Error
            ? hasHistory 
              ? `Mình hiểu câu hỏi của bạn rồi! 💬 Hệ thống đang có nhiều người dùng cùng lúc nên tạm thời chậm một chút.\n\n` +
                `Trong lúc chờ, bạn có thể cho mình biết thêm chi tiết về nhu cầu để mình tư vấn tốt hơn nhé!`
              : `Xin chào! 👋 Mình là trợ lý MADA AI. Hệ thống đang có nhiều người dùng cùng lúc nên hơi chậm một chút.\n\n` +
                `Bạn cứ đặt câu hỏi nhé, mình sẽ trả lời ngay khi có thể! 😊`
            : hasHistory 
              ? `Tôi đã nhận được câu hỏi của bạn. Dựa trên cuộc trò chuyện, tôi có thể hỗ trợ bạn về:\n\n` +
                `• Thông tin về các sản phẩm công nghệ hỗ trợ người khuyết tật\n` +
                `• Tư vấn về thiết bị phù hợp với nhu cầu của bạn\n` +
                `• Hướng dẫn sử dụng các công cụ hỗ trợ\n\n` +
                `Bạn có thể mô tả chi tiết hơn về nhu cầu của mình để tôi có thể tư vấn tốt hơn nhé!`
              : `Xin chào! 👋 Tôi là trợ lý AI của MADA Center. Tôi có thể hỗ trợ bạn:\n\n` +
                `• Tư vấn về công nghệ hỗ trợ người khuyết tật\n` +
                `• Giới thiệu các sản phẩm AT phù hợp với nhu cầu\n` +
                `• Trả lời các câu hỏi về tiêu chuẩn ISO, WCAG\n\n` +
                `Bạn cần hỗ trợ gì hôm nay?`,
          en: is429Error
            ? hasHistory
              ? `I understand your question! 💬 The system is currently experiencing high traffic, so responses may be slower.\n\n` +
                `While waiting, feel free to share more details about your needs so I can provide better advice!`
              : `Hello! 👋 I'm MADA AI assistant. The system is experiencing high traffic, so things may be a bit slower.\n\n` +
                `Feel free to ask your questions - I'll respond as soon as possible! 😊`
            : hasHistory
              ? `I received your question. Based on our conversation, I can help you with:\n\n` +
                `• Information about assistive technology products\n` +
                `• Recommendations for devices that match your needs\n` +
                `• Guidance on using support tools\n\n` +
                `Could you describe your needs in more detail so I can provide better advice?`
              : `Hello! 👋 I'm MADA Center's AI assistant. I can help you with:\n\n` +
                `• Consultations on assistive technology for persons with disabilities\n` +
                `• Product recommendations based on your needs\n` +
                `• Information about ISO and WCAG standards\n\n` +
                `How can I assist you today?`,
          ar: is429Error
            ? hasHistory
              ? `أفهم سؤالك! 💬 النظام يعاني من حركة مرور عالية حاليًا، لذا قد تكون الردود أبطأ.\n\n` +
                `أثناء الانتظار، لا تتردد في مشاركة المزيد من التفاصيل حول احتياجاتك!`
              : `مرحباً! 👋 أنا مساعد MADA AI. النظام يعاني من حركة مرور عالية.\n\n` +
                `لا تتردد في طرح أسئلتك - سأرد في أقرب وقت ممكن! 😊`
            : hasHistory
              ? `تلقت سؤالك. بناءً على محادثتنا، يمكنني مساعدتك في:\n\n` +
                `• المعلومات حول منتجات التكنولوجيا المساعدة\n` +
                `• توصيات الأجهزة التي تناسب احتياجاتك\n` +
                `• إرشادات حول استخدام أدوات الدعم\n\n` +
                `هل يمكنك وصف احتياجاتك بمزيد من التفصيل؟`
              : `مرحباً! 👋 أنا مساعد MADA Center الذكي. يمكنني مساعدتك في:\n\n` +
                `• الاستشارات حول التكنولوجيا المساعدة\n` +
                `• توصيات المنتجات المناسبة لاحتياجاتك\n` +
                `• معلومات عن معايير ISO و WCAG\n\n` +
                `كيف يمكنني مساعدتك اليوم؟`,
          fr: is429Error
            ? hasHistory
              ? `Je comprends votre question! 💬 Le système connaît actuellement une forte affluence, les réponses peuvent être plus lentes.\n\n` +
                `En attendant, n'hésitez pas à partager plus de détails sur vos besoins!`
              : `Bonjour! 👋 Je suis l'assistant MADA AI. Le système connaît une forte affluence.\n\n` +
                `N'hésitez pas à poser vos questions - je répondrai dès que possible! 😊`
            : hasHistory
              ? `J'ai reçu votre question. Sur la base de notre conversation, je peux vous aider avec:\n\n` +
                `• Des informations sur les produits de technologie d'assistance\n` +
                `• Des recommandations d'appareils adaptés à vos besoins\n` +
                `• Des conseils sur l'utilisation des outils de support\n\n` +
                `Pourriez-vous décrire vos besoins plus en détail?`
              : `Bonjour! 👋 Je suis l'assistant IA de MADA Center. Je peux vous aider avec:\n\n` +
                `• Des consultations sur les technologies d'assistance\n` +
                `• Des recommandations de produits adaptées à vos besoins\n` +
                `• Des informations sur les normes ISO et WCAG\n\n` +
                `Comment puis-je vous aider aujourd'hui?`,
        };
        
        const fallbackAnswer = fallbackResponses[effectiveLanguage] || fallbackResponses.vi;
        
        // Stream the fallback response
        // ⭐ FALLBACK: CHỈ gửi products khi đã có đủ context HOẶC user EXPLICITLY yêu cầu
        const isExplicitRequest = isExplicitProductRequest(message); // ⭐ CRITICAL FIX
        // ⭐ Detect nếu user hỏi về "sản phẩm khác"
        const messageLower = (message || '').toLowerCase();
        const isAskingForOtherProductsFallback = /((còn|co|khác|other|another|more|another)|(sản phẩm|sp|thiết bị|product|device)(khác|else|more|additional)|(có|gì|có gì)(khác|else|nữa|more)|(list|show|hiển thị|gợi ý)(thêm|more|additional)|more products|more devices|more options|additional products)/i.test(messageLower);
      // ⭐⭐ Cùng lý do trên: đủ 4 câu thì KHÔNG được chặn bởi shouldShowProducts.
      // Dùng CHUNG điều kiện với nhánh streaming chính + non-streaming.
      if (shouldFetchProducts({
        keywordMatch: shouldShowProducts(message),
        isReadyForProductSuggestion,
        isExplicitRequest,
        consultedQuestionsCompleted: consultedQuestionsCompleted,
        isExplicitProductQuery: isExplicitProductQuery,
        conversationTurns,
      })) {
          try {
            // ⭐ Truyền shownProductIds và isAskingForOtherProducts để không lặp lại sản phẩm
            const suggestedProducts = await getSuggestedProducts([], message, effectiveLanguage, activeAgentId, shownProductIds, isAskingForOtherProductsFallback);
            if (suggestedProducts.length > 0) {
              sentProductIds = suggestedProducts.map((p: any) => p.id).filter(Boolean);
              sendEvent({ type: 'suggestedProducts', suggestedProducts });
            }
          } catch (suggErr) {

          }
        } else if (shouldShowProducts(message) && conversationTurns < 3 && !isExplicitRequest) {

        }
        
        const words = fallbackAnswer.split(' ');
        for (const word of words) {
          sendEvent({ type: 'chunk', chunk: word + ' ' });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        sendEvent({
          type: 'done',
          conversationId: convId,
          confidence: 0.3,
          isFallback: true,
          detectedLanguage: effectiveLanguage,
          shownProductIds: [],
        });
        
        chatHistory.get(convId)!.push({ role: 'assistant', content: fallbackAnswer });
      } else {
        sendEvent({ type: 'error', error: errorMsg, retryable: true });
      }
    }
    
    if (!res.writableEnded) {
      try {
        return res.end();
      } catch (e) {
        console.warn('⚠️ res.end() error:', (e as Error).message);
        return;
      }
    }
    return;
  } catch (error) {
    console.error('❌ Chat stream error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    if (!res.writableEnded) {
      try {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: `Lỗi server: ${errMsg}`, retryable: true })}\n\n`);
          res.end();
        } else {
          res.status(503).json({ success: false, error: `Error: ${errMsg}`, retryable: true });
        }
      } catch (e) {
        console.warn('⚠️ Cannot send error response:', (e as Error).message);
      }
    }
  }
});

// POST /api/chat/follow-up — AI-powered follow-up questions
router.post('/follow-up', async (req, res) => {
  try {
    const { userMessage, aiResponse, conversationHistory, language = 'vi', userMode: _userMode = 'endUser' } = req.body;

    if (!userMessage) {
      return res.status(400).json({ success: false, error: 'userMessage is required' });
    }



    // Build context
    const historyContext = conversationHistory
      ?.slice(-10)
      ?.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      ?.join('\n') || '';

    // Prompt templates — escape backticks to prevent template literal injection
    const safeUserMessage = String(userMessage).replace(/`/g, '\\`');
    const safeAiResponse = String(aiResponse || '(chưa có phản hồi)').replace(/`/g, '\\`');
    const safeHistoryContext = historyContext.replace(/`/g, '\\`');

    const prompts: Record<string, string> = {
      vi: `Bạn là trợ lý MADA AI chuyên về Công nghệ Hỗ trợ (AT).
Dựa vào cuộc trò chuyện sau:
---
Người dùng: ${safeUserMessage}
MADA AI: ${safeAiResponse}
${safeHistoryContext ? `Lịch sử:\n${safeHistoryContext}` : ''}
---
Hãy đề xuất 3 câu hỏi TIẾP THEO mà người dùng có thể hỏi.
QUY TẮC:
1. Câu hỏi phải CỤ THỂ, liên quan đến nội dung đang thảo luận
2. Đa dạng: có thể hỏi về giá, cách dùng, so sánh, mua ở đâu...
3. Ngắn gọn 10-20 từ
4. Trả lời JSON: {"questions": ["câu 1", "câu 2", "câu 3"]}
5. Không hỏi lại những gì đã được trả lời
7. CHỈ trả về JSON, không giải thích.`,
      en: `You are MADA AI assistant specializing in Assistive Technology (AT).
Based on this conversation:
---
User: ${safeUserMessage}
MADA AI: ${safeAiResponse}
${safeHistoryContext ? `History:\n${safeHistoryContext}` : ''}
---
Suggest 3 NEXT questions the user might ask.
RULES:
1. Questions must be SPECIFIC and relevant
2. Diverse: pricing, usage, comparison, where to buy...
3. Concise 10-20 words
4. Respond ONLY in JSON: {"questions": ["q1", "q2", "q3"]}
5. Don't repeat answered questions
7. ONLY return JSON.`,
      ar: `أنت مساعد MADA AI المتخصص في التكنولوجيا المساعدة.
بناءً على هذه المحادثة:
---
المستخدم: ${safeUserMessage}
MADA AI: ${safeAiResponse}
---
اقترح 3 أسئلة NEXT.
القواعد:
1. أسئلة محددة وذات صلة
2. متنوعة
3. موجزة 10-20 كلمة
4. JSON فقط: {"questions": ["q1", "q2", "q3"]}`,
      fr: `Vous êtes l'assistant MADA AI spécialisé en Technologie d'Assistance.
Basé sur cette conversation:
---
Utilisateur: ${safeUserMessage}
MADA AI: ${safeAiResponse}
---
Suggérez 3 questions SUIVANTES.
RÈGLES:
1. Questions spécifiques et pertinentes
2. Diversifiées
3. Concises 10-20 mots
4. JSON uniquement: {"questions": ["q1", "q2", "q3"]}`
    };

    const prompt = prompts[language] || prompts.vi;

    // Check Gemini config
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {

      return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'no_api_key' } });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    let geminiData: any;
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          })
        }
      );

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text().catch(() => '');
        console.error('❌ Gemini API error:', geminiResponse.status, errText);
        return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'api_error' } });
      }

      geminiData = await geminiResponse.json();
    } catch (fetchErr) {
      console.error('❌ Follow-up fetch error:', fetchErr);
      return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'network_error' } });
    }

    let responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    responseText = responseText.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();

    // Parse JSON
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        return res.json({ success: true, data: { questions: questions.slice(0, 4), source: 'gemini' } });
      }

      // Fallback: parse text format
      const lines = responseText.split('\n').map((l: any) => l.trim()).filter(Boolean);
      const questions: string[] = [];
      for (const line of lines) {
        const match = line.match(/^[*\-\•]?\s*(?:Q?\d+[:\.)]\s*)?(.+)/i);
        if (match && match[1] && match[1].length > 10 && !match[1].startsWith('#')) {
          questions.push(match[1].replace(/^[a-z]\)\s*/i, '').trim());
        }
      }

      if (questions.length > 0) {
        return res.json({ success: true, data: { questions: questions.slice(0, 4), source: 'parsed' } });
      }

      return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'no_parse' } });
    } catch (parseErr) {
      console.error('❌ Follow-up parse error:', parseErr);
      return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'parse_error' } });
    }
  } catch (error) {
    console.error('❌ Follow-up error:', error);
    // Always return 200 with fallback — never throw 500 for this endpoint
    const lang = req.body?.language || 'vi';
    res.json({ success: true, data: { questions: generateFallbackFollowUps(req.body?.userMessage || '', lang), source: 'catch_error' } });
  }
});

// Helper: generate fallback follow-up questions based on user message
function generateFallbackFollowUps(userMessage: string, language: string): string[] {
  const q = (userMessage || '').toLowerCase();

  const fallbackByLang: Record<string, () => string[]> = {
    vi: () => {
      const base: string[] = [];
      if (q.includes('thính') || q.includes('tai') || q.includes('hearing')) {
        base.push('Máy trợ thính có kết nối Bluetooth không?');
        base.push('Có thể dùng cho trẻ em không?');
      }
      if (q.includes('wheelchair') || q.includes('xe lăn') || q.includes('mobility')) {
        base.push('Xe lăn điện có giá bao nhiêu?');
        base.push('Có thể mang xe lăn lên máy bay không?');
      }
      if (q.includes('giá') || q.includes('price') || q.includes('cost') || q.includes('mua')) {
        base.push('Mua thiết bị này ở đâu?');
        base.push('Có chương trình hỗ trợ tài chính không?');
      }
      if (base.length < 3) {
        base.push('Thiết bị này có dễ sử dụng không?');
        base.push('Có thể dùng thử trước khi mua không?');
        base.push('Địa chỉ mua thiết bị uy tín ở đâu?');
      }
      return base.slice(0, 4);
    },
    en: () => {
      const base: string[] = [];
      if (q.includes('hearing') || q.includes('thính')) {
        base.push('Does the hearing aid have Bluetooth connectivity?');
        base.push('Can it be used for children?');
      }
      if (q.includes('wheelchair') || q.includes('mobility')) {
        base.push('How much does an electric wheelchair cost?');
        base.push('Can I bring a wheelchair on a plane?');
      }
      if (base.length < 3) {
        base.push('Is this device easy to use?');
        base.push('Can I try before buying?');
        base.push('Where to buy from reputable sources?');
      }
      return base.slice(0, 4);
    },
    ar: () => [
      'هل يمكنني تجربته قبل الشراء؟',
      'أين أشتري من مصادر موثوقة؟',
      'ما هي مدة الضمان؟',
      'هل تتوفر مساعدة مالية؟',
    ],
    fr: () => [
      'Ce dispositif est-il facile à utiliser?',
      'Puis-je l\'essayer avant d\'acheter?',
      'Où acheter auprès de sources fiables?',
      'Quelle est la période de garantie?',
    ],
  };

  return fallbackByLang[language]?.() || fallbackByLang['en']();
}

// GET /api/chat/history/:id — Get conversation history
router.get('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const history = chatHistory.get(id);
    
    if (!history) {
      return res.json({ success: true, data: { messages: [], exists: false } });
    }
    
    res.json({ success: true, data: { messages: history, exists: true } });
  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/chat/history/:id — Clear conversation history
router.delete('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = chatHistory.delete(id);
    
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('❌ Delete history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/chat/evaluate — Run RAG evaluation
// Note: This is a simplified evaluation for development purposes
router.post('/evaluate', async (req, res) => {
  try {
    const { topK = 5 } = req.body;
    
    // Simple keyword-based evaluation
    const testQueries = [
      { query: 'hearing aid', lang: 'en' },
      { query: 'wheelchair', lang: 'en' },
      { query: 'máy trợ thính', lang: 'vi' },
      { query: 'thiết bị hỗ trợ người mù', lang: 'vi' },
      { query: 'screen reader', lang: 'en' },
      { query: 'AAC device', lang: 'en' },
    ];
    
    const results: any[] = [];
    
    for (const testQuery of testQueries) {
      try {
        const searchResults = await ragEngine.query(testQuery.query, [], { topK: Number(topK) });
        
        results.push({
          query: testQuery.query,
          language: testQuery.lang,
          retrievedCount: searchResults.sources?.length || 0,
          confidence: searchResults.confidence || 0,
          contextUsed: searchResults.contextUsed || false,
        });
      } catch (err) {
        results.push({
          query: testQuery.query,
          language: testQuery.lang,
          error: (err as Error).message,
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalQueries: results.length,
          successfulQueries: results.filter((r: any) => !r.error).length,
          avgRetrieved: results.reduce((acc: number, r: any) => acc + (r.retrievedCount || 0), 0) / Math.max(results.filter((r: any) => !r.error).length, 1),
        },
      },
    });
  } catch (error) {
    console.error('❌ Evaluation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/chat/products — Get products on-demand
router.post('/products', async (req, res) => {
  try {
    const { message, language = 'vi', agentId, conversationTurns = 0, isReadyForProductSuggestion = false } = req.body;
    
    // ⭐ Detect language from message for product recommendations
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = ['vi', 'en', 'ar', 'fr'].includes(language) ? language : detectedLanguage;
    
    // ⭐ Handle MADA_PRODUCT_REQUEST
    const isProductRequest = message?.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {

      
      // Get category from agent mapping
      const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
      const madaCategory = madaMapping?.madaCategory || null;
      
      // Fetch products
      const products = await getProductsByCategory(madaCategory, effectiveLanguage, 6);
      
      return res.json({
        success: true,
        data: {
          products,
          count: products.length,
          reason: 'product_request',
        },
      });
    }
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // ⭐ CHỈ gửi products khi đã có đủ context HOẶC user EXPLICITLY yêu cầu
    const isExplicitRequest = isExplicitProductRequest(message); // ⭐ CRITICAL FIX
    if (!shouldShowProducts(message)) {
      return res.json({
        success: true,
        data: {
          products: [],
          reason: 'not_product_intent',
          hint: effectiveLanguage === 'vi' 
            ? 'Hãy hỏi về sản phẩm, thiết bị, giá cả hoặc nơi mua để xem gợi ý.'
            : 'Ask about products, devices, prices or where to buy to see suggestions.',
        },
      });
    }
    
    // ⭐ Check context - only show products when user has provided enough info HOẶC explicit request
    if (conversationTurns < 3 && !isReadyForProductSuggestion && !isExplicitRequest) {

      return res.json({
        success: true,
        data: {
          products: [],
          reason: 'not_enough_context',
          hint: effectiveLanguage === 'vi'
            ? 'Vui lòng cho tôi biết thêm về nhu cầu của bạn (ngân sách, mục đích sử dụng, đối tượng sử dụng...) để tôi có thể gợi ý sản phẩm phù hợp hơn.'
            : 'Please provide more details about your needs (budget, usage purpose, target user...) so I can suggest suitable products.',
        },
      });
    }
    
    // Get products
    const products = await getSuggestedProducts([], message, effectiveLanguage, agentId);
    

    
    res.json({
      success: true,
      data: {
        products,
        count: products.length,
        reason: 'product_intent',
      },
    });
  } catch (error) {
    console.error('❌ Products API error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== CONSULTATION MODE ==============

// Multi-language messages for consultation
const CONSULT_MSGS: Record<string, { start: string; answer: string; complete: string; noMore: string }> = {
  vi: {
    start: 'Cảm ơn bạn đã chia sẻ! Để tư vấn chính xác hơn, mình cần hỏi thêm một vài câu nhé. 💡',
    answer: 'Mình đã ghi nhận thông tin của bạn.',
    complete: 'Dựa trên thông tin bạn cung cấp, đây là những gợi ý của mình:',
    noMore: 'Mình đã có đủ thông tin để tư vấn cho bạn rồi. Đây là những gợi ý:'
  },
  en: {
    start: 'Thank you for sharing! To provide more accurate recommendations, I need to ask a few more questions. 💡',
    answer: 'I\'ve recorded your information.',
    complete: 'Based on the information you provided, here are my suggestions:',
    noMore: 'I have enough information to recommend for you. Here are my suggestions:'
  },
  ar: {
    start: 'شكراً لمشاركتك! لتقديم توصيات أكثر دقة، أحتاج إلى طرح بعض الأسئلة الإضافية. 💡',
    answer: 'لقد سجلنا معلوماتك.',
    complete: 'بناءً على المعلومات التي قدمتها، إليك اقتراحاتي:',
    noMore: 'لدي معلومات كافية للتوصية لك. إليك اقتراحاتي:'
  },
  fr: {
    start: 'Merci de votre partage ! Pour fournir des recommandations plus précises, j\'ai besoin de poser quelques questions supplémentaires. 💡',
    answer: 'J\'ai enregistré vos informations.',
    complete: 'Basé sur les informations que vous avez fournies, voici mes suggestions :',
    noMore: 'J\'ai assez d\'informations pour vous recommander. Voici mes suggestions :'
  }
};

// POST /api/chat/consultation — Start consultation mode
router.post('/consultation', async (req, res) => {
  try {
    const { message, language: uiLanguage = 'vi', conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage) ? uiLanguage : detectedLanguage;
    
    // Create consultation session
    const { sessionId, session } = createConsultationSession(message, effectiveLanguage);
    
    // Get first set of questions
    const { questions } = await getConsultationQuestions(sessionId);
    
    const msgs = CONSULT_MSGS[effectiveLanguage] || CONSULT_MSGS.vi;
    
    // Build response with consultation info
    const welcomeMsg = msgs.start;
    
    res.json({
      success: true,
      data: {
        answer: welcomeMsg,
        consultation: {
          sessionId,
          active: true,
          phase: 'gathering',
          category: session.category,
          questions,
          language: effectiveLanguage,
        },
        conversationId: conversationId || sessionId,
        confidence: 0.9,
        sources: [],
      },
    });
  } catch (error) {
    console.error('❌ Consultation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/chat/consultation/answer — Answer consultation question
// @ts-ignore - unused variable for future extension
router.post('/consultation/answer', async (_req: any, _res: any) => {
  // Main logic in /api/consultation/answer route
});

// POST /api/chat/consultation/direct — Direct question without consultation flow
router.post('/consultation/direct', async (req, res) => {
  try {
    const { message, language: uiLanguage = 'vi', conversationId, agentId, agentPrompt, userMode } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage) ? uiLanguage : detectedLanguage;
    
    // Check for consultation trigger keywords
    const consultTriggers = [
      'tư vấn', 'tư vấn cho tôi', 'recommend for me', 'help me find',
      'consultation', 'مشورة', 'conseil', 'مشورة لي'
    ];
    
    const shouldConsult = consultTriggers.some(t => message.toLowerCase().includes(t.toLowerCase()));
    
    if (shouldConsult) {
      // Redirect to consultation mode
      const { sessionId, session } = createConsultationSession(message, effectiveLanguage);
      const { questions } = await getConsultationQuestions(sessionId);
      
      const msgs = CONSULT_MSGS[effectiveLanguage] || CONSULT_MSGS.vi;
      
      return res.json({
        success: true,
        data: {
          answer: msgs.start,
          consultation: {
            sessionId,
            active: true,
            phase: 'gathering',
            category: session.category,
            questions,
            language: effectiveLanguage,
            suggestion: effectiveLanguage === 'vi' 
              ? '💡 Trả lời các câu hỏi để nhận tư vấn chính xác hơn!'
              : '💡 Answer the questions to get more accurate recommendations!'
          },
          conversationId: conversationId || sessionId,
        },
      });
    }
    
    // Otherwise, normal chat
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = buildSystemPrompt(effectiveLanguage, validUserMode, agentPrompt, agentId);
    
    const ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (agentId) {
      const madaMapping = AGENT_TO_MADA[agentId];
      if (madaMapping) {
        ragConfig.botId = madaMapping.botId;
        ragConfig.madaCategory = madaMapping.madaCategory;
        ragConfig.priority = true;
      } else {
        ragConfig.agentId = agentId;
        ragConfig.priority = true;
      }
    }

    // ⭐ Danh mục tên sản phẩm THẬT của MADA → bot không bịa tên → luôn có link
    try {
      const cat = ragConfig.madaCategory
        ? MADA_CATEGORY_TO_DB[ragConfig.madaCategory] || ragConfig.madaCategory
        : null;
      ragConfig.productCatalog = buildCatalogPromptBlock(
        cat,
        effectiveLanguage,
        40,
        null,
        agentId || null
      );
    } catch (catErr) {
      console.warn('[chat] Failed to build product catalog:', catErr);
    }
    
    const ragResponse = await ragEngine.query(message, [], ragConfig);
    
    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources || [],
        contextUsed: ragResponse.contextUsed,
        conversationId: conversationId || uuidv4(),
        consultation: {
          available: true,
          suggestion: effectiveLanguage === 'vi'
            ? '💡 Bạn muốn được tư vấn chi tiết hơn? Hãy nhấn nút "Bắt đầu tư vấn"!'
            : '💡 Want detailed consultation? Click "Start Consultation"!'
        },
      },
    });
  } catch (error) {
    console.error('❌ Consultation direct error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== MESSAGE FEEDBACK ==============

/**
 * POST /api/feedback - Submit feedback for a message
 */
router.post('/feedback', async (req, res) => {
  try {
    const { message_id, rating, reason, session_id, agent_id, selectedReasons, details } = req.body;
    
    if (!message_id || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'message_id and rating are required' 
      });
    }
    
    if (!['like', 'dislike'].includes(rating)) {
      return res.status(400).json({ 
        success: false, 
        error: 'rating must be "like" or "dislike"' 
      });
    }
    
    // Get user ID if authenticated
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    const authResult = token ? verifyAccessToken(token) as any : null;
    const userId = authResult?.id || null;
    
    // Build reason from selectedReasons + details
    let fullReason = reason || '';
    if (selectedReasons && Array.isArray(selectedReasons) && selectedReasons.length > 0) {
      fullReason = selectedReasons.join(' | ');
      if (details && details.trim()) {
        fullReason += `\n\nChi tiết: ${details.trim()}`;
      }
    } else if (details && details.trim() && !fullReason) {
      fullReason = details.trim();
    }
    
    // Save feedback
    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO message_feedback (id, message_id, session_id, user_id, rating, reason, agent_id, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      message_id,
      session_id || null,
      userId,
      rating,
      fullReason || null,
      agent_id || null,
      req.body.language || 'vi',
      now
    );
    
    logActivity('info', `Message feedback: ${rating}${fullReason ? ` - ${fullReason.slice(0, 100)}` : ''}`, 'User');
    
    res.json({ success: true, data: { id, rating, reason: fullReason } });
  } catch (error) {
    console.error('❌ Feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/questions - Get feedback questions for the dislike form
 */
router.get('/feedback/questions', async (_req, res) => {
  try {
    const questions = db.prepare(`
      SELECT 
        id as db_id,
        question_key,
        text_vi,
        text_en,
        text_ar,
        text_fr,
        icon,
        is_active,
        sort_order
      FROM feedback_questions
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `).all();
    

    
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('❌ Get feedback questions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/all-questions - Get all feedback questions (including inactive) for admin
 */
router.get('/feedback/all-questions', requireAdmin, async (_req, res) => {
  try {
    const questions = db.prepare(`
      SELECT
        id,
        question_key,
        text_vi,
        text_en,
        text_ar,
        text_fr,
        icon,
        is_active,
        sort_order,
        created_at,
        updated_at
      FROM feedback_questions
      ORDER BY sort_order ASC
    `).all();
    
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('❌ Get all feedback questions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback/questions - Create a new feedback question
 */
router.post('/feedback/questions', requireAdmin, async (req, res) => {
  try {
    const { text_vi, text_en, text_ar, text_fr, icon, is_active, sort_order } = req.body;
    
    if (!text_vi) {
      return res.status(400).json({ 
        success: false, 
        error: 'text_vi is required' 
      });
    }
    
    const id = `fq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const questionKey = text_vi.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
    const now = new Date().toISOString();
    const activeValue = (is_active !== undefined && is_active !== null) ? (is_active ? 1 : 0) : 1;
    
    db.prepare(`
      INSERT INTO feedback_questions (id, question_key, text_vi, text_en, text_ar, text_fr, icon, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      questionKey,
      text_vi,
      text_en || '',
      text_ar || '',
      text_fr || '',
      icon || 'alert-circle',
      activeValue,
      sort_order || 99,
      now,
      now
    );
    
    logActivity('info', `Created feedback question: ${text_vi.slice(0, 50)}`, 'Admin');
    
    res.json({ success: true, data: { id, question_key: questionKey } });
  } catch (error) {
    console.error('❌ Create feedback question error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/feedback/questions/:id - Update a feedback question
 */
router.put('/feedback/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text_vi, text_en, text_ar, text_fr, icon, is_active, sort_order } = req.body;
    
    // Check if question exists and get current values
    const existing = db.prepare('SELECT id, is_active, sort_order FROM feedback_questions WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    // Determine the is_active value to use
    // If is_active is explicitly sent (0 or 1), use it. Otherwise keep existing.
    const newIsActive = (is_active !== undefined && is_active !== null)
      ? (is_active ? 1 : 0)
      : existing.is_active;
    
    // Keep existing sort_order if not provided (sort_order is NOT NULL)
    const newSortOrder = (sort_order !== undefined && sort_order !== null && sort_order !== '')
      ? Number(sort_order)
      : existing.sort_order;
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE feedback_questions
      SET text_vi = COALESCE(NULLIF(?, ''), text_vi),
          text_en = COALESCE(NULLIF(?, ''), text_en),
          text_ar = COALESCE(NULLIF(?, ''), text_ar),
          text_fr = COALESCE(NULLIF(?, ''), text_fr),
          icon = COALESCE(NULLIF(?, ''), icon),
          is_active = ?,
          sort_order = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      text_vi ?? null,
      text_en ?? null,
      text_ar ?? null,
      text_fr ?? null,
      icon ?? null,
      newIsActive,
      newSortOrder,
      now,
      id
    );
    
    logActivity('info', `Updated feedback question: ${id}`, 'Admin');
    
    res.json({ success: true, data: { id, is_active: newIsActive } });
  } catch (error) {
    console.error('❌ Update feedback question error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/feedback/questions/:id - Delete a feedback question
 */
router.delete('/feedback/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if question exists
    const existing = db.prepare('SELECT id, text_vi FROM feedback_questions WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    db.prepare('DELETE FROM feedback_questions WHERE id = ?').run(id);
    
    logActivity('info', `Deleted feedback question: ${existing.text_vi}`, 'Admin');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete feedback question error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/stats - Get feedback statistics (for admin)
 */
router.get('/feedback/stats', async (req, res) => {
  try {
    const { agent_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        rating,
        COUNT(*) as count,
        AVG(LENGTH(reason)) as avg_reason_length
      FROM message_feedback
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (agent_id) {
      query += ' AND agent_id = ?';
      params.push(agent_id);
    }
    
    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    query += ' GROUP BY rating';
    
    const stats = db.prepare(query).all(...params);
    
    // Get total
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM message_feedback WHERE 1=1
      ${agent_id ? 'AND agent_id = ?' : ''}
      ${start_date ? 'AND created_at >= ?' : ''}
      ${end_date ? 'AND created_at <= ?' : ''}
    `).all(...(agent_id ? [agent_id] : []).concat(start_date ? [start_date] : []).concat(end_date ? [end_date] : [])) as { total: number }[];
    
    // Get dislike reasons
    const reasons = db.prepare(`
      SELECT reason, COUNT(*) as count 
      FROM message_feedback 
      WHERE rating = 'dislike' AND reason IS NOT NULL AND reason != ''
      ${agent_id ? 'AND agent_id = ?' : ''}
      GROUP BY reason 
      ORDER BY count DESC 
      LIMIT 20
    `).all(...(agent_id ? [agent_id] : []));
    
    res.json({
      success: true,
      data: {
        stats,
        total: totalResult[0]?.total || 0,
        reasons
      }
    });
  } catch (error) {
    console.error('❌ Feedback stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/questions/stats - Per-question selection stats
 * Matches message_feedback.reason against feedback_questions.text_vi
 */
router.get('/feedback/questions/stats', async (req, res) => {
  try {
    // Get all active questions
    const questions = db.prepare(`
      SELECT id, question_key, text_vi, is_active
      FROM feedback_questions
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `).all() as any[];

    // Count total dislikes this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM message_feedback
      WHERE rating = 'dislike' AND created_at >= ?
    `).get(startOfMonth) as { total: number };
    const totalDislike = totalResult?.total || 0;

    // Count per question by matching reason to text_vi
    const data = questions.map((q: any) => {
      const countResult = db.prepare(`
        SELECT COUNT(*) as cnt FROM message_feedback
        WHERE rating = 'dislike' AND reason = ? AND created_at >= ?
      `).get(q.text_vi, startOfMonth) as { cnt: number };
      const count = countResult?.cnt || 0;
      const percent = totalDislike > 0 ? Math.round((count / totalDislike) * 1000) / 10 : 0;
      return {
        question_key: q.question_key,
        count,
        percent,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Feedback questions stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/stats/monthly - Monthly stats for cards
 * Returns: total dislike this month, vs last month %, top reason
 */
router.get('/feedback/stats/monthly', async (req, res) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // This month dislikes
    const thisMonthResult = db.prepare(`
      SELECT COUNT(*) as total FROM message_feedback
      WHERE rating = 'dislike' AND created_at >= ?
    `).get(startOfThisMonth) as { total: number };
    const totalDislikeMonth = thisMonthResult?.total || 0;

    // Last month dislikes
    const lastMonthResult = db.prepare(`
      SELECT COUNT(*) as total FROM message_feedback
      WHERE rating = 'dislike' AND created_at >= ? AND created_at <= ?
    `).get(startOfLastMonth, endOfLastMonth) as { total: number };
    const totalDislikeLastMonth = lastMonthResult?.total || 0;

    // Calculate change percent
    let dislikeChangePercent = 0;
    if (totalDislikeLastMonth > 0) {
      dislikeChangePercent = Math.round(((totalDislikeMonth - totalDislikeLastMonth) / totalDislikeLastMonth) * 1000) / 10;
    } else if (totalDislikeMonth > 0) {
      dislikeChangePercent = 100;
    }

    // Top reason this month (matching against feedback_questions.text_vi)
    const topReasonRow = db.prepare(`
      SELECT reason, COUNT(*) as cnt
      FROM message_feedback
      WHERE rating = 'dislike' AND reason IS NOT NULL AND reason != '' AND created_at >= ?
      GROUP BY reason
      ORDER BY cnt DESC
      LIMIT 1
    `).get(startOfThisMonth) as { reason: string; cnt: number } | undefined;

    const topReason = topReasonRow?.reason || '';

    res.json({
      success: true,
      data: {
        totalDislikeMonth,
        dislikeChangePercent,
        topReason,
      },
    });
  } catch (error) {
    console.error('❌ Feedback monthly stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/list - Get individual feedback entries for admin
 * Includes session_id for linking to chat history
 */
router.get('/feedback/list', async (req, res) => {
  try {
    const { agent_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        mf.id,
        mf.message_id,
        mf.session_id,
        mf.user_id,
        mf.rating,
        mf.reason,
        mf.agent_id,
        mf.language,
        mf.created_at
      FROM message_feedback mf
      WHERE 1=1
    `;
    const params: any[] = [];

    if (agent_id) {
      query += ' AND mf.agent_id = ?';
      params.push(agent_id);
    }

    if (start_date) {
      query += ' AND mf.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND mf.created_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY mf.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const feedbackList = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM message_feedback mf WHERE 1=1';
    const countParams: any[] = [];

    if (agent_id) {
      countQuery += ' AND mf.agent_id = ?';
      countParams.push(agent_id);
    }
    if (start_date) {
      countQuery += ' AND mf.created_at >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND mf.created_at <= ?';
      countParams.push(end_date);
    }

    const countResult = db.prepare(countQuery).get(...countParams) as { total: number };

    res.json({
      success: true,
      data: {
        feedback: feedbackList,
        total: countResult?.total || 0,
      },
    });
  } catch (error) {
    console.error('❌ Feedback list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/:id - Get feedback detail with message content and conversation info
 */
router.get('/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get feedback entry
    const feedback = db.prepare(`
      SELECT 
        mf.*,
        cm.content as message_content,
        cm.role as message_role,
        cm.agent_id as message_agent_id,
        cc.title as conversation_title,
        cc.language as conversation_language,
        u.name as user_name,
        u.email as user_email
      FROM message_feedback mf
      LEFT JOIN chat_messages cm ON cm.id = mf.message_id
      LEFT JOIN chat_conversations cc ON cc.id = mf.session_id
      LEFT JOIN users u ON u.id = mf.user_id
      WHERE mf.id = ?
    `).get(id) as any;

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ Feedback detail error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/conversation/:sessionId - Get all feedback for a conversation
 */
router.get('/feedback/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get all feedback for the conversation
    const feedback = db.prepare(`
      SELECT 
        mf.*,
        cm.content as message_content,
        cm.role as message_role,
        cm.agent_id as message_agent_id
      FROM message_feedback mf
      LEFT JOIN chat_messages cm ON cm.id = mf.message_id
      WHERE mf.session_id = ?
      ORDER BY mf.created_at ASC
    `).all(sessionId);

    // Get conversation info
    const conversation = db.prepare(`
      SELECT 
        cc.*,
        u.name as user_name,
        u.email as user_email
      FROM chat_conversations cc
      LEFT JOIN users u ON u.id = cc.user_id
      WHERE cc.id = ?
    `).get(sessionId) as any;

    res.json({
      success: true,
      data: {
        conversation,
        feedback,
      },
    });
  } catch (error) {
    console.error('❌ Feedback conversation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/feedback/daily - Get daily feedback statistics for chart
 */
router.get('/feedback/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Number(days) || 30;

    // Get daily stats
    const dailyStats = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        rating,
        COUNT(*) as count
      FROM message_feedback
      WHERE created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at), rating
      ORDER BY date ASC
    `).all(daysNum);

    // Get reasons by day
    const reasonsByDay = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        reason,
        COUNT(*) as count
      FROM message_feedback
      WHERE rating = 'dislike' 
        AND reason IS NOT NULL 
        AND reason != ''
        AND created_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at), reason
      ORDER BY date DESC, count DESC
    `).all(daysNum);

    res.json({
      success: true,
      data: {
        dailyStats,
        reasonsByDay,
      },
    });
  } catch (error) {
    console.error('❌ Feedback daily error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
export { detectMessageLanguage };

/**
 * POST /api/chat/feedback/translate — Auto-translate a feedback question text
 * Detect source language from the filled field, translate to the other 3
 */
router.post('/feedback/translate', requireAdmin, async (req, res) => {
  try {
    const { text, sourceLang } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const result = await translateContent(text.trim(), sourceLang || 'vi');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Feedback translate error:', error);
    res.status(500).json({ success: false, error: 'Translation failed' });
  }
});
