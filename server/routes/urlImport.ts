/**
 * Smart URL Import Routes
 *
 * Admin paste URL sản phẩm → server scrape → AI extract products
 * với tên/giá/ảnh/brand → lưu vào kb_products (status=draft).
 *
 * Endpoints:
 *   POST /api/scraper/import-url          — scrape + preview (không lưu)
 *   POST /api/scraper/import-url/save     — scrape + lưu vào DB
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import {
  productExtractor,
  type ExtractedProduct,
  type ExtractionResult,
} from '../lib/scraping/productExtractor';
import { syncProductToKnowledge } from '../lib/syncKbProducts';
import { scrapeProductMetadata } from '../lib/scrapeProductMetadata';
import { translateProduct, detectLanguage as detectTextLang, type SupportedLanguage } from '../lib/translationService';

const router = express.Router();

// ============== HELPERS ==============

function detectLanguage(name: string, description: string): 'vi' | 'en' {
  const text = `${name} ${description}`;
  const vietnameseDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạằẳẵặắấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/;
  return vietnameseDiacritics.test(text) ? 'vi' : 'en';
}

function mapProductToRow(p: ExtractedProduct, defaultCategory: string) {
  const lang = detectLanguage(p.name, p.description);
  const title = p.name.slice(0, 200);
  const titleEn = lang === 'en' ? title : '';
  const description = p.description.slice(0, 1000);
  const descriptionEn = lang === 'en' ? description : '';
  const priceRange = p.price
    ? `${p.price.toLocaleString('en-US')} ${p.currency}`
    : '';

  // ===== MADA branch =====
  // MADA SP không có brand/giá, dùng category từ botId + giữ ISO codes + attachments metadata
  if (p.extractionMethod === 'mada-scraper' && p.madaMetadata) {
    const meta = p.madaMetadata;
    const detectedBrand = meta.botId || '';
    const detectedCategory = meta.madaCategory || defaultCategory || 'general';

    const contentParts = [
      `Tên: ${p.name}`,
      detectedBrand ? `MADA Bot: ${detectedBrand}` : '',
      meta.madaCategory ? `Danh mục MADA: ${meta.madaCategory}` : '',
      meta.isoCodes?.length ? `Tiêu chuẩn: ${meta.isoCodes.join(', ')}` : '',
      meta.tags?.length ? `Tags: ${meta.tags.join(', ')}` : '',
      meta.attachments?.length
        ? `Tài liệu đính kèm: ${meta.attachments.map((a) => `[${a.label}](${a.url})`).join(', ')}`
        : '',
      meta.videoLinks?.length ? `Video: ${meta.videoLinks.join(', ')}` : '',
      p.description ? `Mô tả: ${p.description}` : '',
      meta.content ? `Nội dung chi tiết:\n${meta.content}` : '',
    ].filter(Boolean);

    return {
      id: `prod_${uuidv4().slice(0, 12)}`,
      title,
      title_en: titleEn,
      description,
      description_en: descriptionEn,
      content: contentParts.join('\n'),
      category: detectedCategory,
      brand: detectedBrand,
      model: '',
      price_range: '',
      source_url: p.url,
      product_url: p.url,
      image_url: p.imageUrl,
      iso_codes: meta.isoCodes || [],
      wcag_level: '',
      who_gate_area: '',
      status: 'draft' as const,
      featured: 0,
      sort_order: 0,
      language: meta.language || lang,
    };
  }

  // ===== E-commerce branch (generic) =====
  const detectedBrand = detectBrand(p.name, p.brand);
  const detectedCategory = autoClassifyMadaCategory(
    p.name,
    p.description,
    detectedBrand,
    defaultCategory || p.category
  );

  const content = [
    `Tên: ${p.name}`,
    detectedBrand ? `Thương hiệu: ${detectedBrand}` : '',
    p.category ? `Danh mục: ${p.category}` : '',
    p.price ? `Giá: ${p.price.toLocaleString('en-US')} ${p.currency}` : '',
    p.inStock ? 'Còn hàng' : 'Hết hàng',
    p.description ? `Mô tả: ${p.description}` : '',
    Object.keys(p.specifications).length
      ? `Thông số kỹ thuật: ${JSON.stringify(p.specifications)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: `prod_${uuidv4().slice(0, 12)}`,
    title,
    title_en: titleEn,
    description,
    description_en: descriptionEn,
    content,
    category: detectedCategory || 'general',
    madaCategory: detectedCategory, // để UI hiển thị badge
    brand: detectedBrand,
    model: '',
    price_range: priceRange,
    source_url: p.url,
    product_url: p.url,
    image_url: p.imageUrl,
    iso_codes: [],
    wcag_level: '',
    who_gate_area: '',
    status: 'draft' as const,
    featured: 0,
    sort_order: 0,
    language: lang,
  };
}

/**
 * Detect brand từ tên SP (fallback khi scraper không trả về brand field)
 */
