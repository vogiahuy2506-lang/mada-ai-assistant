// Prometheus Metrics Configuration

import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Request metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// AI metrics
export const aiConfidenceScores = new client.Histogram({
  name: 'ai_confidence_score',
  help: 'AI response confidence scores',
  buckets: [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99],
});

export const aiTokensUsed = new client.Counter({
  name: 'ai_tokens_used_total',
  help: 'Total tokens used by AI model',
  labelNames: ['model', 'type'],
});

export const aiModelErrors = new client.Counter({
  name: 'ai_model_errors_total',
  help: 'Total AI model errors',
  labelNames: ['error_type'],
});

// RAG metrics
export const ragRetrievalLatency = new client.Histogram({
  name: 'rag_retrieval_latency_seconds',
  help: 'RAG retrieval latency in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const ragRetrievalResults = new client.Histogram({
  name: 'rag_retrieval_results_count',
  help: 'Number of RAG retrieval results',
  buckets: [0, 1, 2, 3, 5, 10, 15, 20],
});

// Guardrail metrics
export const guardrailTriggers = new client.Counter({
  name: 'guardrail_triggers_total',
  help: 'Total guardrail triggers',
  labelNames: ['type', 'action'],
});

// Session metrics
export const activeSessions = new client.Gauge({
  name: 'active_sessions_count',
  help: 'Number of active chat sessions',
});

export const sessionMessages = new client.Counter({
  name: 'session_messages_total',
  help: 'Total messages in sessions',
  labelNames: ['role'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(aiConfidenceScores);
register.registerMetric(aiTokensUsed);
register.registerMetric(aiModelErrors);
register.registerMetric(ragRetrievalLatency);
register.registerMetric(ragRetrievalResults);
register.registerMetric(guardrailTriggers);
register.registerMetric(activeSessions);
register.registerMetric(sessionMessages);
