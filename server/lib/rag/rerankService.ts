// @ts-nocheck
/**
 * Re-ranking Service cho RAG
 * Dùng Gemini để đánh giá lại mức độ liên quan của documents đã retrieve
 */

import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';

// ============ PROXY BYPASS ============

// Retry helper for 429 Too Many Requests
async function fetchWithRetry(
  fn: () => Promise<Response>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 1000, maxDelayMs = 16000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fn();

    if (response.status === 429) {
      if (attempt === retries) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API 429 Too Many Requests (after ${retries} retries). ${body}`);
      }
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      console.warn(`⚠️ [rerank 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${retryDelay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }

    return response;
  }
  throw new Error('fetchWithRetry: unreachable');
}

async function callGeminiNoProxy(apiKey: string, modelName: string, prompt: string, tools?: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Clear proxy env vars for this call
  const savedEnv: Record<string, string | undefined> = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    http_proxy: process.env.http_proxy,
    https_proxy: process.env.https_proxy,
  };
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;

  try {
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    };
    if (tools?.length > 0) body.tools = tools;

    const response = await fetchWithRetry(
      () => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { retries: 3, baseDelayMs: 2000, maxDelayMs: 16000 }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    return response.json();
  } finally {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) process.env[key] = val;
    }
  }
}

// ============ SCHEMA DEFINITIONS ============

/**
 * Structured output schema for RERANK response (Task 5)
 * Ensures model returns JSON with predictable structure
 */
const RERANK_RESPONSE_SCHEMA: FunctionDeclaration = {
  name: 'rerank_response',
  description: 'Gemini rerank response với scores và reasons',
  parameters: {
    type: 'object',
    properties: {
      scores: {
        type: 'array',
        description: 'Mảng scores từ 0.0 đến 1.0 cho mỗi item theo thứ tự input',
        items: { type: 'number' }
      },
      reasoning: {
        type: 'string',
        description: 'Giải thích ngắn gọn về phương pháp scoring'
      }
    },
    required: ['scores']
  }
};

export interface RerankableItem {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface RerankResult<T extends RerankableItem> {
  item: T;
  rerankScore: number;
  originalScore?: number;
  reason: string;
}

interface RerankConfig {
  topN: number;
  batchSize: number;
  minScore: number;
}

const DEFAULT_CONFIG: RerankConfig = {
  topN: 5,
  batchSize: 10,
  minScore: 0.3,
};

/**
 * RerankService dùng Gemini để đánh giá lại mức độ liên quan
 * của các documents đã retrieve với query
 */
export class RerankService {
  private client: GoogleGenerativeAI | null = null;
  private config: RerankConfig;

  constructor(config?: Partial<RerankConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.client = new GoogleGenerativeAI(apiKey);
      console.log('✅ RerankService initialized with Gemini');
    } else {
      console.warn('⚠️ RerankService: Gemini API key not configured. Using fallback ranking.');
    }
  }

  /**
   * Rerank danh sách items theo mức độ liên quan với query
   */
  async rerank<T extends RerankableItem>(
    query: string,
    items: T[],
    options?: Partial<RerankConfig>
  ): Promise<RerankResult<T>[]> {
    if (items.length === 0) return [];

    const cfg = { ...this.config, ...options };
    const startTime = Date.now();

    try {
      // Fallback nếu không có Gemini
      if (!this.client) {
        console.warn('⚠️ RerankService: No Gemini client, using fallback ranking');
        return this.fallbackRank(items, cfg);
      }

      // Build prompt cho Gemini
      const prompt = this.buildRerankPrompt(query, items);
      const apiKey = process.env.GEMINI_API_KEY!;

      let scores: number[] = [];

      try {
        // Call Gemini directly (bypasses proxy)
        const result = await callGeminiNoProxy(apiKey, 'gemini-2.5-flash', prompt, [{ functionDeclarations: [RERANK_RESPONSE_SCHEMA] }]);
        
        // Parse the response
        const parts = result?.candidates?.[0]?.content?.parts || [];
        const functionCallPart = parts.find((p: any) => p.functionCall);
        
        if (functionCallPart?.functionCall?.args?.scores) {
          scores = functionCallPart.functionCall.args.scores;
        } else {
          // Try text parsing
          const textParts = parts.filter((p: any) => p.text);
          const text = textParts.map((p: any) => p.text).join('\n').trim();
          if (text) {
            scores = this.parseScores(text, items.length);
          }
        }
      } catch (schemaError: any) {
        // Schema failed - fallback to text parsing
        console.warn('⚠️ Rerank schema parsing failed, using text fallback:', schemaError.message?.slice(0, 80));
        try {
          const result = await callGeminiNoProxy(apiKey, 'gemini-2.5-flash', prompt, undefined);
          const parts = result?.candidates?.[0]?.content?.parts || [];
          const textParts = parts.filter((p: any) => p.text);
          const text = textParts.map((p: any) => p.text).join('\n').trim();
          if (text) {
            scores = this.parseScores(text, items.length);
          }
        } catch {
          // ignore - use fallback below
        }
      }

      // Nếu vẫn không có scores, dùng fallback ranking
      if (scores.length === 0) {
        console.warn('⚠️ RerankService: No scores extracted, falling back to original scores');
        return this.fallbackRank(items, cfg);
      }

      // Map scores vào items, sort theo rerank score
      const reranked: RerankResult<T>[] = items.map((item, idx) => {
        const rerankScore = scores[idx] ?? 0;
        const reason = this.explainScore(query, item, rerankScore);
        return {
          item,
          rerankScore,
          originalScore: item.score,
          reason,
        };
      });

      reranked.sort((a, b) => b.rerankScore - a.rerankScore);

      const filtered = reranked
        .filter((r) => r.rerankScore >= cfg.minScore)
        .slice(0, cfg.topN);

      const duration = Date.now() - startTime;
      console.log(`✅ Rerank completed in ${duration}ms`, {
        inputCount: items.length,
        outputCount: filtered.length,
        topScore: filtered[0]?.rerankScore ?? 0,
      });

      return filtered;
    } catch (error) {
      console.error('❌ Rerank failed, falling back to original scores:', error);
      return this.fallbackRank(items, cfg);
    }
  }

