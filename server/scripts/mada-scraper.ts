/**
 * MADA Assistive Technology Portal Scraper
 *
 * Scrapes product listings & detailed product pages from MADA Qatar AT Portal
 * https://at.mada.org.qa - WordPress + WPML (English / Arabic)
 *
 * Workflow:
 *  1. List category pages (paginated) → extract product list (slug, title, image URL, post ID)
 *  2. For each product → fetch its detail page → extract description, specs, attachments, similar products
 *  3. Convert to DataSource[] and ingest into Knowledge Base via dataIngestion
 *
 * Usage:
 *   npx tsx server/scripts/mada-scraper.ts --category sensory-hearing
 *   npx tsx server/scripts/mada-scraper.ts --category all
 *   npx tsx server/scripts/mada-scraper.ts --url https://at.mada.org.qa/technology/edumic/
 */

import * as cheerio from 'cheerio';
import { dataIngestion } from '../lib/rag/dataIngestion';
import type { DataSource } from '../lib/rag/dataIngestion';

// ============== CONFIG ==============

const BASE_URL = process.env.MADA_BASE_URL || 'https://at.mada.org.qa';
const USER_AGENT = 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)';

/**
 * MADA 7 Bot Categories
 * Mapping theo yêu cầu người dùng + URL thật từ at.mada.org.qa
 */
export const MADA_CATEGORIES = [
  {
    slug: 'sensory-hearing',
    name: 'Sensory – Hearing',
    nameVi: 'Cảm giác – Thính giác',
    bot: 'Bot 1: Sensory – Hearing',
    botId: 'bot-hearing',
    url: `${BASE_URL}/technology-category/body-function/sensory-hearing/`,
    description: 'Hearing aids, sound/visual alert devices, FM systems, personal sound amplifiers',
    isoCodes: ['22.06.06', '22.09.06', '22.18.03'],
    page: 3, // số trang phân trang (sẽ auto-detect khi chạy)
  },
  {
    slug: 'sensory-vision',
    name: 'Sensory – Vision',
    nameVi: 'Cảm giác – Thị giác',
    bot: 'Bot 2: Sensory – Vision',
    botId: 'bot-vision',
    url: `${BASE_URL}/technology-category/body-function/sensory-vision/`,
    description: 'Screen readers, magnifiers, braille devices, low-vision aids',
    isoCodes: ['22.03.06', '22.06.12', '22.06.15', '22.36.12'],
    page: 1,
  },
  {
    slug: 'voice-and-speech',
    name: 'Voice and Speech',
    nameVi: 'Giọng nói và Lời nói',
    bot: 'Bot 3: Voice and Speech',
    botId: 'bot-speech',
    url: `${BASE_URL}/technology-category/body-function/voice-and-speech/`,
    description: 'AAC devices, SGD, PECS, speech-generating devices',
    isoCodes: ['05.15.06', '05.15.12', '22.21.12'],
    page: 1,
  },
  {
    slug: 'mental-cognitive',
    name: 'Mental – Cognitive',
    nameVi: 'Tâm thần – Nhận thức',
    bot: 'Bot 4: Mental – Cognitive',
    botId: 'bot-cognitive',
    url: `${BASE_URL}/technology-category/body-function/mental-cognitive/`,
    description: 'Memory aids, planning tools, learning support for dementia, autism',
    isoCodes: ['05.06.15', '05.09.03', '05.18.06'],
    page: 1,
  },
  {
    slug: 'neuromusculoskeletal-movement',
    name: 'Neuromusculoskeletal Movement',
    nameVi: 'Vận động thần kinh – cơ xương',
    bot: 'Bot 5: Neuromusculoskeletal Movement',
    botId: 'bot-neuro',
    url: `${BASE_URL}/technology-category/body-function/neuromusculoskeletal-movement/`,
    description: 'Limb movement devices, fine motor aids, rehabilitation equipment',
    isoCodes: ['04.24', '06.06', '12.31.03'],
    page: 1,
  },
  {
    slug: 'mobility-and-transportation',
    name: 'Mobility and Transportation',
    nameVi: 'Di chuyển và Giao thông',
    bot: 'Bot 6: Mobility and Transportation',
    botId: 'bot-mobility',
    url: `${BASE_URL}/technology-category/activities-and-participation/mobility-and-transportation/`,
    description: 'Wheelchairs, walkers, smart canes, mobility aids (EU export standard)',
    isoCodes: ['12.21.06', '12.21.09', '12.03.06'],
    page: 1,
  },
  {
    slug: 'regulatory-standards',
    name: 'Regulatory & Standards',
    nameVi: 'Thông tin bổ trợ',
    bot: 'Bot 7: Regulatory & Standards',
    botId: 'bot-regulatory',
    url: `${BASE_URL}/assistive-technology-portal/`,
    description: 'Regulations, ISO/WHO/EU standards, safety certifications',
    isoCodes: [],
    page: 1,
  },
] as const;

