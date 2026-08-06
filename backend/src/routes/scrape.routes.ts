// Scrape Routes - URL scraping and content extraction API

import { Router, Request, Response, NextFunction } from 'express';
import { errors } from '../middleware/error-handler.js';
import { createScrapeRateLimiter } from '../middleware/rate-limiter.js';

export const scrapeRouter = Router();

// Rate limiter middleware for scrape endpoints
const scrapeRateLimiter = createScrapeRateLimiter();

// Scrape content from URL
scrapeRouter.get('/', scrapeRateLimiter.middleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      throw errors.validationError('URL is required');
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw errors.validationError('Invalid URL format');
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw errors.validationError('Only HTTP and HTTPS URLs are allowed');
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI/1.0; +https://mada.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw errors.badRequest(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Only process HTML content
      if (!contentType.includes('text/html')) {
        // Return as raw text for other content types
        const text = await response.text();
        res.status(200).json({
          success: true,
          data: {
            title: parsedUrl.hostname,
            content: text.slice(0, 10000), // Limit content size
            url: url,
            type: 'raw',
          },
        });
        return;
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

      // Extract main content using basic HTML parsing
      let content = extractMainContent(html);

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

      // Combine meta description with content if available
      if (metaDescription && !content.includes(metaDescription)) {
        content = metaDescription + '\n\n' + content;
      }

      res.status(200).json({
        success: true,
        data: {
          title: title,
          content: content,
          url: url,
          type: 'html',
        },
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw errors.badRequest('Request timeout - the website took too long to respond');
      }

      throw fetchError;
    }
  } catch (error) {
    next(error);
  }
});

// Analyze content endpoint - AI analyzes the scraped content
scrapeRouter.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, title, url } = req.body;

    if (!content || typeof content !== 'string') {
      throw errors.validationError('Content is required');
    }

    // This would integrate with the AI agent to analyze content
    // For now, return a basic analysis structure
    const analysis = {
      summary: generateSummary(content),
      keywords: extractKeywords(content),
      suggestedCategories: suggestCategories(content),
      entities: extractEntities(content),
    };

    res.status(200).json({
      success: true,
      data: {
        title: title || 'Untitled',
        url: url || '',
        analysis: analysis,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to extract main content from HTML
function extractMainContent(html: string): string {
  // Remove script tags
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove style tags
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer elements
  content = content.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Try to find main content
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    // Try article tag
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
  }

  // Replace divs and spans with newlines
  content = content.replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  content = decodeHTMLEntities(content);

  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim();

  // Limit content length
  return content.slice(0, 15000);
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

// Generate a basic summary
function generateSummary(content: string): string {
  // Take first few sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const summary = sentences.slice(0, 3).join('. ').trim();

  if (summary.length > 300) {
    return summary.slice(0, 300) + '...';
  }

  return summary || content.slice(0, 200) + '...';
}

// Extract keywords from content
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
    'now', 'here', 'there', 'then', 'once', 'và', 'của', 'là', 'có', 'được',
    'trong', 'cho', 'với', 'để', 'từ', 'này', 'khi', 'như', 'hoặc', 'về',
  ]);

  const words = content.toLowerCase()
    .replace(/[^a-zA-Z\sÀ-ỹ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Suggest AT categories based on content
function suggestCategories(content: string): string[] {
  const categoryKeywords: Record<string, string[]> = {
    vision: [
      'blind', 'visual', 'vision', 'screen reader', 'braille', 'magnifier',
      'low vision', 'eye', 'sight', 'display', 'reading', 'đọc', 'mắt', 'thị giác',
      'khiếm thị', 'hỗ trợ thị giác', 'orcam', 'jaws', 'nvda', 'zoomtext',
    ],
    hearing: [
      'deaf', 'hearing', 'audio', 'sound', 'hearing aid', 'cochlear',
      'caption', 'subtitles', 'amplify', '耳', ' слух', ' слуховой',
      'tai', 'điếc', 'thính giác', 'trợ thính', 'máy trợ thính',
    ],
    mobility: [
      'wheelchair', 'mobility', 'motor', 'paralysis', 'physical', 'movement',
      'walking', 'standing', 'accessibility', 'access', ' xe lăn', 'vận động',
      'di chuyển', 'leo cầu thang', 'cẩu thang', 'nẹp', 'prosthetic',
    ],
    communication: [
      'speech', 'voice', 'communication', 'aac', 'talk', 'speak', 'language',
      'sign language', 'typing', 'writing', 'giao tiếp', 'nói', 'ngôn ngữ',
      'ký hiệu', 'tổng hợp giọng nói', 'text-to-speech', 'speech-to-text',
    ],
    cognition: [
      'cognitive', 'memory', 'learning', 'adhd', 'autism', 'dyslexia',
      'reading difficulty', 'attention', 'concentration', 'nhận thức', 'trí nhớ',
      'học tập', 'tự kỷ', 'dyslexia', 'alzheimer', 'dementia',
    ],
    daily_living: [
      'daily living', 'eating', 'dressing', 'bathing', 'kitchen', 'bathroom',
      'adaptive', 'assistive', 'self-care', 'sinh hoạt', 'ăn uống', 'nhà bếp',
      'nhà tắm', 'dụng cụ', 'hỗ trợ', 'grab bar', 'medication', 'thuốc',
    ],
    education: [
      'education', 'learning', 'school', 'student', 'training', 'teaching',
      'academic', 'study', 'reading', 'writing', 'học', 'giáo dục', 'trường',
      'đào tạo', 'nghiên cứu', 'software', 'technology',
    ],
  };

  const contentLower = content.toLowerCase();
  const suggestions: { category: string; score: number }[] = [];

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const matches = keywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
    if (matches > 0) {
      suggestions.push({ category, score: matches });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.category);
}

// Extract basic entities (this is simplified)
function extractEntities(content: string): {
  organizations: string[];
  products: string[];
  technologies: string[];
} {
  // Look for capitalized words that might be organizations or products
  const properNouns = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];

  const organizations: string[] = [];
  const products: string[] = [];
  const technologies: string[] = [];

  const techKeywords = ['software', 'app', 'application', 'device', 'system', 'platform', 'software'];
  const orgKeywords = ['company', 'inc', 'corp', 'ltd', 'llc', 'association', 'foundation', 'center'];

  properNouns.forEach(noun => {
    const lowerNoun = noun.toLowerCase();
    if (techKeywords.some(kw => content.toLowerCase().includes(`${noun} ${kw}`))) {
      technologies.push(noun);
    } else if (orgKeywords.some(kw => content.toLowerCase().includes(`${lowerNoun} ${kw}`))) {
      organizations.push(noun);
    }
  });

  return {
    organizations: [...new Set(organizations)].slice(0, 5),
    products: [...new Set(products)].slice(0, 5),
    technologies: [...new Set(technologies)].slice(0, 5),
  };
}
