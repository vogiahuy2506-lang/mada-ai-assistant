/**
 * Migrate scraped MADA products to kb_products table
 * Run: npx tsx scripts/migrate-mada-products.ts
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');

interface DeepProduct {
  postId: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  galleryImages: string[];
  content: string;
  isoCodes: string[];
  tags: string[];
  attachments: { type: string; url: string; label: string }[];
  videoLinks: string[];
  sourceUrl: string;
  specifications: Record<string, string>;
  manufacturer?: string;
}

async function main() {
  console.log('🚀 Migrating MADA products to kb_products...\n');

  const db = new Database(DB_PATH);

  // Load scraped data
  const scrapedDataPath = path.join(DATA_DIR, 'mada-deep-products.json');
  if (!fs.existsSync(scrapedDataPath)) {
    console.error('❌ mada-deep-products.json not found!');
    process.exit(1);
  }

  const scrapedProducts: DeepProduct[] = JSON.parse(fs.readFileSync(scrapedDataPath, 'utf-8'));
  console.log(`📦 Loaded ${scrapedProducts.length} scraped products`);

  // Clear existing MADA products in kb_products and knowledge_items
  db.prepare(`DELETE FROM kb_products WHERE category LIKE 'sensory-%' OR category LIKE '%hearing' OR category LIKE '%vision' OR category LIKE '%speech' OR category LIKE '%cognitive' OR category LIKE '%movement' OR category LIKE '%mobility'`).run();
  db.prepare(`DELETE FROM knowledge_items WHERE category LIKE 'sensory-%' OR category LIKE '%hearing' OR category LIKE '%vision' OR category LIKE '%speech' OR category LIKE '%cognitive' OR category LIKE '%movement' OR category LIKE '%mobility'`).run();
  console.log('🗑️  Cleared existing MADA products');

  // Category name mapping (for display)
  const CATEGORY_NAMES: Record<string, string> = {
    'sensory-hearing': 'Sensory – Hearing',
    'sensory-vision': 'Sensory – Vision',
    'voice-and-speech': 'Voice and Speech',
    'mental-cognitive': 'Mental – Cognitive',
    'neuromusculoskeletal-movement': 'Neuromusculoskeletal Movement',
    'mobility-and-transportation': 'Mobility and Transportation',
    'regulatory-standards': 'Regulatory & Standards',
  };

  const now = new Date().toISOString();
  let successCount = 0;
  let errorCount = 0;

  for (const product of scrapedProducts) {
    try {
      // Generate ID
      const id = `mada-${product.slug}`;
      const kiId = `ki-${product.slug}`;
      
      // Clean image URL (make absolute)
      let imageUrl = product.thumbnailUrl;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://at.mada.org.qa${imageUrl}`;
      }

      // Price range (MADA products don't have prices, use "Contact MADA Center")
      const priceRange = 'Liên hệ MADA Center';
      
      const title = product.title;
      const content = product.content || product.description || '';
      const description = (product.description || product.content || '').slice(0, 500);

      // Insert into kb_products (use INSERT OR REPLACE to handle duplicates)
      db.prepare(`
        INSERT OR REPLACE INTO kb_products 
        (id, title, title_en, description, description_en, content, content_en, 
         category, brand, model, price_range, source_url, product_url, image_url, 
         iso_codes, status, featured, language, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        title,
        title,
        description,
        description,
        content,
        content,
        product.category,
        product.manufacturer || 'MADA Qatar',
        product.slug,
        priceRange,
        product.sourceUrl,
        product.sourceUrl,
        imageUrl,
        JSON.stringify(product.isoCodes),
        'published',
        1,
        'en',
        now,
        now
      );

      // Insert into knowledge_items for RAG search (use INSERT OR REPLACE to handle duplicates)
      const metadata = JSON.stringify({
        thumbnailUrl: imageUrl,
        galleryImages: product.galleryImages,
        isoCodes: product.isoCodes,
        tags: product.tags,
        specifications: product.specifications,
        attachments: product.attachments,
        manufacturer: product.manufacturer,
      });

      db.prepare(`
        INSERT OR REPLACE INTO knowledge_items 
        (id, title, title_en, description, description_en, content, content_en, 
         source, source_type, url, category, language, status, 
         confidence, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        kiId,
        title,
        title,
        description,
        description,
        content.slice(0, 2000),
        content.slice(0, 2000),
        product.sourceUrl,
        'web',
        product.sourceUrl,
        product.category,
        'en',
        'published',
        0.9,
        metadata,
        now,
        now
      );

      successCount++;
      console.log(`✅ ${title} (${product.category})`);
    } catch (err: any) {
      errorCount++;
      console.log(`❌ ${product.title}: ${err.message}`);
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify data
  const count = db.prepare('SELECT COUNT(*) as count FROM kb_products').get() as { count: number };
  console.log(`\n📦 kb_products now has ${count.count} products`);

  const kiCount = db.prepare(`SELECT COUNT(*) as count FROM knowledge_items WHERE category LIKE 'sensory-%' OR category LIKE '%hearing' OR category LIKE '%vision' OR category LIKE '%speech' OR category LIKE '%cognitive' OR category LIKE '%movement' OR category LIKE '%mobility'`).get() as { count: number };
  console.log(`📦 knowledge_items has ${kiCount.count} MADA items`);

  // Show products by category
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM kb_products 
    GROUP BY category 
    ORDER BY count DESC
  `).all() as { category: string; count: number }[];
  
  console.log('\n📊 Products by category:');
  for (const row of byCategory) {
    const catName = CATEGORY_NAMES[row.category] || row.category;
    console.log(`   ${catName}: ${row.count}`);
  }

  // Show sample products with images
  console.log('\n📷 Sample products with images:');
  const samples = db.prepare(`
    SELECT title, category, image_url 
    FROM kb_products 
    WHERE image_url IS NOT NULL AND image_url != ''
    LIMIT 5
  `).all() as { title: string; category: string; image_url: string }[];
  
  for (const s of samples) {
    console.log(`   ${s.title}: ${s.image_url.slice(0, 60)}...`);
  }

  db.close();
  console.log('\n🎉 Migration done!');
}

main().catch(console.error);
