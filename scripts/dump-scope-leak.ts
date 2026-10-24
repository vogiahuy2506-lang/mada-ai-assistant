/**
 * ⭐ DUMP câu trả lời THẬT của bot + phân tích tên SP nằm NGOÀI chuyên môn.
 *
 * Khác với `audit-bot-scope.ts` (chỉ kiểm tra URL trong text), script này kiểm
 * tra CẢ TÊN SẢN PHẨM IN ĐẬM (`**Tên**`) — đó là dấu hiệu bot đang "giới
 * thiệu" sản phẩm, kể cả khi không kèm link.
 *
 * Mô phỏng ĐÚNG luồng 5 lượt của UI (giống simulate-real-flow.ts).
 *
 * Cú pháp:
 *   npx tsx scripts/dump-scope-leak.ts [botId]
 */

import { buildProductCatalog, normalizeProductName } from '../server/lib/productLinker';
import { botsForProduct, primaryOwnerForProduct } from '../server/lib/productTaxonomy';
import { hasCompletedConsultQuestions } from '../src/lib/consultQuestions';

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

const BOT_IDS = [
  'bot-hearing', 'bot-vision', 'bot-speech',
  'bot-cognitive', 'bot-neuro', 'bot-mobility',
];

const USER_MSGS = ['tôi bị ù tai nặng', '45 tuổi', 'khó nghe', '2 năm rồi', 'có'];

/** Trích câu trả lời cuối từ stream SSE. */
function extractAnswer(raw: string): string {
  const full = [...raw.matchAll(/"type":"replaceFull","content":"((?:[^"\\]|\\.)*)"/g)];
  if (full.length) {
    try { return JSON.parse(`"${full[full.length - 1][1]}"`); } catch { /* ignore */ }
  }
  let acc = '';
  for (const m of raw.matchAll(/"type":"chunk","chunk":"((?:[^"\\]|\\.)*)"/g)) {
    try { acc += JSON.parse(`"${m[1]}"`); } catch { acc += m[1]; }
  }
  return acc;
}

/** Tên sản phẩm trong **bold** → tra cứu URL trong catalog. */
function boldMentions(answer: string): Array<{ name: string; url: string }> {
  const catalog = buildProductCatalog();
  const byNorm = new Map<string, string>();
  for (const e of catalog) {
    const u = e.product_url || e.source_url || '';
    byNorm.set(normalizeProductName(e.title || ''), u);
    byNorm.set(normalizeProductName(e.title_en || ''), u);
  }
  const out: Array<{ name: string; url: string }> = [];
  for (const m of answer.matchAll(/\*\*([^*\n]{3,70})\*\*/g)) {
    const name = m[1].trim();
    const url = byNorm.get(normalizeProductName(name)) || '';
    out.push({ name, url });
  }
  return out;
}

async function run(botId: string) {
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`🤖 ${botId}`);
  console.log('═'.repeat(78));

  const msgs: string[] = [];
  let totalLeaks = 0;

  for (let i = 0; i < USER_MSGS.length; i++) {
    const u = USER_MSGS[i];
    msgs.push(u);
    const isApproval = u === 'có';
    const consulted = hasCompletedConsultQuestions(msgs);

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: u,
        agentId: botId,
        conversationId: `dump-${botId}-${Date.now()}-${i}`,
        language: 'vi',
        userMode: 'endUser',
        missingContext: [],
        isReadyForProductSuggestion: true,
        conversationTurns: i + 1,
        triggersProductSuggestion: true,
        followUpQuestionsAsked: Math.max(0, i),
        shouldShowProductsNow: isApproval,
        isInQuestionGatheringMode: !isApproval,
        userApprovedProducts: isApproval,
        consultQuestionsCompleted: consulted,
        isExplicitProductQuery: false,
        shownProductIds: [],
      }),
    });
    const raw = await res.text();
    const answer = extractAnswer(raw);
    const mentions = boldMentions(answer);

    const leaks = mentions.filter((m) => {
      if (!m.url) return false;
      const bots = botsForProduct(m.url);
      return bots.length > 0 && !bots.includes(botId);
    });

    console.log(`\n👤 "${u}" [consult=${consulted}] — ${answer.length} ký tự`);
    if (leaks.length === 0) {
      console.log('   ✅ không có tên SP ngoài chuyên môn');
    } else {
      totalLeaks += leaks.length;
      for (const m of leaks) {
        console.log(
          `   ❌ LEAK: **${m.name}**  (owner=${primaryOwnerForProduct(m.url)}, ` +
          `bots=${botsForProduct(m.url).join(',')})`
        );
      }
    }
  }

  console.log(`\n→ TỔNG LEAK của ${botId}: ${totalLeaks}`);
  return totalLeaks;
}

async function main() {
  const only = process.argv[2];
  const list = only ? [only] : BOT_IDS;
  let total = 0;
  for (const b of list) total += await run(b);
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`TỔNG LEAK TOÀN BỘ: ${total}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
