import * as cheerio from 'cheerio';

const VOICE_SLUGS = [
  'attainment-talker-24',
  'coughdrop-aac',
  'gotalk-go',
  'gotalk-now',
  'gotalk-select',
  'grid-pad-10s',
  'proloquo2go',
  'proloquo4text',
  'tawasol-aac-app',
  'tawasol-symbols',
  'td-pilot',
  'tobii-dynavox-i-series',
];

async function scrapeProduct(slug: string) {
  const url = `https://at.mada.org.qa/technology/${slug}/`;
  console.log(`\n🔍 Fetching: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Get title
    const title = $('h1.entry-title').text().trim() || slug;

    // Get full content
    const content = $('.entry-content').html() || '';
    const contentText = $('.entry-content').text().trim();

    // Get metadata
    const metadata: Record<string, string> = {};
    $('strong').each((_, el) => {
      const text = $(el).text().trim();
      const parentText = $(el).parent().text().trim();
      if (text.includes(':') || text.includes('Operating') || text.includes('Manufacturer')) {
        const parts = parentText.split(':');
        if (parts.length >= 2) {
          const key = parts[0].replace(text, '').trim() || text;
          const value = parts.slice(1).join(':').trim();
          if (key && value) {
            metadata[key] = value;
          }
        }
      }
    });

    // Get description (first paragraph)
    const firstPara = $(".entry-content p").first().text().trim();

    // Get image
    const image = $('.post_thumbnail img, .entry-content img').first().attr('src') || '';

    // Get features from lists
    const features: string[] = [];
    $(".entry-content ul li, .entry-content ol li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10 && text.length < 300) {
        features.push(text);
      }
    });

    // Get ISO codes
    const isoCodes: string[] = [];
    $('*').contents().each((_, node) => {
      if (node.type === 'text') {
        const text = $(node).text();
        const match = text.match(/ISO[\s:]*[\d.-]+/g);
        if (match) {
          match.forEach(m => {
            const code = m.replace(/ISO[\s:]*/i, '');
            if (code && !isoCodes.includes(code)) {
              isoCodes.push(code);
            }
          });
        }
      }
    });

    console.log(`  ✅ ${title}`);
    console.log(`     OS: ${metadata['Operating System'] || 'N/A'}`);
    console.log(`     Features: ${features.length} items`);

    return {
      slug,
      title,
      description: firstPara || contentText.slice(0, 500),
      fullContent: contentText.slice(0, 2000),
      operatingSystem: metadata['Operating System'] || '',
      manufacturer: metadata['Manufacturer'] || '',
      image,
      features,
      isoCodes,
      metadata,
    };
  } catch (error) {
    console.error(`  ❌ Error scraping ${slug}:`, error);
    return null;
  }
}

async function main() {
  console.log('🎤 Scraping MADA Voice & Speech products...\n');

  const results = [];
  for (const slug of VOICE_SLUGS) {
    const result = await scrapeProduct(slug);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }

  console.log('\n\n📊 SUMMARY:');
  console.log(`Total products: ${results.length}`);
  
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.title}`);
    console.log(`   OS: ${r.operatingSystem || 'N/A'}`);
    console.log(`   Description: ${r.description.slice(0, 150)}...`);
  });

  // Save to JSON for analysis
  const fs = await import('fs');
  fs.writeFileSync('voice-products.json', JSON.stringify(results, null, 2));
  console.log('\n\n💾 Saved to voice-products.json');
}

main().catch(console.error);
