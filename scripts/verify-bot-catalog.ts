/**
 * ⭐ KIỂM TRA DANH MỤC TRONG PROMPT của từng bot.
 *
 * Mục tiêu: mỗi bot phải thấy ĐÚNG sản phẩm của riêng nó trong prompt
 * (nếu không có trong prompt → model bịa tên → không có card).
 */
import { buildCatalogPromptBlock, buildProductCatalog } from '../server/lib/productLinker';
import { AGENT_TO_MADA, MADA_CATEGORY_TO_DB } from '../server/lib/categoryMapping';

const catalog = buildProductCatalog();
const refs = catalog.filter((c) => c.isReference);

const BOTS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility', 'bot-regulatory',
];

console.log('═'.repeat(78));
console.log('DANH MỤC TRONG PROMPT THEO TỪNG BOT');
console.log('═'.repeat(78));

for (const bot of BOTS) {
  const mapping = Object.entries(AGENT_TO_MADA).find(
    ([, v]: any) => v?.botId === bot
  );
  const madaCat = mapping ? (mapping[1] as any).madaCategory : null;
  const dbCat = madaCat ? (MADA_CATEGORY_TO_DB as any)[madaCat] || madaCat : null;

  const block = buildCatalogPromptBlock(dbCat, 'vi', 40, null, bot);
  const names = catalog.filter((e) => block.includes(e.title));
  const refNames = refs.filter((e) => block.includes(e.title));

  console.log(
    `\n${bot}  (${mapping ? mapping[0] : '?'} / cat=${dbCat || '-'})`
  );
  console.log(`   tổng mục trong prompt : ${names.length}`);
  console.log(`   sản phẩm bán         : ${names.length - refNames.length}`);
  console.log(`   tiêu chuẩn            : ${refNames.length}`);
  if (refNames.length) {
    for (const r of refNames) console.log(`      • ${r.title.slice(0, 60)}`);
  }
}

console.log('\n' + '═'.repeat(78));
console.log('KIỂM TRA BOT-REGULATORY CÓ ĐỦ 7 TIÊU CHUẨN');
console.log('═'.repeat(78));

const mapping = Object.entries(AGENT_TO_MADA).find(
  ([, v]: any) => v?.botId === 'bot-regulatory'
);
const madaCat = mapping ? (mapping[1] as any).madaCategory : null;
const dbCat = madaCat ? (MADA_CATEGORY_TO_DB as any)[madaCat] || madaCat : null;
const block = buildCatalogPromptBlock(dbCat, 'vi', 40, null, 'bot-regulatory');

let ok = true;
for (const r of refs) {
  const has = block.includes(r.title);
  if (!has) ok = false;
  console.log(`   ${has ? '✅' : '❌'} ${r.title.slice(0, 58)}`);
}
console.log(
  `\n${ok ? '✅' : '❌'} bot-regulatory có ${refs.filter((r) => block.includes(r.title)).length}/${refs.length} tiêu chuẩn`
);
