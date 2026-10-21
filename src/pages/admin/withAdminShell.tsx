// ============== Admin Shell HOC ==============
// Bọc một component admin bất kỳ (kể cả trang tự build layout riêng)
// vào trong AdminShell Linear-style mà KHÔNG cần sửa file gốc.
//
// Dùng cho các trang như WidgetCustomization, AdminFeedbackQuestions
// vốn có layout riêng (header gradient, sidebar custom).
// Chỉ cần export default HOC(OriginalComponent) thay vì component gốc.
//
// `bleed` bật full-height mode: trang con tự lo padding + tự scroll và
// `h-full` của nó bám đúng viewport thay vì chiều cao nội dung. Bắt buộc
// cho layout 3 cột / chat / playground — nếu không, phần cuối (composer,
// thanh hành động) nằm dưới màn hình và phải cuộn mới thấy.

import React from 'react';
import { AdminShell } from './AdminShell';

export interface WithAdminShellOptions {
  bleed?: boolean;
}

export function withAdminShell<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAdminShellOptions = {},
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <AdminShell bleed={options.bleed}>
      <Component {...props} />
    </AdminShell>
  );
  Wrapped.displayName = `withAdminShell(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}