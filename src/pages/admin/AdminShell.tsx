// ============== Admin Shell — Linear-style layout ==============
// Sidebar gọn + topbar mỏng + nội dung rộng. Thay thế AdminLayout cũ
// (glassmorphism, sidebar 256px) bằng phong cách tối giản Linear.
//
// Bước 2 — pivot-shell: 14 mục phẳng đã gom thành 4 hub dạng accordion.
// Mọi route giữ nguyên; chỉ đổi cách trình bày trong sidebar.
//
// Bước 3 — profile lên topbar, sidebar thu gọn/mở rộng được.
// Sidebar collapsed thành icon-rail 52px (Linear-style), nút toggle nằm ở
// đáy sidebar đúng chỗ profile vừa rời đi.

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useLanguageStore } from '@/stores';
import { IconButton } from './components/ui';
import { useAdminTheme } from './hooks/useAdminTheme';

type Language = 'vi' | 'en' | 'ar' | 'fr';

interface NavItem {
  labelKey: string;
  href: string;
  icon: string;
  superAdminOnly?: boolean;
}

interface NavHub {
  id: HubId;
  labelKey: string;
  icon: string;
  items: NavItem[];
}

type HubId = 'dashboard' | 'ai' | 'content' | 'system';

// ---- 14 mục, nhóm thành 4 hub. Thứ tự trong mỗi hub là thứ tự hiển thị.
// superAdminOnly giữ nguyên như trước để không nới quyền.
const NAV_HUBS: NavHub[] = [
  {
    id: 'dashboard',
    labelKey: 'hub.dashboard',
    icon: 'dashboard',
    items: [
      { labelKey: 'admin.layout.navOverview', href: '/admin', icon: 'dashboard' },
      { labelKey: 'admin.layout.navAnalytics', href: '/admin/analytics', icon: 'analytics' },
    ],
  },
  {
    id: 'ai',
    labelKey: 'hub.ai',
    icon: 'smart_toy',
    items: [
      { labelKey: 'admin.layout.navChatbotCenter', href: '/admin/chatbots', icon: 'hub' },
      { labelKey: 'admin.layout.navAgents', href: '/admin/agents', icon: 'smart_toy' },
      { labelKey: 'admin.layout.navSystemPrompts', href: '/admin/prompts', icon: 'edit_note' },
      { labelKey: 'admin.layout.navAiChatbox', href: '/admin/widget', icon: 'web_asset' },
    ],
  },
  {
    id: 'content',
    labelKey: 'hub.content',
    icon: 'inventory_2',
    items: [
      { labelKey: 'admin.layout.navProducts', href: '/admin/products', icon: 'inventory_2' },
      { labelKey: 'admin.layout.navFeedbackQuestions', href: '/admin/feedback-questions', icon: 'thumb_down' },
      { labelKey: 'admin.layout.navConsultations', href: '/admin/consultations', icon: 'support_agent' },
      { labelKey: 'admin.layout.navUsers', href: '/admin/users', icon: 'group' },
    ],
  },
  {
    id: 'system',
    labelKey: 'hub.system',
    icon: 'settings_suggest',
    items: [
      { labelKey: 'admin.layout.navScraper', href: '/admin/scraper', icon: 'cloud_download' },
      { labelKey: 'admin.layout.navFileUpload', href: '/admin/file-management', icon: 'upload_file', superAdminOnly: true },
      { labelKey: 'admin.layout.navPermissions', href: '/admin/permissions', icon: 'admin_panel_settings', superAdminOnly: true },
      { labelKey: 'admin.layout.navSettings', href: '/admin/settings', icon: 'settings_suggest', superAdminOnly: true },
    ],
  },
];

const ICONS: Record<string, JSX.Element> = {
  dashboard: <path d="M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z" />,
  hub: <><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="19" r="1.6" /><circle cx="5" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  smart_toy: <><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" /><path d="M2.5 12v3M21.5 12v3" /></>,
  edit_note: <><path d="M5 4h9l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M14 4v5h5M8 13h8M8 17h5" /></>,
  web_asset: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M7 18v2M17 18v2M7 13h4" /></>,
  support_agent: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0M18 8h3M19.5 6.5v3" /></>,
  group: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 5.5a3 3 0 010 5M17 20a6 6 0 00-1.5-4" /></>,
  inventory_2: <><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  thumb_down: <><path d="M7 4v10M7 14l-4 6h10a2 2 0 002-2v-8a2 2 0 00-2-2H7zM7 4a2 2 0 012-2h4l-2 6" /></>,
  cloud_download: <><path d="M7 17a4 4 0 010-8 6 6 0 0111.5 1.5A3.5 3.5 0 0118 17H7z" /><path d="M12 11v8M9.5 16.5L12 19l2.5-2.5" /></>,
  analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  upload_file: <><path d="M14 3v5h5" /><path d="M19 8v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1h8l5 5z" /></>,
  admin_panel_settings: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" /></>,
  settings_suggest: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
};

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      className="w-[15px] h-[15px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: active ? 'var(--lin-accent)' : 'var(--lin-text-tertiary)' }}
      viewBox="0 0 24 24"
    >
      {d}
    </svg>
  );
}

