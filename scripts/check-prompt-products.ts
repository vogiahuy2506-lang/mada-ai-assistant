/**
 * ⭐ Kiểm tra: tên sản phẩm được nhắc trong PROMPT có thực sự tồn tại trong
 * catalog MADA không?
 *
 * Tên bịa trong prompt → model bịa → không có card tương ứng → user thấy
 * "liệt kê tên" nhưng không có card sản phẩm.
 *
 * ⚠️ VÌ SAO CẦN SỬA SCRIPT NÀY:
 * Bản cũ kiểm tra MỘT DANH SÁCH TÊN CỐ ĐỊNH (`CHECK`) — nó không hề đọc
 * prompt thật, nên kết quả "Bịa/không có: 19" là ảo (danh sách cứng vẫn chứa
 * tên đã được thay bằng tên thật). Script báo PASS/FAIL về thứ không liên
 * quan tới trạng thái thật → dễ dẫn tới quyết định sai.
 *
 * → Bản này QUÉT THẬT các nguồn prompt đang chạy:
 *   1. `admin_agents.system_prompt` (7 bot, DB)
 *   2. `kb_categories.description_*` (mô tả danh mục công khai)
 *   3. `src/lib/madaBots.ts` (prompt tĩnh của frontend)
 *   4. `server/lib/prompts/systemPrompts.ts` (prompt tĩnh của backend)
 * rồi so từng tên với catalog MADA (`kb_products`).
 *
 * Usage: npx tsx scripts/check-prompt-products.ts
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'mada.db'), { readonly: true });

// ── 1. Catalog MADA (nguồn sự thật) ──────────────────────────────────
const rows = db.prepare('SELECT title, title_en FROM kb_products').all() as any[];
const names = new Set<string>();
for (const r of rows) {
  if (r.title) names.add(String(r.title).trim().toLowerCase());
  if (r.title_en) names.add(String(r.title_en).trim().toLowerCase());
}

/**
 * ⭐ Thuật ngữ HỢP LỆ — KHÔNG phải tên sản phẩm, không được tính là "bịa".
 *
 *   BTE, CIC, IIC, ITC, RIC → kiểu đeo máy trợ thính (dạng viết tắt chuẩn).
 *   PECS → phương pháp giao tiếp bằng hình ảnh (Picture Exchange
 *   Communication System) — là MÔ HÌNH, không phải tên sản phẩm.
 *   JAWS, NVDA, VoiceOver → phần mềm đọc màn hình, KHÔNG bán bởi MADA.
 */
const TERMINOLOGY = new Set(
  [
    'BTE', 'CIC', 'IIC', 'ITC', 'RIC', 'PECS', 'JAWS', 'NVDA', 'VoiceOver',
    'SGD', 'AAC', 'FM', 'OCR', 'WHO GATE', 'WCAG',
  ].map((s) => s.toLowerCase())
);

/**
 * ⭐ Tên sản phẩm BỊA — bot KHÔNG được nhắc (không có trong catalog MADA).
 * Danh sách này là "blacklist" đã biết, dùng để bắt tái phát.
 */
const KNOWN_FABRICATED = [
  'Phonak Lyric', 'Oticon More', 'Bellman', 'Roger FM System',
  'Phonak Audeo Lumity', 'Ruby HD', 'CCTV Magnifier', 'Medelert',
  'Time Timer', 'IntegraMouse Plus', 'Neofect Smart Glove', 'Bioness L300 Go',
  'Scewo Bro', 'Quickie Q700-UP M', 'Rollator Walker',
];

// ── 2. Thu thập nguồn prompt THẬT đang chạy ───────────────────────────
interface Source {
  label: string;
  text: string;
}

const sources: Source[] = [];

// 2a. Prompt của 7 bot trong DB
const agents = db.prepare('SELECT bot_id, name, system_prompt FROM admin_agents').all() as any[];
for (const a of agents) {
  sources.push({
    label: `admin_agents:${a.bot_id}`,
    text: String(a.system_prompt || ''),
  });
}

