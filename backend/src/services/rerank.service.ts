// Rerank Service - Use Gemini to rerank retrieved results by relevance

import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiConfig } from '../config/app.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RerankService');

export interface RerankableItem {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface RerankResult<T extends RerankableItem> {
  item: T;
  rerankScore: number;       // 0-1
  originalScore?: number;
  reason: string;
}

interface RerankConfig {
  topN: number;              // Giữ lại top N sau rerank
  batchSize: number;         // Số items mỗi request
  minScore: number;          // Ngưỡng score tối thiểu (0-1)
}

const DEFAULT_CONFIG: RerankConfig = {
  topN: 5,
  batchSize: 10,
  minScore: 0.3,
};

/**
 * RerankService dùng Gemini để đánh giá lại mức độ liên quan của các documents
 * đã retrieve với query. Cross-encoder truyền thống dùng local model
 * (sentence-transformers), nhưng Gemini có thể thay thế bằng prompt-based scoring
 * với độ chính xác tương đương và zero infra overhead.
 */
export class RerankService {
  private client: GoogleGenerativeAI | null = null;
  private config: RerankConfig;

  constructor(config?: Partial<RerankConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (geminiConfig.apiKey) {
      this.client = new GoogleGenerativeAI(geminiConfig.apiKey);
    }
  }

  /**
   * Rerank danh sách items theo mức độ liên quan với query.
   * Trả về top N items có score cao nhất.
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
      // Nếu không có Gemini client → fallback về original score
      if (!this.client) {
        logger.warn('No Gemini client, using fallback ranking');
        return this.fallbackRank(items, cfg);
      }

      // Build prompt cho Gemini
      const prompt = this.buildRerankPrompt(query, items);

      const model = this.client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Parse JSON scores từ response
      const scores = this.parseScores(text, items.length);

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
      logger.info('Rerank completed', {
        inputCount: items.length,
        outputCount: filtered.length,
        durationMs: duration,
        topScore: filtered[0]?.rerankScore ?? 0,
      });

      return filtered;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Rerank failed, falling back to original scores', { error: message });
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
        return parsed.scores.map((s: unknown) => {
          const n = Number(s);
          if (Number.isNaN(n)) return 0;
          return Math.max(0, Math.min(1, n));
        });
      }
    } catch (err) {
      logger.warn('Failed to parse rerank scores', { text: text.slice(0, 200) });
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

export const rerankService = new RerankService();
