// @ts-nocheck - Legacy functions kept for backward compatibility
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { vectorStore, chunkText, generateId } from './vectorStore';
import type { Document } from './vectorStore';
import db from '../db';
import { classifyContent } from './taxonomy';
import type { ATCategory } from './taxonomy';
import { extractImageText } from './ocrHelper';
import { parsePDFFile, parseDocxFile } from './fileParsers';

export interface IngestionResult {
  success: boolean;
  documentsAdded: number;
  taskId: string;
  message: string;
  itemId?: string;
  category?: ATCategory;
  isoCodes?: string[];
  confidence?: number;
}

export interface DataSource {
  type: 'pdf' | 'web' | 'text' | 'file' | 'image' | 'docx' | 'xlsx' | 'csv';
  content: string;        // text content hoặc absolute file path
  source: string;         // URL hoặc tên file
  title?: string;
  language?: string;
  metadata?: Record<string, any>;
  /** Web scrape options - nâng cấp để cào sâu và chi tiết */
  scrapeOptions?: {
    /** Follow cùng domain để lấy sub-pages (mặc định: true) */
    followLinks?: boolean;
    /** Độ sâu tối đa khi followLinks=true (mặc định: 3) */
    maxDepth?: number;
    /** Số trang tối đa khi followLinks=true (mặc định: 20) */
    maxPages?: number;
    /** Extract JSON-LD structured data (mặc định: true) */
    extractJsonLd?: boolean;
    /** Extract tables với cấu trúc (mặc định: true) */
    extractTables?: boolean;
    /** Extract metadata đầy đủ (mặc định: true) */
    extractMetadata?: boolean;
    /** Extract FAQs (mặc định: true) */
    extractFaqs?: boolean;
    /** Extract images + captions (mặc định: true) */
    extractImages?: boolean;
    /** Chờ giữa các request (ms, mặc định: 1000) */
    delayBetweenRequests?: number;
  };
}

interface ProgressReporter {
  (stage: string, progress: number, message?: string): void;
}

/** Kết quả scrape chi tiết */
interface DetailedScrapeResult {
  title: string;
  description: string;
  mainContent: string;
  structuredData: Record<string, any>;
  tables: string[];
  jsonLd: Record<string, any>[];
  faqs: Array<{ question: string; answer: string }>;
  images: Array<{ url: string; alt: string; caption?: string }>;
  metadata: Record<string, string>;
  links: Array<{ url: string; text: string; context?: string }>;
  rawHtml?: string;
}

/** Options for detailed scraping */
interface ScrapeOptions {
  followLinks: boolean;
  maxDepth: number;
  maxPages: number;
  extractJsonLd: boolean;
  extractTables: boolean;
  extractMetadata: boolean;
  extractFaqs: boolean;
  extractImages: boolean;
  delayBetweenRequests: number;
}

