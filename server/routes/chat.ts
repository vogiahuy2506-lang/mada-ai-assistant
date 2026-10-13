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
import { logActivity } from '../index';
import { parseAttachment } from '../lib/fileProcessor';
import { translateContent } from '../lib/translationService';

const router = express.Router();

// ============== HELPERS ==============

/**
 * Convert MADA image URL to proxy URL
 */
function toProxyImageUrl(madaUrl: string): string {
  if (!madaUrl || typeof madaUrl !== 'string' || !madaUrl.startsWith('http')) {
    return '';
  }
  if (madaUrl.includes('mada.org.qa') || madaUrl.includes('cdn.at.mada.org.qa')) {
    return `/api/mada-image?url=${encodeURIComponent(madaUrl)}`;
  }
  const shopDomains = ['tgdd.vn', 'cellphones.com.vn', 'fptshop.com.vn', 'dienmayxanh.com', 'hstatic.net', 'viettelstore.vn'];
  if (shopDomains.some(d => madaUrl.includes(d))) {
    return madaUrl;
  }
  if (madaUrl.includes('upload.wikimedia.org')) {
    return madaUrl;
  }
  return madaUrl;
}

// MADA Agent to Category mapping
const AGENT_TO_MADA: Record<string, { botId: string; madaCategory: string }> = {
  'bot-hearing':    { botId: 'bot-hearing',    madaCategory: 'sensory-hearing' },
  'bot-vision':     { botId: 'bot-vision',     madaCategory: 'sensory-vision' },
  'bot-speech':     { botId: 'bot-speech',     madaCategory: 'voice-and-speech' },
  'bot-cognitive':  { botId: 'bot-cognitive',  madaCategory: 'mental-cognitive' },
  'bot-neuro':      { botId: 'bot-neuro',      madaCategory: 'neuromusculoskeletal-movement' },
  'bot-mobility':   { botId: 'bot-mobility',   madaCategory: 'mobility-and-transportation' },
  'bot-regulatory': { botId: 'bot-regulatory', madaCategory: 'regulatory-standards' },
};

// ⭐ Product Request Category Mapping
const MADA_CATEGORY_TO_DB: Record<string, string> = {
  'sensory-hearing': 'sensory-hearing',
  'sensory-vision': 'sensory-vision',
  'voice-and-speech': 'voice-and-speech',
  'mental-cognitive': 'mental-cognitive',
  'neuromusculoskeletal-movement': 'neuromusculoskeletal-movement',
  'mobility-and-transportation': 'mobility-and-transportation',
  'regulatory-standards': 'regulatory-standards',
};

// ⭐ Product request response templates
const PRODUCT_REQUEST_RESPONSES: Record<string, string> = {
  vi: 'Dựa trên nhu cầu của bạn, đây là các sản phẩm công nghệ hỗ trợ tôi gợi ý:',
  en: 'Based on your needs, here are the assistive technology products I recommend:',
  ar: 'بناءً على احتياجاتك، إليك منتجات تقنية المساعدة التي أوصي بها:',
  fr: "Basé sur vos besoins, voici les produits de technologie d'assistance que je recommande:",
};

