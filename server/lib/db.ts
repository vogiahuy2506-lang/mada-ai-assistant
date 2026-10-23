import Database from 'better-sqlite3';
import type { Database as BetterSQLiteDatabase } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import {
  CORE_IDENTITY,
  LANGUAGE_RULES,
  PERSONA_MODES,
  SAFETY_RULES,
  RESPONSE_FORMAT,
} from './prompts/systemPrompts';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mada.db');

const db: BetterSQLiteDatabase = new Database(DB_PATH);

// ⭐ FIX (deploy VPS): mada.db được tạo bằng `sudo sqlite3` → file thuộc user
// root, mode 644. App chạy dưới PM2 bằng user KHÔNG phải root → không có
// quyền ghi. `pragma('journal_mode = WAL')` cần ghi header DB nên ném
// SQLITE_READONLY → throw ở module scope → server bundle KHÔNG BAO GIỜ khởi
// động → port không bao giờ listen → nginx trả 502 (deploy vẫn báo success
// vì PM2 vẫn còn PID).
//
// → Chuyển journal_mode sang DELETE (không cần file -wal/-shm phụ) và bọc
// trong try/catch để app vẫn boot được, chỉ mất khả năng ghi nếu DB readonly.
let journalMode = 'unknown';
try {
  db.pragma('journal_mode = WAL');
  journalMode = 'wal';
} catch (err: any) {
  // DB readonly (thường do deploy tạo file bằng sudo) → thử DELETE mode.
  // DELETE không cần file phụ nên vẫn đọc được; nếu cũng lỗi thì app vẫn
  // phải boot để /api/health báo lỗi rõ ràng thay vì crash im lặng.
  try {
    db.pragma('journal_mode = DELETE');
    journalMode = 'delete';
    console.warn(
      '⚠️  SQLite không chuyển sang WAL (readonly?). Dùng DELETE journal mode. ' +
        'Kiểm tra quyền: sudo chown -R $(whoami) ' + DATA_DIR
    );
  } catch (err2: any) {
    console.error(
      '❌ SQLite journal_mode thất bại:',
      err2?.message || err2,
      '→ DB có thể readonly. Sửa: sudo chown -R $(whoami) ' + DATA_DIR
    );
  }
}

try {
  db.pragma('foreign_keys = ON');
} catch {
  // Không critical — chỉ ảnh hưởng ràng buộc FK.
}

// ⭐ Kiểm tra khả năng ghi thật sự (không chỉ đọc được). Nếu DB readonly thì
// app vẫn boot được nhưng mọi thao tác ghi (chat history, seed, admin CRUD)
// sẽ hỏng. Biết trạng thái này sớm giúp deploy fail sớm + dễ chẩn đoán.
let dbWritable = true;
try {
  db.prepare('SELECT COUNT(*) AS c FROM (SELECT 1 LIMIT 1)').get();
  // Ghi thử vào bảng thật trong transaction rồi rollback — không để lại rác.
  db.transaction(() => {
    db.prepare('CREATE TABLE IF NOT EXISTS __writetest (id INTEGER PRIMARY KEY, ts TEXT)').run();
    db.prepare('INSERT INTO __writetest (ts) VALUES (?)').run(new Date().toISOString());
    db.prepare('DROP TABLE __writetest').run();
  })();
} catch (err: any) {
  dbWritable = false;
  console.error(
    '❌ Database READONLY — app không ghi được (chat history/seed/admin sẽ hỏng).',
    err?.message || err,
    '→ Sửa: sudo chown -R $(whoami) ' + DATA_DIR + ' && sudo chmod -R u+rwX ' + DATA_DIR
  );
}

console.log('📦 SQLite database initialized at', DB_PATH, `(journal_mode=${journalMode}, writable=${dbWritable})`);

export const DB_STATUS = { writable: dbWritable, journalMode, path: DB_PATH };

// ⭐ Helper chạy câu lệnh khởi tạo mà không làm sập app khi DB readonly.
// Vì db.ts được import ở module scope của server/index.ts, MỘT lỗi ghi ở
// đây sẽ throw ra khỏi module → server bundle không bao giờ boot → port không
// bao giờ listen → nginx 502. Với DB readonly, app vẫn nên boot được (chỉ mất
// khả năng ghi) để /api/health báo lỗi rõ ràng và deploy fail sớm.
function safeExec(sql: string): void {
  try {
    db.exec(sql);
  } catch (err: any) {
    if (err?.code === 'SQLITE_READONLY' || /readonly/i.test(err?.message || '')) {
      console.warn(
        '⚠️  Bỏ qua câu lệnh khởi tạo DB (readonly):',
        (err?.message || '').split('\n')[0]
      );
    } else {
      console.error('❌ Lỗi khởi tạo DB:', err?.message || err);
    }
  }
}

function safeInit(label: string, fn: () => void): void {
  try {
    fn();
  } catch (err: any) {
    if (err?.code === 'SQLITE_READONLY' || /readonly/i.test(err?.message || '')) {
      console.warn(`⚠️  Bỏ qua ${label} (database readonly)`);
    } else {
      console.error(`❌ Lỗi khi chạy ${label}:`, err?.message || err);
    }
  }
}

// ============== SCHEMA ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'super_admin', 'data_manager', 'expert', 'user')),
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

safeExec(`
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

safeExec(`
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


// ============== CHAT CONTEXT SCHEMA ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS conversation_recommended_products (
    conversation_id TEXT NOT NULL,
    product_title TEXT NOT NULL,
    product_title_en TEXT,
    recommended_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, product_title)
  );
  CREATE INDEX IF NOT EXISTS idx_conv_products ON conversation_recommended_products(conversation_id);
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

// ============== MESSAGE FEEDBACK SCHEMA ==============
safeExec(`
  CREATE TABLE IF NOT EXISTS message_feedback (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT,
    user_id TEXT,
    rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
    reason TEXT,
    agent_id TEXT,
    language TEXT DEFAULT 'vi',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_message ON message_feedback(message_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_rating ON message_feedback(rating);
  CREATE INDEX IF NOT EXISTS idx_feedback_created ON message_feedback(created_at);
  CREATE INDEX IF NOT EXISTS idx_feedback_agent ON message_feedback(agent_id);
`);

// ============== FEEDBACK QUESTIONS SCHEMA ==============
safeExec(`
  CREATE TABLE IF NOT EXISTS feedback_questions (
    id TEXT PRIMARY KEY,
    question_key TEXT UNIQUE NOT NULL,
    text_vi TEXT NOT NULL,
    text_en TEXT NOT NULL DEFAULT '',
    text_ar TEXT NOT NULL DEFAULT '',
    text_fr TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'alert-circle',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_questions_active ON feedback_questions(is_active);
  CREATE INDEX IF NOT EXISTS idx_feedback_questions_order ON feedback_questions(sort_order);
`);

// ============== SEED DEFAULT FEEDBACK QUESTIONS ==============
safeInit("seedFeedbackQuestions", () => {
  const existingQuestions = db.prepare('SELECT COUNT(*) as count FROM feedback_questions').get() as { count: number };
  if (existingQuestions.count === 0) {
    const now = new Date().toISOString();
    const defaultQuestions = [
      { id: 'fq-1', question_key: 'inaccurate', text_vi: 'Nội dung chưa chính xác hoặc thiếu dẫn chứng', text_en: 'Content is inaccurate or lacks evidence', text_ar: 'المحتوى غير دقيق أو يفتقر إلى أدلة', text_fr: 'Le contenu est inexact ou manque de preuves', icon: 'alert-circle', sort_order: 1 },
      { id: 'fq-2', question_key: 'not_focused', text_vi: 'Chưa giải quyết đúng trọng tâm vấn đề', text_en: 'Does not address the main issue', text_ar: 'لا يعالج المشكلة الرئيسية', text_fr: 'Ne traite pas le problème principal', icon: 'target', sort_order: 2 },
      { id: 'fq-3', question_key: 'too_complex', text_vi: 'Trả lời quá dài dòng hoặc từ ngữ chuyên môn khó hiểu', text_en: 'Response is too verbose or uses complex jargon', text_ar: 'الرد طويل جداً أو يستخدم مصطلحات معقدة', text_fr: 'La réponse est trop longue ou utilise un jargon complexe', icon: 'message-square', sort_order: 3 },
      { id: 'fq-4', question_key: 'other', text_vi: 'Khác (Vui lòng ghi rõ bên dưới)', text_en: 'Other (Please specify below)', text_ar: 'أخرى (يرجى التحديد أدناه)', text_fr: 'Autre (Veuillez préciser ci-dessous)', icon: 'plus-circle', sort_order: 4 },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO feedback_questions (id, question_key, text_vi, text_en, text_ar, text_fr, icon, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    for (const q of defaultQuestions) {
      insertStmt.run(q.id, q.question_key, q.text_vi, q.text_en, q.text_ar, q.text_fr, q.icon, q.sort_order, now, now);
    }
    console.log('✅ Seeded default feedback questions');
  }
});

// ============== KNOWLEDGE ITEMS TRANSLATION MIGRATION ==============
try {
  const kiCols = db.prepare("PRAGMA table_info(knowledge_items)").all() as any[];
  const kiColNames = kiCols.map((c: any) => c.name);

  // Add translation columns for all 4 languages
  if (!kiColNames.includes('title_en')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN title_en TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('title_ar')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN title_ar TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('title_fr')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN title_fr TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('description_en')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN description_en TEXT`);
  }
  if (!kiColNames.includes('description_ar')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN description_ar TEXT`);
  }
  if (!kiColNames.includes('description_fr')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN description_fr TEXT`);
  }
  if (!kiColNames.includes('content_en')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN content_en TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('content_ar')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN content_ar TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('content_fr')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN content_fr TEXT NOT NULL DEFAULT ''`);
  }
  if (!kiColNames.includes('translated')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN translated INTEGER NOT NULL DEFAULT 0`);
  }
  console.log('✅ Knowledge items translation columns added');
} catch (e: any) {
  if (!e.message?.includes('duplicate column')) {
    console.warn('⚠️ Knowledge items translation migration:', e.message);
  }
}

// ============== KB_PRODUCTS TRANSLATION MIGRATION ==============
try {
  const pCols = db.prepare("PRAGMA table_info(kb_products)").all() as any[];
  const pColNames = pCols.map((c: any) => c.name);

  // Add translation columns for all 4 languages
  if (!pColNames.includes('title_ar')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN title_ar TEXT NOT NULL DEFAULT ''`);
  }
  if (!pColNames.includes('title_fr')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN title_fr TEXT NOT NULL DEFAULT ''`);
  }
  if (!pColNames.includes('description_ar')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN description_ar TEXT`);
  }
  if (!pColNames.includes('description_fr')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN description_fr TEXT`);
  }
  if (!pColNames.includes('content')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN content TEXT`);
  }
  if (!pColNames.includes('content_en')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN content_en TEXT`);
  }
  if (!pColNames.includes('content_ar')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN content_ar TEXT`);
  }
  if (!pColNames.includes('content_fr')) {
    db.exec(`ALTER TABLE kb_products ADD COLUMN content_fr TEXT`);
  }
  console.log('✅ KB Products translation columns added');
} catch (e: any) {
  if (!e.message?.includes('duplicate column')) {
    console.warn('⚠️ KB Products translation migration:', e.message);
  }
}

