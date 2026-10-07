import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { PromptsEditor } from './PromptsEditor';
import { ChatCustomization } from './ChatCustomization';
import { useAuthStore, useLanguageStore, usePromptStore } from '@/stores';
import { Sparkles, MessageSquare, Settings, FileText } from 'lucide-react';

const t = (key: string, lang: string): string => {
  const translations: Record<string, Record<string, string>> = {
    vi: {
      'admin.topBar.prompts': 'System Prompts',
      'admin.topBar.promptsSub': 'Quản lý prompts cho AI agents',
      'admin.prompts.bannerTitle': 'Quản lý Prompts',
      'admin.prompts.bannerDesc': 'Cấu hình system prompts và tùy chỉnh giao diện chat để tối ưu trải nghiệm người dùng với AI.',
      'admin.prompts.systemDb': 'Database hệ thống',
      'admin.prompts.systemDbDesc': 'Truy cập file cấu hình',
      'admin.prompts.systemPromptsBtn': 'System Prompts',
      'admin.prompts.systemPromptsBtnDesc': 'Chỉnh sửa nhanh',
      'admin.prompts.editing': 'Đang chỉnh sửa',
      'admin.prompts.chatCustomization': 'Tùy chỉnh Chat',
      'admin.prompts.chatCustomizationDesc': 'Cấu hình giao diện chat',
      'admin.prompts.close': 'Đóng',
      'admin.prompts.promptsCount': 'Prompts đã cấu hình',
      'admin.prompts.quickActions': 'Thao tác nhanh',
    },
    en: {
      'admin.topBar.prompts': 'System Prompts',
      'admin.topBar.promptsSub': 'Manage AI agent prompts',
      'admin.prompts.bannerTitle': 'Manage Prompts',
      'admin.prompts.bannerDesc': 'Configure system prompts and customize chat interface to optimize user experience with AI.',
      'admin.prompts.systemDb': 'System Database',
      'admin.prompts.systemDbDesc': 'Access configuration files',
      'admin.prompts.systemPromptsBtn': 'System Prompts',
      'admin.prompts.systemPromptsBtnDesc': 'Quick edit',
      'admin.prompts.editing': 'Editing',
      'admin.prompts.chatCustomization': 'Chat Customization',
      'admin.prompts.chatCustomizationDesc': 'Configure chat interface',
      'admin.prompts.close': 'Close',
      'admin.prompts.promptsCount': 'Configured prompts',
      'admin.prompts.quickActions': 'Quick actions',
    },
    ar: {
      'admin.topBar.prompts': 'طلبات النظام',
      'admin.topBar.promptsSub': 'إدارة طلبات الوكلاء الذكيين',
      'admin.prompts.bannerTitle': 'إدارة الطلبات',
      'admin.prompts.bannerDesc': 'تكوين طلبات النظام وتخصيص واجهة المحادثة لتحسين تجربة المستخدم مع الذكاء الاصطناعي.',
      'admin.prompts.systemDb': 'قاعدة بيانات النظام',
      'admin.prompts.systemDbDesc': 'الوصول لملفات التكوين',
      'admin.prompts.systemPromptsBtn': 'طلبات النظام',
      'admin.prompts.systemPromptsBtnDesc': 'تعديل سريع',
      'admin.prompts.editing': 'جاري التعديل',
      'admin.prompts.chatCustomization': 'تخصيص المحادثة',
      'admin.prompts.chatCustomizationDesc': 'تكوين واجهة المحادثة',
      'admin.prompts.close': 'إغلاق',
      'admin.prompts.promptsCount': 'الطلبات المكونة',
      'admin.prompts.quickActions': 'إجراءات سريعة',
    },
    fr: {
      'admin.topBar.prompts': 'Prompts système',
      'admin.topBar.promptsSub': 'Gérer les prompts des agents IA',
      'admin.prompts.bannerTitle': 'Gérer les Prompts',
      'admin.prompts.bannerDesc': 'Configurer les prompts système et personnaliser l\'interface de chat pour optimiser l\'expérience utilisateur avec l\'IA.',
      'admin.prompts.systemDb': 'Base de données système',
      'admin.prompts.systemDbDesc': 'Accéder aux fichiers de configuration',
      'admin.prompts.systemPromptsBtn': 'Prompts Système',
      'admin.prompts.systemPromptsBtnDesc': 'Édition rapide',
      'admin.prompts.editing': 'En cours d\'édition',
      'admin.prompts.chatCustomization': 'Personnalisation du Chat',
      'admin.prompts.chatCustomizationDesc': 'Configurer l\'interface de chat',
      'admin.prompts.close': 'Fermer',
      'admin.prompts.promptsCount': 'Prompts configurés',
      'admin.prompts.quickActions': 'Actions rapides',
    },
  };
  return translations[lang]?.[key] || translations['vi'][key] || key;
};

