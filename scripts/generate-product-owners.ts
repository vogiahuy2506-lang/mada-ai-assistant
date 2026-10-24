/**
 * ⭐ SINH `data/mada-product-owners.json` — BẢNG CHỦ SỞ HỮU CHÍNH của sản phẩm.
 *
 * VÌ SAO CẦN BẢNG NÀY:
 * MADA khai sản phẩm thuộc NHIỀU danh mục (cross-listing). Ví dụ
 * `Tobii PCEye 5` nằm ở cả "Neuromusculoskeletal Movement" (Bot 5) và
 * "Mobility & Transportation" (Bot 6); `Dragon Professional` nằm ở 5 danh mục.
 *
 * Nếu chỉ dùng membership (multi-label) thì mỗi bot thấy hàng chục sản phẩm
 * của bot khác → bot-mobility dẫn đầu bằng Tobii PCEye 5 / Quha Dwell
 * (nhập liệu thay thế) thay vì gậy thông minh / điều khiển môi trường.
 *
 * → Cần 1 "chủ sở hữu CHÍNH" cho mỗi sản phẩm. Thứ tự ưu tiên:
 *   1. `CURATED` — bảng rà soát thủ công (Bot 6: di chuyển / sống độc lập).
 *   2. `home-leaf` — danh mục MADA gốc trên TRANG SẢN PHẨM (chuyên môn
 *      thật của sản phẩm), nếu bot đó cũng nằm trong membership.
 *   3. `archive độc quyền` — sản phẩm chỉ nằm trong 1 danh mục MADA.
 *   4. fallback — bot đầu tiên trong membership.
 *
 * Kết quả được COMMIT vào `data/mada-product-owners.json` để runtime KHÔNG
 * phụ thuộc file crawl cache (git-ignored) — deploy lên VPS vẫn đúng.
 *
 * Usage:
 *   npx tsx scripts/generate-product-owners.ts          # ghi file
 *   npx tsx scripts/generate-product-owners.ts --check  # chỉ kiểm tra diff
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const CATEGORIES_PATH = path.join(ROOT, 'data', 'mada-product-categories.json');
const TAXONOMY_PATH = path.join(ROOT, 'data', 'mada-product-taxonomy.json');
const OWNERS_PATH = path.join(ROOT, 'data', 'mada-product-owners.json');
const DB_PATH = path.join(ROOT, 'data', 'mada.db');

const CHECK_ONLY = process.argv.includes('--check');

function norm(u: string | null | undefined): string {
  return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

/** archive membership (danh mục MADA) → botId */
const ARCHIVE_TO_BOT: Record<string, string> = {
  hearing: 'bot-hearing',
  vision: 'bot-vision',
  'voice-and-speech': 'bot-speech',
  cognition: 'bot-cognitive',
  mobility: 'bot-neuro',
  'daily_living': 'bot-mobility',
};

/** home-leaf breadcrumb (chuyên môn gốc) → botId */
const LEAF_TO_BOT: Record<string, string> = {
  'Sensory – Hearing': 'bot-hearing',
  'Sensory – Vision': 'bot-vision',
  'Voice and Speech': 'bot-speech',
  Communication: 'bot-speech',
  'Mental - Cognitive': 'bot-cognitive',
  'Neuromusculoskeletal Movement': 'bot-neuro',
  '1-2-Switch': 'bot-neuro',
};

/**
 * ⭐ CURATED — sản phẩm thuộc chuyên môn "di chuyển / sống độc lập"
 * (Bot 6) theo BẢN CHÂN CỦA MADA (Mobility & Transportation / Environmental
 * Control), không phải thiết bị nhập liệu thay thế (Bot 5).
 *
 * Ghi chú: MADA Qatar KHÔNG bán xe lăn / xe điện / khung đi. Danh mục
 * "Mobility & Transportation" của họ gần như chỉ có: gậy thông minh, ứng dụng
 * định vị tự hành, và bộ điều khiển môi trường (ECU) giúp người khuyết tật
 * tự điều khiển nhà/máy móc → đúng chuyên môn "sống độc lập" của Bot 6.
 */
const CURATED: Record<string, string> = {
  // ── Di chuyển / định vị ───────────────────────────────────────────
  'https://at.mada.org.qa/technology/wewalk-smart-cane/': 'bot-mobility',
  'https://at.mada.org.qa/technology/lazarillo/': 'bot-mobility',
  // ── Điều khiển môi trường (sống độc lập tại nhà / nơi làm việc) ──────
  'https://at.mada.org.qa/technology/primo-environment-control/': 'bot-mobility',
  'https://at.mada.org.qa/technology/housemate/': 'bot-mobility',
  'https://at.mada.org.qa/technology/gewa-control-prog/': 'bot-mobility',
  'https://at.mada.org.qa/technology/power-link-4-2/': 'bot-mobility',
};

/**
 * ⭐ Các sản phẩm ĐA NHIÃN nên ưu tiên cho bot chuyên môn gần nhất.
 */
