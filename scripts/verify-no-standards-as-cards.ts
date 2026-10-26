/**
 * Kiểm tra: card phải là THIẾT BỊ giải quyết vấn đề, KHÔNG phải tiêu chuẩn.
 */
const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

const REF_DOMAINS = ['w3.org', 'iso.org', 'etsi.org', 'assistive-technology-portal', 'health.ec.europa.eu'];

const CASES = [
  { botId: 'bot-vision', label: 'Thị giác', message: 'Tôi mờ mắt, khó đọc sách báo. Có thiết bị nào giúp tôi đọc dễ hơn không?' },
  { botId: 'bot-hearing', label: 'Thính giác', message: 'Tôi nghe kém, không nghe rõ. Có máy trợ thính nào phù hợp không?' },
  { botId: 'bot-mobility', label: 'Di chuyển', message: 'Tôi khó đi lại, cần xe lăn hoặc gậy hỗ trợ.' },
  { botId: 'bot-speech', label: 'Giọng nói', message: 'Tôi nói khó, cần thiết bị giao tiếp thay thế.' },
  { botId: 'bot-cognitive', label: 'Nhận thức', message: 'Tôi hay quên, cần công cụ hỗ trợ trí nhớ.' },
  { botId: 'bot-regulatory', label: 'Regulatory', message: 'Tôi mờ mắt, khó đọc sách báo. Có thiết bị nào giúp tôi đọc dễ hơn không?' },
  { botId: 'bot-regulatory', label: 'Regulatory (chung)', message: 'Cho tôi xem các sản phẩm công nghệ hỗ trợ' },
  { botId: 'bot-vision', label: 'Hỏi SP cụ thể', message: 'VisionBuddy là gì?' },
];

async function run(c: any) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: c.message,
      agentId: c.botId,
      conversationId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      language: 'vi',
      consultQuestionsCompleted: false,
      isExplicitProductQuery: false,
    }),
  });
  const raw = await res.text();
  const cards: any[] = [];
  for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
    try {
      const ev = JSON.parse(m[1]);
      if (ev.type === 'suggestedProducts') cards.push(...(ev.suggestedProducts || []));
    } catch {}
  }
  const refs = cards.filter((p: any) =>
    REF_DOMAINS.some((d) => (p.source_url || p.product_url || '').includes(d))
  );
  const verdict = refs.length === 0 ? '✅' : '❌ LỌT TIÊU CHUẨN';
  console.log(`${verdict} [${c.label}] ${cards.length} cards | tiêu chuẩn lọt: ${refs.length}`);
  if (refs.length) refs.forEach((r: any) => console.log(`     ⚠️  ${r.title}`));
  console.log(`     ${cards.slice(0, 6).map((p: any) => p.title).join(' | ')}`);
}

(async () => { for (const c of CASES) await run(c); })();
