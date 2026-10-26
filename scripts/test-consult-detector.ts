/**
 * ⭐ TEST bộ detector 4 câu hỏi tư vấn — verify các bug đã sửa.
 *
 * Chạy: npx tsx scripts/test-consult-detector.ts
 *
 * NGUYÊN TẮC ĐƯỢC KIỂM TRA:
 *  1. Regex nhận diện được tiếng Việt CÓ DẤU + đại từ "mình".
 *  2. "Đủ 4 câu" = 4 câu đã được TRẢ LỜI (không phải bot đã hỏi).
 *  3. Bot hỏi câu X → khách nói tiếp → câu X coi như đã trả lời (kể cả khi
 *     lời khách không khớp regex nào) → đây là fix của bug "hỏi xong câu 4
 *     rồi mà không ra sản phẩm".
 *  4. TUYỆT ĐỐI không hỏi lại câu đã hỏi.
 *  5. LLM tự hỏi lại câu đã trả lời → phải bị cắt khỏi nội dung.
 *  6. Bot nhắc cụm từ trong lời giải thích ≠ bot hỏi câu đó.
 */

import {
  analyzeConsultProgress,
  detectAnsweredQuestions,
  hasCompletedConsultQuestions,
  getNextConsultQuestionFromHistory,
  stripConsultQuestions,
  type ConsultMessage,
} from '../src/lib/consultCore';

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(
      `  ❌ ${name}`,
      extra !== undefined ? JSON.stringify(extra) : ''
    );
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(64)}\n${title}\n${'─'.repeat(64)}`);
}

/* ────────────────────────────────────────────────────────────────────────
 * 1. BUG "mình" + dấu tiếng Việt (từ phiên trước)
 * ──────────────────────────────────────────────────────────────────────── */
section('1. Nhận diện tiếng Việt có dấu + đại từ "mình"');

const answered1 = detectAnsweredQuestions(['mình bị mờ mắt khi đọc sách']);
check('"mình bị mờ mắt khi đọc sách" → needHelp', answered1.has('needHelp'), [...answered1]);
check('"mình bị mờ mắt khi đọc sách" → condition', answered1.has('condition'), [...answered1]);

const answered2 = detectAnsweredQuestions(['tôi bị ù tai nặng']);
check('"tôi bị ù tai nặng" → needHelp', answered2.has('needHelp'), [...answered2]);
check('"tôi bị ù tai nặng" → condition', answered2.has('condition'), [...answered2]);

check('"45 tuổi" → age', detectAnsweredQuestions(['45 tuổi']).has('age'));
check('"2 năm rồi" → duration', detectAnsweredQuestions(['2 năm rồi']).has('duration'));

/* ────────────────────────────────────────────────────────────────────────
 * 2. Không hỏi câu mà user ĐÃ nêu trong câu đầu tiên
 * ──────────────────────────────────────────────────────────────────────── */
section('2. Bỏ qua câu user đã nêu sẵn (không hỏi lại)');

const first: ConsultMessage[] = [
  { role: 'user', content: 'mình bị mờ mắt khi đọc sách' },
];
const pf = analyzeConsultProgress(first);
check(
  'sau câu đầu: đã biết needHelp + condition',
  pf.answered.has('needHelp') && pf.answered.has('condition'),
  [...pf.answered]
);
check('chưa đủ 4 câu → chưa tư vấn', !pf.completed, [...pf.answered]);
check('câu tiếp theo = age', pf.nextType === 'age', pf.nextType);

/* ────────────────────────────────────────────────────────────────────────
 * 3. BUG CHÍNH: hỏi xong câu 4 → khách trả lời → PHẢI ra sản phẩm
 * ──────────────────────────────────────────────────────────────────────── */
section('3. Luồng đầy đủ (bot hỏi → khách trả lời → ra sản phẩm)');

const Q = {
  needHelp: '*Bạn cần tôi giúp gì hôm nay?*',
  age: '*Năm nay bạn bao nhiêu tuổi rồi?*',
  condition:
    '*Bạn gặp tình trạng như thế nào? Hãy diễn đạt cụ thể tình trạng bạn gặp phải để tôi có thể hiểu rõ hơn về vấn đề của bạn nhé.*',
  duration:
    '*Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?*',
};

// Flow "sạch": mỗi lượt khách trả lời 1 câu, KHÔNG trùng thông tin câu khác.
const flow: ConsultMessage[] = [
  { role: 'user', content: 'mình cần tìm công cụ hỗ trợ' }, // needHelp
  { role: 'assistant', content: Q.needHelp },
  { role: 'user', content: 'ngoài năm mươi' }, // age — KHÔNG khớp regex tuổi
  { role: 'assistant', content: Q.age },
  { role: 'user', content: 'đọc sách thì không thấy rõ' }, // condition
  { role: 'assistant', content: Q.condition },
  { role: 'user', content: 'khoảng năm nay rồi' }, // duration — KHÔNG khớp regex
  { role: 'assistant', content: Q.duration },
];

const p3 = analyzeConsultProgress(flow);
check(
  'sau lượt hỏi câu 4 (KHÁCH CHƯA trả lời) → CHƯA đủ, chưa ra sản phẩm',
  !p3.completed,
  { answered: [...p3.answered], missing: p3.missing }
);
check(
  'chỉ còn thiếu duration',
  p3.missing.length === 1 && p3.missing[0] === 'duration',
  p3.missing
);
check(
  'câu duration đã hỏi → không hỏi lại (nextType = null)',
  p3.nextType === null,
  p3.nextType
);

const flowWithAnswer: ConsultMessage[] = [
  ...flow,
  { role: 'user', content: 'hơi khó chịu thôi' },
];
const p3b = analyzeConsultProgress(flowWithAnswer);
check(
  'khách trả lời câu 4 bằng câu KHÔNG khớp regex → ĐỦ 4 câu → RA SẢN PHẨM',
  p3b.completed,
  { answered: [...p3b.answered], missing: p3b.missing }
);
check('không còn câu tiếp theo', p3b.nextType === null, p3b.nextType);

/* ────────────────────────────────────────────────────────────────────────
 * 4. Trả lời bằng cách diễn đạt lạ (không khớp regex nào)
 * ──────────────────────────────────────────────────────────────────────── */
section('4. Trả lời kiểu lạ vẫn được tính (nhờ tín hiệu thứ tự hội thoại)');

const flowWeird: ConsultMessage[] = [
  { role: 'user', content: 'mình cần tìm công cụ hỗ trợ' },
  { role: 'assistant', content: Q.needHelp },
  { role: 'user', content: 'vẫn ổn' },
  { role: 'assistant', content: Q.age },
  { role: 'user', content: 'đọc sách thì không thấy rõ' },
  { role: 'assistant', content: Q.condition },
  { role: 'user', content: 'khoảng năm nay rồi' },
  { role: 'assistant', content: Q.duration },
  { role: 'user', content: 'hơi khó chịu thôi' },
];
const p4 = analyzeConsultProgress(flowWeird);
check('mọi câu trả lời kiểu lạ → vẫn ĐỦ 4 câu', p4.completed, {
  answered: [...p4.answered],
  missing: p4.missing,
});

/* ────────────────────────────────────────────────────────────────────────
 * 5. Không hỏi lặp
 * ──────────────────────────────────────────────────────────────────────── */
section('5. Không hỏi lặp câu đã hỏi');

const next1 = getNextConsultQuestionFromHistory('vi', flow);
check('sau khi bot hỏi cả 4 câu → không còn câu nào để hỏi', next1 === null, next1);

const flowPartial: ConsultMessage[] = [
  { role: 'user', content: 'tôi bị ù tai' }, // needHelp + condition
  { role: 'assistant', content: Q.needHelp },
  { role: 'user', content: '45 tuổi' }, // age
  { role: 'assistant', content: Q.age },
];
const next2 = getNextConsultQuestionFromHistory('vi', flowPartial);
check('condition đã nêu sẵn → câu tiếp theo = duration', next2?.type === 'duration', next2?.type);
check(
  'không hỏi lại needHelp/age',
  next2?.question !== Q.needHelp && next2?.question !== Q.age
);

/* ────────────────────────────────────────────────────────────────────────
 * 6. Dọn câu hỏi LLM tự hỏi lại
 * ──────────────────────────────────────────────────────────────────────── */
section('6. LLM tự hỏi lại câu đã trả lời → phải bị cắt');

const llmText = `Bạn thường xuyên bị mờ mắt khi đọc sách.

*Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?*

Tôi có thể gợi ý thêm.`;
const cleaned = stripConsultQuestions(llmText, p3b, []);
check(
  'câu hỏi câu 4 bị cắt khỏi text LLM',
  !cleaned.includes('Bạn đã gặp tình trạng này bao lâu rồi'),
  cleaned
);
check('phần nội dung thật vẫn còn', cleaned.includes('mờ mắt khi đọc sách'), cleaned);

/* ────────────────────────────────────────────────────────────────────────
 * 7. Không báo nhầm "bot đã hỏi" khi bot chỉ nhắc cụm từ trong lời giải thích
 * ──────────────────────────────────────────────────────────────────────── */
section('7. Bot nhắc cụm từ trong lời giải thích ≠ bot hỏi');

const explainOnly: ConsultMessage[] = [
  { role: 'user', content: 'tôi bị mờ mắt' },
  {
    role: 'assistant',
    content:
      'Thiết bị này giúp người dùng trong các trường hợp mức độ nhẹ, trung bình hoặc nặng.',
  },
];
const p7 = analyzeConsultProgress(explainOnly);
check('không đánh dấu bot đã hỏi câu duration', !p7.asked.has('duration'), [...p7.asked]);
check('câu tiếp theo = age (condition đã nêu sẵn)', p7.nextType === 'age', p7.nextType);

/* ────────────────────────────────────────────────────────────────────────
 * 8. hasCompletedConsultQuestions (tương thích cũ) vẫn dùng được
 * ──────────────────────────────────────────────────────────────────────── */
section('8. Hàm tương thích cũ');
check(
  'hasCompletedConsultQuestions với 4 câu đầy đủ = true',
  hasCompletedConsultQuestions([
    'tôi bị ù tai',
    '45 tuổi',
    'khó nghe',
    '2 năm rồi',
  ])
);
check(
  'hasCompletedConsultQuestions với 2 câu = false',
  !hasCompletedConsultQuestions(['tôi bị ù tai', '45 tuổi'])
);

/* ──────────────────────────────────────────────────────────────────────── */
console.log(`\n${'═'.repeat(64)}`);
console.log(`KẾT QUẢ: ${pass} pass / ${fail} fail`);
console.log('═'.repeat(64));
process.exit(fail > 0 ? 1 : 0);
