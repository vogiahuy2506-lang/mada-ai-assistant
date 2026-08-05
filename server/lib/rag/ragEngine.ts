import { GoogleGenerativeAI } from '@google/generative-ai';
import { vectorStore } from './vectorStore';

// System prompt for MADA AI - ENHANCED VERSION
const SYSTEM_PROMPT = `
Ban la MADA AI Expert - chuyen gia hang dau ve Cong nghe Ho tro (Assistive Technology).

CHUYEN MON:
- Thiet bi ho tro nguoi khuyet tat (AT Devices)
- Tieu chuan quoc te: WCAG 2.1/2.2, ISO 9999, WHO GATE, ADA
- Giai phap cho: khieu thi, khieu thinh, van dong kem, nhan thuc, giao tiep

PHONG CACH TRA LOI XIZ XO:

1. CAU TRUC BAT BUOC:
   [Tra loi ngan gon 1-2 cau]

   - Phan tich chi tiet
   - Top 3-5 san pham/thiet bi tot nhat voi gia cu the
   - Bang so sanh gia, pros/cons
   - Khuyen nghi theo tung truong hop:
     * Hoc sinh/Sinh vien
     * Van phong/Nhan vien
     * Nguoi cao tuoi
     * Ngan sach han che

2. DINH DANG BAT BUOC:

KHI LIET KE -> Dung bullet points tren dong rieng:
- **Ten san pham**: Mo ta ngan
- **Ten san pham**: Mo ta ngan

KHI SO SANH -> Dung bang markdown:
| Tieu chi | San pham A | San pham B |
|----------|------------|------------|
| Gia | xxx | xxx |

LUON DUNG:
- **Bold** cho ten san pham, thuong hieu
- Tieu de phu cho moi phan
- Gia tham khao (USD/VND)

3. THONG TIN BAT BUOC THEM:
- Gia tham khao
- Danh gia tong the
- Phu hop voi doi tuong nao
- Diem noi bat
- Nhuoc diem can luu y

4. VI DU MINH HOA:

That tot! Tra loi nhu chuyen gia thuc thu:

## Phan mem doc man hinh - Giai phap cho nguoi khiem thi

Tom tat: Day la cac cong cu giup nguoi khiem thi tuong tac voi may tinh thong qua am thanh.

### Cac phan mem pho bien:

| Phan mem | Gia | Diem manh | Phu hop |
|----------|-----|-----------|---------|
| **JAWS** | ~$1000/nam | 40+ ngon ngu | Windows chuyen nghiep |
| **NVDA** | Mien phi | Nhe, USB duoc | Windows, ngan sach it |
| **VoiceOver** | Mien phi | Tich hop san | macOS/iOS |
| **Narrator** | Mien phi | Windows 10/11 | Su dung co ban |

### Top 3 khuyen nghi:
- **NVDA** - Mien phi, tot nhat ve chi phi
- **JAWS** - Chuyen nghiep, nhieu tinh nang
- **VoiceOver** - Apple, mien phi voi Apple

### Khuyen nghi theo nhu cau:
- Ngan sach it: NVDA (mien phi)
- Hoc sinh/sinh vien: NVDA hoac VoiceOver
- Van phong: JAWS hoac VoiceOver

5. AN TOAN:
- Khong dua ra loi khuyen y te
- Luon goi y tham khao chuyen gia
`;

interface RAGResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    content: string;
    source: string;
    metadata?: any;
  }>;
  contextUsed: boolean;
}

interface RAGConfig {
  temperature?: number;
  topK?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

/**
 * Post-process AI response de dam bao list/heading/format markdown hien thi dung
 */
function postProcessMarkdown(text: string): string {
  let result = text;

  // Pattern 1: "*Ten* - mo ta 1 - mo ta 2 - mo ta 3" tren cung 1 dong
  // -> "- **Ten**: mo ta 1. mo ta 2. mo ta 3"
  result = result.replace(
    /\*([^*\n]+)\*\s+-\s+([^-\n]+(?:\s+-\s+[^-\n]+)+)/g,
    (_match, name, desc) => {
      const parts = desc.split(/\s+-\s+/).map((p: string) => p.trim()).filter(Boolean);
      const formatted = parts
        .map((p: string) => p.replace(/^[a-z]/, (c: string) => c.toUpperCase()))
        .join('. ');
      return `- **${name.trim()}**: ${formatted}`;
    }
  );

  // Pattern 2: "*Ten* - mo ta" don gian -> "- **Ten**: mo ta"
  result = result.replace(
    /^(- \*\*[^*]+\*\*:\s+)([^-]+(?:-[^-]+)+)$/gm,
    (_match, prefix, rest) => {
      const parts = rest.split(/\s+-\s+|\s+-/).map((p: string) => p.trim()).filter(Boolean);
      return prefix + parts.join('. ');
    }
  );

  // Pattern 3: Dau "-" khong co space truoc khi viet hoa -> ngat dong
  result = result.replace(
    /([a-z])\s+-\s+([A-Z])/g,
    '$1.\n  - $2'
  );

  // Pattern 4: Sau dau ":" co "*Ten*" ngay -> them ngat dong truoc moi item
  result = result.replace(
    /(:\s+)\*([^*\n]+)\*/g,
    (_match, _prefix, name) => `\n\n- **${name.trim()}**`
  );

  // Pattern 5: Item "- **Ten**..." dinh lien nhau -> tach
  result = result.replace(
    /(\S)\s+(- \*\*[^*]+\*\*)/g,
    '$1\n$2'
  );

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
      console.warn('Gemini API key not configured. Using mock mode.');
      this.isConfigured = false;
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.isConfigured = true;
    console.log('RAG Engine initialized with Gemini');
  }

