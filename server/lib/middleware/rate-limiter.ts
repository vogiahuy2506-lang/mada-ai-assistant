// Rate Limiter Middleware (improved from backend)

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 1000; // Increased for testing

export function createRateLimiter(options: { windowMs?: number; max?: number } = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.max || DEFAULT_MAX_REQUESTS;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

    if (entry.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
      return;
    }

    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const rateLimiter = createRateLimiter();
