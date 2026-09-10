import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../lib/db';
import { syncProductToKnowledge, syncAllPublishedProducts } from '../lib/syncKbProducts';
import { syncItemToVector } from '../lib/syncItemToVector';

const router = Router();

// Middleware: require admin authentication
function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const token = auth.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    // Allow both admin and super_admin to access admin routes
    if (!['admin', 'super_admin'].includes(payload.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// Middleware: require super_admin authentication (highest privilege)
function requireSuperAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const token = auth.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (payload.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Super Admin access required' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ============== CATEGORIES ==============

// GET /api/admin/categories
router.get('/categories', (_req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM kb_categories ORDER BY sort_order ASC').all();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/categories
router.post('/categories', requireAdmin, (req, res) => {
  try {
    const { id, name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link } = req.body;
    
    if (!id || !name_vi || !name_en) {
      return res.status(400).json({ success: false, error: 'ID, name_vi, and name_en are required' });
    }
    
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO kb_categories (id, name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name_vi,
      name_en,
      icon || '📋',
      sort_order || 50,
      description_vi || '',
      description_en || '',
      related_url || '',
      product_link || '',
      now,
      now
    );
    
    const category = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/categories/:id
router.patch('/categories/:id', requireAdmin, (req, res) => {
  try {
    const { name_vi, name_en, icon, sort_order, description_vi, description_en, related_url, product_link } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (name_vi !== undefined) { updates.push('name_vi = ?'); params.push(name_vi); }
    if (name_en !== undefined) { updates.push('name_en = ?'); params.push(name_en); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (description_vi !== undefined) { updates.push('description_vi = ?'); params.push(description_vi); }
    if (description_en !== undefined) { updates.push('description_en = ?'); params.push(description_en); }
    if (related_url !== undefined) { updates.push('related_url = ?'); params.push(related_url); }
    if (product_link !== undefined) { updates.push('product_link = ?'); params.push(product_link); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    
    db.prepare(`UPDATE kb_categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const category = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', requireAdmin, (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    // Check if there are products in this category
    const productCount = db.prepare('SELECT COUNT(*) as count FROM kb_products WHERE category = ?').get(req.params.id) as { count: number };
    if (productCount.count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete category with ${productCount.count} products. Move or delete products first.` 
      });
    }
    
    db.prepare('DELETE FROM kb_categories WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PRODUCTS ==============

// GET /api/admin/products
router.get('/products', (req, res) => {
  try {
    const { q, category, featured, status, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM kb_products WHERE 1=1';
    const params: any[] = [];
    
    if (q) {
      sql += ' AND (title LIKE ? OR title_en LIKE ? OR description LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (featured === 'true') {
      sql += ' AND featured = 1';
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const products = db.prepare(sql).all(...params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM kb_products WHERE 1=1';
    const countParams: any[] = [];
    
    if (q) {
      countSql += ' AND (title LIKE ? OR title_en LIKE ? OR description LIKE ?)';
      const searchTerm = `%${q}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }
    if (featured === 'true') {
      countSql += ' AND featured = 1';
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    
    const { total } = db.prepare(countSql).get(...countParams) as { total: number };
    
    res.json({ success: true, data: { items: products, total } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products
router.post('/products', requireAdmin, (req, res) => {
  try {
    const {
      title, title_en, description, description_en, content, category,
      brand, model, price_range, source_url, product_url, image_url,
      iso_codes, wcag_level, who_gate_area, status, featured, sort_order, language
    } = req.body;
    
    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'Title and category are required' });
    }
    
    const now = new Date().toISOString();
    const id = `prod-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO kb_products (
        id, title, title_en, description, description_en, content, category,
        brand, model, price_range, source_url, product_url, image_url,
        iso_codes, wcag_level, who_gate_area, status, featured, sort_order, language,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      title_en || '',
      description || '',
      description_en || '',
      content || '',
      category,
      brand || '',
      model || '',
      price_range || '',
      source_url || '',
      product_url || '',
      image_url || '',
      JSON.stringify(Array.isArray(iso_codes) ? iso_codes : []),
      wcag_level || '',
      who_gate_area || '',
      status || 'draft',
      featured ? 1 : 0,
      sort_order || 0,
      language || 'vi',
      (req as any).user?.id || null,
      now,
      now
    );
    
    const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/products/:id
router.patch('/products/:id', requireAdmin, (req, res) => {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    
    const fields = [
      'title', 'title_en', 'description', 'description_en', 'content', 'category',
      'brand', 'model', 'price_range', 'source_url', 'product_url', 'image_url',
      'iso_codes', 'wcag_level', 'who_gate_area', 'status', 'featured', 'sort_order', 'language'
    ];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'iso_codes' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        if (field === 'featured') {
          value = value ? 1 : 0;
        }
        params.push(value);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    
    db.prepare(`UPDATE kb_products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', requireAdmin, (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    db.prepare('DELETE FROM kb_products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/:id/publish
router.post('/products/:id/publish', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    db.prepare('UPDATE kb_products SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);

    const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id) as any;

    // ⭐ Auto-sync sang knowledge_items để AI/RAG có thể tìm thấy
    let syncResult: any = null;
    try {
      syncResult = syncProductToKnowledge(product);
      console.log(`📦 [publish] Synced product ${product.id} (${product.title}) → ${syncResult.action} (knowledge_item: ${syncResult.knowledge_item_id})`);
    } catch (syncErr: any) {
      console.error(`⚠️ [publish] Failed to sync ${product.id} to knowledge_items:`, syncErr.message);
    }

    // ⭐ Auto-upsert lên vector store ngay lập tức (không cần chạy script tay)
    let vectorResult: any = null;
    if (syncResult?.knowledge_item_id && status === 'published') {
      try {
        vectorResult = await syncItemToVector(syncResult.knowledge_item_id);
        console.log(`🔎 [publish] Vector sync ${product.id} → ${vectorResult.indexed ? '✅ indexed' : '❌ failed: ' + vectorResult.error}`);
      } catch (vecErr: any) {
        console.error(`⚠️ [publish] Vector sync failed for ${product.id}:`, vecErr.message);
      }
    }

    res.json({
      success: true,
      data: product,
      sync: syncResult,
      vector: vectorResult, // trả về cho client biết
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== BULK PUBLISH (FAST) ==============
// POST /api/admin/products/bulk-publish
// Body: { ids?: string[], scope?: 'all_unpublished' | 'selected' }
// - Nếu scope='all_unpublished' → publish tất cả SP đang không phải 'published'
// - Nếu scope='selected' → publish theo ids[]
// ⭐ Tối ưu: UPDATE + sync knowledge_items chạy song song (Promise.all),
//   vector embedding chạy nền (fire-and-forget) → response trả về ngay trong <1s
router.post('/products/bulk-publish', requireAdmin, async (req, res) => {
  try {
    const { ids, scope = 'selected' } = req.body || {};
    const now = new Date().toISOString();

    let targetIds: string[] = [];
    if (scope === 'all_unpublished') {
      const rows = db.prepare("SELECT id FROM kb_products WHERE status != 'published'").all() as { id: string }[];
      targetIds = rows.map((r) => r.id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids;
    } else {
      return res.status(400).json({ success: false, error: 'ids[] hoặc scope=all_unpublished là bắt buộc' });
    }

    if (targetIds.length === 0) {
      return res.json({ success: true, updated: 0, message: 'Không có sản phẩm nào cần cập nhật' });
    }

    // 1) UPDATE status='published' cho tất cả trong1 lệnh SQL
    const placeholders = targetIds.map(() => '?').join(',');
    const updateResult = db.prepare(
      `UPDATE kb_products SET status = 'published', updated_at = ? WHERE id IN (${placeholders})`
    ).run(now, ...targetIds);

    // 2) Sync sang knowledge_items song song (nhanh - chỉ SQL)
    const syncResults: { id: string; action: string; knowledge_item_id?: string; error?: string }[] = [];
    await Promise.all(
      targetIds.map(async (id) => {
        try {
          const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(id) as any;
          if (!product) {
            syncResults.push({ id, action: 'skip', error: 'not_found' });
            return;
          }
          const r = syncProductToKnowledge(product);
          syncResults.push({ id, action: r.action, knowledge_item_id: r.knowledge_item_id });
          // 3) Vector sync chạy nền (fire-and-forget) - không block response
          if (r.knowledge_item_id) {
            syncItemToVector(r.knowledge_item_id)
              .then((v) => console.log(`🔎 [bulk-publish] Vector ${id} → ${v.indexed ? '✅' : '❌ ' + v.error}`))
              .catch((e) => console.error(`⚠️ [bulk-publish] Vector ${id} failed:`, e?.message));
          }
        } catch (e: any) {
          syncResults.push({ id, action: 'error', error: e?.message });
        }
      })
    );

    res.json({
      success: true,
      updated: updateResult.changes,
      scope,
      sync: syncResults,
      message: `Đã đăng ${updateResult.changes} sản phẩm (vector sync đang chạy nền)`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/bulk-unpublish
// Body: { ids?: string[], scope?: 'all_published' | 'selected' }
router.post('/products/bulk-unpublish', requireAdmin, (req, res) => {
  try {
    const { ids, scope = 'selected' } = req.body || {};
    const now = new Date().toISOString();

    let targetIds: string[] = [];
    if (scope === 'all_published') {
      const rows = db.prepare("SELECT id FROM kb_products WHERE status = 'published'").all() as { id: string }[];
      targetIds = rows.map((r) => r.id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids;
    } else {
      return res.status(400).json({ success: false, error: 'ids[] hoặc scope=all_published là bắt buộc' });
    }

    if (targetIds.length === 0) {
      return res.json({ success: true, updated: 0, message: 'Không có sản phẩm nào cần cập nhật' });
    }

    const placeholders = targetIds.map(() => '?').join(',');
    const updateResult = db.prepare(
      `UPDATE kb_products SET status = 'draft', updated_at = ? WHERE id IN (${placeholders})`
    ).run(now, ...targetIds);

    res.json({
      success: true,
      updated: updateResult.changes,
      scope,
      message: `Đã bỏ đăng ${updateResult.changes} sản phẩm`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ADMIN AGENTS ==============

// GET /api/admin/agents
router.get('/agents', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM admin_agents ORDER BY created_at DESC').all() as any[];
    const parsed = rows.map((a: any) => {
      let caps: any[] = [];
      try { caps = JSON.parse(a.capabilities || '[]'); } catch { caps = []; }
      return {
        ...a,
        capabilities: caps,
        isActive: a.is_active === 1,
        promptId: a.prompt_id || null,
      };
    });
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[GET /admin/agents] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/agents
router.post('/agents', requireAdmin, (req, res) => {
  try {
    const {
      id, name, description, avatar, system_prompt, capabilities,
      is_active, mada_category, bot_id, prompt_id,
      avatar_url, knowledge_url, product_url,
    } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({ success: false, error: 'Name and system_prompt are required' });
    }

    const now = new Date().toISOString();
    const agentId = id || `agent-${uuidv4()}`;

    db.prepare(`
      INSERT INTO admin_agents (
        id, name, description, avatar, system_prompt, capabilities, is_active,
        created_by, mada_category, bot_id, prompt_id,
        avatar_url, knowledge_url, product_url,
        last_crawl_at, last_crawl_status, last_crawl_count,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentId,
      name,
      description || '',
      avatar || '🤖',
      system_prompt,
      JSON.stringify(Array.isArray(capabilities) ? capabilities : []),
      is_active !== false ? 1 : 0,
      (req as any).user?.id || null,
      mada_category || null,
      bot_id || null,
      prompt_id || null,
      avatar_url || null,
      knowledge_url || null,
      product_url || null,
      null, // last_crawl_at
      null, // last_crawl_status
      0,    // last_crawl_count
      now,
      now
    );

    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(agentId) as any;
    res.status(201).json({
      success: true,
      data: { ...agent, capabilities: JSON.parse(agent.capabilities), isActive: agent.is_active === 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/agents/:id
router.patch('/agents/:id', requireAdmin, (req, res) => {
  try {
    const updates: string[] = [];
    const params: any[] = [];

    const fields = [
      'name', 'description', 'avatar', 'system_prompt', 'capabilities',
      'is_active', 'mada_category', 'prompt_id',
      'avatar_url', 'knowledge_url', 'product_url',
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'capabilities' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        if (field === 'is_active') {
          value = value ? 1 : 0;
        }
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    db.prepare(`UPDATE admin_agents SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(req.params.id) as any;
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({
      success: true,
      data: { ...agent, capabilities: JSON.parse(agent.capabilities), isActive: agent.is_active === 1 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/agents/:id
router.delete('/agents/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM admin_agents WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ADMIN SYSTEM PROMPTS CRUD (admin_prompts table) ==============

// GET /api/admin/system-prompts — list all prompts (public for agent store)
router.get('/system-prompts', (req, res) => {
  try {
    const { active, category, language } = req.query;
    let query = 'SELECT * FROM admin_prompts WHERE 1=1';
    const params: any[] = [];
    if (active !== undefined) { query += ' AND is_active = ?'; params.push(active === 'true' ? 1 : 0); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (language) { query += ' AND language = ?'; params.push(language); }
    query += ' ORDER BY is_system DESC, name ASC';
    const prompts = db.prepare(query).all(...params) as any[];
    const parsed = prompts.map((p: any) => ({
      id: p.id, name: p.name, description: p.description, prompt: p.prompt,
      category: p.category, language: p.language, isActive: p.is_active === 1,
      isSystem: p.is_system === 1, createdAt: p.created_at, updatedAt: p.updated_at,
    }));
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/system-prompts — create prompt
router.post('/system-prompts', requireAdmin, (req, res) => {
  try {
    const { id, name, description, prompt, category, language, is_active } = req.body;
    if (!id || !name || !prompt) {
      return res.status(400).json({ success: false, error: 'id, name, and prompt are required' });
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_prompts (id, name, description, prompt, category, language, is_active, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, name, description || '', prompt, category || 'general', language || 'vi', is_active !== false ? 1 : 0, now, now);
    res.status(201).json({
      success: true,
      data: { id, name, description: description || '', prompt, category: category || 'general', language: language || 'vi', isActive: is_active !== false, isSystem: false, createdAt: now, updatedAt: now },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/system-prompts/:id — get single prompt
router.get('/system-prompts/:id', (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM admin_prompts WHERE id = ?').get(req.params.id) as any;
    if (!p) return res.status(404).json({ success: false, error: 'Prompt not found' });
    res.json({
      success: true,
      data: { id: p.id, name: p.name, description: p.description, prompt: p.prompt, category: p.category, language: p.language, isActive: p.is_active === 1, isSystem: p.is_system === 1, createdAt: p.created_at, updatedAt: p.updated_at },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/system-prompts/:id — update prompt
router.patch('/system-prompts/:id', requireAdmin, (req, res) => {
  try {
    const fields = ['name', 'description', 'prompt', 'category', 'language', 'is_active'];
    const updates: string[] = [];
    const params: any[] = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'is_active') value = value ? 1 : 0;
        params.push(value);
      }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No updates provided' });
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    db.prepare(`UPDATE admin_prompts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const p = db.prepare('SELECT * FROM admin_prompts WHERE id = ?').get(req.params.id) as any;
    if (!p) return res.status(404).json({ success: false, error: 'Prompt not found' });
    res.json({
      success: true,
      data: { id: p.id, name: p.name, description: p.description, prompt: p.prompt, category: p.category, language: p.language, isActive: p.is_active === 1, isSystem: p.is_system === 1, createdAt: p.created_at, updatedAt: p.updated_at },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/system-prompts/:id — delete prompt (warn if agents use it)
router.delete('/system-prompts/:id', requireAdmin, (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM admin_prompts WHERE id = ?').get(req.params.id) as any;
    if (!p) return res.status(404).json({ success: false, error: 'Prompt not found' });
    if (p.is_system === 1) {
      return res.status(403).json({ success: false, error: 'Cannot delete system prompt' });
    }
    const usingAgents = db.prepare("SELECT id, name FROM admin_agents WHERE prompt_id = ? AND is_active = 1").all(req.params.id) as any[];
    if (usingAgents.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Prompt is being used by ${usingAgents.length} active agent(s)`,
        usingAgents: usingAgents.map((a: any) => ({ id: a.id, name: a.name })),
        warning: 'Please reassign or deactivate these agents before deleting this prompt.',
      });
    }
    db.prepare('DELETE FROM admin_prompts WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Prompt deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/admin/agents/upload-avatar ==============
// Multipart upload file ảnh icon, lưu vào /data/uploads/agent-avatars/
// Trả về URL tương đối (/api/admin/agents/avatars/:filename) để frontend lưu vào avatar_url.

const AVATAR_DIR = path.join(process.cwd(), 'data', 'uploads', 'agent-avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `agent-${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh (PNG, JPG, WEBP, SVG, GIF)'));
    }
    cb(null, true);
  },
});

router.post('/agents/upload-avatar', requireAdmin, avatarUpload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file nào được upload' });
    }
    const url = `/api/admin/agents/avatars/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/agents/avatars/:filename — serve static avatar (public)
router.get('/agents/avatars/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename); // chống path traversal
  const filePath = path.join(AVATAR_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Avatar not found' });
  }
  res.sendFile(filePath);
});

// GET /api/admin/agents/:id/documents — liệt kê documents trong KB của agent
router.get('/agents/:id/documents', requireAdmin, async (req, res) => {
  try {
    const agent = db.prepare('SELECT id, name FROM admin_agents WHERE id = ?').get(req.params.id) as any;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent không tồn tại' });

    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const { vectorStore } = await import('../lib/rag/vectorStore');
    const docs = await vectorStore.listByAgent(agent.id, { limit });
    const count = await vectorStore.countByAgent(agent.id);

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        totalCount: count,
        documents: docs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/agents/:id/documents/:docId — cập nhật metadata (title) của 1 document
router.patch('/agents/:id/documents/:docId', requireAdmin, async (req, res) => {
  try {
    const agent = db.prepare('SELECT id FROM admin_agents WHERE id = ?').get(req.params.id) as any;
    if (!agent) return res.status(404).json({ success: false, error: 'Agent không tồn tại' });

    const { docId } = req.params;
    const { title } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'title không hợp lệ' });
    }

    const { vectorStore } = await import('../lib/rag/vectorStore');
    const ok = await vectorStore.updateDocument(docId, { title: title.trim() });
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Document không tồn tại trong KB' });
    }

    res.json({ success: true, data: { id: docId, title: title.trim() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== POST /api/admin/agents/:id/crawl-sources ==============
// Cào ngay 2 URL (knowledge_url tổng quát + product_url) → ingest vào KB gắn với agent.
// Trả về jobId + số doc đã ingest + status.
router.post('/agents/:id/crawl-sources', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(id) as any;
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent không tồn tại' });
    }

    const { knowledge_url, product_url, crawl_follow_links, crawl_max_depth, crawl_max_pages } = req.body || {};
    const sources: Array<{ url: string; kind: 'knowledge' | 'product' }> = [];
    if (knowledge_url && /^https?:\/\//i.test(knowledge_url)) {
      sources.push({ url: knowledge_url, kind: 'knowledge' });
    }
    if (product_url && /^https?:\/\//i.test(product_url)) {
      sources.push({ url: product_url, kind: 'product' });
    }

    if (sources.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần ít nhất 1 URL hợp lệ (http/https) để cào',
      });
    }

    // Lưu URL vào DB trước (ngay cả khi crawl fail sau đó)
    db.prepare(`
      UPDATE admin_agents
      SET knowledge_url = COALESCE(?, knowledge_url),
          product_url = COALESCE(?, product_url),
          last_crawl_status = 'running',
          updated_at = ?
      WHERE id = ?
    `).run(knowledge_url || null, product_url || null, new Date().toISOString(), id);

    // ⭐ Detect botId + madaCategory từ agent để RAG filter chính xác khi user chat.
    // Ưu tiên: agent.bot_id/mada_category (lưu trong DB) → fallback tên MADA chuẩn theo `AGENT_TO_MADA`.
    const MADA_BOT_HINTS: Record<string, { botId: string; madaCategory: string }> = {
      'bot-hearing':    { botId: 'bot-hearing',    madaCategory: 'sensory-hearing' },
      'bot-vision':     { botId: 'bot-vision',     madaCategory: 'sensory-vision' },
      'bot-speech':     { botId: 'bot-speech',     madaCategory: 'voice-and-speech' },
      'bot-cognitive':  { botId: 'bot-cognitive',  madaCategory: 'mental-cognitive' },
      'bot-neuro':      { botId: 'bot-neuro',      madaCategory: 'neuromusculoskeletal-movement' },
      'bot-mobility':   { botId: 'bot-mobility',   madaCategory: 'mobility-and-transportation' },
      'bot-regulatory': { botId: 'bot-regulatory', madaCategory: 'regulatory-standards' },
    };
    const inferred = agent.bot_id ? MADA_BOT_HINTS[agent.bot_id] : null;
    const botId = agent.bot_id || inferred?.botId || null;
    const madaCategory = agent.mada_category || inferred?.madaCategory || null;

    // Dynamic import để tránh circular dep
    const { dataIngestion } = await import('../lib/rag/dataIngestion');

    let totalDocs = 0;
    const results: Array<{ url: string; kind: string; ok: boolean; docs: number; error?: string }> = [];

    for (const src of sources) {
      try {
        const result = await dataIngestion.ingestData({
          type: 'web',
          content: src.url, // ingestData tự scrape nếu content < 100 chars
          source: src.url,
          title: `${agent.name} - ${src.kind === 'product' ? 'Sản phẩm' : 'Kiến thức'}`,
          language: 'vi',
          metadata: {
            agentId: agent.id,
            agentName: agent.name,
            sourceKind: src.kind,
            crawledAt: new Date().toISOString(),
            botId,
            madaCategory,
          },
          scrapeOptions: {
            followLinks: !!crawl_follow_links,
            maxDepth: Number(crawl_max_depth) || 1,
            maxPages: Number(crawl_max_pages) || 5,
          },
        });
        if (result.success) {
          totalDocs += result.documentsAdded || 0;
          results.push({ url: src.url, kind: src.kind, ok: true, docs: result.documentsAdded || 0 });
        } else {
          results.push({
            url: src.url,
            kind: src.kind,
            ok: false,
            docs: 0,
            error: result.message || 'unknown error',
          });
        }
      } catch (err: any) {
        results.push({ url: src.url, kind: src.kind, ok: false, docs: 0, error: err.message });
      }
    }

    const status = results.every(r => r.ok) ? 'completed' : 'partial';
    db.prepare(`
      UPDATE admin_agents
      SET last_crawl_at = ?, last_crawl_status = ?, last_crawl_count = ?
      WHERE id = ?
    `).run(new Date().toISOString(), status, totalDocs, id);

    res.json({
      success: true,
      data: {
        agentId: id,
        totalDocs,
        status,
        results,
      },
    });
  } catch (error: any) {
    try {
      db.prepare(`
        UPDATE admin_agents SET last_crawl_status = ?, updated_at = ? WHERE id = ?
      `).run(`failed: ${error.message}`, new Date().toISOString(), id);
    } catch { /* ignore */ }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== SYSTEM LOGS ==============

// GET /api/admin/logs
router.get('/logs', requireAdmin, (req, res) => {
  try {
    const { level, source, limit = 100, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM admin_system_logs WHERE 1=1';
    const params: any[] = [];
    
    if (level && level !== 'all') {
      sql += ' AND level = ?';
      params.push(level);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, data: { logs } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/logs - Only Super Admin can delete logs
router.delete('/logs', requireAdmin, (req, res) => {
  try {
    // Only super_admin can delete logs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Chỉ Super Admin mới có quyền xóa logs' 
      });
    }
    db.prepare('DELETE FROM admin_system_logs').run();
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ANALYTICS ==============

// GET /api/admin/analytics
router.get('/analytics', requireAdmin, (_req, res) => {
  try {
    // Get KB stats
    const kbStats = {
      totalDocuments: db.prepare('SELECT COUNT(*) as count FROM kb_products').get() as { count: number },
      totalCategories: db.prepare('SELECT COUNT(*) as count FROM kb_categories').get() as { count: number },
      publishedDocuments: db.prepare("SELECT COUNT(*) as count FROM kb_products WHERE status = 'published'").get() as { count: number },
      archivedDocuments: db.prepare("SELECT COUNT(*) as count FROM kb_products WHERE status = 'archived'").get() as { count: number },
      draftDocuments: db.prepare("SELECT COUNT(*) as count FROM kb_products WHERE status = 'draft'").get() as { count: number },
    };
    
    // Get user stats
    const userStats = {
      total: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      active: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as { count: number },
      suspended: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'suspended'").get() as { count: number },
      pending: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get() as { count: number },
      admins: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number },
      enterprise: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'enterprise'").get() as { count: number },
      pro: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'pro'").get() as { count: number },
      free: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'free'").get() as { count: number },
    };
    
    // Get log stats
    const logStats = db.prepare(`
      SELECT level, COUNT(*) as count 
      FROM admin_system_logs 
      GROUP BY level
    `).all() as Array<{ level: string; count: number }>;
    
    const logsByLevel: Record<string, number> = {};
    logStats.forEach(l => { logsByLevel[l.level] = l.count; });
    
    const totalLogs = logStats.reduce((sum, l) => sum + l.count, 0);
    
    // Get server info
    const server = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
    };
    
    res.json({
      success: true,
      data: {
        kb: {
          totalDocuments: kbStats.totalDocuments.count,
          totalCategories: kbStats.totalCategories.count,
          publishedDocuments: kbStats.publishedDocuments.count,
        },
        users: userStats,
        logs: {
          total: totalLogs,
          byLevel: logsByLevel,
        },
        server,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/analytics/chat-metrics
router.get('/analytics/chat-metrics', requireAdmin, (_req, res) => {
  try {
    const { range: _range = '7d' } = _req.query;
    
    // Get metrics from the metrics table or generate mock data
    const metrics = db.prepare('SELECT * FROM chat_metrics ORDER BY date DESC LIMIT 7').all();
    
    if (metrics.length === 0) {
      // Return mock data if no real metrics
      const mockMetrics = {
        totalChats: Math.floor(Math.random() * 500) + 100,
        avgResponseTime: Math.floor(Math.random() * 2000) + 500,
        avgConfidence: Math.floor(Math.random() * 30) + 70,
        errorRate: Math.floor(Math.random() * 5) + 1,
        topQueries: [
          { query: 'Thiết bị hỗ trợ thị giác', count: 45 },
          { query: 'Máy trợ thính tốt nhất', count: 38 },
          { query: 'Xe lăn điện giá rẻ', count: 32 },
          { query: 'Ứng dụng hỗ trợ nhận thức', count: 28 },
          { query: 'Thiết bị giao tiếp AAC', count: 25 },
        ],
        chatsByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: Math.floor(Math.random() * 20) })),
        categoryUsage: [
          { category: 'Thị giác', count: 120 },
          { category: 'Thính giác', count: 95 },
          { category: 'Vận động', count: 78 },
          { category: 'Nhận thức', count: 56 },
          { category: 'Giao tiếp', count: 42 },
        ],
        languageDistribution: [
          { language: 'Tiếng Việt', count: 320, color: '#ef4444' },
          { language: 'English', count: 45, color: '#3b82f6' },
          { language: 'العربية', count: 12, color: '#10b981' },
          { language: 'Français', count: 8, color: '#8b5cf6' },
        ],
      };
      return res.json({ success: true, data: mockMetrics });
    }
    
    res.json({ success: true, data: metrics[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== USER STATS ==============

// GET /api/admin/user-stats
router.get('/user-stats', (_req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      active: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as { count: number },
      suspended: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'suspended'").get() as { count: number },
      pending: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get() as { count: number },
      admins: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number },
      enterprise: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'enterprise'").get() as { count: number },
      pro: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'pro'").get() as { count: number },
      free: db.prepare("SELECT COUNT(*) as count FROM users WHERE plan = 'free'").get() as { count: number },
    };
    
    res.json({
      success: true,
      data: {
        total: stats.total.count,
        active: stats.active.count,
        suspended: stats.suspended.count,
        pending: stats.pending.count,
        enterprise: stats.enterprise.count,
        pro: stats.pro.count,
        free: stats.free.count,
        admins: stats.admins.count,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/knowledge-stats
router.get('/knowledge-stats', (req, res) => {
  try {
    const { botId, category } = req.query;

    // Build WHERE cho knowledge_items (dùng JSON extract)
    let kiWhere = "WHERE 1=1";
    const kiParams: any[] = [];
    if (botId) { kiWhere += " AND json_extract(metadata, '$.botId') = ?"; kiParams.push(botId); }
    if (category) { kiWhere += " AND json_extract(metadata, '$.madaCategory') = ?"; kiParams.push(category); }

    let kpWhere = "WHERE 1=1";
    const kpParams: any[] = [];
    if (category) { kpWhere += " AND category = ?"; kpParams.push(category); }

    // Per-bot breakdown
    const perBotRows = db.prepare(
      `SELECT json_extract(metadata, '$.botId') as botId, COUNT(*) as count
       FROM knowledge_items
       WHERE json_extract(metadata, '$.botId') IS NOT NULL
       GROUP BY json_extract(metadata, '$.botId')
       ORDER BY count DESC`
    ).all() as { botId: string; count: number }[];

    const totalDocs = (db.prepare(`SELECT COUNT(*) as count FROM knowledge_items ${kiWhere}`).get(...kiParams) as { count: number }).count;
    const totalKb = (db.prepare('SELECT COUNT(*) as count FROM kb_products').get() as { count: number }).count;
    const totalCats = (db.prepare('SELECT COUNT(*) as count FROM kb_categories').get() as { count: number }).count;

    res.json({
      success: true,
      data: {
        totalDocuments: totalDocs,
        totalKbProducts: totalKb,
        totalCategories: totalCats,
        perBot: perBotRows,
        filter: { botId: botId || null, category: category || null },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== SYSTEM SETTINGS ==============

// GET /api/admin/settings
router.get('/settings', requireAdmin, (_req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings').all() as any[];

    const settingsMap: Record<string, any> = {};
    const grouped: Record<string, any[]> = {};
    const categories: Record<string, { label: string; icon: string }> = {
      ai: { label: 'AI & Model', icon: 'psychology' },
      auth: { label: 'Authentication & Security', icon: 'lock' },
      file_upload: { label: 'File Upload', icon: 'upload_file' },
      rate_limit: { label: 'Rate Limits', icon: 'speed' },
      plan: { label: 'Plans & Quotas', icon: 'workspace_premium' },
      system: { label: 'System', icon: 'settings' },
    };

    for (const s of settings) {
      let value: any = s.value;
      if (s.type === 'number') value = Number(value);
      if (s.type === 'boolean') value = value === 'true';
      if (s.type === 'json') value = JSON.parse(value);

      settingsMap[s.key] = value;

      // ⭐ Auto-group theo prefix key
      const prefix = s.key.split('_')[0];
      const catKey = categories[prefix] ? prefix : 'system';
      if (!grouped[catKey]) grouped[catKey] = [];
      grouped[catKey].push({
        key: s.key,
        value,
        type: s.type,
        description: s.description || '',
        updated_at: s.updated_at,
      });
    }

    res.json({
      success: true,
      data: settingsMap,
      grouped,
      categories,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/settings
router.patch('/settings', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();
    
    // Define sensitive settings that only super_admin can modify
    const sensitiveSettings = [
      'require_2fa',
      'allowed_ip_whitelist',
      'audit_log_retention_days',
      'max_users',
      'max_agents',
      'max_storage_per_user',
      'allowed_email_domains',
      'maintenance_mode', // Only super_admin can enable maintenance mode
      'maintenance_message',
    ];
    
    // Check if any sensitive settings are being updated
    const sensitiveUpdates = Object.keys(updates).filter(key => sensitiveSettings.includes(key));
    
    if (sensitiveUpdates.length > 0 && req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Chỉ Super Admin mới có quyền thay đổi cài đặt hệ thống nhạy cảm' 
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);
    
    for (const [key, value] of Object.entries(updates)) {
      let type = 'string';
      let strValue = String(value);
      
      if (typeof value === 'number') {
        type = 'number';
        strValue = String(value);
      } else if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      } else if (typeof value === 'object') {
        type = 'json';
        strValue = JSON.stringify(value);
      }
      
      // 5 values for INSERT: key, value, type, description, updated_at
      // 4 values for UPDATE: value, type, description, updated_at
      stmt.run(key, strValue, type, '', now, strValue, type, '', now);
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/sync-all
// Bulk sync tất cả kb_products → knowledge_items để AI/RAG biết đến
router.post('/products/sync-all', requireAdmin, (_req, res) => {
  try {
    const result = syncAllPublishedProducts();
    console.log(
      `📦 [admin/sync-all] kb_products → knowledge_items: ` +
      `inserted=${result.inserted}, updated=${result.updated}, archived=${result.archived}, errors=${result.errors.length}`
    );
    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        updated: result.updated,
        archived: result.archived,
        errors: result.errors,
      },
      message:
        `Synced ${result.inserted} new + ${result.updated} updated + ${result.archived} archived. ` +
        `Run "Sync to Vector Store" (npx tsx server/scripts/sync-kb-to-vectors.ts) to make them searchable by AI.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== AUDIT LOGS ==============

router.get('/audit', requireAdmin, (req, res) => {
  try {
    const { action, user_id, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (action) { sql += ' AND action LIKE ?'; params.push(`%${action}%`); }
    if (user_id) { sql += ' AND user_id = ?'; params.push(user_id); }

    // Count
    let countSql = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1${action ? ' AND action LIKE ?' : ''}${user_id ? ' AND user_id = ?' : ''}`;
    const countParams = params.slice();
    const { total } = db.prepare(countSql).get(...countParams) as { total: number };

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, data: logs, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit/actions', requireAdmin, (_req, res) => {
  try {
    const rows = db.prepare(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
    ).all();
    res.json({ success: true, data: rows.map((r: any) => r.action) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/admin/chat-metrics ==============

router.post('/chat-metrics', requireAdmin, (req, res) => {
  try {
    const { latencyMs, confidence } = req.body || {};
    if (typeof latencyMs !== 'number' || typeof confidence !== 'number') {
      return res.status(400).json({ success: false, error: 'latencyMs, confidence phải là number' });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Upsert vào summary row cho today (running aggregates)
    const existing = db.prepare('SELECT * FROM chat_metrics WHERE date = ?').get(today) as any;

    if (existing) {
      const newTotalQueries = (existing.total_queries || 0) + 1;
      const newAvgLatency = Math.round(
        ((existing.avg_response_time_ms || 0) * (existing.total_queries || 0) + latencyMs) / newTotalQueries
      );
      const newAvgConfidence =
        ((existing.avg_confidence || 0) * (existing.total_queries || 0) + confidence) / newTotalQueries;

      db.prepare(
        `UPDATE chat_metrics SET
           total_queries = ?,
           avg_response_time_ms = ?,
           avg_confidence = ?,
           updated_at = ?
         WHERE date = ?`
      ).run(newTotalQueries, newAvgLatency, newAvgConfidence, new Date().toISOString(), today);
    } else {
      db.prepare(
        `INSERT INTO chat_metrics (id, total_chats, total_queries, avg_response_time_ms, avg_confidence, date, created_at, updated_at)
         VALUES (?, 0, 1, ?, ?, ?, ?, ?)`
      ).run(
        `metric-${Date.now()}`,
        latencyMs,
        confidence,
        today,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    res.json({ success: true, data: { date: today, updated: !existing } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/admin/agents/test ==============

router.post('/agents/test', requireAdmin, async (req, res) => {
  try {
    const { agentId, message } = req.body || {};
    if (!agentId || !message) {
      return res.status(400).json({ success: false, error: 'agentId, message là bắt buộc' });
    }

    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(agentId) as any;
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent không tồn tại' });
    }

    const start = Date.now();
    // Proxy tới /api/chat nội bộ
    const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        agentId,
        agentPrompt: agent.system_prompt,
        language: 'vi',
        userMode: 'endUser',
      }),
    });

    const latencyMs = Date.now() - start;
    if (!chatRes.ok) {
      const err = await chatRes.text();
      return res.status(500).json({ success: false, error: `Chat API failed: ${err}`, latencyMs });
    }

    const json: any = await chatRes.json();
    res.json({
      success: true,
      data: {
        response: json.data?.response || json.response || json.message || '',
        latencyMs,
        confidence: json.data?.confidence ?? json.confidence ?? 0.8,
        agentName: agent.name,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== USERS MANAGEMENT ==============

// GET /api/admin/users - Get all users
router.get('/users', requireAdmin, (_req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, name, role, plan, status, provider, quota_used, quota_limit, 
             created_at, updated_at, last_login_at, avatar
      FROM users 
      ORDER BY created_at DESC
    `).all();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/users/:id - Get single user
router.get('/users/:id', requireAdmin, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, email, name, role, plan, status, provider, quota_used, quota_limit, 
             created_at, updated_at, last_login_at, avatar
      FROM users WHERE id = ?
    `).get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);
    
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    
    // Only super_admin can promote user to admin
    if (role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Chỉ Super Admin mới có quyền thăng cấp User thành Admin' 
      });
    }
    
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Cannot change role of another super_admin
    if (user.role === 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Không thể thay đổi role của Super Admin' 
      });
    }
    
    // Cannot demote self
    if (req.params.id === req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Không thể tự thay đổi role của chính mình' 
      });
    }
    
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
      .run(role, new Date().toISOString(), req.params.id);
    
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Delete related data first
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/users/:id/reset-password - Reset password & return new temp password
router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User không tồn tại' });
    }

    const generateTempPassword = () => {
      const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const lower = 'abcdefghjkmnpqrstuvwxyz';
      const digit = '23456789';
      const all = upper + lower + digit;
      let pwd =
        upper.charAt(Math.floor(Math.random() * upper.length)) +
        lower.charAt(Math.floor(Math.random() * lower.length)) +
        digit.charAt(Math.floor(Math.random() * digit.length));
      for (let i = 0; i < 9; i++) {
        pwd += all.charAt(Math.floor(Math.random() * all.length));
      }
      // Shuffle to avoid predictable positions
      return pwd.split('').sort(() => Math.random() - 0.5).join('');
    };
    const tempPassword = generateTempPassword();

    const { hashPassword } = require('../lib/auth');
    const passwordHash = hashPassword(tempPassword);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ?, must_reset_password = 1 WHERE id = ?')
      .run(passwordHash, now, id);

    res.json({
      success: true,
      data: {
        id,
        email: (user as any).email,
        tempPassword,
        message: 'Đã reset mật khẩu. Nhân viên nên đổi MK khi đăng nhập lần đầu.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/users - Create new user manually (returns temp password)
router.post('/users', requireAdmin, (req, res) => {
  try {
    const { email, name, password, role = 'user', plan = 'free' } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'Email và tên là bắt buộc' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email đã tồn tại trong hệ thống' });
    }

    // Generate temp password if not provided (or use provided one)
    let tempPassword = password;
    let isGenerated = false;
    if (!tempPassword) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      tempPassword = '';
      for (let i = 0; i < 12; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      isGenerated = true;
    } else if (tempPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu phải tối thiểu 6 ký tự' });
    }

    const { hashPassword } = require('../lib/auth');
    const id = `user-${uuidv4()}`;
    const passwordHash = hashPassword(tempPassword);
    const now = new Date().toISOString();

    // quota based on plan
    const quotaLimit = plan === 'enterprise' ? 999999 : plan === 'pro' ? 1000 : 10;

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, must_reset_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 'email', 0, ?, ?, ?, ?)
    `).run(id, normalizedEmail, name.trim(), passwordHash, role, plan, quotaLimit, isGenerated ? 1 : 0, now, now);

    const user = db.prepare('SELECT id, email, name, role, plan, status FROM users WHERE id = ?').get(id);
    res.status(201).json({
      success: true,
      data: {
        ...(user as any),
        tempPassword,
        passwordGenerated: isGenerated,
        message: isGenerated
          ? 'Tạo tài khoản thành công. Vui lòng gửi mật khẩu cho nhân viên qua kênh bảo mật.'
          : 'Tạo tài khoản thành công.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============== CHAT CUSTOMIZATION SETTINGS ==============

// GET /api/admin/chat-settings
router.get('/chat-settings', requireAdmin, (_req, res) => {
  try {
    const keys = [
      'chat_greeting_vi', 'chat_greeting_en', 'chat_greeting_ar', 'chat_greeting_fr',
      'chat_description_vi', 'chat_description_en', 'chat_description_ar', 'chat_description_fr',
      'feature_file_attachment_enabled',
      'suggested_prompts'
    ];
    
    const placeholders = keys.map(() => '?').join(',');
    const settings = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...keys) as any[];
    
    const result: Record<string, any> = {};
    for (const s of settings) {
      if (s.type === 'boolean') {
        result[s.key] = s.value === 'true';
      } else if (s.type === 'json') {
        result[s.key] = JSON.parse(s.value);
      } else {
        result[s.key] = s.value;
      }
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/chat-settings
router.put('/chat-settings', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);
    
    for (const [key, value] of Object.entries(updates)) {
      let type = 'string';
      let strValue = String(value);
      
      if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      } else if (typeof value === 'object') {
        type = 'json';
        strValue = JSON.stringify(value);
      }
      
      // 5 values for INSERT: key, value, type, description, updated_at
      // 4 values for UPDATE: value, type, description, updated_at
      stmt.run(key, strValue, type, '', now, strValue, type, '', now);
    }
    
    res.json({ success: true, message: 'Chat settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/chat-settings/public - Public endpoint for chat page
router.get('/chat-settings/public', (_req, res) => {
  try {
    const keys = [
      'chat_greeting_vi', 'chat_greeting_en', 'chat_greeting_ar', 'chat_greeting_fr',
      'chat_description_vi', 'chat_description_en', 'chat_description_ar', 'chat_description_fr',
      'feature_file_attachment_enabled',
      'suggested_prompts',
      'ai_system_instruction',
    ];
    
    const placeholders = keys.map(() => '?').join(',');
    const settings = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...keys) as any[];
    
    const result: Record<string, any> = {};
    for (const s of settings) {
      if (s.type === 'boolean') {
        result[s.key] = s.value === 'true';
      } else if (s.type === 'json') {
        result[s.key] = JSON.parse(s.value);
      } else {
        result[s.key] = s.value;
      }
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== AI SYSTEM INSTRUCTIONS (Super Admin only) ==============
// GET /api/admin/ai-instructions — lấy AI system instructions
router.get('/ai-instructions', requireAdmin, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM system_settings WHERE `key` LIKE 'ai_instruction_%' ORDER BY `key` ASC").all() as any[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (row.type === 'boolean') {
        result[row.key] = row.value === 'true';
      } else if (row.type === 'json') {
        result[row.key] = JSON.parse(row.value);
      } else {
        result[row.key] = row.value;
      }
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/ai-instructions — cập nhật AI system instructions (super admin only)
router.put('/ai-instructions', requireAdmin, (req, res) => {
  try {
    const { user } = req as any;
    
    // ⭐ Super admin only — kiểm tra role
    if (user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Chỉ Super Admin mới có quyền thay đổi AI System Instructions.' 
      });
    }

    const updates = req.body;
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);
    
    for (const [key, value] of Object.entries(updates)) {
      if (!key.startsWith('ai_instruction_')) continue; // Chỉ cho phép ai_instruction_* keys
      
      let type = 'string';
      let strValue = String(value);
      
      if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      } else if (typeof value === 'object') {
        type = 'json';
        strValue = JSON.stringify(value);
      }
      
      // 5 values for INSERT: key, value, type, description, updated_at
      // 4 values for UPDATE: value, type, description, updated_at
      stmt.run(key, strValue, type, '', now, strValue, type, '', now);
    }
    
    // ⭐ Invalidate AI instructions cache để thay đổi có hiệu lực ngay
    try {
      const { invalidateAiInstructionsCache } = require('../lib/prompts/systemPrompts');
      invalidateAiInstructionsCache();
    } catch (e) {
      console.warn('[admin/ai-instructions] Failed to invalidate cache:', e);
    }
    
    res.json({ success: true, message: 'AI System Instructions updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/ai-instructions/public — public endpoint cho chat page đọc AI instructions
router.get('/ai-instructions/public', (_req, res) => {
  try {
    const rows = db.prepare("SELECT key, value, type FROM system_settings WHERE `key` LIKE 'ai_instruction_%'").all() as any[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (row.type === 'boolean') {
        result[row.key] = row.value === 'true';
      } else if (row.type === 'json') {
        result[row.key] = JSON.parse(row.value);
      } else {
        result[row.key] = row.value;
      }
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ⭐ ============== EMOTION SETTINGS (Super Admin only) ==============
// GET /api/admin/emotion-settings — lấy emotion settings
router.get('/emotion-settings', requireAdmin, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM system_settings WHERE `key` LIKE 'emotion_%' ORDER BY `key` ASC").all() as any[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (row.type === 'boolean') {
        result[row.key] = row.value === 'true';
      } else if (row.type === 'json') {
        result[row.key] = JSON.parse(row.value);
      } else {
        result[row.key] = row.value;
      }
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/emotion-settings — cập nhật emotion settings (super admin only)
router.put('/emotion-settings', requireAdmin, (req, res) => {
  try {
    const { user } = req as any;

    // ⭐ Super admin only — kiểm tra role
    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Chỉ Super Admin mới có quyền thay đổi Emotion Settings.'
      });
    }

    const updates = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);

    for (const [key, value] of Object.entries(updates)) {
      if (!key.startsWith('emotion_')) continue; // Chỉ cho phép emotion_* keys

      let type = 'string';
      let strValue = String(value);

      if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      } else if (typeof value === 'object') {
        type = 'json';
        strValue = JSON.stringify(value);
      }

      stmt.run(key, strValue, type, '', now, strValue, type, '', now);
    }

    // ⭐ Invalidate emotion settings cache
    try {
      const { invalidateEmotionSettingsCache } = require('../lib/prompts/systemPrompts');
      invalidateEmotionSettingsCache();
    } catch (e) {
      console.warn('[admin/emotion-settings] Failed to invalidate cache:', e);
    }

    res.json({ success: true, message: 'Emotion Settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/emotion-settings/public — public endpoint cho chat page đọc emotion settings
router.get('/emotion-settings/public', (_req, res) => {
  try {
    const rows = db.prepare("SELECT key, value, type FROM system_settings WHERE `key` LIKE 'emotion_%'").all() as any[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (row.type === 'boolean') {
        result[row.key] = row.value === 'true';
      } else if (row.type === 'json') {
        result[row.key] = JSON.parse(row.value);
      } else {
        result[row.key] = row.value;
      }
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
