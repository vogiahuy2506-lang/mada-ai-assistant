import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { PromptTemplates } from './PromptTemplates';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import { useSystemSettingsStore, useAuthStore, useLanguageStore } from '@/stores';
import { translations, Language } from '@/lib/translations';
import clsx from 'clsx';
import { systemApi } from '@/lib/api';
import { CheckCircle, Check, Loader2, AlertCircle, Shield, Settings, Lock, Cloud, CreditCard, Mail, Bug, Sparkles, FileText, Image, Video, Music, File, Pencil, Save, X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

type Tab = 'general' | 'plans' | 'security' | 'ai' | 'integrations' | 'live' | 'system' | 'templates';

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>('general');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  const [dbGrouped, setDbGrouped] = useState<Record<string, Array<{ key: string; value: any; type: string; description: string }>>>({});
  const [dbCategories, setDbCategories] = useState<Record<string, { label: string; icon: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Get current language and translations (reactive)
  const language = useLanguageStore((s) => s.language ?? 'vi') as Language;
  const typedTranslations = translations as Record<Language, Record<string, string>>;
  const lang = typedTranslations[language] || typedTranslations.vi;
  
  // Get current user role
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const {
    anonymousLimit,
    defaultPlanLimit,
    maxFilesPerSession,
    maxFilesTotal,
    maxFileSizeMB,
    categoryOrder,
    setAnonymousLimit,
    setCategoryOrder,
    loadFromBackend,
    setAllSettings,
  } = useSystemSettingsStore();

  // Load settings from backend on mount
  useEffect(() => {
    loadFromBackend();
  }, []);

  useEffect(() => {
    if (tab === 'live') {
      Promise.all([adminApi.getUserStats(), adminApi.getKnowledgeStats()]).then(([u, k]) => {
        if (u.success && u.data) setUserStats(u.data);
        if (k.success && k.data) setKbStats(k.data);
      });
    }
    if (tab === 'system') {
      adminApi.getSettings().then((res) => {
        if (res.success && res.data && (res.data as any).grouped) {
          setDbGrouped((res.data as any).grouped);
          setDbCategories((res.data as any).categories || {});
        }
      });
    }
  }, [tab]);

  const save = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await systemApi.updateSettings({
        anonymousLimit,
        defaultPlanLimit,
        maxFilesPerSession,
        maxFilesTotal,
        maxFileSizeMB,
        categoryOrder,
      });

      if (res.success) {
        setAllSettings(res.data);
        setSavedAt(new Date().toLocaleTimeString());
        setTimeout(() => setSavedAt(null), 3000);
      } else {
        setSaveError(lang['admin.settings.general.saveFailed']);
      }
    } catch (e) {
      console.error('Save error:', e);
      setSaveError(lang['admin.settings.general.connectionError']);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.settings"
      subtitleKey="admin.topBar.settingsSub"
      showLayoutTitle={false}
    >
      {/* ===================== HERO BANNER ===================== */}
      <section className="mb-10">
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          {/* Banner Header - gradient strip */}
          <div className="h-2 bg-gradient-to-r from-primary via-secondary to-tertiary" />
          
          <div className="p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
            {/* Left: Title + Subtitle */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-on-surface tracking-tight leading-tight">
                    {lang['admin.settings.title']}
                  </h1>
                  <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed max-w-xl">
                    {lang['admin.settings.subtitle']}
                  </p>
                </div>
              </div>
              

            </div>

            {/* Right: Role Badge */}
            <div className="flex-shrink-0">
              {isSuperAdmin ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">{lang['admin.settings.superAdmin']}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{lang['admin.settings.admin']}</span>
                  <span className="text-xs text-on-surface-variant">({lang['admin.settings.system.limitedAccess']})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TABS ===================== */}
      <div className="flex items-center gap-1 p-1.5 bg-white rounded-xl border border-outline-variant mb-8 overflow-x-auto">
        {(
          [
            { id: 'general', label: lang['admin.settings.tabs.general'], icon: Settings },
            { id: 'plans', label: lang['admin.settings.tabs.plans'], icon: CreditCard },
            { id: 'security', label: lang['admin.settings.tabs.security'], icon: Shield },
            { id: 'ai', label: lang['admin.settings.tabs.ai'], icon: Sparkles },
            { id: 'integrations', label: lang['admin.settings.tabs.integrations'], icon: Cloud },
            { id: 'live', label: lang['admin.settings.tabs.live'], icon: AlertCircle },
            { id: 'system', label: lang['admin.settings.tabs.system'], icon: Lock },
          ] as { id: Tab; label: string; icon: any }[]
        ).map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md font-semibold text-sm transition-all whitespace-nowrap flex-shrink-0',
              tab === tabItem.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            )}
          >
            <tabItem.icon className="w-4 h-4 flex-shrink-0" />
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ===================== GENERAL TAB ===================== */}
      {tab === 'general' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.general.sectionTitle']}</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.general.systemName']}</label>
                <input
                  defaultValue="MADA AI"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.general.systemUrl']}</label>
                <input
                  defaultValue="https://mada.ai"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.general.contactEmail']}</label>
                <input
                  type="email"
                  defaultValue="contact@mada.vn"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.general.defaultLanguage']}</label>
                <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                  {['Tiếng Việt', 'English', 'Français', 'العربية'].map((langName: string, idx: number) => (
                    <option key={idx}>{langName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.general.description']}</label>
              <textarea
                rows={3}
                defaultValue="MADA AI - Trợ lý ảo thông minh hỗ trợ người khuyết tật tiếp cận công nghệ."
                className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                disabled={isSaving}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang['admin.settings.general.saving']}
                  </>
                ) : (
                  lang['admin.settings.general.saveChanges']
                )}
              </button>
              {savedAt && (
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {lang['admin.settings.general.savedAt']} {savedAt}
                </span>
              )}
              {saveError && (
                <span className="text-sm font-semibold text-error flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== PLANS TAB ===================== */}
      {tab === 'plans' && (
        <div className="space-y-6">
          {/* Anonymous Quota */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.plans.anonQuota']}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang['admin.settings.plans.anonQuotaDesc']}</p>
            </div>
            <div className="p-8">
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anonymousLimit === -1}
                    onChange={(e) => setAnonymousLimit(e.target.checked ? -1 : 10)}
                    className="w-5 h-5 rounded border-outline text-primary focus:ring-primary"
                  />
                  <span className="text-label-md font-semibold text-on-surface">{lang['admin.settings.plans.unlimited']}</span>
                </label>
                {anonymousLimit !== -1 && (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={anonymousLimit}
                      onChange={(e) => setAnonymousLimit(parseInt(e.target.value) || 10)}
                      className="w-24 px-4 py-2.5 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <span className="text-sm text-on-surface-variant">{lang['admin.settings.plans.messagesPerSession']}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File Upload Limits */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.fileUpload.sectionTitle']}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang['admin.settings.fileUpload.sectionDesc']}</p>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  { icon: Image, label: 'Hình ảnh', color: 'from-pink-400 to-purple-500' },
                  { icon: FileText, label: 'PDF', color: 'from-blue-400 to-cyan-500' },
                  { icon: Video, label: 'Video', color: 'from-violet-500 to-purple-600' },
                  { icon: Music, label: lang['admin.settings.fileUpload.audio'], color: 'from-orange-400 to-amber-500' },
                  { icon: File, label: 'File', color: 'from-gray-500 to-gray-600' },
                ].map((item) => (
                  <div key={item.label} className={`flex flex-col items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${item.color}`}>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ⭐ Bot Order - Sắp xếp thứ tự hiển thị các bot */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.arrangeBots'] || 'Sắp xếp Bot'}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang['admin.settings.dragToReorder'] || 'Kéo thả để thay đổi thứ tự hiển thị của các bot trong sidebar'}</p>
            </div>
            <div className="p-8">
              {/* Bot order list */}
              <div className="space-y-2">
                {(categoryOrder || ['vision', 'hearing', 'communication', 'cognition', 'mobility', 'daily_living', 'education']).map((botId, index) => {
                  const botNames: Record<string, { name: string; icon: string; color: string }> = {
                    vision: { name: lang['admin.settings.bot.vision'] || 'Cảm giác - Thị giác', icon: '👁️', color: 'bg-violet-100 text-violet-700' },
                    hearing: { name: lang['admin.settings.bot.hearing'] || 'Cảm giác - Thính giác', icon: '👂', color: 'bg-blue-100 text-blue-700' },
                    communication: { name: lang['admin.settings.bot.communication'] || 'Giọng nói & Lời nói', icon: '🎤', color: 'bg-rose-100 text-rose-700' },
                    cognition: { name: lang['admin.settings.bot.cognition'] || 'Tâm thần - Nhận thức', icon: '🧠', color: 'bg-amber-100 text-amber-700' },
                    mobility: { name: lang['admin.settings.bot.mobility'] || 'Vận động thần kinh', icon: '🦾', color: 'bg-green-100 text-green-700' },
                    daily_living: { name: lang['admin.settings.bot.dailyLiving'] || 'Hỗ trợ sinh hoạt', icon: '🏠', color: 'bg-purple-100 text-purple-700' },
                    education: { name: lang['admin.settings.bot.education'] || 'Giáo dục', icon: '📚', color: 'bg-teal-100 text-teal-700' },
                  };
                  const bot = botNames[botId] || { name: botId, icon: '🤖', color: 'bg-gray-100 text-gray-700' };

                  return (
                    <div
                      key={botId}
                      className="flex items-center gap-3 p-4 rounded-xl bg-surface-variant/30 border border-outline-variant hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      {/* Drag handle */}
                      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-50 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      {/* Order number */}
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </div>

                      {/* Bot icon and name */}
                      <div className={`w-10 h-10 rounded-xl ${bot.color} flex items-center justify-center text-xl flex-shrink-0`}>
                        {bot.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface">{bot.name}</p>
                        <p className="text-xs text-on-surface-variant">{botId}</p>
                      </div>

                      {/* Move buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            if (index > 0 && categoryOrder) {
                              const newOrder = [...categoryOrder];
                              [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                              setCategoryOrder(newOrder);
                            }
                          }}
                          disabled={index === 0}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={lang['common.moveUp'] || 'Di chuyển lên'}
                        >
                          <ArrowUp className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => {
                            const maxIndex = (categoryOrder || ['vision', 'hearing', 'communication', 'cognition', 'mobility', 'daily_living', 'education']).length - 1;
                            if (index < maxIndex && categoryOrder) {
                              const newOrder = [...categoryOrder];
                              [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                              setCategoryOrder(newOrder);
                            }
                          }}
                          disabled={index === (categoryOrder || ['vision', 'hearing', 'communication', 'cognition', 'mobility', 'daily_living', 'education']).length - 1}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={lang['common.moveDown'] || 'Di chuyển xuống'}
                        >
                          <ArrowDown className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {lang['admin.settings.orderApplied'] || 'Thứ tự sẽ được áp dụng ngay lập tức sau khi lưu'}
              </div>
            </div>
          </div>

          {/* Pricing Plans Editor */}
          <PricingPlansEditor language={language} />

          {/* Save Button for Quota Settings */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang['admin.settings.general.saving']}
                </>
              ) : (
                lang['admin.settings.plans.saveConfig']
              )}
            </button>
            {savedAt && (
              <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                {lang['admin.settings.general.savedAt']} {savedAt}
              </span>
            )}
            {saveError && (
              <span className="text-sm font-semibold text-error flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ===================== SECURITY TAB ===================== */}
      {tab === 'security' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.security.sectionTitle']}</h3>
          </div>
          <div className="p-8 space-y-4">
            {([
              {
                label: lang['admin.settings.security.require2FA'],
                desc: lang['admin.settings.security.require2FADesc'],
                value: true,
              },
              {
                label: lang['admin.settings.security.allowGoogle'],
                desc: lang['admin.settings.security.allowGoogleDesc'],
                value: true,
              },
              {
                label: lang['admin.settings.security.ipWhitelist'],
                desc: lang['admin.settings.security.ipWhitelistDesc'],
                value: false,
              },
              {
                label: lang['admin.settings.security.auditLog'],
                desc: lang['admin.settings.security.auditLogDesc'],
                value: true,
              },
              {
                label: lang['admin.settings.security.autoLock'],
                desc: lang['admin.settings.security.autoLockDesc'],
                value: true,
              },
            ] as { label: string; desc: string; value: boolean }[]
            ).map((item, idx) => (
              <ToggleRow key={idx} label={item.label} desc={item.desc} value={item.value} />
            ))}

            <div className="pt-4 border-t border-outline-variant space-y-2">
              <label className="text-label-sm font-semibold text-on-surface">
                {lang['admin.settings.security.jwtSecret']}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value="sk_live_●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●"
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono"
                />
                <button className="px-4 py-2.5 rounded-xl bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-label-md font-semibold text-sm border border-outline-variant transition-colors">
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                disabled={isSaving}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang['admin.settings.general.saving']}
                  </>
                ) : (
                  lang['admin.settings.security.saveConfig']
                )}
              </button>
              {savedAt && (
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {lang['admin.settings.general.savedAt']} {savedAt}
                </span>
              )}
              {saveError && (
                <span className="text-sm font-semibold text-error flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== AI TAB ===================== */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.ai.sectionTitle']}</h3>
          </div>
          <div className="p-8 space-y-4">
            {([
              {
                name: lang['admin.settings.ai.madaLLM'],
                version: 'v4.2.1',
                status: 'active',
                desc: lang['admin.settings.ai.madaLLMDesc'],
                color: 'primary',
              },
              {
                name: lang['admin.settings.ai.madaVision'],
                version: 'v2.0',
                status: 'active',
                desc: lang['admin.settings.ai.madaVisionDesc'],
                color: 'secondary',
              },
              {
                name: lang['admin.settings.ai.madaVoice'],
                version: 'v1.5',
                status: 'beta',
                desc: lang['admin.settings.ai.madaVoiceDesc'],
                color: 'tertiary',
              },
            ] as { name: string; version: string; status: string; desc: string; color: string }[]
            ).map((m) => (
              <div
                key={m.name}
                className="flex items-start gap-4 p-5 rounded-xl border border-outline-variant hover:border-outline transition-colors"
              >
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  m.color === 'primary' ? 'bg-primary/10' : m.color === 'secondary' ? 'bg-secondary/10' : 'bg-tertiary/10'
                )}>
                  <Sparkles className={clsx(
                    'w-5 h-5',
                    m.color === 'primary' ? 'text-primary' : m.color === 'secondary' ? 'text-secondary' : 'text-tertiary'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-bold text-on-surface">{m.name}</h4>
                    <span className="px-2 py-0.5 rounded bg-surface-variant text-xs font-mono text-on-surface-variant">{m.version}</span>
                    <span className={clsx(
                      'px-2.5 py-1 rounded-full text-xs font-bold',
                      m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{m.desc}</p>
                </div>
                <button className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-label-md font-semibold hover:bg-primary/90 transition-colors flex-shrink-0">
                  {lang['admin.settings.ai.update']}
                </button>
              </div>
            ))}

            <div className="pt-4 border-t border-outline-variant grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.ai.temperature']}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue="0.7"
                    className="flex-1"
                  />
                  <span className="text-sm font-mono text-on-surface-variant w-8 text-right">0.7</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang['admin.settings.ai.maxTokens']}</label>
                <input
                  type="number"
                  defaultValue="2048"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                {lang['admin.settings.ai.saveConfig']}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== INTEGRATIONS TAB ===================== */}
      {tab === 'integrations' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.integrations.sectionTitle']}</h3>
          </div>
          <div className="p-8 space-y-3">
            {([
              { name: lang['admin.settings.integrations.openai'], desc: lang['admin.settings.integrations.openaiDesc'], icon: Sparkles, connected: true, color: 'primary' },
              { name: lang['admin.settings.integrations.googleCloud'], desc: lang['admin.settings.integrations.googleCloudDesc'], icon: Cloud, connected: true, color: 'secondary' },
              { name: lang['admin.settings.integrations.stripe'], desc: lang['admin.settings.integrations.stripeDesc'], icon: CreditCard, connected: false, color: 'primary' },
              { name: lang['admin.settings.integrations.sendgrid'], desc: lang['admin.settings.integrations.sendgridDesc'], icon: Mail, connected: true, color: 'error' },
              { name: lang['admin.settings.integrations.sentry'], desc: lang['admin.settings.integrations.sentryDesc'], icon: Bug, connected: true, color: 'primary' },
            ] as { name: string; desc: string; icon: any; connected: boolean; color: string }[]
            ).map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant hover:border-primary/30 transition-colors"
              >
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  s.color === 'primary' ? 'bg-primary/10' : s.color === 'secondary' ? 'bg-secondary/10' : s.color === 'error' ? 'bg-error/10' : 'bg-surface-variant'
                )}>
                  <s.icon className={clsx(
                    'w-5 h-5',
                    s.color === 'primary' ? 'text-primary' : s.color === 'secondary' ? 'text-secondary' : s.color === 'error' ? 'text-error' : 'text-on-surface-variant'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface">{s.name}</p>
                    {s.connected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {lang['admin.settings.integrations.connected']}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant">{s.desc}</p>
                </div>
                <button
                  className={clsx(
                    'px-4 py-2.5 rounded-xl font-label-md font-semibold text-sm transition-colors flex-shrink-0',
                    s.connected
                      ? 'border border-outline-variant text-on-surface-variant hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      : 'bg-primary text-on-primary hover:bg-primary/90'
                  )}
                >
                  {s.connected ? lang['admin.settings.integrations.disconnect'] : lang['admin.settings.integrations.connect']}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== LIVE STATUS TAB ===================== */}
      {tab === 'live' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.live.sectionTitle']}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang['admin.settings.live.sectionDesc']}</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Users Card */}
              <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <h4 className="font-black text-on-surface">{lang['admin.settings.live.users']}</h4>
                </div>
                {userStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang['admin.settings.live.total']}</p>
                      <p className="text-xl font-black text-on-surface mt-1">{userStats.total}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang['admin.settings.live.active']}</p>
                      <p className="text-xl font-black text-secondary mt-1">{userStats.active}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang['admin.settings.live.suspended']}</p>
                      <p className="text-xl font-black text-error mt-1">{userStats.suspended}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang['admin.settings.live.pending']}</p>
                      <p className="text-xl font-black text-tertiary mt-1">{userStats.pending}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant py-4 text-center">{lang['admin.settings.live.loading']}</p>
                )}
              </div>

              {/* Knowledge Base Card */}
              <div className="p-6 rounded-xl bg-secondary/5 border border-secondary/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </div>
                  <h4 className="font-black text-on-surface">{lang['admin.settings.live.knowledgeBase']}</h4>
                </div>
                {kbStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                      <span className="text-sm text-on-surface-variant">{lang['admin.settings.live.totalDocs']}</span>
                      <span className="text-lg font-black text-primary">{kbStats.totalDocuments}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                      <span className="text-sm text-on-surface-variant">{lang['admin.settings.live.categories']}</span>
                      <span className="text-lg font-black text-secondary">{kbStats.totalCategories}</span>
                    </div>
                    {kbStats.totalSize !== undefined && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                        <span className="text-sm text-on-surface-variant">{lang['admin.settings.live.storageSize']}</span>
                        <span className="text-lg font-black text-tertiary">{(kbStats.totalSize / 1024).toFixed(2)} KB</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant py-4 text-center">{lang['admin.settings.live.loading']}</p>
                )}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.live.endpoints']}</h3>
            </div>
            <div className="p-8">
              <div className="font-mono text-sm space-y-1.5 text-on-surface-variant p-4 bg-surface-variant/30 rounded-xl border border-outline-variant">
                <p>• GET /api/health</p>
                <p>• GET /api/users | PATCH /api/users/:id</p>
                <p>• GET /api/knowledge/stats | GET /api/knowledge/search</p>
                <p>• GET /api/admin/logs | GET /api/admin/analytics</p>
                <p>• POST /api/auth/login | POST /api/auth/register</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SYSTEM DB TAB ===================== */}
      {tab === 'system' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.system.dbTitle']}</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Database settings for system configuration. Table: <code className="text-xs bg-surface-variant px-1.5 py-0.5 rounded">system_settings</code>
                </p>
              </div>
              {!isSuperAdmin && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Super Admin Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Access Denied */}
          {!isSuperAdmin ? (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-amber-500 mb-4" />
              <h4 className="text-lg font-bold text-amber-800 mb-2">{lang['admin.settings.system.accessDenied']}</h4>
              <p className="text-sm text-amber-600">
                {lang['admin.settings.system.accessDeniedDesc']}
              </p>
            </div>
          ) : Object.keys(dbGrouped).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-on-surface-variant">{lang['admin.settings.system.loading']}</p>
            </div>
          ) : (
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(dbGrouped).map(([catKey, items]) => {
                  const cat = dbCategories[catKey] || { label: catKey, icon: 'settings' };
                  return (
                    <div key={catKey} className="rounded-xl border border-outline-variant overflow-hidden">
                      <div className="px-5 py-4 bg-surface-variant/30 border-b border-outline-variant flex items-center gap-2">
                        <Settings className="w-4 h-4 text-primary" />
                        <h4 className="font-bold text-on-surface">{cat.label}</h4>
                        <span className="ml-auto text-xs bg-surface-variant px-2 py-0.5 rounded-full text-on-surface-variant">{items.length}</span>
                      </div>
                      <div className="divide-y divide-outline-variant/50">
                        {items.map((item) => (
                          <div key={item.key} className="flex items-center justify-between px-5 py-3 hover:bg-surface-variant/20 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="font-mono text-xs text-on-surface truncate">{item.key}</div>
                              {item.description && (
                                <div className="text-[10px] text-on-surface-variant truncate">{item.description}</div>
                              )}
                            </div>
                            <div className={clsx(
                              'px-2.5 py-1 rounded text-xs font-mono flex-shrink-0',
                              item.type === 'number' && 'bg-blue-50 text-blue-700',
                              item.type === 'boolean' && 'bg-purple-50 text-purple-700',
                              item.type === 'string' && 'bg-surface-variant text-on-surface-variant',
                              item.type === 'json' && 'bg-amber-50 text-amber-700'
                            )}>
                              {String(item.value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TEMPLATES TAB ===================== */}
      {tab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.templates.sectionTitle']}</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {lang['admin.settings.templates.sectionDesc']}
              </p>
            </div>
            <div className="p-6">
              <PromptTemplates isInline={true} />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function ToggleRow({ label, desc, value }: { label: string; desc: string; value: boolean }) {
  const [enabled, setEnabled] = useState(value);
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-outline-variant hover:border-primary/20 transition-colors">
      <div className="flex-1">
        <p className="font-label-md font-semibold text-on-surface">{label}</p>
        <p className="text-sm text-on-surface-variant mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={clsx(
          'relative w-12 h-7 rounded-full transition-colors flex-shrink-0 mt-0.5',
          enabled ? 'bg-primary' : 'bg-surface-variant'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
            enabled ? 'left-[28px]' : 'left-1'
          )}
        />
      </button>
    </div>
  );
}

// ============== PRICING PLANS EDITOR COMPONENT ==============

interface PricingPlanData {
  id: string;
  planKey: string;
  name_vi: string;
  name_en: string;
  price_amount: number;
  price_currency: string;
  price_note_vi: string;
  price_note_en: string;
  description_vi: string;
  description_en: string;
  features_vi: string[];
  features_en: string[];
  is_active: boolean;
  is_highlighted: boolean;
  cta_text_vi: string;
  cta_text_en: string;
  isEditing: boolean;
}

interface PricingPlansEditorProps {
  language: 'vi' | 'en' | 'ar' | 'fr';
}

function PricingPlansEditor({ language }: PricingPlansEditorProps) {
  const [plans, setPlans] = useState<PricingPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typedTranslations = translations as Record<Language, Record<string, string>>;
  const lang = typedTranslations[language] || typedTranslations.vi;

  // Load plans from API
  useEffect(() => {
    loadPlans();
  }, [language]);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    const res = await adminApi.getPricingPlans({ language });
    if (res.success && res.data) {
      // Transform API data to editable format
      const editablePlans: PricingPlanData[] = res.data.map((p: any) => ({
        id: p.id,
        planKey: p.planKey,
        name_vi: p.name || '',
        name_en: p.name || '',
        price_amount: p.priceAmount || 0,
        price_currency: p.priceCurrency || 'VND',
        price_note_vi: p.priceNote || '',
        price_note_en: p.priceNote || '',
        description_vi: p.description || '',
        description_en: p.description || '',
        features_vi: Array.isArray(p.features) ? p.features : [],
        features_en: Array.isArray(p.features) ? p.features : [],
        is_active: p.isActive !== false,
        is_highlighted: p.isHighlighted || false,
        cta_text_vi: p.ctaText || '',
        cta_text_en: p.ctaText || '',
        isEditing: false,
      }));
      setPlans(editablePlans);
    } else {
      setError(res.error || 'Failed to load pricing plans');
    }
    setLoading(false);
  };

  const updatePlan = (id: string, updates: Partial<PricingPlanData>) => {
    setPlans(plans.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const toggleEdit = (id: string) => {
    setPlans(plans.map(p => p.id === id ? { ...p, isEditing: !p.isEditing } : p));
  };

  const savePlan = async (plan: PricingPlanData) => {
    setSaving(true);
    setError(null);
    
    const res = await adminApi.updatePricingPlan(
      plan.id,
      {
        name_vi: plan.name_vi,
        name_en: plan.name_en,
        price_amount: plan.price_amount,
        price_currency: plan.price_currency,
        price_note_vi: plan.price_note_vi,
        price_note_en: plan.price_note_en,
        description_vi: plan.description_vi,
        description_en: plan.description_en,
        features_vi: plan.features_vi,
        features_en: plan.features_en,
        is_active: plan.is_active,
        is_highlighted: plan.is_highlighted,
        cta_text_vi: plan.cta_text_vi,
        cta_text_en: plan.cta_text_en,
      },
      { language }
    );
    
    if (res.success) {
      setPlans(plans.map(p => p.id === plan.id ? { ...p, isEditing: false } : p));
      setSavedId(plan.id);
      setTimeout(() => setSavedId(null), 3000);
    } else {
      setError(res.error || 'Failed to save pricing plan');
    }
    setSaving(false);
  };

  const addFeature = (planId: string, lang: 'vi' | 'en') => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    if (lang === 'vi') {
      updatePlan(planId, { features_vi: [...plan.features_vi, ''] });
    } else {
      updatePlan(planId, { features_en: [...plan.features_en, ''] });
    }
  };

  const updateFeature = (planId: string, lang: 'vi' | 'en', index: number, value: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    if (lang === 'vi') {
      const newFeatures = [...plan.features_vi];
      newFeatures[index] = value;
      updatePlan(planId, { features_vi: newFeatures });
    } else {
      const newFeatures = [...plan.features_en];
      newFeatures[index] = value;
      updatePlan(planId, { features_en: newFeatures });
    }
  };

  const removeFeature = (planId: string, lang: 'vi' | 'en', index: number) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    
    if (lang === 'vi') {
      updatePlan(planId, { features_vi: plan.features_vi.filter((_, i) => i !== index) });
    } else {
      updatePlan(planId, { features_en: plan.features_en.filter((_, i) => i !== index) });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-error/30 p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-error mb-4" />
        <p className="text-error font-semibold">{error}</p>
        <button onClick={loadPlans} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-outline-variant p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-on-surface">{lang['admin.settings.plans.servicePackage'] || 'Service Packages'}</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              {lang['admin.settings.plans.servicePackageDesc'] || 'Edit service package information. Changes will apply immediately to the entire website.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPlans}
              className="px-4 py-2 rounded-lg border border-outline-variant text-sm font-semibold hover:bg-surface-variant/50 transition-colors"
            >
              {lang['admin.settings.plans.refresh'] || 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-sm text-error font-semibold">{error}</span>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={clsx(
              'bg-white rounded-2xl border overflow-hidden transition-all',
              plan.is_highlighted ? 'border-primary shadow-lg shadow-primary/20' : 'border-outline-variant',
              plan.isEditing && 'ring-2 ring-primary ring-offset-2'
            )}
          >
            {/* Plan Header */}
            <div className={clsx(
              'px-6 py-4 border-b border-outline-variant',
              plan.planKey === 'free' && 'bg-gray-50',
              plan.planKey === 'pro' && 'bg-primary/5',
              plan.planKey === 'enterprise' && 'bg-tertiary/5'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center font-black text-white',
                    plan.planKey === 'free' && 'bg-gray-500',
                    plan.planKey === 'pro' && 'bg-primary',
                    plan.planKey === 'enterprise' && 'bg-tertiary'
                  )}>
                    {plan.planKey === 'free' ? 'F' : plan.planKey === 'pro' ? 'P' : 'E'}
                  </div>
                  <div>
                    <h4 className="font-black text-on-surface">
                      {language === 'vi' ? plan.name_vi : plan.name_en || plan.name_vi}
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      {plan.planKey === 'free' ? 'Miễn phí' : plan.planKey === 'pro' ? 'Pro' : 'Enterprise'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savedId === plan.id && (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Đã lưu
                    </span>
                  )}
                  <button
                    onClick={() => toggleEdit(plan.id)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      plan.isEditing ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80'
                    )}
                  >
                    {plan.isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Plan Content */}
            <div className="p-6 space-y-4">
              {plan.isEditing ? (
                // Edit Mode
                <div className="space-y-4">
                  {/* Name (VI) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Tên (Tiếng Việt)</label>
                    <input
                      value={plan.name_vi}
                      onChange={(e) => updatePlan(plan.id, { name_vi: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Name (EN) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Name (English)</label>
                    <input
                      value={plan.name_en}
                      onChange={(e) => updatePlan(plan.id, { name_en: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-on-surface-variant">Giá (VNĐ)</label>
                      <input
                        type="number"
                        value={plan.price_amount}
                        onChange={(e) => updatePlan(plan.id, { price_amount: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-on-surface-variant">{lang['admin.settings.plans.currency'] || 'Currency'}</label>
                      <select
                        value={plan.price_currency}
                        onChange={(e) => updatePlan(plan.id, { price_currency: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="VND">VND</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  {/* Price Note */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Ghi chú giá (VI)</label>
                    <input
                      value={plan.price_note_vi}
                      onChange={(e) => updatePlan(plan.id, { price_note_vi: e.target.value })}
                      placeholder="VD: /tháng, Liên hệ báo giá"
                      className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Mô tả (Tiếng Việt)</label>
                    <textarea
                      value={plan.description_vi}
                      onChange={(e) => updatePlan(plan.id, { description_vi: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm resize-none focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Features (VI) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-on-surface-variant">Tính năng (Tiếng Việt)</label>
                    {plan.features_vi.map((feat, idx) => (
                      <div key={`vi-${idx}`} className="flex gap-2">
                        <input
                          value={feat}
                          onChange={(e) => updateFeature(plan.id, 'vi', idx, e.target.value)}
                          placeholder={`Tính năng ${idx + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => removeFeature(plan.id, 'vi', idx)}
                          className="p-2 text-error hover:bg-error/10 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addFeature(plan.id, 'vi')}
                      className="w-full py-2 border border-dashed border-outline rounded-lg text-sm text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
                    >
                      + {lang['admin.settings.plans.addFeature'].replace('+ ', '')}
                    </button>
                  </div>

                  {/* CTA Text */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Nút bấm (VI)</label>
                    <input
                      value={plan.cta_text_vi}
                      onChange={(e) => updatePlan(plan.id, { cta_text_vi: e.target.value })}
                      placeholder="VD: Nâng cấp Pro"
                      className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Highlight Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_highlighted}
                      onChange={(e) => updatePlan(plan.id, { is_highlighted: e.target.checked })}
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-semibold">Hiển thị nổi bật (Popular badge)</span>
                  </label>

                  {/* Active Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={(e) => updatePlan(plan.id, { is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-semibold">{lang['admin.settings.plans.active']}</span>
                  </label>

                  {/* Save Button */}
                  <button
                    onClick={() => savePlan(plan)}
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {lang['admin.settings.plans.saveChanges']}
                  </button>
                </div>
              ) : (
                // View Mode
                <div className="space-y-3">
                  {/* Price Display */}
                  <div className="text-center py-3 bg-surface-variant/30 rounded-xl">
                    <div className="text-2xl font-black text-on-surface">
                      {plan.price_amount === 0 ? 'Miễn phí' : (
                        plan.price_currency === 'VND' 
                          ? new Intl.NumberFormat('vi-VN').format(plan.price_amount) + 'đ'
                          : new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.price_currency }).format(plan.price_amount)
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant">{plan.price_note_vi}</div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-on-surface-variant text-center">
                    {language === 'vi' ? plan.description_vi : plan.description_en || plan.description_vi}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {(language === 'vi' ? plan.features_vi : plan.features_en || plan.features_vi).slice(0, 5).map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-on-surface">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="pt-2">
                    <button
                      className={clsx(
                        'w-full py-2.5 rounded-xl font-semibold text-sm transition-colors',
                        plan.is_highlighted
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-surface-variant text-on-surface hover:bg-surface-variant/80'
                      )}
                    >
                      {plan.cta_text_vi || 'Chọn gói này'}
                    </button>
                  </div>

                  {plan.is_highlighted && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Phổ biến
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminSettings;
