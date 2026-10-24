/**
 * ⭐ Chèn link sản phẩm vào câu trả lời của bot.
 *
 * VÌ SAO CẦN:
 * Bot nhắc tên sản phẩm (VD "OrCam Read") nhưng câu trả lời không kèm link →
 * người dùng không biết tìm mua ở đâu. Yêu cầu nghiệp vụ: tên sản phẩm phải
 * có link NGAY DƯỚI nó.
 *
 * NGUYÊN TẮC:
 * Chỉ gắn link cho tên sản phẩm CÓ THẬT trong danh mục MADA. Tên bịa
 * (VD "OrCam Advance") không có trong DB → không gắn link, và bị loại khỏi
 * danh sách khuyến nghị để tránh giới thiệu sản phẩm không tồn tại.
 */

import {
  buildProductCatalog,
  findMentionedProducts,
  normalizeProductName,
  escapeRegExp,
  buildProductNameRegex,
  isShortProductTitle,
  hasExactCaseMention,
  isPresentedAsCatalogItem,
} from './productLinker';
import { botsForProduct } from './productTaxonomy';

/**
 * ⭐ Bot này có được nhắc sản phẩm này không?
 *
 * ⚠️ FAIL-OPEN CHỈ KHI KHÔNG XÁC ĐỊNH ĐƯỢC (không phải "không có trong taxonomy"):
 * Lý do: `botsForProduct()` đã tra 2 nguồn (file taxonomy MADA + index dự phòng
 * từ DB) → mọi mục trong catalog đều xác định được chủ sở hữu (đã kiểm chứng
 * 250/250 mục resolve được). Trước đây 7 TIÊU CHUẨN/QUY ĐỊNH (WCAG, ISO 9999,
 * EN 301 549…) nằm trong `knowledge_items` chứ không có trong file taxonomy →
 * `botsForProduct()` trả [] → bị coi là "thuộc mọi bot" → 42 leak
 * (7 tiêu chuẩn × 6 bot chuyên môn).
 *
 * → Chỉ còn 1 trường hợp fail-open: URL không có trong CẢ 2 nguồn (VD DB lỗi
 *   lúc deploy, hoặc mục mới thêm chưa kịp đồng bộ). Khi đó giữ tên lại an
 *   toàn hơn là xoá sạch tên sản phẩm khỏi câu trả lời.
 *
 * @param answer Câu trả lời gốc — cần để phân biệt "trích dẫn trong văn xuôi"
 *               với "giới thiệu một mục danh mục" (xem `isPresentedAsCatalogItem`).
 */
function isInBotScope(
  entry: {
    product_url?: string;
    source_url?: string;
    title?: string;
    title_en?: string;
    isReference?: boolean;
    coreName?: string;
  },
  botId: string | null | undefined,
  allowTitles?: Set<string> | null,
  answer?: string
): boolean {
  if (!botId) return true;
  // Bot 7 (Thông tin bổ trợ) được xem TOÀN BỘ danh mục.
  if (botId === 'bot-regulatory') return true;
  // ⚠️ CHỈ lọc cho bot MADA dựng sẵn (`bot-*`). Custom agent không có
  // taxonomy → mọi sản phẩm đều "ngoài chuyên môn" theo cách tính này → nếu
  // lọc, custom agent sẽ mất sạch tên sản phẩm khỏi câu trả lời.
  if (!botId.startsWith('bot-')) return true;

  // ⭐⭐ TÀI LIỆU THAM CHIẾU (tiêu chuẩn/quy định) — MỌI bot đều được trích dẫn.
  //
  // VÌ SAO:
  // Tiêu chuẩn (WCAG 2.2, ISO 9999, EN 301 549…) là văn bản dùng chung, KHÔNG
  // thuộc riêng chuyên môn nào và KHÔNG phải sản phẩm bán. Chuyên gia thị giác
  // trả lời "tương phản tối thiểu 4.5:1 theo WCAG 2.2" là câu trả lời ĐÚNG và
  // HỮU ÍCH — nếu lọc như sản phẩm, câu sẽ bị cắt thành "Theo , tương phản…".
  //
  // → MỌI bot được TRÍCH DẪN trong văn xuôi (không in đậm).
  // → Nhưng nếu bot trình bày tiêu chuẩn như MỘT MỤC DANH MỤC (in đậm tên
  //   đầy đủ kèm mô tả + link) → đó là "giới thiệu thiết bị/mục" → phải lọc
  //   theo chuyên môn, giống sản phẩm bán.
  if (entry.isReference) {
    if (!answer) return true;
    return !isPresentedAsCatalogItem(answer, entry);
  }

  // Sản phẩm được phép nhắc dù ngoài chuyên môn (user hỏi thẳng tên).
  if (allowTitles && allowTitles.size > 0) {
    const t = normalizeProductName(entry.title || '');
    const te = normalizeProductName(entry.title_en || '');
    if ((t && allowTitles.has(t)) || (te && allowTitles.has(te))) return true;
  }

  const url = entry.product_url || entry.source_url || '';
  const bots = botsForProduct(url);
  // Không xác định được chủ sở hữu → giữ (fail-open, an toàn khi DB lỗi).
  if (bots.length === 0) return true;
  return bots.includes(botId);
}