export type MadaCategorySlug = typeof MADA_CATEGORIES[number]['slug'];

/**
 * Helper: Lấy category từ URL sản phẩm MADA
 */
export function extractCategoryFromUrl(url: string): string | null {
  for (const cat of MADA_CATEGORIES) {
    if (url.includes(cat.slug)) return cat.slug;
  }
  return null;
}

/**
 * Helper: Lấy botId từ category slug
 */
export function getBotIdForCategory(slug: string | null): string | null {
  if (!slug) return null;
  const cat = MADA_CATEGORIES.find(c => c.slug === slug);
  return cat?.botId || null;
}

// ============== TYPES ==============

export interface ProductListItem {
  postId: string;
  slug: string;
  title: string;
  detailUrl: string;
  thumbnailUrl: string;
  categories: string[];
  language: 'en' | 'ar';
}

export interface ProductDetail {
  postId: string;
  slug: string;
  title: string;
  content: string;          // HTML cleaned → text
  description: string;
  thumbnailUrl: string;
  galleryImages: string[];
  attachments: { type: string; url: string; label: string }[];
  videoLinks: string[];
  categories: string[];
  tags: string[];
  isoCodes: string[];       // ISO 9999 heuristic
  source: string;
  language: 'en' | 'ar';
  scrapedAt: string;
}

// ============== UTILS ==============

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  console.log(`   📥 Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Unsupported content-type: ${contentType} for ${url}`);
  }

  return await res.text();
}

/**
 * Convert Arabic-Indic digits, smart quotes, etc. → ASCII
 * (MADA content mixes English/Arabic content; we keep it as-is but normalise whitespace)
 */
function cleanWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]/g, ' ')
    .replace(/[ ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
 * Heuristic ISO 9999 codes extraction
 * Example: "ISO 9999:2016 / 22 06 12" or "IEC 60118"
 */
const ISO_REGEX = /(ISO\s*\d+(?::\d+)?(?:\/\d+)?(?:\/\d+)?(?:[-/]\d+)*)/gi;
const IEC_REGEX = /(IEC\s*\d+(?:\.\d+)?(?:\-\d+)?)/gi;
const CE_REGEX = /\b(CE[\s-]?Mark(?:ed)?|CE[\s-]?Certified)\b/gi;
const FDA_REGEX = /\b(FDA[\s-]?(?:Approved|Cleared))\b/gi;

function extractStandards(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(ISO_REGEX)) set.add(m[1].replace(/\s+/g, ' ').trim());
  for (const m of text.matchAll(IEC_REGEX)) set.add(m[1].replace(/\s+/g, ' ').trim());
  for (const m of text.matchAll(CE_REGEX)) set.add(m[1].trim());
  for (const m of text.matchAll(FDA_REGEX)) set.add(m[1].trim());
  return Array.from(set);
}

/**
 * Auto-detect số trang pagination từ URL category MADA
 * Trả về số trang lớn nhất tìm được (≥1)
 */
export async function detectTotalPages(
  categorySlug: string,
  language: 'en' | 'ar' = 'en'
): Promise<number> {
  const basePath = language === 'ar'
    ? `/ar/technology-category/body-function/${categorySlug}/`
    : `/technology-category/body-function/${categorySlug}/`;

  // URL cuối dùng tham khảo: nếu slug là regulatory-standards thì dùng URL portal
  const url = categorySlug === 'regulatory-standards'
    ? `${BASE_URL}/assistive-technology-portal/`
    : `${BASE_URL}${basePath}`;

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    let maxPage = 1;

    // Tìm tất cả link phân trang: /page/N/
    $('a[href*="/page/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/page\/(\d+)\/?/);
      if (match) {
        const p = parseInt(match[1], 10);
        if (p > maxPage) maxPage = p;
      }
    });

    // Fallback: tìm class page-numbers
    $('.page-numbers, .pagination a').each((_, el) => {
      const text = $(el).text().trim();
      const p = parseInt(text, 10);
      if (!isNaN(p) && p > maxPage) maxPage = p;
    });

    console.log(`   📄 Detected ${maxPage} page(s) for ${categorySlug}`);
    return maxPage;
  } catch (err: any) {
    console.warn(`   ⚠️  Could not detect pages for ${categorySlug}: ${err.message}`);
    return 1; // fallback
  }
}

