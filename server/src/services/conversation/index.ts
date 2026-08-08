/**
 * MADA AT ASSISTANT - Conversation Service Exports
 * 
 * Export all conversation-related modules and services
 */

// System Instructions
export {
  getSystemInstruction,
  getContextualInstruction,
  getCombinedInstruction,
  detectLanguage,
  LANGUAGE_PATTERNS,
  LANGUAGE_NAMES,
  type SupportedLanguage
} from './system-instructions';

// Intent Detection
export {
  detectIntent,
  getIntentDisplayName,
  AT_CATEGORIES,
  type IntentType,
  type IntentResult
} from './intent-detector';

// Context Builder
export {
  buildContextString,
  formatRAGResultsForDisplay,
  updateConversationContext,
  createConversationContext,
  isContextWithinLimit,
  truncateContext,
  estimateTokens,
  type ChatMessage,
  type RAGSource,
  type UserContext,
  type ConversationContext,
  type BuildContextOptions
} from './context-builder';

// Response Formatter
export {
  formatResponse,
  formatProductBlock,
  formatComparisonTable,
  addSafetyDisclaimer,
  getOutOfScopeResponse,
  getGreetingResponse,
  type FormattedResponse,
  type ResponseMetadata,
  type SourceDisplay
} from './response-formatter';

// Conversation Service (Core)
export {
  ConversationService,
  getConversationService,
  type ConversationServiceConfig
} from './conversation.service';

// Convenience re-exports
import { ConversationService, getConversationService } from './conversation.service';
import { detectLanguage, type SupportedLanguage } from './system-instructions';
import { detectIntent, type IntentResult } from './intent-detector';
import { type RAGSource, type ConversationContext } from './context-builder';

/**
 * Quick chat function for simple use cases
 */
export async function quickChat(
  message: string,
  sessionId: string,
  options: {
    language?: SupportedLanguage;
    ragSources?: RAGSource[];
    apiKey?: string;
  } = {}
): Promise<{
  message: string;
  intent: IntentResult | undefined;
  language: SupportedLanguage;
  suggestions: string[];
}> {
  const service = getConversationService(
    options.apiKey ? { gemini: { apiKey: options.apiKey, model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 8192, topP: 0.95, topK: 40 } } : {}
  );

  const response = await service.generateResponse(message, sessionId, {
    language: options.language,
    ragSources: options.ragSources
  });

  return {
    message: response.message,
    intent: response.metadata.intent,
    language: response.language,
    suggestions: response.suggestions
  };
}

/**
 * Batch process multiple messages
 */
export async function batchChat(
  messages: Array<{ message: string; sessionId: string }>,
  options: {
    language?: SupportedLanguage;
    apiKey?: string;
  } = {}
): Promise<Array<{
  message: string;
  intent: IntentResult | undefined;
  language: SupportedLanguage;
  suggestions: string[];
}>> {
  const service = getConversationService(
    options.apiKey ? { gemini: { apiKey: options.apiKey, model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 8192, topP: 0.95, topK: 40 } } : {}
  );

  const results = [];
  for (const { message, sessionId } of messages) {
    const response = await service.generateResponse(message, sessionId, {
      language: options.language
    });
    results.push({
      message: response.message,
      intent: response.metadata.intent,
      language: response.language,
      suggestions: response.suggestions
    });
  }

  return results;
}

/**
 * Create a new conversation session
 */
export function createSession(): string {
  const service = getConversationService();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return sessionId;
}

/**
 * Get service health status
 */
export async function getServiceHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  geminiConnected: boolean;
  activeSessions: number;
}> {
  const service = getConversationService();
  return service.healthCheck();
}

/**
 * Cleanup old sessions
 */
export function cleanupSessions(maxAgeHours: number = 24): number {
  const service = getConversationService();
  return service.cleanupOldSessions(maxAgeHours * 60 * 60 * 1000);
}