/**
 * Tìm các sản phẩm ĐƯỢC NHẮC trong câu trả lời mà bot KHÔNG được phép nhắc.
 *
 * ⚠️ CHỈ xét sản phẩm THỰC SỰ xuất hiện trong câu trả lời (dùng
 * `findMentionedProducts`) — không quét toàn bộ catalog. Nếu quét toàn bộ
 * catalog thì mỗi lượt chat sẽ gỡ hàng chục tên không có trong câu → hỏng
 * nội dung.
 */
function findOutOfScopeProducts(
  answer: string,
  botId: string | null | undefined,
  catalog: ReturnType<typeof buildProductCatalog>,
  allowTitles?: Set<string> | null
): Array<{ name: string; url: string }> {
  const out: Array<{ name: string; url: string }> = [];
  if (!answer || !botId || botId === 'bot-regulatory') return out;

  const mentioned = findMentionedProducts(answer, catalog);
  for (const entry of mentioned) {
    if (isInBotScope(entry, botId, allowTitles, answer)) continue;

    // ⭐⭐ Chọn ĐÚNG tên cần gỡ — tên phảI CÓ THẬT trong câu.
    //
    // VÌ SAO CẦN:
    // Tài liệu tham chiếu có tên đầy đủ kèm mô tả:
    //   "ISO 9999:2022 — Phân loại công nghệ hỗ trợ (AT)"
    // nhưng bot có thể chỉ viết tên lõi "ISO 9999:2022" (đúng format prompt
    // bắt buộc: tên + link ở dòng riêng). Nếu lấy tên đầy đủ để gỡ →
    // regex KHÔNG khớp câu → tên tiêu chuẩn ngoài chuyên môn LỌT vào câu
    // trả lời (đúng triệu chứng leak).
    //
    // → Ưu tiên tên đầy đủ nếu câu có; không thì dùng tên lõi.
    let name = entry.title || entry.title_en || '';
    if (entry.isReference && name && !answer.includes(name)) {
      const core = (entry.title || '').split('—')[0].trim();
      if (core.length >= 4 && answer.includes(core)) name = core;
    }

    if (!name || name.length < 4) continue;
    const url = entry.product_url || entry.source_url || '';
    if (!url) continue;
    out.push({ name, url });
  }
  return out;
}

/**
 * Tìm tên sản phẩm hợp lệ (có trong DB) chưa có link trong câu trả lời.
 *
 * @returns Danh sách { name, url } cần chèn link.
 */
function findProductsMissingLink(
  answer: string,
  catalog: ReturnType<typeof buildProductCatalog>
): Array<{ name: string; url: string }> {
  const mentions = findMentionedProducts(answer, catalog);
  const out: Array<{ name: string; url: string }> = [];

  for (const entry of mentions) {
    const url = entry.product_url || entry.source_url;
    if (!url || !url.startsWith('http')) continue;

    // ⭐ Nếu link này đã xuất hiện BẤT KỲ chỗ nào trong câu trả lời → bot đã
    // tự viết link đúng rồi → không chèn thêm (tránh link bị lặp).
    if (answer.includes(url)) continue;

    // ⭐⭐ TÀI LIỆU THAM CHIẾU: neo link vào TÊN LÕI, không phải tên đầy đủ.
    //
    // VÌ SAO:
    // Tiêu chuẩn trong DB có tên đầy đủ kèm mô tả:
    //   "WCAG 2.2 — Nguyên tắc và 4 mức tuân thủ (A, AA, AAA)"
    // nhưng bot trích dẫn trong văn xuôi chỉ viết "WCAG 2.2" → neo vào tên
    // đầy đủ sẽ KHÔNG tìm thấy dòng nào → mất link.
    //
    // → Nếu câu CÓ tên đầy đủ → neo vào tên đầy đủ (bot trình bày mục danh
    //   mục). Nếu KHÔNG có → neo vào tên lõi (bot trích dẫn).
    let name = entry.title || '';
    if (entry.isReference) {
      const core = (entry.title || '').split('—')[0].trim();
      const full = entry.title || '';
      if (core && core.length >= 4 && !answer.includes(full)) {
        name = core;
      }
    }
    if (!name) continue;

    // Nếu tên sản phẩm xuất hiện nhiều lần mà chưa có link ở đâu, chỉ chèn
    // 1 lần cho tên đầu tiên — tránh lặp link theo số lần nhắc tên.
    out.push({ name, url });
  }

  // ⭐ Chống lặp: mỗi URL chỉ chèn đúng 1 lần.
  const seenUrls = new Set<string>();
  return out.filter((item) => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });
}

