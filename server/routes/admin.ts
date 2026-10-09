import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../lib/db';
import { syncProductToKnowledge, syncAllPublishedProducts } from '../lib/syncKbProducts';
import { syncItemToVector } from '../lib/syncItemToVector';
import { authenticate, requireRole, hashPassword } from '../lib/auth';
import { invalidateAiInstructionsCache, invalidateEmotionSettingsCache, invalidateSystemPromptCache, buildSystemPrompt } from '../lib/prompts/systemPrompts';

const router = Router();

// Middleware: require admin authentication (uses proper JWT verification via lib/auth)
const requireAdmin = [authenticate, requireRole('admin', 'super_admin')];

// Middleware: require super_admin authentication (highest privilege)
const requireSuperAdmin = [authenticate, requireRole('super_admin')];

// ============== HELPER: Write to admin_system_logs ==============
function logSystemEvent(
  level: 'critical' | 'error' | 'warn' | 'info' | 'success',
  source: string,
  message: string,
  details?: Record<string, any>,
  userId?: string,
  ip?: string,
  userAgent?: string
) {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_system_logs (id, level, source, message, details, user_id, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      level,
      source,
      message,
      details ? JSON.stringify(details) : null,
      userId || null,
      ip || null,
      userAgent || null,
      now
    );
  } catch (err) {
    // Silently fail - logging should never crash the app
    console.error('Failed to write system log:', err);
  }
}

// ============== CATEGORIES ==============

