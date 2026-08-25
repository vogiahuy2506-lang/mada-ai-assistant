/**
 * Admin Scraper Routes
 *
 * Endpoints cho admin panel:
 *   - GET  /api/admin/scraper/mada-categories     → 7 danh mục MADA + URL thật
 *   - POST /api/admin/scraper/crawl-mada          → Trigger crawl một/all danh mục MADA
 *   - GET  /api/admin/scraper/crawl-mada/:jobId   → Check status của crawl job
 *   - GET  /api/admin/scraper/rag-chunks-stats    → Thống kê file mada-rag-chunks.json
 *   - POST /api/admin/scraper/ingest-rag-chunks   → Bulk ingest KB từ file JSON
 *   - GET  /api/admin/scraper/sources             → List nguồn scraping (DB)
 *   - POST /api/admin/scraper/sources             → Thêm nguồn
 *   - DELETE /api/admin/scraper/sources/:id       → Xóa nguồn
 *
 * Tất cả routes yêu cầu admin role.
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { authenticate, requireRole } from '../lib/auth';
import db from '../lib/db';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.use(authenticate as any, requireRole('admin') as any);

// ============== HELPERS ==============

// In-memory job tracker (đủ cho 1 admin, không cần Redis)
interface CrawlJob {
  id: string;
  category: string;        // 'all' hoặc slug cụ thể
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  stdout: string[];
  stderr: string[];
  errorMessage?: string;
}

const crawlJobs = new Map<string, CrawlJob>();

const DATA_DIR = path.join(process.cwd(), 'data');

const MADA_CATEGORIES = [
  {
    slug: 'sensory-hearing',
    name: 'Sensory – Hearing',
    nameVi: 'Cảm giác – Thính giác',
    botId: 'bot-hearing',
    url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/',
    isoCodes: ['22.06.06', '22.09.06', '22.18.03'],
  },
  {
    slug: 'sensory-vision',
    name: 'Sensory – Vision',
    nameVi: 'Cảm giác – Thị giác',
    botId: 'bot-vision',
    url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/',
    isoCodes: ['22.03.06', '22.06.12', '22.06.15', '22.36.12'],
  },
  {
    slug: 'voice-and-speech',
    name: 'Voice and Speech',
    nameVi: 'Giọng nói và Lời nói',
    botId: 'bot-speech',
    url: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/',
    isoCodes: ['05.15.06', '05.15.12', '22.21.12'],
  },
  {
    slug: 'mental-cognitive',
    name: 'Mental – Cognitive',
    nameVi: 'Tâm thần – Nhận thức',
    botId: 'bot-cognitive',
    url: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/',
    isoCodes: ['05.06.15', '05.09.03', '05.18.06'],
  },
  {
    slug: 'neuromusculoskeletal-movement',
    name: 'Neuromusculoskeletal Movement',
    nameVi: 'Vận động thần kinh – cơ xương',
    botId: 'bot-neuro',
    url: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/',
    isoCodes: ['04.24', '06.06', '12.31.03'],
  },
  {
    slug: 'mobility-and-transportation',
    name: 'Mobility and Transportation',
    nameVi: 'Di chuyển và Giao thông',
    botId: 'bot-mobility',
    url: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/',
    isoCodes: ['12.21.06', '12.21.09', '12.03.06'],
  },
  {
    slug: 'regulatory-standards',
    name: 'Regulatory & Standards',
    nameVi: 'Quy định & Tiêu chuẩn',
    botId: 'bot-regulatory',
    url: 'https://at.mada.org.qa/assistive-technology-portal/',
    isoCodes: [],
  },
];

// ============== GET /api/admin/scraper/mada-categories ==============

router.get('/mada-categories', (_req, res) => {
  res.json({ success: true, data: MADA_CATEGORIES });
});

// ============== POST /api/admin/scraper/crawl-mada ==============

router.post('/crawl-mada', (req, res) => {
  const { category = 'all' } = req.body || {};
  const jobId = `crawl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const job: CrawlJob = {
    id: jobId,
    category,
    status: 'queued',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    stdout: [],
    stderr: [],
  };
  crawlJobs.set(jobId, job);

  // Spawn process crawl-mada.ts (chạy nền)
  const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'crawl-mada.ts');
  const args = ['tsx', scriptPath];
  if (category !== 'all') args.push('--category', category);

  const child = spawn('npx', args, {
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  job.status = 'running';

  child.stdout.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    job.stdout.push(line);
    if (job.stdout.length > 200) job.stdout.shift();
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    job.stderr.push(line);
    if (job.stderr.length > 200) job.stderr.shift();
  });

  child.on('exit', (code) => {
    job.exitCode = code;
    job.status = code === 0 ? 'completed' : 'failed';
    job.finishedAt = new Date().toISOString();

    // Log audit
    try {
      db.prepare(
        `INSERT INTO audit_logs (id, action, user_id, target, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        `crawl-${jobId}`,
        `crawl_mada_${job.status}`,
        String((req as any).user?.id) || 'admin',
        `scraper/${category}`,
        JSON.stringify({ exitCode: code, category }),
        new Date().toISOString()
      );
    } catch (e) { /* table may not exist */ }
  });

  child.on('error', (err) => {
    job.status = 'failed';
    job.errorMessage = err.message;
    job.finishedAt = new Date().toISOString();
  });

  res.json({
    success: true,
    data: { jobId, status: job.status, message: `Đã khởi động crawl: ${category}` },
  });
});

// ============== GET /api/admin/scraper/crawl-mada/:jobId ==============

router.get('/crawl-mada/:jobId', (req, res) => {
  const job = crawlJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, data: job });
});