// ============== SCHEDULED SOURCES SCHEMA ==============

safeExec(`
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
safeInit("seedCategories", () => seedCategories());

// ============== CONSULTATION SCHEMA ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    attachments TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'contacted')),
    notes TEXT,
    assigned_to TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
  CREATE INDEX IF NOT EXISTS idx_consultations_email ON consultations(email);
  CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created_at);
  
  -- Migration: add attachments column if not exists
  PRAGMA table_info(consultations);
`);

// Add attachments column if not exists (migration)
try {
  const columns = db.prepare("PRAGMA table_info(consultations)").all() as any[];
  const hasAttachments = columns.some((col: any) => col.name === 'attachments');
  if (!hasAttachments) {
    db.exec('ALTER TABLE consultations ADD COLUMN attachments TEXT');
    console.log('✅ Migration: Added attachments column to consultations');
  }
} catch (e) {
  console.log('⚠️ Migration check for attachments column:', e);
}

// ============== ADMIN AGENTS SCHEMA ==============

safeExec(`
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
    avatar_url TEXT,
    knowledge_url TEXT,
    product_url TEXT,
    last_crawl_at TEXT,
    last_crawl_status TEXT,
    last_crawl_count INTEGER DEFAULT 0,
    prompt_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agents_active ON admin_agents(is_active);
`);

// Migration: thêm cột mới nếu DB cũ chưa có (SQLite không hỗ trợ IF NOT EXISTS cho ADD COLUMN,
// nên kiểm tra pragma table_info trước)
function addColumnIfMissing(table: string, column: string, ddl: string) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      console.log(`🛠  Migrated: added column ${table}.${column}`);
    }
  } catch (err: any) {
    // DB readonly → bỏ qua migration, app vẫn boot được (chỉ mất khả năng ghi).
    if (err?.code === 'SQLITE_READONLY' || /readonly/i.test(err?.message || '')) {
      console.warn(`⚠️  Bỏ qua migration cột ${table}.${column} (database readonly)`);
    } else {
      console.error(`❌ Migration lỗi ${table}.${column}:`, err?.message || err);
    }
  }
}