// ⭐ Get products by category (for product request)
async function getProductsByCategory(madaCategory: string | null, _language: string, limit: number = 6): Promise<any[]> {
  let products: any[] = [];
  
  try {
    let query: string;
    let params: any[];
    
    if (madaCategory && MADA_CATEGORY_TO_DB[madaCategory]) {
      // Lấy products theo category cụ thể
      const dbCategory = MADA_CATEGORY_TO_DB[madaCategory];
      query = `
        SELECT p.*, ki.category as ki_category, ki.confidence
        FROM kb_products p
        LEFT JOIN knowledge_items ki ON p.source_url = ki.url OR p.product_url = ki.url
        WHERE ki.category = ? AND ki.status IN ('draft', 'published', 'approved')
        ORDER BY ki.confidence DESC, p.created_at DESC
        LIMIT ?
      `;
      params = [dbCategory, limit];
      console.log(`📦 [ProductRequest] Fetching products for category: ${dbCategory}`);
    } else {
      // Lấy tất cả products (bot tổng)
      query = `
        SELECT p.*, ki.category as ki_category, ki.confidence
        FROM kb_products p
        LEFT JOIN knowledge_items ki ON p.source_url = ki.url OR p.product_url = ki.url
        WHERE ki.status IN ('draft', 'published', 'approved')
        ORDER BY ki.confidence DESC, p.created_at DESC
        LIMIT ?
      `;
      params = [limit];
      console.log(`📦 [ProductRequest] Fetching all products (no category filter)`);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    console.log(`📦 [ProductRequest] Found ${rows.length} products`);
    
    // Map to suggestedProducts format
    products = rows.map((row: any) => {
      // Determine category color for gradient
      const categoryLower = (row.category || row.ki_category || '').toLowerCase();
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
      
      return {
        id: row.id || row.product_id,
        title: row.title,
        title_en: row.title_en || row.title,
        description: row.description || '',
        category: row.category || row.ki_category || 'general',
        brand: row.brand || 'MADA Qatar AT Portal',
        price_range: row.price_range || 'Liên hệ MADA Center',
        product_url: row.product_url || row.source_url || '',
        source_url: row.source_url || '',
        image_url: toProxyImageUrl(row.image_url || ''),
        confidence: row.confidence || 0.7,
        mada_advice: row.mada_advice || '',
        warranty: row.warranty || '',
        features: (() => {
          try {
            // Check if already an array, try to parse if string
            if (Array.isArray(row.features)) return row.features;
            if (typeof row.features === 'string') return JSON.parse(row.features);
            return [];
          } catch {
            return [];
          }
        })(),
        categoryColor, // For UI gradient
      };
    });
    
    // Filter out invalid products
    products = products.filter((p: any) => {
      const hasTitle = p.title && p.title.length > 2;
      const hasUrl = p.product_url && p.product_url.startsWith('http');
      return hasTitle && hasUrl;
    });
    
    console.log(`📦 [ProductRequest] Returning ${products.length} valid products`);
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
    // ⭐ HÌNH ẢNH - THÊM ĐỂ BẮT "xem hình", "hình ảnh sp"
    'hình ảnh', 'hình', 'ảnh', 'coi hình', 'xem hình', 'pic', 'image', 'photo',
    'link', 'url', 'web', 'website', 'xem thêm',
    'tư vấn', 'chi tiết hơn', 'kĩ hơn', 'cụ thể hơn', 'more details', 'detailed',
    'sp', 'sản phẩm', 'mẫu mã', 'kiểu dáng',
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
    // Arabic
    'منتج', 'جهاز', 'شراء', 'سعر', 'ينصح', 'يقت', 'كرسي متحرك', 'سماعة',
    // French
    'produit', 'appareil', 'dispositif', "siège d'aisance", 'fauteuil roulant',
    'appareil auditif', 'achat', 'prix', 'recommander',
  ];
  
  return productKeywords.some(kw => contentLower.includes(kw));
}

// Language detection
function detectMessageLanguage(message: string): 'vi' | 'en' | 'ar' | 'fr' {
  const text = message || '';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  const viDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (viDiacritics.test(text) && viDiacritics.test(text)) return 'vi';
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
function getSystemInstruction(lang: string, agentPrompt?: string, userMode: 'endUser' | 'specialist' = 'endUser'): string {
  return buildSystemPrompt(lang, userMode, agentPrompt);
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

// Get suggested products from RAG sources
async function getSuggestedProducts(ragSources: any[], message: string, effectiveLanguage: string): Promise<any[]> {
  let suggestedProducts: any[] = [];
  
  // Helper: Check if URL is valid for product
  const isValidProductUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('manual:')) return false;
    if (url.startsWith('bot-') || url.startsWith('agent-')) return false;
    if (!url.startsWith('http')) return false;
    return true;
  };
  
  // Helper: Check if title is a bot/knowledge base entry (not a real product)
  const isBotEntry = (title: string): boolean => {
    if (!title) return false;
    const lower = title.toLowerCase();
    if (lower.includes('bot ') && lower.includes('kiến thức')) return true;
    if (lower.includes('regulatory & standards')) return true;
    if (lower.includes('bot ') && lower.includes('knowledge')) return true;
    return false;
  };
  
  // Helper: Get full product data from kb_products table
  const getProductFromDb = (productUrl: string): any => {
    if (!productUrl) return null;
    try {
      // Normalize URL (remove trailing slash)
      const normalizedUrl = productUrl.replace(/\/$/, '');
      
      // Try to find by source_url OR product_url (both exact and normalized)
      // NOTE: Only remove trailing slash to normalize, NOT all slashes
      const product = db.prepare(`
        SELECT * FROM kb_products 
        WHERE source_url = ? OR product_url = ?
           OR source_url = ? OR product_url = ?
        LIMIT 1
      `).get(normalizedUrl, normalizedUrl, productUrl, productUrl) as any;
      if (product) {
        console.log(`📷 [DB Lookup] FOUND: ${product.title} | image: ${product.image_url ? 'YES' : 'NO'}`);
        return product;
      }
      console.log(`📷 [DB Lookup] NOT FOUND for: ${productUrl}`);
    } catch (e) { 
      console.warn('[getProductFromDb] DB error:', (e as Error).message);
    }
    return null;
  };
  
  // Helper: Directly get product by title from kb_products
  const getProductByTitle = (title: string): any => {
    if (!title) return null;
    try {
      // Try exact match first
      let product = db.prepare(`
        SELECT * FROM kb_products 
        WHERE title = ? OR title_en = ?
        LIMIT 1
      `).get(title, title) as any;
      
      // Try partial match
      if (!product) {
        product = db.prepare(`
          SELECT * FROM kb_products 
          WHERE title LIKE ? OR title_en LIKE ?
          LIMIT 1
        `).get(`%${title}%`, `%${title}%`) as any;
      }
      
      // Try matching with special chars removed
      if (!product) {
        const cleanTitle = title.replace(/[®™©°]/g, '').trim();
        product = db.prepare(`
          SELECT * FROM kb_products 
          WHERE REPLACE(title, '®', '') LIKE ? OR REPLACE(title, '™', '') LIKE ?
          LIMIT 1
        `).get(`%${cleanTitle}%`, `%${cleanTitle}%`) as any;
      }
      
      if (product) {
        console.log(`📷 [Title Lookup] FOUND by title "${title}": ${product.title} | image: ${product.image_url ? 'YES' : 'NO'}`);
        return product;
      }
      console.log(`📷 [Title Lookup] NOT FOUND for title: ${title}`);
    } catch (e) { 
      console.warn('[getProductByTitle] DB error:', (e as Error).message);
    }
    return null;
  };
  
  // Strategy 1: From RAG sources
  if (ragSources.length > 0) {
    console.log(`📦 [getSuggestedProducts] Strategy 1: ${ragSources.length} RAG sources`);
    const sourceUrls = ragSources.slice(0, 8).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);
    console.log(`📦 [getSuggestedProducts] Strategy 1: sourceUrls =`, sourceUrls.slice(0, 5));
    let dbDataMap: Record<string, any> = {};
    
    // Helper: normalize URL (remove trailing slash)
    const normalizeUrl = (url: string) => url?.replace(/\/$/, '') || '';
    
    if (sourceUrls.length > 0) {
      try {
        // Also normalize URLs for lookup
        const normalizedUrls = sourceUrls.map(normalizeUrl);
        const placeholders = normalizedUrls.map(() => '?').join(',');
        const rows = db.prepare(`
          SELECT id, title, content, source, url, category, language, metadata
          FROM knowledge_items
          WHERE REPLACE(url, '/', '') IN (${placeholders}) OR REPLACE(source, '/', '') IN (${placeholders})
        `).all(...normalizedUrls, ...normalizedUrls) as any[];
        
        for (const row of rows) {
          // Store with both original and normalized keys
          const key = row.url || row.source || '';
          if (key) {
            dbDataMap[key] = row;
            dbDataMap[normalizeUrl(key)] = row; // Also store normalized
          }
        }
      } catch (e) { /* ignore */ }
    }
    
    suggestedProducts = ragSources.slice(0, 8).map((src: any, idx: number) => {
      const meta = src.metadata || {};
      const rawSourceUrl = meta.source || meta.url || src.source || '';
      const sourceUrl = normalizeUrl(rawSourceUrl);
      const dbItem = dbDataMap[sourceUrl] || dbDataMap[rawSourceUrl] || {};
      
      // ⭐ LUÔN ƯU TIÊN URL từ database (url column) vì metadata có thể trống
      const finalProductUrl = dbItem.url || sourceUrl || meta.productUrl || '';
      
      // Get thumbnail: try metadata first (thumbnailUrl OR image_url), then kb_products table
      let thumbnail = meta.thumbnailUrl || meta.image_url || '';
      console.log(`📷 [Product ${idx}] title="${meta.title || 'N/A'}" sourceUrl="${sourceUrl.slice(0,60)}"`);
      console.log(`📷 [Product ${idx}] dbItem found: ${!!dbItem.id}, dbItem.url="${(dbItem.url || '').slice(0,60)}"`);
      
      // Also get full product data from kb_products for additional fields
      let kbProduct = getProductFromDb(finalProductUrl);
      console.log(`📷 [Product ${idx}] getProductFromDb(${finalProductUrl?.slice(0,40)}...) = ${kbProduct ? 'FOUND' : 'NOT FOUND'}`);
      
      // Fallback: try to find by title if URL lookup failed
      if (!kbProduct && meta.title) {
        console.log(`📷 [Product ${idx}] Trying getProductByTitle("${meta.title}")`);
        kbProduct = getProductByTitle(meta.title);
      }
      
      if (kbProduct) {
        console.log(`📷 [Product ${idx}] ✓ Found: ${kbProduct.title}, image=${kbProduct.image_url ? 'YES' : 'NO'}`);
        thumbnail = kbProduct.image_url || '';
      } else {
        console.log(`📷 [Product ${idx}] ✗ NOT found in kb_products`);
      }
      
      console.log(`📷 [Product ${idx}] FINAL image=${thumbnail ? 'HAS IMAGE' : 'NO IMAGE'}`);
      
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
      return {
        id: kbProduct?.id || src.id || dbItem.id || `src-${idx}`,
        title: kbProduct?.title || meta.title || dbItem.title || 'Assistive Technology',
        title_en: kbProduct?.title_en || meta.title_en || meta.title || dbItem.title || 'Assistive Technology',
        description: kbProduct?.description || (src.content || dbItem.content || '').slice(0, 300),
        category: meta.category || dbItem.category || 'general',
        brand: merged.brand,
        price_range: merged.price_range,
        product_url: finalProductUrl,
        source_url: finalProductUrl,
        image_url: toProxyImageUrl(thumbnail),
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
    
    // ⭐ Filter out invalid products (bots, invalid URLs, no images, garbage titles)
    suggestedProducts = suggestedProducts.filter((p: any) => {
      const botCheck = isBotEntry(p.title);
      const urlCheck = isValidProductUrl(p.product_url);
      // Filter out garbage titles (repeated chars like "kkkk", "aaaa", etc.)
      const titleLower = (p.title || '').toLowerCase();
      const garbageTitle = /^(.)\1{3,}$/.test(titleLower); // 4+ same chars repeated
      if (garbageTitle) console.log(`📦 [Filter GARBAGE] "${p.title}"`);
      console.log(`📦 [Filter] "${p.title}" | bot=${botCheck} | url_valid=${urlCheck} | url=${p.product_url}`);
      if (botCheck) return false;
      if (!urlCheck) return false;
      if (garbageTitle) return false;
      return true;
    });
    
    console.log(`📦 [getSuggestedProducts] Strategy 1 result: ${suggestedProducts.length} products (after filtering)`);
  }
  
  // Strategy 2: By category keyword (run ALWAYS if category detected, add more products)
  const contentLower = message.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    hearing: ['deaf', 'hear', 'ear', 'sound', 'điếc', 'thính', 'thính giác', 'hearing loss', 'audio', 'fm system', 'amplifier', 'microphone', 'streamer', 'signia', 'oticon', 'resound'],
    vision: ['blind', 'visual', 'eye', 'sight', 'mắt', 'thị giác', 'blindness', 'low vision', 'magnif', 'braille'],
    mobility: ['wheelchair', 'walk', 'move', 'physical', 'mobility', 'vận động', 'di chuyển', 'crutch', 'cane'],
    communication: ['speak', 'talk', 'communicate', 'voice', 'speech', 'giao tiếp', 'ngôn ngữ', 'aac'],
    cognition: ['memory', 'learn', 'cognitive', 'think', 'nhận thức', 'học tập'],
    daily_living: ['daily', 'living', 'self-care', 'sinh hoạt', 'ăn uống'],
    education: ['education', 'school', 'study', 'giáo dục', 'học'],
  };
  
  // Map detected category keyword to actual database category
  const DETECTED_TO_DB_CATEGORY: Record<string, string> = {
    hearing: 'sensory-hearing',
    vision: 'sensory-vision',
    mobility: 'mobility-and-transportation',
    communication: 'voice-and-speech',
    cognition: 'mental-cognitive',
    daily_living: 'daily-living',
    education: 'education',
  };
  
  let detectedCat: string | null = null;
  let detectedDbCategory: string | null = null;
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
      detectedCat = cat;
      detectedDbCategory = DETECTED_TO_DB_CATEGORY[cat] || cat;
      break;
    }
  }
  
  if (detectedCat && detectedDbCategory) {
    console.log(`📦 [getSuggestedProducts] Strategy 2: Detected keyword "${detectedCat}" → DB category "${detectedDbCategory}", adding more products`);
    
    // Collect existing product URLs to avoid duplicates
    const existingUrls = new Set(suggestedProducts.map((p: any) => p.product_url?.replace(/\/$/, '')));
    console.log(`📦 [Strategy2] existingUrls:`, [...existingUrls]);
    
    try {
      // Use the mapped DB category
      const madaItems = db.prepare(`
        SELECT id, title, content, source, url, category, language, metadata
        FROM knowledge_items
        WHERE category = ? AND source LIKE '%MADA%' AND status IN ('draft','published','approved')
        ORDER BY confidence DESC, created_at DESC LIMIT 10
      `).all(detectedDbCategory) as any[];
      
      console.log(`📦 [Strategy2] Query for category "${detectedDbCategory}" returned ${madaItems.length} items`);
      
      console.log(`📦 [Strategy2] Query returned ${madaItems.length} items`);
      
      const isValidTitle = (title: string): boolean => {
        if (!title || title.length < 3) return false;
        const lower = title.toLowerCase();
        if (/^(.)\1+$/.test(lower)) return false;
        if (/^(test|test123|abcd|qwerty)/i.test(lower)) return false;
        return true;
      };
      
      const newProducts = madaItems
        .filter((item: any) => {
          const urlKey = (item.url || item.source || '').replace(/\/$/, '');
          const isValid = isValidTitle(item.title) && !existingUrls.has(urlKey);
          if (!isValid) {
            console.log(`📦 [Strategy2 Filter OUT] "${item.title}" - validTitle=${isValidTitle(item.title)}, inExisting=${existingUrls.has(urlKey)}, url="${urlKey}"`);
          }
          return isValid;
        })
        .map((item: any) => {
          const url = item.url || item.source || '';
          let thumbnail = '';
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            thumbnail = meta?.thumbnailUrl || meta?.image_url || '';
            if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';
          } catch { /* ignore */ }
          if (!thumbnail && url) {
            thumbnail = getProductFromDb(url)?.image_url || '';
          }
          
          const detailedMeta = parseDetailedMetadata(item.metadata);
          const contentData = extractStructuredDataFromContent(item.content || '', effectiveLanguage);
          const merged = { ...detailedMeta, ...contentData };
          
          return {
            id: item.id,
            title: item.title,
            title_en: item.title,
            description: (item.content || '').slice(0, 300),
            category: item.category,
            brand: 'MADA Qatar AT Portal',
            price_range: 'Contact MADA Center',
            product_url: url,
            source_url: url,
            image_url: toProxyImageUrl(thumbnail),
            confidence: 0.6,
            match_reason: getMatchReason(effectiveLanguage, 'category', detectedDbCategory!),
            patient_indications: merged.patient_indications || [],
            medical_indications: merged.medical_indications || [],
            contraindications: merged.contraindications || [],
            specifications: merged.specifications || [],
            compatibility: merged.compatibility || [],
            financial_support: merged.financial_support || [],
            insurance_coverage: merged.insurance_coverage || [],
            mada_advice: merged.mada_advice || '',
            warranty: merged.warranty || '',
            features: merged.features || [],
            standards: merged.standards || [],
          };
        });
      
      // Add new products to existing list
      suggestedProducts.push(...newProducts);
      
      // Final deduplicate and filter
      const seenUrls = new Set<string>();
      suggestedProducts = suggestedProducts.filter((p: any) => {
        const urlKey = (p.product_url || '').replace(/\/$/, '');
        if (seenUrls.has(urlKey)) return false;
        seenUrls.add(urlKey);
        if (isBotEntry(p.title)) return false;
        if (!isValidProductUrl(p.product_url)) return false;
        return true;
      });
      
      // Limit to max 12 products
      suggestedProducts = suggestedProducts.slice(0, 12);
      
      console.log(`📦 [getSuggestedProducts] Strategy 2: Added ${newProducts.length} products, total: ${suggestedProducts.length}`);
    } catch (dbErr) {
      console.log('⚠️ Strategy 2 error:', dbErr);
    }
  }
  
  console.log(`📦 [getSuggestedProducts] FINAL: ${suggestedProducts.length} products`);

  // ⭐ Strategy 3: Featured MADA items (only if still empty)
  if (suggestedProducts.length === 0) {
    console.log(`📦 [getSuggestedProducts] Strategy 3: Trying featured MADA items`);
    try {
      // Get featured products first, then fallback to most recent
      const featuredMada = db.prepare(`
        SELECT id, title, content, source, url, category, language, metadata
        FROM knowledge_items
        WHERE source LIKE '%MADA%' AND status IN ('draft','published','approved')
        ORDER BY confidence DESC, created_at DESC
        LIMIT 12
      `).all() as any[];
      
      // ⭐ Filter out test/invalid titles
      const isValidTitle = (title: string): boolean => {
        if (!title || title.length < 3) return false;
        const lower = title.toLowerCase();
        if (/^(.)\1+$/.test(lower)) return false; // 'aaaa', 'kkkk'
        if (/^(test|test123|abcd|qwerty)/i.test(lower)) return false;
        if (/^[a-z]{1,2}$/.test(lower) && !['tv', 'pc', 'ai', 'at', 'it', 'ok', 'ip'].includes(lower)) return false;
        return true;
      };
      
      const validProducts = featuredMada.filter((item: any) => isValidTitle(item.title));
      
      // Only show products if we have valid ones
      if (validProducts.length > 0) {
        suggestedProducts = validProducts.map((item: any) => {
          const url = item.url || item.source || '';
          let thumbnail = '';
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            thumbnail = meta?.thumbnailUrl || meta?.image_url || '';
            if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';
          } catch { /* ignore */ }
          // Fallback: look up image from kb_products table
          if (!thumbnail && url) {
            thumbnail = getProductFromDb(url)?.image_url || '';
          }
          
          // Parse detailed metadata
          const detailedMeta = parseDetailedMetadata(item.metadata);
          
          // Extract from content
          const contentData = extractStructuredDataFromContent(item.content || '', effectiveLanguage);
          const merged = { ...detailedMeta, ...contentData };
          
          return {
            id: item.id,
            title: item.title,
            title_en: item.title,
            description: (item.content || '').slice(0, 300),
            category: item.category,
            brand: 'MADA Qatar AT Portal',
            price_range: 'Contact MADA Center',
            product_url: url,
            source_url: url,
            image_url: toProxyImageUrl(thumbnail),
            confidence: 0.6,
            match_reason: getMatchReason(effectiveLanguage, 'found'),
            // Detailed fields
            patient_indications: merged.patient_indications || [],
            medical_indications: merged.medical_indications || [],
            contraindications: merged.contraindications || [],
            specifications: merged.specifications || [],
            compatibility: merged.compatibility || [],
            financial_support: merged.financial_support || [],
            insurance_coverage: merged.insurance_coverage || [],
            mada_advice: merged.mada_advice || '',
            warranty: merged.warranty || '',
            features: merged.features || [],
            standards: merged.standards || [],
          };
        });
        
        // ⭐ Filter out invalid products (bots, invalid URLs)
        suggestedProducts = suggestedProducts.filter((p: any) => {
          if (isBotEntry(p.title)) return false;
          if (!isValidProductUrl(p.product_url)) return false;
          return true;
        });
      }
      console.log(`📦 [getSuggestedProducts] Strategy 3: ${validProducts.length} valid items, ${featuredMada.length} total`);
      // If no valid products found, return empty array (don't show garbage)
    } catch (dbErr) { /* ignore */ }
  }
  
  // Final cap at 12 products
  suggestedProducts = suggestedProducts.slice(0, 12);
  
  console.log(`📦 [getSuggestedProducts] FINAL: ${suggestedProducts.length} products`);
  return suggestedProducts;
}

