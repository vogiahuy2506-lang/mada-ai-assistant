/**
 * ⭐ KIỂM TRA: mỗi bot có gửi `suggestedProducts` (để frontend hiện CARD) hay không,
 * và card đó có đúng sản phẩm CHUYÊN MÔN của bot không.
 *
 * Usage: npx tsx scripts/check-bot-cards.ts
 */

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

import { botsForProduct, isExclusiveToBot } from '../server/lib/productTaxonomy';

interface Case {
  botId: string;
  label: string;
  question: string;
  skipProducts?: boolean;
}

const CASES: Case[] = [
  { botId: 'bot-hearing', label: 'Thính giác', question: 'giới thiệu giúp tôi vài máy trợ thính kèm link' },
  { botId: 'bot-vision', label: 'Thị giác', question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ người khiếm thị kèm link' },
  { botId: 'bot-speech', label: 'Giọng nói', question: 'giới thiệu giúp tôi vài thiết bị giao tiếp AAC kèm link' },
  { botId: 'bot-cognitive', label: 'Nhận thức', question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ nhận thức kèm link' },
  { botId: 'bot-neuro', label: 'Cơ xương khớp', question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ vận động chi trên kèm link' },
  { botId: 'bot-mobility', label: 'Di chuyển', question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ di chuyển kèm link' },
  { botId: 'bot-regulatory', label: 'Tiêu chuẩn', question: 'WCAG 2.2 khác WCAG 2.1 ở những tiêu chí nào?', skipProducts: true },
];

function extractAnswer(raw: string): string {
  const full = [...raw.matchAll(/"type":"replaceFull","content":"((?:[^"\\]|\\.)*)"/g)];
  if (full.length) {
    try {
      return JSON.parse(`"${full[full.length - 1][1]}"`);
    } catch {
      return full[full.length - 1][1];
    }
  }
  let acc = '';
  for (const m of raw.matchAll(/"type":"chunk","chunk":"((?:[^"\\]|\\.)*)"/g)) {
    try {
      acc += JSON.parse(`"${m[1]}"`);
    } catch {
      acc += m[1];
    }
  }
  return acc;
}

const slug = (u: string) => u.replace(/.*\/technology\//, '').replace(/\/$/, '').replace(/-/g, ' ');

async function main() {
  for (const c of CASES) {
    const t0 = Date.now();
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: c.question,
        agentId: c.botId,
        conversationId: `cards-${c.botId}-${Date.now()}`,
        language: 'vi',
        consultQuestionsCompleted: true,
      }),
    });
    const raw = await res.text();
    const answer = extractAnswer(raw);

    // ⭐ Parse event suggestedProducts
    let cardProducts: any[] = [];
    for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
      try {
        const ev = JSON.parse(m[1]);
        if (ev.type === 'suggestedProducts') {
          cardProducts = ev.suggestedProducts || [];
        }
      } catch {
        /* ignore */
      }
    }

    const answerUrls = [...new Set(
      [...answer.matchAll(/https:\/\/at\.mada\.org\.qa\/technology\/[a-z0-9-]+\//g)].map((m) => m[0])
    )];

    const cardUrls = [...new Set(
      cardProducts.map((p: any) => p.product_url || p.source_url || '').filter(Boolean)
    )];

    const names = cardProducts.map((p: any) => p.title);

    console.log(`\n━━━ ${c.label} (${c.botId}) — ${Date.now() - t0}ms`);
    console.log(`   card events: ${cardProducts.length} card | câu trả lời có ${answerUrls.length} link`);
    console.log(`   tên trong card: ${names.slice(0, 6).join(' | ') || '(KHÔNG CÓ)'}`);

    if (!c.skipProducts && cardProducts.length > 0) {
      const wrong = cardUrls.filter((u) => !botsForProduct(u).includes(c.botId));
      const excl = cardUrls.filter((u) => isExclusiveToBot(u, c.botId));
      console.log(`   sai chuyên môn: ${wrong.length ? wrong.map(slug).join(', ') : 'không'}`);
      console.log(`   độc quyền của bot: ${excl.length}/${cardUrls.length}`);

      const orphan = answerUrls.filter((u) => !cardUrls.some((c2) => c2.replace(/\/$/, '') === u.replace(/\/$/, '')));
      if (orphan.length) {
        console.log(`   ⚠️ link trong text KHÔNG có card: ${orphan.map(slug).join(', ')}`);
      }
    }
  }
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
