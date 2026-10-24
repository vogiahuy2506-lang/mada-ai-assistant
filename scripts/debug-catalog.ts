/**
 * ⭐ DEBUG catalog: kiểm tra `buildCatalogPromptBlock` cho từng bot —
 * sản phẩm nào thực sự lọt vào danh mục đưa cho model?
 *
 * Usage: npx tsx scripts/debug-catalog.ts
 */

import { buildProductCatalog, buildCatalogPromptBlock } from '../server/lib/productLinker';
import { MADA_CATEGORY_TO_DB, AGENT_TO_MADA } from '../server/lib/categoryMapping';
import { primaryOwnerForProduct } from '../server/lib/productTaxonomy';

const catalog = buildProductCatalog();
console.log('catalog size:', catalog.length);

// Với mỗi URL, đây là category của DÒNG DB đầu tiên (sau khi dedupe).
console.log('');
console.log('=== category của dòng DB được giữ lại sau dedupe ===');
const byCat: Record<string, number> = {};
for (const e of catalog) {
  const c = (e.category || '').toLowerCase();
  byCat[c] = (byCat[c] || 0) + 1;
}
console.log(byCat);

console.log('');
console.log('=== bot-mobility: catalog block thực tế ===');
const mob = AGENT_TO_MADA['bot-mobility'];
const mobDbCat = MADA_CATEGORY_TO_DB[mob.madaCategory];
console.log('madaCategory:', mob.madaCategory, '→ db category:', mobDbCat);

const mobEntries = catalog.filter(
  (e) => (e.category || '').toLowerCase() === (mobDbCat || '').toLowerCase()
);
console.log('entries có db category =', mobDbCat, ':', mobEntries.length);
for (const e of mobEntries.slice(0, 20)) {
  console.log('   ', e.title.padEnd(42), '| owner:', primaryOwnerForProduct(e.product_url || e.source_url));
}

console.log('');
console.log('=== block text cho bot-mobility (dòng đầu) ===');
const block = buildCatalogPromptBlock(mobDbCat, 'vi', 40, null, 'bot-mobility');
console.log(block.split('\n').slice(0, 20).join('\n'));
