// Winston Logger Configuration

import winston from 'winston';
import { appConfig } from '../config/app.config.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: appConfig?.isTest ? 'error' : 'info',
  format: appConfig?.isProduction ? jsonFormat : logFormat,
  transports: [
    new winston.transports.Console({
      format: appConfig?.isProduction
        ? winston.format.combine(winston.format.colorize(), logFormat)
        : winston.format.colorize(),
    }),
  ],
});

// Create child logger for specific services
export function createLogger(service: string) {
  return logger.child({ service });
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  sessionId?: string;
  userId?: string;
  action: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}
