import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import { useSystemSettingsStore, useAuthStore } from '@/stores';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { systemApi } from '@/lib/api';
import { CheckCircle, Loader2, AlertCircle, Shield, Settings, Lock, Cloud, CreditCard, Mail, Bug, Sparkles, FileText, Zap, ArrowRight } from 'lucide-react';
import { PromptTemplates } from './PromptTemplates';

type Tab = 'general' | 'plans' | 'security' | 'ai' | 'integrations' | 'live' | 'system' | 'templates';
type Language = 'vi' | 'en' | 'ar' | 'fr';

// Translation object
const t = {
  vi: {
    title: 'Cấu hình Hệ thống',
    subtitle: 'Điều chỉnh các tham số cốt lõi của MADA AI: gói giá, bảo mật, mô hình AI và tích hợp bên thứ ba.',
    tabs: {
      general: 'Chung',
      plans: 'Gói & Quota',
      security: 'Bảo mật',
      ai: 'AI Models',
      integrations: 'Tích hợp',
      live: 'Trạng thái thật',
      system: 'System DB',
      templates: 'Templates',
    },
    general: {
      sectionTitle: 'Thông tin chung',
      systemName: 'Tên hệ thống',
      systemUrl: 'URL hệ thống',
      contactEmail: 'Email liên hệ',
      defaultLanguage: 'Ngôn ngữ mặc định',
      description: 'Mô tả hệ thống',
      saveChanges: 'Lưu thay đổi',
      saving: 'Đang lưu...',
      savedAt: 'Đã lưu lúc',
      saveFailed: 'Lưu thất bại',
      connectionError: 'Lỗi kết nối server',
    },
    plans: {
      sectionTitle: 'Cấu hình Gói & Quota',
      anonQuota: 'Quota cho người dùng ẩn danh',
      unlimited: 'Không giới hạn',
      messagesPerSession: 'tin nhắn/phiên',
      anonQuotaDesc: 'Người dùng chưa đăng nhập sẽ có giới hạn này. Đặt "Không giới hạn" để bỏ giới hạn.',
      fileUploadLimits: 'Giới hạn Upload File',
      filePerSession: 'File/phiên chat:',
      totalFiles: 'Tổng file:',
      fileSize: 'Dung lượng/file:',
      maxPerSession: 'Tối đa file cho mỗi cuộc trò chuyện',
      maxTotalFiles: 'Tổng số file tối đa cho tất cả phiên',
      maxFileSize: 'Kích thước tối đa cho mỗi file',
      supportedFormats: 'Định dạng hỗ trợ:',
      planQuotas: 'Quota theo Gói dịch vụ',
      pricePerMonth: 'Giá (VND/tháng)',
      quotaPerMonth: 'Quota/tháng',
      current: 'HIỆN TẠI',
      saveConfig: 'Lưu cấu hình',
    },
    security: {
      sectionTitle: 'Bảo mật',
      require2FA: 'Bắt buộc 2FA cho Admin',
      require2FADesc: 'Tất cả tài khoản admin phải bật xác thực 2 yếu tố.',
      allowGoogle: 'Cho phép đăng nhập Google',
      allowGoogleDesc: 'Người dùng có thể đăng nhập bằng tài khoản Google.',
      ipWhitelist: 'Giới hạn IP Whitelist',
      ipWhitelistDesc: 'Chỉ cho phép admin đăng nhập từ IP được phê duyệt.',
      auditLog: 'Audit log chi tiết',
      auditLogDesc: 'Ghi lại mọi hành động admin vào bảng admin_audit_log.',
      autoLock: 'Tự động khóa sau 5 lần sai',
      autoLockDesc: 'Khóa tài khoản sau 5 lần đăng nhập thất bại.',
      jwtSecret: 'JWT Secret (chỉ hiển thị một lần)',
      saveConfig: 'Lưu cấu hình',
    },
    ai: {
      sectionTitle: 'Cấu hình AI Models',
      madaLLM: 'MADA-LLM',
      madaLLMDesc: 'Mô hình ngôn ngữ chính cho trợ lý ảo.',
      madaVision: 'MADA-Vision',
      madaVisionDesc: 'Nhận diện hình ảnh thiết bị hỗ trợ.',
      madaVoice: 'MADA-Voice',
      madaVoiceDesc: 'TTS/STT đa ngôn ngữ (Vi, En, Fr, Ar).',
      update: 'Cập nhật',
      temperature: 'Temperature (0–1)',
      maxTokens: 'Max tokens',
      saveConfig: 'Lưu cấu hình',
    },
    integrations: {
      sectionTitle: 'Tích hợp bên thứ ba',
      openai: 'OpenAI API',
      openaiDesc: 'GPT-4 cho RAG fallback',
      googleCloud: 'Google Cloud',
      googleCloudDesc: 'Storage & Translation',
      stripe: 'Stripe',
      stripeDesc: 'Thanh toán Pro/Enterprise',
      sendgrid: 'SendGrid',
      sendgridDesc: 'Email thông báo',
      sentry: 'Sentry',
      sentryDesc: 'Error tracking',
      connected: 'Connected',
      disconnect: 'Ngắt',
      connect: 'Kết nối',
    },
    live: {
      sectionTitle: 'Trạng thái hệ thống (real-time)',
      sectionDesc: 'Dữ liệu đọc trực tiếp từ backend MADA AI.',
      users: 'Người dùng',
      total: 'Tổng',
      active: 'Active',
      suspended: 'Suspended',
      pending: 'Pending',
      knowledgeBase: 'Knowledge Base',
      totalDocs: 'Tổng tài liệu',
      categories: 'Danh mục',
      storageSize: 'Dung lượng',
      endpoints: 'Endpoints',
      loading: 'Đang tải...',
    },
    languages: ['Tiếng Việt', 'English', 'Français', 'العربية'],
  },
  en: {
    title: 'System Configuration',
    subtitle: 'Adjust core parameters of MADA AI: pricing plans, security, AI models and third-party integrations.',
    tabs: {
      general: 'General',
      plans: 'Plans & Quota',
      security: 'Security',
      ai: 'AI Models',
      integrations: 'Integrations',
      live: 'Live Status',
      system: 'System DB',
      templates: 'Templates',
    },
    general: {
      sectionTitle: 'General Information',
      systemName: 'System Name',
      systemUrl: 'System URL',
      contactEmail: 'Contact Email',
      defaultLanguage: 'Default Language',
      description: 'System Description',
      saveChanges: 'Save Changes',
      saving: 'Saving...',
      savedAt: 'Saved at',
      saveFailed: 'Save failed',
      connectionError: 'Server connection error',
    },
    plans: {
      sectionTitle: 'Plans & Quota Configuration',
      anonQuota: 'Anonymous User Quota',
      unlimited: 'Unlimited',
      messagesPerSession: 'messages/session',
      anonQuotaDesc: 'Unauthenticated users will have this limit. Set "Unlimited" to remove limit.',
      fileUploadLimits: 'File Upload Limits',
      filePerSession: 'Files/session:',
      totalFiles: 'Total files:',
      fileSize: 'File size:',
      maxPerSession: 'Maximum files per conversation',
      maxTotalFiles: 'Maximum total files across all sessions',
      maxFileSize: 'Maximum size per file',
      supportedFormats: 'Supported formats:',
      planQuotas: 'Quota by Service Plan',
      pricePerMonth: 'Price (VND/month)',
      quotaPerMonth: 'Quota/month',
      current: 'CURRENT',
      saveConfig: 'Save Configuration',
    },
    security: {
      sectionTitle: 'Security',
      require2FA: 'Require 2FA for Admin',
      require2FADesc: 'All admin accounts must enable two-factor authentication.',
      allowGoogle: 'Allow Google Login',
      allowGoogleDesc: 'Users can log in using Google accounts.',
      ipWhitelist: 'IP Whitelist Limit',
      ipWhitelistDesc: 'Only allow admin login from approved IPs.',
      auditLog: 'Detailed Audit Log',
      auditLogDesc: 'Record all admin actions to admin_audit_log table.',
      autoLock: 'Auto-lock after 5 failures',
      autoLockDesc: 'Lock account after 5 failed login attempts.',
      jwtSecret: 'JWT Secret (shown once)',
      saveConfig: 'Save Configuration',
    },
    ai: {
      sectionTitle: 'AI Models Configuration',
      madaLLM: 'MADA-LLM',
      madaLLMDesc: 'Main language model for virtual assistant.',
      madaVision: 'MADA-Vision',
      madaVisionDesc: 'Recognize assistive device images.',
      madaVoice: 'MADA-Voice',
      madaVoiceDesc: 'Multilingual TTS/STT (Vi, En, Fr, Ar).',
      update: 'Update',
      temperature: 'Temperature (0–1)',
      maxTokens: 'Max tokens',
      saveConfig: 'Save Configuration',
    },
    integrations: {
      sectionTitle: 'Third-party Integrations',
      openai: 'OpenAI API',
      openaiDesc: 'GPT-4 for RAG fallback',
      googleCloud: 'Google Cloud',
      googleCloudDesc: 'Storage & Translation',
      stripe: 'Stripe',
      stripeDesc: 'Pro/Enterprise payments',
      sendgrid: 'SendGrid',
      sendgridDesc: 'Email notifications',
      sentry: 'Sentry',
      sentryDesc: 'Error tracking',
      connected: 'Connected',
      disconnect: 'Disconnect',
      connect: 'Connect',
    },
    live: {
      sectionTitle: 'System Status (real-time)',
      sectionDesc: 'Data read directly from MADA AI backend.',
      users: 'Users',
      total: 'Total',
      active: 'Active',
      suspended: 'Suspended',
      pending: 'Pending',
      knowledgeBase: 'Knowledge Base',
      totalDocs: 'Total Documents',
      categories: 'Categories',
      storageSize: 'Storage Size',
      endpoints: 'Endpoints',
      loading: 'Loading...',
    },
    languages: ['Tiếng Việt', 'English', 'Français', 'العربية'],
  },
  ar: {
    title: 'إعدادات النظام',
    subtitle: 'ضبط المعلمات الأساسية لـ MADA AI: خطط التسعير والأمان ونماذج الذكاء الاصطناعي والتكاملات الخارجية.',
    tabs: {
      general: 'عام',
      plans: 'الخطط والحصص',
      security: 'الأمان',
      ai: 'نماذج الذكاء',
      integrations: 'التكاملات',
      live: 'الحالة المباشرة',
      system: 'قاعدة النظام',
      templates: 'القوالب',
    },
    general: {
      sectionTitle: 'المعلومات العامة',
      systemName: 'اسم النظام',
      systemUrl: 'رابط النظام',
      contactEmail: 'البريد الإلكتروني',
      defaultLanguage: 'اللغة الافتراضية',
      description: 'وصف النظام',
      saveChanges: 'حفظ التغييرات',
      saving: 'جاري الحفظ...',
      savedAt: 'تم الحفظ في',
      saveFailed: 'فشل الحفظ',
      connectionError: 'خطأ في الاتصال بالخادم',
    },
    plans: {
      sectionTitle: 'إعدادات الخطط والحصص',
      anonQuota: 'حصة المستخدم المجهول',
      unlimited: 'غير محدود',
      messagesPerSession: 'رسائل/جلسة',
      anonQuotaDesc: 'المستخدمون غير المصادق عليهم سيكون لديهم هذا الحد. اضبط "غير محدود" لإزالة الحد.',
      fileUploadLimits: 'حدود رفع الملفات',
      filePerSession: 'ملفات/جلسة:',
      totalFiles: 'إجمالي الملفات:',
      fileSize: 'حجم الملف:',
      maxPerSession: 'الحد الأقصى للملفات لكل محادثة',
      maxTotalFiles: 'الحد الأقصى لإجمالي الملفات عبر جميع الجلسات',
      maxFileSize: 'الحد الأقصى لحجم كل ملف',
      supportedFormats: 'التنسيقات المدعومة:',
      planQuotas: 'الحصص حسب خطة الخدمة',
      pricePerMonth: 'السعر (فيتنامdong/شهر)',
      quotaPerMonth: 'الحصة/شهر',
      current: 'الحالي',
      saveConfig: 'حفظ الإعدادات',
    },
    security: {
      sectionTitle: 'الأمان',
      require2FA: 'طلب المصادقة الثنائية للمدير',
      require2FADesc: 'يجب على جميع حسابات المديرين تمكين المصادقة الثنائية.',
      allowGoogle: 'السماح بتسجيل الدخول بجوجل',
      allowGoogleDesc: 'يمكن للمستخدمين تسجيل الدخول باستخدام حسابات جوجل.',
      ipWhitelist: 'قائمة بيضاء IP',
      ipWhitelistDesc: 'السماح فقط بتسجيل دخول المدير من IPs المعتمدة.',
      auditLog: 'سجل التدقيق المفصل',
      auditLogDesc: 'تسجيل جميع إجراءات المدير في جدول سجل التدقيق.',
      autoLock: 'القفل التلقائي بعد 5 محاولات فاشلة',
      autoLockDesc: 'قفل الحساب بعد 5 محاولات تسجيل دخول فاشلة.',
      jwtSecret: 'JWT Secret (يُعرض مرة واحدة)',
      saveConfig: 'حفظ الإعدادات',
    },
    ai: {
      sectionTitle: 'إعدادات نماذج الذكاء الاصطناعي',
      madaLLM: 'MADA-LLM',
      madaLLMDesc: 'نموذج اللغة الرئيسي للمساعد الافتراضي.',
      madaVision: 'MADA-Vision',
      madaVisionDesc: 'التعرف على صور الأجهزة المساعدة.',
      madaVoice: 'MADA-Voice',
      madaVoiceDesc: 'تحويل النص إلى كلام / التعرف على الكلام متعدد اللغات.',
      update: 'تحديث',
      temperature: 'درجة الحرارة (0–1)',
      maxTokens: 'الحد الأقصى للرموز',
      saveConfig: 'حفظ الإعدادات',
    },
    integrations: {
      sectionTitle: 'التكاملات الخارجية',
      openai: 'OpenAI API',
      openaiDesc: 'GPT-4 للانعكاس',
      googleCloud: 'Google Cloud',
      googleCloudDesc: 'التخزين والترجمة',
      stripe: 'Stripe',
      stripeDesc: 'مدفوعات برو/المؤسسات',
      sendgrid: 'SendGrid',
      sendgridDesc: 'إشعارات البريد الإلكتروني',
      sentry: 'Sentry',
      sentryDesc: 'تتبع الأخطاء',
      connected: 'متصل',
      disconnect: 'قطع الاتصال',
      connect: 'اتصال',
    },
    live: {
      sectionTitle: 'حالة النظام (الوقت الفعلي)',
      sectionDesc: 'البيانات مقروءة مباشرة من خلفية MADA AI.',
      users: 'المستخدمون',
      total: 'المجموع',
      active: 'نشط',
      suspended: 'موقوف',
      pending: 'قيد الانتظار',
      knowledgeBase: 'قاعدة المعرفة',
      totalDocs: 'إجمالي المستندات',
      categories: 'الفئات',
      storageSize: 'حجم التخزين',
      endpoints: 'نقاط النهاية',
      loading: 'جاري التحميل...',
    },
    languages: ['Tiếng Việt', 'English', 'Français', 'العربية'],
  },
  fr: {
    title: 'Configuration du Système',
    subtitle: 'Ajustez les paramètres essentiels de MADA AI: forfaits tarifaires, sécurité, modèles d\'IA et intégrations tierces.',
    tabs: {
      general: 'Général',
      plans: 'Forfaits & Quotas',
      security: 'Sécurité',
      ai: 'Modèles IA',
      integrations: 'Intégrations',
      live: 'État en Direct',
      system: 'Base de Données',
      templates: 'Modèles',
    },
    general: {
      sectionTitle: 'Informations Générales',
      systemName: 'Nom du Système',
      systemUrl: 'URL du Système',
      contactEmail: 'Email de Contact',
      defaultLanguage: 'Langue par Défaut',
      description: 'Description du Système',
      saveChanges: 'Enregistrer les Modifications',
      saving: 'Enregistrement...',
      savedAt: 'Enregistré à',
      saveFailed: 'Échec de l\'enregistrement',
      connectionError: 'Erreur de connexion au serveur',
    },
    plans: {
      sectionTitle: 'Configuration des Forfaits & Quotas',
      anonQuota: 'Quota Utilisateur Anonyme',
      unlimited: 'Illimité',
      messagesPerSession: 'messages/session',
      anonQuotaDesc: 'Les utilisateurs non authentifiés auront cette limite. Définissez "Illimité" pour supprimer la limite.',
      fileUploadLimits: 'Limites de Téléversement',
      filePerSession: 'Fichiers/session:',
      totalFiles: 'Total fichiers:',
      fileSize: 'Taille fichier:',
      maxPerSession: 'Fichiers maximum par conversation',
      maxTotalFiles: 'Fichiers totaux maximum pour toutes les sessions',
      maxFileSize: 'Taille maximum par fichier',
      supportedFormats: 'Formats supportés:',
      planQuotas: 'Quota par Forfait de Service',
      pricePerMonth: 'Prix (VND/mois)',
      quotaPerMonth: 'Quota/mois',
      current: 'ACTUEL',
      saveConfig: 'Enregistrer la Configuration',
    },
    security: {
      sectionTitle: 'Sécurité',
      require2FA: 'Exiger 2FA pour Admin',
      require2FADesc: 'Tous les comptes admin doivent activer l\'authentification à deux facteurs.',
      allowGoogle: 'Autoriser Connexion Google',
      allowGoogleDesc: 'Les utilisateurs peuvent se connecter avec un compte Google.',
      ipWhitelist: 'Liste Blanche IP',
      ipWhitelistDesc: 'Autoriser uniquement la connexion admin depuis des IPs approuvées.',
      auditLog: 'Journal d\'Audit Détaillé',
      auditLogDesc: 'Enregistrer toutes les actions admin dans la table admin_audit_log.',
      autoLock: 'Verrouillage auto après 5 échecs',
      autoLockDesc: 'Verrouiller le compte après 5 tentatives de connexion échouées.',
      jwtSecret: 'JWT Secret (affiché une fois)',
      saveConfig: 'Enregistrer la Configuration',
    },
    ai: {
      sectionTitle: 'Configuration des Modèles IA',
      madaLLM: 'MADA-LLM',
      madaLLMDesc: 'Modèle de langage principal pour l\'assistant virtuel.',
      madaVision: 'MADA-Vision',
      madaVisionDesc: 'Reconnaissance d\'images d\'appareils d\'assistance.',
      madaVoice: 'MADA-Voice',
      madaVoiceDesc: 'TTS/STT multilingue (Vi, En, Fr, Ar).',
      update: 'Mettre à jour',
      temperature: 'Température (0–1)',
      maxTokens: 'Tokens max',
      saveConfig: 'Enregistrer la Configuration',
    },
    integrations: {
      sectionTitle: 'Intégrations Tierces',
      openai: 'OpenAI API',
      openaiDesc: 'GPT-4 pour repli RAG',
      googleCloud: 'Google Cloud',
      googleCloudDesc: 'Stockage & Traduction',
      stripe: 'Stripe',
      stripeDesc: 'Paiements Pro/Entreprise',
      sendgrid: 'SendGrid',
      sendgridDesc: 'Notifications email',
      sentry: 'Sentry',
      sentryDesc: 'Suivi des erreurs',
      connected: 'Connecté',
      disconnect: 'Déconnecter',
      connect: 'Connecter',
    },
    live: {
      sectionTitle: 'État du Système (temps réel)',
      sectionDesc: 'Données lues directement depuis le backend MADA AI.',
      users: 'Utilisateurs',
      total: 'Total',
      active: 'Actif',
      suspended: 'Suspendu',
      pending: 'En attente',
      knowledgeBase: 'Base de Connaissances',
      totalDocs: 'Documents Totaux',
      categories: 'Catégories',
      storageSize: 'Taille Stockage',
      endpoints: 'Points de Terminaison',
      loading: 'Chargement...',
    },
    languages: ['Tiếng Việt', 'English', 'Français', 'العربية'],
  },
};

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>('general');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  const [dbGrouped, setDbGrouped] = useState<Record<string, Array<{ key: string; value: any; type: string; description: string }>>>({});
  const [dbCategories, setDbCategories] = useState<Record<string, { label: string; icon: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const language = useLanguageStore((s) => s.language) as Language;
  const lang = t[language] || t.vi;
  
  // Get current user role
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const {
    anonymousLimit,
    defaultPlanLimit,
    maxFilesPerSession,
    maxFilesTotal,
    maxFileSizeMB,
    setAnonymousLimit,
    setDefaultPlanLimit,
    setMaxFilesPerSession,
    setMaxFilesTotal,
    setMaxFileSizeMB,
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
      });

      if (res.success) {
        setAllSettings(res.data);
        setSavedAt(new Date().toLocaleTimeString());
        setTimeout(() => setSavedAt(null), 3000);
      } else {
        setSaveError(lang.general.saveFailed);
      }
    } catch (e) {
      console.error('Save error:', e);
      setSaveError(lang.general.connectionError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      title={lang.title}
      subtitle={lang.subtitle}
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
                    {lang.title}
                  </h1>
                  <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed max-w-xl">
                    {lang.subtitle}
                  </p>
                </div>
              </div>
              
              {/* Prompt Templates Banner */}
              <button
                onClick={() => setTab('templates')}
                className="group flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200/50 hover:border-indigo-300 hover:shadow-md transition-all w-full md:w-auto"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-bold text-slate-800">Prompt Templates</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Template có sẵn theo ngành</p>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right: Role Badge */}
            <div className="flex-shrink-0">
              {isSuperAdmin ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Super Admin</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Admin</span>
                  <span className="text-xs text-on-surface-variant">(Limited Access)</span>
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
            { id: 'general', label: lang.tabs.general, icon: Settings },
            { id: 'plans', label: lang.tabs.plans, icon: CreditCard },
            { id: 'security', label: lang.tabs.security, icon: Shield },
            { id: 'ai', label: lang.tabs.ai, icon: Sparkles },
            { id: 'integrations', label: lang.tabs.integrations, icon: Cloud },
            { id: 'live', label: lang.tabs.live, icon: AlertCircle },
            { id: 'system', label: 'System DB', icon: Lock },
            { id: 'templates', label: lang.tabs.templates, icon: FileText },
          ] as { id: Tab; label: string; icon: any }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md font-semibold text-sm transition-all whitespace-nowrap flex-shrink-0',
              tab === t.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            )}
          >
            <t.icon className="w-4 h-4 flex-shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== GENERAL TAB ===================== */}
      {tab === 'general' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang.general.sectionTitle}</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang.general.systemName}</label>
                <input
                  defaultValue="MADA AI"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang.general.systemUrl}</label>
                <input
                  defaultValue="https://mada.ai"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang.general.contactEmail}</label>
                <input
                  type="email"
                  defaultValue="contact@mada.vn"
                  className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang.general.defaultLanguage}</label>
                <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                  <option>{lang.languages[0]}</option>
                  <option>{lang.languages[1]}</option>
                  <option>{lang.languages[2]}</option>
                  <option>{lang.languages[3]}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-sm font-semibold text-on-surface">{lang.general.description}</label>
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
                    {lang.general.saving}
                  </>
                ) : (
                  lang.general.saveChanges
                )}
              </button>
              {savedAt && (
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {lang.general.savedAt} {savedAt}
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
              <h3 className="text-lg font-black text-on-surface">{lang.plans.anonQuota}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang.plans.anonQuotaDesc}</p>
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
                  <span className="text-label-md font-semibold text-on-surface">{lang.plans.unlimited}</span>
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
                    <span className="text-sm text-on-surface-variant">{lang.plans.messagesPerSession}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File Upload Limits */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang.plans.fileUploadLimits}</h3>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-label-sm font-semibold text-on-surface">{lang.plans.maxPerSession}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-on-surface-variant whitespace-nowrap">{lang.plans.filePerSession}</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={maxFilesPerSession}
                      onChange={(e) => setMaxFilesPerSession(parseInt(e.target.value) || 10)}
                      className="w-20 px-3 py-2.5 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-label-sm font-semibold text-on-surface">{lang.plans.maxTotalFiles}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-on-surface-variant whitespace-nowrap">{lang.plans.totalFiles}</span>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={maxFilesTotal}
                      onChange={(e) => setMaxFilesTotal(parseInt(e.target.value) || 100)}
                      className="w-20 px-3 py-2.5 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-label-sm font-semibold text-on-surface">{lang.plans.maxFileSize}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-on-surface-variant whitespace-nowrap">{lang.plans.fileSize}</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={maxFileSizeMB}
                      onChange={(e) => setMaxFileSizeMB(parseInt(e.target.value) || 50)}
                      className="w-20 px-3 py-2.5 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <span className="text-sm font-semibold text-on-surface-variant">MB</span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-label-sm font-semibold text-on-surface mb-2">{lang.plans.supportedFormats}</p>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'DOCX', 'TXT', 'PNG', 'JPEG', 'JPG', 'PPTX'].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-3 py-1.5 bg-primary/5 text-primary text-xs font-label-sm font-semibold rounded-lg border border-primary/20"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Plan Quotas */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang.plans.planQuotas}</h3>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: 'Free', color: 'gray', price: '0', current: false, planKey: 'free' },
                  { name: 'Pro', color: 'primary', price: '199,000', current: true, planKey: 'pro' },
                  { name: 'Enterprise', color: 'tertiary', price: 'Liên hệ', current: false, planKey: 'enterprise' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className={clsx(
                      'p-5 rounded-xl border',
                      p.current ? 'border-primary bg-primary/5' : 'border-outline-variant'
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-black text-on-surface">{p.name}</span>
                      {p.current && (
                        <span className="px-2.5 py-1 rounded-full bg-primary text-on-primary text-xs font-bold">
                          {lang.plans.current}
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-label-sm font-semibold text-on-surface-variant">{lang.plans.pricePerMonth}</label>
                        <input
                          defaultValue={p.price}
                          className="w-full px-3 py-2.5 rounded-xl bg-surface-variant/30 border border-outline-variant text-on-surface text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-label-sm font-semibold text-on-surface-variant">{lang.plans.quotaPerMonth}</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={defaultPlanLimit === -1}
                            onChange={(e) => setDefaultPlanLimit(e.target.checked ? -1 : 50)}
                            className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                          />
                          <span className="text-xs text-on-surface-variant">{lang.plans.unlimited}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang.general.saving}
                </>
              ) : (
                lang.plans.saveConfig
              )}
            </button>
            {savedAt && (
              <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                {lang.general.savedAt} {savedAt}
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
            <h3 className="text-lg font-black text-on-surface">{lang.security.sectionTitle}</h3>
          </div>
          <div className="p-8 space-y-4">
            {([
              {
                label: lang.security.require2FA,
                desc: lang.security.require2FADesc,
                value: true,
              },
              {
                label: lang.security.allowGoogle,
                desc: lang.security.allowGoogleDesc,
                value: true,
              },
              {
                label: lang.security.ipWhitelist,
                desc: lang.security.ipWhitelistDesc,
                value: false,
              },
              {
                label: lang.security.auditLog,
                desc: lang.security.auditLogDesc,
                value: true,
              },
              {
                label: lang.security.autoLock,
                desc: lang.security.autoLockDesc,
                value: true,
              },
            ] as { label: string; desc: string; value: boolean }[]
            ).map((item, idx) => (
              <ToggleRow key={idx} label={item.label} desc={item.desc} value={item.value} />
            ))}

            <div className="pt-4 border-t border-outline-variant space-y-2">
              <label className="text-label-sm font-semibold text-on-surface">
                {lang.security.jwtSecret}
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
                    {lang.general.saving}
                  </>
                ) : (
                  lang.security.saveConfig
                )}
              </button>
              {savedAt && (
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {lang.general.savedAt} {savedAt}
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
            <h3 className="text-lg font-black text-on-surface">{lang.ai.sectionTitle}</h3>
          </div>
          <div className="p-8 space-y-4">
            {([
              {
                name: lang.ai.madaLLM,
                version: 'v4.2.1',
                status: 'active',
                desc: lang.ai.madaLLMDesc,
                color: 'primary',
              },
              {
                name: lang.ai.madaVision,
                version: 'v2.0',
                status: 'active',
                desc: lang.ai.madaVisionDesc,
                color: 'secondary',
              },
              {
                name: lang.ai.madaVoice,
                version: 'v1.5',
                status: 'beta',
                desc: lang.ai.madaVoiceDesc,
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
                  {lang.ai.update}
                </button>
              </div>
            ))}

            <div className="pt-4 border-t border-outline-variant grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label-sm font-semibold text-on-surface">{lang.ai.temperature}</label>
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
                <label className="text-label-sm font-semibold text-on-surface">{lang.ai.maxTokens}</label>
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
                {lang.ai.saveConfig}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== INTEGRATIONS TAB ===================== */}
      {tab === 'integrations' && (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant">
            <h3 className="text-lg font-black text-on-surface">{lang.integrations.sectionTitle}</h3>
          </div>
          <div className="p-8 space-y-3">
            {([
              { name: lang.integrations.openai, desc: lang.integrations.openaiDesc, icon: Sparkles, connected: true, color: 'primary' },
              { name: lang.integrations.googleCloud, desc: lang.integrations.googleCloudDesc, icon: Cloud, connected: true, color: 'secondary' },
              { name: lang.integrations.stripe, desc: lang.integrations.stripeDesc, icon: CreditCard, connected: false, color: 'primary' },
              { name: lang.integrations.sendgrid, desc: lang.integrations.sendgridDesc, icon: Mail, connected: true, color: 'error' },
              { name: lang.integrations.sentry, desc: lang.integrations.sentryDesc, icon: Bug, connected: true, color: 'primary' },
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
                        {lang.integrations.connected}
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
                  {s.connected ? lang.integrations.disconnect : lang.integrations.connect}
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
              <h3 className="text-lg font-black text-on-surface">{lang.live.sectionTitle}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{lang.live.sectionDesc}</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Users Card */}
              <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <h4 className="font-black text-on-surface">{lang.live.users}</h4>
                </div>
                {userStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang.live.total}</p>
                      <p className="text-xl font-black text-on-surface mt-1">{userStats.total}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang.live.active}</p>
                      <p className="text-xl font-black text-secondary mt-1">{userStats.active}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang.live.suspended}</p>
                      <p className="text-xl font-black text-error mt-1">{userStats.suspended}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-outline-variant">
                      <p className="text-label-sm text-on-surface-variant">{lang.live.pending}</p>
                      <p className="text-xl font-black text-tertiary mt-1">{userStats.pending}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant py-4 text-center">{lang.live.loading}</p>
                )}
              </div>

              {/* Knowledge Base Card */}
              <div className="p-6 rounded-xl bg-secondary/5 border border-secondary/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </div>
                  <h4 className="font-black text-on-surface">{lang.live.knowledgeBase}</h4>
                </div>
                {kbStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                      <span className="text-sm text-on-surface-variant">{lang.live.totalDocs}</span>
                      <span className="text-lg font-black text-primary">{kbStats.totalDocuments}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                      <span className="text-sm text-on-surface-variant">{lang.live.categories}</span>
                      <span className="text-lg font-black text-secondary">{kbStats.totalCategories}</span>
                    </div>
                    {kbStats.totalSize !== undefined && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-outline-variant">
                        <span className="text-sm text-on-surface-variant">{lang.live.storageSize}</span>
                        <span className="text-lg font-black text-tertiary">{(kbStats.totalSize / 1024).toFixed(2)} KB</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant py-4 text-center">{lang.live.loading}</p>
                )}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant">
              <h3 className="text-lg font-black text-on-surface">{lang.live.endpoints}</h3>
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
                <h3 className="text-lg font-black text-on-surface">System Settings (DB)</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Toàn bộ cấu hình hệ thống được lưu trong <code className="text-xs bg-surface-variant px-1.5 py-0.5 rounded">system_settings</code> table.
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
              <h4 className="text-lg font-bold text-amber-800 mb-2">Truy cập bị hạn chế</h4>
              <p className="text-sm text-amber-600">
                System DB chỉ dành cho Super Admin. Bạn không có quyền xem hoặc chỉnh sửa các cấu hình này.
              </p>
            </div>
          ) : Object.keys(dbGrouped).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-on-surface-variant">Đang tải...</p>
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
              <h3 className="text-lg font-black text-on-surface">Prompt Templates</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Quản lý và áp dụng các template prompt có sẵn theo ngành.
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

export default AdminSettings;
