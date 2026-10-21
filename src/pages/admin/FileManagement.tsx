import React, { useState, useEffect } from 'react';
import {
  Upload, Image, FileText, Video, Music, File,
  Save, RefreshCw, CheckCircle, XCircle, Info,
  Loader2, Shield, Zap, Database, Users
} from 'lucide-react';
import { AdminLayout } from './AdminLayoutLinear';
import { getAccessToken } from '@/lib/api';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { broadcastSettingsChange } from '@/lib/settingsBroadcast';

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
  'file.online': { vi: 'Online', en: 'Online', ar: 'متصل', fr: 'En ligne' },
  'file.pendingSync': { vi: 'Cấu hình đang chờ đồng bộ', en: 'Configuration pending sync', ar: 'في انتظار المزامنة', fr: 'En attente de synchronisation' },
  'file.cancel': { vi: 'Hủy bỏ', en: 'Cancel', ar: 'إلغاء', fr: 'Annuler' },

  // Main title
  'file.title': { vi: 'Quản Lý Upload File', en: 'File Management', ar: 'إدارة الملفات', fr: 'Gestion des fichiers' },
  'file.subtitle': { vi: 'Cấu hình tính năng và giới hạn upload file cho người dùng.', en: 'Configure file upload features and limits for users.', ar: 'تكوين ميزات وحlimits تحميل الملفات للمستخدمين.', fr: 'Configurer les fonctionnalités et limites de téléchargement.' },
  'file.heroTitle': { vi: 'Quản Lý Upload File', en: 'File Management', ar: 'إدارة الملفات', fr: 'Gestion des fichiers' },
  'file.heroSubtitle': { vi: 'Cấu hình toàn diện năng lực tiếp nhận file, quy chuẩn định dạng và định mức lưu trữ phân cấp cho toàn bộ hạ tầng MADA AI.', en: 'Comprehensive configuration of file upload capabilities, format standards, and tiered storage quotas for the entire MADA AI infrastructure.', ar: 'تكوين شامل لقدرات تحميل الملفات ومعايير التنسيق والحصص المتدرجة للتخزين لبنية MADA AI التحتية.', fr: 'Configuration complète des capacités de téléchargement de fichiers, des normes de format et des quotas de stockage hiérarchisés pour l\'infrastructure MADA AI.' },
  'file.coreSystem': { vi: 'Hệ Thống Lõi MADA', en: 'MADA Core System', ar: 'نظام MADA الأساسي', fr: 'Système principal MADA' },
  'file.centralFileMgmt': { vi: 'Quản Lý Tệp Tin Tập Trung', en: 'Central File Management', ar: 'إدارة الملفات المركزية', fr: 'Gestion centralisée des fichiers' },

  // Feature cards
  'file.malwareProtection': { vi: 'Chống Mã Độc AI', en: 'AI Malware Protection', ar: 'حماية من البرمجيات الخبيثة بالذكاء الاصطناعي', fr: 'Protection IA contre les logiciels malveillants' },
  'file.realTimeScan': { vi: 'Quét Thời Gian Thực', en: 'Real-time Scanning', ar: 'فحص في الوقت الفعلي', fr: 'Analyse en temps réel' },
  'file.processingSpeed': { vi: 'Tốc Độ Phân Tích', en: 'Processing Speed', ar: 'سرعة المعالجة', fr: 'Vitesse de traitement' },
  'file.ragPipeline': { vi: 'Chuẩn RAG Pipeline', en: 'RAG Pipeline Standard', ar: 'معيار خط أنابيب RAG', fr: 'Standard pipeline RAG' },

  // Global Toggle
  'file.fileAttachmentFeature': { vi: 'Tính Năng Đính Kèm File Toàn Hệ Thống', en: 'System-wide File Attachment Feature', ar: 'ميزة إرفاق الملفات على مستوى النظام', fr: 'Fonctionnalité de pièce jointe à l\'échelle du système' },
  'file.globalToggleDesc': { vi: 'Công tắc trung tâm chi phối mọi hành động upload, xử lý token đa phương thức và đọc tệp từ tất cả người dùng.', en: 'Central switch governing all upload actions, multimodal token processing, and file reading from all users.', ar: 'محور التبديل المركزي الذي يحكم جميع إجراءات التحميل ومعالجة الرموز متعددة الوسائط وقراءة الملفات من جميع المستخدمين.', fr: 'Commutateur central gouvernant toutes les actions de téléchargement, le traitement des jetons multimodaux et la lecture des fichiers de tous les utilisateurs.' },
  'file.masterControl': { vi: 'Master Control', en: 'Master Control', ar: 'التحكم الرئيسي', fr: 'Contrôle principal' },
  'file.statusEnabled': { vi: 'Trạng thái: Bật', en: 'Status: Enabled', ar: 'الحالة: مفعل', fr: 'Statut: Activé' },
  'file.appliesToAll': { vi: 'Áp dụng mọi phòng chat', en: 'Applies to all chat rooms', ar: 'ينطبق على جميع غرف الدردشة', fr: 'S\'applique à toutes les salles de chat' },

  // File Type Settings
  'file.fileTypeSettings': { vi: 'Cài Đặt Loại File Cho Phép', en: 'Allowed File Types Settings', ar: 'إعدادات أنواع الملفات المسموح بها', fr: 'Paramètres des types de fichiers autorisés' },
  'file.fileTypeDesc': { vi: 'Quản lý bộ lọc định dạng MIME tiếp nhận vào hệ thống MADA', en: 'Manage MIME format filters received by the MADA system', ar: 'إدارة فلاتر تنسيق MIME المستلمة بواسطة نظام MADA', fr: 'Gérer les filtres de format MIME reçus par le système MADA' },
  'file.activeFormats': { vi: 'Đang Kích Hoạt', en: 'Active', ar: 'نشط', fr: 'Actif' },
  'file.uploadImages': { vi: 'Upload Hình Ảnh', en: 'Upload Images', ar: 'تحميل الصور', fr: 'Télécharger des images' },
  'file.imageFormats': { vi: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF, SVG', en: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF, SVG', ar: 'JPG، JPEG، PNG، WEBP، BMP، TIFF، GIF، SVG', fr: 'JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF, SVG' },
  'file.visionAI': { vi: 'Vision AI Ready', en: 'Vision AI Ready', ar: 'جاهز للرؤية بالذكاء الاصطناعي', fr: 'Prêt pour la vision IA' },
  'file.maxSize': { vi: 'Tối đa', en: 'Max', ar: 'الحد الأقصى', fr: 'Max' },
  'file.perFile': { vi: '/tệp', en: '/file', ar: '/ملف', fr: '/fichier' },
  'file.uploadDocuments': { vi: 'Upload Tài Liệu Văn Bản', en: 'Upload Document Files', ar: 'تحميل ملفات المستندات', fr: 'Télécharger des documents' },
  'file.documentFormats': { vi: 'PDF, DOC, DOCX, TXT, MD, EPUB, RTF', en: 'PDF, DOC, DOCX, TXT, MD, EPUB, RTF', ar: 'PDF، DOC، DOCX، TXT، MD، EPUB، RTF', fr: 'PDF, DOC, DOCX, TXT, MD, EPUB, RTF' },
  'file.ragVector': { vi: 'RAG Vector Ready', en: 'RAG Vector Ready', ar: 'جاهز لمتجه RAG', fr: 'Prêt pour le vecteur RAG' },
  'file.uploadVideo': { vi: 'Upload Video & Đa Phương Tiện', en: 'Upload Video & Multimedia', ar: 'تحميل الفيديو والوسائط المتعددة', fr: 'Télécharger des vidéos et multimédias' },
  'file.videoFormats': { vi: 'MP4, AVI, MOV, MKV, WebM', en: 'MP4, AVI, MOV, MKV, WebM', ar: 'MP4، AVI، MOV، MKV، WebM', fr: 'MP4, AVI, MOV, MKV, WebM' },
  'file.autoTranscribe': { vi: 'Auto Transcribe', en: 'Auto Transcribe', ar: 'نسخ تلقائي', fr: 'Transcription automatique' },
  'file.uploadAudio': { vi: 'Upload Âm Thanh & Ghi Âm', en: 'Upload Audio & Recording', ar: 'تحميل الصوت والتسجيل', fr: 'Télécharger de l\'audio et de l\'enregistrement' },
  'file.audioFormats': { vi: 'MP3, WAV, AAC, OGG, M4A, FLAC', en: 'MP3, WAV, AAC, OGG, M4A, FLAC', ar: 'MP3، WAV، AAC، OGG، M4A، FLAC', fr: 'MP3, WAV, AAC, OGG, M4A, FLAC' },
  'file.whisperAI': { vi: 'Whisper AI', en: 'Whisper AI', ar: 'الهمس بالذكاء الاصطناعي', fr: 'Whisper IA' },
  'file.uploadOtherFiles': { vi: 'Tệp Nén & Bảng Dữ Liệu Khác', en: 'Compressed & Data Files', ar: 'ملفات مضغوطة وبيانات', fr: 'Fichiers compressés et données' },
  'file.otherFormats': { vi: 'ZIP, RAR, 7Z, CSV, XLSX, JSON, XML', en: 'ZIP, RAR, 7Z, CSV, XLSX, JSON, XML', ar: 'ZIP، RAR، 7Z، CSV، XLSX، JSON، XML', fr: 'ZIP, RAR, 7Z, CSV, XLSX, JSON, XML' },
  'file.dataParser': { vi: 'Data Parser', en: 'Data Parser', ar: 'محلل البيانات', fr: 'Analyseur de données' },

  // File Size Limits
  'file.fileSizeLimits': { vi: 'Giới Hạn Dung Lượng Định Dạng (MB)', en: 'Format Size Limits (MB)', ar: 'حدود حجم التنسيق (ميجابايت)', fr: 'Limites de taille de format (Mo)' },
  'file.fileSizeDesc': { vi: 'Thiết lập trần dung lượng tối đa cho mỗi loại file tải lên', en: 'Set maximum storage ceiling for each uploaded file type', ar: 'تعيين الحد الأقصى للتخزين لكل نوع ملف تم تحميله', fr: 'Définir le plafond de stockage maximal pour chaque type de fichier téléchargé' },
  'file.unitMB': { vi: 'MB', en: 'MB', ar: 'ميجابايت', fr: 'Mo' },
  'file.default': { vi: 'Mặc định', en: 'Default', ar: 'افتراضي', fr: 'Par défaut' },
  'file.images': { vi: 'Hình Ảnh', en: 'Images', ar: 'الصور', fr: 'Images' },
  'file.documents': { vi: 'Tài Liệu Văn Bản', en: 'Document Files', ar: 'ملفات المستندات', fr: 'Documents' },
  'file.video': { vi: 'Video Đa Phương Tiện', en: 'Video Media', ar: 'وسائط الفيديو', fr: 'Médias vidéo' },
  'file.audio': { vi: 'Âm Thanh Voice', en: 'Voice Audio', ar: 'صوت', fr: 'Audio vocal' },
  'file.otherFiles': { vi: 'File Khác & Tệp Nén', en: 'Other Files & Archives', ar: 'ملفات وأرشيف أخرى', fr: 'Autres fichiers et archives' },
  'file.totalMax': { vi: 'Tổng Max (Mỗi Tệp Đơn)', en: 'Total Max (Per Single File)', ar: 'الحد الأقصى الإجمالي (لكل ملف واحد)', fr: 'Total max (par fichier unique)' },
  'file.blocking': { vi: 'Chốt chặn', en: 'Blocking', ar: 'حاجز', fr: 'Barrière' },

  // Upload Limits by Plan
  'file.uploadLimitsByPlan': { vi: 'Hạn Mức Theo Gói Tài Khoản (File / Tháng)', en: 'Plan-based Upload Limits (Files / Month)', ar: 'حدود التحميل حسب الباقة (ملفات / شهر)', fr: 'Limites de téléchargement par plan (fichiers / mois)' },
  'file.planDesc': { vi: 'Phân cấp số lượng tải tệp dựa trên hạng thành viên', en: 'Tier file upload counts based on membership tier', ar: 'تصنيف عدد تحميلات الملفات بناءً على مستوى العضوية', fr: 'Hiérarchiser le nombre de téléchargements de fichiers selon le niveau d\'adhésion' },
  'file.unlimitedHint': { vi: 'Đặt giá trị 0 = Không giới hạn số lượng', en: 'Set value 0 = Unlimited quantity', ar: 'تعيين القيمة 0 = كمية غير محدودة', fr: 'Définir la valeur 0 = Quantité illimitée' },
  'file.freePlan': { vi: 'Free Plan', en: 'Free Plan', ar: 'الباقة المجانية', fr: 'Plan Gratuit' },
  'file.proPlan': { vi: 'Pro Plan', en: 'Pro Plan', ar: 'باقة Pro', fr: 'Plan Pro' },
  'file.enterprisePlan': { vi: 'Enterprise Plan', en: 'Enterprise Plan', ar: 'باقة المؤسسة', fr: 'Plan Entreprise' },
  'file.basic': { vi: 'Cơ Bản', en: 'Basic', ar: 'أساسي', fr: 'Basique' },
  'file.professional': { vi: 'Chuyên Nghiệp', en: 'Professional', ar: 'احترافي', fr: 'Professionnel' },
  'file.business': { vi: 'Doanh Nghiệp', en: 'Business', ar: 'الأعمال', fr: 'Entreprise' },
  'file.planUnlimitedHint': { vi: '0 = Vô Hạn', en: '0 = Unlimited', ar: '0 = غير محدود', fr: '0 = Illimité' },
  'file.unlimitedUploads': { vi: 'Không giới hạn số lượt tải hàng tháng', en: 'Unlimited upload quota per month', ar: 'حصة تحميل غير محدودة شهرياً', fr: 'Quota de téléchargement illimité par mois' },
  'file.unlimitedPriority': { vi: 'Không giới hạn kèm luồng xử lý ưu tiên Dedicated', en: 'Unlimited with Dedicated priority processing pipeline', ar: 'غير محدود مع خط أنابيب المعالجة ذي الأولوية المخصص', fr: 'Illimité avec pipeline de traitement prioritaire dédié' },
  'file.defaultQuota': { vi: 'Định mức tối đa mặc định cho người dùng miễn phí', en: 'Maximum default quota for free users', ar: 'الحصة الافتراضية القصوى للمستخدمين المجانيين', fr: 'Quota par défaut maximal pour les utilisateurs gratuits' },

  // Session Limits
  'file.sessionAndTotalLimits': { vi: 'Giới Hạn Phiên & Tổng Dung Lượng Bộ Nhớ', en: 'Session & Total Storage Limits', ar: 'حدود الجلسة وإجمالي التخزين', fr: 'Limites de session et de stockage total' },
  'file.sessionDesc': { vi: 'Quy định số file trong một hội thoại và kho tệp lưu trữ trọn đời', en: 'Regulate file count per conversation and lifetime file storage', ar: 'تنظيم عدد الملفات لكل محادثة وتخزين الملفات مدى الحياة', fr: 'Réguler le nombre de fichiers par conversation et le stockage des fichiers à vie' },
  'file.maxFilesPerSession': { vi: 'Tối Đa Số File Trong Một Phiên Chat', en: 'Maximum Files Per Chat Session', ar: 'الحد الأقصى للملفات لكل جلسة دردشة', fr: 'Fichiers maximums par session de chat' },
  'file.sessionFilesHint': { vi: 'Số file tối đa người dùng có thể gửi đồng thời trong cùng một ngữ cảnh hội thoại', en: 'Maximum number of files a user can send simultaneously in the same conversation context', ar: 'الحد الأقصى لعدد الملفات التي يمكن للمستخدم إرسالها في وقت واحد في نفس سياق المحادثة', fr: 'Nombre maximal de fichiers qu\'un utilisateur peut envoyer simultanément dans le même contexte de conversation' },
  'file.maxTotalFiles': { vi: 'Tổng Tệp Tin Được Lưu Trữ', en: 'Total Stored Files', ar: 'إجمالي الملفات المخزنة', fr: 'Fichiers stockés totaux' },
  'file.totalFilesHint': { vi: 'Tổng số tệp tin khả dụng trong thư viện cá nhân của mỗi tài khoản', en: 'Total available files in each account\'s personal library', ar: 'إجمالي الملفات المتاحة في مكتبة كل حساب الشخصية', fr: 'Fichiers totaux disponibles dans la bibliothèque personnelle de chaque compte' },
  'file.storage': { vi: 'Lưu trữ', en: 'Storage', ar: 'تخزين', fr: 'Stockage' },
  'file.chatSession': { vi: 'Phiên chat', en: 'Chat Session', ar: 'جلسة الدردشة', fr: 'Session de chat' },

  // Quick Actions
  'file.quickActions': { vi: 'Hành Động Hàng Loạt Nhanh', en: 'Quick Batch Actions', ar: 'إجراءات دفعية سريعة', fr: 'Actions groupées rapides' },
  'file.quickActionsDesc': { vi: 'Thao tác tức thời trên toàn bộ các định dạng file', en: 'Instant operations across all file formats', ar: 'عمليات فورية عبر جميع تنسيقات الملفات', fr: 'Opérations instantanées sur tous les formats de fichiers' },
  'file.enableAll': { vi: 'Bật Tất Cả Định Dạng', en: 'Enable All Formats', ar: 'تمكين جميع التنسيقات', fr: 'Activer tous les formats' },
  'file.disableAllFileTypes': { vi: 'Tắt Tất Cả Loại File', en: 'Disable All File Types', ar: 'تعطيل جميع أنواع الملفات', fr: 'Désactiver tous les types de fichiers' },
  'file.restoreDefaults': { vi: 'Khôi Phục Mặc Định Hệ Thống', en: 'Restore System Defaults', ar: 'استعادة إعدادات النظام الافتراضية', fr: 'Restaurer les paramètres système par défaut' },
  'file.enabledAllSuccess': { vi: 'Đã bật tất cả định dạng file!', en: 'All file formats enabled!', ar: 'تمكين جميع تنسيقات الملفات!', fr: 'Tous les formats de fichiers activés!' },
  'file.disabledAllSuccess': { vi: 'Đã tắt tất cả loại file!', en: 'All file types disabled!', ar: 'تم تعطيل جميع أنواع الملفات!', fr: 'Tous les types de fichiers désactivés!' },
  'file.restoredSuccess': { vi: 'Đã khôi phục cài đặt mặc định!', en: 'Settings restored to defaults!', ar: 'تمت استعادة الإعدادات الافتراضية!', fr: 'Paramètres restaurés par défaut!' },
};

