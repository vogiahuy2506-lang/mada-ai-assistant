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

// Safe migration: add must_reset_password column to users if missing.
// (Moved out of the SQL template literal above — the previous version
// inlined TypeScript code inside `db.exec(`...`)`, which made SQLite
// choke on `// ...`, `/* ignore */`, `=>`, `as any[]`.)
try {
  const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!cols.find((c) => c.name === 'must_reset_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0');
  }
} catch (e) {
  console.warn('⚠️ must_reset_password migration skipped:', (e as Error).message);
}

// ============== KNOWLEDGE BASE SCHEMA (Tuần 1 — Task 3) ==============

db.exec(`
  -- Bảng category: 7 nhóm chuyên khoa + phụ
  CREATE TABLE IF NOT EXISTS kb_categories (
    id TEXT PRIMARY KEY,
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL DEFAULT '',
    name_fr TEXT NOT NULL DEFAULT '',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    description_vi TEXT,
    description_en TEXT,
    description_ar TEXT,
    description_fr TEXT,
    related_url TEXT,
    product_link TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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

// ============== PRODUCTS SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS kb_products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_en TEXT NOT NULL DEFAULT '',
    title_ar TEXT NOT NULL DEFAULT '',
    title_fr TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    description_ar TEXT NOT NULL DEFAULT '',
    description_fr TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    price_range TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    product_url TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    iso_codes TEXT NOT NULL DEFAULT '[]',
    wcag_level TEXT NOT NULL DEFAULT '',
    who_gate_area TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT 'vi',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON kb_products(category);
  CREATE INDEX IF NOT EXISTS idx_products_status ON kb_products(status);
  CREATE INDEX IF NOT EXISTS idx_products_featured ON kb_products(featured);
  CREATE INDEX IF NOT EXISTS idx_products_created ON kb_products(created_at);
`);


try {
  const cols = db.prepare("PRAGMA table_info(kb_categories)").all() as any[];
  const colNames = cols.map((c: any) => c.name);
  if (!colNames.includes('name_ar')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN name_ar TEXT NOT NULL DEFAULT ''`);
  }
  if (!colNames.includes('name_fr')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN name_fr TEXT NOT NULL DEFAULT ''`);
  }
  if (!colNames.includes('description_ar')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN description_ar TEXT`);
  }
  if (!colNames.includes('description_fr')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN description_fr TEXT`);
  }
  if (!colNames.includes('description_vi')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN description_vi TEXT`);
  }
  if (!colNames.includes('description_en')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN description_en TEXT`);
  }
  if (!colNames.includes('related_url')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN related_url TEXT`);
  }
  if (!colNames.includes('product_link')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN product_link TEXT`);
  }
  if (!colNames.includes('updated_at')) {
    db.exec(`ALTER TABLE kb_categories ADD COLUMN updated_at TEXT`);
  }
} catch (e: any) {
  // Columns may already exist in newer schema
  if (!e.message?.includes('duplicate column')) {
    console.log('⚠️ Migration note:', e.message);
  }
}

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

