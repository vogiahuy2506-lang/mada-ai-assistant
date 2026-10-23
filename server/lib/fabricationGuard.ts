/**
 * ⭐⭐ CHỐNG BỊA — lớp kiểm duyệt bằng CODE, không phụ thuộc prompt.
 *
 * ⚠️ VÌ SAO CẦN (đã kiểm chứng trên log thật):
 * Chỉ dựa vào prompt ("KHÔNG được bịa tên sản phẩm") là KHÔNG ĐỦ. Log chat
 * thật cho thấy bot vẫn bịa:
 *   • Tên sản phẩm: "WHILL Model F", "Jazzy Passport", "Karman XO-202"
 *   • Tên hãng:     "Hãng: Phonak, Oticon, Widex" (chỉ Oticon có thật)
 *   • Giá:          "3-5 triệu", "5-30 triệu đồng" (MADA KHÔNG công bố giá)
 *   • Nhà bán lẻ:   "Pyramid Educational Consultants VN hoặc Shopee"
 *
 * Đây là rủi ro PHÁP LÝ: bịa sản phẩm/giá có thể vi phạm luật bảo vệ người
 * tiêu dùng. Vì vậy ta kiểm tra bằng code: mọi tên/giá/URL phải có thật trong
 * DB MADA thì mới được giữ.
 *
 * NGUYÊN TẮC:
 *   • KHÔNG xoá sản phẩm thật (regression = mất hàng, mất doanh thu).
 *   • Ưu tiên "bỏ tên sai" hơn "giữ tên sai".
 *   • Luôn sửa lại câu sau khi cắt (dùng repairTruncatedSentences).
 *
 * API:
 *   • removeFabricatedContent(answer) — lọc tên/giá/URL/brand bịa.
 *   • detectFabrications(answer)       — chỉ báo cáo (dùng để cảnh báo/log).
 */

import { buildProductCatalog, normalizeProductName } from './productLinker';

// ============== TỪ ĐIỂN THAM CHIẾU ==============

/** URL sản phẩm thật của MADA. */
let _urlSet: Set<string> | null = null;
let _urlSetAt = 0;
const URL_TTL_MS = 60_000;

/** Tên + brand đã chuẩn hoá. */
let _nameSet: Set<string> | null = null;
/** Từ riêng ("token") xuất hiện trong tên/brand sản phẩm thật. */
let _tokenSet: Set<string> | null = null;
let _lexAt = 0;

/** URL hợp lệ của MADA (dùng để so khớp, bỏ qua http/https và dấu / cuối). */
function buildUrlSet(): Set<string> {
  const now = Date.now();
  if (_urlSet && now - _urlSetAt < URL_TTL_MS) return _urlSet;

  const set = new Set<string>();
  for (const e of buildProductCatalog()) {
    for (const u of [e.product_url, e.source_url]) {
      if (!u) continue;
      set.add(u.trim().replace(/\/+$/, '').toLowerCase());
    }
  }
  _urlSet = set;
  _urlSetAt = now;
  return set;
}

/**
 * Từ điển: tên đầy đủ + các token từ tên/brand sản phẩm thật.
 *
 * Ví dụ "Oticon Amigo T31, T30" + brand "Oticon" →
 *   nameSet  = { "oticon amigo t31 t30", ... }
 *   tokenSet = { oticon, amigo, t31, t30, ... }
 *
 * Token giúp phân biệt: "Grid" có thật (Grid 3) nhưng "Grid Pad" thì không,
 * vì "pad" không nằm trong tokenSet.
 */
function buildLexicon(): { names: Set<string>; tokens: Set<string> } {
  const now = Date.now();
  if (_nameSet && _tokenSet && now - _lexAt < URL_TTL_MS) {
    return { names: _nameSet, tokens: _tokenSet };
  }

  const names = new Set<string>();
  const tokens = new Set<string>();

  for (const e of buildProductCatalog()) {
    for (const raw of [e.title, e.title_en, e.brand]) {
      if (!raw) continue;
      const n = normalizeProductName(raw);
      if (!n) continue;
      names.add(n);
      // Token dài ≥ 2 ký tự mới đáng so khớp (bỏ "t", "a" gây nhiễu).
      for (const t of n.split(' ')) {
        if (t.length >= 2) tokens.add(t);
      }
    }
  }

  _nameSet = names;
  _tokenSet = tokens;
  _lexAt = now;
  return { names, tokens };
}

