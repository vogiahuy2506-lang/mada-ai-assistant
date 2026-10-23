/**
 * Kiểm tra phân bổ sản phẩm theo bot — chạy TRƯỚC khi reindex để biết bot nào
 * sẽ nhận bao nhiêu sản phẩm, và phát hiện sản phẩm "mồ côi".
 *
 * ⚠️ Bắt được 2 bug thật khi viết script này:
 *   1. `communication` là alias chết (0 sản phẩm) → bot-speech không có gì
 *   2. Category `mobility` trộn xe lăn (Bot 6) + nẹp/chuột (Bot 5); map cứng
 *      `mobility → bot-neuro` khiến Bot 6 mất sạch xe lăn.
 *
 * Usage:
 *   npx tsx scripts/verify-product-coverage.ts
 */

import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

import { DB_CATEGORY_TO_MADA, resolveProductOwner } from '../server/lib/categoryMapping';

const DB_PATH = path.join(ROOT, 'data', 'mada.db');

/** Nhãn tiếng Việt của từng bot, dùng để báo cáo dễ đọc. */
const BOT_LABEL: Record<string, string> = {
  'bot-hearing': 'Thính giác',
  'bot-vision': 'Thị giác',
  'bot-speech': 'Giọng nói & Lời nói',
  'bot-cognitive': 'Nhận thức',
  'bot-neuro': 'Vận động thần kinh cơ xương',
  'bot-mobility': 'Di chuyển & Giao thông',
  'bot-regulatory': 'Tổng hợp / Tiêu chuẩn',
};

async function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const rows = db
    .prepare(
      `SELECT id, title, category, status
       FROM kb_products
       WHERE status = 'published'`
    )
    .all() as Array<{ id: string; title: string; category: string; status: string }>;

  db.close();

  console.log(`\n📦 Tổng sản phẩm published: ${rows.length}\n`);

  // 1) Phân bổ theo bot
  const byBot = new Map<string, number>();
  const orphans: Array<{ id: string; title: string; category: string }> = [];
  const catCount = new Map<string, number>();

  for (const r of rows) {
    catCount.set(r.category, (catCount.get(r.category) || 0) + 1);
    const owner = resolveProductOwner(r.category, r.title);
    if (!owner) {
      orphans.push({ id: r.id, title: r.title, category: r.category });
      continue;
    }
    byBot.set(owner.botId, (byBot.get(owner.botId) || 0) + 1);
  }

  console.log('━━━ Phân bổ theo bot ━━━');
  const allBots = Object.keys(BOT_LABEL);
  let minCount = Infinity;
  for (const b of allBots) {
    const n = byBot.get(b) || 0;
    minCount = Math.min(minCount, n);
    const pct = ((n / rows.length) * 100).toFixed(1);
    console.log(`  ${BOT_LABEL[b].padEnd(28)} ${String(n).padStart(4)} SP  (${pct}%)`);
  }

  console.log('\n━━━ Theo category trong DB ━━━');
  [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => {
      const owner = DB_CATEGORY_TO_MADA[c];
      const note = owner ? `→ ${owner.botId}` : '⚠️ KHÔNG map';
      console.log(`  ${c.padEnd(22)} ${String(n).padStart(4)} SP   ${note}`);
    });

  if (orphans.length > 0) {
    console.log(`\n━━━ ⚠️ ${orphans.length} sản phẩm mồ côi (không bot nào nhận) ━━━`);
    orphans.slice(0, 10).forEach((o) => console.log(`  [${o.category}] ${o.title}`));
    if (orphans.length > 10) console.log(`  … và ${orphans.length - 10} sản phẩm nữa`);
  } else {
    console.log('\n✅ Không có sản phẩm mồ côi');
  }

  // 2) Cảnh báo bot quá ít sản phẩm
  console.log('\n━━━ Cảnh báo ━━━');
  let warned = false;
  for (const b of allBots) {
    const n = byBot.get(b) || 0;
    // Bot tiêu chuẩn không bán sản phẩm → không cần cảnh báo
    if (b === 'bot-regulatory') continue;
    if (n < 20) {
      console.log(`  ⚠️  ${BOT_LABEL[b]} chỉ có ${n} sản phẩm — quá ít để tư vấn đa dạng`);
      warned = true;
    }
  }
  if (!warned) console.log('  ✅ Tất cả bot bán hàng đều có ≥ 20 sản phẩm');

  console.log(`\n==> Ít nhất: ${minCount} sản phẩm (bot yếu nhất)\n`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});