// 2b. Mô tả danh mục công khai (hiện ra trang danh mục)
const cats = db.prepare('SELECT id, description_vi, description_en FROM kb_categories').all() as any[];
for (const c of cats) {
  sources.push({
    label: `kb_categories:${c.id}`,
    text: `${c.description_vi || ''}\n${c.description_en || ''}`,
  });
}

// 2c. Prompt tĩnh trong source code
for (const rel of ['src/lib/madaBots.ts', 'server/lib/prompts/systemPrompts.ts']) {
  const p = path.join(process.cwd(), rel);
  if (fs.existsSync(p)) {
    sources.push({ label: rel, text: fs.readFileSync(p, 'utf-8') });
  }
}

// ── 3. Quét từng nguồn ────────────────────────────────────────────────
console.log('═'.repeat(78));
console.log('TÊN SẢN PHẨM TRONG PROMPT — CÓ THẬT TRONG CATALOG MADA?');
console.log('═'.repeat(78));
console.log(`Catalog MADA: ${names.size} tên | Nguồn prompt: ${sources.length}\n`);

let totalHits = 0;

for (const src of sources) {
  const hits = KNOWN_FABRICATED.filter((bad) => {
    const re = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(src.text);
  });

  if (hits.length) {
    console.log(`❌ ${src.label}: ${hits.join(', ')}`);
    totalHits += hits.length;
  }
}

// ── 4. Kiểm tra NGƯỢC: tên sản phẩm thật mà bot KHÔNG biết ───────────
// Bot có nhắc được tên sản phẩm thật không → catalog có sản phẩm nhưng
// prompt không hề biết → bot không bao giờ giới thiệu được.
console.log('');
console.log('─'.repeat(78));
console.log('NGƯỢC LẠI: SẢN PHẨM CỦA RIÊNG TỪNG BOT ĐÃ CÓ TRONG PROMPT?');
console.log('─'.repeat(78));

const owned = db.prepare('SELECT bot_id, system_prompt FROM admin_agents').all() as any[];
// Lấy tên sản phẩm thật theo bảng chủ sở hữu MADA
let ownerMap: Record<string, string> = {};
try {
  ownerMap = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'mada-product-owners.json'), 'utf-8')
  );
} catch {
  console.log('⚠️  Không đọc được data/mada-product-owners.json — bỏ qua bước này.');
}

const productByUrl = new Map<string, string>();
for (const r of db.prepare('SELECT title, product_url, source_url FROM kb_products').all() as any[]) {
  const t = String(r.title || '').trim();
  if (!t) continue;
  if (r.product_url) productByUrl.set(r.product_url, t);
  if (r.source_url) productByUrl.set(r.source_url, t);
}

for (const a of owned) {
  const prompt = String(a.system_prompt || '');
  const missing: string[] = [];
  for (const [url, owner] of Object.entries(ownerMap)) {
    if (owner !== a.bot_id) continue;
    const title = productByUrl.get(url);
    if (!title) continue;
    // Tên có thật nhưng KHÔNG xuất hiện trong prompt của bot
    if (!prompt.toLowerCase().includes(title.toLowerCase())) {
      missing.push(title);
    }
  }
  const total = Object.values(ownerMap).filter((o) => o === a.bot_id).length;
  if (missing.length) {
    console.log(`⚠️  ${a.bot_id}: ${missing.length}/${total} sản phẩm RIÊNG chưa có trong prompt`);
    console.log(`      ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
  } else {
    console.log(`✅ ${a.bot_id}: đủ ${total} sản phẩm riêng trong prompt`);
  }
}

console.log('');
console.log('─'.repeat(78));
if (totalHits === 0) {
  console.log('✅ KHÔNG còn tên sản phẩm bịa trong bất kỳ nguồn prompt nào');
} else {
  console.log(`❌ Còn ${totalHits} lần nhắc tên sản phẩm bịa trong prompt`);
}
console.log('─'.repeat(78));

db.close();
process.exit(totalHits === 0 ? 0 : 1);