// ============== TỪ KHOÁ MIỄN TRỪ ==============

/**
 * Từ KHÔNG phải tên sản phẩm dù viết hoa — tiêu chuẩn, tổ chức, thuật ngữ.
 *
 * ⚠️ Đây là danh sách "cho phép" để tránh xoá nhầm. Mở rộng danh sách này
 * AN TOÀN hơn là thu hẹp (mỗi từ thêm vào = 1 trường hợp bị bỏ sót bịa).
 */
const ALLOWED_WORDS = new Set(
  [
    // Tiêu chuẩn & tổ chức
    'iso', 'iec', 'wcag', 'w3c', 'who', 'un', 'eud', 'mdr', 'fda', 'ansi',
    'bs', 'en', 'din', 'jis', 'iec', 'cen', 'ul', 'ce', 'rohs', 'weee',
    // Ngôn ngữ / ký hiệu
    'vietnam', 'vietnamese', 'tieng', 'viet', 'qatar', 'doha', 'arabic',
    'english', 'french', 'spanish', 'chinese', 'tiengviet',
    // Y tế / AT chung
    'at', 'aac', 'pecs', 'bte', 'ite', 'cic', 'mdr', 'scan', 'hp', 'vr',
    'tele', 'ecg', 'eeg', 'emg', 'mri', 'ct', 'us', 'uk', 'eu', 'usa',
    'ld', 'hd', 'iab', 'ind', 'adhd', 'cp', 'asd', 'ds', 'ms', 'als',
    'ra', 'al', 'w', 'h', 'cm', 'mm', 'kg', 'lb', 'ml', 'l',
    // Thương mại
    'mada', 'mada', 'qatar', 'centre', 'center', 'shop', 'online', 'website',
    'email', 'phone', 'whatsapp', 'contact', 'sdn', 'bhd', 'ltd', 'llc', 'inc',
    'gmbh', 'co', 'company', 'group', 'corp', 'technologies', 'technology',
    'systems', 'solutions', 'international', 'global', 'worldwide',
    // Nhóm sản phẩm chung (KHÔNG phải tên riêng)
    'wheelchair', 'wheelchairs', 'hearing', 'speech', 'vision', 'cognition',
    'mobility', 'communication', 'daily', 'living', 'education', 'screen',
    'reader', 'keyboard', 'mouse', 'switch', 'buttons', 'headset', 'earphone',
    'amplifier', 'cochlear', 'prosthetic', 'orthotic', 'orthosis', 'prosthesis',
    'sensor', 'device', 'devices', 'product', 'products', 'model', 'models',
    'brand', 'brands', 'series', 'version', 'edition', 'size', 'weight',
    // Thời gian / số
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'am', 'pm', 'review', 'reviews', 'guide', 'guides', 'step', 'steps',
    'type', 'types', 'class', 'classes', 'level', 'levels', 'group', 'groups',
  ].map((s) => s.toLowerCase())
);

/**
 * Tên riêng HỢP LỆ nhưng KHÔNG nằm trong DB MADA — vẫn phải cho phép nhắc,
 * vì chúng là thực thể công khai, không phải sản phẩm MADA bịa ra.
 *
 * ⚠️ Đây là "van an toàn": nếu danh sách này rỗng, hàm sẽ xoá cả những thứ
 * hợp lệ. Chỉ thêm khi đã kiểm tra chắc chắn đó không phải sản phẩm bịa.
 */
