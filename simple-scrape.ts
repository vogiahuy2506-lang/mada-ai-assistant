/**
 * Simple scrape test - không dùng import chain phức tạp
 */
import * as cheerio from 'cheerio';

const BASE_URL = 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)';

async function fetchHtml(url: string): Promise<string> {
  console.log(`   📥 Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  console.log('🚀 Simple MADA Scraper Test\n');

  // Test Bot 1: Sensory-Hearing
  const categorySlug = 'sensory-hearing';
  const url = `${BASE_URL}/technology-category/body-function/${categorySlug}/`;

  console.log(`📚 Testing category: ${categorySlug}`);
  console.log(`🔗 URL: ${url}\n`);

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Đếm products
    const products: string[] = [];
    $('.at_service_column.at_service_category article.technology').each((_, el) => {
      const title = $(el).find('h2, h3, .title').text().trim();
      if (title) products.push(title);
    });

    console.log(`✅ Found ${products.length} products`);

    // Đếm pagination
    const pages: string[] = [];
    $('a[href*="/page/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      pages.push(href);
    });

    console.log(`📄 Pagination links found: ${pages.length}`);
    if (pages.length > 0) {
      const uniquePages = [...new Set(pages.map(p => {
        const match = p.match(/\/page\/(\d+)\/?/);
        return match ? parseInt(match[1]) : 0;
      }))];
      console.log(`   Page numbers: ${uniquePages.sort((a,b) => a-b).join(', ')}`);
    }

    // Show first 5 products
    console.log(`\n📋 First 5 products:`);
    products.slice(0, 5).forEach((p, i) => console.log(`   ${i+1}. ${p}`));

  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
  }

  console.log('\n✅ Test complete!');
}

main().catch(console.error);
