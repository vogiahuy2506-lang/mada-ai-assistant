import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { authenticate, requireRole } from '../lib/auth';

const router = Router();

// Middleware: require admin authentication
const requireAdmin = [authenticate, requireRole('admin', 'super_admin')];

// ============== HELPER: Create notification ==============
export function createNotification(params: {
  type: 'info' | 'warning' | 'error' | 'success' | 'system';
  title: string;
  message: string;
  link?: string;
  linkLabel?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: 'general' | 'user' | 'product' | 'system' | 'security' | 'performance' | 'support';
  metadata?: Record<string, any>;
  createdBy?: string;
}) {
  try {
    const now = new Date().toISOString();
    const id = `notif-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO admin_notifications (id, type, title, message, link, link_label, priority, category, metadata, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.type,
      params.title,
      params.message,
      params.link || null,
      params.linkLabel || null,
      params.priority || 'normal',
      params.category || 'general',
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.createdBy || null,
      now
    );
    
    return { success: true, id };
  } catch (err) {
    console.error('[createNotification] Error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ============== GET /api/notifications - Get all notifications ==============
router.get('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const { 
      limit = '50', 
      offset = '0', 
      is_read, 
      category, 
      priority,
      type 
    } = req.query;
    
    let sql = 'SELECT * FROM admin_notifications WHERE 1=1';
    const params: any[] = [];
    
    if (is_read !== undefined) {
      sql += ' AND is_read = ?';
      params.push(is_read === 'true' ? 1 : 0);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    // Get total count
    let countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countSql).get(...params) as { total: number };
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const notifications = db.prepare(sql).all(...params) as any[];
    
    // Get unread count
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0').get() as { count: number };
    
    // Parse metadata
    const parsed = notifications.map((n: any) => ({
      ...n,
      is_read: n.is_read === 1,
      isRead: n.is_read === 1,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      createdAt: n.created_at,
      readAt: n.read_at,
    }));
    
    res.json({
      success: true,
      data: {
        notifications: parsed,
        total,
        unreadCount: unreadCount.count,
      },
    });
  } catch (error: any) {
    console.error('[GET /notifications] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET /api/notifications/unread - Get unread count ==============
router.get('/unread', requireAdmin, (_req: Request, res: Response) => {
  try {
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0').get() as { count: number };
    
    // Get recent unread notifications
    const recentUnread = db.prepare(`
      SELECT id, type, title, message, link, priority, category, created_at
      FROM admin_notifications 
      WHERE is_read = 0 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    res.json({
      success: true,
      data: {
        unreadCount: unreadCount.count,
        recentUnread,
      },
    });
  } catch (error: any) {
    console.error('[GET /notifications/unread] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET /api/notifications/stats - Get notification stats ==============
router.get('/stats', requireAdmin, (_req: Request, res: Response) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM admin_notifications').get() as { count: number };
    const unread = db.prepare('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0').get() as { count: number };
    const urgent = db.prepare('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0 AND priority = \'urgent\'').get() as { count: number };
    const high = db.prepare('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0 AND priority = \'high\'').get() as { count: number };
    
    // By category
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM admin_notifications 
      WHERE is_read = 0 
      GROUP BY category
    `).all() as { category: string; count: number }[];
    
    // By type
    const byType = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM admin_notifications 
      WHERE is_read = 0 
      GROUP BY type
    `).all() as { type: string; count: number }[];
    
    res.json({
      success: true,
      data: {
        total: total.count,
        unread: unread.count,
        urgent: urgent.count,
        high: high.count,
        byCategory,
        byType,
      },
    });
  } catch (error: any) {
    console.error('[GET /notifications/stats] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PATCH /api/notifications/:id/read - Mark as read ==============
router.patch('/:id/read', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE admin_notifications 
      SET is_read = 1, read_at = ?, read_by = ?
      WHERE id = ?
    `).run(now, (req as any).user?.id, id);
    
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('[PATCH /notifications/:id/read] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PATCH /api/notifications/read-all - Mark all as read ==============
router.patch('/read-all', requireAdmin, (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      UPDATE admin_notifications 
      SET is_read = 1, read_at = ?, read_by = ?
      WHERE is_read = 0
    `).run(now, (req as any).user?.id);
    
    res.json({ 
      success: true, 
      message: `Marked ${result.changes} notifications as read` 
    });
  } catch (error: any) {
    console.error('[PATCH /notifications/read-all] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== DELETE /api/notifications/:id - Delete notification ==============
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    db.prepare('DELETE FROM admin_notifications WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    console.error('[DELETE /notifications/:id] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== DELETE /api/notifications/clear-all - Clear all read notifications ==============
router.delete('/clear-all', requireAdmin, (_req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM admin_notifications WHERE is_read = 1').run();
    
    res.json({ 
      success: true, 
      message: `Cleared ${result.changes} read notifications` 
    });
  } catch (error: any) {
    console.error('[DELETE /notifications/clear-all] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/notifications - Create notification (internal use) ==============
router.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const { type, title, message, link, linkLabel, priority, category, metadata } = req.body;
    
    if (!type || !title || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'type, title, and message are required' 
      });
    }
    
    const result = createNotification({
      type,
      title,
      message,
      link,
      linkLabel,
      priority,
      category,
      metadata,
      createdBy: (req as any).user?.id,
    });
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error: any) {
    console.error('[POST /notifications] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
