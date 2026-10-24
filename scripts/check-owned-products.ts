/**
 * ⭐ Kiểm tra: sản phẩm RIÊNG của từng bot có lọt vào danh sách card không?
 *
 * Vấn đề: `kb_products.category` chỉ lưu 1 category, nên truy vấn
 * `WHERE category = ?` của bot-mobility (`daily_living`) loại mất GEWA
 * Control Prog / Housemate / Power Link 4 / Primo+ (category = `mobility`).
 *
 * Usage: npx tsx scripts/check-owned-products.ts
 */

import Database from 'better-sqlite3';
import { primaryOwnerForProduct, botsForProduct } from '../server/lib/productTaxonomy';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'mada.db');
const db = new Database(dbPath, { readonly: true });

const rows = db
  .prepare(`SELECT id, title, category, product_url, source_url, image_url FROM kb_products`)
  .all() as any[];

const BOT_IDS = [
  'bot-hearing',
  'bot-vision',
  'bot-speech',
  'bot-cognitive',
  'bot-neuro',
  'bot-mobility',
];

for (const botId of BOT_IDS) {
  const owned = rows.filter((r) => primaryOwnerForProduct(r.product_url || r.source_url) === botId);
  const withImage = owned.filter((r) => r.image_url && r.image_url.length > 0);
  console.log('');
  console.log('═'.repeat(78));
  console.log(`${botId}  — chủ sở hữu chính: ${owned.length} sản phẩm (có ảnh: ${withImage.length})`);
  console.log('═'.repeat(78));
  for (const r of owned) {
    const bots = botsForProduct(r.product_url || r.source_url);
    const flags: string[] = [];
    if (!r.image_url) flags.push('KHÔNG ẢNH');
    if (!bots.includes(botId)) flags.push('TAXONOMY KHÔNG CÓ BOT NÀY');
    console.log(
      `  ${(r.title || '').padEnd(46)} cat=${String(r.category).padEnd(14)} ${
        flags.length ? '⚠️ ' + flags.join(', ') : '✓'
      }`
    );
  }
}

db.close();
