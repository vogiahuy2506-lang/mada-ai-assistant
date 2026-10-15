/**
 * Update knowledge_items with botId metadata for RAG
 * Run: npx tsx scripts/update-knowledge-items-botid.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');

// Bot category to botId mapping
const CATEGORY_TO_BOTID: Record<string, string> = {
  'sensory-hearing': 'bot-hearing',
  'sensory-vision': 'bot-vision',
  'voice-and-speech': 'bot-speech',
  'mental-cognitive': 'bot-cognitive',
  'neuromusculoskeletal-movement': 'bot-neuro',
  'mobility-and-transportation': 'bot-mobility',
  'regulatory-standards': 'bot-regulatory',
};

async function main() {
  console.log('🚀 Updating knowledge_items with botId metadata...\n');

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();

  // Update knowledge_items with botId based on category
  let updatedCount = 0;
  
  for (const [category, botId] of Object.entries(CATEGORY_TO_BOTID)) {
    // Get existing metadata
    const items = db.prepare(`
      SELECT id, metadata, title FROM knowledge_items 
      WHERE category = ?
    `).all(category) as any[];

    console.log(`📦 ${category}: ${items.length} items`);
    
    for (const item of items) {
      let metadata: any = {};
      try {
        metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
      } catch {
        metadata = {};
      }
      
      // Add botId to metadata
      metadata.botId = botId;
      metadata.madaCategory = category;
      
      // Update
      db.prepare(`
        UPDATE knowledge_items 
        SET metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(metadata), now, item.id);
      
      updatedCount++;
    }
  }

  // Also update kb_products with botId in metadata
  let kbUpdatedCount = 0;
  
  for (const [category, botId] of Object.entries(CATEGORY_TO_BOTID)) {
    // Get existing kb_products
    const products = db.prepare(`
      SELECT id, title FROM kb_products 
      WHERE category = ?
    `).all(category) as any[];

    for (const product of products) {
      // Update kb_products directly with botId (we'll add this column or use a join)
      // For now, just log
      kbUpdatedCount++;
    }
  }

  // Verify updates
  console.log(`\n✅ Updated ${updatedCount} knowledge_items with botId`);
  console.log(`📦 Checked ${kbUpdatedCount} kb_products`);

  // Show sample updates
  console.log('\n📋 Sample updates:');
  const samples = db.prepare(`
    SELECT ki.id, ki.title, ki.category, json_extract(ki.metadata, '$.botId') as botId
    FROM knowledge_items ki
    WHERE json_extract(ki.metadata, '$.botId') IS NOT NULL
    LIMIT 5
  `).all() as any[];

  for (const s of samples) {
    console.log(`   ${s.title}: ${s.botId} (${s.category})`);
  }

  // Count by botId
  console.log('\n📊 Items by botId:');
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

  db.close();
  console.log('\n🎉 Done!');
}

main().catch(console.error);
