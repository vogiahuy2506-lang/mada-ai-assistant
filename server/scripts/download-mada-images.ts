/**
 * Download MADA product images to local storage
 * Run: npx tsx server/scripts/download-mada-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'mada-images');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url: string, filename: string): Promise<boolean> {
  const outputPath = path.join(OUTPUT_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`⏭️  Already exists: ${filename}`);
    return true;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://at.mada.org.qa/',
      }
    });

    if (!response.ok) {
      console.log(`❌ Failed to download ${filename}: ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`✅ Downloaded: ${filename}`);
    return true;
  } catch (err: any) {
    console.log(`❌ Error downloading ${filename}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('📥 Downloading MADA product images...\n');
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  // Get all items with thumbnailUrl from database
  const items = db.prepare(`
    SELECT id, title, 
           json_extract(metadata, '$.thumbnailUrl') as thumbnailUrl,
           json_extract(metadata, '$.slug') as slug
    FROM knowledge_items 
    WHERE source_type = 'web' 
      AND json_extract(metadata, '$.thumbnailUrl') IS NOT NULL
      AND json_extract(metadata, '$.thumbnailUrl') != ''
    GROUP BY json_extract(metadata, '$.thumbnailUrl')
  `).all() as any[];

  console.log(`Found ${items.length} unique images to download\n`);

  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    if (!item.thumbnailUrl) continue;
    
    // Extract filename from URL
    const urlParts = item.thumbnailUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1] || `${item.slug || item.id}.jpg`;
    const filename = `${item.slug || item.id}-${originalFilename}`;
    
    const success = await downloadImage(item.thumbnailUrl, filename);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Done! ${successCount} downloaded, ${failCount} failed`);
  console.log(`📁 Images saved to: ${OUTPUT_DIR}`);
  
  // Generate mapping file
  const mapping = items.map(item => ({
    id: item.id,
    title: item.title,
    originalUrl: item.thumbnailUrl,
    localUrl: `/mada-images/${item.slug || item.id}-${item.thumbnailUrl?.split('/').pop() || 'image.jpg'}`
  }));
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'image-mapping.json'),
    JSON.stringify(mapping, null, 2)
  );
  console.log(`📄 Mapping saved to: ${OUTPUT_DIR}/image-mapping.json`);
}

main().catch(console.error);