class DataIngestionService {
  /**
   * Lưu job vào DB và cập nhật tiến trình
   */
  private createJob(source: DataSource, userId?: string): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ingestion_jobs (id, source_type, source, title, status, progress, stage, created_by, created_at)
      VALUES (?, ?, ?, ?, 'processing', 5, 'Khởi tạo', ?, ?)
    `).run(id, source.type, source.source, source.title || null, userId || null, now);
    return id;
  }

  private updateJob(jobId: string, fields: Partial<{
    status: string; progress: number; stage: string;
    items_added: number; error: string; started_at: string; completed_at: string;
  }>): void {
    const allowed = ['status', 'progress', 'stage', 'items_added', 'error', 'started_at', 'completed_at'];
    const sets: string[] = [];
    const values: any[] = [];
    for (const k of allowed) {
      if (fields[k as keyof typeof fields] !== undefined) {
        sets.push(`${k} = ?`);
        values.push(fields[k as keyof typeof fields]);
      }
    }
    if (sets.length === 0) return;
    values.push(jobId);
    db.prepare(`UPDATE ingestion_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  async ingestData(
    source: DataSource,
    userId?: string,
    onProgress?: ProgressReporter
  ): Promise<IngestionResult> {
    const jobId = this.createJob(source, userId);
    this.updateJob(jobId, { started_at: new Date().toISOString(), progress: 10, stage: 'Đang tải nội dung' });
    onProgress?.('downloading', 10, 'Đang tải nội dung');

    console.log(`📥 Starting ingestion job: ${jobId} | type=${source.type} | source=${source.source}`);

    try {
      let content = '';
      let filePath: string | null = null;
      const title = source.title || this.deriveTitle(source.source);

      // ====== BƯỚC 1: Trích xuất nội dung theo loại ======
      switch (source.type) {
        case 'pdf':
          this.updateJob(jobId, { progress: 20, stage: 'Đang trích xuất PDF' });
          onProgress?.('parsing_pdf', 20, 'Đang trích xuất nội dung PDF');
          content = await parsePDFFile(source.content);
          filePath = source.content;
          break;

        case 'docx':
          this.updateJob(jobId, { progress: 20, stage: 'Đang trích xuất DOCX' });
          onProgress?.('parsing_docx', 20, 'Đang trích xuất nội dung Word');
          content = await parseDocxFile(source.content);
          filePath = source.content;
          break;

        case 'image':
          this.updateJob(jobId, { progress: 20, stage: 'Đang chạy OCR trên ảnh' });
          onProgress?.('ocr', 20, 'Đang chạy OCR trích xuất chữ từ ảnh');
          const ocrResult = await extractImageText(source.content);
          content = ocrResult.text;
          filePath = source.content;
          source.metadata = { ...source.metadata, ocr: ocrResult };
          break;

        case 'web':
          this.updateJob(jobId, { progress: 20, stage: 'Đang cào dữ liệu web' });
          onProgress?.('scraping', 20, 'Đang tải và phân tích trang web');
          
          // Merge defaults với options từ caller
          const scrapeOpts = {
            followLinks: true,
            maxDepth: 3,
            maxPages: 20,
            extractJsonLd: true,
            extractTables: true,
            extractMetadata: true,
            extractFaqs: true,
            extractImages: true,
            delayBetweenRequests: 1000,
            ...source.scrapeOptions,
          };
          
          if (source.content && source.content.trim().length > 100 && !source.scrapeOptions?.followLinks) {
            console.log(`📋 Using pre-scraped content for ${source.source} (${source.content.length} chars)`);
            content = source.content;
          } else {
            const scrapeResult = await this.scrapeWebContentDetailed(source.source, scrapeOpts);
            content = this.formatDetailedContent(scrapeResult);
            // Gắn metadata từ scrape
            // ⭐ Chọn thumbnail: ưu tiên từ scrapeResult.images hoặc OG:image metadata
            const ogImage = scrapeResult.metadata?.['og:image'] || scrapeResult.metadata?.['twitter:image'] || '';
            const firstImage = scrapeResult.images?.[0]?.url || '';
            const thumbnailUrl = ogImage || firstImage || source.metadata?.thumbnailUrl || '';
            
            source.metadata = {
              ...source.metadata,
              scrapeMetadata: scrapeResult.metadata,
              jsonLd: scrapeResult.jsonLd,
              tables: scrapeResult.tables,
              images: scrapeResult.images,
              faqs: scrapeResult.faqs,
              structuredData: scrapeResult.structuredData,
              thumbnailUrl, // ⭐ Lưu thumbnailUrl để getSuggestedProducts hiển thị hình ảnh
              galleryImages: scrapeResult.images?.map((img: any) => img.url).filter(Boolean) || [],
            };
          }
          break;

        case 'text':
        case 'file':
        default:
          content = source.content;
          break;
      }

      // ====== BƯỚC 2: Làm sạch ======
      this.updateJob(jobId, { progress: 50, stage: 'Đang làm sạch văn bản' });
      onProgress?.('cleaning', 50, 'Đang làm sạch và chuẩn hóa');
      content = this.cleanTextEnhanced(content);

      if (content.length < 30) {
        this.updateJob(jobId, {
          status: 'failed', progress: 100,
          error: 'Nội dung quá ngắn hoặc không trích xuất được',
          completed_at: new Date().toISOString(),
        });
        return {
          success: false, documentsAdded: 0, taskId: jobId,
          message: 'Nội dung quá ngắn (tối thiểu 30 ký tự) — kiểm tra file có phải ảnh scan chất lượng thấp không',
        };
      }

      // ====== BƯỚC 3: Phân loại tự động (Auto-classify) ======
      this.updateJob(jobId, { progress: 65, stage: 'Đang phân loại tự động' });
      onProgress?.('classifying', 65, 'Đang phân loại ISO 9999 / WCAG / WHO GATE');
      const classification = classifyContent(content);
      console.log(`🏷️  Classified as: ${classification.category} (confidence: ${classification.confidence})`);

      // ====== BƯỚC 4: Lưu knowledge_item vào DB ======
      this.updateJob(jobId, { progress: 75, stage: 'Đang lưu vào Knowledge Base' });
      onProgress?.('saving', 75, 'Đang lưu vào Knowledge Base');
      const itemId = uuidv4();
      const now = new Date().toISOString();
      
      // Tạo mô tả chi tiết từ structured data nếu có
      const enhancedDescription = this.generateEnhancedDescription(content, source.metadata);
      
      db.prepare(`
        INSERT INTO knowledge_items (
          id, title, description, content, source, source_type, url, file_path,
          category, iso_codes, wcag_level, who_gate_area, auto_classified, confidence,
          status, language, metadata, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `).run(
        itemId,
        title,
        enhancedDescription || content.slice(0, 500),
        content,
        source.source,
        source.type,
        source.metadata?.url || null,
        filePath,
        classification.category,
        JSON.stringify(classification.isoCodes),
        classification.wcag.level,
        classification.whoGATE.area,
        1,
        classification.confidence,
        source.language || 'vi',
        JSON.stringify({
          ...source.metadata,
          matchedKeywords: classification.matchedKeywords,
          allScores: classification.scores,
        }),
        userId || null,
        now,
        now
      );

      // ====== BƯỚC 5: Chunk + tạo vector ======
      this.updateJob(jobId, { progress: 85, stage: 'Đang vector hóa' });
      onProgress?.('embedding', 85, 'Đang tạo embedding và lưu vào Vector DB');
      
      // Sử dụng chunk lớn hơn để giữ context
      const chunks = chunkText(content, 1000, 200);
      console.log(`📦 Chunked "${title}" → ${chunks.length} chunks (${content.length} chars, lang=${source.language || 'vi'})`);
      
      if (chunks.length === 0) {
        this.updateJob(jobId, {
          status: 'failed', progress: 100,
          error: 'Chunking produced 0 chunks — content quá ngắn hoặc rỗng sau cleanText',
          completed_at: new Date().toISOString(),
        });
        return {
          success: false, documentsAdded: 0, taskId: jobId,
          message: 'Nội dung sau khi làm sạch quá ngắn (< 1 từ) — không thể chunk',
        };
      }
      
      const documents: Document[] = chunks.map((chunk) => ({
        id: generateId(),
        content: chunk,
        metadata: {
          source: source.source,
          type: source.type === 'docx' ? 'text' : (source.type === 'file' ? 'text' : (source.type === 'image' ? 'text' : source.type)),
          title,
          createdAt: now,
          itemId,
          category: classification.category,
          madaCategory: source.metadata?.madaCategory,
          botId: source.metadata?.botId,
          agentId: source.metadata?.agentId,
          thumbnailUrl: source.metadata?.thumbnailUrl,
          galleryImages: source.metadata?.galleryImages,
          postId: source.metadata?.postId,
          slug: source.metadata?.slug,
          product_url: source.metadata?.url,
          brand: source.metadata?.brand,
          // ⭐ NEW: Enhanced metadata for better RAG
          hasFaqs: (source.metadata?.faqs?.length || 0) > 0,
          hasTables: (source.metadata?.tables?.length || 0) > 0,
          hasImages: (source.metadata?.images?.length || 0) > 0,
          tableCount: source.metadata?.tables?.length || 0,
          faqCount: source.metadata?.faqs?.length || 0,
          imageCount: source.metadata?.images?.length || 0,
        },
      }));

      await vectorStore.addDocuments(documents);

      // Cập nhật indexed flag
      db.prepare(`UPDATE knowledge_items SET indexed = 1, indexed_at = ?, chunk_count = ? WHERE id = ?`)
        .run(now, chunks.length, itemId);

      // ====== BƯỚC 6: Hoàn tất ======
      this.updateJob(jobId, {
        status: 'completed', progress: 100, stage: 'Hoàn tất',
        items_added: 1, completed_at: now,
      });
      onProgress?.('done', 100, 'Hoàn tất');

      this.logIngestion(jobId, source, chunks.length);

      return {
        success: true,
        documentsAdded: chunks.length,
        taskId: jobId,
        itemId,
        message: `✅ Đã thêm "${title}" vào Knowledge Base — phân loại: ${classification.category} (${chunks.length} chunks)`,
        category: classification.category,
        isoCodes: classification.isoCodes.map(c => c.code),
        confidence: classification.confidence,
      };
    } catch (error: any) {
      console.error(`❌ Ingestion failed (${jobId}):`, error);
      this.updateJob(jobId, {
        status: 'failed', progress: 100,
        error: error.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      });
      return {
        success: false,
        documentsAdded: 0,
        taskId: jobId,
        message: `Lỗi: ${error.message || 'Unknown error'}`,
      };
    }
  }

