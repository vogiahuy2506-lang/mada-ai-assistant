# Design System — MADA AI Assistant Admin

<!-- impeccable:design-schema 1 -->

## World

**Linear Minimalism × Google AI Studio Console.** Triết lý Linear: tối giản, border mảnh, type ramp rõ ràng, khoảng nghỉ thở nhiều, mono chỉ dùng cho code/ID. Layout pattern AI Studio: 3-pane (left rail · center playground · right inspector), modal nổi cho config sâu. Một observation: visual authority đến từ evidence (consistency chứ không phải filename).

## Palette

| Token | Hex | Vai trò |
|---|---|---|
| `--lin-accent` | `#5e6ad2` | Mọi primary action + focus ring |
| `--lin-accent-soft` | `rgba(94,106,210,0.10)` | Selected row + active tab |
| `--lin-bg` | `#f7f8f9` (light) / `#0f1013` (dark) | Studio shell |
| `--lin-bg-elevated` | `#ffffff` (light) / `#17191d` (dark) | Card / modal / sidebar |
| `--lin-bg-sunken` | `#fcfcfd` (light) / `#1c1e23` (dark) | Stat tile, embed snippet |
| `--lin-border` | `var(--lin-150)` | Card border |
| `--lin-text-primary` | `--lin-1000` | Body |
| `--lin-text-tertiary` | `--lin-500` | Hint, meta |
| `--lin-text-quaternary` | `--lin-400` | Disabled / placeholder |

Trạng thái semantic: `--lin-success #10b981`, `--lin-warning #f59e0b`, `--lin-danger #ef4444`.

## Typography

- **System sans** (workhorse cho admin chrome, modal body): `Inter`, `-apple-system`.
- **Mono** cho code/ID/embed: `ui-monospace, SFMono-Regular`.
- Ramp: 10.5 / 11 / 12 / 12.5 / 13 / 14 / 15 / 20 / 24.
- Tracking: `-0.01em` cho title; `-0.02em` cho display stat.
- Ban kicker/eyebrow — heading nói trực tiếp, không cần label trên đầu.

## Component Primitives

- `lin-btn` + variants (`primary` | `secondary` | `ghost` | `danger`).
- `lin-input` / `lin-textarea` / `lin-select` đồng bộ height 32 (md), 26 (sm).
- `lin-card` + `lin-card-hover` — flat, không shadow, padding 16.
- `lin-badge` + tones (neutral/accent/success/warning/danger).
- `Modal` + `Tabs` + `Toggle` + `Field` + `SearchInput` + `EmptyState` + `PageHeader` + `StatTile` + `Toolbar`.

## Layout

### Admin Shell
4 hub sidebar (Operations / Content / Chatbots / System), sticky. Mỗi hub 1 page lớn ở main.

### AI Assistants Studio (`/admin/chatbots`)
3-column Linear-style:
- **Left rail 240px:** bot list 7 fixed, search box, quick toggle on hover.
- **Center playground flex:** full-height chat — model picker, language toggle, Người dùng/Chuyên gia, messages stream, sources, composer.
- **Right inspector 320px:** identity compact + quick action (Bật/Tắt) + 6 config buttons grid 2×3 (mở `ConfigModal`).

### ConfigModal
Width 920, max-height calc(100vh − 24px). Header show bot avatar/name + ID + dirty badge. Body có sub-tabs (Basics · Prompt · Knowledge · Questions · Widget · Behavior). Footer có hint phím tắt + nút "Huỷ thay đổi" + "Lưu cấu hình". Esc đóng, click backdrop đóng.

## State Patterns

- `useState` cho in-page ephemeral state (composer text, modal open).
- **Draft pattern:** parent owns `draft: StudioBot | null`; child emit `onUpdate(patch)`; parent merge save with PUT. Modal dùng cùng pattern — luôn là 1 source of truth.
- Optimistic toggle cho `isActive`: set state trước, rollback nếu API fail.
- Playground đọc `draft` real-time — UI test được ngay khi gõ, không cần Save.

## Motion

- Toggle switch: `transform 180ms cubic-bezier(0.16,1,0.3,1)`.
- Modal enter: instant (no flash); backdrop `backdrop-filter: blur(2px)` + `rgba(15,16,19,0.4)`.
- Auto-save composer height.
- Scrollbar custom `.lin-scroll` thanh mảnh 6px, không thanh ngang.

## Accessibility

- Focus ring `--lin-focus`: 2px solid var(--lin-accent) + offset 2px.
- Toggle role=`switch` + aria-checked.
- Modal trap focus bằng `useEffect keydown` (Esc đóng).
- ARIA ưu tiên semantic HTML (button/list/heading) hơn role mocking.

## Assets

- Icons: `lucide-react` (only icon lib chuẩn).
- Logo: MADA (existing).
- No emoji-as-icon trong chrome — emoji chỉ xuất hiện trong tab labels, avatar fallback, sample prompts.
- No hard offset shadow, no glass, no gradient text.

## Conventions

- Mỗi tab trong modal PASS bằng `(bot, draft, isDirty, saving, onUpdate, onSave, onReset)` — same shape.
- Inline color usage thông qua `var(--lin-*)`, không hardcode hex ngoài constants.
- Vietnamese là default copy; English key trong labels khả thi (`Cơ bản/Basics`).
- Cursor pointers đúng nghĩa: chỉ button/link/selectable.
