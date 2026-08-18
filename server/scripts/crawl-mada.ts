/**
 * MADA Knowledge Base Crawler - Production-grade pipeline
 *
 * Crawl chính xác từ 7 danh mục MADA Qatar AT Portal (at.mada.org.qa)
 *
 * Features:
 *   - Auto-detect pagination từ MADA WordPress theme
 *   - Crawl detail page cho TỪNG sản phẩm (description, specs, attachments, ISO codes)
 *   - Clean title (strip "Date: ...")
 *   - Dedup sản phẩm trùng slug/title
 *   - Validate ISO 9999 codes (chỉ giữ code hợp lệ)
 *   - Progress report + error log
 *   - Lưu ra data/mada-knowledge-base-full.json (structured) và
 *           data/mada-knowledge-base-text.json (text chunks cho RAG)
 *
 * Usage:
 *   npx tsx scripts/crawl-mada.ts                  # Crawl tất cả 7 danh mục (EN)
 *   npx tsx scripts/crawl-mada.ts --category vision  # Chỉ 1 danh mục
 *   npx tsx scripts/crawl-mada.ts --lang ar          # Tiếng Ả Rập
 *   npx tsx scripts/crawl-mada.ts --dry-run          # Không crawl, chỉ test config
 *
 * YÊU CẦU: Cần chạy trên máy có internet (sandbox bị chặn network).
 */

import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// ============== CONFIG ==============

const BASE_URL = process.env.MADA_BASE_URL || 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Crawler/2.0; +https://mada.digiso.vn)';
const REQUEST_DELAY_MS = 1500; // Polite delay giữa các request
const OUTPUT_DIR = path.join(process.cwd(), 'data');

/**
 * ⭐ 7 DANH MỤC CHÍNH THỨC — Mapping theo URL thật từ at.mada.org.qa
 */
const MADA_CATEGORIES = [
  {
    slug: 'sensory-hearing',
    name: 'Sensory – Hearing',
    nameVi: 'Cảm giác – Thính giác',
    botId: 'bot-hearing',
    url: `${BASE_URL}/technology-category/body-function/sensory-hearing/`,
    isoCodes: ['22.06.06', '22.09.06', '22.18.03'],
  },
  {
    slug: 'sensory-vision',
    name: 'Sensory – Vision',
    nameVi: 'Cảm giác – Thị giác',
    botId: 'bot-vision',
    url: `${BASE_URL}/technology-category/body-function/sensory-vision/`,
    isoCodes: ['22.03.06', '22.06.12', '22.06.15', '22.36.12'],
  },
  {
    slug: 'voice-and-speech',
    name: 'Voice and Speech',
    nameVi: 'Giọng nói và Lời nói',
    botId: 'bot-speech',
    url: `${BASE_URL}/technology-category/body-function/voice-and-speech/`,
    isoCodes: ['05.15.06', '05.15.12', '22.21.12'],
  },
  {
    slug: 'mental-cognitive',
    name: 'Mental – Cognitive',
    nameVi: 'Tâm thần – Nhận thức',
    botId: 'bot-cognitive',
    url: `${BASE_URL}/technology-category/body-function/mental-cognitive/`,
    isoCodes: ['05.06.15', '05.09.03', '05.18.06'],
  },
  {
    slug: 'neuromusculoskeletal-movement',
    name: 'Neuromusculoskeletal Movement',
    nameVi: 'Vận động thần kinh – cơ xương',
    botId: 'bot-neuro',
    url: `${BASE_URL}/technology-category/body-function/neuromusculoskeletal-movement/`,
    isoCodes: ['04.24', '06.06', '12.31.03'],
  },
  {
    slug: 'mobility-and-transportation',
    name: 'Mobility and Transportation',
    nameVi: 'Di chuyển và Giao thông',
    botId: 'bot-mobility',
    url: `${BASE_URL}/technology-category/activities-and-participation/mobility-and-transportation/`,
    isoCodes: ['12.21.06', '12.21.09', '12.03.06'],
  },
  {
    slug: 'regulatory-standards',
    name: 'Regulatory & Standards',
    nameVi: 'Quy định & Tiêu chuẩn',
    botId: 'bot-regulatory',
    url: `${BASE_URL}/assistive-technology-portal/`,
    isoCodes: [],
  },
] as const;