const ALLOWED_PROPER_NOUNS = new Set(
  [
    'mada', 'qatar', 'doha', 'vietnam', 'vietnamese', 'arabic',
    'google', 'apple', 'microsoft', 'amazon', 'samsung', 'sony', 'nintendo',
    'minecraft', 'roblox', 'youtube', 'facebook', 'instagram', 'whatsapp',
    'zoomtext', 'nvda', 'screen', 'reader',
    // ⚠️ Thuật ngữ ngành — KHÔNG phải tên sản phẩm (đã gặp trong log thật:
    // "Picture Exchange Communication System", "PDF", "OCR", "Screenshot").
    'pdf', 'ocr', 'screenshot', 'picture', 'exchange', 'communication',
    'system', 'systems', 'udi', 'di', 'mdr', 'eu', 'uk', 'us', 'usa',
    // ⚠️ Thuật ngữ pháp lý y tế (đã gặp trong log thật):
    // "Technical Documentation", "Declaration of Conformity", "WHO GATE".
    'technical', 'documentation', 'declaration', 'conformity', 'gate',
    'conform', 'statement', 'labelling', 'labeling', 'prd', 'ud', 'imdr',
    'md', 'mdd', 'general', 'safety', 'performance', 'clinical', 'biologic',
    'intellectual', 'property', 'patent', 'copyright', 'registration',
  ].map((s) => s.toLowerCase())
);

// ============== NHẬN DIỆN TÊN BỊA ==============

/**
 * ⭐ Kiểm tra 1 tên có thật trong catalog không.
 *
 * ⚠️ VÌ SAO CẦN SO KHỚP LẠNG NHIỀU CÁCH:
 * `normalizeProductName` bỏ ký tự đặc biệt → "Echo® 2.4G" thành "echo 2 4g".
 * Nhưng `**bold**` trong câu trả lời có thể bị model viết khác (thêm/bớt ngoặc,
 * bỏ ®, viết "Echo 2.4G"). Nếu chỉ so khớp chính xác chuẩn hoá, tên THẬT sẽ
 * bị xoá nhầm → mất sản phẩm hợp lệ. Vì vậy thử nhiều biến thể trước khi kết luận là bịa.
 */
function isRealName(
  raw: string,
  names: Set<string>,
  tokens: Set<string>
): boolean {
  const n = normalizeProductName(raw);
  if (!n) return true;

  if (names.has(n)) return true;
  if (ALLOWED_WORDS.has(n) || ALLOWED_PROPER_NOUNS.has(n)) return true;

  // Biến thể: bỏ ngoặc/phần mở rộng cuối (VD "Grid 3" vs "Grid 3 (Arabic-English)").
  const stripped = n.replace(/\s+\S+$/, '');
  if (stripped.length >= 4 && names.has(stripped)) return true;

  // Mọi token trong cụm đều phải xuất hiện trong DB mới coi là hợp lệ.
  // (VD "Grid" có thật (Grid 3) nhưng "Grid Pad" không → "pad" không có trong tokens.)
  const parts = n.split(' ').filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.every((p) => tokens.has(p) || ALLOWED_WORDS.has(p) || ALLOWED_PROPER_NOUNS.has(p))) {
    return true;
  }

  // Cụm dài ≥ 4 token mà chỉ khác ở 1 token → coi như biến thể viết sai.
  // (VD "Karman XO-202" bịa; nhưng "Oticon Amigo T31 T30" thật sẽ khớp names.)
  if (parts.length >= 3) {
    const missing = parts.filter(
      (p) => !tokens.has(p) && !ALLOWED_WORDS.has(p) && !ALLOWED_PROPER_NOUNS.has(p)
    );
    if (missing.length === 1 && missing[0].length <= 4) {
      const rest = parts.filter((p) => p !== missing[0]).join(' ');
      if (rest.length >= 4 && tokens.has(rest.split(' ')[0])) return true;
    }
  }

  return false;
}

/** Dấu hiệu tên sản phẩm: CamelCase, ALLCAPS, hoặc có chữ số xen kẽ. */
function looksLikeProductToken(tok: string): boolean {
  if (tok.length < 2) return false;
  // ALLCAPS: JAWS, NVDA, GATE
  if (/^[A-Z]{2,}$/.test(tok)) return true;
  // CamelCase: ZoomText, Proloquo2Go, EduMic, ReSound
  if (/^[A-Z][a-z]+[A-Z]/.test(tok)) return true;
  // Có số xen kẽ chữ: eSight, BrailleSense6, Q2
  if (/^[A-Za-z]+\d+[A-Za-z0-9]*$/.test(tok)) return true;
  // Số xen kẽ có dấu gạch nối: XO-202, MDR-2017, Model-F
  // ⚠️ Phải kiểm trên cả từng PHẦN sau khi tách dấu gạch, vì "XO-202" không
  // khớp `^[A-Za-z]+\d+...` (ký tự '-' nằm giữa).
  if (/^[A-Za-z]+[-.]?\d+[A-Za-z0-9-]*$/.test(tok)) return true;
  return false;
}

