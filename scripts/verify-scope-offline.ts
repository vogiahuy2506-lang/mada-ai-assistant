/**
 * ⭐ KIỂM TRA LEAK OFFLINE — TOÀN BỘ catalog × 6 bot.
 *
 * Mạnh hơn nhiều so với "6 bot × 5 lượt" (kiểm tra online cần server chạy và
 * phụ thuộc LLM có trả lời đúng hướng không → chỉ đo được một phần nhỏ):
 *   - Mỗi bot được thử với TỪNG sản phẩm trong catalog.
 *   - Với mỗi sản phẩm, ta dựng câu trả lời có nhắc tên SP đó, rồi kiểm tra
 *     bot có bị "mang tên SP ngoài chuyên môn" ra không.
 *
 * ⭐ KIỂM TRA CẢ HAI CHIỀU:
 *   1. LEAK  — bot nhắc tên SP thuộc bot khác (vi phạm chuyên môn).
 *   2. MẤT   — bot ĐƯỢC nhắc SP của mình nhưng tên bị gỡ mất, hoặc tên còn
 *      nhưng KHÔNG có link → user thấy tên mà không thấy card (đúng triệu chứng
 *      "chỉ hiện tên, không hiện card").
 *
 * ⚠️ BASELINE: leak = 0.
 *   Trước đây leak = 42 (7 tiêu chuẩn/pháp lý × 6 bot) — vì 7 mục này nằm
 *   trong `knowledge_items` chứ không có trong file taxonomy MADA (chỉ gồm 243
 *   sản phẩm bán) → `botsForProduct()` trả [] → lớp lọc fail-open cho phép
 *   MỌI bot nhắc tới.
 *   Nay `productTaxonomy` tra thêm index dự phòng từ DB → 7 tiêu chuẩn thuộc
 *   `bot-regulatory` → không bot chuyên môn nào nhắc được → leak = 0.
 *
 *   Con số này PHẢI GIỮ NGUYÊN 0 — tăng → đã hỏng. Giảm → kiểm tra xem có
 *   xoá nhầm sản phẩm thật không (kiểm tra chiều ngược bên dưới).
 *
 * Usage: npx tsx scripts/verify-scope-offline.ts
 */

import { appendProductLinks } from '../server/lib/productLinkInjector';
import { buildProductCatalog } from '../server/lib/productLinker';
import { botsForProduct, primaryOwnerForProduct } from '../server/lib/productTaxonomy';

/** Số leak được phép. 0 = không bot nào được nhắc SP ngoài chuyên môn. */
const EXPECTED_LEAK = 0;

const BOTS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility',
];

const catalog = buildProductCatalog();

let leakCount = 0;
let leakCases = 0;
let checked = 0;

const leakSamples: string[] = [];

for (const bot of BOTS) {
  let botLeaks = 0;

  for (const entry of catalog) {
    const name = (entry.title || '').trim();
    const url = entry.product_url || entry.source_url || '';
    if (!name || !url) continue;

    // Sản phẩm thuộc chuyên môn bot này → không tính là leak (kể cả shared).
    const bots = botsForProduct(url);
    if (bots.includes(bot)) continue;

    // Bot này là chủ sở hữu chính thì cũng được nhắc.
    if (primaryOwnerForProduct(url) === bot) continue;

    checked++;

    // Dựng câu trả lời nhắc tên SP ngoài chuyên môn.
    const answer = `Với vai trò của mình, mình gợi ý **${name}** cho bạn nhé.`;
    const out = appendProductLinks(answer, bot);

    // Tên SP ngoài chuyên môn còn sót trong câu → LEAK.
    if (out.includes(name)) {
      leakCount++;
      botLeaks++;
      if (leakSamples.length < 12) {
        leakSamples.push(`${bot}: "${name}" → "${out.replace(/\n/g, ' ⏎ ')}"`);
      }
    }
  }

  console.log(
    `  ${bot.padEnd(15)} leak: ${botLeaks}` +
    (botLeaks === 0 ? '  ✅' : '  ❌')
  );
  leakCases += botLeaks === 0 ? 0 : 1;
}

console.log('\n' + '═'.repeat(74));
console.log(`Đã kiểm tra ${checked} cặp (sản phẩm ngoài chuyên môn × bot)`);
console.log(`Tổng leak: ${leakCount}`);
console.log('═'.repeat(74));

if (leakSamples.length) {
  console.log('\n  Mẫu leak:');
  for (const s of leakSamples) console.log('    - ' + s);
}

// ══════════════════════════════════════════════════════════════════════════
// CHIỀU NGƯỢC: sản phẩm ĐÚNG chuyên môn có bị mất (không còn tên / không link)?
// ══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(74));
console.log('CHIỀU NGƯỢC — SP đúng chuyên môn có bị MẤT không?');
console.log('═'.repeat(74));

let lostCount = 0;
let noLinkCount = 0;
const lostSamples: string[] = [];

for (const bot of BOTS) {
  let botLost = 0;
  let botNoLink = 0;

  for (const entry of catalog) {
    const name = (entry.title || '').trim();
    const url = entry.product_url || entry.source_url || '';
    if (!name || !url) continue;

    const bots = botsForProduct(url);
    if (!bots.includes(bot)) continue;

    const answer = `Mình gợi ý **${name}** cho bạn nhé.`;
    const out = appendProductLinks(answer, bot);

    if (!out.includes(name)) {
      botLost++;
      lostCount++;
      if (lostSamples.length < 12) {
        lostSamples.push(`${bot}: "${name}" → "${out.replace(/\n/g, ' ⏎ ')}"`);
      }
    } else if (!out.includes(url)) {
      // Tên còn nhưng KHÔNG có link → user thấy tên nhưng không thấy card.
      botNoLink++;
      noLinkCount++;
      if (lostSamples.length < 24) {
        lostSamples.push(`${bot}: "${name}" → THIẾU LINK: "${out.replace(/\n/g, ' ⏎ ')}"`);
      }
    }
  }

  console.log(
    `  ${bot.padEnd(15)} mất tên: ${botLost}   thiếu link: ${botNoLink}` +
    (botLost === 0 && botNoLink === 0 ? '  ✅' : '  ❌')
  );
}

if (lostSamples.length) {
  console.log('\n  Mẫu:');
  for (const s of lostSamples) console.log('    - ' + s);
}

console.log('\n' + '═'.repeat(74));
console.log(
  `KẾT QUẢ: leak=${leakCount} | mất tên=${lostCount} | thiếu link=${noLinkCount}`
);
console.log('═'.repeat(74));

// ⭐ Baseline: leak PHẢI bằng 0 (không bot nào nhắc SP ngoài chuyên môn).
// Tăng → đã hỏng. Giảm → phải kiểm tra có xoá nhầm sản phẩm thật không.
if (leakCount !== EXPECTED_LEAK) {
  console.log(
    `❌ leak=${leakCount} ≠ baseline ${EXPECTED_LEAK}` +
    (leakCount > EXPECTED_LEAK ? ' → ĐÃ HỎNG, có leak mới!' : ' → đã thay đổi, cần review')
  );
  process.exit(1);
}
console.log(`✅ leak giữ nguyên baseline (${EXPECTED_LEAK}) — không có leak mới`);

// Mất tên / thiếu link = regression nghiêm trọng (bot mất sản phẩm hợp lệ).
if (lostCount > 0 || noLinkCount > 0) {
  console.log(`❌ có sản phẩm hợp lệ bị mất: mất tên=${lostCount}, thiếu link=${noLinkCount}`);
  process.exit(1);
}
console.log('✅ không sản phẩm hợp lệ nào bị mất tên / thiếu link');