// Seed 7 categories aligned với 7 bot MADA
function seedCategories() {
  const cats = [
    { id: 'vision', name_vi: 'Cảm giác – Thị giác', name_en: 'Vision', name_ar: 'الحواس - البصر', name_fr: 'Sens - Vision', icon: '👁️', sort_order: 1, description_vi: 'Bot 2 – Sensory Vision: Phần mềm đọc màn hình, kính lúp điện tử, màn hình Braille, OrCam MyEye. Tiêu chuẩn ISO 22.03.06, 22.06.12, 22.36.12; WCAG 2.2; ISO 9241-171.', description_en: 'Bot 2 – Sensory Vision: screen readers, electronic magnifiers, Braille displays, OrCam MyEye. Standards ISO 22.03.06, 22.06.12, 22.36.12; WCAG 2.2; ISO 9241-171.', description_ar: 'بوت 2 - الحواس - البصر: قارئات الشاشة والمكبرات الإلكترونية وشاشات برايل. معايير ISO 22.03.06 و WCAG 2.2.', description_fr: 'Bot 2 – Sens – Vision : lecteurs d\'écran, loupes électroniques, plages Braille. Normes ISO 22.03.06, WCAG 2.2.', related_url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/', product_link: '' },
    { id: 'hearing', name_vi: 'Cảm giác – Thính giác', name_en: 'Hearing', name_ar: 'الحواس - السمع', name_fr: 'Sens - Audition', icon: '👂', sort_order: 2, description_vi: 'Bot 1 – Sensory Hearing: Máy trợ thính (Phonak Lyric, Oticon More), thiết bị cảnh báo Bellman, hệ thống Roger FM. Tiêu chuẩn ISO 22.06.06, 22.09.06, 22.18.03; IEC 60118; ISO 8253-1.', description_en: 'Bot 1 – Sensory Hearing: Hearing aids (Phonak Lyric, Oticon More), Bellman alert devices, Roger FM system. Standards ISO 22.06.06, 22.09.06, 22.18.03; IEC 60118; ISO 8253-1.', description_ar: 'بوت 1 - الحواس - السمع: سماعات الأذن وأجهزة التنبيه وأنظمة FM. معايير ISO 22.06.06 و IEC 60118.', description_fr: 'Bot 1 – Sens – Audition : aides auditives, dispositifs d\'alerte, systèmes FM. Normes ISO 22.06.06, IEC 60118.', related_url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/', product_link: '' },
    { id: 'mobility', name_vi: 'Vận động thần kinh', name_en: 'Neuromusculoskeletal Movement', name_ar: 'العضلات والعصبية', name_fr: 'Vouvement neuromusculosquelettique', icon: '🦴', sort_order: 3, description_vi: 'Bot 5 – Neuromusculoskeletal Movement: IntegraMouse Plus, Neofect Smart Glove, Bioness L300 Go FES. Tiêu chuẩn ISO 04.24, 06.06, 12.31.03; ISO 10993-1; ISO 13485.', description_en: 'Bot 5 – Neuromusculoskeletal Movement: IntegraMouse Plus, Neofect Smart Glove, Bioness L300 Go FES. Standards ISO 04.24, 06.06, 12.31.03; ISO 10993-1; ISO 13485.', description_ar: 'بوت 5 - العضلات والعصبية: فأرة الفم وقفازات إعادة التأهيل. معايير ISO 04.24 و ISO 10993-1.', description_fr: 'Bot 5 – Mouvement neuromusculosquelettique : souris buccale, gants de rééducation. Normes ISO 04.24, ISO 10993-1.', related_url: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/', product_link: '' },
    { id: 'cognition', name_vi: 'Tâm thần – Nhận thức', name_en: 'Mental – Cognitive', name_ar: 'الإدراكي والمعرفي', name_fr: 'Cognitif', icon: '🧠', sort_order: 4, description_vi: 'Bot 4 – Mental Cognitive: Hộp chia thuốc Medelert, đồng hồ Time Timer, công cụ WHO GATE cho người sa sút trí tuệ. Tiêu chuẩn ISO 05.06.15, 05.09.03; WHO GATE.', description_en: 'Bot 4 – Mental Cognitive: Medelert pill dispenser, Time Timer, WHO GATE tools for dementia. Standards ISO 05.06.15, 05.09.03; WHO GATE.', description_ar: 'بوت 4 - الإدراك والمعرفي: صناديق الأدوية والساعات المرئية. معايير ISO 05.06.15 و WHO GATE.', description_fr: 'Bot 4 – Cognitif : piluliers, minuteurs visuels, outils OMS GATE. Normes ISO 05.06.15, OMS GATE.', related_url: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/', product_link: '' },
    { id: 'communication', name_vi: 'Giọng nói và Lời nói', name_en: 'Voice and Speech', name_ar: 'الكلام والصوت', name_fr: 'Parole et Voix', icon: '💬', sort_order: 5, description_vi: 'Bot 3 – Voice and Speech: Tobii Dynavox (SGD điều khiển bằng ánh mắt), Proloquo2Go, hệ thống AAC. Tiêu chuẩn ISO 05.15.06, 05.15.12, 22.21.12; HL7 FHIR v4.', description_en: 'Bot 3 – Voice and Speech: Tobii Dynavox (eye-controlled SGD), Proloquo2Go, AAC systems. Standards ISO 05.15.06, 05.15.12, 22.21.12; HL7 FHIR v4.', description_ar: 'بوت 3 - الكلام والصوت: Tobii Dynavox و Proloquo2Go وأنظمة AAC. معايير ISO 05.15.06 و HL7 FHIR v4.', description_fr: 'Bot 3 – Parole et Voix : Tobii Dynavox, Proloquo2Go, systèmes CAA. Normes ISO 05.15.06, HL7 FHIR v4.', related_url: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/', product_link: '' },
    { id: 'daily_living', name_vi: 'Di chuyển và Giao thông', name_en: 'Mobility & Transportation', name_ar: 'التنقل والحركة', name_fr: 'Mobilité et Transport', icon: '🦽', sort_order: 6, description_vi: 'Bot 6 – Mobility & Transportation: Scewo Bro (xe lăn leo cầu thang), WeWALK Smart Cane, Quickie Q700-UP M, Rollator Walker. Tiêu chuẩn ISO 12.21.06, 12.21.09, 12.03.06; ISO 7176-19; CE Medical Class II.', description_en: 'Bot 6 – Mobility & Transportation: Scewo Bro (stair-climbing wheelchair), WeWALK Smart Cane, Quickie Q700-UP M, Rollator Walker. Standards ISO 12.21.06, 12.21.09, 12.03.06; ISO 7176-19; CE Medical Class II.', description_ar: 'بوت 6 - التنقل والحركة: الكراسي المتحركة الذكية والعصي الذكية. معايير ISO 12.21.06 و ISO 7176-19.', description_fr: 'Bot 6 – Mobilité et Transport : fauteuils roulants intelligents, cannes intelligentes. Normes ISO 12.21.06, ISO 7176-19.', related_url: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/', product_link: '' },
    { id: 'education', name_vi: 'Thông tin bổ trợ', name_en: 'Regulatory & Standards', name_ar: 'معلومات إضافية ومعايير', name_fr: 'Informations supplémentaires et normes', icon: '📋', sort_order: 7, description_vi: 'Bot 7 – Regulatory & Standards: Tra cứu ISO 9999:2022, WHO GATE, WCAG 2.2, EU MDR, FDA 21 CFR, CE Mark, HL7 FHIR v4. Cổng thông tin quy định & tiêu chuẩn AT.', description_en: 'Bot 7 – Regulatory & Standards: Lookup ISO 9999:2022, WHO GATE, WCAG 2.2, EU MDR, FDA 21 CFR, CE Mark, HL7 FHIR v4. AT regulations & standards portal.', description_ar: 'بوت 7 - المعايير والتنظيمات: بحث ISO 9999:2022 و WHO GATE و WCAG 2.2 و EU MDR.', description_fr: 'Bot 7 – Réglementation et Normes : recherche ISO 9999:2022, OMS GATE, WCAG 2.2, EU MDR.', related_url: 'https://at.mada.org.qa/assistive-technology-portal/', product_link: '' },
    { id: 'web_accessibility', name_vi: 'Tiếp cận Web', name_en: 'Web Accessibility', name_ar: 'إمكانية الوصول للويب', name_fr: 'Accessibilité Web', icon: '🌐', sort_order: 8, description_vi: 'Công cụ và tiêu chuẩn tiếp cận web (WCAG 2.2, Section 508) – bổ trợ cho Bot 7.', description_en: 'Web accessibility tools and standards (WCAG 2.2, Section 508) – supplementary to Bot 7.', description_ar: 'أدوات ومعايير إمكانية الوصول للويب (WCAG 2.2).', description_fr: 'Outils et normes d\'accessibilité web (WCAG 2.2).', related_url: '', product_link: '' },
    { id: 'general', name_vi: 'Tổng quát', name_en: 'General', name_ar: 'عام', name_fr: 'Général', icon: '📋', sort_order: 99, description_vi: 'Thông tin tổng quát về công nghệ hỗ trợ và các tài nguyên chung', description_en: 'General information about assistive technology and common resources', description_ar: 'معلومات عامة حول التكنولوجيا المساعدة والموارد الشائعة', description_fr: 'Informations générales sur la technologie d\'assistance et ressources communes', related_url: '', product_link: '' },
  ];
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO kb_categories (id, name_vi, name_en, name_ar, name_fr, icon, sort_order, description_vi, description_en, description_ar, description_fr, related_url, product_link, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of cats) stmt.run(c.id, c.name_vi, c.name_en, c.name_ar, c.name_fr, c.icon, c.sort_order, c.description_vi, c.description_en, c.description_ar, c.description_fr, c.related_url, c.product_link, now, now);
  console.log(`🌱 Seeded ${cats.length} KB categories (4 languages: VI/EN/AR/FR)`);
}
seedCategories();

// ============== CONSULTATION SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'contacted')),
    notes TEXT,
    assigned_to TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
  CREATE INDEX IF NOT EXISTS idx_consultations_email ON consultations(email);
  CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created_at);
`);

// ============== ADMIN AGENTS SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT NOT NULL DEFAULT '🤖',
    system_prompt TEXT NOT NULL,
    capabilities TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    mada_category TEXT,
    bot_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agents_active ON admin_agents(is_active);
`);

// ============== ADMIN LOGS SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('critical', 'error', 'warn', 'info', 'success')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_system_logs_level ON admin_system_logs(level);
  CREATE INDEX IF NOT EXISTS idx_system_logs_source ON admin_system_logs(source);
  CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON admin_system_logs(timestamp);
`);

// ============== FILE UPLOAD QUOTA SCHEMA ==============
// Track successful file uploads per user per month.
// Used to enforce plan-based upload limits (e.g. Free = 10/month, Pro = unlimited).

db.exec(`
  CREATE TABLE IF NOT EXISTS file_uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    file_type TEXT,
    month_key TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_file_uploads_user_month ON file_uploads(user_id, month_key);
`);

// ============== SYSTEM SETTINGS SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TEXT NOT NULL
  );
`);

// Seed default system settings
function seedSystemSettings() {
  const defaults = [
    { key: 'anonymous_limit', value: '10', type: 'number', description: 'Message quota for anonymous users' },
    { key: 'default_plan_limit', value: '50', type: 'number', description: 'Default quota limit for free plan' },
    { key: 'file_upload_limit_free', value: '10', type: 'number', description: 'File upload quota per month for Free plan' },
    { key: 'file_upload_limit_pro', value: '0', type: 'number', description: 'File upload quota per month for Pro plan (0 = unlimited)' },
    { key: 'file_upload_limit_enterprise', value: '0', type: 'number', description: 'File upload quota per month for Enterprise plan (0 = unlimited)' },
    { key: 'max_files_per_session', value: '10', type: 'number', description: 'Maximum files per chat session' },
    { key: 'max_files_total', value: '100', type: 'number', description: 'Maximum total files' },
    { key: 'max_file_size_mb', value: '50', type: 'number', description: 'Maximum file size in MB' },
    { key: 'require_2fa_admin', value: 'true', type: 'boolean', description: 'Require 2FA for admin accounts' },
    { key: 'allow_google_login', value: 'true', type: 'boolean', description: 'Allow Google OAuth login' },
    { key: 'audit_log_enabled', value: 'true', type: 'boolean', description: 'Enable detailed audit logging' },
    { key: 'auto_lock_after_failures', value: '5', type: 'number', description: 'Auto-lock account after N failed attempts' },
    { key: 'ai_temperature', value: '0.7', type: 'number', description: 'AI model temperature (0-1)' },
    { key: 'ai_max_tokens', value: '2048', type: 'number', description: 'AI model max tokens' },
  ];

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value, type, description, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of defaults) {
    stmt.run(s.key, s.value, s.type, s.description, now);
  }
  console.log(`🌱 Seeded ${defaults.length} system settings`);
}
seedSystemSettings();

// ============== CHAT METRICS SCHEMA ==============

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_metrics (
    id TEXT PRIMARY KEY,
    total_chats INTEGER NOT NULL DEFAULT 0,
    total_queries INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms INTEGER NOT NULL DEFAULT 0,
    avg_confidence REAL NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    language_stats TEXT NOT NULL DEFAULT '{}',
    category_stats TEXT NOT NULL DEFAULT '{}',
    top_queries TEXT NOT NULL DEFAULT '[]',
    hourly_stats TEXT NOT NULL DEFAULT '[]',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chat_metrics_date ON chat_metrics(date);
`);

// ============== USER CHAT HISTORY & FAVORITES SCHEMA ==============

db.exec(`
  -- Bảng conversations: Mỗi cuộc hội thoại (group nhiều messages)
  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,                  -- NULL nếu anonymous
    title TEXT NOT NULL,
    agent_id TEXT,
    language TEXT NOT NULL DEFAULT 'vi',
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_preview TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Bảng chat_messages: Từng message trong conversation
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    agent_id TEXT,
    sources TEXT,                  -- JSON string mảng sources
    confidence REAL,
    language TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
  );

  -- Bảng user_favorites: Sản phẩm / KB items user bookmark
  CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('product', 'kb_item', 'standard')),
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    metadata TEXT,                 -- JSON string
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_type, item_id)
  );

  CREATE INDEX IF NOT EXISTS idx_conv_user ON chat_conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conv_updated ON chat_conversations(updated_at);
  CREATE INDEX IF NOT EXISTS idx_conv_pinned ON chat_conversations(is_pinned);
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON chat_messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
`);

console.log('✅ Schema created');

// ============== MIGRATIONS ==============

function runMigrations() {
  try {
    // Add device_id column for anonymous sessions (2026-08-20)
    const cols = db.prepare("PRAGMA table_info(chat_conversations)").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    if (!colNames.includes('device_id')) {
      db.exec(`ALTER TABLE chat_conversations ADD COLUMN device_id TEXT`);
      console.log('✅ Added device_id to chat_conversations');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigrations();

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

// ============== FILE UPLOAD QUOTA HELPERS ==============

export interface FileUploadQuota {
  used: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
  plan: 'free' | 'pro' | 'enterprise';
  monthKey: string;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getFileUploadLimitForPlan(plan: 'free' | 'pro' | 'enterprise'): number {
  const key = `file_upload_limit_${plan}`;
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return plan === 'free' ? 10 : -1;
  const n = parseInt(row.value, 10);
  return Number.isFinite(n) && n >= 0 ? n : (plan === 'free' ? 10 : -1);
}

export function getFileUploadQuota(userId: string, plan: 'free' | 'pro' | 'enterprise'): FileUploadQuota {
  const limit = getFileUploadLimitForPlan(plan);
  const monthKey = currentMonthKey();

  if (limit === -1) {
    return { used: 0, limit: -1, remaining: -1, plan, monthKey };
  }

  const row = db.prepare(
    'SELECT COUNT(*) AS c FROM file_uploads WHERE user_id = ? AND month_key = ?'
  ).get(userId, monthKey) as { c: number };

  const used = row.c;
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, plan, monthKey };
}

export interface TrackFileUploadInput {
  userId: string;
  filename: string;
  fileSizeBytes: number;
  fileType?: string;
}

export interface TrackFileUploadResult {
  ok: boolean;
  reason?: 'plan_limit_exceeded' | 'invalid_plan';
  quota: FileUploadQuota;
}

export function trackFileUpload(input: TrackFileUploadInput): TrackFileUploadResult {
  // Resolve plan from users table
  const userRow = db.prepare('SELECT plan FROM users WHERE id = ?').get(input.userId) as { plan: 'free' | 'pro' | 'enterprise' } | undefined;
  if (!userRow) {
    return {
      ok: false,
      reason: 'invalid_plan',
      quota: { used: 0, limit: 0, remaining: 0, plan: 'free', monthKey: currentMonthKey() },
    };
  }

  const plan = userRow.plan;
  const quota = getFileUploadQuota(input.userId, plan);

  // Unlimited plans always allow
  if (quota.limit === -1) {
    db.prepare(`
      INSERT INTO file_uploads (id, user_id, filename, file_size_bytes, file_type, month_key, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `fu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input.userId,
      input.filename,
      input.fileSizeBytes,
      input.fileType ?? null,
      quota.monthKey,
      new Date().toISOString()
    );

    return { ok: true, quota: { ...quota, used: quota.used + 1 } };
  }

  // Limited plans: enforce
  if (quota.remaining <= 0) {
    return { ok: false, reason: 'plan_limit_exceeded', quota };
  }

  db.prepare(`
    INSERT INTO file_uploads (id, user_id, filename, file_size_bytes, file_type, month_key, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `fu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    input.userId,
    input.filename,
    input.fileSizeBytes,
    input.fileType ?? null,
    quota.monthKey,
    new Date().toISOString()
  );

  return { ok: true, quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 } };
}