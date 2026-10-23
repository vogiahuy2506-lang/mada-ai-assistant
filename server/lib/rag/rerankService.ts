// @ts-nocheck
/**
 * Re-ranking Service cho RAG
 * Dùng Gemini để đánh giá lại mức độ liên quan của documents đã retrieve
 */

import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';

// ============ PROXY-AWARE ============

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

async function callGeminiWithProxy(apiKey: string, modelName: string, prompt: string, tools?: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        // ⚠️ PHẢI đủ lớn: Gemini 2.5 dùng "thinking tokens" trước khi trả lời.
        // Với maxOutputTokens=2048 và 28 tài liệu, phần thinking + JSON bị TRUNCATE
        // → parse fail → fallback về RRF score (~0.016) → threshold 0.5 loại hết docs.
        maxOutputTokens: 8192,
        // Tắt thinking để không đốt token budget vào suy luận thừa.
        thinkingConfig: { thinkingBudget: 0 },
      },
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
    // No cleanup needed - using system proxy
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
        const result = await callGeminiWithProxy(apiKey, 'gemini-2.5-flash', prompt, [{ functionDeclarations: [RERANK_RESPONSE_SCHEMA] }]);
        
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
        console.log(`🔬 [rerank] rawScores=${scores.length} sample=${JSON.stringify(scores.slice(0, 5))} max=${Math.max(...scores, 0)}`);
      } catch (schemaError: any) {
        // Schema failed - fallback to text parsing
        console.warn('⚠️ Rerank schema parsing failed, using text fallback:', schemaError.message?.slice(0, 80));
        try {
          const result = await callGeminiWithProxy(apiKey, 'gemini-2.5-flash', prompt, undefined);
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

      // ⚠️ Lưới an toàn: model trả toàn 0 (đọc nhầm prompt / response rỗng) sẽ khiến
      // filter `score >= minScore` loại sạch mọi docs → RAG mất hoàn toàn context.
      // Trong trường hợp này coi như rerank thất bại và dùng fallback ranking.
      if (scores.every((s) => !Number.isFinite(s) || s <= 0)) {
        console.warn('⚠️ RerankService: All scores are 0 — model returned no usable signal. Using fallback ranking.');
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
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // 1) JSON đầy đủ
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.scores)) {
        return this.normalizeScores(parsed.scores, expectedCount);
      }
    } catch {
      // tiếp tục thử các cách khác
    }

    // 2) ⭐ JSON BỊ TRUNCATE (Gemini hết maxOutputTokens) — thường dạng:
    //    `{"scores": [0.9, 0.7, 0.8, ...` (thiếu dấu `]}`).
    //    ⚠️ Regex cũ `"scores"\s*:\s*\[([\s\S]*?)\]?` SAI: `\]?` optional + lazy
    //    khiến capture rỗng ("" → Number("")=0 → mảng toàn 0 → threshold 0.5 loại hết docs).
    //    Dùng `*?` thay vì `*` + non-greedy để dừng tại `]` ĐẦU TIÊN có thật;
    //    nếu không có `]` (truncate) thì lấy hết phần còn lại.
    const arrMatch = cleaned.match(/"scores"\s*:\s*\[([^\]]*)\]?/i);
    if (arrMatch) {
      const nums = arrMatch[1]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      if (nums.length > 0) {
        return this.normalizeScores(nums, expectedCount);
      }
    }

    // 3) Mảng số trần, không có key
    const bareMatch = cleaned.match(/\[[\s\S]*?\]/);
    if (bareMatch) {
      try {
        const arr = JSON.parse(bareMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) {
          return this.normalizeScores(arr, expectedCount);
        }
      } catch {
        // ignore
      }
    }

    console.warn('⚠️ RerankService: Could not parse scores, defaulting to 0.5');
    return new Array(expectedCount).fill(0.5);
  }

  /**
   * Chuẩn hoá scores về đúng độ dài expectedCount và ép về khoảng [0,1].
   * Nếu model trả về nhiều hơn → cắt; ít hơn → pad bằng giá trị cuối.
   */
  private normalizeScores(scores: any[], expectedCount: number): number[] {
    const cleaned = scores.map((s) => {
      const n = Number(s);
      if (Number.isNaN(n)) return 0;
      return Math.max(0, Math.min(1, n));
    });

    if (cleaned.length === expectedCount) return cleaned;
    if (cleaned.length > expectedCount) return cleaned.slice(0, expectedCount);

    // Pad: lấy trung bình phần còn lại (giữ nguyên tín hiệu thay vì 0 tuyệt đối)
    const avg = cleaned.length > 0 ? cleaned.reduce((a, b) => a + b, 0) / cleaned.length : 0.5;
    while (cleaned.length < expectedCount) cleaned.push(avg);
    return cleaned;
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
   * Fallback khi không có rerank model (Gemini lỗi / hết token).
   *
   * ⚠️ `item.score` từ hybrid search là RRF fused score — giá trị RẤT NHỎ
   * (thường ~0.01-0.02) vì công thức 1/(60+rank). Dùng trực tiếp làm
   * `rerankScore` sẽ bị threshold 0.5 loại sạch mọi docs → RAG rỗng.
   *
   * Vì vậy: chuẩn hoá score về thang [0,1] theo max score trong batch,
   * rồi map sang khoảng [0.5, 0.9] để tài liệu đã retrieve vẫn được giữ
   * (context có giá trị hơn là không có context) nhưng vẫn thấp hơn điểm
   * rerank thật (0.9+) để ưu tiên đúng.
   */
  private fallbackRank<T extends RerankableItem>(
    items: T[],
    cfg: RerankConfig
  ): RerankResult<T>[] {
    const scores = items.map((i) => i.score ?? 0);
    const maxScore = Math.max(...scores, 0);
    const minScore = Math.min(...scores, 0);
    const range = maxScore - minScore;

    const normalize = (s: number): number => {
      if (range <= 0) return 0.6;
      const rel = (s - minScore) / range; // 0..1
      return 0.5 + rel * 0.4; // map sang [0.5, 0.9]
    };

    return items
      .map((item) => ({
        item,
        rerankScore: normalize(item.score ?? 0),
        originalScore: item.score,
        reason: 'Ranked by original vector similarity (rerank model unavailable)',
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
