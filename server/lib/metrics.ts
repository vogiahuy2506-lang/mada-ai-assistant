/**
 * MADA AI - Metrics System
 * 
 * Theo dõi và thu thập metrics cho:
 * - Request metrics
 * - AI metrics
 * - RAG metrics
 * - Guardrail metrics
 */

export interface MetricEntry {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

// In-memory metrics storage
const metricsStore: Map<string, MetricEntry[]> = new Map();
const counters: Map<string, number> = new Map();
const gauges: Map<string, number> = new Map();
const histograms: Map<string, number[]> = new Map();

const MAX_HISTORY = 1000;

// Record a metric
export function recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
  const entry: MetricEntry = {
    name,
    value,
    labels,
    timestamp: new Date().toISOString(),
  };

  const existing = metricsStore.get(name) || [];
  existing.unshift(entry);
  
  if (existing.length > MAX_HISTORY) {
    existing.pop();
  }
  
  metricsStore.set(name, existing);
}

// Counter - increments
export function incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
  const key = `${name}:${JSON.stringify(labels)}`;
  const current = counters.get(key) || 0;
  counters.set(key, current + value);
  
  recordMetric(name, current + value, { ...labels, operation: 'increment' });
}

// Gauge - set value
export function setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
  const key = `${name}:${JSON.stringify(labels)}`;
  gauges.set(key, value);
  
  recordMetric(name, value, { ...labels, operation: 'gauge' });
}

// Histogram - record value distribution
export function observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
  const key = `${name}:${JSON.stringify(labels)}`;
  const existing = histograms.get(key) || [];
  
  existing.unshift(value);
  if (existing.length > MAX_HISTORY) {
    existing.pop();
  }
  
  histograms.set(key, existing);
  recordMetric(name, value, { ...labels, operation: 'histogram' });
}

// Get current counter value
export function getCounter(name: string, labels: Record<string, string> = {}): number {
  const key = `${name}:${JSON.stringify(labels)}`;
  return counters.get(key) || 0;
}

// Get current gauge value
export function getGauge(name: string, labels: Record<string, string> = {}): number {
  const key = `${name}:${JSON.stringify(labels)}`;
  return gauges.get(key) || 0;
}

// Get histogram stats
export function getHistogramStats(name: string, labels: Record<string, string> = {}): {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
} {
  const key = `${name}:${JSON.stringify(labels)}`;
  const values = histograms.get(key) || [];
  
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// Pre-defined metrics helpers

// Request metrics
export function recordRequestMetrics(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number
): void {
  incrementCounter('http_requests_total', 1, { endpoint, method, status: String(statusCode) });
  observeHistogram('http_request_duration_ms', durationMs, { endpoint, method });
}

// RAG metrics
export function recordRAGMetrics(
  retrievalCount: number,
  confidence: number,
  durationMs: number,
  usedRerank: boolean = false
): void {
  incrementCounter('rag_queries_total', 1);
  observeHistogram('rag_retrieval_count', retrievalCount);
  observeHistogram('rag_confidence', confidence);
  observeHistogram('rag_query_duration_ms', durationMs);
  
  if (usedRerank) {
    incrementCounter('rag_rerank_total', 1);
  }
}

// Guardrail metrics
export function recordGuardrailMetrics(
  passed: boolean,
  triggeredRule?: string,
  durationMs?: number
): void {
  incrementCounter('guardrail_checks_total', 1, {
    passed: String(passed),
    ...(triggeredRule && { rule: triggeredRule }),
  });
  
  if (durationMs !== undefined) {
    observeHistogram('guardrail_check_duration_ms', durationMs);
  }
}

// AI metrics
export function recordAIMetrics(
  tokensUsed: number,
  model: string,
  durationMs: number,
  success: boolean
): void {
  incrementCounter('ai_requests_total', 1, { model, success: String(success) });
  observeHistogram('ai_tokens_used', tokensUsed, { model });
  observeHistogram('ai_request_duration_ms', durationMs, { model });
}

// Get all metrics summary
export function getMetricsSummary(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, ReturnType<typeof getHistogramStats>>;
  recentMetrics: MetricEntry[];
} {
  const countersObj: Record<string, number> = {};
  const gaugesObj: Record<string, number> = {};

  counters.forEach((value, key) => {
    countersObj[key] = value;
  });

  gauges.forEach((value, key) => {
    gaugesObj[key] = value;
  });

  histograms.forEach(() => {
    // Reserved for future histogram exposure logic
  });

  return {
    counters: countersObj,
    gauges: gaugesObj,
    histograms: {
      'http_request_duration_ms': getHistogramStats('http_request_duration_ms'),
      'rag_query_duration_ms': getHistogramStats('rag_query_duration_ms'),
      'rag_confidence': getHistogramStats('rag_confidence'),
      'ai_request_duration_ms': getHistogramStats('ai_request_duration_ms'),
    },
    recentMetrics: Array.from(metricsStore.values()).flat().slice(0, 100),
  };
}

// Reset all metrics
export function resetMetrics(): void {
  metricsStore.clear();
  counters.clear();
  gauges.clear();
  histograms.clear();
  console.log('✅ Metrics reset');
}