// ============== STEP 1: LIST SCRAPER ==============

export async function scrapeCategoryListing(
  categorySlug: string,
  maxPages = 5,
  language: 'en' | 'ar' = 'en'
): Promise<ProductListItem[]> {
  const products: ProductListItem[] = [];
  const basePath = language === 'ar'
    ? `/ar/technology-category/body-function/${categorySlug}/`
    : `/technology-category/body-function/${categorySlug}/`;

  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1
      ? `${BASE_URL}${basePath}`
      : `${BASE_URL}${basePath}page/${page}/`;

    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err: any) {
      console.warn(`   ⚠️  Could not fetch page ${page}: ${err.message}`);
      break; // no more pages
    }

    const $ = cheerio.load(html);

    let pageCount = 0;
    $('.at_service_column.at_service_category article.technology').each((_, el) => {
      const $el = $(el);
      const article = $el.attr('class') || '';

      // Post ID
      const postId = (article.match(/post-(\d+)/) || [])[1] || `unknown-${pageCount}`;

      // Categories
      const categories: string[] = [];
      for (const m of article.matchAll(/technology_category-([a-z0-9-]+)/g)) {
        categories.push(m[1]);
      }

      // Title + URL
      const $link = $el.find('h2.entry-title a');
      // Get the link text but exclude the .screen-reader-text span content
      let title = $link.clone().children('.screen-reader-text').remove().end().text().replace(/\s+/g, ' ').trim();
      // ⭐ FIX: Remove trailing "Date: <Month> <day>, <year>" that MADA theme injects into h2
      title = title.replace(/\s*Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}.*$/i, '').trim();
      const href = $link.attr('href') || '';
      const detailUrl = absoluteUrl(href, BASE_URL);

      // Slug
      let slug = '';
      try {
        slug = detailUrl.split('/').filter(Boolean).pop() || '';
      } catch { /* ignore */ }

      // Thumbnail - try multiple selectors
      let thumbnailUrl = absoluteUrl(
        $el.find('.tech_cover_new img').attr('src') || '',
        BASE_URL
      );

      // Fallback: try og:image meta tag if tech_cover is empty
      if (!thumbnailUrl || thumbnailUrl === BASE_URL) {
        const ogImage = $('meta[property="og:image"]').attr('content') || '';
        if (ogImage) thumbnailUrl = absoluteUrl(ogImage, BASE_URL);
      }

      // Fallback: find first large image in content (attachment)
      if (!thumbnailUrl || thumbnailUrl === BASE_URL) {
        const firstImg = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
        if (firstImg && !firstImg.includes('icon')) {
          thumbnailUrl = absoluteUrl(firstImg, BASE_URL);
        }
      }

      if (title && detailUrl) {
        products.push({
          postId,
          slug,
          title,
          detailUrl,
          thumbnailUrl,
          categories,
          language,
        });
        pageCount++;
      }
    });

    console.log(`   📄 Page ${page}: found ${pageCount} products`);

    // Check if there's a next page
    const hasNext = $('.pagination .next.page-numbers').length > 0;
    if (!hasNext) break;

    // Be polite
    await delay(800);
  }

  return products;
}