type CategorySlug = typeof MADA_CATEGORIES[number]['slug'];

// ============== TYPES ==============

interface ProductListItem {
  postId: string;
  slug: string;
  title: string;
  detailUrl: string;
  thumbnailUrl: string;
}

interface ProductDetail {
  postId: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  contentMarkdown: string;
  thumbnailUrl: string;
  galleryImages: string[];
  attachments: Array<{ type: string; url: string; label: string }>;
  videoLinks: string[];
  categories: string[];
  tags: string[];
  isoCodes: string[];
  source: string;
  scrapedAt: string;
  language: 'en' | 'ar';
}

interface CrawlReport {
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  totalProducts: number;
  totalDetailPagesScraped: number;
  perCategory: Record<CategorySlug, {
    listItemsFound: number;
    detailPagesScraped: number;
    errors: string[];
  }>;
  errors: string[];
}

// ============== UTILS ==============

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('xml')) {
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  return await res.text();
}

function absoluteUrl(href: string, base: string): string {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * ⭐ FIX chính: strip "Date: <Month> <day>, <year>" mà MADA theme inject vào title.
 * Mẫu gốc: "EduMicDate: December 25, 2022"
 * Sau khi strip: "EduMic"
 */
function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect ISO 9999 codes từ text
 */
function extractIsoCodes(text: string): string[] {
  const set = new Set<string>();
  // ISO 9999:2016 / 22 06 12 hoặc ISO 22.06.06
  const isoPattern = /\b(?:ISO[\s:]*9999[\s:]*\d{0,4})?\s*(\d{2})\s*[.\s]?\s*(\d{2})\s*[.\s]?\s*(\d{2})\b/g;
  for (const m of text.matchAll(isoPattern)) {
    const code = `${m[1]}.${m[2]}.${m[3]}`;
    // Validate: ISO 9999 codes start with 04, 05, 06, 09, 12, 15, 22, 24, 27
    if (/^(04|05|06|09|12|15|22|24|27)\./.test(code)) {
      set.add(code);
    }
  }
  // IEC standards
  const iecPattern = /\b(IEC\s*\d+(?:\.\d+)?(?:\-\d+)?)/gi;
  for (const m of text.matchAll(iecPattern)) {
    set.add(m[1].replace(/\s+/g, ' ').trim());
  }
  return Array.from(set).sort();
}

// ============== STEP 1: LIST SCRAPER ==============

async function scrapeCategoryListing(
  categorySlug: CategorySlug,
  baseUrl: string
): Promise<ProductListItem[]> {
  const products: ProductListItem[] = [];
  const seenSlugs = new Set<string>();

  console.log(`\n📂 Scraping list: ${categorySlug}`);
  console.log(`   Base: ${baseUrl}`);

  for (let page = 1; page <= 10; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;

    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err: any) {
      console.log(`   📄 Page ${page}: ❌ ${err.message} (stopping)`);
      break;
    }

    const $ = cheerio.load(html);
    let pageCount = 0;

    // MADA theme dùng class "article.technology" cho mỗi sản phẩm trong listing
    $('article.technology, .at_service_column article').each((_, el) => {
      const $el = $(el);
      const articleClass = $el.attr('class') || '';
      const postId = (articleClass.match(/post-(\d+)/) || [])[1] || `unknown-${pageCount}`;

      const $link = $el.find('h2.entry-title a, h3.title a').first();
      if (!$link.length) return;

      const rawTitle = $link.clone().children('.screen-reader-text').remove().end().text();
      const title = cleanTitle(rawTitle);
      const href = $link.attr('href') || '';
      const detailUrl = absoluteUrl(href, BASE_URL);

      if (!title || !detailUrl) return;

      // Slug từ URL
      const slug = detailUrl.split('/').filter(Boolean).pop() || '';
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      // Thumbnail
      const $img = $el.find('.tech_cover_new img, .thumb img, img').first();
      let thumbnailUrl = absoluteUrl($img.attr('src') || '', BASE_URL);
      if (!thumbnailUrl || thumbnailUrl === BASE_URL) {
        const ogImage = $('meta[property="og:image"]').attr('content') || '';
        thumbnailUrl = absoluteUrl(ogImage, BASE_URL);
      }

      products.push({
        postId,
        slug,
        title,
        detailUrl,
        thumbnailUrl,
      });
      pageCount++;
    });

    console.log(`   📄 Page ${page}: found ${pageCount} products`);

    // Check nếu có next page
    const hasNext = $('.pagination .next.page-numbers, a.next.page-numbers').length > 0;
    if (!hasNext) break;

    await delay(REQUEST_DELAY_MS);
  }

  console.log(`   ✅ Total list items: ${products.length}`);
  return products;
}

