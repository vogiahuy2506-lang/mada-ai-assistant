/**
 * Admin Products Management Routes
 * CRUD for products linked to AT categories
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { logActivity } from '../index';
import { translateProduct, SupportedLanguage } from '../lib/translationService';
import { authenticate } from '../lib/auth';
import { syncProductToKnowledge, type KbProduct } from '../lib/syncKbProducts';

const router = express.Router();

// Apply authentication to all routes in this router
router.use(authenticate as any);

// ============== TYPES ==============

interface CategoryRow {
  id: string;
  name_vi: string;
  name_en: string;
  icon: string;
  sort_order: number;
  description_vi: string | null;
  description_en: string | null;
  related_url: string | null;
  product_link: string | null;
  created_at: string;
  updated_at: string | null;
}

// ============== CATEGORIES CRUD ==============

// GET all categories
router.get('/categories', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM kb_categories ORDER BY sort_order ASC').all() as CategoryRow[];
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single category
router.get('/categories/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id) as CategoryRow | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create category
router.post('/categories', (req, res) => {
  try {
    const { id, name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link } = req.body;

    if (!id || !name_vi || !name_en) {
      return res.status(400).json({ success: false, error: 'id, name_vi, name_en là bắt buộc' });
    }

    const now = new Date().toISOString();
    const finalId = id.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    db.prepare(`
      INSERT INTO kb_categories (id, name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalId,
      name_vi,
      name_en,
      icon || '📋',
      sort_order || 50,
      description_vi || null,
      description_en || null,
      related_url || null,
      product_link || null,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(finalId) as CategoryRow;
    logActivity('success', `Tạo danh mục: ${name_vi}`, 'Admin Products');
    res.json({ success: true, data: row, message: 'Đã tạo danh mục' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ success: false, error: 'ID danh mục đã tồn tại' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH update category
router.patch('/categories/:id', (req, res) => {
  try {
    const { name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link } = req.body;

    const existing = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    const sets: string[] = [];
    const params: any[] = [];

    if (name_vi !== undefined) { sets.push('name_vi = ?'); params.push(name_vi); }
    if (name_en !== undefined) { sets.push('name_en = ?'); params.push(name_en); }
    if (icon !== undefined) { sets.push('icon = ?'); params.push(icon); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (description_vi !== undefined) { sets.push('description_vi = ?'); params.push(description_vi); }
    if (description_en !== undefined) { sets.push('description_en = ?'); params.push(description_en); }
    if (related_url !== undefined) { sets.push('related_url = ?'); params.push(related_url); }
    if (product_link !== undefined) { sets.push('product_link = ?'); params.push(product_link); }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    db.prepare(`UPDATE kb_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id) as CategoryRow;
    logActivity('info', `Cập nhật danh mục: ${req.params.id}`, 'Admin Products');
    res.json({ success: true, data: row, message: 'Đã cập nhật danh mục' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE category
router.delete('/categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    // Prevent deleting 'general' and default categories
    const protectedIds = ['general', 'vision', 'hearing', 'mobility', 'cognition', 'communication', 'daily_living', 'education', 'web_accessibility'];
    if (protectedIds.includes(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Không thể xóa danh mục mặc định' });
    }

    db.prepare('DELETE FROM kb_categories WHERE id = ?').run(req.params.id);
    logActivity('warn', `Xóa danh mục: ${req.params.id}`, 'Admin Products');
    res.json({ success: true, message: 'Đã xóa danh mục' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== PRODUCTS CRUD ==============

// GET all products
router.get('/items', (req, res) => {
  try {
    const {
      q, category, status, featured,
      limit = '50', offset = '0', sort = 'created_at', order = 'DESC',
    } = req.query;

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      where.push('(title LIKE ? OR title_en LIKE ? OR description LIKE ? OR brand LIKE ?)');
      const kw = `%${q}%`;
      params.push(kw, kw, kw, kw);
    }
    if (category) { where.push('category = ?'); params.push(category); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (featured !== undefined) { where.push('featured = ?'); params.push(featured === 'true' ? 1 : 0); }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const allowedSorts = ['created_at', 'updated_at', 'title', 'sort_order', 'category'];
    const sortCol = allowedSorts.includes(String(sort)) ? String(sort) : 'created_at';
    const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const lim = Math.min(parseInt(String(limit)) || 50, 200);
    const off = Math.max(parseInt(String(offset)) || 0, 0);

    // Check if products table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'").get();
    if (!tableCheck) {
      return res.json({ success: true, data: { items: [], total: 0, limit: lim, offset: off } });
    }

    const rows = db.prepare(`
      SELECT * FROM kb_products
      ${whereStr}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, lim, off);

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM kb_products ${whereStr}`).get(...params) as any;

    res.json({
      success: true,
      data: {
        items: rows,
        total: countRow.total,
        limit: lim,
        offset: off,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single product
router.get('/items/:id', (req, res) => {
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'").get();
    if (!tableCheck) return res.status(404).json({ success: false, error: 'Product not found' });

    const row = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });

    const r = row as any;
    r.iso_codes = JSON.parse(r.iso_codes || '[]');

    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create product (with auto-translation to EN/AR/FR)
router.post('/items', async (req, res) => {
  try {
    const {
      title, title_en, description, description_en, content,
      category, brand, model, price_range, source_url, product_url,
      image_url, iso_codes, wcag_level, who_gate_area, status, featured, sort_order, language,
      skip_translation,
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'title và category là bắt buộc' });
    }

    const id = `prod_${uuidv4().slice(0, 12)}`;
    const now = new Date().toISOString();
    const sourceLang = (language || 'vi') as SupportedLanguage;

    // Prepare translations
    let translations = { title_en: '', title_ar: '', title_fr: '', description_en: '', description_ar: '', description_fr: '', content_en: '', content_ar: '', content_fr: '' };

    // Auto-translate if not skipping and Gemini API key is available
    if (!skip_translation && process.env.GEMINI_API_KEY) {
      try {
        translations = await translateProduct({
          title: title,
          description: description,
          content: content,
          sourceLang: sourceLang,
        });
        console.log(`✅ Translated product "${title}" to EN/AR/FR`);
      } catch (transErr) {
        console.warn('⚠️ Translation failed, continuing without translations:', transErr);
        // ⭐ Don't crash the request — just skip translation
      }
    } else if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY not set — skipping translation for product:', title);
    }

    // Use provided translations if available, otherwise use auto-generated
    const finalTitleEn = title_en || translations.title_en;
    const finalTitleAr = translations.title_ar;
    const finalTitleFr = translations.title_fr;
    const finalDescEn = description_en || translations.description_en;
    const finalDescAr = translations.description_ar;
    const finalDescFr = translations.description_fr;
    const finalContentEn = translations.content_en;
    const finalContentAr = translations.content_ar;
    const finalContentFr = translations.content_fr;

    db.prepare(`
      INSERT INTO kb_products (
        id, title, title_en, title_ar, title_fr,
        description, description_en, description_ar, description_fr, content,
        content_en, content_ar, content_fr,
        category, brand, model, price_range, source_url, product_url,
        image_url, iso_codes, wcag_level, who_gate_area, status, featured,
        sort_order, language, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, title, finalTitleEn || '', finalTitleAr || '', finalTitleFr || '',
      description || '', finalDescEn || '', finalDescAr || '', finalDescFr || '',
      content || '', finalContentEn || '', finalContentAr || '', finalContentFr || '',
      category, brand || '', model || '', price_range || '', source_url || '', product_url || '',
      image_url || '', JSON.stringify(iso_codes || []), wcag_level || '', who_gate_area || '',
      status || 'draft', featured ? 1 : 0, sort_order || 0, sourceLang,
      now, now
    );

    const row = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(id);
    logActivity('success', `Tạo sản phẩm: ${title} (tự động dịch EN/AR/FR)`, 'Admin Products');
    res.json({ success: true, data: row, message: 'Đã tạo sản phẩm', translations_generated: !!(finalTitleEn || finalTitleAr || finalTitleFr) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH update product
router.patch('/items/:id', (req, res) => {
  try {
    const allowed = [
      'title', 'title_en', 'description', 'description_en', 'content',
      'category', 'brand', 'model', 'price_range', 'source_url', 'product_url',
      'image_url', 'wcag_level', 'who_gate_area', 'status', 'featured', 'sort_order', 'language',
    ];

    const sets: string[] = [];
    const params: any[] = [];

    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }

    if (req.body.iso_codes !== undefined) {
      sets.push('iso_codes = ?');
      params.push(JSON.stringify(req.body.iso_codes));
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    db.prepare(`UPDATE kb_products SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    logActivity('info', `Cập nhật sản phẩm: ${req.params.id}`, 'Admin Products');
    res.json({ success: true, data: row, message: 'Đã cập nhật sản phẩm' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH re-translate product with AI
router.patch('/items/:id/translate', async (req, res) => {
  try {
    const { languages } = req.body; // e.g., ['en', 'ar', 'fr'] or all
    const targetLangs = languages || ['en', 'ar', 'fr'];

    const row = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Sản phẩm không tồn tại' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY chưa được cấu hình' });
    }

    const sourceLang = (row.language || 'vi') as SupportedLanguage;

    const translations = await translateProduct({
      title: row.title,
      description: row.description,
      content: row.content,
      sourceLang: sourceLang,
    });

    // Update only requested languages
    const sets = ['updated_at = ?'];
    const params: any[] = [new Date().toISOString()];

    if (targetLangs.includes('en')) {
      sets.push('title_en = ?', 'description_en = ?', 'content_en = ?');
      params.push(translations.title_en, translations.description_en, translations.content_en);
    }
    if (targetLangs.includes('ar')) {
      sets.push('title_ar = ?', 'description_ar = ?', 'content_ar = ?');
      params.push(translations.title_ar, translations.description_ar, translations.content_ar);
    }
    if (targetLangs.includes('fr')) {
      sets.push('title_fr = ?', 'description_fr = ?', 'content_fr = ?');
      params.push(translations.title_fr, translations.description_fr, translations.content_fr);
    }

    params.push(req.params.id);
    db.prepare(`UPDATE kb_products SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    logActivity('success', `Dịch lại sản phẩm: ${row.title}`, 'Admin Products');
    res.json({ success: true, data: updated, message: `Đã dịch sang ${targetLangs.join(', ')}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE product
router.delete('/items/:id', (req, res) => {
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'").get();
    if (!tableCheck) return res.status(404).json({ success: false, error: 'Product not found' });

    const row = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });

    db.prepare('DELETE FROM kb_products WHERE id = ?').run(req.params.id);
    logActivity('warn', `Xóa sản phẩm: ${(row as any).title}`, 'Admin Products');
    res.json({ success: true, message: 'Đã xóa sản phẩm' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH publish/unpublish product
router.post('/items/:id/publish', (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status không hợp lệ' });
    }
    db.prepare('UPDATE kb_products SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);
    res.json({ success: true, message: `Đã chuyển sang ${status}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== STATS ==============

router.get('/stats', (_req, res) => {
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'").get();
    
    let stats = { totalProducts: 0, published: 0, byCategory: [] as any[] };

    if (tableCheck) {
      const total = (db.prepare('SELECT COUNT(*) as c FROM kb_products').get() as any).c;
      const pub = (db.prepare(`SELECT COUNT(*) as c FROM kb_products WHERE status = 'published'`).get() as any).c;
      const byCategory = db.prepare(`
        SELECT category, COUNT(*) as count FROM kb_products
        GROUP BY category ORDER BY count DESC
      `).all() as any[];

      stats = { totalProducts: total, published: pub, byCategory };
    }

    const categories = db.prepare('SELECT * FROM kb_categories ORDER BY sort_order').all();

    res.json({ success: true, data: { ...stats, categories } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== BULK IMPORT ==============

router.post('/items/bulk', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items array là bắt buộc' });
    }

    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_products'").get();
    if (!tableCheck) {
      return res.status(400).json({ success: false, error: 'Products table chưa tồn tại' });
    }

    const stmt = db.prepare(`
      INSERT INTO kb_products (
        id, title, title_en, title_ar, title_fr,
        description, description_en, description_ar, description_fr, content,
        category, brand, model, price_range, source_url, product_url,
        image_url, iso_codes, wcag_level, who_gate_area, status, featured,
        sort_order, language, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let added = 0;
    // Track inserted product IDs and their status for syncing
    const insertedProducts: { id: string; status: string }[] = [];

    for (const item of items) {
      const id = `prod_${uuidv4().slice(0, 12)}`;
      const status = item.status || 'draft';
      stmt.run(
        id, item.title || '', item.title_en || '', '', '',
        item.description || '', item.description_en || '', '', '',
        item.content || '', item.category || 'general', item.brand || '', item.model || '',
        item.price_range || '', item.source_url || '', item.product_url || '',
        item.image_url || '', JSON.stringify(item.iso_codes || []), item.wcag_level || '',
        item.who_gate_area || '', status, item.featured ? 1 : 0,
        item.sort_order || 0, item.language || 'vi', now, now
      );
      added++;
      insertedProducts.push({ id, status });
    }

    // ⭐ Auto-sync published products to knowledge_items so AI/RAG can find them
    const syncResults: { id: string; action: string; knowledge_item_id?: string }[] = [];
    for (const p of insertedProducts) {
      if (p.status === 'published') {
        const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(p.id) as KbProduct | undefined;
        if (product) {
          const result = syncProductToKnowledge(product);
          syncResults.push({ id: p.id, action: result.action, knowledge_item_id: result.knowledge_item_id });
        }
      }
    }

    const publishedCount = insertedProducts.filter(p => p.status === 'published').length;
    const syncedCount = syncResults.length;

    logActivity('success', `Bulk import ${added} sản phẩm (${publishedCount} published, ${syncedCount} synced to KB)`, 'Admin Products');

    const needsReindex = syncedCount > 0;
    res.json({
      success: true,
      message: `Đã thêm ${added} sản phẩm`,
      details: {
        added,
        publishedCount,
        syncedToKnowledge: syncedCount,
        needsReindex,
        reindexMessage: needsReindex
          ? '⚠️ Cần chạy "Sync & Reindex Vector Store" để AI tìm được sản phẩm'
          : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
