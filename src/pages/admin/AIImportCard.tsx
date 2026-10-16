/**
 * AIImportCard - Component cho Admin nhập URL website
 * để AI tự động scrape và trích xuất danh sách sản phẩm.
 *
 * Luồng:
 *  1. Admin paste URL + chọn category mặc định
 *  2. Click "Import" → gọi /api/scraper/import-url (preview only)
 *  3. Hiển thị danh sách sản phẩm trích xuất được
 *  4. Admin xác nhận → gọi /api/scraper/import-url/save (lưu vào DB)
 */

import { useState } from 'react';
import { useAuthStore, useLanguageStore } from '@/stores';
import { getAccessToken } from '@/lib/api';
import { Category } from './adminApi';
import clsx from 'clsx';
import { getImageUrl } from '../../lib/imageProxy';
import { Sparkles, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Save } from 'lucide-react';
import type { Language } from '@/types';

// ============== TRANSLATIONS ==============
const translations: Record<string, Record<Language, string>> = {
  // Card trigger
  'aiImport.title': { vi: 'AI Import từ Website', en: 'AI Import from Website', ar: 'استيراد AI من الموقع', fr: 'Importation AI depuis Site Web' },
  'aiImport.beta': { vi: 'BETA', en: 'BETA', ar: 'تجريبي', fr: 'BÊTA' },
  'aiImport.subtitle': { vi: 'Paste URL sản phẩm → AI tự động trích xuất tên, giá, ảnh', en: 'Paste product URL → AI auto-extracts name, price, image', ar: 'الصق رابط المنتج → يستخرج الذكاء الاصطناعي تلقائيًا الاسم والسعر والصورة', fr: 'Collez URL produit → IA extrait automatiquement nom, prix, image' },
  'aiImport.openTool': { vi: 'Mở công cụ', en: 'Open Tool', ar: 'فتح الأداة', fr: 'Ouvrir l\'outil' },

  // Modal header
  'aiImport.modalTitle': { vi: 'AI Import từ Website', en: 'AI Import from Website', ar: 'استيراد AI من الموقع', fr: 'Importation AI depuis Site Web' },
  'aiImport.modalSubtitle': { vi: 'Paste URL sản phẩm bất kỳ → AI tự động trích xuất', en: 'Paste any product URL → AI auto-extracts', ar: 'الصق أي رابط منتج → يستخرج الذكاء الاصطناعي تلقائيًا', fr: 'Collez n\'importe quel URL produit → IA extrait automatiquement' },

  // Step 1
  'aiImport.step1Title': { vi: 'Nhập URL sản phẩm', en: 'Enter Product URL', ar: 'أدخل رابط المنتج', fr: 'Entrer URL du produit' },
  'aiImport.step1Sub': { vi: 'Bước 1/2: Quét trang web', en: 'Step 1/2: Scan webpage', ar: 'الخطوة 1/2: فحص صفحة الويب', fr: 'Étape 1/2: Scanner la page web' },
  'aiImport.urlPlaceholder': { vi: 'https://shopabc.com/products/iphone-15', en: 'https://shopabc.com/products/iphone-15', ar: 'https://shopabc.com/products/iphone-15', fr: 'https://shopabc.com/products/iphone-15' },
  'aiImport.selectCategory': { vi: '-- Danh mục --', en: '-- Category --', ar: '-- الفئة --', fr: '-- Catégorie --' },
  'aiImport.scanning': { vi: 'Đang quét...', en: 'Scanning...', ar: 'جارٍ الفحص...', fr: 'Numérisation...' },
  'aiImport.scanUrl': { vi: 'Quét URL', en: 'Scan URL', ar: 'فحص الرابط', fr: 'Scanner URL' },

  // Progress messages
  'aiImport.loadingPage': { vi: '⏳ Đang tải trang web...', en: '⏳ Loading webpage...', ar: '⏳ جارٍ تحميل صفحة الويب...', fr: '⏳ Chargement de la page web...' },
  'aiImport.findingProducts': { vi: '🔍 Đang tìm sản phẩm trong HTML/JSON-LD...', en: '🔍 Searching for products in HTML/JSON-LD...', ar: '🔍 جارٍ البحث عن المنتجات في HTML/JSON-LD...', fr: '🔍 Recherche de produits dans HTML/JSON-LD...' },
  'aiImport.aiAnalyzing': { vi: '🤖 Đang dùng AI phân tích nội dung... (có thể mất 10-20 giây)', en: '🤖 Using AI to analyze content... (may take 10-20 seconds)', ar: '🤖 استخدام الذكاء الاصطناعي لتحليل المحتوى... (قد يستغرق 10-20 ثانية)', fr: '🤖 Utilisation de l\'IA pour analyser le contenu... (peut prendre 10-20 secondes)' },

  // Examples
  'aiImport.quickExamples': { vi: 'Ví dụ nhanh:', en: 'Quick examples:', ar: 'أمثلة سريعة:', fr: 'Exemples rapides:' },
  'aiImport.phone': { vi: '📱 Điện thoại', en: '📱 Phone', ar: '📱 هاتف', fr: '📱 Téléphone' },
  'aiImport.laptop': { vi: '💻 Laptop', en: '💻 Laptop', ar: '💻 حاسوب محمول', fr: '💻 Ordinateur portable' },

  // Error
  'aiImport.error': { vi: 'Lỗi', en: 'Error', ar: 'خطأ', fr: 'Erreur' },
  'aiImport.enterUrl': { vi: 'Vui lòng nhập URL', en: 'Please enter URL', ar: 'الرجاء إدخال الرابط', fr: 'Veuillez entrer l\'URL' },
  'aiImport.invalidUrl': { vi: 'URL không hợp lệ (ví dụ: https://shop.com/products)', en: 'Invalid URL (example: https://shop.com/products)', ar: 'رابط غير صالح (مثال: https://shop.com/products)', fr: 'URL invalide (exemple: https://shop.com/products)' },
  'aiImport.noProductsFound': { vi: '⚠️ URL này không có sản phẩm nào (đã thử 3 phương pháp: JSON-LD, HTML selectors, AI).\n\n🔍 Nguyên nhân có thể:\n• Trang không phải shop bán hàng (wiki, blog, tin tức)\n• Trang cần đăng nhập/cookie\n• Trang chặn bot/scraper\n\n✅ Thử các URL kiểu này:\n• Trang danh mục: https://www.thegioididong.com/laptop\n• Trang SP đơn: https://www.thegioididong.com/dtdd/iphone-15-pro-max\n• Shop VN: cellphones.com.vn/mobile.html, fptshop.com.vn/dien-thoai', en: '⚠️ This URL has no products (tried 3 methods: JSON-LD, HTML selectors, AI).\n\n🔍 Possible reasons:\n• Page is not a shop (wiki, blog, news)\n• Page requires login/cookie\n• Page blocks bot/scraper\n\n✅ Try these types of URLs:\n• Category page: https://www.thegioididong.com/laptop\n• Product page: https://www.thegioididong.com/dtdd/iphone-15-pro-max\n• VN Shop: cellphones.com.vn/mobile.html, fptshop.com.vn/dien-thoai', ar: '⚠️ لا يحتوي هذا الرابط على منتجات (جرى تجربة 3 طرق: JSON-LD، محددات HTML، الذكاء الاصطناعي).\n\n🔍 الأسباب المحتملة:\n• الصفحة ليست متجرًا (ويكي، مدونة، أخبار)\n• تتطلب الصفحة تسجيل الدخول/ملفات تعريف الارتباط\n• تحظر الصفحة الروبوت/المكتشف\n\n✅ جرّب أنواع الروابط هذه:\n• صفحة الفئة: https://www.thegioididong.com/laptop\n• صفحة المنتج: https://www.thegioididong.com/dtdd/iphone-15-pro-max', fr: '⚠️ Cette URL n\'a pas de produits (3 méthodes essayées: JSON-LD, sélecteurs HTML, IA).\n\n🔍 Raisons possibles:\n• La page n\'est pas une boutique (wiki, blog, actualités)\n• La page nécessite une connexion/cookie\n• La page bloque le bot/scraper\n\n✅ Essayez ces types d\'URL:\n• Page catégorie: https://www.thegioididong.com/laptop\n• Page produit: https://www.thegioididong.com/dtdd/iphone-15-pro-max' },
  'aiImport.scrapeFailed': { vi: 'Không thể scrape URL này', en: 'Cannot scrape this URL', ar: 'لا يمكن استكشاف هذا الرابط', fr: 'Impossible de scraper cette URL' },
  'aiImport.networkError': { vi: '❌ Không thể kết nối server. Kiểm tra mạng hoặc server có đang chạy không.', en: '❌ Cannot connect to server. Check network or if server is running.', ar: '❌ لا يمكن الاتصال بالخادم. تحقق من الشبكة أو إذا كان الخادم يعمل.', fr: '❌ Impossible de se connecter au serveur. Vérifiez le réseau ou si le serveur fonctionne.' },
  'aiImport.timeout': { vi: '⏱️ Hết thời gian chờ (timeout). URL có thể chặn scraper hoặc server quá chậm.', en: '⏱️ Request timed out. URL may block scrapers or server is too slow.', ar: '⏱️ انتهت مهلة الطلب. قد يحظر الرابط أدوات الاستكشاف أو الخادم بطيء جدًا.', fr: '⏱️ Délai d\'attente dépassé. L\'URL peut bloquer les scrapers ou le serveur est trop lent.' },
  'aiImport.unknownError': { vi: 'Lỗi không xác định', en: 'Unknown error', ar: 'خطأ غير معروف', fr: 'Erreur inconnue' },

  // Step 2 - Preview header
  'aiImport.successExtract': { vi: 'Đã trích xuất thành công {count} sản phẩm', en: 'Successfully extracted {count} products', ar: 'تم استخراج {count} منتج بنجاح', fr: '{count} produits extraits avec succès' },

  // Stats
  'aiImport.hasPrice': { vi: 'Có giá', en: 'Has Price', ar: 'له سعر', fr: 'Avec prix' },
  'aiImport.hasImage': { vi: 'Có ảnh', en: 'Has Image', ar: 'له صورة', fr: 'Avec image' },
  'aiImport.inStock': { vi: 'Còn hàng', en: 'In Stock', ar: 'متوفر', fr: 'En stock' },
  'aiImport.hasBrand': { vi: 'Có thương hiệu', en: 'Has Brand', ar: 'له علامة تجارية', fr: 'Avec marque' },
  'aiImport.contactForPrice': { vi: 'Liên hệ', en: 'Contact', ar: 'اتصل', fr: 'Contact' },
  'aiImport.inStock2': { vi: '✓ Còn hàng', en: '✓ In Stock', ar: '✓ متوفر', fr: '✓ En stock' },
  'aiImport.outOfStock': { vi: '✗ Hết hàng', en: '✗ Out of Stock', ar: '✗ غير متوفر', fr: '✗ Rupture de stock' },

  // Preview list
  'aiImport.preview': { vi: 'Preview', en: 'Preview', ar: 'معاينة', fr: 'Aperçu' },
  'aiImport.openProduct': { vi: 'Mở sản phẩm', en: 'Open product', ar: 'فتح المنتج', fr: 'Ouvrir le produit' },

  // Footer
  'aiImport.readyToSave': { vi: 'Sẵn sàng lưu {count} sản phẩm', en: 'Ready to save {count} products', ar: 'جاهز لحفظ {count} منتج', fr: 'Prêt à sauvegarder {count} produits' },
  'aiImport.enterUrlToStart': { vi: 'Nhập URL để bắt đầu quét', en: 'Enter URL to start scanning', ar: 'أدخل الرابط لبدء الفحص', fr: 'Entrez l\'URL pour commencer' },
  'aiImport.onlySaveWithPrice': { vi: 'Chỉ lưu SP có giá', en: 'Only save products with price', ar: 'حفظ المنتجات ذات السعر فقط', fr: 'Sauvegarder uniquement les produits avec prix' },
  'aiImport.cancel': { vi: 'Hủy', en: 'Cancel', ar: 'إلغاء', fr: 'Annuler' },
  'aiImport.saving': { vi: 'Đang lưu...', en: 'Saving...', ar: 'جارٍ الحفظ...', fr: 'Enregistrement...' },
  'aiImport.saveToKnowledge': { vi: 'Lưu vào kho tri thức', en: 'Save to Knowledge Base', ar: 'حفظ في قاعدة المعرفة', fr: 'Sauvegarder dans la base de connaissances' },

  // Save confirm
  'aiImport.saveConfirm': { vi: 'Lưu {count} sản phẩm vào kho tri thức?', en: 'Save {count} products to Knowledge Base?', ar: 'حفظ {count} منتج في قاعدة المعرفة؟', fr: 'Sauvegarder {count} produits dans la base de connaissances?' },
  'aiImport.saveFailed': { vi: 'Lưu thất bại', en: 'Save failed', ar: 'فشل الحفظ', fr: 'Échec de la sauvegarde' },
  'aiImport.saved': { vi: 'Đã lưu: {saved} SP', en: 'Saved: {saved} products', ar: 'تم الحفظ: {saved} منتج', fr: 'Sauvegardé: {saved} produits' },
  'aiImport.skipped': { vi: 'Bỏ qua trùng: {skipped} SP', en: 'Skipped duplicates: {skipped}', ar: 'تم تخطي التكرارات: {skipped}', fr: 'Doublons ignorés: {skipped}' },
};

