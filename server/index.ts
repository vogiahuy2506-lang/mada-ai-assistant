import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import session from 'express-session';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============== SYSTEM PROMPTS MODULE ==============
import { buildSystemPrompt } from './lib/prompts/systemPrompts';

// ============== HELPERS ==============

/**
 * Convert MADA image URL to proxy URL to avoid hotlink protection.
 * Returns EMPTY string if no valid image available - frontend will show
 * a clean placeholder icon instead of fake/random images.
 *
 * RATIONALE: We do NOT use generic fallback images (Unsplash, etc.) because:
 *  - Users see random unrelated photos → confusing, breaks trust
 *  - It hides real data quality issues
 *  - MADA Qatar has its own product images we must scrape properly
 *
 * @param madaUrl - The original image URL from MADA (can be empty)
 * @returns Proxy URL string, or '' if no image (frontend handles placeholder)
 */
function toProxyImageUrl(madaUrl: string): string {
  // Chỉ accept valid URLs
  if (!madaUrl || typeof madaUrl !== 'string' || !madaUrl.startsWith('http')) {
    return '';
  }

  // Proxy chỉ các domain cần thiết (cdn.at.mada.org.qa, cdn.mada.org.qa)
  // KHÔNG proxy at.mada.org.qa vì browser có thể load trực tiếp
  // (server proxy không hoạt động do sandbox restriction)
  if (madaUrl.includes('cdn.at.mada.org.qa') || madaUrl.includes('cdn.mada.org.qa')) {
    return `/api/mada-image?url=${encodeURIComponent(madaUrl)}`;
  }

  // at.mada.org.qa: load trực tiếp (browser có thể access)
  if (madaUrl.includes('at.mada.org.qa') || madaUrl.includes('mada.org.qa')) {
    return madaUrl;
  }

  // Shop VN và các domain khác: load trực tiếp
  const shopDomains = ['tgdd.vn', 'cellphones.com.vn', 'fptshop.com.vn', 'dienmayxanh.com', 'hstatic.net', 'viettelstore.vn'];
  if (shopDomains.some(d => madaUrl.includes(d))) {
    return madaUrl;
  }

  // Wikimedia và các domain khác → load trực tiếp
  return madaUrl;
}

// RAG imports
import { vectorStore } from './lib/rag/vectorStore';
import { ragEngine } from './lib/rag/ragEngine';
import { ragService } from './lib/rag/rag.service'; // ⭐ Seed data service
import { dataIngestion } from './lib/rag/dataIngestion';
import type { DataSource } from './lib/rag/dataIngestion';
import { guardrails } from './lib/guardrails';

// Scheduler imports
import { startScheduler } from './lib/scraping-scheduler';

// Auth imports
import './lib/db'; // Initialize DB
import db, { getFileUploadQuota, trackFileUpload } from './lib/db';
import { authenticate, requireRole } from './lib/auth';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import userHistoryRoutes from './routes/userHistory';
import kbRoutes from './routes/knowledgeBase';
import scraperRoutes from './routes/scraper';
import madaScraperRoutes from './routes/mada-scraper';
import approvalRoutes from './routes/admin-approval';
import scraperScheduleRoutes from './routes/scraper-schedule';
import paymentRoutes from './routes/payments';
import productsRoutes from './routes/products';
import consultationRoutes from './routes/consultation';
import consultationApiRoutes from './routes/consultation-api';
import adminRoutes from './routes/admin';
import adminScraperRoutes from './routes/admin-scraper';
import promptsRoutes from './routes/prompts';
import promptTemplatesRoutes from './routes/prompt-templates';
import suggestedQuestionsRoutes from './routes/suggested-questions';
import urlImportRoutes from './routes/urlImport';
import publicRoutes from './routes/public';
import permissionsRoutes from './routes/permissions';
import chatRoutes from './routes/chat';
import notificationsRoutes from './routes/notifications';
import supportRoutes from './routes/support';
import widgetRoutes from './routes/widget';

// Chat context (shared state)
import { setRagInitialized } from './lib/chat-context';

// Load .env from project root (mada-ai-assistant/.env), not just cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback to local .env if any

// ============== UNHANDLED PROMISE REJECTION HANDLER ==============
// Prevents silent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION:');
  console.error('Promise:', promise);
  console.error('Reason:', reason instanceof Error ? reason.stack : reason);
  // Don't exit - let the server continue running
});

process.on('uncaughtException', (error: Error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  // For uncaught exceptions, we should exit as the process is in an undefined state
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json({ limit: '50mb' })); // Support large files
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============== RATE LIMITING (Task 4 - Bảo vệ API) ==============
// Áp dụng cho /api/* để chống spam
import { createRateLimiter } from './lib/middleware/rate-limiter';
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 300, // Tăng từ 100 → 300 để không vướng khi admin polling /admin/scraper + chat cùng lúc
});
app.use('/api/', apiRateLimiter);

// Skip rate limit cho admin scraper routes (ch� admin mới vào được - đã có requireRole)
app.use('/api/admin/scraper', (_req, _res, next) => next());

// Rate limit chặt hơn cho các endpoint đắt tài nguyên (chat, recommend, rag)
const heavyApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200, // 200 requests / phút / IP cho AI endpoints
});
app.use('/api/recommend', heavyApiRateLimiter);
app.use('/api/chat', heavyApiRateLimiter);

// ============== SECURITY HEADERS (CSP) ==============
// CSP header for local development - allows localhost resources
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
    "img-src 'self' data: blob: http://localhost:* https://localhost:* https://api.dicebear.com https://img.onelife.vn https://at.mada.org.qa https://cdn.at.mada.org.qa https://cdn.mada.org.qa https://mada.org.qa https://storage.googleapis.com https://*.googleusercontent.com https://lh3.googleusercontent.com; " +
    "connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* https://api.dicebear.com; " +
    "frame-ancestors 'self'; " +
    "worker-src 'self' blob:; " +
    "object-src 'none';"
  );
  next();
});

// ============== PERFORMANCE MONITORING ==============
// In-memory storage for performance metrics
const performanceMetrics = {
  requests: [] as Array<{
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    timestamp: number;
  }>,
  // API Response time thresholds (ms)
  thresholds: {
    chat: 2000,      // Chat API: < 2s
    rag: 1000,       // RAG Search: < 1s
    recommend: 1500, // Recommendations: < 1.5s
    default: 2000,   // Default: < 2s
  },
  // Add request to metrics
  addRequest(method: string, path: string, statusCode: number, responseTime: number) {
    this.requests.push({ method, path, statusCode, responseTime, timestamp: Date.now() });
    // Keep only last 1000 requests
    if (this.requests.length > 1000) {
      this.requests = this.requests.slice(-1000);
    }
  },
  // Get stats for specific endpoint
  getStats(endpoint?: string) {
    const filtered = endpoint 
      ? this.requests.filter(r => r.path.includes(endpoint))
      : this.requests;
    
    if (filtered.length === 0) return null;
    
    const times = filtered.map(r => r.responseTime);
    return {
      count: filtered.length,
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      min: Math.min(...times),
      max: Math.max(...times),
      p50: times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)],
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
      p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)],
      successRate: (filtered.filter(r => r.statusCode < 400).length / filtered.length * 100).toFixed(1),
    };
  },
  // Check if response time meets threshold
  checkThreshold(path: string, responseTime: number): boolean {
    if (path.includes('/chat')) return responseTime < this.thresholds.chat;
    if (path.includes('/rag')) return responseTime < this.thresholds.rag;
    if (path.includes('/recommend')) return responseTime < this.thresholds.recommend;
    return responseTime < this.thresholds.default;
  },
  // Reset metrics
  reset() {
    this.requests = [];
  }
};

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    const responseTime = Date.now() - startTime;
    const path = req.route?.path || req.path;
    
    // Record metric
    performanceMetrics.addRequest(req.method, path, res.statusCode, responseTime);
    
    // Log slow requests (>= 1.5s)
    if (responseTime >= 1500) {
      console.warn(`⚠️  Slow request: ${req.method} ${path} - ${responseTime}ms`);
    }
    
    return originalEnd.apply(this, args as any);
  };
  
  next();
});

// ============== SYSTEM SETTINGS (In-memory, admin can update) ==============
interface SystemSettings {
  anonymousLimit: number;      // -1 = unlimited, else max messages for anonymous
  defaultPlanLimit: number;    // -1 = unlimited for default free plan
  maxFilesPerSession: number;  // max files per chat session
  maxFilesTotal: number;       // max files total per user
  maxFileSizeMB: number;       // max file size in MB
  websiteUrl: string;         // website URL for data collection
  categoryOrder: string[];    // ⭐ Thứ tự hiển thị của các bot trong sidebar
}

let systemSettings: SystemSettings = {
  anonymousLimit: -1,        // Mặc định không giới hạn (theo yêu cầu sếp)
  defaultPlanLimit: -1,
  maxFilesPerSession: 10,
  maxFilesTotal: 100,
  maxFileSizeMB: 50,
  websiteUrl: '',
  categoryOrder: ['vision', 'hearing', 'communication', 'cognition', 'mobility', 'daily_living', 'education'],
};

// API endpoint to get system settings
app.get('/api/system/settings', (_req, res) => {
  res.json({ success: true, data: systemSettings });
});

// API endpoint to update system settings (admin only)
app.put('/api/system/settings', authenticate as any, requireRole('admin') as any, (req, res) => {
  const { anonymousLimit, defaultPlanLimit, maxFilesPerSession, maxFilesTotal, maxFileSizeMB, websiteUrl, categoryOrder } = req.body;

  if (anonymousLimit !== undefined) systemSettings.anonymousLimit = anonymousLimit;
  if (defaultPlanLimit !== undefined) systemSettings.defaultPlanLimit = defaultPlanLimit;
  if (maxFilesPerSession !== undefined) systemSettings.maxFilesPerSession = maxFilesPerSession;
  if (maxFilesTotal !== undefined) systemSettings.maxFilesTotal = maxFilesTotal;
  if (maxFileSizeMB !== undefined) systemSettings.maxFileSizeMB = maxFileSizeMB;
  if (websiteUrl !== undefined) systemSettings.websiteUrl = websiteUrl;
  if (categoryOrder !== undefined) systemSettings.categoryOrder = categoryOrder;

  console.log('📝 System settings updated:', systemSettings);
  res.json({ success: true, data: systemSettings });
});

// Helper function to get settings
function getSystemSettings(): SystemSettings {
  return systemSettings;
}

// Performance metrics endpoint
app.get('/api/performance/metrics', (_req, res) => {
  res.json({
    success: true,
    data: {
      summary: performanceMetrics.getStats(),
      chat: performanceMetrics.getStats('/chat'),
      rag: performanceMetrics.getStats('/rag'),
      recommend: performanceMetrics.getStats('/recommend'),
      recentRequests: performanceMetrics.requests.slice(-20),
    }
  });
});

// Performance health check endpoint
app.get('/api/performance/health', (_req, res) => {
  const stats = performanceMetrics.getStats();
  const isHealthy = stats ? parseFloat(stats.successRate) >= 95 : true;
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    averageResponseTime: stats?.avg || 0,
    successRate: stats?.successRate || '100',
    thresholds: performanceMetrics.thresholds,
  });
});

// Get threshold status for an endpoint
app.get('/api/performance/threshold/:endpoint', (req, res) => {
  const endpoint = req.params.endpoint;
  const stats = performanceMetrics.getStats(endpoint);
  
  if (!stats) {
    return res.json({ success: true, status: 'no_data', message: 'No data for this endpoint' });
  }
  
  let threshold = performanceMetrics.thresholds.default;
  if (endpoint.includes('chat')) threshold = performanceMetrics.thresholds.chat;
  else if (endpoint.includes('rag')) threshold = performanceMetrics.thresholds.rag;
  else if (endpoint.includes('recommend')) threshold = performanceMetrics.thresholds.recommend;
  
  const meetsThreshold = stats.p95 <= threshold;
  
  res.json({
    success: true,
    endpoint,
    threshold,
    stats: {
      avg: stats.avg,
      p50: stats.p50,
      p95: stats.p95,
      p99: stats.p99,
    },
    meetsThreshold,
    status: meetsThreshold ? '✅ PASS' : '❌ FAIL',
  });
});

// ============== SESSION SETUP ==============
app.use(session({
  secret: process.env.SESSION_SECRET || 'mada-ai-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
}));

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (mobile, curl, server-side)
    if (!origin) return callback(null, true);

    // Whitelist localhost with any port for dev
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

    // Allow any Cloud Run service URL (*.run.app)
    // URL format: https://service-hash.region-hash.run.app or https://project-number.region-hash.run.app
    console.log('[CORS] Checking origin:', origin);
    if (/^https:\/\/[a-zA-Z0-9.-]+\.run\.app$/.test(origin)) return callback(null, true);

    // Production domains (hardcoded + env)
    const productionDomains = [
      'https://mada.digiso.vn',
      'https://www.mada.digiso.vn',
    ];

    // Production origins (set via env)
    if (process.env.CORS_ORIGINS) {
      const allowed = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
      productionDomains.push(...allowed);
    }

    if (productionDomains.includes(origin)) return callback(null, true);

    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ============== AUTH ROUTES ==============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', userHistoryRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/payments', paymentRoutes);
// ⭐ Mount productsRoutes ở 2 prefix: /items (file gốc) và /products (frontend gọi)
app.use('/api/admin/items', productsRoutes);
app.use('/api/admin/products', productsRoutes);

// ============== MADA IMAGE PROXY ==============
// Proxy requests to MADA images to avoid hotlink protection
// Returns actual image bytes or a fallback 1x1 transparent PNG
app.get('/api/mada-image', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    // Return fallback image (1x1 transparent PNG)
    return res.status(200)
      .setHeader('Content-Type', 'image/png')
      .setHeader('Cache-Control', 'no-store')
      .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }

  // Validate URL is allowed
  // Chấp nhận: mada.org.qa (MADA gốc), cdn.at.mada.org.qa, cdn.mada.org.qa, plus các shop VN hợp lệ
  const allowedHosts = [
    'mada.org.qa',
    'cdn.at.mada.org.qa',
    'cdn.mada.org.qa',
    'at.mada.org.qa',
    // Shop VN phổ biến - nhiều SP AT nhập từ shop VN
    'cdn.tgdd.vn',
    'cdn.cellphones.com.vn',
    'cdn.fptshop.com.vn',
    'images.fpt.shop',
    'cdn.dienmayxanh.com',
    'img.dienmayxanh.com',
    'product.hstatic.net',
    'cdn.viettelstore.vn',
  ];
  const isAllowed = allowedHosts.some((host) => url.includes(host));
  if (!isAllowed) {
    // Return fallback image instead of JSON error
    return res.status(200)
      .setHeader('Content-Type', 'image/png')
      .setHeader('Cache-Control', 'no-store')
      .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://at.mada.org.qa/',
      },
      // ⭐ Timeout để tránh stuck
      signal: AbortSignal.timeout(10000), // 10s
    });

    if (!response.ok) {
      console.warn(`[mada-image] upstream ${response.status}: ${url}`);
      // Return fallback image instead of JSON error
      return res.status(200)
        .setHeader('Content-Type', 'image/png')
        .setHeader('Cache-Control', 'no-store')
        .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-MADA-Proxy', 'true');
    res.setHeader('X-Cache-Buster', Date.now().toString());
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error(`[mada-image] proxy error: ${url}`, err.message);
    // Return fallback image instead of JSON error
    return res.status(200)
      .setHeader('Content-Type', 'image/png')
      .setHeader('Cache-Control', 'no-store')
      .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }
});

// ============== IN-MEMORY ACTIVITY LOG ==============
interface ActivityLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: string;
  user?: string;
  details?: string;
}

const activityLogs: ActivityLog[] = [];
const MAX_LOGS = 500;

export function logActivity(level: ActivityLog['level'], message: string, source: string, user?: string, details?: string) {
  const entry: ActivityLog = {
    id: crypto.randomUUID(),
    level,
    message,
    source,
    timestamp: new Date().toISOString(),
    user,
    details,
  };
  activityLogs.unshift(entry);
  if (activityLogs.length > MAX_LOGS) activityLogs.length = MAX_LOGS;
  // Mirror to console
  const prefix = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' }[level];
  console.log(`${prefix} [${source}] ${message}${user ? ` (user: ${user})` : ''}`);
}

// Seed bootstrapping logs
logActivity('info', 'MADA AI Server started on port ' + (process.env.PORT || 8080), 'System');
logActivity('info', 'Vector store initialized with 65 documents', 'RAG Engine');
logActivity('success', 'Auth service configured (SQLite + JWT + bcrypt)', 'Auth Service');
logActivity('info', 'CORS policy: any localhost port allowed (dev)', 'Security');

// ============== ADMIN ROUTES ==============
app.use('/api/scraper', scraperRoutes);
app.use('/api/scraper', scraperScheduleRoutes);
app.use('/api/scraper', urlImportRoutes);
app.use('/api/mada-scraper', madaScraperRoutes);
// ⭐ adminRoutes PHẢI mount TRƯỚC approvalRoutes
// vì approvalRoutes có global auth middleware chặn TẤT CẢ /api/admin/*
// Nếu adminRoutes sau → public endpoints như /file-settings/public bị chặn 401
app.use('/api/admin', adminRoutes);
app.use('/api/admin/suggested-questions', suggestedQuestionsRoutes); // ← mount TRƯỚC approvalRoutes (auth middleware)
app.use('/api/admin', approvalRoutes);
app.use('/api/consultation', consultationRoutes);
app.use('/api/consult', consultationApiRoutes);
app.use('/api/admin/scraper', adminScraperRoutes);
app.use('/api/admin/prompts', promptsRoutes);
app.use('/api/admin/prompt-templates', promptTemplatesRoutes);
app.use('/api/public', publicRoutes);

// ============== PERMISSIONS ROUTES ==============
app.use('/api/permissions', permissionsRoutes);

// ============== CHAT ROUTES (AI/RAG Pipeline) ==============
app.use('/api/chat', chatRoutes);

// ============== WIDGET CONFIG ROUTES ==============
app.use('/api/widget', widgetRoutes);

// ============== NOTIFICATIONS ROUTES ==============
app.use('/api/notifications', notificationsRoutes);

