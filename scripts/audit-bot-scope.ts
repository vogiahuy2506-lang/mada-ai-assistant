/**
 * ⭐ AUDIT CHUYÊN MÔN TỪNG BOT — kiểm tra 3 tầng:
 *
 *   TẦNG 1 — Card có render không?
 *   TẦNG 2 — Card có đúng sản phẩm CỦA RIÊNG bot không?
 *   TẦNG 3 — Bot có tự nhắc tên sản phẩm KHÔNG THUỘC chuyên môn mình không?
 *
 * Chạy (cần server đang chạy ở PORT):
 *   npx tsx scripts/audit-bot-scope.ts
 *
 * Exit code = 0 khi tất cả bot PASS, = 1 khi có bot FAIL.
 */

import { botsForProduct, primaryOwnerForProduct } from '../server/lib/productTaxonomy';

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

interface Case {
  botId: string;
  label: string;
  /** Câu hỏi tự nhiên (mô phỏng người dùng thật). */
  question: string;
  /** Lịch sử user trước đó để dựng "đã đủ 4 câu". */
  history?: string[];
  /** Bot này không nên ra sản phẩm (tra cứu tiêu chuẩn). */
  skipProducts?: boolean;
}

/**
 * Lịch sử đủ 4 câu hỏi tiêu chuẩn (needHelp / age / condition / duration).
 * Dùng để mô phỏng người dùng đã trả lời đủ → bot ĐƯỢC tư vấn sản phẩm.
 */
const CONSULTED_HISTORY = [
  'Tôi cần tìm thiết bị hỗ trợ cho người nhà',
  'Năm nay tôi 45 tuổi',
  'Tôi khó đọc sách và mỏi mắt khi đọc lâu',
  'Tình trạng này kéo dài 2 năm rồi, ở mức trung bình',
];

const CASES: Case[] = [
  {
    botId: 'bot-hearing',
    label: 'Bot 1 – Thính giác',
    question: 'giới thiệu giúp tôi vài máy trợ thính kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-vision',
    label: 'Bot 2 – Thị giác',
    question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ người khiếm thị kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-speech',
    label: 'Bot 3 – Giọng nói',
    question: 'giới thiệu giúp tôi vài thiết bị giao tiếp AAC kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-cognitive',
    label: 'Bot 4 – Nhận thức',
    question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ nhận thức kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-neuro',
    label: 'Bot 5 – Vận động thần kinh cơ xương',
    question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ vận động chi trên kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-mobility',
    label: 'Bot 6 – Di chuyển & Giao thông',
    question: 'giới thiệu giúp tôi vài thiết bị hỗ trợ di chuyển kèm link',
    history: CONSULTED_HISTORY,
  },
  {
    botId: 'bot-regulatory',
    label: 'Bot 7 – Thông tin bổ trợ',
    question: 'WCAG 2.2 khác WCAG 2.1 ở những tiêu chí nào?',
    skipProducts: true,
  },
];

/** Trích câu trả lời từ stream SSE (ưu tiên replaceFull, fallback chunk). */
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

/** Trích danh sách card từ event `suggestedProducts`. */
function extractProducts(raw: string): any[] {
  let products: any[] = [];
  for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
    try {
      const ev = JSON.parse(m[1]);
      if (ev.type === 'suggestedProducts') products = ev.suggestedProducts || [];
    } catch {
      /* ignore */
    }
  }
  return products;
}

