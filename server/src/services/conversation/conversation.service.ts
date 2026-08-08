/**
 * MADA AT ASSISTANT - Conversation Service
 * 
 * Core service xử lý hội thoại sử dụng Google Gemini SDK
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerateContentResult,
  type Content,
  type Part
} from '@google/generative-ai';

import {
  getSystemInstruction,
  getContextualInstruction,
  detectLanguage,
  type SupportedLanguage
} from './system-instructions';
import {
  detectIntent,
  type IntentResult,
  getIntentDisplayName
} from './intent-detector';
import {
  buildContextString,
  type ConversationContext,
  type ChatMessage,
  type RAGSource,
  createConversationContext,
  updateConversationContext,
  isContextWithinLimit,
  truncateContext
} from './context-builder';
import {
  formatResponse,
  type FormattedResponse,
  type ResponseMetadata,
  getOutOfScopeResponse,
  getGreetingResponse,
  addSafetyDisclaimer
} from './response-formatter';

// Simple logger for Conversation Service
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ConversationService: ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ConversationService: ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ConversationService: ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ConversationService: ${message}`, meta || '')
};

// Metrics placeholder
const metrics = {
  recordResponseTime: (ms: number) => {},
  recordConfidence: (score: number) => {},
  recordTokens: (count: number) => {},
  recordIntent: (intent: string, confidence: number) => {}
};

/** Gemini Configuration */
interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
}

/** Service Configuration */
export interface ConversationServiceConfig {
  gemini: GeminiConfig;
  maxHistoryMessages: number;
  maxContextTokens: number;
  enableRAG: boolean;
  enableIntentDetection: boolean;
  safetyThreshold: HarmBlockThreshold;
}

/** Default Configuration */
const DEFAULT_CONFIG: ConversationServiceConfig = {
  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
    topK: 40
  },
  maxHistoryMessages: 20,
  maxContextTokens: 8000,
  enableRAG: true,
  enableIntentDetection: true,
  safetyThreshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
};

/** Conversation Service */
export class ConversationService {
  private client: GoogleGenerativeAI | null = null;
  private config: ConversationServiceConfig;
  private sessions: Map<string, ConversationContext> = new Map();
  private safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[];

