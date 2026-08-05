// MADA AI Backend - Main Entry Point

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { appConfig } from './config/app.config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { chatRouter, ragRouter, healthRouter } from './routes/index.js';
import { ragService } from './services/rag.service.js';

const app: Express = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/rag', ragRouter);
app.use('/api/v1/health', healthRouter);

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
    logger.info('Starting MADA AI Backend...');
    await ragService.initialize();
    logger.info('RAG service initialized');

    app.listen(appConfig.port, () => {
      logger.info(`Server running on port ${appConfig.port}`);
      logger.info(`Environment: ${appConfig.nodeEnv}`);
    });

    process.on('SIGTERM', () => { logger.info('SIGTERM received, shutting down...'); process.exit(0); });
    process.on('SIGINT', () => { logger.info('SIGINT received, shutting down...'); process.exit(0); });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export default app;
