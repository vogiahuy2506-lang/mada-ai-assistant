/**
 * Public Products API Routes
 * User-facing endpoints (no auth required)
 * Browse products, categories, search
 */

import express from 'express';
import db from '../lib/db';

const router = express.Router();

interface ProductRow {
  id: string;
  title: string;
  title_en: string;
  title_ar: string;
  title_fr: string;
  description: string;
  description_en: string;
  description_ar: string;
  description_fr: string;
  content: string;
  content_en: string;
  content_ar: string;
  content_fr: string;
  category: string;
  brand: string;
  model: string;
  price_range: string;
  source_url: string;
  product_url: string;
  image_url: string;
  iso_codes: string;
  wcag_level: string;
  who_gate_area: string;
  status: string;
  featured: number;
  sort_order: number;
  language: string;
  created_at: string;
  updated_at: string;
}

type SupportedLang = 'vi' | 'en' | 'ar' | 'fr';

function getLocalizedText(row: ProductRow, lang: SupportedLang): { title: string; description: string; content: string } {
  if (lang === 'en') return {
    title: row.title_en || row.title,
    description: row.description_en || row.description,
    content: row.content_en || row.content,
  };
  if (lang === 'ar') return {
    title: row.title_ar || row.title_en || row.title,
    description: row.description_ar || row.description_en || row.description,
    content: row.content_ar || row.content_en || row.content,
  };
  if (lang === 'fr') return {
    title: row.title_fr || row.title_en || row.title,
    description: row.description_fr || row.description_en || row.description,
    content: row.content_fr || row.content_en || row.content,
  };
  // Default: Vietnamese
  return {
    title: row.title,
    description: row.description,
    content: row.content,
  };
}

function publishRow(row: ProductRow, lang: SupportedLang = 'vi') {
  let iso: string[] = [];
  try {
    iso = JSON.parse(row.iso_codes || '[]');
  } catch {
    iso = [];
  }
  const localized = getLocalizedText(row, lang);
  return {
    ...row,
    title: localized.title,
    description: localized.description,
    content: localized.content,
    iso_codes: iso,
  };
}

// ============== CATEGORIES ==============