// ============== STEP 2: DETAIL SCRAPER ==============

export async function scrapeProductDetail(item: ProductListItem): Promise<ProductDetail> {
  const html = await fetchHtml(item.detailUrl);
  const $ = cheerio.load(html);

  // ===== Title =====
  let title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1.entry-title').first().text().trim() ||
    item.title;
  // ⭐ FIX: strip trailing date from title (MADA theme leaks it in some templates)
  title = title.replace(/\s*Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}.*$/i, '').trim();

  // ===== Description =====
  let description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';
  description = description.replace(/\s*Date:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}.*$/i, '').trim();

  // ===== Main content (gutenberg blocks) =====
  const contentParts: string[] = [];
  const $content = $('.entry-content, .technology-content, article.technology .entry-content').first();
  if ($content.length) {
    $content.find('h1, h2, h3, h4, p, ul, ol, li, table').each((_, el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase() || '';
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;

      if (tag.match(/^h[1-4]$/)) {
        const lvl = parseInt(tag[1]);
        contentParts.push(`\n${'#'.repeat(lvl)} ${text}`);
      } else if (tag === 'li') {
        contentParts.push(`- ${text}`);
      } else if (tag === 'table') {
        // render table rows
        $el.find('tr').each((_, tr) => {
          const cells = $(tr).find('th, td').map((_, c) => $(c).text().trim()).get();
          if (cells.length) contentParts.push(`| ${cells.join(' | ')} |`);
        });
      } else {
        contentParts.push(text);
      }
    });
  }

  // ===== Gallery images =====
  const galleryImages: string[] = [];
  $content.find('img').each((_, el) => {
    const src = absoluteUrl($(el).attr('src') || '', BASE_URL);
    if (src && !galleryImages.includes(src) && !src.includes('icon')) galleryImages.push(src);
  });
  // also try wp-block-image
  $('.wp-block-image img, .gallery img').each((_, el) => {
    const src = absoluteUrl($(el).attr('src') || '', BASE_URL);
    if (src && !galleryImages.includes(src) && !src.includes('icon')) galleryImages.push(src);
  });

  // ✅ If listing thumbnailUrl is empty, use first gallery image
  const finalThumbnailUrl = (item.thumbnailUrl && item.thumbnailUrl !== BASE_URL)
    ? item.thumbnailUrl
    : (galleryImages[0] || '');

  // ===== Attachments (PDFs, DOCX, etc.) =====
  const attachments: { type: string; url: string; label: string }[] = [];
  $content.find('a[href$=".pdf"], a[href$=".PDF"], a[href$=".docx"], a[href$=".doc"]').each((_, el) => {
    const $a = $(el);
    const url = absoluteUrl($a.attr('href') || '', BASE_URL);
    const label = $a.text().trim() || $(el).attr('href')?.split('/').pop() || url;
    const ext = (url.split('.').pop() || '').toLowerCase();
    const type = ['pdf', 'docx', 'doc'].includes(ext) ? ext : 'file';
    if (url && !attachments.find(a => a.url === url)) {
      attachments.push({ type, url, label });
    }
  });

  // ===== Videos =====
  const videoLinks: string[] = [];
  $content.find('iframe[src*="youtube"], iframe[src*="vimeo"], video source, a[href*="youtube"], a[href*="vimeo"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href') || '';
    if (src && !videoLinks.includes(src)) videoLinks.push(src);
  });

  // ===== Tags =====
  const tags: string[] = [];
  $('.entry-tags a, .post-tags a, .technology-tags a').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !tags.includes(t)) tags.push(t);
  });

  // ===== Combined content =====
  const fullContent = cleanWhitespace(contentParts.join('\n'));

  // ===== ISO codes from content =====
  const isoCodes = extractStandards(`${title} ${description} ${fullContent}`);

  return {
    postId: item.postId,
    slug: item.slug,
    title,
    description,
    content: fullContent,
    thumbnailUrl: finalThumbnailUrl,
    galleryImages,
    attachments,
    videoLinks,
    categories: item.categories,
    tags,
    isoCodes,
    source: item.detailUrl,
    language: item.language,
    scrapedAt: new Date().toISOString(),
  };
}

