/**
 * Scrape Open Graph / meta tags from any URL to extract product metadata.
 * Used for the "Import from URL" feature in Admin Products.
 *
 * Extracts:
 * - og:title / <title>
 * - og:description / meta description
 * - og:image
 * - og:site_name
 * - <h1> as fallback title
 */

export interface ProductMetadata {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

function extractMetaContent(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return unescapeHtml(match[1].trim());
    }
  }
  return '';
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

function extractFirstHeading(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (match && match[1]) {
    return unescapeHtml(match[1].replace(/<[^>]+>/g, ' ')).trim();
  }
  return '';
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function scrapeProductMetadata(url: string): Promise<ProductMetadata> {
  const defaults: ProductMetadata = {
    title: '',
    description: '',
    image: '',
    siteName: '',
    url,
  };

  try {
    // Validate URL
    new URL(url);
  } catch {
    return { ...defaults, title: 'Invalid URL' };
  }

  let html = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`scrapeProductMetadata: ${url} returned ${response.status}`);
      return { ...defaults, title: `Page returned ${response.status}` };
    }

    // Only read first 500KB to avoid downloading large pages
    const raw = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    html = decoder.decode(raw.slice(0, 512 * 1024));

  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ...defaults, title: 'Request timed out' };
    }
    console.warn(`scrapeProductMetadata: Failed to fetch ${url}: ${err.message}`);
    return { ...defaults, title: `Fetch failed: ${err.message}` };
  }

  // Extract title
  const title = extractMetaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]) || extractFirstHeading(html);

  // Extract description
  const description = extractMetaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]);

  // Extract image
  const image = extractMetaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);

  // Extract site name
  const siteName = extractMetaContent(html, [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
  ]) || extractHostname(url);

  return {
    title: title || '',
    description: description || '',
    image: image || '',
    siteName: siteName || '',
    url,
  };
}
