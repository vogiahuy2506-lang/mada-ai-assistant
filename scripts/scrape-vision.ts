import * as cheerio from 'cheerio';

const VISION_SLUGS = [
  'nvda-with-arabic-voices',
  'braillesense-6',
  'cloverbook-pro',
  'duxbury-braille-translation-sw',
  'eurobraille-b-note-20',
  'explore-12',
  'helix-hd',
  'qatari-money-reader-app',
  'rs-games',
  'thinkerbell-annie',
  'victor-reader-stratus4-m-daisy-and-mp3-player',
  'visionbuddy',
];

async function scrapeProduct(slug: string) {
  const url = `https://at.mada.org.qa/technology/${slug}/`;
  console.log(`Fetching: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('h1.entry-title').text().trim() || slug;

    // Extract description
    const description = $('.post-excerpt p, .entry-content p').first().text().trim();

    // Extract metadata
    const operatingSystem = $('strong:contains("Operating System")').parent().text().replace('Operating System:', '').trim();
    const manufacturerMatch = $('strong:contains("Additional Information")').parent().html() || '';
    const manufacturer = manufacturerMatch.includes('Manufacturer:') 
      ? manufacturerMatch.match(/Manufacturer:\s*([^<(]+)/)?.[1]?.trim() || ''
      : '';

    // Extract ISO codes
    const isoCodes: string[] = [];
    $('strong:contains("ISO")').each((_, el) => {
      const text = $(el).text();
      const match = text.match(/ISO[:\s]*([\d.-]+)?/);
      if (match?.[1]) isoCodes.push(match[1]);
    });

    // Extract thumbnail
    const thumbnail = $('.post_thumbnail img, .entry-content img').first().attr('src') || '';

    // Extract features
    const features: string[] = [];
    $('ul li, .entry-content li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10 && text.length < 200) {
        features.push(text);
      }
    });

    console.log(`  ✅ ${title}`);
    console.log(`     OS: ${operatingSystem}`);
    console.log(`     Manufacturer: ${manufacturer}`);
    console.log(`     Thumbnail: ${thumbnail ? 'Yes' : 'No'}`);

    return {
      slug,
      title,
      description,
      operatingSystem,
      manufacturer,
      isoCodes,
      thumbnail,
      features: features.slice(0, 5),
    };
  } catch (error) {
    console.error(`  ❌ Error scraping ${slug}:`, error);
    return null;
  }
}

async function main() {
  console.log('🔍 Scraping MADA Vision products...\n');

  const results = await Promise.all(
    VISION_SLUGS.map(slug => scrapeProduct(slug))
  );

  const validResults = results.filter(Boolean);

  console.log('\n📊 Results:');
  console.log(JSON.stringify(validResults, null, 2));
}

main().catch(console.error);
