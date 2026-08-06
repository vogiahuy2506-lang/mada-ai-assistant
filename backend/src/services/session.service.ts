// Session Service - In-memory session management

import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';
import {
  ChatSession,
  ChatMessage,
  ConversationContext,
  createEmptySession,
  createMessage,
  GuardrailResult,
} from '../models/index.js';
import { sessionConfig } from '../config/app.config.js';
import { createLogger } from '../utils/logger.js';
import { activeSessions, sessionMessages } from '../utils/metrics.js';

const logger = createLogger('SessionService');

const sessionCache = new NodeCache({
  stdTTL: Math.floor(sessionConfig.ttl / 1000),
  checkperiod: 60,
  useClones: false,
});

export class SessionService {
  async createSession(
    userId: string,
    metadata: ChatSession['metadata']
  ): Promise<ChatSession> {
    const sessionId = uuidv4();
    const session = createEmptySession(sessionId, userId, metadata);

    const success = sessionCache.set(sessionId, session);
    if (!success) {
      logger.error('Failed to create session', { sessionId });
      throw new Error('Failed to create session');
    }

    activeSessions.inc();
    logger.info('Session created', { sessionId, userId });

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const session = sessionCache.get<ChatSession>(sessionId);

    if (!session) {
      logger.debug('Session not found', { sessionId });
      return null;
    }

    if (new Date() > new Date(session.expiresAt)) {
      await this.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const updatedSession: ChatSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
      id: sessionId,
    };

    sessionCache.set(sessionId, updatedSession);
    logger.debug('Session updated', { sessionId });

    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const success = sessionCache.del(sessionId);

    if (success) {
      activeSessions.dec();
      logger.info('Session deleted', { sessionId });
    }

    return success > 0;
  }

  async addMessage(
    sessionId: string,
    role: ChatMessage['role'],
    content: string,
    options?: {
      ragContext?: ChatMessage['ragContext'];
      confidence?: number;
      guardrailAction?: GuardrailResult['action'];
      intent?: string;
    }
  ): Promise<ChatMessage | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      logger.warn('Cannot add message - session not found', { sessionId });
      return null;
    }

    const message = createMessage(uuidv4(), role, content, {
      ragContext: options?.ragContext,
      confidence: options?.confidence,
      guardrailAction: options?.guardrailAction,
      intent: options?.intent,
    });

    session.messages.push(message);
    session.updatedAt = new Date();

    session.context.questionsAsked++;
    if (role === 'user') {
      session.context.followUpCount++;
    }

    sessionCache.set(sessionId, session);
    sessionMessages.inc({ role });

    logger.debug('Message added to session', {
      sessionId,
      role,
      messageCount: session.messages.length,
    });

    return message;
  }

  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return [];
    }

    const messages = session.messages;

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  async updateContext(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<ConversationContext | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    session.context = {
      ...session.context,
      ...updates,
    };
    session.updatedAt = new Date();

    sessionCache.set(sessionId, session);

    return session.context;
  }

  async getContext(sessionId: string): Promise<ConversationContext | null> {
    const session = await this.getSession(sessionId);
    return session?.context || null;
  }

  async setLanguage(sessionId: string, language: string): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    session.context.language = language as ConversationContext['language'];
    session.updatedAt = new Date();

    sessionCache.set(sessionId, session);
    return true;
  }

  async detectCategoryFromHistory(sessionId: string): Promise<string[]> {
    const session = await this.getSession(sessionId);

    if (!session || session.messages.length === 0) {
      return [];
    }

    const recentMessages = session.messages.slice(-5);
    const allText = recentMessages.map(m => m.content).join(' ').toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
      vision: ['blind', 'khiếm thị', 'blindness', 'mù', 'eyes', 'mắt', 'see', 'nhìn'],
      hearing: ['deaf', 'khiếm thính', 'hearing', ' ears', 'tai', 'listen', 'nghe'],
      mobility: ['wheelchair', 'xe lăn', 'mobility', 'walk', 'đi lại', 'movement'],
      communication: ['speak', 'nói', 'speech', 'giao tiếp', 'communicate'],
      cognition: ['cognitive', 'nhận thức', 'memory', 'trí nhớ', 'learn', 'học'],
      daily_living: ['daily', 'sinh hoạt', 'eat', 'ăn', 'bathroom', 'phòng tắm'],
      education: ['school', 'trường', 'learn', 'học', 'education', 'giáo dục', 'study'],
    };

    const detectedCategories: string[] = [];

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => allText.includes(kw))) {
        detectedCategories.push(category);
      }
    }

    return [...new Set(detectedCategories)];
  }

  async getSessionStats(): Promise<{
    total: number;
    active: number;
    avgMessages: number;
  }> {
    const keys = sessionCache.keys();
    let totalMessages = 0;

    for (const key of keys) {
      const session = sessionCache.get<ChatSession>(key);
      if (session) {
        totalMessages += session.messages.length;
      }
    }

    return {
      total: keys.length,
      active: keys.length,
      avgMessages: keys.length > 0 ? totalMessages / keys.length : 0,
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    const keys = sessionCache.keys();
    let cleaned = 0;

    for (const key of keys) {
      const session = sessionCache.get<ChatSession>(key);
      if (session && new Date() > new Date(session.expiresAt)) {
        sessionCache.del(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired sessions', { count: cleaned });
    }

    return cleaned;
  }
}

export const sessionService = new SessionService();