// ============== GET /api/admin/scraper/crawl-mada-jobs (list) ==============

router.get('/crawl-mada-jobs', (_req, res) => {
  const jobs = Array.from(crawlJobs.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 50);
  res.json({ success: true, data: jobs });
});

// ============== GET /api/admin/scraper/rag-chunks-stats ==============

router.get('/rag-chunks-stats', (_req, res) => {
  const resultsPath = path.join(DATA_DIR, 'mada-scrape-results.json');
  const chunksPath = path.join(DATA_DIR, 'mada-rag-chunks.json');
  const fullPath = path.join(DATA_DIR, 'mada-knowledge-base-full.json');
  const cleanPath = path.join(DATA_DIR, 'mada-knowledge-base.json');
  const reportPath = path.join(DATA_DIR, 'mada-crawl-report.json');

  function statOrMissing(p: string) {
    if (!fs.existsSync(p)) return { exists: false, size: 0, modified: null };
    const stat = fs.statSync(p);
    return { exists: true, size: stat.size, modified: stat.mtime.toISOString() };
  }

  const stats = {
    'mada-scrape-results.json': statOrMissing(resultsPath),
    'mada-rag-chunks.json': statOrMissing(chunksPath),
    'mada-knowledge-base-full.json': statOrMissing(fullPath),
    'mada-knowledge-base.json': statOrMissing(cleanPath),
    'mada-crawl-report.json': statOrMissing(reportPath),
  };

  // Đếm chunks nếu file tồn tại
  let chunkCount = 0;
  let productCount = 0;
  if (fs.existsSync(chunksPath)) {
    try {
      const arr = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
      chunkCount = Array.isArray(arr) ? arr.length : 0;
    } catch { /* ignore */ }
  }
  if (fs.existsSync(fullPath)) {
    try {
      const obj = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      productCount = Object.values(obj).reduce(
        (sum: number, items: any) => sum + (Array.isArray(items) ? items.length : 0),
        0
      );
    } catch { /* ignore */ }
  }

  res.json({ success: true, data: { files: stats, chunkCount, productCount } });
});

// ============== POST /api/admin/scraper/ingest-rag-chunks ==============

interface RagChunk {
  content: string;
  source: string;
  title: string;
  category?: string;
  botId?: string;
  language?: string;
  metadata?: Record<string, any>;
}

router.post('/ingest-rag-chunks', async (req, res) => {
  const { chunks: inputChunks, dryRun = false } = req.body || {};

  let chunks: RagChunk[];
  if (inputChunks && Array.isArray(inputChunks)) {
    chunks = inputChunks;
  } else {
    const chunksPath = path.join(DATA_DIR, 'mada-rag-chunks.json');
    if (!fs.existsSync(chunksPath)) {
      return res.status(404).json({ success: false, error: 'mada-rag-chunks.json không tồn tại' });
    }
    chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
  }

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return res.status(400).json({ success: false, error: 'Không có chunk nào để ingest' });
  }

  if (dryRun) {
    return res.json({
      success: true,
      data: {
        wouldIngest: chunks.length,
        sample: chunks.slice(0, 2).map((c) => ({ title: c.title, category: c.category, contentLen: c.content.length })),
      },
    });
  }

  // Dynamic import để tránh circular dep
  const { dataIngestion } = await import('../lib/rag/dataIngestion');

  let totalAdded = 0;
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      const result = await dataIngestion.ingestData({
        type: 'web',
        content: chunk.content,
        source: chunk.source,
        title: chunk.title,
        language: chunk.language || 'en',
        metadata: {
          ...(chunk.metadata || {}),
          botId: chunk.botId,
          madaCategory: chunk.category,
        },
      });
      if (result.success && result.documentsAdded) {
        totalAdded += result.documentsAdded;
      } else if (!result.success) {
        errors.push(`${chunk.title}: ${result.message}`);
      }
    } catch (err: any) {
      errors.push(`${chunk.title}: ${err.message}`);
    }
  }

  // Log audit
  try {
    db.prepare(
      `INSERT INTO audit_logs (id, action, user_id, target, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      `ingest-${Date.now()}`,
      'ingest_rag_chunks',
      (req.user as any)?.id || 'admin',
      `knowledge_items`,
      JSON.stringify({ count: chunks.length, added: totalAdded, errors: errors.length }),
      new Date().toISOString()
    );
  } catch { /* ignore */ }

  res.json({
    success: errors.length === 0,
    data: {
      total: chunks.length,
      added: totalAdded,
      errors,
    },
  });
});

// ============== GET /api/admin/scraper/sources ==============

router.get('/sources', (_req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM scheduled_sources ORDER BY id ASC'
    ).all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== POST /api/admin/scraper/sources ==============

router.post('/sources', (req, res) => {
  const { id, name, url, category, schedule, enabled = true } = req.body || {};

  if (!id || !name || !url) {
    return res.status(400).json({ success: false, error: 'id, name, url là bắt buộc' });
  }

  try {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO scheduled_sources (id, name, url, type, frequency, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      url,
      'web',  // ⭐ Schema: type IN ('web', 'api')
      schedule || 'daily',
      enabled ? 'active' : 'inactive',
      JSON.stringify({ category }),
      now,
      now
    );
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'ID đã tồn tại' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/sources/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM scheduled_sources WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sources/:id/toggle', (req, res) => {
  try {
    const enabled = req.body?.enabled ? 'active' : 'inactive';
    const result = db.prepare(
      'UPDATE scheduled_sources SET status = ?, updated_at = ? WHERE id = ?'
    ).run(enabled, new Date().toISOString(), req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