/** Rút gọn URL MADA cho log. */
const slug = (u: string) =>
  (u || '')
    .replace(/.*\/technology\//, '')
    .replace(/\/$/, '')
    .replace(/-/g, ' ');

/** URL MADA trong câu trả lời. */
function answerUrls(answer: string): string[] {
  return [
    ...new Set(
      [...answer.matchAll(/https:\/\/at\.mada\.org\.qa\/technology\/[a-z0-9-]+\//g)].map((m) => m[0])
    ),
  ];
}

interface Result {
  botId: string;
  label: string;
  cards: any[];
  answer: string;
  cardUrls: string[];
  mentionUrls: string[];
  ok: boolean;
  issues: string[];
}

async function run(c: Case): Promise<Result> {
  const history = c.history ?? [];
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: c.question,
      agentId: c.botId,
      conversationId: `audit-${c.botId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      language: 'vi',
      consultQuestionsCompleted: history.length > 0,
      isExplicitProductQuery: false,
      conversationTurns: history.length + 1,
    }),
  });
  const raw = await res.text();

  const answer = extractAnswer(raw);
  const cards = extractProducts(raw);
  const cardUrls = [
    ...new Set(cards.map((p: any) => p.product_url || p.source_url || '').filter(Boolean)),
  ];
  const mentionUrls = answerUrls(answer);

  const issues: string[] = [];

  // ── TẦNG 1: card phải có ────────────────────────────────────────────
  if (!c.skipProducts && cards.length === 0) {
    issues.push('KHÔNG có card nào được gửi về (server không sinh suggestedProducts)');
  }

  // ── TẦNG 2: card phải thuộc chuyên môn bot ──────────────────────────
  const foreign = cardUrls.filter((u) => {
    const bots = botsForProduct(u);
    // Sản phẩm không có trong taxonomy → coi như lạ (cần kiểm tra).
    if (bots.length === 0) return true;
    return !bots.includes(c.botId);
  });
  if (foreign.length) {
    issues.push(
      `card thuộc chuyên môn bot KHÁC: ${foreign.map(slug).join(', ')}`
    );
  }

  // Card nên ưu tiên sản phẩm mà bot là chủ sở hữu chính.
  const mine = cardUrls.filter((u) => primaryOwnerForProduct(u) === c.botId);
  if (!c.skipProducts && cards.length > 0 && mine.length === 0) {
    issues.push('KHÔNG card nào là sản phẩm chủ sở hữu chính của bot');
  }

  // ── TẦNG 3: tên sản phẩm bot nhắc trong text phải thuộc chuyên môn ──
  const foreignMentions = mentionUrls.filter((u) => {
    const bots = botsForProduct(u);
    if (bots.length === 0) return true;
    return !bots.includes(c.botId);
  });
  if (foreignMentions.length) {
    issues.push(
      `bot nhắc tên sản phẩm NGOÀI chuyên môn: ${foreignMentions.map(slug).join(', ')}`
    );
  }

  // Link trong text nhưng không có card → tên "mồ côi".
  const orphan = mentionUrls.filter(
    (u) => !cardUrls.some((c2) => c2.replace(/\/$/, '') === u.replace(/\/$/, ''))
  );
  if (orphan.length) {
    issues.push(`link trong text KHÔNG có card: ${orphan.map(slug).join(', ')}`);
  }

  return {
    botId: c.botId,
    label: c.label,
    cards,
    answer,
    cardUrls,
    mentionUrls,
    ok: issues.length === 0,
    issues,
  };
}

async function main() {
  console.log('═'.repeat(78));
  console.log('AUDIT CHUYÊN MÔN + HIỂN THỊ CARD CHO 7 BOT');
  console.log('═'.repeat(78));

  const results: Result[] = [];
  for (const c of CASES) {
    try {
      results.push(await run(c));
    } catch (e) {
      console.error(`❌ ${c.label}: lỗi mạng — ${(e as Error).message}`);
      results.push({
        botId: c.botId,
        label: c.label,
        cards: [],
        answer: '',
        cardUrls: [],
        mentionUrls: [],
        ok: false,
        issues: [`lỗi mạng: ${(e as Error).message}`],
      });
    }
  }

  let pass = 0;
  let fail = 0;

  for (const r of results) {
    const names = r.cards.map((p: any) => p.title).slice(0, 6);
    console.log('');
    console.log(`━━━ ${r.label}  (${r.botId})`);
    console.log(`    card: ${r.cards.length} | link trong text: ${r.mentionUrls.length}`);
    if (names.length) console.log(`    tên: ${names.join(' | ')}`);
    else if (!r.cards.length) console.log('    tên: (KHÔNG CÓ)');

    if (r.ok) {
      pass++;
      console.log('    ✅ PASS');
    } else {
      fail++;
      console.log('    ❌ FAIL');
      for (const i of r.issues) console.log(`       • ${i}`);
    }
  }

  console.log('');
  console.log('═'.repeat(78));
  console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
  console.log('═'.repeat(78));

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
