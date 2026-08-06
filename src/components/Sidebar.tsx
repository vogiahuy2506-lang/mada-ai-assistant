import { useNavigate } from 'react-router-dom';
import { CATEGORY_INFO, type ATCategory } from '@/types';
import { useSidebarStore, useChatStore } from '@/stores';
import clsx from 'clsx';

const categories = Object.keys(CATEGORY_INFO) as ATCategory[];

interface SidebarProps {
  variant?: 'user' | 'expert' | 'data_manager' | 'admin';
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
}

const getMenuItems = (variant: string, onNewChat: () => void): MenuItem[] => {
  const baseMenus: Record<string, MenuItem[]> = {
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

  if (variant === 'user') {
    return [
      { id: 'newchat', label: 'Trò chuyện mới', icon: 'chat', onClick: onNewChat },
      { id: 'history', label: 'Lịch sử', icon: 'history', href: '/history' },
      { id: 'favorites', label: 'Yêu thích', icon: 'favorite', href: '/favorites' },
      { id: 'profile', label: 'Hồ sơ', icon: 'person', href: '/profile' },
      { id: 'settings', label: 'Cài đặt', icon: 'settings', href: '/settings' },
    ];
  }

  return baseMenus[variant] || [];
};

export function Sidebar({ variant = 'user' }: SidebarProps) {
  const navigate = useNavigate();
  const { isCollapsed, activeCategory, toggleCollapse, setActiveCategory } = useSidebarStore();
  const { clearMessages } = useChatStore();

  const handleNewChat = () => {
    clearMessages();
    navigate('/chat');
  };

  const items = getMenuItems(variant, handleNewChat);

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen z-40',
        'bg-white dark:bg-zinc-900',
        'border-r-2 border-zinc-200 dark:border-zinc-800',
        'transition-all duration-300',
        'overflow-y-auto hidden md:block',
        isCollapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800">
        <a href="/" className="font-black text-xl tracking-tight">
          {isCollapsed ? 'M' : 'MADA'}
        </a>
      </div>

      {/* Menu Items */}
      <nav className="p-2 flex flex-col gap-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
              } else if (item.href) {
                window.location.href = item.href;
              }
            }}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg',
              'text-sm font-medium w-full text-left',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              'transition-colors duration-200'
            )}
          >
            <span className="material-symbols-outlined text-lg w-5 text-center flex-shrink-0">
              {item.icon}
            </span>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Categories Section (for user variant) */}
      {variant === 'user' && (
        <>
          <div className="px-4 py-3">
            <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <nav className="px-2 pb-3 flex flex-col gap-0.5">
            {!isCollapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-3 py-1.5">
                Danh mục AT
              </p>
            )}
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  'text-sm transition-colors duration-200',
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  activeCategory === category && 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
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
          'bg-zinc-100 dark:bg-zinc-800',
          'flex items-center justify-center',
          'hover:bg-zinc-200 dark:hover:bg-zinc-700',
          'transition-colors'
        )}
      >
        <span className={clsx('material-symbols-outlined text-sm transition-transform', isCollapsed && 'rotate-180')}>
          chevron_right
        </span>
      </button>
    </aside>
  );
}
