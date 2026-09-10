import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import db, { UserRow, toPublicUser, PublicUser } from './db';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'mada-ai-dev-secret-change-in-production-7f3a9b';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_DAYS = 30;

if (JWT_SECRET === 'mada-ai-dev-secret-change-in-production-7f3a9b') {
  console.warn('⚠️  Using default JWT_SECRET. Set JWT_SECRET env var in production!');
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRow['role'];
  iat?: number;
  exp?: number;
}

// ============== TOKEN HELPERS ==============

export function signAccessToken(user: UserRow): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function createSession(userId: string): { sessionId: string; refreshToken: string; expiresAt: string } {
  const sessionId = randomUUID();
  const refreshToken = randomUUID() + '.' + randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, refreshToken, expiresAt, new Date().toISOString());

  return { sessionId, refreshToken, expiresAt };
}

export function deleteSession(refreshToken: string): void {
  db.prepare('DELETE FROM sessions WHERE refresh_token = ?').run(refreshToken);
}

export function deleteAllUserSessions(userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function findSessionByRefreshToken(refreshToken: string) {
  return db.prepare(`
    SELECT s.*, u.email, u.role, u.status FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.refresh_token = ? AND s.expires_at > ?
  `).get(refreshToken, new Date().toISOString()) as any;
}

// ============== PASSWORD HELPERS ==============

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// ============== MIDDLEWARE ==============

export interface AuthRequest extends Request {
  user?: UserRow;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing access token', code: 'UNAUTHORIZED' });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as UserRow | undefined;

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Account suspended', code: 'SUSPENDED' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    return res.status(500).json({ success: false, error: 'Auth error' });
  }
}

export function requireRole(...roles: UserRow['role'][]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Auth required' });
    }
    // super_admin và admin có quyền truy cập tất cả các role
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Requires role: ${roles.join(' or ')}, you are: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }
    next();
  };
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as UserRow | undefined;
    if (user && user.status !== 'suspended') {
      req.user = user;
    }
  } catch {
    // ignore invalid tokens for optional auth
  }
  next();
}

// ============== AUDIT LOG ==============

export function auditLog(userId: string | null, action: string, req: Request, details?: Record<string, any>) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      action,
      req.originalUrl,
      details ? JSON.stringify(details) : null,
      req.ip || req.socket.remoteAddress || null,
      req.headers['user-agent'] || null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// ============== VALIDATION ==============

export const VALIDATION = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: { minLength: 6 },
  name: { minLength: 1, maxLength: 100 },
};

export function validateRegistration(email: string, password: string, name: string): string | null {
  if (!VALIDATION.email.test(email)) return 'Email không hợp lệ';
  if (password.length < VALIDATION.password.minLength) {
    return `Mật khẩu phải có ít nhất ${VALIDATION.password.minLength} ký tự`;
  }
  if (!name.trim() || name.length > VALIDATION.name.maxLength) {
    return 'Tên không hợp lệ';
  }
  return null;
}

export function validateLogin(email: string, password: string): string | null {
  if (!email.trim()) return 'Email không được để trống';
  if (!password) return 'Mật khẩu không được để trống';
  if (!VALIDATION.email.test(email)) return 'Email không hợp lệ';
  return null;
}

export { toPublicUser };
export type { PublicUser };