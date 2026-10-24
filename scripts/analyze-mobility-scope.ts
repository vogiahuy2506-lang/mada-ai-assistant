/**
 * ⭐ Bot 6 (Mobility) — xác định sản phẩm nào THỰC SỰ thuộc chuyên môn
 * "di chuyển / đi lại / tự lập trong nhà" và sản phẩm nào chỉ được MADA
 * liệt kê chéo (cross-listing) trong archive Mobility & Transportation.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const archive = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;
const taxonomy = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-taxonomy.json'), 'utf-8')
) as Record<string, string[]>;

function norm(u: string | null | undefined): string {
  return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

const leafOf = new Map<string, string>();
const parentOf = new Map<string, string>();
for (const [url, arr] of Object.entries(taxonomy)) {
  if (!arr || arr.length < 7) continue;
  leafOf.set(norm(url), arr[3]);
  parentOf.set(norm(url), arr[0]);
}

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  'SELECT title, category, brand, description, product_url FROM kb_products'
).all() as any[];
db.close();

const byTitle = new Map<string, any>();
for (const r of rows) {
  if (!byTitle.has(r.title)) {
    byTitle.set(r.title, {
      title: r.title,
      brand: r.brand || '',
      desc: (r.description || '').replace(/\s+/g, ' ').trim(),
      url: r.product_url,
      dbCats: new Set<string>(),
      arch: new Set<string>(),
      leaf: '',
      parent: '',
    });
  }
  const e = byTitle.get(r.title)!;
  e.dbCats.add(r.category);
  for (const c of archive[r.product_url] || []) e.arch.add(c);
  const n = norm(r.product_url);
  if (leafOf.has(n)) {
    e.leaf = leafOf.get(n)!;
    e.parent = parentOf.get(n)!;
  }
}

const dl = [...byTitle.values()].filter((e) => e.arch.has('daily_living'));

console.log('═'.repeat(100));
console.log('59 SẢN PHẨM TRONG ARCHIVE "MOBILITY & TRANSPORTATION" — phân loại');
console.log('═'.repeat(100));

const groups: Record<string, any[]> = {};
for (const e of dl) {
  const alsoMobility = e.arch.has('mobility');
  const key = alsoMobility ? 'CÓ trong archive mobility' : 'KHÔNG có trong archive mobility';
  (groups[key] ||= []).push(e);
}
for (const [k, list] of Object.entries(groups)) {
  console.log(`\n--- ${k}: ${list.length} sản phẩm ---`);
  for (const e of list) {
    console.log(
      `   ${e.title.padEnd(40)} leaf=${(e.leaf || '?').padEnd(34)} db=${[...e.dbCats].join(',')}`
    );
  }
}

console.log('\n' + '═'.repeat(100));
console.log('MÔ TẢ sản phẩm ứng viên "di chuyển / môi trường" (không nằm trong archive mobility)');
console.log('═'.repeat(100));
for (const e of groups['KHÔNG có trong archive mobility'] || []) {
  console.log(`\n▸ ${e.title}  [leaf=${e.leaf}]  brand=${e.brand}`);
  console.log(`   ${e.desc.slice(0, 260)}`);
}

console.log('\n' + '═'.repeat(100));
console.log('TẤT CẢ SẢN PHẨM có home-leaf = Environmental Control / 1-2-Switch');
console.log('═'.repeat(100));
for (const e of byTitle.values()) {
  if (e.leaf === 'Environmental Control' || e.leaf === '1-2-Switch') {
    console.log(`   ${e.title.padEnd(40)} leaf=${e.leaf.padEnd(24)} arch=${[...e.arch].join(',')}`);
  }
}

console.log('\n' + '═'.repeat(100));
console.log('SẢN PHẨM CHỈ THUỘC daily_living (độc quyền theo archive)');
console.log('═'.repeat(100));
for (const e of byTitle.values()) {
  if (e.arch.size === 1 && e.arch.has('daily_living')) {
    console.log(`   ${e.title}`);
  }
}
