/**
 * MADA AI - Structured Logging System
 * 
 * Cung cấp structured logging với các cấp độ:
 * - DEBUG: Chi tiết cho development
 * - INFO: Thông tin chung
 * - WARN: Cảnh báo
 * - ERROR: Lỗi
 * - SUCCESS: Thành công
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  data?: Record<string, any>;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

// In-memory log storage for debugging
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 1000;

class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'MADA') {
    this.serviceName = serviceName;
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, duration?: number, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...(data && Object.keys(data).length > 0 && { data }),
      ...(duration !== undefined && { duration }),
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // Store in history
    logHistory.unshift(entry);
    if (logHistory.length > MAX_LOG_HISTORY) {
      logHistory.pop();
    }

    // Console output with formatting
    const icons: Record<string, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    };

    const icon = icons[level] || '📝';
    const prefix = `${icon} [${this.serviceName}]`;

    if (level === LogLevel.ERROR && error) {
      console.error(`${prefix} ${message}`, data || '', '\n', error.stack);
    } else if (level === LogLevel.WARN) {
      console.warn(`${prefix} ${message}`, data || '');
    } else if (level === LogLevel.DEBUG) {
      console.debug(`${prefix} ${message}`, data || '');
    } else {
      console.log(`${prefix} ${message}`, data || '');
    }

    return entry;
  }

  debug(message: string, data?: Record<string, any>): LogEntry {
    return this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, any>): LogEntry {
    return this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, any>): LogEntry {
    return this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, any>): LogEntry {
    return this.log(LogLevel.ERROR, message, data, undefined, error);
  }

  success(message: string, data?: Record<string, any>): LogEntry {
    return this.log(LogLevel.SUCCESS, message, data);
  }

  // Log with duration (useful for performance tracking)
  timed<T>(operation: string, fn: () => T | Promise<T>, data?: Record<string, any>): Promise<T> | T {
    const start = Date.now();
    
    try {
      const result = fn();
      
      // Handle promise
      if (result instanceof Promise) {
        return (async () => {
          try {
            const value = await result;
            const duration = Date.now() - start;
            this.log(LogLevel.SUCCESS, operation, { ...data, durationMs: duration });
            return value;
          } catch (error) {
            const duration = Date.now() - start;
            this.log(LogLevel.ERROR, `${operation} failed`, { ...data, durationMs: duration }, undefined, error as Error);
            throw error;
          }
        })();
      }
      
      const duration = Date.now() - start;
      this.log(LogLevel.SUCCESS, operation, { ...data, durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log(LogLevel.ERROR, `${operation} failed`, { ...data, durationMs: duration }, undefined, error as Error);
      throw error;
    }
  }
}

// Create logger instances for different services
export const createLogger = (serviceName: string): Logger => {
  return new Logger(serviceName);
};

// Default loggers
export const logger = createLogger('MADA');
export const ragLogger = createLogger('RAG');
export const authLogger = createLogger('AUTH');
export const kbLogger = createLogger('KB');
export const scraperLogger = createLogger('SCRAPER');
export const paymentLogger = createLogger('PAYMENT');
export const guardrailLogger = createLogger('GUARDRAIL');

// Get log history (for debugging/monitoring)
export function getLogHistory(limit: number = 100): LogEntry[] {
  return logHistory.slice(0, limit);
}

// Get logs by level
export function getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
  return logHistory.filter((l) => l.level === level).slice(0, limit);
}

// Get logs by service
export function getLogsByService(service: string, limit: number = 100): LogEntry[] {
  return logHistory.filter((l) => l.service === service).slice(0, limit);
}
