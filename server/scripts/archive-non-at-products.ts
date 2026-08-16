/**
 * Archive non-AT products (laptop, máy giặt, etc.) trong kb_products
 *
 * Tình trạng: bảng kb_products có 6 sản phẩm rác (laptop TGDĐ, máy giặt Casper)
 * được import vào trước đó qua URL scraper, không liên quan AT.
 * → Archive (không xóa) để không hiển thị trong frontend nhưng vẫn audit được.
 *
 * Logic: giữ lại products có category chứa 'vision/hearing/mobility/communication/
 * cognitive/education/daily_living/AT/assistive'.
 *
 * Usage:
 *   npx tsx server/scripts/archive-non-at-products.ts --dry-run
 *   npx tsx server/scripts/archive-non-at-products.ts
 */

import db from '../lib/db';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Categories KHÔNG phải AT cần archive
const NON_AT_KEYWORDS = ['laptop', 'máy tính', 'máy giặt', 'washing', 'tủ lạnh', 'refrigerator'];

interface Product {
  id: string;
  title: string;
  category: string;
  status: string;
  image_url: string;
}

function main() {
  console.log('🧹 Archive non-AT products in kb_products');
  console.log('═'.repeat(60));

  const products = db.prepare(`
    SELECT id, title, category, status, image_url
    FROM kb_products
  `).all() as Product[];

  console.log(`📦 Total products: ${products.length}`);

  const toArchive: Product[] = [];
  const toKeep: Product[] = [];

  for (const p of products) {
    const isNonAT = NON_AT_KEYWORDS.some(kw =>
      p.title.toLowerCase().includes(kw) || p.category.toLowerCase().includes(kw)
    );

    if (isNonAT) {
      toArchive.push(p);
    } else {
      toKeep.push(p);
    }
  }

  console.log(`✅ Keep:    ${toKeep.length}`);
  console.log(`📦 Archive: ${toArchive.length}`);

  if (toArchive.length > 0) {
    console.log('\n📦 To archive:');
    for (const p of toArchive) {
      console.log(`  - ${p.title.slice(0, 60)}`);
      console.log(`    category: ${p.category}, image: ${p.image_url.slice(0, 60)}...`);
    }
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply');
    return;
  }

  if (toArchive.length === 0) {
    console.log('\n✅ Nothing to archive');
    return;
  }

  const stmt = db.prepare(`UPDATE kb_products SET status = 'archived', updated_at = ? WHERE id = ?`);
  const now = new Date().toISOString();
  for (const p of toArchive) {
    stmt.run(now, p.id);
  }

  console.log(`\n✅ Archived ${toArchive.length} non-AT products`);
}

main();