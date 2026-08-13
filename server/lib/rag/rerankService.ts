// @ts-nocheck
/**
 * Re-ranking Service cho RAG
 * Dùng Gemini để đánh giá lại mức độ liên quan của documents đã retrieve
 */

import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';

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

      const model = this.client.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
        tools: [{
          functionDeclarations: [RERANK_RESPONSE_SCHEMA]
        }],
      });

      let scores: number[] = [];

      try {
        const result = await model.generateContent(prompt);
        const response = result.response;

        // Try structured JSON first
        if (response.functionCalls?.length > 0) {
          const fnCall = response.functionCalls()[0];
          if (fnCall.name === 'rerank_response') {
            scores = fnCall.args.scores || [];
          }
        }

        // Fallback: if no structured response, parse text
        if (scores.length === 0) {
          const text = response.text().trim();
          scores = this.parseScores(text, items.length);
        }
      } catch (schemaError: any) {
        // Schema failed - fallback to text parsing
        console.warn('⚠️ Rerank schema parsing failed, using text fallback:', schemaError.message?.slice(0, 80));
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        scores = this.parseScores(text, items.length);
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

// Singleton instance
export const rerankService = new RerankService();
