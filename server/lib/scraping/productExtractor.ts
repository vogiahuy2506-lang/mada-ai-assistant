/**
 * Smart Product Extractor
 * 
 * Trích xuất structured product data (tên, giá, ảnh, brand...) từ HTML
 * của website thương mại điện tử.
 *
 * Chiến lược 3 lớp:
 *  1. JSON-LD (Schema.org Product) — nhanh & chính xác nhất
 *  2. HTML structured selectors (.product, [itemtype=Product])
 *  3. Gemini AI fallback — đọc HTML tự do, trích xuất khi không có cấu trúc chuẩn
 */

import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  MADA_CATEGORIES,
  extractCategoryFromUrl,
  scrapeCategoryListing,
  scrapeProductDetail,
  type ProductDetail,
  type ProductListItem,
} from '../../scripts/mada-scraper';

export interface ExtractedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  originalPrice?: number;
  imageUrl: string;
  images: string[];
  category: string;
  brand?: string;
  specifications: Record<string, string>;
  inStock: boolean;
  url: string;
  rating?: number;
  reviewsCount?: number;
  extractionMethod: 'json-ld' | 'html-selectors' | 'gemini-ai' | 'mada-scraper';
  /** Optional rich payload chỉ dành cho MADA (ISO codes, attachments, gallery...) */
  madaMetadata?: {
    postId?: string;
    slug?: string;
    isoCodes?: string[];
    tags?: string[];
    attachments?: { type: string; url: string; label: string }[];
    galleryImages?: string[];
    videoLinks?: string[];
    content?: string;
    categories?: string[];
    madaCategory?: string | null;
    botId?: string | null;
    language?: 'en' | 'ar';
  };
}

export interface ExtractionResult {
  success: boolean;
  url: string;
  totalFound: number;
  products: ExtractedProduct[];
  method: 'json-ld' | 'html-selectors' | 'gemini-ai' | 'mixed' | 'mada-scraper';
  fetchMethod: 'fetch' | 'puppeteer'; // Cách lấy HTML
  durationMs: number;
  proxy?: string;
  userAgent?: string;
  error?: string;
}

interface ExtractorLogger {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

export interface ExtractOptions {
  /**
   * - 'preview': MADA chỉ scrape 1 page, tối đa 20 SP để admin xem nhanh.
   * - 'save':    MADA scrape tối đa 3 page, 100 SP để lưu DB.
   */
  mode?: 'preview' | 'save';
  /**
   * Ngôn ngữ ưu tiên khi scrape MADA. Mặc định: 'en'.
   */
  language?: 'en' | 'ar';
}

const MADA_DOMAINS = new Set(['at.mada.org.qa', 'www.mada.org.qa', 'mada.org.qa']);

export function isMadaUrl(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return MADA_DOMAINS.has(host);
  } catch {
    return false;
  }
}

/**
 * Nhận diện URL là single product page (technology/<slug>) hay category listing.
 */
