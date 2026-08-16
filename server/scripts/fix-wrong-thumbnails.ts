/**
 * Fix script: Tìm & fix các knowledge_items có thumbnailUrl SAI
 * (ảnh không khớp với title)
 *
 * Logic phát hiện:
 *  - Lấy title normalize → keywords
 *  - So sánh với filename trong thumbnailUrl
 *  - Nếu mismatch rõ ràng (vd: title "Oticon More 1" có thumb "HearIt-All-Amplifier") → mark cần fix
 *
 * Modes:
 *   --analyze: Chỉ phân tích, không fix
 *   --fix: Apply fix (sẽ set thumbnailUrl='' hoặc tìm ảnh đúng)
 *   --fix-and-scrape: Cố scrape lại từ source URL
 *
 * Usage:
 *   npx tsx server/scripts/fix-wrong-thumbnails.ts --analyze
 *   npx tsx server/scripts/fix-wrong-thumbnails.ts --fix
 */

import db from '../lib/db';

const args = process.argv.slice(2);
const mode = args.includes('--fix') ? 'fix'
  : args.includes('--fix-and-scrape') ? 'fix-and-scrape'
  : 'analyze';

interface KBItem {
  id: string;
  title: string;
  source: string;
  url: string;
  metadata: string;
  thumbnailUrl: string;
}

const items = db.prepare(`
  SELECT id, title, source, url, metadata,
         json_extract(metadata, '$.thumbnailUrl') as thumbnailUrl
  FROM knowledge_items
  WHERE json_extract(metadata, '$.thumbnailUrl') IS NOT NULL
    AND length(json_extract(metadata, '$.thumbnailUrl')) > 0
`).all() as KBItem[];

console.log(`🔍 Analyzing ${items.length} KB items with thumbnails...`);
console.log('═'.repeat(60));

// Phát hiện mismatch: extract keywords từ title, so filename
function getTitleKeywords(title: string): string[] {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .filter((w) => !['with', 'and', 'the', 'for'].includes(w));
}

function getFilenameKeywords(url: string): string[] {
  const filename = (url.split('/').pop() || '').replace(/\.[^.]+$/, '');
  return filename.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

function calculateMismatch(title: string, thumbUrl: string): {
  score: number;
  reason: string;
} {
  const titleWords = getTitleKeywords(title);
  const fileWords = getFilenameKeywords(thumbUrl);

  // Đếm title words có xuất hiện trong filename
  const matched = titleWords.filter((tw) => fileWords.some((fw) => fw.includes(tw) || tw.includes(fw)));
  const ratio = titleWords.length > 0 ? matched.length / titleWords.length : 1;

  // Nếu filename chứa brand name mà title KHÔNG có brand đó → mismatch rõ
  const knownBrands = ['heari', 'orcam', 'jaws', 'nvda', 'roger', 'phonak', 'williamsound', 'comfort', 'oticon'];
  const titleLower = title.toLowerCase();
  const fileHasUnrelatedBrand = fileWords.some((fw) => {
    return knownBrands.some((brand) => fw.includes(brand) && !titleLower.includes(brand));
  });

  if (fileHasUnrelatedBrand) {
    return { score: 0, reason: 'filename contains brand not in title' };
  }

  if (ratio < 0.3) {
    return { score: ratio, reason: `Low match ratio: ${matched.length}/${titleWords.length}` };
  }

  return { score: ratio, reason: 'OK' };
}

let wrongCount = 0;
const wrongItems: Array<KBItem & { mismatch: ReturnType<typeof calculateMismatch> }> = [];

for (const item of items) {
  if (!item.thumbnailUrl) continue;
  const mismatch = calculateMismatch(item.title, item.thumbnailUrl);
  if (mismatch.score < 0.3) {
    wrongCount++;
    wrongItems.push({ ...item, mismatch });
  }
}

console.log(`\n📊 Results:`);
console.log(`   Total with thumbnail: ${items.length}`);
console.log(`   ❌ Suspicious: ${wrongCount}`);

if (wrongItems.length > 0) {
  console.log(`\n❌ Suspicious items:`);
  for (const item of wrongItems.slice(0, 20)) {
    console.log(`\n   ID: ${item.id}`);
    console.log(`   Title: ${item.title}`);
    console.log(`   Source: ${item.source}`);
    console.log(`   Thumb: ${item.thumbnailUrl}`);
    console.log(`   Reason: ${item.mismatch.reason}`);
  }
  if (wrongItems.length > 20) {
    console.log(`\n   ... and ${wrongItems.length - 20} more`);
  }
}

if (mode === 'analyze') {
  console.log('\n💡 Run with --fix to clear wrong thumbnails');
  process.exit(0);
}

if (mode === 'fix' || mode === 'fix-and-scrape') {
  console.log('\n🔧 Applying fix...');
  let fixed = 0;
  for (const item of wrongItems) {
    // Strategy: clear thumbnailUrl in metadata, then sync to vector store
    const meta = JSON.parse(item.metadata || '{}');
    meta.thumbnailUrl = '';
    meta.galleryImages = [];
    meta.imageFixedAt = new Date().toISOString();
    meta.imageFixedReason = item.mismatch.reason;

    db.prepare(`
      UPDATE knowledge_items
      SET metadata = ?
      WHERE id = ?
    `).run(JSON.stringify(meta), item.id);

    fixed++;
  }
  console.log(`✅ Fixed ${fixed} items (cleared wrong thumbnails)`);
  console.log('\n💡 Next: Run sync-kb-to-vectors.ts to update vector store');
}