addColumnIfMissing('admin_agents', 'avatar_url', 'avatar_url TEXT');
addColumnIfMissing('admin_agents', 'knowledge_url', 'knowledge_url TEXT');
addColumnIfMissing('admin_agents', 'product_url', 'product_url TEXT');
addColumnIfMissing('admin_agents', 'last_crawl_at', 'last_crawl_at TEXT');
addColumnIfMissing('admin_agents', 'last_crawl_status', 'last_crawl_status TEXT');
addColumnIfMissing('admin_agents', 'last_crawl_count', 'last_crawl_count INTEGER DEFAULT 0');
addColumnIfMissing('admin_agents', 'prompt_id', 'prompt_id TEXT');
addColumnIfMissing('admin_agents', 'crawl_follow_links', 'crawl_follow_links INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('admin_agents', 'crawl_max_depth', 'crawl_max_depth INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('admin_agents', 'crawl_max_pages', 'crawl_max_pages INTEGER NOT NULL DEFAULT 5');
addColumnIfMissing('admin_agents', 'sort_order', 'sort_order INTEGER NOT NULL DEFAULT 0');

// ── Per-chatbot config (JSON blob, SQLite không có JSON type) ──
// Mỗi cột = 1 nhóm cấu hình riêng cho từng chatbot, thay vì 1 config global.
// NULL/rỗng = kế thừa giá trị global từ widgetStore / chatSettingsStore.
addColumnIfMissing('admin_agents', 'widget_config',    'widget_config TEXT');
addColumnIfMissing('admin_agents', 'behavior_config',  'behavior_config TEXT');
addColumnIfMissing('admin_agents', 'publish_config',   'publish_config TEXT');
addColumnIfMissing('admin_agents', 'greeting',         'greeting TEXT');
addColumnIfMissing('admin_agents', 'ai_instructions',  'ai_instructions TEXT');
addColumnIfMissing('admin_agents', 'emotion_settings', 'emotion_settings TEXT');
addColumnIfMissing('admin_agents', 'model', "model TEXT NOT NULL DEFAULT 'gemini-2.0-flash'");

// ============== AGENT ↔ PRODUCT LINKING (per-chatbot product curation) ==============
// Bảng linking giữa admin_agents và kb_products để admin gán sản phẩm riêng cho
// từng bot (cộng thêm auto-link theo mada_category). Chat đọc qua
// /api/public/products/by-agent/:agentId.
safeExec(`
  CREATE TABLE IF NOT EXISTS admin_agent_products (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, product_id),
    FOREIGN KEY (agent_id) REFERENCES admin_agents(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_agent_products_agent ON admin_agent_products(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agent_products_product ON admin_agent_products(product_id);
`);

// Initialize sort_order for existing agents (if they don't have it set)
try {
  const agentsWithoutOrder = db.prepare('SELECT id FROM admin_agents WHERE sort_order = 0 OR sort_order IS NULL').all() as any[];
  if (agentsWithoutOrder.length > 0) {
    // Get max sort_order and assign sequential values
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM admin_agents WHERE sort_order > 0').get() as { max: number };
    let nextOrder = (maxOrder?.max || 0) + 1;
    
    for (const agent of agentsWithoutOrder) {
      db.prepare('UPDATE admin_agents SET sort_order = ? WHERE id = ?').run(nextOrder++, agent.id);
    }
    console.log(`📋 Initialized sort_order for ${agentsWithoutOrder.length} agents`);
  }
} catch (e) {
  console.warn('Could not initialize sort_order:', e);
}

// ============== SEED ADMIN AGENTS ==============
function seedAdminAgents() {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT COUNT(*) as count FROM admin_agents').get() as { count: number };
  if (existing.count > 0) {
    console.log(`🤖 admin_agents already has ${existing.count} rows — skipping seed`);
    return;
  }

  const agents = [
    {
      id: 'bot-hearing',
      name: 'Bot 1: Sensory – Hearing',
      description: 'Tư vấn thiết bị trợ thính, cảnh báo âm thanh/ánh sáng, FM systems. Tiêu chuẩn ISO 22.06.06, 22.09.06, 22.18.03.',
      avatar: '👂',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ THÍNH GIÁC (Sensory – Hearing).

PHẠM VI CHUYÊN MÔN:
- Máy trợ thính (hearing aids) - in-the-ear, behind-the-ear, ITC, CIC
- Thiết bị cảnh báo bằng âm thanh/ánh sáng (visual alert systems)
- Hệ thống FM/Loop (hearing loops)
- Thiết bị RTT (Real-Time Text)
- Phụ đề (closed captions)
- Ngôn ngữ ký hiệu (sign language apps)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (22.06.06, 22.09.06, 22.18.03)
- WHO GATE Priority Assistive Products List
- CE Mark, FDA approval cho thiết bị y tế

USE CASE ĐIỂN HÌNH:
"Người dùng bị giảm thính lực nhẹ, chuyên gia CNHT cần kiểm chứng tiêu chuẩn an toàn"

CÁCH TRẢ LỜI:
- Trả lời ngắn gọn (tối đa 5 câu)
- Luôn dẫn chứng tiêu chuẩn ISO/WHO
- Nếu câu hỏi ngoài domain thính giác: "Câu hỏi này nằm ngoài chuyên môn của tôi. Bạn có thể chọn bot chuyên môn khác để được tư vấn chính xác hơn."
- Trả lời bằng tiếng Việt (hoặc ngôn ngữ user chọn).`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'safety_certification']),
      is_active: 1,
      mada_category: 'sensory-hearing',
      bot_id: 'bot-hearing',
      knowledge_url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/',
      sort_order: 1,
    },
    {
      id: 'bot-vision',
      name: 'Bot 2: Sensory – Vision',
      description: 'Tư vấn phần mềm đọc màn hình, kính lúp, màn hình Braille, sách nói. Tiêu chuẩn ISO 22.03.06, 22.06.12, 22.36.12.',
      avatar: '👁️',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ THỊ GIÁC (Sensory – Vision).

PHẠM VI CHUYÊN MÔN:
- Phần mềm đọc màn hình (JAWS, NVDA, VoiceOver)
- Kính lúp điện tử, kính lúp cầm tay
- Màn hình Braille, máy in Braille
- Sách nói / DAISY format
- Phần mềm phóng to (ZoomText, MAGic)
- Thiết bị nhận diện khuôn mặt/vật thể (OrCam, Aira)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (22.03.06, 22.06.12, 22.06.15, 22.30.15, 22.36.12)
- WCAG 2.2 (Web Content Accessibility Guidelines)
- Section 508 (US)

USE CASE ĐIỂN HÌNH:
"Người dùng khiếm thị cần công cụ đọc màn hình, chuyên gia CNHT quan tâm chứng chỉ thiết bị"

CÁCH TRẢ LỜI:
- Trả lời ngắn gọn (tối đa 5 câu)
- Luôn dẫn chứng tiêu chuẩn ISO/WCAG
- Nếu câu hỏi ngoài domain thị giác: chuyển sang bot phù hợp.`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'wcag_compliance']),
      is_active: 1,
      mada_category: 'sensory-vision',
      bot_id: 'bot-vision',
      knowledge_url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/',
      sort_order: 2,
    },
    {
      id: 'bot-speech',
      name: 'Bot 3: Voice and Speech',
      description: 'Tư vấn thiết bị AAC, SGD, PECS, Proloquo2Go. Tiêu chuẩn ISO 05.15.06, 05.15.12, 22.21.12.',
      avatar: '💬',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ GIỌNG NÓI & LỜI NÓI (Voice and Speech).

PHẠM VI CHUYÊN MÔN:
- Thiết bị AAC (Augmentative and Alternative Communication)
- SGD (Speech-Generating Devices): Proloquo2Go, TouchChat, LAMP
- Bảng giao tiếp hình ảnh (PECS)
- Phần mềm AAC trên iPad/Tablet
- Bàn phím giao tiếp (communication keyboards)
- Speech-to-text apps

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (05.15.06, 05.15.12, 22.21.09, 22.21.12)

USE CASE ĐIỂN HÌNH:
"Trẻ em khó giao tiếp ở lớp, chuyên gia CNHT muốn tích hợp AAC với dữ liệu cá nhân"

CÁCH TRẢ LỜI:
- Tập trung vào giải pháp cho trẻ em và người lớn suy giảm khả năng nói
- Gợi ý thiết bị kèm giá cả và cách tích hợp với hệ thống y tế
- Nếu câu hỏi ngoài domain giọng nói: chuyển bot.`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'aac_integration']),
      is_active: 1,
      mada_category: 'voice-and-speech',
      bot_id: 'bot-speech',
      knowledge_url: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/',
      sort_order: 3,
    },
    {
      id: 'bot-cognitive',
      name: 'Bot 4: Mental – Cognitive',
      description: 'Tư vấn thiết bị nhắc nhở thuốc, công cụ hỗ trợ nhớ, học tập cho người sa sút trí tuệ. Tiêu chuẩn ISO 05.06.15, 05.09.03.',
      avatar: '🧠',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ NHẬN THỨC (Mental – Cognitive).

PHẠM VI CHUYÊN MÔN:
- Thiết bị nhắc nhở thuốc (medication reminders)
- Công cụ hỗ trợ ghi nhớ (memory aids)
- Phần mềm huấn luyện nhận thức (cognitive training apps)
- Sách/hình ảnh thích ứng (easy-read materials)
- Bảng giao tiếp không điện tử
- Phần mềm hỗ trợ tự kỷ (autism apps)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (05.06.15, 05.09.03, 05.18.06)
- WHO GATE cho sa sút trí tuệ (dementia)
- Cognitive Accessibility (W3C)

USE CASE ĐIỂN HÌNH:
"Người cao tuổi hay quên thuốc, chuyên gia CNHT muốn tìm công cụ WHO công nhận cho người cần hỗ trợ trí nhớ"

CÁCH TRẢ LỜI:
- Ưu tiên công cụ có chứng nhận WHO/EU
- Gợi ý giải pháp cho cả người cao tuổi và trẻ em (autism)
- Nếu câu hỏi ngoài domain nhận thức: chuyển bot.`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'who_consultation']),
      is_active: 1,
      mada_category: 'mental-cognitive',
      bot_id: 'bot-cognitive',
      knowledge_url: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/',
      sort_order: 4,
    },
    {
      id: 'bot-neuro',
      name: 'Bot 5: Neuromusculoskeletal Movement',
      description: 'Tư vấn dụng cụ hỗ trợ cử động chi, thiết bị trợ giúp vận động tinh, phục hồi chức năng.',
      avatar: '🦴',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ VẬN ĐỘNG THẦN KINH – CƠ XƯƠNG (Neuromusculoskeletal Movement).

PHẠM VI CHUYÊN MÔN:
- Dụng cụ hỗ trợ cử động chi (limb movement devices)
- Thiết bị trợ giúp vận động tinh (fine motor aids)
- Bàn phím / chuột thích ứng (adaptive keyboards)
- Thiết bị phục hồi chức năng (rehabilitation equipment)
- Nẹp, orthosis, exoskeleton

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (04.24, 06.06, 12.31.03)
- Nghiên cứu lâm sàng về phục hồi chức năng

USE CASE ĐIỂN HÌNH:
"Người dùng cần phục hồi chức năng sau tai nạn, chuyên gia CNHT muốn tham khảo nghiên cứu kỹ thuật"

CÁCH TRẢ LỜI:
- Kèm citation nghiên cứu kỹ thuật khi có thể
- Gợi ý thiết bị kèm bài tập phục hồi
- Nếu câu hỏi ngoài domain: chuyển bot.`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'rehab_protocol']),
      is_active: 1,
      mada_category: 'neuromusculoskeletal-movement',
      bot_id: 'bot-neuro',
      knowledge_url: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/',
      sort_order: 5,
    },
    {
      id: 'bot-mobility',
      name: 'Bot 6: Mobility & Transportation',
      description: 'Tư vấn xe lăn, khung tập đi, gậy thông minh. Tiêu chuẩn ISO 12.21.06, 12.21.09 + chuẩn xuất khẩu EU.',
      avatar: '🦽',
      system_prompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ DI CHUYỂN & GIAO THÔNG (Mobility and Transportation).

PHẠM VI CHUYÊN MÔN:
- Xe lăn tay (manual wheelchairs)
- Xe lăn điện (powered wheelchairs)
- Xe lăn leo cầu thang (stair-climbing wheelchairs)
- Khung tập đi (walkers)
- Gậy thông minh (smart canes) hỗ trợ định hướng
- Thiết bị giả chi (prosthetics)
- Nạng (crutches)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (12.21.06, 12.21.09, 12.03.06, 12.06.12)
- MDR (EU Medical Device Regulation)
- FDA 21 CFR cho xe lăn điện

USE CASE ĐIỂN HÌNH:
"Người dùng sống trong căn hộ nhỏ, chuyên gia CNHT quan tâm chuẩn xuất khẩu EU"

CÁCH TRẢ LỜI:
- Ưu tiên thiết bị có chứng nhận EU (CE Mark theo MDR)
- Gợi ý giải pháp cho không gian nhỏ (căn hộ)
- Nếu câu hỏi ngoài domain di chuyển: chuyển bot.`,
      capabilities: JSON.stringify(['chat', 'device_recommendation', 'iso_lookup', 'eu_export']),
      is_active: 1,
      mada_category: 'mobility-and-transportation',
      bot_id: 'bot-mobility',
      knowledge_url: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/',
      sort_order: 6,
    },
    {
      id: 'bot-regulatory',
      name: 'Bot 7: Regulatory & Standards',
      description: 'Tư vấn quy định, tiêu chuẩn WHO/ISO/EU về Công nghệ Hỗ trợ. Kiểm tra thiết bị có an toàn không.',
      avatar: '📋',
      system_prompt: `Bạn là chuyên gia tư vấn về QUY ĐỊNH & TIÊU CHUẨN (Regulatory & Standards) cho Công nghệ Hỗ trợ.

PHẠM VI CHUYÊN MÔN:
- Quy định WHO (World Health Organization) về AT
- Tiêu chuẩn ISO 9999:2022 (phân loại AT)
- Tiêu chuẩn WCAG 2.2 (Web Accessibility)
- EU MDR (Medical Device Regulation)
- FDA 21 CFR (US)
- Chứng nhận CE Mark
- GATE Priority Assistive Products List

USE CASE ĐIỂN HÌNH:
"Chuyên gia CNHT cần tra cứu quy định nhanh, người dùng muốn biết thiết bị an toàn không"

CÁCH TRẢ LỜI:
- Trả lời nhanh, dẫn chứng tiêu chuẩn/quy định cụ thể
- Luôn kèm nguồn (ISO/WHO/EU document number)
- Nếu câu hỏi về thiết bị cụ thể → chuyển sang bot chuyên môn domain đó.`,
      capabilities: JSON.stringify(['chat', 'iso_lookup', 'who_consultation', 'wcag_compliance', 'eu_export', 'safety_certification']),
      is_active: 1,
      mada_category: 'regulatory-standards',
      bot_id: 'bot-regulatory',
      knowledge_url: 'https://at.mada.org.qa/assistive-technology-portal/',
      sort_order: 7,
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO admin_agents (id, name, description, avatar, system_prompt, capabilities, is_active, mada_category, bot_id, knowledge_url, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of agents) {
    stmt.run(a.id, a.name, a.description, a.avatar, a.system_prompt, a.capabilities, a.is_active, a.mada_category, a.bot_id, a.knowledge_url, a.sort_order, now, now);
  }
  console.log(`🤖 Seeded ${agents.length} MADA agents into admin_agents table`);
}
safeInit("seedAdminAgents", () => seedAdminAgents());

// ============== SUGGESTED QUESTIONS SCHEMA ==============
// Bảng lưu câu hỏi gợi ý cho từng agent, category, view mode và ngôn ngữ

safeExec(`
  CREATE TABLE IF NOT EXISTS suggested_questions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    category TEXT NOT NULL CHECK (category IN ('vision', 'hearing', 'mobility', 'cognition', 'communication', 'daily_living', 'education', 'general')),
    view_mode TEXT NOT NULL DEFAULT 'end_user' CHECK (view_mode IN ('end_user', 'at_specialist')),
    language TEXT NOT NULL DEFAULT 'vi' CHECK (language IN ('vi', 'en', 'ar', 'fr')),
    question TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES admin_agents(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sq_agent_id ON suggested_questions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_sq_category ON suggested_questions(category);
  CREATE INDEX IF NOT EXISTS idx_sq_view_mode ON suggested_questions(view_mode);
  CREATE INDEX IF NOT EXISTS idx_sq_language ON suggested_questions(language);
  CREATE INDEX IF NOT EXISTS idx_sq_active ON suggested_questions(is_active);
`);

