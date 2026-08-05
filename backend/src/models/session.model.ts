// Session Model - Chat Session Management

import { MadaCategory } from './product.model.js';

export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'audio';
  url: string;
  name: string;
  size: number;
}

export interface RAGContextRef {
  type: 'product' | 'standard';
  id: string;
  name: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  ragContext?: RAGContextRef[];
  confidence?: number;
  guardrailAction?: GuardrailAction;
  createdAt: Date;
}

export interface ConversationContext {
  detectedNeeds: MadaCategory[];
  discussedProducts: string[];
  discussedCategories: MadaCategory[];
  questionsAsked: number;
  followUpCount: number;
  lastTopic: string;
  language: SupportedLanguage;
}

export type SupportedLanguage = 'vi' | 'en' | 'ar' | 'fr';

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  metadata: {
    deviceType: 'mobile' | 'desktop' | 'tablet';
    userAgent: string;
    ipAddress?: string;
  };
}

export type GuardrailAction = 'ALLOW' | 'REDIRECT' | 'BLOCK' | 'ESCALATE';

export interface GuardrailResult {
  passed: boolean;
  action: GuardrailAction;
  reason: string;
  triggeredRule?: string;
  suggestions?: string[];
  redirectTo?: string;
  customResponse?: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  avgMessagesPerSession: number;
  avgSessionDuration: number;
  topCategories: { category: MadaCategory; count: number }[];
}

export function createEmptySession(
  id: string,
  userId: string,
  metadata: ChatSession['metadata']
): ChatSession {
  return {
    id,
    userId,
    messages: [],
    context: {
      detectedNeeds: [],
      discussedProducts: [],
      discussedCategories: [],
      questionsAsked: 0,
      followUpCount: 0,
      lastTopic: '',
      language: 'vi',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    metadata,
  };
}

export function createMessage(
  id: string,
  role: ChatMessage['role'],
  content: string,
  options?: Partial<ChatMessage>
): ChatMessage {
  return {
    id,
    role,
    content,
    createdAt: new Date(),
    ...options,
  };
}
