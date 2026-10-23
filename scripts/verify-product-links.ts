/**
 * Kiểm tra link sản phẩm: gọi HTTP cho MỌI product_url trong DB, đối chiếu
 * <h1> của trang với `title` trong DB → phát hiện link chết / trỏ nhầm sản phẩm.
 *
 * Usage: npx tsx scripts/verify-product-links.ts
 */

import Database from 'better-sqlite3';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const CONCURRENCY = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .toLowerCase();
}

async function check(url: string, title: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      });
      if (!res.ok) {
        await sleep(600 * attempt);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      const h1 = $('.breadcrumbs').first().text().replace(/\s+/g, ' ').trim();
      const pageTitle = h1 ? h1 : $('h1').first().text().trim();
      return { url, title, status: res.status, pageTitle };
    } catch {
      await sleep(600 * attempt);
    }
  }
  return { url, title, status: 0, pageTitle: '' };
}

async function main() {
  const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
  const rows = db
    .prepare(
      `SELECT title, product_url, source_url FROM kb_products
       WHERE product_url LIKE 'http%' OR source_url LIKE 'http%'`
    )
    .all() as any[];
  db.close();

  // Mỗi URL unique, lấy title tương ứng
  const byUrl = new Map<string, string>();
  for (const r of rows) {
    const u = r.product_url || r.source_url;
    if (u && u.startsWith('http') && !byUrl.has(u)) byUrl.set(u, r.title);
  }

  const urls = [...byUrl.keys()];
  console.log(`🔗 Kiểm tra ${urls.length} link sản phẩm...\n`);

  const results: any[] = [];
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      const u = urls[i];
      const r = await check(u, byUrl.get(u)!);
      results.push(r);
      process.stdout.write(`   ${results.length}/${urls.length}\r`);
    }
  });
  await Promise.all(workers);

  const dead = results.filter((r) => r.status !== 200);
  // So khớp title: bỏ qua khi site đổi slug (title DB khác nhưng vẫn là 1 trang hợp lệ)
  const mismatched = results.filter(
    (r) =>
      r.status === 200 &&
      norm(r.pageTitle) &&
      !norm(r.pageTitle).includes(norm(r.title)) &&
      !norm(r.title).includes(norm(r.pageTitle))
  );

  console.log(`\n\n✅ HTTP 200:      ${results.length - dead.length}/${results.length}`);
  console.log(`❌ Link chết:      ${dead.length}`);
  console.log(`⚠️  Lệch <h1>:      ${mismatched.length}`);

  if (dead.length) {
    console.log(`\n❌ Link chết:`);
    dead.forEach((d) => console.log(`   ${d.status || 'ERR'}  ${d.title}  →  ${d.url}`));
  }
  if (mismatched.length) {
    console.log(`\n⚠️  Trang trả về tiêu đề khác (kiểm tra tay):`);
    mismatched.forEach((d) => console.log(`   DB: ${d.title}\n       Trang: ${d.pageTitle}\n       ${d.url}`));
  }
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
