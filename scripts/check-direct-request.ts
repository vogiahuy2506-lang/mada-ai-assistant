/**
 * ⭐ Test nhánh "khách hỏi trực tiếp, CHƯA qua bộ 4 câu hỏi".
 *
 * Đây là kịch bản phổ biến nhất: khách vào chat, hỏi thẳng "giới thiệu giúp
 * tôi các máy trợ thính phổ biến" → bot liệt kê TÊN sản phẩm trong text.
 *
 * Mục tiêu: xem server có gửi `suggestedProducts` (để frontend hiện CARD) không.
 *
 * Usage: npx tsx scripts/check-direct-request.ts
 */

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

const CASES = [
  { botId: 'bot-hearing', q: 'giới thiệu cho tôi các máy trợ thính phổ biến' },
  { botId: 'bot-vision', q: 'giới thiệu cho tôi các thiết bị đọc sách cho người khiếm thị' },
  { botId: 'bot-speech', q: 'giới thiệu cho tôi thiết bị giao tiếp AAC phổ biến' },
  { botId: 'bot-cognitive', q: 'giới thiệu cho tôi thiết bị hỗ trợ trí nhớ' },
  { botId: 'bot-neuro', q: 'giới thiệu cho tôi bàn phím và chuột thay thế' },
  { botId: 'bot-mobility', q: 'giới thiệu cho tôi gậy thông minh và thiết bị hỗ trợ di chuyển' },
];

function extractAnswer(raw: string): string {
  let acc = '';
  for (const m of raw.matchAll(/"type":"chunk","chunk":"((?:[^"\\]|\\.)*)"/g)) {
    try { acc += JSON.parse(`"${m[1]}"`); } catch { acc += m[1]; }
  }
  return acc;
}

async function main() {
  for (const c of CASES) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: c.q,
        agentId: c.botId,
        conversationId: `direct-${c.botId}-${Date.now()}`,
        language: 'vi',
        // ⭐ KHÔNG bật consultQuestionsCompleted → mô phỏng khách hỏi thẳng
        conversationTurns: 1,
        triggersProductSuggestion: true,
        followUpQuestionsAsked: 0,
        shouldShowProductsNow: false,
        isInQuestionGatheringMode: true,
        userApprovedProducts: false,
        consultQuestionsCompleted: false,
        isExplicitProductQuery: false,
        shownProductIds: [],
      }),
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

    const bold = [...answer.matchAll(/\*\*([^*]{3,60})\*\*/g)].map((m) => m[1].trim());
    console.log(`\n━━━ ${c.botId}: "${c.q}"`);
    console.log(`   tên SP trong TEXT (in đậm): ${bold.length ? bold.slice(0, 8).join(' | ') : '(không có)'}`);
    console.log(`   ⭐ CARD server gửi: ${cards.length} → ${cards.map((x: any) => x.title).slice(0, 6).join(' | ') || '(KHÔNG GỬI CARD)'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
