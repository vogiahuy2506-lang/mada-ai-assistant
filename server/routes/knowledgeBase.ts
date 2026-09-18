/**
 * Knowledge Base routes — CRUD, upload file, phân loại, xuất bản
 * Tuần 1 — Task 3 & 4
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { dataIngestion, type DataSource } from '../lib/rag/dataIngestion';
import { vectorStore } from '../lib/rag/vectorStore';
import { AT_CATEGORIES, classifyContent } from '../lib/rag/taxonomy';
import { detectFileType, parsePDFFile, parseDocxFile } from '../lib/rag/fileParsers';
import { logActivity } from '../index';
import { authenticate, requireRole } from '../lib/auth';

const router = express.Router();

// Apply authentication to write routes (POST/PATCH/DELETE) for KB management
// Note: GET routes remain public for browsing

// ============== MULTER CONFIG ==============

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, UPLOAD_DIR),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /\.(pdf|docx|doc|txt|md|jpg|jpeg|png|webp|bmp|tiff|gif)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Định dạng file không hỗ trợ: ${file.originalname}. Hỗ trợ: PDF, DOCX, TXT, MD, JPG, PNG, WEBP, BMP, TIFF`));
    }
  },
});

// ============== CATEGORIES ==============

router.get('/categories', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM kb_categories ORDER BY sort_order ASC').all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEMS — LIST/SEARCH ==============

router.get('/items', (req, res) => {
  try {
    const {
      q, category, status, source_type,
      limit = '50', offset = '0', sort = 'created_at', order = 'DESC',
    } = req.query;

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      where.push('(title LIKE ? OR content LIKE ? OR description LIKE ?)');
      const kw = `%${q}%`;
      params.push(kw, kw, kw);
    }
    if (category) { where.push('category = ?'); params.push(category); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (source_type) { where.push('source_type = ?'); params.push(source_type); }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const allowedSorts = ['created_at', 'updated_at', 'title', 'confidence', 'category'];
    const sortCol = allowedSorts.includes(String(sort)) ? String(sort) : 'created_at';
    const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const lim = Math.min(parseInt(String(limit)) || 50, 200);
    const off = Math.max(parseInt(String(offset)) || 0, 0);

    const rows = db.prepare(`
      SELECT id, title, description, source, source_type, url, category,
             iso_codes, wcag_level, who_gate_area, confidence, status,
             chunk_count, indexed, language, created_at, updated_at, metadata
      FROM knowledge_items
      ${whereStr}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, lim, off);

    // Parse metadata and extract thumbnailUrl for each item
    const items = rows.map((row: any) => {
      const parsed = JSON.parse(row.metadata || '{}');
      return {
        ...row,
        metadata: parsed,
        image_url: parsed?.thumbnailUrl || parsed?.galleryImages?.[0] || null,
      };
    });

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM knowledge_items ${whereStr}`).get(...params) as any;

    res.json({
      success: true,
      data: {
        items,
        total: countRow.total,
        limit: lim,
        offset: off,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEM — GET ONE ==============

router.get('/items/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Item not found' });

    // Parse JSON fields
    row.iso_codes = JSON.parse(row.iso_codes || '[]');
    const parsed = JSON.parse(row.metadata || '{}');
    row.metadata = parsed;
    row.image_url = parsed?.thumbnailUrl || parsed?.galleryImages?.[0] || null;

    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEM — UPDATE ==============

router.patch('/items/:id', authenticate as any, requireRole('admin', 'data_manager') as any, (req, res) => {
  try {
    const allowed = ['title', 'description', 'category', 'status', 'language'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        sets.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }
    if (req.body.iso_codes !== undefined) {
      sets.push('iso_codes = ?');
      params.push(JSON.stringify(req.body.iso_codes));
    }
    if (req.body.wcag_level !== undefined) {
      sets.push('wcag_level = ?');
      params.push(req.body.wcag_level);
    }
    if (req.body.who_gate_area !== undefined) {
      sets.push('who_gate_area = ?');
      params.push(req.body.who_gate_area);
    }
    if (req.body.content !== undefined) {
      sets.push('content = ?');
      params.push(req.body.content);
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    // Lưu audit log
    const before = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: 'Item not found' });

    db.prepare(`UPDATE knowledge_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    db.prepare(`
      INSERT INTO kb_audit (id, item_id, action, before_data, after_data, user_id, created_at)
      VALUES (?, ?, 'update', ?, ?, ?, ?)
    `).run(
      uuidv4(), req.params.id,
      JSON.stringify(before), JSON.stringify({ ...before, ...req.body }),
      null, new Date().toISOString()
    );

    res.json({ success: true, message: 'Đã cập nhật' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEM — DELETE ==============

router.delete('/items/:id', authenticate as any, requireRole('admin', 'data_manager') as any, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Item not found' });

    // Xóa file vật lý nếu có
    if (row.file_path && fs.existsSync(row.file_path)) {
      try { fs.unlinkSync(row.file_path); } catch {}
    }

    db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(req.params.id);
    logActivity('warn', `Knowledge item deleted: ${row.title || row.id}`, 'Knowledge Base', 'admin');
    res.json({ success: true, message: 'Đã xóa item' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEM — PUBLISH/UNPUBLISH ==============

router.post('/items/:id/publish', authenticate as any, requireRole('admin', 'data_manager') as any, (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status không hợp lệ' });
    }
    db.prepare('UPDATE knowledge_items SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);
    res.json({ success: true, message: `Đã chuyển sang ${status}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KNOWLEDGE ITEM — RE-EMBED ==============

router.post('/items/:id/reindex', authenticate as any, requireRole('admin', 'data_manager') as any, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ success: false, error: 'Item not found' });

    // Tạo lại chunks
    const { chunkText, generateId } = await import('../lib/rag/vectorStore');
    const chunks = chunkText(row.content, 800, 150);
    const documents = chunks.map((chunk) => ({
      id: generateId(),
      content: chunk,
      metadata: {
        source: row.source,
        type: row.source_type,
        title: row.title,
        createdAt: new Date().toISOString(),
        itemId: row.id,
        category: row.category,
      },
    }));

    await vectorStore.addDocuments(documents);
    db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ?, chunk_count = ? WHERE id = ?')
      .run(new Date().toISOString(), chunks.length, row.id);

    res.json({ success: true, message: `Đã tạo lại ${chunks.length} chunks`, chunks: chunks.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== REINDEX ALL ==============

router.post('/reindex-all', authenticate as any, requireRole('admin') as any, async (_req, res) => {
  try {
    const result = await vectorStore.reindexAll();
    res.json({ success: true, data: result, message: `Đã reindex ${result.count} tài liệu` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Error handler cho multer errors
router.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: err.code,
    });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ============== FILE UPLOAD (multipart) ==============

router.post('/upload', authenticate as any, requireRole('admin', 'data_manager') as any, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file nào được upload' });
    }

    const fileType = detectFileType(req.file.originalname);
    if (fileType === 'unknown') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Định dạng file không hỗ trợ' });
    }

    // Map 'txt' → 'text' để khớp với DataSource type
    const sourceType: DataSource['type'] = fileType === 'txt' ? 'text' : fileType;

    const source: DataSource = {
      type: sourceType,
      content: req.file.path,  // absolute path
      source: req.file.originalname,
      title: path.parse(req.file.originalname).name,
      language: 'vi',
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    };

    // Chạy ingestion (async, response trả về ngay taskId)
    const result = await dataIngestion.ingestData(source);

    if (result.success) {
      logActivity(
        'success',
        `KB upload: ${req.file.originalname} → ${result.documentsAdded} docs (${result.category})`,
        'Knowledge Base',
        'admin'
      );
    } else {
      logActivity('error', `KB upload failed: ${req.file.originalname} - ${result.message}`, 'Knowledge Base', 'admin');
    }

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        itemId: result.itemId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType,
        category: result.category,
        isoCodes: result.isoCodes,
        confidence: result.confidence,
        documentsAdded: result.documentsAdded,
        message: result.message,
      },
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    logActivity('error', `KB upload crashed: ${err.message}`, 'Knowledge Base', 'admin');
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== IMAGE UPLOAD (chuyên cho OCR) ==============

router.post('/upload-image', authenticate as any, requireRole('admin', 'data_manager') as any, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có ảnh nào được upload' });
    }

    const source: DataSource = {
      type: 'image',
      content: req.file.path,
      source: req.file.originalname,
      title: path.parse(req.file.originalname).name,
      language: 'vi',
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    };

    const result = await dataIngestion.ingestData(source);

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        itemId: result.itemId,
        fileName: req.file.originalname,
        category: result.category,
        confidence: result.confidence,
        message: result.message,
        hint: result.success ? 'Đã OCR ảnh và thêm vào Knowledge Base' : 'Ảnh có thể quá mờ — thử ảnh scan chất lượng cao hơn',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== EXTRACT TEXT FROM FILE (for chat attachments) ==============

router.post('/extract-text', authenticate as any, requireRole('admin', 'data_manager') as any, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file nào được upload' });
    }

    const fileType = detectFileType(req.file.originalname);
    let text = '';

    try {
      if (fileType === 'pdf') {
        text = await parsePDFFile(req.file.path);
      } else if (fileType === 'docx') {
        text = await parseDocxFile(req.file.path);
      } else if (fileType === 'txt') {
        text = fs.readFileSync(req.file.path, 'utf-8');
      } else if (fileType === 'image') {
        text = '[Hình ảnh - cần OCR để đọc nội dung]';
      } else {
        text = fs.readFileSync(req.file.path, 'utf-8');
      }
    } catch (parseErr: any) {
      console.error('Parse error:', parseErr);
      text = `[Không thể đọc file: ${parseErr.message}]`;
    }

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    // Limit text to 50k chars
    text = text.slice(0, 50000);

    console.log(`📄 Extracted ${text.length} chars from ${req.file.originalname}`);

    res.json({
      success: true,
      data: {
        text,
        fileName: req.file.originalname,
        fileType,
        charCount: text.length,
      },
    });
  } catch (err: any) {
    console.error('Extract text error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== TEXT INGEST ==============

router.post('/text', authenticate as any, requireRole('admin', 'data_manager') as any, async (req, res) => {
  try {
    const { content, title, language = 'vi' } = req.body;
    if (!content || content.length < 30) {
      return res.status(400).json({ success: false, error: 'Nội dung tối thiểu 30 ký tự' });
    }
    const source: DataSource = {
      type: 'text',
      content,
      source: `manual:${Date.now()}`,
      title,
      language,
    };
    const result = await dataIngestion.ingestData(source);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== WEB SCRAPE ==============

router.post('/scrape', authenticate as any, requireRole('admin', 'data_manager') as any, async (req, res) => {
  try {
    const { url, title, language = 'vi' } = req.body;
    if (!url || !url.match(/^https?:\/\//)) {
      return res.status(400).json({ success: false, error: 'URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://)' });
    }
    const source: DataSource = {
      type: 'web',
      content: '',
      source: url,
      title,
      language,
    };
    const result = await dataIngestion.ingestData(source);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== JOB STATUS ==============

router.get('/jobs/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM ingestion_jobs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/jobs', (req, res) => {
  try {
    const { limit = '30' } = req.query;
    const lim = Math.min(parseInt(String(limit)) || 30, 100);
    const rows = db.prepare(`
      SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT ?
    `).all(lim);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== KB STATS ==============

router.get('/stats', async (_req, res) => {
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM knowledge_items').get() as any).c;
    const published = (db.prepare(`SELECT COUNT(*) as c FROM knowledge_items WHERE status = 'published'`).get() as any).c;
    const indexed = (db.prepare(`SELECT COUNT(*) as c FROM knowledge_items WHERE indexed = 1`).get() as any).c;
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count FROM knowledge_items
      WHERE category != 'general' GROUP BY category ORDER BY count DESC
    `).all() as any[];
    const bySourceType = db.prepare(`
      SELECT source_type, COUNT(*) as count FROM knowledge_items
      GROUP BY source_type ORDER BY count DESC
    `).all() as any[];
    const recentJobs = db.prepare(`
      SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT 10
    `).all();
    const vectorStats = await vectorStore.getStats();

    res.json({
      success: true,
      data: {
        total,
        published,
        indexed,
        draft: total - published,
        byCategory,
        bySourceType,
        recentJobs,
        vectorStats,
        categories: AT_CATEGORIES,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== CLASSIFY (preview) ==============

router.post('/classify', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Text required' });
    const result = classifyContent(text);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
