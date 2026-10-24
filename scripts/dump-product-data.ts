/**
 * ⭐ Dump dữ liệu để quyết định "sản phẩm RIÊNG" của từng bot.
 *
 * Cho mỗi sản phẩm trong kb_products:
 *   - home leaf (breadcrumb MADA)
 *   - archive membership (site MADA)
 *   - category trong DB
 *   - brand + mô tả (để phân biệt thiết bị "di chuyển" vs "nhập liệu thay thế")
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();

const taxonomy = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-taxonomy.json'), 'utf-8')
) as Record<string, string[]>;
const archive = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;

function norm(u: string | null | undefined): string {
  return (u || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/, '')
    .toLowerCase();
}

const homeLeaf = new Map<string, string>();
const homeParent = new Map<string, string>();
for (const [url, arr] of Object.entries(taxonomy)) {
  if (!arr || arr.length < 7) continue;
  homeLeaf.set(norm(url), arr[3]);
  homeParent.set(norm(url), arr[0]);
}

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  'SELECT title, category, brand, description, product_url, source_url FROM kb_products'
).all() as any[];
db.close();

// Gộp theo title (nhiều dòng / nhiều category cho 1 sản phẩm)
const byTitle = new Map<string, any>();
for (const r of rows) {
  const key = r.title;
  if (!byTitle.has(key)) {
    byTitle.set(key, {
      title: key,
      brand: r.brand || '',
      description: (r.description || '').replace(/\s+/g, ' ').trim(),
      url: r.product_url || r.source_url,
      dbCategories: new Set<string>(),
      archives: new Set<string>(),
      leaf: '',
      parent: '',
    });
  }
  const e = byTitle.get(key)!;
  e.dbCategories.add(r.category);
  const n = norm(r.product_url || r.source_url);
  for (const c of archive[r.product_url] || archive[r.source_url] || []) e.archives.add(c);
  const l = homeLeaf.get(n);
  if (l) {
    e.leaf = l;
    e.parent = homeParent.get(n) || '';
  }
}

const out = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
fs.writeFileSync(
  path.join(ROOT, '.tmp_crops', 'product-dump.json'),
  JSON.stringify(out, null, 2)
);

console.log(`Tổng sản phẩm unique: ${out.length}`);
console.log('\n=== SẢN PHẨM CÓ "daily_living" TRONG ARCHIVE (danh mục MADA của Bot 6) ===\n');
for (const e of out.filter((x) => x.archives.has('daily_living'))) {
  console.log(
    `▸ ${e.title}  [${[...e.dbCategories].join(',')}]  leaf=${e.leaf || '?'}`
  );
  console.log(
    `   archives: ${[...e.archives].join(',')}   brand: ${e.brand || '-'}`
  );
  console.log(`   ${e.description.slice(0, 150) || '(không mô tả)'}`);
}

console.log('\n\n=== SẢN PHẨM CÓ "voice-and-speech" TRONG ARCHIVE (Bot 3) ===\n');
for (const e of out.filter((x) => x.archives.has('voice-and-speech'))) {
  console.log(
    `▸ ${e.title}  [${[...e.dbCategories].join(',')}]  leaf=${e.leaf || '?'}  archives: ${[...e.archives].join(',')}`
  );
}

console.log('\n\n=== SẢN PHẨM CÓ "hearing" TRONG ARCHIVE (Bot 1) ===\n');
for (const e of out.filter((x) => x.archives.has('hearing'))) {
  console.log(
    `▸ ${e.title}  leaf=${e.leaf || '?'}  archives: ${[...e.archives].join(',')}`
  );
}

console.log('\n\n=== SẢN PHẨM CHỈ THUỘC "mobility" (Bot 5 exclusive) — mẫu ===\n');
const onlyMobility = out.filter(
  (x) => x.archives.has('mobility') && x.archives.size === 1
);
console.log(`Tổng: ${onlyMobility.length}`);