// Nhãn đầy đủ 4 ngôn ngữ. `Record<Language, Labels>` — value là object, không phải string.
// (Trước đây khai báo `Record<string, string>` khiến 18 lỗi TS dây chuyền.)
type Labels = {
  overview: string;
  chatbots: string;
  agents: string;
  prompts: string;
  widget: string;
  consultations: string;
  users: string;
  products: string;
  feedback: string;
  scraper: string;
  analytics: string;
  files: string;
  permissions: string;
  settings: string;
};

type LabelKey = keyof Labels;

const LABELS: Record<Language, Labels> = {
  vi: {
    overview: 'Tổng quan',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    widget: 'AI Chatbox',
    consultations: 'Hỗ trợ',
    users: 'Người dùng',
    products: 'Sản phẩm',
    feedback: 'Phản hồi',
    scraper: 'Scraper',
    analytics: 'Báo cáo',
    files: 'Quản lý file',
    permissions: 'Phân quyền',
    settings: 'Cài đặt',
  },
  en: {
    overview: 'Overview',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    widget: 'AI Chatbox',
    consultations: 'Consultations',
    users: 'Users',
    products: 'Products',
    feedback: 'Feedback',
    scraper: 'Scraper',
    analytics: 'Reports',
    files: 'File Management',
    permissions: 'Permissions',
    settings: 'Settings',
  },
  // AR/FR chưa có bản dịch riêng cho shell: dùng VI/EN theo thứ tự ưu tiên.
  ar: {
    overview: 'Tổng quan',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    widget: 'AI Chatbox',
    consultations: 'Hỗ trợ',
    users: 'Người dùng',
    products: 'Sản phẩm',
    feedback: 'Phản hồi',
    scraper: 'Scraper',
    analytics: 'Báo cáo',
    files: 'Quản lý file',
    permissions: 'Phân quyền',
    settings: 'Cài đặt',
  },
  fr: {
    overview: 'Overview',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    widget: 'AI Chatbox',
    consultations: 'Consultations',
    users: 'Users',
    products: 'Products',
    feedback: 'Feedback',
    scraper: 'Scraper',
    analytics: 'Reports',
    files: 'File Management',
    permissions: 'Permissions',
    settings: 'Settings',
  },
};

// Nhãn 4 hub, cùng cấp độ 4 ngôn ngữ.
const HUB_LABELS: Record<Language, Record<HubId, string>> = {
  vi: {
    dashboard: 'Tổng quan',
    ai: 'Trợ lý AI',
    content: 'Nội dung & Tương tác',
    system: 'Hệ thống',
  },
  en: {
    dashboard: 'Dashboard',
    ai: 'AI Assistants',
    content: 'Content & Interaction',
    system: 'System',
  },
  ar: {
    dashboard: 'نظرة عامة',
    ai: 'مساعدات الذكاء الاصطناعي',
    content: 'المحتوى والتفاعل',
    system: 'النظام',
  },
  fr: {
    dashboard: 'Aperçu',
    ai: 'Assistants IA',
    content: 'Contenu & Interaction',
    system: 'Système',
  },
};

const HREF_TO_LABEL: Record<string, LabelKey> = {
  '/admin': 'overview',
  '/admin/chatbots': 'chatbots',
  '/admin/agents': 'agents',
  '/admin/prompts': 'prompts',
  '/admin/widget': 'widget',
  '/admin/consultations': 'consultations',
  '/admin/users': 'users',
  '/admin/products': 'products',
  '/admin/feedback-questions': 'feedback',
  '/admin/scraper': 'scraper',
  '/admin/analytics': 'analytics',
  '/admin/file-management': 'files',
  '/admin/permissions': 'permissions',
  '/admin/settings': 'settings',
};

