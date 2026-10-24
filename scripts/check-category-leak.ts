/**
 * ⭐ Kiểm tra RÒ RỈ CHUYÊN MÔN: sản phẩm của bot khác có lọt vào card
 * của bot này không, và nguyên nhân (DB category vs taxonomy).
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const archive = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;

function norm(u: string | null | undefined): string {
  return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  'SELECT title, category, product_url FROM kb_products'
).all() as any[];
db.close();

const CHECK = [
  'CoughDrop AAC',
  'Tobii Dynavox I-Series',
  'TD Pilot',
  'Dragon Professional',
  'Proloquo2Go',
  'Amazon Alexa',
  'Lazarillo',
  'Tobii PCEye 5',
  'Quha Zono 2',
  'eSight 4',
  'Quha Dwell',
  'WeWALK Smart Cane',
];

console.log('Sản phẩm'.padEnd(30), 'DB category'.padEnd(18), 'archive membership');
console.log('─'.repeat(100));
for (const t of CHECK) {
  const mine = rows.filter((r) => r.title === t);
  const cats = [...new Set(mine.map((r) => r.category))];
  const arch = new Set<string>();
  for (const r of mine) for (const c of archive[r.product_url] || []) arch.add(c);
  console.log(
    t.padEnd(30),
    cats.join(',').padEnd(18),
    [...arch].join(',')
  );
}

console.log('\n\n=== Row nào bị nhân bản? (1 sản phẩm > 2 category) ===');
const byTitle = new Map<string, string[]>();
for (const r of rows) {
  if (!byTitle.has(r.title)) byTitle.set(r.title, []);
  byTitle.get(r.title)!.push(r.category);
}
let multi = 0;
for (const [t, c] of byTitle) {
  if (c.length > 1) {
    multi++;
    if (multi <= 25) console.log(`  ${t.padEnd(38)} ${c.join(', ')}`);
  }
}
console.log(`\nTổng sản phẩm có >1 category row: ${multi}/${byTitle.size}`);