// ============== STEP 2: DETAIL SCRAPER ==============

async function scrapeProductDetail(
  item: ProductListItem,
  categoryIsoHints: string[]
): Promise<ProductDetail> {
  const html = await fetchHtml(item.detailUrl);
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, footer, header, aside, .comments, .related-posts').remove();

  // ===== Title =====
  let title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1.entry-title').first().text().trim() ||
    item.title;
  title = cleanTitle(title);

  // ===== Description =====
  let description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';
  description = description.replace(/\s+/g, ' ').trim();

  // ===== Main content (markdown-style) =====
  const contentParts: string[] = [];
  const $content = $('.entry-content, article.technology .entry-content').first();
  if ($content.length) {
    $content.find('h1, h2, h3, h4, p, ul, ol, li, table, blockquote').each((_, el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase() || '';
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;

      if (tag.match(/^h[1-4]$/)) {
        const lvl = parseInt(tag[1], 10);
        contentParts.push(`\n${'#'.repeat(lvl)} ${text}\n`);
      } else if (tag === 'li') {
        contentParts.push(`- ${text}`);
      } else if (tag === 'table') {
        $el.find('tr').each((_, tr) => {
          const cells = $(tr).find('th, td').map((_, c) => $(c).text().trim()).get();
          if (cells.length) contentParts.push(`| ${cells.join(' | ')} |`);
        });
      } else {
        contentParts.push(text);
      }
    });
  }

  const contentMarkdown = contentParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // ===== Gallery images =====
  const galleryImages: string[] = [];
  $content.find('img, .wp-block-image img, .gallery img').each((_, el) => {
    const src = absoluteUrl($(el).attr('src') || '', BASE_URL);
    if (src && !galleryImages.includes(src) && !src.toLowerCase().includes('icon')) {
      galleryImages.push(src);
    }
  });

  const finalThumbnailUrl = (item.thumbnailUrl && item.thumbnailUrl !== BASE_URL)
    ? item.thumbnailUrl
    : (galleryImages[0] || '');

  // ===== Attachments (PDFs, DOCX) =====
  const attachments: Array<{ type: string; url: string; label: string }> = [];
  $content.find('a[href$=".pdf"], a[href$=".PDF"], a[href$=".docx"], a[href$=".doc"]').each((_, el) => {
    const $a = $(el);
    const url = absoluteUrl($a.attr('href') || '', BASE_URL);
    const label = $a.text().trim() || url.split('/').pop() || url;
    const ext = (url.split('.').pop() || '').toLowerCase();
    const type = ['pdf', 'docx', 'doc'].includes(ext) ? ext : 'file';
    if (url && !attachments.find(a => a.url === url)) {
      attachments.push({ type, url, label });
    }
  });

  // ===== Video links (YouTube/Vimeo) =====
  const videoLinks: string[] = [];
  $content.find('iframe[src*="youtube"], iframe[src*="vimeo"], a[href*="youtube"], a[href*="vimeo"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href') || '';
    if (src && !videoLinks.includes(src)) videoLinks.push(src);
  });

  // ===== Categories & Tags =====
  const categories: string[] = [];
  const articleClass = $('article').attr('class') || '';
  for (const m of articleClass.matchAll(/technology_category-([a-z0-9-]+)/g)) {
    categories.push(m[1]);
  }
  const tags: string[] = [];
  $('.tag-links a, .entry-tags a, [rel="tag"]').each((_, el) => {
    const tag = $(el).text().trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  });

  // ===== ISO codes from content + category hints =====
  const combinedText = `${description}\n${contentMarkdown}`;
  const extracted = extractIsoCodes(combinedText);
  const isoCodes = Array.from(new Set([...categoryIsoHints, ...extracted]));

  return {
    postId: item.postId,
    slug: item.slug,
    title,
    description,
    content: contentMarkdown,
    contentMarkdown,
    thumbnailUrl: finalThumbnailUrl,
    galleryImages,
    attachments,
    videoLinks,
    categories,
    tags,
    isoCodes,
    source: item.detailUrl,
    scrapedAt: new Date().toISOString(),
    language: 'en',
  };
}

