/**
 * ⭐ TÁI HIỆN LỖI "CHỈ HIỆN TÊN, KHÔNG HIỆN CARD".
 *
 * Mô phỏng CHÍNH XÁC logic chặn ở frontend (src/pages/ChatPage.tsx) rồi đối
 * chiếu với event `suggestedProducts` mà server thực sự gửi về.
 *
 * Nếu server CÓ gửi suggestedProducts nhưng frontend gate trả false →
 * UI chỉ hiện danh sách tên trong markdown, KHÔNG render ProductCardsGrid.
 */

import { detectAnsweredQuestions, hasCompletedConsultQuestions } from '../src/lib/consultQuestions';

const PORT = process.env.PORT || '3001';
const API = `http://localhost:${PORT}/api/chat/stream`;

/** ⭐ Copy chính xác từ ChatPage.tsx (KNOWN_PRODUCT_NAMES) */
const KNOWN_PRODUCT_NAMES = [
  'orcam', 'orcam read', 'orcam myeye', 'orcam advance',
  'jaws', 'nvda', 'zoomtext', 'izoom', 'dragon professional', 'dragon',
  'screen reader', 'mách đọc màn hình',
  'reveal', 'aurora hd', 'helix hd', 'compact 6', 'focus 14', 'blaze et',
  'clearview', 'clareo', 'smart magnifier', 'luna', 'luna series',
  'snow 12', 'pegasus', 'mira', 'argus',
  'braillenote', 'braillesense', 'braille display', 'màn hình chữ nổi',
  'bookman', 'pedant', 'type 4', 'braille embosser',
  'tele tv', 'envision glasses', 'acesight', 'mắt kính thông minh',
  'phonic', 'myvoice', 'vn', 'voice', 'talking tablet',
  'dragon', 'dragon speech', 'tobi dynavox', 'proloquo', 'go talk',
  'grid', 'neuro node', 'mega core',
  'oticon', 'phonak', 'widex', 'signia', 'resound', 'rexton', 'unitron',
  'liestech', 'comfort audio', 'oticon charm', 'xelsys', 'mỏm chú ý',
  'oticon bone', 'cochlear', 'baha', 'bionik',
  'wheelchair', 'xe lăn', 'permobil', 'quickie', 'ottobock', 'sunrise',
  'electric wheelchair', 'xe điện', 'ghế xe điện',
  'walkaid', 'rollator', 'giày thông minh', 'smart shoes',
  'hands-free', 'lightbox', 'emotion', 'talking watch',
];

function mentionsSpecificProduct(message: string): boolean {
  const lower = (message || '').toLowerCase();
  if (!lower.trim()) return false;
  return KNOWN_PRODUCT_NAMES.some(name => lower.includes(name));
}

/** ⭐ Mô phỏng gate cuối cùng của frontend (ChatPage.tsx ~dòng 3119-3187) */
function frontendAllowsCards(opts: {
  userHasApproved: boolean;
  userExplicitlyRequestsProducts: boolean;
  nextConsult: unknown | null;      // getSafeNextConsultQuestion
  botAlreadyAsked: boolean;
  alreadyConsulted: boolean;
  triggersProductSuggestion: boolean;
  isReadyForProducts: boolean;
}): boolean {
  let allowProductAdvice = opts.userHasApproved || opts.userExplicitlyRequestsProducts;

  if (!allowProductAdvice && opts.nextConsult && !opts.botAlreadyAsked) {
    allowProductAdvice = false;
  } else if (!allowProductAdvice && opts.nextConsult && opts.botAlreadyAsked) {
    allowProductAdvice = false;
  } else if (!allowProductAdvice && opts.alreadyConsulted && opts.triggersProductSuggestion) {
    allowProductAdvice = true;
  } else if (!allowProductAdvice && opts.alreadyConsulted && opts.isReadyForProducts) {
    allowProductAdvice = true;
  }
  return allowProductAdvice;
}

interface Case {
  botId: string;
  label: string;
  message: string;
  /** Trả lời trước đó của user (để dựng lịch sử hội thoại) */
  history?: string[];
}

