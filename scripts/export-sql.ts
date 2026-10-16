/**
 * Export MADA data to SQL sync files
 * Run this after scraping new products or updating data locally
 * 
 * Usage: npx tsx scripts/export-sql.ts
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');

function exportTable(db: Database.Database, table: string, outputFile: string) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  
  if (rows.length === 0) {
    console.log(`⚠️  ${table}: no rows to export`);
    return;
  }

  // Get actual column names from table
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const cols = columns.map(c => c.name);
  
  let sql = `-- ${table} exported from local DB\n-- Generated: ${new Date().toISOString()}\n\n`;
  sql += `DELETE FROM ${table};\n\n`;
  
  for (const row of rows) {
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v;
      return JSON.stringify(String(v));
    });
    sql += `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
  }
  
  fs.writeFileSync(outputFile, sql);
  console.log(`✅ ${table}: ${rows.length} rows → ${outputFile}`);
}

function main() {
  console.log('🚀 Exporting MADA data to SQL sync files...\n');
  
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    console.error('   Run "npx tsx scripts/scrape-all-mada-products.ts" first!');
    process.exit(1);
  }
  
  const db = new Database(DB_PATH, { readonly: true });
  
  const dataDir = path.join(__dirname, '..', 'data');
  
  // Export all tables
  // Tables to export (only if they exist)
  const tables = ['kb_categories', 'kb_products', 'knowledge_items'];
  
  for (const table of tables) {
    try {
      const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      if (!exists) {
        console.log(`⚠️  ${table}: table not found, skipping`);
        continue;
      }
      const fileMap: Record<string, string> = {
        'kb_categories': 'categories-sync.sql',
        'kb_products': 'products-sync.sql',
        'knowledge_items': 'knowledge-items-sync.sql',
      };
      const outputFile = path.join(dataDir, fileMap[table] || `${table}-sync.sql`);
      exportTable(db, table, outputFile);
    } catch {
      console.log(`⚠️  ${table}: error checking, skipping`);
    }
  }
  
  db.close();
  
  console.log('\n✅ Export complete!');
  console.log('📝 Commit and push these files to git:');
  console.log('   git add data/*.sql');
  console.log('   git commit -m "Update product data"');
  console.log('   git push');
  console.log('\n🚀 Then deploy to production - it will auto-import!');
}

main();
