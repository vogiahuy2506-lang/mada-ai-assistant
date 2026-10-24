/**
 * ⭐ ĐỒNG BỘ prompt của 7 bot trong DB `admin_agents` — thay tên sản phẩm BỊA
 * bằng tên có THẬT trong catalog MADA.
 *
 * VÌ SAO CẦN:
 * `admin_agents.system_prompt` là VAI TRÒ CHÍNH của bot (xem
 * `buildSystemPrompt()` — `isSpecialistBot` → dùng `resolvedAgentPrompt` làm
 * identity). Nên sửa file tĩnh là chưa đủ — phải sửa cả DB.
 *
 * Bảng đồ tên bịa → tên thật (tất cả đều có trong `kb_products`):
 *   BTE, CIC, IIC ........... giữ làm THUẬT NGỮ (không phải tên sản phẩm)
 *   Phonak Lyric ........... A-200 Personal Sound Amplifier
 *   Oticon More ............ Oticon Amigo T31
 *   Bellman ................ Clarity AlertMaster AL10
 *   Roger FM System ....... StreamLine Mic
 *   Ruby HD ................ Ruby Series
 *   CCTV Magnifier ......... Ruby Series
 *   VoiceOver .............. Dragon Professional
 *   Medelert ............... Hopspot
 *   Time Timer ............. Skwitch
 *   IntegraMouse Plus ...... Smyle Mouse
 *   Neofect Smart Glove .... Tecla-e
 *   Bioness L300 Go ........ Tobii PCEye 5
 *   Scewo Bro .............. WeWALK Smart Cane
 *   Quickie Q700-UP M ...... Lazarillo
 *   Rollator Walker ........ GEWA Control Prog
 *
 * Usage:
 *   npx tsx scripts/sync-agent-prompts.ts          # áp dụng
 *   npx tsx scripts/sync-agent-prompts.ts --check  # chỉ báo cáo
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'mada.db');
const CHECK_ONLY = process.argv.includes('--check');

/** Tên bịa → tên THẬT (tồn tại trong kb_products). */
const REPLACEMENTS: [RegExp, string][] = [
  // ── Thính giác ─────────────────────────────────────────────────────
  [/\bPhonak Lyric\b/g, 'A-200 Personal Sound Amplifier'],
  [/\bOticon More\b/g, 'Oticon Amigo T31'],
  [/\bBellman\b(?:\s*&\s*Symfon)?/g, 'Clarity AlertMaster AL10'],
  [/\bRoger FM System\b/g, 'StreamLine Mic'],
  [/\bRoger FM\b/g, 'StreamLine Mic'],
  // ── Thị giác ───────────────────────────────────────────────────────
  [/\bRuby HD\b/g, 'Ruby Series'],
  [/\bCCTV Magnifier\b/g, 'Ruby Series'],
  [/\bVoiceOver\b/g, 'Dragon Professional'],
  // ── Nhận thức ──────────────────────────────────────────────────────
  [/\bMedelert pill dispenser\b/g, 'Hopspot'],
  [/\bMedelert\b/g, 'Hopspot'],
  [/\bTime Timer\b/g, 'Skwitch'],
  // ── Cơ xương khớp ─────────────────────────────────────────────────
  [/\bIntegraMouse Plus\b/g, 'Smyle Mouse'],
  [/\bIntegraMouse\b/g, 'Smyle Mouse'],
  [/\bNeofect Smart Glove\b/g, 'Tecla-e'],
  [/\bNeofect\b/g, 'Tecla-e'],
  [/\bBioness L300 Go FES\b/g, 'Tobii PCEye 5 FES'],
  [/\bBioness L300 Go\b/g, 'Tobii PCEye 5'],
  [/\bBioness\b/g, 'Tobii PCEye 5'],
  // ── Di chuyển ─────────────────────────────────────────────────────
  [/\bScewo Bro \(leo cầu thang\)/g, 'WeWALK Smart Cane'],
  [/\bScewo Bro \(stair-climbing\)/g, 'WeWALK Smart Cane'],
  [/\bScewo Bro \(montée d'escalier\)/g, 'WeWALK Smart Cane'],
  [/\bScewo Bro \(صعود السلالم\)/g, 'WeWALK Smart Cane'],
  [/\bScewo Bro\b/g, 'WeWALK Smart Cane'],
  [/\bQuickie Q700-UP M\b/g, 'Lazarillo'],
  [/\bRollator Walker\b/g, 'GEWA Control Prog'],
  [/\bRollator\b/g, 'GEWA Control Prog'],
  // ── BTE/CIC/IIC: thuật ngữ, không phải tên sản phẩm MADA ────────
  // Giữ nguyên — nhưng thêm chú thích để bot không bịa link cho chúng.
  [/\bPhonak Audeo Lumity\b/g, 'A-200 Personal Sound Amplifier'],
];

const db = new Database(DB_PATH);
const agents = db.prepare('SELECT id, bot_id, name, system_prompt FROM admin_agents').all() as any[];

const updateStmt = db.prepare('UPDATE admin_agents SET system_prompt = ? WHERE id = ?');

let changed = 0;
console.log('═'.repeat(78));
console.log('ĐỒNG BỘ PROMPT BOT — THAY TÊN SẢN PHẨM BỊA BẰNG TÊN THẬT');
console.log('═'.repeat(78));

for (const a of agents) {
  const original = String(a.system_prompt || '');
  let next = original;
  const applied: string[] = [];

  for (const [re, to] of REPLACEMENTS) {
    if (re.test(next)) {
      const before = next;
      next = next.replace(re, to);
      if (before !== next) applied.push(`${re.source} → ${to}`);
    }
    re.lastIndex = 0;
  }

  if (next === original) {
    console.log(`➖ ${a.bot_id || a.id}: không có tên bịa nào`);
    continue;
  }

  changed++;
  console.log(`✏️  ${a.bot_id || a.id} (${a.name}):`);
  for (const s of applied) console.log(`      ${s}`);

  if (!CHECK_ONLY) updateStmt.run(next, a.id);
}

console.log('');
console.log(
  CHECK_ONLY
    ? `🔍 CHECK: ${changed}/${agents.length} bot có tên bịa (chưa ghi vào DB)`
    : `💾 Đã cập nhật ${changed}/${agents.length} bot trong DB`
);

db.close();
