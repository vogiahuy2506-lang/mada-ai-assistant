// ============== Admin Theme Hook ==============
// Quản lý class `dark` trên <html> để Linear design system hoạt động
// ở cả 2 chế độ. Đồng bộ với useThemeStore để các trang khác
// (chat, widget) không bị đổi hành vi ngoài ý muốn.

import { useEffect, useCallback } from 'react';
import { useThemeStore } from '@/stores';

export function useAdminTheme() {
  const isDark = useThemeStore((s) => s.isDark);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Sync class vào <html> khi theme đổi
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const toggle = useCallback(() => {
    setTheme(!isDark);
  }, [isDark, setTheme]);

  return { isDark, toggle };
}