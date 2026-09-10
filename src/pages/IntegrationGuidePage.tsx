import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/stores';
import {
  Home, Code, Copy, Check, Globe, Palette,
  MessageSquare, FileText, Accessibility, Zap,
  Rocket, Settings, Shield, Languages,
  ChevronRight, ExternalLink, Sparkles, Layers
} from 'lucide-react';
import clsx from 'clsx';

const LABELS = {
  vi: {
    title: 'Hướng Dẫn Tích Hợp Widget',
    description: 'Cách nhúng MADA AI Chat Widget vào website của bạn chỉ trong 3 bước đơn giản',
    quickStart: 'Bắt Đầu Nhanh',
    copyCode: 'Sao chép',
    copied: 'Đã sao chép!',
    step1: 'Thêm Script',
    step1Title: 'Copy đoạn mã bên dưới',
    step1Desc: 'Paste vào thẻ <head> hoặc trước thẻ </body> của website',
    step2: 'Cấu Hình Widget',
    step2Title: 'Tùy chỉnh theo nhu cầu',
    step2Desc: 'Màu sắc, vị trí, ngôn ngữ và các tùy chọn khác',
    step3: 'Hoàn Thành',
    step3Title: 'Kiểm tra ngay',
    step3Desc: 'Reload trang và nhấn vào biểu tượng chat để xem kết quả',
    options: 'Tùy Chỉnh Widget',
    option1Title: 'Vị trí',
    option1Desc: 'Góc dưới bên phải hoặc trái',
    option2Title: 'Màu chủ đạo',
    option2Desc: 'Mã màu hex tùy chọn',
    option3Title: 'Ngôn ngữ',
    option3Desc: 'Tiếng Việt, Anh, Ả Rập, Pháp',
    option4Title: 'Upload file',
    option4Desc: 'Bật/tắt tính năng đính kèm',
    features: 'Tính Năng Nổi Bật',
    demo: 'Xem Demo Widget',
    getCode: 'Lấy Mã Nhúng',
  },
  en: {
    title: 'Widget Integration Guide',
    description: 'Embed MADA AI Chat Widget into your website in just 3 simple steps',
    quickStart: 'Quick Start',
    copyCode: 'Copy',
    copied: 'Copied!',
    step1: 'Add Script',
    step1Title: 'Copy the code below',
    step1Desc: 'Paste into <head> or before </body> tag',
    step2: 'Configure Widget',
    step2Title: 'Customize as needed',
    step2Desc: 'Colors, position, language and more',
    step3: 'Done',
    step3Title: 'Test now',
    step3Desc: 'Reload page and click chat icon to see result',
    options: 'Widget Customization',
    option1Title: 'Position',
    option1Desc: 'Bottom right or left corner',
    option2Title: 'Primary Color',
    option2Desc: 'Custom hex color code',
    option3Title: 'Language',
    option3Desc: 'VI, EN, AR, FR supported',
    option4Title: 'File Upload',
    option4Desc: 'Enable/disable attachments',
    features: 'Key Features',
    demo: 'View Widget Demo',
    getCode: 'Get Embed Code',
  },
  ar: {
    title: 'دليل تكامل الويدجيت',
    description: 'قم بتضمين ودجيت دردشة MADA AI في موقعك في 3 خطوات بسيطة فقط',
    quickStart: 'البدء السريع',
    copyCode: 'نسخ',
    copied: 'تم!',
    step1: 'إضافة السكريبت',
    step1Title: 'انسخ الكود أدناه',
    step1Desc: 'الصقه في علامة <head> أو قبل </body>',
    step2: 'تكوين الويدجيت',
    step2Title: 'تخصيص حسب الحاجة',
    step2Desc: 'الألوان والموضع واللغة والمزيد',
    step3: 'الخطوة 3',
    step3Title: 'اختبر الآن',
    step3Desc: 'أعد تحميل الصفحة وانقر على أيقونة الدردشة',
    options: 'تخصيص الويدجيت',
    option1Title: 'الموضع',
    option1Desc: 'أسفل اليمين أو اليسار',
    option2Title: 'اللون الأساسي',
    option2Desc: 'رمز اللون السداسي',
    option3Title: 'اللغة',
    option3Desc: 'دعم VI, EN, AR, FR',
    option4Title: 'رفع الملفات',
    option4Desc: 'تفعيل/إلغاء المرفقات',
    features: 'الميزات الرئيسية',
    demo: 'عرض تجريبي',
    getCode: 'الحصول على الكود',
  },
  fr: {
    title: "Guide d'intégration du widget",
    description: "Intégrez le widget de chat MADA AI dans votre site en 3 étapes simples",
    quickStart: 'Démarrage rapide',
    copyCode: 'Copier',
    copied: 'Copié!',
    step1: 'Ajouter le script',
    step1Title: 'Copiez le code ci-dessous',
    step1Desc: "Collez dans la balise <head> ou avant </body>",
    step2: 'Configurer le widget',
    step2Title: 'Personnalisez selon vos besoins',
    step2Desc: 'Couleurs, position, langue et plus',
    step3: 'Terminé',
    step3Title: 'Testez maintenant',
    step3Desc: 'Rechargez la page et cliquez sur licône chat',
    options: 'Personnalisation',
    option1Title: 'Position',
    option1Desc: 'Bas droite ou gauche',
    option2Title: 'Couleur principale',
    option2Desc: 'Code couleur hexadécimal',
    option3Title: 'Langue',
    option3Desc: 'Support VI, EN, AR, FR',
    option4Title: 'Upload fichiers',
    option4Desc: 'Activer/désactiver les pièces',
    features: 'Fonctionnalités clés',
    demo: 'Voir la démo',
    getCode: "Obtenir le code",
  },
};

