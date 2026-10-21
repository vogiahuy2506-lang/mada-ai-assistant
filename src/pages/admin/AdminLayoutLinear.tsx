// ============== Admin Layout (Linear shell adapter) ==============
// Giữ đúng API của AdminLayout cũ (title/titleKey/subtitle/children)
// nhưng render bên trong AdminShell Linear-style.
// Tất cả 14 trang admin hiện tại chỉ cần đổi 1 dòng import là
// tự động nhận giao diện mới — không phải sửa nội dung page.

import React, { ReactNode } from 'react';
import { AdminShell } from './AdminShell';
import { PageHeader } from './components/ui';
import { useLanguageStore } from '@/stores';
import { translations } from '@/lib/translations';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  titleKey?: string;
  subtitle?: string;
  subtitleKey?: string;
  showFab?: boolean;
  showLayoutTitle?: boolean;
}

function translate(key: string, language: string): string {
  const table = translations as Record<string, Record<string, string>>;
  return table[language]?.[key] ?? table.vi?.[key] ?? key;
}

export function AdminLayout({
  children,
  title,
  titleKey,
  subtitle,
  subtitleKey,
  showLayoutTitle = true,
}: AdminLayoutProps) {
  const language = useLanguageStore((s) => s.language ?? 'vi');

  const resolvedTitle = title ?? (titleKey ? translate(titleKey, language) : undefined);
  const resolvedSubtitle = subtitle ?? (subtitleKey ? translate(subtitleKey, language) : undefined);

  return (
    <AdminShell>
      {showLayoutTitle && (resolvedTitle || resolvedSubtitle) ? (
        <>
          <PageHeader title={resolvedTitle ?? ''} subtitle={resolvedSubtitle} />
          {children}
        </>
      ) : (
        children
      )}
    </AdminShell>
  );
}