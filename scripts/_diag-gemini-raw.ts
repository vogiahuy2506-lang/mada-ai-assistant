import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY!;
const N = parseInt(process.argv[2] || '33', 10);
const items = Array.from({ length: N }, (_, i) => ({
  id: 'doc' + i,
  content: `Tài liệu ${i} về công nghệ hỗ trợ. ` + 'Nội dung mô tả chi tiết về thiết bị và phương pháp sử dụng. '.repeat(12),
}));

const itemsJson = items
  .map((item, idx) => `[${idx}] (id: ${item.id})\n${item.content.slice(0, 500)}`)
  .join('\n\n');

const prompt = `Bạn là một AI đánh giá mức độ liên quan (relevance scorer) cho hệ thống RAG về Công nghệ Hỗ trợ (Assistive Technology).

# Truy vấn của người dùng
"""xin chào"""

# Danh sách ${items.length} tài liệu ứng viên
${itemsJson}

# Yêu cầu
Cho điểm mức độ liên quan của MỖI tài liệu với truy vấn, thang điểm 0.0 - 1.0:
- 0.0 - 0.3: Không liên quan

# Định dạng output (CHỈ trả về JSON, không có text khác):
{
  "scores": [score_0, score_1, ..., score_${items.length - 1}],
  "reasons": ["lý do ngắn cho item 0", "lý do cho item 1", ...]
}

QUAN TRỌNG: Chỉ trả về JSON object, không thêm markdown code block hay giải thích.`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

const schema = {
  name: 'rerank_response',
  description: 'Gemini rerank response với scores và reasons',
  parameters: {
    type: 'object',
    properties: {
      scores: { type: 'array', description: 'Mảng scores 0..1', items: { type: 'number' } },
      reasoning: { type: 'string' },
    },
    required: ['scores'],
  },
};

(async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
      tools: [{ functionDeclarations: [schema] }],
    }),
  });
  const json: any = await res.json();
  console.log('STATUS', res.status, 'finishReason:', json?.candidates?.[0]?.finishReason);
  const parts = json?.candidates?.[0]?.content?.parts || [];
  console.log('parts types:', parts.map((p: any) => Object.keys(p).join('+')));
  const fc = parts.find((p: any) => p.functionCall);
  if (fc) {
    console.log('FUNCTION CALL args.scores len =', fc.functionCall.args?.scores?.length);
    console.log('sample:', JSON.stringify(fc.functionCall.args?.scores?.slice(0, 8)));
  }
  const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
  console.log('TEXT len:', text.length, 'head:', JSON.stringify(text.slice(0, 300)));
  process.exit(0);
})();