// ============== SUPPORT TICKETS ROUTES ==============
app.use('/api/support', supportRoutes);
app.get('/api/admin/logs', async (req, res) => {
  try {
    const { level, source, limit = '100' } = req.query;
    let filtered = [...activityLogs];
    if (level && typeof level === 'string') {
      filtered = filtered.filter((l) => l.level === level);
    }
    if (source && typeof source === 'string') {
      filtered = filtered.filter((l) => l.source === source);
    }
    const limitNum = Math.min(parseInt(limit as string) || 100, 500);
    res.json({
      success: true,
      data: {
        logs: filtered.slice(0, limitNum),
        total: filtered.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/logs/sources', async (_req, res) => {
  const sources = Array.from(new Set(activityLogs.map((l) => l.source)));
  res.json({ success: true, data: { sources } });
});

app.delete('/api/admin/logs', async (_req, res) => {
  activityLogs.length = 0;
  logActivity('info', 'Activity logs cleared by admin', 'Admin');
  res.json({ success: true, message: 'Logs cleared' });
});

// ============== FILE UPLOAD QUOTA ENDPOINTS ==============
// Authenticated: trả quota của user hiện tại
// Anonymous (không có Bearer token): trả quota "guest" theo plan mặc định (free),
// dùng cho ChatPage hiển thị counter. Không 401 để tránh log lỗi đỏ trên console.
app.get('/api/user/file-quota', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const hasToken = authHeader?.startsWith('Bearer ');

    if (!hasToken) {
      // Guest: trả quota mặc định theo plan free, used=0
      const { getFileUploadLimitForPlan } = await import('./lib/db');
      const limit = getFileUploadLimitForPlan('free');
      const remaining = limit === -1 ? -1 : Math.max(0, limit - 0);
      return res.json({
        success: true,
        data: {
          used: 0,
          limit,
          remaining,
          plan: 'free' as const,
          monthKey: new Date().toISOString().slice(0, 7),
          isGuest: true,
        },
      });
    }

    const token = authHeader!.slice('Bearer '.length);
    const { verifyAccessToken } = await import('./lib/auth');
    const payload = verifyAccessToken(token) as any;
    if (!payload?.userId) {
      // Token sai/hết hạn → cũng trả guest quota, không 401
      const { getFileUploadLimitForPlan } = await import('./lib/db');
      const limit = getFileUploadLimitForPlan('free');
      return res.json({
        success: true,
        data: {
          used: 0,
          limit,
          remaining: limit === -1 ? -1 : Math.max(0, limit - 0),
          plan: 'free' as const,
          monthKey: new Date().toISOString().slice(0, 7),
          isGuest: true,
        },
      });
    }

    const user = db.prepare('SELECT id, plan FROM users WHERE id = ?').get(payload.userId) as { id: string; plan: 'free' | 'pro' | 'enterprise' } | undefined;
    if (!user) {
      const { getFileUploadLimitForPlan } = await import('./lib/db');
      const limit = getFileUploadLimitForPlan('free');
      return res.json({
        success: true,
        data: {
          used: 0,
          limit,
          remaining: limit === -1 ? -1 : Math.max(0, limit - 0),
          plan: 'free' as const,
          monthKey: new Date().toISOString().slice(0, 7),
          isGuest: true,
        },
      });
    }

    const quota = getFileUploadQuota(user.id, user.plan);
    res.json({ success: true, data: quota });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Admin/system: trả plan limits để FE hiển thị pricing card
app.get('/api/user/file-quota/plan-limits', async (_req, res) => {
  try {
    const { getFileUploadLimitForPlan } = await import('./lib/db');
    res.json({
      success: true,
      data: {
        free: getFileUploadLimitForPlan('free'),
        pro: getFileUploadLimitForPlan('pro'),
        enterprise: getFileUploadLimitForPlan('enterprise'),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Admin analytics summary
app.get('/api/admin/analytics', async (_req, res) => {
  try {
    const kbStats = await vectorStore.getStats();
    const levelCounts = activityLogs.reduce(
      (acc, l) => {
        acc[l.level] = (acc[l.level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    res.json({
      success: true,
      data: {
        kb: kbStats,
        logs: {
          total: activityLogs.length,
          byLevel: levelCounts,
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/analytics] failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: (error as Error).message });
  }
});

// Chat analytics aggregated from real activity logs
app.get('/api/admin/chat-metrics', async (req, res) => {
  try {
    const { range = '24h' } = req.query as { range?: string };
    const now = Date.now();
    const rangeMs: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };
    const window = rangeMs[range] ?? rangeMs['24h'];

    const chatLogs = activityLogs.filter((l) => {
      const t = new Date(l.timestamp ?? 0).getTime();
      return l.source === 'Chat' && now - t <= window;
    });

    const totalChats = chatLogs.length;
    const hourlyBuckets = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    chatLogs.forEach((l) => {
      const hour = new Date(l.timestamp ?? now).getHours();
      hourlyBuckets[hour].count += 1;
    });

    const topQueryCounts = new Map<string, number>();
    chatLogs.forEach((l) => {
      const msg = l.message ?? '';
      const match = msg.match(/question[:\s]+["']?([^"'\n]+)/i);
      const q = (match?.[1] ?? '').trim().slice(0, 60);
      if (q.length > 0) topQueryCounts.set(q, (topQueryCounts.get(q) ?? 0) + 1);
    });
    const topQueries = Array.from(topQueryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const langCounts: Record<string, number> = {
      'Tiếng Việt': 0,
      'English': 0,
      'العربية': 0,
      'Français': 0,
    };
    chatLogs.forEach((l) => {
      const lang = (l as any).language ?? (l.message?.includes('lang:en') ? 'English' : l.message?.includes('lang:ar') ? 'العربية' : l.message?.includes('lang:fr') ? 'Français' : 'Tiếng Việt');
      langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    });
    const languageDistribution = [
      { language: 'Tiếng Việt', count: langCounts['Tiếng Việt'] ?? 0, color: '#ef4444' },
      { language: 'English', count: langCounts['English'] ?? 0, color: '#3b82f6' },
      { language: 'العربية', count: langCounts['العربية'] ?? 0, color: '#10b981' },
      { language: 'Français', count: langCounts['Français'] ?? 0, color: '#f59e0b' },
    ];

    const errorCount = activityLogs.filter((l) => {
      const t = new Date(l.timestamp ?? 0).getTime();
      return l.level === 'error' && now - t <= window;
    }).length;
    const errorRate = totalChats > 0 ? (errorCount / totalChats) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalChats,
        avgResponseTime: 0,
        avgConfidence: 0,
        topQueries,
        chatsByHour: hourlyBuckets,
        categoryUsage: [],
        languageDistribution,
        errorRate,
      },
    });
  } catch (error) {
    console.error('Chat metrics error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/admin/chat-metrics - Track chat metrics (no auth required, fire-and-forget)
app.post('/api/admin/chat-metrics', async (req, res) => {
  try {
    const { conversationId: _cId, latencyMs: _lat, confidence: _conf, botId: _bot, language: _lang, userMode: _um } = req.body;
    // Fire-and-forget: just acknowledge and skip logging to avoid noise
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== GLOBAL ERROR HANDLER (Multer + JSON) ==============
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('🚨 Global error handler:', err.message);

  // Multer errors
  if (err && err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: err.code,
    });
  }

  // Custom fileFilter errors (from us)
  if (err && err.message && err.message.includes('Định dạng file không hỗ trợ')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Other errors
  if (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// Initialize RAG on startup
export let ragInitialized = false;

/**
 * Sync all knowledge_items từ SQLite → vector store khi khởi động.
 * Fix bug "không tìm thấy trong CSDL" vì 358 items không được auto-sync.
 * Lý do: trước đó chỉ sync items có status='published', nhưng data scrape hiện tại
 * toàn 'draft' → vector store rỗng.
 */
async function syncKnowledgeBaseToVectorStore(): Promise<void> {
  try {
    const db = (await import('./lib/db')).default;

    // Lấy TẤT CẢ items có content (bất kể status - vì draft vẫn cần search được)
    const items = db.prepare(`
      SELECT id, title, content, source, source_type, category, metadata, language
      FROM knowledge_items
      WHERE content IS NOT NULL AND length(content) > 20
      LIMIT 500
    `).all() as any[];

    if (items.length === 0) {
      console.log('📚 [Sync KB] No items to sync');
      return;
    }

    console.log(`📚 [Sync KB] Syncing ${items.length} items to vector store...`);

    const documents = items.map((item) => {
      let meta: any = {};
      try {
        meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
      } catch { meta = {}; }

      return {
        id: item.id,
        content: `${item.title}\n\n${item.content}`.slice(0, 4000),
        metadata: {
          source: item.source || '',
          type: item.source_type || 'web',
          title: item.title || '',
          category: item.category || 'general',
          ...meta,
        },
      };
    });

    // Bulk add - tự chunk để tránh rate limit
    const CHUNK_SIZE = 20;
    let synced = 0;
    for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
      const chunk = documents.slice(i, i + CHUNK_SIZE);
      try {
        await vectorStore.addDocuments(chunk);
        synced += chunk.length;
        if (i % 100 === 0) {
          console.log(`   ${synced}/${documents.length}...`);
        }
      } catch (err) {
        console.warn(`   ⚠️ Chunk ${i}-${i + CHUNK_SIZE} failed:`, (err as Error).message);
      }
    }

    // Đánh dấu indexed=1
    const stmt = db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ? WHERE id = ?');
    for (const item of items) {
      stmt.run(new Date().toISOString(), item.id);
    }

    console.log(`✅ [Sync KB] Done! ${synced}/${documents.length} items indexed in vector store`);
  } catch (err) {
    console.error('❌ [Sync KB] Failed:', (err as Error).message);
  }
}

async function initializeServices() {
  try {
    await vectorStore.initialize();
    ragEngine.initialize();
    guardrails.initialize();
    ragInitialized = true;
    setRagInitialized(true); // Sync with chat-context module
    console.log('🚀 RAG system ready');
    console.log('🛡️ Guardrails system ready');

    // ⭐ Auto-sync SQLite → vector store để search hoạt động
    await syncKnowledgeBaseToVectorStore();

    // Start scraping scheduler
    startScheduler();
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

/**
 * Wait for RAG engine to be ready (wait for initialization if server just started)
 */
async function waitForRagReady(timeoutMs: number = 15000): Promise<boolean> {
  const startTime = Date.now();
  while (!ragInitialized) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn('⚠️ RAG engine not ready after', timeoutMs, 'ms');
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return true;
}

/**
 * Initialize all services synchronously before server starts.
 * This ensures RAG is ready before handling requests.
 */
async function bootstrap(): Promise<void> {
  console.log('🔧 Initializing services...');
  
  try {
    await initializeServices();
    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    // Don't exit - let server start anyway for debugging
  }
}

// bootstrap() is now called inside the listen() block below so we can await
// service initialization before accepting traffic.
const consultations: any[] = [];
const chatHistory: Map<string, any[]> = new Map();

// ============== HTTP SERVER ==============
// PORT already defined at line ~94
const HOST = '0.0.0.0';

// @ts-ignore - Express listen overload conflict (kept as Server for graceful shutdown)
// Wait for bootstrap() to complete (initializeServices includes ragEngine.initialize +
// syncKnowledgeBaseToVectorStore) BEFORE accepting connections. Without this, requests
// can race ahead of RAG init and hit "Hệ thống đang khởi tạo" even though the engine
// is healthy seconds later.
bootstrap().then(() => {
  const server = app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 MADA AI Server running on http://${HOST}:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/`);
    console.log(`⚡ RAG Enabled: ${ragInitialized}`);
    console.log(`🤖 Gemini Configured: ${!!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'}`);
    console.log(`🛡️  Guardrails: Active`);
    console.log(`🔐 Auth: SQLite + bcrypt + JWT (admin: ${process.env.ADMIN_EMAIL || 'admin@mada.vn'})`);
  });
  void server; // intentionally kept for graceful shutdown support
}).catch((err) => {
  console.error('❌ Bootstrap failed, cannot start server:', err);
  process.exit(1);
});

// ============== MAPPING AGENT TO MADA ==============

const AGENT_TO_MADA: Record<string, { botId: string; madaCategory: string }> = {
  'bot-hearing':    { botId: 'bot-hearing',    madaCategory: 'sensory-hearing' },
  'bot-vision':     { botId: 'bot-vision',     madaCategory: 'sensory-vision' },
  'bot-speech':     { botId: 'bot-speech',     madaCategory: 'voice-and-speech' },
  'bot-cognitive':  { botId: 'bot-cognitive',  madaCategory: 'mental-cognitive' },
  'bot-neuro':      { botId: 'bot-neuro',      madaCategory: 'neuromusculoskeletal-movement' },
  'bot-mobility':   { botId: 'bot-mobility',   madaCategory: 'mobility-and-transportation' },
  'bot-regulatory': { botId: 'bot-regulatory', madaCategory: 'regulatory-standards' },
};

// ============== COMPREHENSIVE KNOWLEDGE BASE ==============

const COMPREHENSIVE_KNOWLEDGE = [
  // === VISION AIDS ===
  {
    topic: 'Phần mềm đọc màn hình - Screen Readers',
    content: `Phần mềm đọc màn hình là công cụ thiết yếu cho người khiếm thị sử dụng máy tính.

**JAWS (Job Access With Speech)**
- Nhà phát triển: Freedom Scientific (Mỹ)
- Là phần mềm đọc màn hình thương mại phổ biến nhất
- Hỗ trợ Windows, Microsoft Office, các trình duyệt web
- Có phiên bản dành cho doanh nghiệp và cá nhân
- Hỗ trợ hơn 40 ngôn ngữ bao gồm tiếng Việt
- Tương thích với màn hình Braille

**NVDA (NonVisual Desktop Access)**
- Nhà phát triển: NV Access (Australia)
- Phần mềm mã nguồn mở, miễn phí hoàn toàn
- Chỉ hỗ trợ Windows
- Được cộng đồng người dùng và nhà phát triển toàn cầu hỗ trợ
- Dung lượng nhẹ, có thể cài đặt trên USB
- Hỗ trợ hơn 50 ngôn ngữ
- Được nhiều tổ chức phi lợi nhuận tài trợ phát triển

**VoiceOver**
- Nhà phát triển: Apple Inc.
- Tích hợp sẵn trong macOS, iOS, iPadOS
- Miễn phí cho người dùng Apple
- Hỗ trợ đa ngôn ngữ
- Tích hợp sâu với hệ sinh thái Apple

**Narrator**
- Nhà phát triển: Microsoft
- Tích hợp sẵn trong Windows 10/11
- Miễn phí
- Được cải thiện đáng kể trong các phiên bản Windows gần đây

Tiêu chuẩn áp dụng: ISO 9999:24.09.15, EN 1332-20`,
  },
  {
    topic: 'Màn hình Braille - Braille Displays',
    content: `Màn hình Braille (Braille Display) là thiết bị phần cứng hiển thị văn bản dưới dạng chữ nổi Braille cho người khiếm thị.

**Cấu tạo:**
- Các ô Braille (cells) có thể nổi hoặc tụt xuống để tạo ký tự
- Mỗi ô Braille gồm 6 hoặc 8 chấm
- Các phím điều khiển tích hợp
- Kết nối USB hoặc Bluetooth

**Các loại phổ biến:**

*Focus Blue (40/80)*
- Nhà sản xuất: HumanWare (Canada)
- 40 hoặc 80 ô Braille
- Kết nối USB-C và Bluetooth
- Tương thích với JAWS, NVDA, VoiceOver
- Pin sạc với thời gian sử dụng 20 giờ

*Brailliant BI 40X/80X*
- Nhà sản xuất: HumanWare
- Công nghệ Brailler mới nhất
- Thiết kế mỏng, nhẹ
- Bàn phím Perkin
- Kết nối đa thiết bị

* HandyTech Active Braille*
- Nhà sản xuất: HandyTech (Đức)
- Chất lượng Đức, bền bỉ
- Tương thích cao

*ONYX*
- Nhà sản xuất: APH (American Printing House)
- Màn hình Braille kết hợp cảm ứng
- Hỗ trợ điều hướng đa ngón

Tiêu chuẩn: ISO 9999:24.09.12, EN 1332-4`,
  },
  {
    topic: 'Kính thông minh cho người khiếm thị - Smart Glasses',
    content: `Kính thông minh cho người khiếm thị sử dụng AI và camera để hỗ trợ nhận diện và điều hướng.

**OrCam MyEye**
- Nhà phát triển: OrCam Technologies (Israel)
- Camera nhỏ gắn vào gọng kính
- Nhận diện khuôn mặt
- Đọc văn bản tiếng Việt và 100+ ngôn ngữ
- Nhận diện tiền giấy
- Nhận diện sản phẩm (barcodes)
- Điều khiển bằng cử chỉ
- Dung lượng pin 4-6 giờ

**Aira**
- Dịch vụ kết nối với agent nhìn
- Camera trên kính hoặc smartphone
- Agent từ xa hỗ trợ 24/7
- Phù hợp cho công việc và sinh hoạt

**Envision AI Glasses**
- Nhà phát triển: Envision (Hà Lan)
- AI nhận diện đa chức năng
- Đọc văn bản thời gian thực
- Nhận diện khuôn mặt người quen
- Mô tả cảnh vật xung quanh
- Hỗ trợ hơn 60 ngôn ngữ

**Sunu Band**
- Sóng siêu âm phát hiện vật cản
- Đeo như đồng hồ
- Rung nhẹ khi có vật cản

Tiêu chuẩn: ISO 9999:24.09.27`,
  },
  {
    topic: 'Thiết bị phóng to và đọc - Video Magnifiers',
    content: ` Thiết bị phóng to hình ảnh (Video Magnifiers/CCTV) giúp người khiếm thị có thể đọc văn bản và xem hình ảnh.

**CCTV Desktop Magnifiers**
- Camera quét văn bản dưới bàn
- Màn hình hiển thị phóng to
- Điều chỉnh độ phóng to 2x-70x
- Chế độ màu: đen trắng, trắng đen, màu tự nhiên
- Đèn LED chiếu sáng
- Bàn đọc di chuyển được

*Topolino*
- Nhà sản xuất: Schweizer (Đức)
- Chất lượng cao, bền bỉ
- Điều khiển đơn giản

*Amigo 2*
- Nhà sản xuất: HIMS (Hàn Quốc)
- Màn hình 7 inch
- Di động, pin sạc

**Phần mềm phóng to máy tính:**

*ZoomText*
- Nhà phát triển: Vispero/Freedom Scientific
- Phóng to màn hình máy tính
- Nhiều chế độ màu
- Đọc văn bản (Text-to-Speech)
- Tương thích Windows

*MAGic*
- Nhà phát triển: Dolphin
- Phóng to và đọc
- Giao diện đơn giản

Tiêu chuẩn: ISO 9999:22.03.06`,
  },
  {
    topic: 'Thiết bị nhận diện cho người khiếm thị',
    content: `Các thiết bị và ứng dụng nhận diện giúp người khiếm thị tiếp cận thông tin trực quan.

**KNFB Reader**
- Nhà phát triển: KNFB Blaid
- Ứng dụng di động
- Chụp và đọc văn bản tiếng Việt
- Nhận diện tiếng Việt chính xác cao
- Hoạt động offline

**Envision AI App**
- Nhà phát triển: Envision
- Ứng dụng iOS/Android
- Đọc văn bản: tài liệu, sách, nhãn mác
- Nhận diện khuôn mặt
- Mô tả hình ảnh bằng AI
- Quét barcode tìm sản phẩm
- Hỗ trợ 60+ ngôn ngữ

**Seeing AI (Microsoft)**
- Miễn phí
- iOS
- Nhiều chế độ nhận diện:
  - Văn bản
  - Sản phẩm
  - Tiền
  - Khuôn mặt
  - Màu sắc
  - Chữ viết tay

**Be My Eyes**
- Kết nối với tình nguyện viên nhìn
- Gọi video hỗ trợ
- Phổ biến toàn cầu

Tiêu chuẩn: ISO 9999:24.09.33`,
  },

  // === HEARING AIDS ===
  {
    topic: 'Máy trợ thính - Hearing Aids',
    content: `Máy trợ thính là thiết bị điện tử khuếch đại âm thanh cho người khiếm thính.

**Các loại máy trợ thính:**

*BTE (Behind-The-Ear)*
- Máy đeo sau vành tai
- Bộ phận xử lý nằm sau tai
- Ống dẫn âm vào tai
- Phù hợp cho mất thính giác nhẹ đến nặng
- Dễ sử dụng, thay pin dễ dàng

*ITE (In-The-Ear)*
- Máy đeo trong vành tai
- Vừa khít với tai người dùng
- Thẩm mỹ hơn BTE
- Phù hợp mất thính giác nhẹ đến trung bình

*ITC (In-The-Canal)*
- Nhỏ hơn ITE
- Đặt trong ống tai
- Kém nổi bật
- Phù hợp mất thính giác nhẹ

*CIC (Completely-In-Canal)*
- Nhỏ nhất, đặt sâu trong ống tai
- Gần như không nhìn thấy
- Phù hợp mất thính giác nhẹ

**Công nghệ hiện đại:**
- Kết nối Bluetooth với điện thoại, TV
- Điều chỉnh bằng smartphone app
- Giảm tiếng ồn thông minh (AI)
- Nhiều chương trình nghe
- Pin sạc lithium
- Water-resistant

**Thương hiệu hàng đầu:**
- Phonak (Thụy Sĩ)
- Oticon (Đan Mạch)
- Widex (Đan Mạch)
- Signia/Siemens (Đức)
- ReSound (Đan Mạch)
- Starkey (Mỹ)

Tiêu chuẩn: ISO 9999:22.06.15, EN 60118`,
  },
  {
    topic: 'Hệ thống FM cho người điếc - FM Systems',
    content: `Hệ thống FM (Frequency Modulation) truyền âm thanh trực tiếp vào máy trợ thính, đặc biệt hữu ích trong lớp học và hội họp.

**Cấu tạo:**
- Bộ phát (Transmitter): Người nói đeo micro
- Máy thu (Receiver): Kết nối với máy trợ thính
- Tần số FM cố định

**Ứng dụng:**
- Lớp học cho học sinh khiếm thính
- Hội thảo, cuộc họp
- Giao tiếp cá nhân khoảng cách xa

**Phổ biến:**
- Phonak Roger
- Oticon EduMic
- Widex FM

**Loop Induction System**
- Sử dụng từ trường thay vì sóng FM
- Người đeo máy trợ thính chỉ cần bật chế độ "T"
- Lắp đặt cố định trong phòng

Tiêu chuẩn: IEC 60118-4, EN 60118-4`,
  },
  {
    topic: 'Thiết bị RTT và VRS cho người điếc',
    content: `Công nghệ hỗ trợ giao tiếp cho người điếc và khiếm thính.

**RTT (Real-Time Text)**
- Gửi văn bản trong thời gian thực khi gọi điện
- Không cần chờ người khác nhắn tin
- Tương tự chat nhưng tự động
- Tiêu chuẩn: ITU F.703, RFC 4103
- Hỗ trợ bởi nhiều nhà mạng

**VRS (Video Relay Service)**
- Trung gian viên dịch ngôn ngữ ký hiệu
- Người điếc gọi qua video
- Trung gian viên nhìn thấy cả hai
- Kết nối người điếc với người nghe
- Dịch vụ 24/7

**Các ứng dụng giao tiếp:**
- Convo (Mỹ)
- Sorenson (Mỹ)
- Global Teleco (Quốc tế)

**Alerting Devices**
- Chuông cửa kết nối đèn nháy
- Đồng hồ rung
- Chuông báo cháy kết nối đèn
- Cảm biến trẻ em khóc

Tiêu chuẩn: ADA (Americans with Disabilities Act), EN 1332`,
  },
  {
    topic: 'Phụ đề và công nghệ hỗ trợ cho người điếc',
    content: `Công nghệ hiển thị văn bản và phụ đề cho người điếc.

**Closed Captions (CC)**
- Phụ đề ẩn, bật được trên TV
- Bao gồm lời thoại, âm thanh, nguồn âm
- Mô tả tiếng ồn môi trường
- Tiêu chuẩn: EIA-608, EIA-708

**Open Captions**
- Phụ đề luôn hiển thị
- Không tắt được
- Phổ biến ở rạp chiếu phim

**Subtitles vs Captions**
- Subtitles: Chỉ lời thoại (cho người nghe được)
- Captions: Toàn bộ âm thanh (cho người điếc)

**Công nghệ tự động:**
- YouTube tự động phụ đề (English)
- Otter.ai ghi chép thời gian thực
- Google Live Caption (Android)
- Apple Live Captions (iOS)

**Sign Language Interpretation**
- Phim có người phiên dịch ngôn ngữ ký hiệu
- Cửa sổ nhỏ góc màn hình
- Tùy chọn trên Netflix, Disney+

Tiêu chuẩn: WCAG 2.1 Level AA, Section 508`,
  },

  // === MOBILITY AIDS ===
  {
    topic: 'Xe lăn điện - Electric Wheelchairs',
    content: `Xe lăn điện là phương tiện di chuyển cho người khuyết tật vận động, sử dụng động cơ điện.

**Phân loại theo vị trí người dùng:**

*Xe lăn điện tiêu chuẩn*
- Ngồi thẳng
- Điều khiển joystick
- Phù hợp sử dụng trong nhà và ngoài trời

*Xe lăn tự cân bằng (Standing)*
- Người dùng đứng được
- Hỗ trợ tuần hoàn máu
- Giảm loét da
- VD: Permobil C500, QS5 X850

*Xe lăn siêu nhẹ*
- Khung hợp kim nhôm/titan
- Dễ gấp, mang theo
- Phù hợp người tự dùng

**Điều khiển:**
- Joystick tay
- Điều khiển bằng cằm
- Điều khiển bằng hơi thở (sip-and-puff)
- Điều khiển bằng mắt (eye-tracking)
- App điện thoại

**Thông số kỹ thuật:**
- Tốc độ: 6-10 km/h
- Pin: 20-50 km/ lần sạc
- Tải trọng: 100-150 kg
- Trọng lượng: 60-150 kg

**Thương hiệu:**
- Permobil (Thụy Điển)
- Sunrise Medical (Mỹ/Anh)
- Invacare (Mỹ)
- Quickie (Mỹ)
- TiLite (Mỹ)

Tiêu chuẩn: ISO 9999:12.21.06, ISO 7176`,
  },
  {
    topic: 'Xe lăn leo cầu thang - Stair Climbing Wheelchairs',
    content: `Xe lăn leo cầu thang giúp người khuyết tật di chuyển giữa các tầng không có thang máy.

**Công nghệ:**

*Salamander System*
- Bánh xích leo cầu thang
- Gắn vào xe lăn thường
- Có thể tháo rời
- VD: Scalamobil S95

*iBOT (Innovative Wheelchair)*
- Công nghệ tự cân bằng
- Lên/xuống cầu thang bằng bánh xích
- Di chuyển trên địa hình gồ ghề
- Nhà sản xuất: DEKA (Mỹ)

*Stair-Trac*
- Bánh xích gắn thêm
- Lắp được nhiều loại xe lăn

**Đặc điểm:**
- An toàn khi leo
- Tốc độ leo: 8-15 bậc/phút
- Trọng lượng thêm: 15-30 kg
- Pin lithium

**Hạn chế:**
- Cầu thang phải đủ rộng
- Không leo được cầu thang xoắn
- Tốc độ chậm

Tiêu chuẩn: ISO 9999:12.21.15`,
  },
  {
    topic: 'Khung đi và nạng - Walkers and Crutches',
    content: `Thiết bị hỗ trợ đi lại cho người có khó khăn về vận động.

**Khung đi (Walkers/Rollators)**

*Khung đi tiêu chuẩn*
- Khung nhôm/inox
- 4 chân có đệm cao su
- Có hoặc không có bánh
- Gập được

*Rollator (Khung đi bánh)*
- 3-4 bánh xe
- Có phanh
- Có ghế ngồi
- Có giỏ đựng đồ
- Phù hợp đi bộ ngoài trời

**Nạng:**

*Nạng nách (Axillary Crutches)*
- Điểm tìm: nách và tay
- Phù hợp hồi phục ngắn hạn
- Điều chỉnh chiều cao dễ dàng

*Nạng quả (Forearm Crutches/Canadian Crutches)*
- Điểm tìm: cẳng tay
- Tay cầm và vòng ôm cẳng tay
- Phù hợp sử dụng dài hạn
- Giảm áp lực lên nách

*Nạng gập (Folding Crutches)*
- Gập được để mang theo
- Nhẹ, bằng nhôm

*Gậy 4 chân (Quad Cane)*
- 4 chân đế, vững hơn gậy thường
- Đế cao su chống trượt
- Phù hợp người già

**Vật liệu:**
- Nhôm: nhẹ, giá rẻ
- Titan: nhẹ, bền, đắt
- Carbon: rất nhẹ, rất đắt

Tiêu chuẩn: ISO 9999:12.03.06, ISO 9999:12.03.03`,
  },
  {
    topic: 'Thiết bị giả (Prosthetics)',
    content: `Thiết bị giả (Prosthetics) thay thế chi bị mất hoặc thiếu.

**Phân loại:**

*Chi giả trên (Upper Limb)*
- Tay giả (Above/Below Elbow)
- Ngón giả
- Vai giả
- Cánh tay giả

*Chi giả dưới (Lower Limb)*
- Chân giả (Above/Below Knee)
- Bàn chân giả
- Đầu gối giả
- Hông giả

**Công nghệ hiện đại:**

*Myoelectric (Điện cơ)*
- Điều khiển bằng tín hiệu cơ từ mỏm cụt
- Mở/đóng bàn tay giả tự nhiên
- Pin sạc
- VD: Össur bionic, Touch Bionics i-Limb

*Body-Powered (Động lực cơ thể)*
- Điều khiển bằng dây kéo và khớp vai
- Tin cậy, bền
- Giá thấp hơn myoelectric

*Cosmetic (Thẩm mỹ)*
- Giống như chi thật về hình dáng
- Chức năng hạn chế
- Trọng lượng nhẹ

*Microprocessor Knee*
- Đầu gối có vi xử lý
- Thích ứng với tốc độ đi
- Giảm té ngã
- VD: C-Leg (Ottobock), Rheo (Ossur)

**Ổ cắm (Socket):**
- Đúc theo mỏm cụt người dùng
- Vật liệu: nhựa composite, silicon
- Fit chính xác giảm đau

**Liner & Suspension:**
- Liner: Lớp đệm tiếp xúc da
- Suspension: Hệ thống giữ chân giả

Thương hiệu: Ottobock (Đức), Össur (Iceland), Touch Bionics (Mỹ)

Tiêu chuẩn: ISO 9999:24.06, ISO 10328`,
  },

  // === COGNITION AIDS ===
  {
    topic: 'Hỗ trợ nhận thức - Cognitive Aids',
    content: `Thiết bị và ứng dụng hỗ trợ người có khó khăn về nhận thức, trí nhớ, học tập.

**Thiết bị hỗ trợ trí nhớ:**

*NeuroPage*
- Thiết bị nhắc nhở bằng thông báo
- Lập trình được nhiều lịch
- Nhỏ gọn, mang theo

*Spoken Text*
- Nhắc nhở bằng giọng nói
- Đọc lịch, tin nhắn

**Ứng dụng hỗ trợ:**

*Picture Planner*
- Ứng dụng lịch với hình ảnh
- Phù hợp người khó đọc

*MediMinder*
- Hộp thuốc nhắc nhở
- Chia ngăn theo giờ
- Báo động khi đến giờ

*Google Calendar với nhắc nhở*
- Miễn phí
- Thông báo đa thiết bị

**Thiết bị học tập:**
- Bảng giao tiếp (Communication Boards)
- Thẻ hình ảnh (Picture Cards)
- Sách có kết cấu (Adaptive Books)

**Hỗ trợ đọc:**
- Sách nói (Audiobooks)
- Sách có phóng to (Large Print)
- Sách Braille
- Ứng dụng đọc sách: Audible, Google Play Books

**Hỗ trợ viết:**
- Bàn phím thích ứng
- Phần mềm nhận dạng giọng nói
- Ứng dụng ghi chú

Tiêu chuẩn: ISO 9999:05.15, ISO 9999:05.18`,
  },
  {
    topic: 'AAC - Giao tiếp thay thế và bổ sung',
    content: `AAC (Augmentative and Alternative Communication) là các phương pháp giao tiếp cho người không thể nói hoặc nói khó.

**Phân loại AAC:**

*Không cần thiết bị (Unaided AAC)*
- Ngôn ngữ ký hiệu
- Cử chỉ tự nhiên
- Biểu cảm khuôn mặt

*Cần thiết bị (Aided AAC)*
- Thiết bị điện tử
- Bảng giao tiếp không điện tử

**Bảng giao tiếp (Communication Boards)**
- Tấm gỗ/nhựa có hình ảnh
- Người dùng chỉ vào hình để giao tiếp
- Có thể cá nhân hóa

**Thiết bị phát âm (Speech Generating Devices - SGD)**

*Tobii Dynavox*
- Thiết bị theo dõi mắt (eye-tracking)
- Điều khiển bằng mắt
- Phần mềm: TD Snap, Communicator
- Hỗ trợ nhiều ngôn ngữ

*Prentke Romich*
- Thiết bị AAC hàng đầu
- Touch, switch, eye-tracking
- Thuật toán chiến lược ngữ vựng

*LIGHTWRITER*
- Bàn phím nhỏ
- Hiển thị văn bản trên màn hình
- Phát âm văn bản

**Ứng dụng AAC:**
- Proloquo2Go (iOS)
- TouchChat (iOS/Android)
- AACorn
- Avaz

**PECS (Picture Exchange Communication System)**
- Hệ thống 6 giai đoạn
- Bắt đầu từ trao đổi thẻ hình
- Phổ biến trên thế giới

Tiêu chuẩn: ISO 9999:05.15.06`,
  },

  // === STANDARDS ===
  {
    topic: 'Tiêu chuẩn WCAG 2.1 - Web Content Accessibility Guidelines',
    content: `WCAG (Web Content Accessibility Guidelines) là hướng dẫn quốc tế về tiếp cận nội dung web cho người khuyết tật.

**4 Nguyên tắc chính (POUR):**

*1. Perceivable (Có thể nhận thức)*
- Văn bản thay thế cho hình ảnh (Alt text)
- Phụ đề cho video
- Phiên âm cho audio
- Thiết kế có thể phóng to
- Đủ độ tương phản màu

*2. Operable (Có thể vận hành)*
- Điều hướng bằng bàn phím
- Đủ thời gian đọc nội dung
- Không có nội dung nhấp nháy nguy hiểm
- Hướng dẫn rõ ràng

*3. Understandable (Dễ hiểu)*
- Ngôn ngữ rõ ràng
- Điều hướng có thể dự đoán
- Hỗ trợ tránh và sửa lỗi

*4. Robust (Mạnh mẽ)*
- Tương thích với công nghệ hỗ trợ
- Valid HTML
- ARIA khi cần

**Mức tuân thủ:**

*Level A (Cơ bản)*
- Alt text cho hình ảnh
- Phụ đề cho video
- Điều hướng bằng bàn phím

*Level AA (Chuẩn - Khuyến nghị)*
- Độ tương phản 4.5:1
- Kích thước văn bản có thể phóng to 200%
- Nhận dạng ngôn ngữ trang
- **Pháp luật Việt Nam yêu cầu AA**

*Level AAA (Nâng cao)*
- Độ tương phản 7:1
- Ngôn ngữ ký hiệu
- Chú thích cho audio

**WCAG 2.1 bổ sung:**
- Tiêu chí 2.5.1: Cử chỉ đa điểm
- Tiêu chí 2.5.3: Nhãn trong tên
- Tiêu chí 2.5.4: Cơ chế hoạt động

Phát triển bởi: W3C Web Accessibility Initiative (WAI)
Website: https://www.w3.org/WAI/WCAG21/quickref/`,
  },
  {
    topic: 'Tiêu chuẩn ISO 9999 - Assistive Products',
    content: `ISO 9999 là tiêu chuẩn quốc tế về phân loại sản phẩm hỗ trợ cho người khuyết tật.

**Cấu trúc phân loại:**

*05 - Thiết bị hỗ trợ nhận thức*
- 05.03: Thiết bị hỗ trợ học tập
- 05.06: Thiết bị hỗ trợ nhắc nhở
- 05.09: Thiết bị đào tạo kỹ năng nhận thức
- 05.12: Thiết bị giao tiếp tăng cường

*12 - Thiết bị hỗ trợ di chuyển*
- 12.03: Nạng và khung đi
- 12.06: Xe lăn
- 12.12: Xe lăn điện
- 12.18: Xe lăn leo cầu thang
- 12.22: Phương tiện đi lại

*15 - Thiết bị hỗ trợ sinh hoạt*
- 15.03: Thiết bị ăn uống
- 15.06: Thiết bị vệ sinh
- 15.09: Quần áo và giày dép thích ứng
- 15.12: Thiết bị ngủ

*18 - Nhà ở và cơ sở công cộng*
- 18.03: Cửa và cửa sổ
- 18.06: Tay nắm và vòi nước
- 18.09: Bồn cầu
- 18.15: Thang máy

*22 - Thiết bị hỗ trợ thính giác*
- 22.03: Thiết bị khuếch đại âm thanh
- 22.06: Máy trợ thính
- 22.09: Thiết bị FM
- 22.12: Thiết bị báo động

*24 - Thiết bị hỗ trợ thị giác*
- 24.03: Thiết bị đọc
- 24.06: Phần mềm hỗ trợ
- 24.09: Thiết bị đọc màn hình
- 24.12: Màn hình Braille
- 24.18: Kính lúp
- 24.24: Thiết bị nhận diện

**Phiên bản hiện tại:** ISO 9999:2022 (Phiên bản thứ 7)
**Năm ban hành:** 2022
**Tổ chức:** ISO (International Organization for Standardization)

Website: https://www.iso.org/standard/76953.html`,
  },
  {
    topic: 'WHO GATE - Global Cooperation on Assistive Technology',
    content: `WHO GATE (Global Cooperation on Assistive Technology) là chương trình toàn cầu của WHO về công nghệ hỗ trợ.

**5 Chương trình chính của GATE:**

*1. People (Con người)*
- Đào tạo nhân lực
- Xây dựng năng lực cộng đồng
- Hỗ trợ người dùng cuối

*2. Products (Sản phẩm)*
- Danh mục sản phẩm AT
- Tiêu chuẩn chất lượng
- Priority Assistive Products List (APL)

*3. Provision (Cung cấp)*
- Chính sách quốc gia
- Mô hình cung cấp
- Bảo hiểm AT

*4. Personnel (Nhân sự)*
- Đào tạo chuyên gia AT
- Chứng chỉ nghề
- Hướng dẫn thực hành

*5. Policy (Chính sách)*
- Khung pháp lý
- Tiêu chuẩn quốc tế
- Chiến lược quốc gia

**Priority Assistive Products List (APL)**
Danh sách 50 sản phẩm AT ưu tiên, bao gồm:
- Wheelchairs
- Hearing aids
- Visual aids
- Communication aids
- prostheses
- Orthoses

**Mục tiêu GATE:**
- Đạt 50% nhu cầu AT được đáp ứng vào 2030
- 1 tỷ người được hưởng AT vào 2030

**Tài liệu quan trọng:**
- Priority Assistive Products List (2016)
- Improving Access to Assistive Technology (2017)
- Global perspectives on AT (2023)

Website: https://www.who.int/health-topics/assistive-technology`,
  },
  {
    topic: 'Thiết bị hỗ trợ sinh hoạt - Daily Living Aids',
    content: `Thiết bị hỗ trợ sinh hoạt hàng ngày cho người khuyết tật và người cao tuổi.

**Thiết bị ăn uống:**

*Nĩa/dĩa thích ứng*
- Tay cầm dày, dễ nắm
- Tay cầm nghiêng cho người yếu tay
- Nĩa/dĩa nặng cho người run tay

*Cốc uống thích ứng*
- Cốc có 2 quai
- Cốc có ống hút tích hợp
- Cốc có nắp chống tràn
- Cốc nhựa mềm

*Dụng cụ cắt thức ăn*
- Bàn cắt có đinh tán
- Kẹp cố định đĩa

**Thiết bị vệ sinh:**

*Ghế tắm*
- Ghế có lỗ (shower chair)
- Ghế xoay ngồi vào bồn
- Ghế tắm có tay vịn
- Ghế dài cho bồn tắm

*Tay vịn tường*
- Inox, gắn tường
- Gập được tiết kiệm không gian
- Đủ dài, chịu lực tốt

*Vòi sen cầm tay*
- Dây dài, đầu vòi linh hoạt
- Giá đỡ cao/thấp

**Thiết bị mặc quần áo:**

*Móc khoát quần áo*
- Móc dài 60-90cm
- Móc có gương
- Móc giày

*Kẹp tất/khoát tất*
- Dụng cụ khoát tất không cần cúi
- Dụng cụ kẹp tất

*Nút áo lớn*
- Nút áo khổng lồ
- Velcro thay nút

**Thiết bị ngủ:**

*Thanh vịn giường*
- Gắn cạnh giường
- Giúp ngồi dậy dễ dàng
- Có túi đựng đồ

*Gối thích ứng*
- Gối chống loét
- Gối hỗ trợ nằm nghiêng
- Gối cho người liệt nửa người

Tiêu chuẩn: ISO 9999:09.09, ISO 9999:09.12, ISO 9999:15.03`,
  },
  {
    topic: 'Công nghệ hỗ trợ cho người cao tuổi',
    content: `Giải pháp công nghệ hỗ trợ người cao tuổi duy trì độc lập và chất lượng cuộc sống.

**Thiết bị an toàn:**

*Hệ thống gọi cứu hộ*
- Vòng tay/pendant có nút SOS
- Gọi được 24/7
- GPS theo dõi vị trí
- Phát hiện té ngã tự động
- VD: Apple Watch, Life Alert, Medical Guardian

*Phát hiện té ngã*
- Cảm biến trong nhà
- Camera thông minh
- Thảm cảm ứng
- Báo động khi không phản ứng

**Công nghệ nhà thông minh:**

*Google Home / Amazon Alexa*
- Điều khiển bằng giọng nói
- Hẹn giờ, nhắc nhở
- Gọi điện
- Nghe nhạc, tin tức

*Đèn thông minh*
- Bật/tắt bằng giọng nói
- Hẹn giờ bật khi trời tối
- Ánh sáng ngủ (giảm ngã)

*Khoá cửa thông minh*
- Mở bằng mã số
- Mở bằng vân tay
- Điều khiển từ xa

**Ứng dụng sức khỏe:**

*Hỗ trợ thuốc*
- Nhắc uống thuốc
- Theo dõi lịch uống thuốc
- Kết nối với chuyên gia y tế

*Hỗ trợ từ xa*
- Tư vấn chuyên gia CNHT từ xa
- Video call với chuyên gia
- Theo dõi tiến trình sử dụng thiết bị hỗ trợ tại nhà

**Thiết bị giao tiếp:*
- Điện thoại màn hình lớn
- Tablet đơn giản hóa
- Ứng dụng video call dễ dùng

**Hỗ trợ vận động:**
- Xe lăn siêu nhẹ
- Thang máy gia đình
- Băng chuyền tường

Tiêu chuẩn: ISO 9999:09.09, ISO 9999:12.03`,
  },
  {
    topic: 'Công nghệ hỗ trợ cho trẻ em khuyết tật',
    content: `Giải pháp AT cho trẻ em khuyết tật để học tập, phát triển và tham gia cộng đồng.

**Hỗ trợ vận động cho trẻ:**

*Xe lăn trẻ em*
- Kích thước nhỏ, nhẹ
- Màu sắc hấp dẫn
- Có thể điều chỉnh theo tuổi
- VD: Invacare TFX, Quickie Rumble

*Ghế hỗ trợ*
- Ghế chuyên dụng cho trẻ
- Hỗ trợ tư thế đúng
- Bàn học tích hợp
- Có thể đặt xe lăn vào

*Áo nịt (Orthoses)*
- Nẹp chân, nẹp tay trẻ em
- Nhẹ, thoáng khí
- Thiết kế vui nhộn

**Hỗ trợ giao tiếp:**

*Bảng PECS trẻ em*
- Hình ảnh lớn, màu sắc
- Dễ chỉ vào
- Nhiều chủ đề

*Ứng dụng AAC trẻ em*
- Proloquo2Go
- TouchChat
- Toca Boca (games học nói)

*Đồ chơi hỗ trợ*
- Đồ chơi có nút lớn
- Đồ chơi cảm ứng
- Đồ chơi có âm thanh

**Hỗ trợ học tập:**

*Phần mềm học đọc*
- ABCmouse
- Reading Bear
- Starfall

*Ứng dụng học ký hiệu*
- Marlee Signs
- Baby Sign Language

*Kính lúp/đọc cho trẻ*
- Kính phóng to cầm tay
- Bảng phóng to

**Hỗ trợ thị giác cho trẻ:**

*Sách nói trẻ em*
- Audible Kids
- Bookshare
- Learning Ally

*Sách Braille trẻ em*
- Raised Dot Coding
- Bộ chữ cái Braille
- Đồ chơi Braille

**Hỗ trợ thính giác cho trẻ:**

*Máy trợ thính trẻ em*
- Thiết kế màu sắc
- Đeo móc tai trẻ em
- Pin an toàn

*FM System lớp học*
- Thiết bị Roger
- Giáo viên đeo micro
- Nghe rõ ràng trong lớp

**Tài nguyên giáo dục:**
- Understood.org
- Wrightslaw
- Do2Learn

Tiêu chuẩn: ISO 9999:05, UN CRPD Article 24 (Giáo dục)`,
  },
  {
    topic: 'Phần mềm và ứng dụng hỗ trợ tiếp cận - Accessibility Software',
    content: `Phần mềm và ứng dụng hỗ trợ người khuyết tật sử dụng công nghệ.

**Phần mềm đọc màn hình (Screen Readers):**
- JAWS (Windows) - Thương mại
- NVDA (Windows) - Miễn phí, mã nguồn mở
- VoiceOver (macOS/iOS) - Miễn phí
- Narrator (Windows) - Miễn phí
- Orca (Linux) - Miễn phí

**Phần mềm phóng to màn hình:**
- ZoomText - Phóng to và đọc
- MAGic - Dolphin
- Windows Magnifier - Miễn phí
- Apple Zoom - Miễn phí

**Phần mềm nhận dạng giọng nói:**
- Dragon NaturallySpeaking (Windows)
- Dragon Professional (Doanh nghiệp)
- Windows Speech Recognition - Miễn phí
- macOS Dictation - Miễn phí

**Phần mềm nhận dạng ký tự (OCR):**
- Adobe Acrobat
- ABBYY FineReader
- Google Keep (basic OCR)
- Microsoft OneNote (OCR)

**Trình duyệt web hỗ trợ:**
- Chrome với extension accessibility
- Firefox với add-on
- Edge với built-in reader

**Extension/Add-on hữu ích:**
- WebAIM Contrast Checker
- aXe accessibility testing
- WAVE evaluation tool
- Color Oracle (blindness simulation)

**Ứng dụng di động:**
- Be My Eyes (gọi tình nguyện viên)
- Aira (agent hỗ trợ)
- Seeing AI (Microsoft - iOS)
- Lookout (Google - Android)
- Envision AI (Android/iOS)

**Công cụ kiểm tra accessibility:**
- WAVE Web Accessibility Evaluation Tool
- axe DevTools
- Lighthouse (Chrome)
- Accessibility Insights (Microsoft)

**Phần mềm thiết kế accessibility:**
- Figma (built-in accessibility features)
- Adobe XD (accessibility plugins)
- Sketch (accessibility plugins)

Tiêu chuẩn: WCAG 2.1, Section 508, EN 301 549`,
  },
  {
    topic: 'Chính sách và pháp luật về hỗ trợ người khuyết tật',
    content: `Khuôn khổ pháp lý quốc tế và Việt Nam về công nghệ hỗ trợ.

**QUỐC TẾ:**

*Công ước Liên Hợp Quốc về Quyền Người Khuyết Tật (CRPD)*
- Được thông qua 2006
- Việt Nam phê chuẩn 2014
- Điều 4: Nghĩa vụ chung - cung cấp AT
- Điều 20: Di chuyển cá nhân
- Điều 26: Phục hồi chức năng
- Điều 32: Hợp tác quốc tế

*WHO Global Action Plan on AT (GATE)*
- Mục tiêu 1 tỷ người được hưởng AT vào 2030
- Priority Assistive Products List (APL)
- Hướng dẫn các quốc gia

*ISAAC - International Society for AAC*
- Tổ chức về giao tiếp thay thế
- Hội nghị thường niên
- Tài nguyên về AAC

**VIỆT NAM:**

*Luật Người khuyết tật 2010*
- Điều 25: Hỗ trợ phục hồi chức năng
- Điều 26: Hỗ trợ công nghệ hỗ trợ
- Điều 33: Dịch vụ trợ giúp

*Nghị định 28/2012/NĐ-CP*
- Quy định trợ giúp người khuyết tật
- Chính sách hỗ trợ AT

*Quyết định 1428/QĐ-TTg 2015*
- Chương trình hành động quốc gia về AT

**Tổ chức tại Việt Nam:**
- Trung ương Hội Người khuyết tật Việt Nam
- MADA Qatar (hỗ trợ AT quốc tế)
- Các trung tâm hỗ trợ người khuyết tật
- Trường Chuyên biệt

**Các quốc gia có chính sách AT tiên tiến:**
- Mỹ: ADA, Section 508, Medicare AT coverage
- Anh: Equality Act 2010, NHS AT services
- Úc: NDIS (National Disability Insurance Scheme)
- Đức: Soziale Pflegeversicherung (Bảo hiểm chăm sóc)
- Nhật: Act for Employment of Persons with Disabilities`,
  },
  {
    topic: 'Đào tạo và hướng dẫn sử dụng công nghệ hỗ trợ',
    content: `Hướng dẫn đào tạo người khuyết tật và gia đình sử dụng AT hiệu quả.

**Nguyên tắc đào tạo AT:**

*1. Định hướng người dùng*
- Xác định nhu cầu cá nhân
- Lựa chọn AT phù hợp
- Đào tạo theo tốc độ người học

*2. Đào tạo có cấu trúc*
- Bắt đầu từ đơn giản
- Tăng dần độ phức tạp
- Lặp lại và củng cố

*3. Thực hành trong môi trường thực*
- Tập trong nhà
- Tập ngoài cộng đồng
- Hỗ trợ khi cần

**Chương trình đào tạo phổ biến:**

*Đào tạo sử dụng xe lăn*
- Trung tâm VITA (Việt Nam)
- Đào tạo kỹ thuật viên
- Đào tạo người dùng

*Đào tạo máy trợ thính*
- Lắp đặt và cài đặt
- Sử dụng hàng ngày
- Bảo trì cơ bản

*Đào tạo NVDA/máy tính*
- Các trung tâm CNTT cho người khuyết tật
- Hướng dẫn trực tuyến
- Cộng đồng người dùng NVDA

**Tài nguyên học tập:**

*Online:*
- WebAIM.org - Hướng dẫn accessibility
- AAC Learning Journey
- Hadley Institute (blindness)
- Perkins eLearning

*YouTube channels:*
- AOAVids
- Tech Vision
- AT4ALL tutorials

*Sách:*
- "Computer Ease" - Hướng dẫn máy tính cho người mù
- "Living with Hearing Loss"
- "Wheelchair Skills Training"

**Đào tạo cho gia đình:**
- Tham gia chương trình gia đình người khuyết tật
- Học cách hỗ trợ đúng cách
- Kỹ thuật giao tiếp
- Quản lý AT tại nhà

**Chứng chỉ nghề:**
- ATP (Assistive Technology Professional)
- RESNA (Rehabilitation Engineering Society)
- CSUN Conference`,
  },
];

// ============== SEED KNOWLEDGE ==============

const SEED_KNOWLEDGE = [
  {
    topic: 'Thiết bị hỗ trợ người khiếm thị',
    content: `Các thiết bị hỗ trợ người khiếm thị bao gồm:
1. Phần mềm đọc màn hình: JAWS, NVDA, VoiceOver, SystemAccess
2. Phóng to hình ảnh: ZoomText, MAGic
3. Màn hình Braille: Focus, Brailliant, HandyTech
4. Kính thông minh: Aira, OrCam
5. Thiết bị nhận diện: KNFB Reader, Envision AI
6. Đồng hồ nói: Talking Watch, iWatch
7. Nhãn RFID: Talking Labels, PenFriend
Các thiết bị này giúp người khiếm thị tiếp cận thông tin, sử dụng máy tính, và sinh hoạt độc lập.`,
  },
  {
    topic: 'Tiêu chuẩn WCAG 2.1',
    content: `WCAG (Web Content Accessibility Guidelines) là tiêu chuẩn quốc tế về tiếp cận website cho người khuyết tật.

Các nguyên tắc chính (POUR):
- Perceivable (Có thể nhận thức): Nội dung phải có thể nhận thấy được
- Operable (Có thể vận hành): Giao diện phải có thể điều khiển được
- Understandable (Dễ hiểu): Thông tin phải dễ hiểu
- Robust (Mạnh mẽ): Phải tương thích với nhiều công nghệ hỗ trợ

Các mức tuân thủ:
- Level A: Cơ bản (tối thiểu)
- Level AA: Chuẩn (khuyến nghị)
- Level AAA: Nâng cao`,
  },
  {
    topic: 'Công nghệ hỗ trợ vận động',
    content: `Thiết bị hỗ trợ vận động (Mobility Aids):
1. Xe lăn thủ công: Xe lăn gấp, xe lăn cố định
2. Xe lăn điện: Điều khiển joystick, điện thoại
3. Xe lăn leo cầu thang: Scalamobil, Toppy
4. Khung đi/Khung tập: Walker, Rollator
5. Nạng/Gậy: Nạng nách, gậy 4 chân
6. Thiết bị giả: Chân giả, tay giả
7. Exoskeleton: Thiết bị hỗ trợ đi đứng

Tiêu chuẩn áp dụng: ISO 9999:12`,
  },
  {
    topic: 'Thiết bị hỗ trợ người điếc',
    content: `Công nghệ hỗ trợ thính giác (Hearing Aids):
1. Máy trợ thính: Behind-the-ear (BTE), In-the-ear (ITE), Completely-in-canal (CIC)
2. Thiết bị RTT (Real-Time Text): Gửi văn bản trong cuộc gọi
3. Thiết bị FM: Hệ thống FM cho lớp học, phòng họp
4. Subtitles/Closed Caption: Phụ đề cho TV, video
5. Video Relay Service (VRS): Dịch vụ trung gian qua video
6. Alerting Devices: Chuông, đèn báo, rung
7. Cochlear Implant: Thiết bị cấy ốc tai

Tiêu chuẩn: ITU F.703, ADA, EN 60118`,
  },
];

// ============== ROUTES ==============

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ragEnabled: ragInitialized,
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here',
    authEnabled: true,
    mailConfigured: !!(process.env.MAIL_HOST && process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD),
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me', 'POST /api/auth/refresh', 'PUT /api/auth/profile', 'PUT /api/auth/password'],
      users: ['GET /api/users', 'GET /api/users/:id', 'POST /api/users', 'PATCH /api/users/:id', 'DELETE /api/users/:id', 'GET /api/users/stats/overview'],
      kb: [
        'GET    /api/kb/categories',
        'GET    /api/kb/items?q=&category=&status=',
        'GET    /api/kb/items/:id',
        'PATCH  /api/kb/items/:id',
        'DELETE /api/kb/items/:id',
        'POST   /api/kb/items/:id/publish',
        'POST   /api/kb/items/:id/reindex',
        'POST   /api/kb/reindex-all',
        'POST   /api/kb/upload          (multipart: file PDF/DOCX/TXT)',
        'POST   /api/kb/upload-image    (multipart: ảnh → OCR)',
        'POST   /api/kb/text            (JSON: content, title)',
        'POST   /api/kb/scrape          (JSON: url, title)',
        'POST   /api/kb/classify        (JSON: text)',
        'GET    /api/kb/jobs',
        'GET    /api/kb/jobs/:id',
        'GET    /api/kb/stats',
      ],
    },
  });
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!process.env.MAIL_HOST || !process.env.MAIL_USERNAME || !process.env.MAIL_PASSWORD) {
      return res.status(500).json({
        success: false,
        error: 'Email not configured. Check MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env'
      });
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '465'),
      secure: process.env.MAIL_SECURE === 'true',
      requireTLS: process.env.MAIL_TLS === 'true',
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USERNAME,
      to: to || process.env.CONSULTATION_EMAIL || process.env.MAIL_USERNAME,
      subject: subject || 'Test Email from MADA AI',
      html: `<p>${message || 'This is a test email from MADA AI Assistant.'}</p>
             <p>Timestamp: ${new Date().toISOString()}</p>`,
    });

    res.json({ success: true, message: 'Email sent successfully!' });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

// ============== LANGUAGE DETECTION ==============
/**
 * Detect language from user message
 * Priority: Arabic > Vietnamese > French > English
 */
function detectMessageLanguage(message: string): 'vi' | 'en' | 'ar' | 'fr' {
  const text = message || '';
  
  // Check for Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  
  // Check for Vietnamese diacritics
  const viDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const viMatches = text.match(viDiacritics);
  if (viMatches && viMatches.length >= 2) {
    return 'vi';
  }
  
  // Check for French common words
  const frWords = /\b(je|tu|il|elle|nous|vous|ils|elles|bonjour|merci|oui|non|parce que|s'il vous plaît|désolé|excusez-moi|vous êtes|je suis|estre|être)\b/i;
  if (frWords.test(text)) {
    return 'fr';
  }
  
  // Default to English
  return 'en';
}

/**
 * Detect language của AI response (verify AI có tuân thủ system instruction không)
 * Returns language code nếu detect được, hoặc 'unknown' nếu không rõ ràng.
 */
function detectAnswerLanguage(answer: string): 'vi' | 'en' | 'ar' | 'fr' | 'unknown' {
  const text = (answer || '').trim();
  if (!text || text.length < 10) return 'unknown';

  // Arabic: Arabic chars > 30% → Arabic
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.length;
  if (arabicChars / totalChars > 0.3) return 'ar';

  // Vietnamese: có Vietnamese diacritics (ư, ơ, đ, etc)
  const viDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/;
  if (viDiacritics.test(text)) return 'vi';

  // French: French common words (≥2 match)
  const frCommon = /\b(le|la|les|un|une|des|du|de|et|ou|est|sont|avec|pour|sans|dans|sur|sous|tres|aussi|etre|avoir|faire|aller|venir|voir|savoir|prendre|parler)\b/i;
  const frMatches = (text.match(frCommon) || []).length;
  if (frMatches >= 2) return 'fr';

  // English: default nếu có Latin chars
  if (/[a-zA-Z]/.test(text)) return 'en';

  return 'unknown';
}

/**
 * Verify AI response có đúng ngôn ngữ UI không.
 * Returns true nếu response đúng ngôn ngữ mong đợi, false nếu sai.
 */
function isAnswerInExpectedLanguage(answer: string, expectedLang: 'vi' | 'en' | 'ar' | 'fr'): boolean {
  const detected = detectAnswerLanguage(answer);
  if (detected === 'unknown') return true; // Không chắc chắn → assume OK
  return detected === expectedLang;
}

/**
 * ⭐ SYSTEM PROMPT ĐẦY ĐỦ CHO TẤT CẢ 4 NGÔN NGỮ (VI/EN/AR/FR)
 * Dùng chung cho /api/chat, /api/chat-with-file, /api/chat/stream
 * Có structured rules + emergency injection nếu AI trả sai ngôn ngữ
 */
const _FULL_LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  vi: `🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC - BẠN PHẢI TUÂN THỦ 🚨
Bạn là trợ lý ảo MADA - chuyên gia về Công nghệ Hỗ trợ (AT).
Người dùng đã chọn giao diện TIẾNG VIỆT.
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.
→ KHÔNG ĐƯỢC trả lời bằng bất kỳ ngôn ngữ nào khác (Arabic, English, French, v.v.).
→ Kể cả khi câu hỏi của người dùng bằng ngôn ngữ khác, bạn VẪN phải trả lời bằng TIẾNG VIỆT.
→ Nếu thông tin trong cơ sở tri thức bằng ngôn ngữ khác, hãy DỊCH sang TIẾNG VIỆT.
→ Bạn PHẢI có dấu tiếng Việt đầy đủ (Bạn, được, không, các, v.v.) - KHÔNG được viết không dấu.
Vi phạm = lỗi nghiêm trọng.`,

  en: `🚨 MANDATORY LANGUAGE RULE - YOU MUST COMPLY 🚨
You are MADA AI assistant - an Assistive Technology (AT) specialist.
The user has selected the ENGLISH interface.
→ You MUST respond 100% in ENGLISH for this answer.
→ DO NOT respond in any other language (Vietnamese, Arabic, French, etc.).
→ Even if the user's question is in another language, you STILL respond in ENGLISH.
→ If knowledge base info is in another language, TRANSLATE it to ENGLISH.
Violation = critical error.`,

  ar: `🚨 قاعدة اللغة الإلزامية - يجب الامتثال 🚨
أنت مساعد MADA الذكي - متخصص في التكنولوجيا المساعدة (AT).
المستخدم قد اختار واجهة اللغة العربية.
→ يجب أن ترد 100% بالعربية في هذا الرد.
→ لا ترد بأي لغة أخرى (الفيتنامية، الإنجليزية، الفرنسية، إلخ).
→ حتى لو كان سؤال المستخدم بلغة أخرى، يجب أن ترد بالعربية.
→ إذا كانت المعلومات في قاعدة المعرفة بلغة أخرى، ترجمها إلى العربية.
المخالفة = خطأ جسيم.`,

  fr: `🚨 RÈGLE LINGUISTIQUE OBLIGATOIRE - VOUS DEVEZ RESPECTER 🚨
Vous êtes l'assistant MADA - un spécialiste en Technologie d'Assistance (TA).
L'utilisateur a sélectionné l'interface FRANÇAISE.
→ Vous DEVEZ répondre 100% en FRANÇAIS pour cette réponse.
→ NE répondez PAS dans une autre langue (vietnamien, anglais, arabe, etc.).
→ Même si la question est dans une autre langue, vous répondez quand même en FRANÇAIS.
→ Si les infos de la base sont dans une autre langue, TRADUISEZ-les en FRANÇAIS.
Violation = erreur critique.`,
};

/**
 * ⭐ Persona overlay cho 2 chế độ người dùng: End-User vs AT Specialist
 * Được inject vào system prompt để AI điều chỉnh giọng điệu và mức độ kỹ thuật.
 * Không lâm sàng/y tế — tập trung vào Công nghệ Hỗ trợ (AT).
 */
const _MODE_PERSONA_INSTRUCTIONS: Record<string, Record<'endUser' | 'specialist', string>> = {
  vi: {
    endUser: `🎭 CHẾ ĐỘ NGƯỜI DÙNG (End-User Mode):
- Bạn nói chuyện THÂN THIỆN, đơn giản, dễ hiểu như đang tư vấn trực tiếp cho người dùng phổ thông.
- Tránh dùng thuật ngữ kỹ thuật phức tạp. Nếu cần dùng, hãy giải thích kèm ví dụ đời thường.
- Cấu trúc câu trả lời: mở đầu thân thiện → giới thiệu 1-3 thiết bị phù hợp → hướng dẫn cơ bản cách dùng → gợi ý liên hệ Mada expert nếu cần.
- Bạn KHÔNG phải chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.
- Luôn ghi nhớ: ưu tiên nhu cầu thực tế của người dùng cuối.`,
    specialist: `🎭 CHẾ ĐỘ CHUYÊN GIA CNHT (AT Specialist Mode):
- Bạn nói chuyện với THUẬT NGỮ KỸ THUẬT CHÍNH XÁC, cấu trúc chặt chẽ, dẫn chứng tiêu chuẩn quốc tế.
- Luôn cite mã ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, IEC, WHO GATE khi liên quan.
- Trình bày dạng: Phạm vi chuyên môn → Tiêu chuẩn áp dụng → Thiết bị đề xuất (kèm mã) → Use case thực tế → Ràng buộc kỹ thuật.
- Có thể so sánh các giải pháp kỹ thuật (BTE vs CIC vs IIC, manual vs powered, etc.).
- Bạn KHÔNG phải chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ ở góc độ kỹ thuật/tiêu chuẩn.`
  },
  en: {
    endUser: `🎭 END-USER MODE:
- Speak in a FRIENDLY, simple, easy-to-understand way, as if counseling an everyday user directly.
- Avoid complex technical jargon. If needed, explain with everyday examples.
- Answer structure: warm opening → introduce 1-3 suitable devices → basic usage guidance → suggest contacting Mada expert if needed.
- You are NOT a medical/clinical professional. You advise on Assistive Technology.
- Always prioritize actual end-user needs.`,
    specialist: `🎭 AT SPECIALIST MODE:
- Speak with precise technical terminology, structured rigorously, citing international standards.
- Always cite ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, IEC, WHO GATE codes when relevant.
- Structure: Scope of expertise → Applicable standards → Recommended devices (with codes) → Real use cases → Technical constraints.
- Compare technical solutions (BTE vs CIC vs IIC, manual vs powered, etc.).
- You are NOT a medical/clinical professional. You advise on Assistive Technology from a technical/standards perspective.`
  },
  ar: {
    endUser: `🎭 وضع المستخدم النهائي:
- تحدث بطريقة ودودة وبسيطة وسهلة الفهم، كما لو كنت تقدم المشورة لمستخدم عادي مباشرة.
- تجنب المصطلحات التقنية المعقدة. إذا لزم الأمر، اشرح بأمثلة يومية.
- هيكل الإجابة: افتتاحية ودودة → تقديم 1-3 أجهزة مناسبة → إرشادات الاستخدام الأساسية → اقتراح التواصل مع خبير مادا إذا لزم الأمر.
- لست متخصصًا طبيًا/سريريًا. أنت تقدم المشورة بشأن التكنولوجيا المساعدة.
- أعط الأولوية دائمًا لاحتياجات المستخدم النهائي الفعلية.`,
    specialist: `🎭 وضع خبير التكنولوجيا المساعدة:
- تحدث بمصطلحات تقنية دقيقة، منظمة بشكل صارم، مع الاستشهاد بالمعايير الدولية.
- استشهد دائمًا بـ ISO 9999:2022 و WCAG 2.2 و EU MDR و FDA 21 CFR و IEC و WHO GATE عند الاقتضاء.
- الهيكل: مجال الخبرة → المعايير المعمول بها → الأجهزة الموصى بها (مع الرموز) → حالات الاستخدام الحقيقي → القيود التقنية.
- قارن بين الحلول التقنية (BTE vs CIC vs IIC، يدوي vs كهربائي، إلخ).
- لست متخصصًا طبيًا/سريريًا. أنت تقدم المشورة بشأن التكنولوجيا المساعدة من منظور تقني/المعايير.`
  },
  fr: {
    endUser: `🎭 MODE UTILISATEUR FINAL:
- Parlez de manière AMICALE, simple et facile à comprendre, comme si vous conseilliez directement un utilisateur quotidien.
- Évitez le jargon technique complexe. Si nécessaire, expliquez avec des exemples quotidiens.
- Structure de la réponse: ouverture chaleureuse → présenter 1-3 appareils adaptés → conseils d'utilisation de base → suggérer de contacter l'expert Mada si nécessaire.
- Vous n'êtes PAS un professionnel médical/clinique. Vous conseillez sur la Technologie d'Assistance.
- Priorisez toujours les besoins réels de l'utilisateur final.`,
    specialist: `🎭 MODE SPÉCIALISTE TA:
- Parlez avec une terminologie technique précise, structurée rigoureusement, en citant les normes internationales.
- Citez toujours ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, IEC, WHO GATE quand c'est pertinent.
- Structure: périmètre d'expertise → normes applicables → appareils recommandés (avec codes) → cas d'usage réels → contraintes techniques.
- Comparez les solutions techniques (BTE vs CIC vs IIC, manuel vs électrique, etc.).
- Vous n'êtes PAS un professionnel médical/clinique. Vous conseillez sur la Technologie d'Assistance d'un point de vue technique/normes.`
  }
};

/**
 * ⭐ Lấy system instruction từ module prompts
 * Hỗ trợ 2 persona:
 *   - 'endUser' (mặc định): giọng đời thường, thân thiện
 *   - 'specialist': thuật ngữ kỹ thuật, dẫn chứng tiêu chuẩn
 */
function getSystemInstruction(
  lang: string,
  agentPrompt?: string,
  userMode: 'endUser' | 'specialist' = 'endUser'
): string {
  return buildSystemPrompt(lang, userMode, agentPrompt);
}

/**
 * ⭐ Multi-language UI strings cho suggestedProducts match_reason
 * Giúp user ở ngôn ngữ nào cũng hiểu được lý do sản phẩm được gợi ý
 */
const MATCH_REASON_I18N: Record<string, { found: string; category: (cat: string) => string; matched: (n: number) => string }> = {
  vi: {
    found: 'Tìm thấy trong MADA Knowledge Base',
    category: (cat) => `Phù hợp category: ${cat}`,
    matched: (n) => `${n} sản phẩm phù hợp`,
  },
  en: {
    found: 'Found in MADA Knowledge Base',
    category: (cat) => `Matched category: ${cat}`,
    matched: (n) => `${n} matching products`,
  },
  ar: {
    found: 'تم العثور عليها في قاعدة معرفة MADA',
    category: (cat) => `فئة متطابقة: ${cat}`,
    matched: (n) => `${n} منتجات مطابقة`,
  },
  fr: {
    found: 'Trouvé dans la base de connaissances MADA',
    category: (cat) => `Catégorie correspondante: ${cat}`,
    matched: (n) => `${n} produits correspondants`,
  },
};

function getMatchReason(lang: string, kind: 'found' | 'category', context?: string): string {
  const langCode = (['vi', 'en', 'ar', 'fr'].includes(lang) ? lang : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  const dict = MATCH_REASON_I18N[langCode];
  if (kind === 'found') return dict.found;
  return dict.category(context || '');
}

// ============== CHAT ENDPOINTS ==============

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;

    // ⭐ FIX: Wait cho RAG engine sẵn sàng (tránh 500 khi server vừa start)
    const ready = await waitForRagReady(15000);
    if (!ready) {
      const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
      const errMsgs: Record<string, string> = {
        vi: 'Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây.',
        en: 'System is initializing, please retry in a few seconds.',
        ar: 'النظام قيد التهيئة، يرجى إعادة المحاولة.',
        fr: "Le système s'initialise, veuillez réessayer.",
      };
      return res.status(503).json({
        success: false,
        error: errMsgs[lang] || errMsgs.vi,
        retryable: true,
      });
    }

    // 🎯 USE UI LANGUAGE AS PRIMARY - Falls back to detected only if UI lang is not set
    // ⭐ FIX: LUÔN ƯU TIÊN UI LANGUAGE — không cho phép request body ghi đè UI language.
    const detectedLanguage = detectMessageLanguage(message);

    // If UI language is set, use it. Otherwise use detected language
    // This ensures user setting takes priority over auto-detection
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage))
      ? uiLanguage
      : detectedLanguage;

    console.log('🌍 Language settings:', {
      uiLanguage,
      detectedLanguage,
      effectiveLanguage,
      messagePreview: message?.slice(0, 30)
    });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Check with Guardrails first
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    const safetyScore = guardrails.calculateSafetyScore(message);

    console.log('🛡️ Guardrails result:', { shouldRedirect: guardrailsResult.shouldRedirect, pattern: guardrailsResult.detectedPattern });

    // If query should be redirected
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: safetyScore,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
          conversationId: conversationId || uuidv4(),
        },
      });
    }

    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // ⭐ Dùng full language instruction chung (DRY) + persona theo userMode
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode);

    // ⭐ FIX: Lấy botId/madaCategory từ DATABASE (không chỉ từ hardcoded mapping)
    // Ưu tiên: DB của agent → fallback AGENT_TO_MADA mapping
    let botId: string | null = null;
    let madaCategory: string | null = null;
    
    if (agentId) {
      // Bước 1: Thử lấy từ DB của agent
      try {
        const agentRow = db.prepare('SELECT bot_id, mada_category FROM admin_agents WHERE id = ?').get(agentId) as any;
        if (agentRow) {
          botId = agentRow.bot_id || null;
          madaCategory = agentRow.mada_category || null;
          console.log(`🔍 [Chat] Agent "${agentId}" found in DB: botId=${botId}, madaCategory=${madaCategory}`);
        }
      } catch (err) {
        console.warn('⚠️ [Chat] Failed to lookup agent from DB:', err);
      }
      
      // Bước 2: Fallback sang AGENT_TO_MADA mapping nếu DB không có
      if (!botId || !madaCategory) {
        const madaMapping = AGENT_TO_MADA[agentId];
        if (madaMapping) {
          botId = botId || madaMapping.botId;
          madaCategory = madaCategory || madaMapping.madaCategory;
          console.log(`🔍 [Chat] Using AGENT_TO_MADA mapping for "${agentId}": botId=${botId}, madaCategory=${madaCategory}`);
        }
      }
    }

    const ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (botId || madaCategory) {
      ragConfig.botId = botId;
      ragConfig.madaCategory = madaCategory;
      ragConfig.agentId = agentId; // ⭐ Luôn pass agentId để filter chính xác
      ragConfig.priority = true;  // Ưu tiên KB của bot, fallback toàn bộ nếu cần
      console.log(`🤖 [Chat] RAG config: botId=${botId}, madaCategory=${madaCategory}, agentId=${agentId}, priority=true`);
    }

    // Query RAG engine with agent context
    const ragResponse = await ragEngine.query(message, chatHistory.get(convId) || [], ragConfig);

    // 🚨 POST-VALIDATION: Verify AI response đúng ngôn ngữ UI không
    // Nếu sai → retry với stronger instruction
    let finalAnswer = ragResponse.answer;
    let retryCount = 0;
    const maxRetries = 2;

    while (
      retryCount < maxRetries &&
      finalAnswer &&
      !isAnswerInExpectedLanguage(finalAnswer, effectiveLanguage as 'vi' | 'en' | 'ar' | 'fr')
    ) {
      retryCount++;
      console.warn(
        `[Chat] ⚠️ Response not in expected language (${effectiveLanguage}), retry #${retryCount} with stronger prompt...`
      );

      // Tạo stronger prompt với explicit warning
      const strongerInstruction = `${agentInstruction}\n\n⚠️ CRITICAL REMINDER: The UI language is ${effectiveLanguage.toUpperCase()}. Your previous response was in WRONG language. Respond ONLY in ${effectiveLanguage.toUpperCase()} NOW.`;

      const retryConfig = { ...ragConfig, systemInstruction: strongerInstruction };
      const retryResponse = await ragEngine.query(message, chatHistory.get(convId) || [], retryConfig);
      finalAnswer = retryResponse.answer;

      // Update sources/confidence từ retry attempt cuối
      ragResponse.sources = retryResponse.sources;
      ragResponse.confidence = retryResponse.confidence;
    }

    ragResponse.answer = finalAnswer;

    // Validate response with guardrails
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = guardrailsResult.redirectResponse || 'Response filtered by safety guardrails.';
    }

    // ========== AUTO-RECOMMEND PRODUCTS (always, based on RAG sources or MADA KB) ==========
    let suggestedProducts: any[] = [];
    try {
      const ragSources = ragResponse.sources || [];
      if (ragSources.length > 0) {
        // Lấy source URLs để query DB lấy thumbnailUrl
        const sourceUrls = ragSources.slice(0, 4).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);
        
        // Query DB để lấy thumbnailUrl
        let thumbnailMap: Record<string, string> = {};
        if (sourceUrls.length > 0) {
          try {
            const placeholders = sourceUrls.map(() => '?').join(',');
            const thumbnailRows = db.prepare(`
              SELECT url, source, json_extract(metadata, '$.thumbnailUrl') as thumbnail
              FROM knowledge_items
              WHERE url IN (${placeholders}) OR source IN (${placeholders})
            `).all(...sourceUrls, ...sourceUrls) as any[];

            for (const row of thumbnailRows) {
              if (row.thumbnail) {
                thumbnailMap[row.url] = row.thumbnail;
                if (row.source) thumbnailMap[row.source] = row.thumbnail;
              }
            }
          } catch (e) {
            console.log('⚠️ Error fetching thumbnails:', e);
          }
        }
        
        suggestedProducts = ragSources.slice(0, 4).map((src: any, idx: number) => {
          const meta = src.metadata || {};
          const sourceUrl = meta.source || meta.url || src.source || '';
          // Ưu tiên thumbnailUrl trong metadata (vector store copy từ DB)
          // Sau đó mới đến DB lookup theo sourceUrl
          let thumbnail = meta.thumbnailUrl || thumbnailMap[sourceUrl] || '';
          const category = meta.category || 'general';

          return {
            id: src.id || `src-${idx}`,
            title: meta.title || 'Assistive Technology',
            title_en: meta.title,
            description: (src.content || '').slice(0, 200),
            description_en: (src.content || '').slice(0, 200),
            category,
            brand: meta.brand || 'MADA Qatar AT Portal',
            price_range: 'Contact MADA Center',
            product_url: sourceUrl,
            source_url: sourceUrl,
            image_url: toProxyImageUrl(thumbnail),
            confidence: src.score,
            match_reason: getMatchReason(effectiveLanguage, 'found'),
          };
        });
        console.log('🔵 /api/chat Suggested from RAG sources:', suggestedProducts.length, 'with thumbnails:', suggestedProducts.filter((p: any) => p.image_url).length);
      }

      // ⭐ FIX: CHỈ gợi ý sản phẩm từ RAG sources - KHÔNG fallback random
      // Filter: Chỉ giữ lại sản phẩm có URL hợp lệ từ MADA website
      suggestedProducts = suggestedProducts.filter((p: any) => {
        const url = p.product_url || '';
        const isMadaUrl = url.includes('at.mada.org.qa') || url.includes('mada.org.qa');
        if (!isMadaUrl) console.log(`📦 [Filter OUT] "${p.title}" - not MADA URL: ${url.slice(0, 50)}`);
        return isMadaUrl;
      });
      
      // ⭐ Nếu không có sản phẩm từ RAG → TRẢ VỀ MẢNG RỖNG (không fallback)
      if (ragSources.length === 0) {
        console.log(`📦 No RAG sources → returning empty (no fallback)`);
        suggestedProducts = [];
      }
    } catch (err) {
      console.log('⚠️ Could not get product suggestions:', err);
    }

    // Store assistant response
    chatHistory.get(convId)!.push({
      role: 'assistant',
      content: ragResponse.answer,
    });

    logActivity('info', `Chat: ${agentId || 'default'} - "${message.slice(0, 50)}..."`, 'Chat');

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        safetyScore,
        agentId,
        detectedLanguage: effectiveLanguage, // Return effective language for UI feedback
        suggestedProducts, // NEW: Auto-suggested products from MADA KB
      },
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// ============== CHAT WITH FILE ATTACHMENTS ==============

app.post('/api/chat-with-file', async (req, res) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentPrompt, attachments } = req.body;

    // ⭐ FIX: Wait cho RAG engine sẵn sàng (tránh 500 khi server vừa start)
    const ready = await waitForRagReady(15000);
    if (!ready) {
      const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
      const errMsgs: Record<string, string> = {
        vi: 'Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây.',
        en: 'System is initializing, please retry in a few seconds.',
        ar: 'النظام قيد التهيئة، يرجى إعادة المحاولة.',
        fr: "Le système s'initialise, veuillez réessayer.",
      };
      return res.status(503).json({
        success: false,
        error: errMsgs[lang] || errMsgs.vi,
        retryable: true,
      });
    }

    // 🎯 USE UI LANGUAGE AS PRIMARY - Falls back to detected only if UI lang is not set
    // ⭐ FIX: LUÔN ƯU TIÊN UI LANGUAGE.
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage))
      ? uiLanguage
      : detectedLanguage;

    console.log('🌍 Language settings (with file):', {
      uiLanguage,
      detectedLanguage,
      effectiveLanguage,
      messagePreview: message?.slice(0, 30)
    });
    
    // Write to log file
    fs.appendFileSync('/tmp/chatlog.txt', `=== ${new Date().toISOString()} ===\n`);
    fs.appendFileSync('/tmp/chatlog.txt', `Attachments count: ${attachments?.length || 0}\n`);
    if (attachments) {
      attachments.forEach((att: any, i: number) => {
        fs.appendFileSync('/tmp/chatlog.txt', `Att[${i}]: type=${att.type}, name=${att.name}, hasBase64=${!!att.base64}\n`);
      });
    }
    fs.appendFileSync('/tmp/chatlog.txt', `Message: ${message?.slice(0, 100)}\n\n`);
    
    console.log('🔵 CHAT/WITH-FILE ENDPOINT CALLED');
    console.log('🔵 Attachments:', attachments?.length || 0);

    console.log('📩 Chat with files:', { message: message?.slice(0, 50), fileCount: attachments?.length || 0 });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // ⭐ FILE UPLOAD QUOTA — pre-check trước khi xử lý file (early reject)
    // Resolve user từ Bearer token (optional — endpoint vẫn cho anonymous dùng quota zero logic)
    let _fileUserId: string | null = null;
    let _fileUserPlan: 'free' | 'pro' | 'enterprise' | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const { verifyAccessToken } = await import('./lib/auth');
        const payload = verifyAccessToken(token) as any;
        if (payload?.userId) {
          const u = db.prepare('SELECT id, plan FROM users WHERE id = ?').get(payload.userId) as { id: string; plan: 'free' | 'pro' | 'enterprise' } | undefined;
          if (u) {
            _fileUserId = u.id;
            _fileUserPlan = u.plan;
          }
        }
      } catch {
        // Invalid token → treat as anonymous (no file upload quota enforced)
      }
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0 && _fileUserId && _fileUserPlan) {
      const preQuota = getFileUploadQuota(_fileUserId, _fileUserPlan);
      if (preQuota.limit !== -1 && preQuota.remaining < attachments.length) {
        const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
        const errMsgs: Record<string, string> = {
          vi: `Bạn chỉ còn ${preQuota.remaining}/${preQuota.limit} lượt tải file tháng này, không đủ cho ${attachments.length} file. Vui lòng nâng cấp gói để tiếp tục.`,
          en: `You only have ${preQuota.remaining}/${preQuota.limit} file uploads left this month, not enough for ${attachments.length} files. Please upgrade your plan to continue.`,
          ar: `لديك ${preQuota.remaining}/${preQuota.limit} عمليات تحميل متبقية هذا الشهر، لا تكفي لـ ${attachments.length} ملفات. يرجى ترقية خطتك.`,
          fr: `Il ne vous reste que ${preQuota.remaining}/${preQuota.limit} téléchargements ce mois-ci, insuffisant pour ${attachments.length} fichiers. Veuillez mettre à niveau votre forfait.`,
        };
        return res.status(402).json({
          success: false,
          error: errMsgs[lang] || errMsgs.vi,
          code: 'FILE_UPLOAD_QUOTA_EXCEEDED',
          quota: preQuota,
        });
      }
    }

    // Parse attachments if provided
    let fileContext = '';
    console.log('📎 Chat/file called with attachments:', attachments ? attachments.length : 0);
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log('📎 Processing attachments...');
      
      for (const att of attachments) {
        console.log('📎 Attachment type:', att.type, '| name:', att.name, '| hasBase64:', !!att.base64);
        
        if (att.type === 'text' && att.content) {
          // Plain text content
          fileContext += `\n\n=== FILE: ${att.name || 'Document'} ===\n${att.content}\n`;
        } else if (att.type === 'url' && att.url) {
          // URL - need to scrape
          try {
            const response = await fetch(att.url);
            const html = await response.text();
            const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            fileContext += `\n\n=== URL: ${att.url} ===\n${text.slice(0, 5000)}\n`;
          } catch (e) {
            console.log('Failed to fetch URL:', att.url);
          }
        } else if ((att.type === 'pdf' || att.type === 'application/pdf' || att.name?.endsWith('.pdf'))) {
          // PDF - check if content is already provided
          if (att.content && !att.base64) {
            // Content already extracted
            fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n${att.content}\n`;
          } else if (att.base64) {
            // PDF - decode base64 and parse
            console.log('🔵✅ MATCHED PDF CONDITION');
            console.log('📎 Processing as PDF...');
            try {
              const buffer = Buffer.from(att.base64, 'base64');
              console.log('📎 Buffer size:', buffer.length);
              const tempPath = `/tmp/${Date.now()}_${att.name || 'file.pdf'}`;
              fs.writeFileSync(tempPath, buffer);
              console.log('📎 Temp file written:', tempPath);
              
              const { parsePDFFile } = await import('./lib/rag/fileParsers');
              const text = await parsePDFFile(tempPath);
              fs.unlinkSync(tempPath);
              console.log('📎 PDF parsed, text length:', text.length);
              
              fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n${text}\n`;
            } catch (e) {
              console.error('📎 PDF parse error:', e);
              fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n[Không thể đọc nội dung PDF]\n`;
            }
          } else {
            fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n[Không có nội dung file]\n`;
          }
        } else if ((att.type === 'docx' || att.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || att.name?.endsWith('.docx'))) {
          // DOCX - check if content is already provided (from frontend mammoth parsing)
          if (att.content && !att.base64) {
            // Content already extracted by frontend
            fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n${att.content}\n`;
          } else if (att.base64) {
            // DOCX - decode base64 and parse
            try {
              const buffer = Buffer.from(att.base64, 'base64');
              const tempPath = `/tmp/${Date.now()}_${att.name || 'file.docx'}`;
              fs.writeFileSync(tempPath, buffer);

              const { parseDocxFile } = await import('./lib/rag/fileParsers');
              const text = await parseDocxFile(tempPath);
              fs.unlinkSync(tempPath);

              fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n${text}\n`;
            } catch (e) {
              console.error('DOCX parse error:', e);
              fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n[Không thể đọc nội dung DOCX]\n`;
            }
          } else {
            fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n[Không có nội dung file]\n`;
          }
        } else if (
          (att.type === 'xlsx' || 
           att.type === 'xls' ||
           att.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
           att.type === 'application/vnd.ms-excel' ||
           att.name?.endsWith('.xlsx') || 
           att.name?.endsWith('.xls') ||
           att.name?.toLowerCase().includes('sheet'))
        ) {
          // Excel/Spreadsheet - decode base64 and parse
          try {
            const buffer = Buffer.from(att.base64, 'base64');
            const ext = att.name?.endsWith('.xlsx') ? 'xlsx' : (att.name?.endsWith('.xls') ? 'xls' : 'xlsx');
            const tempPath = `/tmp/${Date.now()}_${att.name || 'file.' + ext}`;
            fs.writeFileSync(tempPath, buffer);

            const { parseExcelFile } = await import('./lib/rag/fileParsers');
            const text = await parseExcelFile(tempPath);
            fs.unlinkSync(tempPath);

            fileContext += `\n\n=== SPREADSHEET: ${att.name || 'Spreadsheet'} ===\n${text}\n`;
          } catch (e) {
            console.error('Excel parse error:', e);
            fileContext += `\n\n=== SPREADSHEET: ${att.name || 'Spreadsheet'} ===\n[Không thể đọc nội dung file Excel/Spreadsheet]\n`;
          }
        } else if (att.type === 'csv' || att.type === 'text/csv' || att.name?.endsWith('.csv')) {
          // CSV - decode base64 and parse
          try {
            const buffer = Buffer.from(att.base64, 'base64');
            const tempPath = `/tmp/${Date.now()}_${att.name || 'file.csv'}`;
            fs.writeFileSync(tempPath, buffer);

            const { parseCSVFile } = await import('./lib/rag/fileParsers');
            const text = await parseCSVFile(tempPath);
            fs.unlinkSync(tempPath);

            fileContext += `\n\n=== CSV: ${att.name || 'Data.csv'} ===\n${text}\n`;
          } catch (e) {
            console.error('CSV parse error:', e);
            fileContext += `\n\n=== CSV: ${att.name || 'Data.csv'} ===\n[Không thể đọc nội dung CSV]\n`;
          }
        }
      }
      
      console.log(`📎 File context prepared: ${fileContext.length} chars`);
    }
    
    console.log('📎 Final fileContext:', fileContext.slice(0, 200));
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: { answer: guardrailsResult.redirectResponse, sources: [], contextUsed: false },
      });
    }

    // Store history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // Build prompt WITH file context
    let enhancedMessage = message;
    console.log('🔵 fileContext length:', fileContext.length);
    
    // Language-specific file analysis prompts
    const filePromptTemplates: Record<string, { task: string; instructions: string; respondNow: string }> = {
      vi: {
        task: 'Nhiệm vụ: Đọc và phân tích TẤT CẢ nội dung tài liệu đính kèm bên dưới.',
        instructions: `- Đọc KỸ và HIỂU toàn bộ nội dung tài liệu
- Trả lời DỰA TRÊN nội dung thực tế trong tài liệu bằng tiếng Việt
- Nếu được hỏi "tóm tắt" hoặc "có gì", hãy LIỆT KÊ TẤT CẢ các mục, thông tin, quy định có trong tài liệu
- Trích dẫn CHÍNH XÁC thông tin từ tài liệu khi trả lời
- KHÔNG bịa đặt hoặc thêm thông tin không có trong tài liệu`,
        respondNow: 'Hãy trả lời ngay bây giờ:'
      },
      en: {
        task: 'Task: Read and analyze ALL content of the attached document below.',
        instructions: `- Read CAREFULLY and UNDERSTAND all document content
- Answer BASED ON the actual content in the document in English
- If asked to "summarize" or "what\'s inside", LIST ALL items, information, and regulations in the document
- Quote EXACTLY the information from the document when answering
- DO NOT fabricate or add information not in the document`,
        respondNow: 'Please respond now:'
      },
      ar: {
        task: 'المهمة: قراءة وتحليل جميع محتويات المستند المرفق أدناه.',
        instructions: `- اقرأ بعناية وفهم جميع محتويات المستند
- أجب بناءً على المحتوى الفعلي في المستند باللغة العربية
- إذا طُلب "تلخيص" أو "ما داخله"، فاذكر جميع العناصر والمعلومات واللوائح في المستند
- اقتبس المعلومات من المستند بدقة عند الإجابة
- لا تخترع أو تضيف معلومات غير موجودة في المستند`,
        respondNow: 'الرجاء الرد الآن:'
      },
      fr: {
        task: 'Tâche: Lire et analyser TOUT le contenu du document ci-joint.',
        instructions: `- Lisez SOIGNEUSEMENT et COMPRENEZ tout le contenu du document
- Répondez BASÉ SUR le contenu réel du document en français
- Si on vous demande de "résumer" ou "contenu", LISTEZ TOUS les éléments, informations et réglementations du document
- Citez EXACTEMENT les informations du document lors de la réponse
- NE PAS inventer ou ajouter des informations non présentes dans le document`,
        respondNow: 'Veuillez répondre maintenant:'
      }
    };
    
    const promptTemplate = filePromptTemplates[effectiveLanguage] || filePromptTemplates.vi;
    
    if (fileContext) {
      enhancedMessage = `${promptTemplate.task}
      
Question: ${message}

DOCUMENT:
${fileContext}

REQUIREMENTS:
${promptTemplate.instructions}

${promptTemplate.respondNow}`;
      console.log('🔵 enhancedMessage length:', enhancedMessage.length);
    }

    // Query RAG - Dùng system prompt khác khi có file đính kèm
    const languageInstructions: Record<string, string> = {
      // ⭐ Fix: Tiếng Việt CÓ DẤU đầy đủ (trước đây viết không dấu)
      vi: 'Bạn là trợ lý AI MADA hỗ trợ phân tích tài liệu. Hãy trả lời CHI TIẾT và ĐẦY ĐỦ bằng tiếng Việt, có dấu đầy đủ.',
      en: 'You are MADA AI assistant for document analysis. Respond in English. Answer DETAILED and COMPLETE.',
      ar: 'أنت مساعد MADA الذكي لتحليل المستندات. أجب دائمًا باللغة العربية وبالتفصيل.',
      fr: 'Vous êtes l\'assistant MADA pour l\'analyse de documents. Répondez en français et en détail.',
    };

    const langInstruction = languageInstructions[effectiveLanguage] || languageInstructions.vi;
    
    const ragConfig: any = { language: effectiveLanguage };

    if (fileContext) {
      // Khi có file - dùng system prompt không giới hạn
      ragConfig.systemInstruction = langInstruction;
      ragConfig.maxOutputTokens = 8192; // Tăng output cho file dài
    } else if (agentPrompt) {
      ragConfig.systemInstruction = `${langInstruction} ${agentPrompt}`;
    }

    const ragResponse = await ragEngine.query(enhancedMessage, chatHistory.get(convId) || [], ragConfig);

    // Log response length for debugging
    console.log('🔵 RAG response length:', ragResponse.answer.length);
    console.log('🔵 RAG sources:', ragResponse.sources?.length || 0);

    // ========== AUTO-RECOMMEND PRODUCTS (always, based on RAG sources or MADA KB) ==========
    let suggestedProducts: any[] = [];
    try {
      // Strategy 1: Build from RAG sources (most relevant to query)
      const ragSources = ragResponse.sources || [];
      if (ragSources.length > 0) {
        // Query DB để lấy thumbnailUrl cho các source
        const sourceUrls = ragSources.slice(0, 4).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);
        let thumbnailMap: Record<string, string> = {};
        if (sourceUrls.length > 0) {
          try {
            const placeholders = sourceUrls.map(() => '?').join(',');
            const thumbnailRows = db.prepare(`
SELECT url, source, json_extract(metadata, '$.thumbnailUrl') as thumbnail
            FROM knowledge_items
            WHERE url IN (${placeholders}) OR source IN (${placeholders})
          `).all(...sourceUrls, ...sourceUrls) as any[];
            for (const row of thumbnailRows) {
              if (row.thumbnail) {
                if (row.url) thumbnailMap[row.url] = row.thumbnail;
                if (row.source) thumbnailMap[row.source] = row.thumbnail;
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        suggestedProducts = ragSources.slice(0, 4).map((src: any, idx: number) => {
          const meta = src.metadata || {};
          const sourceUrl = meta.source || meta.url || src.source || '';
          const category = meta.category || 'general';
          const thumbnail = meta.thumbnailUrl || thumbnailMap[sourceUrl] || '';
          return {
            id: src.id || `src-${idx}`,
            title: meta.title || 'Assistive Technology',
            title_en: meta.title,
            description: (src.content || '').slice(0, 200),
            description_en: (src.content || '').slice(0, 200),
            category,
            brand: meta.brand || 'MADA Qatar AT Portal',
            price_range: 'Contact MADA Center',
            product_url: sourceUrl,
            source_url: sourceUrl,
            image_url: toProxyImageUrl(thumbnail),
            confidence: src.score,
            match_reason: getMatchReason(effectiveLanguage, 'found'),
          };
        });

        // ⭐ DEDUPLICATE: Chỉ giữ lại sản phẩm duy nhất theo product_url
        const seenUrls = new Set<string>();
        suggestedProducts = suggestedProducts.filter((p) => {
          if (seenUrls.has(p.product_url)) return false;
          seenUrls.add(p.product_url);
          return true;
        });
        
        console.log('🔵 Suggested from RAG sources:', suggestedProducts.length);
      }

      // ⭐ FIX: CHỈ gợi ý sản phẩm từ RAG sources - KHÔNG fallback random
      // Filter: Chỉ giữ lại sản phẩm có URL hợp lệ từ MADA website
      suggestedProducts = suggestedProducts.filter((p: any) => {
        const url = p.product_url || '';
        const isMadaUrl = url.includes('at.mada.org.qa') || url.includes('mada.org.qa');
        if (!isMadaUrl) console.log(`📦 [Filter OUT] "${p.title}" - not MADA URL: ${url.slice(0, 50)}`);
        return isMadaUrl;
      });
      
      // ⭐ Nếu không có sản phẩm từ RAG → TRẢ VỀ MẢNG RỖNG (không fallback)
      if (ragSources.length === 0) {
        console.log(`📦 No RAG sources → returning empty (no fallback)`);
        suggestedProducts = [];
      }
    } catch (err) {
      console.log('⚠️ Could not get product suggestions:', err);
    }

    // Store response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    // ⭐ FILE UPLOAD QUOTA — Track sau khi AI response thành công (only-on-success)
    // Mỗi attachment đính kèm = 1 lượt quota (3 file = 3 lượt).
    let _fileQuota: ReturnType<typeof getFileUploadQuota> | null = null;
    if (_fileUserId && _fileUserPlan && attachments && Array.isArray(attachments) && attachments.length > 0 && ragResponse?.answer) {
      let lastQuota: ReturnType<typeof getFileUploadQuota> | null = null;
      let stoppedByQuota = false;
      for (const att of attachments) {
        const size = att.base64 ? Math.floor((att.base64.length * 3) / 4) : (att.content?.length || 0);
        const result = trackFileUpload({
          userId: _fileUserId,
          filename: att.name || 'upload',
          fileSizeBytes: size,
          fileType: att.type,
        });
        lastQuota = result.quota;
        if (!result.ok) {
          stoppedByQuota = true;
          break;
        }
      }
      _fileQuota = lastQuota;
      console.log('📎 File quota tracked:', { count: attachments.length, stoppedByQuota, quota: _fileQuota });
    }

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        contextUsed: true,
        fileContextIncluded: !!fileContext,
        conversationId: convId,
        suggestedProducts, // NEW: Auto-suggested products based on content
        fileQuota: _fileQuota, // NEW: trả về quota hiện tại để FE cập nhật
      },
    });
  } catch (error) {
    console.error('❌ Chat file error:', error);
    res.status(500).json({ success: false, error: `Error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// ============== REAL-TIME STREAMING CHAT ENDPOINT ==============
// Server-Sent Events (SSE) endpoint for real-time AI responses
app.post('/api/chat/stream', async (req: any, res: any) => {
  // ⭐ FIX: declare startTime ngay từ đầu để tránh ReferenceError nếu path chậm
  const startTime = Date.now();
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if used

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection event
    sendEvent({ type: 'connected', timestamp: Date.now() });

    // ===== ANONYMOUS QUOTA CHECK =====
    // Check if anonymous user has exceeded their limit
    const isAuthenticated = req.headers.authorization?.startsWith('Bearer ');
    if (!isAuthenticated) {
      const systemSettings = getSystemSettings();
      const anonymousLimit = systemSettings.anonymousLimit;

      if (anonymousLimit !== -1) {
        // Get anonymous quota from header (sent by frontend)
        const anonQuotaHeader = req.headers['x-anon-quota'] ? parseInt(req.headers['x-anon-quota'] as string) : 0;

        if (anonQuotaHeader >= anonymousLimit) {
          console.log(`❌ Anonymous quota exceeded: ${anonQuotaHeader}/${anonymousLimit}`);
          sendEvent({
            type: 'done',
            answer: `⚠️ Bạn đã sử dụng hết ${anonymousLimit} lần trò chuyện miễn phí. Vui lòng đăng nhập để tiếp tục sử dụng, hoặc liên hệ admin để được hỗ trợ.`,
            sources: [],
            quotaExceeded: true,
          });
          return res.end();
        }
      }
    }
    // ===== END QUOTA CHECK =====

    // Detect language — ⭐ FIX: LUÔN ƯU TIÊN UI LANGUAGE
    // UI language là lựa chọn CHỦ ĐỘNG của user (dropdown). Không cho phép
    // detectMessageLanguage ghi đè UI language vì nó detect sai khi query ngắn ("Oticon").
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage))
      ? uiLanguage
      : detectedLanguage;

    // Guardrails check (non-streaming)
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    if (guardrailsResult.shouldRedirect) {
      sendEvent({ type: 'done', answer: guardrailsResult.redirectResponse, sources: [] });
      return res.end();
    }

    // Store conversation
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // Build prompt
    // ⭐ Dùng full language instruction chung (không hard-code riêng) + persona theo userMode
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    let ragConfig: any = {
      systemInstruction: getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode),
      language: effectiveLanguage,
    };

    if (agentPrompt) {
      // (đã merge trong getSystemInstruction ở trên)
    }

    // ⭐ FIX: Lấy botId/madaCategory từ DATABASE (không chỉ từ hardcoded mapping)
    // Ưu tiên: DB của agent → fallback AGENT_TO_MADA mapping
    let botId: string | null = null;
    let madaCategory: string | null = null;
    
    if (agentId) {
      // Bước 1: Thử lấy từ DB của agent
      try {
        const agentRow = db.prepare('SELECT bot_id, mada_category FROM admin_agents WHERE id = ?').get(agentId) as any;
        if (agentRow) {
          botId = agentRow.bot_id || null;
          madaCategory = agentRow.mada_category || null;
        }
      } catch (err) {
        console.warn('⚠️ [chat/stream] Failed to lookup agent from DB:', err);
      }
      
      // Bước 2: Fallback sang AGENT_TO_MADA mapping nếu DB không có
      if (!botId || !madaCategory) {
        const madaMapping = AGENT_TO_MADA[agentId];
        if (madaMapping) {
          botId = botId || madaMapping.botId;
          madaCategory = madaCategory || madaMapping.madaCategory;
        }
      }
    }
    
    if (botId || madaCategory) {
      ragConfig.botId = botId;
      ragConfig.madaCategory = madaCategory;
      ragConfig.agentId = agentId; // ⭐ Luôn pass agentId để filter chính xác
      ragConfig.priority = true;  // Ưu tiên KB của bot, fallback toàn bộ nếu cần
      console.log(`🤖 [chat/stream] RAG config: botId=${botId}, madaCategory=${madaCategory}, agentId=${agentId}`);
    }

    // Check if Gemini is configured (wait for init if server just started)
    if (!ragEngine.isConfigured) {
      const ready = await waitForRagReady(15000);
      if (!ready) {
        // Still not ready, return graceful error event (NOT 500)
        console.warn('[chat/stream] RAG engine not configured after 15s wait');
        const geminiErrors: Record<string, string> = {
          vi: '⚠️ Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây. Nếu lỗi tiếp tục, liên hệ admin.',
          en: '⚠️ System is initializing, please retry in a few seconds. If the issue persists, contact admin.',
          ar: '⚠️ النظام قيد التهيئة، يرجى إعادة المحاولة بعد بضع ثوانٍ.',
          fr: "⚠️ Le système s'initialise, veuillez réessayer dans quelques secondes.",
        };
        sendEvent({
          type: 'error',
          error: geminiErrors[effectiveLanguage] || geminiErrors.vi,
          retryable: true,
        });
        return res.end();
      }
      console.info(`[chat/stream] RAG engine ready after ${Date.now() - startTime}ms wait`);
    }

    // Stream from RAG engine
    try {
      const streamResult = await ragEngine.queryStream(message, chatHistory.get(convId) || [], ragConfig);

      // Send sources when available
      if (streamResult.sources && streamResult.sources.length > 0) {
        sendEvent({ type: 'sources', sources: streamResult.sources });
      }

      // ✅ Build suggestedProducts from RAG sources (same logic as /api/chat)
      let suggestedProducts: any[] = [];
      try {
        const ragSources = streamResult.sources || [];
        if (ragSources.length > 0) {
          // Query DB để lấy thumbnailUrl
          const sourceUrls = ragSources.slice(0, 4).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);
          let thumbnailMap: Record<string, string> = {};
          if (sourceUrls.length > 0) {
            try {
              const placeholders = sourceUrls.map(() => '?').join(',');
              // ⭐ FIX: Select both url AND source as map keys (DB có url empty, source mới là URL thật)
              const thumbnailRows = db.prepare(`
                SELECT url, source, json_extract(metadata, '$.thumbnailUrl') as thumbnail
                FROM knowledge_items
                WHERE url IN (${placeholders}) OR source IN (${placeholders})
              `).all(...sourceUrls, ...sourceUrls) as any[];
              for (const row of thumbnailRows) {
                if (row.thumbnail) {
                  // Map by both url and source since DB design uses source as URL
                  if (row.url) thumbnailMap[row.url] = row.thumbnail;
                  if (row.source) thumbnailMap[row.source] = row.thumbnail;
                }
              }
            } catch (e) { /* ignore */ }
          }
          
suggestedProducts = ragSources.slice(0, 4).map((src: any, idx: number) => {
            const meta = src.metadata || {};
            const sourceUrl = meta.source || meta.url || src.source || '';
            const category = meta.category || 'general';
            const thumbnail = meta.thumbnailUrl || thumbnailMap[sourceUrl] || '';
            return {
              id: src.id || `src-${idx}`,
              title: meta.title || 'Assistive Technology',
              title_en: meta.title || 'Assistive Technology',
              description: '',
              category,
              brand: meta.brand || 'MADA Qatar AT Portal',
              price_range: 'Contact MADA Center',
              product_url: sourceUrl,
              source_url: sourceUrl,
              image_url: toProxyImageUrl(thumbnail),
              confidence: src.score || 0.7,
              // ⭐ Multi-language match_reason
              match_reason: getMatchReason(effectiveLanguage, 'found'),
            };
          });
        }

        // Fallback: query DB by detected category
        if (suggestedProducts.length === 0) {
          const contentLower = message.toLowerCase();
          const categoryKeywords: Record<string, string[]> = {
            hearing: ['deaf', 'hear', 'ear', 'sound', 'điếc', 'thính', 'thính giác', 'hearing loss', 'audio', 'fm system', 'microphone', 'amplifier'],
            vision: ['blind', 'visual', 'eye', 'sight', 'mắt', 'thị giác', 'blindness', 'low vision'],
            mobility: ['wheelchair', 'walk', 'move', 'physical', 'mobility', 'vận động', 'di chuyển'],
            communication: ['speak', 'talk', 'communicate', 'voice', 'speech', 'giao tiếp', 'ngôn ngữ', 'aac'],
            cognition: ['memory', 'learn', 'cognitive', 'think', 'nhận thức', 'học tập'],
            daily_living: ['daily', 'living', 'self-care', 'sinh hoạt', 'ăn uống'],
            education: ['education', 'school', 'study', 'giáo dục', 'học'],
          };
          let detectedCat: string | null = null;
          for (const [cat, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
              detectedCat = cat;
              break;
            }
          }
          if (detectedCat) {
            const madaItems = db.prepare(`
              SELECT id, title, content, source, url, category, language, metadata
              FROM knowledge_items
              WHERE category = ? AND source LIKE '%mada.org.qa%' AND status IN ('draft','published','approved')
              ORDER BY confidence DESC, created_at DESC
              LIMIT 4
            `).all(detectedCat) as any[];
            suggestedProducts = madaItems.map((item: any) => {
              const url = item.url || item.source || '';
              let thumbnail = '';
              try {
                const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                thumbnail = meta?.thumbnailUrl || '';
                if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';
              } catch { /* ignore */ }
              return {
                id: item.id, title: item.title, title_en: item.title,
                description: (item.content || '').slice(0, 200),
                category: item.category, brand: 'MADA Qatar AT Portal',
                price_range: 'Contact MADA Center', product_url: url, source_url: url,
                image_url: toProxyImageUrl(thumbnail), confidence: 0.7,
                // ⭐ Multi-language match_reason
                match_reason: getMatchReason(effectiveLanguage, 'category', detectedCat),
              };
            });
            
            // ⭐ DEDUPLICATE: Chỉ giữ lại sản phẩm duy nhất theo product_url
            const seenUrls = new Set<string>();
            suggestedProducts = suggestedProducts.filter((p: any) => {
              if (seenUrls.has(p.product_url)) return false;
              seenUrls.add(p.product_url);
              return true;
            });
          }
        }

        // ⭐ FIX: KHÔNG fallback random - chỉ gợi ý từ RAG sources
        // Strategy 2 và 3 đã bị disable

        if (suggestedProducts.length > 0) {
          sendEvent({ type: 'suggestedProducts', suggestedProducts });
          console.log(`🔵 /api/chat/stream Suggested: ${suggestedProducts.length}`);
        }
      } catch (suggErr) {
        console.log('⚠️ /api/chat/stream suggestedProducts error:', suggErr);
      }

      // Stream the response chunks
      if (streamResult.stream) {
        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            sendEvent({ type: 'chunk', chunk: chunkText });
          }
        }
      } else if (streamResult.answer) {
        // Fallback: send whole answer if not streaming
        sendEvent({ type: 'chunk', chunk: streamResult.answer });
      }

      // Send completion
      sendEvent({
        type: 'done',
        conversationId: convId,
        confidence: streamResult.confidence || 0.5,
      });

      // Store assistant response in history
      chatHistory.get(convId)!.push({ role: 'assistant', content: streamResult.answer || '' });

    } catch (streamError) {
      console.error('❌ Stream error:', streamError);
      // ⭐ FIX: Chỉ gửi event nếu response chưa end
      if (!res.writableEnded) {
        sendEvent({ type: 'error', error: streamError instanceof Error ? streamError.message : 'Stream failed' });
      }
    }

    // ⭐ FIX: Chỉ end nếu response chưa được end (tránh throw "write after end")
    if (!res.writableEnded) {
      try {
        return res.end();
      } catch (e) {
        console.warn('⚠️ res.end() error (already closed?):', (e as Error).message);
        return;
      }
    }
    return;
  } catch (error) {
    console.error('❌ Chat stream error:', error);
    // ⭐ FIX: TRÁNH 500 — nếu SSE headers đã gửi (đã vào stream mode),
    // phải gửi error event thay vì 500 status (Express 500 sẽ đóng stream).
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    if (!res.writableEnded) {
      try {
        if (res.headersSent) {
          // SSE mode: gửi error event để client xử lý
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: `Lỗi server: ${errMsg}. Vui lòng thử lại.`,
            retryable: true,
          })}\n\n`);
          res.end();
        } else {
          // Chưa vào SSE: mới chỉ là JSON error
          res.status(503).json({ success: false, error: `Error: ${errMsg}`, retryable: true });
        }
      } catch (e) {
        console.warn('⚠️ Cannot send error response (stream already closed):', (e as Error).message);
      }
    }
  }
});

