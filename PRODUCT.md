# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18 + Vite + TypeScript (client) · Express + better-sqlite3 + RAG (server) · Tailwind-inspired linear-admin design tokens in `src/styles/linear-admin.css`

## Users

- **End user:** Người khuyết tật, người lớn tuổi, người nhà bệnh nhân và chuyên gia CNHT (Assistive Technology specialist) tại Việt Nam truy cập widget chat được nhúng trên website MADA Qatar tiếng Việt/Anh/Pháp/Ả Rập.
- **Admin operator:** MADA team Qatar quản trị toàn bộ sản phẩm AT (sản phẩm, danh mục, scraper, users, support). Họ chịu trách nhiệm cấu hình 7 chatbot cố định cho 6 nhóm khuyết tật + 1 quy định tiêu chuẩn.

## Product Purpose

**`/workspace`** xây dựng nền tảng hỏi–đáp AI về công nghệ trợ giúp (AT). Trợ lý trả lời theo 7 domain cố định bằng RAG dữ liệu đã ingest từ MADA + WHO + ISO + nhà cung cấp, kèm gợi ý sản phẩm curated và câu hỏi gợi ý. Thành công = visitor nhận được thiết bị/tiêu chuẩn phù hợp mà không cần gọi nhân viên.

## Positioning

7 chatbot cố định (mỗi chatbot = một domain khuyết tật) kết hợp RAG + curated product DB + capability plugins + per-bot emotional persona, tất cả cấu hình qua 1 trang studio. Khác với đối thủ dùng 1 chatbot lớn, chia nhỏ theo domain giúp cấu hình nhanh hơn và knowledge base ít bị nhiễu chéo.

## Operating Context

- Cấu hình thường 1–3 ngày/lần; nội dung chính vẫn là sản phẩm, người dùng, KB.
- AI Assistants Studio là 1 hub trong shell admin 4 hub (Operations / Content / Chatbots / System).
- Áp dụng Linear-style minimalism nhưng phải Anthropic/Google AI Studio reference cho phần studio chat.
- Admin thường xuyên A/B thử prompt trước khi publish; cần playground live nhiều-turn.

## Capabilities and Constraints

- **7 bot cố định:** `bot-hearing`, `bot-vision`, `bot-speech`, `bot-cognitive`, `bot-neuro`, `bot-mobility`, `bot-regulatory`.
- **Bốn ngôn ngữ:** vi, en, ar, fr.
- **RAG pipeline:** better-sqlite3 + vector store chunked theo metadata `{agentId, botId, madaCategory}`.
- **Per-bot override:** widget/behavior/publish/greeting/emotion JSON blobs trong `admin_agents`, NULL = inherit global.
- **Constraint:** KHÔNG được tạo/xoá bot — danh sách cố định.
- **Constraint:** mọi cấu hình phải audit được qua `system_events`.
- **Open decision:** Khi bot chưa có trong DB thì studio tự tạo với persona default + knowledge URL MADA.

## Brand Commitments

- **Tên thương hiệu:** MADA (Qatar Center for Assistive Technology).
- **Giọng chuyên nghiệp:** Tiếng Việt mặc định cho admin UI, song ngữ trong widget.
- **Visual reference (pinned):** Linear Minimalism + Google AI Studio / Anthropic Console layout pattern cho playground chat.
- **Assets:** Logo MADA, bộ icon `lucide-react`, không dùng emoji-as-icon trong chrome.

## Evidence on Hand

- `seed-local.ts` seed 7 fixed bot + 5 admin user.
- `kb_products`, `system_events`, `message_feedback`, `consultations`, `admin_agents` đã có data thật.
- Testimonials/case-studies chưa có — KHÔNG được phát minh.

## Product Principles

1. Studio AI Assistants = 1 trang duy nhất, 3 cột (sidebar list · center playground · inspector), KHÔNG chia tab ngang kéo dài.
2. Mọi tùy chỉnh chi tiết thu gọn vào modal — viewport admin luôn giữ được playground "đang chạy" để test ngay.
3. Override per-bot phải reset được về global trong 1 cú click.
4. Disabled state = bot không có trong DB (auto-create) — không bao giờ để trống.

## Accessibility & Inclusion

- WCAG AA — focus ring `--lin-focus`, contrast tối thiểu 4.5:1.
- ARIA: listbox cho bot picker, modal trap focus, escape đóng modal.
- Phím tắt: ⌘K mở bot list, ⌘. mở playground, Esc đóng modal.