  async query(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    config: RAGConfig = {}
  ): Promise<RAGResponse> {
    const { topK = 5, systemInstruction } = config;

    try {
      // Initialize if not already
      if (!this.isConfigured) {
        this.initialize();
      }

      // Retrieve relevant documents
      const relevantDocs = await vectorStore.search(userQuery, topK);

      // Build context from retrieved documents
      let context = '';
      if (relevantDocs.length > 0) {
        context = relevantDocs
          .map((doc, index) => `[Document ${index + 1}] (Source: ${doc.metadata.source})\n${doc.content}`)
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
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: config.maxOutputTokens ?? 2048,
          },
        });

        const result = await model.generateContent(prompt);
        const rawAnswer = result.response.text();
        const answer = postProcessMarkdown(rawAnswer);

        return {
          answer,
          confidence: this.calculateConfidence(relevantDocs, hasContext),
          sources: relevantDocs.map(doc => ({
            content: doc.content.slice(0, 200) + (doc.content.length > 200 ? '...' : ''),
            source: doc.metadata?.source || 'Unknown',
            metadata: doc.metadata,
          })),
          contextUsed: hasContext,
        };
      } else {
        // Fallback to mock response
        return this.mockResponse(userQuery, relevantDocs);
      }
    } catch (error) {
      console.error('RAG query failed:', error);
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
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n')
      : '';

    const basePrompt = systemInstruction || SYSTEM_PROMPT;

    return `${basePrompt}

${hasContext ? `Co so tri thuc (Knowledge Base):
${context}

---

` : ''}${historyStr ? `Lich su tro chuyen:
${historyStr}

---

` : ''}Cau hoi hien tai:
User: ${userQuery}

Assistant:`;
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

      const summary = content.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).slice(0, 4).join('\n');

      const answer = postProcessMarkdown(`${categoryIntro[category] || 'Dua tren co so tri thuc, '}**${title}**:

${summary}

Nguon: ${mainDoc.metadata?.source || 'MADA Knowledge Base'}
${docs.length > 1 ? `\nCo ${docs.length} tai lieu lien quan duoc tim thay.` : ''}`);

      return {
        answer,
        confidence: docs.length >= 3 ? 88 : docs.length >= 2 ? 82 : 75,
        sources: docs.map(doc => ({
          content: doc.content.slice(0, 200),
          source: doc.metadata?.source || 'Unknown',
          metadata: doc.metadata,
        })),
        contextUsed: true,
      };
    }

    return {
      answer: `Cam on cau hoi cua ban ve **"${query}"**.

Hien tai he thong dang o che do demo va chua tim thay thong tin lien quan trong co so tri thuc. De co cau tra loi thong minh hon:

1. Them **GEMINI_API_KEY** vao file \`.env\`
2. Khoi dong lai server

**Ban cung co the su dung danh muc o sidebar de xem cac cau hoi mau theo tung chuyen khoa AT.*`,
      confidence: 40,
      sources: [],
      contextUsed: false,
    };
  }

  private detectCategory(query: string): string {
    const q = query.toLowerCase();
    if (/\b(xe lan|wheelchair|nang|crutch|nẹp|leo cau thang|mobility|van dong)\b/i.test(q)) return 'mobility';
    if (/\b(kinh|khieu thi|blind|vision|doc man hinh|braille|orcam|jaws|low vision)\b/i.test(q)) return 'vision';
    if (/\b(tro thinh|hearing aid|diếc|deaf|cochlear|tai)\b/i.test(q)) return 'hearing';
    if (/\b(giao tiep|communication|aac|sgd)\b/i.test(q)) return 'communication';
    if (/\b(tri nho|memory|nhan thuc|cognition|alzheimer|autism|tu ky)\b/i.test(q)) return 'cognition';
    if (/\b(an uong|eating|daily|sinh hoat|nha tam|nha bep|grab bar)\b/i.test(q)) return 'daily_living';
    if (/\b(hoc|education|school|doc|reading|writing)\b/i.test(q)) return 'education';
    return 'general';
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const ragEngine = new RAGEngine();
