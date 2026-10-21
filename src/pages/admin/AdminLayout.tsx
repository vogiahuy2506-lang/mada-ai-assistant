import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';
import madaLogo from '@/assets/mada-logo.png';
import { Menu, X } from 'lucide-react';

// Admin Layout translations - Vietnamese, English, Arabic, French
const tL = (key: string): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Navigation
      'admin.layout.navOverview': 'Tổng quan',
      'admin.layout.navAiChatbox': 'AI Chatbox',
      'admin.layout.navUsers': 'Người dùng',
      'admin.layout.navProducts': 'Sản phẩm',
      'admin.layout.navScraper': 'Scraper',
      'admin.layout.navActivityLogs': 'Nhật ký hoạt động',
      'admin.layout.navAnalytics': 'Báo cáo',
      'admin.layout.navAgents': 'AI Agents',
      'admin.layout.navChatbotCenter': 'Chatbot Center',
      'admin.layout.navSuggestedQuestions': 'Câu hỏi gợi ý',
      'admin.layout.navSystemPrompts': 'System Prompts',
      'admin.layout.navConsultations': 'Hỗ trợ',
      'admin.layout.navFeedback': 'Phản hồi',
      'admin.layout.navFileUpload': 'Quản lý file',
      'admin.layout.navSettings': 'Cài đặt',
      'admin.layout.navPermissions': 'Phân quyền',
      'admin.layout.navSupport': 'Hỗ trợ',
      'admin.layout.navNotifications': 'Thông báo',
      'admin.layout.navFeedbackQuestions': 'Câu hỏi phản hồi',
      // Notifications page
      'notifications.title': 'Thông báo',
      'notifications.subtitle': 'Quản lý thông báo hệ thống',
      // Labels
      'admin.layout.superAdminOnly': 'Chỉ Super Admin',
      'admin.layout.admin': 'Quản trị',
      'admin.layout.super': 'SUPER',
      'admin.layout.plan': 'Gói',
      'admin.layout.planEnterprise': 'Enterprise',
      'admin.layout.planPro': 'Pro',
      'admin.layout.planFree': 'Miễn phí',
      'admin.layout.logout': 'Đăng xuất',
      'admin.layout.controlCenter': 'Trung tâm quản trị',
      'admin.layout.switchLanguage': 'Chọn ngôn ngữ',
      'admin.layout.langVi': 'Tiếng Việt',
      'admin.layout.langEn': 'English',
      'admin.layout.langAr': 'العربية',
      'admin.layout.langFr': 'Français',
      // Top bar titles
      'admin.topBar.overview': 'Tổng quan',
      'admin.topBar.overviewSub': 'Xem nhanh tình trạng hệ thống',
      'admin.topBar.users': 'Người dùng',
      'admin.topBar.usersSub': 'Quản lý tài khoản người dùng',
      'admin.topBar.products': 'Sản phẩm',
      'admin.topBar.productsSub': 'Quản lý danh mục và sản phẩm',
      'admin.topBar.agents': 'AI Agents',
      'admin.topBar.agentsSub': 'Quản lý các AI Agent',
      'admin.topBar.prompts': 'System Prompts',
      'admin.topBar.promptsSub': 'Quản lý prompts cho AI',
      'admin.topBar.consultations': 'Tư vấn',
      'admin.topBar.consultationsSub': 'Xem và quản lý các yêu cầu tư vấn',
      'admin.topBar.templates': 'Templates',
      'admin.topBar.templatesSub': 'Quản lý mẫu prompts',
      // File Management translations
      'admin.topBar.fileManagement': 'Quản Lý Upload File',
      'admin.topBar.fileManagementSub': 'Cấu hình tính năng upload file và giới hạn cho người dùng',
      // Feedback page
      'admin.topBar.feedback': 'Phản hồi Chatbot',
      'admin.topBar.feedbackSub': 'Thống kê đánh giá của người dùng về các câu trả lời của chatbot',
      // Notifications page
      'admin.topBar.notifications': 'Thông báo',
      'admin.topBar.notificationsSub': 'Quản lý thông báo hệ thống',
      // Support page
      'admin.topBar.support': 'Hỗ trợ',
      'admin.topBar.supportSub': 'Quản lý ticket hỗ trợ người dùng',
    },
    en: {
      // Navigation
      'admin.layout.navOverview': 'Overview',
      'admin.layout.navAiChatbox': 'AI Chatbox',
      'admin.layout.navUsers': 'Users',
      'admin.layout.navProducts': 'Products',
      'admin.layout.navScraper': 'Scraper',
      'admin.layout.navActivityLogs': 'Activity Logs',
      'admin.layout.navAnalytics': 'Reports',
      'admin.layout.navAgents': 'AI Agents',
      'admin.layout.navChatbotCenter': 'Chatbot Center',
      'admin.layout.navSuggestedQuestions': 'Suggested Questions',
      'admin.layout.navSystemPrompts': 'System Prompts',
      'admin.layout.navConsultations': 'Support',
      'admin.layout.navFeedback': 'Feedback',
      'admin.layout.navFileUpload': 'File Management',
      'admin.layout.navSettings': 'Settings',
      'admin.layout.navPermissions': 'Permissions',
      'admin.layout.navSupport': 'Support',
      'admin.layout.navNotifications': 'Notifications',
      'admin.layout.navFeedbackQuestions': 'Feedback Questions',
      // Notifications page
      'notifications.title': 'Notifications',
      'notifications.subtitle': 'System notifications management',
      // Labels
      'admin.layout.superAdminOnly': 'Super Admin only',
      'admin.layout.admin': 'Admin',
      'admin.layout.super': 'SUPER',
      'admin.layout.plan': 'Plan',
      'admin.layout.planEnterprise': 'Enterprise',
      'admin.layout.planPro': 'Pro',
      'admin.layout.planFree': 'Free',
      'admin.layout.logout': 'Logout',
      'admin.layout.controlCenter': 'Control Center',
      'admin.layout.switchLanguage': 'Switch language',
      'admin.layout.langVi': 'Tiếng Việt',
      'admin.layout.langEn': 'English',
      'admin.layout.langAr': 'العربية',
      'admin.layout.langFr': 'Français',
      // Top bar titles
      'admin.topBar.overview': 'Overview',
      'admin.topBar.overviewSub': 'Quick view of system status',
      'admin.topBar.users': 'Users',
      'admin.topBar.usersSub': 'Manage user accounts',
      'admin.topBar.products': 'Products',
      'admin.topBar.productsSub': 'Manage categories and products',
      'admin.topBar.agents': 'AI Agents',
      'admin.topBar.agentsSub': 'Manage AI Agents',
      'admin.topBar.prompts': 'System Prompts',
      'admin.topBar.promptsSub': 'Manage AI prompts',
      'admin.topBar.consultations': 'Consultations',
      'admin.topBar.consultationsSub': 'View and manage consultation requests',
      'admin.topBar.templates': 'Templates',
      'admin.topBar.templatesSub': 'Manage prompt templates',
      // File Management translations
      'admin.topBar.fileManagement': 'Upload File Management',
      'admin.topBar.fileManagementSub': 'Configure file upload features and limits for users',
      // Feedback page
      'admin.topBar.feedback': 'Chatbot Feedback',
      'admin.topBar.feedbackSub': 'Statistics of user feedback on chatbot responses',
      // Notifications page
      'admin.topBar.notifications': 'Notifications',
      'admin.topBar.notificationsSub': 'Manage system notifications',
      // Support page
      'admin.topBar.support': 'Support',
      'admin.topBar.supportSub': 'Manage user support tickets',
    },
    ar: {
      // Navigation
      'admin.layout.navOverview': 'نظرة عامة',
      'admin.layout.navAiChatbox': 'مساعد AI',
      'admin.layout.navUsers': 'المستخدمون',
      'admin.layout.navProducts': 'المنتجات',
      'admin.layout.navScraper': 'المجمع',
      'admin.layout.navActivityLogs': 'سجلات النشاط',
      'admin.layout.navAnalytics': 'التقارير',
      'admin.layout.navAgents': 'وكلاء الذكاء الاصطناعي',
      'admin.layout.navChatbotCenter': 'مركز الشات بوت',
      'admin.layout.navSuggestedQuestions': 'الأسئلة المقترحة',
      'admin.layout.navSystemPrompts': 'طلبات النظام',
      'admin.layout.navConsultations': 'الدعم',
      'admin.layout.navFeedback': 'التعليقات',
      'admin.layout.navFileUpload': 'إدارة الملفات',
      'admin.layout.navSettings': 'الإعدادات',
      'admin.layout.navPermissions': 'الصلاحيات',
      'admin.layout.navSupport': 'الدعم',
      'admin.layout.navNotifications': 'الإشعارات',
      'admin.layout.navFeedbackQuestions': 'أسئلة التعليقات',
      // Notifications page
      'notifications.title': 'الإشعارات',
      'notifications.subtitle': 'إدارة إشعارات النظام',
      // Labels
      'admin.layout.superAdminOnly': 'مدير رئيسي فقط',
      'admin.layout.admin': 'مدير',
      'admin.layout.super': 'مدير رئيسي',
      'admin.layout.plan': 'الباقة',
      'admin.layout.planEnterprise': 'مؤسساتي',
      'admin.layout.planPro': 'احترافي',
      'admin.layout.planFree': 'مجاني',
      'admin.layout.logout': 'تسجيل الخروج',
      'admin.layout.controlCenter': 'مركز التحكم',
      'admin.layout.switchLanguage': 'تبديل اللغة',
      'admin.layout.langVi': 'Tiếng Việt',
      'admin.layout.langEn': 'English',
      'admin.layout.langAr': 'العربية',
      'admin.layout.langFr': 'Français',
      // Top bar titles
      'admin.topBar.overview': 'نظرة عامة',
      'admin.topBar.overviewSub': 'عرض سريع لحالة النظام',
      'admin.topBar.users': 'المستخدمون',
      'admin.topBar.usersSub': 'إدارة حسابات المستخدمين',
      'admin.topBar.products': 'المنتجات',
      'admin.topBar.productsSub': 'إدارة الفئات والمنتجات',
      'admin.topBar.agents': 'وكلاء الذكاء الاصطناعي',
      'admin.topBar.agentsSub': 'إدارة وكلاء الذكاء الاصطناعي',
      'admin.topBar.prompts': 'طلبات النظام',
      'admin.topBar.promptsSub': 'إدارة طلبات الذكاء الاصطناعي',
      'admin.topBar.consultations': 'الاستشارات',
      'admin.topBar.consultationsSub': 'عرض وإدارة طلبات الاستشارة',
      'admin.topBar.templates': 'القوالب',
      'admin.topBar.templatesSub': 'إدارة قوالب الطلبات',
      // File Management translations
      'admin.topBar.fileManagement': 'إدارة تحميل الملفات',
      'admin.topBar.fileManagementSub': 'تكوين ميزات تحميل الملفات وحدودها للمستخدمين',
      // Feedback page
      'admin.topBar.feedback': 'تعليقات الشات بوت',
      'admin.topBar.feedbackSub': 'إحصائيات تعليقات المستخدمين على ردود الشات بوت',
      // Notifications page
      'admin.topBar.notifications': 'الإشعارات',
      'admin.topBar.notificationsSub': 'إدارة إشعارات النظام',
      // Support page
      'admin.topBar.support': 'الدعم',
      'admin.topBar.supportSub': 'إدارة تذاكر دعم المستخدمين',
    },
    fr: {
      // Navigation
      'admin.layout.navOverview': 'Aperçu',
      'admin.layout.navAiChatbox': 'Chatbot IA',
      'admin.layout.navUsers': 'Utilisateurs',
      'admin.layout.navProducts': 'Produits',
      'admin.layout.navScraper': 'Extracteur',
      'admin.layout.navActivityLogs': 'Journaux d\'activité',
      'admin.layout.navAnalytics': 'Rapports',
      'admin.layout.navAgents': 'Agents IA',
      'admin.layout.navChatbotCenter': 'Centre Chatbot',
      'admin.layout.navSuggestedQuestions': 'Questions suggérées',
      'admin.layout.navSystemPrompts': 'Prompts système',
      'admin.layout.navConsultations': 'Support',
      'admin.layout.navFeedback': 'Commentaires',
      'admin.layout.navFileUpload': 'Gestion des fichiers',
      'admin.layout.navSettings': 'Paramètres',
      'admin.layout.navPermissions': 'Permissions',
      'admin.layout.navSupport': 'Support',
      'admin.layout.navNotifications': 'Notifications',
      'admin.layout.navFeedbackQuestions': 'Questions de feedback',
      // Notifications page
      'notifications.title': 'Notifications',
      'notifications.subtitle': 'Gestion des notifications système',
      // Labels
      'admin.layout.superAdminOnly': 'Super Admin uniquement',
      'admin.layout.admin': 'Admin',
      'admin.layout.super': 'SUPER',
      'admin.layout.plan': 'Plan',
      'admin.layout.planEnterprise': 'Entreprise',
      'admin.layout.planPro': 'Pro',
      'admin.layout.planFree': 'Gratuit',
      'admin.layout.logout': 'Déconnexion',
      'admin.layout.controlCenter': 'Centre de contrôle',
      'admin.layout.switchLanguage': 'Changer de langue',
      'admin.layout.langVi': 'Tiếng Việt',
      'admin.layout.langEn': 'English',
      'admin.layout.langAr': 'العربية',
      'admin.layout.langFr': 'Français',
      // Top bar titles
      'admin.topBar.overview': 'Aperçu',
      'admin.topBar.overviewSub': 'Vue rapide de l\'état du système',
      'admin.topBar.users': 'Utilisateurs',
      'admin.topBar.usersSub': 'Gérer les comptes utilisateurs',
      'admin.topBar.products': 'Produits',
      'admin.topBar.productsSub': 'Gérer les catégories et produits',
      'admin.topBar.agents': 'Agents IA',
      'admin.topBar.agentsSub': 'Gérer les agents IA',
      'admin.topBar.prompts': 'Prompts système',
      'admin.topBar.promptsSub': 'Gérer les prompts IA',
      'admin.topBar.consultations': 'Consultations',
      'admin.topBar.consultationsSub': 'Voir et gérer les demandes de consultation',
      'admin.topBar.templates': 'Modèles',
      'admin.topBar.templatesSub': 'Gérer les modèles de prompts',
      // File Management translations
      'admin.topBar.fileManagement': 'Gestion des fichiers',
      'admin.topBar.fileManagementSub': 'Configurer les fonctionnalités de téléchargement et les limites pour les utilisateurs',
      // Feedback page
      'admin.topBar.feedback': 'Commentaires du Chatbot',
      'admin.topBar.feedbackSub': 'Statistiques des commentaires des utilisateurs sur les réponses du chatbot',
      // Notifications page
      'admin.topBar.notifications': 'Notifications',
      'admin.topBar.notificationsSub': 'Gérer les notifications système',
      // Support page
      'admin.topBar.support': 'Support',
      'admin.topBar.supportSub': 'Gérer les tickets de support utilisateurs',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

interface NavItem {
  labelKey: string;
  href: string;
  icon: string;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'admin.layout.navOverview', href: '/admin', icon: 'dashboard' },
  { labelKey: 'admin.layout.navAiChatbox', href: '/admin/widget', icon: 'smart_toy' },
  { labelKey: 'admin.layout.navUsers', href: '/admin/users', icon: 'group' },
  { labelKey: 'admin.layout.navProducts', href: '/admin/products', icon: 'inventory_2' },
  { labelKey: 'admin.layout.navScraper', href: '/admin/scraper', icon: 'cloud_download' },
  // Gộp Nhật ký hoạt động + Phân tích → chỉ còn "Báo cáo" (trỏ /admin/analytics)
  { labelKey: 'admin.layout.navAnalytics', href: '/admin/analytics', icon: 'analytics' },
  { labelKey: 'admin.layout.navAgents', href: '/admin/agents', icon: 'smart_toy' },
  { labelKey: 'admin.layout.navChatbotCenter', href: '/admin/chatbots', icon: 'hub' },
  // Gộp Câu hỏi gợi ý vào AI Agents tab → xoá khỏi sidebar
  { labelKey: 'admin.layout.navSystemPrompts', href: '/admin/prompts', icon: 'edit_note' },
  { labelKey: 'admin.layout.navConsultations', href: '/admin/consultations', icon: 'support_agent' },
  { labelKey: 'admin.layout.navFeedbackQuestions', href: '/admin/feedback-questions', icon: 'thumb_down' },
  { labelKey: 'admin.layout.navFileUpload', href: '/admin/file-management', icon: 'upload_file', superAdminOnly: true },
  { labelKey: 'admin.layout.navSettings', href: '/admin/settings', icon: 'settings_suggest', superAdminOnly: true },
  { labelKey: 'admin.layout.navPermissions', href: '/admin/permissions', icon: 'admin_panel_settings', superAdminOnly: true },
];

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  titleKey?: string;
  subtitle?: string;
  subtitleKey?: string;
  showFab?: boolean;
  showLayoutTitle?: boolean;
}