export function classifyMadaUrl(url: string): 'product' | 'category' | 'unknown' {
  try {
    const path = new URL(url).pathname;
    // /technology/<slug>/ là chi tiết 1 sản phẩm
    if (/\/technology\/[^/]+\/?$/i.test(path)) return 'product';
    // /technology-category/.../ là listing
    if (/\/technology-category\//i.test(path)) return 'category';
    // /assistive-technology-portal/ là listing đặc biệt
    if (/\/assistive-technology-portal\/?$/i.test(path)) return 'category';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

class ProductExtractorService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });
    }
  }

  /**
   * Main entry: trích xuất products từ URL
   *
   * Auto-routing:
   *  - URL thuộc MADA (at.mada.org.qa) → dùng mada-scraper chuyên dụng
   *  - URL khác → 3-layer e-commerce extractor (JSON-LD, HTML, Gemini AI)
   */
  async extractFromUrl(
    url: string,
    logger?: ExtractorLogger,
    options: ExtractOptions = {}
  ): Promise<ExtractionResult> {
    const start = Date.now();
    const log = {
      info: logger?.info || console.log,
      warn: logger?.warn || console.warn,
      error: logger?.error || console.error,
    };

    // ===== MADA fast path =====
    if (isMadaUrl(url)) {
      log.info?.(`[ProductExtractor] Detected MADA URL → routing to mada-scraper`);
      return this.extractFromMada(url, log, options, start);
    }

    let fetchMethod: 'fetch' | 'puppeteer' = 'fetch';
    let proxyUsed: string | undefined;
    let userAgentUsed: string | undefined;

    try {
      log.info?.(`[ProductExtractor] Fetching ${url}...`);

      // Smart fetch (auto-detect SPA + use proxy + stealth)
      const { browserFetcher } = await import('./browserFetcher');
      const fetchResult = await browserFetcher.fetch(url, {
        timeoutMs: 30000,
        useProxy: true,
        retries: 2,
      });

      const html = fetchResult.html;
      fetchMethod = fetchResult.method;
      proxyUsed = fetchResult.proxy;
      userAgentUsed = fetchResult.userAgent;
      log.info?.(
        `[ProductExtractor] Fetched via ${fetchMethod} (${fetchResult.durationMs}ms, ${html.length} chars${proxyUsed ? `, proxy=${proxyUsed}` : ''})`
      );

      const allProducts: ExtractedProduct[] = [];
      const methodsUsed = new Set<string>();

      // ===== Layer 1: JSON-LD (Schema.org Product) =====
      const jsonLdProducts = this.extractFromJsonLd(html, url);
      if (jsonLdProducts.length > 0) {
        log.info?.(`[ProductExtractor] Layer 1 (JSON-LD) found ${jsonLdProducts.length} products`);
        jsonLdProducts.forEach((p) => allProducts.push(p));
        methodsUsed.add('json-ld');
      }

      // ===== Layer 2: HTML structured selectors =====
      const htmlProducts = this.extractFromHtmlStructure(html, url);
      if (htmlProducts.length > 0) {
        log.info?.(`[ProductExtractor] Layer 2 (HTML) found ${htmlProducts.length} products`);
        const existingKeys = new Set(allProducts.map((p) => this.productKey(p)));
        htmlProducts.forEach((p) => {
          if (!existingKeys.has(this.productKey(p))) {
            allProducts.push(p);
            existingKeys.add(this.productKey(p));
          }
        });
        methodsUsed.add('html-selectors');
      }

      // ===== Layer 3: Gemini AI fallback (chỉ khi layer 1+2 không đủ) =====
      if (allProducts.length === 0 && this.model) {
        log.warn?.('[ProductExtractor] No structured data found, using Gemini AI fallback...');
        const aiProducts = await this.extractWithGemini(html, url, log);
        if (aiProducts.length > 0) {
          aiProducts.forEach((p) => allProducts.push(p));
          methodsUsed.add('gemini-ai');
        }
      }

      // dedupe cuối cùng theo tên (case-insensitive)
      const finalProducts = this.deduplicate(allProducts);
      const method: ExtractionResult['method'] =
        methodsUsed.size === 1 ? (Array.from(methodsUsed)[0] as any) : 'mixed';

      return {
        success: true,
        url,
        totalFound: finalProducts.length,
        products: finalProducts,
        method,
        fetchMethod,
        durationMs: Date.now() - start,
        proxy: proxyUsed,
        userAgent: userAgentUsed,
      };
    } catch (err: any) {
      log.error?.('[ProductExtractor] Error:', err);
      return {
        success: false,
        url,
        totalFound: 0,
        products: [],
        method: 'mixed',
        fetchMethod,
        durationMs: Date.now() - start,
        proxy: proxyUsed,
        userAgent: userAgentUsed,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Fetch HTML thông qua BrowserFetcher (smart SPA detection + proxy + stealth)
   */
  private async fetchHtml(url: string, log: ExtractorLogger): Promise<string> {
    const { browserFetcher } = await import('./browserFetcher');
    const result = await browserFetcher.fetch(url, {
      timeoutMs: 30000,
      useProxy: true,
      retries: 2,
    });
    log.info?.(
      `[ProductExtractor] Fetched via ${result.method} (${result.durationMs}ms, status=${result.statusCode})`
    );
    return result.html;
  }

  // ============================================================
  // LAYER 1: JSON-LD (Schema.org Product)
  // ============================================================
  private extractFromJsonLd(html: string, baseUrl: string): ExtractedProduct[] {
    const $ = cheerio.load(html);
    const products: ExtractedProduct[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).html();
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        const candidates = this.flattenProductNodes(data);
        for (const item of candidates) {
          const p = this.parseJsonLdProduct(item, baseUrl);
          if (p) products.push(p);
        }
      } catch {
        // ignore JSON parse errors
      }
    });

    return products;
  }

  private flattenProductNodes(data: any): any[] {
    const results: any[] = [];
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const type = node['@type'];
      if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
        results.push(node);
      }
      if (node['@graph']) visit(node['@graph']);
      if (node.mainEntity) visit(node.mainEntity);
      if (Array.isArray(node.itemListElement)) {
        node.itemListElement.forEach((it: any) => visit(it.item || it));
      }
    };
    visit(data);
    return results;
  }

  private parseJsonLdProduct(data: any, baseUrl: string): ExtractedProduct | null {
    const name = (data.name || '').trim();
    if (!name) return null;

    const offers = data.offers || {};
    const price = this.parsePriceNumber(offers.price);
    const currency = offers.priceCurrency || 'USD';
    const availability = (offers.availability || '').toString();
    const inStock = availability.includes('InStock');

    const images = Array.isArray(data.image)
      ? data.image
      : data.image
        ? [data.image]
        : [];

    const specs: Record<string, string> = {};
    if (Array.isArray(data.additionalProperty)) {
      data.additionalProperty.forEach((prop: any) => {
        if (prop.name && prop.value) specs[prop.name] = String(prop.value);
      });
    }

    return {
      id: data.sku || data.mpn || data['@id'] || this.slugify(name),
      name,
      description: (data.description || '').slice(0, 1000),
      price,
      currency,
      originalPrice: undefined,
      imageUrl: images[0] || '',
      images,
      category: data.category || '',
      brand:
        typeof data.brand === 'string'
          ? data.brand
          : data.brand?.name || undefined,
      specifications: specs,
      inStock,
      url: data.url || baseUrl,
      rating: data.aggregateRating?.ratingValue,
      reviewsCount: data.aggregateRating?.reviewCount,
      extractionMethod: 'json-ld',
    };
  }

  // ============================================================
  // LAYER 2: HTML STRUCTURED SELECTORS
  // ============================================================
  private extractFromHtmlStructure(html: string, baseUrl: string): ExtractedProduct[] {
    const $ = cheerio.load(html);
    const products: ExtractedProduct[] = [];

    // Common product container selectors (mở rộng cho VN e-commerce)
    const selectors = [
      // ===== TGDD (ưu tiên cao nhất - data-* đầy đủ) =====
      'li[class*="__cate_42"]',   // TGDD phone
      'li[class*="__cate_44"]',   // TGDD product item
      'li.item.ajaxed',           // TGDD generic
      '.listproduct li.item',
      'ul.listproduct > li',
      '[data-id][data-price]',    // TGDD generic
      // ===== FPT SHOP (Next.js - không có data-* attributes) =====
      // Card pattern: <a href="/dien-thoai/<slug>" class="..."> bọc <div class="cardInfo">
      'a[href*="/dien-thoai/"]',         // FPT phones
      'a[href*="/laptop/"]',              // FPT laptops
      'a[href*="/may-tinh-bang"]',        // FPT tablets
      'a[href*="/dong-ho-thong-minh"]',   // FPT smartwatches
      'a[href*="/apple/"]',               // FPT apple brand page
      'a[href*="/phu-kien/"]',            // FPT accessories
      // CardInfo wrapper inside FPT cards
      '.cardInfo',
      '[class*="ProductCard"]',
      // ===== TIKI =====
      '[data-view-id="product_list"] > div > div',
      'div[class*="product-item"]',
      'div[class*="ProductItem"]',
      'a[href*="/p"][href*=".html"]',     // Tiki product links
      // ===== CELLPHONES =====
      '.product-info-container.product-item',
      '.product-info-container',
      '.product-item',
      '[class*="product-box"]',
      // ===== SHOPEE (fallback - thường fail vì SPA) =====
      '[data-sku]',
      // ===== GENERIC VN E-COMMERCE =====
      '.item-product',
      '.prd-item',
      '.product-list .item',
      '.product-listing .item',
      // Generic selectors
      '[itemtype*="schema.org/Product"]',
      '[itemtype*="Product"]',
      '.product',
      '.product-item',
      '.product-card',
      '[data-product-id]',
      '.woocommerce-loop-product__link',
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const $el = $(el);

        // ===== FPT SHOP special handling =====
        // <a href="/dien-thoai/xiaomi-poco-c81-pro"> bao bọc img
        // <div class="cardInfo"> liền kề chứa giá + tên (h3)
        let name = '';
        let $cardInfo: any = null;
        const isFPTSelector = sel.includes('a[href*="/dien-thoai/"]') || sel.includes('a[href*="/laptop/"]') ||
            sel.includes('a[href*="/apple/"]') || sel.includes('a[href*="/may-tinh-bang"]') ||
            sel.includes('a[href*="/dong-ho"]') || sel.includes('a[href*="/phu-kien"]');
        const isCardInfoSelector = sel.includes('.cardInfo') || sel.includes('ProductCard');

        if (isCardInfoSelector) {
          // Lấy tên từ h3 trong cardInfo
          name = $el.find('h3').first().text().trim();
        } else if (isFPTSelector) {
          // FPT: lấy alt text từ <img> đầu tiên
          const imgAlt = $el.find('img').first().attr('alt');
          if (imgAlt && imgAlt.length > 5 && !imgAlt.includes('http')) {
            name = imgAlt.trim();
          }
          // FPT: cardInfo là element LIỀN SAU <a> (next sibling)
          if (!$cardInfo) {
            $cardInfo = $el.next('.cardInfo');
            if (!$cardInfo.length) {
              $cardInfo = $el.parent().find('.cardInfo').first();
            }
            if ($cardInfo.length) {
              const h3Name = $cardInfo.find('h3').first().text().trim();
              if (h3Name && h3Name.length > 3) name = h3Name;
            }
          }
        }
        if (!name) {
          // Thử lấy tên từ nhiều nguồn (ưu tiên data-* của TGDD, rồi HTML structure)
          name =
            $el.attr('data-name') ||
            $el.find('a').first().attr('data-name') ||
            $el.find('[itemprop="name"]').attr('content') ||
            $el.find('.product-title, .product-name, h2, h3, .title, .name').first().text().trim();
        }

        // FPT Shop fallback: tìm alt text trong descendants
        if (!name || name.length < 3) {
          const imgAlt = $el.find('img').first().attr('alt') || '';
          if (imgAlt && imgAlt.length > 3 && !imgAlt.includes('http')) {
            name = imgAlt.trim();
          }
        }

        // Skip nav/category links (FPT nav có href="/dien-thoai/ai" v.v.)
        const href = $el.attr('href') || $el.find('a').first().attr('href') || '';
        if (/dien-thoai-ai$|dien-thoai-gap$|dien-thoai-gaming$|dien-thoai-pin$|dien-thoai-5g$|pho-thong$/.test(href)) {
          return; // skip this element
        }
        // Skip brand/series category pages (vd: /dien-thoai/honor, /dien-thoai/xiaomi-17t)
        // Detail URLs có dạng: /dien-thoai/<brand>-<model>-<sku>, vd: xiaomi-poco-c81-pro
        if (/^https?:\/\/[^/]+\/dien-thoai\/[a-z0-9-]+$/.test(href)) {
          const slug = href.split('/dien-thoai/')[1] || '';
          // Series/brand: ngắn (< 15 chars) hoặc không có dấu - nhiều
          // Detail: có nhiều dấu -, vd: xiaomi-poco-c81-pro (3+ parts)
          const parts = slug.split('-');
          if (parts.length < 3 && slug.length < 18) {
            return; // skip brand/series pages
          }
          // Skip nếu slug là tên brand thuần (honor, samsung, xiaomi...)
          const brandNames = ['honor', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'apple', 'nokia', 'tecno', 'infinix', 'itel', 'benco', 'nubia', 'pho-thong'];
          if (parts.length <= 2 && brandNames.includes(slug.toLowerCase())) {
            return;
          }
        }

        if (!name || name.length < 3) return;

        // ===== Price extraction =====
        // FPT Shop: price nằm trong cardInfo (sibling của <a> NGOÀI, hoặc parent của <a> TRONG)
        // Card structure:
        //   <div class="..."><a class="relative flex...">IMG</a><div class="cardInfo"><a>tên</a><p>giá</p></div></div>
        let searchEl: any = $el;
        if (isFPTSelector && !$cardInfo) {
          // Tìm cardInfo: sibling của <a> NGOÀI, hoặc parent của <a> TRONG
          if (isInsideCardInfo) {
            $cardInfo = $el.parent();
          } else {
            $cardInfo = $el.next('.cardInfo');
            if (!$cardInfo.length) {
              $cardInfo = $el.parent().children('.cardInfo').first();
            }
            if (!$cardInfo.length) {
              $cardInfo = $el.parent().find('.cardInfo').first();
            }
          }
        }
        if ($cardInfo && $cardInfo.length) {
          searchEl = $cardInfo;
        }

        const dataPrice = searchEl.attr('data-price') || searchEl.find('a').first().attr('data-price');
        let price = 0;
        let currency = 'VND';
        if (dataPrice) {
          price = this.parsePriceNumber(dataPrice);
        }
        if (!price) {
          // Ưu tiên: itemprop="price" → class .price → VN price pattern
          // Tránh class chứa "old" hoặc "sale" (giá cũ/giá KM)
          const priceText =
            searchEl.find('[itemprop="price"]').attr('content') ||
            searchEl.find('.price:not([class*="old"]):not([class*="sale"]):not([class*="compare"]):not([class*="through"])').first().text().trim() ||
            searchEl.find('.product-price, .amount, strong.price').first().text().trim();
          const parsed = this.parsePrice(priceText);
          price = parsed.price;
          currency = parsed.currency;
        }

        // FPT Shop / fallback: tìm element có text VN price (xxx.xxx.xxxđ)
        // Lấy GIÁ HIỆN TẠI (current/selling price), bỏ qua old-price/sale-price
        if (!price) {
          const priceEls = searchEl.find('*').filter((_: number, e: any) => {
            const t = $(e).contents().filter((__: number, n: any) => n.type === 'text').text().trim();
            // Pattern: "X.XXX.XXX" hoặc "X.XXX.XXX đ/₫"
            if (!/^\d{1,3}([.,]\d{3})+(\s*[₫đVND])?$/i.test(t)) return false;
            // Bỏ qua class chứa old/sale/compare
            const cls = $(e).attr('class') || '';
            if (/old|sale|compare|through|was|giacu|giam|line-through/i.test(cls)) return false;
            return true;
          });
          if (priceEls.length > 0) {
            const t = priceEls.first().contents().filter((_: number, n: any) => n.type === 'text').text().trim();
            const parsed = this.parsePrice(t);
            if (parsed.price > 0) {
              price = parsed.price;
              currency = parsed.currency;
            }
          }
        }

        // FPT fallback: tìm text có "X.XXX.XXX" mà KHÔNG có class old/sale
        if (!price) {
          // Lấy tất cả text nodes có format VN price, trong cardInfo hoặc parent
          const allText = searchEl.text();
          // Tìm pattern "X.XXX.XXX" với thousands separator (ít nhất 1 dấu chấm)
          // Bỏ qua: "100%", "5%", "0.5mm" - chỉ lấy giá tiền (>100.000 và có 3+ digits groups)
          const priceMatches = allText.match(/(\d{1,3}(?:\.\d{3}){1,})/g);
          if (priceMatches) {
            // Lấy giá NHỎ NHẤT (vì old-price thường cao hơn current price)
            const prices = priceMatches
              .map(m => this.parsePrice(m).price)
              .filter(p => p >= 100000); // Bỏ qua số < 100K (có thể là % nhỏ)
            if (prices.length > 0) {
              price = Math.min(...prices);
              currency = 'VND';
            }
          }
        }

        // ===== Image extraction =====
        const imageUrl =
          $el.attr('data-src') ||
          $el.find('a').first().attr('data-src') ||
          $el.find('[itemprop="image"]').attr('content') ||
          $el.find('img').first().attr('data-src') ||
          $el.find('img').first().attr('src') ||
          '';

        const url =
          $el.attr('href') ||
          $el.find('a').first().attr('href') ||
          baseUrl;

        // Skip nav/category links
        if (url && /dien-thoai-ai$|dien-thoai-gap$|dien-thoai-gaming$|dien-thoai-pin$|dien-thoai-5g$|pho-thong$/.test(url)) {
          return;
        }
        // Skip brand/series category pages
        if (/^https?:\/\/[^/]+\/dien-thoai\/[a-z0-9-]+$/.test(url)) {
          const slug = url.split('/dien-thoai/')[1] || '';
          const parts = slug.split('-');
          if (parts.length < 3 && slug.length < 18) return;
          const brandNames = ['honor', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'apple', 'nokia', 'tecno', 'infinix', 'itel', 'benco', 'nubia'];
          if (parts.length <= 2 && brandNames.includes(slug.toLowerCase())) return;
        }

        // ===== Brand extraction =====
        // FPT: brand được detect từ URL slug hoặc name (để lại rỗng)
        const brand =
          $el.find('a').first().attr('data-brand') ||
          $el.find('[itemprop="brand"]').attr('content') ||
          $el.find('.brand').first().text().trim() ||
          undefined;

        const productId =
          $el.attr('data-id') ||
          $el.find('a').first().attr('data-id') ||
          $el.attr('data-product-id') ||
          this.slugify(name);

        products.push({
          id: productId,
          name: name.slice(0, 200),
          description: $el.find('.product-desc, .description, p, .item-compare').first().text().trim().slice(0, 500),
          price,
          currency,
          imageUrl: this.absolutize(imageUrl, baseUrl),
          images: [this.absolutize(imageUrl, baseUrl)].filter(Boolean) as string[],
          category: $el.find('a').first().attr('data-cate') || '',
          brand,
          specifications: {},
          inStock: !$el.find('.out-of-stock, .sold-out').length,
          url: this.absolutize(url, baseUrl),
          extractionMethod: 'html-selectors',
        });
      });

      // Dedupe theo URL trong cùng 1 selector (FPT có 2 <a> cùng href - 1 ngoài, 1 trong cardInfo)
      const seenUrls = new Set<string>();
      const deduped: ExtractedProduct[] = [];
      for (const p of products) {
        if (seenUrls.has(p.url)) continue;
        seenUrls.add(p.url);
        deduped.push(p);
      }
      products.length = 0;
      products.push(...deduped);

      if (products.length > 0) break; // dùng selector đầu tiên cho kết quả
    }

    return products;
  }

  // ============================================================
  // LAYER 3: GEMINI AI FALLBACK
  // ============================================================
  private async extractWithGemini(
    html: string,
    baseUrl: string,
    log: ExtractorLogger
  ): Promise<ExtractedProduct[]> {
    if (!this.model) return [];

    const $ = cheerio.load(html);

    // Strip noise trước khi gửi cho AI
    $('script, style, noscript, iframe, svg, header, footer, nav, aside').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 30000);
    const imageUrls = $('img')
      .map((_, el) => $(el).attr('src') || $(el).attr('data-src'))
      .get()
      .filter(Boolean)
      .filter((u: string) => !u.startsWith('data:'))
      .slice(0, 30);

    const prompt = `Bạn là AI chuyên trích xuất danh sách sản phẩm từ nội dung trang web thương mại điện tử.

NHIỆM VỤ: Phân tích nội dung HTML từ URL "${baseUrl}" và trích xuất TẤT CẢ sản phẩm có trong trang.

YÊU CẦU BẮT BUỘC:
- Lấy CHÍNH XÁC tên sản phẩm
- Lấy CHÍNH XÁC giá (chuyển về dạng số, ví dụ "1.290.000 VND" → 1290000)
- Detect currency (VND, USD, EUR...) dựa trên ký hiệu tiền tệ
- Mô tả ngắn gọn (< 500 ký tự)
- Nếu không rõ giá → price = 0, inStock = false
- Nếu tên sản phẩm chứa thông số kỹ thuật → đưa vào specifications

ĐỊNH DẠNG JSON (chỉ trả JSON, không text):
{
  "products": [
    {
      "id": "SKU hoặc slug từ tên",
      "name": "Tên sản phẩm",
      "description": "Mô tả",
      "price": 1290000,
      "currency": "VND",
      "originalPrice": null,
      "imageUrl": "URL ảnh đầu tiên từ danh sách (nếu khớp với sản phẩm)",
      "category": "Danh mục",
      "brand": "Thương hiệu hoặc null",
      "inStock": true,
      "specifications": {"Màn hình": "6.1 inch"}
    }
  ]
}

NỘI DUNG TRANG:
${bodyText}

DANH SÁCH ẢNH KHẢ DỤNG:
${imageUrls.join('\n')}

QUAN TRỌNG: Chỉ trả về JSON hợp lệ. Không có text giải thích.`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const json = JSON.parse(text);

      return (json.products || []).map((p: any) => ({
        id: p.id || this.slugify(p.name),
        name: p.name || '',
        description: p.description || '',
        price: Number(p.price) || 0,
        currency: p.currency || 'USD',
        originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
        imageUrl: p.imageUrl || '',
        images: p.imageUrl ? [p.imageUrl] : [],
        category: p.category || '',
        brand: p.brand || undefined,
        specifications: p.specifications || {},
        inStock: Boolean(p.inStock),
        url: baseUrl,
        extractionMethod: 'gemini-ai' as const,
      }));
    } catch (err: any) {
      log.error?.('[ProductExtractor] Gemini extraction failed:', err.message);
      return [];
    }
  }

  // ============================================================
  // MADA PORTAL ROUTE (at.mada.org.qa)
  // ============================================================

  /**
   * Map 1 ProductDetail (MADA) → ExtractedProduct để tận dụng flow lưu DB / sync RAG.
   * MADA không có giá → price = 0, currency = 'N/A' (filter chỉ-lưu-SP-có-giá sẽ tự skip nếu cần).
   */
  private madaDetailToExtractedProduct(detail: ProductDetail): ExtractedProduct {
    const madaCategory = extractCategoryFromUrl(detail.source);
    let catConfig = madaCategory ? MADA_CATEGORIES.find((c) => c.slug === madaCategory) : undefined;

    // Fallback: detect category từ detail.categories (WordPress taxonomy slugs)
    // Nếu admin paste URL sản phẩm (không chứa category slug), ta vẫn có thể
    // gán đúng category từ breadcrumb HTML.
    if (!catConfig && detail.categories?.length) {
      // detail.categories chứa WordPress taxonomy slugs như 'sensory-hearing'
      const matched = detail.categories.find((c) =>
        MADA_CATEGORIES.some((m) => m.slug === c)
      );
      if (matched) {
        catConfig = MADA_CATEGORIES.find((c) => c.slug === matched);
      }
    }

    const category = catConfig?.slug || madaCategory || 'general';
    const brand = catConfig?.botId || undefined;

    // Specifications từ standards + attachments
    const specs: Record<string, string> = {};
    detail.isoCodes.forEach((code, i) => {
      specs[`standard_${i + 1}`] = code;
    });
    if (detail.attachments.length) {
      specs.documents = detail.attachments.map((a) => a.label).join(', ');
    }

    return {
      id: detail.slug || `mada-${detail.postId}`,
      name: detail.title,
      description: (detail.description || '').slice(0, 1000),
      price: 0,
      currency: 'N/A',
      imageUrl: detail.thumbnailUrl,
      images: detail.galleryImages?.length ? detail.galleryImages : (detail.thumbnailUrl ? [detail.thumbnailUrl] : []),
      category,
      brand,
      specifications: specs,
      inStock: true,
      url: detail.source,
      extractionMethod: 'mada-scraper',
      madaMetadata: {
        postId: detail.postId,
        slug: detail.slug,
        isoCodes: detail.isoCodes,
        tags: detail.tags,
        attachments: detail.attachments,
        galleryImages: detail.galleryImages,
        videoLinks: detail.videoLinks,
        content: detail.content,
        categories: detail.categories,
        madaCategory: catConfig?.slug || madaCategory,
        botId: catConfig?.botId || null,
        language: detail.language,
      },
    };
  }

  /**
   * MADA-specific extractor:
   *  - Single product URL  → scrape detail page đó
   *  - Category URL        → list page → scrape N details
   *  - Root / misc URL     → fallback: list 1 page đầu của sensory-hearing
   */
  private async extractFromMada(
    url: string,
    log: ExtractorLogger,
    options: ExtractOptions,
    startTime: number
  ): Promise<ExtractionResult> {
    const mode = options.mode || 'preview';
    const language = options.language || 'en';
    const classify = classifyMadaUrl(url);

    try {
      let products: ExtractedProduct[] = [];

      if (classify === 'product') {
        // ===== Single product URL → fetch detail trực tiếp =====
        log.info?.(`[ProductExtractor/MADA] Scraping single product: ${url}`);
        const slug = url.split('/').filter(Boolean).pop() || 'unknown';
        const postIdMatch = url.match(/post[-_]?(\d+)/i);
        const item: ProductListItem = {
          postId: postIdMatch?.[1] || `unknown-${slug}`,
          slug,
          title: slug.replace(/-/g, ' '),
          detailUrl: url,
          thumbnailUrl: '',
          categories: extractCategoryFromUrl(url) ? [extractCategoryFromUrl(url)!] : [],
          language,
        };
        const detail = await scrapeProductDetail(item);
        products = [this.madaDetailToExtractedProduct(detail)];
      } else if (classify === 'category') {
        // ===== Category URL → list + scrape N details =====
        // Ưu tiên lấy category slug từ URL (EN hoặc AR)
        let slug = extractCategoryFromUrl(url);
        let catConfig = slug ? MADA_CATEGORIES.find((c) => c.slug === slug) : undefined;

        // Nếu URL là /ar/... thì tự detect ngôn ngữ
        let detectedLang: 'en' | 'ar' = language;
        try {
          const path = new URL(url).pathname;
          if (path.startsWith('/ar/')) detectedLang = 'ar';
        } catch { /* ignore */ }

        if (!catConfig) {
          // Trường hợp portal root: dùng sensory-hearing mặc định
          slug = 'sensory-hearing';
          catConfig = MADA_CATEGORIES.find((c) => c.slug === slug);
          log.warn?.(`[ProductExtractor/MADA] Cannot match category from URL, falling back to ${slug}`);
        }

        const maxPages = mode === 'save' ? 3 : 1;
        const listLimit = mode === 'save' ? 100 : 20;

        if (!slug) {
          log.warn?.('[ProductExtractor/MADA] No valid category slug, returning empty result');
          return {
            success: true,
            url,
            totalFound: 0,
            products: [],
            method: 'mada-scraper',
            fetchMethod: 'fetch',
            durationMs: Date.now() - startTime,
          };
        }

        log.info?.(`[ProductExtractor/MADA] Scraping category "${slug}" (lang=${detectedLang}, mode=${mode}, maxPages=${maxPages})`);
        const list = await scrapeCategoryListing(slug, maxPages, detectedLang);

        for (let i = 0; i < list.length && products.length < listLimit; i++) {
          const item = list[i];
          try {
            log.info?.(`[ProductExtractor/MADA] [${i + 1}/${list.length}] ${item.title}`);
            const detail = await scrapeProductDetail(item);
            products.push(this.madaDetailToExtractedProduct(detail));
            // polite delay
            await new Promise((r) => setTimeout(r, 500));
          } catch (err: any) {
            log.warn?.(`[ProductExtractor/MADA] Skip "${item.title}": ${err.message}`);
          }
        }
      } else {
        // Unknown URL type → fallback sensory-hearing 1 page
        log.warn?.(`[ProductExtractor/MADA] Unknown URL type, falling back to sensory-hearing listing`);
        const list = await scrapeCategoryListing('sensory-hearing', 1, language);
        for (let i = 0; i < Math.min(list.length, mode === 'save' ? 20 : 5); i++) {
          try {
            const detail = await scrapeProductDetail(list[i]);
            products.push(this.madaDetailToExtractedProduct(detail));
            await new Promise((r) => setTimeout(r, 500));
          } catch (err: any) {
            log.warn?.(`[ProductExtractor/MADA] Skip: ${err.message}`);
          }
        }
      }

      log.info?.(`[ProductExtractor/MADA] ✅ Got ${products.length} products from ${url}`);

      return {
        success: true,
        url,
        totalFound: products.length,
        products,
        method: 'mada-scraper',
        fetchMethod: 'fetch',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      log.error?.('[ProductExtractor/MADA] Error:', err);
      return {
        success: false,
        url,
        totalFound: 0,
        products: [],
        method: 'mada-scraper',
        fetchMethod: 'fetch',
        durationMs: Date.now() - startTime,
        error: err.message || String(err),
      };
    }
  }

  // ============================================================
  // UTILS
  // ============================================================
  private parsePrice(input: string): { price: number; currency: string } {
    if (!input) return { price: 0, currency: 'VND' };
    const currency = input.includes('₫') || input.includes('VND') || input.includes('đồng') || input.includes(' đ') || /[\s]đ$/.test(input)
      ? 'VND'
      : input.includes('$') || input.includes('USD')
        ? 'USD'
        : input.includes('€') || input.includes('EUR')
          ? 'EUR'
          : 'VND'; // Default VND cho VN sites
    const cleaned = this.normalizePriceString(input);
    const num = parseFloat(cleaned);
    return { price: isNaN(num) ? 0 : Math.round(num), currency };
  }

  private parsePriceNumber(input: any): number {
    if (typeof input === 'number') return Math.round(input);
    if (typeof input !== 'string') return 0;
    const cleaned = this.normalizePriceString(input);
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
  }

  /**
   * Chuẩn hóa string giá thông minh (handle VN/EU/US formats):
   * - "19.890.000" (VN thousand sep) → "19890000"
   * - "23,990,000.0" (EN) → "23990000"
   * - "1.234.567,89" (EU) → "1234567.89"
   * - "23.990.000đ" → "23990000"
   * - "19890000.0" (data-attr decimal) → "19890000" (treat trailing .0 as thousand)
   */
  private normalizePriceString(input: string): string {
    let s = input.replace(/[^\d.,]/g, '');
    if (!s) return '';

    const dots = (s.match(/\./g) || []).length;
    const commas = (s.match(/,/g) || []).length;

    if (dots === 0 && commas === 0) return s;

    if (dots > 0 && commas === 0) {
      // Only dots: "19890000.0", "19.890.000", "198.5"
      if (dots === 1) {
        const [intPart, decPart] = s.split('.');
        // "19890000.0" - int part has > 3 digits, dec has 1 → likely just .0 suffix from JSON
        if (decPart.length <= 2 && intPart.length >= 4) {
          // Strip the trailing decimal
          return intPart;
        }
        // "198.5" - decimal
        return s;
      }
      // Multiple dots: VN thousand sep
      return s.replace(/\./g, '');
    }

    if (commas > 0 && dots === 0) {
      // Only commas: "1,234,567" or "198,5"
      if (commas === 1) {
        const [intPart, decPart] = s.split(',');
        if (intPart.length >= 4 && decPart.length === 3) {
          // "1,234" - thousand sep
          return s.replace(/,/g, '');
        }
        // "198,5" - EU decimal
        return intPart + '.' + decPart;
      }
      // Multiple commas: thousand sep
      return s.replace(/,/g, '');
    }

    // Both dots and commas
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      // US: "1,234,567.89"
      return s.replace(/,/g, '');
    } else {
      // EU: "1.234.567,89"
      return s.replace(/\./g, '').replace(',', '.');
    }
  }

  private absolutize(url: string, baseUrl: string): string {
    if (!url) return '';
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private productKey(p: ExtractedProduct): string {
    return `${this.slugify(p.name)}|${p.url}`;
  }

  private deduplicate(products: ExtractedProduct[]): ExtractedProduct[] {
    const seen = new Map<string, ExtractedProduct>();
    for (const p of products) {
      const key = this.slugify(p.name);
      if (!seen.has(key)) seen.set(key, p);
    }
    return Array.from(seen.values());
  }
}

export const productExtractor = new ProductExtractorService();