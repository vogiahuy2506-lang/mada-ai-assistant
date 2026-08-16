/**
 * Scrape product images from 7 MADA Qatar category pages + portal
 *
 * Purpose: Cập nhật ảnh sản phẩm THẬT từ MADA Qatar portal vào DB.
 * KHÔNG dùng ảnh random/fake - chỉ lấy ảnh thật từ MADA.
 *
 * 7 Categories (theo yêu cầu người dùng):
 *  - Bot 1: Sensory – Hearing
 *  - Bot 2: Sensory – Vision
 *  - Bot 3: Voice and Speech
 *  - Bot 4: Mental – Cognitive
 *  - Bot 5: Neuromusculoskeletal Movement
 *  - Bot 6: Mobility and Transportation
 *  - Bot 7: Regulatory & Standards (portal)
 *
 * Workflow:
 *  1. Fetch category page (paginated) → extract product URLs
 *  2. For each product URL → fetch detail page → extract image
 *  3. Update DB: knowledge_items.metadata.thumbnailUrl
 *
 * Usage:
 *   npx tsx server/scripts/scrape-mada-images.ts                    # All categories
 *   npx tsx server/scripts/scrape-mada-images.ts --category hearing # Only hearing
 *   npx tsx server/scripts/scrape-mada-images.ts --limit 5          # Limit 5 products/category
 *   npx tsx server/scripts/scrape-mada-images.ts --dry-run          # Preview only
 */

import * as cheerio from 'cheerio';
import db from '../lib/db';

const BASE_URL = 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)';

// ============== 7 BOT CATEGORIES ==============
const CATEGORIES = [
  {
    slug: 'sensory-hearing',
    name: 'Sensory – Hearing',
    nameVi: 'Cảm giác – Thính giác',
    url: `${BASE_URL}/technology-category/body-function/sensory-hearing/`,
    icon: 'hearing',
  },
  {
    slug: 'sensory-vision',
    name: 'Sensory – Vision',
    nameVi: 'Cảm giác – Thị giác',
    url: `${BASE_URL}/technology-category/body-function/sensory-vision/`,
    icon: 'visibility',
  },
  {
    slug: 'voice-and-speech',
    name: 'Voice and Speech',
    nameVi: 'Giọng nói và Lời nói',
    url: `${BASE_URL}/technology-category/body-function/voice-and-speech/`,
    icon: 'forum',
  },
  {
    slug: 'mental-cognitive',
    name: 'Mental – Cognitive',
    nameVi: 'Tâm thần – Nhận thức',
    url: `${BASE_URL}/technology-category/body-function/mental-cognitive/`,
    icon: 'psychology',
  },
  {
    slug: 'neuromusculoskeletal-movement',
    name: 'Neuromusculoskeletal Movement',
    nameVi: 'Vận động thần kinh – cơ xương',
    url: `${BASE_URL}/technology-category/body-function/neuromusculoskeletal-movement/`,
    icon: 'accessible',
  },
  {
    slug: 'mobility-and-transportation',
    name: 'Mobility and Transportation',
    nameVi: 'Di chuyển và Giao thông',
    url: `${BASE_URL}/technology-category/activities-and-participation/mobility-and-transportation/`,
    icon: 'directions',
  },
  {
    slug: 'regulatory-standards',
    name: 'Regulatory & Standards',
    nameVi: 'Quy định & Tiêu chuẩn',
    url: `${BASE_URL}/assistive-technology-portal/`,
    icon: 'verified',
  },
];

// ============== ARGUMENT PARSING ==============
const args = process.argv.slice(2);
const onlyCategory = args.find(a => a.startsWith('--category='))?.split('=')[1];
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;
const dryRun = args.includes('--dry-run');

// ============== HELPERS ==============

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function absoluteUrl(url: string, base: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return '';
  }
}

/**
 * Extract product URLs from a category listing page.
 * MADA category pages use .tech_box or .technology-item containers.
 */
