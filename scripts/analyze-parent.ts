/**
 * ⭐ Phân bố theo home-PARENT (cấp cha trong breadcrumb MADA).
 * "Activities and Participation" = sống độc lập / di chuyển hằng ngày.
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
  return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

const parentOf = new Map<string, string>();
const leafOf = new Map<string, string>();
for (const [url, arr] of Object.entries(taxonomy)) {
  if (!arr || arr.length < 7) continue;
  parentOf.set(norm(url), arr[0]);
  leafOf.set(norm(url), arr[3]);
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
      url: r.product_url,
      brand: r.brand || '',
      desc: (r.description || '').replace(/\s+/g, ' ').trim(),
      arch: new Set<string>(),
      parent: '',
      leaf: '',
    });
  }
  const e = byTitle.get(r.title)!;
  for (const c of archive[r.product_url] || []) e.arch.add(c);
  const n = norm(r.product_url);
  if (parentOf.has(n)) {
    e.parent = parentOf.get(n)!;
    e.leaf = leafOf.get(n)!;
  }
}

const byParent: Record<string, any[]> = {};
for (const e of byTitle.values()) (byParent[e.parent || '(không rõ)'] ||= []).push(e);

for (const [p, list] of Object.entries(byParent).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${'═'.repeat(78)}\nPARENT: ${p}  (${list.length} sản phẩm)\n${'═'.repeat(78)}`);
  const byLeaf: Record<string, number> = {};
  for (const e of list) byLeaf[e.leaf || '?'] = (byLeaf[e.leaf || '?'] || 0) + 1;
  console.log('  leaf:', byLeaf);
  if (p === 'Activities and Participation') {
    for (const e of list) {
      console.log(`   • ${e.title.padEnd(38)} leaf=${(e.leaf || '?').padEnd(30)} arch=${[...e.arch].join(',')}`);
      console.log(`     ${e.desc.slice(0, 140)}`);
    }
  }
}
