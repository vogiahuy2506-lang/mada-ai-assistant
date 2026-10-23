/**
 * Crawl danh sách sản phẩm theo TỪNG category archive của site MADA.
 *
 * ⚠️ VÌ SAO CẦN (phát hiện mới):
 * - Breadcrumb trên trang sản phẩm chỉ hiện **1** category (category cha của
 *   sản phẩm), nhưng site lại liệt kê sản phẩm đó ở **nhiều** category archive
 *   khác nhau. Ví dụ:
 *     - `Hitch 2.0`  → breadcrumb: Body Function > Neuromusculoskeletal Movement
 *       nhưng cũng nằm trong archive Mobility & Transportation.
 *     - `EduMic`     → breadcrumb: Activities and Participation > Recreation and Leisure
 *       nhưng cũng nằm trong archive Sensory – Hearing.
 * - Nếu chỉ tin breadcrumb thì sẽ GÁN SAI category cho rất nhiều sản phẩm
 *   (ví dụ 27 sản phẩm "hearing" của ta thực ra nằm ở Communication /
 *   Recreation & Leisure theo site).
 *
 * Vì vậy script này lấy **membership đầy đủ** từ các trang archive
 * (có phân trang), rồi ghi ra `data/mada-product-categories.json`:
 *   { "<product_url>": ["<db_category>", ...] }
 *
 * Usage:
 *   npx tsx scripts/crawl-product-categories.ts
 */

import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'mada-product-categories.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/** Archive URL của từng db_category (khớp kb_categories.related_url) */
const CATEGORY_ARCHIVES: { dbCategory: string; url: string }[] = [
  { dbCategory: 'vision', url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/' },
  { dbCategory: 'hearing', url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/' },
  { dbCategory: 'mobility', url: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/' },
  { dbCategory: 'cognition', url: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/' },
  { dbCategory: 'voice-and-speech', url: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/' },
  { dbCategory: 'daily_living', url: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/' },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string | null> {
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
      return await res.text();
    } catch {
      await sleep(800 * attempt);
    }
  }
  return null;
}

/** Lấy tất cả link sản phẩm + link trang kế tiếp từ 1 trang archive */
function parseArchive(html: string): { products: string[]; nextPage: string | null } {
  const $ = cheerio.load(html);

  // ⚠️ Phải dùng .get() để có mảng JS thuần — `.filter()` của cheerio dùng
  // callback (index, element) chứ không phải predicate 1-arg như Array.filter.
  const hrefs = $('a[href*="/technology/"]')
    .map((_, a) => $(a).attr('href') || '')
    .get();

  // Chỉ link có dạng /technology/<slug>/ (bỏ /technology-category/...)
  const products = [
    ...new Set(
      hrefs
        .filter((h) => /\/technology\/[^/]+\/?$/.test(h))
        .map((h) => h.replace(/\/+$/, '') + '/')
    ),
  ];

  // Trang kế tiếp: /page/N/ — lấy số lớn nhất
  let maxPage = 1;
  $('a[href*="/page/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const m = href.match(/\/page\/(\d+)\/?/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
  });

  return { products, nextPage: maxPage > 1 ? `PAGE:${maxPage}` : null };
}

async function main() {
  console.log('🗂️  Crawl membership sản phẩm theo category archive\n');

  const membership: Record<string, string[]> = {};
  const stats: Record<string, number> = {};

  for (const cat of CATEGORY_ARCHIVES) {
    // Thu thập tất cả link sản phẩm qua các trang
    const all = new Set<string>();
    let maxPage = 1;

    // Trang 1: biết tổng số trang
    const first = await fetchHtml(cat.url);
    if (!first) {
      console.log(`   ⚠️  ${cat.dbCategory}: không tải được trang 1, bỏ qua`);
      continue;
    }
    parseArchive(first).products.forEach((p) => all.add(p));

    // Tìm số trang lớn nhất từ link phân trang
    const pageLinks = [...first.matchAll(/\/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10));
    if (pageLinks.length) maxPage = Math.max(...pageLinks);

    for (let p = 2; p <= maxPage; p++) {
      const url = cat.url.replace(/\/?$/, '/') + `page/${p}/`;
      const html = await fetchHtml(url);
      if (!html) {
        console.log(`   ⚠️  ${cat.dbCategory} page ${p}: fail`);
        continue;
      }
      parseArchive(html).products.forEach((x) => all.add(x));
    }

    for (const url of all) {
      if (!membership[url]) membership[url] = [];
      if (!membership[url].includes(cat.dbCategory)) membership[url].push(cat.dbCategory);
    }
    stats[cat.dbCategory] = all.size;
    console.log(`   ${cat.dbCategory.padEnd(17)} ${all.size} sản phẩm (${maxPage} trang)`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(membership, null, 2));

  const multi = Object.values(membership).filter((v) => v.length > 1).length;
  console.log(`\n📊 Tổng sản phẩm unique: ${Object.keys(membership).length}`);
  console.log(`   Thuộc >1 category:    ${multi}`);
  console.log(`💾 Ghi → ${path.basename(OUT_PATH)}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
