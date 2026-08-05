import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import db, { UserRow } from '../lib/db';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  createSession,
  deleteSession,
  deleteAllUserSessions,
  findSessionByRefreshToken,
  authenticate,
  validateRegistration,
  validateLogin,
  toPublicUser,
  auditLog,
  AuthRequest,
} from '../lib/auth';
import { logActivity } from '../index';

const router = Router();

// ============== POST /api/auth/register ==============

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const validationError = validateRegistration(email, password, name);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email đã được đăng ký', code: 'EMAIL_EXISTS' });
    }

    const now = new Date().toISOString();
    const id = `user-${randomUUID()}`;
    const passwordHash = hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 'free', 'active', 'email', 0, 10, ?, ?)
    `).run(id, normalizedEmail, name.trim(), passwordHash, now, now);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    const accessToken = signAccessToken(user);
    const { refreshToken, expiresAt } = createSession(user.id);

    auditLog(user.id, 'register', req, { email: user.email });
    logActivity('success', `New user registered: ${user.name}`, 'Auth Service', user.email);

    res.status(201).json({
      success: true,
      data: {
        user: toPublicUser(user),
        accessToken,
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== POST /api/auth/login ==============

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const validationError = validateLogin(email, password);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as UserRow | undefined;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không đúng', code: 'INVALID_CREDENTIALS' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      auditLog(user.id, 'login_failed', req, { reason: 'wrong_password' });
      logActivity('warn', `Failed login attempt for ${normalizedEmail}`, 'Auth Service', undefined, 'wrong_password');
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không đúng', code: 'INVALID_CREDENTIALS' });
    }

    if (user.status === 'suspended') {
      logActivity('warn', `Suspended account login attempt: ${normalizedEmail}`, 'Auth Service');
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị tạm khóa', code: 'SUSPENDED' });
    }

    if (user.status === 'pending') {
      logActivity('warn', `Pending account login attempt: ${normalizedEmail}`, 'Auth Service');
      return res.status(403).json({ success: false, error: 'Tài khoản đang chờ duyệt', code: 'PENDING' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);

    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
    const accessToken = signAccessToken(freshUser);
    const { refreshToken, expiresAt } = createSession(freshUser.id);

    auditLog(freshUser.id, 'login', req);
    logActivity('info', `User logged in: ${freshUser.name} (${freshUser.role})`, 'Auth Service', freshUser.email);

    res.json({
      success: true,
      data: {
        user: toPublicUser(freshUser),
        accessToken,
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== POST /api/auth/refresh ==============

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const session = findSessionByRefreshToken(refreshToken);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token', code: 'INVALID_REFRESH' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as UserRow;
    if (!user || user.status === 'suspended') {
      return res.status(401).json({ success: false, error: 'User not authorized' });
    }

    deleteSession(refreshToken);
    const newAccessToken = signAccessToken(user);
    const newRefresh = createSession(user.id);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefresh.refreshToken,
        refreshTokenExpiresAt: newRefresh.expiresAt,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== GET /api/auth/me ==============

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: { user: toPublicUser(req.user!) },
  });
});

// ============== POST /api/auth/logout ==============

router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    deleteSession(refreshToken);
  } else {
    deleteAllUserSessions(req.user!.id);
  }
  auditLog(req.user!.id, 'logout', req);
  logActivity('info', `User logged out: ${req.user!.email}`, 'Auth Service', req.user!.email);
  res.json({ success: true });
});

// ============== PUT /api/auth/profile ==============

router.put('/profile', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar } = req.body;
    const user = req.user!;

    if (name !== undefined) {
      if (!name.trim() || name.length > 100) {
        return res.status(400).json({ success: false, error: 'Tên không hợp lệ' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Có gì đó để cập nhật' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
    auditLog(user.id, 'profile_update', req);
    res.json({ success: true, data: { user: toPublicUser(updated) } });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== PUT /api/auth/password ==============

router.put('/password', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user!;

    if (!currentPassword || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Mật khẩu hiện tại không đúng' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, new Date().toISOString(), user.id);

    deleteAllUserSessions(user.id);

    auditLog(user.id, 'password_change', req);
    res.json({ success: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

export default router;