// ============== STEP 3: CONVERT TO DATASOURCE ==============

export function productDetailToDataSource(p: ProductDetail): DataSource {
  // Build a richly structured "document" string for embedding
  const sections: string[] = [];
  sections.push(`# ${p.title}`);
  sections.push(`**Source:** ${p.source}`);
  sections.push(`**Category:** ${p.categories.join(', ')}`);
  sections.push(`**Language:** ${p.language}`);
  if (p.description) sections.push(`\n## Description\n${p.description}`);
  if (p.content) sections.push(`\n## Details\n${p.content}`);
  if (p.isoCodes.length) sections.push(`\n## Standards & Certifications\n${p.isoCodes.join(', ')}`);
  if (p.tags.length) sections.push(`\n## Tags\n${p.tags.join(', ')}`);
  if (p.attachments.length) {
    sections.push(`\n## Documents\n${p.attachments.map(a => `- [${a.label}](${a.url})`).join('\n')}`);
  }
  if (p.videoLinks.length) {
    sections.push(`\n## Videos\n${p.videoLinks.map(v => `- ${v}`).join('\n')}`);
  }

  const text = sections.join('\n');

  // Extract madaCategory + botId from source URL
  const madaCategory = extractCategoryFromUrl(p.source);
  const botId = getBotIdForCategory(madaCategory);

  return {
    type: 'web',
    content: text,
    source: p.source,
    title: p.title,
    language: p.language,
    metadata: {
      url: p.source,
      postId: p.postId,
      slug: p.slug,
      categories: p.categories,
      tags: p.tags,
      isoCodes: p.isoCodes,
      thumbnailUrl: p.thumbnailUrl,
      galleryImages: p.galleryImages,
      attachments: p.attachments,
      videoLinks: p.videoLinks,
      description: p.description,
      scrapedAt: p.scrapedAt,
      // ⭐ MỚI: gắn category + botId để RAG filter theo domain
      madaCategory,
      botId,
    },
  };
}

// ============== STEP 4: INGEST INTO KB ==============

export async function ingestProductDetail(p: ProductDetail): Promise<{
  success: boolean;
  message: string;
  taskId?: string;
  documentsAdded?: number;
}> {
  const ds = productDetailToDataSource(p);
  const result = await dataIngestion.ingestData(ds);
  return {
    success: result.success,
    message: result.message,
    taskId: result.taskId,
    documentsAdded: result.documentsAdded,
  };
}

// ============== MAIN ORCHESTRATOR ==============

interface RunOptions {
  categorySlug: string;
  maxPages?: number;
  language?: 'en' | 'ar';
  ingest?: boolean;
  onProgress?: (msg: string) => void;
}

