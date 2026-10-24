/**
 * ⭐ Tìm sản phẩm THỰC SỰ thuộc chuyên môn "di chuyển / đi lại /
 * tự lập" trong toàn bộ catalog (kể cả sản phẩm chưa nằm trong archive
 * daily_living).
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const archive = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  'SELECT title, category, brand, description, product_url FROM kb_products'
).all() as any[];
db.close();

const KEYWORDS = [
  'smart cane', 'walking cane', 'cane for', 'white cane', 'obstacle',
  'navigation', 'gps', 'wayfinding', 'route', 'direction',
  'wheelchair', 'scooter', 'rollator', 'walker', 'stair',
  'mobility', 'independent', 'independence', 'autonom',
  'travel', 'transport', 'outdoor', 'walking', 'ambulat',
  'out and about', 'daily activit', 'at home', 'in the home',
  'control the world', 'smart home', 'environment control',
  'household', 'appliance',
];

const seen = new Set<string>();
for (const r of rows) {
  const t = (r.title || '').toLowerCase();
  const d = (r.description || '').toLowerCase();
  const arch = (archive[r.product_url] || []).join(',');
  const hits = KEYWORDS.filter(
    (k) => t.includes(k) || d.includes(k)
  );
  if (!hits.length) continue;
  if (seen.has(r.title)) continue;
  seen.add(r.title);
  console.log(
    `▸ ${r.title.padEnd(38)} [${r.category.padEnd(16)}] arch=${arch.padEnd(30)} ${r.brand || ''}`
  );
  console.log(`   hits: ${hits.join(', ')}`);
  console.log(`   ${(r.description || '').replace(/\s+/g, ' ').slice(0, 200)}`);
  console.log();
}
