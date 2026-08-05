// Embedding Service - Text embedding generation

export class EmbeddingService {
  private dimensions: number;

  constructor(dimensions: number = 768) {
    this.dimensions = dimensions;
  }

  private simulateEmbedding(text: string): number[] {
    const embedding = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach((word, idx) => {
      for (let i = 0; i < Math.min(word.length, 10); i++) {
        const hash = (word.charCodeAt(i) * (idx + 1) * 31) % this.dimensions;
        embedding[hash] += 0.1;
      }
    });
    
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  async embedText(text: string): Promise<number[]> {
    return this.simulateEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.simulateEmbedding(text));
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.simulateEmbedding(query);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

export const embeddingService = new EmbeddingService();
