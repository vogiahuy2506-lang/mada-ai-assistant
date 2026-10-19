// @ts-nocheck
import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';
import { vectorStore } from './vectorStore';
import { rerankService, type RerankableItem } from './rerankService';
import db from '../db';

// ============ PROXY-AWARE FETCH ============
// Use proxy if configured (respects HTTP_PROXY/HTTPS_PROXY env vars)
async function proxyAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Simply use regular fetch - Node.js 18+ respects HTTP_PROXY/HTTPS_PROXY env vars
  return fetch(input, init);
}

// Retry helper with exponential backoff — for handling 429 Too Many Requests from Gemini API
async function fetchWithRetry(
  fn: () => Promise<Response>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 1000, maxDelayMs = 16000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fn();

    // 429 = Too Many Requests — retry with backoff
    if (response.status === 429) {
      if (attempt === retries) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API error: 429 Too Many Requests (after ${retries} retries). ${body}`);
      }

      // Read retry-after hint if present, otherwise use exponential backoff
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

      console.warn(`⚠️ [Gemini 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${retryDelay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }

    return response;
  }

  // Should not reach here, but satisfy TypeScript
  throw new Error('fetchWithRetry: unreachable');
}

// Direct Gemini API call that bypasses proxy, with automatic 429 retry
async function callGeminiDirect(apiKey: string, modelName: string, prompt: string, tools?: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      topP: 0.8,
      topK: 20,
    },
  };

  if (tools?.length > 0) {
    body.tools = tools;
  }

  const response = await fetchWithRetry(
    () => proxyAwareFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { retries: 3, baseDelayMs: 2000, maxDelayMs: 16000 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============ SCHEMA DEFINITIONS ============

/**
 * Structured output schema for RAG chat response (Task 5)
 * Ensures model returns JSON with predictable structure
 */
const RAG_RESPONSE_SCHEMA: FunctionDeclaration = {
  name: 'rag_response',
  description: 'MADA AI RAG response với cấu trúc JSON chuẩn',
  parameters: {
    type: 'object',
    properties: {
      replyText: {
        type: 'string',
        description: 'Câu trả lời chính bằng ngôn ngữ của user, tối đa 5 câu, có markdown formatting'
      },
      confidence: {
        type: 'number',
        description: 'Độ tin cậy từ 0.0 đến 1.0, dựa trên context và relevance'
      },
      devices: {
        type: 'array',
        description: 'Danh sách thiết bị AT được đề cập',
        items: { type: 'string' }
      },
      standardsHighlight: {
        type: 'array',
        description: 'Tiêu chuẩn ISO/WHO/WCAG được đề cập',
        items: { type: 'string' }
      }
    },
    required: ['replyText', 'confidence']
  }
};

// System prompt - Thân thiện, có dấu, tự nhiên như chuyên gia thật
const SYSTEM_PROMPT = `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT) cho người khuyết tật tại Việt Nam, được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).

🎯 CÁCH TRẢ LỜI:
- Trả lời bằng ngôn ngữ của người dùng (Việt/Anh/Pháp/Ár)
- Giọng văn thân thiện, ấm áp, chuyên nghiệp - như một chuyên gia đang tư vấn trực tiếp
- Dùng "mình" hoặc "tôi" cho tự nhiên (tùy ngữ cảnh)
- Trả lời NGẮN GỌN, SÚC TÍCH - tối đa 4-6 câu, đi thẳng vào vấn đề
- KHÔNG lặp lại câu hỏi của người dùng
- KHÔNG dùng ngôn ngữ máy móc, khô khan

📋 NỘI DUNG CẦN CÓ:
- Tên sản phẩm cụ thể (kèm link nguồn MADA nếu có)
- Giá tham khảo (VND/USD) - chỉ khi có trong dữ liệu
- Đối tượng phù hợp (trẻ em, người lớn, người cao tuổi...)
- Ưu điểm nổi bật 1-2 dòng
- Tiêu chuẩn/ISO codes nếu có (WCAG, ISO 9999, etc.)

🎨 FORMAT:
- Dùng danh sách gạch đầu dòng (-) hoặc đánh số (1., 2., 3.) khi liệt kê sản phẩm
- **In đậm** tên sản phẩm
- Có thể dùng bảng khi so sánh
- Emoji vừa phải (1-2 emoji/đoạn) cho sinh động

⚠️ GIỚI HẠN:
- KHÔNG đưa ra lời khuyên y tế, chẩn đoán bệnh
- KHÔNG tự xưng "bác sĩ" hay "chuyên gia y tế"
- KHÔNG trả lời các vấn đề ngoài phạm vi AT (giáo dục thông thường, y tế đại chúng, etc.)
- Nếu câu hỏi về y tế: "Xin lỗi, mình chỉ hỗ trợ tư vấn về Công nghệ Hỗ trợ (AT). Về các vấn đề y tế, bạn nên tham khảo ý kiến bác sĩ chuyên khoa nhé."

💡 VỀ DỮ LIỆU:
- Nếu CÓ thông tin trong [THÔNG TIN TỪ CƠ SỞ TRI THỨC]: dùng thông tin đó, kèm nguồn tham khảo
- Nếu KHÔNG CÓ hoặc THÔNG TIN ÍT: DÙNG KIẾN THỨC CHUNG của bạn về Công nghệ Hỗ trợ để trả lời! Đừng nói "không tìm thấy" - hãy tư vấn dựa trên kiến thức AT của bạn
- Bạn có kiến thức rộng về: thiết bị hỗ trợ người khiếm thị, người khiếm hearing, xe lăn, thiết bị giao tiếp AAC, công nghệ hỗ trợ nhận thức, vật dụng sinh hoạt hàng ngày, v.v.

💡 VÍ DỤ MẪU:

Câu hỏi: "Cho tôi xin thiết bị hỗ trợ người khiếm thị đọc sách"

Trả lời mẫu:
Dưới đây là 3 thiết bị phổ biến cho người khiếm thị đọc sách:

1. **NVDA** (Miễn phí) - Phần mềm đọc màn hình mã nguồn mở, hỗ trợ tiếng Việt
   - Phù hợp: Người khiếm thị dùng máy tính
   - Ưu điểm: Miễn phí 100%, cộng đồng hỗ trợ lớn

2. **Kính lúp điện tử Ruby HD** - Khoảng 8-15 triệu VNĐ
   - Phù hợp: Người già thị lực kém, học sinh
   - Ưu điểm: Phóng to 2-24x, gọn nhẹ, dễ mang theo

3. **BrailleSense Polaris** - Khoảng 50-80 triệu VNĐ
   - Phù hợp: Người khiếm thị thành thạo chữ Braille
   - Ưu điểm: Hiển thị chữ nổi, kết nối WiFi, đọc PDF

Bạn muốn mình tư vấn kỹ hơn về thiết bị nào không? 😊`;

/**
 * ⭐ i18n hóa phần "tail prompt" (CHỈ DẪN TRẢ LỜI) của buildPrompt.
 * Trước đây cứng tiếng Việt không dấu, nay đa ngôn ngữ.
 */
interface RagTailPrompt {
  userLabel: string;
  aiLabel: string;
  guidanceTitle: string;
  guidanceRules: string[];
  contextHeader: string;
  historyHeader: string;
  questionHeader: string;
  answerPrompt: string;
}

const RAG_TAIL_PROMPTS: Record<'vi' | 'en' | 'ar' | 'fr', RagTailPrompt> = {
  vi: {
    userLabel: 'Người dùng',
    aiLabel: 'MADA AI',
    guidanceTitle: 'CHỈ DẪN TRẢ LỜI',
    guidanceRules: [
      'Trả lời NGẮN GỌN, ĐÚNG TRỌNG TÂM câu hỏi',
      'Nếu CÓ thông tin trong [THÔNG TIN TỪ CƠ SỞ TRI THỨC]: dùng thông tin đó',
      'Nếu KHÔNG CÓ hoặc ÍT thông tin: DÙNG KIẾN THỨC CHUNG về Công nghệ Hỗ trợ để trả lời! Đừng nói "không tìm thấy"',
      'Bạn có kiến thức về: thiết bị khiếm thị, khiếm hearing, xe lăn, AAC, thiết bị nhận thức, vật dụng sinh hoạt...'
    ],
    contextHeader: '📚 THÔNG TIN TỪ CƠ SỞ TRI THỨC',
    historyHeader: '📝 LỊCH SỬ',
    questionHeader: '❓ Câu hỏi',
    answerPrompt: '🤖 Trả lời ngắn gọn, đúng trọng tâm:'
  },
  en: {
    userLabel: 'User',
    aiLabel: 'MADA AI',
    guidanceTitle: 'ANSWER GUIDELINES',
    guidanceRules: [
      'Answer CONCISELY, FOCUSED on the question',
      'If information IS in [KNOWLEDGE BASE CONTEXT]: use that information',
      'If NO or LIMITED information: Use your GENERAL KNOWLEDGE about Assistive Technology to answer! Do NOT say "not found"',
      'You know about: vision devices, hearing aids, wheelchairs, AAC, cognitive aids, daily living products...'
    ],
    contextHeader: '📚 KNOWLEDGE BASE CONTEXT',
    historyHeader: '📝 HISTORY',
    questionHeader: '❓ Question',
    answerPrompt: '🤖 Answer concisely and focused:'
  },
  ar: {
    userLabel: 'المستخدم',
    aiLabel: 'MADA AI',
    guidanceTitle: 'إرشادات الإجابة',
    guidanceRules: [
      'أجب بإيجاز، مع التركيز على السؤال',
      'إذا كانت المعلومات موجودة في [سياق قاعدة المعرفة]: استخدم تلك المعلومات',
      'إذا لم تكن هناك معلومات كافية: استخدم معرفتك العامة حول التكنولوجيا المساعدة! لا تقل "غير موجود"',
      'أنت تعرف عن: أجهزة البصر، سماعات الأذن، الكراسي المتحركة، AAC، أجهزة الإدراك...'
    ],
    contextHeader: '📚 سياق قاعدة المعرفة',
    historyHeader: '📝 السجل',
    questionHeader: '❓ سؤال',
    answerPrompt: '🤖 أجب بإيجاز وبشكل مركّز:'
  },
  fr: {
    userLabel: 'Utilisateur',
    aiLabel: 'MADA AI',
    guidanceTitle: 'CONSIGNES DE RÉPONSE',
    guidanceRules: [
      'Répondez CONCISÉMENT, en vous concentrant sur la question',
      'Utilisez uniquement les informations DE LA SOURCE, sans digression',
      "Si AUCUNE ou PEU dinformation: Utilisez vos CONNAISSANCES GÉNÉRALES sur la Technologie dAssistance! Ne dites JAMAIS non trouvé",
      'Si l\'information EST dans [CONTEXTE BASE DE CONNAISSANCES], RÉPONDEZ immédiatement, NE dites JAMAIS "non trouvé"',
      'Si AUCUNE information : "Je n\'ai pas trouvé d\'information sur [sujet] dans la base de données."'
    ],
    contextHeader: '📚 CONTEXTE BASE DE CONNAISSANCES',
    historyHeader: '📝 HISTORIQUE',
    questionHeader: '❓ Question',
    answerPrompt: '🤖 Réponses concise et ciblée :'
  }
};

interface RAGResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    content: string;
    source: string;
    metadata?: any;
    rerankScore?: number;
    rerankReason?: string;
  }>;
  contextUsed: boolean;
  usedRerank?: boolean;
}

