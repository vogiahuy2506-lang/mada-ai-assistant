// @ts-nocheck
import { GoogleGenerativeAI, type FunctionDeclaration } from '@google/generative-ai';
import { vectorStore } from './vectorStore';
import { rerankService, type RerankableItem } from './rerankService';
import db from '../db';

// ============ PROXY BYPASS FETCH ============
// Custom fetch that bypasses system proxy for Google API
async function noProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // Only bypass proxy for Google APIs
  if (url.includes('generativelanguage.googleapis.com') || url.includes('aiplatform.googleapis.com')) {
    // Save and clear proxy environment
    const savedEnv: Record<string, string | undefined> = {
      HTTP_PROXY: process.env.HTTP_PROXY,
      HTTPS_PROXY: process.env.HTTPS_PROXY,
      http_proxy: process.env.http_proxy,
      https_proxy: process.env.https_proxy,
      ALL_PROXY: process.env.ALL_PROXY,
      all_proxy: process.env.all_proxy,
    };
    
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    delete process.env.ALL_PROXY;
    delete process.env.all_proxy;
    
    try {
      return await fetch(url, init);
    } finally {
      // Restore proxy settings
      for (const [key, val] of Object.entries(savedEnv)) {
        if (val !== undefined) {
          process.env[key] = val;
        }
      }
    }
  }
  
  return fetch(input, init);
}

