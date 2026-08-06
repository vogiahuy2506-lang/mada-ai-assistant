// Error Handler Middleware (from backend/src/middleware/error-handler)

import { Request, Response, NextFunction } from 'express';

export interface APIError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
}

export function createError(
  message: string,
  statusCode: number,
  code: string,
  details?: unknown
): APIError {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function errorHandler(
  err: APIError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const code = 'code' in err ? err.code : 'INTERNAL_ERROR';

  console.error('Error:', err.message);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
    },
    timestamp: new Date().toISOString(),
  });
}

export const errors = {
  badRequest: (message: string) => createError(message, 400, 'BAD_REQUEST'),
  unauthorized: (message: string = 'Unauthorized') => createError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message: string = 'Forbidden') => createError(message, 403, 'FORBIDDEN'),
  notFound: (message: string = 'Resource not found') => createError(message, 404, 'NOT_FOUND'),
  validationError: (message: string) => createError(message, 400, 'VALIDATION_ERROR'),
  rateLimited: (message: string = 'Too many requests') => createError(message, 429, 'RATE_LIMITED'),
  internal: (message: string = 'Internal server error') => createError(message, 500, 'INTERNAL_ERROR'),
  serviceUnavailable: (message: string = 'Service unavailable') => createError(message, 503, 'SERVICE_UNAVAILABLE'),
};
