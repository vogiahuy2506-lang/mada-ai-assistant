/**
 * ⭐ TEST HỒI QUY — khớp tên sản phẩm & gắn link.
 *
 * VÌ SAO CẦN:
 * Ba lỗi dưới đây đều rất "âm thầm" — không làm hỏng app, chỉ làm hỏng
 * CHẤT LƯỢNG câu trả lời, nên rất dễ tái phát mà không ai nhận ra:
 *
 * 1. RANH GIỚI TỪ `\b` KHÔNG TỒN TẠI khi tên SP nằm cạnh ký tự non-word.
 *    - `**Optelec ClearReader+**` → sau `+` là `*` → không có `\b` → KHÔNG
 *      gắn link → user thấy tên nhưng KHÔNG thấy card.
 *    - `**A-200 Personal Sound Amplifier**` → sau tên là `*` → không có `\b`.
 *    - `**Clicker 8 (English and Arabic)**` → sau `)` là `*` → không có `\b`.
 *
 * 2. TÊN BỌC TRONG `**BOLD**` KHÔNG BỊ GỠ khi chưa đủ 4 câu hỏi — regex cũ
 *    chỉ cho phép MỘT dấu `*` trước tên, nên `**Tên**` không khớp.
 *
 * 3. TÊN NGẮN TRÙNG TỪ THƯỜNG ("Clicker", "Pearl") bị gỡ nhầm → câu hỏng
 *    ("dùng một clicker nhỏ gọn" → "dùng một nhỏ gọn").
 *
 * 4. TÊN NGẮN LÀ SUBSTRING CỦA TÊN DÀI ("Clicker" ⊂ "Dwell Clicker 2") →
 *    gỡ nhầm làm méo tên ("Dwell Clicker 2" → "Dwell 2").
 *
 * Chạy: npx tsx server/tests/product-name-matching-test.ts
 */

import { appendProductLinks, stripProductMentions } from '../lib/productLinkInjector';
import { findMentionedProducts, buildProductCatalog } from '../lib/productLinker';
import { botsForProduct } from '../lib/productTaxonomy';

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

const catalog = buildProductCatalog();
const catByTitle = new Map<string, string>();
for (const e of catalog) {
  if (e.title) catByTitle.set(e.title.trim(), e.product_url || e.source_url || '');
}

/** Bot nào ĐƯỢC nhắc sản phẩm này (lấy từ taxonomy, không hardcode). */
function ownerBotOf(name: string): string | null {
  const url = catByTitle.get(name);
  if (!url) return null;
  const bots = botsForProduct(url);
  return bots.length ? bots[0] : null;
}

console.log('═'.repeat(74));
console.log('PHẦN 1 — TÊN KẾT THÚC BẰNG KÝ TỰ ĐẶC BIỆT VẪN ĐƯỢC GẮN LINK');
console.log('═'.repeat(74));

// Trước fix: các tên này KHÔNG có link (đúng triệu chứng "chỉ hiện tên,
// không hiện card").
const SPECIAL_SUFFIX = [
  'Optelec ClearReader+',
  'Clicker 8 (English and Arabic)',
  'Chatpack Desktop Sound Field System (Model TA-1)',
  'Accuratus Monster 2 (English)',
  'Snap & Read (English/Arabic)',
  'Primo+ Environment Control',
  'Hook+ Switch Interface',
];

