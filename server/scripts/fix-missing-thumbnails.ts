/**
 * Fix missing thumbnails - scrape from MADA portal
 * Run: npx tsx server/scripts/fix-missing-thumbnails.ts
 */

import * as cheerio from 'cheerio';
import db from '../lib/db';

const BASE_URL = 'https://at.mada.org.qa';

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function getThumbnailFromDetailPage(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    
    // Try multiple selectors
    let imgUrl = $('.tech_cover_new img').attr('src') || '';
    if (!imgUrl) {
      imgUrl = $('meta[property="og:image"]').attr('content') || '';
    }
    if (!imgUrl) {
      const firstImg = $('.entry-content img').first().attr('src') || '';
      if (firstImg && !firstImg.includes('icon')) imgUrl = firstImg;
    }
    
    if (imgUrl && !imgUrl.startsWith('http')) {
      imgUrl = new URL(imgUrl, BASE_URL).toString();
    }
    
    return imgUrl || null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('🔍 Đang tìm sản phẩm thiếu ảnh...\n');
  
  // Get items without thumbnail
  const items = db.prepare(`
    SELECT id, title, source, url, metadata
    FROM knowledge_items 
    WHERE source_type = 'web' 
      AND (json_extract(metadata, '$.thumbnailUrl') IS NULL 
           OR json_extract(metadata, '$.thumbnailUrl') = '')
    LIMIT 50
  `).all() as any[];

  console.log(`Tìm thấy ${items.length} sản phẩm cần cập nhật\n`);

  let updated = 0;
  let failed = 0;

  for (const item of items) {
    const sourceUrl = item.url || item.source;
    if (!sourceUrl || !sourceUrl.includes('mada.org.qa/technology/')) {
      continue;
    }

    console.log(`📥 ${item.title}...`);
    
    const thumbnail = await getThumbnailFromDetailPage(sourceUrl);
    
    if (thumbnail) {
      // Update metadata
      const meta = typeof item.metadata === 'string' 
        ? JSON.parse(item.metadata) 
        : (item.metadata || {});
      
      meta.thumbnailUrl = thumbnail;
      meta.galleryImages = [thumbnail];
      
      db.prepare(`
        UPDATE knowledge_items 
        SET metadata = ? 
        WHERE id = ?
      `).run(JSON.stringify(meta), item.id);
      
      console.log(`   ✅ Updated: ${thumbnail.slice(0, 60)}...`);
      updated++;
    } else {
      console.log(`   ❌ No image found`);
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Hoàn tất! ${updated} updated, ${failed} failed`);
}

main().catch(console.error);
