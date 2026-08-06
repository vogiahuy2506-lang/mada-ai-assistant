// Input Validation Schemas

import { z } from 'zod';

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  language: z.enum(['vi', 'en', 'ar', 'fr']).optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'document', 'audio']),
    url: z.string().url(),
    name: z.string(),
    size: z.number().max(10 * 1024 * 1024),
  })).optional(),
  // Legacy fields for compatibility
  agentId: z.string().optional(),
  agentPrompt: z.string().optional(),
});

export const ragSearchSchema = z.object({
  query: z.string().min(1).max(5000),
  categories: z.array(z.enum(['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living', 'education'])).optional(),
  filters: z.object({
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    brand: z.string().optional(),
    platform: z.string().optional(),
  }).optional(),
  topK: z.number().min(1).max(20).default(5),
});

export const sessionQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type RAGSearchInput = z.infer<typeof ragSearchSchema>;
export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;