async function scrapeCategoryPage(categoryUrl: string): Promise<string[]> {
  const urls: string[] = [];
  let page = 1;
  const maxPages = 10; // safety limit

  while (page <= maxPages) {
    const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}page/${page}/`;
    console.log(`   📄 Page ${page}: ${pageUrl}`);

    let html: string;
    try {
      html = await fetchHtml(pageUrl);
    } catch (err) {
      console.log(`   ⚠️  Page ${page} failed: ${(err as Error).message}`);
      break;
    }

    const $ = cheerio.load(html);
    let foundOnPage = 0;

    // MADA uses .tech_box > a for product links
    $('.tech_box a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('/technology/') && !urls.includes(href)) {
        urls.push(href);
        foundOnPage++;
      }
    });

    // Fallback: also try generic .technology-item
    $('.technology-item a, article.technology a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('/technology/') && !urls.includes(href)) {
        urls.push(href);
        foundOnPage++;
      }
    });

    if (foundOnPage === 0) {
      console.log(`   (No more products found, stop at page ${page})`);
      break;
    }
    page++;
    await sleep(500);
  }

  return urls;
}

/**
 * Extract thumbnail URL from a product detail page.
 * Tries multiple selectors + og:image meta fallback.
 */
async function getThumbnailFromDetail(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Priority 1: .tech_cover_new img (MADA's main cover)
    let img = $('.tech_cover_new img').attr('src') || '';

    // Priority 2: og:image meta tag
    if (!img) {
      img = $('meta[property="og:image"]').attr('content') || '';
    }

    // Priority 3: first large image in content area
    if (!img) {
      const firstImg = $('.entry-content img').first().attr('src') ||
                       $('.tech_box img').first().attr('src') || '';
      if (firstImg && !firstImg.includes('icon') && !firstImg.includes('logo')) {
        img = firstImg;
      }
    }

    // Priority 4: post thumbnail (WordPress)
    if (!img) {
      img = $('meta[property="og:image:secure_url"]').attr('content') || '';
    }

    if (!img) return null;

    const fullUrl = absoluteUrl(img, url);
    if (!fullUrl.startsWith('http')) return null;

    // Validate it's a MADA image
    if (!fullUrl.includes('mada.org.qa') && !fullUrl.includes('cdn.at.mada.org.qa')) {
      return null;
    }

    return fullUrl;
  } catch (err) {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Update product in DB with new thumbnail URL.
 */
function updateProductThumbnail(
  url: string,
  thumbnailUrl: string,
  categorySlug: string,
): boolean {
  try {
    const item = db.prepare(`
      SELECT id, metadata FROM knowledge_items WHERE url = ? OR source = ? LIMIT 1
    `).get(url, url) as any;

    if (!item) {
      return false; // not in DB
    }

    const meta = typeof item.metadata === 'string'
      ? JSON.parse(item.metadata || '{}')
      : (item.metadata || {});

    // Only update if missing or empty
    const oldThumb = meta.thumbnailUrl || '';
    if (oldThumb === thumbnailUrl) {
      return true; // already correct
    }

    meta.thumbnailUrl = thumbnailUrl;
    meta.galleryImages = meta.galleryImages?.length
      ? meta.galleryImages
      : [thumbnailUrl];
    meta.madaCategory = meta.madaCategory || categorySlug;
    meta.imageScrapedAt = new Date().toISOString();

    if (dryRun) {
      console.log(`     [DRY-RUN] Would update: ${url.slice(0, 70)}...`);
      return true;
    }

    db.prepare(`UPDATE knowledge_items SET metadata = ? WHERE id = ?`)
      .run(JSON.stringify(meta), item.id);

    return true;
  } catch (err) {
    console.error(`     ❌ DB error:`, (err as Error).message);
    return false;
  }
}

/**
 * Insert new product into DB if not exists.
 */
function insertProductIfNew(
  url: string,
  title: string,
  thumbnailUrl: string,
  category: typeof CATEGORIES[number],
): boolean {
  try {
    const existing = db.prepare(`SELECT id FROM knowledge_items WHERE url = ? LIMIT 1`).get(url);
    if (existing) return false; // already in DB

    if (dryRun) {
      console.log(`     [DRY-RUN] Would insert new product: ${title}`);
      return true;
    }

    const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const meta = {
      url,
      thumbnailUrl,
      galleryImages: [thumbnailUrl],
      madaCategory: category.slug,
      botId: `bot-${category.slug}`,
      scrapedAt: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO knowledge_items (
        id, title, content, source, source_type, url, category,
        status, language, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'web', ?, ?, 'draft', 'en', ?, ?, ?)
    `).run(
      id,
      title,
      title, // content = title for now
      url,
      url,
      category.slug,
      JSON.stringify(meta),
      new Date().toISOString(),
      new Date().toISOString(),
    );

    return true;
  } catch (err) {
    console.error(`     ❌ Insert error:`, (err as Error).message);
    return false;
  }
}

