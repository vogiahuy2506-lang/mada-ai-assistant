import Database from 'better-sqlite3';
import type { Database as BetterSQLiteDatabase } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mada.db');

const db: BetterSQLiteDatabase = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦 SQLite database initialized at', DB_PATH);

// ============== SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'data_manager', 'expert', 'user')),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    provider TEXT NOT NULL DEFAULT 'email',
    avatar TEXT,
    quota_used INTEGER NOT NULL DEFAULT 0,
    quota_limit INTEGER NOT NULL DEFAULT 10,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(refresh_token);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`);

// ============== KNOWLEDGE BASE SCHEMA (Tuần 1 — Task 3) ==============

db.exec(`
  -- Bảng category: 7 nhóm chuyên khoa + phụ
  CREATE TABLE IF NOT EXISTS kb_categories (
    id TEXT PRIMARY KEY,
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- Bảng knowledge_items: từng tài liệu / sản phẩm trong KB
  CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf','web','text','image','docx','manual','seed')),
    url TEXT,
    file_path TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    iso_codes TEXT,
    wcag_level TEXT,
    who_gate_area TEXT,
    auto_classified INTEGER NOT NULL DEFAULT 0,
    confidence REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    chunk_count INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT 'vi',
    metadata TEXT,
    indexed INTEGER NOT NULL DEFAULT 0,
    indexed_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Bảng ingestion_jobs: lịch sử thu thập dữ liệu (theo dõi tiến trình)
  CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
    progress INTEGER NOT NULL DEFAULT 0,
    stage TEXT,
    items_added INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Bảng kb_audit: lịch sử chỉnh sửa KB
  CREATE TABLE IF NOT EXISTS kb_audit (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_kb_items_category ON knowledge_items(category);
  CREATE INDEX IF NOT EXISTS idx_kb_items_status ON knowledge_items(status);
  CREATE INDEX IF NOT EXISTS idx_kb_items_source_type ON knowledge_items(source_type);
  CREATE INDEX IF NOT EXISTS idx_kb_items_indexed ON knowledge_items(indexed);
  CREATE INDEX IF NOT EXISTS idx_kb_items_created ON knowledge_items(created_at);
  CREATE INDEX IF NOT EXISTS idx_kb_jobs_status ON ingestion_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_kb_audit_item ON kb_audit(item_id);
`);

// ============== SCHEDULED SOURCES SCHEMA ==============

db.exec(`
  -- Bảng scheduled_sources: các nguồn scrape định kỳ
  CREATE TABLE IF NOT EXISTS scheduled_sources (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'web' CHECK (type IN ('web', 'api')),
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly', 'daily', 'weekly')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    last_run TEXT,
    last_success TEXT,
    last_error TEXT,
    error_message TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_sources(status);
  CREATE INDEX IF NOT EXISTS idx_scheduled_frequency ON scheduled_sources(frequency);
`);

// Seed 7+2 categories
function seedCategories() {
  const cats = [
    { id: 'vision', name_vi: 'Hỗ trợ Thị giác', name_en: 'Vision', icon: '👁️', sort_order: 1 },
    { id: 'hearing', name_vi: 'Hỗ trợ Thính giác', name_en: 'Hearing', icon: '👂', sort_order: 2 },
    { id: 'mobility', name_vi: 'Hỗ trợ Vận động', name_en: 'Mobility', icon: '🦽', sort_order: 3 },
    { id: 'cognition', name_vi: 'Hỗ trợ Nhận thức', name_en: 'Cognition', icon: '🧠', sort_order: 4 },
    { id: 'communication', name_vi: 'Hỗ trợ Giao tiếp', name_en: 'Communication', icon: '💬', sort_order: 5 },
    { id: 'daily_living', name_vi: 'Hỗ trợ Sinh hoạt', name_en: 'Daily Living', icon: '🏠', sort_order: 6 },
    { id: 'education', name_vi: 'Hỗ trợ Giáo dục', name_en: 'Education', icon: '📚', sort_order: 7 },
    { id: 'web_accessibility', name_vi: 'Tiếp cận Web', name_en: 'Web Accessibility', icon: '🌐', sort_order: 8 },
    { id: 'general', name_vi: 'Tổng quát', name_en: 'General', icon: '📋', sort_order: 99 },
  ];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO kb_categories (id, name_vi, name_en, icon, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const c of cats) stmt.run(c.id, c.name_vi, c.name_en, c.icon, c.sort_order, now);
  console.log(`🌱 Seeded ${cats.length} KB categories`);
}
seedCategories();

console.log('✅ Schema created');

// ============== SEED ADMIN ==============

function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mada.vn';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (existing) {
    console.log(`👤 Admin already exists: ${adminEmail}`);
    return;
  }

  const hash = bcrypt.hashSync(adminPassword, 12);
  const now = new Date().toISOString();
  const id = `admin-${Date.now()}`;

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, last_login_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, adminEmail, 'MADA Admin', hash, 'admin', 'enterprise', 'active', 'email', 0, -1, now, now, now);

  console.log(`🌱 Seeded admin: ${adminEmail} / ${adminPassword}`);
}

function seedDemoUsers() {
  const demos = [
    { email: 'expert@mada.vn', password: 'Expert@123', name: 'Trần Chuyên Gia', role: 'expert', plan: 'enterprise' },
    { email: 'data@mada.vn', password: 'Data@123', name: 'Lê Quản Lý Dữ Liệu', role: 'data_manager', plan: 'enterprise' },
    { email: 'user@mada.vn', password: 'User@123', name: 'Nguyễn Minh Khách', role: 'user', plan: 'pro' },
  ];

  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const d of demos) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(d.email);
    if (existing) continue;
    const hash = bcrypt.hashSync(d.password, 12);
    const now = new Date().toISOString();
    const id = `${d.role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    stmt.run(id, d.email, d.name, hash, d.role, d.plan, 'active', 'email', Math.floor(Math.random() * 50), d.plan === 'enterprise' ? -1 : 100, now, now);
    console.log(`🌱 Seeded ${d.role}: ${d.email} / ${d.password}`);
  }
}

seedAdmin();
seedDemoUsers();

export default db;

// ============== TYPES ==============

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'data_manager' | 'expert' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  provider: string;
  avatar: string | null;
  quota_used: number;
  quota_limit: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRow['role'];
  plan: UserRow['plan'];
  status: UserRow['status'];
  provider: string;
  avatar: string | null;
  quotaUsed: number;
  quotaLimit: number;
  lastLogin: string | null;
  createdAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    plan: row.plan,
    status: row.status,
    provider: row.provider,
    avatar: row.avatar,
    quotaUsed: row.quota_used,
    quotaLimit: row.quota_limit,
    lastLogin: row.last_login_at,
    createdAt: row.created_at,
  };
}