const CASES: Case[] = [
  { botId: 'bot-hearing', label: 'Thính giác', message: 'EduMic dùng cho mục đích gì?' },
  { botId: 'bot-vision', label: 'Thị giác', message: 'VisionBuddy giúp được gì?' },
  { botId: 'bot-speech', label: 'Giọng nói', message: 'TD Pilot là gì?' },
  { botId: 'bot-cognitive', label: 'Nhận thức', message: 'CoughDrop AAC dùng để làm gì?' },
  { botId: 'bot-neuro', label: 'Cơ xương khớp', message: 'Xbox Adaptive Controller hoạt động thế nào?' },
  { botId: 'bot-mobility', label: 'Di chuyển', message: 'WeWALK Smart Cane giúp gì?' },
  { botId: 'bot-hearing', label: 'Thính giác (có trong list)', message: 'Oticon Amigo Arc là gì?' },
  { botId: 'bot-vision', label: 'Thị giác (có trong list)', message: 'OrCam MyEye hoạt động ra sao?' },
];

async function run(c: Case) {
  const history = c.history ?? [];
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: c.message,
      agentId: c.botId,
      conversationId: `repro-${c.botId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      language: 'vi',
      consultQuestionsCompleted: false,
      isExplicitProductQuery: mentionsSpecificProduct(c.message),
    }),
  });
  const raw = await res.text();

  let cardProducts: any[] = [];
  // ⭐⭐ CỜ CHÍNH THỨC TỪ SERVER (nguồn sự thật) — giống hệt ChatPage.tsx.
  let serverExplicitProductQuery: boolean | null = null;
  for (const m of raw.matchAll(/data: (\{.*?\})\n\n/g)) {
    try {
      const ev = JSON.parse(m[1]);
      if (ev.type === 'suggestedProducts') cardProducts = ev.suggestedProducts || [];
      if (ev.type === 'done' && typeof ev.isExplicitProductQuery === 'boolean') {
        serverExplicitProductQuery = ev.isExplicitProductQuery;
      }
    } catch { /* ignore */ }
  }

  // ── Mô phỏng frontend gate (đúng logic ChatPage.tsx hiện tại) ─────────
  const pastUserMessages = [...history, c.message];
  const alreadyConsulted = hasCompletedConsultQuestions(pastUserMessages);
  const userExplicitlyRequestsProducts = mentionsSpecificProduct(c.message);
  const triggersProductSuggestion = /sản phẩm|thiết bị|máy|mua|ở đâu|gợi ý|đề xuất|recommend|suggest|sp\b/i.test(c.message);
  const isReadyForProducts = false; // lượt đầu, chưa đủ context
  const nextConsult = null;         // bot hỏi đủ rồi trong kịch bản hỏi tên sản phẩm

  // ⭐ ƯU TIÊN cờ server; chỉ fallback về danh sách local khi server chưa trả cờ.
  const explicitProductDetected =
    serverExplicitProductQuery === null
      ? userExplicitlyRequestsProducts
      : serverExplicitProductQuery;

  const allow = frontendAllowsCards({
    userHasApproved: false,
    userExplicitlyRequestsProducts: explicitProductDetected,
    nextConsult,
    botAlreadyAsked: false,
    alreadyConsulted,
    triggersProductSuggestion,
    isReadyForProducts,
  });

  const serverSent = cardProducts.length;
  const clientKeeps = allow && serverSent > 0;
  const names = cardProducts.slice(0, 4).map((p: any) => p.title).join(' | ');

  const verdict = serverSent > 0 && !clientKeeps
    ? '❌ MẤT CARD (server có, client bỏ)'
    : serverSent === 0
      ? '⚠️  server không gửi card'
      : '✅ có card';

  console.log(`${verdict}  [${c.label}] "${c.message}"`);
  console.log(
    `      server gửi: ${serverSent} card | cờ server: ${serverExplicitProductQuery} | ` +
    `list local: ${userExplicitlyRequestsProducts ? 'CÓ' : 'KHÔNG'} | frontend allow: ${allow}`
  );
  if (names) console.log(`      card: ${names}`);
  console.log();
}

async function main() {
  console.log('=== TÁI HIỆN: server gửi card nhưng frontend bỏ ===\n');
  for (const c of CASES) await run(c);
}

main().catch((e) => { console.error('❌ Fatal:', e); process.exit(1); });