function detectBrand(name: string, fallback?: string): string {
  // Nếu brand đã có và là string ngắn (< 30 chars), dùng luôn
  if (fallback && typeof fallback === 'string' && fallback.length > 0 && fallback.length < 30) {
    return fallback;
  }

  // Danh sách brands phổ biến cần detect
  const brands = [
    // Laptops / PCs
    'Apple', 'MacBook', 'iPhone', 'iPad',
    'HP', 'Hewlett-Packard',
    'Dell', 'Alienware',
    'Asus', 'ASUS', 'ZenBook', 'VivoBook', 'ROG', 'TUF',
    'Lenovo', 'ThinkPad', 'IdeaPad', 'Legion', 'LOQ',
    'Acer', 'Predator', 'Nitro', 'Aspire', 'Swift',
    'MSI', 'Cyborg', 'Katana', 'Raider',
    'Gigabyte', 'GIGABYTE', 'Aorus',
    'Microsoft', 'Surface',
    'Razer', 'Blade',
    'LG', 'Gram',
    'Samsung', 'Galaxy',
    // Mobiles
    'Xiaomi', 'Redmi', 'POCO', 'Mi',
    'Oppo', 'OPPO', 'Reno', 'Find',
    'Vivo', 'iQOO',
    'Realme', 'realme',
    'OnePlus',
    'Nokia',
    'Motorola', 'Moto',
    'Sony', 'Xperia',
    'Google', 'Pixel',
    'Honor',
    'Huawei',
    'Tecno',
    'Infinix',
    'Itel',
    // Audio
    'Sony', 'Bose', 'JBL', 'Beats', 'Sennheiser', 'Marshall', 'Anker', 'Soundcore',
    'AirPods', 'Galaxy Buds',
    // Cameras
    'Canon', 'Nikon', 'Fujifilm', 'Olympus', 'Panasonic', 'GoPro',
    // Wearables
    'Apple Watch', 'Garmin', 'Fitbit', 'Amazfit',
    // Printers
    'Epson', 'Brother', 'HP',
    // Smart home
    'Google Home', 'Amazon', 'Echo',
    // Assistive tech brands (MADA domain)
    'OrCam', 'JAWS', 'NVDA', 'ZoomText', 'Dragon',
  ];

  const lower = name.toLowerCase();
  for (const brand of brands) {
    const regex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower) || regex.test(name)) {
      // Chuẩn hóa brand name
      if (/^macbook$|^imac$/i.test(brand)) return 'Apple';
      if (/^iphone$|^ipad$|^apple watch$|^airpods$/i.test(brand)) return 'Apple';
      if (/^galaxy$/.test(brand)) return 'Samsung';
      if (/^raider$|^katana$|^cyborg$/i.test(brand)) return 'MSI';
      if (/^rog$|^tuf$|^zenbook$|^vivobook$/i.test(brand)) return 'Asus';
      if (/^legion$|^thinkpad$|^ideapad$|^loq$/i.test(brand)) return 'Lenovo';
      if (/^predator$|^nitro$|^aspire$|^swift$/i.test(brand)) return 'Acer';
      if (/^aorus$/i.test(brand)) return 'Gigabyte';
      if (/^redmi$|^poco$|^mi$/i.test(brand)) return 'Xiaomi';
      if (/^reno$|^find$/i.test(brand)) return 'Oppo';
      if (/^iqoo$/i.test(brand)) return 'Vivo';
      if (/^moto$/.test(brand)) return 'Motorola';
      if (/^xperia$/.test(brand)) return 'Sony';
      if (/^pixel$/.test(brand)) return 'Google';
      if (/^blade$/.test(brand)) return 'Razer';
      if (/^gram$/.test(brand)) return 'LG';
      if (/^galaxy buds$/.test(brand)) return 'Samsung';
      if (/^surface$/.test(brand)) return 'Microsoft';
      if (/^alienware$/.test(brand)) return 'Dell';
      return brand;
    }
  }

  return (typeof fallback === 'string' && fallback.length < 30) ? fallback : '';
}

