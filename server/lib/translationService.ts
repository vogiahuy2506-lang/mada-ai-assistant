/**
 * Translation Service - Auto-translate KB content to all 4 languages
 *
 * Supported languages: Vietnamese (vi), English (en), Arabic (ar), French (fr)
 * Uses Gemini API for high-quality translations
 *
 * Usage:
 *   import { translateContent, translateProduct } from './translationService';
 *   const translations = await translateContent(text, 'vi');
 *   // Returns { en: '...', ar: '...', fr: '...' }
 */

// ============ PROXY BYPASS ============

// Retry helper for 429 Too Many Requests
async function fetchWithRetry(
  fn: () => Promise<Response>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 1000, maxDelayMs = 16000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fn();

    if (response.status === 429) {
      if (attempt === retries) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API 429 Too Many Requests (after ${retries} retries). ${body}`);
      }
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      console.warn(`⚠️ [translation 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${retryDelay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }

    return response;
  }
  throw new Error('fetchWithRetry: unreachable');
}

async function callGeminiNoProxy(apiKey: string, modelName: string, prompt: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Clear proxy env vars for this call
  const savedEnv: Record<string, string | undefined> = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    http_proxy: process.env.http_proxy,
    https_proxy: process.env.https_proxy,
  };
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;

  try {
    const response = await fetchWithRetry(
      () => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }),
      { retries: 3, baseDelayMs: 2000, maxDelayMs: 16000 }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    return response.json();
  } finally {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) process.env[key] = val;
    }
  }
}

// Supported languages
export type SupportedLanguage = 'vi' | 'en' | 'ar' | 'fr';

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ar: 'Arabic',
  fr: 'French',
};

export const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

interface TranslationResult {
  en: string;
  ar: string;
  fr: string;
}

interface ProductTranslation {
  title_en: string;
  title_ar: string;
  title_fr: string;
  description_en: string;
  description_ar: string;
  description_fr: string;
  content_en: string;
  content_ar: string;
  content_fr: string;
}

// Cache for rate limiting (avoid re-translating the same text)
const translationCache = new Map<string, TranslationResult>();
// Note: CACHE_TTL_MS intentionally unused - cache entries are invalidated on retrieval
void 0; // Placeholder for future cache TTL implementation

function getCacheKey(text: string, sourceLang: string): string {
  return `${sourceLang}:${text.slice(0, 100)}`;
}

function getCached(text: string, sourceLang: string): TranslationResult | null {
  const key = getCacheKey(text, sourceLang);
  const cached = translationCache.get(key);
  if (cached) {
    // Invalidate old cache
    translationCache.delete(key);
    return cached;
  }
  return null;
}

function setCache(text: string, sourceLang: string, result: TranslationResult) {
  const key = getCacheKey(text, sourceLang);
  translationCache.set(key, result);
  // Simple LRU: clear oldest if too many
  if (translationCache.size > 200) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
}

/**
 * Translate content to all OTHER languages (not the source language)
 * Source language is auto-detected from the input
 */
export async function translateContent(
  text: string,
  sourceLang: SupportedLanguage = 'vi'
): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    return { en: '', ar: '', fr: '' };
  }

  // Check cache first
  const cached = getCached(text, sourceLang);
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not set — skipping translation');
    return { en: '', ar: '', fr: '' };
  }

  // Target languages (skip source language)
  const targets: SupportedLanguage[] = ['en', 'ar', 'fr'].filter(l => l !== sourceLang) as SupportedLanguage[];

  // Build prompt for simultaneous translation
  const targetNames = targets.map(l => LANGUAGE_NAMES[l]).join(', ');
  const truncated = text.length > 4000 ? text.slice(0, 4000) + '...' : text;

  const prompt = `You are a professional translator. Translate the following text from ${LANGUAGE_NAMES[sourceLang]} to ${targetNames}.

IMPORTANT RULES:
- Translate ACCURATELY preserving the original meaning
- For technical AT (Assistive Technology) terms, keep proper terminology
- Keep HTML tags, URLs, and special formatting intact
- Return ONLY a valid JSON object, no markdown, no explanation
- Arabic text must be in proper Arabic script (RTL)
- JSON format: {"en":"english translation","ar":"arabic translation","fr":"french translation"}

TEXT TO TRANSLATE:
${truncated}`;

  try {
    // Call Gemini directly (bypasses proxy)
    const result = await callGeminiNoProxy(apiKey, 'gemini-2.5-flash', prompt);
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter((p: any) => p.text);
    const translatedText = textParts.map((p: any) => p.text).join('\n').trim();

    // Parse JSON response
    let parsed: TranslationResult;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = translatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(translatedText);
      }
    } catch {
      console.warn('⚠️ Failed to parse translation response, trying one by one');
      // Fallback: translate one by one using direct API call
      parsed = await translateOneByOneDirect(text, sourceLang, targets);
    }

    // Validate and fill missing
    const finalResult: TranslationResult = {
      en: parsed?.en || '',
      ar: parsed?.ar || '',
      fr: parsed?.fr || '',
    };

    setCache(text, sourceLang, finalResult);
    return finalResult;

  } catch (err) {
    console.error('❌ Translation error:', (err as Error).message);
    // Fallback: return empty (don't block the main flow)
    return { en: '', ar: '', fr: '' };
  }
}

