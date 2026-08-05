// RAG Service Tests

import { describe, it, expect, beforeAll } from 'vitest';
import { RAGService } from '../../src/services/rag.service';
import { SEED_PRODUCTS } from '../../src/data/seed-products';

describe('RAGService', () => {
  let service: RAGService;

  beforeAll(async () => {
    service = new RAGService();
    await service.initialize();
  });

  it('should initialize with seed products', async () => {
    const stats = await service.getStats();
    expect(stats.total).toBe(SEED_PRODUCTS.length);
    expect(stats.total).toBeGreaterThan(10);
    expect(stats.byCategory.vision).toBeGreaterThan(0);
    expect(stats.byCategory.hearing).toBeGreaterThan(0);
    expect(stats.byCategory.mobility).toBeGreaterThan(0);
  });

  it('should return all 7 categories in seed data', async () => {
    const stats = await service.getStats();
    const expectedCategories = [
      'vision',
      'hearing',
      'mobility',
      'communication',
      'cognition',
      'daily_living',
      'education',
    ];
    for (const cat of expectedCategories) {
      expect(stats.byCategory[cat]).toBeGreaterThan(0);
    }
  });

  it('should find vision products for vision queries', async () => {
    const result = await service.search({
      query: 'thiết bị cho người mù đọc sách',
      maxResults: 3,
      useRerank: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    const topProduct = result.results[0];
    expect(topProduct.item.category).toBe('vision');
  });

  it('should find hearing products for hearing queries', async () => {
    const result = await service.search({
      query: 'máy trợ thính cho người cao tuổi',
      maxResults: 3,
      useRerank: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].item.category).toBe('hearing');
  });

  it('should find mobility products for wheelchair queries', async () => {
    const result = await service.search({
      query: 'xe lăn điện',
      maxResults: 3,
      useRerank: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].item.category).toBe('mobility');
  });

  it('should filter by category', async () => {
    const result = await service.search({
      query: 'thiết bị hỗ trợ',
      categories: ['communication'],
      maxResults: 5,
      useRerank: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    for (const r of result.results) {
      expect(r.item.category).toBe('communication');
    }
  });

  it('should detect Vietnamese language', async () => {
    const result = await service.search({
      query: 'Tôi cần xe lăn',
      maxResults: 1,
      useRerank: false,
    });
    expect(result.detectedLanguage).toBe('vi');
  });

  it('should detect English language', async () => {
    const result = await service.search({
      query: 'I need a wheelchair',
      maxResults: 1,
      useRerank: false,
    });
    expect(result.detectedLanguage).toBe('en');
  });

  it('should process query in under 1 second', async () => {
    const start = Date.now();
    await service.search({
      query: 'thiết bị cho người khiếm thị',
      maxResults: 5,
      useRerank: false,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('should get product by id', async () => {
    const product = await service.getProductById('prod_vis_001');
    expect(product).toBeDefined();
    expect(product?.id).toBe('prod_vis_001');
    expect(product?.name.vi).toContain('OrCam');
  });

  it('should get products by category', async () => {
    const visionProducts = await service.getProductsByCategory('vision');
    expect(visionProducts.length).toBeGreaterThan(0);
    for (const p of visionProducts) {
      expect(p.category).toBe('vision');
    }
  });
});
