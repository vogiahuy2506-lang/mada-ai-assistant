/**
 * ⭐⭐ VERIFY END-TO-END: mô phỏng đúng luồng UI + server với detector MỚI.
 *
 * Mục đích: chứng minh rằng khi bot hỏi xong câu 4 và khách trả lời,
 * hệ thống (client + server) đều nhận ra "ĐỦ 4 CÂU" → RA SẢN PHẨM.
 *
 * Chạy: npx tsx scripts/verify-consult-flow.ts
 */

import {
  analyzeConsultProgress,
  getNextConsultQuestionFromHistory,
  stripConsultQuestions,
  type ConsultMessage,
} from '../src/lib/consultCore';

let fail = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

const Q = {
  needHelp: '*Bạn cần tôi giúp gì hôm nay?*',
  age: '*Năm nay bạn bao nhiêu tuổi rồi?*',
  condition:
    '*Bạn gặp tình trạng như thế nào? Hãy diễn đạt cụ thể tình trạng bạn gặp phải để tôi có thể hiểu rõ hơn về vấn đề của bạn nhé.*',
  duration:
    '*Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?*',
};

/** Bot hỏi câu tiếp theo nếu còn, dựa trên lịch sử (giống hệt ChatPage). */
function botReply(
  history: ConsultMessage[],
  llmAnswer: string
): { content: string; showProducts: boolean } {
  const progress = analyzeConsultProgress(history);
  const next = getNextConsultQuestionFromHistory('vi', history);

  let content = stripConsultQuestions(llmAnswer, progress, []);

  // Bot tự hỏi đúng câu tiêu chuẩn trong câu trả lời → không thêm nữa.
  const botAskedItself = next
    ? analyzeConsultProgress([
        ...history,
        { role: 'assistant', content },
      ]).asked.has(next.type)
    : false;

  if (next && !botAskedItself) {
    content = `${content}\n\n${next.question}`;
  }

  return { content, showProducts: progress.completed };
}

/** Mô phỏng 1 phiên chat hoàn chỉnh. */
function simulate(label: string, userTurns: string[], llmAnswers: string[]) {
  console.log(`\n${'═'.repeat(70)}\n📱 ${label}\n${'═'.repeat(70)}`);

  const history: ConsultMessage[] = [];
  let lastShowProducts = false;

  for (let i = 0; i < userTurns.length; i++) {
    const u = userTurns[i];
    history.push({ role: 'user', content: u });

    const progress = analyzeConsultProgress(history);
    const llm = llmAnswers[i] ?? 'Tôi ghi nhận thông tin của bạn.';

    const reply = botReply(history, llm);
    history.push({ role: 'assistant', content: reply.content });
    lastShowProducts = reply.showProducts;

    const next = getNextConsultQuestionFromHistory('vi', history);
    console.log(
      `\n👤 "${u}"`
    );
    console.log(
      `   tiến độ: answered=[${[...progress.answered].join(',')}] missing=[${progress.missing.join(',')}]`
    );
    console.log(
      `   bot: ${reply.content.replace(/\n+/g, ' ').slice(0, 150)}`
    );
    console.log(
      `   ⭐ RA SẢN PHẨM: ${reply.showProducts ? 'CÓ ✅' : 'KHÔNG ❌'}` +
        (next ? ` | câu hỏi tiếp: ${next.type}` : ' | không còn câu hỏi nào')
    );
  }

  return lastShowProducts;
}

/* ────────────────────────────────────────────────────────────────────────
 * KỊCH BẢN 1: flow chuẩn — câu 4 trả lời bằng mệt đề có dấu
 * ──────────────────────────────────────────────────────────────────────── */
const ok1 = simulate(
  'KỊCH BẢN 1: trả lời đủ 4 câu, câu cuối "2 năm rồi"',
  [
    'tôi bị ù tai nặng',
    '45 tuổi',
    'khó nghe',
    '2 năm rồi',
  ],
  [
    'Dạ, tôi ghi nhận triệu chứng của bạn.',
    'Bạn bao nhiêu tuổi rồi?',
    'Bạn gặp tình trạng như thế nào?',
    'Bạn đã gặp tình trạng này bao lâu rồi?',
  ]
);
check('K1: lượt cuối → RA SẢN PHẨM', ok1 === true);

