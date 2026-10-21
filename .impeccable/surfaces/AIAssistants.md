# Surface Brief — Admin AI Assistants Studio

**Surface:** `/admin/chatbots`
**Artifact entry:** `src/pages/admin/AIAssistants/index.tsx`
**Mode:** Operate (admin cấu hình — completion > showcase)
**Visitor:** Admin MADA; Operator persona.

## Audience, Job, Action, Constraints

- **Audience:** MADA admin operator cấu hình 7 bot fixed của hệ thống.
- **Job:** Edit avatar / prompt / KB / widget / behavior / questions trên 1 bot đã chọn, trong khi test ngay trong playground.
- **Action:** Chọn bot → sửa dạng modal → draft / save → test trực tiếp. Không rời khỏi viewport playground.
- **Constraint:** Tối đa 7 bot; override per-bot reset về global trong 1 click; chỉ founder/CTA duy nhất là Save.
- **Constraint:** Disabled state của bot hiển thị rõ; modal phải trap focus và đóng bằng Esc.

## Direction (pinned — Linear Minimalism × Google AI Studio)

Brief ghim visual world: **Linear Minimalism** (đã codified trong `src/styles/linear-admin.css`) + layout pattern tham chiếu **Google AI Studio / Anthropic Console**:
- Left rail 240px = list bot cố định + settings button.
- Center = **Playground chat** (chiếm ~55% wide, full height), composer ở cuối giống AI Studio.
- Right rail 320px = Inspector nhỏ (`model`, `embed snippet`, `quick stats`, nút mở modal từng config group).
- **Các chỉnh sửa chi tiết → MODAL** không phải tab trung tâm. Modal có section tabs BÊN TRONG để gom `Basics · Prompt · Knowledge · Questions · Widget · Behavior`.

## Memorable Moment

Khi admin đổi `system_prompt` ở modal Prompt → nhấn ra ngoài → composer phản hồi ngay bằng câu mới vì playground đọc `draft` real-time. Đây là cái "Aha" — không cần Save để test.

## Unresolved Decisions

- Có nên show lịch sử chat persist hay ephemeral? Hiện đang ephemeral (in-memory) trong playground.
- Modal editing có dùng tab sections bên trong (mỗi modal 6 tabs) hay là split-modal nhiều modal? Đang chọn 1 modal với tab bên trong để giữ 1 stack.
- Stats nhanh ở Inspector: chunks count, last crawl status, linked products count, isActive.