/**
 * Fallback: translate one language at a time (using direct API)
 */
async function translateOneByOneDirect(
  text: string,
  sourceLang: SupportedLanguage,
  targets: SupportedLanguage[]
): Promise<TranslationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { en: '', ar: '', fr: '' };

  const result: TranslationResult = { en: '', ar: '', fr: '' };
  const truncated = text.length > 2000 ? text.slice(0, 2000) : text;

  for (const target of targets) {
    try {
      const prompt = `Translate this text from ${LANGUAGE_NAMES[sourceLang]} to ${LANGUAGE_NAMES[target]}.
Keep technical terms, HTML tags, and URLs intact. Return ONLY the translation, no quotes.

TEXT: ${truncated}`;

      const res = await callGeminiNoProxy(apiKey, 'gemini-2.5-flash', prompt);
      const parts = res?.candidates?.[0]?.content?.parts || [];
      const translated = parts.map((p: any) => p.text).join('').trim();
      
      if (target === 'en') result.en = translated;
      if (target === 'ar') result.ar = translated;
      if (target === 'fr') result.fr = translated;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn(`⚠️ Failed to translate to ${target}:`, (e as Error).message);
    }
  }

  return result;
}

/**
 * Translate a full product (title + description + content)
 */
export async function translateProduct(input: {
  title: string;
  description?: string;
  content?: string;
  sourceLang?: SupportedLanguage;
}): Promise<ProductTranslation> {
  // Auto-detect source language
  const sourceLang = input.sourceLang || detectLanguage(input.title + ' ' + (input.description || ''));

  // Combine text for better context
  const allText = [
    input.title,
    input.description || '',
    input.content ? input.content.slice(0, 2000) : '',
  ].filter(Boolean).join('\n\n');

  const result = await translateContent(allText, sourceLang);

  return {
    title_en: result.en.split('\n')[0] || '', // First line = title
    title_ar: result.ar.split('\n')[0] || '',
    title_fr: result.fr.split('\n')[0] || '',
    description_en: extractDescription(result.en, input.description || ''),
    description_ar: extractDescription(result.ar, input.description || ''),
    description_fr: extractDescription(result.fr, input.description || ''),
    content_en: result.en,
    content_ar: result.ar,
    content_fr: result.fr,
  };
}

/**
 * Extract description from translated text (after title line)
 */
function extractDescription(translatedText: string, _originalDescription: string): string {
  const lines = translatedText.split('\n').filter(l => l.trim());
  // Skip first line (title), return next few lines
  const descLines = lines.slice(1, 4).join(' ').trim();
  return descLines || translatedText.slice(0, 300);
}

/**
 * Detect language of text
 */
export function detectLanguage(text: string): SupportedLanguage {
  const vietnameseDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạằẳẵặắấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/;
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
  const frenchPattern = /\b(le|la|les|de|du|des|un|une|et|en|que|qui|est|sont|pour|avec|dans|sur|ce|cette|ces|au|aux)\b/i;

  if (arabicPattern.test(text)) return 'ar';
  if (vietnameseDiacritics.test(text)) return 'vi';
  if (frenchPattern.test(text) && /[éèêëàâäùûüôöîïç]/i.test(text)) return 'fr';
  return 'en'; // Default to English
}

/**
 * Get localized content from a product/item based on user's language
 */
export function getLocalizedContent<T extends {
  title?: string;
  title_en?: string;
  title_ar?: string;
  title_fr?: string;
  description?: string;
  description_en?: string;
  description_ar?: string;
  description_fr?: string;
  content?: string;
  content_en?: string;
  content_ar?: string;
  content_fr?: string;
}>(
  item: T,
  language: SupportedLanguage
): { title: string; description: string; content: string } {
  if (language === 'vi' || !language) {
    return {
      title: item.title || '',
      description: item.description || '',
      content: item.content || '',
    };
  }
  if (language === 'en') {
    return {
      title: item.title_en || item.title || '',
      description: item.description_en || item.description || '',
      content: item.content_en || item.content || '',
    };
  }
  if (language === 'ar') {
    return {
      title: item.title_ar || item.title || '',
      description: item.description_ar || item.description || '',
      content: item.content_ar || item.content || '',
    };
  }
  if (language === 'fr') {
    return {
      title: item.title_fr || item.title || '',
      description: item.description_fr || item.description || '',
      content: item.content_fr || item.content || '',
    };
  }
  // Fallback
  return {
    title: item.title || '',
    description: item.description || '',
    content: item.content || '',
  };
}

/**
 * Batch translate multiple items (with rate limiting)
 */
export async function translateBatch<T extends { id: string; title: string; description?: string }>(
  items: T[],
  sourceLang: SupportedLanguage = 'vi'
): Promise<Map<string, TranslationResult>> {
  const results = new Map<string, TranslationResult>();

  for (const item of items) {
    try {
      const result = await translateContent(
        `${item.title}\n\n${item.description || ''}`,
        sourceLang
      );
      results.set(item.id, result);
    } catch (e) {
      console.warn(`⚠️ Failed to translate item ${item.id}:`, (e as Error).message);
    }

    // Rate limit: wait between translations
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}
