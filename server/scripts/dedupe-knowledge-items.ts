/**
 * Dedupe knowledge_items - Xóa trùng lặp giữ nguyên record có indexed=1 hoặc created_at gần nhất
 *
 * Tình trạng: EduMic xuất hiện 13 lần, Oticon Amigo 13 lần... do scraper
 * chạy nhiều lần không check duplicate.
 *
 * Usage:
 *   npx tsx server/scripts/dedupe-knowledge-items.ts --dry-run  # Preview
 *   npx tsx server/scripts/dedupe-knowledge-items.ts            # Apply
 */

import db from '../lib/db';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

interface KBItem {
  id: string;
  title: string;
  source: string | null;
  indexed: number;
  created_at: string;
  category: string;
}

function main() {
  console.log('🧹 Dedupe knowledge_items');
  console.log('═'.repeat(60));

  if (!dryRun) {
    console.log('⚠️  Will DELETE duplicate rows (keeping 1 per unique title+source)');
  } else {
    console.log('🟡 DRY-RUN — no changes');
  }

  // Get all items with their counts
  const allItems = db.prepare(`
    SELECT id, title, source, indexed, created_at, category
    FROM knowledge_items WHERE source_type='web'
  `).all() as KBItem[];

  // Group by title + source
  const groups = new Map<string, KBItem[]>();
  for (const item of allItems) {
    const key = `${item.title.toLowerCase().trim()}|${(item.source || '').toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let totalToDelete = 0;
  const toDelete: string[] = [];

  for (const [key, items] of groups) {
    if (items.length <= 1) continue;

    // Sort: indexed=1 trước, rồi created_at mới nhất
    items.sort((a, b) => {
      if (a.indexed !== b.indexed) return b.indexed - a.indexed; // indexed=1 trước
      return b.created_at.localeCompare(a.created_at); // newer trước
    });

    // Giữ lại items[0], xóa rest
    const keepers = items.slice(0, 1).map(i => i.id);
    const droppers = items.slice(1).map(i => i.id);

    console.log(`📦 ${items[0].title.slice(0, 50)} (${items.length}x)`);
    console.log(`   ✅ Keep: ${keepers[0].slice(0, 8)}... (indexed=${items[0].indexed})`);
    console.log(`   ❌ Drop: ${droppers.length} duplicates`);

    toDelete.push(...droppers);
    totalToDelete += droppers.length;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Total duplicates to delete: ${totalToDelete}`);
  console.log(`📊 Unique items remaining: ${allItems.length - totalToDelete}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply');
    return;
  }

  if (toDelete.length === 0) {
    console.log('\n✅ Nothing to dedupe');
    return;
  }

  console.log('\n🗑️ Deleting...');

  // Delete vectors from in-memory store first (to keep doc count accurate)
  // We can't easily do this from here; vector store will have orphans until next re-sync
  const deleteStmt = db.prepare('DELETE FROM knowledge_items WHERE id = ?');
  const txn = db.transaction((ids: string[]) => {
    for (const id of ids) deleteStmt.run(id);
  });
  txn(toDelete);

  console.log(`✅ Deleted ${toDelete.length} duplicate rows`);
  console.log('\n💡 Run sync-kb-to-vectors.ts to clean up vector store');
}

main();