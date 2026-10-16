/**
 * Smart URL Import Routes — Async Job Queue
 *
 * Admin paste URL sản phẩm → scrape chạy NỀN (không block request)
 * Frontend poll job status → hiển thị kết quả
 *
 * Endpoints:
 *   POST /api/scraper/import-url          — Tạo preview job → trả jobId ngay
 *   GET  /api/scraper/import-url/:jobId   — Poll job status + results
 *   POST /api/scraper/import-url/save     — Tạo save job → trả jobId ngay
 *   GET  /api/scraper/import-url/:jobId/save — Poll save job status
 *   GET  /api/scraper/import-url/metadata — Scrape meta tags (sync, nhanh)
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
    madaCategory: detectedCategory,
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

function detectBrand(name: string, fallback?: string): string {
  if (fallback && typeof fallback === 'string' && fallback.length > 0 && fallback.length < 30) {
    return fallback;
  }

  const brands = [
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
    'Bose', 'JBL', 'Beats', 'Sennheiser', 'Marshall', 'Anker', 'Soundcore',
    'AirPods', 'Galaxy Buds',
    'Canon', 'Nikon', 'Fujifilm', 'Olympus', 'Panasonic', 'GoPro',
    'Apple Watch', 'Garmin', 'Fitbit', 'Amazfit',
    'Epson', 'Brother',
    'Google Home', 'Amazon', 'Echo',
    'OrCam', 'JAWS', 'NVDA', 'ZoomText', 'Dragon',
  ];

  const lower = name.toLowerCase();
  for (const brand of brands) {
    const regex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower) || regex.test(name)) {
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

function detectCategoryFromBrand(brand: string): string {
  if (!brand) return '';
  const b = brand.toLowerCase();

  if (/apple|samsung|xiaomi|oppo|vivo|realme|oneplus|nokia|motorola|sony|google|honor|huawei|tecno|infinix|itel/.test(b)) {
    return 'communication';
  }
  if (/dell|hp|hewlett|lenovo|thinkpad|ideapad|asus|zenbook vivobook|acer|predator|msi|gigabyte|microsoft|surface|razer|lg|alienware|apple/.test(b)) {
    return 'web_accessibility';
  }
  if (/bose|jbl|beats|sennheiser|marshall|anker|soundcore|airpods|galaxy buds|sony audio|jabra|plantronics|audio technica/.test(b)) {
    return 'hearing';
  }
  if (/canon|nikon|fujifilm|olympus|panasonic|gopro|dji|logitech webcam/.test(b)) {
    return 'vision';
  }
  if (/garmin|fitbit|amazfit|apple watch|samsung watch|wearable/.test(b)) {
    return 'daily_living';
  }
  if (/epson|brother|canon printer|laserjet/.test(b)) {
    return 'general';
  }
  if (/orcam|jaws|nvda|zoomtext|dragon|屏幕阅读器|读屏软件/.test(b)) {
    return 'vision';
  }

  return '';
}

function autoClassifyMadaCategory(
  name: string,
  description: string,
  brand: string,
  existingCategory?: string
): string {
  const text = `${name} ${description} ${brand}`.toLowerCase();

  if (brand) {
    const fromBrand = detectCategoryFromBrand(brand);
    if (fromBrand) return fromBrand;
  }

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

  const webA11yKeywords = [
    'website', 'web', 'WCAG', 'accessibility', 'a11y', 'ADA compliance',
    'screen reader', 'browser', 'trình duyệt', 'chrome', 'firefox', 'edge',
    'extension', 'plugin', 'add-on', 'font', 'phông chữ', 'contrast', 'tương phản',
    'caption', 'phụ đề', 'subtitle', 'transcript', 'văn bản', 'alt text',
  ];
  if (webA11yKeywords.some(kw => text.includes(kw))) {
    return 'web_accessibility';
  }

  if (existingCategory && existingCategory !== 'general') {
    return existingCategory;
  }

  return 'general';
}

// ============== JOB HELPERS ==============

interface ScrapeJob {
  id: string;
  url: string;
  mode: 'preview' | 'save';
  default_category: string;
  mada_language: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string | null;
  error: string | null;
  progress: number;
  progress_message: string | null;
  created_at: string;
  updated_at: string;
}

function createScrapeJob(url: string, mode: 'preview' | 'save', defaultCategory: string, madaLanguage: string): ScrapeJob {
  const id = `sj_${uuidv4().slice(0, 12)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO scrape_jobs (id, url, mode, default_category, mada_language, status, progress, progress_message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
  `).run(id, url, mode, defaultCategory, madaLanguage, now, now);

  return db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(id) as ScrapeJob;
}

function updateScrapeJob(jobId: string, updates: Partial<Pick<ScrapeJob, 'status' | 'result' | 'error' | 'progress' | 'progress_message'>>) {
  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [new Date().toISOString()];

  if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status); }
  if (updates.result !== undefined) { sets.push('result = ?'); params.push(updates.result); }
  if (updates.error !== undefined) { sets.push('error = ?'); params.push(updates.error); }
  if (updates.progress !== undefined) { sets.push('progress = ?'); params.push(updates.progress); }
  if (updates.progress_message !== undefined) { sets.push('progress_message = ?'); params.push(updates.progress_message); }

  params.push(jobId);
  db.prepare(`UPDATE scrape_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

// ============== BACKGROUND WORKER: PREVIEW SCRAPE ==============

async function runPreviewJob(job: ScrapeJob) {
  updateScrapeJob(job.id, { status: 'running', progress: 10, progress_message: 'Đang kết nối website...' });

  try {
    const result: ExtractionResult = await productExtractor.extractFromUrl(job.url, undefined, {
      mode: 'preview',
      language: job.mada_language === 'ar' ? 'ar' : 'en',
    });

    updateScrapeJob(job.id, { progress: 80, progress_message: 'Đang xử lý kết quả...' });

    const preview = result.products.slice(0, 20).map((p) => mapProductToRow(p, job.default_category));

    const output = {
      url: job.url,
      totalFound: result.totalFound,
      method: result.method,
      fetchMethod: result.fetchMethod,
      durationMs: result.durationMs,
      proxyUsed: result.proxy || null,
      userAgent: result.userAgent || null,
      products: result.products.slice(0, 100),
      previewRows: preview,
      stats: {
        withPrice: result.products.filter((p) => p.price > 0).length,
        withImage: result.products.filter((p) => !!p.imageUrl).length,
        inStock: result.products.filter((p) => p.inStock).length,
        withBrand: result.products.filter((p) => !!p.brand).length,
      },
      success: result.success,
      error: result.error || null,
    };

    updateScrapeJob(job.id, {
      status: 'completed',
      progress: 100,
      progress_message: 'Hoàn tất',
      result: JSON.stringify(output),
    });

    console.log(`✅ [preview job ${job.id}] Found ${result.totalFound} products in ${result.durationMs}ms`);
  } catch (err: any) {
    console.error(`❌ [preview job ${job.id}] Failed:`, err.message);
    updateScrapeJob(job.id, {
      status: 'failed',
      progress: 100,
      error: err.message,
    });
  }
}

// ============== BACKGROUND WORKER: SAVE SCRAPE + PERSIST ==============

async function runSaveJob(job: ScrapeJob) {
  updateScrapeJob(job.id, { status: 'running', progress: 5, progress_message: 'Đang kết nối website MADA...' });

  try {
    // Scrape
    const result = await productExtractor.extractFromUrl(job.url, undefined, {
      mode: 'save',
      language: job.mada_language === 'ar' ? 'ar' : 'en',
    });

    updateScrapeJob(job.id, { progress: 40, progress_message: `Đã scrape xong, xử lý ${result.products.length} sản phẩm...` });

    const isMada = result.method === 'mada-scraper';
    const productsToSave = result.products.filter((p) => p.name);

    if (productsToSave.length === 0) {
      updateScrapeJob(job.id, {
        status: 'failed',
        progress: 100,
        error: isMada
          ? 'MADA URL không trả về sản phẩm nào. Kiểm tra URL hoặc category.'
          : 'Không có sản phẩm hợp lệ để lưu.',
      });
      return;
    }

    updateScrapeJob(job.id, { progress: 50, progress_message: `Đang dịch ${productsToSave.length} sản phẩm...` });

    const existing = db.prepare('SELECT product_url FROM kb_products').all() as { product_url: string }[];
    const existingUrls = new Set(existing.map(e => e.product_url));

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
    const translatedRows: Array<{ row: any; translations: any }> = [];

    for (const p of productsToSave) {
      if (existingUrls.has(p.url)) {
        skipped++;
        continue;
      }
      const row = mapProductToRow(p, job.default_category);
      const detectedLang = detectTextLang(row.title + ' ' + (row.description || ''));
      const translations = await translateProduct({
        title: row.title,
        description: row.description,
        content: row.content,
        sourceLang: detectedLang as SupportedLanguage,
      }).catch(() => ({ title_en: '', title_ar: '', title_fr: '', description_en: '', description_ar: '', description_fr: '', content_en: '', content_ar: '', content_fr: '' }));
      translatedRows.push({ row, translations });
    }

    updateScrapeJob(job.id, { progress: 75, progress_message: `Đang lưu ${translatedRows.length} sản phẩm vào DB...` });

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
        try {
          const syncRes = syncProductToKnowledge(row);
          if (syncRes.knowledge_item_id) syncedIds.push(syncRes.knowledge_item_id);
        } catch (e) {
          console.warn(`[save job ${job.id}] sync fail:`, e);
        }
        inserted++;
      }
    });
    txn();

    const output = {
      url: job.url,
      totalFound: result.totalFound,
      saved: inserted,
      skipped,
      syncedToRAG: syncedIds.length,
      method: result.method,
      fetchMethod: result.fetchMethod,
      durationMs: result.durationMs,
      message: skipped > 0
        ? `Đã lưu ${inserted} sản phẩm mới (bỏ qua ${skipped} SP trùng lặp). ${syncedIds.length} SP đã sync sang AI/RAG.`
        : `Đã lưu ${inserted} sản phẩm từ ${job.url}. ${syncedIds.length} SP đã sync sang AI/RAG.`,
    };

    updateScrapeJob(job.id, {
      status: 'completed',
      progress: 100,
      progress_message: 'Hoàn tất',
      result: JSON.stringify(output),
    });

    console.log(`✅ [save job ${job.id}] Saved ${inserted} products, synced ${syncedIds.length}`);
  } catch (err: any) {
    console.error(`❌ [save job ${job.id}] Failed:`, err.message);
    updateScrapeJob(job.id, {
      status: 'failed',
      progress: 100,
      error: err.message,
    });
  }
}

// ============== POST /import-url — TẠO PREVIEW JOB ==============

router.post('/import-url', (req, res) => {
  const { url, defaultCategory = 'general', madaLanguage = 'en' } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL là bắt buộc' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'URL không hợp lệ' });
  }

  // Tạo job → trả jobId ngay (không chờ scrape)
  const job = createScrapeJob(url, 'preview', defaultCategory, madaLanguage);
  console.log(`🕷️ [import-url] Created preview job ${job.id} for: ${url}`);

  res.json({
    success: true,
    data: { jobId: job.id, status: 'pending', message: 'Đang bắt đầu scrape...' },
  });

  // Chạy scrape ở NỀN (setImmediate để không block response)
  setImmediate(() => {
    runPreviewJob(job);
  });
});

// ============== GET /import-url/:jobId — POLL PREVIEW JOB STATUS ==============

router.get('/import-url/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = db.prepare('SELECT * FROM scrape_jobs WHERE id = ? AND mode = ?').get(jobId, 'preview') as ScrapeJob | undefined;

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job không tồn tại' });
  }

  if (job.status === 'completed') {
    const result = JSON.parse(job.result || '{}');
    return res.json({
      success: true,
      data: {
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        ...result,
      },
    });
  }

  if (job.status === 'failed') {
    return res.json({
      success: true,
      data: {
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        error: job.error,
        success: false,
        error2: job.error,
      },
    });
  }

  // pending / running
  res.json({
    success: true,
    data: {
      status: job.status,
      progress: job.progress,
      progressMessage: job.progress_message || 'Đang xử lý...',
    },
  });
});

// ============== POST /import-url/save — TẠO SAVE JOB ==============

router.post('/import-url/save', (req, res) => {
  const {
    url,
    defaultCategory = 'general',
    onlyValid = true,
    forceReimport = false,
    madaLanguage = 'en',
  } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL là bắt buộc' });
  }

  // Tạo job → trả jobId ngay
  const job = createScrapeJob(url, 'save', defaultCategory, madaLanguage);
  console.log(`💾 [import-url/save] Created save job ${job.id} for: ${url}`);

  res.json({
    success: true,
    data: { jobId: job.id, status: 'pending', message: 'Đang bắt đầu scrape và lưu...' },
  });

  // Chạy ở NỀN
  setImmediate(() => {
    runSaveJob(job);
  });
});

// ============== GET /import-url/:jobId/save — POLL SAVE JOB STATUS ==============

router.get('/import-url/:jobId/save', (req, res) => {
  const { jobId } = req.params;
  const job = db.prepare('SELECT * FROM scrape_jobs WHERE id = ? AND mode = ?').get(jobId, 'save') as ScrapeJob | undefined;

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job không tồn tại' });
  }

  if (job.status === 'completed') {
    const result = JSON.parse(job.result || '{}');
    return res.json({
      success: true,
      data: {
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        ...result,
      },
    });
  }

  if (job.status === 'failed') {
    return res.json({
      success: true,
      data: {
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        error: job.error,
      },
    });
  }

  res.json({
    success: true,
    data: {
      status: job.status,
      progress: job.progress,
      progressMessage: job.progress_message || 'Đang xử lý...',
    },
  });
});

// ============== LEGACY: backward compat sync endpoints ==============

// POST /import-url (sync — legacy, vẫn giữ cho backward compat)
// Nếu client gọi sync version, redirect sang job-based
router.post('/import-url/sync', async (req, res) => {
  const { url, defaultCategory = 'general', madaLanguage = 'en' } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL là bắt buộc' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'URL không hợp lệ' });
  }

  try {
    const result = await productExtractor.extractFromUrl(url, undefined, {
      mode: 'preview',
      language: madaLanguage === 'ar' ? 'ar' : 'en',
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Scrape thất bại',
        durationMs: result.durationMs,
      });
    }

    const preview = result.products.slice(0, 20).map((p) => mapProductToRow(p, defaultCategory));

    res.json({
      success: true,
      data: {
        url,
        totalFound: result.totalFound,
        method: result.method,
        fetchMethod: result.fetchMethod,
        durationMs: result.durationMs,
        products: result.products.slice(0, 100),
        previewRows: preview,
        stats: {
          withPrice: result.products.filter((p) => p.price > 0).length,
          withImage: result.products.filter((p) => !!p.imageUrl).length,
          inStock: result.products.filter((p) => p.inStock).length,
          withBrand: result.products.filter((p) => !!p.brand).length,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== GET /import-url/metadata (SYNC — NHANH) ==============

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
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== CLEANUP: xóa jobs cũ hơn 24h ==============

try {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const deleted = db.prepare("DELETE FROM scrape_jobs WHERE created_at < ? AND status IN ('completed', 'failed')").run(cutoff);
  if (deleted.changes > 0) {
    console.log(`🧹 [scrape_jobs] Cleaned up ${deleted.changes} old jobs`);
  }
} catch { /* ignore cleanup errors */ }

export default router;
