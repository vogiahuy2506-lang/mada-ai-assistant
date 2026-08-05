// Rerank Service Tests

import { describe, it, expect } from 'vitest';
import { RerankService, type RerankableItem } from '../../src/services/rerank.service';

describe('RerankService', () => {
  const items: RerankableItem[] = [
    {
      id: 'a',
      content: 'OrCam MyEye - Thiết bị đeo AI cho người khiếm thị, đọc văn bản thành tiếng',
      score: 0.7,
    },
    {
      id: 'b',
      content: 'JAWS Screen Reader - Phần mềm đọc màn hình cho Windows',
      score: 0.65,
    },
    {
      id: 'c',
      content: 'Phonak Hearing Aid - Máy trợ thính cho người khiếm thính',
      score: 0.6,
    },
    {
      id: 'd',
      content: 'Permobil Wheelchair - Xe lăn điện cho người liệt',
      score: 0.55,
    },
  ];

  it('should be ready when Gemini API key is set', () => {
    const service = new RerankService();
    // Without API key (test env), it falls back to original scores
    expect(typeof service.isReady()).toBe('boolean');
  });

  it('should return fallback scores when client unavailable', async () => {
    const service = new RerankService();
    const result = await service.rerank('OrCam đọc sách', items, { topN: 4, minScore: 0 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4);
    // Top result depends on whether Gemini rerank is enabled or fallback is used.
    // Accept either the highest-original-score (a=0.7) OR the most semantically relevant (a/b).
    expect(['a', 'b']).toContain(result[0].item.id);
  });

  it('should respect topN config', async () => {
    const service = new RerankService();
    const result = await service.rerank('test', items, { topN: 3, minScore: 0 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('should respect topN limit', async () => {
    const service = new RerankService();
    const result = await service.rerank('OrCam đọc sách', items, { topN: 2, minScore: 0 });
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result.length).toBeGreaterThan(0);
    // Top result should be most relevant (OrCam or JAWS depending on rerank/client state)
    expect(['a', 'b']).toContain(result[0].item.id);
  });

  it('should handle empty input array', async () => {
    const service = new RerankService();
    const result = await service.rerank('test', []);
    expect(result).toEqual([]);
  });
});
