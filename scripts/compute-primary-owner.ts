/**
 * ⭐ Tính "chủ sở hữu chính" (primary owner) cho từng sản phẩm.
 *
 * Quy tắc:
 *  1. Ưu tiên home-leaf breadcrumb của site MADA (danh mục mà sản phẩm
 *     đang nằm ở trên trang sản phẩm) — đây là CHUYÊN MÔN gốc của sản phẩm.
 *  2. Nếu home-leaf không quyết định được → dùng archive membership:
 *     nếu sản phẩm chỉ nằm trong 1 archive → bot đó là chủ.
 *  3. Bảng ưu tiên THỦ CÔNG cho các trường hợp đặc biệt (Bot 6).
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const archive = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-categories.json'), 'utf-8')
) as Record<string, string[]>;
const taxonomy = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'mada-product-taxonomy.json'), 'utf-8')
) as Record<string, string[]>;

function norm(u: string | null | undefined): string {
  return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

const ARCHIVE2BOT: Record<string, string> = {
  hearing: 'bot-hearing',
  vision: 'bot-vision',
  'voice-and-speech': 'bot-speech',
  cognition: 'bot-cognitive',
  mobility: 'bot-neuro',
  'daily_living': 'bot-mobility',
};

const LEAF2BOT: Record<string, string> = {
  'Sensory – Vision': 'bot-vision',
  'Voice and Speech': 'bot-speech',
  Communication: 'bot-speech',
  'Mental - Cognitive': 'bot-cognitive',
  'Neuromusculoskeletal Movement': 'bot-neuro',
  '1-2-Switch': 'bot-neuro',
};

/** ⭐ Ưu tiên thủ công: sản phẩm thực sự thuộc "di chuyển / đi lại" */
const MANUAL_PRIMARY: Record<string, string> = {
  'https://at.mada.org.qa/technology/wewalk-smart-cane/': 'bot-mobility',
  'https://at.mada.org.qa/technology/lazarillo/': 'bot-mobility',
  'https://at.mada.org.qa/technology/esight-4/': 'bot-mobility',
};

const leafOf = new Map<string, string>();
for (const [url, arr] of Object.entries(taxonomy)) {
  if (!arr || arr.length < 7) continue;
  leafOf.set(norm(url), arr[3]);
}

const db = new Database(path.join(ROOT, 'data', 'mada.db'), { readonly: true });
const rows = db.prepare(
  'SELECT title, category, product_url FROM kb_products'
).all() as any[];
db.close();

const byTitle = new Map<string, any>();
for (const r of rows) {
  if (!byTitle.has(r.title)) {
    byTitle.set(r.title, { title: r.title, url: r.product_url, arch: new Set<string>() });
  }
  const e = byTitle.get(r.title)!;
  for (const c of archive[r.product_url] || []) e.arch.add(c);
}

const primary = new Map<string, string>();
const reason = new Map<string, string>();

for (const e of byTitle.values()) {
  const bots = [...new Set([...e.arch].map((c) => ARCHIVE2BOT[c]).filter(Boolean))];

  const manual = MANUAL_PRIMARY[e.url];
  if (manual) {
    primary.set(e.title, manual);
    reason.set(e.title, 'thủ công');
    continue;
  }

  const leaf = leafOf.get(norm(e.url));
  const leafBot = leaf ? LEAF2BOT[leaf] : undefined;
  if (leafBot && bots.includes(leafBot)) {
    primary.set(e.title, leafBot);
    reason.set(e.title, `home-leaf ${leaf}`);
    continue;
  }
  if (bots.length === 1) {
    primary.set(e.title, bots[0]);
    reason.set(e.title, 'archive độc quyền');
    continue;
  }
  primary.set(e.title, bots[0] || 'bot-regulatory');
  reason.set(e.title, 'fallback');
}

const counts: Record<string, number> = {};
const byBot: Record<string, string[]> = {};
for (const [t, b] of primary) {
  counts[b] = (counts[b] || 0) + 1;
  (byBot[b] ||= []).push(t);
}

console.log('═'.repeat(70));
console.log('CHỦ SỞ HỮU CHÍNH SAU KHI SỬA');
console.log('═'.repeat(70));
for (const b of [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility', 'bot-regulatory',
]) {
  console.log(`${b.padEnd(16)} ${String(counts[b] || 0).padStart(3)}`);
}

console.log('\n--- lý do phân bổ ---');
const byReason: Record<string, number> = {};
for (const r of reason.values()) byReason[r] = (byReason[r] || 0) + 1;
for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${r}`);
}

console.log('\n--- Bot 6 (Mobility) sẽ dẫn đầu bằng ---');
console.log((byBot['bot-mobility'] || []).join(', '));

console.log('\n--- Bot 5 (Neuro) — 15 sản phẩm đầu ---');
console.log((byBot['bot-neuro'] || []).slice(0, 15).join(', '));

console.log('\n--- Bot 1 (Hearing) — 10 sản phẩm đầu ---');
console.log((byBot['bot-hearing'] || []).slice(0, 10).join(', '));

// Xuất file curation
const out: Record<string, { title: string; url: string }[]> = {};
for (const [t, b] of primary) {
  const e = byTitle.get(t)!;
  (out[b] ||= []).push({ title: t, url: e.url });
}
for (const k of Object.keys(out)) out[k].sort((a, b) => a.title.localeCompare(b.title));

fs.writeFileSync(
  path.join(ROOT, '.tmp_crops', 'primary-owner.json'),
  JSON.stringify(out, null, 2)
);
console.log('\n📄 .tmp_crops/primary-owner.json');