const STEPS_CONFIG = [
  {
    icon: Rocket,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    step: 1,
  },
  {
    icon: Settings,
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    step: 2,
  },
  {
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    step: 3,
  },
];

const FEATURE_ICONS = [
  { Icon: Languages, color: 'text-blue-600', bg: 'bg-blue-50' },
  { Icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  { Icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  { Icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { Icon: Layers, color: 'text-pink-600', bg: 'bg-pink-50' },
  { Icon: Code, color: 'text-slate-600', bg: 'bg-slate-50' },
];

export function IntegrationGuidePage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const { language } = useLanguageStore();
  const labels = LABELS[language];

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://mada.example.com';

  const baseCode = `<script src="${currentDomain}/widget.js"></script>`;

  const fullCode = `<script src="${currentDomain}/widget.js"></script>
<script>
  MADAWidget.init({
    position: 'bottom-right',
    primaryColor: '#D97706',
    defaultLanguage: '${language}',
    allowFileUpload: true,
    apiUrl: '${currentDomain}/api'
  });
</script>`;

  const handleCopy = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      // Silent fail
    }
  };

  const features = [
    labels.feature1,
    labels.feature2,
    labels.feature3,
    labels.feature4,
    labels.feature5,
    labels.feature6,
  ];

  const steps = [
    { title: labels.step1, titleDesc: labels.step1Title, desc: labels.step1Desc, code: baseCode, section: 'step1' },
    { title: labels.step2, titleDesc: labels.step2Title, desc: labels.step2Desc, code: fullCode, section: 'step2' },
    { title: labels.step3, titleDesc: labels.step3Title, desc: labels.step3Desc, code: null, section: 'step3' },
  ];

  const options = [
    { title: labels.option1Title, desc: labels.option1Desc, example: "position: 'bottom-right'" },
    { title: labels.option2Title, desc: labels.option2Desc, example: "primaryColor: '#D97706'" },
    { title: labels.option3Title, desc: labels.option3Desc, example: "defaultLanguage: 'vi'" },
    { title: labels.option4Title, desc: labels.option4Desc, example: "allowFileUpload: true" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 text-slate-800 font-sans">
      {/* ──────────────────────────  HEADER  ────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            to="/guest-widget"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            <span>Quay lại</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/mada-logo.png" alt="MADA" className="h-9" />
          </div>
        </div>
      </header>

      {/* ──────────────────────────  HERO  ────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-violet-200/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>Widget Chat AI cho Website</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
            {labels.title}
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            {labels.description}
          </p>
        </div>
      </section>

      {/* ──────────────────────────  STEPS  ────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">{labels.quickStart}</h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-400" />
            <span className="text-sm text-slate-500 font-medium">3 bước đơn giản</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          {steps.map((step, idx) => {
            const config = STEPS_CONFIG[idx];
            return (
              <div
                key={idx}
                className={`relative group`}
              >
                {/* Connector line */}
                {idx < 2 && (
                  <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-slate-200 to-transparent z-10 -translate-x-full" />
                )}

                <div className={`relative bg-white rounded-2xl border ${config.borderColor} shadow-sm hover:shadow-lg transition-all duration-300 p-6 h-full`}>
                  {/* Step number & icon */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg shadow-slate-200`}>
                      <config.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bước {config.step}</span>
                      <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-2 mb-5">
                    <p className="font-semibold text-slate-700">{step.titleDesc}</p>
                    <p className="text-sm text-slate-500">{step.desc}</p>
                  </div>

                  {/* Code block */}
                  {step.code && (
                    <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <button
                          onClick={() => handleCopy(step.code!, step.section)}
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                            copiedSection === step.section
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          )}
                        >
                          {copiedSection === step.section ? (
                            <><Check className="w-3 h-3" /> {labels.copied}</>
                          ) : (
                            <><Copy className="w-3 h-3" /> {labels.copyCode}</>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 text-sm text-amber-300 font-mono overflow-x-auto">
                        {step.code}
                      </pre>
                    </div>
                  )}

                  {/* Success check for step 3 */}
                  {!step.code && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm font-medium text-emerald-700">
                        Widget đã sẵn sàng hoạt động!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ──────────────────────────  CONFIG OPTIONS  ────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-16">
          <div className="px-6 sm:px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{labels.options}</h2>
                <p className="text-sm text-slate-500">Tùy chỉnh widget theo phong cách website của bạn</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="group relative p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all duration-200"
                >
                  <h4 className="font-semibold text-slate-800 mb-1">{opt.title}</h4>
                  <p className="text-sm text-slate-500 mb-3">{opt.desc}</p>
                  <code className="inline-block text-xs bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-mono">
                    {opt.example}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ──────────────────────────  FEATURES  ────────────────────────── */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">{labels.features}</h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-violet-400" />
            <span className="text-sm text-slate-500 font-medium">Tất cả những gì bạn cần</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-violet-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((feature, i) => {
            const { Icon, color, bg } = FEATURE_ICONS[i];
            return (
              <div
                key={i}
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">{feature}</span>
              </div>
            );
          })}
        </div>

        {/* ──────────────────────────  CTA  ────────────────────────── */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/guest-widget"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 font-semibold"
            >
              <ExternalLink className="w-5 h-5" />
              <span>{labels.demo}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────  FOOTER  ────────────────────────── */}
      <footer className="py-10 border-t border-slate-200 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img src="/mada-logo.png" alt="MADA" className="h-8 mx-auto mb-4 opacity-60" />
          <p className="text-sm text-slate-500">
            MADA AI - Hỗ trợ tư vấn chuyên gia AT
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Developed by DIGISO Digital Solutions - digiso.vn
          </p>
        </div>
      </footer>
    </div>
  );
}

export default IntegrationGuidePage;
