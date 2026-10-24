/**
 * ⭐ KIỂM TRA 2 CHIỀU cho TIÊU CHUẨN (reference documents).
 *
 * 1) TRÍCH DẪN trong văn xuôi → PHẢI GIỮ (mọi bot), và link phải ĐÚNG bản.
 * 2) GIỚI THIỆU như mục danh mục (in đậm tên đầy đủ) → PHẢI BỊ GỠ (bot khác).
 */
import { appendProductLinks } from '../server/lib/productLinkInjector';
import { buildProductCatalog, findMentionedProducts } from '../server/lib/productLinker';

const BOTS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility',
];

const catalog = buildProductCatalog();
const refs = catalog.filter((c) => c.isReference);

let pass = 0, fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`   ✅ ${label}`); }
  else { fail++; console.log(`   ❌ ${label}  ${detail}`); }
}

console.log('═'.repeat(78));
console.log('PHẦN 1 — TRÍCH DẪN TRONG VĂN XUÔI → PHẢI GIỮ');
console.log('═'.repeat(78));

const proseCases = [
  'Theo WCAG 2.2, tương phản tối thiểu của văn bản thường là 4.5:1.',
  'Theo ISO 9999:2022, thiết bị này thuộc nhóm 22.03.06.',
  'Checklist WCAG 2.2 AA cốt lõi: 1) Ảnh có alt text, 2) Tương phản ≥ 4.5:1.',
  'Theo EU MDR 2017/745, xe lăn điện thuộc Class I.',
  'Theo EN 301 549, yêu cầu về khả năng tiếp cận ICT là bắt buộc.',
];

for (const p of proseCases) {
  for (const bot of BOTS) {
    const out = appendProductLinks(p, bot);
    // Tên tiêu chuẩn phải còn nguyên trong câu.
    const m = p.match(/(WCAG 2\.2|ISO 9999:2022|EN 301 549|MDR)/);
    check(`${bot}: giữ trích dẫn "${m?.[0]}"`, out.includes(m?.[0] || 'X'), out);
  }
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 2 — GIỚI THIỆU NHƯ MỤC DANH MỤC (in đậm tên đầy đủ) → PHẢI BỊ GỠ');
console.log('═'.repeat(78));

for (const ref of refs) {
  const answer = `Mình gợi ý **${ref.title}** cho bạn nhé.`;
  for (const bot of BOTS) {
    const out = appendProductLinks(answer, bot);
    check(
      `${bot}: gỡ "${ref.title.slice(0, 34)}..."`,
      !out.includes(ref.title),
      out.replace(/\n/g, ' ⏎ ')
    );
  }
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 3 — LINK TRÍCH DẪN PHẢI ĐÚNG BẢN (không nhầm phiên bản)');
console.log('═'.repeat(78));

// "WCAG 2.1" KHÔNG được gắn link WCAG 2.2.
const wcag21 = 'So sánh WCAG 2.1 với bản mới.';
const out21 = appendProductLinks(wcag21, 'bot-vision');
check('"WCAG 2.1" KHÔNG bị gắn link WCAG 2.2', !out21.includes('WCAG22'), out21);

// "WCAG 2.2" trong văn xuôi → link về trang gốc (không phải #new).
const out22 = appendProductLinks('Theo WCAG 2.2 nhé.', 'bot-vision');
const linked22 = out22.match(/https?:\/\/\S+/)?.[0] || '(không có link)';
check(
  '"WCAG 2.2" trích dẫn → link trang gốc (không #new)',
  linked22.includes('WCAG22') && !linked22.includes('#new'),
  linked22
);

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 4 — bot-regulatory ĐƯỢC biến tiêu chuẩn thành card');
console.log('═'.repeat(78));
for (const ref of refs) {
  const out = appendProductLinks(`Mình gợi ý **${ref.title}** cho bạn nhé.`, 'bot-regulatory');
  check(
    `bot-regulatory giữ "${ref.title.slice(0, 30)}..."`,
    out.includes(ref.title),
    out.replace(/\n/g, ' ⏎ ')
  );
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 5 — KHÔNG khớp nhầm tiêu chuẩn là sản phẩm');
console.log('═'.repeat(78));
// Chỉ nên khớp tiêu chuẩn khi có mặt trong câu.
const mentioned = findMentionedProducts('Mình gợi ý **Housemate** cho bạn nhé.', catalog);
check(
  'câu chỉ nhắc Housemate → không khớp tiêu chuẩn nào',
  mentioned.every((m) => !m.isReference),
  mentioned.map((m) => m.title).join(' | ')
);

console.log('\n' + '═'.repeat(78));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(78));
if (fail > 0) process.exit(1);
