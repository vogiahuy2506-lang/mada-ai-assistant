// App Configuration - Environment variables and settings (from backend/src/config)

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default(''),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.3),
  GEMINI_MAX_TOKENS: z.coerce.number().min(1).default(8192),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Feature Flags
  ENABLE_RAG: z.string().default('true'),
  ENABLE_GUARDRAILS: z.string().default('true'),
  ENABLE_METRICS: z.string().default('true'),

  // Email
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.string().default('465'),
  MAIL_SECURE: z.string().default('true'),
  MAIL_TLS: z.string().default('true'),
  MAIL_USERNAME: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('mada.noreply@digiso.vn'),
  CONSULTATION_EMAIL: z.string().default('contact@mada.vn'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:', parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;

export const appConfig = {
  port: parseInt(config.PORT, 10),
  nodeEnv: config.NODE_ENV,
  corsOrigins: config.CORS_ORIGINS ? config.CORS_ORIGINS.split(',').map(s => s.trim()) : [],
  isProduction: config.NODE_ENV === 'production',
  isDevelopment: config.NODE_ENV === 'development',
  isTest: config.NODE_ENV === 'test',
};

export const geminiConfig = {
  apiKey: config.GEMINI_API_KEY,
  model: config.GEMINI_MODEL,
  temperature: config.GEMINI_TEMPERATURE,
  maxTokens: config.GEMINI_MAX_TOKENS,
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
};

export const featureFlags = {
  enableRag: config.ENABLE_RAG === 'true',
  enableGuardrails: config.ENABLE_GUARDRAILS === 'true',
  enableMetrics: config.ENABLE_METRICS === 'true',
};
