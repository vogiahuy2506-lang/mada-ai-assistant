// Content Detector - AI-powered content analysis and classification

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============ SCHEMA DEFINITIONS ============

/**
 * Structured output schema for CONTENT DETECTION (Task 5)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CONTENT_DETECTION_SCHEMA: any = {
  name: 'content_detection',
  description: 'Phân tích và phân loại nội dung AT',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['product', 'regulation', 'guide', 'article', 'standard', 'unknown'],
        description: 'Loại nội dung'
      },
      confidence: {
        type: 'number',
        description: 'Độ tin cậy từ 0.0 đến 1.0'
      },
      isoCodes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Mã ISO 9999 được đề cập'
      },
      wcagLevel: {
        type: 'string',
        enum: ['A', 'AA', 'AAA'],
        description: 'Mức độ WCAG'
      },
      whoGateCategory: {
        type: 'string',
        description: 'Danh mục WHO GATE'
      },
      summary: {
        type: 'string',
        description: 'Tóm tắt nội dung'
      }
    },
    required: ['type', 'confidence']
  }
};

export interface ContentType {
  type: 'product' | 'regulation' | 'guide' | 'article' | 'standard' | 'unknown';
  confidence: number;
}

export interface DetectedMetadata {
  title?: string;
  isoCodes: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  whoGateCategory?: string;
  language?: string;
  summary?: string;
}

export interface DetectionResult {
  contentType: ContentType;
  metadata: DetectedMetadata;
  suggestedCategory?: string;
  rawAnalysis?: string;
}

const SYSTEM_PROMPT = `Bạn là chuyên gia về Công nghệ Hỗ trợ (Assistive Technology - AT) và các tiêu chuẩn quốc tế liên quan.

Nhiệm vụ của bạn là phân tích nội dung và trả về kết quả JSON với các trường:
- type: "product" | "regulation" | "guide" | "article" | "standard" | "unknown"
- confidence: số từ 0-1
- isoCodes: mảng các mã ISO tìm được (ví dụ: ["ISO 9999:2022", "ISO 7176"])
- wcagLevel: "A" | "AA" | "AAA" | null
- whoGateCategory: danh mục WHO GATE (vision, hearing, mobility, communication, cognition, daily_living, education)
- summary: tóm tắt 1-2 câu về nội dung

Chỉ trả về JSON, không có text khác.`;

const USER_PROMPT = `Phân tích nội dung sau và trả về JSON:
---
{content}
---`;

class ContentDetector {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  async initialize(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ GEMINI_API_KEY not set, content detection will use fallback');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    console.log('✅ Content Detector initialized with Gemini');
  }

  async detect(content: string, title?: string): Promise<DetectionResult> {
    // Fallback detection if Gemini not available
    if (!this.model) {
      return this.fallbackDetection(content, title);
    }

    try {
      const prompt = SYSTEM_PROMPT + '\n\n' + USER_PROMPT.replace('{content}', content.slice(0, 2000));

      // Try structured output first
      let parsed: any = null;

      try {
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
          tools: [{
            functionDeclarations: [CONTENT_DETECTION_SCHEMA]
          }]
        });

        const response = result.response;

        if (response.functionCalls?.length > 0) {
          const fnCall = response.functionCalls()[0];
          if (fnCall.name === 'content_detection') {
            parsed = fnCall.args;
          }
        }
      } catch (schemaError: any) {
        console.warn('⚠️ Content detector schema failed, using text fallback:', schemaError.message?.slice(0, 80));
      }

      // Fallback: parse text if schema didn't work
      if (!parsed) {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { type: 'unknown', confidence: 0.5 };
        }
      }

      return {
        contentType: {
          type: parsed.type || 'unknown',
          confidence: parsed.confidence || 0.5,
        },
        metadata: {
          title,
          isoCodes: parsed.isoCodes || [],
          wcagLevel: parsed.wcagLevel,
          whoGateCategory: parsed.whoGateCategory,
          summary: parsed.summary,
        },
        suggestedCategory: parsed.whoGateCategory,
        rawAnalysis: JSON.stringify(parsed),
      };
    } catch (error) {
      console.error('Content detection error:', error);
    }

    return this.fallbackDetection(content, title);
  }

  private fallbackDetection(content: string, _title?: string): DetectionResult {
    const contentLower = content.toLowerCase();

    // Detect content type
    let type: DetectionResult['contentType']['type'] = 'unknown';
    let confidence = 0.5;

    if (contentLower.includes('mua') || contentLower.includes('giá') || contentLower.includes('đặt hàng')) {
      type = 'product';
      confidence = 0.7;
    } else if (contentLower.includes('điều') && contentLower.includes('nghị') || contentLower.includes('quyết định') || contentLower.includes('thông tư')) {
      type = 'regulation';
      confidence = 0.7;
    } else if (contentLower.includes('hướng dẫn') || contentLower.includes('cách') || contentLower.includes('bước')) {
      type = 'guide';
      confidence = 0.7;
    } else if (contentLower.includes('iso') || contentLower.includes('iec') || contentLower.includes('en 60118')) {
      type = 'standard';
      confidence = 0.8;
    }

    // Extract ISO codes
    const isoCodes: string[] = [];
    const isoRegex = /ISO\s*\d+[\d:.]*\d+/gi;
    const isoMatches = content.match(isoRegex);
    if (isoMatches) {
      isoCodes.push(...[...new Set(isoMatches.map(i => i.toUpperCase()))]);
    }

    // Extract WCAG level
    let wcagLevel: DetectedMetadata['wcagLevel'] = undefined;
    if (contentLower.includes('wcag 2.1') || contentLower.includes('wcag2.1')) {
      if (contentLower.includes('aaa')) wcagLevel = 'AAA';
      else if (contentLower.includes('aa')) wcagLevel = 'AA';
      else wcagLevel = 'A';
    }

    // Detect WHO GATE category
    let whoGateCategory: string | undefined;
    if (contentLower.includes('khiếm thị') || contentLower.includes('blind') || contentLower.includes('mù') || contentLower.includes('braille')) {
      whoGateCategory = 'vision';
    } else if (contentLower.includes('khiếm thính') || contentLower.includes('deaf') || contentLower.includes('điếc') || contentLower.includes('hearing')) {
      whoGateCategory = 'hearing';
    } else if (contentLower.includes('vận động') || contentLower.includes('wheelchair') || contentLower.includes('xe lăn') || contentLower.includes('mobility')) {
      whoGateCategory = 'mobility';
    } else if (contentLower.includes('giao tiếp') || contentLower.includes('aac') || contentLower.includes('communication')) {
      whoGateCategory = 'communication';
    } else if (contentLower.includes('nhận thức') || contentLower.includes('cognitive') || contentLower.includes('trí nhớ')) {
      whoGateCategory = 'cognition';
    } else if (contentLower.includes('sinh hoạt') || contentLower.includes('daily living')) {
      whoGateCategory = 'daily_living';
    } else if (contentLower.includes('giáo dục') || contentLower.includes('education') || contentLower.includes('học tập')) {
      whoGateCategory = 'education';
    }

    return {
      contentType: { type, confidence },
      metadata: {
        title: _title,
        isoCodes,
        wcagLevel,
        whoGateCategory,
      },
      suggestedCategory: whoGateCategory,
    };
  }

  async classifyForRAG(query: string): Promise<{
    categories: string[];
    keywords: string[];
  }> {
    if (!this.model) {
      // Fallback keyword extraction
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5);

      const categories: string[] = [];
      if (query.includes('blind') || query.includes('mù') || query.includes('đọc')) categories.push('vision');
      if (query.includes('hear') || query.includes('nghe') || query.includes('điếc')) categories.push('hearing');
      if (query.includes('wheelchair') || query.includes('xe') || query.includes('đi')) categories.push('mobility');

      return { categories, keywords };
    }

    try {
      const prompt = `Phân loại truy vấn về AT và trả về JSON:
{
  "categories": ["vision"|"hearing"|"mobility"|"communication"|"cognition"|"daily_living"|"education"],
  "keywords": ["từ khóa quan trọng từ câu hỏi"]
}

Truy vấn: ${query}

Chỉ trả về JSON.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Classification error:', error);
    }

    return { categories: [], keywords: [] };
  }
}

export const contentDetector = new ContentDetector();
