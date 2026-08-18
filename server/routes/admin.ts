import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { syncProductToKnowledge, syncAllPublishedProducts } from '../lib/syncKbProducts';

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
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ============== CATEGORIES ==============

// GET /api/admin/categories
router.get('/categories', (req, res) => {
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
      req.user?.id || null,
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
router.post('/products/:id/publish', requireAdmin, (req, res) => {
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

    res.json({
      success: true,
      data: product,
      sync: syncResult, // trả về cho client biết
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ADMIN AGENTS ==============

// GET /api/admin/agents
router.get('/agents', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM admin_agents ORDER BY created_at DESC').all();
    const parsed = agents.map((a: any) => ({
      ...a,
      capabilities: JSON.parse(a.capabilities || '[]'),
      isActive: a.is_active === 1,
    }));
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/agents
router.post('/agents', requireAdmin, (req, res) => {
  try {
    const { id, name, description, avatar, system_prompt, capabilities, is_active, mada_category, bot_id } = req.body;
    
    if (!name || !system_prompt) {
      return res.status(400).json({ success: false, error: 'Name and system_prompt are required' });
    }
    
    const now = new Date().toISOString();
    const agentId = id || `agent-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO admin_agents (id, name, description, avatar, system_prompt, capabilities, is_active, created_by, mada_category, bot_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentId,
      name,
      description || '',
      avatar || '🤖',
      system_prompt,
      JSON.stringify(Array.isArray(capabilities) ? capabilities : []),
      is_active !== false ? 1 : 0,
      req.user?.id || null,
      mada_category || null,
      bot_id || null,
      now,
      now
    );
    
    const agent = db.prepare('SELECT * FROM admin_agents WHERE id = ?').get(agentId) as any;
    res.status(201).json({ 
      success: true, 
      data: { ...agent, capabilities: JSON.parse(agent.capabilities), isActive: agent.is_active === 1 } 
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
    
    const fields = ['name', 'description', 'avatar', 'system_prompt', 'capabilities', 'is_active', 'mada_category'];
    
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
      data: { ...agent, capabilities: JSON.parse(agent.capabilities), isActive: agent.is_active === 1 } 
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

// DELETE /api/admin/logs
router.delete('/logs', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM admin_system_logs').run();
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ANALYTICS ==============

// GET /api/admin/analytics
router.get('/analytics', requireAdmin, (req, res) => {
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
router.get('/analytics/chat-metrics', requireAdmin, (req, res) => {
  try {
    const { range = '7d' } = req.query;
    
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
router.get('/user-stats', (req, res) => {
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
router.get('/settings', requireAdmin, (req, res) => {
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
    
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, type, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
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
      
      stmt.run(key, strValue, type, strValue, now);
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/products/sync-all
// Bulk sync tất cả kb_products → knowledge_items để AI/RAG biết đến
router.post('/products/sync-all', requireAdmin, (req, res) => {
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
    const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 5001}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        agentId,
        language: 'vi',
        userMode: 'endUser',
        // stream: false để lấy nguyên văn
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

export default router;