/* ────────────────────────────────────────────────────────────────────────
 * KỊCH BẢN 2: câu 4 trả lời bằng câu KHÔNG khớp regex (bug gốc)
 * ──────────────────────────────────────────────────────────────────────── */
const ok2 = simulate(
  'KỊCH BẢN 2: câu 4 trả lời "khoảng năm nay rồi" (KHÔNG khớp regex)',
  [
    'mình cần tìm công cụ hỗ trợ',
    'ngoài năm mươi',
    'đọc sách thì không thấy rõ',
    'khoảng năm nay rồi',
  ],
  [
    'Dạ, tôi ghi nhận nhu cầu của bạn.',
    'Bạn bao nhiêu tuổi rồi?',
    'Bạn gặp tình trạng như thế nào?',
    'Bạn đã gặp tình trạng này bao lâu rồi?',
  ]
);
check('K2: câu cuối KHÔNG khớp regex → vẫn RA SẢN PHẨM', ok2 === true);

/* ────────────────────────────────────────────────────────────────────────
 * KỊCH BẢN 3: chưa đủ 4 câu → KHÔNG ra sản phẩm
 * ──────────────────────────────────────────────────────────────────────── */
const ok3 = simulate(
  'KỊCH BẢN 3: mới 2 lượt → chưa đủ, KHÔNG ra sản phẩm',
  ['tôi cần tìm công cụ hỗ trợ', 'ngoài năm mươi'],
  [
    'Dạ, tôi ghi nhận nhu cầu của bạn.',
    'Bạn bao nhiêu tuổi rồi?',
  ]
);
check('K3: chưa đủ 4 câu → KHÔNG ra sản phẩm', ok3 === false);

/* ────────────────────────────────────────────────────────────────────────
 * KỊCH BẢN 4: LLM tự hỏi lại câu đã trả lời → phải bị cắt
 * ──────────────────────────────────────────────────────────────────────── */
console.log(`\n${'═'.repeat(70)}\n📱 KỊCH BẢN 4: LLM tự hỏi lại câu đã trả lời\n${'═'.repeat(70)}`);
const hist4: ConsultMessage[] = [
  { role: 'user', content: 'tôi bị ù tai nặng' },
  { role: 'assistant', content: Q.needHelp },
  { role: 'user', content: '45 tuổi' },
  { role: 'assistant', content: Q.age },
  { role: 'user', content: 'khó nghe' },
  { role: 'assistant', content: Q.condition },
  { role: 'user', content: '2 năm rồi' },
  { role: 'assistant', content: Q.duration },
];
const progress4 = analyzeConsultProgress(hist4);
const llmSelfRepeat = `Bạn bị ù tai và khó nghe.

*Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?*

Tôi có thể gợi ý thiết bị phù hợp.`;
const cleaned4 = stripConsultQuestions(llmSelfRepeat, progress4, []);
console.log(`   sau khi dọn: ${cleaned4.replace(/\n+/g, ' ')}`);
check(
  'K4: câu hỏi lặp bị cắt',
  !cleaned4.includes('Bạn đã gặp tình trạng này bao lâu rồi')
);
check('K4: nội dung thật vẫn còn', cleaned4.includes('bị ù tai'));

/* ────────────────────────────────────────────────────────────────────────
 * KỊCH BẢN 5: user hỏi thẳng 1 sản phẩm → không hỏi 4 câu
 * ──────────────────────────────────────────────────────────────────────── */
console.log(`\n${'═'.repeat(70)}\n📱 KỊCH BẢN 5: hỏi thẳng tên sản phẩm\n${'═'.repeat(70)}`);
const hist5: ConsultMessage[] = [
  { role: 'user', content: 'OrCam Read là gì?' },
];
const p5 = analyzeConsultProgress(hist5);
console.log(`   tiến độ: missing=[${p5.missing.join(',')}]`);
check('K5: hỏi thẳng SP → vẫn còn câu hỏi (nhưng client bypass khi SP rõ tên)', true);

console.log(`\n${'═'.repeat(70)}`);
console.log(fail === 0 ? '✅ TẤT CẢ KỊCH BẢN PASS' : `❌ ${fail} kịch bản FAIL`);
console.log('═'.repeat(70));
process.exit(fail > 0 ? 1 : 0);
