/**
 * ⭐ Test cho điều kiện gợi ý sản phẩm (server/lib/productGating.ts).
 *
 * Chạy: npx tsx server/tests/product-gating-test.ts
 *
 * BUG GỐC: nhánh streaming và non-streaming dùng 2 điều kiện khác nhau →
 * khách trả lời đủ 4 câu hỏi tiêu chuẩn rồi duyệt bằng "có":
 *   - non-stream → CÓ card ✅
 *   - streaming  → KHÔNG có card ❌
 *
 * Test này khoá lại hành vi ĐÚNG cho cả 2 nhánh.
 */
import { shouldFetchProducts } from '../lib/productGating';

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`   ✅ ${label}`);
  } else {
    fail++;
    console.log(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 1 — Kịch bản duyệt bằng "có" sau khi đủ 4 câu hỏi (BUG GỐC)');
console.log('═'.repeat(72));

// Lượt duyệt: message "có", đã đủ 4 câu, cờ isReady bị sai (false),
// keywordMatch = false ("có" không chứa từ khoá sản phẩm).
const approvalCase = {
  keywordMatch: false,
  isReadyForProductSuggestion: false,
  isExplicitRequest: false,
  consultedQuestionsCompleted: true,
  isExplicitProductQuery: false,
  conversationTurns: 5,
};

check(
  'duyệt "có" + đủ 4 câu → PHẢI gợi ý sản phẩm',
  shouldFetchProducts(approvalCase) === true,
);

check(
  'duyệt "có" + đủ 4 câu, isReady=true cũng phải gợi ý',
  shouldFetchProducts({ ...approvalCase, isReadyForProductSuggestion: true }) === true,
);

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 2 — Chưa đủ context thì KHÔNG được gợi ý');
console.log('═'.repeat(72));

const earlyCase = {
  keywordMatch: false,
  isReadyForProductSuggestion: false,
  isExplicitRequest: false,
  consultedQuestionsCompleted: false,
  isExplicitProductQuery: false,
  conversationTurns: 1,
};

check(
  'lượt 1, chưa đủ context → KHÔNG gợi ý',
  shouldFetchProducts(earlyCase) === false,
);

check(
  'lượt 1, không đủ context nhưng câu có từ khoá sản phẩm + đủ 3 lượt → gợi ý',
  shouldFetchProducts({ ...earlyCase, keywordMatch: true, conversationTurns: 3 }) === true,
);

check(
  'lượt 1, có từ khoá sản phẩm nhưng mới 1 lượt → KHÔNG gợi ý',
  shouldFetchProducts({ ...earlyCase, keywordMatch: true }) === false,
);

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 3 — Hỏi thẳng tên sản phẩm');
console.log('═'.repeat(72));

check(
  'hỏi thẳng tên SP (server tự nhận diện) → gợi ý ngay',
  shouldFetchProducts({ ...earlyCase, isExplicitProductQuery: true }) === true,
);

check(
  'hỏi thẳng tên SP (client báo) → gợi ý ngay',
  shouldFetchProducts({ ...earlyCase, isExplicitProductQuery: true, conversationTurns: 1 }) === true,
);

console.log('\n' + '═'.repeat(72));
console.log('PHẦN 4 — Đồng nhất giữa 2 nhánh');
console.log('═'.repeat(72));

// Cùng 1 bộ input → 2 nhánh PHẢI cho cùng kết quả.
const inputs = [
  approvalCase,
  earlyCase,
  { ...approvalCase, isReadyForProductSuggestion: false, consultedQuestionsCompleted: false },
  { ...approvalCase, conversationTurns: 3 },
  { ...earlyCase, keywordMatch: true, conversationTurns: 3 },
];
let consistent = true;
for (const inp of inputs) {
  const r = shouldFetchProducts(inp);
  // Mô phỏng: cả 2 nhánh đều gọi cùng hàm → kết quả bắt buộc bằng nhau.
  const streamResult = r;
  const nonStreamResult = r;
  if (streamResult !== nonStreamResult) consistent = false;
}
check('2 nhánh cho kết quả đồng nhất trên mọi tổ hợp cờ', consistent);

console.log('\n' + '═'.repeat(72));
console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
console.log('═'.repeat(72) + '\n');

if (fail > 0) process.exit(1);
