// Session Service Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from '../../src/services/session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  it('should create a new session with UUID', async () => {
    const session = await service.createSession('user_1', {
      language: 'vi',
      deviceType: 'desktop',
      userAgent: 'test',
    });

    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.userId).toBe('user_1');
    expect(session.messages).toEqual([]);
    expect(session.metadata.language).toBe('vi');
  });

  it('should retrieve an existing session', async () => {
    const created = await service.createSession('user_2', {
      language: 'en',
      deviceType: 'mobile',
      userAgent: 'jest',
    });

    const retrieved = await service.getSession(created.id);
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.userId).toBe('user_2');
  });

  it('should return null for non-existent session', async () => {
    const result = await service.getSession('nonexistent-id');
    expect(result).toBeNull();
  });

  it('should delete session', async () => {
    const created = await service.createSession('user_3', {
      language: 'vi',
      deviceType: 'desktop',
      userAgent: 'test',
    });

    const deleted = await service.deleteSession(created.id);
    expect(deleted).toBe(true);

    const retrieved = await service.getSession(created.id);
    expect(retrieved).toBeNull();
  });

  it('should add messages to session', async () => {
    const session = await service.createSession('user_4', {
      language: 'vi',
      deviceType: 'desktop',
      userAgent: 'test',
    });

    await service.addMessage(session.id, 'user', 'Tôi cần xe lăn');
    await service.addMessage(session.id, 'assistant', 'Tôi có thể giúp bạn');

    const messages = await service.getMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  it('should detect category from history', async () => {
    const session = await service.createSession('user_5', {
      language: 'vi',
      deviceType: 'desktop',
      userAgent: 'test',
    });

    await service.addMessage(session.id, 'user', 'Tôi bị khiếm thị cần đọc sách');
    await service.addMessage(session.id, 'user', 'Có thiết bị nào không?');

    const categories = await service.detectCategoryFromHistory(session.id);
    expect(categories).toContain('vision');
  });

  it('should get session stats', async () => {
    await service.createSession('user_a', { language: 'vi', deviceType: 'desktop', userAgent: 'test' });
    await service.createSession('user_b', { language: 'en', deviceType: 'mobile', userAgent: 'test' });

    const stats = await service.getSessionStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.avgMessages).toBeGreaterThanOrEqual(0);
  });
});