// ============== MAIN ==============

async function main() {
  console.log('🚀 MADA Image Scraper');
  console.log('━'.repeat(60));
  console.log(`Mode: ${dryRun ? '🟡 DRY-RUN (no DB changes)' : '🟢 LIVE (will update DB)'}`);
  console.log(`Limit: ${limit === Infinity ? '∞' : limit} products/category`);
  if (onlyCategory) console.log(`Filter: only "${onlyCategory}"`);
  console.log('━'.repeat(60));

  const categories = onlyCategory
    ? CATEGORIES.filter(c => c.slug === onlyCategory || c.slug.includes(onlyCategory))
    : CATEGORIES;

  if (categories.length === 0) {
    console.error(`❌ Category "${onlyCategory}" not found. Available:`);
    CATEGORIES.forEach(c => console.error(`   - ${c.slug}`));
    process.exit(1);
  }

  let totalScraped = 0;
  let totalUpdated = 0;
  let totalInserted = 0;
  let totalFailed = 0;

  for (const category of categories) {
    console.log(`\n📂 [${category.name}] ${category.nameVi}`);
    console.log(`   URL: ${category.url}`);

    // Step 1: Get all product URLs from category page
    const productUrls = await scrapeCategoryPage(category.url);
    const productList = productUrls.slice(0, limit);

    console.log(`   Found ${productUrls.length} products, processing ${productList.length}`);

    // Step 2: For each product, scrape thumbnail
    for (let i = 0; i < productList.length; i++) {
      const url = productList[i];
      const slug = url.split('/technology/')[1]?.replace(/\/$/, '') || url;
      const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      process.stdout.write(`   [${i + 1}/${productList.length}] ${slug.slice(0, 50)}... `);

      const thumbnail = await getThumbnailFromDetail(url);

      if (!thumbnail) {
        console.log(`❌ no image`);
        totalFailed++;
        await sleep(300);
        continue;
      }

      totalScraped++;

      // Update or insert in DB
      const updated = updateProductThumbnail(url, thumbnail, category.slug);
      if (updated) {
        totalUpdated++;
        // Try to insert if not exists
        const inserted = insertProductIfNew(url, title, thumbnail, category);
        if (inserted) totalInserted++;
        console.log(`✅ ${thumbnail.slice(0, 60)}...`);
      } else {
        console.log(`⚠️  not in DB`);
      }

      await sleep(300); // rate limit
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Categories processed:  ${categories.length}`);
  console.log(`Products with image:    ${totalScraped}`);
  console.log(`DB records updated:     ${totalUpdated}`);
  console.log(`DB records inserted:    ${totalInserted}`);
  console.log(`Failed (no image):      ${totalFailed}`);
  console.log('═'.repeat(60));

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes to DB');
  } else {
    console.log('\n✅ Done! Restart server to see updated images in chat.');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});