  private buildRerankPrompt(query: string, items: RerankableItem[]): string {
    const itemsJson = items
      .map(
        (item, idx) =>
          `[${idx}] (id: ${item.id})\n${item.content.slice(0, 500)}`
      )
      .join('\n\n');

    return `Bạn là một AI đánh giá mức độ liên quan (relevance scorer) cho hệ thống RAG về Công nghệ Hỗ trợ (Assistive Technology).

# Truy vấn của người dùng
"""${query}"""

# Danh sách ${items.length} tài liệu ứng viên
${itemsJson}

# Yêu cầu
Cho điểm mức độ liên quan của MỖI tài liệu với truy vấn, thang điểm 0.0 - 1.0:
- 0.0 - 0.3: Không liên quan
- 0.4 - 0.6: Liên quan một phần
- 0.7 - 0.8: Liên quan
- 0.9 - 1.0: Rất liên quan, trả lời trực tiếp câu hỏi

# Định dạng output (CHỈ trả về JSON, không có text khác):
{
  "scores": [score_0, score_1, ..., score_${items.length - 1}],
  "reasons": ["lý do ngắn cho item 0", "lý do cho item 1", ...]
}

QUAN TRỌNG: Chỉ trả về JSON object, không thêm markdown code block hay giải thích.`;
  }

  private parseScores(text: string, expectedCount: number): number[] {
    try {
      // Loại bỏ markdown code block nếu có
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed.scores) && parsed.scores.length === expectedCount) {
        return parsed.scores.map((s) => {
          const n = Number(s);
          if (Number.isNaN(n)) return 0;
          return Math.max(0, Math.min(1, n));
        });
      }
    } catch (err) {
      console.warn('⚠️ RerankService: Failed to parse scores', { text: text.slice(0, 200) });
    }

    // Fallback: đều 0.5
    return new Array(expectedCount).fill(0.5);
  }

  private explainScore(query: string, item: RerankableItem, score: number): string {
    const queryLower = query.toLowerCase();
    const contentLower = item.content.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    const matches = queryWords.filter((w) => contentLower.includes(w));

    if (matches.length > 0) {
      return `Khớp ${matches.length}/${queryWords.length} từ khóa: "${matches.slice(0, 3).join('", "')}"`;
    }

    if (score >= 0.7) return 'Phù hợp ngữ nghĩa với truy vấn';
    if (score >= 0.4) return 'Liên quan một phần';
    return 'Điểm liên quan thấp';
  }

  /**
   * Fallback: dùng original score từ vector search
   */
  private fallbackRank<T extends RerankableItem>(
    items: T[],
    cfg: RerankConfig
  ): RerankResult<T>[] {
    return items
      .map((item) => ({
        item,
        rerankScore: item.score ?? 0.5,
        originalScore: item.score,
        reason: 'Ranked by original vector similarity (no rerank model)',
      }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, cfg.topN);
  }

  /**
   * Health check
   */
  isReady(): boolean {
    return this.client !== null;
  }
}

// Lazy singleton - chỉ initialize khi GEMINI_API_KEY đã load (sau dotenv.config())
// Fix cho bug: imports chạy trước dotenv → process.env.GEMINI_API_KEY rỗng khi constructor chạy
let _rerankServiceInstance: RerankService | null = null;

export const rerankService = {
  rerank<T extends RerankableItem>(items: T[], query: string, config?: Partial<RerankConfig>): Promise<RerankResult<T>[]> {
    if (!_rerankServiceInstance) {
      _rerankServiceInstance = new RerankService();
    }
    return _rerankServiceInstance.rerank(items, query, config);
  },
  /**
   * Check ready. Trả về true nếu instance đã init + có Gemini client
   */
  isReady(): boolean {
    if (!_rerankServiceInstance) {
      // Lazy init: tạo instance để xem API key có không
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'your_gemini_api_key_here') {
        _rerankServiceInstance = new RerankService();
        return _rerankServiceInstance.isReady();
      }
      return false;
    }
    return _rerankServiceInstance.isReady();
  },
  initialize(config?: Partial<RerankConfig>): void {
    if (!_rerankServiceInstance) {
      _rerankServiceInstance = new RerankService(config);
    }
  },
};
