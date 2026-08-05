// App Configuration - Environment variables and settings

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.3),
  GEMINI_MAX_TOKENS: z.coerce.number().min(1).default(8192),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Session
  SESSION_TTL: z.coerce.number().default(86400),
  SESSION_SECRET: z.string().default('change-this-in-production'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(30),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Feature Flags
  ENABLE_RAG: z.string().default('true'),
  ENABLE_GUARDRAILS: z.string().default('true'),
  ENABLE_METRICS: z.string().default('true'),
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
  corsOrigin: config.CORS_ORIGIN,
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

export const sessionConfig = {
  ttl: config.SESSION_TTL * 1000, // Convert to ms
  secret: config.SESSION_SECRET,
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
