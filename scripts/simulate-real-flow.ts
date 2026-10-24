/**
 * ⭐ MÔ PHỎNG ĐÚNG LUỒNG THẬT của UI (ChatPage.handleSend) — 5 lượt:
 *   1. "tôi bị ù tai nặng"   → bot hỏi Q1
 *   2. "45 tuổi"             → bot hỏi Q2
 *   3. "khó nghe"            → bot hỏi Q3
 *   4. "2 năm rồi"           → bot hỏi Q4 + mời xem sản phẩm
 *   5. "có"                  → PHẢI ra card sản phẩm
 *
 * Mỗi lượt gửi đúng body mà frontend gửi (kể cả cờ).
 *
 * Usage: npx tsx scripts/simulate-real-flow.ts
 */

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

import {
  hasCompletedConsultQuestions,
  detectAnsweredQuestions,
} from '../src/lib/consultQuestions';

interface Turn {
  user: string;
  /** frontend gửi lên */
  body: Record<string, unknown>;
}

function buildTurns(agentId: string): Turn[] {
  const msgs: string[] = [];
  const assistant: string[] = [];
  const turns: Turn[] = [];

  const userMsgs = ['tôi bị ù tai nặng', '45 tuổi', 'khó nghe', '2 năm rồi', 'có'];

  for (let i = 0; i < userMsgs.length; i++) {
    const u = userMsgs[i];
    msgs.push(u);
    // ⭐ Frontend: followUpQuestionsAsked tăng khi ở gathering mode & không phải duyệt
    const isApproval = u === 'có';
    const followUpQuestionsAsked = Math.max(0, i); // lượt 2,3,4,5 → 1,2,3,4
    const consulted = hasCompletedConsultQuestions(msgs);
    turns.push({
      user: u,
      body: {
        message: u,
        agentId,
        conversationId: `sim-${agentId}`,
        language: 'vi',
        userMode: 'endUser',
        missingContext: [],
        isReadyForProductSuggestion: true,
        conversationTurns: i + 1,
        triggersProductSuggestion: true,
        followUpQuestionsAsked,
        shouldShowProductsNow: isApproval,
        isInQuestionGatheringMode: !isApproval,
        userApprovedProducts: isApproval,
        consultQuestionsCompleted: consulted,
        isExplicitProductQuery: false,
        shownProductIds: [],
      },
    });
  }
  return turns;
}

function extractAnswer(raw: string): string {
  const full = [...raw.matchAll(/"type":"replaceFull","content":"((?:[^"\\]|\\.)*)"/g)];
  if (full.length) {
    try { return JSON.parse(`"${full[full.length - 1][1]}"`); } catch { /* */ }
  }
  let acc = '';
  for (const m of raw.matchAll(/"type":"chunk","chunk":"((?:[^"\\]|\\.)*)"/g)) {
    try { acc += JSON.parse(`"${m[1]}"`); } catch { acc += m[1]; }
  }
  return acc;
}

async function run(agentId: string) {
  console.log(`\n${'═'.repeat(70)}\n🤖 ${agentId}\n${'═'.repeat(70)}`);
  const turns = buildTurns(agentId);

  for (const t of turns) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t.body),
    });
    const raw = await res.text();
    const answer = extractAnswer(raw);

    let cards: any[] = [];
    for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
      try {
        const ev = JSON.parse(m[1]);
        if (ev.type === 'suggestedProducts') cards = ev.suggestedProducts || [];
      } catch { /* ignore */ }
    }

    const mentions = [...answer.matchAll(/\*\*([^*]{3,60})\*\*/g)].map((m) => m[1].trim());
    console.log(`\n👤 "${t.user}"  [consult=${t.body.consultQuestionsCompleted}]`);
    console.log(`   bot trả lời (${answer.length} ký tự): ${answer.replace(/\n+/g, ' ').slice(0, 170)}`);
    console.log(`   tên SP in đậm trong text: ${mentions.slice(0, 6).join(' | ') || '(không có)'}`);
    console.log(`   ⭐ CARD: ${cards.length} → ${cards.map((c: any) => c.title).slice(0, 6).join(' | ') || '(KHÔNG CÓ CARD)'}`);
  }
}

async function main() {
  for (const bot of ['bot-hearing', 'bot-vision', 'bot-speech', 'bot-cognitive', 'bot-neuro', 'bot-mobility']) {
    await run(bot);
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
