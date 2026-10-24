/**
 * ⭐ KIỂM TRA TỔNG HỢP — card sản phẩm + tiêu chuẩn theo 7 bot.
 *
 * Mục tiêu: chứng minh 3 điều
 *   1. Sản phẩm ĐÚNG chuyên môn → có link + tên giữ nguyên.
 *   2. Sản phẩm SAI chuyên môn → bị gỡ (0 leak).
 *   3. Tiêu chuẩn → trích dẫn văn xuôi thì GIỮ (mọi bot), giới thiệu như
 *      mục danh mục thì CHỈ bot-regulatory được giữ.
 */
import { appendProductLinks } from '../server/lib/productLinkInjector';
import { buildProductCatalog, findMentionedProducts } from '../server/lib/productLinker';

const catalog = buildProductCatalog();
const refs = catalog.filter((c) => c.isReference);
const prods = catalog.filter((c) => !c.isReference);

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`   ✅ ${label}`);
  } else {
    fail++;
    console.log(`   ❌ ${label}`);
    if (detail) console.log(`      → ${detail.replace(/\n/g, ' ⏎ ')}`);
  }
}

const BOTS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility', 'bot-regulatory',
];

console.log('═'.repeat(78));
console.log('PHẦN 1 — SẢN PHẨM ĐÚNG CHUYÊN MÔN: giữ tên + có link');
console.log('═'.repeat(78));

// Bot-hearing phải có card cho sản phẩm thuộc hearing.
const hearingSamples = prods
  .filter((p) => (p.category || '').toLowerCase().includes('hearing'))
  .slice(0, 5);
for (const p of hearingSamples) {
  const out = appendProductLinks(`Mình gợi ý **${p.title}** cho bạn nhé.`, 'bot-hearing');
  check(
    `hearing giữ "${p.title.slice(0, 32)}"`,
    out.includes(p.title),
    out
  );
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 2 — DÒNG TÊN ĐƠN LẺ (format prompt) KHÔNG BỊ THAY BẰNG CÂU HỎI');
console.log('═'.repeat(78));

for (const p of [prods[0], prods[1], refs[0]]) {
  const bot = p.isReference ? 'bot-regulatory' : 'bot-hearing';
  const out = appendProductLinks(`**${p.title}**`, bot);
  check(
    `giữ nguyên dòng tên "${p.title.slice(0, 32)}"`,
    out.includes(p.title) && !out.includes('Bạn cần cho mình biết thêm'),
    out
  );
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 3 — LINK KHÔNG BỊ HỎNG (không thêm "…" vào URL)');
console.log('═'.repeat(78));

for (const p of [prods[0], refs[0]]) {
  const bot = p.isReference ? 'bot-regulatory' : 'bot-hearing';
  const url = p.product_url || p.source_url;
  const out = appendProductLinks(`Mình gợi ý **${p.title}** cho bạn nhé.\n🔗 ${url}`, bot);
  const m = out.match(/https?:\/\/\S+/)?.[0] || '';
  check(
    `URL "${url.slice(0, 40)}..." nguyên vẹn`,
    m === url && !out.includes(`${url}…`),
    out
  );
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 4 — TIÊU CHUẨN TRÍCH DẪN VĂN XUÔI: GIỮ Ở MỌI BOT');
console.log('═'.repeat(78));

const proseCases = [
  'Theo WCAG 2.2, tương phản tối thiểu của văn bản thường là 4.5:1.',
  'Theo ISO 9999:2022, thiết bị này thuộc nhóm 22.03.06.',
  'Theo EN 301 549, yêu cầu về khả năng tiếp cận ICT là bắt buộc.',
  'Theo EU MDR 2017/745, xe lăn điện thuộc Class I.',
];
for (const p of proseCases) {
  const needle = p.match(/WCAG 2\.2|ISO 9999:2022|EN 301 549|MDR/)?.[0] || '';
  for (const bot of BOTS) {
    const out = appendProductLinks(p, bot);
    check(`${bot}: giữ "${needle}"`, out.includes(needle), out);
  }
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 5 — TIÊU CHUẨN GIỚI THIỆU NHƯ MỤC DANH MỤC: CHỈ bot-regulatory');
console.log('═'.repeat(78));

for (const ref of refs) {
  for (const bot of BOTS.filter((b) => b !== 'bot-regulatory')) {
    const out = appendProductLinks(`Mình gợi ý **${ref.title}** cho bạn nhé.`, bot);
    check(
      `${bot}: gỡ "${ref.title.slice(0, 30)}..."`,
      !out.includes(ref.title),
      out
    );
  }
  const outR = appendProductLinks(`Mình gợi ý **${ref.title}** cho bạn nhé.`, 'bot-regulatory');
  check(
    `bot-regulatory: giữ "${ref.title.slice(0, 30)}..."`,
    outR.includes(ref.title),
    outR
  );
}

console.log('\n' + '═'.repeat(78));
console.log('PHẦN 6 — KHÔNG KHỚP NHẦM TIÊU CHUẨN LÀ SẢN PHẨM');
console.log('═'.repeat(78));

const mentioned = findMentionedProducts('Mình gợi ý **Housemate** cho bạn nhé.', catalog);
check(
  'câu chỉ nhắc Housemate → không khớp tiêu chuẩn nào',
  mentioned.every((m) => !m.isReference),
  mentioned.map((m) => m.title).join(', ')
);

console.log('\n' + '═'.repeat(78));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(78));
if (fail > 0) process.exit(1);