const CURATED_ALSO: Record<string, string[]> = {
  // Sản phẩm AAC đa nhãn — chủ về bot-speech
  'https://at.mada.org.qa/technology/proloquo2go/': ['bot-speech'],
  'https://at.mada.org.qa/technology/proloquo4text/': ['bot-speech'],
};

/** Chuẩn hoá key để tra cứu khớp với `norm(product_url)`. */
const CURATED_BY_URL = new Map(
  Object.entries(CURATED).map(([u, b]) => [norm(u), b])
);
const CURATED_ALSO_BY_URL = new Map(
  Object.entries(CURATED_ALSO).map(([u, b]) => [norm(u), b])
);

function main() {
  const archive = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf-8')) as Record<string, string[]>;

  const leafOf = new Map<string, string>();
  if (fs.existsSync(TAXONOMY_PATH)) {
    const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf-8')) as Record<string, string[]>;
    for (const [url, arr] of Object.entries(taxonomy)) {
      if (!arr || arr.length < 7) continue;
      leafOf.set(norm(url), arr[3]);
    }
  }

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(
    'SELECT title, product_url, source_url FROM kb_products'
  ).all() as any[];
  db.close();

  // Gom theo URL chuẩn hoá → danh sách category membership
  const membership = new Map<string, Set<string>>();
  const titles = new Map<string, string>();
  for (const r of rows) {
    const raw = r.product_url || r.source_url;
    if (!raw) continue;
    const key = norm(raw);
    if (!membership.has(key)) membership.set(key, new Set());
    for (const c of archive[raw] || archive[r.product_url] || []) {
      membership.get(key)!.add(c);
    }
    if (!titles.has(key)) titles.set(key, r.title);
  }

  const owners: Record<string, string> = {};
  const stats: Record<string, number> = {};
  const reasons: Record<string, number> = {};

  for (const [key, cats] of membership) {
    const bots = [...new Set([...cats].map((c) => ARCHIVE_TO_BOT[c]).filter(Boolean))];
    let owner: string | undefined;
    let reason = '';

    // 1. CURATED
    const curated = CURATED_BY_URL.get(key);
    if (curated) {
      owner = curated;
      reason = 'curated';
    }

    // 1b. CURATED_ALSO (ưu tiên nhưng không bắt buộc)
    if (!owner) {
      const also = CURATED_ALSO_BY_URL.get(key);
      if (also && also.some((b) => bots.includes(b))) {
        owner = also.find((b) => bots.includes(b))!;
        reason = 'curated-also';
      }
    }

    // 2. home-leaf
    if (!owner) {
      const leaf = leafOf.get(key);
      const leafBot = leaf ? LEAF_TO_BOT[leaf] : undefined;
      if (leafBot && bots.includes(leafBot)) {
        owner = leafBot;
        reason = 'home-leaf';
      }
    }

    // 3. archive độc quyền
    if (!owner && bots.length === 1) {
      owner = bots[0];
      reason = 'archive-exclusive';
    }

    // 4. fallback
    if (!owner) {
      owner = bots[0] || 'bot-regulatory';
      reason = 'fallback';
    }

    owners[key] = owner;
    stats[owner] = (stats[owner] || 0) + 1;
    reasons[reason] = (reasons[reason] || 0) + 1;
  }

  // Ghi lại dưới dạng URL GỐC (có dấu "/" cuối) để khớp với product_url trong DB
  const finalOwners: Record<string, string> = {};
  for (const r of rows) {
    const raw = r.product_url || r.source_url;
    if (!raw) continue;
    const key = norm(raw);
    if (finalOwners[raw]) continue;
    if (owners[key]) finalOwners[raw] = owners[key];
  }

  const sorted: Record<string, string> = {};
  for (const k of Object.keys(finalOwners).sort()) sorted[k] = finalOwners[k];

  console.log('═'.repeat(70));
  console.log('CHỦ SỞ HỮU CHÍNH CỦA SẢN PHẨM');
  console.log('═'.repeat(70));
  for (const b of [
    'bot-hearing', 'bot-vision', 'bot-speech',
    'bot-cognitive', 'bot-neuro', 'bot-mobility', 'bot-regulatory',
  ]) {
    console.log(`${b.padEnd(16)} ${String(stats[b] || 0).padStart(3)}`);
  }
  console.log('\nLý do:');
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${r}`);
  }

  console.log('\nBot 6 (Mobility):');
  for (const [url, b] of Object.entries(sorted)) {
    if (b === 'bot-mobility') console.log(`  ${titles.get(norm(url)) || url}`);
  }

  const json = JSON.stringify(sorted, null, 2) + '\n';
  if (CHECK_ONLY) {
    const current = fs.existsSync(OWNERS_PATH)
      ? fs.readFileSync(OWNERS_PATH, 'utf-8')
      : '';
    console.log(
      current === json
        ? '\n✅ File đã up-to-date, không có thay đổi.'
        : '\n⚠️  File KHÁC với dữ liệu mới — cần chạy lại không có --check.'
    );
    return;
  }

  fs.writeFileSync(OWNERS_PATH, json);
  console.log(`\n💾 Ghi → ${path.basename(OWNERS_PATH)} (${Object.keys(sorted).length} sản phẩm)`);
}

main();