/**
 * MADA AT ASSISTANT - Context Builder
 * 
 * Xây dựng context cho AI response bao gồm:
 * - RAG results
 * - Conversation history
 * - User preferences
 * - Intent context
 */

import type { SupportedLanguage } from './system-instructions';
import type { IntentResult } from './intent-detector';

/** Conversation message */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    language?: SupportedLanguage;
    confidence?: number;
    intent?: string;
    sources?: RAGSource[];
  };
}

/** RAG search result */
export interface RAGSource {
  id: string;
  type: 'product' | 'standard' | 'guide' | 'article';
  name: string;
  description: string;
  score: number;
  url?: string;
  category?: string;
  language?: SupportedLanguage;
  metadata?: Record<string, any>;
}

/** User context/preferences */
export interface UserContext {
  userId?: string;
  language: SupportedLanguage;
  preferences?: {
    priceRange?: 'budget' | 'mid-range' | 'premium';
    categories?: string[];
    brands?: string[];
    platforms?: string[];
  };
  previousQueries?: string[];
  discussedProducts?: string[];
}

/** Conversation context */
export interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  userContext: UserContext;
  currentIntent?: IntentResult;
  ragSources: RAGSource[];
  startedAt: Date;
  lastActivity: Date;
  messageCount: number;
}

/** Context building options */
export interface BuildContextOptions {
  includeHistory?: boolean;
  maxHistoryMessages?: number;
  includeRAG?: boolean;
  includeIntentContext?: boolean;
  language?: SupportedLanguage;
}

/**
 * Build context string for AI
 */
export function buildContextString(
  conversation: ConversationContext,
  options: BuildContextOptions = {}
): string {
  const {
    includeHistory = true,
    maxHistoryMessages = 10,
    includeRAG = true,
    includeIntentContext = true
  } = options;

  const parts: string[] = [];

  // 1. Intent Context
  if (includeIntentContext && conversation.currentIntent) {
    const intent = conversation.currentIntent;
    const intentContext = buildIntentContext(intent, conversation.userContext.language);
    if (intentContext) {
      parts.push(intentContext);
    }
  }

  // 2. RAG Sources
  if (includeRAG && conversation.ragSources.length > 0) {
    const ragContext = buildRAGContext(conversation.ragSources);
    parts.push(ragContext);
  }

  // 3. User Preferences
  const preferencesContext = buildPreferencesContext(conversation.userContext);
  if (preferencesContext) {
    parts.push(preferencesContext);
  }

  // 4. Conversation History
  if (includeHistory && conversation.messages.length > 0) {
    const historyContext = buildHistoryContext(
      conversation.messages,
      maxHistoryMessages
    );
    parts.push(historyContext);
  }

  return parts.join('\n\n');
}

/**
 * Build intent context
 */
function buildIntentContext(
  intent: IntentResult,
  language: SupportedLanguage
): string {
  const langMap: Record<SupportedLanguage, string> = {
    vi: 'Tiếng Việt',
    en: 'English',
    ar: 'العربية',
    fr: 'Français'
  };

  const parts: string[] = [];

  // Intent info
  parts.push(`[CONVERSATION CONTEXT]`);
  parts.push(`- Detected intent: ${intent.primary}`);
  parts.push(`- Intent confidence: ${Math.round(intent.confidence * 100)}%`);
  
  if (intent.category) {
    parts.push(`- Relevant AT category: ${intent.category}`);
  }
  
  if (intent.entities && intent.entities.length > 0) {
    parts.push(`- Products mentioned: ${intent.entities.join(', ')}`);
  }

  // Safety warning for medical symptoms
  if (intent.requiresProfessional) {
    const warning = language === 'vi' 
      ? `\n⚠️ SAFETY NOTE: User may be describing medical symptoms. DO NOT diagnose. Redirect to medical professional if needed.`
      : language === 'ar'
      ? `\n⚠️ ملاحظة أمان: قد يصف المستخدم أعراضًا طبية. لا تشخّص. أعد التوجيه إلى متخصص طبي إذا لزم الأمر.`
      : language === 'fr'
      ? `\n⚠️ NOTE DE SÉCURITÉ: L'utilisateur peut décrire des symptômes médicaux. NE PAS diagnostiquer. Rediriger vers un professionnel médical si nécessaire.`
      : `\n⚠️ SAFETY NOTE: User may be describing medical symptoms. DO NOT diagnose. Redirect to medical professional if needed.`;
    parts.push(warning);
  }

  return parts.join('\n');
}

/**
 * Build RAG context from sources
 */
function buildRAGContext(sources: RAGSource[]): string {
  if (sources.length === 0) return '';

  const parts: string[] = [];
  parts.push('[RELEVANT KNOWLEDGE BASE INFORMATION]');
  parts.push('Based on the knowledge base, here are relevant results:\n');

  for (let i = 0; i < Math.min(sources.length, 5); i++) {
    const source = sources[i];
    const relevance = Math.round(source.score * 100);
    
    parts.push(`${i + 1}. ${source.type.toUpperCase()}: ${source.name}`);
    parts.push(`   Relevance: ${relevance}%`);
    parts.push(`   ${source.description}`);
    
    if (source.category) {
      parts.push(`   Category: ${source.category}`);
    }
    
    if (source.url) {
      parts.push(`   Source: ${source.url}`);
    }
    
    parts.push('');
  }

  parts.push('---\nPlease use this information to provide accurate and relevant responses.');

  return parts.join('\n');
}

