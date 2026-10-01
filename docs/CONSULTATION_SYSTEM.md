# Hệ thống Tư vấn Sản phẩm (Consultation System)

## Tổng quan

Hệ thống tư vấn sản phẩm với khả năng hỏi lại khách hàng (Follow-up Questions) giúp đề xuất thiết bị công nghệ hỗ trợ (AT) phù hợp nhất dựa trên nhu cầu cụ thể của từng người dùng.

## Tính năng chính

### 1. Hỗ trợ đa ngôn ngữ (Multi-language)
- **Tiếng Việt** (vi) - 🇻🇳
- **Tiếng Anh** (en) - 🇬🇧
- **Tiếng Ả Rập** (ar) - 🇸🇦
- **Tiếng Pháp** (fr) - 🇫🇷

Hệ thống tự động:
- Phát hiện ngôn ngữ từ tin nhắn người dùng
- Phản hồi bằng đúng ngôn ngữ của người dùng
- Retry nếu phản hồi bằng ngôn ngữ sai

### 2. Hỏi lại khách hàng (Follow-up Questions)

Hệ thống hỏi 2-3 câu hỏi cụ thể để làm rõ nhu cầu:

#### Ví dụ với người đau:
```
🤔 Bạn đau ở vị trí nào trên cơ thể? (đầu, cổ, lưng, chân, tay...)
💡 Mức độ đau như thế nào? (nhẹ, vừa, nặng)
⏰ Đau khi nào? (khi vận động, khi nghỉ, cả ngày...)
```

#### Ví dụ với người khó nghe:
```
👂 Mức độ khó nghe của bạn như thế nào? (nghe kém nhẹ, trung bình, nặng)
💬 Bạn có gặp khó khăn khi nghe trong môi trường ồn ào không?
🎧 Bạn đã từng sử dụng thiết bị hỗ trợ nghe chưa?
```

#### Ví dụ với người khó nhìn:
```
👁️ Mức độ khó nhìn của bạn như thế nào? (nhìn mờ, nhìn hạn chế, không nhìn được)
📖 Bạn có cần hỗ trợ để đọc sách hoặc tài liệu không?
🏠 Bạn có gặp khó khăn khi di chuyển trong nhà hoặc ngoài đường không?
```

### 3. Phát hiện danh mục tự động
Hệ thống tự động phát hiện danh mục thiết bị:
- 👁️ **Thị giác** (Vision)
- 🔊 **Thính giác** (Hearing)
- 💬 **Giao tiếp** (Communication)
- 🦽 **Vận động** (Mobility)
- 🧠 **Nhận thức** (Cognition)
- 🏠 **Sinh hoạt** (Daily Living)

## API Endpoints

### 1. Bắt đầu tư vấn
```http
POST /api/consultation/start
Content-Type: application/json

{
  "message": "Tôi bị đau lưng và khó đi lại",
  "language": "vi"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "consult-1234567890-abc",
    "category": "mobility",
    "welcomeMessage": "Cảm ơn bạn đã chia sẻ! Để tư vấn chính xác hơn, mình cần hỏi thêm một vài câu nhé. 💡",
    "initialQuestions": [
      "🤔 Bạn đau ở vị trí nào trên cơ thể? (đầu, cổ, lưng, chân, tay...)",
      "💡 Mức độ đau như thế nào? (nhẹ, vừa, nặng)",
      "⏰ Đau khi nào? (khi vận động, khi nghỉ, cả ngày...)"
    ],
    "phase": "gathering",
    "language": "vi"
  }
}
```

### 2. Gửi câu trả lời
```http
POST /api/consultation/answer
Content-Type: application/json

{
  "sessionId": "consult-1234567890-abc",
  "question": "Bạn đau ở vị trí nào trên cơ thể?",
  "answer": "Tôi đau ở lưng dưới, gần eo",
  "userReady": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "consult-1234567890-abc",
    "phase": "gathering",
    "nextQuestions": [
      "💡 Mức độ đau như thế nào? (nhẹ, vừa, nặng)",
      "🏃 Bạn có thể đứng và đi được một đoạn ngắn không?"
    ]
  }
}
```

### 3. Yêu cầu đề xuất
```http
POST /api/consultation/recommend
Content-Type: application/json

{
  "sessionId": "consult-1234567890-abc"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "consult-1234567890-abc",
    "phase": "recommending",
    "recommendations": [
      {
        "id": "rec-0",
        "title": "Xe lăn điện",
        "description": "Thiết bị di chuyển cho người khuyết tật vận động...",
        "category": "mobility",
        "confidence": 0.85
      }
    ],
    "explanation": "Dựa trên thông tin bạn cung cấp, đây là những gợi ý của mình:",
    "confidence": 0.9
  }
}
```

