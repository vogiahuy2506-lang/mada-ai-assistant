// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { vectorStore } from './vectorStore';
import { rerankService, type RerankableItem } from './rerankService';

// System prompt CHOÁNG - Ngắn gọn, cụ thể, action-oriented
const SYSTEM_PROMPT = `Ban la MADA AI - chuyen gia Cong nghe Ho tro Nguoi khuyet tat.

🍀 QUY TAC VAO:

1. TRA LOI NGAN - TOI DA 5 CAU
2. DUNG SO SANH - NEU CAN
3. GIAI PHAP CU THE - KHONG LAN MAN

🍀 LUON DUA RA:

✓ Ten san pham cu the (neu co)
✓ Gia tien cu the (VND/USD)
✓ Ai nen dung (tre em, nguoi lon, nguoi cao tuoi...)
✓ Uy diem ngan gon

🍀 VI DU:

Cau hoi: "Co thiet bi gi cho nguoi bi dau mat?"

Tra loi: 

**Top 3 goi y:**

1. **Kem chong hanh nang SPF 50+** - 150.000 - 300.000 VND
   - Ai: Tat ca nguoi, dac biet tre em
   - UV: Chan 99% tia UV

2. **Kinh mat chuyen dung** - 500.000 - 2.000.000 VND
   - Ai: Nguoi nhay cam anh sang
   - Loi ich: Giam lo ang, met mat

3. **Dung cu doc sach** - 1.500.000+ VND
   - Ai: Nguoi mat qua 80%
   - Tinh nang: Doc van ban phong to

---

Cau hoi: "Thiet bi gi cho nguoi di xe lan?"

Tra loi:

**Khuyen nghi:**

| Loai | Gia | Phu hop |
|------|-----|---------|
| Xe lan tay co ban | 2-5 triệu | Nguoi tu dong duoc |
| Xe lan dien nhe | 10-20 triệu | Nguoi yeu, cao tuoi |
| Xe lan dien tu dong | 30-60 triệu | Nguoi khong the tu dong |

🍀 CAM:

- Khong dua ra loi khuyen y te/chuan doan
- Khong tu xung "toi la bac si"
- Khong tra loi nhung thu ngoai pham vi AT

🍀 NEU KHONG CHAC CHAN:

Noi: "Toi khong chac chan ve dieu nay. Ban nen hoi them chuyen gia y te."

THOAT NGAY khoi man hinh. Neu nguoi hoi ve y te/chuan doan/benh, tra loi:

"Xin loi, toi chi tu van ve Cong nghe Ho tro. Ve van de y te, ban nen lien he bac si chuyen nghiep."`;

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
  private isConfigured = false;

  initialize(): void {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ Gemini API key not configured. Using mock mode.');
      this.isConfigured = false;
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.isConfigured = true;
    console.log('✅ RAG Engine initialized with Gemini');
  }

  async query(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<RAGResponse> {
    const { topK = 10, systemInstruction } = config; // Increased from 5 to 10

    try {
      // Initialize if not already
      if (!this.isConfigured) {
        this.initialize();
      }

      // Retrieve relevant documents - get more for better context
      const relevantDocs = await vectorStore.search(userQuery, topK * 4); // Get 4x more for richer context

      // Apply re-ranking if available
      let finalDocs = relevantDocs;
      let usedRerank = false;

      if (relevantDocs.length > 0 && rerankService.isReady()) {
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
      const prompt = this.buildPrompt(userQuery, context, conversationHistory, hasContext, systemInstruction);

      // Generate response
      if (this.isConfigured && this.genAI) {
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.3, // Low temp = focused, faster
            maxOutputTokens: config.maxOutputTokens || 8192, // Tăng lên cho file dài
            topP: 0.8,
            topK: 20,
          },
        });

        const result = await model.generateContent(prompt);
        const rawAnswer = result.response.text();
        const answer = postProcessMarkdown(rawAnswer);

        return {
          answer,
          confidence: this.calculateConfidence(finalDocs, hasContext),
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
      } else {
        // Fallback to mock response
        return this.mockResponse(userQuery, relevantDocs);
      }
    } catch (error) {
      console.error('❌ RAG query failed:', error);
      throw error;
    }
  }

  private buildPrompt(
    userQuery: string,
    context: string,
    conversationHistory: Array<{ role: string; content: string }>,
    hasContext: boolean,
    systemInstruction?: string
  ): string {
    const historyStr = conversationHistory.length > 0
      ? conversationHistory
          .map((msg) => `${msg.role === 'user' ? 'Nguoi dung' : 'MADA AI'}: ${msg.content}`)
          .join('\n')
      : '';

    const basePrompt = systemInstruction || SYSTEM_PROMPT;

    return `${basePrompt}

CHI DAN TRA LOI:
- Tra loi NGAN GON, DUNG TRONG TAM cau hoi
- Chi dung thong tin TU NGUON, khong lan man
- Dung dong ngay sau khi da tra loi du
- Neu khong co thong tin: "Toi khong tim thay thong tin ve [chu de] trong co so du lieu."

${hasContext ? `📚 THONG TIN TU CO SO TRI THUC:
${context}

---` : ''}
${historyStr ? `📝 LICH SU:
${historyStr}

---` : ''}
❓ Cau hoi: ${userQuery}

🤖 Tra loi ngan gon, dung trong tam:`;
  }

  private calculateConfidence(relevantDocs: any[], hasContext: boolean): number {
    if (!hasContext) return 50;

    const docCount = relevantDocs.length;
    if (docCount >= 3) return 95;
    if (docCount >= 2) return 85;
    if (docCount >= 1) return 75;

    return 65;
  }

  private async mockResponse(query: string, docs: any[]): Promise<RAGResponse> {
    const category = this.detectCategory(query);

    if (docs.length > 0) {
      const mainDoc = docs[0];
      const title = mainDoc.metadata?.title || 'Tai lieu tham khao';
      const content = mainDoc.content || '';

      const categoryIntro: Record<string, string> = {
        mobility: 'Ve thiet bi van dong va xe lan, ',
        vision: 'Ve thiet bi ho tro thi giac, ',
        hearing: 'Ve thiet bi ho tro thinh giac, ',
        cognition: 'Ve thiet bi ho tro nhan thuc, ',
        communication: 'Ve thiet bi giao tiep, ',
        daily_living: 'Ve thiet bi ho tro sinh hoat, ',
        education: 'Ve thiet bi giao duc, ',
        general: '',
      };

      const summary = content
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .slice(0, 4)
        .join('\n');

      const answer = postProcessMarkdown(
        `${categoryIntro[category] || ''}**${title}**:\n\n${summary}\n\n---\n\n*Nguon: ${mainDoc.metadata?.source || 'Unknown'}*`
      );

      return {
        answer,
        confidence: 75,
        sources: docs.map((doc) => ({
          content: doc.content.slice(0, 200) + (doc.content.length > 200 ? '...' : ''),
          source: doc.metadata?.source || 'Unknown',
          metadata: doc.metadata,
        })),
        contextUsed: true,
        usedRerank: false,
      };
    }

    return {
      answer:
        'Xin loi, toi chua co du lieu ve chu de nay. Ban co the:\n\n1. Upload them tai lieu vao Knowledge Base\n2. Scrape them nguon tu web\n3. Lien he chuyen gia neu can',
      confidence: 30,
      sources: [],
      contextUsed: false,
      usedRerank: false,
    };
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
}

export const ragEngine = new RAGEngine();
