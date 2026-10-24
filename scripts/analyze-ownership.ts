/**
 * ⭐ PHÂN TÍCH CHUYÊN MÔN: in ra sản phẩm chủ sở hữu chính của từng bot,
 * gom theo "leaf" (chuyên môn gốc trên trang MADA) để rà soát thủ công.
 *
 * Usage: npx tsx scripts/analyze-ownership.ts
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const norm = (u: string | null | undefined) =>
  (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();

const taxonomy = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-taxonomy.json'), 'utf-8')
) as Record<string, string[]>;
const categories = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;
const owners = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-owners.json'), 'utf-8')
) as Record<string, string>;

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  "SELECT id, title, category, product_url, source_url FROM kb_products WHERE status='published'"
).all() as any[];
db.close();

const byUrl = new Map<string, any>();
for (const r of rows) {
  const k = norm(r.product_url || r.source_url);
  if (!byUrl.has(k)) byUrl.set(k, r);
}

const leafOf = new Map<string, string>();
for (const [url, arr] of Object.entries(taxonomy)) {
  if (!arr || arr.length < 7) continue;
  leafOf.set(norm(url), arr[3]);
}

const BOTS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility', 'bot-regulatory',
];

for (const bot of BOTS) {
  const mine = Object.entries(owners).filter(([, b]) => b === bot);
  const byLeaf = new Map<string, any[]>();
  for (const [url] of mine) {
    const k = norm(url);
    const row = byUrl.get(k);
    const leaf = leafOf.get(k) || '(no-leaf)';
    if (!byLeaf.has(leaf)) byLeaf.set(leaf, []);
    byLeaf.get(leaf)!.push({
      title: row?.title || url,
      dbCats: [...new Set((categories[url] || []))].join(','),
      dbCat: row?.category || '?',
    });
  }
  console.log('');
  console.log('═'.repeat(76));
  console.log(`${bot}  —  ${mine.length} sản phẩm chủ sở hữu chính`);
  console.log('═'.repeat(76));
  for (const [leaf, items] of [...byLeaf.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ▸ ${leaf}  (${items.length})`);
    for (const it of items) {
      console.log(`      ${it.title.padEnd(46)} db=${it.dbCat.padEnd(13)} mada=${it.dbCats}`);
    }
  }
}