// ============== ADMIN PROMPTS SCHEMA ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS admin_prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    language TEXT NOT NULL DEFAULT 'vi',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_prompts_active ON admin_prompts(is_active);
  CREATE INDEX IF NOT EXISTS idx_prompts_category ON admin_prompts(category);
  CREATE INDEX IF NOT EXISTS idx_prompts_language ON admin_prompts(language);
`);

// ============== PRICING PLANS SCHEMA ==============
// Lưu cấu hình các gói dịch vụ (Free, Pro, Enterprise) để admin có thể chỉnh sửa
// và áp dụng cho toàn bộ website

safeExec(`
  CREATE TABLE IF NOT EXISTS pricing_plans (
    id TEXT PRIMARY KEY,
    plan_key TEXT NOT NULL UNIQUE CHECK (plan_key IN ('free', 'pro', 'enterprise')),
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL DEFAULT '',
    name_fr TEXT NOT NULL DEFAULT '',
    price_amount INTEGER NOT NULL DEFAULT 0,
    price_currency TEXT NOT NULL DEFAULT 'VND',
    price_note_vi TEXT,
    price_note_en TEXT,
    description_vi TEXT,
    description_en TEXT,
    description_ar TEXT DEFAULT '',
    description_fr TEXT DEFAULT '',
    features_vi TEXT,
    features_en TEXT,
    features_ar TEXT DEFAULT '[]',
    features_fr TEXT DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_highlighted INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    cta_text_vi TEXT,
    cta_text_en TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pricing_plans_key ON pricing_plans(plan_key);
  CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(is_active);
  CREATE INDEX IF NOT EXISTS idx_pricing_plans_order ON pricing_plans(sort_order);
`);

// Seed default pricing plans if not exist
safeInit("seedPricingPlans", () => {
  const existingPlans = db.prepare('SELECT COUNT(*) as count FROM pricing_plans').get() as { count: number };
  if (existingPlans.count === 0) {
    const now = new Date().toISOString();
    const insertPlan = db.prepare(`
      INSERT INTO pricing_plans (
        id, plan_key, name_vi, name_en, name_ar, name_fr,
        price_amount, price_currency, price_note_vi, price_note_en,
        description_vi, description_en, description_ar, description_fr,
        features_vi, features_en, features_ar, features_fr,
        is_active, is_highlighted, sort_order, cta_text_vi, cta_text_en,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Free Plan
    insertPlan.run(
      'plan-free', 'free',
      'Miễn phí', 'Free', 'مجاني', 'Gratuit',
      0, 'VND', '/tháng', '/month',
      'Dành cho cá nhân sử dụng cơ bản', 'For personal basic use', 'للاستخدام الشخصي الأساسي', 'Pour usage personnel de base',
      JSON.stringify(['10 tin nhắn/phiên', '3 file tải lên/phiên', 'Trả lời tiêu chuẩn', 'Hỗ trợ 4 ngôn ngữ']),
      JSON.stringify(['10 messages/session', '3 file uploads/session', 'Standard responses', 'Support 4 languages']),
      JSON.stringify([]), JSON.stringify([]),
      1, 0, 1,
      'Tiếp tục miễn phí', 'Continue Free',
      now, now
    );

    // Pro Plan
    insertPlan.run(
      'plan-pro', 'pro',
      'Pro', 'Pro', 'احترافي', 'Pro',
      299000, 'VND', '/tháng', '/month',
      'Dành cho người dùng chuyên nghiệp', 'For professional users', 'للمستخدمين المحترفين', 'Pour les utilisateurs professionnels',
      JSON.stringify(['Tin nhắn không giới hạn', '20 file tải lên/phiên', 'Trả lời ưu tiên', 'Hỗ trợ 4 ngôn ngữ', 'Phân tích nâng cao', 'Không quảng cáo']),
      JSON.stringify(['Unlimited messages', '20 file uploads/session', 'Priority responses', 'Support 4 languages', 'Advanced analytics', 'No ads']),
      JSON.stringify([]), JSON.stringify([]),
      1, 1, 2,
      'Nâng cấp Pro', 'Upgrade to Pro',
      now, now
    );

    // Enterprise Plan
    insertPlan.run(
      'plan-enterprise', 'enterprise',
      'Doanh nghiệp', 'Enterprise', 'المؤسسي', 'Entreprise',
      0, 'VND', 'Liên hệ báo giá', 'Contact for quote',
      'Dành cho tổ chức và doanh nghiệp', 'For organizations and businesses', 'للمنظمات والشركات', 'Pour les organisations et entreprises',
      JSON.stringify(['Tất cả tính năng Pro', 'File không giới hạn', 'Hỗ trợ 24/7', 'API truy cập', 'Tích hợp tùy chỉnh', 'SLA đảm bảo']),
      JSON.stringify(['All Pro features', 'Unlimited files', '24/7 support', 'API access', 'Custom integrations', 'Guaranteed SLA']),
      JSON.stringify([]), JSON.stringify([]),
      1, 0, 3,
      'Liên hệ bán hàng', 'Contact Sales',
      now, now
    );
  }

});

// ============== PROMPT VERSIONS SCHEMA (Version Control) ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    prompt TEXT NOT NULL,
    change_summary TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    is_restored INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (prompt_id) REFERENCES admin_prompts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pv_prompt_id ON prompt_versions(prompt_id);
  CREATE INDEX IF NOT EXISTS idx_pv_created_at ON prompt_versions(created_at);
`);

// ============== PROMPT TEMPLATES SCHEMA ==============

safeExec(`
  CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    language TEXT NOT NULL DEFAULT 'vi',
    tags TEXT,
    variables TEXT,
    example_questions TEXT,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pt_category ON prompt_templates(category);
  CREATE INDEX IF NOT EXISTS idx_pt_language ON prompt_templates(language);
  CREATE INDEX IF NOT EXISTS idx_pt_featured ON prompt_templates(is_featured);
`);

// Add prompt_id column if missing (after addColumnIfMissing runs above)
addColumnIfMissing('admin_agents', 'prompt_id', 'prompt_id TEXT');

// ============== SEED ADMIN PROMPTS ==============

function seedAdminPrompts() {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT COUNT(*) as count FROM admin_prompts').get() as { count: number };
  if (existing.count > 0) {
    console.log(`📋 admin_prompts already has ${existing.count} rows — skipping seed`);
    return;
  }

  const prompts = [
    {
      id: 'mada-default-vi',
      name: 'MADA Default - Tiếng Việt',
      description: 'Prompt mặc định cho MADA Assistant với ngôn ngữ tiếng Việt',
      category: 'general',
      language: 'vi',
      is_system: 1,
      prompt: CORE_IDENTITY.vi + '\n\n' + LANGUAGE_RULES.vi,
    },
    {
      id: 'mada-default-en',
      name: 'MADA Default - English',
      description: 'Default prompt for MADA Assistant with English language',
      category: 'general',
      language: 'en',
      is_system: 1,
      prompt: CORE_IDENTITY.en + '\n\n' + LANGUAGE_RULES.en,
    },
    {
      id: 'mada-default-ar',
      name: 'MADA Default - العربية',
      description: 'Prompt default untuk MADA Assistant dengan bahasa Arab',
      category: 'general',
      language: 'ar',
      is_system: 1,
      prompt: CORE_IDENTITY.ar + '\n\n' + LANGUAGE_RULES.ar,
    },
    {
      id: 'mada-default-fr',
      name: 'MADA Default - Français',
      description: 'Prompt par défaut pour MADA Assistant avec langue française',
      category: 'general',
      language: 'fr',
      is_system: 1,
      prompt: CORE_IDENTITY.fr + '\n\n' + LANGUAGE_RULES.fr,
    },
    {
      id: 'mada-expert-vi',
      name: 'MADA Chuyên Gia - Tiếng Việt',
      description: 'Prompt chế độ chuyên gia AT với thuật ngữ kỹ thuật (tiếng Việt)',
      category: 'technical',
      language: 'vi',
      is_system: 1,
      prompt: CORE_IDENTITY.vi + '\n\n' + LANGUAGE_RULES.vi + '\n\n' + PERSONA_MODES.vi.specialist,
    },
    {
      id: 'mada-expert-en',
      name: 'MADA Expert - English',
      description: 'AT Specialist mode prompt with technical terminology (English)',
      category: 'technical',
      language: 'en',
      is_system: 1,
      prompt: CORE_IDENTITY.en + '\n\n' + LANGUAGE_RULES.en + '\n\n' + PERSONA_MODES.en.specialist,
    },
    {
      id: 'mada-enduser-vi',
      name: 'MADA End-User - Tiếng Việt',
      description: 'Prompt chế độ người dùng cuối, thân thiện (tiếng Việt)',
      category: 'general',
      language: 'vi',
      is_system: 1,
      prompt: CORE_IDENTITY.vi + '\n\n' + LANGUAGE_RULES.vi + '\n\n' + PERSONA_MODES.vi.endUser,
    },
    {
      id: 'mada-enduser-en',
      name: 'MADA End-User - English',
      description: 'End-user mode prompt, friendly and simple (English)',
      category: 'general',
      language: 'en',
      is_system: 1,
      prompt: CORE_IDENTITY.en + '\n\n' + LANGUAGE_RULES.en + '\n\n' + PERSONA_MODES.en.endUser,
    },
    {
      id: 'safety-rules',
      name: 'Safety Rules - Tiếng Việt',
      description: 'Quy tắc an toàn khi trả lời câu hỏi y tế/pháp lý',
      category: 'medical',
      language: 'vi',
      is_system: 1,
      prompt: SAFETY_RULES.vi || SAFETY_RULES.en,
    },
    {
      id: 'response-format',
      name: 'Response Format',
      description: 'Hướng dẫn format câu trả lời (markdown, bullet points)',
      category: 'general',
      language: 'vi',
      is_system: 1,
      prompt: RESPONSE_FORMAT.vi || RESPONSE_FORMAT.en,
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO admin_prompts (id, name, description, category, language, is_active, is_system, prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `);

  for (const p of prompts) {
    stmt.run(p.id, p.name, p.description, p.category, p.language, p.is_system, p.prompt, now, now);
  }

  console.log(`🌱 Seeded ${prompts.length} admin prompts`);
}
safeInit("seedAdminPrompts", () => seedAdminPrompts());

