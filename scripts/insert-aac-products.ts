/**
 * Insert common AAC products into kb_products table
 * These products are referenced by AI but may not be in MADA portal
 * Run: npx tsx scripts/insert-aac-products.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'mada.db');

interface AACProduct {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  brand: string;
  productUrl: string;
  imageUrl: string;
}

// Common AAC products that AI might reference
const AAC_PRODUCTS: AACProduct[] = [
  {
    id: 'aac-big-mack',
    title: 'BIG/mack',
    titleEn: 'BIG/mack',
    description: 'Big Mack là thiết bị giao tiếp tăng cường (AAC) đơn giản với một nút lớn. Khi nhấn, thiết bị phát ra một thông điệp đã ghi sẵn. Phù hợp cho người mới bắt đầu học giao tiếp.',
    descriptionEn: 'BIG/mack is a simple augmentative and alternative communication (AAC) device with one large button. When pressed, the device plays a pre-recorded message. Suitable for beginners learning to communicate.',
    category: 'voice-and-speech',
    brand: 'AbleNet',
    productUrl: 'https://www.ablenetinc.com/tech/big-mack/',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop',
  },
  {
    id: 'aac-interact-as',
    title: 'Interact-AS',
    titleEn: 'Interact-AS',
    description: 'Interact-AS là phần mềm giao tiếp tăng cường (AAC) cho Windows. Hỗ trợ quét và điểm nhìn, phù hợp cho người có khó khăn về vận động tinh.',
    descriptionEn: 'Interact-AS is an augmentative and alternative communication (AAC) software for Windows. Supports scanning and eye gaze, suitable for people with motor difficulties.',
    category: 'voice-and-speech',
    brand: 'Origin Instruments',
    productUrl: 'https://www.orin.com/access/interact/',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=400&fit=crop',
  },
  {
    id: 'aac-step-by-step',
    title: 'Step-by-Step',
    titleEn: 'Step-by-Step',
    description: 'Step-by-Step là thiết bị giao tiếp với 3 cấp độ. Người dùng có thể ghi và phát lại 3 thông điệp khác nhau. Phù hợp để dạy trình tự và kỹ năng.',
    descriptionEn: 'Step-by-Step is a communication device with 3 levels. Users can record and play back 3 different messages. Suitable for teaching sequences and skills.',
    category: 'voice-and-speech',
    brand: 'AbleNet',
    productUrl: 'https://www.ablenetinc.com/tech/step-by-step/',
    imageUrl: 'https://images.unsplash.com/photo-1581093458791-9f3c3250a8b0?w=400&h=400&fit=crop',
  },
  {
    id: 'aac-td-suppier',
    title: 'TD Pilot',
    titleEn: 'TD Pilot',
    description: 'TD Pilot là thiết bị giao tiếp tăng cường (AAC) sử dụng công nghệ theo dõi mắt. Gắn vào iPad và cho phép người dùng điều khiển bằng mắt.',
    descriptionEn: 'TD Pilot is an augmentative and alternative communication (AAC) device using eye-tracking technology. Attaches to iPad and allows users to control with their eyes.',
    category: 'voice-and-speech',
    brand: 'Tobii Dynavox',
    productUrl: 'https://www.tobiidynavox.com/devices/ipad/td-pilot/',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=400&fit=crop',
  },
  {
    id: 'aac-grid-pad',
    title: 'Grid Pad',
    titleEn: 'Grid Pad',
    description: 'Grid Pad là thiết bị AAC chuyên dụng với màn hình lớn, hỗ trợ cảm ứng và điều khiển bằng mắt. Đi kèm phần mềm Grid 3.',
    descriptionEn: 'Grid Pad is a dedicated AAC device with a large screen, supporting touch and eye control. Comes with Grid 3 software.',
    category: 'voice-and-speech',
    brand: 'Smartbox',
    productUrl: 'https://www.thinksmartbox.com/products/grid-pad',
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop',
  },
  {
    id: 'vision-ruby-xl-hd',
    title: 'Kính lúp điện tử cầm tay Ruby XL HD',
    titleEn: 'Ruby XL HD Handheld Electronic Magnifier',
    description: 'Kính lúp điện tử cầm tay Ruby XL HD là thiết bị hỗ trợ người có thị lực kém đọc sách, tài liệu, nhãn mác. Màn hình 5 inch HD, zoom 2x-14x, đèn LED chiếu sáng, chế độ màu tự nhiên và tương phản cao.',
    descriptionEn: 'Ruby XL HD is a handheld electronic magnifier that helps people with low vision read books, documents, and labels. 5-inch HD screen, 2x-14x zoom, LED lighting, natural color and high contrast modes.',
    category: 'sensory-vision',
    brand: 'Freedom Scientific',
    productUrl: 'https://www.enhancedvision.com/ruby-xl-hd.html',
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=400&fit=crop',
  },
];

async function main() {
  console.log('🚀 Inserting AAC products into database...\n');

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  
  let inserted = 0;
  let skipped = 0;

  for (const product of AAC_PRODUCTS) {
    // Check if product already exists
    const existing = db.prepare('SELECT id FROM kb_products WHERE id = ?').get(product.id);
    if (existing) {
      console.log(`⏭️  Skipped: ${product.title} (already exists)`);
      skipped++;
      continue;
    }

    try {
      db.prepare(`
        INSERT INTO kb_products 
        (id, title, title_en, description, description_en, content, content_en, 
         category, brand, model, price_range, source_url, product_url, image_url, 
         iso_codes, status, featured, language, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.id,
        product.title,
        product.titleEn,
        product.description,
        product.descriptionEn,
        product.description,
        product.descriptionEn,
        product.category,
        product.brand,
        product.id,
        'Liên hệ nhà cung cấp',
        product.productUrl,
        product.productUrl,
        product.imageUrl,
        '[]',
        'published',
        1,
        'en',
        now,
        now
      );

      console.log(`✅ Inserted: ${product.title} (${product.brand})`);
      inserted++;
    } catch (err: any) {
      console.log(`❌ Error inserting ${product.title}: ${err.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);

  db.close();
  console.log('\n🎉 Done!');
}

main().catch(console.error);
