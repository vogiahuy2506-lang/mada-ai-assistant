import { useNavigate } from 'react-router-dom';
import { CATEGORY_INFO, SAMPLE_QUESTIONS, type ATCategory, type ViewMode, type Language } from '@/types';
import { useSidebarStore, useChatStore, useViewModeStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';

// Helper function để lấy category name theo ngôn ngữ
const getCategoryName = (category: ATCategory, lang: Language): string => {
  const info = CATEGORY_INFO[category];
  switch (lang) {
    case 'en': return info.nameEn;
    case 'ar': return info.nameAr;
    case 'fr': return info.nameFr;
    default: return info.nameVi;
  }
};

// Helper function để lấy menu labels theo ngôn ngữ
const getMenuLabels = (lang: Language) => {
  const labels: Record<Language, Record<string, string>> = {
    vi: {
      newchat: 'Trò chuyện mới',
      history: 'Lịch sử',
      favorites: 'Yêu thích',
      profile: 'Hồ sơ',
      settings: 'Cài đặt',
      categories: '📂 Danh mục AT',
      questions: '💡 Câu hỏi gợi ý',
      selectCategory: 'Chọn danh mục để xem câu hỏi gợi ý',
      seeMore: 'Xem thêm',
    },
    en: {
      newchat: 'New Chat',
      history: 'History',
      favorites: 'Favorites',
      profile: 'Profile',
      settings: 'Settings',
      categories: '📂 AT Categories',
      questions: '💡 Suggested Questions',
      selectCategory: 'Select a category to see suggested questions',
      seeMore: 'See more',
    },
    ar: {
      newchat: 'محادثة جديدة',
      history: 'السجل',
      favorites: 'المفضلة',
      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      categories: '📂 فئات AT',
      questions: '💡 أسئلة مقترحة',
      selectCategory: 'اختر فئة لرؤية الأسئلة المقترحة',
      seeMore: 'المزيد',
    },
    fr: {
      newchat: 'Nouveau chat',
      history: 'Historique',
      favorites: 'Favoris',
      profile: 'Profil',
      settings: 'Paramètres',
      categories: '📂 Catégories AT',
      questions: '💡 Questions suggérées',
      selectCategory: 'Sélectionnez une catégorie pour voir les questions suggérées',
      seeMore: 'Voir plus',
    },
  };
  return labels[lang];
};

const categories = Object.keys(CATEGORY_INFO) as ATCategory[];

interface SidebarProps {
  variant?: 'user' | 'expert' | 'data_manager' | 'admin';
  onSelectQuestion?: (question: string) => void;
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
      { id: 'agents', label: 'Quản lý Agent', icon: 'smart_toy', href: '/admin/agents' },
      { id: 'logs', label: 'Nhật ký hệ thống', icon: 'receipt_long', href: '/admin/logs' },
      { id: 'stats', label: 'Thống kê', icon: 'analytics', href: '/admin/stats' },
      { id: 'deploy', label: 'Triển khai', icon: 'rocket_launch', href: '/admin/deploy' },
      { id: 'settings', label: 'Cài đặt', icon: 'settings', href: '/admin/settings' },
      { id: 'prompts', label: 'System Prompts', icon: 'edit_note', href: '/admin/prompts' },
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

// Sample Questions Component
interface SampleQuestionsProps {
  category: ATCategory | null;
  viewMode: ViewMode;
  language: Language;
  onSelectQuestion: (question: string) => void;
  isCollapsed?: boolean;
}

function SampleQuestions({ category, viewMode, language, onSelectQuestion, isCollapsed = false }: SampleQuestionsProps) {
  const labels = getMenuLabels(language);
  const questions = category ? SAMPLE_QUESTIONS[category]?.[viewMode]?.[language] || [] : [];
  const categoryColor = category ? CATEGORY_INFO[category].color : 'text-violet-600';
  const categoryBgColor = category ? CATEGORY_INFO[category].bgColor : 'bg-violet-50';
  
  if (isCollapsed) return null;
  
  if (questions.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400 italic">
        {labels.selectCategory}
      </div>
    );
  }

  return (
    <div className="mt-3 px-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 py-1.5">
        {labels.questions}
      </p>
      <div className="flex flex-col gap-0.5 mt-1">
        {questions.slice(0, 4).map((question, idx) => (
          <button
            key={idx}
            onClick={() => onSelectQuestion(question)}
            className={clsx(
              'flex items-start gap-2 px-2 py-1.5 rounded-lg',
              'text-xs text-left text-slate-600',
              `hover:${categoryBgColor} hover:${categoryColor}`,
              'transition-colors duration-200',
              'group'
            )}
          >
            <span className={clsx('text-slate-400 group-hover:text-violet-500 mt-0.5 flex-shrink-0', `group-hover:${categoryColor.replace('text-', 'text-')}`)}>
              •
            </span>
            <span className="line-clamp-2">{question}</span>
          </button>
        ))}
        {questions.length > 4 && (
          <button className={clsx('flex items-center gap-1 px-2 py-1 text-xs font-medium', categoryColor)}>
            {labels.seeMore} {questions.length - 4} câu
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        )}
      </div>
    </div>
  );
}

// View Mode Toggle Component
interface ViewModeToggleProps {
  viewMode: ViewMode;
  onToggle: () => void;
  isCollapsed?: boolean;
}

function ViewModeToggle({ viewMode, onToggle, isCollapsed = false }: ViewModeToggleProps) {
  if (isCollapsed) return null;
  
  return (
    <div className="px-3 py-2">
      <div className="bg-slate-100 rounded-xl p-0.5 flex">
        <button
          onClick={viewMode === 'end_user' ? undefined : onToggle}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200',
            viewMode === 'end_user' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <span className="material-symbols-outlined text-sm">person</span>
          <span>Người dùng</span>
        </button>
        <button
          onClick={viewMode === 'at_specialist' ? undefined : onToggle}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200',
            viewMode === 'at_specialist' 
              ? 'bg-white text-violet-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <span className="material-symbols-outlined text-sm">engineering</span>
          <span>Chuyên gia</span>
        </button>
      </div>
      {/* Tooltip khi collapsed */}
      <p className="text-[9px] text-slate-400 text-center mt-1.5">
        {viewMode === 'end_user' ? 'Chế độ thân thiện' : 'Chế độ chuyên sâu'}
      </p>
    </div>
  );
}

// Category Icon với emoji fallback
const categoryEmojis: Record<ATCategory, string> = {
  vision: '👁️',
  hearing: '👂',
  mobility: '🦽',
  cognition: '🧠',
  communication: '💬',
  daily_living: '🏠',
  education: '📚',
};

export function Sidebar({ variant = 'user', onSelectQuestion }: SidebarProps) {
  const navigate = useNavigate();
  const { isCollapsed, activeCategory, toggleCollapse, setActiveCategory } = useSidebarStore();
  const { viewMode, toggleViewMode } = useViewModeStore();
  const { clearMessages } = useChatStore();
  const { language } = useLanguageStore();
  const labels = getMenuLabels(language);

  const handleNewChat = () => {
    clearMessages();
    navigate('/chat');
  };

  const items = getMenuItems(variant, handleNewChat);

  const handleCategoryClick = (category: ATCategory) => {
    if (activeCategory === category) {
      setActiveCategory(null);
    } else {
      setActiveCategory(category);
    }
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen z-40',
        'bg-white dark:bg-zinc-900',
        'border-r-2 border-zinc-200 dark:border-zinc-800',
        'transition-all duration-300',
        'flex flex-col',
        'overflow-hidden',
        isCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <a href="/" className="font-black text-xl tracking-tight">
          {isCollapsed ? 'M' : 'MADA'}
        </a>
      </div>

      {/* View Mode Toggle - Chỉ hiển thị cho user variant */}
      {variant === 'user' && (
        <ViewModeToggle 
          viewMode={viewMode} 
          onToggle={toggleViewMode} 
          isCollapsed={isCollapsed}
        />
      )}

      {/* Menu Items */}
      <nav className="p-2 flex flex-col gap-0.5 flex-shrink-0">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
              } else if (item.href) {
                navigate(item.href);
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

      {/* Categories Section (for user variant) - Scrollable */}
      {variant === 'user' && (
        <>
          <div className="px-4 py-2 flex-shrink-0">
            <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <nav className="px-2 pb-2 flex flex-col gap-0.5 flex-shrink-0">
            {!isCollapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-3 py-1.5">
                {labels.categories}
              </p>
            )}
            {isCollapsed && (
              <p className="text-[10px] text-center text-zinc-400 py-1.5">📂</p>
            )}
            {categories.map((category) => {
              const categoryInfo = CATEGORY_INFO[category];
              const isActive = activeCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    'text-sm transition-all duration-200',
                    'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    isActive 
                      ? `${categoryInfo.bgColor} ${categoryInfo.color} border-l-2 ${categoryInfo.borderColor} font-medium` 
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  <span className="text-base w-5 text-center flex-shrink-0">
                    {categoryEmojis[category]}
                  </span>
                  {!isCollapsed && (
                    <span className="truncate text-xs">{getCategoryName(category, language)}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sample Questions - Hiển thị khi có category được chọn */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <SampleQuestions 
              category={activeCategory as ATCategory | null}
              viewMode={viewMode}
              language={language}
              onSelectQuestion={onSelectQuestion || (() => {})}
              isCollapsed={isCollapsed}
            />
          </div>
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