/** Cụm 2 từ Việt hoa chữ cái đầu: "Jazzy Passport", "Grid Pad", "WHILL Model". */
const TWO_CAP_WORDS = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;

/**
 * Mức giá — MADA KHÔNG công bố giá nên mọi mức đều là bịa.
 *
 * ⚠️ VÌ SAO regex phải cẩn thận:
 * - `$` là ký tự đặc biệt, phải escape. Và "$2,500" BẮT ĐẦU bằng `$` nên không
 *   dùng `\b` trước số (sau `$` không có word boundary với số).
 * - "500.000 đồng" / "500.000đ": cần bắt được cả khi dấu chấm phân cách nghìn.
 * - "3-5 triệu", "từ 5-30 triệu": bắt được cả dấu gạch nối.
 *
 * ⚠️ KHÔNG dùng cờ `g` ở đây: hàm gọi dùng `.test()` nhiều lần, cờ `g` làm
 * `lastIndex` tự dịch chuyển → kết quả khớp/bỏ khớp xen kẽ không ổn định.
 */
const PRICE_RE =
  /(?:\d[\d.,]*\s*(?:[-–—~]\s*\d[\d.,]*\s*)?(?:triệu|nghìn|ngàn|vnd|đ(?:[\s.,]|$)|đồng))|(?:[$€£]\s*\d[\d.,]*)|(?:\b\d[\d.,]*\s*(?:[-–—~]\s*\d[\d.,]*\s*)?(?:dollars?|usd|qar|eur))/i;

/** Dẫn nhập cụm tên hãng: "Hãng: Phonak, Oticon", "thương hiệu: AbleNet". */
const BRAND_LEAD =
  /(?:hãng|hãng\s+sản\s+xuất|thương\s+hiệu|của\s+(?:hãng|thương\s+hiệu)|brand|brands)\s*[:：]\s*([^\n.]{3,120})/gi;

interface Fabrication {
  kind: 'product' | 'brand' | 'price' | 'url';
  value: string;
}

/**
 * Phân tích câu trả lời, trả về danh sách nội dung bịa tìm được.
 * Dùng cho cảnh báo/log; `removeFabricatedContent` dùng để gỡ.
 */
