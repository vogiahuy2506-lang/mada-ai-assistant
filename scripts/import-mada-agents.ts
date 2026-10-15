/**
 * Import scraped MADA agents data into database
 * Usage: npx tsx scripts/import-mada-agents.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');
const DATA_PATH = path.join(__dirname, '..', 'data', 'mada-agents-data.json');

// Map to database category names
const CATEGORY_MAP: Record<string, string> = {
  'sensory-hearing': 'sensory-hearing',
  'sensory-vision': 'sensory-vision',
  'voice-speech': 'voice-and-speech',
  'mental-cognitive': 'mental-cognitive',
  'movement': 'neuromusculoskeletal-movement',
  'mobility-transport': 'mobility-and-transportation',
  'regulatory-standards': 'regulatory-standards',
};

interface Device {
  name: string;
  description: string;
  image: string;
  link: string;
}

interface QAEntry {
  category: string;
  mode: string;
  lang: string;
  question: string;
  answer: string;
  confidence: number;
  devices?: Device[];
  standards?: string[];
}

interface DataFile {
  categoryAgents: any[];
  qaData: QAEntry[];
  metadata: any;
}

async function main() {
  console.log('🚀 Starting MADA agents data import...\n');

  // Load data
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
  const data: DataFile = JSON.parse(rawData);

  console.log(`📊 Loaded ${data.categoryAgents.length} category agents`);
  console.log(`📊 Loaded ${data.qaData.length} QA entries\n`);

  // Connect to database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Stats
  const stats = {
    productsCreated: 0,
    errors: 0,
    byCategory: {} as Record<string, number>,
  };

  // Insert devices as products from QA entries
  console.log('📝 Importing devices as products...');
  const seenProducts = new Set<string>();

  for (const qa of data.qaData) {
    const category = CATEGORY_MAP[qa.category] || qa.category;

    if (qa.devices) {
      for (const device of qa.devices) {
        const productKey = `${device.name}-${device.link}`;
        if (seenProducts.has(productKey)) continue;
        seenProducts.add(productKey);

        const productId = uuidv4();
        const now = new Date().toISOString();
        const language = qa.lang === 'vi' ? 'vi' : qa.lang === 'ar' ? 'ar' : qa.lang === 'fr' ? 'fr' : 'en';

        try {
          db.prepare(`
            INSERT INTO kb_products (
              id, title, title_en,
              description, description_en,
              category, brand, model, source_url, product_url, image_url,
              status, language, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            productId,
            device.name,
            device.name,
            device.description,
            device.description,
            category,
            'MADA',
            '',
            device.link || '',
            device.link || '',
            device.image || '',
            'published',
            language,
            now,
            now
          );
          stats.productsCreated++;
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          console.log(`  ✅ ${category}: ${device.name}`);
        } catch (err: any) {
          stats.errors++;
          console.log(`  ❌ Error creating product ${device.name}: ${err.message}`);
        }
      }
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`   - Products created: ${stats.productsCreated}`);
  console.log(`   - Errors: ${stats.errors}`);
  console.log('\n📊 Products by Category:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    console.log(`   - ${cat}: ${count}`);
  }
  console.log('\n✅ Import complete!');

  db.close();
}

main().catch(console.error);
