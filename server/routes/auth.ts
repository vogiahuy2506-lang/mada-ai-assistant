import { Router, Request, Response } from 'express';
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

    // Check if admin approval is required (default: true for better security)
    const ADMIN_APPROVAL_REQUIRED = process.env.ADMIN_APPROVAL_REQUIRED !== 'false';
    const defaultStatus = ADMIN_APPROVAL_REQUIRED ? 'pending' : 'active';

    db.prepare(`
  INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, avatar, quota_used, quota_limit, last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'user', 'free', ?, 'email', NULL, 0, 10, NULL, ?, ?)
`).run(id, normalizedEmail, name.trim(), passwordHash, defaultStatus, now, now);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    const accessToken = signAccessToken(user);
    const { refreshToken, expiresAt } = createSession(user.id);

    auditLog(user.id, 'register', req, { email: user.email });
    logActivity('success', `New user registered: ${user.name}`, 'Auth Service', user.email);
    sysLog('success', 'auth', 'Đăng ký tài khoản mới', { email: user.email, name: user.name, role: user.role });

    // Check if pending approval
    const needsApproval = user.status === 'pending';
    const approvalMessage = needsApproval
      ? ' Tài khoản của bạn đang chờ phê duyệt. Vui lòng đợi email xác nhận.'
      : '';

    res.status(201).json({
      success: true,
      data: {
        user: toPublicUser(user),
        accessToken,
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
        pendingApproval: needsApproval,
      },
      message: needsApproval ? `Đăng ký thành công!${approvalMessage}` : undefined,
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
      sysLog('error', 'auth', 'Đăng nhập thất bại', { email: normalizedEmail, reason: 'wrong_password' });
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không đúng', code: 'INVALID_CREDENTIALS' });
    }

    if (user.status === 'suspended') {
      logActivity('warn', `Suspended account login attempt: ${normalizedEmail}`, 'Auth Service');
      sysLog('error', 'auth', 'Đăng nhập thất bại - tài khoản bị khóa', { email: normalizedEmail });
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị tạm khóa', code: 'SUSPENDED' });
    }

    // Super Admin và Admin luôn được đăng nhập, bỏ qua pending approval
    const bypassApproval = user.role === 'super_admin' || user.role === 'admin';
    if (user.status === 'pending' && !bypassApproval) {
      logActivity('warn', `Pending account login attempt: ${normalizedEmail}`, 'Auth Service');
      return res.status(403).json({ success: false, error: 'Tài khoản đang chờ duyệt', code: 'PENDING' });
    }

    const now = new Date().toISOString();

    // Auto-activate super_admin và admin nếu đang pending
    if (user.status === 'pending' && bypassApproval) {
      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run('active', now, user.id);
      logActivity('info', `Auto-activated ${user.role} account: ${normalizedEmail}`, 'Auth Service');
    }

    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);

    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
    const accessToken = signAccessToken(freshUser);
    const { refreshToken, expiresAt } = createSession(freshUser.id);

    auditLog(freshUser.id, 'login', req);
    logActivity('info', `User logged in: ${freshUser.name} (${freshUser.role})`, 'Auth Service', freshUser.email);
    sysLog('success', 'auth', 'Đăng nhập thành công', { email: freshUser.email, name: freshUser.name, role: freshUser.role }, freshUser.id);

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

router.get('/me', authenticate as any, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({
    success: true,
    data: { user: toPublicUser(authReq.user!) },
  });
});

// ============== POST /api/auth/logout ==============

router.post('/logout', authenticate as any, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { refreshToken } = req.body;
  if (refreshToken) {
    deleteSession(refreshToken);
  } else {
    deleteAllUserSessions(authReq.user!.id);
  }
  auditLog(authReq.user!.id, 'logout', req);
  logActivity('info', `User logged out: ${authReq.user!.email}`, 'Auth Service', authReq.user!.email);
  sysLog('info', 'auth', 'Đăng xuất khỏi hệ thống', { email: authReq.user!.email }, authReq.user!.id);
  res.json({ success: true });
});

// ============== PUT /api/auth/profile ==============

