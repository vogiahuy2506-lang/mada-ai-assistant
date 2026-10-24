/**
 * ⭐ TEST lọc chuyên môn sản phẩm trong câu trả lời.
 *
 * Bối cảnh: `appendProductLinks()` trước đây gắn link cho MỌI tên sản phẩm
 * có thật trong DB, kể cả tên thuộc bot KHÁC. Hậu quả: bot-mobility trả lời
 * kèm "CoughDrop AAC" (thuộc bot-speech) + link → người dùng thấy bot giới
 * thiệu thiết bị không đúng chuyên môn.
 *
 * Chạy: npx tsx server/tests/product-scope-test.ts
 */

import { appendProductLinks } from '../lib/productLinkInjector';
import { normalizeProductName } from '../lib/productLinker';
import { botsForProduct, primaryOwnerForProduct } from '../lib/productTaxonomy';

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass++;
    console.log(`   ✅ ${label}`);
  } else {
    fail++;
    console.log(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('═'.repeat(74));
console.log('PHẦN 1 — Lọc theo chuyên môn bot');
console.log('═'.repeat(74));

// Tìm 2 sản phẩm thật: 1 đa nhãn (thuộc nhiều bot), 1 chỉ thuộc 1 bot.
const CANDIDATES: Array<{ url: string; title: string }> = [
  {
    url: 'https://at.mada.org.qa/technology/coughdrop-aac/',
    title: 'CoughDrop AAC',
  },
  {
    url: 'https://at.mada.org.qa/technology/housemate/',
    title: 'Housemate',
  },
  {
    url: 'https://at.mada.org.qa/technology/wewalk-smart-cane/',
    title: 'WeWALK Smart Cane',
  },
];

for (const c of CANDIDATES) {
  const bots = botsForProduct(c.url);
  const owner = primaryOwnerForProduct(c.url);
  console.log(
    `   ℹ️  ${c.title.padEnd(20)} bots=${(bots.join(',') || 'NONE').padEnd(38)} owner=${owner || '-'}`
  );
}

// Bot-mobility KHÔNG được nhắc "CoughDrop AAC" (thuộc speech/neuro/cognitive).
const mobilityAnswer =
  'Mình gợi ý **CoughDrop AAC** và **Housemate** cho bạn nhé.';

const outMobility = appendProductLinks(mobilityAnswer, 'bot-mobility');
check(
  'bot-mobility: tên SP ngoài chuyên môn bị gỡ',
  !outMobility.includes('CoughDrop AAC'),
  outMobility
);
check(
  'bot-mobility: tên SP thuộc chuyên môn được GIỮ',
  outMobility.includes('Housemate'),
  outMobility
);
check(
  'bot-mobility: không gắn link cho SP ngoài chuyên môn',
  !outMobility.includes('coughdrop-aac'),
  outMobility
);

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 2 — Không lọc nhầm sản phẩm của chính bot');
console.log('═'.repeat(74));

// bot-mobility phải giữ được toàn bộ SP riêng của mình.
for (const c of CANDIDATES) {
  const bots = botsForProduct(c.url);
  if (!bots.includes('bot-mobility')) continue;
  const out = appendProductLinks(`Gợi ý **${c.title}** cho bạn.`, 'bot-mobility');
  check(`bot-mobility giữ được "${c.title}"`, out.includes(c.title), out);
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 3 — Ngoại lệ: user hỏi thẳng sản phẩm');
console.log('═'.repeat(74));

const directAnswer = '**CoughDrop AAC** là ứng dụng giao tiếp cho iPad.';
const allow = new Set([normalizeProductName('CoughDrop AAC')]);
const outAllowed = appendProductLinks(directAnswer, 'bot-mobility', allow);
check(
  'user hỏi thẳng SP ngoài chuyên môn → bot vẫn trả lời được',
  outAllowed.includes('CoughDrop AAC'),
  outAllowed
);

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 4 — Fail-open (không lọc nhầm)');
console.log('═'.repeat(74));

check(
  'bot-regulatory (Thông tin bổ trợ) xem được toàn bộ danh mục',
  appendProductLinks(directAnswer, 'bot-regulatory').includes('CoughDrop AAC')
);
check(
  'không truyền botId → không lọc (giữ nguyên hành vi cũ)',
  appendProductLinks(directAnswer).includes('CoughDrop AAC')
);
check(
  'custom agent (không phải bot-*) → fail-open, không xoá',
  appendProductLinks(directAnswer, 'my-custom-agent').includes('CoughDrop AAC')
);

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 5 — Không làm hỏng nội dung khác');
console.log('═'.repeat(74));

const prose =
  'Với vai trò là Trợ lý Di chuyển, mình tập trung vào các giải pháp giúp bạn di chuyển an toàn.';
const outProse = appendProductLinks(prose, 'bot-mobility');
check(
  'văn xuôi không đổi khi không có tên SP',
  outProse.trim() === prose.trim(),
  outProse
);

const techAnswer =
  'Theo quy định của WHO GATE, mọi thiết bị đều cần đánh giá tác động.';
check(
  'nội dung kỹ thuật giữ nguyên',
  appendProductLinks(techAnswer, 'bot-mobility').includes('WHO GATE')
);

console.log('\n' + '═'.repeat(74));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(74));

if (fail > 0) process.exit(1);
