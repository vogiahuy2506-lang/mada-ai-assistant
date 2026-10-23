/**
 * Chuẩn hoá `kb_products.category` theo membership THẬT của site MADA.
 *
 * ⚠️ VÌ SAO CẦN:
 * Một sản phẩm trên site MADA có thể thuộc NHIỀU category. Ví dụ:
 *   - `Dragon Professional` → vision, mobility, cognition, voice-and-speech
 *   - `Tobii Dynavox I-Series` → cognition, mobility, voice-and-speech
 * Nhưng DB chỉ giữ 1 category / sản phẩm (và 243 sản phẩm unique bị nhân bản
 * thành 319 dòng với category sai).
 *
 * Hệ quả: vector store gắn metadata.botId/madaCategory theo 1 category duy
 * nhất → bot (VD bot-vision) không retrieve được sản phẩm thực sự thuộc
 * category đó, hoặc bot-hearing bị mất sản phẩm vì sản phẩm đó nằm ở
 * category khác trên site.
 *
 * Script này:
 *   1. Đọc `data/mada-product-categories.json` (sinh bởi crawl-product-categories.ts)
 *   2. Với mỗi sản phẩm, đảm bảo có ĐÚNG 1 dòng cho MỖI category site gán
 *   3. Xoá các dòng có category không còn hợp lệ
 *
 * Usage:
 *   npx tsx scripts/normalize-product-categories.ts          # dry-run
 *   npx tsx scripts/normalize-product-categories.ts --apply   # áp dụng
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'mada.db');
const MAP_PATH = path.join(ROOT, 'data', 'mada-product-categories.json');

const APPLY = process.argv.includes('--apply');

/** Chuẩn hoá URL để so khớp (bỏ trailing slash, lowercase) */
function normUrl(u: string): string {
  return (u || '').replace(/\/+$/, '').toLowerCase();
}

/** Sinh id cho dòng mới: `mada_<slug>_<timestamp>` (giống hệt format hiện có) */
function makeId(title: string, category: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `mada_${slug}_${category.replace(/[^a-z0-9]+/g, '')}_${Date.now()}`;
}

function main() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(
      `❌ Thiếu ${path.basename(MAP_PATH)}. Chạy trước: npx tsx scripts/crawl-product-categories.ts`
    );
    process.exit(1);
  }

  const siteMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')) as Record<string, string[]>;
  const siteByUrl = new Map(
    Object.entries(siteMap).map(([k, v]) => [normUrl(k), v] as [string, string[]])
  );

  const db = new Database(DB_PATH);
  const rows = db
    .prepare(
      `SELECT id, title, category, product_url, source_url, content, description, brand,
              price_range, image_url, title_en, status, sort_order, featured, language,
              iso_codes, wcag_level, who_gate_area, created_by, created_at, updated_at
       FROM kb_products`
    )
    .all() as any[];

  // Gom dòng theo title
  const byTitle = new Map<string, any[]>();
  for (const r of rows) {
    if (!byTitle.has(r.title)) byTitle.set(r.title, []);
    byTitle.get(r.title)!.push(r);
  }

  const toDelete: any[] = [];
  const toInsert: any[] = [];

  for (const [title, list] of byTitle) {
    const url = list[0].product_url || list[0].source_url || '';
    const want = new Set(siteByUrl.get(normUrl(url)) || []);

    // Nhóm dòng hiện có theo category
    const byCat = new Map<string, any[]>();
    for (const r of list) {
      if (!byCat.has(r.category)) byCat.set(r.category, []);
      byCat.get(r.category)!.push(r);
    }

    // Xoá dòng có category không còn hợp lệ
    for (const [cat, catRows] of byCat) {
      if (!want.has(cat)) {
        toDelete.push(...catRows);
      } else {
        // Giữ 1 dòng, xoá các dòng trùng lặp cùng category
        const [keep, ...dups] = catRows;
        void keep;
        toDelete.push(...dups);
      }
    }

    // Thêm dòng cho category còn thiếu (clone từ 1 dòng bất kỳ của sản phẩm)
    for (const cat of want) {
      if (byCat.has(cat)) continue;
      const src = list[0];
      toInsert.push({
        ...src,
        id: makeId(title, cat),
        category: cat,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(
    `\n🔧 Chuẩn hoá category sản phẩm theo membership site MADA ${
      APPLY ? '(APPLY)' : '(DRY-RUN)'
    }\n`
  );
  console.log(`   Sản phẩm unique: ${byTitle.size}`);
  console.log(`   Dòng hiện tại:   ${rows.length}`);
  console.log(`   Xoá:             ${toDelete.length}`);
  console.log(`   Thêm:            ${toInsert.length}`);
  console.log(`   Kết quả:         ${rows.length - toDelete.length + toInsert.length}`);

  if (toDelete.length) {
    console.log(`\n🗑️  Xoá (category không còn trên site):`);
    toDelete.forEach((r) => console.log(`   - ${r.title} [${r.category}]`));
  }
  if (toInsert.length) {
    console.log(`\n➕ Thêm (category còn thiếu):`);
    toInsert.forEach((r) => console.log(`   + ${r.title} [${r.category}]`));
  }

  if (!APPLY) {
    console.log(`\n💡 Chạy với --apply để áp dụng.`);
    db.close();
    return;
  }

  // Backup trước khi ghi
  const backup = path.join(
    ROOT,
    'data',
    `mada.db.bak-pre-category-normalize-${Date.now()}`
  );
  db.prepare('VACUUM INTO ?').run(backup);
  console.log(`\n💾 Backup → ${path.basename(backup)}`);

  const delStmt = db.prepare(`DELETE FROM kb_products WHERE id = ?`);
  const insStmt = db.prepare(`
    INSERT INTO kb_products (
      id, title, title_en, title_ar, title_fr, description, description_en,
      description_ar, description_fr, content, category, brand, model, price_range,
      source_url, product_url, image_url, iso_codes, wcag_level, who_gate_area,
      status, featured, sort_order, language, created_by, created_at, updated_at
    ) VALUES (
      @id, @title, @title_en, @title_ar, @title_fr, @description, @description_en,
      @description_ar, @description_fr, @content, @category, @brand, @model, @price_range,
      @source_url, @product_url, @image_url, @iso_codes, @wcag_level, @who_gate_area,
      @status, @featured, @sort_order, @language, @created_by, @created_at, @updated_at
    )
  `);

  const applyAll = db.transaction(() => {
    for (const r of toDelete) delStmt.run(r.id);
    for (const r of toInsert) {
      insStmt.run({
        id: r.id,
        title: r.title,
        title_en: r.title_en || '',
        title_ar: r.title_ar || '',
        title_fr: r.title_fr || '',
        description: r.description || '',
        description_en: r.description_en || '',
        description_ar: r.description_ar || '',
        description_fr: r.description_fr || '',
        content: r.content || '',
        category: r.category,
        brand: r.brand || '',
        model: r.model || '',
        price_range: r.price_range || '',
        source_url: r.source_url || '',
        product_url: r.product_url || '',
        image_url: r.image_url || '',
        iso_codes: r.iso_codes || '[]',
        wcag_level: r.wcag_level || '',
        who_gate_area: r.who_gate_area || '',
        status: r.status || 'published',
        featured: r.featured || 0,
        sort_order: r.sort_order || 0,
        language: r.language || 'vi',
        created_by: r.created_by || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      });
    }
  });

  applyAll();
  db.close();

  console.log(`\n✅ Đã áp dụng. Bước tiếp theo: npx tsx scripts/reindex-products.ts --all`);
}

main();