// ============== TRANSLATION HELPER ==============
const tFile = (key: string, lang: Language = 'vi'): string => {
  const safeLang = lang ?? 'vi';
  return fileTranslations[key]?.[safeLang] || fileTranslations[key]?.['vi'] || key;
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
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Toast auto-hide
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = getAccessToken() || localStorage.getItem('token');
      if (!token) {
        setMessage({ type: 'error', text: tFile('file.sessionExpired', language) || 'Vui lòng đăng nhập để tiếp tục.' });
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin/file-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        setMessage({ type: 'error', text: tFile('file.sessionExpired', language) || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, ...data.data }));
        setHasPendingChanges(false); // Reset khi load thành công
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
        setHasPendingChanges(false); // Reset sau khi lưu thành công
        // ⭐ Broadcast settings change to all ChatPage instances - immediate sync!
        broadcastSettingsChange(['feature_file_attachment_enabled']);
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
    setHasPendingChanges(true);
  };

  // Custom Toggle Switch Component — matches the HTML sample exactly
  const ToggleSwitch = ({ 
    checked, 
    onChange, 
    disabled = false,
    size = 'default'
  }: { 
    checked: boolean; 
    onChange: () => void; 
    disabled?: boolean;
    size?: 'default' | 'large';
  }) => {
    const isLarge = size === 'large';
    
    if (isLarge) {
      // Large toggle - matches original HTML: w-16 h-9, knob h-7 w-7
      return (
        <label className={clsx(
          'relative inline-flex items-center cursor-pointer select-none',
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        )}>
          <input 
            checked={checked} 
            onChange={onChange}
            disabled={disabled}
            type="checkbox" 
            className="sr-only peer" 
          />
          <div className={clsx(
            'w-16 h-9 rounded-full transition-all duration-200',
            'peer-checked:bg-emerald-500 bg-slate-200',
            'peer-focus:outline-none',
            'peer-focus:ring-2 peer-focus:ring-teal-500 peer-focus:ring-offset-2'
          )}>
            <span className={clsx(
              'absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow-md',
              'transition-all duration-200',
              'peer-checked:translate-x-7'
            )} />
          </div>
        </label>
      );
    }
    
    // Default toggle - matches original HTML: w-14 h-8, knob h-6 w-6
    return (
      <label className={clsx(
        'relative inline-flex items-center cursor-pointer select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      )}>
        <input 
          checked={checked} 
          onChange={onChange}
          disabled={disabled}
          type="checkbox" 
          className="sr-only peer" 
        />
        <div className={clsx(
          'w-14 h-8 rounded-full transition-all duration-200',
          'peer-checked:bg-emerald-500 bg-slate-200',
          'peer-focus:outline-none',
          'peer-focus:ring-2 peer-focus:ring-teal-500 peer-focus:ring-offset-2'
        )}>
          <span className={clsx(
            'absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm',
            'transition-all duration-200',
            'peer-checked:translate-x-6'
          )} />
        </div>
      </label>
    );
  };

  // File Type Card Component
  const FileTypeCard = ({
    icon: Icon,
    title,
    formats,
    badge,
    badgeColor,
    checked,
    onToggle,
    disabled,
    maxSize,
    colorClass,
    borderClass,
    gradientClass,
    iconBgClass
  }: {
    icon: React.ElementType;
    title: string;
    formats: string;
    badge: string;
    badgeColor: string;
    checked: boolean;
    onToggle: () => void;
    disabled: boolean;
    maxSize: number;
    colorClass: string;
    borderClass: string;
    gradientClass: string;
    iconBgClass: string;
  }) => (
    <div className={clsx(
      'group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 gap-4',
      gradientClass,
      checked ? borderClass : 'border-black/10 bg-slate-50/50 hover:bg-slate-50',
      !disabled && checked && 'hover:scale-[1.01]'
    )}>
      <div className="flex items-center gap-4">
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center border-2 shadow-sm transition-all',
          checked ? colorClass : iconBgClass
        )}>
          <Icon className={clsx('w-6 h-6 transition-colors', checked ? 'text-white' : 'text-current')} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 group-hover:text-black transition">{title}</h3>
            <span className={clsx(
              'text-[11px] font-bold px-2 py-0.5 rounded-md border',
              badgeColor
            )}>{badge}</span>
          </div>
          <p className="text-xs sm:text-sm font-mono text-slate-500 mt-0.5">{formats}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-5 pl-16 sm:pl-0">
        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
          {tFile('file.maxSize')}: {maxSize} {tFile('file.unitMB')}{tFile('file.perFile')}
        </span>
        <ToggleSwitch checked={checked} onChange={onToggle} disabled={disabled} />
      </div>
    </div>
  );

  // Size Input Card Component
  const SizeInputCard = ({
    label,
    value,
    onChange,
    disabled,
    colorDot,
    defaultValue,
    isFeatured = false
  }: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    disabled: boolean;
    colorDot: string;
    defaultValue: number;
    isFeatured?: boolean;
  }) => (
    <div className={clsx(
      'p-5 rounded-2xl border-2 transition-all duration-200 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100',
      isFeatured 
        ? 'bg-gradient-to-br from-teal-50/70 to-emerald-50/50 border-teal-300/80 shadow-sm' 
        : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
    )}>
      <div className="flex items-center gap-2.5 mb-3">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span className={clsx('w-2 h-2 rounded-full', colorDot, isFeatured && 'animate-ping')}></span>
          {label}
        </label>
        {isFeatured && (
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-100 text-teal-800">
            {tFile('file.blocking')}
          </span>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          {tFile('file.default')}: {defaultValue}
        </span>
      </div>
      <div className="relative flex items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          disabled={disabled}
          className={clsx(
            'w-full rounded-xl border-2 py-2.5 pl-3.5 pr-12 text-lg font-mono font-bold shadow-xs transition-all focus:outline-none',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
            isFeatured 
              ? 'border-teal-300 text-teal-950 focus:border-teal-600 bg-white' 
              : 'border-slate-200 text-slate-900 focus:border-teal-500 bg-white',
            disabled && 'bg-slate-100 cursor-not-allowed'
          )}
        />
        <span className={clsx(
          'absolute right-3.5 text-xs font-bold',
          isFeatured ? 'text-teal-700' : 'text-slate-400'
        )}>
          {tFile('file.unitMB')}
        </span>
      </div>
    </div>
  );

  // Plan Card Component
  const PlanCard = ({
    name,
    tier,
    value,
    onChange,
    disabled,
    isHighlighted,
    tierColor,
    hint,
    hintColor = 'text-emerald-600'
  }: {
    name: string;
    tier: string;
    value: number;
    onChange: (val: number) => void;
    disabled: boolean;
    isHighlighted: boolean;
    tierColor: string;
    hint: string;
    hintColor?: string;
  }) => (
    <div className={clsx(
      'p-6 rounded-2xl border-2 transition-all shadow-xs flex flex-col justify-between',
      isHighlighted 
        ? 'bg-gradient-to-b from-amber-50/40 via-white to-white border-amber-200 hover:border-amber-300' 
        : 'bg-gradient-to-b from-slate-50 to-white border-slate-200 hover:border-slate-300'
    )}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className={clsx('text-sm font-bold tracking-wide uppercase', isHighlighted ? 'text-amber-900' : 'text-slate-800')}>
            {name}
          </span>
          <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold border', tierColor)}>
            {tier}
          </span>
        </div>
        <div className="relative mb-3">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            disabled={disabled}
            className={clsx(
              'w-full rounded-xl border-2 py-3 pl-4 pr-14 text-xl font-mono font-bold shadow-xs transition-all focus:outline-none',
              '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
              isHighlighted 
                ? 'border-amber-300 text-amber-950 focus:border-amber-500 bg-white' 
                : 'border-slate-300 text-slate-900 focus:border-teal-500 bg-white',
              disabled && 'bg-slate-100 cursor-not-allowed'
            )}
          />
          <span className={clsx(
            'absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap',
            isHighlighted ? 'text-amber-700' : 'text-slate-400'
          )}>
            {value === 0 ? tFile('file.planUnlimitedHint') : tFile('file.perFile') + '/tháng'}
          </span>
        </div>
      </div>
      <p className={clsx('text-xs font-semibold mt-2 flex items-center gap-1.5', hintColor)}>
        {isHighlighted && (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        )}
        {hint}
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const activeFormatsCount = [
    settings.imageUploadEnabled,
    settings.documentUploadEnabled,
    settings.videoUploadEnabled,
    settings.audioUploadEnabled,
    settings.otherFileUploadEnabled
  ].filter(Boolean).length;

  return (
    <AdminLayout
      titleKey="admin.topBar.fileManagement"
      subtitleKey="admin.topBar.fileManagementSub"
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-right fade-in duration-300">
          <div className={clsx(
            'flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-sm',
            toast.type === 'success' 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' 
              : 'bg-red-50/95 border-red-200 text-red-800'
          )}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-white via-teal-50/30 to-emerald-50/40 border border-slate-200/80 p-7 sm:p-9 shadow-sm mb-8">
        {/* Ambient Background Orbs */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-teal-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 bg-emerald-200/20 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2.5 text-xs font-bold text-teal-700 uppercase tracking-wider">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                {tFile('file.coreSystem')}
              </span>
              <span>›</span>
              <span className="text-slate-500">{tFile('file.centralFileMgmt')}</span>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              {tFile('file.heroTitle')}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200 tracking-normal">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {tFile('file.online')}
              </span>
            </h1>
            
            <p className="text-slate-600 text-sm sm:text-base max-w-2xl leading-relaxed">
              {tFile('file.heroSubtitle')}
            </p>
          </div>
          
          {/* Feature Cards */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{tFile('file.malwareProtection')}</div>
                <div className="text-[11px] font-medium text-emerald-600">{tFile('file.realTimeScan')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{tFile('file.processingSpeed')}</div>
                <div className="text-[11px] font-semibold text-teal-700">{tFile('file.ragPipeline')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Master Toggle Section */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm transition-all duration-200 hover:border-teal-200 hover:shadow-md mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/25 shrink-0">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{tFile('file.fileAttachmentFeature')}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {tFile('file.masterControl')}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">{tFile('file.globalToggleDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-slate-900">{tFile('file.statusEnabled')}</div>
              <div className="text-[11px] text-emerald-600 font-medium">{tFile('file.appliesToAll')}</div>
            </div>
            <ToggleSwitch
              checked={settings.fileAttachmentEnabled}
              onChange={() => updateSetting('fileAttachmentEnabled', !settings.fileAttachmentEnabled)}
              size="large"
            />
          </div>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-xl border-2 mb-6',
          message.type === 'success' 
            ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
            : 'bg-red-100 text-red-700 border-red-300'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* File Type Settings */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-wider uppercase">{tFile('file.fileTypeSettings')}</h2>
              <p className="text-xs text-slate-500">{tFile('file.fileTypeDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {activeFormatsCount}/5 {tFile('file.activeFormats')}
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Images */}
          <FileTypeCard
            icon={Image}
            title={tFile('file.uploadImages')}
            formats={tFile('file.imageFormats')}
            badge={tFile('file.visionAI')}
            badgeColor="bg-blue-100/70 text-blue-700 border-blue-200"
            checked={settings.imageUploadEnabled}
            onToggle={() => updateSetting('imageUploadEnabled', !settings.imageUploadEnabled)}
            disabled={!settings.fileAttachmentEnabled}
            maxSize={settings.maxImageSizeMB}
            colorClass="bg-gradient-to-tr from-blue-500 to-cyan-400 text-white border-blue-400/30"
            borderClass="border-blue-300 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-100"
            gradientClass="from-blue-50/50 via-white to-white"
            iconBgClass="bg-blue-100 border-blue-200 text-blue-600"
          />

          {/* Documents */}
          <FileTypeCard
            icon={FileText}
            title={tFile('file.uploadDocuments')}
            formats={tFile('file.documentFormats')}
            badge={tFile('file.ragVector')}
            badgeColor="bg-rose-100/70 text-rose-700 border-rose-200"
            checked={settings.documentUploadEnabled}
            onToggle={() => updateSetting('documentUploadEnabled', !settings.documentUploadEnabled)}
            disabled={!settings.fileAttachmentEnabled}
            maxSize={settings.maxDocumentSizeMB}
            colorClass="bg-gradient-to-tr from-rose-500 to-pink-500 text-white border-rose-400/30"
            borderClass="border-rose-300 bg-rose-50/50 hover:border-rose-400 hover:bg-rose-100"
            gradientClass="from-rose-50/50 via-white to-white"
            iconBgClass="bg-rose-100 border-rose-200 text-rose-600"
          />

          {/* Video */}
          <FileTypeCard
            icon={Video}
            title={tFile('file.uploadVideo')}
            formats={tFile('file.videoFormats')}
            badge={tFile('file.autoTranscribe')}
            badgeColor="bg-purple-100/70 text-purple-700 border-purple-200"
            checked={settings.videoUploadEnabled}
            onToggle={() => updateSetting('videoUploadEnabled', !settings.videoUploadEnabled)}
            disabled={!settings.fileAttachmentEnabled}
            maxSize={settings.maxVideoSizeMB}
            colorClass="bg-gradient-to-tr from-purple-600 to-indigo-500 text-white border-purple-400/30"
            borderClass="border-purple-300 bg-purple-50/50 hover:border-purple-400 hover:bg-purple-100"
            gradientClass="from-purple-50/50 via-white to-white"
            iconBgClass="bg-purple-100 border-purple-200 text-purple-600"
          />

          {/* Audio */}
          <FileTypeCard
            icon={Music}
            title={tFile('file.uploadAudio')}
            formats={tFile('file.audioFormats')}
            badge={tFile('file.whisperAI')}
            badgeColor="bg-emerald-100/70 text-emerald-700 border-emerald-200"
            checked={settings.audioUploadEnabled}
            onToggle={() => updateSetting('audioUploadEnabled', !settings.audioUploadEnabled)}
            disabled={!settings.fileAttachmentEnabled}
            maxSize={settings.maxAudioSizeMB}
            colorClass="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-emerald-400/30"
            borderClass="border-emerald-300 bg-emerald-50/50 hover:border-emerald-400 hover:bg-emerald-100"
            gradientClass="from-emerald-50/50 via-white to-white"
            iconBgClass="bg-emerald-100 border-emerald-200 text-emerald-600"
          />

          {/* Other Files */}
          <FileTypeCard
            icon={File}
            title={tFile('file.uploadOtherFiles')}
            formats={tFile('file.otherFormats')}
            badge={tFile('file.dataParser')}
            badgeColor="bg-amber-100/70 text-amber-800 border-amber-200"
            checked={settings.otherFileUploadEnabled}
            onToggle={() => updateSetting('otherFileUploadEnabled', !settings.otherFileUploadEnabled)}
            disabled={!settings.fileAttachmentEnabled}
            maxSize={settings.maxOtherFileSizeMB}
            colorClass="bg-gradient-to-tr from-amber-500 to-orange-400 text-white border-amber-400/30"
            borderClass="border-amber-300 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-100"
            gradientClass="from-amber-50/50 via-white to-white"
            iconBgClass="bg-amber-100 border-amber-200 text-amber-600"
          />
        </div>
      </section>

      {/* File Size Limits */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-wider uppercase">{tFile('file.fileSizeLimits')}</h2>
            <p className="text-xs text-slate-500">{tFile('file.fileSizeDesc')}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          <SizeInputCard
            label={tFile('file.images')}
            value={settings.maxImageSizeMB}
            onChange={(val) => updateSetting('maxImageSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled || !settings.imageUploadEnabled}
            colorDot="bg-blue-500"
            defaultValue={10}
          />
          <SizeInputCard
            label={tFile('file.documents')}
            value={settings.maxDocumentSizeMB}
            onChange={(val) => updateSetting('maxDocumentSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled || !settings.documentUploadEnabled}
            colorDot="bg-rose-500"
            defaultValue={50}
          />
          <SizeInputCard
            label={tFile('file.video')}
            value={settings.maxVideoSizeMB}
            onChange={(val) => updateSetting('maxVideoSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled || !settings.videoUploadEnabled}
            colorDot="bg-purple-500"
            defaultValue={100}
          />
          <SizeInputCard
            label={tFile('file.audio')}
            value={settings.maxAudioSizeMB}
            onChange={(val) => updateSetting('maxAudioSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled || !settings.audioUploadEnabled}
            colorDot="bg-emerald-500"
            defaultValue={50}
          />
          <SizeInputCard
            label={tFile('file.otherFiles')}
            value={settings.maxOtherFileSizeMB}
            onChange={(val) => updateSetting('maxOtherFileSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled || !settings.otherFileUploadEnabled}
            colorDot="bg-amber-500"
            defaultValue={25}
          />
          <SizeInputCard
            label={tFile('file.totalMax')}
            value={settings.maxFileSizeMB}
            onChange={(val) => updateSetting('maxFileSizeMB', val)}
            disabled={!settings.fileAttachmentEnabled}
            colorDot="bg-teal-600"
            defaultValue={50}
            isFeatured
          />
        </div>
      </section>

      {/* Upload Limits by Plan */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-wider uppercase">{tFile('file.uploadLimitsByPlan')}</h2>
              <p className="text-xs text-slate-500">{tFile('file.planDesc')}</p>
            </div>
          </div>
        </div>
        
        <p className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-full self-start flex items-center gap-1.5 mt-4 mb-6">
          <span>💡</span> {tFile('file.unlimitedHint')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard
            name={tFile('file.freePlan')}
            tier={tFile('file.basic')}
            value={settings.fileUploadLimitFree}
            onChange={(val) => updateSetting('fileUploadLimitFree', val)}
            disabled={!settings.fileAttachmentEnabled}
            isHighlighted={false}
            tierColor="bg-slate-200 text-slate-700 border-slate-300"
            hint={tFile('file.defaultQuota')}
            hintColor="text-slate-500"
          />
          <PlanCard
            name={tFile('file.proPlan')}
            tier={tFile('file.professional')}
            value={settings.fileUploadLimitPro}
            onChange={(val) => updateSetting('fileUploadLimitPro', val)}
            disabled={!settings.fileAttachmentEnabled}
            isHighlighted={true}
            tierColor="bg-amber-100 text-amber-800 border-amber-200"
            hint={tFile('file.unlimitedUploads')}
            hintColor="text-emerald-600"
          />
          <PlanCard
            name={tFile('file.enterprisePlan')}
            tier={tFile('file.business')}
            value={settings.fileUploadLimitEnterprise}
            onChange={(val) => updateSetting('fileUploadLimitEnterprise', val)}
            disabled={!settings.fileAttachmentEnabled}
            isHighlighted={true}
            tierColor="bg-teal-100 text-teal-800 border-teal-200"
            hint={tFile('file.unlimitedPriority')}
            hintColor="text-emerald-600"
          />
        </div>
      </section>

      {/* Session and Total Limits */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-wider uppercase">{tFile('file.sessionAndTotalLimits')}</h2>
            <p className="text-xs text-slate-500">{tFile('file.sessionDesc')}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Max Files Per Session */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-50/40 to-white border border-teal-100/90 hover:border-teal-300 transition-all shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-800">{tFile('file.maxFilesPerSession')}</label>
              <span className="text-xs font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded">{tFile('file.chatSession')}</span>
            </div>
            <input
              type="number"
              value={settings.maxFilesPerSession}
              onChange={(e) => updateSetting('maxFilesPerSession', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full bg-white text-lg font-mono font-bold text-slate-900 rounded-xl border border-slate-200 py-3 px-4 focus:border-teal-500 focus:ring-0 shadow-xs disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-2">{tFile('file.sessionFilesHint')}</p>
          </div>

          {/* Max Total Files */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-50/40 to-white border border-indigo-100/90 hover:border-indigo-300 transition-all shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-800">{tFile('file.maxTotalFiles')}</label>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">{tFile('file.storage')}</span>
            </div>
            <input
              type="number"
              value={settings.maxFilesTotal}
              onChange={(e) => updateSetting('maxFilesTotal', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full bg-white text-lg font-mono font-bold text-slate-900 rounded-xl border border-slate-200 py-3 px-4 focus:border-indigo-500 focus:ring-0 shadow-xs disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-2">{tFile('file.totalFilesHint')}</p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-wider uppercase">{tFile('file.quickActions')}</h2>
            <p className="text-xs text-slate-500">{tFile('file.quickActionsDesc')}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              setSettings({
                ...settings,
                imageUploadEnabled: true,
                documentUploadEnabled: true,
                videoUploadEnabled: true,
                audioUploadEnabled: true,
                otherFileUploadEnabled: true,
              });
              setHasPendingChanges(true);
              setToast({ show: true, message: tFile('file.enabledAllSuccess', language), type: 'success' });
            }}
            disabled={!settings.fileAttachmentEnabled}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/25 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            {tFile('file.enableAll')}
          </button>
          <button
            onClick={() => {
              setSettings({
                ...settings,
                imageUploadEnabled: false,
                documentUploadEnabled: false,
                videoUploadEnabled: false,
                audioUploadEnabled: false,
                otherFileUploadEnabled: false,
              });
              setHasPendingChanges(true);
              setToast({ show: true, message: tFile('file.disabledAllSuccess', language), type: 'success' });
            }}
            disabled={!settings.fileAttachmentEnabled}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" />
            {tFile('file.disableAllFileTypes')}
          </button>
          <button
            onClick={() => {
              loadSettings();
              setToast({ show: true, message: tFile('file.restoredSuccess', language), type: 'success' });
            }}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            {tFile('file.restoreDefaults')}
          </button>
        </div>
      </section>

      {/* Sticky Bottom Save Bar - Chỉ hiện khi có thay đổi chưa lưu */}
      {hasPendingChanges && (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col sm:flex-row items-center justify-between bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xl gap-4"
           style={{ left: 'max(1rem, 16rem)', maxWidth: 'calc(100vw - 2rem)' }}>
        <div className="flex items-center gap-3.5 text-slate-600 text-xs sm:text-sm">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <div>
            <span className="font-bold text-slate-900">{tFile('file.pendingSync')}:</span>
            <span className="text-slate-500 ml-1">Các thay đổi sẽ được áp dụng ngay trên toàn bộ node cụm máy chủ.</span>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button 
            onClick={loadSettings}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {tFile('file.cancel')}
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-md shadow-teal-500/25 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? tFile('file.saving') : tFile('file.saveChanges')}
          </button>
        </div>
      </div>
      )}
    </AdminLayout>
  );
};

export default FileManagement;
