/**
 * Sync TẤT CẢ knowledge_items từ SQLite → vector store
 *
 * Sửa lỗi: vector store chỉ có 201 docs, DB có 358 items.
 * Lý do: status filter chỉ lấy 'published' nhưng data hiện tại toàn 'draft'.
 *
 * Usage:
 *   npx tsx server/scripts/sync-kb-to-vectors.ts
 *   npx tsx server/scripts/sync-kb-to-vectors.ts --clear     # Clear vector store trước
 */

import 'dotenv/config';
import db from '../lib/db';
import { vectorStore } from '../lib/rag/vectorStore';

const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');

async function main() {
  console.log('🔄 Sync Knowledge Base → Vector Store');
  console.log('═'.repeat(60));

  await vectorStore.initialize();

  if (shouldClear) {
    console.log('⚠️  Clearing vector store...');
    await vectorStore.clear();
    console.log('✅ Cleared\n');
  }

  // Get all items regardless of status
  const items = db.prepare(`
    SELECT id, title, content, source, source_type, category, metadata, language, status
    FROM knowledge_items
    WHERE content IS NOT NULL AND length(content) > 20
    ORDER BY indexed ASC, created_at DESC
    LIMIT 500
  `).all() as any[];

  console.log(`📦 Found ${items.length} items in SQLite\n`);

  if (items.length === 0) {
    console.log('✅ Nothing to sync');
    return;
  }

  // Convert to Document format
  const documents = items.map((item) => {
    let meta: any = {};
    try {
      meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
    } catch { meta = {}; }

    return {
      id: item.id,
      content: `${item.title}\n\n${(item.content || '').slice(0, 3500)}`,
      metadata: {
        source: item.source || '',
        type: item.source_type || 'web',
        title: item.title || '',
        category: item.category || 'general',
        // ⭐ Copy thumbnailUrl từ DB metadata → vector store → frontend
        thumbnailUrl: meta.thumbnailUrl || '',
        ...meta,
      },
    };
  });

  // Bulk add in chunks
  const CHUNK_SIZE = 25;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
    const chunk = documents.slice(i, i + CHUNK_SIZE);
    try {
      await vectorStore.addDocuments(chunk);
      synced += chunk.length;
      console.log(`   ${synced}/${documents.length} synced...`);
    } catch (err) {
      console.warn(`   ⚠️ Chunk ${i + 1}-${i + CHUNK_SIZE} failed: ${(err as Error).message}`);
      failed += chunk.length;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  // Mark as indexed
  const stmt = db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  for (const item of items) {
    stmt.run(now, item.id);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Synced: ${synced}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log('═'.repeat(60));
  console.log('\n💡 Restart server to use updated vector store');
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});