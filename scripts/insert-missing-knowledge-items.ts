/**
 * Insert missing knowledge_items for mobility and regulatory categories
 * Run: npx tsx scripts/insert-missing-knowledge-items.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');

const CATEGORY_TO_BOTID: Record<string, string> = {
  'mobility-and-transportation': 'bot-mobility',
  'regulatory-standards': 'bot-regulatory',
};

async function main() {
  console.log('🚀 Inserting missing knowledge_items...\n');

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();

  let insertedCount = 0;

  for (const [category, botId] of Object.entries(CATEGORY_TO_BOTID)) {
    // Get products from kb_products
    const products = db.prepare(`
      SELECT id, title, content, description, image_url, product_url, source_url
      FROM kb_products 
      WHERE category = ?
    `).all(category) as any[];

    console.log(`📦 ${category}: ${products.length} products in kb_products`);

    // Check existing in knowledge_items
    const existing = db.prepare(`
      SELECT COUNT(*) as count FROM knowledge_items WHERE category = ?
    `).get(category) as { count: number };
    
    console.log(`   Already in knowledge_items: ${existing.count}`);

    if (products.length === 0) continue;

    // Check if knowledge_items for this category has botId
    const existingWithBotId = db.prepare(`
      SELECT COUNT(*) as count FROM knowledge_items 
      WHERE category = ? AND json_extract(metadata, '$.botId') IS NOT NULL
    `).get(category) as { count: number };

    if (existingWithBotId.count > 0) {
      console.log(`   Already has botId, skipping...`);
      continue;
    }

    // Insert into knowledge_items
    const insertStmt = db.prepare(`
      INSERT INTO knowledge_items 
      (id, title, title_en, description, description_en, content, content_en,
       source, source_type, url, source_url, category, language, status,
       confidence, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const product of products) {
      const kiId = `ki-${product.id}`;
      
      // Check if already exists
      const exists = db.prepare('SELECT id FROM knowledge_items WHERE id = ?').get(kiId);
      if (exists) continue;

      const content = product.content || product.description || '';
      const description = (product.description || '').slice(0, 500);
      
      const metadata = JSON.stringify({
        botId,
        madaCategory: category,
        thumbnailUrl: product.image_url,
        productUrl: product.product_url,
        sourceUrl: product.source_url,
      });

      try {
        insertStmt.run(
          kiId,
          product.title,
          product.title,
          description,
          description,
          content.slice(0, 2000),
          content.slice(0, 2000),
          product.source_url || product.product_url,
          'web',
          product.product_url,
          product.source_url || product.product_url,
          category,
          'en',
          'published',
          0.9,
          metadata,
          now,
          now
        );
        insertedCount++;
        console.log(`   ✅ ${product.title}`);
      } catch (err: any) {
        console.log(`   ❌ ${product.title}: ${err.message}`);
      }
    }
  }

  // Now update all knowledge_items with botId metadata
  console.log('\n📝 Updating botId metadata...');
  
  for (const [category, botId] of Object.entries(CATEGORY_TO_BOTID)) {
    const items = db.prepare(`
      SELECT id, metadata FROM knowledge_items WHERE category = ?
    `).all(category) as any[];

    for (const item of items) {
      let metadata: any = {};
      try {
        metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
      } catch {
        metadata = {};
      }
      
      metadata.botId = botId;
      metadata.madaCategory = category;
      
      db.prepare(`
        UPDATE knowledge_items SET metadata = ?, updated_at = ? WHERE id = ?
      `).run(JSON.stringify(metadata), now, item.id);
    }
    
    console.log(`   ✅ ${category}: ${items.length} items updated`);
  }

  // Final count
  console.log('\n📊 Final count by botId:');
  const counts = db.prepare(`
    SELECT json_extract(metadata, '$.botId') as botId, COUNT(*) as count
    FROM knowledge_items
    WHERE json_extract(metadata, '$.botId') IS NOT NULL
    GROUP BY json_extract(metadata, '$.botId')
    ORDER BY count DESC
  `).all() as any[];

  for (const c of counts) {
    console.log(`   ${c.botId}: ${c.count} items`);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM knowledge_items
    WHERE json_extract(metadata, '$.botId') IS NOT NULL
  `).get() as { count: number };
  
  console.log(`   TOTAL: ${total.count} items`);

  db.close();
  console.log('\n🎉 Done!');
}

main().catch(console.error);
