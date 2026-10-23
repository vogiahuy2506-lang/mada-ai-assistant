/**
 * ⭐ Quyết định duy nhất: có gọi `getSuggestedProducts()` hay không.
 *
 * ⚠️ VÌ SAO TÁCH RA FILE NÀY:
 * Trước đây nhánh STREAMING (`/api/chat/stream`) và nhánh NON-STREAMING
 * (`/api/chat`) dùng HAI điều kiện KHÁC NHAU:
 *
 *   - Non-stream: `allowProducts && (shouldShowProducts(msg) || allowProducts) && (...)`
 *     với `allowProducts = consultedDone || explicitProductQuery`
 *   - Streaming:  `(shouldShow || isReadyForProductSuggestion) && (...)`
 *     → KHÔNG hề dùng `consultQuestionsCompleted`.
 *
 * Hệ quả (BUG thật, đã tái hiện được trên production):
 * Khách trả lời đủ 4 câu hỏi tiêu chuẩn → bot hỏi "bạn có muốn xem sản
 * phẩm không?" → khách trả lời "có".
 *
 *   - Non-stream → CÓ card sản phẩm ✅
 *   - Streaming  → KHÔNG có card ❌
 *
 * Lý do: cờ `isReadyForProductSuggestion` do frontend gửi lên được tính từ
 * bộ regex RIÊNG (`hasSymptom`/`hasSeverity`/`hasDuration`) khác hẳn bộ
 * detector chính thức của 4 câu hỏi tiêu chuẩn (`hasCompletedConsultQuestions`).
 * Hai bộ này hay LỆCH: khách trả lời mức độ bằng "không thể đi lại" hoặc
 * "2 tháng nay" → detector chuẩn báo ĐÃ ĐỦ, nhưng bộ regex cũ báo thiếu →
 * `isReadyForProductSuggestion = false`.
 *
 * Ở lượt duyệt ("có"), câu hỏi KHÔNG chứa từ khoá sản phẩm nên
 * `shouldShowProducts() = false` → nhánh streaming rơi hết → không gửi card.
 *
 * → Sửa: cả 2 nhánh dùng CHUNG hàm `shouldFetchProducts()` dưới đây, và cờ
 * `consultedQuestionsCompleted` (dùng detector chuẩn) được tính là điều kiện
 * đủ để gợi ý sản phẩm.
 */

export interface ProductGateInput {
  /** `shouldShowProducts(message)` — câu hỏi có chứa từ khoá sản phẩm. */
  keywordMatch: boolean;

  /** Cờ `isReadyForProductSuggestion` do client gửi lên. */
  isReadyForProductSuggestion: boolean;

  /** `isExplicitProductRequest(message)` — khách yêu cầu xem sản phẩm rõ ràng. */
  isExplicitRequest: boolean;

  /**
   * ⭐ Client đã trả lời đủ bộ 4 câu hỏi tiêu chuẩn.
   * Tính bằng detector CHÍNH THỨC (`hasCompletedConsultQuestions`).
   */
  consultedQuestionsCompleted: boolean;

  /**
   * ⭐ Server TỰ nhận diện câu hỏi có nhắc đúng TÊN sản phẩm trong DB
   * (không tin cờ của client).
   */
  isExplicitProductQuery: boolean;

  /** Số lượt hỏi đáp trong cuộc trò chuyện. */
  conversationTurns: number;
}

/**
 * ⭐ Điều kiện đủ điều kiện gợi ý sản phẩm — dùng chung cho cả streaming
 * và non-streaming.
 *
 * QUY TẮC NGHIỆP VỤ:
 *  1. Đã trả lời đủ 4 câu hỏi tiêu chuẩn → ĐƯỢC gợi ý sản phẩm.
 *  2. Khách hỏi thẳng tên sản phẩm → ĐƯỢC gợi ý (chỉ sản phẩm đó).
 *  3. Khách nói "gợi ý sản phẩm" / "xem sản phẩm" → ĐƯỢC gợi ý.
 *  4. Còn lại (chưa đủ context) → KHÔNG gợi ý, để bot hỏi thêm.
 */
export function shouldFetchProducts(input: ProductGateInput): boolean {
  const {
    keywordMatch,
    isReadyForProductSuggestion,
    isExplicitRequest,
    consultedQuestionsCompleted,
    isExplicitProductQuery,
    conversationTurns,
  } = input;

  // Đã đủ 4 câu hỏi, hoặc hỏi thẳng tên sản phẩm → được phép gợi ý.
  const allowProducts = consultedQuestionsCompleted || isExplicitProductQuery;

  const hasEntryCondition =
    allowProducts || keywordMatch || isReadyForProductSuggestion;

  const hasContextCondition =
    conversationTurns >= 3 ||
    isReadyForProductSuggestion ||
    isExplicitRequest ||
    allowProducts;

  return hasEntryCondition && hasContextCondition;
}