export function detectFabrications(answer: string): Fabrication[] {
  if (!answer) return [];
  const { names, tokens } = buildLexicon();
  const urls = buildUrlSet();
  const found: Fabrication[] = [];

  // --- 1. URL MADA không có trong DB ---
  const urlRe = /https?:\/\/at\.mada\.org\.qa\/technology\/[^\s)>\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(answer))) {
    const u = m[0].replace(/[.,;:]+$/, '').replace(/\/+$/, '').toLowerCase();
    if (u && !urls.has(u)) {
      found.push({ kind: 'url', value: m[0] });
    }
  }

  // --- 2. Giá (MADA không công bố giá → mọi mức giá đều là bịa) ---
  const priceGlobal = new RegExp(PRICE_RE.source, 'gi');
  while ((m = priceGlobal.exec(answer))) {
    found.push({ kind: 'price', value: m[0] });
  }

  // --- 3. Tên sản phẩm bịa ---
  const seen = new Set<string>();

  const consider = (raw: string, kind: Fabrication['kind'] = 'product') => {
    const tok = raw.trim().replace(/[.,;:!?'")]/g, '');
    if (!tok || tok.length < 3) return;
    if (seen.has(tok.toLowerCase())) return;
    seen.add(tok.toLowerCase());

    if (isRealName(tok, names, tokens)) return;
    found.push({ kind, value: tok });
  };

  // --- 3. Tên sản phẩm bịa — CHỈ trong **bold** ---
  //
  // ⚠️ Giữ đúng bằng logic của `stripFabricatedNames` (chỉ bold + brand list).
  // Nếu ở đây quét mọi token CamelCase trong khi hàm gỡ thì không, phần "phát
  // hiện" và phần "gỡ" sẽ lệch nhau → cảnh báo báo bịa nhưng câu trả lời vẫn có.
  const boldRe = /\*\*([^*\n]{2,80})\*\*/g;
  while ((m = boldRe.exec(answer))) consider(m[1]);

  // --- 4. Tên hãng bịa sau các cụm dẫn nhập ---
  BRAND_LEAD.lastIndex = 0;
  while ((m = BRAND_LEAD.exec(answer))) {
    for (const rawPart of m[1].split(/[,;]|\bvà\b|\band\b|\/|\+|\bor\b|\bhoặc\b/i)) {
      const part = rawPart.trim();
      if (!part) continue;

      // Cắt dần từ ở cuối (xem giải thích trong `stripFabricatedNames`) vì cụm
      // cuối hay bị văn xuôi dính vào: "Crick Software đều có…".
      const words = part.split(/\s+/);
      let decided = false;
      for (let take = words.length; take >= 1; take--) {
        const candidate = words.slice(0, take).join(' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
        if (!candidate) continue;
        if (isRealName(candidate, names, tokens)) {
          decided = true; // hãng thật → không báo bịa
          break;
        }
      }
      if (!decided) consider(part, 'brand');
    }
  }

  return found;
}

// ============== GỠ NỘI DUNG BỊA ==============

/** Xoá các mệnh đề "mua ở đâu / nhà phân phối / shop" không thuộc MADA. */
const RESELLER_CLAIM =
  /\b(?:mua|đặt|order|bán|phân\s+phối|reseller|distributor|liên\s+hệ\s+tại)\b[^.\n]{0,60}?\b(?:shopee|lazada|amazon\.com|tiki|taobao|alibaba|facebook\s+page|group\s+facebook)\b[^.\n]*/gi;

/**
 * Quét 1 lần, xoá mọi cụm tên bịa — thử cụm DÀI NHẤT trước.
 *
 * ⚠️ VÌ SAO CẦN THỬ NHIỀU ĐỘ DÀI:
 * Tên sản phẩm thật có thể rất dài và chứa từ "trông giống tên sản phẩm":
 *   "Eurobraille b.note 20" → nếu chỉ khớp "Eurobraille b" sẽ kết luận bịa.
 *   "Oticon Amigo T31, T30"  → "T30" trông như token sản phẩm.
 * Nếu quét ngược (dài → ngắn) và dừng ngay khi tìm thấy cụm HỢP LỆ thì các cụm
 * con bên trong không bao giờ bị xét riêng → không xoá nhầm.
 *
 * @returns Văn bản đã lọc.
 */
function stripFabricatedNames(
  text: string,
  names: Set<string>,
  tokens: Set<string>
): string {
  // ⚠️ THIẾT KẾ CUỐI — CHỈ XỬ LÝ 2 TÍN HIỆU ĐÁNG TIN CẬY:
  //
  // 1) TÊN TRONG **BOLD**: bot LUÔN in đậm tên sản phẩm/hãng. Đây là tín hiệu
  //    mạnh nhất và không nhầm với văn xuôi.
  // 2) DANH SÁCH HÃNG sau cụm dẫn "Hãng:", "thương hiệu:", "của hãng".
  //
  // ⚠️ VÌ SAO KHÔNG quét mọi từ trông giống tên sản phẩm:
  // Cách cũ quét mọi CamelCase/ALLCAPS trong văn bản. Điều đó phá hỏng câu
  // tiếng Việt: "Bạn cần Technical Documentation" → khớp nhầm các mảnh chữ,
  // và "Xe lăn điện thuộc Class I theo EU MDR 2017/745" bị cắt thành
  // "Xe lăn điện thuộ MDR 2017/745" (mất "Class I"). Rủi ro xoá nhầm NỘI DUNG
  // HỢP LỆ lớn hơn nhiều so với bỏ sót 1 tên bịa viết không in đậm — mà tên bịa
  // loại đó đã bị chặn bởi tầng prompt + không bao giờ có link MADA.
  //
  // Bù lại: URL MADA bịa, giá bịa và nhà bán lẻ vẫn bị chặn ở các bước khác,
  // và prompt đã yêu cầu model luôn in đậm tên sản phẩm.
  let out = text;

  // --- 1) Tên trong **bold** ---
  out = out.replace(/\*\*([^*\n]{2,80})\*\*/g, (_full, raw: string) => {
    const name = raw.trim();
    if (!name || name.length < 3) return _full;
    return isRealName(name, names, tokens) ? _full : '';
  });

  // --- 2) Danh sách hãng sau cụm dẫn nhập ---
  out = out.replace(BRAND_LEAD, (full, list: string) => {
    const kept: string[] = [];

    for (const rawPart of list.split(/[,;]|\bvà\b|\band\b|\/|\+|\bor\b|\bhoặc\b/i)) {
      const part = rawPart.trim();
      if (!part) continue;

      // ⚠️ Cụm cuối thường bị VĂN XUÔI dính vào:
      // "Crick Software đều có sản phẩm" — "Crick Software" là hãng thật nhưng
      // cụm chứa nó thì không khớp catalog → bị xoá cả, mất hãng hợp lệ.
      // → Cắt dần các từ ở CUỐI cho tới khi tìm được tên hãng hợp lệ.
      const words = part.split(/\s+/);
      let accepted = '';
      for (let take = words.length; take >= 1; take--) {
        const candidate = words.slice(0, take).join(' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
        if (!candidate) continue;
        if (isRealName(candidate, names, tokens)) {
          accepted = candidate;
          break;
        }
      }

      if (accepted) kept.push(accepted);
      else if (part.length <= 2) kept.push(part); // giữ dấu phẩy lạ, vô hại
    }

    if (kept.length === 0) return '';
    const lead = full.split(/[:：]/)[0];
    return `${lead}: ${kept.join(', ')}`;
  });

  return out;
}

/** Cụm này có trông giống tên sản phẩm không (để biết có cần kiểm tra không). */
function isSuspectPhrase(phrase: string): boolean {
  const parts = phrase.split(' ').filter(Boolean);
  if (parts.length === 0) return false;

  // ⚠️ TIÊU CHUẨN + PHIÊN BẢN → KHÔNG phải tên sản phẩm.
  // "ISO 9999:2022", "WCAG 2.2", "EN 301 549", "IEC 61508", "MDR 2017/745",
  // "ISO 22163:2017" đều trông giống tên sản phẩm (có số xen kẽ) nhưng là tiêu
  // chuẩn quốc tế — xoá đi sẽ phá nội dung pháp lý mà MADA hay hỏi.
  if (STANDARD_RE.test(phrase)) return false;

  if (parts.length === 1) return looksLikeProductToken(parts[0]);

  // ≥ 2 từ: đáng nghi nếu có từ viết kiểu tên sản phẩm (CamelCase/ALLCAPS/số),
  // HOẶC cả 2 từ đầu đều hoa và không thuộc danh sách cho phép.
  if (parts.some((p) => looksLikeProductToken(p))) {
    // Nhưng nếu mọi từ đều đã biết (nằm trong catalog hoặc danh sách cho phép)
    // thì cụm đó là thuật ngữ quen thuộc, không phải tên sản phẩm bịa.
    return !parts.every((p) => isKnownWord(p));
  }

  const first = parts[0];
  const second = parts[1];
  if (!/^[A-Z][a-z]{2,}$/.test(first) || !/^[A-Z][a-z]{2,}$/.test(second)) return false;

  // Cả hai từ đều trong danh sách cho phép → không đáng nghi.
  if (isKnownWord(first) || isKnownWord(second)) return false;

  return true;
}

/** Tiêu chuẩn quốc tế / văn bản pháp lý (không phải tên sản phẩm). */
const STANDARD_RE =
  /\b(?:iso|iec|wcag|astm|ansi|bs|en|din|jis|cen|ul|ieee|itu|isoiec|etsi|mdr|iec\s?62443)\s*[\d.:/-]*\b/i;

/** Từ này đã biết là hợp lệ không (trong catalog hoặc danh sách cho phép)? */
function isKnownWord(word: string): boolean {
  const n = normalizeProductName(word);
  if (!n) return true;
  return ALLOWED_WORDS.has(n) || ALLOWED_PROPER_NOUNS.has(n);
}

/**
 * Xoá CÂU có chứa mức giá.
 *
 * ⚠️ VÌ SAO XOÁ CÂU CHỨ KHÔNG XOÁ TỪ:
 * "Giá khoảng 3-5 triệu." → xoá từ "3-5 triệu" còn lại "Giá khoảng ." → người
 * dùng thấy câu vỡ nét, tưởng bot lỗi. Xoá hẳn câu đó sạch hơn nhiều.
 *
 * ⚠️ Nhưng câu hỏi của người dùng KHÔNG bị đụng: hàm chỉ xoá CÂU TRẢ LỜI của bot,
 * và chỉ xoá câu có giá. Câu hỏi không bao giờ đi qua đây (đây là filter output).
 */
function dropPriceClause(line: string): string {
  if (!PRICE_RE.test(line)) return line;

  // Tách thành câu theo dấu kết câu, giữ dấu kết để không lệch cấu trúc.
  const sentences = line.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((s) => !PRICE_RE.test(s));

  // Câu bị xoá hết → trả về rỗng để bước dọn dòng xoá luôn dòng.
  return kept.join(' ');
}

/**
 * ⭐ Gỡ mọi nội dung bịa khỏi câu trả lời.
 *
 * @returns Câu trả lời đã loại bỏ tên/giá/URL/nhà bán lẻ không có thật.
 */
export function removeFabricatedContent(answer: string): string {
  if (!answer) return answer;

  const { names, tokens } = buildLexicon();
  const urls = buildUrlSet();

  let out = answer;

  // --- 1. Xoá URL MADA bịa (giữ nguyên URL thật) ---
  out = out.replace(/https?:\/\/at\.mada\.org\.qa\/technology\/[^\s)>\]]+/gi, (full) => {
    const u = full.replace(/[.,;:]+$/, '').replace(/\/+$/, '').toLowerCase();
    return urls.has(u) ? full : '';
  });

  // --- 2. Xoá dòng link bịa trở thành trống ---
  out = out
    .split('\n')
    .map((l) => l.replace(/^([ \t]*(?:🔗\s*)?)[ \t]*$/, '$1'))
    .join('\n');

  // --- 3. Xoá nhà bán lẻ ngoài MADA ---
  out = out.replace(RESELLER_CLAIM, '');

  // --- 4. Xoá mức giá (MADA không công bố giá) ---
  // ⚠️ Xoá CÂU chứa giá, không chỉ từ "triệu" — nếu chỉ xoá từ thì câu còn
  // lại "Giá khoảng ." rất vô nghĩa và làm người dùng tưởng bot lỗi.
  out = out.split('\n').map((line) => dropPriceClause(line)).join('\n');

  // --- 5. Xoá tên sản phẩm / hãng bịa ---
  //
  // ⚠️ VÌ SAO PHẢI QUÉT 1 LẦN THAY VÌ THAY THẾ TUẦN TỰ:
  // Cách cũ chạy 3 vòng `replace` liên tiếp (bold → token → cụm 2 từ) làm hỏng
  // tên THẬT: "Eurobraille b.note 20" sống sót vòng bold, nhưng vòng "cụm 2 từ
  // hoa" khớp "Eurobraille b" (vì "b.note" bị normalize thành "b") → không có
  // trong DB → XOÁ NHẦM sản phẩm thật.
  //
  // Nay quét MỘT LẦN, tại mỗi vị trí thử cụm DÀI NHẤT trước (tên đầy đủ),
  // rồi mới lùi dần về 1 từ. Nhờ vậy tên dài luôn được so khớp nguyên vẹn.
  out = stripFabricatedNames(out, names, tokens);

  // --- 6. Dọn dấu câu/bullet rỗng do các bước xoá để lại ---
  out = out
    .split('\n')
    .filter((line) => {
      if (/^[\t ]*$/.test(line)) return true; // dòng trống → giữ (phân tách <p>)
      // Dòng chỉ còn dấu câu hoặc bullet rỗng → xoá.
      if (/^[\t ]*(?:[-–—•*][\t ]*){1,}[,.]?[\t ]*$/.test(line)) return false;
      if (/^[\t ]*[,…;:]+[\t ]*$/.test(line)) return false;
      return true;
    })
    .join('\n');

  // Dọt các dấu nối còn sót: "của hãng ," → "của hãng"
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(^|[\s,;:])[,;:]+(?=\s|$)/g, '$1')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(?:^[ \t]*\n){2,}/gm, '\n\n')
    .trim();

  return out;
}