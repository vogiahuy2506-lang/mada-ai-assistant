/**
 * Deep MADA Scraper
 * 
 * Cào sâu từng sản phẩm MADA:
 * 1. Vào trang danh mục → lấy danh sách link sản phẩm
 * 2. Vào từng trang sản phẩm → trích xuất chi tiết (specs, gallery, ISO codes...)
 * 3. Lưu JSON đầy đủ + import vào SQLite
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'mada-deep-products.json');
const BASE_URL = 'https://at.mada.org.qa';

function absoluteUrl(href: string, base: string): string {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// MADA categories để scrape
const MADA_CATEGORIES = [
  'sensory-hearing',
  'sensory-vision',
  'voice-and-speech',
  'mental-cognitive',
  'neuromusculoskeletal-movement',
  'mobility-and-transportation',
  'regulatory-standards',
];

interface ProductLink {
  postId: string;
  slug: string;
  title: string;
  detailUrl: string;
  thumbnailUrl: string;
  categories: string[];
}

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
  model?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractProductsFromHtml(html: string, categorySlug: string): ProductLink[] {
  const products: ProductLink[] = [];
  const $ = cheerio.load(html);

  // Main pattern: MADA WordPress theme structure
  // .at_service_column.at_service_category article.technology
  $('.at_service_column.at_service_category article.technology').each((_, el) => {
    const $el = $(el);
    const classes = $el.attr('class') || '';

    // Post ID
    const postIdMatch = classes.match(/post-(\d+)/);
    const postId = postIdMatch?.[1] || '';

    // Title - remove screen-reader-text, strip trailing "Date: ..." from MADA theme
    const $link = $el.find('h2.entry-title a');
    let title = $link.clone().children('.screen-reader-text').remove().end().text()
      .replace(/\s+/g, ' ')
      .replace(/\s*Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}.*$/i, '')
      .trim();

    const href = $link.attr('href') || '';
    const detailUrl = absoluteUrl(href, BASE_URL);

    // Slug
    const slug = detailUrl.split('/technology/')[1]?.replace(/\/$/, '') || '';

    // Thumbnail
    const $img = $el.find('img');
    const thumbnailUrl = $img.attr('src') || $img.attr('data-src') || '';

    // Always use the primary categorySlug as the category for this scrape run
    // This ensures consistent categorization based on the listing page
    if (title && detailUrl && slug) {
      products.push({
        postId,
        slug,
        title: decodeHtmlEntities(title),
        detailUrl,
        thumbnailUrl,
        categories: [categorySlug], // Use the page category as primary
      });
    }
  });

  // Fallback: generic article links with technology/ in URL
  if (products.length === 0) {
    $('article a[href*="/technology/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      if (href.includes('/technology/') && !href.includes('/technology-category/')) {
        const slug = href.split('/technology/')[1]?.replace(/\/$/, '') || '';
        if (slug && !products.some(p => p.slug === slug)) {
          const $article = $el.closest('article');
          const $img = $article.find('img');
          products.push({
            postId: '',
            slug,
            title: $el.text().trim() || slug,
            detailUrl: absoluteUrl(href, BASE_URL),
            thumbnailUrl: $img.attr('src') || '',
            categories: [categorySlug],
          });
        }
      }
    });
  }

  return products;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractProductDetail(html: string, url: string): Partial<DeepProduct> {
  const product: Partial<DeepProduct> = {
    sourceUrl: url,
    galleryImages: [],
    attachments: [],
    videoLinks: [],
    isoCodes: [],
    tags: [],
    specifications: {},
  };

  // Extract title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) {
    product.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract description/content
  const contentMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i);
  if (contentMatch) {
    // Strip HTML tags but keep structure
    let content = contentMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    product.content = decodeHtmlEntities(content);
    product.description = content.slice(0, 500);
  }

  // Extract featured image
  const featuredMatch = html.match(/<img[^>]*class="[^"]*wp-image-[^"]*"[^>]*src="([^"]+)"/i) ||
                       html.match(/"featuredImage"\s*:\s*"([^"]+)"/i) ||
                       html.match(/og:image"[^>]*content="([^"]+)"/i);
  if (featuredMatch) {
    product.thumbnailUrl = featuredMatch[1];
    product.galleryImages?.push(featuredMatch[1]);
  }

  // Extract gallery images
  const galleryMatches = html.matchAll(/<img[^>]*class="[^"]*gallery[^"]*"[^>]*src="([^"]+)"/gi);
  for (const m of galleryMatches) {
    if (!product.galleryImages?.includes(m[1])) {
      product.galleryImages?.push(m[1]);
    }
  }

  // Extract ISO codes from content or meta
  const isoMatches = html.matchAll(/\b(ISO\s*\d{4}(?:-\d+)?)\b/gi);
  for (const m of isoMatches) {
    if (!product.isoCodes?.includes(m[1].toUpperCase())) {
      product.isoCodes?.push(m[1].toUpperCase());
    }
  }

  // Extract IEC codes
  const iecMatches = html.matchAll(/\b(IEC\s*\d{1,2}(?:-\d+)?)\b/gi);
  for (const m of iecMatches) {
    if (!product.isoCodes?.includes(m[1].toUpperCase())) {
      product.isoCodes?.push(m[1].toUpperCase());
    }
  }

  // Extract WHO references
  if (/\bWHO\b/i.test(html) && !product.tags?.includes('WHO')) {
    product.tags?.push('WHO');
  }

  // Extract attachments (PDFs, docs)
  const attachmentMatches = html.matchAll(/<a[^>]*href="([^"]+\.(?:pdf|doc|docx|xlsx))"[^>]*>([^<]+)<\/a>/gi);
  for (const m of attachmentMatches) {
    if (!product.attachments?.some(a => a.url === m[1])) {
      product.attachments?.push({
        type: m[1].split('.').pop()?.toUpperCase() || 'DOC',
        url: m[1],
        label: decodeHtmlEntities(m[2].trim()),
      });
    }
  }

  // Extract video links
  const videoMatches = html.matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/gi);
  for (const m of videoMatches) {
    if (!product.videoLinks?.includes(m[0])) {
      product.videoLinks?.push(m[0]);
    }
  }

  // Extract specifications from tables
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch) {
    const rows = tableMatch[1].matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi);
    for (const row of rows) {
      const key = decodeHtmlEntities(row[1].trim()).toLowerCase().replace(/\s+/g, '_');
      const value = decodeHtmlEntities(row[2].trim());
      if (key && value && key.length < 50) {
        product.specifications![key] = value;
      }
    }
  }

  // Extract manufacturer/brand
  const mfrMatch = html.match(/manufacturer["\s:]+([^"<&\n]+)/i) ||
                   html.match(/brand["\s:]+([^"<&\n]+)/i);
  if (mfrMatch) {
    product.manufacturer = decodeHtmlEntities(mfrMatch[1].trim());
  }

  return product;
}

async function scrapeCategoryPage(categorySlug: string): Promise<ProductLink[]> {
  console.log(`\n📂 Scraping category: ${categorySlug}`);
  
  // Try English version first
  const url = `https://at.mada.org.qa/technology-category/body-function/${categorySlug}/`;
  
  console.log(`   Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    console.log(`   📄 Got ${html.length} chars`);

    const products = extractProductsFromHtml(html, categorySlug);
    console.log(`   ✅ Found ${products.length} products`);
    
    return products;
  } catch (err) {
    console.log(`   ❌ Error: ${err}`);
    return [];
  }
}

async function scrapeProductPage(link: ProductLink): Promise<DeepProduct | null> {
  try {
    console.log(`   🔍 ${link.title.slice(0, 50)}...`);
    
    const response = await fetch(link.detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const detail = extractProductDetail(html, link.detailUrl);

    const product: DeepProduct = {
      postId: link.postId,
      slug: link.slug,
      title: link.title,
      description: detail.description || '',
      category: link.categories[0] || 'general',
      thumbnailUrl: detail.thumbnailUrl || link.thumbnailUrl,
      galleryImages: detail.galleryImages || (link.thumbnailUrl ? [link.thumbnailUrl] : []),
      content: detail.content || '',
      isoCodes: detail.isoCodes || [],
      tags: detail.tags || [],
      attachments: detail.attachments || [],
      videoLinks: detail.videoLinks || [],
      sourceUrl: link.detailUrl,
      specifications: detail.specifications || {},
      manufacturer: detail.manufacturer,
    };

    // Add some specs from content
    if (product.content) {
      if (/\b Bluetooth\b/i.test(product.content)) {
        product.specifications.bluetooth = 'Supported';
      }
      if (/\b rechargeable\b/i.test(product.content) || /\bpin sạc\b/i.test(product.content)) {
        product.specifications.rechargeable = 'Yes';
      }
      if (/\bwaterproof\b|\bwater resistant\b/i.test(product.content)) {
        product.specifications.water_resistant = 'Yes';
      }
    }

    return product;
  } catch (err) {
    console.log(`   ❌ Error: ${err}`);
    return null;
  }
}

async function main() {
  console.log('🚀 MADA Deep Scraper');
  console.log('====================\n');

  const allProducts: DeepProduct[] = [];
  const failedLinks: string[] = [];

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Scrape each category
  for (const categorySlug of MADA_CATEGORIES) {
    const links = await scrapeCategoryPage(categorySlug);
    
    if (links.length === 0) {
      console.log(`   ⚠️  No products found, trying alternate URL...`);
      // Try alternate URL patterns
      const altUrls = [
        `https://at.mada.org.qa/technology-category/${categorySlug}/`,
        `https://at.mada.org.qa/${categorySlug}/`,
      ];
      
      for (const altUrl of altUrls) {
        console.log(`   Trying: ${altUrl}`);
        try {
          const response = await fetch(altUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
          });
          if (response.ok) {
            const html = await response.text();
            const altLinks = extractProductsFromHtml(html, categorySlug);
            if (altLinks.length > 0) {
              links.push(...altLinks);
              console.log(`   ✅ Found ${altLinks.length} products from alternate URL`);
              break;
            }
          }
        } catch {}
      }
    }

    // Scrape each product detail
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      console.log(`\n[${categorySlug}] Product ${i + 1}/${links.length}`);
      
      const product = await scrapeProductPage(link);
      
      if (product) {
        allProducts.push(product);
        console.log(`   ✅ Saved: ${product.title.slice(0, 40)}...`);
      } else {
        failedLinks.push(link.detailUrl);
      }

      // Polite delay between requests
      await sleep(1000);
    }

    // Delay between categories
    await sleep(2000);
  }

  // Deduplicate by slug (same product can appear in multiple categories)
  const seenSlugs = new Set<string>();
  const uniqueProducts: DeepProduct[] = [];
  for (const p of allProducts) {
    if (!seenSlugs.has(p.slug)) {
      seenSlugs.add(p.slug);
      uniqueProducts.push(p);
    } else {
      console.log(`   ⚠️  Skipping duplicate: ${p.title}`);
    }
  }
  allProducts.length = 0;
  allProducts.push(...uniqueProducts);

  // Save to JSON
  console.log('\n\n💾 Saving to JSON...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
  console.log(`   ✅ Saved ${allProducts.length} unique products to ${OUTPUT_FILE}`);

  // Summary by category
  console.log('\n📊 Summary:');
  const byCategory: Record<string, number> = {};
  for (const p of allProducts) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`   ${cat}: ${count}`);
  }

  if (failedLinks.length > 0) {
    console.log(`\n⚠️  Failed to scrape ${failedLinks.length} products:`);
    failedLinks.slice(0, 5).forEach(url => console.log(`   - ${url}`));
  }

  // Import to SQLite
  console.log('\n🗄️  Importing to SQLite...');
  await importToSQLite(allProducts);

  console.log('\n🎉 Done!');
}

async function importToSQLite(products: DeepProduct[]) {
  // Dynamic import better-sqlite3 (the package used in this project)
  const { default: Database } = await import('better-sqlite3');
  
  const dbPath = path.join(DATA_DIR, 'mada.db');
  const db = new Database(dbPath);

  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mada_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      thumbnail_url TEXT,
      gallery_images TEXT,
      content TEXT,
      iso_codes TEXT,
      tags TEXT,
      attachments TEXT,
      video_links TEXT,
      source_url TEXT,
      specifications TEXT,
      manufacturer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clear old data
  db.exec('DELETE FROM mada_products');

  // Insert products
  const stmt = db.prepare(`
    INSERT INTO mada_products 
    (post_id, slug, title, description, category, thumbnail_url, gallery_images, 
     content, iso_codes, tags, attachments, video_links, source_url, specifications, manufacturer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of products) {
    stmt.run(
      p.postId,
      p.slug,
      p.title,
      p.description,
      p.category,
      p.thumbnailUrl,
      JSON.stringify(p.galleryImages),
      p.content,
      JSON.stringify(p.isoCodes),
      JSON.stringify(p.tags),
      JSON.stringify(p.attachments),
      JSON.stringify(p.videoLinks),
      p.sourceUrl,
      JSON.stringify(p.specifications),
      p.manufacturer || null
    );
  }

  db.close();

  console.log(`   ✅ Imported ${products.length} products to SQLite`);
}

main().catch(console.error);
