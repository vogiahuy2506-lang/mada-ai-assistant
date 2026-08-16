/**
 * Fix missing thumbnails - chỉ dùng URL sản phẩm đã có trong DB
 *
 * Khác với scrape-mada-images.ts (scrape từ category page):
 *  - Script này lấy các items ĐÃ CÓ trong DB nhưng THIẾU thumbnailUrl
 *  - Visit lại URL sản phẩm, lấy ảnh thật, update metadata
 *  - KHÔNG tạo ảnh fake/random - chỉ scrape từ MADA thật
 *
 * Usage:
 *   npx tsx server/scripts/fix-db-thumbnails.ts           # Fix all missing
 *   npx tsx server/scripts/fix-db-thumbnails.ts --limit 20
 *   npx tsx server/scripts/fix-db-thumbnails.ts --dry-run
 */

import * as cheerio from 'cheerio';
import db from '../lib/db';

const BASE_URL = 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)';

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const limit = limitArg ? parseInt(limitArg, 10) : 100;
const dryRun = args.includes('--dry-run');

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function absoluteUrl(url: string, base: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  try { return new URL(url, base).toString(); } catch { return ''; }
}

async function getThumbnailFromDetail(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Try selectors in priority order
    let img = $('.tech_cover_new img').attr('src') || '';

    if (!img) {
      img = $('meta[property="og:image"]').attr('content') || '';
    }

    if (!img) {
      const firstImg = $('.entry-content img, .tech_box img').first().attr('src') || '';
      if (firstImg && !firstImg.includes('icon') && !firstImg.includes('logo')) {
        img = firstImg;
      }
    }

    if (!img) return null;

    const fullUrl = absoluteUrl(img, url);
    if (!fullUrl.startsWith('http')) return null;

    // Only accept MADA images
    if (!fullUrl.includes('mada.org.qa') && !fullUrl.includes('cdn.at.mada.org.qa')) {
      return null;
    }

    return fullUrl;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🔧 Fix Missing Thumbnails');
  console.log('━'.repeat(50));
  console.log(`Mode: ${dryRun ? '🟡 DRY-RUN' : '🟢 LIVE'}`);
  console.log(`Limit: ${limit} items`);

  // Find items missing thumbnail OR with invalid/empty thumbnail
  const items = db.prepare(`
    SELECT id, title, source, url, metadata
    FROM knowledge_items
    WHERE source_type = 'web'
      AND (url LIKE '%mada.org.qa%' OR source LIKE '%mada.org.qa%')
      AND (
        json_extract(metadata, '$.thumbnailUrl') IS NULL
        OR json_extract(metadata, '$.thumbnailUrl') = ''
        OR json_extract(metadata, '$.thumbnailUrl') NOT LIKE '%mada.org.qa%'
      )
    LIMIT ?
  `).all(limit) as any[];

  console.log(`Found ${items.length} items needing thumbnail fix\n`);

  if (items.length === 0) {
    console.log('✅ All items already have valid MADA thumbnails');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sourceUrl = item.url || item.source;
    if (!sourceUrl) continue;

    const title = (item.title || '').slice(0, 50);
    process.stdout.write(`[${i + 1}/${items.length}] ${title}... `);

    const thumbnail = await getThumbnailFromDetail(sourceUrl);

    if (!thumbnail) {
      console.log(`❌ no image`);
      failed++;
      await sleep(400);
      continue;
    }

    // Update DB
    try {
      const meta = typeof item.metadata === 'string'
        ? JSON.parse(item.metadata || '{}')
        : (item.metadata || {});

      meta.thumbnailUrl = thumbnail;
      if (!meta.galleryImages || meta.galleryImages.length === 0) {
        meta.galleryImages = [thumbnail];
      }
      meta.imageFixedAt = new Date().toISOString();

      if (dryRun) {
        console.log(`🟡 would update → ${thumbnail.slice(0, 60)}`);
      } else {
        db.prepare(`UPDATE knowledge_items SET metadata = ? WHERE id = ?`)
          .run(JSON.stringify(meta), item.id);
        console.log(`✅ ${thumbnail.slice(0, 60)}`);
      }
      updated++;
    } catch (err) {
      console.log(`❌ DB error: ${(err as Error).message}`);
      failed++;
    }

    await sleep(400); // rate limit MADA
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log('═'.repeat(50));

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Done! Restart server to see new images.');
  }
}

main().catch(err => {
  console.error('💥', err);
  process.exit(1);
});