export async function runMadaScraper(opts: RunOptions): Promise<{
  category: string;
  totalFound: number;
  totalScraped: number;
  totalIngested: number;
  errors: string[];
  duration: number;
}> {
  const start = Date.now();
  const errors: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    opts.onProgress?.(msg);
  };

  log(`\n${'='.repeat(70)}`);
  log(`🚀 MADA Scraper — Category: ${opts.categorySlug}`);
  log('='.repeat(70));

  // Step 1: List
  log(`\n📚 Step 1: Scraping category listing (${opts.language || 'en'})...`);
  const list = await scrapeCategoryListing(
    opts.categorySlug,
    opts.maxPages || 5,
    opts.language || 'en'
  );
  log(`✅ Found ${list.length} products`);

  let totalIngested = 0;
  let totalScraped = 0;

  // Step 2 + 3: Detail + Ingest
  log(`\n📖 Step 2: Scraping product details${opts.ingest ? ' + ingesting into KB' : ''}...`);
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const percent = ((i + 1) / list.length * 100).toFixed(1);
    log(`\n[${i + 1}/${list.length}] (${percent}%) ${item.title}`);

    try {
      const detail = await scrapeProductDetail(item);
      totalScraped++;

      if (detail.content.length < 50) {
        log(`   ⚠️  Skipping (content too short: ${detail.content.length} chars)`);
        continue;
      }

      log(`   📏 Content: ${detail.content.length} chars | Images: ${detail.galleryImages.length} | Docs: ${detail.attachments.length}`);
      if (detail.isoCodes.length) log(`   🏷️  Standards: ${detail.isoCodes.join(', ')}`);

      if (opts.ingest) {
        const result = await ingestProductDetail(detail);
        if (result.success && result.documentsAdded) {
          totalIngested += result.documentsAdded;
          log(`   ✅ Ingested: ${result.documentsAdded} chunks`);
        } else {
          log(`   ❌ Ingest failed: ${result.message}`);
          errors.push(`${item.title}: ${result.message}`);
        }
      }

      // Be polite
      await delay(1500);
    } catch (err: any) {
      log(`   ❌ Error: ${err.message}`);
      errors.push(`${item.title}: ${err.message}`);
    }
  }

  const duration = Date.now() - start;
  log(`\n${'='.repeat(70)}`);
  log(`📊 SUMMARY`);
  log(`   Category: ${opts.categorySlug}`);
  log(`   Found: ${list.length} | Scraped: ${totalScraped} | Ingested: ${totalIngested} chunks`);
  log(`   Errors: ${errors.length}`);
  log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
  log('='.repeat(70));

  return {
    category: opts.categorySlug,
    totalFound: list.length,
    totalScraped,
    totalIngested,
    errors,
    duration,
  };
}

// ============== CLI ==============

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const categorySlug = getArg('--category') || 'sensory-hearing';
  const maxPagesArg = getArg('--pages');
  const autoDetect = args.includes('--auto-pages') || !maxPagesArg;
  const maxPages = maxPagesArg ? parseInt(maxPagesArg) : 5;
  const language = (getArg('--lang') || 'en') as 'en' | 'ar';
  const ingest = args.includes('--ingest');

  if (categorySlug === 'all') {
    console.log('\n🌐 Scraping ALL categories...\n');
    for (const cat of MADA_CATEGORIES) {
      try {
        // Auto-detect pages trước
        let pages = maxPages;
        if (autoDetect) {
          console.log(`\n🔍 Auto-detecting pagination for ${cat.slug}...`);
          pages = await detectTotalPages(cat.slug, language);
        }
        await runMadaScraper({
          categorySlug: cat.slug,
          maxPages: pages,
          language,
          ingest,
        });
      } catch (err: any) {
        console.error(`❌ Category ${cat.slug} failed: ${err.message}`);
      }
      await delay(3000);
    }
  } else {
    // Auto-detect cho 1 category
    let pages = maxPages;
    if (autoDetect) {
      console.log(`\n🔍 Auto-detecting pagination for ${categorySlug}...`);
      pages = await detectTotalPages(categorySlug, language);
    }
    await runMadaScraper({
      categorySlug,
      maxPages: pages,
      language,
      ingest,
    });
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] || '');

if (isMainModule) {
  main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
}

export default {
  runMadaScraper,
  scrapeCategoryListing,
  scrapeProductDetail,
  productDetailToDataSource,
  ingestProductDetail,
  detectTotalPages,
  extractCategoryFromUrl,
  getBotIdForCategory,
  MADA_CATEGORIES,
};