router.put('/profile', authenticate as any, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { name, avatar } = req.body;
    const user = authReq.user!;

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
    sysLog('info', 'auth', 'Cập nhật hồ sơ cá nhân', { updatedFields: Object.keys(req.body) }, user.id);
    res.json({ success: true, data: { user: toPublicUser(updated) } });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== PUT /api/auth/password ==============

router.put('/password', authenticate as any, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { currentPassword, newPassword } = req.body;
    const user = authReq.user!;

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

// ============== POST /api/auth/reset-admin (EMERGENCY ONLY) ==============

router.post('/reset-admin', async (req, res) => {
  const SECRET_KEY = process.env.ADMIN_RESET_SECRET || 'mada-emergency-reset-2024';
  
  try {
    const { secret, email, password } = req.body;
    
    // Verify secret key
    if (secret !== SECRET_KEY) {
      return res.status(403).json({ success: false, error: 'Invalid secret key' });
    }
    
    const targetEmail = email || 'superadmin@mada.vn';
    const newPassword = password || 'SuperAdmin@123';
    
    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND role IN (?, ?)').get(targetEmail, 'super_admin', 'admin') as UserRow;
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }
    
    // Hash and update password
    const hash = hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, user.id);
    
    // Delete all sessions
    deleteAllUserSessions(user.id);
    
    auditLog(user.id, 'admin_password_reset', req as any, { resetBy: 'emergency-api' });
    logActivity('warn', `Admin password reset for ${targetEmail}`, 'Auth Service');
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      credentials: {
        email: targetEmail,
        password: newPassword
      }
    });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

// ============== GET /auth/google/url ==============

router.get('/google/url', (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ 
      success: false, 
      message: 'Google OAuth chưa được cấu hình. Vui lòng liên hệ quản trị viên.' 
    });
  }
  
  // Redirect to Google OAuth
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${process.env.APP_URL || 'http://localhost:5173'}/api/auth/google/callback`);
  const scope = encodeURIComponent('profile email');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=select_account`;
  
  res.json({ success: true, url: authUrl });
});

// Alias for frontend compatibility (direct redirect)
router.get('/google', (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ 
      success: false, 
      message: 'Google OAuth chưa được cấu hình.' 
    });
  }
  
  // Redirect to Google OAuth
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${process.env.APP_URL || 'http://localhost:5173'}/api/auth/google/callback`);
  const scope = encodeURIComponent('profile email');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=select_account`;
  
  res.redirect(authUrl);
});

// ============== GET /auth/google/callback ==============

router.get('/google/callback', (req, res) => {
  const { code, error } = req.query;
  
  if (error || !code) {
    console.error('Google OAuth error:', error);
    return res.redirect('/?error=google_oauth_failed');
  }
  
  // Exchange code for tokens and authenticate user
  exchangeCodeForTokens(code as string, req, res);
});

async function exchangeCodeForTokens(code: string, req: any, res: any) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/api/auth/google/callback`;
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token: string };
    
    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const googleUser = await userResponse.json() as { id: string; email: string; name: string; picture: string };
    
    // 🔐 Check domain restriction
    const allowedDomains = process.env.ALLOWED_GOOGLE_DOMAINS;
    if (allowedDomains) {
      const domains = allowedDomains.split(',').map(d => d.trim().toLowerCase().replace('@', ''));
      const userDomain = googleUser.email.split('@')[1]?.toLowerCase();
      if (!userDomain || !domains.includes(userDomain)) {
        console.error(`Google OAuth blocked: ${googleUser.email} not in allowed domains: ${allowedDomains}`);
        return res.redirect('/?error=google_domain_not_allowed');
      }
    }
    
    // Find or create user in database
    const email = googleUser.email.toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleUser.id) as UserRow | undefined;
    
    if (!user) {
      // Check if email exists (link account)
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
      
      if (user) {
        // Link Google to existing account
        db.prepare('UPDATE users SET google_id = ?, avatar = COALESCE(?, avatar), updated_at = ? WHERE id = ?')
          .run(googleUser.id, googleUser.picture, new Date().toISOString(), user.id);
      } else {
        // Create new user
        const id = `user-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO users (id, email, name, google_id, avatar, role, plan, status, provider, quota_used, quota_limit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'user', 'free', 'active', 'google', 0, 10, ?, ?)
        `).run(id, email, googleUser.name, googleUser.id, googleUser.picture, now, now);
      }
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleUser.id) as UserRow;
    }

    // Update last login
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user!.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user!.id) as UserRow;

    // Generate JWT tokens
    const accessToken = signAccessToken(user!);
    const { refreshToken, expiresAt } = createSession(user!.id);

    auditLog(user!.id, 'google_login', req);
    logActivity('info', `User logged in with Google: ${user!.name}`, 'Auth Service', user!.email);

    // Redirect to frontend with tokens
    res.redirect(`/?google_auth=success&access_token=${accessToken}&refresh_token=${refreshToken}&expires_at=${expiresAt}&user_id=${user!.id}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('/?error=google_oauth_failed');
  }
}

export default router;