/**
 * Migration script: knowledge_items (source_type='web') → kb_products
 *
 * Vấn đề: Scraper ghi scraped items vào knowledge_items nhưng
 * /api/public/products đọc từ kb_products → bảng trống.
 *
 * Script này migrate ngược chiều: lấy tất cả scraped items
 * trong knowledge_items (source_type='web', status='published')
 * và insert/update vào kb_products.
 *
 * Chạy: node -e "$(cat scripts/migrate-scraped-to-products.ts)"
 */

import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');

const db = new Database(DB_PATH, { readonly: false });
db.pragma('journal_mode = WAL');

function parseMetadata(raw: string | null): any {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function migrateScrapedItems(): {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
} {
  const items = db.prepare(`
    SELECT id, title, description, content, url, category, metadata, language, status, created_at, updated_at
    FROM knowledge_items
    WHERE source_type = 'web' AND status = 'published'
  `).all() as any[];

  console.log(`Found ${items.length} scraped items to migrate`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO kb_products (
      id, title, title_en, description, description_en, content,
      category, brand, model, price_range, source_url, product_url,
      image_url, iso_codes, wcag_level, who_gate_area, status, language,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE kb_products SET
      title = ?, title_en = ?, description = ?, description_en = ?,
      content = ?, category = ?, brand = ?, model = ?, price_range = ?,
      source_url = ?, product_url = ?, image_url = ?, iso_codes = ?,
      wcag_level = ?, who_gate_area = ?, language = ?, updated_at = ?
    WHERE id = ?
  `);

  const checkStmt = db.prepare(`SELECT id FROM kb_products WHERE id = ?`);
  const findByUrl = db.prepare(`SELECT id FROM kb_products WHERE product_url = ? OR source_url = ?`);

  const now = new Date().toISOString();

  for (const item of items) {
    try {
      const meta = parseMetadata(item.metadata);
      const kbId = `scraped_${item.id}`;

      // Check if already exists in kb_products
      const existing = checkStmt.get(kbId) ||
        (item.url ? findByUrl.get(item.url, item.url) : null);

      const title_en = meta.titleEn || meta.titleEN || '';
      const brand = meta.brand || '';
      const model = meta.model || '';
      const price_range = meta.priceRange || '';
      const image_url = meta.thumbnailUrl || meta.imageUrl || '';
      const wcag_level = meta.wcagLevel || item.wcag_level || '';
      const who_gate_area = meta.whoGateArea || item.who_gate_area || '';
      const description = item.description || '';
      const description_en = meta.descriptionEn || meta.descriptionEN || '';
      const content = item.content || '';
      const category = item.category || 'general';
      const iso_codes = item.iso_codes || '[]';
      const language = item.language || 'en';

      if (existing) {
        // Update existing
        updateStmt.run(
          item.title, title_en, description, description_en,
          content, category, brand, model, price_range,
          item.url || '', item.url || '', image_url, iso_codes,
          wcag_level, who_gate_area, language, now,
          existing.id || kbId
        );
        updated++;
      } else {
        // Insert new
        insertStmt.run(
          kbId,
          item.title, title_en, description, description_en, content,
          category, brand, model, price_range,
          item.url || '', item.url || '', image_url, iso_codes,
          wcag_level, who_gate_area,
          'published', language,
          null, // created_by
          item.created_at || now, now
        );
        inserted++;
      }
    } catch (e: any) {
      errors.push(`${item.id}: ${e.message}`);
      skipped++;
    }
  }

  return { inserted, updated, skipped, errors };
}

// Run
const result = migrateScrapedItems();
console.log('\nMigration complete:');
console.log(`  Inserted: ${result.inserted}`);
console.log(`  Updated:  ${result.updated}`);
console.log(`  Skipped:  ${result.skipped}`);
if (result.errors.length > 0) {
  console.log(`  Errors:`);
  result.errors.forEach(e => console.log(`    - ${e}`));
}

// Verify
const kb = db.prepare(`SELECT count(*) AS c FROM kb_products WHERE status='published'`).get() as any;
const kbImg = db.prepare(`SELECT count(*) AS c FROM kb_products WHERE status='published' AND image_url != ''`).get() as any;
const ki = db.prepare(`SELECT count(*) AS c FROM knowledge_items WHERE source_type='web'`).get() as any;
const kiImg = db.prepare(`SELECT count(*) AS c FROM knowledge_items WHERE source_type='web' AND json_extract(metadata, '\$.thumbnailUrl') IS NOT NULL AND json_extract(metadata, '\$.thumbnailUrl') != ''`).get() as any;
console.log('\nVerification:');
console.log(`  kb_products published:       ${kb.c}`);
console.log(`  kb_products with image:       ${kbImg.c}`);
console.log(`  knowledge_items (web):         ${ki.c}`);
console.log(`  knowledge_items with thumb:    ${kiImg.c}`);

db.close();
