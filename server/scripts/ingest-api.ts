/**
 * Ingest scraped products vào KB qua server API
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

const SERVER_URL = 'http://localhost:3001';
const DELAY = 500; // 500ms giữa các request

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function ingestProduct(product: ProductInfo): Promise<boolean> {
  const title = product.title.replace(/Date:.*$/, '').trim();

  try {
    const res = await fetch(`${SERVER_URL}/api/data/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: product.detailUrl,
        type: 'web',
        content: '', // sẽ được fetch từ server
        title: title,
      }),
    });

    if (!res.ok) {
      console.log(`      ❌ ${res.status}: ${title.slice(0, 30)}`);
      return false;
    }

    const data = await res.json();
    if (data.success) {
      console.log(`      ✅ ${title.slice(0, 40)}`);
      return true;
    } else {
      console.log(`      ⚠️  ${data.error || 'failed'}`);
      return false;
    }
  } catch (err: any) {
    console.log(`      ❌ Network: ${err.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitPerCategory = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '999');

  console.log(`\n🚀 MADA KB Ingest via API`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`   Limit per category: ${limitPerCategory}`);
  console.log('');

  // Check server
  try {
    const health = await fetch(`${SERVER_URL}/api/health`);
    const data = await health.json();
    console.log(`✅ Server OK: RAG=${data.ragEnabled}, Gemini=${data.geminiConfigured}`);
  } catch (err) {
    console.error(`❌ Server not responding at ${SERVER_URL}`);
    console.log('   Run: npm run server');
    process.exit(1);
  }

  // Read results
  const resultsPath = path.join(process.cwd(), 'data', 'mada-scrape-results.json');
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ No scraped data. Run: npx tsx standalone-scrape.ts');
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) as Record<string, ProductInfo[]>;

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const [category, products] of Object.entries(results)) {
    if (products.length === 0) {
      console.log(`\n📚 ${category}: 0 products (skip)`);
      continue;
    }

    const botId = BOT_ID_MAP[category] || 'unknown';
    console.log(`\n📚 ${category} → ${botId}`);

    const toIngest = products.slice(0, limitPerCategory);
    let success = 0;
    let failed = 0;

    for (const product of toIngest) {
      if (dryRun) {
        console.log(`   🔗 ${product.detailUrl}`);
        success++;
      } else {
        const ok = await ingestProduct(product);
        if (ok) success++;
        else failed++;
        await delay(DELAY);
      }
    }

    console.log(`   📊 ${success} success, ${failed} failed`);
    totalSuccess += success;
    totalFailed += failed;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 TOTAL: ${totalSuccess} success, ${totalFailed} failed`);

  if (dryRun) {
    console.log(`\n✅ Dry-run complete!`);
    console.log(`   To ingest for real: npx tsx ingest-api.ts`);
  } else {
    console.log(`\n🎉 Ingest complete!`);
    console.log(`   Check KB: curl http://localhost:3001/api/knowledge/stats`);
  }
}

main().catch(console.error);
