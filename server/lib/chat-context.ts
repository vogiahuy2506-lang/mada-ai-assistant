/**
 * Shared chat context module
 * Contains shared state and functions used by chat routes
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db';

// Use global to avoid circular dependency with index.ts
declare global {
  var __ragInitialized: boolean | undefined;
}

// ============== PERSISTENT CHAT HISTORY ==============
// Lịch sử nằm trong RAM để truy cập nhanh, đồng thời được ghi vào SQLite (bảng chat_messages)
// để không mất khi server restart. Các nơi gọi vẫn dùng chatHistory.has/get/set/push như cũ.

// Bảng riêng (chat_messages đã được tính năng lịch sử khác dùng với schema khác, không đụng vào)
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_context_messages (
    conversation_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, idx)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_context_created ON chat_context_messages(created_at);
`);

const MAX_PERSISTED_MESSAGES = 40;
const RETENTION_DAYS = 30;

try {
  db.prepare(`DELETE FROM chat_context_messages WHERE created_at < datetime('now', ?)`).run(`-${RETENTION_DAYS} days`);
} catch (e) {
  console.warn('[chat-context] Cleanup of old chat context messages failed:', (e as Error).message);
}

const selectMessages = db.prepare('SELECT role, content FROM chat_context_messages WHERE conversation_id = ? ORDER BY idx ASC');
const deleteMessages = db.prepare('DELETE FROM chat_context_messages WHERE conversation_id = ?');
const insertMessage = db.prepare('INSERT INTO chat_context_messages (conversation_id, idx, role, content) VALUES (?, ?, ?, ?)');

const persistConversation = db.transaction((conversationId: string, messages: any[]) => {
  deleteMessages.run(conversationId);
  messages.slice(-MAX_PERSISTED_MESSAGES).forEach((m, i) => {
    if (m && typeof m.content === 'string' && m.content.length > 0) {
      insertMessage.run(conversationId, i, String(m.role || 'user'), m.content);
    }
  });
});

/** Mảng tin nhắn tự lưu vào SQLite mỗi khi có thay đổi qua push/splice */
class PersistedMessages extends Array<any> {
  static get [Symbol.species]() { return Array; }
  conversationId = '';

  private save() {
    if (!this.conversationId) return;
    try {
      persistConversation(this.conversationId, Array.from(this));
    } catch (e) {
      console.warn('[chat-context] Failed to persist chat history:', (e as Error).message);
    }
  }

  push(...items: any[]): number {
    const result = super.push(...items);
    this.save();
    return result;
  }

  splice(start: number, deleteCount?: number, ...items: any[]): any[] {
    const removed = deleteCount === undefined
      ? super.splice(start)
      : super.splice(start, deleteCount, ...items);
    this.save();
    return removed;
  }
}

function wrapMessages(conversationId: string, messages: any[]): PersistedMessages {
  const wrapped = new PersistedMessages();
  wrapped.conversationId = conversationId;
  // Dùng Array.prototype.push để nạp dữ liệu mà không kích hoạt lưu lại
  Array.prototype.push.apply(wrapped, messages);
  return wrapped;
}

class PersistentChatHistory extends Map<string, any[]> {
  private hydrate(conversationId: string): boolean {
    try {
      const rows = selectMessages.all(conversationId) as Array<{ role: string; content: string }>;
      if (rows.length === 0) return false;
      super.set(conversationId, wrapMessages(conversationId, rows));
      return true;
    } catch (e) {
      console.warn('[chat-context] Failed to load chat history:', (e as Error).message);
      return false;
    }
  }

  has(conversationId: string): boolean {
    return super.has(conversationId) || this.hydrate(conversationId);
  }

  get(conversationId: string): any[] | undefined {
    if (!super.has(conversationId)) this.hydrate(conversationId);
    return super.get(conversationId);
  }

  set(conversationId: string, messages: any[]): this {
    return super.set(conversationId, wrapMessages(conversationId, messages));
  }
}

// In-memory cache + SQLite persistence for chat conversations
export const chatHistory: Map<string, any[]> = new PersistentChatHistory();

// Initialize global if not set
if (global.__ragInitialized === undefined) {
  global.__ragInitialized = false;
}

/**
 * Set RAG initialized state (called by index.ts)
 */
export function setRagInitialized(value: boolean) {
  global.__ragInitialized = value;
}

/**
 * Get RAG initialized state
 */
export function isRagInitialized(): boolean {
  return global.__ragInitialized || false;
}

/**
 * Wait for RAG engine to be ready (wait for initialization if server just started)
 */
export async function waitForRagReady(timeoutMs: number = 15000): Promise<boolean> {
  const startTime = Date.now();
  while (!global.__ragInitialized) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn('⚠️ RAG engine not ready after', timeoutMs, 'ms');
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return true;
}

/**
 * Generate new conversation ID
 */
export function generateConversationId(): string {
  return uuidv4();
}
