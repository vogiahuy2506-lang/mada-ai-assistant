/**
 * Standalone MADA Scraper - Scrape all 7 categories
 * Không dùng complex import chain
 */
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)';
const DELAY = 3000; // 3s giữa các request

const CATEGORIES = [
  { slug: 'sensory-hearing',                name: 'Bot 1: Hearing',          pages: 3 },
  { slug: 'sensory-vision',                 name: 'Bot 2: Vision',          pages: 1 },
  { slug: 'voice-and-speech',               name: 'Bot 3: Speech',          pages: 1 },
  { slug: 'mental-cognitive',               name: 'Bot 4: Cognitive',       pages: 1 },
  { slug: 'neuromusculoskeletal-movement',  name: 'Bot 5: Neuro-Movement',  pages: 1 },
  { slug: 'mobility-and-transportation',    name: 'Bot 6: Mobility',        pages: 1 },
  { slug: 'regulatory-standards',           name: 'Bot 7: Regulatory',       pages: 1 },
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface ProductInfo {
  title: string;
  detailUrl: string;
  thumbnail: string;
  category: string;
}

async function scrapeCategory(slug: string, maxPages: number): Promise<ProductInfo[]> {
  const products: ProductInfo[] = [];
  const baseUrl = slug === 'regulatory-standards'
    ? `${BASE_URL}/assistive-technology-portal/`
    : `${BASE_URL}/technology-category/body-function/${slug}/`;

  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    console.log(`   📥 Page ${page}/${maxPages}: ${url.slice(0, 60)}...`);

    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      $('article.technology, .at_service_column article').each((_, el) => {
        const $el = $(el);
        const titleEl = $el.find('h2, h3, .title, .entry-title').first();
        const title = titleEl.text().trim() || $el.text().trim().slice(0, 50);

        const link = $el.find('a').first().attr('href') || '';
        const detailUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;

        const thumb = $el.find('img').first().attr('src') ||
                      $el.find('[class*="thumb"] img').first().attr('src') || '';

        if (title && title.length > 3) {
          products.push({ title, detailUrl, thumbnail: thumb, category: slug });
        }
      });

      console.log(`   ✅ Page ${page}: found ${products.length} products so far`);
    } catch (err: any) {
      console.log(`   ⚠️  Page ${page} error: ${err.message}`);
      break;
    }

    await delay(DELAY);
  }

  return products;
}

async function scrapeProductDetail(url: string): Promise<string> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Remove scripts, styles
    $('script, style, nav, footer, header').remove();

    // Get main content
    const content = $('#content, main, article, .entry-content').text().trim() ||
                   $('body').text().trim();

    // Clean up
    return content.replace(/\s+/g, ' ').slice(0, 5000);
  } catch (err) {
    return '';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doIngest = args.includes('--ingest');
  const categoryArg = args.find(a => a.startsWith('--cat='))?.split('=')[1];

  console.log(`\n🚀 MADA Scraper - All 7 Categories`);
  console.log(`   Ingest to KB: ${doIngest ? 'YES' : 'NO (dry-run)'}`);
  console.log('');

  const categories = categoryArg
    ? CATEGORIES.filter(c => c.slug === categoryArg)
    : CATEGORIES;

  const allResults: Record<string, ProductInfo[]> = {};
  const errors: string[] = [];

  for (const cat of categories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 ${cat.name} (${cat.slug})`);
    console.log('='.repeat(60));

    try {
      const products = await scrapeCategory(cat.slug, cat.pages);
      allResults[cat.slug] = products;

      console.log(`\n   📊 Total: ${products.length} products`);

      if (products.length > 0) {
        // Show first 3
        console.log(`\n   📋 Sample products:`);
        products.slice(0, 3).forEach((p, i) => {
          console.log(`      ${i+1}. ${p.title.slice(0, 50)}`);
          console.log(`         🔗 ${p.detailUrl.slice(0, 60)}`);
        });
      }

    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      errors.push(`${cat.slug}: ${err.message}`);
    }

    await delay(DELAY);
  }

  // Save results
  const outputPath = path.join(process.cwd(), 'data', 'mada-scrape-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY`);
  console.log('='.repeat(60));

  let totalProducts = 0;
  for (const [slug, products] of Object.entries(allResults)) {
    console.log(`   ${slug}: ${products.length} products`);
    totalProducts += products.length;
  }

  console.log(`\n   ✅ Total: ${totalProducts} products across ${Object.keys(allResults).length} categories`);
  console.log(`   📁 Saved to: ${outputPath}`);
  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.join(', ')}`);
  }

  console.log('\n🎉 Done!');
}

main().catch(console.error);