// GET /api/admin/categories
router.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT * FROM kb_categories ORDER BY sort_order ASC').all();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/categories
router.post('/categories', requireAdmin, (req: Request, res: Response) => {
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
router.patch('/categories/:id', requireAdmin, (req: Request, res: Response) => {
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
router.delete('/categories/:id', requireAdmin, (req: Request, res: Response) => {
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
router.get('/products', (req: Request, res: Response) => {
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
router.post('/products', requireAdmin, (req: Request, res: Response) => {
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
        id, title, title_en, title_ar, title_fr,
        description, description_en, description_ar, description_fr, content, content_en, content_ar, content_fr, category,
        brand, model, price_range, source_url, product_url, image_url,
        iso_codes, wcag_level, who_gate_area, status, featured, sort_order, language,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      title_en || '', '', '',
      description || '', description_en || '', '', '',
      content || '', '', '', '',
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

    // Log the creation
    logSystemEvent(
      'success', 'products', 'Tạo sản phẩm mới',
      { id, title, category, status: status || 'draft' },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/products/:id
router.patch('/products/:id', requireAdmin, (req: Request, res: Response) => {
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

    // Log the update
    logSystemEvent(
      'info', 'products', 'Cập nhật sản phẩm',
      { id: req.params.id, title: (product as any)?.title, updatedFields: Object.keys(req.body) },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const product = db.prepare('SELECT * FROM kb_products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    db.prepare('DELETE FROM kb_products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });

    // Log the deletion
    logSystemEvent(
      'warn', 'products', 'Xóa sản phẩm',
      { id: req.params.id, title: (product as any)?.title, category: (product as any)?.category },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/:id/publish
router.post('/products/:id/publish', requireAdmin, async (req: Request, res: Response) => {
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
router.post('/products/bulk-publish', requireAdmin, async (req: Request, res: Response) => {
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
router.post('/products/bulk-unpublish', requireAdmin, (req: Request, res: Response) => {
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
router.get('/agents', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM admin_agents ORDER BY sort_order ASC, created_at ASC').all() as any[];
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
router.post('/agents', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      id, name, description, avatar, system_prompt, capabilities,
      is_active, mada_category, bot_id, prompt_id,
      avatar_url, knowledge_url, product_urls,
    } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({ success: false, error: 'Name and system_prompt are required' });
    }

    const now = new Date().toISOString();
    const agentId = id || `agent-${uuidv4()}`;
    
    // Support both single product_url and product_urls array
    const productUrlList = Array.isArray(product_urls) ? product_urls : [];
    const firstProductUrl = productUrlList[0] || null;

    db.prepare(`
      INSERT INTO admin_agents (
        id, name, description, avatar, system_prompt, capabilities, is_active,
        created_by, mada_category, bot_id,
        created_at, updated_at,
        avatar_url, knowledge_url, product_url,
        last_crawl_at, last_crawl_status, last_crawl_count,
        prompt_id, crawl_follow_links, crawl_max_depth, crawl_max_pages
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      now,   // created_at
      now,   // updated_at
      avatar_url || null,
      knowledge_url || null,
      firstProductUrl,
      null,  // last_crawl_at
      null,  // last_crawl_status
      0,     // last_crawl_count
      prompt_id || null,
      0,     // crawl_follow_links
      1,     // crawl_max_depth
      5,     // crawl_max_pages
    );

    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(agentId) as any;
    res.status(201).json({
      success: true,
      data: { ...agent, capabilities: JSON.parse(agent.capabilities), isActive: agent.is_active === 1 },
    });

    // Log the creation
    logSystemEvent(
      'success', 'agents', 'Tạo AI Agent mới',
      { id: agentId, name, mada_category, is_active: is_active !== false },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/agents/:id
router.patch('/agents/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const updates: string[] = [];
    const params: any[] = [];

    const fields = [
      'name', 'description', 'avatar', 'system_prompt', 'capabilities',
      'is_active', 'mada_category', 'prompt_id',
      'avatar_url', 'knowledge_url', 'product_url',
      'sort_order', 'crawl_follow_links', 'crawl_max_depth', 'crawl_max_pages',
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
    
    // Special handling for product_urls array - save first URL to product_url
    if (req.body.product_urls !== undefined) {
      const productUrlList = Array.isArray(req.body.product_urls) ? req.body.product_urls : [];
      const firstProductUrl = productUrlList[0] || null;
      updates.push('product_url = ?');
      params.push(firstProductUrl);
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

    // Log the update
    logSystemEvent(
      'info', 'agents', 'Cập nhật AI Agent',
      { id: req.params.id, name: agent.name, updatedFields: Object.keys(req.body) },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/agents/reorder — Batch update sort_order for all agents
router.patch('/agents/reorder', requireAdmin, (req: Request, res: Response) => {
  try {
    const { agents } = req.body as { agents: { id: string; sort_order: number }[] };

    if (!Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ success: false, error: 'agents array is required' });
    }

    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE admin_agents SET sort_order = ?, updated_at = ? WHERE id = ?
    `);

    const updateMany = db.transaction((items: typeof agents) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, now, item.id);
      }
    });

    updateMany(agents);

    // Log the reorder action
    logSystemEvent(
      'info', 'agents', 'Sắp xếp lại thứ tự Agent',
      { agentIds: agents.map(a => a.id), newOrder: agents.map(a => a.sort_order) },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Agents reordered successfully' });
  } catch (error: any) {
    console.error('[PATCH /admin/agents/reorder] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/agents/:id
router.delete('/agents/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM admin_agents WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully' });

    // Log the deletion
    logSystemEvent(
      'warn', 'agents', 'Xóa AI Agent',
      { id: req.params.id, name: agent?.name },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== SIMPLIFIED SYSTEM PROMPT API (single prompt for all languages) ==============

// GET /api/admin/system-prompts — get the single main system prompt
router.get('/system-prompts', (_req: Request, res: Response) => {
  try {
    const row = db.prepare(
      "SELECT value, updated_at FROM system_settings WHERE \`key\` = 'main_system_prompt'"
    ).get() as { value: string; updated_at: string } | undefined;
    res.json({
      success: true,
      data: {
        content: row?.value || '',
        updatedAt: row?.updated_at || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/system-prompts — save the main system prompt (admin only)
router.put('/system-prompts', requireAdmin, (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO system_settings (\`key\`, value, type, description, updated_at)
      VALUES ('main_system_prompt', ?, 'string', 'Main system prompt for MADA AI chatbot', ?)
      ON CONFLICT(\`key\`) DO UPDATE SET value = ?, updated_at = ?
    `).run(content, now, content, now);
    // Invalidate cache
    try { invalidateSystemPromptCache(); } catch (e) { console.warn('[admin/system-prompts] Cache invalidation failed:', e); }
    res.json({ success: true, data: { content, updatedAt: now } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/system-prompts/preview — preview full built prompt for each language
router.get('/system-prompts/preview', (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as string) || 'vi';
    const langCode = (['vi', 'en', 'ar', 'fr'].includes(lang) ? lang : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
    const userMode = (req.query.mode as 'endUser' | 'specialist') || 'endUser';
    const fullPrompt = buildSystemPrompt(langCode, userMode);
    res.json({
      success: true,
      data: {
        language: langCode,
        mode: userMode,
        prompt: fullPrompt,
      },
    });
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

router.post('/agents/upload-avatar', requireAdmin, avatarUpload.single('avatar'), (req: Request, res: Response) => {
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
router.get('/agents/avatars/:filename', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename); // chống path traversal
  const filePath = path.join(AVATAR_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Avatar not found' });
  }
  res.sendFile(filePath);
});

// GET /api/admin/agents/:id/documents — liệt kê documents trong KB của agent
router.get('/agents/:id/documents', requireAdmin, async (req: Request, res: Response) => {
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
router.patch('/agents/:id/documents/:docId', requireAdmin, async (req: Request, res: Response) => {
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
router.post('/agents/:id/crawl-sources', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(id) as any;
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent không tồn tại' });
    }

    const { knowledge_url, product_urls, crawl_follow_links, crawl_max_depth, crawl_max_pages } = req.body || {};
    
    // Support both single product_url and product_urls array
    const productUrlList = Array.isArray(product_urls) 
      ? product_urls 
      : (product_urls ? [product_urls] : []);
    
    const sources: Array<{ url: string; kind: 'knowledge' | 'product' }> = [];
    if (knowledge_url && /^https?:\/\//i.test(knowledge_url)) {
      sources.push({ url: knowledge_url, kind: 'knowledge' });
    }
    // Add all product URLs
    for (const url of productUrlList) {
      if (url && /^https?:\/\//i.test(url)) {
        sources.push({ url, kind: 'product' });
      }
    }

    if (sources.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần ít nhất 1 URL hợp lệ (http/https) để cào',
      });
    }

    // Lưu URL đầu tiên vào DB (backward compatibility)
    const firstProductUrl = productUrlList[0] || null;
    db.prepare(`
      UPDATE admin_agents
      SET knowledge_url = COALESCE(?, knowledge_url),
          product_url = COALESCE(?, product_url),
          last_crawl_status = 'running',
          updated_at = ?
      WHERE id = ?
    `).run(knowledge_url || null, firstProductUrl, new Date().toISOString(), id);

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
router.get('/logs', requireAdmin, (req: Request, res: Response) => {
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
router.delete('/logs', requireAdmin, (req: Request, res: Response) => {
  try {
    // Only super_admin can delete logs
    if ((req as any).user?.role !== 'super_admin') {
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
router.get('/analytics', requireAdmin, (_req: Request, res: Response) => {
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
router.get('/analytics/chat-metrics', requireAdmin, (_req: Request, res: Response) => {
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
router.get('/user-stats', (_req: Request, res: Response) => {
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
router.get('/knowledge-stats', (req: Request, res: Response) => {
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
router.get('/settings', requireAdmin, (_req: Request, res: Response) => {
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
router.patch('/settings', requireAdmin, (req: Request, res: Response) => {
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
    
    if (sensitiveUpdates.length > 0 && (req as any).user?.role !== 'super_admin') {
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

    // Log the settings update
    logSystemEvent(
      'info', 'settings', 'Cập nhật cài đặt hệ thống',
      { keys: Object.keys(updates), sensitive: sensitiveUpdates.length > 0 },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/sync-and-index
// ⭐ Complete sync: kb_products → knowledge_items AND vector store
// Chạy đầy đủ trong 1 endpoint để admin chỉ cần 1 click
router.post('/products/sync-and-index', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 1) Sync kb_products → knowledge_items
    const syncResult = syncAllPublishedProducts();
    console.log(
      `📦 [sync-and-index] Step 1 - kb_products → knowledge_items: ` +
      `inserted=${syncResult.inserted}, updated=${syncResult.updated}, archived=${syncResult.archived}, errors=${syncResult.errors.length}`
    );

    // 2) Find all knowledge_items with indexed=0 (these need vector indexing)
    const unindexedItems = db.prepare(`
      SELECT id, title, content FROM knowledge_items
      WHERE indexed = 0 AND status = 'published'
        AND content IS NOT NULL AND length(content) > 20
      ORDER BY updated_at DESC
    `).all() as any[];

    console.log(`🔍 [sync-and-index] Step 2 - Found ${unindexedItems.length} unindexed items`);

    // 3) Index in vector store (fire-and-forget for each, batch for speed)
    let indexedCount = 0;
    let indexErrors = 0;

    if (unindexedItems.length > 0) {
      const { vectorStore } = await import('../lib/rag/vectorStore');
      const { chunkText, generateId } = await import('../lib/rag/vectorStore');

      // Process in chunks of 10 for rate limit safety
      const CHUNK_SIZE = 10;
      for (let i = 0; i < unindexedItems.length; i += CHUNK_SIZE) {
        const chunk = unindexedItems.slice(i, i + CHUNK_SIZE);
        const documents = [];

        for (const item of chunk) {
          let meta: any = {};
          try {
            const row = db.prepare('SELECT metadata FROM knowledge_items WHERE id = ?').get(item.id) as any;
            if (row?.metadata) {
              meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            }
          } catch { /* ignore */ }

          const content = `${item.title}\n\n${(item.content || '').slice(0, 3500)}`;
          const chunks = chunkText(content, 800, 150);

          for (const c of chunks) {
            documents.push({
              id: generateId(),
              content: c,
              metadata: {
                source: meta.productUrl || meta.source || item.id,
                type: 'manual',
                title: item.title || '',
                category: meta.category || 'general',
                itemId: item.id,
                thumbnailUrl: meta.thumbnailUrl || '',
                ...meta,
              },
            });
          }
        }

        try {
          await vectorStore.addDocuments(documents);

          // Mark items as indexed
          for (const item of chunk) {
            db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ? WHERE id = ?')
              .run(new Date().toISOString(), item.id);
            indexedCount++;
          }
        } catch (err: any) {
          console.warn(`⚠️ [sync-and-index] Chunk ${i}-${i + CHUNK_SIZE} failed:`, err.message);
          indexErrors += chunk.length;
        }
      }
    }

    const vectorStats = await (await import('../lib/rag/vectorStore')).vectorStore.getStats();

    console.log(
      `✅ [sync-and-index] Done! ` +
      `kb_products synced: ${syncResult.inserted} new + ${syncResult.updated} updated. ` +
      `Vector indexed: ${indexedCount} items. Total in vector store: ${vectorStats.totalDocuments}`
    );

    res.json({
      success: true,
      data: {
        kbSync: {
          inserted: syncResult.inserted,
          updated: syncResult.updated,
          archived: syncResult.archived,
          errors: syncResult.errors,
        },
        vectorIndex: {
          indexed: indexedCount,
          skipped: indexErrors,
          totalInVectorStore: vectorStats.totalDocuments,
        },
      },
      message:
        `✅ Hoàn tất! Đã sync ${syncResult.inserted + syncResult.updated} sản phẩm vào Knowledge Base, ` +
        `và index ${indexedCount} items vào Vector Store. ` +
        `Tổng ${vectorStats.totalDocuments} documents trong Vector Store. Bot giờ có thể tìm được sản phẩm!`,
    });
  } catch (error: any) {
    console.error('❌ [sync-and-index] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== AUDIT LOGS ==============

router.get('/audit', requireAdmin, (req: Request, res: Response) => {
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

router.get('/audit/actions', requireAdmin, (_req: Request, res: Response) => {
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

router.post('/chat-metrics', requireAdmin, (req: Request, res: Response) => {
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

router.post('/agents/test', requireAdmin, async (req: Request, res: Response) => {
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
    const chatPort = process.env.PORT || 3003;
    const chatRes = await fetch(`http://127.0.0.1:${chatPort}/api/chat`, {
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
router.get('/users', requireAdmin, (_req: Request, res: Response) => {
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
router.get('/users/:id', requireAdmin, (req: Request, res: Response) => {
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
router.put('/users/:id/status', requireAdmin, (req: Request, res: Response) => {
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
router.put('/users/:id/role', requireAdmin, (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    
    // Only super_admin can promote user to admin
    if (role === 'admin' && (req as any).user?.role !== 'super_admin') {
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
    if (req.params.id === (req as any).user?.id) {
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
router.delete('/users/:id', requireAdmin, (req: Request, res: Response) => {
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
router.post('/users/:id/reset-password', requireAdmin, (req: Request, res: Response) => {
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
router.post('/users', requireAdmin, (req: Request, res: Response) => {
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

    const id = `user-${uuidv4()}`;
    const passwordHash = hashPassword(tempPassword);
    const now = new Date().toISOString();

    // quota based on plan
    const quotaLimit = plan === 'enterprise' ? 999999 : plan === 'pro' ? 1000 : 10;

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, avatar, quota_used, quota_limit, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 'email', NULL, 0, ?, NULL, ?, ?)
    `).run(id, normalizedEmail, name.trim(), passwordHash, role, plan, quotaLimit, now, now);

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

    // Log the creation
    logSystemEvent(
      'success', 'users', 'Tạo tài khoản người dùng mới',
      { id, email: normalizedEmail, name: name.trim(), role, plan },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============== CHAT CUSTOMIZATION SETTINGS ==============

// GET /api/admin/chat-settings
router.get('/chat-settings', requireAdmin, (_req: Request, res: Response) => {
  try {
    const keys = [
      'chat_greeting_vi', 'chat_greeting_en', 'chat_greeting_ar', 'chat_greeting_fr',
      'chat_description_vi', 'chat_description_en', 'chat_description_ar', 'chat_description_fr',
      'feature_file_attachment_enabled',
      'feature_show_suggested_questions',
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
        // Auto-parse JSON strings (e.g. suggested_prompts stored with type='string')
        const trimmed = (s.value || '').trim();
        if ((trimmed.startsWith('[') || trimmed.startsWith('{')) &&
            (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
          try {
            result[s.key] = JSON.parse(trimmed);
            continue;
          } catch {
            // Fall through
          }
        }
        result[s.key] = s.value;
      }
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/chat-settings
router.put('/chat-settings', requireAdmin, (req: Request, res: Response) => {
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
router.get('/chat-settings/public', (_req: Request, res: Response) => {
  try {
    const keys = [
      'chat_greeting_vi', 'chat_greeting_en', 'chat_greeting_ar', 'chat_greeting_fr',
      'chat_description_vi', 'chat_description_en', 'chat_description_ar', 'chat_description_fr',
      'feature_file_attachment_enabled',
      'feature_show_suggested_questions',
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
        // Auto-parse JSON strings (e.g. suggested_prompts stored with type='string')
        const trimmed = (s.value || '').trim();
        if ((trimmed.startsWith('[') || trimmed.startsWith('{')) &&
            (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
          try {
            result[s.key] = JSON.parse(trimmed);
            continue;
          } catch {
            // Fall through
          }
        }
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
router.get('/ai-instructions', requireAdmin, (_req: Request, res: Response) => {
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
router.put('/ai-instructions', requireAdmin, (req: Request, res: Response) => {
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
router.get('/ai-instructions/public', (_req: Request, res: Response) => {
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
router.get('/emotion-settings', requireAdmin, (_req: Request, res: Response) => {
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
router.put('/emotion-settings', requireAdmin, (req: Request, res: Response) => {
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
router.get('/emotion-settings/public', (_req: Request, res: Response) => {
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

// ============== FILE UPLOAD SETTINGS (SuperAdmin only) ==============

// GET /api/admin/file-settings — get file upload settings
router.get('/file-settings', requireAdmin, (_req: Request, res: Response) => {
  try {
    const keys = [
      'feature_file_attachment_enabled',
      'feature_image_upload_enabled',
      'feature_document_upload_enabled',
      'feature_video_upload_enabled',
      'feature_audio_upload_enabled',
      'feature_other_file_upload_enabled',
      'max_file_size_mb',
      'max_image_size_mb',
      'max_document_size_mb',
      'max_video_size_mb',
      'max_audio_size_mb',
      'max_other_file_size_mb',
      'max_files_per_session',
      'max_files_total',
      'file_upload_limit_free',
      'file_upload_limit_pro',
      'file_upload_limit_enterprise',
    ];

    const placeholders = keys.map(() => '?').join(',');
    const settings = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...keys) as any[];

    const result: Record<string, any> = {};
    for (const s of settings) {
      // Map database key → frontend key for fileAttachmentEnabled
      const frontendKey = s.key === 'feature_file_attachment_enabled'
        ? 'fileAttachmentEnabled'
        : s.key === 'feature_image_upload_enabled'
        ? 'imageUploadEnabled'
        : s.key === 'feature_document_upload_enabled'
        ? 'documentUploadEnabled'
        : s.key === 'feature_video_upload_enabled'
        ? 'videoUploadEnabled'
        : s.key === 'feature_audio_upload_enabled'
        ? 'audioUploadEnabled'
        : s.key === 'feature_other_file_upload_enabled'
        ? 'otherFileUploadEnabled'
        : s.key === 'max_file_size_mb'
        ? 'maxFileSizeMB'
        : s.key === 'max_image_size_mb'
        ? 'maxImageSizeMB'
        : s.key === 'max_document_size_mb'
        ? 'maxDocumentSizeMB'
        : s.key === 'max_video_size_mb'
        ? 'maxVideoSizeMB'
        : s.key === 'max_audio_size_mb'
        ? 'maxAudioSizeMB'
        : s.key === 'max_other_file_size_mb'
        ? 'maxOtherFileSizeMB'
        : s.key === 'max_files_per_session'
        ? 'maxFilesPerSession'
        : s.key === 'max_files_total'
        ? 'maxFilesTotal'
        : s.key === 'file_upload_limit_free'
        ? 'fileUploadLimitFree'
        : s.key === 'file_upload_limit_pro'
        ? 'fileUploadLimitPro'
        : s.key === 'file_upload_limit_enterprise'
        ? 'fileUploadLimitEnterprise'
        : s.key;
      if (s.type === 'boolean') {
        result[frontendKey] = s.value === 'true';
      } else if (s.type === 'number') {
        result[frontendKey] = Number(s.value);
      } else if (s.type === 'json') {
        result[frontendKey] = JSON.parse(s.value);
      } else {
        result[frontendKey] = s.value;
      }
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/file-settings — update file upload settings (SuperAdmin only)
router.put('/file-settings', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();

    // Map frontend keys to database keys
    const keyMapping: Record<string, string> = {
      fileAttachmentEnabled: 'feature_file_attachment_enabled',
      imageUploadEnabled: 'feature_image_upload_enabled',
      documentUploadEnabled: 'feature_document_upload_enabled',
      videoUploadEnabled: 'feature_video_upload_enabled',
      audioUploadEnabled: 'feature_audio_upload_enabled',
      otherFileUploadEnabled: 'feature_other_file_upload_enabled',
      maxFileSizeMB: 'max_file_size_mb',
      maxImageSizeMB: 'max_image_size_mb',
      maxDocumentSizeMB: 'max_document_size_mb',
      maxVideoSizeMB: 'max_video_size_mb',
      maxAudioSizeMB: 'max_audio_size_mb',
      maxOtherFileSizeMB: 'max_other_file_size_mb',
      maxFilesPerSession: 'max_files_per_session',
      maxFilesTotal: 'max_files_total',
      fileUploadLimitFree: 'file_upload_limit_free',
      fileUploadLimitPro: 'file_upload_limit_pro',
      fileUploadLimitEnterprise: 'file_upload_limit_enterprise',
    };

    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);

    for (const [frontendKey, value] of Object.entries(updates)) {
      const dbKey = keyMapping[frontendKey];
      if (!dbKey) continue;

      let type = 'string';
      let strValue = String(value);

      if (typeof value === 'number') {
        type = 'number';
        strValue = String(value);
      } else if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      }

      stmt.run(dbKey, strValue, type, '', now, strValue, type, '', now);
    }

    res.json({ success: true, message: 'File settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/file-settings/public — public endpoint for file upload validation
router.get('/file-settings/public', (_req: Request, res: Response) => {
  try {
    const keys = [
      'feature_file_attachment_enabled',
      'feature_image_upload_enabled',
      'feature_document_upload_enabled',
      'feature_video_upload_enabled',
      'feature_audio_upload_enabled',
      'feature_other_file_upload_enabled',
      'max_file_size_mb',
      'max_image_size_mb',
      'max_document_size_mb',
      'max_video_size_mb',
      'max_audio_size_mb',
      'max_other_file_size_mb',
    ];

    const placeholders = keys.map(() => '?').join(',');
    const settings = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...keys) as any[];

    const result: Record<string, any> = {};
    for (const s of settings) {
      if (s.type === 'boolean') {
        result[s.key] = s.value === 'true';
      } else if (s.type === 'number') {
        result[s.key] = Number(s.value);
      } else {
        result[s.key] = s.value;
      }
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PRICING PLANS (Admin CRUD) ==============

type SupportedLang = 'vi' | 'en' | 'ar' | 'fr';

function parsePlanRow(row: any, lang: SupportedLang) {
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
    isActive: row.is_active === 1,
    isHighlighted: row.is_highlighted === 1,
    sortOrder: row.sort_order,
    ctaText: row[`cta_text_${lang}`] || row.cta_text_vi,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/admin/pricing-plans - Get all pricing plans
router.get('/pricing-plans', requireAdmin, (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as SupportedLang) || 'vi';
    const rows = db.prepare('SELECT * FROM pricing_plans ORDER BY sort_order ASC').all();
    res.json({
      success: true,
      data: rows.map((row: any) => parsePlanRow(row, lang)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/pricing-plans/:id - Get single pricing plan
router.get('/pricing-plans/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as SupportedLang) || 'vi';
    const row = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, data: parsePlanRow(row as any, lang) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/pricing-plans/:id - Update pricing plan
router.patch('/pricing-plans/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    const fields = [
      'name_vi', 'name_en', 'name_ar', 'name_fr',
      'price_amount', 'price_currency',
      'price_note_vi', 'price_note_en',
      'description_vi', 'description_en', 'description_ar', 'description_fr',
      'features_vi', 'features_en', 'features_ar', 'features_fr',
      'is_active', 'is_highlighted', 'sort_order',
      'cta_text_vi', 'cta_text_en',
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        let value = req.body[field];
        if (['is_active', 'is_highlighted'].includes(field)) {
          value = value ? 1 : 0;
        }
        if (Array.isArray(value)) {
          value = JSON.stringify(value);
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

    db.prepare(`UPDATE pricing_plans SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(req.params.id);
    const lang = (req.query.lang as SupportedLang) || 'vi';
    res.json({ success: true, data: parsePlanRow(updated as any, lang) });

    // Log the update
    logSystemEvent(
      'info', 'pricing', 'Cập nhật gói dịch vụ',
      { id: req.params.id, planKey: (row as any).plan_key, updatedFields: Object.keys(req.body) },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== FEEDBACK STATISTICS API ==============

// GET /api/admin/feedback/stats - Get aggregated feedback statistics by module
router.get('/feedback/stats', ...requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Get stats grouped by agent_id (which represents different modules/categories)
    const stats = db.prepare(`
      SELECT 
        mf.agent_id as module,
        COUNT(*) as totalResponses,
        SUM(CASE WHEN mf.rating = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN mf.rating = 'dislike' THEN 1 ELSE 0 END) as dislikes,
        ROUND(SUM(CASE WHEN mf.rating = 'like' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as satisfaction
      FROM message_feedback mf
      GROUP BY mf.agent_id
      ORDER BY totalResponses DESC
    `).all() as any[];

    // Map agent_id to module names and icons
    const moduleMap: Record<string, { name: string; icon: string }> = {
      'vision': { name: 'Thị giác', icon: 'visibility' },
      'hearing': { name: 'Thính giác', icon: 'hearing' },
      'mobility': { name: 'Vận động', icon: 'accessible_forward' },
      'communication': { name: 'Giao tiếp', icon: 'record_voice_over' },
      'cognition': { name: 'Nhận thức', icon: 'psychology' },
      'daily_living': { name: 'Sinh hoạt', icon: 'daily_living' },
      'education': { name: 'Giáo dục', icon: 'school' },
      'general': { name: 'Tổng quát', icon: 'smart_toy' },
    };

    const moduleStats = stats.map(s => {
      const mapped = moduleMap[s.module || 'general'] || { name: 'Khác', icon: 'smart_toy' };
      return {
        name: mapped.name,
        icon: mapped.icon,
        satisfaction: s.satisfaction || 0,
        totalResponses: s.totalResponses || 0,
        likes: s.likes || 0,
        dislikes: s.dislikes || 0,
      };
    });

    // Get overall totals
    const totals = db.prepare(`
      SELECT 
        COUNT(*) as totalResponses,
        SUM(CASE WHEN rating = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN rating = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM message_feedback
    `).get() as any;

    res.json({
      success: true,
      data: {
        modules: moduleStats,
        totals: {
          totalResponses: totals.totalResponses || 0,
          likes: totals.likes || 0,
          dislikes: totals.dislikes || 0,
          satisfaction: totals.totalResponses > 0 
            ? Math.round((totals.likes / totals.totalResponses) * 1000) / 10 
            : 0,
        }
      }
    });
  } catch (error: any) {
    console.error('[/api/admin/feedback/stats]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/feedback - Get feedback list with pagination and filters
router.get('/feedback', ...requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const rating = req.query.rating as string;
    const module = req.query.module as string;
    const status = req.query.status as string;

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (mf.id LIKE ? OR mf.reason LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (rating) {
      whereClause += ' AND mf.rating = ?';
      params.push(rating);
    }

    if (module) {
      whereClause += ' AND mf.agent_id = ?';
      params.push(module);
    }

    // Status filter for pending expert review (dislikes that haven't been reviewed)
    if (status === 'pending') {
      whereClause += ' AND mf.rating = ? AND mf.reason IS NOT NULL';
      params.push('dislike');
    }

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM message_feedback mf WHERE ${whereClause}
    `).get(...params) as any;

    // Get paginated results with message content
    const feedback = db.prepare(`
      SELECT 
        mf.id,
        mf.message_id,
        mf.session_id,
        mf.user_id,
        mf.rating,
        mf.reason,
        mf.agent_id as module,
        mf.language,
        mf.created_at,
        u.name as user_name,
        u.email as user_email,
        cm.content as message_content
      FROM message_feedback mf
      LEFT JOIN users u ON mf.user_id = u.id
      LEFT JOIN chat_messages cm ON mf.message_id = cm.id
      WHERE ${whereClause}
      ORDER BY mf.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    // Map to frontend format
    const items = feedback.map(f => {
      // Module display name mapping
      const moduleMap: Record<string, string> = {
        'vision': 'Thị giác',
        'hearing': 'Thính giác',
        'mobility': 'Vận động',
        'communication': 'Giao tiếp',
        'cognition': 'Nhận thức',
        'daily_living': 'Sinh hoạt',
        'education': 'Giáo dục',
        'general': 'Tổng quát',
      };
      return {
        id: f.id,
        messageId: f.message_id,
        sessionId: f.session_id,
        userId: f.user_id,
        userName: f.user_name || 'Khách',
        userEmail: f.user_email || '',
        rating: f.rating,
        reason: f.reason || '',
        module: f.module || 'general',
        moduleDisplay: moduleMap[f.module || 'general'] || 'Khác',
        question: f.message_content || f.reason || 'Không có nội dung',
        language: f.language || 'vi',
        createdAt: f.created_at,
        status: f.reason ? 'pending' : 'reviewed',
      };
    });

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
        }
      }
    });
  } catch (error: any) {
    console.error('[/api/admin/feedback]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/feedback/:id - Get single feedback item
router.get('/feedback/:id', ...requireAdmin, async (req: Request, res: Response) => {
  try {
    const feedback = db.prepare(`
      SELECT 
        mf.*,
        u.name as user_name,
        u.email as user_email,
        cm.content as message_content
      FROM message_feedback mf
      LEFT JOIN users u ON mf.user_id = u.id
      LEFT JOIN chat_messages cm ON mf.message_id = cm.id
      WHERE mf.id = ?
    `).get(req.params.id) as any;

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    res.json({
      success: true,
      data: {
        id: feedback.id,
        messageId: feedback.message_id,
        messageContent: feedback.message_content,
        sessionId: feedback.session_id,
        userId: feedback.user_id,
        userName: feedback.user_name || 'Khách',
        userEmail: feedback.user_email || '',
        rating: feedback.rating,
        reason: feedback.reason || '',
        module: feedback.agent_id || 'general',
        language: feedback.language || 'vi',
        createdAt: feedback.created_at,
      }
    });
  } catch (error: any) {
    console.error('[/api/admin/feedback/:id]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/feedback/:id - Update feedback status (mark as reviewed)
router.patch('/feedback/:id', ...requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    // Currently only updating status, could extend to add notes, etc.
    if (status) {
      // For now, we just log the status change
      // In future, could add a status column to message_feedback table
      console.log(`Feedback ${req.params.id} status updated to: ${status}`);
    }

    logSystemEvent(
      'info', 'feedback', 'Cập nhật trạng thái phản hồi',
      { id: req.params.id, status },
      (req as any).user?.id,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
