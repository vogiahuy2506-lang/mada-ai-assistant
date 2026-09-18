import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db, { UserRow, toPublicUser } from '../lib/db';
import { authenticate, requireRole, auditLog, hashPassword } from '../lib/auth';
import { logActivity } from '../index';

const router = Router();

// Helper: write to admin_system_logs
function sysLog(level: 'critical' | 'error' | 'warn' | 'info' | 'success', source: string, message: string, details?: Record<string, any>, userId?: string) {
  try {
    db.prepare(`
      INSERT INTO admin_system_logs (id, level, source, message, details, user_id, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      level,
      source,
      message,
      details ? JSON.stringify(details) : null,
      userId || null,
      null, null,
      new Date().toISOString()
    );
  } catch { /* silently ignore */ }
}

// All endpoints require admin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.use(authenticate as any, requireRole('admin') as any);

// ============== GET /api/users ==============

router.get('/', (req: Request, res: Response) => {
  try {
    const { search, role, status, plan, limit = '100', offset = '0' } = req.query;

    let sql = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];

    if (search && typeof search === 'string') {
      sql += ' AND (email LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role && typeof role === 'string') {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (status && typeof status === 'string') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (plan && typeof plan === 'string') {
      sql += ' AND plan = ?';
      params.push(plan);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(sql).all(...params) as UserRow[];
    const total = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };

    res.json({
      success: true,
      data: {
        users: rows.map(toPublicUser),
        total: total.cnt,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== GET /api/users/:id ==============

router.get('/:id', (req: Request, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as UserRow | undefined;
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

// ============== POST /api/users (admin create user) ==============

router.post('/', (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'user', plan = 'free' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'email, password, name required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
      return res.status(409).json({ success: false, error: 'Email đã tồn tại', code: 'EMAIL_EXISTS' });
    }

    const validRoles = ['admin', 'data_manager', 'expert', 'user'];
    const validPlans = ['free', 'pro', 'enterprise'];
    if (!validRoles.includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
    if (!validPlans.includes(plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });

    const id = `user-${randomUUID()}`;
    const now = new Date().toISOString();
    const limits: Record<string, number> = { free: 10, pro: 100, enterprise: -1 };

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, avatar, quota_used, quota_limit, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 'email', NULL, 0, ?, NULL, ?, ?)
    `).run(id, normalizedEmail, name, hashPassword(password), role, plan, limits[plan], now, now);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    auditLog((req as any).user?.id, 'admin_create_user', req, { createdUserId: id, role, plan });
    logActivity('success', `Admin created user: ${name} (${role}/${plan})`, 'User Management', (req as any).user?.email);

    res.status(201).json({ success: true, data: { user: toPublicUser(user) } });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== PATCH /api/users/:id (admin update role/plan/status) ==============

router.patch('/:id', (req: Request, res: Response) => {
  try {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as UserRow | undefined;
    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { role, plan, status, name, quotaLimit } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (role !== undefined) {
      const validRoles = ['admin', 'data_manager', 'expert', 'user'];
      if (!validRoles.includes(role)) return res.status(400).json({ success: false, error: 'Invalid role' });
      updates.push('role = ?');
      values.push(role);
    }

    if (plan !== undefined) {
      const validPlans = ['free', 'pro', 'enterprise'];
      if (!validPlans.includes(plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });
      updates.push('plan = ?');
      values.push(plan);
      const limits: Record<string, number> = { free: 10, pro: 100, enterprise: -1 };
      updates.push('quota_limit = ?');
      values.push(limits[plan]);
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'suspended', 'pending'];
      if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
      if (target.id === (req as any).user?.id && status === 'suspended') {
        return res.status(400).json({ success: false, error: 'Không thể tự khóa tài khoản admin' });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (quotaLimit !== undefined) {
      updates.push('quota_limit = ?');
      values.push(Number(quotaLimit));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Có gì đó để cập nhật' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(target.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(target.id) as UserRow;
    auditLog((req as any).user?.id, 'admin_update_user', req, { targetId: target.id, changes: req.body });
    const changes = Object.keys(req.body).filter((k) => req.body[k] !== undefined).join(', ');
    logActivity(
      status === 'suspended' ? 'warn' : 'info',
      `Admin updated ${target.email}: ${changes}`,
      'User Management',
      (req as any).user?.email
    );

    // Log to admin_system_logs
    sysLog(
      status === 'suspended' ? 'warn' : 'info',
      'users',
      `Cập nhật người dùng ${target.email}`,
      { targetId: target.id, changes: req.body },
      (req as any).user?.id
    );

    res.json({ success: true, data: { user: toPublicUser(updated) } });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== DELETE /api/users/:id ==============

router.delete('/:id', (req: Request, res: Response) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as UserRow | undefined;
  if (!target) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  if (target.id === (req as any).user?.id) {
    return res.status(400).json({ success: false, error: 'Không thể tự xóa' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  auditLog((req as any).user?.id, 'admin_delete_user', req, { targetId: target.id, email: target.email });
  logActivity('warn', `Admin deleted user: ${target.email}`, 'User Management', (req as any).user?.email);

  // Log to admin_system_logs
  sysLog(
    'error',
    'users',
    `Xóa tài khoản người dùng ${target.email}`,
    { targetId: target.id, email: target.email },
    (req as any).user?.id
  );

  res.json({ success: true });
});

// ============== GET /api/users/stats/overview ==============

router.get('/stats/overview', (_req: Request, res: Response) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
      SUM(CASE WHEN plan = 'enterprise' THEN 1 ELSE 0 END) as enterprise,
      SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro,
      SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free
    FROM users
  `).get() as any;

  res.json({ success: true, data: stats });
});

export default router;