  constructor(config: Partial<ConversationServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize safety settings
    this.safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: this.config.safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: this.config.safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: this.config.safetyThreshold },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: this.config.safetyThreshold },
    ];

    // Initialize Gemini client
    this.initializeGemini();
  }

  /**
   * Initialize Google Gemini client
   */
  private initializeGemini(): void {
    if (!this.config.gemini.apiKey) {
      logger.warn('Google Gemini API key not provided. Running in demo mode.');
      return;
    }

    try {
      this.client = new GoogleGenerativeAI(this.config.gemini.apiKey);
      logger.info('Google Gemini client initialized', {
        model: this.config.gemini.model
      });
    } catch (error) {
      logger.error('Failed to initialize Gemini client', { error });
    }
  }

  /**
   * Generate response for a user message
   */
  async generateResponse(
    message: string,
    sessionId: string,
    options: {
      language?: SupportedLanguage;
      forceLanguage?: SupportedLanguage;
      ragSources?: RAGSource[];
    } = {}
  ): Promise<FormattedResponse> {
    const startTime = Date.now();
    const { language: userLanguage, forceLanguage, ragSources = [] } = options;

    try {
      // 1. Get or create session
      let context = this.sessions.get(sessionId);
      if (!context) {
        const detectedLang = userLanguage || detectLanguage(message);
        context = createConversationContext(sessionId, detectedLang);
        this.sessions.set(sessionId, context);
        logger.info('New conversation session created', { sessionId });
      }

      // 2. Detect language
      const language = forceLanguage || userLanguage || detectLanguage(message);
      
      // 3. Detect intent
      let intent: IntentResult | undefined;
      if (this.config.enableIntentDetection) {
        intent = detectIntent(message, language);
        context.currentIntent = intent;
        logger.debug('Intent detected', {
          intent: intent.primary,
          confidence: intent.confidence,
          category: intent.category
        });
      }

      // 4. Handle special intents
      if (intent?.primary === 'general_greeting') {
        return getGreetingResponse(language);
      }

      if (intent?.primary === 'out_of_scope') {
        return getOutOfScopeResponse(message, language);
      }

      // 5. Update context with RAG sources
      if (ragSources.length > 0) {
        context.ragSources = ragSources;
      }

      // 6. Add user message to history
      const userMsg: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        metadata: {
          language,
          intent: intent?.primary
        }
      };
      context = updateConversationContext(context, userMsg);

      // 7. Build context string
      let contextString = buildContextString(context, {
        includeHistory: true,
        maxHistoryMessages: this.config.maxHistoryMessages,
        includeRAG: this.config.enableRAG,
        includeIntentContext: true
      });

      // 8. Check context length
      if (!isContextWithinLimit(contextString, this.config.maxContextTokens)) {
        contextString = truncateContext(contextString, this.config.maxContextTokens);
        logger.debug('Context truncated due to token limit');
      }

      // 9. Get system instruction
      const contexts: ('medicalSymptoms' | 'productInquiry' | 'standardsInquiry')[] = [];
      if (intent?.requiresProfessional) contexts.push('medicalSymptoms');
      if (intent?.primary === 'product_inquiry') contexts.push('productInquiry');
      if (intent?.primary === 'standards_question') contexts.push('standardsInquiry');
      
      let systemInstruction = getSystemInstruction(language);
      for (const ctx of contexts) {
        systemInstruction += getContextualInstruction(language, ctx);
      }

      // 10. Generate response
      const response = await this.callGemini(
        message,
        systemInstruction,
        context,
        language
      );

      // 11. Add assistant message to history
      const assistantMsg: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: {
          language,
          confidence: response.metadata.confidence,
          intent: intent?.primary
        }
      };
      context = updateConversationContext(context, assistantMsg);

      // 12. Update session
      this.sessions.set(sessionId, context);

      // 13. Record metrics
      const processingTime = Date.now() - startTime;
      this.recordMetrics(response.metadata, intent, processingTime);

      // 14. Add safety disclaimer if needed
      if (intent?.requiresProfessional) {
        response.message = addSafetyDisclaimer(response.message, intent, language);
      }

      logger.info('Response generated', {
        sessionId,
        intent: intent?.primary,
        processingTimeMs: processingTime,
        confidence: response.metadata.confidence
      });

      return response;

    } catch (error) {
      logger.error('Error generating response', { error, sessionId });
      return this.getErrorResponse(options.forceLanguage || options.language || 'vi', Date.now() - startTime);
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(
    message: string,
    systemInstruction: string,
    context: ConversationContext,
    language: SupportedLanguage
  ): Promise<FormattedResponse> {
    if (!this.client) {
      return this.getDemoResponse(message, language);
    }

    try {
      const model = this.client.getGenerativeModel({
        model: this.config.gemini.model,
        generationConfig: {
          temperature: this.config.gemini.temperature,
          maxOutputTokens: this.config.gemini.maxTokens,
          topP: this.config.gemini.topP,
          topK: this.config.gemini.topK,
        },
      });

      // Build conversation history
      const history: Content[] = context.messages
        .slice(-this.config.maxHistoryMessages)
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: msg.content }] as Part[]
        }));

      // Generate content
      const result: GenerateContentResult = await model.generateContent({
        contents: [
          ...history,
          { role: 'user', parts: [{ text: message }] }
        ],
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }]
        },
        safetySettings: this.safetySettings,
      });

      const response = result.response;
      const text = response.text();
      const usageMetadata = response.usageMetadata;

      // Estimate confidence
      let confidence = 0.85;
      const promptFeedback = result.response.promptFeedback;
      if (promptFeedback?.blockReason) {
        confidence = 0.3; // Blocked by safety
        logger.warn('Response blocked by safety settings', {
          reason: promptFeedback.blockReason
        });
      }

      const metadata: ResponseMetadata = {
        confidence,
        tokensUsed: usageMetadata?.totalTokenCount || 0,
        model: this.config.gemini.model,
        processingTimeMs: 0,
        finishReason: 'COMPLETE',
        intent: context.currentIntent,
        sources: context.ragSources
      };

      return formatResponse(text, metadata, language);

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Gemini API error', { error: err.message });
      throw error;
    }
  }

  /**
   * Get demo response (when no API key)
   */
  private getDemoResponse(message: string, language: SupportedLanguage): FormattedResponse {
    const templates: Record<SupportedLanguage, string> = {
      vi: 'Xin chào! Tôi là Mada AT Assistant. Tôi nhận được tin nhắn của bạn: "' + message + '". Hiện tại hệ thống đang chạy ở chế độ demo. Vui lòng cấu hình Google Gemini API Key để kích hoạt đầy đủ.',
      en: 'Hello! I am Mada AT Assistant. I received your message: "' + message + '". The system is currently running in demo mode. Please configure your Google Gemini API Key for full activation.',
      ar: 'مرحبا! أنا مساعد تقنية المعلومات. استلمت رسالتك: "' + message + '". النظام يعمل حاليًا في وضع العرض التوضيحي. يرجى تكوين مفتاح Google Gemini API للتفعيل الكامل.',
      fr: 'Bonjour! Je suis Mada AT Assistant. J\'ai reçu votre message: "' + message + '". Le système fonctionne actuellement en mode démo. Veuillez configurer votre clé API Google Gemini pour l\'activation complète.'
    };

    return {
      message: templates[language],
      metadata: {
        confidence: 1.0,
        tokensUsed: 0,
        model: 'demo',
        processingTimeMs: 0,
        finishReason: 'DEMO_MODE'
      },
      suggestions: [
        language === 'vi' ? '📝 Đặt câu hỏi về AT' :
        language === 'ar' ? '📝 اطرح سؤالاً عن TA' :
        language === 'fr' ? '📝 Poser une question sur TA' :
        '📝 Ask a question about AT',
        language === 'vi' ? '🔧 Cấu hình API' :
        language === 'ar' ? '🔧 تكوين API' :
        language === 'fr' ? '🔧 Configurer l\'API' :
        '🔧 Configure API'
      ],
      sources: [],
      language
    };
  }

  /**
   * Get error response
   */
  private getErrorResponse(language: SupportedLanguage, processingTime: number): FormattedResponse {
    const templates: Record<SupportedLanguage, string> = {
      vi: 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
      en: 'I apologize, I encountered an issue processing your request. Please try again later.',
      ar: 'عذرًا، واجهت مشكلة في معالجة طلبك. يرجى المحاولة مرة أخرى لاحقًا.',
      fr: 'Je m\'excuse, j\'ai rencontré un problème lors du traitement de votre demande. Veuillez réessayer.'
    };

    return {
      message: templates[language],
      metadata: {
        confidence: 0,
        tokensUsed: 0,
        model: 'error',
        processingTimeMs: processingTime,
        finishReason: 'ERROR'
      },
      suggestions: [
        language === 'vi' ? '🔄 Thử lại' :
        language === 'ar' ? '🔄 حاول مرة أخرى' :
        language === 'fr' ? '🔄 Réessayer' :
        '🔄 Try again',
        language === 'vi' ? '📞 Liên hệ hỗ trợ' :
        language === 'ar' ? '📞 اتصل بالدعم' :
        language === 'fr' ? '📞 Contacter le support' :
        '📞 Contact support'
      ],
      sources: [],
      language
    };
  }

  /**
   * Get conversation history
   */
  getConversationHistory(sessionId: string): ChatMessage[] {
    const context = this.sessions.get(sessionId);
    return context?.messages || [];
  }

  /**
   * Clear conversation
   */
  clearConversation(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info('Conversation cleared', { sessionId });
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): {
    messageCount: number;
    startedAt: Date;
    lastActivity: Date;
    language: SupportedLanguage;
  } | null {
    const context = this.sessions.get(sessionId);
    if (!context) return null;

    return {
      messageCount: context.messageCount,
      startedAt: context.startedAt,
      lastActivity: context.lastActivity,
      language: context.userContext.language
    };
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(
    sessionId: string,
    preferences: {
      priceRange?: 'budget' | 'mid-range' | 'premium';
      categories?: string[];
      brands?: string[];
      platforms?: string[];
    }
  ): void {
    const context = this.sessions.get(sessionId);
    if (context) {
      context.userContext.preferences = {
        ...context.userContext.preferences,
        ...preferences
      };
      this.sessions.set(sessionId, context);
      logger.debug('User preferences updated', { sessionId, preferences });
    }
  }

  /**
   * Record metrics
   */
  private recordMetrics(
    metadata: ResponseMetadata,
    intent: IntentResult | undefined,
    processingTime: number
  ): void {
    try {
      if (metrics) {
        metrics.recordResponseTime(processingTime);
        metrics.recordConfidence(metadata.confidence);
        metrics.recordTokens(metadata.tokensUsed);
        if (intent) {
          metrics.recordIntent(intent.primary, intent.confidence);
        }
      }
    } catch (error) {
      logger.debug('Failed to record metrics', { error });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    geminiConnected: boolean;
    activeSessions: number;
  }> {
    const hasApiKey = !!this.config.gemini.apiKey;
    
    return {
      status: hasApiKey ? 'healthy' : 'degraded',
      geminiConnected: hasApiKey && !!this.client,
      activeSessions: this.sessions.size
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old sessions
   */
  cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    const entries = Array.from(this.sessions.entries());
    for (const [sessionId, context] of entries) {
      if (now - context.lastActivity.getTime() > maxAgeMs) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Old sessions cleaned up', { cleaned });
    }

    return cleaned;
  }
}

// Export singleton instance
let serviceInstance: ConversationService | null = null;

export function getConversationService(
  config?: Partial<ConversationServiceConfig>
): ConversationService {
  if (!serviceInstance) {
    serviceInstance = new ConversationService(config);
  }
  return serviceInstance;
}