const HUB_OF_ITEM: Record<string, HubId> = NAV_HUBS.reduce<Record<string, HubId>>((acc, hub) => {
  for (const item of hub.items) acc[item.href] = hub.id;
  return acc;
}, {});

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
    style={{ transform: open ? 'rotate(90deg)' : 'none' }}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface AdminShellProps {
  children: React.ReactNode;
  /**
   * Full-bleed mode: bỏ max-width + padding của content wrapper và khoá
   * chiều cao shell đúng 1 viewport. Dành cho trang layout dạng app
   * (3 cột, chat, playground) — trang đó tự lo padding và tự scroll
   * bên trong; nếu không, con có `h-full` sẽ cao theo NỘI DUNG và
   * phần cuối (composer, thanh hành động) rơi xuống dưới màn hình.
   */
  bleed?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = 'mada.admin.sidebar.collapsed';

export function AdminShell({ children, bleed = false }: AdminShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin } = useAuthStore();
  const language = useLanguageStore((s) => s.language ?? 'vi');
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const { isDark, toggle } = useAdminTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Sidebar thu gọn (icon-rail) — persist qua localStorage.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  });

  const isUserSuperAdmin = isSuperAdmin();
  const lang: Language = language as Language;
  const labels = LABELS[lang] ?? LABELS.vi;
  const hubLabels = HUB_LABELS[lang] ?? HUB_LABELS.vi;

  // Hub nào đang mở. Route hiện tại luôn thuộc một hub → hub đó tự bung,
  // nên không bao giờ phải tìm mục con trong một accordion đang đóng.
  const currentHub = HUB_OF_ITEM[location.pathname];
  const [openHubs, setOpenHubs] = useState<Set<HubId>>(
    () => new Set(currentHub ? [currentHub] : [])
  );

  // Điều hướng sang hub khác (kể cả bằng link cũ) → bung hub tương ứng.
  useEffect(() => {
    if (!currentHub) return;
    setOpenHubs((prev) => (prev.has(currentHub) ? prev : new Set(prev).add(currentHub)));
  }, [currentHub]);

  // Đóng mobile sau khi chọn mục.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = useCallbackSafe(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
    // Đóng tất cả hub accordion khi chuyển sang collapsed để tránh nav items
    // overflow bề rộng sidebar.
    setOpenHubs(new Set());
  });

  const visibleHubs = useMemo(
    () =>
      NAV_HUBS.map((hub) => ({
        ...hub,
        items: hub.items.filter((item) => !item.superAdminOnly || isUserSuperAdmin),
      })).filter((hub) => hub.items.length > 0),
    [isUserSuperAdmin]
  );

  const toggleHub = (id: HubId) =>
    setOpenHubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sidebar = (
    <>
      {/* Brand */}
      <div
        className="h-12 flex items-center px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--lin-border)' }}
      >
        <Link to="/admin" className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: 'var(--lin-accent)' }}
          >
            M
          </div>
          {!collapsed && (
            <span className="text-[13px] font-semibold lin-t-primary tracking-[-0.01em] truncate">
              MADA Admin
            </span>
          )}
        </Link>
      </div>

      {/* Nav — 4 hub dạng accordion */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 lin-scroll">
        {visibleHubs.map((hub) => {
          const open = openHubs.has(hub.id);
          const hubActive = hub.items.some((item) => isItemActive(location.pathname, item.href));
          return (
            <div key={hub.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleHub(hub.id)}
                aria-expanded={open}
                title={collapsed ? hubLabels[hub.id] : undefined}
                className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] font-semibold transition-colors lin-focus-visible"
                style={{
                  background: hubActive && !open ? 'var(--lin-accent-soft)' : 'transparent',
                  color: hubActive ? 'var(--lin-accent)' : 'var(--lin-text-secondary)',
                  justifyContent: collapsed ? 'center' : undefined,
                }}
              >
                <NavIcon name={hub.icon} active={hubActive} />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{hubLabels[hub.id]}</span>
                    <Chevron open={open} />
                  </>
                )}
              </button>

              {open && !collapsed && (
                <div className="mt-0.5 flex flex-col">
                  {hub.items.map((item) => {
                    const isActive = isItemActive(location.pathname, item.href);
                    const label = labels[HREF_TO_LABEL[item.href]];
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors lin-focus-visible"
                        style={{
                          // Thụt nhẹ để thị giác thấy quan hệ cha–con
                          marginLeft: 'var(--lin-nav-child-inset, 14px)',
                          background: isActive ? 'var(--lin-accent-soft)' : 'transparent',
                          color: isActive ? 'var(--lin-accent)' : 'var(--lin-text-tertiary)',
                          fontWeight: isActive ? 600 : 500,
                        }}
                      >
                        <NavIcon name={item.icon} active={isActive} />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed: hiện icon của từng mục con, không cần accordion */}
              {open && collapsed && (
                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                  {hub.items.map((item) => {
                    const isActive = isItemActive(location.pathname, item.href);
                    const label = labels[HREF_TO_LABEL[item.href]];
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={label}
                        aria-label={label}
                        className="w-7 h-7 rounded-md flex items-center justify-center transition-colors lin-focus-visible"
                        style={{
                          background: isActive ? 'var(--lin-accent-soft)' : 'transparent',
                        }}
                      >
                        <NavIcon name={item.icon} active={isActive} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Sidebar footer: nút thu gọn / mở rộng ── */}
      <div
        className="shrink-0 p-2"
        style={{ borderTop: '1px solid var(--lin-border)' }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu nhỏ sidebar'}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu nhỏ sidebar'}
          className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[12.5px] font-medium transition-colors lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
          style={{
            color: 'var(--lin-text-tertiary)',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <svg
            className="w-[15px] h-[15px] shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d="M15 10l-3 2 3 2" />
          </svg>
          {!collapsed && <span className="truncate">Thu gọn</span>}
        </button>
      </div>
    </>
  );

  const sidebarWidth = collapsed ? 'var(--lin-sidebar-w-collapsed)' : 'var(--lin-sidebar-w)';

  return (
    <div
      className={bleed ? 'lin-shell h-[100dvh] flex overflow-hidden' : 'lin-shell min-h-screen flex'}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 fixed left-0 top-0 bottom-0 z-30 transition-[width] duration-200"
        style={{
          width: sidebarWidth,
          background: 'var(--lin-bg-elevated)',
          borderRight: '1px solid var(--lin-border)',
        }}
      >
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className="md:hidden flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform"
        style={{
          width: 'var(--lin-sidebar-w)',
          background: 'var(--lin-bg-elevated)',
          borderRight: '1px solid var(--lin-border)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {sidebar}
      </aside>

      {/* Main */}
      <div
        className="lin-main-offset flex-1 flex flex-col min-w-0 transition-[margin] duration-200"
        style={{
          '--lin-shell-sidebar-w': sidebarWidth,
          ...(bleed ? { minHeight: 0 } : null),
        } as React.CSSProperties}
      >
        {/* Topbar */}
        <header
          className="h-12 flex items-center justify-between gap-3 px-4 shrink-0 sticky top-0 z-20"
          style={{
            background: 'var(--lin-bg-elevated)',
            borderBottom: '1px solid var(--lin-border)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded lin-btn-ghost lin-focus-visible"
              aria-label="Menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <IconButton
              label={isDark ? 'Light mode' : 'Dark mode'}
              onClick={toggle}
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" strokeLinejoin="round" />
                </svg>
              )}
            </IconButton>

            {/* Language */}
            <button
              onClick={() => {
                const order: Language[] = ['vi', 'en', 'ar', 'fr'];
                const next = order[(order.indexOf(lang) + 1) % order.length];
                setLanguage(next);
              }}
              className="h-7 px-2 rounded lin-btn-ghost lin-focus-visible text-[12px] font-medium"
              title="Đổi ngôn ngữ"
            >
              {{ vi: 'VI', en: 'EN', ar: 'AR', fr: 'FR' }[lang] ?? 'VI'}
            </button>

            {/* ── Profile (moved from sidebar footer) ── */}
            <div
              className="flex items-center gap-2 pl-2 ml-0.5"
              style={{ borderLeft: '1px solid var(--lin-border)' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: 'var(--lin-bg-sunken)', color: 'var(--lin-text-secondary)' }}
                title={user?.name || user?.email}
              >
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block min-w-0 max-w-[160px]">
                <p className="text-[12.5px] font-medium lin-t-primary truncate leading-tight">
                  {user?.name || user?.email}
                </p>
                <p className="text-[10.5px] lin-t-quaternary truncate leading-tight">
                  {isUserSuperAdmin ? 'Super Admin' : 'Admin'}
                </p>
              </div>
              <IconButton
                label="Đăng xuất"
                size="sm"
                onClick={() => { logout(); navigate('/'); }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M15 12H3M7 8l-4 4 4 4M13 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconButton>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={bleed ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-y-auto lin-scroll'}>
          {bleed ? (
            children
          ) : (
            <div style={{ maxWidth: 'var(--lin-content-max)' }} className="mx-auto px-6 py-6">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** useCallback an toàn cho callback không cần deps ngoài. */
function useCallbackSafe<T extends (...args: any[]) => any>(fn: T): T {
  return React.useCallback(fn, []);
}
