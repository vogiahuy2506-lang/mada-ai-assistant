/**
 * Helper để render ảnh sản phẩm an toàn
 *
 * - Nếu là MADA image (mada.org.qa) → route qua /api/mada-image proxy để bypass hotlink
 * - Nếu là shop VN (tgdd, cellphones, fptshop, dienmayxanh) → load trực tiếp
 * - Nếu là URL khác (CDN trung tính) → load trực tiếp
 * - Nếu là URL rác (broken/demo/placeholder) → trả empty để fallback gradient
 *
 * Dùng:
 *   <img src={getImageUrl(product.image_url)} alt={product.title} />
 *
 * Đặc điểm:
 *   - Whitelist domain an toàn
 *   - Tự encode URL để làm query param
 *   - Hỗ trợ fallback error handler
 *   - Tự detect URL rác (demo, broken, dead domain)
 */

const PROXY_REQUIRED_HOSTS = [
  'at.mada.org.qa',
  'mada.org.qa',
  'cdn.at.mada.org.qa',
  'cdn.mada.org.qa',
];

const ALLOWED_HOSTS = [
  ...PROXY_REQUIRED_HOSTS,
  // Shop VN không cần proxy (CDN public)
  'cdn.tgdd.vn',
  'cdn.cellphones.com.vn',
  'cdn2.cellphones.com.vn',
  'cdn.fptshop.com.vn',
  'images.fpt.shop',
  'cdn.dienmayxanh.com',
  'img.dienmayxanh.com',
  'product.hstatic.net',
  'cdn.viettelstore.vn',
  'cdn-lazada.zdn.vn',
  'cdn.shopee.vn',
  'tikicdn.com',
  'salt.tikicdn.com',
  // Shopify CDN
  'cdn.shopify.com',
  'cdn3.mywot.com',
  'cdn4.mywot.com',
  // WordPress/WooCommerce
  'woocommerce.com',
  'wp.com',
  // Wikimedia
  'upload.wikimedia.org',
  // Github (cho icon/demo)
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  // Generic image hosts
  'i.imgur.com',
  'i.pravatar.cc',
  'picsum.photos',
  // Google/Facebook CDN
  'googleusercontent.com',
  'ggpht.com',
  'fbcdn.net',
  'akamai.net',
  'akamaized.net',
  'cloudfront.net',
  'stackpathdns.com',
  'cdn.jsdelivr.net',
  // Other common CDNs
  'res.cloudinary.com',
  'cloudinary.com',
  'imgix.net',
  'images.unsplash.com',
];

/**
 * Patterns của URL rác cần reject (placeholder/demo/broken/dead domain)
 * Dựa trên kinh nghiệm scrape thực tế của MADA seed data cũ.
 */
const GARBAGE_URL_PATTERNS = [
  /\.example\.(com|org|net)/i,      // example.com domains
  /\/\/example\./i,                  // //example.com
  /\/jaws\.jpg$/i,                   // Old broken demo filename
  /\/orcam\.jpg$/i,                  // Old broken demo filename
  /\/nvda\.jpg$/i,                   // Old broken demo filename
  /\/mada\.vn\//i,                   // Dead domain mada.vn
  /^https?:\/\/mada\.vn/i,          // Full URL with dead domain
  /\/placeholder\./i,                // placeholder.svg
  /\/default-(image|product|thumb)/i,
  /data:image\/svg\+xml/i,           // base64 inline SVG (data URL)
];

/**
 * Trả về URL đã route qua proxy nếu cần
 * - Input: URL gốc từ DB
 * - Output: URL đã xử lý (proxy nếu cần) hoặc '' để fallback gradient
 */
export function getImageUrl(originalUrl: string | null | undefined | unknown): string {
  // Defensive: reject non-string input
  if (!originalUrl || typeof originalUrl !== 'string') return '';

  // Nếu đã qua proxy rồi thì giữ nguyên (tránh double-proxy)
  if (originalUrl.startsWith('/api/mada-image')) return originalUrl;

  // Reject nếu match pattern rác
  if (GARBAGE_URL_PATTERNS.some((pattern) => pattern.test(originalUrl))) {
    return '';
  }

  // Validate là URL hợp lệ (tránh nhận string rác)
  try {
    new URL(originalUrl);
  } catch {
    return '';
  }

  // Nếu cần proxy → route qua /api/mada-image
  if (PROXY_REQUIRED_HOSTS.some((host) => originalUrl.includes(host))) {
    return `/api/mada-image?url=${encodeURIComponent(originalUrl)}`;
  }

  // Nếu là allowed host → load trực tiếp
  if (ALLOWED_HOSTS.some((host) => originalUrl.includes(host))) {
    return originalUrl;
  }

  // Unknown host - vẫn load trực tiếp (browser sẽ fail nếu có hotlink protection)
  return originalUrl;
}

/**
 * Check URL có phải ảNH an toàn không (cho validate input form admin)
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  if (GARBAGE_URL_PATTERNS.some((pattern) => pattern.test(url))) return false;
  try {
    new URL(url);
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.some((host) => url.includes(host)) || url.startsWith('/api/');
}