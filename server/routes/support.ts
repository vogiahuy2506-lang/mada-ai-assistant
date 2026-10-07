import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { authenticate, requireRole } from '../lib/auth';
import { createNotification } from './notifications';

const router = Router();

// Middleware: require admin authentication
const requireAdmin = [authenticate, requireRole('admin', 'super_admin')];

// ============== HELPER: Generate ticket number ==============
function generateTicketNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TKT-${year}${month}-${random}`;
}

// ============== GET /api/support - Get all tickets ==============
router.get('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const { 
      limit = '50', 
      offset = '0', 
      status, 
      priority,
      category,
      search,
      assigned_to,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;
    
    let sql = `
      SELECT t.*, 
        u.name as assigned_to_name,
        (SELECT COUNT(*) FROM support_ticket_replies WHERE ticket_id = t.id) as reply_count
      FROM support_tickets t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }
    if (category) {
      sql += ' AND t.category = ?';
      params.push(category);
    }
    if (assigned_to) {
      sql += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }
    if (search) {
      sql += ' AND (t.subject LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ? OR t.user_email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Get total count
    let countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/LEFT JOIN[\s\S]*?ON[\s\S]*?/, '');
    countSql = countSql.replace(/,\s*u\.name[\s\S]*?as reply_count/, '');
    countSql = countSql.replace(/\(SELECT COUNT\(\*\) FROM support_ticket_replies WHERE ticket_id = t\.id\) as reply_count/, '');
    const { total } = db.prepare(countSql).get(...params) as { total: number };
    
    // Valid sort columns
    const validSortColumns = ['created_at', 'updated_at', 'priority', 'status', 'ticket_number'];
    const sortColumn = validSortColumns.includes(String(sort_by)) ? String(sort_by) : 'created_at';
    const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY t.${sortColumn} ${sortDirection}`;
    
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const tickets = db.prepare(sql).all(...params) as any[];
    
    // Get stats
    const stats = {
      open: (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get() as { count: number }).count,
      in_progress: (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'in_progress'").get() as { count: number }).count,
      resolved: (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'resolved'").get() as { count: number }).count,
      closed: (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'closed'").get() as { count: number }).count,
      urgent: (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'in_progress') AND priority = 'urgent'").get() as { count: number }).count,
    };
    
    res.json({
      success: true,
      data: {
        tickets,
        total,
        stats,
      },
    });
  } catch (error: any) {
    console.error('[GET /support] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET /api/support/:id - Get single ticket ==============
router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ticket = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
      FROM support_tickets t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `).get(id) as any;
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    // Get replies
    const replies = db.prepare(`
      SELECT r.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
      FROM support_ticket_replies r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.ticket_id = ?
      ORDER BY r.created_at ASC
    `).all(id) as any[];
    
    // Parse attachments
    const parsedReplies = replies.map((r: any) => ({
      ...r,
      attachments: r.attachments ? JSON.parse(r.attachments) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    
    res.json({
      success: true,
      data: {
        ticket: {
          ...ticket,
          createdAt: ticket.created_at,
          updatedAt: ticket.updated_at,
          assignedAt: ticket.assigned_at,
          resolvedAt: ticket.resolved_at,
          closedAt: ticket.closed_at,
        },
        replies: parsedReplies,
      },
    });
  } catch (error: any) {
    console.error('[GET /support/:id] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/support - Create ticket (user-facing) ==============
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, user_email, user_name, subject, description, category, priority } = req.body;
    
    if (!user_email || !user_name || !subject || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_email, user_name, subject, and description are required' 
      });
    }
    
    const id = `ticket-${uuidv4()}`;
    const ticketNumber = generateTicketNumber();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO support_tickets (
        id, ticket_number, user_id, user_email, user_name, subject, description,
        category, priority, status, ip_address, user_agent, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      id,
      ticketNumber,
      user_id || null,
      user_email,
      user_name,
      subject,
      description,
      category || 'general',
      priority || 'normal',
      req.ip || null,
      req.headers['user-agent'] || null,
      now,
      now
    );
    
    // Create notification for admins
    createNotification({
      type: 'info',
      title: 'Ticket hỗ trợ mới',
      message: `Ticket #${ticketNumber}: ${subject}`,
      link: `/admin/support/${id}`,
      linkLabel: 'Xem ticket',
      priority: priority === 'urgent' ? 'urgent' : priority === 'high' ? 'high' : 'normal',
      category: 'support',
      metadata: { ticketId: id, ticketNumber, userEmail: user_email },
    });
    
    res.status(201).json({
      success: true,
      data: {
        id,
        ticketNumber,
      },
    });
  } catch (error: any) {
    console.error('[POST /support] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PATCH /api/support/:id - Update ticket ==============
router.patch('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, category, assigned_to } = req.body;
    
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];
    
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      
      if (status === 'resolved') {
        updates.push('resolved_at = ?');
        params.push(now);
      } else if (status === 'closed') {
        updates.push('closed_at = ?');
        params.push(now);
      }
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
      if (assigned_to) {
        updates.push('assigned_at = ?');
        params.push(now);
      }
    }
    
    params.push(id);
    
    db.prepare(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    // Get updated ticket
    const updatedTicket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedTicket });
  } catch (error: any) {
    console.error('[PATCH /support/:id] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/support/:id/reply - Add reply to ticket ==============
router.post('/:id/reply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, message, attachments } = req.body;
    
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const replyId = `reply-${uuidv4()}`;
    const now = new Date().toISOString();
    
    // Determine if this is admin reply
    const isAdminReply = user_id && ['admin', 'super_admin', 'data_manager', 'expert'].includes(
      (db.prepare('SELECT role FROM users WHERE id = ?').get(user_id) as any)?.role || ''
    );
    
    db.prepare(`
      INSERT INTO support_ticket_replies (id, ticket_id, user_id, is_admin_reply, message, attachments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      replyId,
      id,
      user_id || null,
      isAdminReply ? 1 : 0,
      message.trim(),
      attachments ? JSON.stringify(attachments) : null,
      now,
      now
    );
    
    // Update ticket status if needed
    if (!isAdminReply && ticket.status === 'resolved') {
      db.prepare(`UPDATE support_tickets SET status = 'in_progress', updated_at = ? WHERE id = ?`).run(now, id);
    } else {
      db.prepare(`UPDATE support_tickets SET updated_at = ? WHERE id = ?`).run(now, id);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: replyId,
        message: message.trim(),
        isAdminReply,
        createdAt: now,
      },
    });
  } catch (error: any) {
    console.error('[POST /support/:id/reply] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== DELETE /api/support/:id - Delete ticket ==============
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    db.prepare('DELETE FROM support_ticket_replies WHERE ticket_id = ?').run(id);
    db.prepare('DELETE FROM support_tickets WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error: any) {
    console.error('[DELETE /support/:id] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== POST /api/support/:id/rate - Rate ticket ==============
router.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }
    
    db.prepare(`
      UPDATE support_tickets 
      SET rating = ?, rating_comment = ?, updated_at = ?
      WHERE id = ?
    `).run(rating, comment || null, new Date().toISOString(), id);
    
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error: any) {
    console.error('[POST /support/:id/rate] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET /api/support/admins/list - Get admin list for assignment ==============
router.get('/admins/list', requireAdmin, (_req: Request, res: Response) => {
  try {
    const admins = db.prepare(`
      SELECT id, email, name, avatar, role
      FROM users
      WHERE role IN ('admin', 'super_admin', 'data_manager', 'expert')
      ORDER BY name ASC
    `).all();
    
    res.json({ success: true, data: admins });
  } catch (error: any) {
    console.error('[GET /support/admins/list] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET /api/support/stats/overview - Get ticket stats ==============
router.get('/stats/overview', requireAdmin, (_req: Request, res: Response) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM support_tickets').get() as { count: number };
    const open = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get() as { count: number };
    const inProgress = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'in_progress'").get() as { count: number };
    const resolved = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'resolved'").get() as { count: number };
    const closed = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'closed'").get() as { count: number };
    
    const avgResponseTime = db.prepare(`
      SELECT AVG(
        (julianday(resolved_at) - julianday(created_at)) * 24 * 60
      ) as avg_minutes
      FROM support_tickets
      WHERE resolved_at IS NOT NULL
    `).get() as { avg_minutes: number | null };
    
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM support_tickets
      GROUP BY category
      ORDER BY count DESC
    `).all() as { category: string; count: number }[];
    
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM support_tickets
      WHERE status IN ('open', 'in_progress')
      GROUP BY priority
    `).all() as { priority: string; count: number }[];
    
    res.json({
      success: true,
      data: {
        total: total.count,
        open: open.count,
        inProgress: inProgress.count,
        resolved: resolved.count,
        closed: closed.count,
        avgResponseTimeMinutes: avgResponseTime.avg_minutes ? Math.round(avgResponseTime.avg_minutes) : null,
        byCategory,
        byPriority,
      },
    });
  } catch (error: any) {
    console.error('[GET /support/stats/overview] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
