/**
 * Shared chat context module
 * Contains shared state and functions used by chat routes
 */

import { v4 as uuidv4 } from 'uuid';

// Use global to avoid circular dependency with index.ts
declare global {
  var __ragInitialized: boolean | undefined;
}

// In-memory storage for chat conversations
export const chatHistory: Map<string, any[]> = new Map();

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