/**
 * ⭐ Gỡ tên sản phẩm khỏi câu trả lời khi người dùng CHƯA đủ 4 câu hỏi.
 *
 * VÌ SAO CẦN:
 * Chỉ dựa vào prompt là chưa đủ — mô hình vẫn hay tự liệt kê thiết bị vì
 * system prompt riêng của từng bot (bot-vision…) có sẵn danh sách sản phẩm
 * và chỉ thị "giới thiệu sản phẩm". Vì vậy cần lớp lọc bắt buộc ở server.
 *
 * CÁCH LÀM:
 * Bỏ các khối văn bản có liệt kê tên sản phẩm (dòng chứa tên trong DB của
 * MADA, hoặc URL sản phẩm). Giữ nguyên phần còn lại của câu trả lời.
 *
 * @param answer Câu trả lời gốc.
 * @returns Câu trả lời đã loại bỏ phần nhắc tên sản phẩm.
 */
export function stripProductMentions(answer: string): string {
  if (!answer) return answer;

  const catalog = buildProductCatalog();
  if (catalog.length === 0) return answer;

  const lines = answer.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    // Bỏ hẳn dòng nào chứa URL sản phẩm MADA (dòng link riêng).
    if (/^\s*(?:🔗\s*)?https?:\/\/at\.mada\.org\.qa\/technology\/\S+\s*$/.test(line)) {
      continue;
    }

    kept.push(line);
  }

  let out = kept.join('\n');

  // Xóa các mục danh sách nhắc tên sản phẩm (dòng bắt đầu bằng -, *, •, số).
  out = out
    .split('\n')
    .filter((line) => {
      const isListItem = /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
      if (!isListItem) return true;
      if (/at\.mada\.org\.qa\/technology\//i.test(line)) return false;
      return !mentionsCatalogProduct(line, catalog);
    })
    .join('\n');

  // ⭐ Xóa tên sản phẩm NHÚNG TRONG CÂU (không phải list item).
  //
  // ⚠️ VÌ SAO CẦN: bot hay viết "Bạn đã - JAWS" hoặc "dùng OrCam MyEye nhé"
  // trên cùng một dòng với văn xuôi. Các tên này không bắt đầu bằng bullet nên
  // vòng lọc danh sách ở trên bỏ sót → sau khi xóa link, câu còn sót tên sản
  // phẩm vi phạm quy tắc "chưa đủ 4 câu thì cấm nhắc thiết bị".
  //
  // Cách làm: cắt phần tên sản phẩm ra khỏi dòng, kèm dấu nối phía trước
  // (bullet/dấu phẩy/gạch nối) cho sạch, rồi dọn khoảng trắng thừa.
  //
  // ⚠️ TÊN NGẮN (< 8 ký tự) PHẢI KHỚP HOA THƯỜNG:
  // "Pearl", "Clicker" vừa là tên sản phẩm vừa là từ tiếng Anh có
  // nghĩa ("viên ngọc", "cái bấm") — khớp không phân biệt hoa thường sẽ xóa
  // nhầm rồi làm câu nghĩa đổi. Danh sách chỉ có 18 tên dưới 8 ký tự và đều
  // là thương hiệu viết hoa (JAWS, Osmo, Mabot, Pearl…), nên khớp HOA THƯỜNG
  // vừa bắt được sản phẩm vừa không dính từ thường.
  // ⭐⭐ SẮP XẾP TÊN DÀI TRƯỚC — tránh gỡ tên ngắn nằm TRONG tên dài.
  //
  // VÌ SAO CẦN:
  // "Dwell Clicker 2" CHỨA "Clicker", và "SmartNav 4 with Dwell clicker 2"
  // chứa cả hai. Nếu gỡ theo thứ tự catalog, tên ngắn ("Clicker") có thể bị
  // gỡ trước → tên dài bị MÉO thành "Dwell 2" hoặc để lửng "SmartNav 4 with".
  //
  // → Gỡ tên DÀI NHẤT trước. Khi tên dài đã bị gỡ, tên ngắn bên trong nó
  //   cũng không còn trong câu → không gỡ nhầm nữa.
  const stripTargets = [...catalog]
    .map((entry) => ({ entry, name: (entry.title || '').trim() }))
    // ⭐⭐ BỎ QUA TÀI LIỆU THAM CHIẾU (tiêu chuẩn/quy định).
    //
    // VÌ SAO:
    // `stripProductMentions()` chạy khi user CHƯA đủ 4 câu hỏi → gỡ tên sản
    // phẩm để bot không "tự giới thiệu thiết bị" sớm. Nhưng tiêu chuẩn KHÔNG
    // phải sản phẩm: "Theo WCAG 2.2, tương phản tối thiểu 4.5:1" là NỘI DUNG
    // TƯ VẤN, không phải "quảng cáo thiết bị" → gỡ đi làm mất thông tin
    // pháp lý hữu ích (và làm câu vỡ: "Theo , tương phản là 4.5:1").
    .filter((t) => !t.entry.isReference && t.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length);

  for (const { name } of stripTargets) {
    const isShort = isShortProductTitle(name);
    // Tên ngắn: chỉ gỡ khi tên xuất hiện ĐÚNG HOA THƯỜNG trong câu gốc.
    if (isShort && !hasExactCaseMention(answer, name)) continue;

    const escaped = escapeRegExp(name);
    // Tên dài: cho phép không phân biệt hoa thường (người dùng hay gõ sai).
    // Tên ngắn: bắt buộc đúng hoa thường như trong DB.
    const flags = isShort ? 'gm' : 'gim';

    // ⭐⭐ RANH GIỚI TỪ AN TOÀN (không dùng `\b`).
    //
    // `\b` KHÔNG tồn tại khi tên SP nằm cạnh ký tự non-word. Với markdown
    // bold `**Tên**`, ký tự liền kề tên là `*` (non-word) → không có `\b` →
    // regex không khớp → tên sản phẩm KHÔNG bị gỡ → lọt vào câu trả lời khi
    // chưa đủ 4 câu hỏi.
    //
    // → Dùng lookaround kiểm tra ký tự liền kề có phải chữ/số hay không:
    //   đúng cả trong bold, vẫn chặn khớp nhầm giữa từ.
    const B = '(?<![A-Za-z0-9])';
    const E = '(?![A-Za-z0-9])';

    // ⭐⭐ TÊN BỌC TRONG **BOLD** → gỡ luôn cả dấu in đậm.
    // (Trước đây tên trong `**...**` không bị gỡ vì marker chỉ cho phép 1 dấu *.)
    out = out.replace(
      new RegExp(`\\*\\*\\s*${B}${escaped}${E}\\s*\\*\\*`, flags),
      ''
    );
    // Tên trong **BOLD** nhưng có ký tự cuối đặc biệt → không dùng E (vì `*` sau
    // tên đã là ranh giới hợp lệ, nhưng `+`/`)` bên trong tên cần khớp chính xác).
    out = out.replace(
      new RegExp(`\\*\\*\\s*${escaped}\\s*\\*\\*`, flags),
      ''
    );

    // Dòng CHỈ CÒN tên sản phẩm (sau khi link đã bị xóa) → xóa cả dòng.
    out = out.replace(
      new RegExp(
        `^\\s*(?:[-–—•*]|\\d+[.)])?\\s*${B}${escaped}${E}[,:;]?\\s*$`,
        flags
      ),
      ''
    );
    // Tên nằm GIỮA văn xuôi → gỡ ra cùng dấu nối đứng trước.
    out = out.replace(
      new RegExp(
        `(?:^|\\s)[-–—•*]?\\s*${B}${escaped}${E}[,:;]?`,
        flags
      ),
      ''
    );
  }

  out = out
    // ⚠️ DÙNG CLASS [\t ] THAY VÌ \s, VÀ LOẠI TRỪ DÒNG RỖNG:
    // Regex cũ dùng \s* → \s khớp CẢ ký tự xuống dòng, nên dòng trống bị hiểu
    // là "dòng chỉ còn dấu câu" và bị XOÁ. Hậu quả: \n\n → \n → markdown gộp
    // header với câu đầu tiên vào cùng thẻ <p> → header dính liền câu.
    //
    // Ngoài ra `[\t ]*X?[\t ]*Y?[\t ]*` khớp CẢ CHUỖI RỖNG (mọi phần đều
    // optional) → dòng "" cũng bị xoá. Phải yêu cầu có ít nhất 1 ký tự thực.
    // Dòng rỗng / chỉ khoảng trắng → GIỮ (phân tách thẻ <p> trong markdown).
    // Dòng chỉ còn dấu câu hoặc bullet rỗng (---, ***, -, …) → XOÁ.
    .split('\n')
    .filter((line) => {
      if (/^[\t ]*$/.test(line)) return true; // dòng trống → giữ
      if (/^[\t ]*(?:[-–—•*][\t ]*){1,}[,.]?[\t ]*$/.test(line)) return false; // --- *** -
      if (/^[\t ]*[,.…;:]+[\t ]*$/.test(line)) return false; // , ; : …
      return true;
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Bảo toàn dòng trống (đây là thứ tách thẻ <p> trong markdown).
    .replace(/(?:^[ \t]*\n){2,}/gm, '\n\n')
    .trim();

  return out;
}

/**
 * ⭐ Cache tên đã chuẩn hoá của catalog (tránh normalize lặp lại mỗi lượt).
 */
let _normalizedTitlesCache: {
  at: number;
  items: Array<{ title: string; norm: string; core: string; isShort: boolean }>;
} | null = null;

function getNormalizedTitles(): Array<{
  title: string;
  norm: string;
  core: string;
  isShort: boolean;
}> {
  const now = Date.now();
  if (_normalizedTitlesCache && now - _normalizedTitlesCache.at < 60_000) {
    return _normalizedTitlesCache.items;
  }
  const items = buildProductCatalog().map((entry) => {
    const title = entry.title || '';
    return {
      title,
      norm: normalizeProductName(title),
      core: entry.isReference ? normalizeProductName(entry.coreName || '') : '',
      isShort: isShortProductTitle(title),
    };
  });
  _normalizedTitlesCache = { at: now, items };
  return items;
}

/**
 * ⭐ Dòng này có phải CHỈ là TÊN SẢN PHẨM / TÊN TIÊU CHUẨN không?
 *
 * ⚠️ VÌ SAO CẦN:
 * `repairTruncatedSentences()` có nhánh "câu bị cắt cụt → thay bằng câu hỏi
 * thêm thông tin". Nhưng rất nhiều khi dòng đó KHÔNG phải câu văn — mà là
 * DÒNG TÊN SẢN PHẨM do bot viết theo format prompt bắt buộc:
 *   "**Tên sản phẩm**" + link ở dòng riêng.
 *
 * Thay nó bằng câu hỏi chung → MẤT HOÀN TOÀN tên sản phẩm → frontend không
 * khớp được tên nào → người dùng chỉ thấy câu hỏi chung chung, KHÔNG thấy
 * card sản phẩm (đúng triệu chứng "bot chỉ hiện tên, không hiện card").
 *
 * → Nhận diện dòng tên sản phẩm/tiêu chuẩn và GIỮ NGUYÊN.
 *
 * @param line Dòng cần kiểm tra.
 */
function isCatalogNameOnlyLine(line: string): boolean {
  if (!line) return false;

  // Bỏ marker markdown + bullet để so khớp tên thuần.
  let bare = line
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:[-–—•*]|\d+[.)])\s+/, '')
    .trim();
  if (!bare) return false;

  // Tách phần URL ở cuối dòng (nếu có) — dòng link không phải câu văn.
  const urlMatch = bare.match(/\s*(?:🔗\s*)?https?:\/\/\S+\s*$/);
  if (urlMatch) bare = bare.slice(0, urlMatch.index!).trim();
  if (!bare) return true; // dòng chỉ có URL → dòng link → giữ nguyên

  const norm = normalizeProductName(bare);
  if (!norm) return true;

  for (const item of getNormalizedTitles()) {
    if (item.norm) {
      // ⭐ Tên ngắn ("Pearl", "Clicker") chỉ khớp khi dòng ĐÚNG BẰNG tên —
      // nếu dùng "includes" thì câu văn kiểu "viên ngọc quý" cũng bị tính
      // nhầm là dòng tên sản phẩm → câu bị giữ nguyên dù đang cụt.
      if (item.isShort) {
        if (norm === item.norm) return true;
      } else if (norm === item.norm || norm.includes(item.norm)) {
        // Tên dài: dòng có thể là tên đầy đủ kèm mô tả.
        return true;
      }
    }

    // ⭐ Tài liệu tham chiếu: bot có thể chỉ viết TÊN LÕI ("ISO 9999:2022")
    // chứ không viết tên đầy đủ kèm mô tả → so khớp bằng tên lõi.
    if (item.core && norm === item.core) return true;
  }
  return false;
}

