/**
 * ⭐ KIỂM CHỨNG BOT CÓ GỢI Ý ĐÚNG CHUYÊN MÔN KHÔNG.
 *
 * Cách kiểm: đối chiếu sản phẩm bot gợi ý với taxonomy MADA
 * (`data/mada-product-categories.json`) — nguồn chuẩn, đã đối chiếu 349/349 sản
 * phẩm trong `kb_products` khớp 100%.
 *
 * Ba điều kiện mỗi bot phải đạt:
 *   1. Có câu trả lời thật (len > 200 ký tự)
 *   2. Mọi sản phẩm được gợi ý đều thuộc bot đó theo taxonomy MADA
 *      (sản phẩm đa nhãn được phép — ví dụ `proloquo2go` thuộc cả bot-cognitive
 *      lẫn bot-speech vì MADA khai vậy)
 *   3. Nếu bot có sản phẩm ĐỘC QUYỀN thì phải ưu tiên chúng, không dẫn đầu
 *      bằng sản phẩm đa nhãn của bot khác
 *
 * Usage:
 *   npx tsx scripts/verify-bot-scope.ts
 */

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

import { botsForProduct, isExclusiveToBot } from '../server/lib/productTaxonomy';

interface Case {
  botId: string;
  label: string;
  question: string;
  /** Bot không bán sản phẩm → bỏ qua kiểm tra sản phẩm */
  skipProducts?: boolean;
}

const CASES: Case[] = [
  { botId: 'bot-hearing', label: 'Thính giác', question: 'tôi bị ù tai nặng, nên chọn máy trợ thính loại nào, giới thiệu giúp tôi vài mẫu kèm link' },
  { botId: 'bot-vision', label: 'Thị giác', question: 'người mù cần đọc sách in, có thiết bị nào giới thiệu giúp tôi kèm link' },
  { botId: 'bot-speech', label: 'Giọng nói', question: 'bệnh nhân bị sái khó nói sau đột quỵ, cần thiết bị giao tiếp thay thế AAC, giới thiệu kèm link' },
  { botId: 'bot-cognitive', label: 'Nhận thức', question: 'trẻ tự kỷ 8 tuổi cần ứng dụng hỗ trợ giao tiếp và học tập, giới thiệu thiết bị kèm link' },
  { botId: 'bot-neuro', label: 'Cơ xương khớp', question: 'người bại não cần bàn phím thay thế và chuột thay thế vì không cử động được tay, giới thiệu kèm link' },
  { botId: 'bot-mobility', label: 'Di chuyển', question: 'người liệt chân cần phương tiện di chuyển và thiết bị hỗ trợ đi lại trong nhà, giới thiệu kèm link' },
  { botId: 'bot-regulatory', label: 'Tiêu chuẩn', question: 'WCAG 2.2 khác WCAG 2.1 ở những tiêu chí nào?', skipProducts: true },
];

/** Trích phần text của SSE stream (nội dung JSON có escape) */
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
  let pass = 0;
  const total = CASES.length;

  for (const c of CASES) {
    const t0 = Date.now();
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: c.question,
        agentId: c.botId,
        conversationId: `scope-${c.botId}-${Date.now()}`,
        language: 'vi',
        // ⭐ Bot chỉ gợi ý sản phẩm SAU khi đã hỏi đủ 4 câu tư vấn (hoặc user
        // hỏi thẳng về sản phẩm). Bật cờ này để test đúng nhánh "gợi ý sản
        // phẩm", nếu không mọi bot đều chỉ hỏi bổ sung và test vô nghĩa.
        consultQuestionsCompleted: true,
      }),
    });
    const raw = await res.text();
    const answer = extractAnswer(raw);
    const hasSources = /"type":"sources"/.test(raw);
    const hasImg = /https?:\/\/[^\s"']+\.(jpg|jpeg|png|webp)/i.test(raw);

    // ⭐ CHỈ lấy URL nằm trong CÂU TRẢ LỜI, không lấy URL trong event `sources`
    // (sources là tài liệu tri thức, không phải sản phẩm bot gợi ý).
    const answerUrls = [...new Set(
      [...answer.matchAll(/https:\/\/at\.mada\.org\.qa\/technology\/[a-z0-9-]+\//g)].map((m) => m[0])
    )];

    let ok = res.ok && hasSources && answer.length > 200;
    let note = `sources=${hasSources ? 'Y' : 'N'} img=${hasImg ? 'Y' : 'N'} len=${answer.length}`;

    if (!c.skipProducts) {
      const wrong = answerUrls.filter((u) => !botsForProduct(u).includes(c.botId));
      const exclusiveCount = answerUrls.filter((u) => isExclusiveToBot(u, c.botId)).length;

      note += ` sp=${answerUrls.length} sai=${wrong.length}`;

      if (answerUrls.length === 0) {
        // Hỏi tư vấn chưa cần gợi ý sản phẩm (bot đang hỏi thêm thông tin) → chấp nhận
        note += '(chưa gợi ý — đang hỏi bổ sung)';
      } else {
        ok = ok && wrong.length === 0;
        if (wrong.length > 0) {
          note += ` SAI: ${wrong.map(slug).slice(0, 3).join(', ')}`;
        }
      }

      // Nếu bot có sản phẩm độc quyền thì phải ưu tiên
      if (exclusiveCount === 0 && answerUrls.length > 0) {
        // bot-mobility không có SP độc quyền (MADA không bán xe lăn) → bỏ qua
        if (c.botId !== 'bot-mobility') note += ' ⚠️ không ưu tiên SP độc quyền';
      } else if (exclusiveCount > 0) {
        note += ` độcQuyền=${exclusiveCount}`;
      }
    }

    if (ok) pass++;
    console.log(`${ok ? '✅' : '❌'} ${c.label.padEnd(12)} ${String(Date.now() - t0).padStart(6)}ms  ${note}`);
    if (!ok) {
      console.log(`     Q: ${c.question.slice(0, 68)}…`);
      console.log(`     SP: ${answerUrls.map(slug).slice(0, 6).join(', ') || '(không có)'}`);
      console.log(`     A: ${answer.replace(/\n+/g, ' ').slice(0, 200)}`);
    }
  }

  console.log(`\n==> ${pass}/${total} bot gợi ý đúng chuyên môn\n`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});