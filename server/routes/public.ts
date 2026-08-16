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
  description: string;
  description_en: string;
  content: string;
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

function publishRow(row: ProductRow) {
  let iso: string[] = [];
  try {
    iso = JSON.parse(row.iso_codes || '[]');
  } catch {
    iso = [];
  }
  return { ...row, iso_codes: iso };
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
    } = req.query;

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
        items: rows.map(publishRow),
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
        product: publishRow(row),
        related: related.map(publishRow),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/search - alias for /products with q param, returns search-friendly format
router.get('/search', (req, res) => {
  try {
    const { q = '', limit = '20' } = req.query;
    const query = String(q).trim();
    const lim = Math.min(parseInt(String(limit)) || 20, 50);

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
        items: rows.map(publishRow),
        total: countRow.total,
        query,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/featured - featured products for homepage
router.get('/featured', (_, res) => {
  try {
    const rows = db
      .prepare(
        "SELECT * FROM kb_products WHERE status = 'published' AND featured = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 12"
      )
      .all() as ProductRow[];

    res.json({ success: true, data: rows.map(publishRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/public/stats - public stats for homepage
router.get('/stats', (_req, res) => {
  try {
    const total = (db.prepare("SELECT COUNT(*) as c FROM kb_products WHERE status = 'published'").get() as any)?.c || 0;
    const categories = (db.prepare('SELECT COUNT(*) as c FROM kb_categories').get() as any)?.c || 0;
    const brands = (db.prepare("SELECT COUNT(DISTINCT brand) as c FROM kb_products WHERE status = 'published' AND brand != ''").get() as any)?.c || 0;

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

export default router;
