# RAG Engine - Gemini SDK Workaround

## Vấn đề

**SDK**: `@google/generative-ai@0.24.1` (latest version)
**Model**: `gemini-2.5-flash` / `gemini-3.5-flash`
**Issue**: SDK không parse `functionCall` trong response → `response.functionCalls = undefined` → `response.text() = ""`

### Reproduction

```typescript
// Cấu hình giống RAG engine:
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{ functionDeclarations: [RAG_RESPONSE_SCHEMA] }],
});

// Gọi:
const result = await model.generateContent(prompt);
const response = result.response;

// Bug:
console.log(response.functionCalls); // undefined (phải có 1 fn call!)
console.log(response.text());        // "" (phải có text)
console.log(result.response.candidates[0].content.parts[0].functionCall); // ✅ CÓ!
```

### Root Cause

SDK version 0.24.1 không handle đúng format response từ Gemini 2.5+/3.5+ khi model trả về function call. Format API trả về:

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "functionCall": {
          "name": "rag_response",
          "args": { "replyText": "actual content here..." }
        }
      }]
    },
    "finishReason": "STOP"
  }]
}
```

SDK expect format khác và silently fail.

## Workaround

Trong `server/lib/rag/ragEngine.ts`, method `extractAnswerFromRawResponse()` parse thủ công từ raw response:

```typescript
private extractAnswerFromRawResponse(result: any): string {
  const candidates = result?.response?.candidates || [];
  const parts = candidates[0]?.content?.parts || [];

  // Priority 1: functionCall.args (structured output)
  for (const part of parts) {
    if (part?.functionCall?.args) {
      const args = part.functionCall.args;
      if (args.replyText) return String(args.replyText);
      if (args.answer) return String(args.answer);
      if (args.response) return String(args.response);
      if (args.text) return String(args.text);
      if (args.content) return String(args.content);
    }
  }

  // Priority 2: inline text
  for (const part of parts) {
    if (part?.text) return String(part.text);
  }

  // Priority 3: SDK text() function
  return result.response.text?.() || '';
}
```

Flow:
1. SDK parses `functionCalls` đúng → dùng SDK (case thường)
2. SDK parses `text` đúng → dùng SDK
3. **Cả 2 fail** → fallback manual parse từ raw response

## Long-term Solution

Khi muốn fix chính thức, có 2 options:

### Option A: Migrate sang SDK mới `@google/genai` (recommended)

```bash
npm install @google/genai
```

API mới:
```typescript
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    tools: [{ functionDeclarations: [RAG_RESPONSE_SCHEMA] }],
  },
});
console.log(response.text); // ✅ Direct text access
```

**Pros**: Official Google SDK mới nhất, support đầy đủ Gemini 2.5+/3.5+
**Cons**: Refactor lớn, cần test kỹ

### Option B: Pin Gemini model cũ hơn (temporary)

Dùng `gemini-2.0-flash` thay vì `2.5`/`3.5`. SDK cũ support tốt hơn.

**Pros**: Không cần refactor
**Cons**: Model cũ hơn, có thể bị Google deprecate

### Decision (2026-08-15)

Giữ workaround hiện tại vì:
- Work cho cả 4 ngôn ngữ (VI/EN/AR/FR)
- Đã test regression OK
- Không break code khác
- Có thể migrate sang SDK mới khi có thời gian refactor

## Testing

```bash
# Verify 4 languages:
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What products for hearing impaired?","language":"en","agentId":"MADA_USER"}'

# Expected: 500+ chars answer (không phải 0 chars)
```

## Files Changed

- `server/lib/rag/ragEngine.ts`:
  - Method `extractAnswerFromRawResponse()` - manual parse fallback
  - 3-tier fallback chain trong `query()` method