// MADA AI Backend - Main Entry Point
// Updated with comprehensive logging and configuration display

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { appConfig, featureFlags } from './config/app.config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { chatRouter, ragRouter, healthRouter, scrapeRouter, recommendRouter } from './routes/index.js';
import { ragService } from './services/rag.service.js';
import { embeddingService } from './services/embedding.service.js';
import { vectorStoreFactory } from './lib/vectorStoreFactory.js';

const app: Express = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Legacy route compatibility - redirect /api/chat to /api/v1/chat
app.use('/api/chat', (req, res, next) => {
  // Forward to the chat router
  req.url = '/';
  chatRouter(req, res, next);
});

app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/rag', ragRouter);
app.use('/api/v1/recommend', recommendRouter);
app.use('/api/v1/health', healthRouter);
app.use('/api/scrape', scrapeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

app.use(errorHandler);

async function start() {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    MADA AI ASSISTANT                         ║
║               Backend Server - v2.0                          ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    logger.info('Initializing services...');

    // Initialize embedding service
    const embeddingHealth = await embeddingService.healthCheck();
    logger.info('Embedding service status', embeddingHealth);

    // Initialize vector store factory
    await vectorStoreFactory.initialize();
    const vectorStoreType = vectorStoreFactory.getStoreType();
    logger.info('Vector store initialized', { storeType: vectorStoreType });

    // Initialize RAG service
    await ragService.initialize();
    logger.info('RAG service initialized');

    // Log configuration
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ CONFIGURATION                                               │
├─────────────────────────────────────────────────────────────┤
│ Environment:     ${appConfig.nodeEnv.padEnd(40)}│
│ Port:            ${String(appConfig.port).padEnd(40)}│
│ CORS Origin:     ${appConfig.corsOrigin.padEnd(40)}│
├─────────────────────────────────────────────────────────────┤
│ FEATURES                                                     │
├─────────────────────────────────────────────────────────────┤
│ RAG:          ${(featureFlags.enableRag ? '✅ Enabled' : '❌ Disabled').padEnd(50)}│
│ Guardrails:   ${(featureFlags.enableGuardrails ? '✅ Enabled' : '❌ Disabled').padEnd(50)}│
│ Metrics:      ${(featureFlags.enableMetrics ? '✅ Enabled' : '❌ Disabled').padEnd(50)}│
│ Pinecone:     ${(featureFlags.enablePinecone ? '✅ Enabled' : '❌ Disabled').padEnd(50)}│
├─────────────────────────────────────────────────────────────┤
│ EMBEDDINGS                                                   │
├─────────────────────────────────────────────────────────────┤
│ Type:          ${(embeddingHealth.usingRealEmbeddings ? 'Real (Gemini)' : 'Simulated').padEnd(50)}│
│ Model:         ${'gemini-embedding-exp-03-07'.padEnd(50)}│
│ Dimension:     ${'768'.padEnd(50)}│
├─────────────────────────────────────────────────────────────┤
│ VECTOR STORE                                                 │
├─────────────────────────────────────────────────────────────┤
│ Type:          ${(vectorStoreType === 'pinecone' ? 'Pinecone (Cloud)' : 'In-Memory').padEnd(50)}│
└─────────────────────────────────────────────────────────────┘
    `);

    // Start server
    app.listen(appConfig.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🚀 Server running on http://localhost:${String(appConfig.port).padEnd(28)}║
║                                                               ║
║  API Endpoints:                                               ║
║  • POST /api/v1/chat       - Chat with AI                    ║
║  • POST /api/v1/recommend  - Get product recommendations     ║
║  • POST /api/v1/rag/search - RAG search                     ║
║  • GET  /api/v1/health     - Health check                   ║
╚═══════════════════════════════════════════════════════════════╝
      `);
      logger.info('Server startup complete', {
        port: appConfig.port,
        environment: appConfig.nodeEnv,
        features: featureFlags,
      });
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

start();

export default app;