### 4. Chat với chế độ tư vấn
```http
POST /api/chat/consultation
Content-Type: application/json

{
  "message": "Tôi cần tư vấn về xe lăn",
  "language": "vi"
}
```

### 5. Trạng thái phiên tư vấn
```http
GET /api/consultation/status/:sessionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "phase": "gathering",
    "answersCount": 2,
    "questionsAsked": 4
  }
}
```

### 6. Xóa phiên tư vấn
```http
DELETE /api/consultation/:sessionId
```

### 7. Lịch sử phiên tư vấn
```http
GET /api/consultation/history/:sessionId
```

### 8. Đề xuất nhanh (không qua hỏi)
```http
POST /api/consultation/quick-recommend
Content-Type: application/json

{
  "message": "Tai nghe cho người điếc",
  "language": "vi"
}
```

### 9. So sánh sản phẩm
```http
POST /api/consultation/compare
Content-Type: application/json

{
  "products": [
    { "title": "Phonak Audeo", "description": "..." },
    { "title": "Oticon Opn", "description": "..." }
  ],
  "language": "vi"
}
```

## Cấu trúc dữ liệu

### ConsultationSession
```typescript
interface ConsultationSession {
  id: string;                    // ID phiên tư vấn
  userMessage: string;           // Tin nhắn ban đầu của người dùng
  language: string;               // Ngôn ngữ (vi/en/ar/fr)
  answers: ConsultationAnswer[];  // Danh sách câu hỏi và câu trả lời
  currentPhase: 'initial' | 'gathering' | 'recommending';
  questionsAsked: number;         // Số câu hỏi đã hỏi
  category?: string;              // Danh mục thiết bị phát hiện
  createdAt: string;              // Thời gian tạo
}
```

### ConsultationAnswer
```typescript
interface ConsultationAnswer {
  question: string;    // Câu hỏi
  answer: string;      // Câu trả lời
  timestamp: string;   // Thời gian trả lời
}
```

## Luồng hoạt động

```
┌─────────────────────────────────────────────────────────────┐
│                    BẮT ĐẦU TƯ VẤN                           │
│                     /api/consultation/start                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Phát hiện ngôn ngữ │
                    │  Phát hiện danh mục │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Gửi 2-3 câu hỏi   │
                    │    đầu tiên         │
                    └─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     GIAI ĐOẠN THU THẬP                      │
│                  /api/consultation/answer                    │
│                                                              │
│    Lặp lại cho đến khi:                                     │
│    • Đã hỏi đủ 3-5 câu                                      │
│    • Hoặc userReady = true                                   │
│    • Hoặc đã xác định rõ danh mục + 2 câu trả lời           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   CHUYỂN SANG GIAI   │
                    │     ĐOẠN ĐỀ XUẤT     │
                    │  /api/consultation/   │
                    │      recommend       │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  RAG query với đầy  │
                    │  đủ context          │
                    │  Trả về sản phẩm    │
                    └─────────────────────┘
```

## Các file chính

| File | Mô tả |
|------|-------|
| `server/lib/consultationEngine.ts` | Engine xử lý tư vấn |
| `server/routes/consultation-api.ts` | API endpoints |
| `server/routes/chat.ts` | Tích hợp chat với tư vấn |

## Tùy chỉnh câu hỏi

Có thể tùy chỉnh câu hỏi trong `consultationEngine.ts`:

```typescript
const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  {
    condition: '(đau|đau đớn|đau nhức)',
    questions: {
      vi: ['Câu hỏi 1', 'Câu hỏi 2', 'Câu hỏi 3'],
      en: ['Question 1', 'Question 2', 'Question 3'],
      ar: ['السؤال 1', 'السؤال 2', 'السؤال 3'],
      fr: ['Question 1', 'Question 2', 'Question 3'],
    }
  }
];
```

## Cấu hình

### Biến môi trường
```env
# Gemini API (tùy chọn - dùng cho AI question generation)
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.6-flash
```

### Ngưỡng chuyển giai đoạn
```typescript
// Trong consultationEngine.ts
// Chuyển sang giai đoạn đề xuất khi:
// - userReady = true
// - answers.length >= 3
// - category xác định + answers.length >= 2
```