  async ingestMultiple(
    sources: DataSource[],
    userId?: string
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];
    for (const source of sources) {
      const result = await this.ingestData(source, userId);
      results.push(result);
    }
    return results;
  }

  // ==================== ENHANCED SCRAPER ====================

  /**
   * ⭐ SCRAPER NÂNG CAO - Cào sâu và chi tiết nhất
   * 
   * Các cải tiến:
   * 1. Extract JSON-LD structured data (Schema.org)
   * 2. Extract tables với cấu trúc
   * 3. Extract metadata đầy đủ (OG, meta)
   * 4. Extract FAQs từ structured data và HTML
   * 5. Extract images với captions
   * 6. Extract internal links có giá trị cao
   * 7. Preserve document structure
   */
  private async scrapeWebContentDetailed(
    url: string,
    options: ScrapeOptions
  ): Promise<DetailedScrapeResult> {
    const {
      followLinks,
      maxDepth,
      maxPages,
      extractJsonLd: _extractJsonLd,
      extractTables: _extractTables,
      extractMetadata: _extractMetadata,
      extractFaqs: _extractFaqs,
      extractImages: _extractImages,
      delayBetweenRequests,
    } = options;

    // Google Sheets: chuyển sang CSV
    const sheetsCsv = googleSheetsToCsvUrl(url);
    if (sheetsCsv) {
      console.log(`📊 [scrape] Google Sheets detected → CSV export`);
      const csvContent = await this.fetchAndFormatCsv(sheetsCsv, url);
      return {
        title: this.extractTitleFromUrl(url),
        description: '',
        mainContent: csvContent,
        structuredData: {},
        tables: [csvContent],
        jsonLd: [],
        faqs: [],
        images: [],
        metadata: { source: url, type: 'google-sheets' },
        links: [],
      };
    }

    if (!followLinks) {
      // Single page scrape
      const html = await this.fetchHtmlWithRetry(url);
      return this.parseDetailedContent(html, url, options);
    }

    // ========== RECURSIVE CRAWL ==========
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];
    const results: DetailedScrapeResult[] = [];

    while (queue.length > 0 && results.length < maxPages) {
      const { url: curUrl, depth } = queue.shift()!;
      if (visited.has(curUrl)) continue;
      visited.add(curUrl);

      try {
        console.log(`🕷️ [crawl:${depth}] ${curUrl} (${results.length}/${maxPages})`);
        
        const html = await this.fetchHtmlWithRetry(curUrl);
        const parsed = this.parseDetailedContent(html, curUrl, options);
        results.push(parsed);

        // Extract sub-links nếu chưa đến depth limit
        if (depth < maxDepth) {
          const links = this.extractHighValueLinks(html, curUrl);
          for (const link of links) {
            if (!visited.has(link.url) && results.length + queue.length < maxPages * 2) {
              queue.push({ url: link.url, depth: depth + 1 });
            }
          }
        }

        // Delay giữa các request để tránh bị block
        if (delayBetweenRequests > 0) {
          await this.sleep(delayBetweenRequests);
        }
      } catch (err: any) {
        console.warn(`⚠️ [crawl] Failed ${curUrl}: ${err.message}`);
      }
    }

    console.log(`✅ [crawl] Completed: ${results.length} pages from ${url}`);

    // Merge tất cả kết quả
    return this.mergeDetailedResults(results);
  }

  /**
   * Fetch HTML với retry logic
   */
  private async fetchHtmlWithRetry(url: string, maxRetries = 3): Promise<string> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const ct = response.headers.get('content-type') || '';
        if (!ct.includes('text/html') && !ct.includes('xml')) {
          throw new Error(`Unsupported content-type: ${ct}`);
        }

        return await response.text();
      } catch (err: any) {
        if (attempt === maxRetries) throw err;
        console.warn(`⚠️ [fetch] Retry ${attempt}/${maxRetries} for ${url}: ${err.message}`);
        await this.sleep(1000 * attempt); // Exponential backoff
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * ⭐ PARSE CHI TIẾT - Trích xuất tất cả dữ liệu có giá trị
   */
  private parseDetailedContent(
    html: string,
    url: string,
    options: ScrapeOptions
  ): DetailedScrapeResult {
    const $ = cheerio.load(html);
    const baseUrl = new URL(url);

    // ===== 1. EXTRACT METADATA =====
    const metadata: Record<string, string> = {};
    
    // JSON-LD - declare outside conditional so it can be used in FAQ extraction
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const jsonLd: Record<string, any>[] = [];
    
    if (options.extractMetadata) {
      // Meta tags
      $('meta').each((_, el) => {
        const name = $(el).attr('name') || $(el).attr('property') || '';
        const content = $(el).attr('content') || '';
        if (name && content) {
          metadata[name] = content;
        }
      });

      // Link tags
      $('link').each((_, el) => {
        const rel = $(el).attr('rel') || '';
        const href = $(el).attr('href') || '';
        if (rel && href) {
          metadata[`link:${rel}`] = href;
        }
      });

      // JSON-LD parsing
      jsonLdScripts.each((_, el) => {
        try {
          const content = $(el).html() || '';
          const data = JSON.parse(content);
          jsonLd.push(Array.isArray(data) ? data[0] : data);
        } catch { /* ignore invalid JSON */ }
      });
      
      // Additional metadata
      metadata['pageUrl'] = url;
      metadata['pageDomain'] = baseUrl.hostname;
      metadata['crawledAt'] = new Date().toISOString();
    } else {
      // Still parse JSON-LD even if extractMetadata is false (for FAQ extraction)
      jsonLdScripts.each((_, el) => {
        try {
          const content = $(el).html() || '';
          const data = JSON.parse(content);
          jsonLd.push(Array.isArray(data) ? data[0] : data);
        } catch { /* ignore invalid JSON */ }
      });
    }

    // ===== 2. REMOVE NOISE =====
    $('script, style, noscript, iframe, svg, canvas, form, button, select, input').remove();
    $('nav, header, footer, aside').remove();
    $('[role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]').remove();
    $('.ad, .ads, .advertisement, .banner, .popup, .modal, .cookie-banner, .newsletter, .subscribe, .social, .share, .comments, #comments').remove();
    $('meta, link').remove(); // Remove meta/link tags from body

    // ===== 3. FIND MAIN CONTENT =====
    let mainContent = $('main, article, [role="main"], .main-content, .content, .post-content, .entry-content, .product-description, .product-detail, #content, .article-body').first();
    if (mainContent.length === 0) {
      mainContent = $('body');
    }

    // ===== 4. EXTRACT TITLE =====
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      this.extractTitleFromUrl(url);

    // ===== 5. EXTRACT DESCRIPTION =====
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '';

    // ===== 6. EXTRACT TABLES =====
    const tables: string[] = [];
    if (options.extractTables) {
      mainContent.find('table').each((idx, table) => {
        const $table = $(table);
        const headers: string[] = [];
        const rows: string[][] = [];

        // Extract headers
        $table.find('thead th, thead td').each((_, th) => {
          headers.push($(th).text().replace(/\s+/g, ' ').trim());
        });

        // Extract body rows
        $table.find('tbody tr, tr').each((_, tr) => {
          const row: string[] = [];
          $(tr).find('td, th').each((_, td) => {
            row.push($(td).text().replace(/\s+/g, ' ').trim());
          });
          if (row.length > 0) rows.push(row);
        });

        // Format table
        if (headers.length > 0 || rows.length > 0) {
          let tableText = `\n[TABLE ${idx + 1}]\n`;
          if (headers.length > 0) {
            tableText += `Headers: ${headers.join(' | ')}\n`;
            tableText += `${'---'.repeat(headers.length)}\n`;
          }
          rows.forEach(row => {
            tableText += `${row.join(' | ')}\n`;
          });
          tables.push(tableText);
        }
      });
      // Remove tables from DOM after extraction
      mainContent.find('table').remove();
    }

    // ===== 7. EXTRACT FAQs =====
    const faqs: Array<{ question: string; answer: string }> = [];
    if (options.extractFaqs) {
      // From JSON-LD
      const jsonLdFaqs = jsonLd
        .filter(d => d['@type'] === 'FAQPage' || d['@type'] === 'QAPage')
        .flatMap(d => d.mainEntity || d.question || [])
        .filter(Boolean);
      
      jsonLdFaqs.forEach(faq => {
        const question = faq.name || faq.question || '';
        const answer = faq.acceptedAnswer?.text || faq.answer || '';
        if (question && answer) {
          faqs.push({ question, answer });
        }
      });

      // From HTML (common patterns)
      
      mainContent.find('[class*="faq"], [id*="faq"], dl.faq, .questions').each((_, el) => {
        $(el).find('dt, h3, h4').each((_, q) => {
          const $q = $(q);
          const question = $q.text().replace(/\s+/g, ' ').trim();
          const $dd = $q.next('dd, p');
          const answer = $dd.text().replace(/\s+/g, ' ').trim();
          
          if (question && answer && question.length > 5 && answer.length > 5) {
            faqs.push({ question, answer });
          }
        });
      });
    }

    // ===== 8. EXTRACT IMAGES =====
    const images: Array<{ url: string; alt: string; caption?: string }> = [];
    if (options.extractImages) {
      mainContent.find('img').each((_, img) => {
        const $img = $(img);
        let src = $img.attr('src') || '';
        
        // Handle relative URLs
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = `${baseUrl.origin}${src}`;
        
        const alt = $img.attr('alt') || '';
        const caption = $img.closest('figure').find('figcaption').text().trim() ||
                       $img.parent().find('.caption, .img-caption').text().trim();
        
        // Only keep images with alt text or from main content
        if (src && (alt || caption)) {
          images.push({ url: src, alt, caption: caption || undefined });
        }
      });
    }

    // ===== 9. EXTRACT LINKS =====
    const links: Array<{ url: string; text: string; context?: string }> = [];
    mainContent.find('a[href]').each((_, a) => {
      const $a = $(a);
      let href = $a.attr('href') || '';
      
      // Skip anchors, mailto, javascript
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
      
      // Handle relative URLs
      if (href.startsWith('/')) href = `${baseUrl.origin}${href}`;
      
      // Only same domain
      try {
        const linkUrl = new URL(href);
        if (linkUrl.hostname !== baseUrl.hostname) return;
      } catch { return; }

      const text = $a.text().replace(/\s+/g, ' ').trim();
      if (text && text.length > 3) {
        links.push({ url: href, text });
      }
    });

    // ===== 10. EXTRACT MAIN CONTENT WITH STRUCTURE =====
    const contentParts: string[] = [];

    // Process headings and content - use CheerioElement type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processNode = (node: any, depth: number = 0) => {
      const $node = $(node);
      const tag = node.tagName?.toLowerCase() || '';
      
      if (tag.match(/^h[1-6]$/)) {
        const level = parseInt(tag[1]);
        const text = $node.text().replace(/\s+/g, ' ').trim();
        if (text) {
          contentParts.push(`\n${'#'.repeat(Math.min(level, 3))} ${text}\n`);
        }
      } else if (tag === 'p') {
        const text = $node.text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 10) {
          contentParts.push(text + '\n');
        }
      } else if (tag === 'li') {
        const text = $node.text().replace(/\s+/g, ' ').trim();
        if (text) {
          contentParts.push(`  • ${text}\n`);
        }
      } else if (tag === 'ul' || tag === 'ol') {
        $node.find('> li').each((_: number, li: any) => {
          const text = $(li).text().replace(/\s+/g, ' ').trim();
          if (text) contentParts.push(`  • ${text}\n`);
        });
      } else if (tag === 'blockquote') {
        const text = $node.text().replace(/\s+/g, ' ').trim();
        if (text) {
          contentParts.push(`\n> ${text}\n`);
        }
      } else if (tag === 'pre' || tag === 'code') {
        const text = $node.text().trim();
        if (text && text.length > 5) {
          contentParts.push(`\n[CODE]\n${text}\n[/CODE]\n`);
        }
      } else if (tag === 'div' || tag === 'section' || tag === 'article') {
        $node.contents().each((_: number, child: unknown) => {
          if ((child as { type?: string }).type === 'tag' || (child as { type?: string }).type === 'text') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            processNode(child as any, depth + 1);
          }
        });
      }
    };

    // Process content recursively
    mainContent.contents().each((_: number, node: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processNode(node as any);
    });

    // Fallback: if nothing extracted, get all text
    let mainText = contentParts.join('');
    if (mainText.length < 100) {
      mainText = mainContent.text().replace(/\s+/g, ' ').trim();
    }

    // ===== 11. EXTRACT STRUCTURED DATA =====
    const structuredData: Record<string, any> = {};
    jsonLd.forEach((data, idx) => {
      const type = data['@type'] || `schema${idx}`;
      structuredData[type] = data;
    });

    return {
      title: title.replace(/\s+/g, ' ').trim(),
      description: description.replace(/\s+/g, ' ').trim(),
      mainContent: mainText,
      structuredData,
      tables,
      jsonLd,
      faqs,
      images,
      metadata,
      links,
      rawHtml: html,
    };
  }

  /**
   * Extract links có giá trị cao (ưu tiên product, article, detail pages)
   */
  private extractHighValueLinks(html: string, baseUrl: string): Array<{ url: string; text: string }> {
    const $ = cheerio.load(html);
    const base = new URL(baseUrl);
    const links: Array<{ url: string; text: string; score: number }> = [];

    // Priority patterns for valuable links
    const priorityPatterns = [
      /product/i, /article/i, /detail/i, /spec/i, /specification/i,
      /feature/i, /review/i, /comparison/i, /guide/i, /tutorial/i,
      /document/i, /download/i, /catalog/i, /assistive/i, /at-/i,
    ];

    $('a[href]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        
        // Skip invalid links
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
        if (href.match(/\.(png|jpg|jpeg|gif|pdf|zip|exe|doc|docx)$/i)) return;
        
        const u = new URL(href, base);
        
        // Only same domain
        if (u.hostname !== base.hostname) return;
        
        // Skip common nav/utility pages
        const path = u.pathname.toLowerCase();
        if (path.match(/^\/(login|register|signup|contact|about|privacy|terms|tag|category|author|page)\/?$/)) return;
        
        const text = $el.text().replace(/\s+/g, ' ').trim();
        
        // Calculate priority score
        let score = 0;
        if (text) score += 1;
        if (text.length > 10) score += 1;
        priorityPatterns.forEach(pattern => {
          if (pattern.test(u.pathname) || pattern.test(text)) score += 2;
        });
        
        // Prefer links with specific paths
        if (u.pathname.match(/\/[a-z0-9-]+\/[a-z0-9-]+/i)) score += 1;
        
        if (score > 0) {
          links.push({ url: u.toString(), text, score });
        }
      } catch { /* ignore */ }
    });

    // Sort by score and return top links
    return links
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ url, text }) => ({ url, text }));
  }

  /**
   * Merge nhiều kết quả scrape thành 1
   */
  private mergeDetailedResults(results: DetailedScrapeResult[]): DetailedScrapeResult {
    if (results.length === 0) {
      return {
        title: '',
        description: '',
        mainContent: '',
        structuredData: {},
        tables: [],
        jsonLd: [],
        faqs: [],
        images: [],
        metadata: {},
        links: [],
      };
    }

    if (results.length === 1) return results[0];

    // Merge all data
    const merged: DetailedScrapeResult = {
      title: results[0].title,
      description: results.map(r => r.description).filter(Boolean).join(' | '),
      mainContent: results.map(r => r.mainContent).filter(Boolean).join('\n\n---\n\n'),
      structuredData: Object.assign({}, ...results.map(r => r.structuredData)),
      tables: results.flatMap(r => r.tables),
      jsonLd: results.flatMap(r => r.jsonLd),
      faqs: results.flatMap(r => r.faqs),
      images: results.flatMap(r => r.images),
      metadata: Object.assign({}, ...results.map(r => r.metadata)),
      links: results.flatMap(r => r.links),
    };

    // Dedupe links
    const seenUrls = new Set<string>();
    merged.links = merged.links.filter(link => {
      if (seenUrls.has(link.url)) return false;
      seenUrls.add(link.url);
      return true;
    });

    // Dedupe images
    const seenImages = new Set<string>();
    merged.images = merged.images.filter(img => {
      if (seenImages.has(img.url)) return false;
      seenImages.add(img.url);
      return true;
    });

    // Dedupe FAQs
    const seenFaqs = new Set<string>();
    merged.faqs = merged.faqs.filter(faq => {
      const key = faq.question.toLowerCase();
      if (seenFaqs.has(key)) return false;
      seenFaqs.add(key);
      return true;
    });

    return merged;
  }

  /**
   * Format kết quả scrape chi tiết thành text cho embedding
   */
  private formatDetailedContent(result: DetailedScrapeResult): string {
    const parts: string[] = [];

    // Title
    if (result.title) {
      parts.push(`# ${result.title}`);
    }

    // Description
    if (result.description) {
      parts.push(`\n${result.description}\n`);
    }

    // Main content
    if (result.mainContent) {
      parts.push(`\n## Nội dung chính\n\n${result.mainContent}`);
    }

    // Tables
    if (result.tables.length > 0) {
      parts.push(`\n## Dữ liệu bảng (${result.tables.length} bảng)\n`);
      result.tables.forEach(table => {
        parts.push(table);
      });
    }

    // FAQs
    if (result.faqs.length > 0) {
      parts.push(`\n## Câu hỏi thường gặp (${result.faqs.length} câu)\n`);
      result.faqs.forEach((faq, idx) => {
        parts.push(`**Q${idx + 1}:** ${faq.question}\n**A${idx + 1}:** ${faq.answer}\n`);
      });
    }

    // Structured data summary
    if (Object.keys(result.structuredData).length > 0) {
      parts.push(`\n## Thông tin cấu trúc\n`);
      Object.entries(result.structuredData).forEach(([type, data]) => {
        if (type === '@context' || type === '@graph') return;
        
        // Extract key properties
        const keyProps = ['name', 'description', 'brand', 'model', 'price', 'availability', 'category'];
        const summary: string[] = [];
        
        keyProps.forEach(prop => {
          if (data[prop]) {
            summary.push(`${prop}: ${typeof data[prop] === 'object' ? JSON.stringify(data[prop]) : data[prop]}`);
          }
        });
        
        if (summary.length > 0) {
          parts.push(`- ${type}: ${summary.join(', ')}`);
        }
      });
    }

    // Images summary
    if (result.images.length > 0) {
      parts.push(`\n## Hình ảnh (${result.images.length} ảnh)\n`);
      result.images.slice(0, 10).forEach((img, idx) => {
        const caption = img.caption ? ` - ${img.caption}` : '';
        parts.push(`[Image ${idx + 1}]: ${img.alt}${caption} (${img.url})`);
      });
    }

    return parts.join('\n').trim();
  }

  /**
   * Tạo mô tả enhanced từ structured data
   */
  private generateEnhancedDescription(content: string, metadata?: Record<string, any>): string {
    if (!metadata) return content.slice(0, 500);

    const parts: string[] = [];

    // Từ metadata
    if (metadata.scrapeMetadata) {
      const m = metadata.scrapeMetadata;
      if (m['og:title'] || m['og:description']) {
        parts.push(m['og:title'] || '');
        parts.push(m['og:description'] || '');
      }
    }

    // Từ JSON-LD
    if (metadata.jsonLd && metadata.jsonLd.length > 0) {
      const ld = metadata.jsonLd[0];
      if (ld.name) parts.push(ld.name);
      if (ld.description) parts.push(ld.description);
      if (ld.brand?.name) parts.push(`Brand: ${ld.brand.name}`);
      if (ld.category) parts.push(`Category: ${ld.category}`);
    }

    // Từ FAQs
    if (metadata.faqs && metadata.faqs.length > 0) {
      parts.push(`Có ${metadata.faqs.length} câu hỏi thường gặp.`);
    }

    // Từ tables
    if (metadata.tables && metadata.tables.length > 0) {
      parts.push(`Có ${metadata.tables.length} bảng dữ liệu.`);
    }

    // Combine
    const desc = parts.filter(Boolean).join(' - ');
    return desc || content.slice(0, 500);
  }

  /**
   * ⭐ ENHANCED CLEAN TEXT - Giữ lại thông tin quan trọng hơn
   */
  private cleanTextEnhanced(text: string): string {
    return text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove multiple spaces but preserve intentional structure
      .replace(/[ \t]+/g, ' ')
      // Remove non-breaking spaces
      .replace(/[ ]/g, ' ')
      // Collapse excessive newlines but preserve section breaks
      .replace(/\n{4,}/g, '\n\n\n')
      // Remove leading/trailing whitespace per line
      .replace(/^[ \t]+/gm, '')
      // Remove very short lines that are likely noise
      .replace(/^.{1,5}$\n/gm, '')
      // Clean up common artifacts
      .replace(/\[TABLE \d+\]/g, '---BẢNG---')
      .replace(/\[CODE\]/g, '```')
      .replace(/\[\/CODE\]/g, '```')
      // Final trim
      .trim();
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use scrapeWebContentDetailed instead
   */
  private async _scrapeWebContent(
    url: string,
    options: { followLinks?: boolean; maxDepth?: number; maxPages?: number } = {}
  ): Promise<string> {
    const opts: ScrapeOptions = {
      followLinks: options.followLinks ?? true,
      maxDepth: options.maxDepth ?? 3,
      maxPages: options.maxPages ?? 20,
      extractJsonLd: true,
      extractTables: true,
      extractMetadata: true,
      extractFaqs: true,
      extractImages: true,
      delayBetweenRequests: 1000,
    };
    
    const result = await this.scrapeWebContentDetailed(url, opts);
    return this.formatDetailedContent(result);
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1]?.replace(/-/g, ' ') || u.hostname;
    } catch {
      return url.slice(0, 50);
    }
  }

  /**
   * @deprecated Use fetchHtmlWithRetry instead
   */
  private async _fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xml')) {
      throw new Error(`Unsupported content-type: ${ct}`);
    }
    return response.text();
  }

  /**
   * @deprecated Not used in new implementation
   */
  private _extractSameDomainLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const base = new URL(baseUrl);
    const links = new Set<string>();
    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
        const u = new URL(href, base);
        if (u.hostname !== base.hostname) return;
        if (u.pathname.match(/\.(png|jpg|jpeg|gif|pdf|zip|css|js)$/i)) return;
        u.hash = '';
        links.add(u.toString());
      } catch { /* ignore malformed href */ }
    });
    return Array.from(links).slice(0, 30);
  }

  private async fetchAndFormatCsv(csvUrl: string, sourceUrl: string): Promise<string> {
    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} khi tải CSV Google Sheets`);
    const csv = await res.text();
    return this.csvToReadableText(csv, sourceUrl);
  }

  private csvToReadableText(csv: string, sourceUrl: string): string {
    const rows: string[][] = csv
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter(l => l.length > 0)
      .map(line => {
        const out: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuote = !inQuote;
          } else if (ch === ',' && !inQuote) {
            out.push(cur); cur = '';
          } else cur += ch;
        }
        out.push(cur);
        return out;
      });

    if (rows.length === 0) return '';

    const header = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

    const lines = dataRows.map(row => {
      const pairs = header.map((h, i) => `${h}: ${(row[i] || '').trim()}`).filter(p => !p.endsWith(': '));
      return pairs.join(' | ');
    });

    return `=== Google Sheets: ${sourceUrl} ===\nCó ${dataRows.length} dòng, ${header.length} cột.\nCột: ${header.join(', ')}\n\n` + lines.join('\n');
  }

  /**
   * @deprecated Use parseDetailedContent instead
   */
  private _extractMainContent(html: string, url: string): string {
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe, svg, canvas, form, button').remove();
    $('nav, header.site-header, footer, aside, .sidebar, .menu, .navigation').remove();
    $('.ad, .ads, .advertisement, .banner, .popup, .modal, .cookie-banner, .newsletter, .subscribe').remove();
    $('.social, .share, .social-share, .comments, #comments, .comment-section').remove();
    $('[role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]').remove();

    let mainContent = $('main, article, [role="main"], .main-content, .content, .post-content, .entry-content, .product-description').first();
    let body = mainContent.length > 0 ? mainContent : $('body');

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      '';

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const parts: string[] = [];
    if (title) parts.push(`# ${title.trim()}`);
    if (description) parts.push(`_${description.trim()}_`);

    body.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, .product-spec, .spec, .description, .feature').each((_, el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase() || '';
      const text = $el.text().replace(/\s+/g, ' ').trim();

      if (!text || text.length < 2) return;

      if (tag.match(/^h[1-6]$/)) {
        const level = parseInt(tag[1]);
        parts.push(`\n${'#'.repeat(level)} ${text}`);
      } else if (tag === 'li') {
        parts.push(`- ${text}`);
      } else {
        parts.push(text);
      }
    });

    let result = parts.join('\n').trim();
    if (result.length < 50) {
      result = body.text().replace(/\s+/g, ' ').trim();
    }

    result = result.replace(/\n{3,}/g, '\n\n');
    console.log(`🌐 Scraped ${url} → ${result.length} chars, ${parts.length} elements`);

    return result;
  }

  /**
   * @deprecated Use cleanTextEnhanced instead
   */
  private _cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ /g, ' ')
      .replace(/[ ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^[ \t]+/gm, '')
      .trim();
  }

  private deriveTitle(source: string): string {
    try {
      if (source.startsWith('http')) {
        const url = new URL(source);
        return url.pathname.split('/').filter(Boolean).pop() || url.hostname;
      }
      return path.basename(source, path.extname(source));
    } catch {
      return source.slice(0, 100);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logIngestion(taskId: string, source: DataSource, documentsAdded: number): void {
    const logPath = path.join(process.cwd(), 'data', 'ingestion_log.json');
    const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf-8')) : [];
    logs.unshift({
      taskId,
      source: source.source,
      type: source.type,
      title: source.title,
      documentsAdded,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(logPath, JSON.stringify(logs.slice(0, 100), null, 2));
  }

  async getIngestionLogs(limit = 50): Promise<any[]> {
    const logPath = path.join(process.cwd(), 'data', 'ingestion_log.json');
    if (!fs.existsSync(logPath)) return [];
    const logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    return logs.slice(0, limit);
  }
}

export const dataIngestion = new DataIngestionService();

/**
 * Nếu `url` là Google Sheets public, trả về URL export CSV.
 */
export function googleSheetsToCsvUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)docs\.google\.com$/i.test(u.hostname)) return null;
    if (!u.pathname.includes('/spreadsheets/')) return null;

    let gid = u.searchParams.get('gid') || '';
    if (!gid && u.hash) {
      const m = u.hash.match(/gid=(\d+)/);
      if (m) gid = m[1];
    }
    if (!gid) gid = '0';

    const idMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) return null;
    const sheetId = idMatch[1];

    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  } catch {
    return null;
  }
}