interface ImportPreviewProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  brand?: string;
  category?: string;
  /** Danh mục MADA được phát hiện tự động (vision, hearing, mobility, ...) */
  madaCategory?: string;
  inStock: boolean;
  url: string;
}

interface ImportPreviewResponse {
  url: string;
  totalFound: number;
  method: 'json-ld' | 'html-selectors' | 'gemini-ai' | 'mixed';
  durationMs: number;
  products: ImportPreviewProduct[];
  stats: {
    withPrice: number;
    withImage: number;
    inStock: number;
    withBrand: number;
  };
}

/** Map MADA category ID → label + color */
export const MADA_CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  vision: { label: '👁 Thị giác', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  hearing: { label: '🔊 Thính giác', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  communication: { label: '💬 Giao tiếp', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  mobility: { label: '🦽 Vận động', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  cognition: { label: '🧠 Nhận thức', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  daily_living: { label: '🏠 Sinh hoạt', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  web_accessibility: { label: '🌐 Web A11y', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  general: { label: '📁 Tổng quát', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

interface AIImportCardProps {
  categories: Category[];
  onImportSuccess?: () => void;
}

interface SaveJobResult {
  status: 'completed' | 'failed';
  progress: number;
  progressMessage: string | null;
  error?: string;
  saved?: number;
  skipped?: number;
  syncedToRAG?: number;
  totalFound?: number;
  message?: string;
  url?: string;
  method?: string;
  fetchMethod?: string;
  durationMs?: number;
}

// ============== JOB POLLING HELPER ==============

async function pollJob<T>(
  path: string,
  options: {
    pollingIntervalMs?: number;
    maxPolls?: number;
    onProgress?: (progress: number, message: string | null) => void;
  } = {}
): Promise<T & { status: string; progress: number; progressMessage: string | null; error?: string }> {
  const { pollingIntervalMs = 1500, maxPolls = 80, onProgress } = options;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));

    try {
      const res = await fetch(`/api/scraper/${path}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Poll failed');
      }

      const data = json.data;
      onProgress?.(data.progress || 0, data.progressMessage || null);

      if (data.status === 'completed') {
        return data as T & { status: string; progress: number; progressMessage: string | null; error?: string };
      }

      if (data.status === 'failed') {
        return data as T & { status: string; progress: number; progressMessage: string | null; error?: string };
      }
      // status === 'pending' | 'running' → continue polling
    } catch (err: any) {
      // Nếu fetch lỗi, vẫn tiếp tục poll (server có thể đang khởi động lại)
      console.warn(`[pollJob] poll ${i + 1} failed:`, err.message);
    }
  }

  // Timeout
  const result: any = { status: 'failed', progress: 100, progressMessage: 'Hết thời gian chờ', error: 'maxPolls exceeded' };
  return result;
}

export function AIImportCard({ categories, onImportSuccess }: AIImportCardProps) {
  const { user } = useAuthStore();
  const language = useLanguageStore((state) => state.language ?? 'vi') as Language;

  // Translation helper
  const t = (key: string, params?: Record<string, string | number>): string => {
    const text = translations[key]?.[language] || translations[key]?.vi || key;
    if (params) {
      let result = text;
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
      return result;
    }
    return text;
  };

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [onlyValid, setOnlyValid] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'data_manager';

  if (!isAdmin) return null;

  const reset = () => {
    setUrl('');
    setCategory('');
    setError(null);
    setPreview(null);
  };

  // ============== PREVIEW SCRAPE (JOB-BASED) ==============

  const handlePreview = async () => {
    if (!url.trim()) {
      setError(t('aiImport.enterUrl'));
      return;
    }
    try {
      new URL(url);
    } catch {
      setError(t('aiImport.invalidUrl'));
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    setProgressMessage(t('aiImport.loadingPage'));
    try {
      const token = getAccessToken() || '';

      // Bước 1: Tạo preview job → nhận jobId ngay
      const createRes = await fetch('/api/scraper/import-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim(), defaultCategory: category || 'general', madaLanguage: 'en' }),
      });
      const createJson = await createRes.json();

      if (!createRes.ok || !createJson.success) {
        throw new Error(createJson.error || t('aiImport.scrapeFailed'));
      }

      const { jobId } = createJson.data;

      // Bước 2: Poll job status cho đến khi completed/failed
      const pollResult = await pollJob<ImportPreviewResponse>(jobId, {
        pollingIntervalMs: 1500,
        maxPolls: 80, // ~2 phút max
        onProgress: (progress, message) => {
          setProgressMessage(message || t('aiImport.loadingPage'));
        },
      });

      if (pollResult.status === 'failed') {
        throw new Error(pollResult.error || t('aiImport.scrapeFailed'));
      }

      const jobData = pollResult as any;
      setPreview(jobData);

      if (jobData.totalFound === 0) {
        setError(t('aiImport.noProductsFound'));
      }
    } catch (err: any) {
      const msg = err?.message || t('aiImport.unknownError');
      let displayMsg = msg;
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('Network request failed') ||
        msg.includes('NetworkError') ||
        !navigator.onLine
      ) {
        displayMsg = t('aiImport.networkError');
      } else if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('maxPolls')) {
        displayMsg = t('aiImport.timeout');
      }
      setError(displayMsg);
    } finally {
      setLoading(false);
      setProgressMessage(null);
    }
  };

  // ============== SAVE SCRAPE (JOB-BASED) ==============

  const handleSave = async () => {
    if (!preview) return;
    if (!confirm(t('aiImport.saveConfirm', { count: preview.totalFound }))) return;

    setSaving(true);
    setError(null);
    setProgressMessage('Đang tạo job lưu...');
    try {
      const token = getAccessToken() || '';

      // Bước 1: Tạo save job → nhận jobId ngay
      const createRes = await fetch('/api/scraper/import-url/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: preview.url,
          defaultCategory: category || 'general',
          onlyValid,
          forceReimport: false,
          madaLanguage: 'en',
        }),
      });
      const createJson = await createRes.json();

      if (!createRes.ok || !createJson.success) {
        throw new Error(createJson.error || t('aiImport.saveFailed'));
      }

      const { jobId } = createJson.data;

      // Bước 2: Poll save job status
      const pollResult = await pollJob<SaveJobResult>(jobId + '/save', {
        pollingIntervalMs: 2000,
        maxPolls: 60, // ~2 phút max cho save
        onProgress: (progress, message) => {
          setProgressMessage(message || 'Đang xử lý...');
        },
      });

      if (pollResult.status === 'failed') {
        throw new Error(pollResult.error || t('aiImport.saveFailed'));
      }

      const saveData = pollResult as any;
      let savedMsg = t('aiImport.saved', { saved: saveData.saved || 0 });
      if (saveData.skipped) {
        savedMsg += '\n' + t('aiImport.skipped', { skipped: saveData.skipped });
      }
      alert(`✅ ${saveData.message || savedMsg}`);
      reset();
      setOpen(false);
      onImportSuccess?.();
    } catch (err: any) {
      const msg = err?.message || t('aiImport.unknownError');
      let displayMsg = msg;
      if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || msg.includes('NetworkError') || !navigator.onLine) {
        displayMsg = t('aiImport.networkError');
      } else if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('maxPolls')) {
        displayMsg = t('aiImport.timeout');
      }
      setError(displayMsg);
    } finally {
      setSaving(false);
      setProgressMessage(null);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (!price) return t('aiImport.contactForPrice');
    return `${price.toLocaleString('vi-VN')} ${currency}`;
  };

  const methodLabel: Record<string, { label: string; color: string }> = {
    'json-ld': { label: 'JSON-LD', color: 'bg-green-100 text-green-700' },
    'html-selectors': { label: 'HTML', color: 'bg-blue-100 text-blue-700' },
    'gemini-ai': { label: 'Gemini AI', color: 'bg-purple-100 text-purple-700' },
    mixed: { label: 'Mixed', color: 'bg-amber-100 text-amber-700' },
  };

  return (
    <>
      {/* Compact card trigger - Stitch style */}
      <div className="mb-5 rounded-xl bg-white border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                {t('aiImport.title')}
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-blue-100 text-blue-600">
                {t('aiImport.beta')}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {t('aiImport.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('aiImport.openTool')}
          </button>
        </div>
      </div>

      {/* Full-screen modal - Stitch style */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh] border border-blue-200">
            {/* Header - Light blue */}
            <div className="px-6 py-5 border-b border-blue-100 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">{t('aiImport.modalTitle')}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('aiImport.modalSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="w-10 h-10 rounded-lg hover:bg-blue-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Step 1: Input URL */}
              <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-800">{t('aiImport.step1Title')}</h3>
                    <span className="text-xs text-gray-400">{t('aiImport.step1Sub')}</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">link</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={t('aiImport.urlPlaceholder')}
                      disabled={loading || saving}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading || saving}
                    className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-blue-400 min-w-[150px]"
                  >
                    <option value="">{t('aiImport.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_vi}</option>
                    ))}
                  </select>
                  <button
                    onClick={handlePreview}
                    disabled={loading || saving || !url.trim()}
                    className="px-5 h-10 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('aiImport.scanning')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {t('aiImport.scanUrl')}
                      </>
                    )}
                  </button>
                </div>
                {/* Progress message khi đang loading */}
                {loading && progressMessage && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 mt-3">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700">{progressMessage}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-gray-500">{t('aiImport.quickExamples')}</span>
                  {[
                    { label: t('aiImport.phone'), url: 'https://cellphones.com.vn/mobile.html' },
                    { label: t('aiImport.laptop'), url: 'https://www.thegioididong.com/laptop' },
                  ].map((ex) => (
                    <button
                      key={ex.url}
                      type="button"
                      onClick={() => setUrl(ex.url)}
                      className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-700">{t('aiImport.error')}</p>
                    <p className="text-sm text-red-600 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Step 2: Preview */}
              {preview && (
                <>
                  <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-blue-600 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-white">
                          {t('aiImport.successExtract', { count: preview.totalFound })}
                        </h3>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        methodLabel[preview.method]?.color || 'bg-white/20 text-white'
                      )}>
                        {methodLabel[preview.method]?.label || preview.method}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-white/20 text-white">
                        ⏱️ {(preview.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatBox label={t('aiImport.hasPrice')} value={`${preview.stats.withPrice}/${preview.totalFound}`} color="blue" />
                        <StatBox label={t('aiImport.hasImage')} value={`${preview.stats.withImage}/${preview.totalFound}`} color="indigo" />
                        <StatBox label={t('aiImport.inStock')} value={`${preview.stats.inStock}/${preview.totalFound}`} color="green" />
                        <StatBox label={t('aiImport.hasBrand')} value={`${preview.stats.withBrand}/${preview.totalFound}`} color="gray" />
                      </div>
                    </div>
                  </div>

                  {/* Product list */}
                  <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-blue-100 bg-gray-50">
                      <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-base">inventory_2</span>
                        {t('aiImport.preview')} ({Math.min(preview.products.length, 20)}/{preview.totalFound})
                      </h3>
                    </div>
                    <div className="space-y-2 p-3 max-h-80 overflow-y-auto">
                      {preview.products.slice(0, 20).map((p, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                          {p.imageUrl ? (
                            <img
                              src={getImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-gray-100 border border-gray-200"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                              <span className="material-symbols-outlined text-gray-400 text-base">image_not_supported</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-gray-800 line-clamp-1">{p.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded font-medium',
                                p.price > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-500'
                              )}>
                                {formatPrice(p.price, p.currency)}
                              </span>
                              {p.brand && (
                                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                                  {p.brand}
                                </span>
                              )}
                              {p.inStock ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium border border-green-100">
                                  {t('aiImport.inStock2')}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium border border-red-100">
                                  {t('aiImport.outOfStock')}
                                </span>
                              )}
                              {/* MADA Category Badge */}
                              {p.madaCategory && MADA_CATEGORY_LABELS[p.madaCategory] && (
                                <span className={clsx(
                                  'text-xs px-2 py-0.5 rounded font-medium border',
                                  MADA_CATEGORY_LABELS[p.madaCategory].bg,
                                  MADA_CATEGORY_LABELS[p.madaCategory].color
                                )}>
                                  {MADA_CATEGORY_LABELS[p.madaCategory].label}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                            title={t('aiImport.openProduct')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-blue-100 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-gray-600 font-medium">
                  {preview
                    ? t('aiImport.readyToSave', { count: preview.totalFound })
                    : t('aiImport.enterUrlToStart')}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={onlyValid}
                    onChange={(e) => setOnlyValid(e.target.checked)}
                    disabled={saving}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('aiImport.onlySaveWithPrice')}</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                >
                  {t('aiImport.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!preview || saving || loading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('aiImport.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('aiImport.saveToKnowledge')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={clsx('rounded-lg p-3 border bg-white', colors.bg, colors.border)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={clsx('font-semibold text-base mt-0.5', colors.text)}>{value}</p>
    </div>
  );

}

export default AIImportCard;
