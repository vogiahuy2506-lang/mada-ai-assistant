// Request Logger Middleware

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';
import { httpRequestDuration, httpRequestTotal } from '../utils/metrics.js';

const logger = createLogger('RequestLogger');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;

    // Log response
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });

    // Record metrics
    const route = req.route?.path || req.path;
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode.toString() },
      duration / 1000
    );
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    });

    return originalSend.call(this, body);
  };

  next();
}

// Skip logging for health checks
export function skipHealthCheck(req: Request): boolean {
  return req.path === '/health' || req.path === '/api/v1/health';
}
