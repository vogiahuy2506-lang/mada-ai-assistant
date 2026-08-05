// RAG Routes - RAG search API endpoints

import { Router, Request, Response, NextFunction } from 'express';
import { ragService } from '../services/rag.service.js';
import { ragSearchSchema } from '../utils/validation.js';
import { errors } from '../middleware/error-handler.js';
import { searchRateLimiter } from '../middleware/rate-limiter.js';
import { Product } from '../models/index.js';

export const ragRouter = Router();

ragRouter.post('/search', searchRateLimiter.middleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = ragSearchSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw errors.validationError('Invalid request body');
    }

    const { query, categories, filters, topK } = parseResult.data;

    const results = await ragService.search({
      query,
      categories,
      filters,
      maxResults: topK,
    });

    res.status(200).json({
      success: true,
      data: {
        results: results.results.map((r: { type: string; item: unknown; score: number; relevanceReason: string; confidence: number }) => {
          const product = r.item as Product;
          return {
            type: r.type,
            id: product.id,
            name: product.name,
            description: product.description,
            score: r.score,
            relevanceReason: r.relevanceReason,
            confidence: r.confidence,
            pricing: product.pricing,
            category: product.category,
          };
        }),
        query: results.query,
        totalResults: results.results.length,
        processingTimeMs: results.processingTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

ragRouter.get('/product/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await ragService.getProductById(req.params.id);
    if (!product) {
      throw errors.notFound('Product not found');
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

ragRouter.get('/categories', async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'vision', name: 'Vision Support', nameVi: 'Hỗ trợ thị giác' },
      { id: 'hearing', name: 'Hearing Support', nameVi: 'Hỗ trợ thính giác' },
      { id: 'mobility', name: 'Mobility Support', nameVi: 'Hỗ trợ vận động' },
      { id: 'communication', name: 'Communication Support', nameVi: 'Hỗ trợ giao tiếp' },
      { id: 'cognition', name: 'Cognitive Support', nameVi: 'Hỗ trợ nhận thức' },
      { id: 'daily_living', name: 'Daily Living Aids', nameVi: 'Hỗ trợ sinh hoạt' },
      { id: 'education', name: 'Educational Support', nameVi: 'Hỗ trợ giáo dục' },
    ],
  });
});

ragRouter.get('/category/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await ragService.getProductsByCategory(req.params.id as 'vision' | 'hearing' | 'mobility' | 'communication' | 'cognition' | 'daily_living' | 'education');
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});
