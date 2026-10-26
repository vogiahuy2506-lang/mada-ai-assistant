/**
 * ⭐ Lớp TƯƠNG THÍCH NGƯỢC cho `@/lib/consultQuestions`.
 *
 * ⚠️ Toàn bộ logic đã được chuyển sang `@/lib/consultCore` — module dùng
 * CHUNG cho cả client (Vite) và server (esbuild).
 *
 * VÌ SAO TÁCH?
 *   Trước đây client và server dùng HAI bộ regex RIÊNG cho bộ 4 câu hỏi
 *   tiêu chuẩn. Hai bộ này lệch nhau → trạng thái "đã đủ 4 câu" ở client và
 *   server khác nhau → server gửi card sản phẩm nhưng client vứt (và ngược
 *   lại). Một bộ logic dùng chung là cách duy nhất để 2 bên luôn khớp.
 *
 * File này giữ nguyên mọi export cũ để không phá vỡ chỗ đang import.
 */

export {
  // Types
  type ConsultQuestionType,
  type ConsultLang,
  type ConsultMessage,
  type ConsultProgress,
  // Câu hỏi
  CONSULT_QUESTION_ORDER,
  CONSULT_QUESTIONS,
  ALL_CONSULT_QUESTION_TEXTS,
  QUESTIONS_FLAT,
  // Detector
  normalizeForMatch,
  detectAnsweredQuestions,
  detectAskedQuestions,
  analyzeConsultProgress,
  hasCompletedConsultQuestions,
  isConsultCompleted,
  // Câu hỏi tiếp theo
  getNextConsultQuestion,
  getNextConsultQuestionFromHistory,
  getSafeNextConsultQuestion,
  isQuestionAlreadyAsked,
  // Dọn nội dung
  stripAlreadyAskedQuestions,
  stripConsultQuestions,
} from './consultCore';