export function AdminPrompts() {
  const language = useLanguageStore((s) => s.language ?? 'vi');
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || 'admin';
  const prompts = usePromptStore((s) => s.prompts);

  const [showPromptsEditor, setShowPromptsEditor] = useState(false);
  const [showChatCustomization, setShowChatCustomization] = useState(false);

  const configuredPrompts = prompts?.filter((p: any) => p.currentValue !== p.defaultValue).length || 0;

  return (
    <AdminLayout
      titleKey="admin.topBar.prompts"
      subtitleKey="admin.topBar.promptsSub"
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-purple-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {t('admin.prompts.bannerTitle', language)}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              {t('admin.prompts.bannerDesc', language)}
            </p>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.prompts.promptsCount', language)}</p>
            <h3 className="text-xl font-black text-on-surface">{configuredPrompts}</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-purple-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cards</p>
            <h3 className="text-xl font-black text-on-surface">2</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.prompts.quickActions', language)}</p>
            <h3 className="text-xl font-black text-on-surface">2</h3>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 shadow-[6px_6px_0px_0px_#000] transform rotate-[0.3deg] hover:rotate-0 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-slate-300 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <h3 className="text-lg font-black text-emerald-700">Ready</h3>
          </div>
        </div>
      </section>

      {/* 2 Quick-Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* System Prompts */}
        <button
          onClick={() => {
            setShowChatCustomization(false);
            setShowPromptsEditor(!showPromptsEditor);
          }}
          className="relative group flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            backgroundColor: showPromptsEditor ? 'rgba(99,102,241,0.04)' : 'white',
            borderColor: showPromptsEditor ? 'rgba(99,102,241,0.5)' : '#e2e8f0',
            boxShadow: showPromptsEditor ? '0 0 0 4px rgba(99,102,241,0.08), 0 8px 24px rgba(99,102,241,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={{
              backgroundColor: showPromptsEditor ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
              border: `1px solid ${showPromptsEditor ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)'}`,
            }}>
            <span className="material-symbols-outlined text-xl" style={{ color: '#6366f1' }}>edit_note</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: showPromptsEditor ? '#6366f1' : '#1e293b' }}>
              {t('admin.prompts.systemPromptsBtn', language)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: showPromptsEditor ? 'rgba(99,102,241,0.6)' : '#94a3b8' }}>
              {showPromptsEditor ? t('admin.prompts.editing', language) : t('admin.prompts.systemPromptsBtnDesc', language)}
            </p>
          </div>
          <div className="shrink-0">
            <div className="w-3 h-3 rounded-full transition-all duration-300" style={{
              backgroundColor: showPromptsEditor ? '#6366f1' : '#cbd5e1',
              boxShadow: showPromptsEditor ? '0 0 0 4px rgba(99,102,241,0.2)' : 'none',
            }} />
          </div>
        </button>

        {/* Tùy chỉnh Chat */}
        <button
          onClick={() => {
            setShowPromptsEditor(false);
            setShowChatCustomization(!showChatCustomization);
          }}
          className="relative group flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            backgroundColor: showChatCustomization ? 'rgba(14,165,233,0.04)' : 'white',
            borderColor: showChatCustomization ? 'rgba(14,165,233,0.5)' : '#e2e8f0',
            boxShadow: showChatCustomization ? '0 0 0 4px rgba(14,165,233,0.08), 0 8px 24px rgba(14,165,233,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={{
              backgroundColor: showChatCustomization ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)',
              border: `1px solid ${showChatCustomization ? 'rgba(14,165,233,0.25)' : 'rgba(14,165,233,0.15)'}`,
            }}>
            <span className="material-symbols-outlined text-xl" style={{ color: '#0ea5e9' }}>chat</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: showChatCustomization ? '#0ea5e9' : '#1e293b' }}>
              {t('admin.prompts.chatCustomization', language)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: showChatCustomization ? 'rgba(14,165,233,0.6)' : '#94a3b8' }}>
              {showChatCustomization ? t('admin.prompts.editing', language) : t('admin.prompts.chatCustomizationDesc', language)}
            </p>
          </div>
          <div className="shrink-0">
            <div className="w-3 h-3 rounded-full transition-all duration-300" style={{
              backgroundColor: showChatCustomization ? '#0ea5e9' : '#cbd5e1',
              boxShadow: showChatCustomization ? '0 0 0 4px rgba(14,165,233,0.2)' : 'none',
            }} />
          </div>
        </button>
      </div>

      {/* Expanded: System Prompts Editor */}
      {showPromptsEditor && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-primary">edit_note</span>
              {t('admin.prompts.systemPromptsBtn', language)}
            </h2>
            <button
              onClick={() => setShowPromptsEditor(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('admin.prompts.close', language)}
            </button>
          </div>
          <div className="p-5">
            <PromptsEditor onClose={() => setShowPromptsEditor(false)} />
          </div>
        </div>
      )}

      {/* Expanded: Chat Customization */}
      {showChatCustomization && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ color: '#0ea5e9' }}>chat</span>
              {t('admin.prompts.chatCustomization', language)}
            </h2>
            <button
              onClick={() => setShowChatCustomization(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('admin.prompts.close', language)}
            </button>
          </div>
          <div className="p-5">
            <ChatCustomization isInline userRole={userRole} onClose={() => setShowChatCustomization(false)} />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminPrompts;