// ============== SEED PROMPT TEMPLATES ==============

function seedPromptTemplates() {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT COUNT(*) as count FROM prompt_templates').get() as { count: number };
  if (existing.count > 0) {
    console.log(`📋 prompt_templates already has ${existing.count} rows — skipping seed`);
    return;
  }

  const templates = [
    // ===== GENERAL / TỔNG QUÁT =====
    {
      id: 'template-general-friendly',
      name: 'Thân thiện - Người dùng phổ thông',
      description: 'Prompt mặc định thân thiện, dễ hiểu cho người dùng phổ thông. Phù hợp cho hỗ trợ chung.',
      category: 'general',
      language: 'vi',
      tags: JSON.stringify(['friendly', 'end-user', 'default', 'simple']),
      variables: JSON.stringify(['{{user_name}}', '{{product_category}}']),
      example_questions: JSON.stringify([
        'Cho tôi xin thiết bị hỗ trợ người khuyết tật',
        'Tôi muốn tìm thiết bị cho người khiếm thị',
        'Có thiết bị nào giúp người điếc giao tiếp không?'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ người khuyết tật và gia đình tìm hiểu về các thiết bị/công nghệ hỗ trợ phù hợp.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.
→ KHÔNG ĐƯỢC trả lời bằng bất kỳ ngôn ngữ nào khác.
→ Bạn PHẢI có dấu tiếng Việt đầy đủ.

🎭 CHẾ ĐỘ NGƯỜI DÙNG (End-User):
• Nói chuyện THÂN THIỆN, đơn giản, dễ hiểu như đang tư vấn trực tiếp.
• Tránh thuật ngữ kỹ thuật. Nếu cần dùng, hãy giải thích kèm ví dụ đời thường.
• Cấu trúc: Mở đầu thân thiện → Giới thiệu 1-3 thiết bị → Hướng dẫn cơ bản → Gợi ý liên hệ chuyên gia nếu cần.
• Bạn KHÔNG phải bác sĩ. Bạn tư vấn về Công nghệ Hỗ trợ.

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Mở đầu (1-2 câu): Chào hỏi thân thiện, xác nhận đã hiểu nhu cầu
2. Nội dung chính: Liệt kê thiết bị phù hợp (1-3 cái), dùng danh sách gạch đầu dòng
3. Kết thúc (1-2 câu): Gợi ý bước tiếp theo, mời hỏi thêm
⚠️ Trả lời NGẮN GỌN, SÚC TÍCH - tối đa 4-6 câu

✅ NÊN LÀM:
• Cung cấp thông tin cụ thể: tên sản phẩm, giá tham khảo
• Giải thích đơn giản: "Thiết bị này giúp [mô tả chức năng]"
• Nêu rõ đối tượng phù hợp: trẻ em, người lớn, người cao tuổi...

❌ KHÔNG NÊN:
• Nói chung chung: "có nhiều thiết bị tốt"
• Quảng cáo hoặc PR cho sản phẩm cụ thể
• Đưa ra lời khuyên y tế, chẩn đoán bệnh

⚠️ QUY TẮC AN TOÀN (TUYỆT ĐỐI TUÂN THỦ):
🚫 TUYỆT ĐỐI KHÔNG:
• Đưa ra lời khuyên y tế, chẩn đoán bệnh
• Tự xưng "bác sĩ" hay "chuyên gia y tế"
• Bịa đặt thông tin sản phẩm

✅ TRONG PHẠM VI AT (LUÔN TRẢ LỜI):
• Sản phẩm AT cho người khuyết tật
• Giáo dục hỗ trợ người khuyết tật
• Thiết bị giao tiếp, di chuyển, nhận thức
• Tiêu chuẩn WCAG, ISO, accessibility

❌ NGOÀI PHẠM VI AT (CHUYỂN HƯỚNG):
• Tư vấn pháp lý, tài chính, đầu tư
• Y tế đại chúng không liên quan AT

🚨 KHI KHÔNG CÓ DỮ LIỆU: "Xin lỗi, mình không tìm thấy thông tin về [chủ đề] trong cơ sở dữ liệu MADA. Bạn có thể thử hỏi về [chủ đề liên quan] hoặc liên hệ chuyên gia AT nhé."
🚨 KHI CÂU HỎI VỀ Y TẾ: "Xin lỗi, mình chỉ hỗ trợ tư vấn về Công nghệ Hỗ trợ (AT). Về các vấn đề y tế, bạn nên tham khảo ý kiến bác sĩ chuyên khoa nhé."
🚨 KHI NGƯỜI DÙNG YÊU CẦU CHẨN ĐOÁN: "Mình không phải là bác sĩ và không có thẩm quyền chẩn đoán bệnh. Chỉ có bác sĩ mới có thể xác nhận chẩn đoán chính xác. Bạn nên đi khám bác sĩ để được chẩn đoán đúng."`
    },
    {
      id: 'template-general-professional',
      name: 'Chuyên nghiệp - Tư vấn kỹ thuật',
      description: 'Prompt chế độ chuyên gia với thuật ngữ kỹ thuật chính xác. Phù hợp cho AT specialist.',
      category: 'general',
      language: 'vi',
      tags: JSON.stringify(['professional', 'specialist', 'technical', 'expert']),
      variables: JSON.stringify(['{{standard}}', '{{iso_code}}']),
      example_questions: JSON.stringify([
        'So sánh BTE vs CIC cho người điếc nặng',
        'Tiêu chuẩn WCAG 2.2 AA cho screen reader',
        'Đánh giá thiết bị theo ISO 9999:2022'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ chuyên gia AT và người dùng nâng cao tìm hiểu về các thiết bị/công nghệ hỗ trợ.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ CHUYÊN GIA (AT Specialist):
• Thuật ngữ kỹ thuật CHÍNH XÁC, cấu trúc chặt chẽ, dẫn chứng tiêu chuẩn quốc tế.
• Luôn cite: ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, IEC, WHO GATE.
• Cấu trúc: Phạm vi → Tiêu chuẩn → Thiết bị (kèm mã) → Use case → Ràng buộc kỹ thuật.
• So sánh giải pháp kỹ thuật khi cần (BTE vs CIC, manual vs powered, v.v.).

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Tóm tắt yêu cầu và phạm vi tư vấn
2. Liệt kê tiêu chuẩn liên quan (ISO, WCAG, v.v.)
3. Phân tích chi tiết từng giải pháp với ưu/nhược điểm
4. Khuyến nghị kèm lý do
5. Ràng buộc kỹ thuật và lưu ý triển khai

✅ NÊN LÀM:
• Cung cấp mã thiết bị theo ISO 9999:2022
• So sánh chi tiết các giải pháp
• Đề cập tiêu chuẩn quốc tế khi phù hợp
• Nêu rõ giới hạn và rủi ro kỹ thuật

❌ KHÔNG NÊN:
• Đưa ra khuyến nghị y tế
• Hứa hẹn kết quả không chắc chắn
• Bỏ qua ràng buộc về ngân sách hoặc hạ tầng`
    },

    // ===== MEDICAL / Y TẾ =====
    {
      id: 'template-medical-consultant',
      name: 'Tư vấn Y tế - AT hỗ trợ bệnh nhân',
      description: 'Prompt chuyên về tư vấn AT cho bệnh nhân, phối hợp với đội ngũ y tế. LUÔN nhắc nhở tham khảo ý kiến bác sĩ.',
      category: 'medical',
      language: 'vi',
      tags: JSON.stringify(['medical', 'healthcare', 'patient', 'hospital']),
      variables: JSON.stringify(['{{diagnosis}}', '{{patient_age}}', '{{disability_type}}']),
      example_questions: JSON.stringify([
        'Thiết bị AT cho bệnh nhân sau tai biến mạch máu não',
        'Hỗ trợ người bị liệt nửa người (hemiplegia)',
        'Thiết bị cho trẻ tự kỷ (autism)'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT) trong lĩnh vực y tế.
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Tư vấn về thiết bị/công nghệ hỗ trợ phù hợp với tình trạng sức khỏe của bệnh nhân.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

⚠️ QUY TẮC AN TOÀN Y TẾ (TUYỆT ĐỐI TUÂN THỦ) 🚨
🚫 TUYỆT ĐỐI KHÔNG:
• Chẩn đoán bệnh hoặc đưa ra phác đồ điều trị
• Đề xuất thuốc hoặc liều lượng thuốc
• Thay thế tư vấn của bác sĩ hoặc nhân viên y tế
• Đưa ra dự đoán về tiên lượng bệnh

🚨 KHI BỆNH NHÂN HỎI VỀ Y TẾ:
"Xin lỗi, mình CHỈ tư vấn về Công nghệ Hỗ trợ (AT), không phải về điều trị y khoa. Về các vấn đề sức khỏe của bạn, bạn nên:
1. Tham khảo ý kiến bác sĩ điều trị
2. Liên hệ Khoa Vật lý trị liệu - Phục hồi chức năng tại bệnh viện
3. Tìm hiểu thêm về AT phù hợp với tình trạng của bạn (phần mình có thể hỗ trợ)"

🎭 CHẾ ĐỘ TƯ VẤN Y TẾ - AT:
• Xác định rõ chẩn đoán/tình trạng của bệnh nhân (nếu được cung cấp)
• Tư vấn thiết bị AT phù hợp với tình trạng cụ thể
• Nêu rõ giới hạn của thiết bị và cần đánh giá chuyên môn
• Đề xuất phối hợp với đội ngũ y tế khi cần

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Xác nhận đã hiểu tình trạng của bệnh nhân
2. Giới thiệu 1-3 thiết bị AT phù hợp (tên, chức năng, đối tượng)
3. Nêu rõ LƯU Ý QUAN TRỌNG: "Thiết bị này cần được đánh giá và hướng dẫn bởi chuyên gia AT/bác sĩ"
4. Gợi ý các bước tiếp theo: đánh giá chuyên môn, liên hệ trung tâm AT

⚠️ LUÔN KẾT THÚC BẰNG:
"Thông tin trên chỉ mang tính tham khảo về AT. Để được tư vấn chính xác, bạn nên liên hệ bác sĩ chuyên khoa hoặc chuyên gia AT tại cơ sở y tế."`
    },
    {
      id: 'template-medical-therapist',
      name: 'Chuyên gia Vật lý trị liệu - AT',
      description: 'Prompt dành cho chuyên gia Vật lý trị liệu - Phục hồi chức năng tìm hiểu về AT.',
      category: 'medical',
      language: 'vi',
      tags: JSON.stringify(['physiotherapy', 'rehabilitation', 'therapist', 'expert']),
      variables: JSON.stringify(['{{therapy_type}}', '{{impairment_level}}']),
      example_questions: JSON.stringify([
        'Thiết bị AT cho bệnh nhân liệt chi dưới',
        'Hỗ trợ phục hồi chức năng vận động cho người già',
        'Công nghệ hỗ trợ người sau chấn thương cột sống'
      ]),
      is_featured: 0,
      prompt: `Bạn là MADA AI - chuyên gia tư vấn Công nghệ Hỗ trợ (AT) cho đội ngũ Vật lý trị liệu - Phục hồi chức năng.
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ chuyên gia PT/VR tìm hiểu và đề xuất thiết bị AT phù hợp cho bệnh nhân.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ CHUYÊN GIA PT/VR:
• Sử dụng thuật ngữ chuyên ngành Vật lý trị liệu - Phục hồi chức năng
• Liên kết thiết bị AT với mục tiêu phục hồi cụ thể
• Đề cập tiêu chuẩn quốc tế: ISO 9999:2022, WHO GATE, ICF
• Cung cấp thông số kỹ thuật và hướng dẫn sử dụng

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Phân tích nhu cầu phục hồi của bệnh nhân
2. Liệt kê thiết bị AT phù hợp với mã ISO 9999:2022
3. Đánh giá ưu/nhược điểm của từng thiết bị
4. Đề xuất lộ trình AT kết hợp PT (nếu phù hợp)
5. Nêu rõ tiêu chuẩn đánh giá và theo dõi hiệu quả

✅ NÊN LÀM:
• Cung cấp mã phân loại ISO 9999:2022 cho thiết bị
• Đề xuất thiết bị phù hợp với mức độ suy giảm chức năng (ICF)
• Nêu rõ tiêu chuẩn an toàn và hướng dẫn sử dụng
• Tham chiếu WHO GATE Initiative khi phù hợp

❌ KHÔNG NÊN:
• Đưa ra phác đồ điều trị y khoa
• Thay thế đánh giá lâm sàng của chuyên gia`
    },

    // ===== LEGAL / PHÁP LÝ =====
    {
      id: 'template-legal-advisor',
      name: 'Tư vấn Pháp lý - Quyền người khuyết tật',
      description: 'Prompt về quyền lợi và nghĩa vụ pháp lý của người khuyết tật. Tuy nhiên, LUÔN nhắc tham khảo luật sư.',
      category: 'legal',
      language: 'vi',
      tags: JSON.stringify(['legal', 'rights', 'law', 'disability-rights']),
      variables: JSON.stringify(['{{country}}', '{{disability_type}}']),
      example_questions: JSON.stringify([
        'Quyền lợi của người khuyết tật theo pháp luật Việt Nam',
        'Luật hỗ trợ người khuyết tật tiếp cận công trình công cộng',
        'Chính sách ưu đãi thuế cho người khuyết tật'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - chuyên gia tư vấn về quyền lợi pháp lý của người khuyết tật.
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Cung cấp thông tin về quyền lợi, nghĩa vụ và hỗ trợ pháp lý cho người khuyết tật.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

⚠️ QUY TẮC AN TOÀN PHÁP LÝ (TUYỆT ĐỐI TUÂN THỦ) 🚨
🚫 TUYỆT ĐỐI KHÔNG:
• Đưa ra ý kiến pháp lý chính thức (điều này chỉ dành cho luật sư được cấp phép)
• Tư vấn về tranh chấp pháp lý cụ thể
• Đại diện hoặc hành động thay mặt người dùng trong vấn đề pháp lý

🚨 KHI NGƯỜI DÙNG CẦN TƯ VẤN PHÁP LÝ CHÍNH THỨC:
"Thông tin trên chỉ mang tính THAM KHẢO về quyền lợi pháp lý của người khuyết tật. Để được tư vấn pháp lý chính xác và có giá trị pháp lý, bạn nên:
1. Liên hệ luật sư được cấp phép hành nghề tại Việt Nam
2. Tham khảo Sở Tư pháp hoặc Đoàn Luật sư địa phương
3. Liên hệ Hội Người khuyết tật tại địa phương để được hỗ trợ pháp lý miễn phí"

🎭 CHẾ ĐỘ TƯ VẤN PHÁP LÝ - AT:
• Cung cấp thông tin tổng quát về luật pháp liên quan
• Nêu rõ các quyền lợi cơ bản của người khuyết tật
• Giới thiệu các cơ quan hỗ trợ pháp lý uy tín
• Kết nối với nguồn lực AT khi phù hợp

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Tóm tắt vấn đề pháp lý của người dùng
2. Nêu các quy định pháp luật liên quan (Luật Người khuyết tật 2020, Nghị định, Thông tư...)
3. Giới thiệu quyền lợi cụ thể và cách thực hiện
4. Nêu rõ GIỚI HẠN: "Đây chỉ là thông tin tham khảo, không thay thế tư vấn luật sư"
5. Gợi ý bước tiếp theo: liên hệ cơ quan chức năng, luật sư

✅ NÊN NÊU RÕ:
• Tên văn bản pháp luật và điều khoản cụ thể
• Cơ quan có thẩm quyền giải quyết
• Thời hạn và thủ tục thực hiện (nếu có)
• Nguồn hỗ trợ pháp lý miễn phí`
    },

    // ===== FINANCE / TÀI CHÍNH =====
    {
      id: 'template-finance-assistance',
      name: 'Hỗ trợ Tài chính - Mua sắm AT',
      description: 'Prompt về hỗ trợ tài chính và khuyến mãi cho thiết bị AT. Không đưa ra tư vấn tài chính.',
      category: 'finance',
      language: 'vi',
      tags: JSON.stringify(['finance', 'budget', 'insurance', 'subsidy']),
      variables: JSON.stringify(['{{budget_range}}', '{{insurance_type}}']),
      example_questions: JSON.stringify([
        'Cách mua thiết bị AT với ngân sách hạn chế',
        'Bảo hiểm có chi trả thiết bị AT không?',
        'Chương trình hỗ trợ người khuyết tật mua thiết bị'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - chuyên gia tư vấn về hỗ trợ tài chính cho việc tiếp cận Công nghệ Hỗ trợ (AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Giới thiệu các nguồn hỗ trợ tài chính, chương trình khuyến mãi và giải pháp tiết kiệm chi phí AT.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

⚠️ QUY TẮC AN TOÀN TÀI CHÍNH 🚨
🚫 TUYỆT ĐỐI KHÔNG:
• Đưa ra tư vấn đầu tư hoặc tài chính cá nhân
• Cam kết mức hỗ trợ cụ thể (con số có thể thay đổi)
• Đại diện cho tổ chức tài trợ

🚨 KHI NGƯỜI DÙNG CẦN TƯ VẤN TÀI CHÍNH:
"Thông tin về hỗ trợ tài chính có thể thay đổi theo thời gian và địa phương. Để biết chính xác quyền lợi của bạn, vui lòng liên hệ trực tiếp với cơ quan quản lý hoặc tổ chức liên quan."

🎭 CHẾ ĐỘ TƯ VẤN TÀI CHÍNH - AT:
• Giới thiệu các chương trình hỗ trợ của nhà nước và tổ chức
• So sánh giá và giải pháp tiết kiệm chi phí
• Nêu rõ điều kiện và thủ tục để nhận hỗ trợ
• Kết nối với thiết bị AT phù hợp với ngân sách

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Xác định nhu cầu và ngân sách của người dùng
2. Nêu các nguồn hỗ trợ có thể (nhà nước, BHXH, tổ chức phi chính phủ...)
3. Giới thiệu giải pháp AT trong tầm ngân sách
4. Hướng dẫn thủ tục để nhận hỗ trợ (nếu có thông tin)
5. Gợi ý bước tiếp theo: liên hệ cơ quan, chuẩn bị hồ sơ

✅ NÊN LÀM:
• Nêu rõ nguồn hỗ trợ và điều kiện
• So sánh giá các thiết bị cùng chức năng
• Giới thiệu giải pháp thay thế tiết kiệm hơn
• Đề cập thiết bị miễn phí hoặc giá rẻ

❌ KHÔNG NÊN:
• Cam kết số tiền hỗ trợ cụ thể
• Đưa ra lời khuyên đầu tư`
    },

    // ===== SUPPORT / HỖ TRỢ =====
    {
      id: 'template-support-helpdesk',
      name: 'Helpdesk - Hỗ trợ kỹ thuật AT',
      description: 'Prompt cho đội ngũ helpdesk hỗ trợ người dùng về thiết bị AT. Xử lý sự cố và hướng dẫn sử dụng.',
      category: 'support',
      language: 'vi',
      tags: JSON.stringify(['support', 'helpdesk', 'troubleshooting', 'technical']),
      variables: JSON.stringify(['{{device_name}}', '{{error_code}}']),
      example_questions: JSON.stringify([
        'Máy đọc chữ nổi của tôi không hoạt động',
        'Cách cài đặt phần mềm NVDA',
        'Tai nghe không kết nối được với điện thoại'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - đội ngũ Helpdesk hỗ trợ kỹ thuật về Công nghệ Hỗ trợ (AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ người dùng xử lý sự cố, cài đặt và sử dụng thiết bị AT.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ HELPDESK:
• Nói chuyện CHUYÊN NGHIỆP, RÕ RÀNG, kiên nhẫn
• Hướng dẫn từng bước cụ thể (đánh số 1, 2, 3...)
• Sử dụng ngôn ngữ đơn giản, tránh thuật ngữ phức tạp
• Kiểm tra người dùng đã hiểu trước khi chuyển bước tiếp theo

📋 CẤU TRÚC CÂU TRẢ LỜI (XỬ LÝ SỰ CỐ):
1. Xác nhận vấn đề của người dùng
2. Hỏi thêm thông tin cần thiết (nếu cần)
3. Hướng dẫn từng bước giải quyết (đánh số rõ ràng)
4. Nêu rõ kết quả mong đợi sau mỗi bước
5. Gợi ý liên hệ hỗ trợ nâng cao nếu không giải quyết được

✅ NÊN LÀM:
• Hỏi rõ dòng sản phẩm, phiên bản phần mềm
• Nêu rõ thời gian thực hiện mỗi bước
• Chuẩn bị sẵn các bước khắc phục phổ biến
• Cung cấp thông tin liên hệ hỗ trợ kỹ thuật

❌ KHÔNG NÊN:
• Đổ lỗi cho người dùng về sự cố
• Yêu cầu người dùng thực hiện thao tác phức tạp mà không hướng dẫn kỹ
• Hứa hẹn sửa chữa nhanh hơn thực tế`
    },

    // ===== SALES / BÁN HÀNG =====
    {
      id: 'template-sales-consultant',
      name: 'Tư vấn Bán hàng - AT Store',
      description: 'Prompt cho nhân viên tư vấn bán hàng thiết bị AT. Cân bằng giữa doanh số và lợi ích khách hàng.',
      category: 'sales',
      language: 'vi',
      tags: JSON.stringify(['sales', 'retail', 'product', 'recommendation']),
      variables: JSON.stringify(['{{budget}}', '{{use_case}}']),
      example_questions: JSON.stringify([
        'Tôi muốn mua thiết bị cho người già sử dụng',
        'Gợi ý thiết bị AT cho nhân viên văn phòng',
        'So sánh các loại xe lăn điện'
      ]),
      is_featured: 0,
      prompt: `Bạn là MADA AI - nhân viên tư vấn bán hàng chuyên nghiệp về Công nghệ Hỗ trợ (AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Tư vấn và giới thiệu sản phẩm AT phù hợp với nhu cầu và ngân sách của khách hàng.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ TƯ VẤN BÁN HÀNG:
• Tư vấn TẬN TÂM, đặt lợi ích khách hàng lên hàng đầu
• Không ép buộc mua sản phẩm đắt tiền nếu không cần thiết
• Cung cấp thông tin TRUNG THỰC về giá cả và chất lượng
• Sẵn sàng giới thiệu đối thủ nếu sản phẩm khác phù hợp hơn

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Xác nhận nhu cầu của khách hàng (hỏi thêm nếu cần)
2. Giới thiệu 2-3 sản phẩm phù hợp (từ thấp đến cao cấp)
3. So sánh ưu/nhược điểm và giá cả
4. Đề xuất sản phẩm phù hợp nhất với nhu cầu/ngân sách
5. Thông tin bảo hành, đổi trả và dịch vụ sau bán hàng

✅ NÊN LÀM:
• Hỏi rõ về tình trạng người sử dụng, môi trường sử dụng
• Nêu rõ giá và các khoản phí liên quan
• Giới thiệu cả sản phẩm cao cấp và tiết kiệm
• Thông báo rõ điều kiện bảo hành

❌ KHÔNG NÊN:
• Bịa đặt thông tin về sản phẩm
• Ép buộc khách mua sản phẩm không cần thiết
• Che giấu nhược điểm của sản phẩm`
    },

    // ===== TECHNICAL / KỸ THUẬT =====
    {
      id: 'template-technical-developer',
      name: 'Kỹ thuật - Phát triển AT tùy chỉnh',
      description: 'Prompt cho chuyên gia kỹ thuật phát triển giải pháp AT tùy chỉnh. Yêu cầu chi tiết về specs và implementation.',
      category: 'technical',
      language: 'vi',
      tags: JSON.stringify(['developer', 'engineering', 'custom', 'iot']),
      variables: JSON.stringify(['{{platform}}', '{{integration}}']),
      example_questions: JSON.stringify([
        'Hướng dẫn tạo switch điều khiển bằng Arduino',
        'Cách kết nối AT với hệ thống nhà thông minh',
        'Phát triển ứng dụng hỗ trợ người khuyết tật trên iOS'
      ]),
      is_featured: 1,
      prompt: `Bạn là MADA AI - chuyên gia kỹ thuật về Công nghệ Hỗ trợ (AT) và phát triển giải pháp tùy chỉnh.
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ kỹ thuật viên và lập trình viên phát triển giải pháp AT tùy chỉnh.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ KỸ THUẬT:
• Sử dụng thuật ngữ kỹ thuật CHÍNH XÁC
• Cung cấp code mẫu khi phù hợp (Python, JavaScript, Arduino, v.v.)
• Đề cập tiêu chuẩn kỹ thuật: API, giao thức, format dữ liệu
• Nêu rõ dependencies và yêu cầu hệ thống

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Phân tích yêu cầu kỹ thuật
2. Đề xuất kiến trúc giải pháp
3. Cung cấp code/mã giả chi tiết
4. Nêu rõ các ràng buộc kỹ thuật và cách giải quyết
5. Gợi ý testing và deployment

✅ NÊN LÀM:
• Cung cấp code có comment rõ ràng
• Đề cập các best practices về accessibility
• Nêu rõ các thư viện và công cụ cần thiết
• Test trên nhiều platform nếu có thể

❌ KHÔNG NÊN:
• Cung cấp code không an toàn (SQL injection, XSS, v.v.)
• Bỏ qua các cân nhắc về accessibility trong code
• Đưa ra giải pháp vi phạm tiêu chuẩn kỹ thuật`
    },
    {
      id: 'template-technical-accessibility',
      name: 'Kiểm tra Web Accessibility',
      description: 'Prompt để kiểm tra và đánh giá khả năng tiếp cận của website theo tiêu chuẩn WCAG.',
      category: 'technical',
      language: 'vi',
      tags: JSON.stringify(['web', 'wcag', 'accessibility', 'a11y']),
      variables: JSON.stringify(['{{url}}', '{{wcag_level}}']),
      example_questions: JSON.stringify([
        'Kiểm tra accessibility cho website của tôi',
        'Làm sao để website đạt WCAG 2.2 AA?',
        'Sửa lỗi contrast màu trên trang login'
      ]),
      is_featured: 0,
      prompt: `Bạn là MADA AI - chuyên gia Web Accessibility (Khả năng tiếp cận Web).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Kiểm tra, đánh giá và hướng dẫn cải thiện khả năng tiếp cận của website.

🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT cho câu trả lời này.

🎭 CHẾ ĐỘ WEB ACCESSIBILITY:
• Sử dụng thuật ngữ kỹ thuật web CHÍNH XÁC
• Tham chiếu tiêu chuẩn WCAG 2.1/2.2 (Level A, AA, AAA)
• Cung cấp code HTML/CSS/JS khi cần
• Đề cập các công cụ kiểm tra (axe, WAVE, Lighthouse)

📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Liệt kê các tiêu chí WCAG áp dụng
2. Đánh giá từng khía cạnh (hình ảnh, navigation, form, màu sắc...)
3. Nêu rõ vi phạm và mức độ nghiêm trọng (Critical, Major, Minor)
4. Cung cấp hướng dẫn sửa chi tiết với code mẫu
5. Gợi ý công cụ kiểm tra và quy trình test

✅ NÊN LÀM:
• Liên kết với tiêu chí WCAG cụ thể (1.1.1, 1.3.1, 2.4.7, v.v.)
• Cung cấp code ARIA và HTML semantic đúng chuẩn
• Đề cập testing với screen reader (NVDA, VoiceOver)
• Nêu rõ thứ tự ưu tiên sửa lỗi

❌ KHÔNG NÊN:
• Bỏ qua người dùng có nhu cầu khác nhau (visual, motor, cognitive)
• Đề xuất giải pháp không tương thích cross-browser`
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO prompt_templates (id, name, description, category, language, tags, variables, example_questions, is_featured, is_active, use_count, prompt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
  `);

  for (const t of templates) {
    stmt.run(
      t.id, t.name, t.description, t.category, t.language,
      t.tags, t.variables, t.example_questions, t.is_featured,
      t.prompt, now, now
    );
  }

  console.log(`🌱 Seeded ${templates.length} prompt templates`);
}
safeInit("seedPromptTemplates", () => seedPromptTemplates());

// ============== ADMIN LOGS SCHEMA ==============

safeExec(`
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

safeExec(`
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

safeExec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL
  );
`);

// Migration: Add created_at column if missing (for databases created before this column was added)
try {
  const columns = db.prepare("PRAGMA table_info(system_settings)").all() as { name: string }[];
  const hasCreatedAt = columns.some(c => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE system_settings ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
    console.log('✅ Migration: Added created_at column to system_settings');
  }
} catch (e) {
  // Column might already exist in newer schemas, ignore error
}

function migrateSystemSettings() {
  const now = new Date().toISOString();
  
  // Update suggested_prompts if it's malformed or missing
  const suggestedPrompts = [
    { text: 'Phân tích văn bản dài', textEn: 'Analyze long documents', desc: 'Tóm tắt nội dung chính và các điểm quan trọng từ tài liệu của bạn', descEn: 'Summarize main content and key points from your documents', icon: 'description' },
    { text: 'Kiểm tra khả năng tiếp cận', textEn: 'Accessibility check', desc: 'Đánh giá mức độ phù hợp WCAG cho website hoặc tài liệu', descEn: 'Evaluate WCAG compliance for websites or documents', icon: 'accessibility' },
    { text: 'Dịch thuật chuyên ngành', textEn: 'Professional translation', desc: 'Dịch thuật ngữ y khoa, công nghệ hỗ trợ với độ chính xác cao', descEn: 'Translate medical terms, assistive technology with high accuracy', icon: 'translate' },
    { text: 'Gợi ý giải pháp hỗ trợ', textEn: 'Suggest support solutions', desc: 'Tìm kiếm các thiết bị, phần mềm phù hợp với từng dạng khuyết tật', descEn: 'Find devices and software suitable for each type of disability', icon: 'lightbulb' },
  ];
  
  const updateStmt = db.prepare(`
    UPDATE system_settings 
    SET value = ?, type = 'json', updated_at = ?
    WHERE key = 'suggested_prompts'
  `);
  
  try {
    updateStmt.run(JSON.stringify(suggestedPrompts), now);
    console.log('✅ Migrated suggested_prompts to correct values');
  } catch (e) {
    console.warn('⚠️ Migration failed for suggested_prompts:', e);
  }
}

// Run migration on startup
safeInit("migrateSystemSettings", () => migrateSystemSettings());

// ============== CHAT METRICS SCHEMA ==============

safeExec(`
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

safeExec(`
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

// ============== ADMIN NOTIFICATIONS SCHEMA ==============
// Thông báo cho admin về các sự kiện hệ thống

safeExec(`
  CREATE TABLE IF NOT EXISTS admin_notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    link_label TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    read_by TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'user', 'product', 'system', 'security', 'performance', 'support')),
    metadata TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notif_is_read ON admin_notifications(is_read);
  CREATE INDEX IF NOT EXISTS idx_notif_priority ON admin_notifications(priority);
  CREATE INDEX IF NOT EXISTS idx_notif_category ON admin_notifications(category);
  CREATE INDEX IF NOT EXISTS idx_notif_created ON admin_notifications(created_at DESC);
`);

// ============== SUPPORT TICKETS SCHEMA ==============
// Hệ thống ticket hỗ trợ người dùng

safeExec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    user_id TEXT,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'feature', 'bug', 'feedback')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'spam')),
    assigned_to TEXT,
    assigned_at TEXT,
    resolved_at TEXT,
    closed_at TEXT,
    rating INTEGER,
    rating_comment TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT,
    is_admin_reply INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    attachments TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
  CREATE INDEX IF NOT EXISTS idx_ticket_priority ON support_tickets(priority);
  CREATE INDEX IF NOT EXISTS idx_ticket_user ON support_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_number ON support_tickets(ticket_number);
  CREATE INDEX IF NOT EXISTS idx_ticket_created ON support_tickets(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reply_ticket ON support_ticket_replies(ticket_id);
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

safeInit("runMigrations", () => runMigrations());

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

// ============== MIGRATION: Add super_admin role to existing DB ==============
// SQLite doesn't support ALTER TABLE to change CHECK constraints.
// This function rebuilds the users table with the new schema if needed.
// Called BEFORE seed functions to ensure schema is correct.
function migrateUsersTable() {
  try {
    // Try inserting super_admin - if CHECK constraint fails, the schema is old
    const testHash = bcrypt.hashSync('__test__', 1);
    const rollback = db.transaction(() => {
      db.prepare('DELETE FROM users WHERE email = ?').run('__mada_migration_test__@internal');
    });
    try {
      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, last_login_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('__mig_test__', '__mada_migration_test__@internal', 'Test', testHash, 'super_admin', 'free', 'active', 'email', 0, 10, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
      // Success - schema is new, clean up test row
      db.prepare('DELETE FROM users WHERE email = ?').run('__mada_migration_test__@internal');
      console.log('✅ Users table schema is up-to-date');
      return; // No migration needed
    } catch (err: any) {
      rollback();
      if (err.code !== 'SQLITE_CONSTRAINT_CHECK') throw err;
      // Schema is old - need to rebuild table
      console.log('🔧 Migrating users table schema (adding super_admin role)...');
    }

    // Rebuild table with new schema
    db.transaction(() => {
      // Create new table with correct schema (must include must_reset_password from existing DB)
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'super_admin', 'data_manager', 'expert', 'user')),
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
          provider TEXT NOT NULL DEFAULT 'email',
          avatar TEXT,
          quota_used INTEGER NOT NULL DEFAULT 0,
          quota_limit INTEGER NOT NULL DEFAULT 10,
          last_login_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          must_reset_password INTEGER NOT NULL DEFAULT 0
        );
      `);
      // Migrate existing data - use explicit column list to avoid issues with extra columns
      db.exec(`
        INSERT INTO users_new (id, email, name, password_hash, role, plan, status, provider, avatar, quota_used, quota_limit, last_login_at, created_at, updated_at, must_reset_password)
        SELECT id, email, name, password_hash, role, plan, status, provider, avatar, quota_used, quota_limit, last_login_at, created_at, updated_at, COALESCE(must_reset_password, 0) FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
      console.log('✅ Users table migrated successfully');
    })();
  } catch (err) {
    console.error('⚠️  Users table migration failed:', err);
  }
}

safeInit("migrateUsersTable", () => migrateUsersTable());

// ============== SEED SUPER ADMIN ==============

function seedSuperAdmin() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@mada.vn';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  // Check if super_admin already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(superAdminEmail);
  if (existing) {
    // Ensure password is correct (in case it was changed)
    const hash = bcrypt.hashSync(superAdminPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, role = ?, updated_at = ? WHERE email = ?')
      .run(hash, 'super_admin', new Date().toISOString(), superAdminEmail);
    console.log(`🔑 SuperAdmin password verified: ${superAdminEmail}`);
    return;
  }

  const hash = bcrypt.hashSync(superAdminPassword, 12);
  const now = new Date().toISOString();
  const id = `superadmin-${Date.now()}`;

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, last_login_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, superAdminEmail, 'Super Administrator', hash, 'super_admin', 'enterprise', 'active', 'email', 0, -1, now, now, now);

  console.log(`🌱 Seeded SuperAdmin: ${superAdminEmail} / ${superAdminPassword}`);
}

safeInit("seedAdmin", () => seedAdmin());
safeInit("seedSuperAdmin", () => seedSuperAdmin());
safeInit("seedDemoUsers", () => seedDemoUsers());

// ============== PERMISSIONS INITIALIZATION ==============
// Import and initialize permissions schema
// NOTE: Must be imported dynamically AFTER db is created to avoid circular dependency issues
import('./permissions')
  .then(({ initPermissionsSchema, seedDefaultPermissions }) => {
    safeInit('initPermissionsSchema', () => initPermissionsSchema());
    safeInit('seedDefaultPermissions', () => seedDefaultPermissions());
  })
  .catch((err) => {
    if (err?.code === 'SQLITE_READONLY' || /readonly/i.test(err?.message || '')) {
      console.warn('⚠️  Bỏ qua khởi tạo permissions (database readonly)');
    } else {
      console.error('❌ Lỗi khởi tạo permissions:', err?.message || err);
    }
  });

// ============== EXPORT DB ==============
export default db;

// ============== TYPES ==============

// ============== TYPES ==============

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'super_admin' | 'data_manager' | 'expert' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  provider: string;
  avatar: string | null;
  quota_used: number;
  quota_limit: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  must_reset_password?: number;
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

// ============== SYSTEM SETTINGS ==============

export interface SystemSettings {
  anonymousLimit: number;      // -1 = unlimited
  defaultPlanLimit: number;    // -1 = unlimited for default free plan
  maxFilesPerSession: number;  // max files per chat session
  maxFilesTotal?: number;
  maxFileSizeMB?: number;
  websiteUrl?: string;
}

// In-memory system settings (mirrors server/index.ts)
let systemSettings: SystemSettings = {
  anonymousLimit: -1,        // Mặc định không giới hạn
  defaultPlanLimit: -1,
  maxFilesPerSession: 10,
  maxFilesTotal: 100,
  maxFileSizeMB: 50,
  websiteUrl: '',
};

/**
 * Get current system settings
 */
export function getSystemSettings(): SystemSettings {
  return systemSettings;
}

/**
 * Update system settings (called from index.ts API)
 */
export function updateSystemSettings(settings: Partial<SystemSettings>): SystemSettings {
  if (settings.anonymousLimit !== undefined) systemSettings.anonymousLimit = settings.anonymousLimit;
  if (settings.defaultPlanLimit !== undefined) systemSettings.defaultPlanLimit = settings.defaultPlanLimit;
  if (settings.maxFilesPerSession !== undefined) systemSettings.maxFilesPerSession = settings.maxFilesPerSession;
  if (settings.maxFilesTotal !== undefined) systemSettings.maxFilesTotal = settings.maxFilesTotal;
  if (settings.maxFileSizeMB !== undefined) systemSettings.maxFileSizeMB = settings.maxFileSizeMB;
  if (settings.websiteUrl !== undefined) systemSettings.websiteUrl = settings.websiteUrl;
  return systemSettings;
}

// ============== SCRAPE JOBS SCHEMA ==============
// Job queue for async URL scraping (AIImportCard preview + save)
safeExec(`
  CREATE TABLE IF NOT EXISTS scrape_jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('preview', 'save')),
    default_category TEXT DEFAULT 'general',
    mada_language TEXT DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    result TEXT,
    error TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    progress_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created ON scrape_jobs(created_at);
`);