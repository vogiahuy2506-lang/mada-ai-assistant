/**
 * SkipToContent - WCAG 2.4.1 Bypass Blocks
 * Hidden link cho phép keyboard users skip to main content
 */

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      Bỏ qua đến nội dung chính
    </a>
  );
}