/**
 * Map brand → category MADA (fallback khi không có brand)
 * Fallback: dùng keyword matching trên tên + mô tả sản phẩm
 */
function detectCategoryFromBrand(brand: string): string {
  if (!brand) return '';
  const b = brand.toLowerCase();

  // Smartphones/Tablets → communication (mobile a11y)
  if (/apple|samsung|xiaomi|oppo|vivo|realme|oneplus|nokia|motorola|sony|google|honor|huawei|tecno|infinix|itel/.test(b)) {
    return 'communication';
  }

  // Laptops/PCs → web_accessibility (web a11y)
  if (/dell|hp|hewlett|lenovo|thinkpad|ideapad|asus|zenbook vivobook|acer|predator|msi|gigabyte|microsoft|surface|razer|lg|alienware|apple/.test(b)) {
    return 'web_accessibility';
  }

  // Audio/headphones/speakers → hearing
  if (/bose|jbl|beats|sennheiser|marshall|anker|soundcore|airpods|galaxy buds|sony audio|jabra|plantronics|audio technica/.test(b)) {
    return 'hearing';
  }

  // Cameras → vision
  if (/canon|nikon|fujifilm|olympus|panasonic|gopro|dji|logitech webcam/.test(b)) {
    return 'vision';
  }

  // Wearables/tablets → daily_living
  if (/garmin|fitbit|amazfit|apple watch|samsung watch|wearable/.test(b)) {
    return 'daily_living';
  }

  // Printers → general
  if (/epson|brother|canon printer|laserjet/.test(b)) {
    return 'general';
  }

  // Assistive tech → vision/hearing
  if (/orcam|jaws|nvda|zoomtext|dragon|屏幕阅读器|读屏软件/.test(b)) {
    return 'vision';
  }

  return '';
}

/**
 * Auto-classify product vào category MADA dựa trên:
 * 1. Brand (đã có ở trên)
 * 2. Tên sản phẩm + mô tả (keyword matching)
 * 3. Fallback: dùng AI/Gemini để phân loại
 */