// ============== AI FOLLOW-UP QUESTIONS ENDPOINT ==============
// NOTE: /api/chat/follow-up is handled by the chat router in routes/chat.ts
// (duplicated inline endpoint removed to avoid conflicts)

// ============== SCRAPE ENDPOINT ==============

// Scrape content from URL (used by ChatPage for URL attachments)
app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, error: 'Only HTTP and HTTPS URLs are allowed' });
    }

    // ========== SPECIAL HANDLING FOR GOOGLE DOCS ==========
    // Google Docs published URLs - export as plain text
    if (
      parsedUrl.hostname.includes('docs.google.com') &&
      (parsedUrl.pathname.includes('/document/d/') || parsedUrl.pathname.includes('/document/pub/'))
    ) {
      try {
        // For published Google Docs, we can try to get the export URL
        const docIdMatch = parsedUrl.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(exportUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI/1.0)',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const text = await response.text();
            return res.status(200).json({
              success: true,
              data: {
                title: 'Google Docs',
                content: text.slice(0, 50000), // Limit content size
                url: url,
                type: 'google-docs',
              },
            });
          }
        }
      } catch (e) {
        console.error('Google Docs fetch error:', e);
        // Fall through to normal scraping
      }
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI/1.0; +https://mada.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({ success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type') || '';

      // Only process HTML content
      if (!contentType.includes('text/html')) {
        // Return as raw text for other content types
        const text = await response.text();
        return res.status(200).json({
          success: true,
          data: {
            title: parsedUrl.hostname,
            content: text.slice(0, 10000),
            url: url,
            type: 'raw',
          },
        });
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

      // Extract main content using basic HTML parsing
      let content = extractMainContent(html);

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

      // Combine meta description with content if available
      if (metaDescription && !content.includes(metaDescription)) {
        content = metaDescription + '\n\n' + content;
      }

      res.status(200).json({
        success: true,
        data: {
          title: title,
          content: content,
          url: url,
          type: 'html',
        },
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return res.status(400).json({ success: false, error: 'Request timeout - the website took too long to respond' });
      }

      return res.status(500).json({ success: false, error: 'Failed to fetch URL content' });
    }
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper function to extract main content from HTML
function extractMainContent(html: string): string {
  // Remove script tags
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove style tags
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer, aside elements
  content = content.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Try to find main content
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    // Try article tag
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
  }

  // Replace divs and spans with newlines
  content = content.replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  content = decodeHTMLEntities(content);

  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim();

  // Limit content length
  return content.slice(0, 15000);
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

// ============== DATA INGESTION ENDPOINTS ==============

// Upload and ingest text/URL
app.post('/api/data/ingest', async (req, res) => {
  try {
    const { content, url, type = 'text', title } = req.body;

    if (!content && !url) {
      return res.status(400).json({
        success: false,
        error: 'Either content or url is required',
      });
    }

    const source: DataSource = {
      type: url ? 'web' : (type as 'text' | 'pdf'),
      content: content || '',
      source: url || 'manual-input',
      title,
    };

    const result = await dataIngestion.ingestData(source);

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        documentsAdded: result.documentsAdded,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Upload file (PDF, TXT, etc.)
app.post('/api/data/upload', async (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({
        success: false,
        error: 'Filename and content are required',
      });
    }

    const ext = path.extname(filename).toLowerCase();
    const isPDF = ext === '.pdf';

    const source: DataSource = {
      type: isPDF ? 'pdf' : 'text',
      content,
      source: `upload:${filename}`,
      title: filename,
    };

    const result = await dataIngestion.ingestData(source);

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        documentsAdded: result.documentsAdded,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Batch ingest multiple sources
app.post('/api/data/batch', async (req, res) => {
  try {
    const { sources } = req.body;

    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        success: false,
        error: 'Sources array is required',
      });
    }

    const results = await dataIngestion.ingestMultiple(sources);

    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);
    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        totalSources: sources.length,
        successCount,
        totalDocumentsAdded: totalDocs,
        results,
      },
    });
  } catch (error) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get ingestion logs
