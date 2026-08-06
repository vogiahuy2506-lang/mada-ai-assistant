// Rate Limiter Middleware

import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { rateLimitConfig } from '../config/app.config.js';
import { createLogger } from '../utils/logger.js';
import { errors } from './error-handler.js';

const logger = createLogger('RateLimiter');

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private cache: NodeCache;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs?: number, maxRequests?: number) {
    this.windowMs = windowMs || rateLimitConfig.windowMs;
    this.maxRequests = maxRequests || rateLimitConfig.maxRequests;
    this.cache = new NodeCache({
      stdTTL: Math.ceil(this.windowMs / 1000),
      checkperiod: 60,
    });

    logger.info('Rate limiter initialized', {
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    });
  }

  private getKey(req: Request): string {
    // Use IP address as key, or user ID if authenticated
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const user = (req as Request & { user?: { id?: string } }).user;
    const userId = user?.id || '';
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  check(req: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(req);
    const now = Date.now();

    let entry = this.cache.get<RateLimitEntry>(key);

    if (!entry) {
      entry = { count: 1, resetTime: now + this.windowMs };
      this.cache.set(key, entry);
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: entry.resetTime };
    }

    if (now > entry.resetTime) {
      // Reset window
      entry = { count: 1, resetTime: now + this.windowMs };
      this.cache.set(key, entry);
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: entry.resetTime };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    this.cache.set(key, entry);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = this.check(req);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
        });

        const error = errors.rateLimited(
          `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
        );
        return next(error);
      }

      next();
    };
  }
}

// Default rate limiter instance
export const rateLimiter = new RateLimiter();

// Per-endpoint rate limiters
export const chatRateLimiter = new RateLimiter(60000, 30); // 30 requests per minute
export const searchRateLimiter = new RateLimiter(60000, 60); // 60 requests per minute

// Create scrape rate limiter as a function to avoid initialization issues
export function createScrapeRateLimiter() {
  return new RateLimiter(60000, 20); // 20 requests per minute
}