/**
 * @deprecated Dùng AdminShell trực tiếp cho layout Linear-style mới.
 * Giữ lại để các trang admin cũ vẫn hoạt động.
 */
export function AdminLayout({
  children,
  title,
  titleKey,
  subtitle,
  subtitleKey,
  showFab: _showFab = false,
  showLayoutTitle = true,
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const isUserSuperAdmin = isSuperAdmin();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get the title
  const getCurrentTitle = () => {
    if (title) return title;
    if (titleKey) return tL(titleKey);
    return tL('admin.layout.controlCenter');
  };

  const getCurrentSubtitle = () => {
    if (subtitle) return subtitle;
    if (subtitleKey) return tL(subtitleKey);
    return '';
  };

  const currentTitle = getCurrentTitle();
  const currentSubtitle = getCurrentSubtitle();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      className="font-body-md antialiased bg-background text-on-background min-h-screen flex"
      style={{ overflowX: 'hidden' }}
    >
      {/* Material Symbols font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap" />
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .font-display-lg { font-family: 'Manrope', sans-serif; }
        .font-body-lg, .font-body-md, .font-label-md, .font-label-sm { font-family: 'Inter', sans-serif; }
      `}</style>
      <style>{`
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        nav::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* SIDEBAR - Desktop */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 border-r border-white/10 z-50 flex-col p-4 gap-2 backdrop-blur-xl bg-white/70 border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        {/* Logo */}
        <div className="mb-6 px-2 flex items-center">
          <img src={madaLogo} alt="MADA" className="h-12 w-auto" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS
            .filter((item) => {
              if (item.superAdminOnly && !isUserSuperAdmin) return false;
              return true;
            })
            .map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-150 active:scale-95',
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-md'
                    : 'text-on-surface-variant hover:bg-surface-variant/50 hover:scale-[1.02]'
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-label-md">{tL(item.labelKey)}</span>
              </Link>
            );
          })}

        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/20 flex flex-col gap-1">
          {/* User Role Badge */}
          <div className="px-4 py-3 mb-4 rounded-2xl border border-primary/10 bg-primary/5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_circle</span>
              <span className="font-label-sm font-bold text-primary truncate flex-1">{user?.name || user?.email || tL('admin.layout.admin')}</span>
              {isUserSuperAdmin ? (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                  {tL('admin.layout.super')}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  {tL('admin.layout.admin')}
                </span>
              )}
            </div>
            <p className="font-label-sm text-primary/70 mt-1">
              {tL('admin.layout.plan')}: {user?.plan === 'enterprise' ? tL('admin.layout.planEnterprise') : user?.plan === 'pro' ? tL('admin.layout.planPro') : tL('admin.layout.planFree')}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-error/5 hover:text-error transition-all text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-md">{tL('admin.layout.logout')}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="md:ml-64 min-h-screen overflow-y-auto flex-1 flex flex-col w-full">
        {/* TOP BAR */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-outline-variant/30 px-4 md:px-8 py-3 flex items-center gap-3 md:gap-4 shrink-0">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-surface-variant/50 hover:bg-surface-variant transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 min-w-0">
            {showLayoutTitle && (
              <div>
                <h1 className="font-display-lg text-lg md:text-xl font-bold text-on-surface truncate">{currentTitle}</h1>
                {currentSubtitle && (
                  <p className="text-xs text-on-surface-variant truncate mt-0.5 hidden sm:block">{currentSubtitle}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell placeholder - notifications page removed */}

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20">
              <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
              <span className="font-label-sm font-semibold text-primary">{user?.email || user?.name || tL('admin.layout.admin')}</span>
              {isUserSuperAdmin && (
                <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                  {tL('admin.layout.super')}
                </span>
              )}
            </div>

            {/* Language Selector - Premium Design */}
            <div className="relative group">
              <button className="group/btn flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all duration-300 backdrop-blur-sm">
                {/* Globe Icon */}
                <span className="material-symbols-outlined text-[16px] text-primary transition-transform duration-300 group-hover/btn:rotate-12">language</span>
                
                {/* Flag + Code */}
                <span className="text-base leading-none">
                  {language === 'vi' ? '🇻🇳' : language === 'en' ? '🇺🇸' : language === 'ar' ? '🇸🇦' : '🇫🇷'}
                </span>
                <span className="font-bold text-xs text-primary tracking-wide">
                  {language === 'vi' ? 'VI' : language === 'en' ? 'EN' : language === 'ar' ? 'AR' : 'FR'}
                </span>
                
                {/* Arrow */}
                <span className="material-symbols-outlined text-[14px] text-primary/70 transition-transform duration-300 group-hover/btn:translate-y-0.5">expand_more</span>
              </button>
              
              {/* Premium Dropdown - Clean Design */}
              <div className="absolute right-0 top-full mt-2 py-2 px-2 rounded-2xl bg-white border border-black/10 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 min-w-[220px]">
                {/* Arrow */}
                <div className="absolute -top-1.5 right-5 w-3 h-3 bg-white border-l border-t border-black/10 rotate-45"></div>
                
                <div className="space-y-1">
                  {/* Vietnamese */}
                  <button
                    onClick={() => setLanguage('vi')}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      language === 'vi' 
                        ? 'bg-emerald-500 text-white' 
                        : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <span className="text-lg">🇻🇳</span>
                    <span className={clsx(
                      'flex-1 text-left text-sm font-medium',
                      language === 'vi' ? 'text-white' : ''
                    )}>
                      {tL('admin.layout.langVi')}
                    </span>
                    <span className={clsx(
                      'text-xs',
                      language === 'vi' ? 'text-white/80' : 'text-gray-400'
                    )}>
                      VI
                    </span>
                    {language === 'vi' && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                  
                  {/* English */}
                  <button
                    onClick={() => setLanguage('en')}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      language === 'en' 
                        ? 'bg-emerald-500 text-white' 
                        : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <span className="text-lg">🇺🇸</span>
                    <span className={clsx(
                      'flex-1 text-left text-sm font-medium',
                      language === 'en' ? 'text-white' : ''
                    )}>
                      {tL('admin.layout.langEn')}
                    </span>
                    <span className={clsx(
                      'text-xs',
                      language === 'en' ? 'text-white/80' : 'text-gray-400'
                    )}>
                      EN
                    </span>
                    {language === 'en' && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                  
                  {/* Arabic */}
                  <button
                    onClick={() => setLanguage('ar')}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      language === 'ar' 
                        ? 'bg-emerald-500 text-white' 
                        : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <span className="text-lg">🇸🇦</span>
                    <span className={clsx(
                      'flex-1 text-left text-sm font-medium',
                      language === 'ar' ? 'text-white' : ''
                    )}>
                      {tL('admin.layout.langAr')}
                    </span>
                    <span className={clsx(
                      'text-xs',
                      language === 'ar' ? 'text-white/80' : 'text-gray-400'
                    )}>
                      AR
                    </span>
                    {language === 'ar' && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                  
                  {/* French */}
                  <button
                    onClick={() => setLanguage('fr')}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      language === 'fr' 
                        ? 'bg-emerald-500 text-white' 
                        : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <span className="text-lg">🇫🇷</span>
                    <span className={clsx(
                      'flex-1 text-left text-sm font-medium',
                      language === 'fr' ? 'text-white' : ''
                    )}>
                      {tL('admin.layout.langFr')}
                    </span>
                    <span className={clsx(
                      'text-xs',
                      language === 'fr' ? 'text-white/80' : 'text-gray-400'
                    )}>
                      FR
                    </span>
                    {language === 'fr' && (
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE BODY */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 pb-36 max-w-[1600px] mx-auto space-y-6 md:space-y-8">
            {children}
          </div>
        </div>
      </main>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          
          {/* Mobile Sidebar */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left-2 duration-200">
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <img src={madaLogo} alt="MADA" className="h-10 w-auto" />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-variant transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {NAV_ITEMS
                .filter((item) => {
                  if (item.superAdminOnly && !isUserSuperAdmin) return false;
                  return true;
                })
                .map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/admin' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-150 active:scale-95',
                        isActive
                          ? 'bg-primary-container text-on-primary-container shadow-md'
                          : 'text-on-surface-variant hover:bg-surface-variant/50 hover:scale-[1.02]'
                      )}
                    >
                      <span className="material-symbols-outlined">{item.icon}</span>
                      <span className="font-label-md">{tL(item.labelKey)}</span>
                    </Link>
                  );
                })}
            </nav>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-outline-variant/30 space-y-3">
              {/* User Info */}
              <div className="px-4 py-3 rounded-2xl border border-primary/10 bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_circle</span>
                  <span className="font-label-sm font-bold text-primary truncate flex-1">{user?.name || user?.email || tL('admin.layout.admin')}</span>
                  {isUserSuperAdmin ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                      {tL('admin.layout.super')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                      {tL('admin.layout.admin')}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-error/5 hover:text-error transition-all text-left"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label-md">{tL('admin.layout.logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
