/**
 * Ingest scraped products vào Knowledge Base
 * Đọc từ data/mada-scrape-results.json
 */
import fs from 'fs';
import path from 'path';

interface ProductInfo {
  title: string;
  detailUrl: string;
  thumbnail: string;
  category: string;
}

const BOT_ID_MAP: Record<string, string> = {
  'sensory-hearing': 'bot-hearing',
  'sensory-vision': 'bot-vision',
  'voice-and-speech': 'bot-speech',
  'mental-cognitive': 'bot-cognitive',
  'neuromusculoskeletal-movement': 'bot-neuro',
  'mobility-and-transportation': 'bot-mobility',
  'regulatory-standards': 'bot-regulatory',
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n🚀 MADA KB Ingest`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN (no ingest)' : 'LIVE'}`);
  console.log('');

  // Read scraped results
  const resultsPath = path.join(process.cwd(), 'data', 'mada-scrape-results.json');

  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ File not found: ${resultsPath}`);
    console.log('   Run: npx tsx standalone-scrape.ts');
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as Record<string, ProductInfo[]>;

  let totalProducts = 0;
  let totalCategories = 0;

  console.log('📦 Products to ingest:');
  for (const [category, products] of Object.entries(results)) {
    if (products.length === 0) continue;
    totalCategories++;
    totalProducts += products.length;
    const botId = BOT_ID_MAP[category] || 'unknown';
    console.log(`   ${category} → ${botId}: ${products.length} products`);
  }

  console.log(`\n   Total: ${totalProducts} products in ${totalCategories} categories`);

  if (dryRun) {
    console.log('\n✅ Dry-run complete (no changes made)');
    return;
  }

  // TODO: Gọi server API để ingest
  console.log('\n⚠️  Ingest via server API not implemented yet.');
  console.log('   Manual options:');
  console.log('   1. Use /admin/data → Upload URLs manually');
  console.log('   2. Call server endpoint: POST /api/knowledge/ingest');
  console.log('   3. Or run full scraper with --ingest flag when fixed');

  // Show sample data format
  console.log('\n📋 Sample data format:');
  const firstProduct = Object.values(results).flat()[0];
  if (firstProduct) {
    console.log(JSON.stringify({
      type: 'web',
      source: firstProduct.detailUrl,
      title: firstProduct.title.replace(/Date:.*$/, '').trim(),
      metadata: {
        madaCategory: firstProduct.category,
        botId: BOT_ID_MAP[firstProduct.category],
        thumbnailUrl: firstProduct.thumbnail,
      }
    }, null, 2));
  }
}

main().catch(console.error);