// Direct Gemini API call that bypasses proxy
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
  
  const response = await noProxyFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
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
const SYSTEM_PROMPT = `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology) cho người khuyết tật tại Việt Nam, được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).

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
- 🚨 QUAN TRỌNG VỀ CÁCH TRẢ LỜI KHI KHÔNG CÓ DỮ LIỆU:
  • Nếu [Context] ở dưới KHÔNG chứa thông tin liên quan trực tiếp đến câu hỏi của người dùng (kể cả khi có từ khóa trùng), bạn PHẢI nói thẳng rằng mình không tìm thấy thông tin, ví dụ:
    "Xin lỗi, mình không tìm thấy thông tin về [chủ đề] trong cơ sở dữ liệu MADA. Bạn có thể thử hỏi về [chủ đề liên quan] hoặc liên hệ chuyên gia AT nhé."
  • TUYỆT ĐỐI KHÔNG bịa thiết bị, KHÔNG gán thông tin từ doc không liên quan vào câu trả lời.
  • TUYỆT ĐỐI KHÔNG lặp lại tên sản phẩm chỉ vì nó xuất hiện trong context mà không đúng với câu hỏi.
- Nếu không chắc chắn: "Mình chưa có thông tin chính xác về vấn đề này. Bạn có thể liên hệ chuyên gia AT tại địa phương để được tư vấn chi tiết hơn nhé."
- Nếu câu hỏi về y tế: "Xin lỗi, mình chỉ hỗ trợ tư vấn về Công nghệ Hỗ trợ (AT). Về các vấn đề y tế, bạn nên tham khảo ý kiến bác sĩ chuyên khoa nhé."

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
      'Chỉ dùng thông tin TỪ NGUỒN, không lan man',
      'Dừng ngay sau khi đã trả lời đủ',
      'Nếu CÓ thông tin trong [THÔNG TIN TỪ CƠ SỞ TRI THỨC] thì TRẢ LỜI ngay, TUYỆT ĐỐI KHÔNG nói "không tìm thấy"',
      'Nếu KHÔNG có thông tin: "Tôi không tìm thấy thông tin về [chủ đề] trong cơ sở dữ liệu."'
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
      'Only use information FROM THE SOURCE, no rambling',
      'Stop immediately after answering sufficiently',
      'If information IS in [KNOWLEDGE BASE CONTEXT] then ANSWER right away, NEVER say "not found"',
      'If NO information: "I could not find information about [topic] in the database."'
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
      'استخدم فقط المعلومات من المصدر، بدون تشتت',
      'توقف فورًا بعد الإجابة الكافية',
      'إذا كانت المعلومات موجودة في [سياق قاعدة المعرفة]، فأجب فورًا، ولا تقل أبدًا "غير موجود"',
      'إذا لم تكن هناك معلومات: "لم أجد معلومات حول [الموضوع] في قاعدة البيانات."'
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
      'Arrêtez-vous dès que la réponse est suffisante',
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
    
    // Clear proxy environment variables for this process to ensure direct connection
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    delete process.env.ALL_PROXY;
    delete process.env.all_proxy;
    
    console.log('✅ RAG Engine initialized with Gemini (proxy bypassed)');
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

      // ⭐ Custom agent KHÔNG có dữ liệu → trả lời rằng không tìm thấy thông tin
      // Không cho AI trả lời sai bằng kiến thức chung
      if (agentId && relevantDocs.length === 0) {
        console.log(`⚠️ [RAG] Agent "${agentId}" - no relevant docs found for query: "${userQuery.slice(0, 50)}..."`);
        const noDataMsgs: Record<string, string> = {
          vi: `Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu của bot này. Vui lòng thử hỏi về chủ đề khác hoặc liên hệ quản trị viên để thêm dữ liệu.`,
          en: `Sorry, I couldn't find information related to your question in this bot's knowledge base. Please try asking about a different topic or contact the administrator to add data.`,
          ar: `عذراً، لم أتمكن من العثور على معلومات متعلقة بسؤالك في قاعدة معرفة هذا البوت. يرجى محاولة السؤال عن موضوع آخر أو الاتصال بالمسؤول لإضافة البيانات.`,
          fr: `Désolé, je n'ai pas trouvé d'informations concernant votre question dans la base de connaissances de ce bot. Veuillez essayer de poser une question sur un autre sujet ou contacter l'administrateur pour ajouter des données.`,
        };
        const lang = config.language || 'vi';
        return {
          answer: noDataMsgs[lang] || noDataMsgs.vi,
          confidence: 0,
          sources: [],
          contextUsed: false,
        };
      }

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
        model: 'gemini-3.5-flash', // ⚡ Stable & Fast
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

    // ⭐ Custom agent KHÔNG có dữ liệu → trả lời rằng không tìm thấy thông tin
    if (agentId && relevantDocs.length === 0) {
      console.log(`⚠️ [RAG Stream] Agent "${agentId}" - no relevant docs found`);
      const noDataMsgs: Record<string, string> = {
        vi: `Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu của bot này.`,
        en: `Sorry, I couldn't find information related to your question in this bot's knowledge base.`,
        ar: `عذراً، لم أتمكن من العثور على معلومات متعلقة بسؤالك.`,
        fr: `Désolé, je n'ai pas trouvé d'informations concernant votre question.`,
      };
      const lang = config.language || 'vi';
      const noDataAnswer = noDataMsgs[lang] || noDataMsgs.vi;
      
      const noDataStream = (async function* () {
        yield { text: () => noDataAnswer };
      })();
      
      return {
        stream: noDataStream,
        sources: [],
        confidence: 0,
        answer: noDataAnswer,
      };
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
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: config.maxOutputTokens || 8192,
        topP: 0.8,
        topK: 20,
      },
    });

    // Collect full answer for history
    let fullAnswer = '';

    const stream = (async function* () {
      try {
        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          fullAnswer += text;
          yield { text: () => text };
        }
      } catch (error) {
        console.error('❌ Stream generation error:', error);
        yield { text: () => '' };
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
      vision: [
        'mù', 'blind', 'thi', 'vision', 'thị', 'nhin', 'mat', 'mắt',
        'braille', 'đọc', 'doc', 'sach', 'man hinh', 'màn hình',
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
      'vision': ['vision', 'sensory-vision'],
      'hearing': ['hearing', 'sensory-hearing'],
      'mobility': ['mobility', 'mobility-transportation', 'neuromusculoskeletal-movement'],
      'communication': ['communication', 'voice-and-speech'],
      'cognition': ['cognition', 'mental-cognitive'],
      'daily_living': ['general', 'daily_living'],
      'education': ['education', 'general'],
      'general': ['general'],
    };
    return map[cat] || [cat];
  }
}

export const ragEngine = new RAGEngine();
