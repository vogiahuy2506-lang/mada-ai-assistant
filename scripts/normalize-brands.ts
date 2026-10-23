/**
 * Chuẩn hoá tên hãng trong kb_products sau khi backfill.
 *
 * ⚠️ VÌ SAO CẦN:
 * Trang MADA ghi "Manufacturer" không nhất quán → bot sẽ trả lời sai khi
 * người dùng hỏi "sản phẩm HumanWare nào?" mà DB lưu cả "HumanWare" lẫn
 * "Humanware". Cần gộp về một tên chuẩn để:
 *   1. Filter/slug hoạt động đúng (trước đây tách 2 nhóm)
 *   2. Vector store không tạo 2 cluster cho cùng 1 hãng
 *
 * ⚠️ KHÔNG đụng vào: "Nuance now" (Dragon Professional — tên sản phẩm bị MADA
 * ghi sai ở cột Manufacturer), "Skoogmusic Ltd. Defunct" (giữ nguyên vì là tên
 * pháp lý), "Prentke Romich Company PRC – Saltillo" (thương hiệu cha).
 *
 * Usage: npx tsx scripts/normalize-brands.ts [--dry-run]
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');

/** from (đúng như trong DB) → to (tên chuẩn) */
const ALIASES: Record<string, string> = {
  Humanware: 'HumanWare',
  HouseMate: 'Housemate',
  'Smartbox Assistive Technology': 'SmartBox',
  'Nessy Learning': 'Nessy',
  'Prentke Romich Company PRC – Saltillo': 'Saltillo',
};

const dryRun = process.argv.includes('--dry-run');
const db = new Database(DB_PATH, { readonly: dryRun });

console.log('🏷️  Chuẩn hoá tên hãng\n');

const entries = Object.entries(ALIASES);
const updateStmt = db.prepare(
  `UPDATE kb_products SET brand = ?, updated_at = ? WHERE brand = ?`
);

let changed = 0;
for (const [from, to] of entries) {
  const n = (db.prepare(`SELECT COUNT(*) c FROM kb_products WHERE brand = ?`).get(from) as { c: number }).c;
  if (n === 0) {
    console.log(`   ⏭  ${from} — không có trong DB`);
    continue;
  }
  console.log(`   → ${from} → ${to}  (${n} sản phẩm)`);
  changed += n;
  if (!dryRun) updateStmt.run(to, new Date().toISOString(), from);
}

const stats = db
  .prepare(
    `SELECT COUNT(*) total,
            COUNT(DISTINCT brand) distinct_brands,
            SUM(CASE WHEN length(COALESCE(brand,'')) > 0 THEN 1 ELSE 0 END) has_brand
     FROM kb_products WHERE status = 'published'`
  )
  .get() as { total: number; distinct_brands: number; has_brand: number };

console.log(`\n📈 Đã gộp ${changed} bản ghi${dryRun ? ' (DRY-RUN)' : ''}`);
console.log(`   ${stats.has_brand}/${stats.total} có brand, ${stats.distinct_brands} hãng khác nhau`);

db.close();