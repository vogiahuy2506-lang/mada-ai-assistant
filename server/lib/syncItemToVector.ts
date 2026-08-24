/**
 * Upsert a single knowledge_item to the vector store.
 *
 * Called immediately after syncProductToKnowledge() when a product is published.
 * Replaces the need to run sync-kb-to-vectors.ts batch script manually.
 *
 * Also used for re-indexing a single item after edits.
 */

import db from './db';
import { vectorStore } from './rag/vectorStore';
import { getEmbeddingProvider } from './rag/vectorStore';

export interface SyncVectorResult {
  success: boolean;
  indexed: boolean;
  error?: string;
}

/**
 * Upsert a single knowledge_item into the vector store by its ID.
 */
export async function syncItemToVector(knowledgeItemId: string): Promise<SyncVectorResult> {
  try {
    const item = db.prepare(`
      SELECT id, title, content, source, source_type, category, metadata, language, status
      FROM knowledge_items
      WHERE id = ?
    `).get(knowledgeItemId) as any;

    if (!item) {
      return { success: false, indexed: false, error: `Knowledge item not found: ${knowledgeItemId}` };
    }

    if (!item.content || item.content.length < 20) {
      return { success: false, indexed: false, error: 'Content too short to index' };
    }

    let meta: any = {};
    try {
      meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
    } catch { meta = {}; }

    const document = {
      id: item.id,
      content: `${item.title}\n\n${(item.content || '').slice(0, 3500)}`,
      metadata: {
        source: item.source || '',
        type: item.source_type || 'web',
        title: item.title || '',
        category: item.category || 'general',
        thumbnailUrl: meta.thumbnailUrl || '',
        galleryImages: meta.galleryImages || [],
        productUrl: meta.productUrl || '',
        imageUrl: meta.imageUrl || '',
        brand: meta.brand || '',
        product_url: meta.productUrl || '',
        ...meta,
      },
    };

    await vectorStore.addDocuments([document]);

    // Mark as indexed
    db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ? WHERE id = ?')
      .run(new Date().toISOString(), item.id);

    return { success: true, indexed: true };
  } catch (err: any) {
    console.error(`❌ [syncItemToVector] Failed for ${knowledgeItemId}:`, err.message);
    return { success: false, indexed: false, error: err.message };
  }
}

/**
 * Delete a single knowledge_item from the vector store.
 */
export async function deleteItemFromVector(knowledgeItemId: string): Promise<void> {
  try {
    await vectorStore.deleteDocument(knowledgeItemId);
    db.prepare('UPDATE knowledge_items SET indexed = 0, indexed_at = NULL WHERE id = ?')
      .run(knowledgeItemId);
    console.log(`🗑️ [vector] Deleted from store: ${knowledgeItemId}`);
  } catch (err: any) {
    console.error(`⚠️ [vector] Delete failed for ${knowledgeItemId}:`, err.message);
  }
}
