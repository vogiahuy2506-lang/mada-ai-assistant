/**
 * Comprehensive MADA Products Scraper
 * Scrapes all products from at.mada.org.qa with images
 * 
 * Usage: npx tsx scripts/scrape-all-mada-products.ts
 */

import * as cheerio from 'cheerio';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');

// MADA Categories with their slugs
const CATEGORIES = [
  {
    name: 'sensory-hearing',
    label: 'Sensory - Hearing',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/'
  },
  {
    name: 'sensory-vision',
    label: 'Sensory - Vision',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/'
  },
  {
    name: 'voice-and-speech',
    label: 'Voice and Speech',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/'
  },
  {
    name: 'mental-cognitive',
    label: 'Mental - Cognitive',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/'
  },
  {
    name: 'neuromusculoskeletal-movement',
    label: 'Neuromusculoskeletal Movement',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/'
  },
  {
    name: 'mobility-and-transportation',
    label: 'Mobility and Transportation',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/mobility-and-transportation/'
  }
];

interface Product {
  slug: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  content: string;
  contentEn: string;
  imageUrl: string;
  additionalImages: string[];
  manufacturer: string;
  isoCodes: string[];
  category: string;
  sourceUrl: string;
}

// Extract product slugs from category page
async function getProductSlugs(categoryUrl: string): Promise<string[]> {
  console.log(`📂 Fetching category: ${categoryUrl}`);
  
  try {
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`  ❌ Failed to fetch category: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const slugs: string[] = [];
    
    // Try multiple selectors for product links
    $('a[href*="/technology/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/technology\/([^/]+)\/?$/);
      if (match && match[1] && !match[1].includes('category')) {
        slugs.push(match[1]);
      }
    });
    
    console.log(`  ✅ Found ${slugs.length} products`);
    return [...new Set(slugs)]; // Remove duplicates
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
    return [];
  }
}

// Scrape individual product page
async function scrapeProduct(slug: string, category: string): Promise<Product | null> {
  const url = `https://at.mada.org.qa/technology/${slug}/`;
  
  try {
    console.log(`  🔍 Scraping: ${slug}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('h1.entry-title').text().trim() || slug;
    const titleEn = title; // Will be translated later
    
    // Extract main image
    let imageUrl = '';
    
    // Try featured image first
    const featuredImg = $('.post-thumbnail img, .entry-featured-image img, .wp-post-image').first();
    if (featuredImg.length) {
      imageUrl = featuredImg.attr('src') || featuredImg.attr('data-src') || '';
    }
    
    // Try first image in content
    if (!imageUrl) {
      const contentImg = $('.entry-content img, .post-content img').first();
      imageUrl = contentImg.attr('src') || '';
    }
    
    // Extract additional images from gallery
    const additionalImages: string[] = [];
    $('.gallery img, .entry-content img, .post-gallery img').each((_, el) => {
      const imgSrc = $(el).attr('src') || '';
      if (imgSrc && !additionalImages.includes(imgSrc)) {
        additionalImages.push(imgSrc);
      }
    });
    
    // Extract description
    let description = '';
    let descriptionEn = '';
    
    // Try excerpt first
    const excerpt = $('.post-excerpt p, .entry-summary p, . excerpt').first().text().trim();
    if (excerpt) {
      description = excerpt;
      descriptionEn = excerpt;
    }
    
    // Try first paragraph
    if (!description) {
      const firstP = $('.entry-content p, .post-content p').first().text().trim();
      description = firstP;
      descriptionEn = firstP;
    }
    
    // Extract content
    let content = '';
    let contentEn = '';
    
    $('.entry-content p, .post-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) {
        content += text + '\n\n';
      }
    });
    contentEn = content;
    
    // Extract manufacturer
    let manufacturer = '';
    $('strong').each((_, el) => {
      const text = $(el).text();
      if (text.toLowerCase().includes('manufacturer') || text.toLowerCase().includes('hãng')) {
        manufacturer = $(el).parent().text().replace(text, '').trim();
        if (manufacturer.includes(':')) {
          manufacturer = manufacturer.split(':')[1].trim();
        }
      }
    });
    
    // Extract ISO codes
    const isoCodes: string[] = [];
    const isoRegex = /\b(ISO\s*\d+[\d.-]*|IEC\s*\d+[\d.-]*|ISO\s*9999)\b/gi;
    const pageText = $('body').text();
    const matches = pageText.match(isoRegex);
    if (matches) {
      matches.forEach(m => isoCodes.push(m.toUpperCase()));
    }
    
    // Extract WCAG level
    let wcagLevel = '';
    const wcagMatch = pageText.match(/WCAG\s*(\d+\.\d+)/i);
    if (wcagMatch) {
      wcagLevel = wcagMatch[1];
    }
    
    console.log(`    ✅ Title: ${title}`);
    console.log(`       Image: ${imageUrl ? 'Yes' : 'No'}`);
    console.log(`       ISO: ${isoCodes.slice(0, 3).join(', ')}`);
    
    return {
      slug,
      title,
      titleEn,
      description,
      descriptionEn,
      content,
      contentEn,
      imageUrl,
      additionalImages,
      manufacturer,
      isoCodes: [...new Set(isoCodes)],
      category,
      sourceUrl: url
    };
    
  } catch (error) {
    console.log(`    ❌ Error: ${error}`);
    return null;
  }
}

// Save product to database
function saveProduct(db: Database.Database, product: Product): void {
  const id = `mada_${product.slug}_${Date.now()}`;
  
  // Check if exists
  const existing = db.prepare('SELECT id FROM kb_products WHERE source_url = ?').get(product.sourceUrl);
  if (existing) {
    // Update
    db.prepare(`
      UPDATE kb_products SET
        title = ?, title_en = ?, title_ar = ?, title_fr = ?,
        description = ?, description_en = ?, content = ?, content_en = ?,
        image_url = ?, brand = ?, iso_codes = ?,
        category = ?, updated_at = ?
      WHERE source_url = ?
    `).run(
      product.title, product.titleEn, '', '',
      product.description, product.descriptionEn, product.content, product.contentEn,
      product.imageUrl, product.manufacturer, JSON.stringify(product.isoCodes),
      product.category, new Date().toISOString(),
      product.sourceUrl
    );
  } else {
    // Insert
    db.prepare(`
      INSERT INTO kb_products (
        id, title, title_en, title_ar, title_fr,
        description, description_en, content, content_en,
        category, brand, iso_codes, source_url, product_url, image_url,
        status, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, product.title, product.titleEn, '', '',
      product.description, product.descriptionEn, product.content, product.contentEn,
      product.category, product.manufacturer, JSON.stringify(product.isoCodes),
      product.sourceUrl, product.sourceUrl, product.imageUrl,
      'published', 1, new Date().toISOString(), new Date().toISOString()
    );
  }
  
  console.log(`  💾 Saved: ${product.title}`);
}

// Save knowledge item for RAG
function saveKnowledgeItem(db: Database.Database, product: Product): void {
  const id = `kbprod_${product.slug}_${Date.now()}`;
  
  const content = `
# ${product.title}

## Mô tả
${product.description}

## Chi tiết sản phẩm
${product.content}

## Thông tin kỹ thuật
- **Hãng sản xuất:** ${product.manufacturer || 'Không có thông tin'}
- **Mã ISO:** ${product.isoCodes.join(', ') || 'Không có thông tin'}
- **Danh mục:** ${product.category}

## Nguồn
${product.sourceUrl}
  `.trim();
  
  const existing = db.prepare('SELECT id FROM knowledge_items WHERE url = ?').get(product.sourceUrl);
  if (existing) {
    db.prepare(`
      UPDATE knowledge_items SET
        title = ?, title_en = ?, description = ?, description_en = ?,
        content = ?, content_en = ?, category = ?, iso_codes = ?,
        metadata = ?, updated_at = ?
      WHERE url = ?
    `).run(
      product.title, product.titleEn, product.description, product.descriptionEn,
      content, content, product.category, JSON.stringify(product.isoCodes),
      JSON.stringify({ image_url: product.imageUrl, additional_images: product.additionalImages }),
      new Date().toISOString(), product.sourceUrl
    );
  } else {
    db.prepare(`
      INSERT INTO knowledge_items (
        id, title, title_en, title_ar, title_fr,
        description, description_en, content, content_en,
        source, source_type, url, category, iso_codes, metadata,
        status, language, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, product.title, product.titleEn, '', '',
      product.description, product.descriptionEn, content, content,
      'MADA Portal', 'web', product.sourceUrl, product.category,
      JSON.stringify(product.isoCodes),
      JSON.stringify({ image_url: product.imageUrl, additional_images: product.additionalImages }),
      'published', 'vi', new Date().toISOString(), new Date().toISOString()
    );
  }
  
  console.log(`  📚 RAG: ${product.title}`);
}

// Main function
async function main() {
  console.log('🚀 MADA Products Scraper');
  console.log('='.repeat(50));
  
  const db = new Database(DB_PATH);
  let totalScraped = 0;
  let totalErrors = 0;
  
  for (const cat of CATEGORIES) {
    console.log(`\n📂 Category: ${cat.label}`);
    console.log('-'.repeat(40));
    
    const slugs = await getProductSlugs(cat.madaUrl);
    
    for (const slug of slugs) {
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const product = await scrapeProduct(slug, cat.name);
      
      if (product) {
        try {
          saveProduct(db, product);
          saveKnowledgeItem(db, product);
          totalScraped++;
        } catch (err) {
          console.log(`  ❌ DB Error: ${err}`);
          totalErrors++;
        }
      } else {
        totalErrors++;
      }
    }
  }
  
  db.close();
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   ✅ Scraped: ${totalScraped}`);
  console.log(`   ❌ Errors: ${totalErrors}`);
  console.log('\n✨ Done!');
}

main().catch(console.error);