for (const name of SPECIAL_SUFFIX) {
  const url = catByTitle.get(name);
  const bot = ownerBotOf(name);
  if (!url || !bot) {
    console.log(`   ➖ bỏ qua "${name}" (không có trong catalog)`);
    continue;
  }
  const out = appendProductLinks(`Gợi ý **${name}** nhé.`, bot);
  check(
    `"${name}" được gắn link (bot ${bot})`,
    out.includes('🔗') && out.includes(url),
    out
  );
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 2 — TÊN BỌC TRONG **BOLD** ĐƯỢC Gỡ KHI CHƯA ĐỦ 4 CÂU');
console.log('═'.repeat(74));

const boldCases = [
  'A-200 Personal Sound Amplifier',
  'OrCam MyEye',
  'Optelec ClearReader+',
  'CoughDrop AAC',
  'WeWALK Smart Cane',
  'Dwell Clicker 2',
];

for (const name of boldCases) {
  const text = `Mình gợi ý **${name}** cho bạn nhé.`;
  const out = stripProductMentions(text);
  check(
    `"${name}" bị gỡ khỏi câu (kể cả khi bọc bold)`,
    !out.includes(name) && !out.includes('**'),
    out
  );
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 3 — TÊN NGẮN TRÙNG TỪ THƯỜNG KHÔNG BỊ XOÁ NHẦM');
console.log('═'.repeat(74));

// "clicker" / "pearl" viết thường là TỪ TIẾNG ANH, không phải tên SP.
const commonWordCases = [
  { bot: 'bot-vision', text: 'Bạn có thể điều khiển thiết bị bằng một clicker đơn giản.' },
  { bot: 'bot-speech', text: 'Giao diện có một nút clicker rõ ràng để người dùng chọn.' },
  { bot: 'bot-mobility', text: 'Bạn có thể dùng một pearl nhỏ gọn cho cổ tay.' },
];

for (const c of commonWordCases) {
  const out = appendProductLinks(c.text, c.bot);
  const word = c.text.match(/\b(clicker|pearl)\b/i)?.[1] || '';
  check(
    `${c.bot}: giữ từ thường "${word}" (không phải tên sản phẩm)`,
    out.toLowerCase().includes(word),
    out
  );
}

// Ngược lại: bot ĐƯỢC nhắc tên SP viết HOA THƯỜNG thì phải giữ.
for (const [name, bot] of [
  ['Clicker', 'bot-neuro'],
  ['Clicker', 'bot-cognitive'],
  ['Pearl', 'bot-vision'],
] as Array<[string, string]>) {
  const out = appendProductLinks(`Mình gợi ý **${name}** cho bạn nhé.`, bot);
  check(`${bot} giữ được "${name}" (đúng hoa thường)`, out.includes(name), out);
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 4 — TÊN DÀI CHỨA TÊN NGẮN KHÔNG BỊ MÉO');
console.log('═'.repeat(74));
// "Dwell Clicker 2" chứa "Clicker" → khi gỡ phải gỡ TRỌN tên, không để lửng
// "Dwell 2" hay "SmartNav 4 with".
const nestedCases = [
  { name: 'Dwell Clicker 2', bot: 'bot-mobility', dangling: ['Dwell 2', 'Clicker 2'] },
  {
    name: 'SmartNav 4 with Dwell clicker 2',
    bot: 'bot-mobility',
    dangling: ['SmartNav 4 with', 'Dwell 2'],
  },
  { name: 'Cosmo Switch', bot: 'bot-neuro', dangling: ['Cosmo', 'Osmo'] },
];

for (const c of nestedCases) {
  const text = `Mình gợi ý **${c.name}** cho bạn nhé.`;

  // appendProductLinks: bot ĐƯỢC nhắc SP này → phải giữ nguyên tên + gắn link.
  const out = appendProductLinks(text, c.bot);
  check(
    `appendProductLinks giữ nguyên "${c.name}"`,
    out.includes(c.name),
    out
  );

  // stripProductMentions: phải gỡ TRỌN tên, không để lửng mảnh vỡ.
  const stripped = stripProductMentions(text);
  const leftover = c.dangling.filter((d) => stripped.includes(d));
  check(
    `stripProductMentions gỡ trọn "${c.name}" (không để lửng)`,
    !stripped.includes(c.name) && leftover.length === 0,
    leftover.length ? `còn lửng: ${leftover.join(', ')} | out="${stripped}"` : `out="${stripped}"`
  );
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 5 — LIST ITEM CHỨA TỪ THƯỜNG KHÔNG BỊ XOÁ HẲN DÒNG');
console.log('═'.repeat(74));

// Trước fix: `mentionsCatalogProduct()` so khớp không phân biệt hoa thường
// → dòng "- dùng một clicker nhỏ gọn" bị xoá HẲN (mất cả nội dung).
const listCommonWord = [
  '- dùng một clicker nhỏ gọn',
  '- bạn có thể dùng pearl nhỏ gọn',
];
for (const line of listCommonWord) {
  const out = stripProductMentions(line);
  check(
    `giữ nguyên list item chứa từ thường: "${line}"`,
    out.trim() === line.trim(),
    `out="${out}"`
  );
}

// Ngược lại: list item chứa TÊN SP thật phải bị xoá.
const listRealProduct = [
  '- OrCam MyEye',
  '- Dwell Clicker 2',
  '- Optelec ClearReader+',
];
for (const line of listRealProduct) {
  const out = stripProductMentions(line);
  check(
    `xoá list item chứa tên SP thật: "${line}"`,
    out.trim() === '',
    `out="${out}"`
  );
}

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 6 — KHỚP CHỒNG LẤN: CHỈ NHẬN TÊN DÀI NHẤT');
console.log('═'.repeat(74));

const mentioned = findMentionedProducts('Mình gợi ý **Dwell Clicker 2** cho bạn nhé.');
const titles = mentioned.map((m) => m.title);
check(
  'không khớp cả "Clicker" lẫn "Dwell Clicker 2"',
  !titles.includes('Clicker') && titles.includes('Dwell Clicker 2'),
  titles.join(' | ')
);

console.log('\n' + '═'.repeat(74));
console.log('PHẦN 7 — VĂN XUÔI KHÔNG BỊ HỎNG');
console.log('═'.repeat(74));

const prose = [
  'Với vai trò là Trợ lý Di chuyển, mình tập trung vào các giải pháp giúp bạn di chuyển an toàn.',
  'Theo quy định của WHO GATE, mọi thiết bị đều cần đánh giá tác động.',
  'Bạn nên đi khám bác sĩ chuyên khoa để xác định nguyên nhân chính xác nhất.',
];

for (const p of prose) {
  const out = appendProductLinks(p, 'bot-mobility');
  check('văn xuôi giữ nguyên', out.trim() === p.trim(), `out="${out}"`);
}

console.log('\n' + '═'.repeat(74));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(74));

if (fail > 0) process.exit(1);
