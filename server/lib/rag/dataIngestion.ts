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
  type: 'pdf' | 'web' | 'text' | 'file' | 'image' | 'docx';
  content: string;        // text content hoặc absolute file path
  source: string;         // URL hoặc tên file
  title?: string;
  language?: string;
  metadata?: Record<string, any>;
}

interface ProgressReporter {
  (stage: string, progress: number, message?: string): void;
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
          // content ở đây là absolute file path
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
          // Nếu caller đã cung cấp sẵn content (vd MADA scraper), dùng luôn.
          // Tránh re-fetch gây block bởi Cloudflare/WAF khi UA bị reject.
          if (source.content && source.content.trim().length > 100) {
            console.log(`📋 Using pre-scraped content for ${source.source} (${source.content.length} chars)`);
            content = source.content;
          } else {
            content = await this.scrapeWebContent(source.source);
          }
          break;

        case 'text':
        case 'file':
        default:
          // content đã là text
          content = source.content;
          break;
      }

      // ====== BƯỚC 2: Làm sạch ======
      this.updateJob(jobId, { progress: 50, stage: 'Đang làm sạch văn bản' });
      onProgress?.('cleaning', 50, 'Đang làm sạch và chuẩn hóa');
      content = this.cleanText(content);

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
      db.prepare(`
        INSERT INTO knowledge_items (
          id, title, description, content, source, source_type, url, file_path,
          category, iso_codes, wcag_level, who_gate_area, auto_classified, confidence,
          status, language, metadata, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `).run(
        itemId,
        title,
        content.slice(0, 500),
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
      const chunks = chunkText(content, 800, 150);
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
          // ⭐ MỚI: Gắn MADA category + botId cho RAG filter theo domain
          madaCategory: source.metadata?.madaCategory,
          botId: source.metadata?.botId,
          // ✅ Copy MADA-specific metadata so RAG responses include image_url
          thumbnailUrl: source.metadata?.thumbnailUrl,
          galleryImages: source.metadata?.galleryImages,
          postId: source.metadata?.postId,
          slug: source.metadata?.slug,
          product_url: source.metadata?.url,
          brand: source.metadata?.brand,
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

  /**
   * Web scraper dùng cheerio — bỏ menu, footer, ads, comments
   * Giữ lại: heading, paragraph, list, table, article
   */
  private async scrapeWebContent(url: string): Promise<string> {
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI-Bot/1.0; +https://mada.digiso.vn)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('xml')) {
        throw new Error(`Unsupported content-type: ${contentType}`);
      }

      html = await response.text();
    } catch (error: any) {
      throw new Error(`Không thể tải URL: ${error.message}`);
    }

    return this.extractMainContent(html, url);
  }

  private extractMainContent(html: string, url: string): string {
    const $ = cheerio.load(html);

    // ===== Loại bỏ noise =====
    $('script, style, noscript, iframe, svg, canvas, form, button').remove();
    $('nav, header.site-header, footer, aside, .sidebar, .menu, .navigation').remove();
    $('.ad, .ads, .advertisement, .banner, .popup, .modal, .cookie-banner, .newsletter, .subscribe').remove();
    $('.social, .share, .social-share, .comments, #comments, .comment-section').remove();
    $('[role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]').remove();

    // Ưu tiên vùng main content
    let mainContent = $('main, article, [role="main"], .main-content, .content, .post-content, .entry-content, .product-description').first();
    let body = mainContent.length > 0 ? mainContent : $('body');

    // Lấy title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      '';

    // Lấy description
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // ===== Thu thập text theo cấu trúc =====
    const parts: string[] = [];
    if (title) parts.push(`# ${title.trim()}`);
    if (description) parts.push(`_${description.trim()}_`);

    // Collect headings + paragraphs + lists
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

    // Nếu không thu được gì, fallback body text
    let result = parts.join('\n').trim();
    if (result.length < 50) {
      result = body.text().replace(/\s+/g, ' ').trim();
    }

    // Final clean
    result = result.replace(/\n{3,}/g, '\n\n');
    console.log(`🌐 Scraped ${url} → ${result.length} chars, ${parts.length} elements`);

    return result;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ /g, ' ')
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
