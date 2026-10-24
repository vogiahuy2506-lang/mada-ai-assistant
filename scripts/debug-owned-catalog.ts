/**
 * ⭐ Debug: tại sao sản phẩm RIÊNG của bot không vào catalog?
 *
 * Usage: npx tsx scripts/debug-owned-catalog.ts
 */

import { buildProductCatalog } from '../server/lib/productLinker';
import { primaryOwnerForProduct, isExclusiveToBot, botsForProduct } from '../server/lib/productTaxonomy';

const catalog = buildProductCatalog();
console.log('catalog size:', catalog.length);

const BOT_IDS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility',
];

for (const botId of BOT_IDS) {
  const exclusive = catalog.filter((e) => isExclusiveToBot(e.product_url || e.source_url, botId));
  console.log('');
  console.log('═'.repeat(70));
  console.log(`${botId}: exclusive trong catalog = ${exclusive.length}`);
  console.log('═'.repeat(70));
  for (const e of exclusive.slice(0, 12)) {
    console.log(
      `  ${(e.title || '').padEnd(42)} cat=${String(e.category).padEnd(14)} owner=${primaryOwnerForProduct(e.product_url || e.source_url)}`
    );
  }
}

// ⭐ Kiểm tra riêng 4 sản phẩm của bot-mobility
console.log('');
console.log('═'.repeat(70));
console.log('4 SẢN PHẨM RIÊNG CỦA BOT-MOBILITY — có trong catalog?');
console.log('═'.repeat(70));

const MOB = [
  'gewa-control-prog',
  'housemate',
  'power-link-4-2',
  'primo-environment-control',
  'wewalk-smart-cane',
  'lazarillo',
];

for (const slug of MOB) {
  const hit = catalog.filter((e) => (e.product_url || e.source_url || '').includes(slug));
  console.log('');
  console.log(`── ${slug}: ${hit.length} dòng trong catalog`);
  for (const h of hit) {
    const url = h.product_url || h.source_url;
    console.log(`     title="${h.title}" cat=${h.category}`);
    console.log(`     url=${url}`);
    console.log(`     owner=${primaryOwnerForProduct(url)} exclusive=${isExclusiveToBot(url, 'bot-mobility')}`);
    console.log(`     bots=${JSON.stringify(botsForProduct(url))}`);
  }
}
