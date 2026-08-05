// Context Service - Multi-turn conversation context management

import { ChatMessage } from '../models/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ContextService');

interface ContextWindowConfig {
  maxTokens: number;
  systemPromptTokens: number;
  reservedForResponse: number;
  availableForHistory: number;
}

const DEFAULT_CONFIG: ContextWindowConfig = {
  maxTokens: 128000,
  systemPromptTokens: 2000,
  reservedForResponse: 4000,
  availableForHistory: 122000,
};

export class ContextService {
  private config: ContextWindowConfig;

  constructor(config?: Partial<ContextWindowConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  truncateMessages(
    messages: ChatMessage[],
    maxTokens: number
  ): ChatMessage[] {
    if (messages.length === 0) return [];

    const result: ChatMessage[] = [];
    let currentTokens = 0;

    const reversed = [...messages].reverse();

    for (const message of reversed) {
      const messageTokens = this.estimateTokenCount(message.content);

      if (currentTokens + messageTokens <= maxTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    logger.debug('Messages truncated', {
      originalCount: messages.length,
      truncatedCount: result.length,
    });

    return result;
  }

  summarizeHistory(messages: ChatMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    const userMessages = messages.filter(m => m.role === 'user');

    const summaryParts: string[] = [];

    if (userMessages.length > 0) {
      const firstTopic = userMessages[0].content.substring(0, 100);
      summaryParts.push(`Người dùng bắt đầu hỏi về: "${firstTopic}..."`);
    }

    if (userMessages.length > 1) {
      summaryParts.push(`Đã có ${userMessages.length} câu hỏi được đặt ra.`);
    }

    const discussedProducts = new Set<string>();
    for (const msg of messages) {
      if (msg.ragContext) {
        for (const ctx of msg.ragContext) {
          discussedProducts.add(ctx.name);
        }
      }
    }

    if (discussedProducts.size > 0) {
      summaryParts.push(`Đã thảo luận về: ${[...discussedProducts].join(', ')}.`);
    }

    return summaryParts.join(' ');
  }

  buildContextForLLM(
    messages: ChatMessage[],
    _currentMessage: string,
    options?: {
      includeHistory?: boolean;
      maxHistoryTokens?: number;
    }
  ): {
    context: string;
    truncatedMessages: ChatMessage[];
    wasTruncated: boolean;
  } {
    const includeHistory = options?.includeHistory ?? true;
    const maxHistoryTokens = options?.maxHistoryTokens ?? this.config.availableForHistory;

    if (!includeHistory || messages.length === 0) {
      return {
        context: '',
        truncatedMessages: [],
        wasTruncated: false,
      };
    }

    const truncatedMessages = this.truncateMessages(messages, maxHistoryTokens);
    const wasTruncated = truncatedMessages.length < messages.length;

    const contextParts: string[] = [];

    if (wasTruncated) {
      const summary = this.summarizeHistory(messages.slice(0, -truncatedMessages.length));
      if (summary) {
        contextParts.push(`[Lịch sử trước đó]: ${summary}`);
      }
    }

    for (const msg of truncatedMessages.slice(-10)) {
      const role = msg.role === 'user' ? 'Người dùng' : 'Trợ lý';
      contextParts.push(`[${role}]: ${msg.content.substring(0, 500)}`);
    }

    return {
      context: contextParts.join('\n'),
      truncatedMessages,
      wasTruncated,
    };
  }

  extractIntent(message: string): {
    intent: string;
    entities: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
  } {
    const lowerMessage = message.toLowerCase();

    let intent = 'general';
    const entities: string[] = [];

    if (lowerMessage.includes('tìm') || lowerMessage.includes('search') || lowerMessage.includes('find')) {
      intent = 'search';
    } else if (lowerMessage.includes('mua') || lowerMessage.includes('buy') || lowerMessage.includes('price')) {
      intent = 'purchase';
    } else if (lowerMessage.includes('so sánh') || lowerMessage.includes('compare')) {
      intent = 'comparison';
    } else if (lowerMessage.includes('hướng dẫn') || lowerMessage.includes('how') || lowerMessage.includes('cách')) {
      intent = 'guidance';
    } else if (lowerMessage.includes('?')) {
      intent = 'question';
    }

    const productPatterns = [
      /orcam/i, /jaws/i, /nvda/i, /braille/i,
      /wheelchair/i, /xe lăn/i,
    ];

    for (const pattern of productPatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.push(match[0]);
      }
    }

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (/tuyệt vời|great|good|excellent|👍|cảm ơn/.test(lowerMessage)) {
      sentiment = 'positive';
    } else if (/không|hông|not|bad|失望|không hài lòng/.test(lowerMessage)) {
      sentiment = 'negative';
    }

    return { intent, entities, sentiment };
  }
}

// Singleton instance
export const contextService = new ContextService();
