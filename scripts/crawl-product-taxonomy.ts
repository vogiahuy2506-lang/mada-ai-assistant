/**
 * Crawl taxonomy (breadcrumb) của từng sản phẩm trên at.mada.org.qa.
 *
 * Mục đích: biết CHÍNH XÁC site xếp sản phẩm vào category nào, để
 * gán `kb_products.category` đúng (hiện DB có 319 dòng nhưng chỉ 243 sản
 * phẩm unique, và nhiều sản phẩm nằm ở 2-3 category khác nhau).
 *
 * Site taxonomy KHÁC hệ thống bot của ta (7 bot), nên script chỉ thu thập
 * dữ liệu thô + thống kê, CHƯA gán — việc quyết định map sang bot do
 * `normalize-products.ts` đảm nhiệm.
 *
 * Usage:
 *   npx tsx scripts/crawl-product-taxonomy.ts          # crawl + cache
 *   npx tsx scripts/crawl-product-taxonomy.ts --force  # bỏ cache
 */

import Database from 'better-sqlite3';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'mada.db');
const CACHE_PATH = path.join(ROOT, 'data', 'mada-product-taxonomy.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const CONCURRENCY = 8;

/** Đọc breadcrumb → mảng các phân cấp category (vd: ['Body Function','Sensory – Vision']) */
async function fetchTaxonomy(url: string): Promise<string[] | null> {
  // Site đôi lúc trả lỗi/rate-limit khi crawl song song → thử lại nhiều lần
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        await sleep(800 * attempt);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      // Breadcrumb có cấu trúc: Home > Assistive Technology > Body Function > X
      const bc = $('.breadcrumbs').first();
      if (bc.length === 0) {
        await sleep(800 * attempt);
        continue;
      }

      const parts = bc
        .find('a, span')
        .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter(Boolean);

      // Bỏ "Home" và "Assistive Technology", giữ lại các cấp category thật
      const filtered = parts.filter(
        (p) => !/^home$/i.test(p) && !/^assistive technology$/i.test(p)
      );
      return filtered.length ? filtered : null;
    } catch {
      await sleep(800 * attempt);
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pool<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, size: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
  return results;
}

async function main() {
  const force = process.argv.includes('--force');

  console.log('🕸️  Crawl taxonomy sản phẩm từ site MADA\n');

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(
    `SELECT DISTINCT product_url FROM kb_products
     WHERE product_url LIKE 'http%' AND product_url != ''`
  ).all() as any[];
  db.close();

  // Lấy danh sách URL unique
  const urls = [...new Set(rows.map((r) => r.product_url))] as string[];
  console.log(`📦 ${urls.length} sản phẩm unique\n`);

  let cache: Record<string, string[] | null> = {};
  if (!force && fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    console.log(`💾 Cache có ${Object.keys(cache).length} mục\n`);
  }

  // Cần crawl: URL chưa có trong cache HOẶC trước đó crawl fail (null) → thử lại
  const todo = urls.filter((u) => !(u in cache) || cache[u] === null);
  if (todo.length > 0) {
    console.log(`🌐 Cần crawl: ${todo.length}\n`);
    let done = 0;

    await pool(
      todo,
      async (url) => {
        cache[url] = await fetchTaxonomy(url);
        done++;
        if (done % 25 === 0) {
          process.stdout.write(`   ${done}/${todo.length}\r`);
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
        }
      },
      CONCURRENCY
    );

    console.log(`\n   ${done}/${todo.length} xong`);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  }

  // Thống kê
  const leafCount: Record<string, number> = {};
  const fullCount: Record<string, number> = {};
  let nulls = 0;

  for (const url of urls) {
    const tax = cache[url];
    if (!tax || tax.length === 0) {
      nulls++;
      continue;
    }
    const leaf = tax[tax.length - 1];
    const full = tax.join(' > ');
    leafCount[leaf] = (leafCount[leaf] || 0) + 1;
    fullCount[full] = (fullCount[full] || 0) + 1;
  }

  console.log(`\n📊 Taxonomy theo leaf category (${Object.keys(leafCount).length} loại):`);
  for (const [k, v] of Object.entries(leafCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${v.toString().padStart(3)}  ${k}`);
  }

  console.log(`\n📊 Theo đường dẫn đầy đủ:`);
  for (const [k, v] of Object.entries(fullCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${v.toString().padStart(3)}  ${k}`);
  }

  console.log(`\n⚠️  Không đọc được breadcrumb: ${nulls}/${urls.length}`);
  console.log(`💾 Cache → ${path.basename(CACHE_PATH)}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
