import { CATEGORY_INFO, type ATCategory } from '@/types';
import { useSidebarStore } from '@/stores';
import clsx from 'clsx';

const categories = Object.keys(CATEGORY_INFO) as ATCategory[];

interface SidebarProps {
  variant?: 'user' | 'expert' | 'data_manager' | 'admin';
}

const menuItems = {
  user: [
    { id: 'chat', label: 'Trò chuyện mới', icon: 'chat', href: '/chat' },
    { id: 'history', label: 'Lịch sử', icon: 'history', href: '/history' },
    { id: 'favorites', label: 'Yêu thích', icon: 'favorite', href: '/favorites' },
    { id: 'profile', label: 'Hồ sơ', icon: 'person', href: '/profile' },
    { id: 'settings', label: 'Cài đặt', icon: 'settings', href: '/settings' },
  ],
  expert: [
    { id: 'dashboard', label: 'Trang tổng quan', icon: 'dashboard', href: '/expert' },
    { id: 'requests', label: 'Danh sách yêu cầu', icon: 'inbox', href: '/expert/requests' },
    { id: 'history', label: 'Lịch sử', icon: 'history', href: '/expert/history' },
    { id: 'stats', label: 'Thống kê', icon: 'analytics', href: '/expert/stats' },
  ],
  data_manager: [
    { id: 'dashboard', label: 'Trang tổng quan', icon: 'dashboard', href: '/data' },
    { id: 'knowledge', label: 'Kho tri thức', icon: 'library_books', href: '/data/knowledge' },
    { id: 'collect', label: 'Thu thập dữ liệu', icon: 'cloud_download', href: '/data/collect' },
    { id: 'documents', label: 'Quản lý tài liệu', icon: 'folder', href: '/data/documents' },
    { id: 'categories', label: 'Danh mục', icon: 'category', href: '/data/categories' },
  ],
  admin: [
    { id: 'dashboard', label: 'Trang tổng quan', icon: 'dashboard', href: '/admin' },
    { id: 'users', label: 'Quản lý người dùng', icon: 'people', href: '/admin/users' },
    { id: 'roles', label: 'Quản lý phân quyền', icon: 'admin_panel_settings', href: '/admin/roles' },
    { id: 'ai', label: 'Quản lý AI', icon: 'psychology', href: '/admin/ai' },
    { id: 'logs', label: 'Nhật ký hệ thống', icon: 'receipt_long', href: '/admin/logs' },
    { id: 'stats', label: 'Thống kê', icon: 'analytics', href: '/admin/stats' },
    { id: 'deploy', label: 'Triển khai', icon: 'rocket_launch', href: '/admin/deploy' },
    { id: 'settings', label: 'Cài đặt', icon: 'settings', href: '/admin/settings' },
  ],
};

export function Sidebar({ variant = 'user' }: SidebarProps) {
  const { isCollapsed, activeCategory, toggleCollapse, setActiveCategory } = useSidebarStore();
  const items = menuItems[variant];

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-40',
        'bg-surface dark:bg-on-background',
        'border-r-2 border-on-background dark:border-surface',
        'transition-all duration-300',
        'overflow-y-auto hidden md:block',
        isCollapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-center border-b border-on-background dark:border-surface">
        <a href="/" className="font-black text-lg tracking-tighter">
          {isCollapsed ? 'M' : 'MADA'}
        </a>
      </div>

      {/* Menu Items */}
      <nav className="p-2 flex flex-col gap-0.5">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg',
              'text-sm font-medium',
              'hover:bg-surface-container dark:hover:bg-surface-container-high',
              'transition-all duration-200',
              'border-2 border-transparent',
              'hover:border-outline'
            )}
          >
            <span className="material-symbols-outlined text-lg w-5 text-center flex-shrink-0">
              {item.icon}
            </span>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </a>
        ))}
      </nav>

      {/* Categories Section (for user variant) */}
      {variant === 'user' && (
        <>
          <div className="px-3 py-2">
            <div className="h-px bg-outline-variant" />
          </div>

          <nav className="px-2 pb-2 flex flex-col gap-0.5">
            {!isCollapsed && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant px-3 py-1">
                Danh mục AT
              </p>
            )}
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                  'text-sm transition-all duration-200',
                  'hover:bg-surface-container dark:hover:bg-surface-container-high',
                  activeCategory === category && 'bg-primary/10 text-primary border-2 border-primary'
                )}
              >
                <span className="material-symbols-outlined text-base w-5 text-center flex-shrink-0">
                  {CATEGORY_INFO[category].icon}
                </span>
                {!isCollapsed && <span className="truncate text-xs">{CATEGORY_INFO[category].nameVi}</span>}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={toggleCollapse}
        className={clsx(
          'absolute bottom-4 right-3',
          'w-8 h-8 rounded-full',
          'bg-surface-container dark:bg-surface-container-high',
          'flex items-center justify-center',
          'hover:bg-outline transition-colors',
          'border-2 border-on-background dark:border-surface'
        )}
      >
        <span className={clsx('material-symbols-outlined text-sm transition-transform', isCollapsed && 'rotate-180')}>
          chevron_right
        </span>
      </button>
    </aside>
  );
}
