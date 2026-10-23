/**
 * Backfill nội dung sản phẩm MADA từ website at.mada.org.qa
 *
 * ⚠️ VÌ SAO CẦN:
 * 257/319 sản phẩm trong `kb_products` có `content` RỖNG và `description`
 * chỉ chứa `"Operating System: Other"`. Nguyên nhân gốc:
 *   1) `syncKbProducts.ts` dựng `content` từ `product.description` (bỏ qua `product.content`)
 *   2) 257 sản phẩm chưa từng được scrape detail → không có nội dung nào ở DB
 *
 * Hệ quả: vector store index toàn bộ chuỗi vô nghĩa ("Operating System: Other")
 * → rerank score ~0.01 → threshold 0.5 loại hết → RAG không có context
 * → bot trả lời "không có thông tin chi tiết".
 *
 * Script này scrape lại trang chi tiết từng sản phẩm và điền `content` +
 * `description` thật vào `kb_products`.
 *
 * Usage:
 *   npx tsx scripts/backfill-product-content.ts              # chỉ sản phẩm thiếu
 *   npx tsx scripts/backfill-product-content.ts --all        # sản phẩm thiếu + sửa mô tả rỗng
 *   npx tsx scripts/backfill-product-content.ts --force       # scrape lại tất cả
 *   npx tsx scripts/backfill-product-content.ts --limit 20   # giới hạn số lượng (test)
 */

import Database from 'better-sqlite3';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mada.db');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'mada.db.bak-backfill');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const MIN_CONTENT_LEN = 80;

/** Ánh xạ kb_products.category → (madaCategory, botId) khớp với kb_categories */
const CATEGORY_TO_MADA: Record<string, { madaCategory: string; botId: string }> = {
  hearing: { madaCategory: 'sensory-hearing', botId: 'bot-hearing' },
  vision: { madaCategory: 'sensory-vision', botId: 'bot-vision' },
  'voice-and-speech': { madaCategory: 'voice-and-speech', botId: 'bot-speech' },
  cognition: { madaCategory: 'mental-cognitive', botId: 'bot-cognitive' },
  mobility: { madaCategory: 'neuromusculoskeletal-movement', botId: 'bot-neuro' },
  daily_living: { madaCategory: 'mobility-and-transportation', botId: 'bot-mobility' },
  education: { madaCategory: 'regulatory-standards', botId: 'bot-regulatory' },
};

interface ProductRow {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  product_url: string;
  source_url: string;
}

/** Chuẩn hoá text: bỏ HTML, gộp khoảng trắng, bỏ comment HTML của WordPress */
function cleanText(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bỏ các đoạn metadata vô nghĩa đầu nội dung ("Operating System: Other", ...) */
function stripBoilerplate(text: string): string {
  const lines = text
    .split(/(?<=-->)\s*|\s{2,}/)
    .map((l) => l.trim())
    .filter(Boolean);

  const meaningful = lines.filter((line) => {
    if (line.length < 15) return false;
    if (/^(Availability at Mada Center|Operating System|Manufacturer|SKU|Availability)\b/i.test(line)) return false;
    if (/^(In-Stock|Out of Stock|Pre-Order)$/i.test(line)) return false;
    return true;
  });

  return (meaningful.length > 0 ? meaningful.join(' ') : text).trim();
}

/** Lấy nội dung thật từ trang chi tiết sản phẩm */
async function fetchProductContent(url: string): Promise<{ title?: string; description: string; content: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = cleanText($('h1.entry-title').first().text() || $('h1').first().text());

    // Nội dung chính nằm trong .entry-content
    let raw = '';
    const entry = $('.entry-content').first();
    if (entry.length > 0) {
      raw = entry.text();
    } else {
      const p = $('.post-content').first();
      if (p.length > 0) raw = p.text();
    }

    const cleaned = stripBoilerplate(cleanText(raw));
    if (cleaned.length < MIN_CONTENT_LEN) return null;

    // description = 500 ký tự đầu, content = toàn bộ
    return {
      title: title || undefined,
      description: cleaned.slice(0, 500),
      content: cleaned,
    };
  } catch (err) {
    console.warn(`   ⚠️  ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const all = args.includes('--all');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  console.log('🚀 Backfill nội dung sản phẩm MADA\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Không tìm thấy DB: ${DB_PATH}`);
    process.exit(1);
  }

  // Backup DB trước khi sửa
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log(`💾 Đã backup DB → ${path.basename(BACKUP_PATH)}\n`);
  }

  const db = new Database(DB_PATH);

  let rows = db.prepare(`
    SELECT id, title, description, content, category, product_url, source_url
    FROM kb_products
    WHERE status = 'published' AND (product_url LIKE 'http%' OR source_url LIKE 'http%')
    ORDER BY category, title
  `).all() as ProductRow[];

  // Lọc theo nhu cầu
  if (force) {
    // tất cả
  } else if (all) {
    rows = rows.filter(
      (r) => (r.content || '').length < MIN_CONTENT_LEN || (r.description || '').length < MIN_CONTENT_LEN
    );
  } else {
    rows = rows.filter((r) => (r.content || '').length < MIN_CONTENT_LEN);
  }

  if (rows.length > limit) rows = rows.slice(0, limit);

  console.log(`📦 Cần scrape: ${rows.length} sản phẩm\n`);

  const updateStmt = db.prepare(`
    UPDATE kb_products
    SET description = ?,
        content = ?,
        updated_at = ?
    WHERE id = ?
  `);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const url = row.product_url || row.source_url;
    process.stdout.write(`   → ${row.title} ... `);

    const scraped = await fetchProductContent(url);
    if (!scraped) {
      console.log('❌ không lấy được nội dung');
      fail++;
      failures.push(row.title);
      // tránh spam request lỗi liên tiếp
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    updateStmt.run(
      scraped.description,
      scraped.content,
      new Date().toISOString(),
      row.id
    );
    ok++;
    console.log(`✅ ${scraped.content.length} ký tự`);

    // Rate-limit nhẹ để không bị chặn
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n📊 Kết quả:`);
  console.log(`   ✅ Thành công: ${ok}`);
  console.log(`   ⏭️  Bỏ qua (không đủ nội dung): ${skip}`);
  console.log(`   ❌ Thất bại: ${fail}`);
  if (failures.length > 0) {
    console.log(`   Thất bại: ${failures.slice(0, 10).join(', ')}${failures.length > 10 ? '…' : ''}`);
  }

  // Thống kê sau backfill
  const stats = db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN length(COALESCE(content,'')) >= ? THEN 1 ELSE 0 END) as with_content
       FROM kb_products WHERE status = 'published'`
    )
    .get(MIN_CONTENT_LEN) as { total: number; with_content: number };

  console.log(`\n📈 kb_products: ${stats.with_content}/${stats.total} sản phẩm có nội dung thật`);

  db.close();
  console.log('\n🎉 Xong! Bước tiếp theo: chạy reindex để đưa nội dung mới vào vector store.');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
