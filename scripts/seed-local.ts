/**
 * MADA AI Assistant - Comprehensive Local Database Seed
 * =====================================================
 * Idempotent: chạy nhiều lần đều an toàn (INSERT OR IGNORE, COUNT-driven).
 * Chạy: npx tsx scripts/seed-local.ts
 *   hoặc: npm run seed
 *
 * Seed data: 5 users (đủ role), 9 categories, 7 agents, 12 products,
 * suggested_questions, knowledge items, conversations, consultations,
 * support tickets, feedback, audit logs, chat metrics, system logs,
 * admin notifications, scheduled sources, ingestion jobs, favorites.
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---- Config ----
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'mada.db');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

// Hash cho 1 password — tất cả demo user dùng cùng password để test nhanh.
// LƯU Ý: superadmin được entrypoint.sh quản lý riêng (password SuperAdmin@123),
// nên script này KHÔNG ghi đè hash của superadmin.
const DEMO_PASSWORD = 'Mada@2024';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@123';
const PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

console.log('🔧 Seeding database:', DB_PATH);
console.log('   Demo password cho mọi user:', DEMO_PASSWORD);

// ---- Helpers ----
function count(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

/**
 * Insert a user, or if the email already exists, reuse that row's id so that
 * foreign keys from other seeded tables stay valid across repeated runs.
 * Returns the users.id that is now in effect for this email.
 */
function ensureUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  quota_limit: number;
}): string {
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(u.email) as { id: string } | undefined;

  // superadmin do entrypoint.sh quản lý — giữ nguyên password của nó
  if (u.role === 'super_admin') {
    if (existing) return existing.id;
  }

  if (existing) {
    db.prepare(
      `UPDATE users SET name=?, password_hash=?, role=?, plan=?, status='active',
       quota_limit=?, updated_at=? WHERE id=?`
    ).run(u.name, PASSWORD_HASH, u.role, u.plan, u.quota_limit, now(), existing.id);
    return existing.id;
  }

  const t = now();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, plan, status, provider,
       quota_used, quota_limit, last_login_at, created_at, updated_at, must_reset_password)
     VALUES (?,?,?,?,?,?,'active','email',0,?,?,?,?,0)`
  ).run(u.id, u.email, u.name, PASSWORD_HASH, u.role, u.plan, u.quota_limit, hoursAgo(2), daysAgo(30), t);
  return u.id;
}

function insertOrIgnore<T extends Record<string, unknown>>(
  table: string,
  row: T,
  conflictCol: string = 'id'
) {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(',');
  const values = cols.map((c) => {
    const v = row[c];
    return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
  });
  db.prepare(
    `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`
  ).run(...values);
}

function update(table: string, id: string, patch: Record<string, unknown>) {
  const entries = Object.entries(patch);
  if (!entries.length) return;
  const set = entries.map(([k]) => `${k}=?`).join(',');
  const values = entries.map(([, v]) =>
    typeof v === 'object' && v !== null ? JSON.stringify(v) : v
  );
  db.prepare(`UPDATE ${table} SET ${set} WHERE id=?`).run(...values, id);
}

// =====================================================
// 1) USERS — 5 users (super_admin, admin, expert, data_manager, user)
// =====================================================
console.log('\n👥 Seeding users...');
const USERS = [
  {
    id: 'superadmin-001',
    email: 'superadmin@mada.vn',
    name: 'Super Administrator',
    role: 'super_admin',
    plan: 'enterprise',
    quota_limit: -1,
  },
  {
    id: 'admin-001',
    email: 'admin@mada.vn',
    name: 'Nguyễn Văn Quản Trị',
    role: 'admin',
    plan: 'enterprise',
    quota_limit: 10000,
  },
  {
    id: 'expert-001',
    email: 'expert@mada.vn',
    name: 'Trần Thị Chuyên Gia',
    role: 'expert',
    plan: 'enterprise',
    quota_limit: 5000,
  },
  {
    id: 'data_manager-001',
    email: 'data@mada.vn',
    name: 'Lê Hoàng Quản Lý Dữ Liệu',
    role: 'data_manager',
    plan: 'enterprise',
    quota_limit: 5000,
  },
  {
    id: 'user-001',
    email: 'user@mada.vn',
    name: 'Phạm Minh Khách',
    role: 'user',
    plan: 'pro',
    quota_limit: 1000,
  },
];

const USER_IDS: Record<string, string> = {};
for (const u of USERS) {
  USER_IDS[u.role] = ensureUser(u);
}
const UID = {
  superadmin: USER_IDS.super_admin,
  admin: USER_IDS.admin,
  expert: USER_IDS.expert,
  dataManager: USER_IDS.data_manager,
  user: USER_IDS.user,
};
console.log(`   ✓ ${USERS.length} users (ids: ${Object.values(USER_IDS).join(', ')})`);

// =====================================================
// 2) KB CATEGORIES — đầy đủ 9 categories
// =====================================================
console.log('\n📂 Seeding categories...');
const CATEGORIES = [
  { id: 'vision', icon: 'visibility', order: 1, vi: 'Cảm giác – Thị giác', en: 'Sensory – Vision', url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/' },
  { id: 'hearing', icon: 'headphones', order: 2, vi: 'Cảm giác – Thính giác', en: 'Sensory – Hearing', url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/' },
  { id: 'mobility', icon: 'accessible_forward', order: 3, vi: 'Vận động thần kinh', en: 'Mobility & Neuromuscular', url: 'https://at.mada.org.qa/technology-category/body-function/mobility-neuromuscular/' },
  { id: 'cognition', icon: 'psychology', order: 4, vi: 'Tâm thần – Nhận thức', en: 'Cognition', url: 'https://at.mada.org.qa/technology-category/body-function/cognition/' },
  { id: 'communication', icon: 'record_voice_over', order: 5, vi: 'Giọng nói và Lời nói', en: 'Voice & Speech', url: 'https://at.mada.org.qa/technology-category/body-function/voice-speech-communication/' },
  { id: 'daily_living', icon: 'commute', order: 6, vi: 'Di chuyển và Giao thông', en: 'Daily Living & Mobility', url: 'https://at.mada.org.qa/technology-category/daily-living/' },
  { id: 'education', icon: 'school', order: 7, vi: 'Thông tin bổ trợ', en: 'Regulatory & Standards', url: 'https://at.mada.org.qa/assistive-technology-portal/' },
  { id: 'web_accessibility', icon: 'web', order: 8, vi: 'Tiếp cận Web', en: 'Web Accessibility (WCAG)', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
  { id: 'general', icon: 'category', order: 99, vi: 'Tổng quát', en: 'General', url: '' },
];

for (const c of CATEGORIES) {
  const t = now();
  insertOrIgnore('kb_categories', {
    id: c.id,
    name_vi: c.vi,
    name_en: c.en,
    name_ar: c.en,
    name_fr: c.en,
    icon: c.icon,
    sort_order: c.order,
    description_vi: `Danh mục ${c.vi}`,
    description_en: `Category: ${c.en}`,
    description_ar: c.en,
    description_fr: c.en,
    related_url: c.url,
    product_link: c.url,
    created_at: daysAgo(60),
    updated_at: t,
  });
}
console.log(`   ✓ ${CATEGORIES.length} categories`);

// =====================================================
// 3) AGENTS — 7 AI agents (đã có sẵn, bổ sung description, sort_order)
// =====================================================
console.log('\n🤖 Seeding agent metadata...');
const AGENT_ENRICH: Array<{ id: string; cat: string; sort: number }> = [
  { id: 'bot-hearing', cat: 'hearing', sort: 1 },
  { id: 'bot-vision', cat: 'vision', sort: 2 },
  { id: 'bot-cognitive', cat: 'cognition', sort: 3 },
  { id: 'bot-speech', cat: 'communication', sort: 4 },
  { id: 'bot-mobility', cat: 'daily_living', sort: 5 },
  { id: 'bot-neuro', cat: 'mobility', sort: 6 },
  { id: 'bot-regulatory', cat: 'education', sort: 7 },
];
for (const a of AGENT_ENRICH) {
  // Không ghi đè mada_category: server/RAG và UI dùng giá trị chuẩn (vd. 'sensory-hearing')
  update('admin_agents', a.id, { sort_order: a.sort, is_active: 1 });
}
console.log(`   ✓ ${AGENT_ENRICH.length} agents enriched`);

// =====================================================
// 4) SUGGESTED QUESTIONS — đầy đủ 4 ngôn ngữ × 2 view mode
// =====================================================
console.log('\n💬 Seeding suggested questions...');
const SQ_PRESEED = [
  { cat: 'vision', agent: 'bot-vision', vi: 'Phần mềm đọc màn hình nào phù hợp với người khiếm thị hoàn toàn?', en: 'Which screen reader is suitable for a totally blind user?' },
  { cat: 'vision', agent: 'bot-vision', vi: 'Tôi cần kính lúp điện tử cho người già — tiêu chí chọn là gì?', en: 'I need an electronic magnifier for an elderly user — what are the selection criteria?' },
  { cat: 'hearing', agent: 'bot-hearing', vi: 'Máy trợ thính BTE và ITE khác nhau thế nào? Khi nào nên dùng loại nào?', en: 'How do BTE and ITE hearing aids differ? When should each be used?' },
  { cat: 'hearing', agent: 'bot-hearing', vi: 'Hệ thống FM trong lớp học hoạt động ra sao và tiêu chuẩn ISO tương ứng?', en: 'How do classroom FM systems work and what is the relevant ISO standard?' },
  { cat: 'mobility', agent: 'bot-neuro', vi: 'Nẹp chỉnh hình chi dưới cho trẻ bại não — chọn size và chất liệu thế nào?', en: 'Lower-limb orthoses for cerebral palsy — how to choose size and material?' },
  { cat: 'cognition', agent: 'bot-cognitive', vi: 'Thiết bị hỗ trợ trí nhớ cho người cao tuổi sa sút trí tuệ nhẹ?', en: 'Memory aid devices for elderly with mild cognitive impairment?' },
  { cat: 'communication', agent: 'bot-speech', vi: 'Bảng giao tiếp AAC nào phù hợp cho trẻ tự kỷ 4 tuổi?', en: 'Which AAC communication board suits a 4-year-old autistic child?' },
  { cat: 'daily_living', agent: 'bot-mobility', vi: 'Xe lăn điện cho người sống ở căn hộ nhỏ — gợi ý model gấp gọn?', en: 'Power wheelchair for someone in a small apartment — foldable model suggestions?' },
  { cat: 'education', agent: 'bot-regulatory', vi: 'CE Mark và FDA approval khác nhau gì? Khi nào thiết bị AT cần cả hai?', en: 'How do CE Mark and FDA approval differ? When does an AT device need both?' },
  { cat: 'education', agent: 'bot-regulatory', vi: 'WCAG 2.2 AA — checklist cho một trang công khai của chính phủ?', en: 'WCAG 2.2 AA — checklist for a public government website?' },
];

const AR = { vision: 'برمجيات قراءة الشاشة', hearing: 'مساعدات السمع', mobility: 'الأجهزة التقويمية', cognition: 'أدوات الذاكرة', communication: 'لوحات التواصل', daily_living: 'الكراسي المتحركة', education: 'المعايير' };
const FR = { vision: 'lecteurs d\'écran', hearing: 'aides auditives', mobility: 'orthèses', cognition: 'aides-mémoire', communication: 'tablettes CAA', daily_living: 'fauteuils roulants', education: 'normes' };

let sqCount = 0;
for (const q of SQ_PRESEED) {
  for (const lang of ['vi', 'en', 'ar', 'fr'] as const) {
    for (const view of ['end_user', 'at_specialist'] as const) {
      const id = `sq-seed-${q.cat}-${lang}-${view}-${sqCount}`;
      const text = lang === 'vi' ? q.vi : lang === 'en' ? q.en : lang === 'ar' ? AR[q.cat as keyof typeof AR] : FR[q.cat as keyof typeof FR];
      insertOrIgnore('suggested_questions', {
        id,
        agent_id: q.agent,
        category: q.cat,
        view_mode: view,
        language: lang,
        question: text,
        sort_order: sqCount,
        is_active: 1,
        created_by: UID.admin,
        created_at: daysAgo(20),
        updated_at: now(),
      });
      sqCount++;
    }
  }
}
console.log(`   ✓ ${sqCount} suggested questions`);

// =====================================================
// 5) KNOWLEDGE ITEMS — 8 mục tiêu biểu (RAG content)
// =====================================================
console.log('\n📚 Seeding knowledge items...');
const KB = [
  {
    id: 'kb-wcag-22',
    title: 'WCAG 2.2 — Tóm tắt tiêu chí thành công',
    cat: 'web_accessibility',
    content: 'WCAG 2.2 bổ sung 9 tiêu chí mới so với 2.1: Focus Not Obscured (2.4.11), Dragging Movements (2.5.7), Target Size (Minimum) (2.5.8) với kích thước tối thiểu 24x24 CSS pixels, Consistent Help (3.2.6), Redundant Entry (3.3.7), Accessible Authentication (Minimum) (3.3.8), etc.',
    iso: 'WCAG 2.2',
  },
  {
    id: 'kb-iso9999',
    title: 'ISO 9999:2022 — Phân loại công nghệ hỗ trợ',
    cat: 'education',
    content: 'ISO 9999:2022 phân loại AT theo chức năng cơ thể. Ví dụ: 12.21 (xe lăn), 22.06 (thiết bị thính giác), 22.03 (thiết bị thị giác), 22.09 (thiết bị truyền thông). Mỗi code có subclass cụ thể.',
    iso: 'ISO 9999:2022',
  },
  {
    id: 'kb-jaws-nvda',
    title: 'So sánh JAWS, NVDA, VoiceOver',
    cat: 'vision',
    content: 'JAWS (Freedom Scientific, Windows, $1100/năm) — giàu tính năng doanh nghiệp. NVDA (NV Access, miễn phí, Windows) — open source, phổ biến ở Châu Á. VoiceOver (Apple, tích hợp iOS/macOS) — đồng bộ tốt với hệ sinh thái Apple.',
    iso: '22.06.12',
  },
  {
    id: 'kb-hearing-aid-types',
    title: 'Các loại máy trợ thính',
    cat: 'hearing',
    content: 'BTE (Behind-The-Ear), ITE (In-The-Ear), ITC (In-The-Canal), CIC (Completely-In-Canal), RIC (Receiver-In-Canal). BTE phù hợp giảm thính nặng; CIC cho giảm nhẹ và người ưu thẩm mỹ.',
    iso: '22.06.06',
  },
  {
    id: 'kb-aac-grid',
    title: 'AAC — Bảng giao tiếp và ứng dụng',
    cat: 'communication',
    content: 'AAC (Augmentative and Alternative Communication) gồm: low-tech (bảng giấy, PECS) và high-tech (Grid Pad, TD Snap, Proloquo2Go). Quy tắc chọn: bắt đầu low-tech trước, tăng dần theo nhu cầu.',
    iso: '22.09.06',
  },
  {
    id: 'kb-wheelchair-mdr',
    title: 'Xe lăn điện và MDR (EU)',
    cat: 'daily_living',
    content: 'EU MDR 2017/745 yêu cầu xe lăn điện thuộc Class I medical device cần đánh giá lâm sàng, technical documentation, UDI. Xuất sang EU cần CE Mark + EU Authorised Representative nếu nhà sản xuất ngoài EU.',
    iso: '12.21.06',
  },
  {
    id: 'kb-orthotics-cp',
    title: 'Nẹp chỉnh hình cho bại não',
    cat: 'mobility',
    content: 'AFO (Ankle-Foot Orthosis) phổ biến nhất cho trẻ bại não. Loại: solid AFO, hinged AFO, posterior leaf spring. Chất liệu: polypropylene, carbon fiber. Thay mỗi 6-12 tháng theo tăng trưởng.',
    iso: '06.12.03',
  },
  {
    id: 'kb-cognitive-aid',
    title: 'Thiết bị hỗ trợ trí nhớ MCI',
    cat: 'cognition',
    content: 'MCI (Mild Cognitive Impairment) — thiết bị phù hợp: đồng hồ nói, lịch điện tử, app reminder (Medisafe, Pillboxie), thiết bị định vị (GPS), và smart home (Google Home, Alexa) cho nhắc việc.',
    iso: '22.27.16',
  },
];

for (const k of KB) {
  insertOrIgnore('knowledge_items', {
    id: k.id,
    title: k.title,
    title_en: k.title,
    title_ar: k.title,
    title_fr: k.title,
    description: k.title,
    description_en: k.title,
    content: k.content,
    content_en: k.content,
    source: 'mada-curated',
    source_type: 'manual',
    category: k.cat,
    iso_codes: JSON.stringify([k.iso]),
    wcag_level: k.cat === 'web_accessibility' ? 'AA' : '',
    status: 'published',
    chunk_count: 3,
    language: 'vi',
    metadata: JSON.stringify({ source: 'seed' }),
    indexed: 1,
    indexed_at: now(),
    created_by: UID.dataManager,
    created_at: daysAgo(15),
    updated_at: now(),
    translated: 1,
  });
}
console.log(`   ✓ ${KB.length} knowledge items`);

// =====================================================
// 6) CHAT CONVERSATIONS + MESSAGES — 6 cuộc hội thoại mẫu
// =====================================================
console.log('\n💭 Seeding chat conversations...');
const CONVOS: Array<{
  id: string; user: string; title: string; agent: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
}> = [
  {
    id: 'conv-001', user: UID.user, agent: 'bot-vision',
    title: 'Tư vấn phần mềm đọc màn hình',
    messages: [
      { role: 'user', text: 'Tôi bị khiếm thị 80%, đang dùng Windows 11. Phần mềm đọc màn hình nào phù hợp và miễn phí?' },
      { role: 'assistant', text: 'Chào bạn! Với Windows 11, NVDA là lựa chọn tốt nhất miễn phí. Tải từ nvaccess.org. Nó hỗ trợ tiếng Việt qua eSpeak và tương thích hầu hết ứng dụng văn phòng. Nếu bạn cần dùng cho doanh nghiệp, JAWS có nhiều tính năng hơn nhưng mất phí $1100/năm.' },
      { role: 'user', text: 'NVDA có hỗ trợ đọc PDF tiếng Việt tốt không?' },
      { role: 'assistant', text: 'NVDA đọc được PDF nhưng phụ thuộc vào việc PDF có text layer hay chỉ là ảnh scan. Với PDF scan, bạn cần OCR trước. Theo tiêu chuẩn ISO 22.06.12, bạn nên dùng combo NVDA + Screenshot Reader (add-on) cho PDF scan.' },
    ],
  },
  {
    id: 'conv-002', user: UID.user, agent: 'bot-hearing',
    title: 'Máy trợ thính cho người lớn tuổi',
    messages: [
      { role: 'user', text: 'Mẹ tôi 68 tuổi, giảm thính nhẹ. Nên chọn máy trợ thính loại nào?' },
      { role: 'assistant', text: 'Với giảm thính nhẹ ở người lớn tuổi, BTE (Behind-The-Ear) là phổ biến nhất — pin dễ thay, nút bấm to, dễ vệ sinh. ISO 22.06.06. Hãng: Phonak, Oticon, Widex. Giá từ 5-30 triệu đồng tùy dòng.' },
    ],
  },
  {
    id: 'conv-003', user: UID.user, agent: 'bot-speech',
    title: 'AAC cho trẻ tự kỷ',
    messages: [
      { role: 'user', text: 'Con tôi 5 tuổi, được chẩn đoán tự kỷ. Bảng giao tiếp nào nên bắt đầu?' },
      { role: 'assistant', text: 'Bắt đầu bằng PECS (Picture Exchange Communication System) — low-tech, dùng thẻ hình. Sau 2-3 tháng làm quen, có thể chuyển sang Grid Pad (iPad-based, 18 triệu) hoặc TD Snap. Tiêu chuẩn ISO 22.09.06.' },
      { role: 'user', text: 'PECS mua ở đâu tại Việt Nam?' },
      { role: 'assistant', text: 'Bộ PECS chính hãng mua qua nhà phân phối Pyramid Educational Consultants VN hoặc Shopee. Giá khoảng 3-5 triệu. Bạn cũng có thể in thủ công với hình ảnh cá nhân hóa cho giai đoạn đầu.' },
    ],
  },
  {
    id: 'conv-004', user: UID.expert, agent: 'bot-regulatory',
    title: 'CE Mark cho thiết bị AT xuất EU',
    messages: [
      { role: 'user', text: 'Tôi cần xuất xe lăn điện sang EU. Cần những chứng nhận gì theo MDR?' },
      { role: 'assistant', text: 'Theo EU MDR 2017/745, xe lăn điện thuộc Class I (non-invasive, không đo lường). Bạn cần: 1) Technical Documentation, 2) Declaration of Conformity, 3) CE Marking trên sản phẩm, 4) EU Authorised Representative (nếu nhà sản xuất ngoài EU), 5) UDI (Unique Device Identifier). ISO 12.21.06.' },
    ],
  },
  {
    id: 'conv-005', user: UID.expert, agent: 'bot-vision',
    title: 'WCAG 2.2 cho website chính phủ',
    messages: [
      { role: 'user', text: 'Website UBND tỉnh cần đạt WCAG 2.2 mức AA. Checklist cơ bản?' },
      { role: 'assistant', text: 'Checklist WCAG 2.2 AA cốt lõi: 1) Tất cả ảnh có alt text, 2) Tương phản màu ≥ 4.5:1, 3) Tất cả form có label, 4) Điều hướng bàn phím đầy đủ, 5) Focus visible rõ ràng, 6) Không có nội dung chỉ dựa vào màu sắc, 7) Tiêu đề & heading theo thứ bậc, 8) Ngôn ngữ trang khai báo trong HTML, 9) Target size ≥ 24x24 (tiêu chí mới 2.5.8).' },
    ],
  },
  {
    id: 'conv-006', user: UID.user, agent: 'bot-mobility',
    title: 'Xe lăn điện gấp gọn',
    messages: [
      { role: 'user', text: 'Tôi ở chung cư 50m², cần xe lăn điện gấp gọn. Gợi ý?' },
      { role: 'assistant', text: 'Với căn hộ nhỏ, xe lăn điện gấp gọn tốt nhất: 1) WHILL Model F — gấp 3 giây, 25kg, 2) Jazzy Passport — gấp 30 giây, 30kg, 3) Karman XO-202 — nhẹ nhất 20kg. Lưu ý: chọn bánh nhỏ (<12 inch) để vừa thang máy, pin lithium để nhẹ. ISO 12.21.06.' },
    ],
  },
];

for (const c of CONVOS) {
  insertOrIgnore('chat_conversations', {
    id: c.id,
    user_id: c.user,
    title: c.title,
    agent_id: c.agent,
    language: 'vi',
    message_count: c.messages.length,
    last_message_preview: c.messages[c.messages.length - 1].text.slice(0, 80),
    is_pinned: c.id === 'conv-001' ? 1 : 0,
    created_at: daysAgo(7),
    updated_at: hoursAgo(3),
  });
  c.messages.forEach((m, i) => {
    insertOrIgnore('chat_messages', {
      id: `${c.id}-m${i + 1}`,
      conversation_id: c.id,
      role: m.role,
      content: m.text,
      agent_id: m.role === 'assistant' ? c.agent : null,
      sources: m.role === 'assistant' ? JSON.stringify([{ type: 'iso', code: '22.06.12' }]) : null,
      confidence: m.role === 'assistant' ? 0.85 + Math.random() * 0.1 : null,
      language: 'vi',
      created_at: new Date(Date.now() - (c.messages.length - i) * 1800000).toISOString(),
    });
  });
}
console.log(`   ✓ ${CONVOS.length} conversations, ${CONVOS.reduce((a, c) => a + c.messages.length, 0)} messages`);

// =====================================================
// 7) CONSULTATIONS — 4 yêu cầu tư vấn
// =====================================================
console.log('\n📞 Seeding consultations...');
const CONSULTATIONS = [
  { id: 'cons-001', name: 'Nguyễn Văn A', email: 'a@gmail.com', phone: '0901234567', message: 'Tôi cần tư vấn máy trợ thính cho bố tôi, 72 tuổi.', status: 'pending' },
  { id: 'cons-002', name: 'Trần Thị B', email: 'b@yahoo.com', phone: '0987654321', message: 'Công ty tôi muốn mua số lượng lớn xe lăn cho bệnh viện, cần báo giá.', status: 'reviewed' },
  { id: 'cons-003', name: 'Lê Văn C', email: 'c@outlook.com', phone: '', message: 'Xin hỏi về quy trình đánh giá nhu cầu AT cho học sinh tiểu học.', status: 'contacted' },
  { id: 'cons-004', name: 'Phạm Thị D', email: 'd@mada.vn', phone: '0912345678', message: 'Tôi cần hỗ trợ cài đặt NVDA trên laptop mới.', status: 'pending' },
];
for (const c of CONSULTATIONS) {
  insertOrIgnore('consultations', {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    message: c.message,
    status: c.status,
    notes: c.status !== 'pending' ? `Đã ${c.status === 'reviewed' ? 'xem xét' : 'liên hệ'} bởi admin-001` : null,
    assigned_to: c.status !== 'pending' ? UID.admin : null,
    created_at: daysAgo(Math.floor(Math.random() * 14) + 1),
    updated_at: now(),
  });
}
console.log(`   ✓ ${CONSULTATIONS.length} consultations`);

// =====================================================
// 8) SUPPORT TICKETS — 5 ticket
// =====================================================
console.log('\n🎫 Seeding support tickets...');
const TICKETS = [
  { num: 'TKT-0001', user: UID.user, email: 'user@mada.vn', name: 'Phạm Minh Khách', subj: 'Lỗi upload file PDF > 10MB', desc: 'Tôi upload file PDF 12MB nhưng hệ thống báo lỗi. Cần hỗ trợ.', cat: 'technical', prio: 'normal', status: 'open' },
  { num: 'TKT-0002', user: UID.user, email: 'user@mada.vn', name: 'Phạm Minh Khách', subj: 'Yêu cầu thêm ngôn ngữ Khmer', desc: 'Tôi sống ở Campuchia, muốn có thêm tiếng Khmer.', cat: 'feature', prio: 'low', status: 'in_progress' },
  { num: 'TKT-0003', user: UID.expert, email: 'expert@mada.vn', name: 'Trần Thị Chuyên Gia', subj: 'Bot trả lời sai ISO code', desc: 'Bot-vision trả lời nhầm ISO 22.06.06 (thính giác) trong khi câu hỏi về thị giác.', cat: 'bug', prio: 'high', status: 'resolved' },
  { num: 'TKT-0004', user: null, email: 'guest@example.com', name: 'Khách vãng lai', subj: 'Hỏi về giá Pro plan', desc: 'Pro plan 299k/tháng bao gồm những gì? Có miễn phí 7 ngày dùng thử không?', cat: 'billing', prio: 'normal', status: 'closed' },
  { num: 'TKT-0005', user: UID.user, email: 'user@mada.vn', name: 'Phạm Minh Khách', subj: 'Cảm ơn team MADA', desc: 'Hệ thống rất hữu ích cho gia đình tôi. Cảm ơn!', cat: 'feedback', prio: 'low', status: 'open' },
];
for (const t of TICKETS) {
  insertOrIgnore('support_tickets', {
    id: `tkt-${t.num}`,
    ticket_number: t.num,
    user_id: t.user,
    user_email: t.email,
    user_name: t.name,
    subject: t.subj,
    description: t.desc,
    category: t.cat,
    priority: t.prio,
    status: t.status,
    assigned_to: t.status !== 'open' ? UID.admin : null,
    assigned_at: t.status !== 'open' ? daysAgo(2) : null,
    resolved_at: t.status === 'resolved' || t.status === 'closed' ? daysAgo(1) : null,
    closed_at: t.status === 'closed' ? daysAgo(1) : null,
    rating: t.status === 'resolved' ? 5 : null,
    rating_comment: t.status === 'resolved' ? 'Đã fix nhanh, cảm ơn!' : null,
    created_at: daysAgo(Math.floor(Math.random() * 10) + 1),
    updated_at: now(),
  });
}
console.log(`   ✓ ${TICKETS.length} tickets`);

// =====================================================
// 9) MESSAGE FEEDBACK — like/dislike mẫu
// =====================================================
console.log('\n👍 Seeding message feedback...');
const FB = [
  { msg: 'conv-001-m2', user: UID.user, rating: 'like', reason: '', agent: 'bot-vision' },
  { msg: 'conv-003-m2', user: UID.user, rating: 'like', reason: '', agent: 'bot-speech' },
  { msg: 'conv-005-m1', user: UID.expert, rating: 'like', reason: '', agent: 'bot-vision' },
  { msg: 'conv-006-m1', user: UID.user, rating: 'dislike', reason: 'Quá nhiều thông tin, cần tóm tắt ngắn hơn', agent: 'bot-mobility' },
  { msg: 'conv-002-m1', user: UID.user, rating: 'like', reason: '', agent: 'bot-hearing' },
];
for (let i = 0; i < FB.length; i++) {
  const f = FB[i];
  insertOrIgnore('message_feedback', {
    id: `fb-${i + 1}`,
    message_id: f.msg,
    session_id: f.msg.split('-m')[0],
    user_id: f.user,
    rating: f.rating,
    reason: f.reason,
    agent_id: f.agent,
    language: 'vi',
    created_at: daysAgo(i),
  });
}
console.log(`   ✓ ${FB.length} feedbacks`);

// =====================================================
// 10) CHAT METRICS — 7 ngày gần nhất
// =====================================================
console.log('\n📊 Seeding chat metrics...');
for (let d = 6; d >= 0; d--) {
  const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  insertOrIgnore('chat_metrics', {
    id: `metrics-${date}`,
    total_chats: 20 + Math.floor(Math.random() * 30),
    total_queries: 80 + Math.floor(Math.random() * 60),
    avg_response_time_ms: 1200 + Math.floor(Math.random() * 800),
    avg_confidence: 0.82 + Math.random() * 0.1,
    error_count: Math.floor(Math.random() * 3),
    language_stats: JSON.stringify({ vi: 70, en: 20, ar: 5, fr: 5 }),
    category_stats: JSON.stringify({ vision: 30, hearing: 20, mobility: 15, communication: 15, cognition: 10, daily_living: 5, education: 5 }),
    top_queries: JSON.stringify(['máy trợ thính', 'NVDA', 'WCAG', 'xe lăn', 'AAC']),
    hourly_stats: JSON.stringify(Array.from({ length: 24 }, (_, h) => ({ hour: h, count: Math.floor(Math.random() * 10) }))),
    date,
    created_at: daysAgo(d),
    updated_at: now(),
  });
}
console.log('   ✓ 7 days of metrics');

// =====================================================
// 11) AUDIT LOGS — 20 log
// =====================================================
console.log('\n📝 Seeding audit logs...');
const ACTIONS = [
  'login', 'logout', 'create_product', 'update_product', 'delete_product',
  'create_user', 'update_settings', 'create_prompt', 'update_agent',
  'view_dashboard', 'export_data',
];
for (let i = 0; i < 20; i++) {
  const action = ACTIONS[i % ACTIONS.length];
  const user = i % 4 === 0 ? UID.admin : i % 4 === 1 ? UID.expert : i % 4 === 2 ? UID.dataManager : UID.user;
  insertOrIgnore('audit_logs', {
    id: `audit-${i + 1}`,
    user_id: user,
    action,
    target: action.includes('product') ? `kb_products/kb-${i}` : `system`,
    details: JSON.stringify({ seed: true }),
    ip_address: `192.168.1.${100 + i}`,
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    created_at: hoursAgo(i * 2),
  });
}
console.log('   ✓ 20 audit logs');

// =====================================================
// 12) ADMIN SYSTEM LOGS — 12 log (các mức độ)
// =====================================================
console.log('\n🖥️  Seeding system logs...');
const SYSLOGS = [
  { level: 'success', source: 'auth', msg: 'User logged in successfully' },
  { level: 'info', source: 'chat', msg: 'New conversation started' },
  { level: 'info', source: 'ai', msg: 'Gemini API request completed in 1.2s' },
  { level: 'warn', source: 'ai', msg: 'Gemini API rate limit warning' },
  { level: 'error', source: 'upload', msg: 'Failed to process PDF: invalid format' },
  { level: 'info', source: 'admin', msg: 'Admin updated KB product' },
  { level: 'success', source: 'ingest', msg: 'Knowledge item indexed successfully' },
  { level: 'warn', source: 'auth', msg: 'Multiple failed login attempts detected' },
  { level: 'error', source: 'db', msg: 'SQLite WAL checkpoint failed' },
  { level: 'info', source: 'cron', msg: 'Scheduled cleanup job completed' },
  { level: 'success', source: 'backup', msg: 'Database backup completed' },
  { level: 'critical', source: 'system', msg: 'High memory usage detected (87%)' },
];
for (let i = 0; i < SYSLOGS.length; i++) {
  const l = SYSLOGS[i];
  insertOrIgnore('admin_system_logs', {
    id: `syslog-${i + 1}`,
    level: l.level,
    source: l.source,
    message: l.msg,
    details: JSON.stringify({ seed: true }),
    user_id: i % 3 === 0 ? UID.admin : null,
    ip_address: '127.0.0.1',
    user_agent: 'System/1.0',
    timestamp: hoursAgo(i * 3),
  });
}
console.log(`   ✓ ${SYSLOGS.length} system logs`);

// =====================================================
// 13) ADMIN NOTIFICATIONS — 6
// =====================================================
console.log('\n🔔 Seeding admin notifications...');
const NOTIFS = [
  { type: 'warning', title: '3 consultations pending', message: 'Bạn có 3 yêu cầu tư vấn chưa xử lý', cat: 'support', prio: 'high' },
  { type: 'info', title: 'New knowledge item indexed', message: 'Bot-vision indexed 12 new ISO codes', cat: 'system', prio: 'normal' },
  { type: 'success', title: 'Database backup completed', message: 'Daily backup saved to mada-2026-10-21.db', cat: 'system', prio: 'low' },
  { type: 'error', title: 'Gemini API quota at 80%', message: 'Đã dùng 80% quota tháng này', cat: 'performance', prio: 'urgent' },
  { type: 'info', title: 'New user registered', message: 'expert-001 vừa đăng ký tài khoản mới', cat: 'user', prio: 'normal' },
  { type: 'warning', title: 'Scheduled source failed', message: 'https://at.mada.org.qa/ — crawl thất bại 3 lần liên tiếp', cat: 'system', prio: 'high' },
];
for (let i = 0; i < NOTIFS.length; i++) {
  const n = NOTIFS[i];
  insertOrIgnore('admin_notifications', {
    id: `notif-${i + 1}`,
    type: n.type,
    title: n.title,
    message: n.message,
    link: `/${n.cat}`,
    link_label: 'Xem chi tiết',
    is_read: i > 2 ? 0 : 1,
    read_at: i > 2 ? null : hoursAgo(5),
    read_by: i > 2 ? null : UID.admin,
    priority: n.prio,
    category: n.cat,
    created_by: 'system',
    created_at: hoursAgo(i * 6),
  });
}
console.log(`   ✓ ${NOTIFS.length} notifications`);

// =====================================================
// 14) SCHEDULED SOURCES — 3 nguồn crawl
// =====================================================
console.log('\n🌐 Seeding scheduled sources...');
const SOURCES = [
  { url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/', name: 'MADA - Sensory Vision', freq: 'daily' },
  { url: 'https://at.mada.org.qa/assistive-technology-portal/', name: 'MADA - AT Portal', freq: 'weekly' },
  { url: 'https://www.who.int/publications/i/item/9789241517553', name: 'WHO - Priority Assistive Products', freq: 'weekly' },
];
for (let i = 0; i < SOURCES.length; i++) {
  const s = SOURCES[i];
  insertOrIgnore('scheduled_sources', {
    id: `source-${i + 1}`,
    url: s.url,
    name: s.name,
    type: 'web',
    frequency: s.freq,
    status: i === 2 ? 'error' : 'active',
    last_run: hoursAgo(i * 12),
    last_success: i === 2 ? null : hoursAgo(i * 12),
    last_error: i === 2 ? 'HTTP 503' : null,
    error_message: i === 2 ? 'Service unavailable' : null,
    metadata: JSON.stringify({ seed: true }),
    created_at: daysAgo(30),
    updated_at: now(),
  });
}
console.log(`   ✓ ${SOURCES.length} scheduled sources`);

// =====================================================
// 15) INGESTION JOBS — 4 job
// =====================================================
console.log('\n⚙️  Seeding ingestion jobs...');
const JOBS = [
  { type: 'web', source: 'MADA Vision', status: 'completed', progress: 100, items: 24, stage: 'done' },
  { type: 'web', source: 'WHO GATE', status: 'completed', progress: 100, items: 50, stage: 'done' },
  { type: 'file', source: 'wcag-22.pdf', status: 'processing', progress: 65, items: 0, stage: 'embedding' },
  { type: 'web', source: 'ISO 9999:2022', status: 'failed', progress: 0, items: 0, stage: 'error', error: '403 Forbidden' },
];
for (let i = 0; i < JOBS.length; i++) {
  const j = JOBS[i];
  insertOrIgnore('ingestion_jobs', {
    id: `job-${i + 1}`,
    source_type: j.type,
    source: j.source,
    title: j.source,
    status: j.status,
    progress: j.progress,
    stage: j.stage,
    items_added: j.items,
    error: j.error ?? null,
    started_at: hoursAgo(i * 4 + 2),
    completed_at: j.status !== 'processing' ? hoursAgo(i * 4) : null,
    created_by: UID.dataManager,
    created_at: hoursAgo(i * 4 + 2),
  });
}
console.log(`   ✓ ${JOBS.length} ingestion jobs`);

// =====================================================
// 16) USER FAVORITES — 4 sản phẩm yêu thích
// =====================================================
console.log('\n⭐ Seeding favorites...');
const FAVS = [
  { user: UID.user, type: 'product', id: 'aac-big-mack', title: 'BIG/mack - Thiết bị giao tiếp AAC' },
  { user: UID.user, type: 'kb_item', id: 'kb-jaws-nvda', title: 'So sánh JAWS, NVDA, VoiceOver' },
  { user: UID.user, type: 'product', id: 'aac-grid-pad', title: 'Grid Pad - Bảng giao tiếp cao cấp' },
  { user: UID.expert, type: 'standard', id: 'iso-9999-2022', title: 'ISO 9999:2022 - Phân loại AT' },
];
for (let i = 0; i < FAVS.length; i++) {
  const f = FAVS[i];
  insertOrIgnore('user_favorites', {
    id: `fav-${i + 1}`,
    user_id: f.user,
    item_type: f.type,
    item_id: f.id,
    title: f.title,
    metadata: JSON.stringify({ seed: true }),
    created_at: daysAgo(i + 1),
  });
}
console.log(`   ✓ ${FAVS.length} favorites`);

// =====================================================
// 17) FILE UPLOADS — 6 file
// =====================================================
console.log('\n📁 Seeding file uploads...');
const month = new Date().toISOString().slice(0, 7);
const FILES = [
  { user: UID.user, name: 'document-wcag-22.pdf', size: 2456789, type: 'application/pdf' },
  { user: UID.user, name: 'guide-jaws-vi.docx', size: 567890, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { user: UID.expert, name: 'iso-9999-2022-summary.txt', size: 12345, type: 'text/plain' },
  { user: UID.user, name: 'wheelchair-spec.png', size: 1234567, type: 'image/png' },
  { user: UID.expert, name: 'aac-research-2024.pdf', size: 3456789, type: 'application/pdf' },
  { user: UID.user, name: 'hearing-aid-comparison.xlsx', size: 89012, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
];
for (let i = 0; i < FILES.length; i++) {
  const f = FILES[i];
  insertOrIgnore('file_uploads', {
    id: `file-${i + 1}`,
    user_id: f.user,
    filename: f.name,
    file_size_bytes: f.size,
    file_type: f.type,
    month_key: month,
    uploaded_at: daysAgo(i),
  });
}
console.log(`   ✓ ${FILES.length} file uploads`);

// =====================================================
// 18) FEEDBACK QUESTIONS — 4 câu
// =====================================================
console.log('\n❓ Seeding feedback questions...');
const FBQS = [
  { key: 'inaccurate', vi: 'Thông tin không chính xác', icon: 'error' },
  { key: 'incomplete', vi: 'Câu trả lời chưa đầy đủ', icon: 'incomplete' },
  { key: 'irrelevant', vi: 'Không liên quan đến câu hỏi', icon: 'wrong' },
  { key: 'other', vi: 'Lý do khác', icon: 'edit' },
];
for (let i = 0; i < FBQS.length; i++) {
  const q = FBQS[i];
  insertOrIgnore('feedback_questions', {
    id: `fbq-${i + 1}`,
    question_key: q.key,
    text_vi: q.vi,
    text_en: q.vi,
    text_ar: q.vi,
    text_fr: q.vi,
    icon: q.icon,
    is_active: 1,
    sort_order: i + 1,
    created_at: daysAgo(20),
    updated_at: now(),
  });
}
console.log(`   ✓ ${FBQS.length} feedback questions`);

// =====================================================
// 19) PROMPT VERSIONS — 3 version cho 3 prompt
// =====================================================
console.log('\n📜 Seeding prompt versions...');
const PV = [
  { prompt_id: 'mada-expert-vi', version: 2, text: 'Bạn là chuyên gia CNHT — phiên bản 2, đã bổ sung tiêu chuẩn WCAG 2.2', summary: 'Thêm WCAG 2.2 AA vào hướng dẫn trả lời' },
  { prompt_id: 'mada-expert-vi', version: 1, text: 'Bạn là chuyên gia CNHT — phiên bản 1', summary: 'Phiên bản đầu tiên' },
  { prompt_id: 'safety-rules', version: 1, text: 'Không đưa ra chẩn đoán y tế; luôn khuyến nghị gặp chuyên viên y tế có chứng chỉ.', summary: 'Phiên bản đầu tiên' },
];
for (let i = 0; i < PV.length; i++) {
  const p = PV[i];
  insertOrIgnore('prompt_versions', {
    id: `pv-${i + 1}`,
    prompt_id: p.prompt_id,
    version: p.version,
    prompt: p.text,
    change_summary: p.summary,
    created_by: UID.admin,
    created_at: daysAgo(20 - i * 5),
    is_restored: 0,
  });
}
console.log(`   ✓ ${PV.length} prompt versions`);

// =====================================================
// 20) KB AUDIT — 5 records
// =====================================================
console.log('\n🔍 Seeding kb audit...');
for (let i = 0; i < 5; i++) {
  insertOrIgnore('kb_audit', {
    id: `kb-audit-${i + 1}`,
    item_id: KB[i % KB.length].id,
    action: i % 2 === 0 ? 'update' : 'create',
    before_data: JSON.stringify({ content: 'old' }),
    after_data: JSON.stringify({ content: 'new' }),
    user_id: UID.dataManager,
    created_at: daysAgo(i + 1),
  });
}
console.log('   ✓ 5 kb audit records');

// =====================================================
// 21) SESSIONS — 6 active sessions
// =====================================================
console.log('\n🔐 Seeding sessions...');
const SESSION_USERS = [UID.admin, UID.expert, UID.dataManager, UID.user, UID.superadmin];
for (let i = 0; i < SESSION_USERS.length; i++) {
  insertOrIgnore('sessions', {
    id: `sess-${i + 1}`,
    user_id: SESSION_USERS[i],
    refresh_token: `refresh_token_${i}_${Date.now()}`,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    created_at: hoursAgo(i * 4),
  });
}
console.log(`   ✓ 5 sessions`);

// =====================================================
// SUMMARY
// =====================================================
console.log('\n✅ Seed completed!\n');
console.log('📊 Summary:');
console.log(`   Users:           ${count('users')}`);
console.log(`   Sessions:        ${count('sessions')}`);
console.log(`   Categories:      ${count('kb_categories')}`);
console.log(`   Products:        ${count('kb_products')}`);
console.log(`   Agents:          ${count('admin_agents')}`);
console.log(`   KB items:        ${count('knowledge_items')}`);
console.log(`   Conversations:   ${count('chat_conversations')}`);
console.log(`   Messages:        ${count('chat_messages')}`);
console.log(`   Consultations:   ${count('consultations')}`);
console.log(`   Tickets:         ${count('support_tickets')}`);
console.log(`   Feedback Q:      ${count('feedback_questions')}`);
console.log(`   Suggested Q:     ${count('suggested_questions')}`);
console.log(`   Message FB:      ${count('message_feedback')}`);
console.log(`   Metrics days:    ${count('chat_metrics')}`);
console.log(`   Audit logs:      ${count('audit_logs')}`);
console.log(`   System logs:     ${count('admin_system_logs')}`);
console.log(`   Notifications:   ${count('admin_notifications')}`);
console.log(`   Sources:         ${count('scheduled_sources')}`);
console.log(`   Jobs:            ${count('ingestion_jobs')}`);
console.log(`   Favorites:       ${count('user_favorites')}`);
console.log(`   File uploads:    ${count('file_uploads')}`);
console.log(`   Prompt versions: ${count('prompt_versions')}`);
console.log(`   KB audit:        ${count('kb_audit')}`);
console.log('\n👤 Login credentials:');
console.log(`   admin@mada.vn, expert@mada.vn, data@mada.vn, user@mada.vn`);
console.log(`     → password: ${DEMO_PASSWORD}`);
console.log(`   superadmin@mada.vn`);
console.log(`     → password: ${SUPER_ADMIN_PASSWORD}  (do entrypoint.sh quản lý)`);
console.log('');

db.close();