function autoClassifyMadaCategory(
  name: string,
  description: string,
  brand: string,
  existingCategory?: string
): string {
  const text = `${name} ${description} ${brand}`.toLowerCase();

  // Nếu có brand → dùng brand mapping trước
  if (brand) {
    const fromBrand = detectCategoryFromBrand(brand);
    if (fromBrand) return fromBrand;
  }

  // === KEYWORD MATCHING trên nội dung ===

  // 🔤 HEARING - Thính giác
  const hearingKeywords = [
    'hearing aid', 'hearing amplifier', ' hearing', 'tai nghe', 'loa', 'loa khuếch đại',
    'amplifier', 'headphone', 'earphone', 'earpiece', 'cochlear', 'hearing loop',
    'FM system', 'alert', 'rung', 'nghe kém', 'khiếm thính', 'tai', 'âm thanh',
    'speaker', 'microphone', 'ALS', 'caption', 'phụ đề', 'subtitles', 'audio',
    'stethoscope', ' listening', 'rung động', 'deaf', 'hard of hearing',
    'visual alert', 'rung', 'thính giác', 'hearing impairment', 'assistive listening',
    'sound', 'âm', 'nhạc', 'radio', 'bluetooth speaker', 'smart speaker',
  ];
  if (hearingKeywords.some(kw => text.includes(kw))) {
    return 'hearing';
  }

  // 👁️ VISION - Thị giác
  const visionKeywords = [
    'screen reader', 'NVDA', 'JAWS', 'VoiceOver', 'ZoomText', 'magnifier', 'magnification',
    'Braille', 'braille', 'OrCam', 'eye', 'thị giác', 'khiếm thị', 'mù', 'blind',
    'vision', 'camera', 'đọc', 'reader', 'read', 'scan', 'quét', 'nhận dạng',
    'optical character', 'OCR', 'text-to-speech', 'speech synthesis', 'tts',
    'screen magnification', 'zoom', 'phóng to', 'thị lực', 'visual', 'hình ảnh',
    'camera', 'máy ảnh', 'image', 'photo', 'hình', '障碍', '視覚', '視覺',
    'naming', 'đặt tên', 'label', 'nhãn', '障碍', 'accessibility',
    'navigation', 'điều hướng', 'orientation', 'định hướng', 'mobility aid',
    'màn hình', 'display', 'monitor', 'laptop', 'tablet', 'ipad', 'smartphone',
  ];
  if (visionKeywords.some(kw => text.includes(kw))) {
    return 'vision';
  }

  // 🗣️ COMMUNICATION - Giao tiếp
  const communicationKeywords = [
    'AAC', 'communication', 'giao tiếp', 'speech', 'nói', 'tiếng nói',
    'talker', 'communicator', 'ngôn ngữ', 'language', 'symbol', 'biểu tượng',
    'voice', 'giọng nói', 'text to speech', 'TTS', 'STP', 'SGD',
    'eye tracking', 'eye gaze', 'theo dõi mắt', 'switch', 'công tắc',
    'alternative', 'tăng cường', 'ngôn ngữ ký hiệu', 'sign language',
    'DynaVox', 'Tobii', ' PRC', 'Saltillo', 'mega', 'say it', 'quick talker',
    'laryngectomy', 'throat', 'cổ họng', 'aphasia', 'afasia', 'rối loạn ngôn ngữ',
    'stroke', 'đột quỵ', 'cerebral palsy', 'bại não', 'ALS', 'Lou Gehrig',
    'autism', 'tự kỷ', 'autistic', 'speech impairment', 'rối loạn lời nói',
  ];
  if (communicationKeywords.some(kw => text.includes(kw))) {
    return 'communication';
  }

  // 🦽 MOBILITY - Vận động
  const mobilityKeywords = [
    'wheelchair', 'xe lăn', 'xe đẩy', 'wheel chair', 'wheelchair',
    'prosthetic', 'prosthesis', 'chân giả', 'tay giả', '假肢', '義肢',
    'orthosis', 'orthopedic', 'nẹp', 'brace', 'splint', 'hỗ trợ',
    'walking', 'đi bộ', 'walker', 'khung tập đi', 'cane', 'gậy',
    'crutch', 'nạng', 'standing frame', 'standing', 'đứng', 'lift',
    'nâng', 'hoist', 'patient lift', 'transfer', 'chuyển', 'đỡ',
    'bed', 'giường', 'mattress', 'nệm', 'positioning', 'vị trí',
    'seating', 'ghế', 'cushion', 'đệm', 'pressure relief', 'giảm áp lực',
    'bathroom', 'phòng tắm', 'toilet', 'bồn cầu', 'shower', 'vòi sen',
    'grab bar', 'tay vịn', 'railing', 'thanh', 'grab', 'bám',
    'scooter', 'xe điện', 'mobility scooter', 'xe ga', 'electric scooter',
    'stairlift', 'thang máy', 'elevator', 'ramp', 'dốc', 'slope',
  ];
  if (mobilityKeywords.some(kw => text.includes(kw))) {
    return 'mobility';
  }

  // 🧠 COGNITION - Nhận thức
  const cognitionKeywords = [
    'cognitive', 'nhận thức', 'cognition', 'memory', 'trí nhớ', 'ghi nhớ',
    'dementia', 'sa sút trí tuệ', ' Alzheimer', 'parkinson', ' Huntington',
    'brain injury', 'chấn thương não', 'TBI', 'ABI', 'acquired brain',
    'intellectual', 'trí tuệ', 'learning', 'học tập', 'học', 'study',
    'attention', 'chú ý', 'concentration', 'tập trung', 'focus',
    'executive function', 'chức năng điều hành', 'planning', 'lập kế hoạch',
    'organization', 'tổ chức', 'sắp xếp', 'scheduler', 'lịch', 'reminder',
    'nhắc nhở', 'alarm', 'báo thức', 'prompt', 'hướng dẫn', 'prompting',
    'task analysis', 'phân tích công việc', 'step by step', 'từng bước',
    'visual schedule', 'lịch trình', 'token board', 'khen thưởng',
    'autism', 'tự kỷ', 'autistic', 'asperger', 'spectrum',
    ' Down syndrome', ' down', 'trisomy 21', 'ID', 'intellectual disability',
    'special education', 'giáo dục đặc biệt', 'SPED', 'IEP',
  ];
  if (cognitionKeywords.some(kw => text.includes(kw))) {
    return 'cognition';
  }

  // 🏠 DAILY LIVING - Sinh hoạt
  const dailyLivingKeywords = [
    'daily living', 'sinh hoạt', 'self-care', 'chăm sóc', 'eating', 'ăn uống',
    'utensil', 'dụng cụ', 'knife', 'dao', 'fork', 'nĩa', 'spoon', 'thìa',
    'plate', 'đĩa', 'bowl', 'bát', 'cup', 'cốc', 'mug', 'glass', 'ly',
    'adaptive', 'thích ứng', '易化', 'easy grip', 'dễ cầm', 'ergonomic',
    'button hook', 'móc nút', 'zipper pull', 'kéo khóa', 'shoe horn', 'lấy giày',
    'dressing', 'mặc', 'quần áo', 'clothing', 'shirt', 'áo', 'pants', 'quần',
    'socks', 'tất', 'shoe', 'giày', 'sock aid', 'lấy tất', 'reacher', 'gắp',
    'grabber', 'tweed', 'long reacher', 'gắp đồ', '翻', '取物',
    'bathroom', 'phòng tắm', 'shower', 'tắm', 'toilet', 'vệ sinh',
    'commode', 'bô', 'bedpan', 'niệu', 'urinal', 'bồn tiểu',
    'kitchen', 'nhà bếp', 'cooking', 'nấu ăn', 'cutting', 'cắt',
    'peeling', 'bào', 'opening', 'mở', 'jar', 'lọ', 'bottle', 'chai',
    'medication', 'thuốc', 'pill', 'viên', 'dosage', 'liều', 'alarm',
    'báo thức', 'dispenser', 'phân phát', 'organizer', 'hộp thuốc',
  ];
  if (dailyLivingKeywords.some(kw => text.includes(kw))) {
    return 'daily_living';
  }

  // 🌐 WEB ACCESSIBILITY
  const webA11yKeywords = [
    'website', 'web', 'WCAG', 'accessibility', 'a11y', 'ADA compliance',
    'screen reader', 'browser', 'trình duyệt', 'chrome', 'firefox', 'edge',
    'extension', 'plugin', 'add-on', 'font', 'phông chữ', 'contrast', 'tương phản',
    'caption', 'phụ đề', 'subtitle', 'transcript', 'văn bản', 'alt text',
  ];
  if (webA11yKeywords.some(kw => text.includes(kw))) {
    return 'web_accessibility';
  }

  // Nếu có category từ URL/existing → giữ nguyên
  if (existingCategory && existingCategory !== 'general') {
    return existingCategory;
  }

  return 'general';
}

