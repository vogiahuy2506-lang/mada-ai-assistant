// Chat Routes - Main chat API endpoints

import { Router, Request, Response, NextFunction } from 'express';
import { GeminiAgent } from '../agents/gemini-agent.js';
import { sessionService } from '../services/session.service.js';
import { ragService } from '../services/rag.service.js';
import { GuardrailsOrchestrator } from '../guardrails/index.js';
import { chatRequestSchema } from '../utils/validation.js';
import { createLogger } from '../utils/logger.js';
import { errors } from '../middleware/error-handler.js';
import { chatRateLimiter } from '../middleware/rate-limiter.js';
import { SupportedLanguage, RAGContextRef, Product } from '../models/index.js';

const logger = createLogger('ChatRoutes');

export const chatRouter = Router();

const geminiAgent = new GeminiAgent();
const guardrails = new GuardrailsOrchestrator();

chatRouter.post('/', chatRateLimiter.middleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw errors.validationError('Invalid request body');
    }

    const { message, sessionId, language = 'vi' } = parseResult.data;

    let session = sessionId ? await sessionService.getSession(sessionId) : null;

    if (!session) {
      session = await sessionService.createSession('anonymous', {
        deviceType: 'desktop',
        userAgent: req.get('user-agent') || 'unknown',
        ipAddress: req.ip,
      });
    }

    if (language) {
      await sessionService.setLanguage(session.id, language);
    }

    const guardrailResult = await guardrails.check(message, language);
    await sessionService.addMessage(session.id, 'user', message);

    let responseText: string;
    let confidence = 0.82;
    let ragContext: RAGContextRef[] = [];

    if (!guardrailResult.passed) {
      if (guardrailResult.customResponse) {
        responseText = guardrailResult.customResponse;
      } else if (guardrailResult.action === 'BLOCK') {
        responseText = 'Tôi không thể hỗ trợ yêu cầu này. Vui lòng hỏi về Công nghệ Hỗ trợ.';
      } else {
        responseText = guardrailResult.suggestions?.join(' ') ||
          'Tôi có thể giúp bạn về các giải pháp công nghệ hỗ trợ. Bạn cần hỗ trợ gì?';
      }
      confidence = 0.5;
    } else {
      if (process.env.ENABLE_RAG !== 'false') {
        try {
          const ragResults = await ragService.search({
            query: message,
            language,
            maxResults: 3,
          });

          if (ragResults.results.length > 0) {
            ragContext = ragResults.results.slice(0, 3).map((r: { type: string; item: unknown; score: number }) => {
              const product = r.item as Product;
              const name = product.name?.[language as keyof typeof product.name] || product.name?.en || 'Unknown';
              return {
                type: r.type as 'product' | 'standard',
                id: product.id || 'unknown',
                name,
                score: r.score,
              };
            });
          }
        } catch (ragError) {
          logger.warn('RAG search failed', { error: ragError });
        }
      }

      const history = await sessionService.getMessages(session.id, 10);
      const aiResponse = await geminiAgent.generateResponse(
        message,
        history,
        language as SupportedLanguage,
        {
          ragResults: ragContext.map(ctx => ({
            name: ctx.name,
            description: '',
            score: ctx.score,
          })),
        }
      );

      responseText = aiResponse.text;
      confidence = aiResponse.confidence;
    }

    await sessionService.addMessage(session.id, 'assistant', responseText, {
      ragContext,
      confidence,
      guardrailAction: guardrailResult.action,
    });

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        message: responseText,
        confidence,
        sources: ragContext,
        guardrailAction: guardrailResult.action !== 'ALLOW' ? guardrailResult.action : undefined,
        metadata: {
          tokensUsed: 0,
          processingTimeMs: Date.now() - new Date(session.createdAt).getTime(),
          model: 'gemini-2.0-flash',
        },
      },
    });

  } catch (error) {
    next(error);
  }
});

chatRouter.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      throw errors.notFound('Session not found');
    }
    res.status(200).json({
      success: true,
      data: {
        id: session.id,
        messages: session.messages,
        context: session.context,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.delete('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await sessionService.deleteSession(req.params.id);
    if (!deleted) {
      throw errors.notFound('Session not found');
    }
    res.status(200).json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await sessionService.getSessionStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});
