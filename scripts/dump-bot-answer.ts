/**
 * ⭐ DEBUG: in ra câu trả lời + danh sách card của 1 bot (để soi lỗi).
 *
 * Usage: npx tsx scripts/dump-bot-answer.ts <botId> "<câu hỏi>"
 */

const botId = process.argv[2] || 'bot-mobility';
const question = process.argv[3] || 'giới thiệu giúp tôi vài thiết bị hỗ trợ di chuyển kèm link';

const API = `http://localhost:${process.env.PORT || '3001'}/api/chat/stream`;

const res = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: question,
    agentId: botId,
    conversationId: `dump-${botId}-${Date.now()}`,
    language: 'vi',
    consultQuestionsCompleted: true,
    conversationTurns: 5,
  }),
});
const raw = await res.text();

let ans = '';
for (const m of raw.matchAll(/"type":"(?:chunk|replaceFull)","(?:chunk|content)":"((?:[^"\\]|\\.)*)"/g)) {
  try {
    ans += JSON.parse(`"${m[1]}"`);
  } catch {
    ans += m[1];
  }
}

console.log('=== ANSWER ===');
console.log(ans);
console.log('');
console.log('=== CARDS ===');
for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
  try {
    const ev = JSON.parse(m[1]);
    if (ev.type === 'suggestedProducts') {
      for (const p of ev.suggestedProducts) {
        console.log(' -', p.title, '|', p.product_url);
      }
    }
  } catch {
    /* ignore */
  }
}
