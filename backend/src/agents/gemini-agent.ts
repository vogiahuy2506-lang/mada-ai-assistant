// Gemini Agent - AI Agent Engine using Google Gemini SDK

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerateContentResult } from '@google/generative-ai';
import { geminiConfig } from '../config/app.config.js';
import { getSystemInstruction } from './system-instructions.js';
import { createLogger } from '../utils/logger.js';
import { aiConfidenceScores, aiTokensUsed, aiModelErrors } from '../utils/metrics.js';
import { ChatMessage, SupportedLanguage } from '../models/index.js';

const logger = createLogger('GeminiAgent');

interface GeminiResponse {
  text: string;
  confidence: number;
  tokensUsed: number;
  finishReason: string;
}

interface ConversationTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export class GeminiAgent {
  private client: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[];

  constructor() {
    const apiKey = geminiConfig.apiKey || 'demo-key';
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: geminiConfig.model,
      generationConfig: {
        temperature: geminiConfig.temperature,
        maxOutputTokens: geminiConfig.maxTokens,
        topP: 0.95,
        topK: 40,
      },
    });

    // Safety settings - block harmful content
    this.safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    logger.info('Gemini Agent initialized', { model: geminiConfig.model });
  }

  async generateResponse(
    userMessage: string,
    history: ChatMessage[],
    language: SupportedLanguage = 'vi',
    context?: {
      ragResults?: { name: string; description: string; score: number }[];
      category?: string;
    }
  ): Promise<GeminiResponse> {
    const startTime = Date.now();

    try {
      // Build conversation history
      const conversationHistory: ConversationTurn[] = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      // Build prompt with context
      let promptWithContext = userMessage;

      if (context?.ragResults && context.ragResults.length > 0) {
        const contextSection = context.ragResults
          .map((r, i) => `${i + 1}. ${r.name} - Điểm phù hợp: ${Math.round(r.score * 100)}%`)
          .join('\n');

        promptWithContext = `${userMessage}

[SẢN PHẨM GỢI Ý TỪ HỆ THỐNG]
${contextSection}
---
Hãy dựa trên thông tin sản phẩm trên để trả lời câu hỏi của người dùng một cách chính xác.`;
      }

      // Generate content
      const result = await this.model.generateContent({
        contents: [
          ...conversationHistory,
          { role: 'user', parts: [{ text: promptWithContext }] },
        ],
        systemInstruction: {
          role: 'system',
          parts: [{ text: getSystemInstruction(language) }],
        },
        safetySettings: this.safetySettings,
      });

      const response = result.response;
      const text = response.text();

      // Calculate metrics
      const usageMetadata = response.usageMetadata;
      const tokensUsed = usageMetadata?.totalTokenCount || 0;

      // Estimate confidence based on response characteristics
      const confidence = this.estimateConfidence(result);

      // Record metrics
      aiConfidenceScores.observe(confidence);
      if (tokensUsed > 0) {
        aiTokensUsed.inc({ model: geminiConfig.model, type: 'total' }, tokensUsed);
      }

      const duration = Date.now() - startTime;
      logger.info('Response generated', {
        tokensUsed,
        confidence,
        durationMs: duration,
        finishReason: 'COMPLETE',
      });

      return {
        text,
        confidence,
        tokensUsed,
        finishReason: 'COMPLETE',
      };
    } catch (error: any) {
      logger.error('Error generating response', { error: error.message });

      aiModelErrors.inc({ error_type: error.status || 'unknown' });

      // Return error response
      return {
        text: this.getErrorMessage(language),
        confidence: 0,
        tokensUsed: 0,
        finishReason: 'ERROR',
      };
    }
  }

  private estimateConfidence(result: GenerateContentResult): number {
    // Base confidence
    let confidence = 0.85;

    // Check for safety blocks
    const promptFeedback = result.response.promptFeedback;
    if (promptFeedback?.blockReason) {
      confidence = 0.3; // Low confidence due to safety block
    }

    // Ensure confidence is within bounds
    return Math.max(0.5, Math.min(0.99, confidence));
  }

  private getErrorMessage(language: string): string {
    const messages: Record<string, string> = {
      vi: 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
      en: 'I apologize, I encountered an issue processing your request. Please try again later.',
      ar: 'عذرًا، واجهت مشكلة في معالجة طلبك. يرجى المحاولة مرة أخرى لاحقًا.',
      fr: 'Je m\'excuse, j\'ai rencontré un problème lors du traitement de votre demande. Veuillez réessayer.',
    };

    return messages[language] || messages.vi;
  }

  async generateSimpleResponse(prompt: string, language: SupportedLanguage = 'vi'): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: {
          role: 'system',
          parts: [{ text: getSystemInstruction(language) }],
        },
        safetySettings: this.safetySettings,
      });

      return result.response.text();
    } catch (error: any) {
      logger.error('Error in simple response generation', { error: error.message });
      return this.getErrorMessage(language);
    }
  }

  async generateWithImage(
    text: string,
    imageBase64: string,
    mimeType: string,
    language: SupportedLanguage = 'vi'
  ): Promise<GeminiResponse> {
    try {
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
        systemInstruction: {
          role: 'system',
          parts: [{ text: getSystemInstruction(language) }],
        },
        safetySettings: this.safetySettings,
      });

      const response = result.response;

      return {
        text: response.text(),
        confidence: this.estimateConfidence(result),
        tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        finishReason: 'COMPLETE',
      };
    } catch (error: any) {
      logger.error('Error generating response with image', { error: error.message });
      return {
        text: this.getErrorMessage(language),
        confidence: 0,
        tokensUsed: 0,
        finishReason: 'ERROR',
      };
    }
  }
}