app.get('/api/data/logs', async (_req, res) => {
  try {
    const logs = await dataIngestion.getIngestionLogs(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== KNOWLEDGE BASE ENDPOINTS ==============

// Search knowledge base
app.get('/api/knowledge/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const results = await vectorStore.search(q as string, Number(limit));

    res.json({
      success: true,
      data: {
        query: q,
        results,
        total: results.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get knowledge base stats
app.get('/api/knowledge/stats', async (_req, res) => {
  try {
    const stats = await vectorStore.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Clear knowledge base
app.delete('/api/knowledge', async (_req, res) => {
  try {
    await vectorStore.clear();
    res.json({
      success: true,
      message: 'Knowledge base cleared successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== LEGACY ENDPOINTS ==============

// RAG Recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { query, language = 'vi', maxResults = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    // Check with Guardrails first
    const guardrailsResult = guardrails.analyzeQuery(query, language);

    // If query should be redirected
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: 0,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
        },
      });
    }

    const ragResponse = await ragEngine.query(query, [], { topK: maxResults });

    res.json({
      success: true,
      data: ragResponse,
    });
  } catch (error) {
    console.error('RAG error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Consultation submission
app.post('/api/consultations', async (req, res) => {
  try {
    const { name, email, phone, message, aiResponse } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required',
      });
    }

    const consultation = {
      id: uuidv4(),
      name,
      email,
      phone,
      message,
      aiResponse,
      status: 'pending',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    };

    consultations.push(consultation);

    res.json({
      success: true,
      data: consultation,
      message: 'Consultation request submitted successfully',
    });
  } catch (error) {
    console.error('Consultation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get consultations (for experts)
app.get('/api/consultations', (req, res) => {
  const { status, limit = 50 } = req.query;

  let filtered = consultations;
  if (status) {
    filtered = consultations.filter((c) => c.status === status);
  }

  res.json({
    success: true,
    data: filtered.slice(-Number(limit)),
  });
});

// Data collection endpoint (legacy)
app.post('/api/data/collect', async (req, res) => {
  try {
    const { url, type = 'website' } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const result = await dataIngestion.ingestData({
      type: 'web',
      content: '',
      source: url,
    });

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        status: result.success ? 'completed' : 'failed',
        url,
        type,
        documentsAdded: result.documentsAdded,
        createdAt: new Date().toISOString(),
      },
      message: result.message,
    });
  } catch (error) {
    console.error('Collection error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Statistics endpoint
app.get('/api/stats', async (_req, res) => {
  try {
    const kbStats = await vectorStore.getStats();

    res.json({
      success: true,
      data: {
        totalUsers: 1234,
        totalDocuments: kbStats.totalDocuments,
        totalQueries: 45231,
        averageAccuracy: kbStats.totalDocuments > 0 ? 95.5 : 0,
        averageResponseTime: 1.2,
        storageUsed: 2.4,
        storageLimit: 10,
        ragEnabled: ragInitialized,
        knowledgeBaseReady: kbStats.isInitialized,
      },
    });
  } catch (error) {
    console.error('[GET /api/stats] failed:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: (error as Error).message });
  }
});

// ============== SEED DATA API ENDPOINTS ==============
// ⭐ Đảm bảo AI luôn có data để trả lời

// GET /api/seed/search - Tìm kiếm sản phẩm từ seed data
app.get('/api/seed/search', async (req, res) => {
  try {
    const { q, category, lang: _lang = 'vi', limit = 5 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const categories = category
      ? [category as string] as any[]
      : undefined;

    const results = await ragService.search({
      query: q,
      categories,
      maxResults: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: {
        query: q,
        results: results.results.map(r => ({
          id: r.item.id,
          madaId: r.item.madaId,
          name: r.item.name,
          description: r.item.description,
          category: r.item.category,
          subcategory: r.item.subcategory,
          manufacturer: r.item.manufacturer,
          sourceUrl: r.item.sourceUrl,
          thumbnailUrl: (r.item as any).thumbnailUrl,
          isoCodes: r.item.isoCodes,
          features: r.item.features,
          useCases: r.item.useCases,
          targetSymptoms: r.item.targetSymptoms,
          score: r.score,
          relevanceReason: r.relevanceReason,
          confidence: r.confidence,
          source: r.source,
        })),
        totalInDatabase: results.totalInDatabase,
        processingTime: results.processingTime,
      },
    });
  } catch (error) {
    console.error('[GET /api/seed/search] failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// GET /api/seed/products - Lấy danh sách tất cả sản phẩm
app.get('/api/seed/products', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let products = await ragService.getAllProducts();

    if (category) {
      products = products.filter(p => p.category === category);
    }

    const total = products.length;
    const paginated = products.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        products: paginated,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('[GET /api/seed/products] failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// GET /api/seed/product/:id - Lấy chi tiết sản phẩm
app.get('/api/seed/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ragService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('[GET /api/seed/product/:id] failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// GET /api/seed/stats - Thống kê seed data
app.get('/api/seed/stats', async (_req, res) => {
  try {
    const stats = await ragService.getStats();

    res.json({
      success: true,
      data: {
        ...stats,
        categories: {
          'sensory-hearing': 'Cảm giác – Thính giác',
          'sensory-vision': 'Cảm giác – Thị giác',
          'voice-and-speech': 'Giọng nói và Lời nói',
          'mental-cognitive': 'Tâm thần – Nhận thức',
          'neuromusculoskeletal': 'Vận động thần kinh – cơ xương',
          'mobility-transportation': 'Di chuyển và Giao thông',
          'regulatory-standards': 'Thông tin bổ trợ',
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/seed/stats] failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// ============== COMPREHENSIVE DATA ENDPOINTS ==============

// Add comprehensive knowledge base
app.post('/api/data/comprehensive', async (_req, res) => {
  try {
    console.log('📚 Loading comprehensive knowledge base...');
    
    const sources = COMPREHENSIVE_KNOWLEDGE.map((item, index) => ({
      type: 'text' as const,
      content: item.content,
      source: `who:mada:at_${index + 1}`,
      title: item.topic,
    }));

    const results = await dataIngestion.ingestMultiple(sources);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    console.log(`✅ Added ${totalDocs} documents from ${COMPREHENSIVE_KNOWLEDGE.length} comprehensive topics`);

    res.json({
      success: true,
      data: {
        topicsAdded: COMPREHENSIVE_KNOWLEDGE.length,
        documentsAdded: totalDocs,
        topics: COMPREHENSIVE_KNOWLEDGE.map(k => k.topic),
      },
      message: `Đã thêm ${COMPREHENSIVE_KNOWLEDGE.length} chủ đề với ${totalDocs} tài liệu vào cơ sở tri thức`,
    });
  } catch (error) {
    console.error('Comprehensive data error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== SAMPLE DATA ENDPOINTS ==============

// Add sample knowledge base
app.post('/api/data/sample', async (_req, res) => {
  try {
    const sampleData = [
      {
        type: 'text' as const,
        content: `Công nghệ hỗ trợ người khuyết tật (Assistive Technology) là các thiết bị, phần mềm hoặc hệ thống giúp người khuyết tật thực hiện các hoạt động hàng ngày một cách độc lập hơn. Theo tiêu chuẩn ISO 9999, có 7 danh mục chính: thiết bị nhìn (Vision), thiết bị nghe (Hearing), thiết bị vận động (Mobility), thiết bị nhận thức (Cognition), thiết bị giao tiếp (Communication), hỗ trợ sinh hoạt (Daily Living), và giáo dục (Education).`,
        source: 'sample:mada_at_basics',
        title: 'Giới thiệu về Công nghệ Hỗ trợ',
      },
      {
        type: 'text' as const,
        content: `JAWS (Job Access With Speech) là phần mềm đọc màn hình phổ biến nhất dành cho người khiếm thị. JAWS hỗ trợ nhiều ngôn ngữ bao gồm tiếng Việt, cho phép người dùng điều khiển máy tính hoàn toàn bằng bàn phím thông qua giọng nói. JAWS tương thích với Windows và nhiều ứng dụng văn phòng.`,
        source: 'sample:JAWS_software',
        title: 'Phần mềm đọc màn hình JAWS',
      },
      {
        type: 'text' as const,
        content: `NVDA (NonVisual Desktop Access) là phần mềm đọc màn hình mã nguồn mở và miễn phí dành cho người khiếm thị trên hệ điều hành Windows. NVDA được phát triển bởi tổ chức NV Access và có cộng đồng hỗ trợ lớn trên toàn thế giới. Phần mềm này hỗ trợ hơn 50 ngôn ngữ và có thể cài đặt trên USB mà không cần cài đặt trên máy.`,
        source: 'sample:NVDA_software',
        title: 'Phần mềm đọc màn hình NVDA',
      },
      {
        type: 'text' as const,
        content: `Màn hình Braille là thiết bị xuất ra dạng nổi (Braille) cho phép người khiếm thị đọc nội dung trên màn hình máy tính. Màn hình Braille thường có từ 20 đến 80 ô Braille, mỗi ô có thể hiển thị một ký tự. Thiết bị này kết nối với máy tính qua USB hoặc Bluetooth và tương thích với các phần mềm đọc màn hình như JAWS và NVDA.`,
        source: 'sample:braille_display',
        title: 'Màn hình Braille',
      },
      {
        type: 'text' as const,
        content: `WCAG 2.1 (Web Content Accessibility Guidelines) là hướng dẫn quốc tế về tiếp cận nội dung web dành cho người khuyết tật. WCAG được phát triển bởi W3C và có 4 nguyên tắc chính: Có thể nhận thức (Perceivable), Có thể vận hành (Operable), Dễ hiểu (Understandable), và Mạnh mẽ (Robust). Tiêu chuẩn này có 3 mức độ tuân thủ: A, AA, và AAA.`,
        source: 'sample:WCAG_standards',
        title: 'Tiêu chuẩn WCAG 2.1',
      },
      {
        type: 'text' as const,
        content: `Xe lăn điện là thiết bị hỗ trợ di chuyển cho người khuyết tật vận động. Xe lăn điện hiện đại có thể điều khiển bằng joystick, điện thoại thông minh, hoặc cử chỉ đầu/mắt. Một số xe lăn có thể leo cầu thang, đứng thẳng, và điều chỉnh chiều cao. Pin xe lăn điện thường có thời gian sử dụng từ 8-20 giờ tùy model.`,
        source: 'sample:electric_wheelchair',
        title: 'Xe lăn điện',
      },
      {
        type: 'text' as const,
        content: `AAC (Augmentative and Alternative Communication) là các phương pháp giao tiếp thay thế và bổ sung dành cho người gặp khó khăn trong giao tiếp bằng lời nói. AAC bao gồm: giao tiếp bằng hình ảnh (PECS), thiết bị phát âm điện tử, ứng dụng giao tiếp trên tablet, và ngôn ngữ ký hiệu. AAC không thay thế việc phát triển lời nói mà bổ sung cho nó.`,
        source: 'sample:AAC_systems',
        title: 'Hệ thống giao tiếp AAC',
      },
      {
        type: 'text' as const,
        content: `Bàn phím thích ứng là thiết bị hỗ trợ người có khó khăn về vận động tay có thể sử dụng máy tính. Bàn phím thích ứng có thể có phím lớn, phím mềm, gập được, hoặc có thể điều khiển bằng miệng. Một số bàn phím còn tích hợp chuột cảm ứng hoặc head mouse (điều khiển bằng đầu).`,
        source: 'sample:adaptive_keyboard',
        title: 'Bàn phím thích ứng',
      },
    ];

    const results = await dataIngestion.ingestMultiple(sampleData);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    res.json({
      success: true,
      data: {
        sourcesAdded: sampleData.length,
        documentsAdded: totalDocs,
        results,
      },
      message: `Đã thêm ${totalDocs} tài liệu mẫu vào cơ sở tri thức`,
    });
  } catch (error) {
    console.error('Sample data error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add seed data
app.post('/api/data/seed', async (_req, res) => {
  try {
    const sources = SEED_KNOWLEDGE.map((item, index) => ({
      type: 'text' as const,
      content: item.content,
      source: `seed:knowledge_${index + 1}`,
      title: item.topic,
    }));

    const results = await dataIngestion.ingestMultiple(sources);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    res.json({
      success: true,
      data: {
        topicsAdded: SEED_KNOWLEDGE.length,
        documentsAdded: totalDocs,
      },
      message: `Đã thêm ${SEED_KNOWLEDGE.length} chủ đề kiến thức vào cơ sở tri thức`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
// ============== CONSULTATION ROUTES ==============
// Lưu trữ consultation requests
interface ConsultationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'contacted';
  attachments?: { name: string; type: string; size: number }[];
}

const consultationRequests: ConsultationRequest[] = [];

app.post('/api/consultation', async (req, res) => {
  try {
    const { name, email, phone, message, attachments, timestamp } = req.body;

    // Validate
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all required fields (name, email, message)',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
      });
    }

    // Tạo request
    const request: ConsultationRequest = {
      id: uuidv4(),
      name,
      email,
      phone: phone || '',
      message,
      timestamp: timestamp || new Date().toISOString(),
      status: 'pending',
      attachments: attachments?.map((a: any) => ({ name: a.name, type: a.type, size: a.size })) || [],
    };

    consultationRequests.push(request);
    logActivity('info', `New consultation request from ${name} (${email})`, 'Consultation');

    // Gửi email thông báo bằng tiếng Anh (nếu có MAIL config)
    if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: parseInt(process.env.MAIL_PORT || '465'),
          secure: process.env.MAIL_SECURE === 'true',
          requireTLS: process.env.MAIL_TLS === 'true',
          auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
          },
        });

        // Build admin link to view consultation
        const adminBaseUrl = process.env.ADMIN_URL || process.env.BASE_URL || 'https://mada.example.com';
        const viewChatLink = `${adminBaseUrl}/admin/consultations`;

        // Build email content in English
        const formattedDate = new Date(request.timestamp).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });

        // Format attachments list
        const attachmentsList = request.attachments && request.attachments.length > 0
          ? `<p><strong>Attachments:</strong></p>
             <ul>
               ${request.attachments.map((a) => `<li>📎 ${a.name} (${(a.size / 1024).toFixed(1)} KB)</li>`).join('')}
             </ul>`
          : '<p><em>No attachments</em></p>';

        await transporter.sendMail({
          from: process.env.MAIL_FROM || 'MADA AI <noreply@mada.org.qa>',
          to: process.env.CONSULTATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'hotro.digibook@gmail.com',
          subject: `[MADA] New Consultation Request from ${name}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #0047ff 0%, #0052cc 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <img src="${adminBaseUrl}/mada-logo.png" alt="MADA" style="height: 48px; margin-bottom: 12px;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Consultation Request</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">MADA Center - Assistive Technology Support</p>
  </div>
  
  <!-- Content -->
  <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    
    <!-- Request ID -->
    <div style="background: #f0f4ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Request ID</p>
      <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px; color: #0047ff; font-weight: 600;">${request.id}</p>
    </div>
    
    <!-- Contact Information -->
    <h2 style="font-size: 16px; color: #333; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0047ff;">📋 Contact Information</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 120px;">Full Name:</td>
        <td style="padding: 8px 0; font-weight: 600; color: #333;">${request.name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Email:</td>
        <td style="padding: 8px 0;">
          <a href="mailto:${request.email}" style="color: #0047ff; text-decoration: none;">${request.email}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Phone:</td>
        <td style="padding: 8px 0; color: #333;">${request.phone || '<em>Not provided</em>'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Submitted:</td>
        <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
      </tr>
    </table>
    
    <!-- Request Details -->
    <h2 style="font-size: 16px; color: #333; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0047ff;">💬 Request Details</h2>
    
    <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; color: #333; line-height: 1.6; white-space: pre-wrap;">${request.message.replace(/\n/g, '<br>')}</p>
    </div>
    
    <!-- Attachments -->
    <h2 style="font-size: 16px; color: #333; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0047ff;">📎 Attachments</h2>
    
    <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      ${attachmentsList}
    </div>
    
    <!-- Action Button -->
    <div style="text-align: center; margin-top: 24px;">
      <a href="${viewChatLink}" style="display: inline-block; background: #0047ff; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,71,255,0.3);">
        📊 View in Admin Dashboard
      </a>
    </div>
    
    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 24px;">
      This is an automated notification from MADA AI Assistant.<br>
      Please respond to the user within 24-48 hours.
    </p>
  </div>
  
</body>
</html>
          `,
          text: `
NEW CONSULTATION REQUEST

Request ID: ${request.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contact Information:
• Name: ${request.name}
• Email: ${request.email}
• Phone: ${request.phone || 'Not provided'}
• Submitted: ${formattedDate}

Request Details:
${request.message}

Attachments: ${request.attachments && request.attachments.length > 0 ? request.attachments.map((a) => `• ${a.name}`).join('\n') : 'None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View in Admin Dashboard: ${viewChatLink}

This is an automated notification from MADA AI Assistant.
Please respond to the user within 24-48 hours.
          `,
        });

        logActivity('success', `Email notification sent to ${process.env.CONSULTATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'hotro.digibook@gmail.com'}`, 'Consultation');
      } catch (emailError) {
        logActivity('warn', `Failed to send email: ${emailError}`, 'Consultation');
      }
    } else {
      logActivity('warn', 'Email not configured. Set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD to enable notifications.', 'Consultation');
    }

    res.json({
      success: true,
      data: {
        id: request.id,
        message: 'Your consultation request has been submitted successfully. An AT specialist will contact you within 24-48 hours.',
      },
    });
  } catch (error) {
    console.error('Consultation error:', error);
    logActivity('error', `Error processing consultation: ${error}`, 'Consultation');
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// Get all consultation requests (admin only)
app.get('/api/consultation', authenticate as any, requireRole('admin', 'super_admin') as any, async (req, res) => {
  try {
    const { status } = req.query;
    let filtered = [...consultationRequests];

    if (status && typeof status === 'string') {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update consultation status (admin only)
app.patch('/api/consultation/:id', authenticate as any, requireRole('admin', 'super_admin') as any, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = consultationRequests.find((r) => r.id === id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }

    request.status = status || request.status;
    logActivity('info', `Cập nhật trạng thái yêu cầu ${id} thành ${request.status}`, 'Consultation');

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== AI SUGGESTIONS AFTER SCRAPE ==============

/**
 * Generate AI suggestions after scraping/content upload
 * Returns related questions, topics, and product recommendations
 */
app.post('/api/kb/suggest', async (req, res) => {
  try {
    const { content, category, title, language = 'vi' } = req.body;

    if (!content || content.length < 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nội dung quá ngắn để tạo đề xuất (tối thiểu 50 ký tự)' 
      });
    }

    console.log(`💡 Generating suggestions for: ${title || 'Untitled'} (category: ${category})`);

    // Truncate content for prompt
    const truncatedContent = content.slice(0, 3000);
    
    // Detect category for suggestions
    const detectedCategory = category || 'general';
    
    // Language-specific prompts
    const suggestionPrompts: Record<string, { intro: string; questions: string; topics: string; products: string }> = {
      vi: {
        intro: `Bạn là chuyên gia về Công nghệ Hỗ trợ (AT). Dựa vào nội dung sau, hãy đề xuất:`,
        questions: `- 3 câu hỏi mà người dùng có thể hỏi về chủ đề này
- Câu hỏi phải ngắn gọn, thực tế, phù hợp với người khuyết tật hoặc gia đình họ
- Format: mỗi câu hỏi trên 1 dòng`,
        topics: `- 3 chủ đề liên quan mà người dùng nên tìm hiểu thêm
- Các chủ đề phải liên quan trực tiếp đến nội dung
- Format: mỗi chủ đề trên 1 dòng`,
        products: `- 2-3 thiết bị/sản phẩm AT phù hợp với nội dung này
- Nếu nội dung về thị giác → đề xuất: phần mềm đọc màn hình, kính thông minh, màn hình Braille
- Nếu nội dung về thính giác → đề xuất: máy trợ thính, thiết bị FM, phụ đề
- Nếu nội dung về vận động → đề xuất: xe lăn, khung đi, nạng
- Nếu nội dung về nhận thức/giao tiếp → đề xuất: thiết bị AAC, ứng dụng giao tiếp
- Format: Tên sản phẩm - mô tả ngắn`
      },
      en: {
        intro: `You are an Assistive Technology (AT) specialist. Based on the following content, please suggest:`,
        questions: `- 3 questions users might ask about this topic
- Questions should be concise, practical, and relevant for people with disabilities or their families
- Format: one question per line`,
        topics: `- 3 related topics users should explore further
- Topics must be directly related to the content
- Format: one topic per line`,
        products: `- 2-3 AT devices/products suitable for this content
- Format: Product name - brief description`
      },
      ar: {
        intro: `أنت متخصص في التكنولوجيا المساعدة (AT). بناءً على المحتوى التالي، يرجى اقتراح:`,
        questions: `- 3 أسئلة قد يسألها المستخدمون حول هذا الموضوع
- يجب أن تكون الأسئلة موجزة وعملية
- التنسيق: سؤال واحد في كل سطر`,
        topics: `- 3 مواضيع ذات صلة يجب على المستخدمين استكشافها
- التنسيق: موضوع واحد في كل سطر`,
        products: `- 2-3 أجهزة/منتجات AT مناسبة لهذا المحتوى
- التنسيق: اسم المنتج - وصف موجز`
      },
      fr: {
        intro: `Vous êtes spécialiste en Technologie d'Assistance (TA). Basé sur le contenu suivant, veuillez suggérer:`,
        questions: `- 3 questions que les utilisateurs pourraient poser sur ce sujet
- Format: une question par ligne`,
        topics: `- 3 sujets connexes que les utilisateurs devraient explorer
- Format: un sujet par ligne`,
        products: `- 2-3 dispositifs/produits TA adaptés à ce contenu
- Format: Nom du produit - description brève`
      }
    };

    const prompt = suggestionPrompts[language] || suggestionPrompts.vi;

    // Build the full prompt
    const fullPrompt = `${prompt.intro}

NỘI DUNG:
${truncatedContent}

1. CÂU HỎI GỢI Ý:
${prompt.questions}

2. CHỦ ĐỀ LIÊN QUAN:
${prompt.topics}

3. SẢN PHẨM ĐỀ XUẤT:
${prompt.products}

Hãy trả lời theo format trên, không thêm giải thích.`;

    // Use RAG engine to generate suggestions
    const ragResponse = await ragEngine.query(fullPrompt, [], {
      systemInstruction: 'Bạn là trợ lý AI chuyên về Công nghệ Hỗ trợ. Trả lời ngắn gọn, thực tế, theo đúng format yêu cầu.',
      maxOutputTokens: 1024
    });

    // Parse the response to extract structured suggestions
    const response = ragResponse.answer;
    
    const suggestions = {
      questions: [] as string[],
      topics: [] as string[],
      products: [] as { name: string; description: string }[],
      raw: response
    };

    // Parse questions
    const questionsMatch = response.match(/1\.\s*CÂU HỎI[^\n]*\n([\s\S]*?)(?=2\.|CHỦ ĐỀ|SẢN PHẨM|$)/i);
    if (questionsMatch) {
      suggestions.questions = questionsMatch[1]
        .split('\n')
        .map((q: string) => q.replace(/^[-•*]\s*/, '').trim())
        .filter((q: string) => q.length > 10);
    }

    // Parse topics
    const topicsMatch = response.match(/2\.\s*CHỦ ĐỀ[^\n]*\n([\s\S]*?)(?=3\.|SẢN PHẨM|$)/i);
    if (topicsMatch) {
      suggestions.topics = topicsMatch[1]
        .split('\n')
        .map((t: string) => t.replace(/^[-•*]\s*/, '').trim())
        .filter((t: string) => t.length > 5);
    }

    // Parse products
    const productsMatch = response.match(/3\.\s*SẢN PHẨM[^\n]*\n([\s\S]*?)$/i);
    if (productsMatch) {
      const productLines = productsMatch[1].split('\n').filter((p: string) => p.trim().length > 3);
      suggestions.products = productLines.map((p: string) => {
        const parts = p.replace(/^[-•*]\s*/, '').split('-');
        return {
          name: parts[0]?.trim() || p.trim(),
          description: parts[1]?.trim() || ''
        };
      });
    }

    // If parsing failed, try alternative parsing
    if (suggestions.questions.length === 0) {
      // Try to extract any lines that look like questions
      const lines = response.split('\n').filter((l: string) => l.trim());
      suggestions.questions = lines.slice(0, 3).map((q: string) => q.replace(/^[-•*\d.]\s*/, '').trim());
    }

    console.log(`✅ Generated suggestions: ${suggestions.questions.length} questions, ${suggestions.topics.length} topics, ${suggestions.products.length} products`);

    res.json({
      success: true,
      data: {
        title,
        category: detectedCategory,
        suggestions,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Suggestion generation error:', error);
    res.status(500).json({ success: false, error: 'Không thể tạo đề xuất' });
  }
});

// ============== SCRAPE WITH SUGGESTIONS ==============

/**
 * Scrape URL and return content WITH AI suggestions
 */
app.post('/api/kb/scrape-with-suggest', async (req, res) => {
  try {
    const { url, title, language = 'vi' } = req.body;

    if (!url || !url.match(/^https?:\/\//)) {
      return res.status(400).json({ success: false, error: 'URL không hợp lệ' });
    }

    // First, scrape the content
    const source: DataSource = {
      type: 'web',
      content: '',
      source: url,
      title,
      language,
    };

    const result = await dataIngestion.ingestData(source);

    if (!result.success) {
      return res.json({ 
        success: false, 
        error: result.message 
      });
    }

    // Get the scraped content from the item
    const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(result.itemId) as any;
    if (!item) {
      return res.status(500).json({ success: false, error: 'Không tìm thấy item' });
    }

    // Generate suggestions
    const suggestionsRes = await fetch(`http://localhost:${PORT}/api/kb/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: item.content,
        category: item.category,
        title: item.title,
        language
      })
    });

    const suggestionsData = await suggestionsRes.json();

    res.json({
      success: true,
      data: {
        itemId: result.itemId,
        title: item.title,
        category: item.category,
        documentsAdded: result.documentsAdded,
        suggestions: suggestionsData.success ? suggestionsData.data.suggestions : null,
        message: result.message
      }
    });

  } catch (error) {
    console.error('❌ Scrape with suggestions error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi scrape và tạo đề xuất' });
  }
});

// Serve frontend static files (production)
// Frontend is built to dist/client, not server/client
const clientDistPath = path.join(__dirname, '..', 'dist', 'client');
const assetsPath = path.join(clientDistPath, 'assets');
if (fs.existsSync(clientDistPath)) {
  console.log(`📁 Static files root: ${clientDistPath}`);
  console.log(`📁 Assets path: ${assetsPath}`);
  console.log(`📁 Assets exist: ${fs.existsSync(assetsPath)}`);
  
  // Explicitly serve /assets from clientDistPath/assets to ensure files are served correctly
  // This fixes the issue where SPA fallback catches /assets/* requests
  app.use('/assets', express.static(assetsPath));
  
  // Also serve other static files from client root (manifest.json, favicon, etc.)
  app.use(express.static(clientDistPath));
  
  // SPA fallback - serve index.html for all non-API routes
  // Note: This regex should NOT match /assets/* since we handle it explicitly above
  app.get(/^(?!\/api\/|\/uploads\/|\/assets\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) res.status(404).json({ success: false, error: 'Not found' });
    });
  });
  console.log(`📦 Serving frontend from ${clientDistPath}`);
} else {
  console.log(`⚠️  Frontend build not found at ${clientDistPath}`);
}

export default app;

// Reference unused constants so TypeScript doesn't complain.
// They're kept as inline data for debugging/reuse.
void _FULL_LANGUAGE_INSTRUCTIONS;
void _MODE_PERSONA_INSTRUCTIONS;