// GET /api/public/categories - list all categories
router.get('/categories', (_req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM kb_categories ORDER BY sort_order ASC')
      .all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/categories/:slug - single category
router.get('/categories/:slug', (req, res) => {
  try {
    const row = db
      .prepare('SELECT * FROM kb_categories WHERE id = ?')
      .get(req.params.slug);
    if (!row) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== PRODUCTS ==============

// GET /api/public/products - browse (status=published only)
router.get('/products', (req, res) => {
  try {
    const {
      q,
      category,
      brand,
      wcag_level,
      who_gate_area,
      featured,
      limit = '24',
      offset = '0',
      sort = 'created_at',
      order = 'DESC',
      lang = 'vi',
    } = req.query;

    // Validate language
    const userLang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(lang)) 
      ? String(lang) as SupportedLang 
      : 'vi';

    const where: string[] = ["status = 'published'"];
    const params: any[] = [];

    if (q) {
      where.push('(title LIKE ? OR title_en LIKE ? OR description LIKE ? OR description_en LIKE ? OR brand LIKE ? OR model LIKE ?)');
      const kw = `%${q}%`;
      params.push(kw, kw, kw, kw, kw, kw);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (brand) {
      where.push('brand = ?');
      params.push(brand);
    }
    if (wcag_level) {
      where.push('wcag_level = ?');
      params.push(wcag_level);
    }
    if (who_gate_area) {
      where.push('who_gate_area = ?');
      params.push(who_gate_area);
    }
    if (featured !== undefined) {
      where.push('featured = ?');
      params.push(featured === 'true' ? 1 : 0);
    }

    const whereStr = `WHERE ${where.join(' AND ')}`;
    const allowedSorts = ['created_at', 'updated_at', 'title', 'sort_order', 'category', 'brand'];
    const sortCol = allowedSorts.includes(String(sort)) ? String(sort) : 'created_at';
    const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const lim = Math.min(parseInt(String(limit)) || 24, 100);
    const off = Math.max(parseInt(String(offset)) || 0, 0);

    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'")
      .get();
    if (!tableCheck) {
      return res.json({
        success: true,
        data: { items: [], total: 0, limit: lim, offset: off },
      });
    }

    const rows = db
      .prepare(
        `SELECT * FROM kb_products ${whereStr} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
      )
      .all(...params, lim, off) as ProductRow[];

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM kb_products ${whereStr}`)
      .get(...params) as any;

    // Get facet counts (brands, categories) for filter UI
    const brandFacets = db
      .prepare(
        `SELECT brand, COUNT(*) as count FROM kb_products WHERE status = 'published' AND brand != '' GROUP BY brand ORDER BY count DESC LIMIT 30`
      )
      .all() as any[];

    const categoryFacets = db
      .prepare(
        `SELECT category, COUNT(*) as count FROM kb_products WHERE status = 'published' GROUP BY category ORDER BY count DESC`
      )
      .all() as any[];

    res.json({
      success: true,
      data: {
        items: rows.map(r => publishRow(r, userLang)),
        total: countRow.total,
        limit: lim,
        offset: off,
        facets: {
          brands: brandFacets,
          categories: categoryFacets,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/products/:id - product detail
router.get('/products/:id', (req, res) => {
  try {
    const lang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(req.query.lang))
      ? String(req.query.lang) as SupportedLang
      : 'vi';
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'")
      .get();
    if (!tableCheck) return res.status(404).json({ success: false, error: 'Product not found' });

    const row = db
      .prepare("SELECT * FROM kb_products WHERE id = ? AND status = 'published'")
      .get(req.params.id) as ProductRow | undefined;

    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });

    // Related products (same category, exclude self, limit 6)
    const related = db
      .prepare(
        `SELECT * FROM kb_products WHERE category = ? AND id != ? AND status = 'published' ORDER BY created_at DESC LIMIT 6`
      )
      .all(row.category, row.id) as ProductRow[];

    res.json({
      success: true,
      data: {
        product: publishRow(row, lang),
        related: related.map(r => publishRow(r, lang)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/search - alias for /products with q param, returns search-friendly format
router.get('/search', (req, res) => {
  try {
    const { q = '', limit = '20', lang = 'vi' } = req.query;
    const query = String(q).trim();
    const lim = Math.min(parseInt(String(limit)) || 20, 50);
    const userLang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(lang))
      ? String(lang) as SupportedLang
      : 'vi';

    if (!query) {
      return res.json({ success: true, data: { items: [], total: 0, query: '' } });
    }

    const kw = `%${query}%`;
    const rows = db
      .prepare(
        `SELECT * FROM kb_products
         WHERE status = 'published'
         AND (title LIKE ? OR title_en LIKE ? OR description LIKE ? OR description_en LIKE ? OR brand LIKE ? OR model LIKE ? OR category LIKE ?)
         ORDER BY
           CASE WHEN title LIKE ? THEN 1
                WHEN title_en LIKE ? THEN 2
                WHEN brand LIKE ? THEN 3
                ELSE 4 END,
           created_at DESC
         LIMIT ?`
      )
      .all(
        kw, kw, kw, kw, kw, kw, kw,
        kw, kw, kw,
        lim
      ) as ProductRow[];

    const countRow = db
      .prepare(
        `SELECT COUNT(*) as total FROM kb_products
         WHERE status = 'published'
         AND (title LIKE ? OR title_en LIKE ? OR description LIKE ? OR description_en LIKE ? OR brand LIKE ? OR model LIKE ? OR category LIKE ?)`
      )
      .get(kw, kw, kw, kw, kw, kw, kw) as any;

    res.json({
      success: true,
      data: {
        items: rows.map(r => publishRow(r, userLang)),
        total: countRow.total,
        query,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/featured - featured products for homepage
router.get('/featured', (req, res) => {
  try {
    const lang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(req.query.lang))
      ? String(req.query.lang) as SupportedLang
      : 'vi';
    // Query from knowledge_items (products scraped from MADA portal)
    const items = db
      .prepare(
        "SELECT * FROM knowledge_items WHERE status = 'published' AND source_type = 'web' ORDER BY created_at DESC LIMIT 12"
      )
      .all() as KnowledgeItemRow[];

    res.json({ success: true, data: items.map(r => publishRow(knowledgeItemToProductRow(r), lang)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⭐ NEW: Get products by agent ID (for ChatPage to know which products belong to which bot)
// ⭐ CRITICAL: Products have madaCategory as category (e.g., 'sensory-vision', 'mental-cognitive')
const AGENT_TO_MADA_PUBLIC: Record<string, { madaCategory: string; productCategory: string }> = {
  'bot-hearing':    { madaCategory: 'sensory-hearing',          productCategory: 'sensory-hearing' },
  'bot-vision':     { madaCategory: 'sensory-vision',           productCategory: 'sensory-vision' },
  'bot-speech':     { madaCategory: 'voice-and-speech',         productCategory: 'voice-and-speech' },
  'bot-cognitive':  { madaCategory: 'mental-cognitive',         productCategory: 'mental-cognitive' },
  'bot-neuro':      { madaCategory: 'neuromusculoskeletal-movement', productCategory: 'neuromusculoskeletal-movement' },
  'bot-mobility':   { madaCategory: 'mobility-and-transportation',    productCategory: 'mobility-and-transportation' },
  'bot-regulatory': { madaCategory: 'regulatory-standards',     productCategory: 'regulatory-standards' },
};

// Transform knowledge_items row to ProductRow format for compatibility
interface KnowledgeItemRow {
  id: string;
  title: string;
  title_en: string | null;
  title_ar: string | null;
  title_fr: string | null;
  description: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_fr: string | null;
  content: string | null;
  content_en: string | null;
  content_ar: string | null;
  content_fr: string | null;
  category: string;
  iso_codes: string | null;
  wcag_level: string | null;
  who_gate_area: string | null;
  status: string;
  language: string;
  url: string | null;
  metadata: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function knowledgeItemToProductRow(item: KnowledgeItemRow): ProductRow {
  let metadata: any = {};
  try {
    metadata = item.metadata ? JSON.parse(item.metadata) : {};
  } catch { /* ignore */ }
  
  return {
    id: item.id,
    title: item.title || '',
    title_en: item.title_en || '',
    title_ar: item.title_ar || '',
    title_fr: item.title_fr || '',
    description: item.description || '',
    description_en: item.description_en || '',
    description_ar: item.description_ar || '',
    description_fr: item.description_fr || '',
    content: item.content || '',
    content_en: item.content_en || '',
    content_ar: item.content_ar || '',
    content_fr: item.content_fr || '',
    category: item.category || '',
    brand: metadata.brand || '',
    model: metadata.model || '',
    price_range: metadata.priceRange || '',
    source_url: item.url || '',
    product_url: item.url || '',
    image_url: metadata.imageUrl || metadata.thumbnailUrl || '',
    iso_codes: item.iso_codes || '[]',
    wcag_level: item.wcag_level || '',
    who_gate_area: item.who_gate_area || '',
    status: item.status || 'draft',
    featured: metadata.featured || 0,
    sort_order: metadata.sortOrder || 0,
    language: item.language || 'vi',
    created_at: item.created_at || '',
    updated_at: item.updated_at || '',
  };
}

router.get('/products/by-agent/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const lang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(req.query.lang))
      ? String(req.query.lang) as SupportedLang
      : 'vi';
    const limit = Math.min(parseInt(String(req.query.limit)) || 12, 50);
    
    let productCategory: string | null = null;
    
    // Bước 1: Thử lookup từ database (agentId là UUID của agent trong admin_agents)
    try {
      const agentRow = db.prepare('SELECT mada_category FROM admin_agents WHERE id = ?').get(agentId) as any;
      if (agentRow?.mada_category) {
        productCategory = agentRow.mada_category;
        console.log(`📦 [by-agent] DB lookup for ${agentId}: mada_category=${agentRow.mada_category} → productCategory=${productCategory}`);
      }
    } catch (e) {
      console.warn(`[by-agent] DB lookup failed for ${agentId}:`, e);
    }
    
    // Bước 2: Fallback sang hardcoded mapping nếu agentId là bot ID (e.g., 'bot-vision')
    if (!productCategory && AGENT_TO_MADA_PUBLIC[agentId]) {
      productCategory = AGENT_TO_MADA_PUBLIC[agentId].productCategory;
      console.log(`📦 [by-agent] Hardcoded mapping for ${agentId}: productCategory=${productCategory}`);
    }
    
    // Query from knowledge_items (source_type='web' from MADA portal scrape)
    let items: KnowledgeItemRow[];
    if (productCategory) {
      // bot-regulatory → xem tất cả categories
      if (agentId === 'bot-regulatory') {
        items = db.prepare(
          "SELECT * FROM knowledge_items WHERE status = 'published' AND source_type = 'web' ORDER BY category ASC, created_at DESC LIMIT ?"
        ).all(limit) as KnowledgeItemRow[];
        console.log(`📦 [by-agent] Regulatory bot - returning all ${items.length} products`);
      } else {
        items = db.prepare(
          "SELECT * FROM knowledge_items WHERE category = ? AND status = 'published' AND source_type = 'web' ORDER BY created_at DESC LIMIT ?"
        ).all(productCategory, limit) as KnowledgeItemRow[];
        console.log(`📦 [by-agent] Category filter: ${productCategory} → ${items.length} products`);
      }
    } else {
      // Không xác định được category → trả về featured products
      items = db.prepare(
        "SELECT * FROM knowledge_items WHERE status = 'published' AND source_type = 'web' ORDER BY created_at DESC LIMIT ?"
      ).all(limit) as KnowledgeItemRow[];
      console.log(`📦 [by-agent] No category found - returning ${items.length} products`);
    }
    
    const rows = items.map(knowledgeItemToProductRow);

    res.json({
      success: true,
      data: {
        agentId,
        madaCategory: productCategory,
        products: rows.map(r => publishRow(r, lang)),
        total: rows.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/stats - public stats for homepage
router.get('/stats', (_req, res) => {
  try {
    // Query from knowledge_items (products scraped from MADA portal)
    const total = (db.prepare("SELECT COUNT(*) as c FROM knowledge_items WHERE status = 'published' AND source_type = 'web'").get() as any)?.c || 0;
    // Distinct categories from knowledge_items
    const catResult = db.prepare("SELECT COUNT(DISTINCT category) as c FROM knowledge_items WHERE status = 'published' AND source_type = 'web' AND category != ''").get() as any;
    const categories = catResult?.c || 0;
    // Distinct sources (brands/manufacturers from metadata)
    const brandResult = db.prepare("SELECT COUNT(DISTINCT json_extract(metadata, '$.brand')) as c FROM knowledge_items WHERE status = 'published' AND source_type = 'web' AND metadata LIKE '%brand%'").get() as any;
    const brands = brandResult?.c || 0;

    res.json({
      success: true,
      data: {
        totalProducts: total,
        totalCategories: categories,
        totalBrands: brands,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/public/track - Track chat metrics (no auth, fire-and-forget)
router.post('/track', (_req, res) => {
  res.json({ success: true });
});

// ============== AGENTS (active only, no auth) ==============
// GET /api/public/agents - List active agents for chat UI / AgentCustomizer
// NOTE: Only returns agents with is_active=1 so anonymous users see the
// published catalogue. Admin CRUD still goes through /api/admin/agents.
router.get('/agents', (_req, res) => {
  try {
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_agents'")
      .get();
    if (!tableCheck) {
      return res.json({ success: true, data: [] });
    }

    const rows = db
      .prepare(
        'SELECT * FROM admin_agents WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
      )
      .all() as any[];

    const parsed = rows.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      avatar: a.avatar || '🤖',
      system_prompt: a.system_prompt || '',
      systemPrompt: a.system_prompt || '',
      capabilities: (() => {
        try {
          return JSON.parse(a.capabilities || '[]');
        } catch {
          return [];
        }
      })(),
      isActive: a.is_active === 1,
      is_active: a.is_active === 1,
      madaCategory: a.mada_category || a.madaCategory || null,
      mada_category: a.mada_category || null,
      botId: a.bot_id || a.botId || null,
      bot_id: a.bot_id || null,
      promptId: a.prompt_id || a.promptId || null,
      prompt_id: a.prompt_id || null,
      avatarUrl: a.avatar_url || a.avatarUrl || null,
      avatar_url: a.avatar_url || null,
      knowledgeUrl: a.knowledge_url || a.knowledgeUrl || null,
      knowledge_url: a.knowledge_url || null,
      productUrl: a.product_url || a.productUrl || null,
      product_url: a.product_url || null,
      sort_order: a.sort_order ?? 0,
      sortOrder: a.sort_order ?? 0,
      createdAt: a.created_at,
      created_at: a.created_at,
      updatedAt: a.updated_at,
      updated_at: a.updated_at,
    }));

    res.json({ success: true, data: parsed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== PRICING PLANS (Public - for PaywallModal) ==============
// GET /api/public/pricing-plans - Get active pricing plans (no auth required)

function parsePublicPlanRow(row: any, lang: SupportedLang) {
  return {
    id: row.id,
    planKey: row.plan_key,
    name: row[`name_${lang}`] || row.name_vi,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    priceNote: row[`price_note_${lang}`] || row.price_note_vi,
    description: row[`description_${lang}`] || row.description_vi,
    features: (() => {
      try {
        return JSON.parse(row[`features_${lang}`] || row.features_vi || '[]');
      } catch {
        return [];
      }
    })(),
    isHighlighted: row.is_highlighted === 1,
    ctaText: row[`cta_text_${lang}`] || row.cta_text_vi,
  };
}

router.get('/pricing-plans', (req, res) => {
  try {
    const lang: SupportedLang = ['vi', 'en', 'ar', 'fr'].includes(String(req.query.lang))
      ? String(req.query.lang) as SupportedLang
      : 'vi';

    // Check if table exists
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pricing_plans'")
      .get();
    if (!tableCheck) {
      return res.json({
        success: true,
        data: [],
        message: 'Pricing plans table not found',
      });
    }

    const rows = db
      .prepare('SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC')
      .all();

    res.json({
      success: true,
      data: rows.map((row: any) => parsePublicPlanRow(row, lang)),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