router.post('/', async (req, res) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;
    
    // Skip RAG ready check for faster testing (products can work without RAG)
    // const ready = await waitForRagReady(2000);
    // if (!ready) { ... }
    
    const detectedLanguage = detectMessageLanguage(message);
    // ⭐ Ưu tiên detect từ message - nếu người dùng hỏi tiếng Anh thì reply tiếng Anh
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : ((uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : 'vi');
    
    console.log('🌍 Language settings:', { uiLanguage, detectedLanguage, effectiveLanguage, messagePreview: message?.slice(0, 30) });
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    const safetyScore = guardrails.calculateSafetyScore(message);
    
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: safetyScore,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
          conversationId: conversationId || uuidv4(),
        },
      });
    }
    
    // ⭐ Handle MADA_PRODUCT_REQUEST - Trả về sản phẩm theo category của bot
    const isProductRequest = message.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {
      console.log(`📦 [MADA_PRODUCT_REQUEST] Detected in non-stream! agentId: ${agentId}`);
      
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
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode);
    const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
    
    const ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (madaMapping) {
      ragConfig.botId = madaMapping.botId;
      ragConfig.madaCategory = madaMapping.madaCategory;
      ragConfig.priority = true;
    } else if (agentId) {
      // ⭐ Custom agent: filter by agentId to get agent's own KB docs
      ragConfig.agentId = agentId;
      ragConfig.priority = true;
    }
    
    console.log('🤖 Chat RAG config:', { 
      agentId, 
      isMadaBot: !!madaMapping, 
      ragConfig: { 
        hasAgentId: !!ragConfig.agentId, 
        hasBotId: !!ragConfig.botId,
        hasMadaCategory: !!ragConfig.madaCategory,
        priority: ragConfig.priority 
      }
    });
    
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
    
    // Validate response
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = guardrailsResult.redirectResponse || 'Response filtered by safety guardrails.';
    }
    
    // ⭐ Tự động gợi ý sản phẩm khi user hỏi về thiết bị/sản phẩm
    const suggestedProducts: any[] = [];
    if (shouldShowProducts(message)) {
      try {
        const products = await getSuggestedProducts(ragResponse.sources || [], message, effectiveLanguage);
        suggestedProducts.push(...products);
      } catch (suggErr) {
        console.log('⚠️ suggestedProducts error:', suggErr);
      }
    }
    
    // Store assistant response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    logActivity('info', `Chat: ${agentId || 'default'} - "${message.slice(0, 50)}..."`, 'Chat');
    
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
        suggestedProducts,
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
    const { message, conversationId, language: uiLanguage = 'vi', agentPrompt, attachments } = req.body;
    
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
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : ((uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : 'vi');
    
    console.log('📎 Chat with files:', { message: message?.slice(0, 50), fileCount: attachments?.length || 0, effectiveLanguage });
    
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
              console.log(`✅ Parsed ${result.type}: ${name} → ${result.text.length} chars`);
            } else {
              // Parse failed — include error info
              const displayName = name.length > 40 ? name.slice(0, 37) + '...' : name;
              fileContext += `\n\n⚠️ Không thể đọc file "${displayName}": ${result.error || 'Lỗi không xác định'}`;
              attachmentResults.push({ name, type: mimeType, success: false, error: result.error, fileType: result.type });
              console.log(`⚠️ Failed to parse ${name}: ${result.error}`);
            }
          } catch (attErr) {
            console.log('⚠️ Attachment processing error:', attErr);
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
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, 'endUser');
    const ragConfig: any = { 
      systemInstruction: agentInstruction, 
      language: effectiveLanguage,
    };
    
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
    
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = 'Response filtered by safety guardrails.';
    }
    
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
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;
    
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
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : ((uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : 'vi');
    
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    if (guardrailsResult.shouldRedirect) {
      sendEvent({ type: 'done', answer: guardrailsResult.redirectResponse, sources: [], detectedLanguage: effectiveLanguage });
      return res.end();
    }
    
    // ⭐ Handle MADA_PRODUCT_REQUEST - Trả về sản phẩm theo category của bot
    const isProductRequest = message.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {
      // Get agent mapping for category
      const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
      const madaCategory = madaMapping?.madaCategory || null;
      
      console.log(`📦 [MADA_PRODUCT_REQUEST] Detected! agentId: ${agentId}, madaCategory: ${madaCategory || 'all'}`);
      
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
    
    // Build RAG config
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode);
    const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
    
    let ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (madaMapping) {
      ragConfig.botId = madaMapping.botId;
      ragConfig.madaCategory = madaMapping.madaCategory;
      ragConfig.priority = true;
    } else if (agentId) {
      // ⭐ Custom agent: filter by agentId to get agent's own KB docs
      ragConfig.agentId = agentId;
      ragConfig.priority = true;
    }
    
    console.log('🤖 Stream Chat RAG config:', { 
      agentId, 
      isMadaBot: !!madaMapping, 
      ragConfig: { 
        hasAgentId: !!ragConfig.agentId, 
        hasBotId: !!ragConfig.botId,
        hasMadaCategory: !!ragConfig.madaCategory,
        priority: ragConfig.priority 
      }
    });
    
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
      const shouldShow = shouldShowProducts(message);
      console.log(`🔍 [STREAM] shouldShowProducts check: ${shouldShow} for message: "${message.substring(0, 80)}..."`);
      if (shouldShow) {
        try {
          const suggestedProducts = await getSuggestedProducts(streamResult.sources || [], message, effectiveLanguage);
          console.log(`📦 [STREAM] suggestedProducts count: ${suggestedProducts.length}, first title: ${suggestedProducts[0]?.title || 'N/A'}`);
          if (suggestedProducts.length > 0) {
            sendEvent({ type: 'suggestedProducts', suggestedProducts });
          }
        } catch (suggErr) {
          console.log('⚠️ suggestedProducts error:', suggErr);
        }
      }
      // Stream response
      if (streamResult.stream) {
        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            sendEvent({ type: 'chunk', chunk: chunkText });
          }
        }
      } else if (streamResult.answer) {
        sendEvent({ type: 'chunk', chunk: streamResult.answer });
      }
      
      sendEvent({
        type: 'done',
        conversationId: convId,
        confidence: streamResult.confidence || 0.5,
        detectedLanguage: effectiveLanguage,
      });
      
      chatHistory.get(convId)!.push({ role: 'assistant', content: streamResult.answer || '' });
      
    } catch (streamError) {
      console.error('❌ Stream error:', streamError);
      const errorMsg = streamError instanceof Error ? streamError.message : 'Stream failed';
      
      // ⭐ FALLBACK: Khi RAG/AI fail, vẫn trả lời được với basic response
      const isNetworkError = errorMsg.includes('fetch failed') || 
                            errorMsg.includes('ENOTFOUND') ||
                            errorMsg.includes('getaddrinfo') ||
                            errorMsg.includes('ECONNREFUSED');
      
      // ⭐ 429 Too Many Requests — API rate limit
      const is429Error = errorMsg.includes('429') || 
                         errorMsg.includes('Too Many Requests') ||
                         errorMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isNetworkError || is429Error) {
        const errorType = is429Error ? '429_RATE_LIMIT' : 'NETWORK_ERROR';
        console.log(`🔄 [FALLBACK ${errorType}] ${is429Error ? 'API rate limited, ' : ''}providing basic response`);
        
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
        // ⭐ FALLBACK: Vẫn gửi suggestedProducts nếu user hỏi về thiết bị/sản phẩm
        if (shouldShowProducts(message)) {
          try {
            const suggestedProducts = await getSuggestedProducts([], message, effectiveLanguage);
            if (suggestedProducts.length > 0) {
              sendEvent({ type: 'suggestedProducts', suggestedProducts });
            }
          } catch (suggErr) {
            console.log('⚠️ [FALLBACK] suggestedProducts error:', suggErr);
          }
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

    console.log('💡 Generating follow-up questions for:', userMessage.slice(0, 50));

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
      console.log('💡 Follow-up: No Gemini API key, returning fallback questions');
      return res.json({ success: true, data: { questions: generateFallbackFollowUps(userMessage, language), source: 'no_api_key' } });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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
    const { message, language = 'vi', agentId } = req.body;
    
    // ⭐ Detect language from message for product recommendations
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi');
    
    // ⭐ Handle MADA_PRODUCT_REQUEST
    const isProductRequest = message?.includes('[MADA_PRODUCT_REQUEST]');
    if (isProductRequest) {
      console.log(`📦 [Products API] MADA_PRODUCT_REQUEST detected! agentId: ${agentId}`);
      
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
    
    // Check if message is asking for products
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
    
    // Get products
    const products = await getSuggestedProducts([], message, effectiveLanguage);
    
    console.log(`📦 [Products API] Found ${products.length} products for: "${message.slice(0, 50)}..."`);
    
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
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : ((uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : 'vi');
    
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
    const effectiveLanguage = (detectedLanguage && detectedLanguage !== 'unknown') ? detectedLanguage : ((uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : 'vi');
    
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
    const agentInstruction = buildSystemPrompt(effectiveLanguage, validUserMode, agentPrompt);
    
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
    
    console.log('[DEBUG] Feedback questions from DB:', JSON.stringify(questions, null, 2));
    
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
