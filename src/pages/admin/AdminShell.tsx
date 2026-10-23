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
//
// Bước 4 — modern sidebar:
//   • Nhóm phẳng có header uppercase thay cho accordion (scan nhanh hơn).
//   • Ô tìm kiếm trong sidebar (⌘K) lọc theo tên mục, không cần nhớ đường dẫn.
//   • Active state rõ: nền accent-soft + thanh chỉ báo 2px bên trái.
//   • Icon rail khi thu gọn: group bằng đường kẻ mảnh, hover hiện tooltip.
//   • Keyboard: ⌘K focus search, ⌘B toggle sidebar.
//   • Mục super-admin có chip "SUPER" để phân quyền nhìn thấy ngay.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Từ khoá phụ để tìm kiếm (tiếng Anh / tiếng Việt / route). */
  keywords?: string;
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
      { labelKey: 'admin.layout.navOverview', href: '/admin', icon: 'dashboard', keywords: 'home tong quan overview' },
      { labelKey: 'admin.layout.navAnalytics', href: '/admin/analytics', icon: 'analytics', keywords: 'bao cao thong ke reports analytics' },
    ],
  },
  {
    id: 'ai',
    labelKey: 'hub.ai',
    icon: 'smart_toy',
    items: [
      { labelKey: 'admin.layout.navChatbotCenter', href: '/admin/chatbots', icon: 'hub', keywords: 'chatbot center trung tam bot' },
      { labelKey: 'admin.layout.navAgents', href: '/admin/agents', icon: 'smart_toy', keywords: 'agent ai tro ly' },
      { labelKey: 'admin.layout.navSuggestedQuestions', href: '/admin/suggested-questions', icon: 'quiz', superAdminOnly: true, keywords: 'cau hoi goi y suggested questions' },
      { labelKey: 'admin.layout.navSystemPrompts', href: '/admin/prompts', icon: 'edit_note', keywords: 'prompt system' },
      { labelKey: 'admin.layout.navAiChatbox', href: '/admin/widget', icon: 'web_asset', keywords: 'chatbox widget' },
    ],
  },
  {
    id: 'content',
    labelKey: 'hub.content',
    icon: 'inventory_2',
    items: [
      { labelKey: 'admin.layout.navProducts', href: '/admin/products', icon: 'inventory_2', keywords: 'san pham products' },
      { labelKey: 'admin.layout.navFeedback', href: '/admin/feedback', icon: 'feedback', keywords: 'phan hoi feedback danh gia' },
      { labelKey: 'admin.layout.navFeedbackQuestions', href: '/admin/feedback-questions', icon: 'thumb_down', keywords: 'cau hoi phan hoi feedback questions' },
      { labelKey: 'admin.layout.navConsultations', href: '/admin/consultations', icon: 'support_agent', keywords: 'tu van ho tro consultation support' },
      { labelKey: 'admin.layout.navUsers', href: '/admin/users', icon: 'group', keywords: 'nguoi dung user tai khoan' },
    ],
  },
  {
    id: 'system',
    labelKey: 'hub.system',
    icon: 'settings_suggest',
    items: [
      { labelKey: 'admin.layout.navScraper', href: '/admin/scraper', icon: 'cloud_download', keywords: 'scraper thu thap du lieu' },
      { labelKey: 'admin.layout.navFileUpload', href: '/admin/file-management', icon: 'upload_file', superAdminOnly: true, keywords: 'file upload quan ly file' },
      { labelKey: 'admin.layout.navPermissions', href: '/admin/permissions', icon: 'admin_panel_settings', superAdminOnly: true, keywords: 'phan quyen permissions role' },
      { labelKey: 'admin.layout.navSettings', href: '/admin/settings', icon: 'settings_suggest', superAdminOnly: true, keywords: 'cai dat settings' },
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
  quiz: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>,
  feedback: <><path d="M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2z" /><path d="M8 9h8M8 13h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
};

function NavIcon({ name, active, size = 16 }: { name: string; active: boolean; size?: number }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      className="shrink-0"
      style={{ width: size, height: size }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      color={active ? 'var(--lin-accent)' : 'var(--lin-text-tertiary)'}
      viewBox="0 0 24 24"
      aria-hidden="true"
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
  suggestedQuestions: string;
  widget: string;
  consultations: string;
  users: string;
  products: string;
  feedback: string;
  feedbackQuestions: string;
  scraper: string;
  analytics: string;
  files: string;
  permissions: string;
  settings: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
  collapse: string;
  expand: string;
  close: string;
  collapseGroup: string;
  expandGroup: string;
  superAdmin: string;
};

type LabelKey = keyof Labels;

const LABELS: Record<Language, Labels> = {
  vi: {
    overview: 'Tổng quan',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    suggestedQuestions: 'Câu hỏi gợi ý',
    widget: 'AI Chatbox',
    consultations: 'Hỗ trợ',
    users: 'Người dùng',
    products: 'Sản phẩm',
    feedback: 'Phản hồi',
    feedbackQuestions: 'Câu hỏi phản hồi',
    scraper: 'Scraper',
    analytics: 'Báo cáo',
    files: 'Quản lý file',
    permissions: 'Phân quyền',
    settings: 'Cài đặt',
    search: 'Tìm kiếm',
    searchPlaceholder: 'Tìm trang…',
    noResults: 'Không tìm thấy',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    close: 'Đóng',
    collapseGroup: 'Thu gọn nhóm',
    expandGroup: 'Mở nhóm',
    superAdmin: 'SUPER',
  },
  en: {
    overview: 'Overview',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    suggestedQuestions: 'Suggested Questions',
    widget: 'AI Chatbox',
    consultations: 'Consultations',
    users: 'Users',
    products: 'Products',
    feedback: 'Feedback',
    feedbackQuestions: 'Feedback Questions',
    scraper: 'Scraper',
    analytics: 'Reports',
    files: 'File Management',
    permissions: 'Permissions',
    settings: 'Settings',
    search: 'Search',
    searchPlaceholder: 'Find a page…',
    noResults: 'No results',
    collapse: 'Collapse',
    expand: 'Expand',
    close: 'Close',
    collapseGroup: 'Collapse group',
    expandGroup: 'Expand group',
    superAdmin: 'SUPER',
  },
  // AR/FR chưa có bản dịch riêng cho shell: dùng VI/EN theo thứ tự ưu tiên.
  ar: {
    overview: 'Tổng quan',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    suggestedQuestions: 'Câu hỏi gợi ý',
    widget: 'AI Chatbox',
    consultations: 'Hỗ trợ',
    users: 'Người dùng',
    products: 'Sản phẩm',
    feedback: 'Phản hồi',
    feedbackQuestions: 'Câu hỏi phản hồi',
    scraper: 'Scraper',
    analytics: 'Báo cáo',
    files: 'Quản lý file',
    permissions: 'Phân quyền',
    settings: 'Cài đặt',
    search: 'Tìm kiếm',
    searchPlaceholder: 'Tìm trang…',
    noResults: 'Không tìm thấy',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    close: 'Đóng',
    collapseGroup: 'Thu gọn nhóm',
    expandGroup: 'Mở nhóm',
    superAdmin: 'SUPER',
  },
  fr: {
    overview: 'Overview',
    chatbots: 'Chatbot Center',
    agents: 'AI Agents',
    prompts: 'System Prompts',
    suggestedQuestions: 'Suggested Questions',
    widget: 'AI Chatbox',
    consultations: 'Consultations',
    users: 'Users',
    products: 'Products',
    feedback: 'Feedback',
    feedbackQuestions: 'Feedback Questions',
    scraper: 'Scraper',
    analytics: 'Reports',
    files: 'File Management',
    permissions: 'Permissions',
    settings: 'Settings',
    search: 'Rechercher',
    searchPlaceholder: 'Rechercher…',
    noResults: 'Aucun résultat',
    collapse: 'Réduire',
    expand: 'Agrandir',
    close: 'Fermer',
    collapseGroup: 'Réduire le groupe',
    expandGroup: 'Ouvrir le groupe',
    superAdmin: 'SUPER',
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
  '/admin/suggested-questions': 'suggestedQuestions',
  '/admin/widget': 'widget',
  '/admin/consultations': 'consultations',
  '/admin/users': 'users',
  '/admin/products': 'products',
  '/admin/feedback': 'feedback',
  '/admin/feedback-questions': 'feedbackQuestions',
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

/** Tìm hub chứa route hiện tại (hỗ trợ cả sub-route, vd /admin/agents/123). */
function findHubOfPath(pathname: string): HubId | undefined {
  if (HUB_OF_ITEM[pathname]) return HUB_OF_ITEM[pathname];
  // Sắp xếp theo độ dài giảm dần để khớp route cụ thể nhất trước.
  const hrefs = Object.keys(HUB_OF_ITEM).sort((a, b) => b.length - a.length);
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + '/')) return HUB_OF_ITEM[href];
  }
  return undefined;
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

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
// Nhóm chính đang thu gọn (TỔNG QUAN / TRỢ LÝ AI / NỘI DUNG & TƯƠNG TÁC / HỆ THỐNG).
const HUB_COLLAPSED_KEY = 'mada.admin.hubs.collapsed';

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
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // Nhóm chính đang thu gọn — persist qua localStorage.
  const [collapsedHubs, setCollapsedHubs] = useState<Set<HubId>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(HUB_COLLAPSED_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });

  const isUserSuperAdmin = isSuperAdmin();
  const lang: Language = language as Language;
  const labels = LABELS[lang] ?? LABELS.vi;
  const hubLabels = HUB_LABELS[lang] ?? HUB_LABELS.vi;

  // Đóng mobile sau khi chọn mục.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Luôn mở nhóm chứa trang đang xem — tránh tình huống đang ở trang A
  // nhưng nhóm của A bị thu gọn nên không thấy mục active trong sidebar.
  useEffect(() => {
    const activeHub = findHubOfPath(location.pathname);
    if (!activeHub) return;
    setCollapsedHubs((prev) => {
      if (!prev.has(activeHub)) return prev;
      const next = new Set(prev);
      next.delete(activeHub);
      try {
        window.localStorage.setItem(HUB_COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Thu gọn / mở rộng từng nhóm chính trong sidebar.
  const toggleHub = useCallback((hubId: HubId) => {
    setCollapsedHubs((prev) => {
      const next = new Set(prev);
      if (next.has(hubId)) next.delete(hubId);
      else next.add(hubId);
      try {
        window.localStorage.setItem(HUB_COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* localStorage bị chặn — bỏ qua, trạng thái vẫn giữ trong phiên */
      }
      return next;
    });
  }, []);

  // ⌘B / Ctrl+B toggle sidebar, ⌘K / Ctrl+K focus ô tìm kiếm.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      } else if (key === 'k') {
        e.preventDefault();
        if (collapsed) {
          setCollapsed(false);
          window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
        }
        // Chờ render xong rồi focus.
        window.setTimeout(() => searchRef.current?.focus(), 30);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed, collapsed]);

  const visibleHubs = useMemo(
    () =>
      NAV_HUBS.map((hub) => ({
        ...hub,
        items: hub.items.filter((item) => !item.superAdminOnly || isUserSuperAdmin),
      })).filter((hub) => hub.items.length > 0),
    [isUserSuperAdmin]
  );

  // Lọc theo tên mục / từ khoá / route.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { item: NavItem; hub: HubId }[] = [];
    for (const hub of visibleHubs) {
      for (const item of hub.items) {
        const label = labels[HREF_TO_LABEL[item.href]] ?? item.href;
        const haystack = `${label} ${item.href} ${item.keywords ?? ''} ${hubLabels[hub.id]}`.toLowerCase();
        if (haystack.includes(q)) out.push({ item, hub: hub.id });
      }
    }
    return out;
  }, [query, visibleHubs, labels, hubLabels]);

  const isSearching = query.trim().length > 0;

  const renderItem = (item: NavItem, hubId: HubId, showHubName = false) => {
    const isActive = isItemActive(location.pathname, item.href);
    const label = labels[HREF_TO_LABEL[item.href]] ?? item.href;
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => {
          setMobileOpen(false);
          setQuery('');
        }}
        title={collapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className="group relative flex items-center gap-2.5 h-8 px-2.5 rounded-[7px] text-[13px] transition-colors duration-150 lin-focus-visible lin-nav-item"
        style={{
          background: isActive ? 'var(--lin-accent-soft)' : 'transparent',
          color: isActive ? 'var(--lin-accent)' : 'var(--lin-text-secondary)',
          fontWeight: isActive ? 600 : 500,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--lin-bg-hover)';
            e.currentTarget.style.color = 'var(--lin-text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--lin-text-secondary)';
          }
        }}
      >
        {/* Thanh chỉ báo active — dấu hiệu trực quan mạnh nhất */}
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full transition-all duration-150"
          style={{
            width: 2,
            height: isActive ? 16 : 0,
            background: 'var(--lin-accent)',
            opacity: isActive ? 1 : 0,
          }}
        />
        <NavIcon name={item.icon} active={isActive} />
        <span className="truncate flex-1">{label}</span>
        {showHubName && (
          <span className="text-[10.5px] lin-t-quaternary truncate max-w-[92px]">
            {hubLabels[hubId]}
          </span>
        )}
        {!showHubName && item.superAdminOnly && (
          <span
            className="text-[9px] font-bold tracking-wide px-1 py-[1px] rounded-[4px] shrink-0"
            style={{
              background: 'var(--lin-bg-sunken)',
              color: 'var(--lin-text-quaternary)',
            }}
          >
            {labels.superAdmin}
          </span>
        )}
      </Link>
    );
  };

  const sidebar = (variant: 'desktop' | 'mobile') => (
    <>
      {/* ── Brand ── */}
      <div
        className="h-12 flex items-center gap-2 px-3 shrink-0"
        style={{ borderBottom: '1px solid var(--lin-border)' }}
      >
        <Link to="/admin" className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-white text-[11.5px] font-bold shrink-0 shadow-sm"
            style={{
              background: 'linear-gradient(140deg, var(--lin-accent) 0%, var(--lin-accent-hover) 100%)',
            }}
          >
            M
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <span className="block text-[13px] font-semibold lin-t-primary tracking-[-0.01em] truncate">
                MADA Admin
              </span>
              <span className="block text-[10px] lin-t-quaternary truncate">
                Control Center
              </span>
            </div>
          )}
        </Link>

        {/* Nút toggle — LUÔN hiện (mở rộng/thu gọn).
            Mobile dùng nút X đóng thay vì toggle. */}
        {variant === 'mobile' ? (
          <IconButton label={labels.close} size="sm" onClick={() => setMobileOpen(false)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </IconButton>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? labels.expand : labels.collapse}
            title={collapsed ? `${labels.expand} (⌘B)` : `${labels.collapse} (⌘B)`}
            aria-expanded={!collapsed}
            className="w-7 h-7 shrink-0 rounded-[7px] flex items-center justify-center transition-colors duration-150 lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
            style={{ color: 'var(--lin-text-tertiary)' }}
          >
            {/* Icon panel: mũi tên chỉ hướng theo trạng thái hiện tại */}
            <svg
              className="w-[15px] h-[15px] transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M9 4v16" />
              <path d="M15 10l-3 2 3 2" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Search ── */}
      {!collapsed ? (
        <div className="px-3 pt-3 shrink-0">
          <div className="relative">
            <span
              className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--lin-text-quaternary)' }}
            >
              <NavIcon name="search" active={false} size={14} />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.search}
              className="w-full h-8 pl-[30px] pr-12 rounded-[8px] text-[12.5px] lin-focus-visible outline-none transition-colors duration-150"
              style={{
                background: 'var(--lin-bg-sunken)',
                border: '1px solid transparent',
                color: 'var(--lin-text-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--lin-accent-border)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
              }}
            />
            {!query && (
              <kbd
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-[2px] rounded-[5px] pointer-events-none lin-t-quaternary"
                style={{
                  background: 'var(--lin-bg-elevated)',
                  border: '1px solid var(--lin-border)',
                }}
              >
                ⌘K
              </kbd>
            )}
          </div>
        </div>
      ) : (
        <div className="px-2 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
              window.setTimeout(() => searchRef.current?.focus(), 30);
            }}
            title={labels.search}
            aria-label={labels.search}
            className="w-full h-8 flex items-center justify-center rounded-[7px] transition-colors lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
            style={{ color: 'var(--lin-text-tertiary)' }}
          >
            <NavIcon name="search" active={false} size={15} />
          </button>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 lin-scroll">
        {isSearching ? (
          /* Kết quả tìm kiếm — dạng phẳng, có tên hub ở cuối */
          searchResults.length > 0 ? (
            <div className="flex flex-col gap-px">
              {searchResults.map(({ item, hub }) => renderItem(item, hub, true))}
            </div>
          ) : (
            <div className="px-2.5 py-6 text-center">
              <p className="text-[12px] lin-t-tertiary">{labels.noResults}</p>
              <p className="text-[11px] lin-t-quaternary mt-1 truncate">“{query.trim()}”</p>
            </div>
          )
        ) : collapsed ? (
          /* Icon rail: group bằng đường kẻ mảnh */
          <div className="flex flex-col items-center gap-0.5">
            {visibleHubs.map((hub, hubIdx) => (
              <div key={hub.id} className="w-full flex flex-col items-center">
                {hubIdx > 0 && (
                  <div
                    className="w-5 my-1.5"
                    style={{ height: 1, background: 'var(--lin-border-subtle)' }}
                  />
                )}
                {hub.items.map((item) => {
                  const isActive = isItemActive(location.pathname, item.href);
                  const label = labels[HREF_TO_LABEL[item.href]] ?? item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={label}
                      aria-label={label}
                      className="relative w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors duration-150 lin-focus-visible lin-nav-item"
                      style={{
                        background: isActive ? 'var(--lin-accent-soft)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--lin-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                        style={{
                          width: 2,
                          height: isActive ? 16 : 0,
                          background: 'var(--lin-accent)',
                        }}
                      />
                      <NavIcon name={item.icon} active={isActive} size={16} />
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* Nhóm phẳng, header uppercase — có mũi tên trượt để thu gọn nhóm */
          <div className="flex flex-col">
            {visibleHubs.map((hub) => {
              const isHubCollapsed = collapsedHubs.has(hub.id);
              return (
                <section key={hub.id} className="mb-1">
                  <header
                    className="flex items-center gap-1.5 px-2.5 pt-3 pb-1.5"
                    style={{ color: 'var(--lin-text-quaternary)' }}
                  >
                    <NavIcon name={hub.icon} active={false} size={13} />
                    <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] truncate">
                      {hubLabels[hub.id]}
                    </h2>
                    {/* Mũi tên trượt: thu gọn / mở rộng nhóm */}
                    <button
                      type="button"
                      onClick={() => toggleHub(hub.id)}
                      aria-expanded={!isHubCollapsed}
                      aria-label={
                        isHubCollapsed ? labels.expandGroup : labels.collapseGroup
                      }
                      title={
                        isHubCollapsed ? labels.expandGroup : labels.collapseGroup
                      }
                      className="ml-auto shrink-0 w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-colors duration-150 lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
                      style={{ color: 'var(--lin-text-quaternary)' }}
                    >
                      <svg
                        className="w-3 h-3 transition-transform duration-200 ease-out"
                        style={{
                          transform: isHubCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </header>
                  {/* Danh sách mục — thu gọn/giãn theo trạng thái nhóm.
                      `visibility: hidden` khi thu gọn để link không còn nhận
                      focus bằng Tab và không lọt vào accessibility tree. */}
                  <div
                    className="flex flex-col gap-px overflow-hidden transition-[max-height,opacity,visibility] duration-200 ease-out"
                    style={{
                      maxHeight: isHubCollapsed ? 0 : 400,
                      opacity: isHubCollapsed ? 0 : 1,
                      visibility: isHubCollapsed ? 'hidden' : 'visible',
                    }}
                  >
                    {hub.items.map((item) => renderItem(item, hub.id))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </nav>

      {/* ── Sidebar footer ── */}
      <div
        className="shrink-0 p-2"
        style={{ borderTop: '1px solid var(--lin-border)' }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? labels.expand : labels.collapse}
          title={collapsed ? `${labels.expand} (⌘B)` : `${labels.collapse} (⌘B)`}
          className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-[7px] text-[12.5px] font-medium transition-colors duration-150 lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
          style={{ color: 'var(--lin-text-tertiary)' }}
        >
          <svg
            className="w-[15px] h-[15px] shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d="M15 10l-3 2 3 2" />
          </svg>
          <span className="truncate">{collapsed ? labels.expand : labels.collapse}</span>
          {!collapsed && (
            <kbd
              className="ml-auto text-[10px] font-medium px-1.5 py-[2px] rounded-[5px]"
              style={{
                background: 'var(--lin-bg-sunken)',
                color: 'var(--lin-text-quaternary)',
                border: '1px solid var(--lin-border)',
              }}
            >
              ⌘B
            </kbd>
          )}
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
        className="hidden md:flex flex-col shrink-0 fixed left-0 top-0 bottom-0 z-30 transition-[width] duration-200 ease-out"
        style={{
          width: sidebarWidth,
          background: 'var(--lin-bg-elevated)',
          borderRight: '1px solid var(--lin-border)',
        }}
      >
        {sidebar('desktop')}
      </aside>

      {/* Tab bật lại — hiện ở mép trái sidebar khi đang thu gọn.
          Vuốt/nhấn vào mép để mở rộng mà không cần tìm nút. */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={labels.expand}
          title={labels.expand}
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 items-center justify-center w-[14px] h-14 rounded-r-[7px] transition-colors duration-150 lin-focus-visible hover:bg-[var(--lin-bg-hover)]"
          style={{
            background: 'var(--lin-bg-elevated)',
            borderRight: '1px solid var(--lin-border)',
            borderTop: '1px solid var(--lin-border)',
            borderBottom: '1px solid var(--lin-border)',
            color: 'var(--lin-text-tertiary)',
          }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

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
        {sidebar('mobile')}
      </aside>

      {/* Main */}
      <div
        className="lin-main-offset flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ease-out"
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

            {/* Breadcrumb — topbar trống bên trái thì lấp bằng ngữ cảnh trang */}
            {!collapsed && (
              <div className="hidden md:flex items-center gap-1.5 min-w-0 text-[12.5px]">
                <span className="lin-t-quaternary">Admin</span>
                <span className="lin-t-quaternary">/</span>
                <span className="lin-t-secondary truncate font-medium">
                  {labels[HREF_TO_LABEL[location.pathname]] ??
                    labels[HREF_TO_LABEL[Object.keys(HREF_TO_LABEL).find((h) => location.pathname.startsWith(h) && h !== '/admin') ?? '']] ??
                    labels.overview}
                </span>
              </div>
            )}
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

            {/* ── Profile ── */}
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
