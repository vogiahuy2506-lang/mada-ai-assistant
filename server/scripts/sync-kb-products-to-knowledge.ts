/**
 * Sync tất cả kb_products (draft/published/archived) → knowledge_items
 * Dùng để:
 *   - Backfill các sản phẩm đã tồn tại nhưng chưa có trong knowledge_items
 *   - Sau đó chạy sync-kb-to-vectors để vector hóa
 *
 * Usage:
 *   npx tsx server/scripts/sync-kb-products-to-knowledge.ts
 *   npx tsx server/scripts/sync-kb-products-to-knowledge.ts --dry-run
 */

import db from '../lib/db';
import { syncAllPublishedProducts } from '../lib/syncKbProducts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('🔄 Sync kb_products → knowledge_items');
console.log('═'.repeat(60));

if (dryRun) {
  console.log('🟡 DRY-RUN mode — no changes');
} else {
  console.log('🟢 LIVE mode');
}

if (dryRun) {
  const products = db.prepare(`
    SELECT id, title, status FROM kb_products
  `).all() as any[];
  console.log(`\nWould process ${products.length} products:`);
  for (const p of products.slice(0, 10)) {
    console.log(`  - [${p.status}] ${p.title.slice(0, 50)}`);
  }
  if (products.length > 10) {
    console.log(`  ... and ${products.length - 10} more`);
  }
  console.log('\n💡 Run without --dry-run to apply');
  process.exit(0);
}

const result = syncAllPublishedProducts();

console.log('\n' + '═'.repeat(60));
console.log(`📊 Results:`);
console.log(`   Inserted: ${result.inserted}`);
console.log(`   Updated:  ${result.updated}`);
console.log(`   Archived: ${result.archived}`);
console.log(`   Errors:   ${result.errors.length}`);

if (result.errors.length > 0) {
  console.log('\n❌ Errors:');
  for (const e of result.errors.slice(0, 10)) {
    console.log(`  - ${e}`);
  }
}

console.log('\n💡 Next: Run sync-kb-to-vectors.ts to add to vector store');