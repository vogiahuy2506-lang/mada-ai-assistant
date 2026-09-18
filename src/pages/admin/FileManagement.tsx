import React, { useState, useEffect } from 'react';
import {
  Upload, Image, FileText, Video, Music, File,
  Save, RefreshCw, CheckCircle, XCircle, Info,
  Loader2
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';

// ============== TYPES ==============
type Language = 'vi' | 'en' | 'ar' | 'fr';

// ============== TRANSLATIONS ==============
const fileTranslations: Record<string, Record<Language, string>> = {
  // Messages
  'file.saving': { vi: 'Đang lưu...', en: 'Saving...', ar: 'جارٍ الحفظ...', fr: 'Enregistrement...' },
  'file.saveChanges': { vi: 'Lưu Thay Đổi', en: 'Save Changes', ar: 'حفظ التغييرات', fr: 'Enregistrer' },
  'file.saveSuccess': { vi: 'Cài đặt đã được lưu thành công!', en: 'Settings saved successfully!', ar: 'تم حفظ الإعدادات بنجاح!', fr: 'Paramètres enregistrés avec succès!' },
  'file.error': { vi: 'Không thể lưu cài đặt', en: 'Cannot save settings', ar: 'لا يمكن حفظ الإعدادات', fr: 'Impossible d\'enregistrer les paramètres' },
  'file.errorOccurred': { vi: 'Đã xảy ra lỗi khi lưu cài đặt', en: 'An error occurred while saving settings', ar: 'حدث خطأ أثناء حفظ الإعدادات', fr: 'Une erreur s\'est produite lors de l\'enregistrement' },
  'file.sessionExpired': { vi: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', en: 'Session expired. Please log in again.', ar: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.', fr: 'Session expirée. Veuillez vous reconnecter.' },

  // Main title
  'file.title': { vi: 'Quản Lý Upload File', en: 'File Management', ar: 'إدارة الملفات', fr: 'Gestion des fichiers' },
  'file.subtitle': { vi: 'Cấu hình tính năng và giới hạn upload file cho người dùng.', en: 'Configure file upload features and limits for users.', ar: 'تكوين ميزات وحlimits تحميل الملفات للمستخدمين.', fr: 'Configurer les fonctionnalités et limites de téléchargement.' },
  'file.heroTitle': { vi: 'Quản Lý Upload File', en: 'File Management', ar: 'إدارة الملفات', fr: 'Gestion des fichiers' },
  'file.heroSubtitle': { vi: 'Cấu hình tính năng và ', en: 'Configure ', ar: 'تكوين ', fr: 'Configurer ' },
  'file.heroSubtitleBold': { vi: 'giới hạn upload file', en: 'file upload ', ar: 'حدود تحميل الملفات', fr: 'les limites de téléchargement' },
  'file.heroSubtitleSuffix': { vi: ' cho người dùng.', en: 'features and limits for users.', ar: ' للمستخدمين.', fr: '.' },

  // Global Toggle
  'file.fileAttachmentFeature': { vi: 'Tính Năng Đính Kèm File', en: 'File Attachment Feature', ar: 'ميزة إرفاق الملفات', fr: 'Fonctionnalité de pièce jointe' },
  'file.globalToggleDesc': { vi: 'Công tắc chính cho tất cả tính năng upload file', en: 'Main toggle for all file upload features', ar: 'الزر الرئيسي لجميع ميزات تحميل الملفات', fr: 'Bouton principal pour toutes les fonctionnalités de téléchargement' },

  // File Type Settings
  'file.fileTypeSettings': { vi: 'Cài Đặt Loại File', en: 'File Type Settings', ar: 'إعدادات أنواع الملفات', fr: 'Paramètres des types de fichiers' },
  'file.uploadImages': { vi: 'Upload Hình Ảnh', en: 'Upload Images', ar: 'تحميل الصور', fr: 'Télécharger des images' },
  'file.imageFormats': { vi: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF', en: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF', ar: 'JPG، JPEG، PNG، WEBP، BMP، TIFF، GIF', fr: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF' },
  'file.uploadDocuments': { vi: 'Upload Tài Liệu', en: 'Upload Documents', ar: 'تحميل المستندات', fr: 'Télécharger des documents' },
  'file.documentFormats': { vi: 'PDF, DOC, DOCX, TXT, MD', en: 'PDF, DOC, DOCX, TXT, MD', ar: 'PDF، DOC، DOCX، TXT، MD', fr: 'PDF, DOC, DOCX, TXT, MD' },
  'file.uploadVideo': { vi: 'Upload Video', en: 'Upload Video', ar: 'تحميل الفيديو', fr: 'Télécharger des vidéos' },
  'file.videoFormats': { vi: 'MP4, AVI, MOV, MKV, WebM', en: 'MP4, AVI, MOV, MKV, WebM', ar: 'MP4، AVI، MOV، MKV، WebM', fr: 'MP4, AVI, MOV, MKV, WebM' },
  'file.uploadAudio': { vi: 'Upload Âm Thanh', en: 'Upload Audio', ar: 'تحميل الصوت', fr: 'Télécharger de l\'audio' },
  'file.audioFormats': { vi: 'MP3, WAV, AAC, OGG, M4A', en: 'MP3, WAV, AAC, OGG, M4A', ar: 'MP3، WAV، AAC، OGG، M4A', fr: 'MP3, WAV, AAC, OGG, M4A' },
  'file.uploadOtherFiles': { vi: 'Các Loại File Khác', en: 'Other File Types', ar: 'أنواع ملفات أخرى', fr: 'Autres types de fichiers' },
  'file.otherFormats': { vi: 'ZIP, RAR, CSV, XLSX, JSON, XML', en: 'ZIP, RAR, CSV, XLSX, JSON, XML', ar: 'ZIP، RAR، CSV، XLSX، JSON، XML', fr: 'ZIP, RAR, CSV, XLSX, JSON, XML' },

  // File Size Limits
  'file.fileSizeLimits': { vi: 'Giới Hạn Dung Lượng (MB)', en: 'File Size Limits (MB)', ar: 'حدود حجم الملف (ميجابايت)', fr: 'Limites de taille de fichier (Mo)' },
  'file.images': { vi: 'Hình Ảnh', en: 'Images', ar: 'الصور', fr: 'Images' },
  'file.documents': { vi: 'Tài Liệu', en: 'Documents', ar: 'المستندات', fr: 'Documents' },
  'file.video': { vi: 'Video', en: 'Video', ar: 'الفيديو', fr: 'Vidéo' },
  'file.audio': { vi: 'Âm Thanh', en: 'Audio', ar: 'الصوت', fr: 'Audio' },
  'file.otherFiles': { vi: 'File Khác', en: 'Other Files', ar: 'ملفات أخرى', fr: 'Autres fichiers' },
  'file.totalMax': { vi: 'Tổng Max', en: 'Total Max', ar: 'الحد الأقصى الإجمالي', fr: 'Total max' },

  // Upload Limits by Plan
  'file.uploadLimitsByPlan': { vi: 'Giới Hạn Upload Theo Plan (File/tháng)', en: 'Upload Limits by Plan (Files/month)', ar: 'حدود التحميل حسب الباقة (ملفات/شهر)', fr: 'Limites de téléchargement par plan (fichiers/mois)' },
  'file.unlimitedHint': { vi: 'Đặt 0 = Không giới hạn', en: 'Set 0 = Unlimited', ar: 'تعيين 0 = غير محدود', fr: 'Définir 0 = Illimité' },
  'file.freePlan': { vi: 'Free Plan', en: 'Free Plan', ar: 'الباقة المجانية', fr: 'Plan Gratuit' },
  'file.proPlan': { vi: 'Pro Plan', en: 'Pro Plan', ar: 'باقة Pro', fr: 'Plan Pro' },
  'file.enterprisePlan': { vi: 'Enterprise Plan', en: 'Enterprise Plan', ar: 'باقة المؤسسة', fr: 'Plan Entreprise' },
  'file.planUnlimitedHint': { vi: '0 = Không giới hạn', en: '0 = Unlimited', ar: '0 = غير محدود', fr: '0 = Illimité' },

  // Session Limits
  'file.sessionAndTotalLimits': { vi: 'Giới Hạn Phiên & Tổng', en: 'Session & Total Limits', ar: 'حدود الجلسة والإجمالي', fr: 'Limites de session et total' },
  'file.maxFilesPerSession': { vi: 'Max Files Per Session', en: 'Max Files Per Session', ar: 'الحد الأقصى للملفات لكل جلسة', fr: 'Max fichiers par session' },
  'file.sessionFilesHint': { vi: 'Số file tối đa trong một phiên chat', en: 'Maximum number of files in one chat session', ar: 'الحد الأقصى لعدد الملفات في جلسة دردشة واحدة', fr: 'Nombre maximum de fichiers dans une session de chat' },
  'file.maxTotalFiles': { vi: 'Max Total Files', en: 'Max Total Files', ar: 'الحد الأقصى للملفات الإجمالي', fr: 'Max fichiers totaux' },
  'file.totalFilesHint': { vi: 'Tổng số file tối đa người dùng có thể upload', en: 'Maximum total files user can upload', ar: 'إجمالي الحد الأقصى للملفات التي يمكن للمستخدم تحميلها', fr: 'Nombre total maximum de fichiers que l\'utilisateur peut télécharger' },

  // Quick Actions
  'file.quickActions': { vi: 'Hành Động Nhanh', en: 'Quick Actions', ar: 'إجراءات سريعة', fr: 'Actions rapides' },
  'file.enableAll': { vi: 'Bật Tất Cả', en: 'Enable All', ar: 'تمكين الكل', fr: 'Activer tout' },
  'file.disableAllFileTypes': { vi: 'Tắt Tất Cả Loại File', en: 'Disable All File Types', ar: 'تعطيل جميع أنواع الملفات', fr: 'Désactiver tous les types de fichiers' },
  'file.restoreDefaults': { vi: 'Khôi Phục Mặc Định', en: 'Restore Defaults', ar: 'استعادة الإعدادات الافتراضية', fr: 'Restaurer par défaut' },
};

// ============== TRANSLATION HELPER ==============
const tFile = (key: string, lang: Language = 'vi'): string => {
  return fileTranslations[key]?.[lang] || fileTranslations[key]?.['vi'] || key;
};

interface FileSettings {
  fileAttachmentEnabled: boolean;
  imageUploadEnabled: boolean;
  documentUploadEnabled: boolean;
  videoUploadEnabled: boolean;
  audioUploadEnabled: boolean;
  otherFileUploadEnabled: boolean;
  maxFileSizeMB: number;
  maxImageSizeMB: number;
  maxDocumentSizeMB: number;
  maxVideoSizeMB: number;
  maxAudioSizeMB: number;
  maxOtherFileSizeMB: number;
  maxFilesPerSession: number;
  maxFilesTotal: number;
  fileUploadLimitFree: number;
  fileUploadLimitPro: number;
  fileUploadLimitEnterprise: number;
}

const FileManagement: React.FC = () => {
  const { language } = useLanguageStore();

  const [settings, setSettings] = useState<FileSettings>({
    fileAttachmentEnabled: true,
    imageUploadEnabled: true,
    documentUploadEnabled: true,
    videoUploadEnabled: true,
    audioUploadEnabled: true,
    otherFileUploadEnabled: true,
    maxFileSizeMB: 50,
    maxImageSizeMB: 10,
    maxDocumentSizeMB: 50,
    maxVideoSizeMB: 100,
    maxAudioSizeMB: 50,
    maxOtherFileSizeMB: 25,
    maxFilesPerSession: 10,
    maxFilesTotal: 100,
    fileUploadLimitFree: 10,
    fileUploadLimitPro: 0,
    fileUploadLimitEnterprise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = getAccessToken() || localStorage.getItem('token');
      if (!token) {
        // Not logged in - show login prompt
        setMessage({ type: 'error', text: tFile('file.sessionExpired', language) || 'Vui lòng đăng nhập để tiếp tục.' });
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin/file-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Handle 401 Unauthorized
      if (res.status === 401) {
        setMessage({ type: 'error', text: tFile('file.sessionExpired', language) || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, ...data.data }));
      } else {
        console.error('Failed to load file settings:', data.error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = getAccessToken() || localStorage.getItem('token');
      const res = await fetch('/api/admin/file-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: tFile('file.saveSuccess', language) });
      } else {
        setMessage({ type: 'error', text: data.error || tFile('file.error', language) });
      }
    } catch (error) {
      setMessage({ type: 'error', text: tFile('file.errorOccurred', language) });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof FileSettings>(key: K, value: FileSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const ToggleSwitch = ({ 
    checked, 
    onChange, 
    disabled = false 
  }: { 
    checked: boolean; 
    onChange: () => void; 
    disabled?: boolean;
  }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'relative w-14 h-7 rounded-full transition-colors border-2 border-black',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
          checked ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="Quản Lý Upload File"
      titleEn="File Management"
      titleAr="إدارة الملفات"
      titleFr="Gestion des fichiers"
      subtitle="Cấu hình tính năng và giới hạn upload file cho người dùng."
      subtitleEn="Configure file upload features and limits for users."
      subtitleAr="تكوين ميزات وحlimits تحميل الملفات للمستخدمين."
      subtitleFr="Configurer les fonctionnalités et limites de téléchargement."
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner - Match AdminUsers style */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative gap-4 flex-wrap">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-white to-teal-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-6 px-6">
            <h2 className="text-3xl md:text-4xl font-black text-on-surface mb-2 tracking-tight">
              {tFile('file.heroTitle', language)}
            </h2>
            <p className="text-sm md:text-base font-medium text-on-surface-variant border-l-4 border-emerald-500 pl-4 py-1 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {tFile('file.heroSubtitle', language)}<b>{tFile('file.heroSubtitleBold', language)}</b>{tFile('file.heroSubtitleSuffix', language)}
            </p>
          </div>
          <div className="relative z-10 py-6 px-6">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 
                  <span>{tFile('file.saving', language)}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{tFile('file.saveChanges', language)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-xl border-2',
          message.type === 'success' 
            ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
            : 'bg-red-100 text-red-700 border-red-300'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Global Toggle */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-black">{tFile('file.fileAttachmentFeature', language)}</h2>
              <p className="text-sm text-slate-500">{tFile('file.globalToggleDesc', language)}</p>
            </div>
          </div>
          <ToggleSwitch
            checked={settings.fileAttachmentEnabled}
            onChange={() => updateSetting('fileAttachmentEnabled', !settings.fileAttachmentEnabled)}
          />
        </div>
      </div>

      {/* File Type Toggles */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          {tFile('file.fileTypeSettings', language)}
        </h2>
        
        <div className="space-y-3">
          {/* Images */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 border-2 border-black hover:border-blue-400 hover:bg-blue-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-black">
                <Image className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{tFile('file.uploadImages', language)}</h3>
                <p className="text-sm text-slate-500">{tFile('file.imageFormats', language)}</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.imageUploadEnabled}
              onChange={() => updateSetting('imageUploadEnabled', !settings.imageUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Documents */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border-2 border-black hover:border-red-400 hover:bg-red-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center border-2 border-black">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{tFile('file.uploadDocuments', language)}</h3>
                <p className="text-sm text-slate-500">{tFile('file.documentFormats', language)}</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.documentUploadEnabled}
              onChange={() => updateSetting('documentUploadEnabled', !settings.documentUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Videos */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border-2 border-black hover:border-purple-400 hover:bg-purple-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center border-2 border-black">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{tFile('file.uploadVideo', language)}</h3>
                <p className="text-sm text-slate-500">{tFile('file.videoFormats', language)}</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.videoUploadEnabled}
              onChange={() => updateSetting('videoUploadEnabled', !settings.videoUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Audio */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 border-2 border-black hover:border-green-400 hover:bg-green-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center border-2 border-black">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{tFile('file.uploadAudio', language)}</h3>
                <p className="text-sm text-slate-500">{tFile('file.audioFormats', language)}</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.audioUploadEnabled}
              onChange={() => updateSetting('audioUploadEnabled', !settings.audioUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Other Files */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border-2 border-black hover:border-orange-400 hover:bg-orange-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center border-2 border-black">
                <File className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{tFile('file.uploadOtherFiles', language)}</h3>
                <p className="text-sm text-slate-500">{tFile('file.otherFormats', language)}</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.otherFileUploadEnabled}
              onChange={() => updateSetting('otherFileUploadEnabled', !settings.otherFileUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>
        </div>
      </div>

      {/* File Size Limits */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          {tFile('file.fileSizeLimits', language)}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-blue-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-600" /> {tFile('file.images', language)}
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxImageSizeMB}
              onChange={(e) => updateSetting('maxImageSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.imageUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-red-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" /> {tFile('file.documents', language)}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxDocumentSizeMB}
              onChange={(e) => updateSetting('maxDocumentSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.documentUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-purple-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-600" /> {tFile('file.video', language)}
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxVideoSizeMB}
              onChange={(e) => updateSetting('maxVideoSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.videoUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-green-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Music className="w-4 h-4 text-green-600" /> {tFile('file.audio', language)}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxAudioSizeMB}
              onChange={(e) => updateSetting('maxAudioSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.audioUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-orange-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <File className="w-4 h-4 text-orange-600" /> {tFile('file.otherFiles', language)}
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxOtherFileSizeMB}
              onChange={(e) => updateSetting('maxOtherFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.otherFileUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-teal-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-teal-600" /> {tFile('file.totalMax', language)}
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxFileSizeMB}
              onChange={(e) => updateSetting('maxFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>
        </div>
      </div>

      {/* Upload Limits by Plan */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          {tFile('file.uploadLimitsByPlan', language)}
        </h2>
        <p className="text-sm text-slate-500 mb-4">{tFile('file.unlimitedHint', language)}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">{tFile('file.freePlan', language)}</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitFree}
              onChange={(e) => updateSetting('fileUploadLimitFree', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">{tFile('file.planUnlimitedHint', language)}</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-amber-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">{tFile('file.proPlan', language)}</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitPro}
              onChange={(e) => updateSetting('fileUploadLimitPro', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">{tFile('file.planUnlimitedHint', language)}</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-purple-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">{tFile('file.enterprisePlan', language)}</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitEnterprise}
              onChange={(e) => updateSetting('fileUploadLimitEnterprise', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">{tFile('file.planUnlimitedHint', language)}</p>
          </div>
        </div>
      </div>

      {/* Session Limits */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          {tFile('file.sessionAndTotalLimits', language)}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-cyan-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">{tFile('file.maxFilesPerSession', language)}</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFilesPerSession}
              onChange={(e) => updateSetting('maxFilesPerSession', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">{tFile('file.sessionFilesHint', language)}</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-indigo-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">{tFile('file.maxTotalFiles', language)}</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.maxFilesTotal}
              onChange={(e) => updateSetting('maxFilesTotal', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">{tFile('file.totalFilesHint', language)}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000]">
        <h2 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider">{tFile('file.quickActions', language)}</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSettings({
              ...settings,
              fileAttachmentEnabled: true,
              imageUploadEnabled: true,
              documentUploadEnabled: true,
              videoUploadEnabled: true,
              audioUploadEnabled: true,
              otherFileUploadEnabled: true,
            })}
            disabled={!settings.fileAttachmentEnabled}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <CheckCircle className="w-4 h-4" /> {tFile('file.enableAll', language)}
          </button>
          <button
            onClick={() => setSettings({
              ...settings,
              imageUploadEnabled: false,
              documentUploadEnabled: false,
              videoUploadEnabled: false,
              audioUploadEnabled: false,
              otherFileUploadEnabled: false,
            })}
            disabled={!settings.fileAttachmentEnabled}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <XCircle className="w-4 h-4" /> {tFile('file.disableAllFileTypes', language)}
          </button>
          <button
            onClick={loadSettings}
            className="px-5 py-2.5 bg-gradient-to-r from-slate-500 to-gray-500 text-white rounded-xl hover:from-slate-400 hover:to-gray-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <RefreshCw className="w-4 h-4" /> {tFile('file.restoreDefaults', language)}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default FileManagement;