/**
 * Build user preferences context
 */
function buildPreferencesContext(context: UserContext): string {
  if (!context.preferences && !context.discussedProducts?.length) return '';

  const parts: string[] = [];
  parts.push('[USER PREFERENCES & HISTORY]');

  if (context.discussedProducts && context.discussedProducts.length > 0) {
    parts.push(`Products already discussed: ${context.discussedProducts.join(', ')}`);
  }

  if (context.preferences) {
    if (context.preferences.priceRange) {
      parts.push(`Price preference: ${context.preferences.priceRange}`);
    }
    if (context.preferences.categories && context.preferences.categories.length > 0) {
      parts.push(`Interested categories: ${context.preferences.categories.join(', ')}`);
    }
    if (context.preferences.brands && context.preferences.brands.length > 0) {
      parts.push(`Preferred brands: ${context.preferences.brands.join(', ')}`);
    }
    if (context.preferences.platforms && context.preferences.platforms.length > 0) {
      parts.push(`Required platforms: ${context.preferences.platforms.join(', ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Build conversation history context
 */
function buildHistoryContext(
  messages: ChatMessage[],
  maxMessages: number
): string {
  if (messages.length === 0) return '';

  const parts: string[] = [];
  parts.push('[CONVERSATION HISTORY]');

  // Get recent messages (excluding last one which is current user message)
  const recentMessages = messages.slice(-maxMessages - 1, -1);
  
  if (recentMessages.length === 0) {
    return '[CONVERSATION HISTORY]\nThis is the start of the conversation.';
  }

  for (const msg of recentMessages) {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    const timestamp = msg.timestamp.toLocaleTimeString();
    
    // Truncate long messages
    let content = msg.content;
    if (content.length > 300) {
      content = content.substring(0, 300) + '...';
    }
    
    parts.push(`[${role} - ${timestamp}]: ${content}`);
  }

  return parts.join('\n\n');
}

/**
 * Format RAG results for display
 */
export function formatRAGResultsForDisplay(sources: RAGSource[]): {
  products: RAGSource[];
  standards: RAGSource[];
  other: RAGSource[];
} {
  const products: RAGSource[] = [];
  const standards: RAGSource[] = [];
  const other: RAGSource[] = [];

  for (const source of sources) {
    if (source.type === 'product') {
      products.push(source);
    } else if (source.type === 'standard') {
      standards.push(source);
    } else {
      other.push(source);
    }
  }

  return { products, standards, other };
}

/**
 * Update conversation context with new message
 */
export function updateConversationContext(
  context: ConversationContext,
  newMessage: ChatMessage
): ConversationContext {
  const updatedMessages = [...context.messages, newMessage];
  const discussedProducts = [...(context.userContext.discussedProducts || [])];
  
  // Extract product mentions from assistant response
  if (newMessage.role === 'assistant') {
    const productMentions = extractProductMentions(newMessage.content);
    for (const product of productMentions) {
      if (!discussedProducts.includes(product)) {
        discussedProducts.push(product);
      }
    }
  }

  return {
    ...context,
    messages: updatedMessages,
    userContext: {
      ...context.userContext,
      discussedProducts
    },
    lastActivity: new Date(),
    messageCount: updatedMessages.length
  };
}

/**
 * Extract product mentions from text
 */
function extractProductMentions(text: string): string[] {
  const knownProducts = [
    'OrCam', 'MyEye', 'JAWS', 'NVDA', 'VoiceOver', 'TalkBack',
    'Phonak', 'Oticon', 'Widex', 'Resound', 'Signia',
    'Tobii', 'Dynavox', 'PRC', 'Saltillo', 'Proloquo2Go',
    'WHILL', 'Permobil', 'Quickie', 'Invacare', 'Ottobock',
    'Aira', 'Envision', 'ZoomText', 'Dragon', 'Kurzweil'
  ];

  const found: string[] = [];
  for (const product of knownProducts) {
    if (text.includes(product)) {
      found.push(product);
    }
  }

  return found;
}

/**
 * Create empty conversation context
 */
export function createConversationContext(
  sessionId: string,
  language: SupportedLanguage = 'vi'
): ConversationContext {
  return {
    sessionId,
    messages: [],
    userContext: {
      language,
      discussedProducts: [],
      previousQueries: []
    },
    ragSources: [],
    startedAt: new Date(),
    lastActivity: new Date(),
    messageCount: 0
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English, more for multi-byte languages
  return Math.ceil(text.length / 4);
}

/**
 * Check if context is within token limit
 */
export function isContextWithinLimit(
  context: string,
  maxTokens: number = 8000
): boolean {
  return estimateTokens(context) <= maxTokens;
}

/**
 * Truncate context if too long
 */
export function truncateContext(
  context: string,
  maxTokens: number = 8000
): string {
  const currentTokens = estimateTokens(context);
  
  if (currentTokens <= maxTokens) {
    return context;
  }

  // Remove oldest sections first
  const sections = context.split(/\n\n\[/);
  
  // Keep system instruction and current context, remove history
  let result = sections[0]; // Keep first section (system)
  
  for (let i = 1; i < sections.length; i++) {
    const section = '[' + sections[i];
    const newResult = result + '\n\n' + section;
    
    if (estimateTokens(newResult) <= maxTokens) {
      result = newResult;
    } else {
      break;
    }
  }

  return result;
}
