/**
 * ⭐ Sinh danh sách tên sản phẩm THẬT theo từng bot (từ bảng chủ sở hữu).
 *
 * Dùng để thay thế các tên SẢN PHẨM BỊA trong prompt (Scewo Bro, Quickie,
 * Medelert, Time Timer, Bellman…) bằng tên có thật trong catalog MADA.
 *
 * Usage: npx tsx scripts/list-owned-by-bot.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { primaryOwnerForProduct } from '../server/lib/productTaxonomy';

const db = new Database(path.join(process.cwd(), 'data', 'mada.db'), { readonly: true });
const rows = db.prepare('SELECT title, product_url, source_url, category FROM kb_products').all() as any[];
db.close();

const byBot: Record<string, string[]> = {};
for (const r of rows) {
  const bot = primaryOwnerForProduct(r.product_url || r.source_url);
  if (!bot) continue;
  const t = (r.title || '').trim();
  if (!t) continue;
  byBot[bot] = byBot[bot] || [];
  if (!byBot[bot].includes(t)) byBot[bot].push(t);
}

const ORDER = [
  'bot-hearing',
  'bot-vision',
  'bot-speech',
  'bot-cognitive',
  'bot-neuro',
  'bot-mobility',
];

for (const b of ORDER) {
  console.log('');
  console.log('═'.repeat(70));
  console.log(`${b} (${byBot[b]?.length || 0})`);
  console.log('═'.repeat(70));
  console.log((byBot[b] || []).join('\n'));
}