interface RAGConfig {
  temperature?: number;
  topK?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  /** ⭐ Ngôn ngữ UI để i18n hóa tail prompt (mặc định 'vi') */
  language?: 'vi' | 'en' | 'ar' | 'fr';
  /** ⭐ MỚI: Filter RAG theo bot ID (e.g. 'bot-hearing') */
  botId?: string;
  /** ⭐ MỚI: Filter RAG theo MADA category slug (e.g. 'sensory-hearing') */
  madaCategory?: string;
  /** ⭐ MỚI: Filter RAG theo custom agent ID (for custom agents like 'kkkk') */
  agentId?: string;
  /** ⭐ MỚI: Nếu true → ưu tiên KB theo filter, nếu thiếu thì fallback toàn bộ KB */
  priority?: boolean;
}

/**
 * Post-process AI response de dam bao format hien thi dung
 */
function postProcessMarkdown(text: string): string {
  let result = text;

  // Pattern 1: "*Ten* - mo ta 1 - mo ta 2" tren 1 dong -> "- **Ten**: mo ta 1. mo ta 2"
  result = result.replace(
    /\*([^*\n]+)\*\s+-\s+([^-\n]+(?:\s+-\s+[^-\n]+)+)/g,
    (_match, name, desc) => {
      const parts = desc.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
      const formatted = parts.map((p) => p.replace(/^[a-z]/, (c) => c.toUpperCase())).join('. ');
      return `- **${name.trim()}**: ${formatted}`;
    }
  );

  // Pattern 2: Dau "-" khong co space truoc khi viet hoa -> ngat dong
  result = result.replace(/([a-z])\s+-\s+([A-Z])/g, '$1.\n- $2');

  // Pattern 3: Sau dau ":" co "*Ten*" ngay -> tach item
  result = result.replace(/(:\s+)\*([^*\n]+)\*/g, (_, _colon, content) => `\n\n- **${content.trim()}**`);

  // Pattern 4: Item "- **Ten**..." dinh lien nhau -> tach
  result = result.replace(/(\S)\s+(- \*\*[^*]+\*\*)/g, '$1\n$2');

  // Cleanup: gop nhieu newline thua
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

class RAGEngine {
  private genAI: GoogleGenerativeAI | null = null;
  private _isConfigured = false;

  get isConfigured(): boolean {
    return this._isConfigured;
  }

  initialize(): void {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is missing or invalid. Set it in .env to enable RAG.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this._isConfigured = true;
    
    // Keep proxy settings - Node.js 18+ respects HTTP_PROXY/HTTPS_PROXY
    console.log('✅ RAG Engine initialized with Gemini (using system proxy if configured)');
  }

  async query(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<RAGResponse> {
    const { topK = 10, systemInstruction, botId, madaCategory, agentId, priority = false } = config;

    try {
      // Initialize if not already
      if (!this._isConfigured) {
        this.initialize();
      }

      // ⚡ PERFORMANCE OPTIMIZATION: Reduce docs retrieved (was topK * 4, now topK * 2)
      let relevantDocs = await this.retrieveDocuments(userQuery, topK * 2, { botId, madaCategory, agentId, priority });

      // ⭐ FIX: Cho phép AI trả lời bằng kiến thức chung khi không có relevantDocs
      // AI có kiến thức về AT, không nên chặn trả lời
      // if (agentId && relevantDocs.length === 0) { ... return "không tìm thấy" ... } // DISABLED

      // Apply re-ranking only if top score is low (relevance uncertain)
      // Re-ranking costs ~2s extra per query. For seed/migration KB, vector search
      // is usually enough. Only rerank when top-1 score < 0.5 (uncertain relevance).
      let finalDocs = relevantDocs;
      let usedRerank = false;

      const topScore = relevantDocs[0]?.score || 0;
      const shouldRerank = topScore < 0.5 && relevantDocs.length > 3;

      if (shouldRerank && rerankService.isReady()) {
        try {
          const items: RerankableItem[] = relevantDocs.map((doc, idx) => ({
            id: doc.id || `doc_${idx}`,
            content: doc.content,
            score: doc.score || 0.5,
            metadata: doc.metadata,
          }));

          const reranked = await rerankService.rerank(userQuery, items, { topN: topK });

          if (reranked.length > 0) {
            finalDocs = reranked.map((r) => ({
              ...r.item,
              score: r.rerankScore,
              metadata: {
                ...r.item.metadata,
                rerankScore: r.rerankScore,
                rerankReason: r.reason,
              },
            }));
            usedRerank = true;
          }
        } catch (error) {
          console.warn('⚠️ Reranking failed, using original order:', error);
        }
      }

      // Build context from retrieved documents
      let context = '';
      if (finalDocs.length > 0) {
        context = finalDocs
          .map((doc, index) => `[Document ${index + 1}] (Nguồn: ${doc.metadata?.title || doc.metadata?.source || 'Unknown'})\n${doc.content}`)
          .join('\n\n');
      }

      // Build prompt
      const hasContext = context.length > 0;
      const prompt = this.buildPrompt(userQuery, context, conversationHistory, hasContext, systemInstruction, config.language);

      // Generate response
      if (!this._isConfigured || !this.genAI) {
        throw new Error('RAG Engine is not initialized. Set GEMINI_API_KEY in .env.');
      }

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash', // ✅ Stable & Fast
        generationConfig: {
          temperature: 0.3, // Low temp = focused, faster
          maxOutputTokens: config.maxOutputTokens || 2048, // ⚡ Reduced for faster response
          topP: 0.8,
          topK: 20,
        },
        tools: [{
          functionDeclarations: [RAG_RESPONSE_SCHEMA]
        }],
      });

      // Use direct API call (bypasses proxy issues)
      let structuredResponse: any = null;
      let answer: string;
      let confidence: number;

      try {
        // Call Gemini API directly (no SDK, no proxy)
        const apiKey = process.env.GEMINI_API_KEY!;
        const geminiResult = await callGeminiDirect(apiKey, 'gemini-2.5-flash', prompt, tools ? [{ functionDeclarations: [RAG_RESPONSE_SCHEMA] }] : undefined);
        
        // Parse the response
        const candidates = geminiResult?.candidates || [];
        const parts = candidates[0]?.content?.parts || [];
        
        // Try function call first (structured output)
        const functionCallPart = parts.find((p: any) => p.functionCall);
        if (functionCallPart?.functionCall) {
          const fnCall = functionCallPart.functionCall;
          if (fnCall.name === 'rag_response') {
            structuredResponse = fnCall.args;
            answer = postProcessMarkdown(structuredResponse.replyText || '');
            confidence = structuredResponse.confidence || this.calculateConfidence(finalDocs, hasContext);
          } else {
            // Fallback to text from function call args
            const rawAnswer = fnCall.args?.replyText || fnCall.args?.answer || fnCall.args?.text || '';
            answer = postProcessMarkdown(rawAnswer);
            confidence = this.calculateConfidence(finalDocs, hasContext);
          }
        } else {
          // Regular text response
          const textParts = parts.filter((p: any) => p.text);
          const rawAnswer = textParts.map((p: any) => p.text).join('\n');
          answer = postProcessMarkdown(rawAnswer);
          confidence = this.calculateConfidence(finalDocs, hasContext);
        }
      } catch (schemaError: any) {
        console.warn('[RAG] Schema parsing failed, using text fallback:', schemaError.message?.slice(0, 80));
        try {
          // Retry without structured output
          const apiKey = process.env.GEMINI_API_KEY!;
          const geminiResult = await callGeminiDirect(apiKey, 'gemini-2.5-flash', prompt, undefined);
          const parts = geminiResult?.candidates?.[0]?.content?.parts || [];
          const textParts = parts.filter((p: any) => p.text);
          const rawAnswer = textParts.map((p: any) => p.text).join('\n');
          answer = postProcessMarkdown(rawAnswer);
          confidence = this.calculateConfidence(finalDocs, hasContext);
        } catch (textError) {
          throw textError;
        }
      }

      return {
        answer,
        confidence,
        devices: structuredResponse?.devices || [],
        standardsHighlight: structuredResponse?.standardsHighlight || [],
        sources: finalDocs.map((doc) => ({
          content: doc.content?.slice(0, 200) + (doc.content?.length > 200 ? '...' : ''),
          source: doc.metadata?.source || 'Unknown',
          metadata: doc.metadata,
          rerankScore: doc.metadata?.rerankScore,
          rerankReason: doc.metadata?.rerankReason,
        })),
        contextUsed: hasContext,
        usedRerank,
      };
    } catch (error) {
      console.error('❌ RAG query failed:', error);
      throw error;
    }
  }

  /**
   * Fallback: parse raw response từ Gemini khi SDK không parse được.
   *
   * Issue: @google/generative-ai@0.24.x không parse functionCall trong một số trường hợp
   * → Method này parse thủ công từ raw response structure.
   *
   * Supported formats:
   *  1. functionCall.args.replyText (MADA RAG schema)
   *  2. functionCall.args.{answer,response,text} (custom schemas)
   *  3. Inline text trong parts[]
   *  4. response.text() như last resort
   *
   * Returns empty string nếu không tìm thấy content (để caller xử lý fallback).
   */
  private extractAnswerFromRawResponse(result: any): string {
    try {
      const response = result?.response;
      if (!response) return '';

      const candidates = response.candidates || [];
      if (candidates.length === 0) return '';

      const candidate = candidates[0];
      const parts = candidate?.content?.parts || [];

      // 1. Try functionCall.args (structured output)
      for (const part of parts) {
        if (part?.functionCall?.args) {
          const args = part.functionCall.args;
          // Priority order cho MADA schema
          if (args.replyText) return String(args.replyText);
          if (args.answer) return String(args.answer);
          if (args.response) return String(args.response);
          if (args.text) return String(args.text);
          if (args.content) return String(args.content);
          // Last: serialize all args as text
          const keys = Object.keys(args);
          if (keys.length > 0) {
            return keys.map((k) => `${k}: ${args[k]}`).join('\n');
          }
        }
      }

      // 2. Try inline text trong parts
      for (const part of parts) {
        if (part?.text) return String(part.text);
      }

      // 3. Try response.text() như last resort
      try {
        const text = response.text?.();
        if (text) return text;
      } catch {
        // Ignore
      }

      return '';
    } catch (err) {
      console.error('[RAG] Manual parse failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }

  /**
   * Stream query - returns streaming response for real-time updates
   */
  async queryStream(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<{
    stream: AsyncGenerator<{ text: () => string }>;
    sources: RAGResponse['sources'];
    confidence: number;
    answer: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const topK = config.topK || 10;
    const { botId, madaCategory, agentId, priority = false } = config;

    // Retrieve relevant documents (với filter MADA nếu có)
    const rawDocs = await this.retrieveDocuments(userQuery, topK * 4, { botId, madaCategory, agentId, priority });

    // ⭐ FIX: Pinecone trả score=1.0 cho mọi doc (do metric config), không dùng được.
    // → BẮT BUỘC gọi rerankService (LLM-based) để có relevance score thật.
    // Nếu rerank fail → fallback dùng rawDocs nhưng đánh confidence thấp.
    let relevantDocs: any[] = rawDocs;
    let usedRerank = false;

    // ⭐ Custom agent KHÔNG có dữ liệu → tìm sản phẩm trong DB theo category làm context
    // Thay vì trả lời "không tìm thấy" → cho AI giới thiệu sản phẩm có sẵn
    if (agentId && relevantDocs.length === 0) {
      console.log(`⚠️ [RAG Stream] Agent "${agentId}" - no relevant docs found, fetching products as fallback`);

      const lang = config.language || 'vi';
      const labelHeader = lang === 'en' ? 'Available products in our database' : 'Các sản phẩm hiện có trong cơ sở dữ liệu';

      // Fetch top products từ kb_products theo botId / madaCategory
      let productContext = '';
      try {
        // Map madaCategory (e.g. "mental-cognitive") → DB category enum (e.g. "cognition")
        const MADA_CATEGORY_TO_DB: Record<string, string> = {
          'mobility': 'mobility',
          'vision': 'vision',
          'hearing': 'hearing',
          'cognition': 'cognition',
          'mental-cognitive': 'cognition',
          'communication': 'communication',
          'daily-living': 'daily_living',
          'education': 'education',
        };
        const dbCategory = (madaCategory && MADA_CATEGORY_TO_DB[madaCategory]) || null;

        let products: any[] = [];
        if (dbCategory) {
          products = db.prepare(
            `SELECT title, title_en, description, category, brand, price_range, product_url
             FROM kb_products
             WHERE (category = ? OR category LIKE ?) AND status = 'published'
             ORDER BY featured DESC, sort_order DESC, created_at DESC
             LIMIT 5`
          ).all(dbCategory, `%${dbCategory}%`) as any[];
        }
        // ⭐ FIX: KHÔNG fallback sang tất cả sản phẩm nếu category không match
        // Nếu không có sản phẩm đúng category → bỏ qua product fallback, trả lời "không tìm thấy"
        // Việc hiện sản phẩm không liên quan (vd: thính giác cho câu hỏi về thị giác) gây confusion

        if (products.length > 0) {
          const isEn = lang === 'en';
          productContext = products.map((p, i) => {
            const name = isEn ? (p.title_en || p.title) : p.title;
            return `${i + 1}. ${name}${p.brand ? ` (${p.brand})` : ''}${p.price_range ? ` — ${p.price_range}` : ''}${p.description ? `\n   ${p.description}` : ''}`;
          }).join('\n');
          console.log(`📦 [RAG Stream] Built product context from ${products.length} DB products`);
        }
      } catch (err) {
        console.warn('⚠️ [RAG Stream] Product fallback fetch failed:', (err as Error).message);
      }

      // Nếu có product context → cho AI giới thiệu sản phẩm
      if (productContext) {
        const intro = lang === 'en'
          ? `I don't have detailed information about this topic in my knowledge base yet, but here are some products from our database that may be relevant:`
          : `Tôi chưa có thông tin chi tiết về chủ đề này trong cơ sở kiến thức, nhưng dưới đây là một số sản phẩm từ cơ sở dữ liệu có thể phù hợp:`;

        const aiContext = `[${labelHeader}]\n${productContext}`;
        const prompt = this.buildPrompt(userQuery, aiContext, conversationHistory, true, config.systemInstruction, config.language);
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.3, maxOutputTokens: config.maxOutputTokens || 8192, topP: 0.8, topK: 20 },
        });

        let fullAnswer = '';
        const productStream = (async function* () {
          // Stream intro trước
          yield { text: () => `${intro}\n\n` };
          fullAnswer += intro + '\n\n';

          // Stream AI response
          try {
            const result = await model.generateContentStream({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) {
                fullAnswer += text;
                yield { text: () => text };
              }
            }
          } catch (e) {
            console.error('❌ [RAG Stream] product-fallback stream error:', e);
            // Fallback: stream raw product list
            const raw = `\n\n${productContext}`;
            fullAnswer += raw;
            yield { text: () => raw };
          }
        })();

        return {
          stream: productStream,
          sources: [],
          confidence: 50,
          answer: fullAnswer || intro,
        };
      }

      // ⭐ FIX: Thay vì return "không tìm thấy" → cho AI trả lời bằng kiến thức chung
      // Bỏ qua return ở đây để code tiếp tục xuống rerank và AI response
      // if (!productContext) { return "không tìm thấy" } // DISABLED
    }

    // ⭐ FIX: Pinecone trả score=1.0 cho mọi doc (do metric config), không dùng được.
    // → BẮT BUỘC gọi rerankService (LLM-based) để có relevance score thật.
    // Nếu rerank fail → fallback dùng rawDocs nhưng đánh confidence thấp.
    if (rerankService.isReady() && rawDocs.length > 0) {
      try {
        const items: RerankableItem[] = rawDocs.map((doc, idx) => ({
          id: doc.id || `doc_${idx}`,
          content: doc.content,
          score: doc.score || 0.5,
          metadata: doc.metadata,
        }));
        const reranked = await rerankService.rerank(userQuery, items, { topN: topK });
        if (reranked.length > 0) {
          relevantDocs = reranked.map((r) => ({
            ...r.item,
            score: r.rerankScore,
            metadata: {
              ...r.item.metadata,
              rerankScore: r.rerankScore,
              rerankReason: r.reason,
            },
          }));
          usedRerank = true;
          console.log(`🔄 [RAG Stream] Reranked: top rerank score = ${relevantDocs[0].score.toFixed(3)}`);
        }
      } catch (err) {
        console.warn('⚠️ [RAG Stream] Rerank failed, using raw docs:', (err as Error).message);
      }
    }

    // ⭐ FIX: Lọc docs có relevance score quá thấp (sau rerank) để tránh
    // Gemini bị ép trả lời khi context không thực sự match câu hỏi.
    // Rerank score 0..1. Threshold 0.5: docs < 0.5 rõ ràng không liên quan.
    // Threshold cao hơn (0.7) sẽ cắt nhầm paraphrase tốt.
    const RERANK_THRESHOLD = 0.5;
    const beforeFilter = relevantDocs.length;
    if (usedRerank) {
      relevantDocs = relevantDocs.filter((d: any) => (d.score ?? 0) >= RERANK_THRESHOLD);
      console.log(`🔍 [RAG Stream] After threshold: ${relevantDocs.length}/${beforeFilter} (best: ${(relevantDocs[0]?.score ?? 0).toFixed(3)})`);
    } else if (relevantDocs.length > 0) {
      console.log(`⚠️ [RAG Stream] No rerank; using all ${relevantDocs.length} raw docs (may be irrelevant)`);
    }

    // Build context
    let context = '';
    if (relevantDocs.length > 0) {
      context = relevantDocs
        .map((doc, index) => `[Document ${index + 1}] (Nguồn: ${doc.metadata?.title || doc.metadata?.source || 'Unknown'})\n${doc.content}`)
        .join('\n\n');
    }

    // Build prompt
    const hasContext = context.length > 0;
    const prompt = this.buildPrompt(userQuery, context, conversationHistory, hasContext, config.systemInstruction, config.language);

    // Format sources
    const sources = relevantDocs.map((doc) => ({
      content: doc.content?.slice(0, 200) + (doc.content?.length > 200 ? '...' : ''),
      source: doc.metadata?.source || 'Unknown',
      metadata: doc.metadata,
      rerankScore: doc.metadata?.rerankScore,
      rerankReason: doc.metadata?.rerankReason,
    }));

    const confidence = this.calculateConfidence(relevantDocs, hasContext);

    // Generate streaming response
    if (!this._isConfigured || !this.genAI) {
      throw new Error('RAG Engine is not initialized. Set GEMINI_API_KEY in .env.');
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: config.maxOutputTokens || 8192,
        topP: 0.8,
        topK: 20,
      },
    });

    // Retry wrapper for streaming — detects 429 before starting the stream
    async function streamWithRetry(model: any, prompt: string, retries = 3, baseDelayMs = 2000) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await model.generateContentStream({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          return result;
        } catch (error: any) {
          const msg = error?.message || '';
          const is429 = msg.includes('429') || msg.includes('Too Many Requests') || error?.status === 429;

          if (is429 && attempt < retries) {
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 16000);
            console.warn(`⚠️ [RAG Stream 429] Attempt ${attempt + 1}/${retries + 1} — waiting ${delay}ms before retry...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw error;
        }
      }
      throw new Error('streamWithRetry: unreachable');
    }

    // Collect full answer for history
    let fullAnswer = '';

    const stream = (async function* () {
      try {
        const result = await streamWithRetry(model, prompt);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          fullAnswer += text;
          yield { text: () => text };
        }
      } catch (error) {
        // ⭐ FIX: throw lỗi để caller xử lý (không nuốt lỗi như trước)
        // Trước đây yield chuỗi rỗng → AI "im lặng", sources rỗng → không gợi ý sản phẩm
        console.error('❌ Stream generation error:', error);
        throw error;
      }
    })();

    // Return stream with sources and confidence
    return {
      stream,
      sources,
      confidence,
      answer: '', // Will be populated as chunks come in
    };
  }

  private buildPrompt(
    userQuery: string,
    context: string,
    conversationHistory: Array<{ role: string; content: string }>,
    hasContext: boolean,
    systemInstruction?: string,
    language: 'vi' | 'en' | 'ar' | 'fr' = 'vi'
  ): string {
    const langCode: 'vi' | 'en' | 'ar' | 'fr' = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi');
    const tail = RAG_TAIL_PROMPTS[langCode];

    const historyStr = conversationHistory.length > 0
      ? conversationHistory
          .map((msg) => {
            const roleLabel = msg.role === 'user' ? tail.userLabel : tail.aiLabel;
            return `${roleLabel}: ${msg.content}`;
          })
          .join('\n')
      : '';

    const basePrompt = systemInstruction || SYSTEM_PROMPT;

    return `${basePrompt}

${tail.guidanceTitle}:
${tail.guidanceRules.map(r => `- ${r}`).join('\n')}

${hasContext ? `${tail.contextHeader}:
${context}

---` : ''}
${historyStr ? `${tail.historyHeader}:
${historyStr}

---` : ''}
${tail.questionHeader}: ${userQuery}

${tail.answerPrompt}`;
  }

  private calculateConfidence(relevantDocs: any[], hasContext: boolean): number {
    if (!hasContext || relevantDocs.length === 0) return 30;

    // ⭐ FIX: Confidence dựa trên rerank score (range 0..1, từ rerankService).
    // Top rerank score càng cao → confidence càng cao.
    const scores = relevantDocs
      .map((d: any) => (typeof d.score === 'number' ? d.score : 0.5))
      .slice(0, 5);
    const top1 = scores[0] || 0;
    // Guard against division by zero: if scores.length is 0, use 1 as denominator
    const avgTop3 = scores.length > 0 
      ? scores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, scores.length))
      : 0;

    // ⭐ Rerank score 0.5-0.7 thường là "liên quan một phần" (trùng keyword nhưng
    // không match intent). Cần penalty mạnh.
    // Rerank score 0.7+ mới thực sự trả lời được câu hỏi.
    const toConfidence = (s: number) => {
      if (s >= 0.85) return 95;
      if (s >= 0.75) return 85;
      if (s >= 0.65) return 70;
      if (s >= 0.55) return 55;
      return 40; // < 0.55 thì coi như không match
    };
    const topConf = toConfidence(top1);
    const avgConf = toConfidence(avgTop3);

    // Weighted: 70% top1 + 30% avg top3
    return Math.round(topConf * 0.7 + avgConf * 0.3);
  }

  private detectCategory(query: string): string {
    const lowerQuery = query.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
      mobility: [
        'xe lan', 'xe lăn', 'wheelchair', 'nạng', 'nang', 'chống', 'gậy', 'gay',
        'di chuyen', 'van dong', 'đi lại', 'tay', 'chân', 'chân tay',
      ],
      hearing: [
        'de', 'de', 'nghe', 'thinh', ' Hearing', 'am thanh', 'tai',
        'suat nghe', 'may', 'bieu', 'ngôn ngữ ký hiệu',
      ],
      cognition: [
        'nao', 'óc', 'trí', 'nhớ', 'memory', 'cognit', 'Alzheimer',
        'dementia', 'tre em', 'autism', 'tự kỷ', 'hoc tap', 'learning',
      ],
      communication: [
        'noi', 'nói', 'speak', 'giao tiep', 'communication', 'ngôn ngữ',
        'language', 'bieu', 'symbol', 'ipad', 'tablet',
      ],
      daily_living: [
        'an', 'uong', 'nau', 'nấu', 'rua', 'tắm', 'bath', 'nha',
        'nha ve sinh', 'toilet', 'quan ao', 'clothes', 'giặt',
      ],
      education: [
        'hoc', 'học', 'school', 'study', 'giao duc', 'education',
        'sinh vien', 'student', 'sach', 'book', 'giao duc dac biet',
      ],
      general: [],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * ⭐ MỚI: Retrieve documents với priority mode
   *
   * Nếu priority=true và có filter (botId/madaCategory):
   *   - Pass 1: search với filter (chỉ lấy KB của bot đó)
   *   - Pass 2: nếu không đủ topK → fallback search toàn bộ KB
   *
   * Nếu priority=false (default):
   *   - Search toàn bộ KB với filter (nếu có)
   */
  private async retrieveDocuments(
    userQuery: string,
    topK: number,
    options: { botId?: string; madaCategory?: string; agentId?: string; priority?: boolean }
  ): Promise<any[]> {
    const { botId, madaCategory, agentId, priority = false } = options;
    // ⭐ Build filter: agentId (custom agents) > botId/madaCategory (MADA bots)
    const filter = (botId || madaCategory) ? { botId, madaCategory } : undefined;
    const agentFilter = agentId ? { agentId } : undefined;

    // Pass 1: search theo filter - Dùng hybrid search để kết hợp vector + keyword
    // ⭐ Ưu tiên agentFilter (custom agents) > filter (MADA bots) > no filter
    let primary: any[] = [];
    const searchFilter = agentFilter || filter;
    
    if (searchFilter) {
      try {
        // Hybrid search: kết hợp vector similarity + BM25 keyword matching
        primary = await vectorStore.hybridSearch(userQuery, topK, searchFilter, 0.7, 0.3);
        console.log(`🔍 [RAG] Hybrid search (filter) (agentId=${agentId}, botId=${botId}, madaCategory=${madaCategory}): ${primary.length} docs`);
      } catch (err) {
        console.warn('⚠️ [RAG] Hybrid filter search failed, falling back to vector:', err);
        try {
          primary = await vectorStore.search(userQuery, { topK, filter: searchFilter });
        } catch (err2) {
          console.warn('⚠️ [RAG] Vector filter search also failed:', err2);
        }
      }
    }

    // Nếu có agentId (custom agent) → KHÔNG BAO GIỜ fallback sang MADA KB
    // Custom agent phải dùng DỮ LIỆU RIÊNG, không trộn với MADA
    const hasAgentId = !!agentId;
    
    // Nếu priority mode VÀ chưa đủ → fallback hybrid search toàn bộ KB
    // NHƯNG: Nếu có agentId (custom agent), KHÔNG fallback - dùng kết quả hiện có
    if (priority && searchFilter && primary.length < topK && !hasAgentId) {
      const need = topK - primary.length;
      console.log(`🔁 [RAG] Priority fallback: cần thêm ${need} docs từ toàn bộ KB`);
      try {
        const fallback = await vectorStore.hybridSearch(userQuery, need, undefined, 0.7, 0.3);
        // Merge, tránh trùng
        const primaryIds = new Set(primary.map((d: any) => d.id || d.metadata?.source));
        const merged = [...primary];
        for (const doc of fallback) {
          const id = doc.id || doc.metadata?.source;
          if (!primaryIds.has(id)) {
            merged.push(doc);
            primaryIds.add(id);
          }
          if (merged.length >= topK) break;
        }
        return merged;
      } catch (err) {
        console.warn('⚠️ [RAG] Fallback hybrid search failed, trying vector:', err);
        try {
          const fallback = await vectorStore.search(userQuery, { topK: need, filter: undefined });
          const primaryIds = new Set(primary.map((d: any) => d.id || d.metadata?.source));
          const merged = [...primary];
          for (const doc of fallback) {
            const id = doc.id || doc.metadata?.source;
            if (!primaryIds.has(id)) {
              merged.push(doc);
              primaryIds.add(id);
            }
            if (merged.length >= topK) break;
          }
          return merged;
        } catch (err2) {
          console.warn('⚠️ [RAG] Fallback search also failed:', err2);
        }
      }
    } else if (hasAgentId && primary.length === 0) {
      // ⭐ Custom agent KHÔNG có dữ liệu - log cảnh báo và trả về rỗng
      // KHÔNG fallback sang MADA để tránh trả lời sai
      console.log(`⚠️ [RAG] Agent "${agentId}" has no knowledge base data. Not falling back to MADA.`);
      return [];
    }

    // Nếu không có searchFilter hoặc không priority → trả về primary hoặc search toàn bộ
    if (!searchFilter) {
      try {
        // Hybrid search: kết hợp vector + BM25
        const noFilterResults = await vectorStore.hybridSearch(userQuery, topK, undefined, 0.7, 0.3);
        if (noFilterResults.length > 0) return noFilterResults;
      } catch (err) {
        console.warn('⚠️ [RAG] Hybrid search failed, falling back to vector:', err);
        try {
          const noFilterResults = await vectorStore.search(userQuery, topK);
          if (noFilterResults.length > 0) return noFilterResults;
        } catch (err2) {
          console.warn('⚠️ [RAG] Vector search also failed:', err2);
        }
      }
      return await this.sqliteFallback(userQuery, topK);
    }

    // Nếu filter search rỗng mà priority=false → fallback SQLite
    if (primary.length === 0) {
      return await this.sqliteFallback(userQuery, topK, { botId, madaCategory, agentId });
    }

    return primary;
  }

  /**
   * Fallback: SELECT trực tiếp từ SQLite knowledge_items bằng LIKE keyword
   * Dùng khi vector store rỗng hoặc không match được.
   * Score đơn giản: count keyword matches trong title + content.
   */
  private async sqliteFallback(
    userQuery: string,
    topK: number,
    filter?: { botId?: string; madaCategory?: string; agentId?: string }
  ): Promise<any[]> {
    try {
      const query = userQuery.trim();
      if (!query || query.length < 2) return [];

      // Tách keywords (loại bỏ stop words)
      const stopWords = new Set(['là', 'gì', 'có', 'cho', 'tôi', 'bạn', 'của', 'và', 'thì', 'mà', 'được', 'không', 'này', 'kia', 'với', 'từ', 'trong', 'một', 'những', 'các']);
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
        .slice(0, 8);

      if (keywords.length === 0) return [];

      // Build SQL: mỗi keyword là 1 điều kiện LIKE, score = số match
      const likeConditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)').join(' OR ');
      const likeParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

      // Map botId/category/agentId từ filter (nếu có)
      let categoryFilter = '';
      const catFilterParams: string[] = [];
      if (filter?.madaCategory) {
        // Cho phép partial match vì DB có cả 'sensory-vision' và 'vision'
        const aliases = this.expandCategoryAliases(filter.madaCategory);
        if (aliases.length > 0) {
          categoryFilter = ` AND (${aliases.map(() => 'category = ?').join(' OR ')})`;
          catFilterParams.push(...aliases);
        }
      }

      // ⭐ Filter by agentId (stored in metadata as JSON)
      let agentFilter = '';
      const agentFilterParams: string[] = [];
      if (filter?.agentId) {
        agentFilter = ` AND (LOWER(metadata) LIKE ? OR LOWER(metadata) LIKE ?)`;
        agentFilterParams.push(`%"agentId":"${filter.agentId}"%`, `%agentId%${filter.agentId}%`);
      }

      // ⭐ Fix: Include ALL source types (web, manual, pdf, text, etc.) — imported products have source_type='manual'
      const sql = `
        SELECT id, title, content, source, category, metadata,
          (${keywords.map(() => 'CASE WHEN LOWER(title) LIKE ? THEN 2 ELSE 0 END + CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END').join(' + ')}) as score
        FROM knowledge_items
        WHERE source_type IN ('web', 'manual', 'pdf', 'text', 'image', 'docx', 'xlsx', 'csv')
          AND (${likeConditions})
          ${categoryFilter}
          ${agentFilter}
        ORDER BY score DESC, length(content) DESC
        LIMIT ?
      `;

      // Params: score weight params + like params + category params + agent filter params + limit
      const simpleSql = `
        SELECT id, title, content, source, category, metadata,
          (${keywords.map(() => '(CASE WHEN LOWER(title) LIKE ? THEN 2 ELSE 0 END + CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END)').join(' + ')}) as match_score
        FROM knowledge_items
        WHERE source_type IN ('web', 'manual', 'pdf', 'text', 'image', 'docx', 'xlsx', 'csv')
          AND (${likeConditions})
          ${categoryFilter}
          ${agentFilter}
        ORDER BY match_score DESC
        LIMIT ?
      `;
      const allParams: any[] = [];
      keywords.forEach(k => {
        allParams.push(`%${k}%`, `%${k}%`);
      });
      allParams.push(...likeParams);
      allParams.push(...catFilterParams);
      allParams.push(...agentFilterParams);
      allParams.push(topK);

      const rows = db.prepare(simpleSql).all(...allParams) as any[];

      console.log(`🗄️ [SQLite fallback] ${rows.length} docs for: "${query.slice(0, 50)}..."`);

      return rows.map((row, i) => {
        let meta: any = {};
        try {
          meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {});
        } catch { meta = {}; }

        return {
          id: row.id,
          content: row.content?.slice(0, 4000) || row.title,
          score: 0.3 + (i === 0 ? 0.2 : 0), // baseline score 0.3-0.5
          metadata: {
            source: row.source || '',
            type: 'web',
            title: row.title || '',
            category: row.category || 'general',
            ...meta,
          },
        };
      });
    } catch (err) {
      console.warn('⚠️ [SQLite fallback] failed:', (err as Error).message);
      return [];
    }
  }

  /** Map filter category sang nhiều alias có thể có trong DB */
  private expandCategoryAliases(cat: string): string[] {
    const map: Record<string, string[]> = {
      // Hearing
      'sensory-hearing': ['sensory-hearing', 'hearing', 'sensory-hearing'],
      'hearing': ['hearing', 'sensory-hearing'],
      // Vision
      'sensory-vision': ['sensory-vision', 'vision', 'sensory-vision'],
      'vision': ['vision', 'sensory-vision'],
      // Speech/Communication
      'voice-and-speech': ['voice-and-speech', 'voice', 'speech', 'communication', 'aac'],
      'voice-speech': ['voice-and-speech', 'voice', 'speech', 'communication', 'aac'],
      'communication': ['communication', 'voice-and-speech'],
      // Cognitive
      'mental-cognitive': ['mental-cognitive', 'cognition', 'cognitive', 'mental'],
      'cognitive': ['cognitive', 'mental-cognitive'],
      // Neuro/Movement
      'neuromusculoskeletal-movement': ['neuromusculoskeletal-movement', 'neuro', 'movement', 'musculoskeletal'],
      'movement': ['movement', 'neuromusculoskeletal-movement'],
      // Mobility/Transport
      'mobility-and-transportation': ['mobility-and-transportation', 'mobility', 'transport', 'physical'],
      'mobility': ['mobility', 'mobility-and-transportation'],
      // Regulatory
      'regulatory-standards': ['regulatory-standards', 'regulatory', 'standards'],
      // Fallback
      'daily_living': ['general', 'daily_living'],
      'education': ['education', 'general'],
      'general': ['general'],
    };
    return map[cat] || [cat];
  }
}

export const ragEngine = new RAGEngine();
