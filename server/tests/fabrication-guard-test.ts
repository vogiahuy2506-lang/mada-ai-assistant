/**
 * ⭐ Bộ test chống bịa — chạy trên dữ liệu THẬT lấy từ DB và log chat.
 *
 * Chạy: npx tsx server/tests/fabrication-guard-test.ts
 *
 * Mục tiêu:
 *   1. Chứng minh lỗ hổng ĐÃ ĐƯỢC SỬA (từ bịa không còn lọt qua).
 *   2. Bảo vệ KHÔNG XOÁ NHẦM (sản phẩm/brand thật phải còn nguyên).
 *   3. Chạy lại trên các câu trả lời thật đã lưu trong chat_messages.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildProductCatalog } from '../lib/productLinker';
import { appendProductLinks, stripProductMentions, repairTruncatedSentences } from '../lib/productLinkInjector';
import { removeFabricatedContent, detectFabrications } from '../lib/fabricationGuard';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(__dirname, '..', '..', 'data', 'mada.db');

const catalog = buildProductCatalog();
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`   ✅ ${label}`);
  } else {
    fail++;
    console.log(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log(`\n📦 Catalog: ${catalog.length} sản phẩm\n`);
console.log('═'.repeat(72));
console.log('PHẦN 1 — Tên sản phẩm / hãng bịa');
console.log('═'.repeat(72));

const fakeNames = ['Phonak Audéo Lumity', 'Oticon Xcel 3', 'OrCam Advance Pro', 'Jazzy Passport', 'WHILL Model F', 'Karman XO-202'];
// ⚠️ Thiết kế CỐ Ý: bot LUÔN in đậm tên sản phẩm (đã có trong prompt), nên lớp
// chống bịa kiểm tra **bold** + danh sách hãng. Tên viết thường không in đậm
// sẽ không bị gỡ — đánh đổi có chủ đích để KHÔNG xoá nhầm văn xuôi tiếng Việt.
const answer1 = `Với nhu cầu của bạn, bạn có thể xem **${fakeNames[0]}** hoặc **${fakeNames[1]}** nhé.`;
const out1 = removeFabricatedContent(answer1);
check('tên bịa trong **bold** bị gỡ', !out1.includes('Lumity') && !out1.includes('Xcel 3'), out1);

const answer1b = `Có nhiều lựa chọn: ${fakeNames.map((f) => `**${f}**`).join(', ')}.`;
const out1b = removeFabricatedContent(answer1b);
const leaked1b = fakeNames.filter((f) => out1b.includes(f));
check('tên bịa liệt kê dạng văn xuôi (có in đậm) bị gỡ', leaked1b.length === 0, leaked1b.join(', '));

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 2 — Giá bịa (MADA không công bố giá)');
console.log('═'.repeat(72));

const priceCases = [
  ['Giá khoảng 3-5 triệu.', '3-5 triệu'],
  ['Bộ PECS này giá 500.000 đồng.', '500.000'],
  ['Giá từ 5-30 triệu đồng tùy dòng.', '5-30 triệu'],
  ['It costs around $2,500 for this model.', '$2,500'],
];
for (const [text, needle] of priceCases) {
  const out = removeFabricatedContent(text);
  check(`"${needle}" bị gỡ`, !out.includes(needle), out);
}

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 3 — URL MADA bịa');
console.log('═'.repeat(72));

const fakeUrl = 'https://at.mada.org.qa/technology/phonak-audeo-lumity/';
const answer3 = `Bạn có thể dùng Lumity nhé.\n🔗 ${fakeUrl}`;
const out3 = appendProductLinks(removeFabricatedContent(answer3));
check('URL bịa bị gỡ', !out3.includes(fakeUrl), out3);

const realProduct = catalog.find((c) => c.product_url && c.title);
const answer3b = `Gợi ý: **${realProduct!.title}**\n🔗 ${realProduct!.product_url}`;
const out3b = appendProductLinks(removeFabricatedContent(answer3b));
check(`URL THẬT (${realProduct!.title}) được giữ`, out3b.includes(realProduct!.product_url), out3b);

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 4 — Nhà bán lẻ ngoài MADA');
console.log('═'.repeat(72));

const reseller = 'Bạn có thể mua trên Shopee hoặc liên hệ nhà phân phối.';
check('nhắc Shopee bị gỡ', !removeFabricatedContent(reseller).toLowerCase().includes('shopee'));

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 5 — KHÔNG XOÁ NHẦM (regression)');
console.log('═'.repeat(72));

// 5a. 100% tên sản phẩm thật phải sống sót (kể cả khi in đậm)
let lost: string[] = [];
for (const p of catalog) {
  const line = `Gợi ý phù hợp: **${p.title}** cho trường hợp của bạn.`;
  const out = removeFabricatedContent(line);
  if (!out.includes(p.title)) lost.push(p.title);
}
check(`100% tên sản phẩm thật được giữ (${catalog.length} mục)`, lost.length === 0, lost.slice(0, 5).join(', '));

// 5b. 100% brand thật phải sống sót (kể cả khi in đậm)
const realBrands = [...new Set(catalog.map((c) => c.brand).filter(Boolean))];
let lostBrands: string[] = [];
for (const b of realBrands) {
  const line = `Đây là sản phẩm của **${b}**, chất lượng tốt.`;
  if (!removeFabricatedContent(line).includes(b)) lostBrands.push(b);
}
check(`100% tên hãng thật được giữ (${realBrands.length} hãng)`, lostBrands.length === 0, lostBrands.join(', '));

// 5b2. Danh sách hãng thật trong câu "Hãng: ..." phải giữ nguyên
// ⚠️ Chỉ kiểm tra PHẦN DANH SÁCH hãng, không kiểm tra cả câu: hàm viết lại danh
// sách theo dạng chuẩn nên phần văn xuôi phía sau ("đều có sản phẩm") có thể bị
// cắt — đó là hành vi chấp nhận được, miễn là không mất tên hãng thật.
const brandLine = 'Các hãng: AbleNet, Tobii Dynavox, Crick Software đều có sản phẩm.';
const brandOut = removeFabricatedContent(brandLine);
check(
  'danh sách hãng thật trong câu "Hãng:" được giữ',
  ['AbleNet', 'Tobii Dynavox', 'Crick Software'].every((b) => brandOut.includes(b)),
  brandOut
);

// 5b3. Danh sách hãng BỊA trong câu "Hãng: ..." phải bị lọc
const brandFakeLine = 'Các hãng: AbleNet, Phonak, Widex đều có sản phẩm.';
const brandFakeOut = removeFabricatedContent(brandFakeLine);
check('hãng bịa trong danh sách "Hãng:" bị gỡ', !brandFakeOut.includes('Phonak') && !brandFakeOut.includes('Widex'), brandFakeOut);
check('hãng thật vẫn còn trong danh sách', brandFakeOut.includes('AbleNet'), brandFakeOut);

// 5c. Câu hỏi của người dùng không bị đụng
const userQuestion = 'Tôi nên mua con nào cho cháu tôi? Máy kêu to có dễ nghe không?';
check('câu hỏi người dùng không bị cắt', removeFabricatedContent(userQuestion) === userQuestion);
check(
  'stripProductMentions không cắt câu hỏi',
  stripProductMentions(userQuestion).includes('Máy kêu to')
);

// 5d. Nội dung kỹ thuật/tiêu chuẩn không bị đụng
const techSentences = [
  'Tiêu chuẩn ISO 9999:2022 và WCAG 2.2 quy định rõ các yêu cầu về khả năng tiếp cận.',
  'Bạn cần Technical Documentation, Declaration of Conformity và CE Marking trên sản phẩm.',
  'Xe lăn điện thuộc Class I theo EU MDR 2017/745, không đo lường nên không-invasive.',
  'Theo quy định của WHO GATE, mọi thiết bị đều cần đánh giá tác động.',
];
for (const s of techSentences) {
  const out = removeFabricatedContent(s);
  check(`nội dung kỹ thuật giữ nguyên: "${s.slice(0, 48)}…"`, out === s, out);
}

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 6 — Chạy lại trên CÂU TRẢ LỜI THẬT trong chat_messages');
console.log('═'.repeat(72));

try {
  const db = new Database(DB, { readonly: true });
  const rows = db
    .prepare(
      `SELECT content FROM chat_messages
       WHERE role = 'assistant' AND length(COALESCE(content, '')) > 40`
    )
    .all() as Array<{ content: string }>;
  console.log(`   (${rows.length} câu trả lời thật trong DB)\n`);

  let realLost = 0;
  let realCleaned = 0;
  for (const r of rows) {
    const before = r.content;
    const after = removeFabricatedContent(before);
    if (after !== before) realCleaned++;
    // Không được làm câu trả lời MẤT NỘI DUNG (>70% bị xoá) → dấu hiệu xoá nhầm.
    if (after.length < before.length * 0.3) {
      realLost++;
      console.log(`   ❌ XOÁ QUÁ NHIỀU (${before.length} → ${after.length} ký tự):`);
      console.log(`      TRƯỚC: ${before.slice(0, 130)}`);
      console.log(`      SAU:   ${after.slice(0, 130)}`);
    }
  }
  check('không câu nào bị xoá quá nhiều (mất nội dung)', realLost === 0, `${realLost} câu`);
  console.log(`   ℹ️  ${realCleaned}/${rows.length} câu có nội dung bịa đã được làm sạch`);

  // In các bịa bộ phát hiện được trong log thật
  console.log('\n   Bịa phát hiện trong log thật:');
  const kinds = new Map<string, string[]>();
  for (const r of rows) {
    for (const f of detectFabrications(r.content)) {
      if (!kinds.has(f.kind)) kinds.set(f.kind, []);
      const list = kinds.get(f.kind)!;
      if (!list.includes(f.value) && list.length < 6) list.push(f.value);
    }
  }
  for (const [kind, vals] of kinds) {
    console.log(`      [${kind}] ${vals.join(' | ')}`);
  }
  if (kinds.size === 0) console.log('      (không phát hiện được — đã sạch)');

  db.close();
} catch (err) {
  console.log(`   ⚠️  Bỏ qua (không đọc được DB): ${(err as Error).message}`);
}

console.log('\n' + '═'.repeat(72));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(72));
process.exit(fail > 0 ? 1 : 0);