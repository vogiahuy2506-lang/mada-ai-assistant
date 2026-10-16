/**
 * Count products in kb_products table
 * Run: npx tsx scripts/count-products.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'mada.db');

async function main() {
  const db = new Database(DB_PATH);
  
  // Total products
  const total = db.prepare('SELECT COUNT(*) as count FROM kb_products').get() as { count: number };
  
  // Products WITH images
  const withImages = db.prepare(`
    SELECT COUNT(*) as count FROM kb_products 
    WHERE image_url IS NOT NULL AND image_url != '' AND image_url != 'null'
  `).get() as { count: number };
  
  // Products WITHOUT images
  const withoutImages = db.prepare(`
    SELECT COUNT(*) as count FROM kb_products 
    WHERE image_url IS NULL OR image_url = '' OR image_url = 'null'
  `).get() as { count: number };
  
  // By category
  const byCategory = db.prepare(`
    SELECT 
      category,
      COUNT(*) as total,
      SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' AND image_url != 'null' THEN 1 ELSE 0 END) as with_image
    FROM kb_products
    GROUP BY category
    ORDER BY total DESC
  `).all() as { category: string; total: number; with_image: number }[];
  
  // Sample products without images
  const sampleNoImage = db.prepare(`
    SELECT title, category, image_url FROM kb_products 
    WHERE image_url IS NULL OR image_url = '' OR image_url = 'null'
    LIMIT 10
  `).all() as { title: string; category: string; image_url: string }[];
  
  console.log('\n📊 THỐNG KÊ SẢN PHẨM\n');
  console.log(`  Tổng sản phẩm: ${total.count}`);
  console.log(`  ✅ Có hình ảnh: ${withImages.count} (${Math.round(withImages.count / total.count * 100)}%)`);
  console.log(`  ❌ Không có hình ảnh: ${withoutImages.count} (${Math.round(withoutImages.count / total.count * 100)}%)`);
  
  console.log('\n📁 Theo Category:\n');
  for (const row of byCategory) {
    const pct = Math.round(row.with_image / row.total * 100);
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    console.log(`  ${row.category.padEnd(30)} ${row.total.toString().padStart(3)} sp | ${bar} ${pct}%`);
  }
  
  if (sampleNoImage.length > 0) {
    console.log('\n🔍 MẪU sản phẩm KHÔNG có ảnh:\n');
    for (const p of sampleNoImage) {
      console.log(`  - ${p.title}`);
      console.log(`    category: ${p.category} | image: "${p.image_url || '(null)'}"`);
    }
  }
  
  db.close();
  console.log('\n');
}

main().catch(console.error);
