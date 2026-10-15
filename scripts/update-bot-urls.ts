/**
 * Update bot knowledge URLs via API
 * Run: npx tsx scripts/update-bot-urls.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3001/api/admin/agents';
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');

interface ProductURLs {
  [category: string]: string[];
}

async function getProductURLs(): Promise<ProductURLs> {
  // Dynamic import better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(DB_PATH);
  
  const categories = [
    'sensory-hearing',
    'sensory-vision',
    'voice-and-speech',
    'mental-cognitive',
    'neuromusculoskeletal-movement',
    'mobility-and-transportation'
  ];
  
  const urls: ProductURLs = {};
  
  for (const cat of categories) {
    const rows = db.prepare(`
      SELECT product_url FROM kb_products 
      WHERE category = ? AND product_url LIKE '%technology/%'
    `).all(cat) as { product_url: string }[];
    
    urls[cat] = rows.map(r => r.product_url);
  }
  
  db.close();
  return urls;
}

// Bot ID to category mapping
const BOT_CATEGORIES: Record<string, string> = {
  'bot-hearing': 'sensory-hearing',
  'bot-vision': 'sensory-vision',
  'bot-speech': 'voice-and-speech',
  'bot-cognitive': 'mental-cognitive',
  'bot-neuro': 'neuromusculoskeletal-movement',
  'bot-mobility': 'mobility-and-transportation',
  'bot-regulatory': 'ALL', // Will get all URLs
};

async function updateBotURLs() {
  console.log('🚀 Starting bot URL update...\n');
  
  const productURLs = await getProductURLs();
  
  // Print summary
  console.log('📦 Product URLs by category:');
  for (const [cat, urls] of Object.entries(productURLs)) {
    console.log(`   ${cat}: ${urls.length} URLs`);
  }
  
  // Build all URLs for regulatory bot
  const allURLs = Object.values(productURLs).flat();
  productURLs['ALL'] = allURLs;
  
  console.log(`\n📦 Regulatory bot will get: ${allURLs.length} URLs`);
  
  console.log('\n📝 URLs for each bot:');
  for (const [botId, category] of Object.entries(BOT_CATEGORIES)) {
    const urls = productURLs[category] || [];
    console.log(`\n${botId} (${category}):`);
    urls.slice(0, 3).forEach(url => console.log(`   - ${url}`));
    if (urls.length > 3) console.log(`   ... and ${urls.length - 3} more`);
  }
  
  console.log('\n\n⚠️  To apply these URLs, please use the admin panel:');
  console.log('   1. Go to /api/admin/agents');
  console.log('   2. Click edit on each bot');
  console.log('   3. Add product URLs in the "KIẾN THỨC" section');
  console.log('\n   OR use the crawl-sources endpoint:');
  console.log('   POST /api/admin/agents/:id/crawl-sources');
  console.log('   Body: { knowledge_url: "...", product_urls: [...] }');
  
  // Generate SQL for direct DB update
  console.log('\n\n📄 SQL statements to update admin_agents:');
  console.log('-- Update product_url (first URL) for each bot');
  
  for (const [botId, category] of Object.entries(BOT_CATEGORIES)) {
    if (category === 'ALL') continue;
    const urls = productURLs[category] || [];
    if (urls.length > 0) {
      console.log(`UPDATE admin_agents SET product_url = '${urls[0]}' WHERE id = '${botId}';`);
    }
  }
  
  console.log('\n-- Update bot-regulatory with first URL from each category');
  const firstUrls = Object.entries(productURLs)
    .filter(([cat]) => cat !== 'ALL')
    .map(([cat, urls]) => urls[0])
    .filter(Boolean);
  
  if (firstUrls.length > 0) {
    console.log(`UPDATE admin_agents SET product_url = '${firstUrls[0]}' WHERE id = 'bot-regulatory';`);
  }
  
  // Save URLs to a JSON file for reference
  const urlsFile = path.join(DATA_DIR, 'bot-product-urls.json');
  fs.writeFileSync(urlsFile, JSON.stringify({
    byCategory: productURLs,
    byBot: Object.fromEntries(
      Object.entries(BOT_CATEGORIES).map(([botId, cat]) => [botId, productURLs[cat] || []])
    ),
    updatedAt: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n💾 Saved URLs to: ${urlsFile}`);
  console.log('\n🎉 Done!');
}

updateBotURLs().catch(console.error);
