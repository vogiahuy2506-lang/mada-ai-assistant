/**
 * Format giá hiển thị (TGDD style - Việt Nam)
 *
 * Input có thể là:
 *  - "3.950.000đ"           → "3.950.000₫"
 *  - "3,950,000 VND"        → "3.950.000₫"
 *  - "3.95 triệu"           → "3.950.000₫"  (nhân 1,000,000)
 *  - "3,95 tr"              → "3.950.000₫"
 *  - "2399 nghìn" / "2399k" → "2.399.000₫"  (nhân 1,000)
 *  - "$1,299"               → "$1,299"
 *  - "1299 USD"             → "$1,299"
 *  - "Liên hệ" / "Miễn phí" → giữ nguyên
 *  - ""                     → ""
 *
 * Quy tắc:
 *  - VNĐ: dùng "." phân cách hàng nghìn (3.950.000₫)
 *  - USD/EUR: dùng "," phân cách hàng nghìn ($1,299)
 *  - "triệu/tr/m" → nhân 1,000,000
 *  - "nghìn/ngàn/k" → nhân 1,000
 */
export function formatPrice(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  // Giữ nguyên nếu là text đặc biệt (không phải số)
  const specialTexts = ['liên hệ', 'lien he', 'miễn phí', 'mien phi', 'free', 'contact', 'tba', 'sắp ra mắt', 'coming soon', 'n/a'];
  const lowerRaw = raw.toLowerCase();
  if (specialTexts.some(t => lowerRaw === t || lowerRaw.includes(t))) {
    return raw;
  }

  // Detect currency
  const isVND = /\b(VND|VNĐ)\b|đ|₫/i.test(raw);
  const isUSD = /\$|USD/i.test(raw);
  const isEUR = /€|EUR/i.test(raw);

  // Detect multiplier - check trước khi parse số
  const lower = lowerRaw;
  const trimmedLower = lower.trim();
  // "2399k" → nghìn (k); "4.5tr" → triệu (tr); "3.5 triệu" → triệu
  const trailingK = /(k|nghìn|nghin|ngàn|ngan)$/i.test(trimmedLower);
  const trailingTr = /(tr|triệu|trieu|million|mil)$/i.test(trimmedLower);
  const trailingMultiplier = trailingK || trailingTr;

  // Phân biệt triệu vs nghìn
  const isMillion = /\b(triệu|trieu|million|mil)\b/i.test(lower)
    || /\btr\.?\b/i.test(lower)
    || trailingTr;
  const isThousand = /\b(nghìn|nghin|ngàn|ngan|nghìn)\b/i.test(lower)
    || trailingK;

  // Tách phần số (giữ cả dấu "." và ",")
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return raw;

  // Parse số - xử lý nhiều format
  let num = 0;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
      // "3,950,000.50" (US style) - không phổ biến ở VN
      num = parseFloat(cleaned.replace(/,/g, ''));
    } else {
      // "3.950.000" (VN) hoặc "23.950,50" (EU)
      const parts = cleaned.split(',');
      const intPart = parts[0].replace(/\./g, '');
      const decPart = parts[1] || '';
      num = parseFloat(intPart + (decPart ? '.' + decPart : ''));
    }
  } else if (cleaned.includes('.')) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      // "3.950.000" - nhiều dấu chấm = phân cách nghìn
      num = parseFloat(cleaned.replace(/\./g, ''));
    } else if (dotCount === 1) {
      const [intPart, decPart] = cleaned.split('.');
      if (isMillion || isThousand) {
        // "3.95 triệu" hoặc "3.95 nghìn" - decimal
        num = parseFloat(cleaned);
      } else if (intPart.length <= 3 && decPart.length <= 2) {
        // "3.95" - không có context → có thể là decimal
        num = parseFloat(cleaned);
      } else {
        // "3950.00" hoặc "1234.5" - phân cách nghìn
        num = parseFloat(cleaned.replace(/\./g, ''));
      }
    } else {
      num = parseFloat(cleaned);
    }
  } else if (cleaned.includes(',')) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount > 1) {
      // "3,950,000" - phân cách nghìn (US style)
      num = parseFloat(cleaned.replace(/,/g, ''));
    } else {
      const [intPart, decPart] = cleaned.split(',');
      if (decPart.length === 3) {
        // "3,950" - phân cách nghìn
        num = parseFloat(cleaned.replace(',', ''));
      } else {
        // "3,95" - decimal
        num = parseFloat(intPart + '.' + decPart);
      }
    }
  } else {
    num = parseFloat(cleaned);
  }

  if (isNaN(num) || num <= 0) return raw;

  // Apply multiplier
  if (isMillion) {
    num = num * 1_000_000;
  } else if (isThousand) {
    num = num * 1_000;
  }

  // Round để loại bỏ floating point precision (vd: 3.95 * 1M = 3950000.0000000002)
  // Chỉ round phần thập phân, KHÔNG round lên hàng nghìn (giữ nguyên giá trị)
  num = Math.round(num);

  // Format hiển thị theo currency
  if (isUSD) {
    const formatted = Math.round(num).toLocaleString('en-US');
    return `$${formatted}`;
  } else if (isEUR) {
    const formatted = Math.round(num).toLocaleString('en-US');
    return `€${formatted}`;
  } else {
    // Mặc định VND (kể cả khi không detect được - vì user Việt)
    const formatted = num.toLocaleString('vi-VN');
    return `${formatted}₫`;
  }
}

/**
 * Short format cho card nhỏ (vd: "3.9tr₫", "1.2k$")
 */
export function formatPriceShort(input: string | number | null | undefined): string {
  const formatted = formatPrice(input);
  if (!formatted) return '';

  const match = formatted.match(/^([\d.,]+)(₫|\$|€)$/);
  if (!match) return formatted;

  const numStr = match[1].replace(/[.,]/g, '');
  const num = parseInt(numStr, 10);
  const symbol = match[2];

  if (symbol === '₫') {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}tỷ₫`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}tr₫`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k₫`;
    return `${num}₫`;
  }
  return formatted;
}