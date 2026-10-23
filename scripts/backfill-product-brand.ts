/**
 * Backfill `brand` + `model` cho kb_products từ trang chi tiết MADA.
 *
 * ⚠️ VÌ SAO CẦN:
 * 349/349 sản phẩm có `brand = ''`, `model = ''` → bot không trả lời được
 * "của hãng nào", "so sánh giữa hãng nào" dù nội dung mô tả có đủ thông tin.
 *
 * ⚠️ CÁI KHÔNG LÀM ĐƯỢC (đã kiểm chứng trên 24 sản phẩm mẫu):
 *   - `price_range`: MADA KHÔNG công bố giá trên trang sản phẩm (0/24)
 *   - `iso_codes`:   ISO chỉ gắn ở mô tả CATEGORY, không gắn từng sản phẩm (0/24)
 *   - tồn kho:      nằm trong HTML comment → MADA đã ẩn
 * → Bot phải trả lời "liên hệ MADA Center để biết giá", KHÔNG được bịa giá.
 *
 * Nguồn duy nhất: dòng "Manufacturer: X" trong .entry-content.
 *   18/24 sản phẩm (75%) có dòng này.
 *
 * Usage:
 *   npx tsx scripts/backfill-product-brand.ts
 *   npx tsx scripts/backfill-product-brand.ts --limit 20   # test trước
 *   npx tsx scripts/backfill-product-brand.ts --dry-run    # chỉ xem, không ghi DB
 *   npx tsx scripts/backfill-product-brand.ts --force     # scrape lại cả sản phẩm đã có brand
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'mada.db.bak-backfill-brand');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/** Parser dùng chung — xem _brand-parse-lib.ts để biết các biến thể HTML MADA. */
import { parseManufacturer } from './_brand-parse-lib';

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  console.log('🏷️  Backfill brand + model từ trang MADA\n');
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Không tìm thấy DB: ${DB_PATH}`);
    process.exit(1);
  }

  if (!dryRun && !fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log(`💾 Đã backup DB → ${path.basename(BACKUP_PATH)}\n`);
  }

  const db = new Database(DB_PATH, { readonly: dryRun });

  let rows = db
    .prepare(
      `SELECT id, title, brand, model, product_url, source_url
       FROM kb_products
       WHERE status = 'published' AND (product_url LIKE 'http%' OR source_url LIKE 'http%')
       ORDER BY category, title`
    )
    .all() as Array<{
    id: string;
    title: string;
    brand: string;
    model: string;
    product_url: string;
    source_url: string;
  }>;

  rows = force ? rows : rows.filter((r) => !r.brand);
  if (rows.length > limit) rows = rows.slice(0, limit);

  console.log(`📦 Cần scrape: ${rows.length}/${force ? rows.length : 'thiếu brand'}\n`);
  if (dryRun) console.log('🔍 DRY-RUN — không ghi vào DB\n');

  const updateStmt = db.prepare(
    `UPDATE kb_products
     SET brand = COALESCE(NULLIF(?, ''), brand),
         model = COALESCE(NULLIF(?, ''), model),
         updated_at = ?
     WHERE id = ?`
  );

  let ok = 0;
  let fail = 0;
  const noBrand: string[] = [];
  const byBrand = new Map<string, number>();

  for (const row of rows) {
    const url = row.product_url || row.source_url;
    process.stdout.write(`   → ${row.title.slice(0, 42).padEnd(44)} `);

    let parsed: { brand?: string; model?: string } = {};
    try {
      // Timeout 20s: MADA đôi lúc treo kết nối, không có timeout sẽ kẹt cả script.
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.log(`❌ HTTP ${res.status}`);
        fail++;
        noBrand.push(row.title);
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      parsed = parseManufacturer(await res.text());
    } catch (err) {
      console.log(`⚠️  ${(err as Error).message}`);
      fail++;
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    if (!parsed.brand) {
      console.log('— không có Manufacturer');
      noBrand.push(row.title);
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }

    ok++;
    byBrand.set(parsed.brand, (byBrand.get(parsed.brand) ?? 0) + 1);
    console.log(`✅ ${parsed.brand}${parsed.model ? ` / ${parsed.model}` : ''}`);

    if (!dryRun) {
      updateStmt.run(parsed.brand ?? '', parsed.model ?? '', new Date().toISOString(), row.id);
    }

    // Rate-limit nhẹ, tránh bị chặn
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n📊 Kết quả`);
  console.log(`   ✅ Có brand : ${ok}`);
  console.log(`   ➖ Không có  : ${noBrand.length} (trang không ghi Manufacturer)`);
  console.log(`   ❌ Lỗi tải   : ${fail}`);
  if (noBrand.length > 0) {
    console.log(`\n   Không có Manufacturer (${noBrand.length}):`);
    for (const t of noBrand.slice(0, 12)) console.log(`     - ${t}`);
    if (noBrand.length > 12) console.log(`     … và ${noBrand.length - 12} sản phẩm khác`);
  }

  if (!dryRun) {
    const stats = db
      .prepare(
        `SELECT COUNT(*) total,
                SUM(CASE WHEN length(COALESCE(brand,'')) > 0 THEN 1 ELSE 0 END) has_brand,
                SUM(CASE WHEN length(COALESCE(model,'')) > 0 THEN 1 ELSE 0 END) has_model
         FROM kb_products WHERE status = 'published'`
      )
      .get() as { total: number; has_brand: number; has_model: number };

    console.log(`\n📈 kb_products: ${stats.has_brand}/${stats.total} có brand, ${stats.has_model} có model`);
  }

  console.log(`\n🏆 Top hãng:`);
  for (const [brand, n] of [...byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`   ${String(n).padStart(4)}  ${brand}`);
  }

  if (!dryRun) {
    console.log('\n🎉 Xong! Bước tiếp theo: chạy reindex-products.ts để đưa brand vào vector store.');
  }

  db.close();
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});