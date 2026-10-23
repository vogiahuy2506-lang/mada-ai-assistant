/**
 * Thư viện parse "Manufacturer" từ trang sản phẩm MADA.
 * Tách riêng để `backfill-product-brand.ts` và script chẩn đoán dùng chung.
 */

import * as cheerio from 'cheerio';

/** Nhãn của field KHÁC ngay sau brand → brand kết thúc trước đó. */
const FOLLOWING_LABEL =
  /(?:Supporting\s+Documents|Training\s+and\s+Support|Product\s+Page|Documentation|Resources)\s*:\s*/i;

/**
 * Dấu câu dính cuối từ HTML ("Crick Software ,", "… Support:") → dấu hiệu cụm
 * đã nuốt phần kế tiếp → loại.
 *
 * ⚠️ NHƯNGNG dấu chấm sau VIẾT TẮT LÀ HỢP LỆ và rất phổ biến ở tên hãng:
 * "eSight Corp.", "The Soundbeam Project Ltd.", "Hearing Products Intl. Ltd."
 * Trước đây regex `[,:;.]$` loại cả những tên này → MADA mất hãng cho hàng chục
 * sản phẩm (và bot trả lời "không rõ hãng"). Vì vậy chỉ loại dấu chấm khi nó
 * KHÔNG nằm sau một viết tắt hợp lệ.
 */
const ABBREV_SUFFIX = /(?:^|\s)(?:Corp|Inc|Ltd|Co|LLC|LLP|GmbH|PLC|S\.A|B\.V|Pty|Assoc|Soc|Std|Labs?)\.$/i;

function isValidBrand(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 60) return false;
  if (/[,:;]$/.test(v)) return false; // "Crick Software ," / "… Support:"
  if (/\.$/.test(v) && !ABBREV_SUFFIX.test(v)) return false; // dấu chấm lơ lửng
  if (/https?:\/\//i.test(v)) return false;
  if (/\b(product page|official website|documentation|website|homepage)\b/i.test(v)) return false;
  const words = v.split(/\s+/);
  if (words.length > 6) return false;
  if (!words.some((w) => /^[A-Za-zÀ-ỹ]/.test(w))) return false;
  return true;
}

/**
 * ⚠️ HTML MADA hay viết:  Manufacturer: Assistiveware (<a …>https://…</a>)
 * Nếu chỉ cắt tại "<" thì brand thành "Assistiveware (" → phải cân bằng ngoặc.
 */
function cleanBrandText(value: string): string {
  return value
    .split('<')[0]
    .replace(/\((?:https?:\/\/|www\.)[^)]*\)/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/[()[\]]/g, ' ') // ngoặc lơ lửng: "Assistiveware (" → "Assistiveware "
    .replace(/\s*,\s*$/g, '') // dấu phẩy sót: "Crick Software ,"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trích brand + model từ HTML trang sản phẩm MADA.
 *
 * HTML thực tế (3 biến thể):
 *   1) <p>Manufacturer: Tobii Dynavox (<a…>https://…</a>)</p>          → "Tobii Dynavox"
 *   2) <p>Manufacturer: Don Johnston<br /> Co-Writer Supporting Documents: <a…>…</a></p>
 *                                                                    → "Don Johnston"
 *   3) <p>Manufacturer: Amazon Mobile LLC (<a>product page</a>)</p>    → "Amazon Mobile LLC"
 *
 * Lưu ý: <br /> phải được coi là khoảng trắng — cheerio .text() KHÔNG chèn
 * khoảng trắng cho <br>, nên "Tobii Dynavox<br />product page" thành
 * "Tobii Dynavoxproduct page". <a> bị bỏ qua vì thường chỉ chứa URL.
 */
/**
 * ⚠️ Một số trang MADA viết sai tên hãng (typo của admin, không phải lỗi parser):
 *   "TobiiDynavox" (thiếu space), "Tobii Dynabox" (thêm 'a').
 * Chuẩn hoá về tên đúng để bot trả lời nhất quán khi khách hỏi "của hãng nào".
 */
const BRAND_CANON: Array<[RegExp, string]> = [
  [/^tobii\s*dynavox$/i, 'Tobii Dynavox'],
  [/^tobii\s*dynabox$/i, 'Tobii Dynavox'],
  [/^tobii\s*dynavox\s+limited$/i, 'Tobii Dynavox'],
  [/^skyward\/tobii\s*dynavox$/i, 'Tobii Dynavox'],
  [/^lexability/i, 'Lexability'],
];

function canonicalizeBrand(value: string): string {
  for (const [re, replacement] of BRAND_CANON) {
    if (re.test(value.trim())) return replacement;
  }
  return value.trim();
}

export function parseManufacturer(html: string): { brand?: string; model?: string } {
  const $ = cheerio.load(html);

  let scope = $('p:contains("Manufacturer:")').first();
  if (scope.length === 0) {
    scope = $('p')
      .filter((_, el) => $(el).text().includes('Manufacturer:'))
      .first();
  }
  if (scope.length === 0) return {};

  let brand = '';
  let model = '';
  let started = false;

  const walk = (node: any): void => {
    if (!node || started === 'stop') return;

    if (node.type === 'text') {
      let text: string = node.data ?? '';
      if (!started) {
        const m = text.match(/Manufacturer\s*:\s*/i);
        if (!m) return;
        text = text.slice(m.index! + m[0].length);
        started = true;
      }
      const stop = text.search(FOLLOWING_LABEL);
      if (stop >= 0) text = text.slice(0, stop);
      brand += text;
      return;
    }

    const tag = (node.tagName ?? '').toLowerCase();
    if (tag === 'br') {
      // <br> sau khi đã có brand = sang field khác → dừng.
      // <br> ngay sau "Manufacturer:" chỉ là xuống dòng, vẫn phải nối tiếp.
      if (started && brand.trim().length > 0) started = 'stop';
      else if (started) brand += ' ';
      return;
    }
    if (tag === 'a') return;

    for (const child of node.children ?? []) walk(child);
  };

  for (const child of scope.contents().toArray()) {
    walk(child);
    if (FOLLOWING_LABEL.test(brand)) break;
  }

  if (!started || started === 'stop' && !brand.trim()) return {};

  brand = cleanBrandText(brand.split(/\bVideo\b/i)[0]);

  // Tách "Brand (Model)" nếu MADA ghi rõ trong ngoặc
  const paren = brand.match(/^(.*?)\s*\(([^)]{2,40})\)\s*$/);
  if (paren) {
    const candidate = paren[2].trim();
    const base = paren[1].trim();
    if (isValidBrand(base)) {
      model = isValidBrand(candidate) ? candidate : '';
      brand = base;
    }
  }

  return isValidBrand(brand) ? { brand: canonicalizeBrand(brand), model } : {};
}

export { isValidBrand, FOLLOWING_LABEL };