// ============== POST /import-url (PREVIEW ONLY) ==============

router.post('/import-url', async (req, res) => {
  try {
    const { url, defaultCategory = 'general', madaLanguage = 'en' } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: 'URL là bắt buộc' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res
        .status(400)
        .json({ success: false, error: 'URL không hợp lệ' });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res
        .status(400)
        .json({ success: false, error: 'Chỉ hỗ trợ http/https' });
    }

    console.log(`\n🕷️ [import-url] Scraping: ${url}`);

    // MADA → preview mode (1 page, 20 SP) cho admin xem nhanh
    const result: ExtractionResult = await productExtractor.extractFromUrl(url, undefined, {
      mode: 'preview',
      language: madaLanguage === 'ar' ? 'ar' : 'en',
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Không thể scrape URL này',
        durationMs: result.durationMs,
        fetchMethod: result.fetchMethod,
      });
    }

    console.log(
      `✅ [import-url] Found ${result.totalFound} products via ${result.method} (fetch=${result.fetchMethod}, ${result.durationMs}ms${result.proxy ? `, proxy=${result.proxy}` : ''})`
    );

    // Preview rows (chưa lưu DB)
    const preview = result.products.slice(0, 20).map((p) =>
      mapProductToRow(p, defaultCategory)
    );

    // Get proxy stats (chỉ cần cho e-commerce path)
    const proxyStats = result.method === 'mada-scraper'
      ? null
      : (await import('../lib/scraping/proxyService')).proxyService.getStats();

    res.json({
      success: true,
      data: {
        url,
        totalFound: result.totalFound,
        method: result.method,
        fetchMethod: result.fetchMethod,
        durationMs: result.durationMs,
        proxyUsed: result.proxy || null,
        userAgent: result.userAgent || null,
        products: result.products.slice(0, 100), // full data cho client
        previewRows: preview,
        stats: {
          withPrice: result.products.filter((p) => p.price > 0).length,
          withImage: result.products.filter((p) => !!p.imageUrl).length,
          inStock: result.products.filter((p) => p.inStock).length,
          withBrand: result.products.filter((p) => !!p.brand).length,
        },
        proxyStats,
      },
    });
  } catch (err: any) {
    console.error('[import-url] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== POST /import-url/save (PERSIST TO DB) ==============

router.post('/import-url/save', async (req, res) => {
  try {
    const {
      url,
      defaultCategory = 'general',
      onlyValid = true,
      forceReimport = false,
      madaLanguage = 'en',
    } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: 'URL là bắt buộc' });
    }

    // MADA → save mode (3 page, 100 SP) để lưu nhiều SP
    const result = await productExtractor.extractFromUrl(url, undefined, {
      mode: 'save',
      language: madaLanguage === 'ar' ? 'ar' : 'en',
    });

    if (!result.success) {
      return res
        .status(500)
        .json({ success: false, error: result.error || 'Scrape thất bại' });
    }

    const isMada = result.method === 'mada-scraper';

    // MADA SP không có giá → bỏ filter "onlyValid" khi user chọn lưu từ MADA
    // (admin paste URL MADA thường muốn lưu tất cả assistive tech SP)
    const productsToSave = onlyValid && !isMada
      ? result.products.filter((p) => p.name && p.price > 0)
      : result.products.filter((p) => p.name);

    if (productsToSave.length === 0) {
      return res.status(400).json({
        success: false,
        error: isMada
          ? 'MADA URL không trả về sản phẩm nào. Kiểm tra URL hoặc category.'
          : 'Không có sản phẩm hợp lệ để lưu. Hãy thử bỏ tick "Chỉ lưu SP có giá" hoặc dùng URL khác.',
      });
    }

    // Check duplicates (trừ khi forceReimport=true)
    const existingUrls = new Set<string>();
    if (!forceReimport) {
      const existing = db.prepare('SELECT product_url FROM kb_products').all() as { product_url: string }[];
      for (const e of existing) existingUrls.add(e.product_url);
    }

    const insert = db.prepare(`
      INSERT INTO kb_products (
        id, title, title_en, title_ar, title_fr,
        description, description_en, description_ar, description_fr,
        content,
        category, brand, model, price_range, source_url, product_url,
        image_url, iso_codes, wcag_level, who_gate_area, status, featured,
        sort_order, language, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;

    // ⭐ Pre-process: translate all products BEFORE inserting (translation is async)
    console.log(`🌐 Translating ${productsToSave.length} products to all languages...`);
    const translatedRows: Array<{ row: any; translations: any }> = [];
    for (const p of productsToSave) {
      if (!forceReimport && existingUrls.has(p.url)) {
        skipped++;
        continue;
      }
      const row = mapProductToRow(p, defaultCategory);
      const detectedLang = detectTextLang(row.title + ' ' + (row.description || ''));
      const translations = await translateProduct({
        title: row.title,
        description: row.description,
        content: row.content,
        sourceLang: detectedLang as SupportedLanguage,
      }).catch(() => ({ title_en: '', title_ar: '', title_fr: '', description_en: '', description_ar: '', description_fr: '', content_en: '', content_ar: '', content_fr: '' }));
      translatedRows.push({ row, translations });
    }

    // Then insert in a synchronous transaction
    const syncedIds: string[] = [];
    const txn = db.transaction(() => {
      for (const { row, translations } of translatedRows) {
        insert.run(
          row.id, row.title, row.title_en || translations.title_en, translations.title_ar, translations.title_fr,
          row.description, row.description_en || translations.description_en, translations.description_ar, translations.description_fr,
          row.content, row.category, row.brand, row.model, row.price_range, row.source_url, row.product_url,
          row.image_url, JSON.stringify(row.iso_codes), row.wcag_level, row.who_gate_area,
          row.status, row.featured, row.sort_order, row.language, now, now
        );

        // ⭐ Auto-sync to knowledge_items
        try {
          const syncRes = syncProductToKnowledge(row);
          if (syncRes.knowledge_item_id) syncedIds.push(syncRes.knowledge_item_id);
        } catch (e) {
          console.warn(`[import-url/save] sync fail for ${row.id}:`, e);
        }
        inserted++;
      }
    });
    txn();

    console.log(
      `💾 [import-url/save] Saved ${inserted} (skipped ${skipped}) from ${url} (method=${result.method}, fetch=${result.fetchMethod}, ${result.durationMs}ms, synced=${syncedIds.length})`
    );

    res.json({
      success: true,
      data: {
        url,
        totalFound: result.totalFound,
        saved: inserted,
        skipped,
        syncedToRAG: syncedIds.length,
        method: result.method,
        fetchMethod: result.fetchMethod,
        durationMs: result.durationMs,
      },
      message: skipped > 0
        ? `Đã lưu ${inserted} sản phẩm mới (bỏ qua ${skipped} SP trùng lặp). ${syncedIds.length} SP đã sync sang AI/RAG.`
        : `Đã lưu ${inserted} sản phẩm từ ${url}. ${syncedIds.length} SP đã sync sang AI/RAG.`,
    });
  } catch (err: any) {
    console.error('[import-url/save] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

// ============== GET /import-url/metadata (SCRAPE META TAGS) ==============

/**
 * GET /api/scraper/import-url/metadata?url=<url>
 *
 * Scrape Open Graph / meta tags từ URL để pre-fill form sản phẩm.
 * Trả về nhanh: title, description, image, siteName.
 */
router.get('/import-url/metadata', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu tham số url' });
    }

    const metadata = await scrapeProductMetadata(url);

    res.json({
      success: true,
      data: metadata,
    });
  } catch (err: any) {
    console.error('[import-url/metadata] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});