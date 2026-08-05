// Health Routes - Health check endpoints

import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vector-store.js';
import { sessionService } from '../services/session.service.js';
import { register } from '../utils/metrics.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    gemini: boolean;
    vectorStore: boolean;
    session: boolean;
  };
}

// Basic health check
healthRouter.get('/', async (_req: Request, res: Response) => {
  const status: HealthStatus = {
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      gemini: true,
      vectorStore: await vectorStore.healthCheck(),
      session: true,
    },
  };

  const allHealthy = Object.values(status.services).every(Boolean);
  const allUnhealthy = Object.values(status.services).every(v => !v);

  if (allHealthy) {
    status.status = 'healthy';
  } else if (allUnhealthy) {
    status.status = 'unhealthy';
  } else {
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'unhealthy' ? 503 : 200;

  res.status(httpStatus).json({
    success: status.status !== 'unhealthy',
    data: status,
  });
});

// Detailed health check with session stats
healthRouter.get('/detailed', async (_req: Request, res: Response) => {
  const sessionStats = await sessionService.getSessionStats();
  const vectorStats = await vectorStore.getStats();

  res.status(200).json({
    success: true,
    data: {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV,
      },
      sessions: sessionStats,
      vectorStore: vectorStats,
      timestamp: new Date().toISOString(),
    },
  });
});

// Prometheus metrics endpoint
healthRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

// Liveness probe (Kubernetes)
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe (Kubernetes)
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const vectorStoreHealthy = await vectorStore.healthCheck();

  if (vectorStoreHealthy) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});
