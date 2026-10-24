/**
 * ⭐ Kiểm tra prompt của 7 bot (trong DB `admin_agents`) xem có nhắc tên
 * sản phẩm KHÔNG TỒN TẠI trong catalog MADA không.
 *
 * Usage: npx tsx scripts/audit-bot-prompts.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'mada.db'), { readonly: true });
const products = db.prepare('SELECT title, title_en FROM kb_products').all() as any[];
const agents = db.prepare('SELECT id, bot_id, name, system_prompt FROM admin_agents').all() as any[];

const names = new Set<string>();
for (const p of products) {
  if (p.title) names.add(String(p.title).trim().toLowerCase());
  if (p.title_en) names.add(String(p.title_en).trim().toLowerCase());
}

/**
 * ⭐ Tên sản phẩm BỊA (không có trong catalog MADA) — bot KHÔNG được nhắc.
 *
 * ⚠️ KHÔNG đưa "thuật ngữ" vào đây:
 *   BTE, CIC, IIC, ITC, RIC = kiểu đeo máy trợ thính (dạng viết tắt chuẩn).
 *   PECS = phương pháp giao tiếp bằng hình ảnh (Picture Exchange Communication
 *   System), là MÔ HÌNH chứ không phải tên sản phẩm trong catalog.
 * → Chúng hợp lệ trong prompt chuyên gia (so sánh BTE vs CIC, PECS vs SGD).
 * → Xem `scripts/sync-agent-prompts.ts` — cùng nguyên tắc.
 */
const FABRICATED = [
  'Phonak Lyric', 'Oticon More', 'Bellman', 'Roger FM System',
  'Phonak Audeo Lumity', 'VoiceOver', 'Ruby HD', 'CCTV Magnifier', 'Medelert',
  'Time Timer', 'IntegraMouse Plus', 'Neofect Smart Glove', 'Bioness L300 Go',
  'Scewo Bro', 'Quickie Q700-UP M', 'Rollator Walker',
];

/** Tên sản phẩm THẬT (được phép nhắc). */
const ALLOWED = new Set(
  [
    'Tobii Dynavox', 'Proloquo2Go', 'Tobii Dynavox I-Series', 'Tobii Dynavox Indi',
    'OrCam MyEye', 'JAWS', 'NVDA with Arabic voices', 'Tobii PCEye 5',
    'Tobii PCEye Mini', 'WeWALK Smart Cane', 'Lazarillo', 'GEWA Control Prog',
    'Primo+ Environment Control', 'Housemate', 'Power Link 4', 'Quha Zono 2',
    'Quha Dwell', 'Smyle Mouse', 'Tecla-e', 'Xbox Adaptive Controller',
    'Hopspot', 'Talking Photo Album', 'VisionBuddy', 'IrisVision Inspire',
    'CloverBook Pro', 'Scanmarker Reader', 'TD Pilot', 'CoughDrop AAC',
    'Kinova Jaco Assistive Robotic Arm', 'Obi robotic feeding device',
    'MOGO Super Evaluation Kit', 'Assessment Switch Kit', 'Ruby Series',
    'Topaz Series', 'Snow 12', 'ZoomText Magnifier / Reader',
  ].map((s) => s.toLowerCase())
);

console.log('═'.repeat(78));
console.log('FABRICATED PRODUCT NAMES IN BOT PROMPTS');
console.log('═'.repeat(78));

let total = 0;
for (const a of agents) {
  const prompt = String(a.system_prompt || '');
  const hits = FABRICATED.filter((f) => {
    if (ALLOWED.has(f.toLowerCase())) return false;
    const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(prompt);
  });
  if (hits.length) {
    console.log(`❌ ${a.bot_id} (${a.name}): ${hits.join(', ')}`);
    total += hits.length;
  } else {
    console.log(`✅ ${a.bot_id} (${a.name}): sạch`);
  }
}

console.log('');
console.log(`Tổng số tên bịa tìm thấy: ${total}`);
db.close();