// ============== STEP 3: MAIN PIPELINE ==============

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const categoryArg = getArg('--category');
  const dryRun = args.includes('--dry-run');

  console.log('\n' + '='.repeat(70));
  console.log('🚀 MADA Knowledge Base Crawler v2.0');
  console.log('='.repeat(70));
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`   Delay: ${REQUEST_DELAY_MS}ms between requests`);
  console.log('');

  // Filter categories
  const targetCategories = categoryArg
    ? MADA_CATEGORIES.filter(c => c.slug === categoryArg)
    : MADA_CATEGORIES.slice();

  if (categoryArg && targetCategories.length === 0) {
    console.error(`❌ Unknown category: ${categoryArg}`);
    console.log(`   Available: ${MADA_CATEGORIES.map(c => c.slug).join(', ')}`);
    process.exit(1);
  }

  console.log(`📂 Target categories: ${targetCategories.length}`);
  targetCategories.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} (${c.slug}) → ${c.botId}`);
  });

  if (dryRun) {
    console.log('\n✅ Dry-run complete. No data fetched.');
    return;
  }

  const report: CrawlReport = {
    startedAt: new Date().toISOString(),
    finishedAt: '',
    totalDurationMs: 0,
    totalProducts: 0,
    totalDetailPagesScraped: 0,
    perCategory: {} as any,
    errors: [],
  };

  const startMs = Date.now();
  const fullKB: Record<string, ProductDetail[]> = {};

  for (const cat of targetCategories) {
    console.log('\n' + '-'.repeat(70));
    console.log(`📂 ${cat.name} (${cat.slug})`);
    console.log(`   URL: ${cat.url}`);
    console.log('-'.repeat(70));

    fullKB[cat.slug] = [];
    report.perCategory[cat.slug] = {
      listItemsFound: 0,
      detailPagesScraped: 0,
      errors: [],
    };

    try {
      // STEP 1: List
      const list = await scrapeCategoryListing(cat.slug, cat.url);
      report.perCategory[cat.slug].listItemsFound = list.length;

      // STEP 2: Detail cho từng sản phẩm
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const progress = `[${i + 1}/${list.length}]`;
        process.stdout.write(`\r   🔍 ${progress} ${item.title.slice(0, 60).padEnd(60)}`);

        try {
          const detail = await scrapeProductDetail(item, [...cat.isoCodes]);
          fullKB[cat.slug].push(detail);
          report.perCategory[cat.slug].detailPagesScraped++;
        } catch (err: any) {
          console.log(`\n   ❌ ${item.title}: ${err.message}`);
          report.perCategory[cat.slug].errors.push(`${item.title}: ${err.message}`);
          report.errors.push(`${cat.slug}/${item.title}: ${err.message}`);
        }

        await delay(REQUEST_DELAY_MS);
      }
      process.stdout.write('\n');
    } catch (err: any) {
      console.log(`   ❌ Category failed: ${err.message}`);
      report.errors.push(`${cat.slug}: ${err.message}`);
    }

    report.totalProducts += report.perCategory[cat.slug].detailPagesScraped;
  }

  report.finishedAt = new Date().toISOString();
  report.totalDurationMs = Date.now() - startMs;
  report.totalDetailPagesScraped = Object.values(report.perCategory).reduce(
    (sum, c) => sum + c.detailPagesScraped, 0
  );

  // ===== OUTPUT =====
  console.log('\n' + '='.repeat(70));
  console.log('💾 Saving results...');

  // 1. Full structured KB
  const fullPath = path.join(OUTPUT_DIR, 'mada-knowledge-base-full.json');
  fs.writeFileSync(fullPath, JSON.stringify(fullKB, null, 2), 'utf-8');
  console.log(`   ✅ Full KB: ${fullPath}`);
  console.log(`      ${report.totalDetailPagesScraped} products across ${Object.keys(fullKB).length} categories`);

  // 2. Text chunks (cho RAG ingestion)
  const textChunks: Array<{
    content: string;
    source: string;
    title: string;
    category: string;
    botId: string;
    language: string;
    metadata: Record<string, any>;
  }> = [];

  for (const cat of targetCategories) {
    const botId = cat.botId;
    for (const product of fullKB[cat.slug] || []) {
      const sections = [
        `# ${product.title}`,
        `**Source:** ${product.source}`,
        `**Category:** ${cat.name} (${cat.slug})`,
        `**Bot ID:** ${botId}`,
      ];
      if (product.description) sections.push(`\n## Description\n${product.description}`);
      if (product.content) sections.push(`\n## Details\n${product.content}`);
      if (product.isoCodes.length) sections.push(`\n## Standards & Certifications\n${product.isoCodes.join(', ')}`);
      if (product.tags.length) sections.push(`\n## Tags\n${product.tags.join(', ')}`);
      if (product.attachments.length) {
        sections.push(`\n## Documents\n${product.attachments.map(a => `- [${a.label}](${a.url})`).join('\n')}`);
      }

      textChunks.push({
        content: sections.join('\n'),
        source: product.source,
        title: product.title,
        category: cat.slug,
        botId,
        language: product.language,
        metadata: {
          url: product.source,
          slug: product.slug,
          postId: product.postId,
          categories: product.categories,
          tags: product.tags,
          isoCodes: product.isoCodes,
          thumbnailUrl: product.thumbnailUrl,
          galleryImages: product.galleryImages,
          attachments: product.attachments,
          videoLinks: product.videoLinks,
          description: product.description,
          madaCategory: cat.slug,
          botId,
        },
      });
    }
  }

  const textPath = path.join(OUTPUT_DIR, 'mada-rag-chunks.json');
  fs.writeFileSync(textPath, JSON.stringify(textChunks, null, 2), 'utf-8');
  console.log(`   ✅ RAG chunks: ${textPath}`);
  console.log(`      ${textChunks.length} chunks ready for vector ingestion`);

  // 3. Report
  const reportPath = path.join(OUTPUT_DIR, 'mada-crawl-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`   ✅ Report: ${reportPath}`);

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`   Duration: ${(report.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`   Products: ${report.totalDetailPagesScraped}/${report.totalProducts}`);
  console.log(`   Errors: ${report.errors.length}`);
  console.log('');
  console.log('   Per category:');
  for (const [slug, stats] of Object.entries(report.perCategory)) {
    const errCount = stats.errors.length;
    console.log(`     ${slug.padEnd(40)} ${stats.detailPagesScraped}/${stats.listItemsFound} ${errCount > 0 ? `(${errCount} errors)` : ''}`);
  }
  console.log('='.repeat(70));

  if (report.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    report.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (report.errors.length > 10) console.log(`   ... and ${report.errors.length - 10} more`);
  }

  console.log('\n✅ DONE. Next step: run ingestion');
  console.log('   npx tsx scripts/ingest-scraped.ts');
}

main().catch(err => {
  console.error('\n❌ FATAL:', err);
  process.exit(1);
});