/**
 * ⭐ Dọn CÂU BỊ CẮT CỤT do việc xóa dòng sản phẩm.
 *
 * ⚠️ VÌ SAO CẦN: khi bot viết câu dài rồi nhắc tên sản phẩm ở DÒNG KẾ TIẾP
 * (ví dụ "Bạn đã\n- JAWS\nhttps://…"), hàm trên xóa dòng sản phẩm → biến
 * "Bạn đã" thành câu đứt dừng, người dùng thấy bot "trả lời cụt lủn" mà
 * không hiểu vì sao.
 *
 * Cách xử lý: phát hiện câu cuối không kết thúc bằng dấu câu (?!.…) VÀ quá
 * ngắn (≤ 60 ký tự), rồi ghép nó lại với câu kế tiếp — hoặc bỏ hẳn nếu bỏ đi
 * không còn ý nghĩa.
 */
export function repairTruncatedSentences(answer: string): string {
  if (!answer) return answer;

  // ⭐⭐ DÒNG CUỐI LÀ URL → KHÔNG phải câu bị cụt.
  //
  // VÌ SAO CẦN:
  // Link do hệ thống chèn (dòng "🔗 https://…") là DÒNG RIÊNG, không phải
  // câu thoại. Nếu coi nó là "câu cuối bị cắt cụt" → hàm này:
  //   1) nối URL vào câu trước (mất định dạng "link ở dòng riêng" mà prompt
  //      bắt buộc), và
  //   2) thêm dấu "…" vào cuối URL (URL hỏng).
  //
  // → Câu trả lời kết thúc bằng URL là câu HỢP LỆ → trả về nguyên vẹn.
  if (/https?:\/\/\S*\s*$/.test(answer.trim())) return answer;

  const endsCleanly = /[?!.…"')\]]\s*$/.test(answer.trim());
  if (endsCleanly) return answer;

  const lines = answer.split('\n').map((l) => l.trim()).filter(Boolean);

  // ⭐⭐ DÒNG CUỐI LÀ TÊN SẢN PHẨM / TÊN TIÊU CHUẨN → KHÔNG phải câu bị cụt.
  //
  // VÌ SAO CẦN:
  // Format prompt bắt buộc bot viết:
  //   "**Tên sản phẩm**"  (link ở dòng riêng)
  // Dòng đó KHÔNG có dấu kết câu → bị coi là "câu bị cắt cụt" → thay bằng
  // câu hỏi chung → MẤT HOÀN TOÀN tên sản phẩm → frontend không khớp được
  // tên nào → người dùng chỉ thấy câu hỏi chung, KHÔNG thấy card (đúng
  // triệu chứng "bot chỉ hiện tên, không hiện card").
  //
  // → Giữ nguyên dòng tên sản phẩm.
  if (lines.length >= 1 && isCatalogNameOnlyLine(lines[lines.length - 1])) {
    return answer;
  }

  // Trường hợp 1: chỉ còn MỘT câu ngắn bị cắt.
  // ⚠️ KHÔNG trả về '' — bot im lặng còn tệ hơn trả lời sai. Thay bằng câu
  // có nghĩa, nói thẳng là chưa đủ thông tin để tư vấn thiết bị.
  if (lines.length === 1 && !/[?!.…]/.test(lines[0]) && lines[0].length <= 60) {
    return 'Bạn cần cho mình biết thêm một chút về tình trạng của bạn để mình có thể tư vấn chính xác hơn nhé.';
  }

  // Trường hợp 2: câu cuối bị cắt cụt → nối vào câu liền trước cho tự nhiên.
  const last = lines[lines.length - 1];
  const noPunctuation = !/[?!.…]/.test(last);
  if (noPunctuation && last.length <= 60 && lines.length > 1) {
    const prev = lines[lines.length - 2];
    // Câu trước đã có dấu kết → câu cắt là một mảnh rời, không nối vào được.
    if (!/[?!.…]\s*$/.test(prev)) {
      lines[lines.length - 2] = `${prev} ${last}`;
      lines.pop();
      const merged = lines.join('\n');
      return /[?!.…"')\]]\s*$/.test(merged) ? merged : `${merged}…`;
    }
  }

  return `${answer.replace(/\s+$/, '')}…`;
}

/** Dòng có chứa tên sản phẩm nào trong catalog MADA không. */
function mentionsCatalogProduct(line: string, catalog: ReturnType<typeof buildProductCatalog>): boolean {
  const lower = line.toLowerCase();
  for (const entry of catalog) {
    // ⭐ Tài liệu tham chiếu (tiêu chuẩn) KHÔNG phải sản phẩm → dòng chứa
    // tiêu chuẩn không bị xoá (VD "- Theo WCAG 2.2, tương phản 4.5:1").
    if (entry.isReference) continue;

    const title = (entry.title || '').trim();
    const name = title.toLowerCase();
    // Tên quá ngắn (VD "VN", "ST") dễ khớp nhầm → bỏ qua.
    if (name.length < 5) continue;

    // ⭐⭐ TÊN NGẮN PHẢI KHỚP ĐÚNG HOA THƯỜNG.
    //
    // "Clicker" là tên sản phẩm NHƯNG cũng là từ tiếng Anh thường ("cái
    // bấm"). Nếu so khớp không phân biệt hoa thường thì dòng
    // "- dùng một clicker nhỏ gọn" bị xoá HẲN → mất cả nội dung, không
    // phải chỉ mất tên sản phẩm.
    //
    // → Với tên ngắn, chỉ coi là "nhắc sản phẩm" khi xuất hiện đúng hoa thường.
    if (isShortProductTitle(title)) {
      if (hasExactCaseMention(line, title)) return true;
      continue;
    }

    if (lower.includes(name)) return true;
  }
  return false;
}

/**
 * Chèn link MADA dưới mỗi tên sản phẩm hợp lệ trong câu trả lời.
 *
 * Thay vì dựa vào model tự viết link (không đáng tin), ta tự chèn link chính
 * xác từ DB. Nhờ vậy link luôn đúng và không bao giờ bị bịa.
 *
 * ⭐⭐ LỌC THEO CHUYÊN MÔN BOT:
 * Chỉ gắn link cho sản phẩm bot ĐƯỢC PHÉP nhắc. Nếu không lọc, bot-mobility
 * có thể gắn link sản phẩm của bot-speech (VD "CoughDrop AAC") vào câu trả
 * lời → người dùng thấy bot giới thiệu thiết bị không đúng chuyên môn.
 *
 * @param answer      Câu trả lời gốc.
 * @param botId       Bot đang trả lời (dùng để lọc chuyên môn).
 * @param allowTitles Tên sản phẩm được phép nhắc dù ngoài chuyên môn
 *                    (VD user hỏi thẳng "CoughDrop AAC là gì?").
 * @returns Câu trả lời đã chèn link dưới tên sản phẩm.
 */
export function appendProductLinks(
  answer: string,
  botId?: string | null,
  allowTitles?: Set<string> | null
): string {
  if (!answer) return answer;

  const catalog = buildProductCatalog();
  if (catalog.length === 0) return answer;

  // ⭐⭐⭐ LOẠI SẢN PHẨM NGOÀI CHUYÊN MÔN KHỎI CÂU TRẢ LỜI.
  //
  // VÌ SAO PHẢI LOẠI (không chỉ bỏ link):
  // Bot có thể tự nhắc tên sản phẩm của bot khác trong văn xuôi (không in đậm,
  // không kèm link). Chỉ bỏ link thì người dùng VẪN thấy tên sản phẩm sai
  // chuyên môn → đúng triệu chứng "bot giới thiệu thiết bị không đúng của
  // riêng nó". Phải gỡ cả TÊN khỏi câu trả lời.
  //
  // ⚠️ CHỈ gỡ tên sản phẩm ĐANG ĐƯỢC NHẮC trong câu (có mặt trong text),
  //    không gỡ mọi tên trong catalog (sẽ làm hỏng cả câu trả lời).
  const outOfScope = findOutOfScopeProducts(answer, botId, catalog, allowTitles);
  let out = answer;
  for (const { name } of outOfScope) {
    const escaped = escapeRegExp(name);
    const B = '(?<![A-Za-z0-9])';
    const E = '(?![A-Za-z0-9])';
    // Tên nằm trong **bold** → gỡ cả dấu in đậm.
    out = out.replace(
      new RegExp(`\\*\\*\\s*${B}${escaped}${E}\\s*\\*\\*`, 'gi'),
      ''
    );
    // Tên nằm trong văn xuôi (không in đậm) → gỡ kèm dấu nối phía trước.
    out = out.replace(
      new RegExp(`(?:^|\\s)[-–—•*]?\\s*${B}${escaped}${E}[,:;]?`, 'gim'),
      ''
    );
  }
  out = out
    .split('\n')
    .filter((line) => {
      if (/^[\t ]*$/.test(line)) return true;
      if (/^[\t ]*(?:[-–—•*][\t ]*){1,}[,.]?[\t ]*$/.test(line)) return false;
      if (/^[\t ]*[,…;:]+[\t ]*$/.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ⭐ Sau khi gỡ tên ngoài chuyên môn, câu có thể bị cắt cụt → sửa lại.
  out = repairTruncatedSentences(out);

  const missing = findProductsMissingLink(out, catalog);

// ⭐ KHÔNG return sớm khi không thiếu link — vì câu trả lời vẫn có thể cần
  // BƯỚC CHUẨN HOÁ (thêm emoji 🔗 cho link bot tự viết). Nếu return ở đây thì
  // link trần sẽ không bao giờ được chuẩn hoá.

// ⭐⭐ CHUẨN HOÁ LINK SẴN CÓ: bot thường tự viết link MADA nhưng KHÔNG kèm
  // emoji "🔗" (thường là dòng ngay dưới tên sản phẩm). Người dùng cần link
  // nổi bật và nhất quán, nên ta thêm "🔗" cho mọi URL trần của MADA.
  //
  // ⚠️ CHỈ xử lý URL đứng RIÊNG một dòng (hoặc đứng sau 1 ký tự ngay trước).
  // Nếu quét mọi URL ở giữa văn bản, sẽ chèn "🔗" vào giữa câu tiếng Việt và
  // làm nội dung đọc lộn xộn.
  out = out.replace(
    /^([ \t]*)((?:https?:\/\/)at\.mada\.org\.qa\/technology\/\S+)[ \t]*$/gim,
    (_m, indent: string, url: string) =>
      /🔗/.test(indent) ? `${indent}${url}` : `${indent}🔗 ${url}`
  );

for (const { name, url } of missing) {
    // Escape các ký tự regex của tên sản phẩm
    const escaped = escapeRegExp(name);

    // ⭐⭐ RANH GIỚI TỪ AN TOÀN (không dùng `\b`).
    //
    // `\b` KHÔNG tồn tại khi tên SP nằm cạnh ký tự non-word. Ví dụ tên kết
    // thúc bằng `+` hoặc `)` ("Optelec ClearReader+", "Clicker 8 (English and
    // Arabic)") → sau tên là `*` của markdown bold → không có `\b` → regex
    // không khớp → tên sản phẩm KHÔNG được gắn link.
    //
    // Hậu quả: bot nhắc đúng sản phẩm thuộc chuyên môn nhưng user chỉ thấy
    // TÊN, không thấy CARD → đúng triệu chứng "chỉ hiện tên, không hiện card".
    //
    // → Dùng lookaround kiểm tra ký tự liền kề có phải chữ/số hay không.
    const B = '(?<![A-Za-z0-9])';
    const E = '(?![A-Za-z0-9])';

    // Tìm dòng chứa tên sản phẩm (hỗ trợ **Tên** hoặc Tên)
    // Nếu dòng đó đã có link → bỏ qua
    const lineRegex = new RegExp(
      `^([^\\n]*${B}${escaped}${E}[^\\n]*)$`,
      'gmi'
    );

    out = out.replace(lineRegex, (fullLine, content: string) => {
      if (content.includes(url) || content.includes('http')) return fullLine;

      const indent = fullLine.match(/^\s*/)?.[0] ?? '';
      const trimmed = content.trimEnd();

      // Giữ định dạng list (-, *, •, số) nếu có
      const bulletMatch = trimmed.match(/^(\s*(?:[-*•]|\d+[.)])\s+)/);
      const bullet = bulletMatch ? bulletMatch[1] : indent;
      const body = bulletMatch ? trimmed.slice(bulletMatch[1].length) : trimmed;

      return `${bullet}${body}\n${indent}🔗 ${url}`;
    });

    // ⭐ Dòng vừa chèn link có thể ĐỨT RỜI vì tên sản phẩm nằm giữa câu
    // (VD: "Bạn đã gặp tình trạng mờ mắt, nên dùng JAWS giúp bạn đọc dễ hơn"
    // → link bị chèn ngay sau tên làm câu gãy). Sửa nối lại sau khi chèn.
    out = repairTruncatedSentences(out);
  }

  return out;
}