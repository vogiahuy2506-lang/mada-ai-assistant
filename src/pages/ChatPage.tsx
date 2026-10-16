import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChatStore, useChatHistoryStore, useLanguageStore, useAuthStore, useAnonQuotaStore, usePaywallModalStore, useAuthModalStore, useAgentStore, useSelectedAgentStore, useSystemSettingsStore, useViewModeStore, useChatSettingsStore } from '@/stores';
import madaLogo from '@/assets/mada-logo.png';
import { QuotaIndicator } from '@/components/auth/QuotaIndicator';
import { DislikeFeedbackForm } from '@/components/DislikeFeedbackForm';
import AttachmentModal from '@/components/ui/AttachmentModal';
import {
  Send, Plus, User, Mic,
  Volume2, ChevronDown, Check,
  Bot as BotIcon, ChevronRight,
  FileText, Video, Mic2, ImageIcon, File, X,
  MessageCircle,
  LogOut, Sparkles,
  Search, MessageSquare, Loader2,
  Accessibility,
  Globe,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CATEGORY_INFO, SAMPLE_QUESTIONS, AT_SPECIALIST_KEYWORDS, type ATCategory, type Language, type SuggestedProduct } from '@/types';
import { t } from '@/lib/translations';
import { userHistoryApi, fileQuotaApi, getAccessToken, type FileUploadQuota } from '@/lib/api';
import { getImageUrl } from '@/lib/imageProxy';
import { onAgentChange } from '@/lib/agentBroadcast';
import { onSettingsChange } from '@/lib/settingsBroadcast';
import { MADA_BOTS } from '@/lib/madaBots';

// ⭐ Helper: Staggered fetch with retry to avoid 429 rate limiting
async function staggeredFetch(url: string, delayMs: number = 100, retries: number = 3): Promise<Response> {
  await new Promise(resolve => setTimeout(resolve, delayMs));
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        const retryDelay = Math.min(500 * Math.pow(2, attempt), 3000); // exponential backoff, max 3s
        console.warn(`[staggeredFetch] 429 received for ${url}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        const retryDelay = Math.min(500 * Math.pow(2, attempt), 3000);
        console.warn(`[staggeredFetch] Error for ${url}: ${err}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

// ⭐ Map botId → ATCategory (dùng để sync thứ tự agent ↔ sidebar)
// NOTE: bot-neuro → mobility (neuromuscular), bot-mobility → daily_living
const BOT_ID_TO_CATEGORY: Record<string, ATCategory> = {
  'bot-vision': 'vision',
  'bot-hearing': 'hearing',
  'bot-speech': 'communication',
  'bot-cognitive': 'cognition',
  'bot-neuro': 'mobility',
  'bot-mobility': 'daily_living',
  'bot-regulatory': 'education',
};

/** Tính sortedCategories từ thứ tự agent (theo sortOrder), KHÔNG dùng categoryOrder từ system settings.
 *  Đảm bảo sidebar đồng bộ với thứ tự trong AdminPrompts. */
function getSortedCategoriesFromAgents(activeAgents: { botId?: string; sortOrder?: number }[]): ATCategory[] {
  const allCategories = Object.keys(CATEGORY_INFO) as ATCategory[];
  // Map botId → category theo thứ tự sortOrder
  const orderedCats: ATCategory[] = [];
  for (const agent of activeAgents) {
    if (agent.botId && BOT_ID_TO_CATEGORY[agent.botId]) {
      const cat = BOT_ID_TO_CATEGORY[agent.botId];
      if (!orderedCats.includes(cat)) orderedCats.push(cat);
    }
  }
  // Thêm các category còn thiếu (không có agent tương ứng) vào cuối
  for (const cat of allCategories) {
    if (!orderedCats.includes(cat)) orderedCats.push(cat);
  }
  return orderedCats;
}

// Attachment options - use getAttachmentOptions(language) inside component
function getAttachmentOptions(lang: Language) {
  const labels: Record<Language, { addAttachment: string; image: string; imageDesc: string; document: string; video: string; videoDesc: string; audio: string; audioDesc: string; file: string; fileDesc: string; enterUrl: string; urlPlaceholder: string }> = {
    vi: { addAttachment: 'Thêm tệp đính kèm', image: 'Hình ảnh', imageDesc: 'Tải lên hình ảnh', document: 'Tài liệu', video: 'Video', videoDesc: 'Tải lên video', audio: 'Âm thanh', audioDesc: 'Ghi âm hoặc file', file: 'File khác', fileDesc: 'Mọi loại file', enterUrl: 'Nhập link web để AI đọc và phân tích nội dung:', urlPlaceholder: 'https://example.com' },
    en: { addAttachment: 'Add attachment', image: 'Image', imageDesc: 'Upload image', document: 'Document', video: 'Video', videoDesc: 'Upload video', audio: 'Audio', audioDesc: 'Record or file', file: 'Other file', fileDesc: 'All files', enterUrl: 'Enter a web link for AI to read and analyze content:', urlPlaceholder: 'https://example.com' },
    ar: { addAttachment: 'إضافة مرفق', image: 'صورة', imageDesc: 'تحميل صورة', document: 'مستند', video: 'فيديو', videoDesc: 'تحميل فيديو', audio: 'صوت', audioDesc: 'تسجيل أو ملف', file: 'ملف آخر', fileDesc: 'جميع الملفات', enterUrl: 'أدخل رابط ويب لقراءة وتحليل المحتوى:', urlPlaceholder: 'https://example.com' },
    fr: { addAttachment: 'Ajouter une pièce jointe', image: 'Image', imageDesc: 'Télécharger image', document: 'Document', video: 'Vidéo', videoDesc: 'Télécharger vidéo', audio: 'Audio', audioDesc: 'Enregistrer ou fichier', file: 'Autre fichier', fileDesc: 'Tous les fichiers', enterUrl: 'Entrez un lien web pour que l\'IA lise et analyse le contenu:', urlPlaceholder: 'https://example.com' },
  };
  const l = labels[lang] || labels.vi;
  
  return [
    { id: 'image', icon: ImageIcon, label: l.image, accept: 'image/*', description: l.imageDesc },
    { id: 'document', icon: FileText, label: l.document, accept: '.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.md', description: 'PDF, Word, Excel, Text' },
    { id: 'video', icon: Video, label: l.video, accept: 'video/*', description: l.videoDesc },
    { id: 'audio', icon: Mic2, label: l.audio, accept: 'audio/*', description: l.audioDesc },
    { id: 'file', icon: File, label: l.file, accept: '*/*', description: l.fileDesc },
  ];
}

// Sample questions translated by language - Sử dụng SAMPLE_QUESTIONS từ types
function getSampleQuestionsByLang(category: ATCategory, lang: Language): string[] {
  return SAMPLE_QUESTIONS[category]?.end_user?.[lang] || SAMPLE_QUESTIONS[category]?.end_user?.vi || [];
}

// Helper function to get agent display name based on language
// If the agent matches a MADA bot, use nameVi for Vietnamese, nameEn for English, etc.
function getAgentDisplayName(agentId: string, agentName: string, lang: Language): string {
  const madaBot = MADA_BOTS.find(b => b.id === agentId);
  if (madaBot) {
    if (lang === 'vi') return madaBot.nameVi;
    // For en/ar/fr, use English name (no translation available)
    return madaBot.name;
  }
  return agentName;
}

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

// Category Icons
const CATEGORY_ICONS: Record<ATCategory, string> = {
  vision: 'visibility',
  hearing: 'headphones',
  communication: 'record_voice_over',
  cognition: 'psychology',
  mobility: 'accessible_forward',
  daily_living: 'commute',
  education: 'school',
};

const CATEGORY_LABELS: Record<ATCategory, { title: string; titleEn: string; titleAr: string; titleFr: string; desc: string; descEn: string; descAr: string; descFr: string }> = {
  vision: {
    title: 'CẢM GIÁC - THỊ GIÁC',
    titleEn: 'VISION SENSORY',
    titleAr: 'الحواس - البصر',
    titleFr: 'SENS - VISION',
    desc: 'Máy đọc màn hình, phóng to...',
    descEn: 'Screen readers, magnification...',
    descAr: 'قارئات الشاشة، التكبير...',
    descFr: 'Lecteurs d\'écran, loupe...',
  },
  hearing: { 
    title: 'CẢM GIÁC - THÍNH GIÁC', 
    titleEn: 'HEARING SENSORY', 
    titleAr: 'الحواس - السمع',
    titleFr: 'SENS - AUDITION',
    desc: 'Máy trợ thính, thiết bị phản hồi...', 
    descEn: 'Hearing aids, alerting devices...',
    descAr: 'سماعات الأذن، أجهزة التنبيه...',
    descFr: 'Appareils auditifs, dispositifs d\'alerte...',
  },
  communication: { 
    title: 'GIỌNG NÓI VÀ LỜI NÓI', 
    titleEn: 'SPEECH & VOICE', 
    titleAr: 'الكلام والصوت',
    titleFr: 'PAROLE ET VOIX',
    desc: 'Thiết bị giao tiếp tăng cường...', 
    descEn: 'Augmentative communication devices...',
    descAr: 'أجهزة الاتصال المعزز...',
    descFr: 'Dispositifs de communication augmentative...',
  },
  cognition: { 
    title: 'TÂM THẦN - NHẬN THỨC', 
    titleEn: 'COGNITIVE', 
    titleAr: 'الإدراكي والمعرفي',
    titleFr: 'COGNITIF',
    desc: 'Thiết bị hỗ trợ trí nhớ, sắp xếp...', 
    descEn: 'Memory aids, organization tools...',
    descAr: 'أدوات الذاكرة، أدوات التنظيم...',
    descFr: 'Aides à la mémoire, outils d\'organisation...',
  },
  mobility: { 
    title: 'VẬN ĐỘNG THẦN KINH', 
    titleEn: 'NEUROMUSCULAR', 
    titleAr: 'العضلات والعصبية',
    titleFr: 'NEUROMUSCULAIRE',
    desc: 'Nẹp chỉnh hình, bàn phím thay thế...', 
    descEn: 'Orthoses, alternative keyboards...',
    descAr: 'الأطراف الصناعية، لوحات المفاتيح البديلة...',
    descFr: 'Orthèses, claviers alternatifs...',
  },
  daily_living: { 
    title: 'DI CHUYỂN VÀ GIAO THÔNG', 
    titleEn: 'MOBILITY', 
    titleAr: 'التنقل والحركة',
    titleFr: 'MOBILITÉ',
    desc: 'Xe lăn thông minh, cải tiến...', 
    descEn: 'Smart wheelchairs, improvements...',
    descAr: 'الكراسي المتحركة الذكية، التحسينات...',
    descFr: 'Fauteuils roulants intelligents, améliorations...',
  },
  education: { 
    title: 'THÔNG TIN BỔ TRỢ', 
    titleEn: 'EDUCATION', 
    titleAr: 'التعليم',
    titleFr: 'ÉDUCATION',
    desc: 'Tiêu chuẩn Công nghệ hỗ trợ...', 
    descEn: 'Assistive Technology standards...',
    descAr: 'معايير تقنية المساعدة...',
    descFr: 'Normes de technologie d\'assistance...',
  },
};

// Generate follow-up questions based on user's question and AI's response
function generateFollowUpQuestions(userQuestion: string, _aiResponse: string, language: Language): string[] {
  const q = userQuestion.toLowerCase();
  
  // Detect topic keywords
  const isVision = q.includes('thị') || q.includes('mù') || q.includes('blind') || q.includes('vision') || q.includes('nhìn') || q.includes('mắt') || q.includes('scree') || q.includes('braille');
  const isHearing = q.includes('thính') || q.includes('tai') || q.includes('nghe') || q.includes('hearing') || q.includes('máy trợ thính') || q.includes('hearing aid');
  const isMobility = q.includes('wheelchair') || q.includes('xe lăn') || q.includes('mobility') || q.includes('vận động') || q.includes('di chuyển') || q.includes('prosthetic') || q.includes('chân');
  const isCognition = q.includes('nhận thức') || q.includes('trí nhớ') || q.includes('cognition') || q.includes('memory') || q.includes('mất') || q.includes('注意力') || q.includes('autism') || q.includes('tự kỷ');
  const isCommunication = q.includes('giao tiếp') || q.includes('nói') || q.includes('speech') || q.includes('communication') || q.includes('aac') || q.includes('giọng');
  const isPrice = q.includes('giá') || q.includes('price') || q.includes('cost') || q.includes('bao nhiêu') || q.includes('mua') || q.includes('tiền');
  const isChild = q.includes('trẻ') || q.includes('child') || q.includes('kid') || q.includes('em bé') || q.includes('student') || q.includes('học sinh');
  const isElderly = q.includes('già') || q.includes('old') || q.includes('elderly') || q.includes('người lớn tuổi') || q.includes('senior');
  
  // Follow-up templates by language and topic
  if (language === 'vi') {
    const base = [];
    
    // Price-related follow-ups
    if (isPrice) {
      base.push('Mua thiết bị này ở đâu?');
      base.push('Có chương trình hỗ trợ tài chính không?');
      base.push('Bảo hành bao lâu?');
    }
    
    // For hearing
    if (isHearing) {
      base.push('Máy trợ thính có kết nối Bluetooth không?');
      base.push('Có thể dùng cho trẻ em không?');
      base.push('Cách vệ sinh máy trợ thính?');
      if (isPrice) base.push('Có loại rẻ hơn không?');
      if (isElderly) base.push('Người già sử dụng có khó không?');
    }

    
    // For mobility
    if (isMobility) {
      base.push('Xe lăn điện có bảo hành không?');
      base.push('Sạc pin xe lăn điện mất bao lâu?');
      base.push('Có thể mang xe lăn lên máy bay không?');
      if (isChild) base.push('Trẻ em có dùng được xe lăn điện không?');
    }
    
    // For cognition
    if (isCognition) {
      base.push('Có ứng dụng hỗ trợ trí nhớ không?');
      base.push('Thiết bị cho người tự kỷ?');
      base.push('Có công cụ sắp xếp công việc không?');
      if (isChild) base.push('Thiết bị hỗ trợ học tập cho trẻ ADHD?');
    }
    
    // For communication
    if (isCommunication) {
      base.push('Ứng dụng giao tiếp cho người không nói được?');
      base.push('Thiết bị AAC giá bao nhiêu?');
      base.push('Có app miễn phí không?');
    }
    
    // Default follow-ups
    if (base.length < 3) {
      base.push('Thiết bị này có dễ sử dụng không?');
      base.push('Có thể dùng thử trước khi mua không?');
      base.push('Địa chỉ mua thiết bị uy tín ở đâu?');
    }
    
    // Shuffle and return 4 questions
    return base.sort(() => Math.random() - 0.5).slice(0, 4);
  }
  
  // English follow-ups
  if (language === 'en') {
    const base = [];
    
    if (isPrice) {
      base.push('Where can I buy this device?');
      base.push('Is there financial assistance available?');
      base.push('What is the warranty period?');
    }
    
    if (isHearing) {
      base.push('Do hearing aids connect to Bluetooth?');
      base.push('Can children use hearing aids?');
      base.push('How to clean hearing aids?');
      if (isElderly) base.push('Is it easy for elderly to use?');
    }
    
    if (isVision) {
      base.push('What is the best screen reader?');
      base.push('How much does a Braille display cost?');
      base.push('Are there text-to-speech apps for blind people?');
      if (isChild) base.push('What devices are recommended for blind children?');
    }
    
    if (isMobility) {
      base.push('Do electric wheelchairs have warranty?');
      base.push('How long does it take to charge?');
      base.push('Can I bring a wheelchair on a plane?');
    }
    
    if (isCognition) {
      base.push('Are there memory support apps?');
      base.push('Devices for people with autism?');
      base.push('Task organization tools?');
    }
    
    if (isCommunication) {
      base.push('AAC apps for non-verbal people?');
      base.push('How much do AAC devices cost?');
      base.push('Are there free apps available?');
    }
    
    if (base.length < 3) {
      base.push('Is this device easy to use?');
      base.push('Can I try before buying?');
      base.push('Where to buy from reputable sources?');
    }
    
    return base.sort(() => Math.random() - 0.5).slice(0, 4);
  }
  
  // Arabic follow-ups
  if (language === 'ar') {
    return [
      'هل يمكنني تجربته قبل الشراء؟',
      'أين أشتري من مصادر موثوقة؟',
      'ما هي مدة الضمان؟',
      'هل تتوفر مساعدة مالية؟',
    ].slice(0, 4);
  }
  
  // French follow-ups
  return [
    'Ce dispositif est-il facile à utiliser?',
    'Puis-je l\'essayer avant d\'acheter?',
    'Où acheter auprès de sources fiables?',
    'Quelle est la période de garantie?',
  ].slice(0, 4);
}

// Detect category từ câu hỏi
function detectCategoryFromQuery(query: string): string {
  const q = query.toLowerCase();
  
  // Mobility - xe lăn, vận động
  if (/\b(xe lăn|wheelchair|nạng|crutch|gậy|nẹp|chỉnh hình|prosthetic|mobility|vận động|leo cầu thang|stair|cane)\b/i.test(q)) {
    return 'mobility';
  }
  // Hearing - tai, điếc
  if (/\b(tai|điếc|deaf|hearing|trợ thính|hearing aid|cochlear|fm system|roger|cap|caption|tinnitus)\b/i.test(q)) {
    return 'hearing';
  }
  // Communication - giao tiếp, AAC
  if (/\b(giao tiếp|communication|aac|sgd|sign language|ngôn ngữ ký hiệu|nói|speech|voice|apraxia)\b/i.test(q)) {
    return 'communication';
  }
  // Cognition - nhận thức, trí nhớ
  if (/\b(trí nhớ|memory|nhận thức|cognition|dyslexia|autism|tự kỷ|adhd|tbi|alzheimer|dementia|symbol)\b/i.test(q)) {
    return 'cognition';
  }
  // Daily living - sinh hoạt, ăn uống
  if (/\b(ăn uống|eating|daily|sinh hoạt|nhà tắm|bathroom|nhà bếp|kitchen|grab bar|utensil|medication|thuốc)\b/i.test(q)) {
    return 'daily_living';
  }
  // Education - học tập, giáo dục
  if (/\b(học|education|school|trường|đọc|reading|writing|tiếng anh|english|dyslexia|udl|wcag)\b/i.test(q)) {
    return 'education';
  }
  
  return 'general';
}

interface Message {
  id: string;
  role: string;
  content: string;
  confidence?: number;
  products?: unknown[];
  standards?: string[];
  feedback?: 'like' | 'dislike';
  isStreaming?: boolean;
  sources?: { content: string; source: string; metadata?: Record<string, unknown> }[];
  contextUsed?: boolean;
  attachments?: { name: string; type: string; preview?: string }[];
  suggestedProducts?: SuggestedProduct[];
}

// Sidebar conversation shape sourced from `useChatHistoryStore` (HistoryConversation)

// Consultation Modal Types & Data
interface ConsultationFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
  attachments?: { name: string; type: string; size: number; base64?: string }[];
}

// Consultation Modal Component - Simplified: Name, Email, Phone, Description + File attachment
function ConsultationModal({ 
  isOpen, 
  onClose,
  onSubmit,
  language = 'vi' as Language
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSubmit: (data: ConsultationFormData) => void;
  language?: Language;
}): JSX.Element | null {
  const [formData, setFormData] = useState<ConsultationFormData>({
    name: '', email: '', phone: '', message: '', attachments: []
  });
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; size: number; base64?: string; preview?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Translations for form labels
  const labels = {
    vi: {
      title: 'Yêu cầu Tư vấn Chuyên gia',
      subtitle: 'MADA Center, Doha, Qatar',
      personalInfo: 'THÔNG TIN CÁ NHÂN',
      fullName: 'Họ và tên',
      fullNamePlaceholder: 'Nguyễn Văn A',
      email: 'Email',
      emailPlaceholder: 'email@example.com',
      phone: 'Điện thoại',
      phonePlaceholder: '+974 1234 5678',
      description: 'MÔ TẢ NHU CẦU',
      descriptionPlaceholder: 'Mô tả chi tiết tình trạng và nhu cầu về thiết bị công nghệ hỗ trợ...',
      attachment: 'Đính kèm tệp',
      attachmentHint: 'Hình ảnh, tài liệu, video...',
      submit: 'GỬI YÊU CẦU',
      cancel: 'Hủy',
      sending: 'Đang gửi...',
      errorName: 'Vui lòng nhập họ tên',
      errorEmail: 'Vui lòng nhập email hợp lệ',
      errorMessage: 'Vui lòng nhập mô tả nhu cầu',
    },
    en: {
      title: 'AT Expert Consultation Request',
      subtitle: 'MADA Center, Doha, Qatar',
      personalInfo: 'PERSONAL INFORMATION',
      fullName: 'Full Name',
      fullNamePlaceholder: 'John Smith',
      email: 'Email',
      emailPlaceholder: 'email@example.com',
      phone: 'Phone Number',
      phonePlaceholder: '+974 1234 5678',
      description: 'NEEDS DESCRIPTION',
      descriptionPlaceholder: 'Describe your situation and assistive technology needs in detail...',
      attachment: 'Attach Files',
      attachmentHint: 'Images, documents, videos...',
      submit: 'SUBMIT REQUEST',
      cancel: 'Cancel',
      sending: 'Sending...',
      errorName: 'Please enter your name',
      errorEmail: 'Please enter a valid email',
      errorMessage: 'Please describe your needs',
    },
    ar: {
      title: 'طلب استشارة خبير AT',
      subtitle: 'مركز MADA، الدوحة، قطر',
      personalInfo: 'المعلومات الشخصية',
      fullName: 'الاسم الكامل',
      fullNamePlaceholder: 'أحمد محمد',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'email@example.com',
      phone: 'رقم الهاتف',
      phonePlaceholder: '+974 1234 5678',
      description: 'وصف الاحتياجات',
      descriptionPlaceholder: 'صف وضعك واحتياجاتك من التكنولوجيا المساعدة بالتفصيل...',
      attachment: 'إرفاق ملفات',
      attachmentHint: 'صور، مستندات، فيديوهات...',
      submit: 'إرسال الطلب',
      cancel: 'إلغاء',
      sending: 'جارٍ الإرسال...',
      errorName: 'الرجاء إدخال الاسم',
      errorEmail: 'الرجاء إدخال بريد إلكتروني صالح',
      errorMessage: 'الرجاء وصف احتياجاتك',
    },
    fr: {
      title: 'Demande de consultation AT',
      subtitle: 'Centre MADA, Doha, Qatar',
      personalInfo: 'INFORMATIONS PERSONNELLES',
      fullName: 'Nom complet',
      fullNamePlaceholder: 'Jean Dupont',
      email: 'Email',
      emailPlaceholder: 'email@example.com',
      phone: 'Téléphone',
      phonePlaceholder: '+974 1234 5678',
      description: 'DESCRIPTION DES BESOINS',
      descriptionPlaceholder: 'Décrivez votre situation et vos besoins en technologie d\'assistance en détail...',
      attachment: 'Joindre des fichiers',
      attachmentHint: 'Images, documents, vidéos...',
      submit: 'ENVOYER LA DEMANDE',
      cancel: 'Annuler',
      sending: 'Envoi en cours...',
      errorName: 'Veuillez entrer votre nom',
      errorEmail: 'Veuillez entrer un email valide',
      errorMessage: 'Veuillez décrire vos besoins',
    },
  };
  const l = labels[language] || labels.vi;
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = l.errorName;
    if (!formData.email.trim()) newErrors.email = l.errorEmail;
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = l.errorEmail;
    if (!formData.message.trim()) newErrors.message = l.errorMessage;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const MAX_FILES = 3;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file
    
    for (let i = 0; i < Math.min(files.length, MAX_FILES); i++) {
      const file = files[i];
      
      if (file.size > MAX_SIZE) {
        alert(`${file.name} exceeds 10MB limit`);
        continue;
      }
      
      // Convert to base64 for sending
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      
      setSelectedFiles(prev => [...prev, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
        preview: file.type.startsWith('image/') ? base64 : undefined,
      }]);
    }
    
    // Reset input
    e.target.value = '';
  };
  
  // Remove file
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          attachments: selectedFiles.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            base64: f.base64,
          })),
          timestamp: new Date().toISOString(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSubmit(formData);
        setFormData({ name: '', email: '', phone: '', message: '', attachments: [] });
        setSelectedFiles([]);
        onClose();
      } else {
        alert(data.error || 'Failed to submit consultation request');
      }
    } catch (error) {
      console.error('Consultation submit error:', error);
      onSubmit(formData);
      setFormData({ name: '', email: '', phone: '', message: '', attachments: [] });
      setSelectedFiles([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-lg rounded-xl border-2 border-slate-800 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden animate-modal-in max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-white p-4 md:p-5 flex items-start justify-between relative overflow-hidden flex-shrink-0 border-b-2 border-slate-100">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-white to-blue-50/50" />
          
          {/* Left: Logo + Branding */}
          <div className="relative z-10 flex gap-3 items-center">
            <img 
              src="/mada-logo.png" 
              alt="MADA" 
              className="h-12 md:h-14 w-auto object-contain drop-shadow-sm"
            />
            <div className="w-px h-10 bg-slate-200 hidden md:block" />
            <div>
              <h1 className="text-sm md:text-base font-bold text-slate-800 leading-tight">
                {l.title}
              </h1>
              <p className="text-[10px] md:text-xs text-secondary/70 mt-0.5 font-medium">{l.subtitle}</p>
            </div>
          </div>
          
          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="relative z-10 w-8 h-8 rounded-full border-2 border-slate-200 text-slate-400 hover:bg-secondary hover:border-secondary hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 md:p-5 bg-slate-50 space-y-4 overflow-y-auto flex-1">
          
          {/* Section 1: Personal Information */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {l.personalInfo}
            </h2>
            
            {/* Full Name */}
            <div className="relative">
              <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{l.fullName} *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                className={`w-full h-11 px-4 rounded-full border-2 font-medium transition-colors focus:outline-none text-sm ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                placeholder={l.fullNamePlaceholder}
              />
              {errors.name && <p className="text-[10px] text-red-500 mt-1 pl-4">{errors.name}</p>}
            </div>
            
            {/* Email */}
            <div className="relative">
              <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{l.email} *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                className={`w-full h-11 px-4 rounded-full border-2 font-medium transition-colors focus:outline-none text-sm ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                placeholder={l.emailPlaceholder}
              />
              {errors.email && <p className="text-[10px] text-red-500 mt-1 pl-4">{errors.email}</p>}
            </div>
            
            {/* Phone */}
            <div className="relative">
              <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{l.phone}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-11 px-4 rounded-full border-2 border-slate-300 font-medium transition-colors focus:outline-none focus:border-secondary focus:ring-0 text-sm"
                placeholder={l.phonePlaceholder}
              />
            </div>
          </section>

          {/* Section 2: Needs Description */}
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> {l.description}
            </h2>
            <div className="relative">
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) => { setFormData({ ...formData, message: e.target.value }); setErrors({ ...errors, message: '' }); }}
                className={`w-full px-4 py-3 rounded-xl border-2 font-medium transition-colors resize-none focus:outline-none text-sm ${errors.message ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                placeholder={l.descriptionPlaceholder}
              />
              {errors.message && <p className="text-[10px] text-red-500 mt-1">{errors.message}</p>}
            </div>
          </section>

          {/* Section 3: File Attachment */}
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <File className="w-3.5 h-3.5" /> {l.attachment}
            </h2>
            
            {/* File Input */}
            <div className="relative">
              <input
                type="file"
                id="consultation-file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="consultation-file"
                className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-secondary hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{l.attachmentHint}</span>
              </label>
            </div>
            
            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200"
                  >
                    {file.preview ? (
                      <img src={file.preview} alt={file.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <File className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </form>

        {/* Footer */}
        <div className="p-4 bg-white border-t-2 border-slate-800 flex flex-col sm:flex-row justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full border-2 border-slate-800 font-bold text-xs text-slate-800 bg-white hover:bg-slate-100 transition-colors"
          >
            {l.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-full border-2 border-slate-800 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {l.sending}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {l.submit}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ⭐ Product Image Component - xử lý lỗi ảnh đúng cách (tránh vi phạm Rules of Hooks)
// (reserved for future product image feature)
function ProductImage({ 
  imageUrl, 
  alt 
}: { 
  imageUrl: string | null | undefined; 
  alt: string;
}) {
  const [useHasError, setUseHasError] = useState(false);
  
  const src = getImageUrl(imageUrl);
  
  if (!src || useHasError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
        <Accessibility className="w-10 h-10" />
      </div>
    );
  }
  
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        console.warn('[ProductImage] Image failed to load:', src);
        setUseHasError(true);
      }}
    />
  );
}

// Product Card Component

export function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, setLanguage } = useLanguageStore();
  const { messages, addMessage, clearMessages, isLoading, setLoading, setMessages } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const authModal = useAuthModalStore();

  // Chat settings from admin
  const { greeting, description, suggestedPrompts, fileAttachmentEnabled, showSuggestedQuestions, loadFromBackend: loadChatSettings } = useChatSettingsStore();

  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isBotsCollapsed, setIsBotsCollapsed] = useState(false); // Kept for potential future use
  const [isRecording, setIsRecording] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ fileId: string; name: string; type: string; size: number; content?: string; originalFile?: File; isLoading?: boolean; isCancelling?: boolean }[]>([]);
   
  const [_cancellingFiles, setCancellingFiles] = useState<Set<string>>(new Set());
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

  // ⭐ File upload quota state (theo plan + tháng)
  const [fileQuota, setFileQuota] = useState<FileUploadQuota | null>(null);
  const fetchFileQuota = useCallback(async () => {
    if (!user) {
      setFileQuota(null);
      return;
    }
    const res = await fileQuotaApi.getMyQuota();
    if (res.success) setFileQuota(res.data);
  }, [user]);
  // Fetch quota khi user thay đổi (login/logout)
  useEffect(() => {
    fetchFileQuota();
  }, [fetchFileQuota]);

  // ⭐ Sync agents from backend on mount + when window regains focus (STAGGERED to avoid 429)
  const loadAgents = useAgentStore((s) => s.loadAgents);
  
  // Helper: Map backend agent to frontend format (reused for direct API calls)
  const mapBackendAgent = (a: any) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    avatar: a.avatar || '🤖',
    systemPrompt: a.system_prompt || a.systemPrompt || '',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
    isActive: a.isActive === true || a.is_active === 1,
    createdBy: (a.created_by === 'admin' || a.createdBy === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    createdAt: a.createdAt ? new Date(a.createdAt).getTime()
      : a.created_at ? new Date(a.created_at).getTime()
      : Date.now(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt).getTime()
      : a.updated_at ? new Date(a.updated_at).getTime()
      : Date.now(),
    madaCategory: a.mada_category || a.madaCategory,
    botId: a.bot_id || a.botId,
    promptId: a.promptId || a.prompt_id || undefined,
    avatarUrl: a.avatar_url || a.avatarUrl,
    knowledgeUrl: a.knowledge_url || a.knowledgeUrl,
    productUrl: a.product_url || a.productUrl,
    sortOrder: a.sort_order ?? a.sortOrder ?? 0,
  });
  
  // Helper: Fetch agents directly from API and update store
  const fetchAgentsDirectly = useCallback(() => {
    // Xóa cache trước khi fetch
    try {
      const storageKey = 'mada-agents';
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((parsed.state?.agents && parsed.state.agents.length > 0) || parsed.state?.lastSynced) {
          console.log('[ChatPage] 🔄 Clearing cache before direct fetch...');
          const newState = { ...parsed, state: { ...parsed.state, agents: [], lastSynced: null } };
          localStorage.setItem(storageKey, JSON.stringify(newState));
        }
      }
    } catch (_) {}
    
    // Xóa store state TRƯỚC KHI gọi API để tránh persist rehydrate ghi đè
    useAgentStore.setState({ agents: [], lastSynced: null });
    
    return fetch('/api/public/agents')
      .then(res => res.json())
      .then((data: { success: boolean; data: unknown[] }) => {
        if (data.success && Array.isArray(data.data)) {
          const freshAgents = data.data.map((item: unknown) => mapBackendAgent(item));
          console.log('[ChatPage] ✅ Agents fetched directly:', freshAgents.length, 'active:', freshAgents.filter(a => a.isActive).length);
          freshAgents.forEach((a, i) => console.log(`  [${i}] "${a.name}" isActive=${a.isActive}`));
          useAgentStore.setState({
            agents: freshAgents,
            lastSynced: Date.now(),
            backendConnected: true,
            isLoading: false,
            isSyncing: false,
          });
        }
      })
      .catch(err => {
        console.error('[ChatPage] ❌ Direct fetch failed:', err);
        // Fallback to loadAgents
        loadAgents();
      });
  }, [loadAgents]);

  useEffect(() => {
    // ⭐ Stagger delay to avoid 429 rate limiting on initial load
    const timer = setTimeout(() => {
      console.log('[ChatPage] Loading agents from backend (direct)...');
      fetchAgentsDirectly();
    }, 200); // 200ms delay to avoid initial burst
    
    const onFocus = () => {
      console.log('[ChatPage] Window focus - reloading agents...');
      fetchAgentsDirectly();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchAgentsDirectly]);

  // ⭐ Sync system settings (categoryOrder) from backend on mount + when window regains focus (STAGGERED)
  const loadSystemSettings = useSystemSettingsStore((s) => s.loadFromBackend);
  useEffect(() => {
    // ⭐ Stagger delay to avoid 429
    const timer = setTimeout(() => {
      console.log('[ChatPage] Loading system settings from backend...');
      loadSystemSettings().then(() => {
        console.log('[ChatPage] System settings loaded, categoryOrder:', useSystemSettingsStore.getState().categoryOrder);
      }).catch((err) => {
        console.error('[ChatPage] Failed to load system settings:', err);
      });
    }, 100); // 100ms delay
    const onFocus = () => {
      console.log('[ChatPage] Window focus - reloading system settings...');
      loadSystemSettings();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadSystemSettings]);

  // ⭐ Fetch custom questions from API on mount - ONE REQUEST for all categories (STAGGERED)
  useEffect(() => {
    const controller = new AbortController();
    
    // ⭐ Stagger delay to avoid 429 on initial load
    const timer = setTimeout(async () => {
      try {
        const res = await staggeredFetch(
          `/api/admin/suggested-questions?view_mode=end_user&language=${language}&is_active=true`,
          0, // no initial delay since we have setTimeout
          2  // 2 retries for 429
        );
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          // Group questions by category, take only 4 per category
          const grouped: Record<string, string[]> = {};
          const categories: ATCategory[] = ['vision', 'hearing', 'mobility', 'cognition', 'communication', 'daily_living', 'education'];
          categories.forEach(cat => grouped[cat] = []);
          
          data.data.forEach((q: any) => {
            if (q.category && grouped[q.category] && grouped[q.category].length < 4) {
              grouped[q.category].push(q.question);
            }
          });
          
          setCustomQuestions(grouped);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('[ChatPage] Failed to fetch custom questions:', err);
        }
      }
    }, 150); // 150ms delay
    
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [language]);

  // ⭐ Load conversation from URL session parameter
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      console.log('[ChatPage] Loading session from URL:', sessionId);
      // Set the active conversation ID to load from URL
      setActiveConversationId(sessionId);
      // Load messages for this session (synchronous)
      const msgs = getMessagesForConversation(sessionId);
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      }
    }
  }, [searchParams]);

  // ⭐ Lắng nghe broadcast từ AdminAgents - cập nhật agents ngay khi admin thêm/sửa/xóa bot
  useEffect(() => {
    const cleanup = onAgentChange((event) => {
      const agentId = 'agentId' in event ? event.agentId : ('agentIds' in event ? event.agentIds?.join(',') : '');
      console.log('[ChatPage] 📡 Received agent change broadcast:', event.type, agentId || '');

      // ⭐ Xử lý thay đổi category order (từ AdminSettings)
      if (event.type === 'category-order-changed') {
        console.log('[ChatPage] 🔄 Category order changed, reloading system settings...');
        useSystemSettingsStore.getState().loadFromBackend();
        return;
      }

      // ⭐ Xử lý thay đổi questions
      if (event.type === 'questions-changed') {
        const catsToFetch: ATCategory[] = event.category ? [event.category as ATCategory] : ['vision', 'hearing', 'mobility', 'cognition', 'communication', 'daily_living', 'education'];
        
        staggeredFetch(`/api/admin/suggested-questions?view_mode=end_user&language=${language}&is_active=true`, 0, 2)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              const grouped: Record<string, string[]> = {};
              catsToFetch.forEach(cat => grouped[cat] = []);
              data.data.forEach((q: any) => {
                if (q.category && grouped[q.category] && grouped[q.category].length < 4) {
                  grouped[q.category].push(q.question);
                }
              });
              setCustomQuestions(grouped);
            }
          })
          .catch(err => console.error('[ChatPage] Failed to fetch questions on broadcast:', err));
        return;
      }

      // ⭐ Reload agents ngay lập tức khi có thay đổi từ Admin (bao gồm agent-toggled)
      // Dùng getState() để đảm bảo luôn gọi đúng phiên bản mới nhất của loadAgents
      // ⭐ Xóa cache localStorage TRƯỚC khi reload để đảm bảo không dùng dữ liệu cũ
      
      // Helper: Map backend agent to frontend format
      const mapBackendAgent = (a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description || '',
        avatar: a.avatar || '🤖',
        systemPrompt: a.system_prompt || a.systemPrompt || '',
        capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
        isActive: a.isActive === true || a.is_active === 1,
        createdBy: (a.created_by === 'admin' || a.createdBy === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        createdAt: a.createdAt ? new Date(a.createdAt).getTime()
          : a.created_at ? new Date(a.created_at).getTime()
          : Date.now(),
        updatedAt: a.updatedAt ? new Date(a.updatedAt).getTime()
          : a.updated_at ? new Date(a.updated_at).getTime()
          : Date.now(),
        madaCategory: a.mada_category || a.madaCategory,
        botId: a.bot_id || a.botId,
        promptId: a.promptId || a.prompt_id || undefined,
        avatarUrl: a.avatar_url || a.avatarUrl,
        knowledgeUrl: a.knowledge_url || a.knowledgeUrl,
        productUrl: a.product_url || a.productUrl,
        sortOrder: a.sort_order ?? a.sortOrder ?? 0,
      });
      
      const clearCache = () => {
        try {
          const storageKey = 'mada-agents';
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            // Xóa agents cũ trong persist storage để force fetch từ API
            // Luôn xóa nếu có data (kể cả agents rỗng) để đảm bảo fresh fetch
            if (parsed.state?.agents !== undefined || parsed.state?.lastSynced) {
              console.log('[ChatPage] 🔄 Clearing localStorage cache before broadcast reload...');
              const newState = { ...parsed, state: { ...parsed.state, agents: [], lastSynced: null } };
              localStorage.setItem(storageKey, JSON.stringify(newState));
            }
          }
        } catch (_) {}
        // Xóa trong store hiện tại TRƯỚC KHI gọi API để tránh persist rehydrate ghi đè
        useAgentStore.setState({ agents: [], lastSynced: null });
      };
      clearCache();

      // Gọi API trực tiếp thay vì qua loadAgents() để tránh race condition với persist
      console.log('[ChatPage] 🔄 Fetching agents directly from /public/agents...');
      fetch('/api/public/agents')
        .then(res => res.json())
        .then((fetchData: { success: boolean; data: unknown[] }) => {
          if (fetchData.success && Array.isArray(fetchData.data)) {
            const freshAgents = fetchData.data.map((item: unknown) => mapBackendAgent(item));
            console.log('[ChatPage] ✅ Fresh agents fetched:', freshAgents.length, 'active:', freshAgents.filter(a => a.isActive).length);
            // Cập nhật store trực tiếp với dữ liệu mới
            useAgentStore.setState({
              agents: freshAgents,
              lastSynced: Date.now(),
              backendConnected: true,
              isLoading: false,
              isSyncing: false,
            });
          }
        })
        .catch(err => {
          console.error('[ChatPage] ❌ Failed to fetch agents:', err);
          // Fallback: gọi loadAgents nếu fetch trực tiếp thất bại
          useAgentStore.getState().loadAgents();
        });
    });
    return cleanup;
  }, [language]);

  // Load chat settings from backend on mount (STAGGERED to avoid 429)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadChatSettings();
    }, 50); // Small delay
    return () => clearTimeout(timer);
  }, [loadChatSettings]);

  // ⭐ Lắng nghe broadcast từ Admin - cập nhật settings ngay khi admin thay đổi
  useEffect(() => {
    const cleanup = onSettingsChange((event) => {
      console.log('[ChatPage] 📡 Received settings change broadcast:', event.type, event);
      // Reload settings ngay lập tức khi có thay đổi từ Admin
      loadChatSettings();
    });
    return cleanup;
  }, [loadChatSettings]);

  const fileQuotaExhausted = !!fileQuota && fileQuota.limit !== -1 && fileQuota.remaining <= 0;
  const [activeCategory, setActiveCategory] = useState<ATCategory | null>(null);
   
  const [_suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ⭐ Custom Questions from API (AdminPrompts synced)
  const [customQuestions, setCustomQuestions] = useState<Record<string, string[]>>({});

  // ⭐ AT Specialist Suggestion State
  const [showATSuggestion, setShowATSuggestion] = useState(false);

  // ⭐ Smart Product Suggestion State - Theo dõi conversation depth và user context
  const [conversationTurns, setConversationTurns] = useState(0); // Số lượt hỏi-đáp
  const [userContextCollected, setUserContextCollected] = useState({
    hasSymptom: false,     // Mô tả triệu chứng/tình trạng
    hasBudget: false,      // Ngân sách/giá cả
    hasConstraint: false,  // Ràng buộc (độ tuổi, môi trường...)
    hasGoal: false,       // Mục tiêu sử dụng
    hasDeviceType: false,  // Loại thiết bị quan tâm
    hasDuration: false,    // Thời gian xảy ra
    hasSeverity: false,    // Mức độ nghiêm trọng
    hasPreviousTry: false, // Đã thử sản phẩm gì chưa
  });
  
  // ⭐ Tính Maturity Score (0-100) - được giữ lại cho tương lai nếu cần
  const _getMaturityScore = useCallback(() => {
    let score = 0;
    const ctx = userContextCollected;
    
    // Triệu chứng: 40 điểm (quan trọng nhất)
    if (ctx.hasSymptom) score += 40;
    
    // Mức độ nghiêm trọng: 15 điểm
    if (ctx.hasSeverity) score += 15;
    
    // Thời gian: 10 điểm
    if (ctx.hasDuration) score += 10;
    
    // Ràng buộc: 10 điểm
    if (ctx.hasConstraint) score += 10;
    
    // Mục tiêu: 10 điểm
    if (ctx.hasGoal) score += 10;
    
    // Loại thiết bị quan tâm: 5 điểm
    if (ctx.hasDeviceType) score += 5;
    
    // Ngân sách: 5 điểm
    if (ctx.hasBudget) score += 5;
    
    // Đã thử sản phẩm: 5 điểm
    if (ctx.hasPreviousTry) score += 5;
    
    return Math.min(score, 100);
  }, [userContextCollected]);
  void _getMaturityScore;
  const _REQUIRED_CONTEXT_FIELDS = {
    hasSymptom: 'Mô tả triệu chứng/tình trạng hiện tại',
    hasSeverity: 'Mức độ nghiêm trọng (nhẹ/vừa/nặng)',
    hasDuration: 'Thời gian xảy ra vấn đề',
  };
  
  const _OPTIONAL_CONTEXT_FIELDS = {
    hasBudget: 'Ngân sách/chi phí dự kiến',
    hasConstraint: 'Độ tuổi/môi trường sử dụng',
    hasGoal: 'Mục tiêu sử dụng thiết bị',
    hasDeviceType: 'Loại thiết bị quan tâm',
    hasPreviousTry: 'Đã thử sản phẩm nào trước đó chưa',
  };

  // ⭐ Kiểm tra có đủ điều kiện gợi ý sản phẩm không
  // YÊU CẦU: Phải khai thác đủ TẤT CẢ required context (triệu chứng + mức độ + thời gian)
  // HOẶC conversationTurns >= 5 (backup - để đảm bảo bot đã hỏi nhiều rồi)
  const isReadyForProductSuggestion = useMemo(() => {
    // Kiểm tra từng required field
    const hasRequiredSymptom = userContextCollected.hasSymptom;
    const hasRequiredSeverity = userContextCollected.hasSeverity;
    const hasRequiredDuration = userContextCollected.hasDuration;
    
    // Đủ 3 required fields → show sản phẩm
    if (hasRequiredSymptom && hasRequiredSeverity && hasRequiredDuration) {
      return true;
    }
    
    // Backup: >= 5 lượt hỏi đáp (bot đã hỏi nhiều, giả sử đã khai thác đủ)
    if (conversationTurns >= 5) {
      return true;
    }
    
    return false;
  }, [userContextCollected, conversationTurns]);
  
  // ⭐ Lấy danh sách context còn thiếu (để bot hỏi thêm)
  const getMissingContext = useMemo(() => {
    const missing: string[] = [];
    
    // Ưu tiên theo thứ tự: triệu chứng → mức độ → thời gian → bổ sung
    if (!userContextCollected.hasSymptom) missing.push('symptom');
    if (!userContextCollected.hasSeverity) missing.push('severity');
    if (!userContextCollected.hasDuration) missing.push('duration');
    if (!userContextCollected.hasBudget) missing.push('budget');
    if (!userContextCollected.hasConstraint) missing.push('constraint');
    if (!userContextCollected.hasGoal) missing.push('goal');
    if (!userContextCollected.hasPreviousTry) missing.push('previousTry');
    
    return missing;
  }, [userContextCollected]);
  
  // ⭐ Tạo câu hỏi follow-up dựa trên context còn thiếu
  // Bot sẽ hỏi TỪNG câu một, không hỏi tất cả cùng lúc
  const getNextFollowUpQuestion = useCallback((lang: Language): string => {
    const missing = getMissingContext;
    if (missing.length === 0) return '';
    
    const questionsByLang: Record<Language, Record<string, string[]>> = {
      vi: {
        symptom: ['Bạn có thể mô tả rõ hơn về triệu chứng/tình trạng của mình không?', 'Biểu hiện cụ thể như thế nào vậy?', 'Bạn gặp vấn đề này ra sao?'],
        severity: ['Mức độ ảnh hưởng như thế nào? (nhẹ, vừa, hay nặng)', 'Tình trạng này có nghiêm trọng không?', 'Độ khó khăn ra sao?'],
        duration: ['Tình trạng này kéo dài bao lâu rồi?', 'Bạn gặp vấn đề này từ khi nào?', 'Đã bao lâu chưa?'],
        budget: ['Bạn có dự kiến ngân sách bao nhiêu cho thiết bị này?', 'Khoảng giá nào phù hợp với bạn?'],
        constraint: ['Bạn bao nhiêu tuổi? / Thiết bị dùng ở đâu (nhà, văn phòng, trường học)?'],
        goal: ['Mục tiêu chính khi sử dụng thiết bị là gì?', 'Bạn muốn đạt được điều gì với thiết bị này?'],
        previousTry: ['Bạn đã thử sử dụng thiết bị nào chưa?', 'Trước đây có dùng sản phẩm tương tự chưa?'],
      },
      en: {
        symptom: ['Could you describe your symptoms in more detail?', 'What specific symptoms are you experiencing?'],
        severity: ['How severe is your condition? (mild, moderate, or severe)', 'How much does it affect your daily life?'],
        duration: ['How long have you been experiencing this?', 'When did this problem start?'],
        budget: ['Do you have a budget in mind for this device?', 'What price range would work for you?'],
        constraint: ['How old is the user? / Where will the device be used (home, office, school)?'],
        goal: ['What is your main goal with this device?', 'What do you want to achieve with this device?'],
        previousTry: ['Have you tried any similar devices before?', 'Have you used any products for this before?'],
      },
      ar: {
        symptom: ['هل يمكنك وصف أعراضك بمزيد من التفصيل؟', 'ما هي الأعراض المحددة التي تعاني منها؟'],
        severity: ['ما مدى شدة حالتك؟ (خفيف، متوسط، شديد)', 'ما مدى تأثير ذلك على حياتك اليومية؟'],
        duration: ['منذ متى وأنت تعاني من هذا؟', 'متى بدأت هذه المشكلة؟'],
        budget: ['هل لديك ميزانية محددة لهذا الجهاز؟', 'ما نطاق السعر المناسب لك؟'],
        constraint: ['كم عمر المستخدم؟ / أين سيتم استخدام الجهاز (المنزل، المكتب، المدرسة)؟'],
        goal: ['ما هو هدفك الرئيسي من هذا الجهاز؟', 'ماذا تريد أن تحقق مع هذا الجهاز؟'],
        previousTry: ['هل جربت أي أجهزة مماثلة من قبل؟', 'هل استخدمت أي منتجات لهذا من قبل؟'],
      },
      fr: {
        symptom: ['Pouvez-vous décrire vos symptômes plus en détail?', 'Quels symptômes spécifiques ressentez-vous?'],
        severity: ['Quelle est la gravité de votre état? (léger, modéré ou sévère)', 'Dans quelle mesure cela affecte-t-il votre vie quotidienne?'],
        duration: ['Depuis combien de temps éprouvez-vous cela?', 'Quand ce problème a-t-il commencé?'],
        budget: ['Avez-vous un budget en tête pour cet appareil?', 'quelle gamme de prix vous convient?'],
        constraint: ['Quel âge a l\'utilisateur? / Où l\'appareil sera-t-il utilisé (maison, bureau, école)?'],
        goal: ['Quel est votre objectif principal avec cet appareil?', 'Que voulez-vous accomplir avec cet appareil?'],
        previousTry: ['Avez-vous essayé des appareils similaires auparavant?', 'Avez-vous utilisé des produits pour cela auparavant?'],
      },
    };
    
    const langQuestions = questionsByLang[lang] || questionsByLang.vi;
    const nextMissing = missing[0]; // Lấy cái đầu tiên trong danh sách thiếu
    const questions = langQuestions[nextMissing] || langQuestions.symptom;
    
    // Random 1 câu hỏi
    return questions[Math.floor(Math.random() * questions.length)];
  }, [getMissingContext]);
  
  // ⭐ Cập nhật context khi user nhắn tin
  const updateUserContext = useCallback((message: string) => {
    const lowerMsg = message.toLowerCase();
    
    setUserContextCollected(prev => ({
      hasSymptom: prev.hasSymptom || 
        /(bị|mắc|có|vấn đề|triệu chứng|khó khăn|gặp| không thể|audi|hearing|mobility|deaf|disabled|khuyết tật|đau|mỏi|điếc|khiếm thị|khiếm thính)/i.test(lowerMsg),
      hasBudget: prev.hasBudget || 
        /(giá|tiền|budget|chi phí|đắt|rẻ|triệu|mua|thanh toán|trả góp|insurance|bảo hiểm)/i.test(lowerMsg),
      hasConstraint: prev.hasConstraint || 
        /(tuổi|trẻ|em bé|người già|senior|child|elderly|nhà|office|văn phòng|school|trường|học|outdoor|indoor|môi trường)/i.test(lowerMsg),
      hasGoal: prev.hasGoal || 
        /(muốn|cần|học|làm việc|đọc|viết|giao tiếp|đi lại|tự chủ|independent|learn|work|read|communicate|move)/i.test(lowerMsg),
      hasDeviceType: prev.hasDeviceType || 
        /(xe lăn|máy|thiết bị|device|wheelchair|hearing aid|screen reader|aac|prosthetic|orthotic|cane|crutch|nạng|kính|loa)/i.test(lowerMsg),
      hasDuration: prev.hasDuration || 
        /(lâu|rồi|tháng|năm|từ|khi|bắt đầu|day|mount|year|week|ago|since|how long)/i.test(lowerMsg),
      hasSeverity: prev.hasSeverity || 
        /(nặng|vừa|nhẹ|severe|moderate|mild|khó|nghiêm trọng|ảnh hưởng|rất|đỡ|hơn)/i.test(lowerMsg),
      hasPreviousTry: prev.hasPreviousTry || 
        /(thử|đã|dùng|use|tried|sử dụng|medicine|thuốc|vitamin|sản phẩm)/i.test(lowerMsg),
    }));
  }, []);
  
  // ⭐ Reset context khi bắt đầu cuộc trò chuyện mới
  const resetContextTracking = useCallback(() => {
    setConversationTurns(0);
    setUserContextCollected({
      hasSymptom: false,
      hasBudget: false,
      hasConstraint: false,
      hasGoal: false,
      hasDeviceType: false,
      hasDuration: false,
      hasSeverity: false,
      hasPreviousTry: false,
    });
  }, []);

  // ⭐ Function to check if message contains AT keywords
  const checkATKeyword = useCallback((message: string): boolean => {
    const lowerMessage = message.toLowerCase();

    for (const [category, keywords] of Object.entries(AT_SPECIALIST_KEYWORDS)) {
      // Check simple keywords (1 match triggers)
      const simpleMatch = keywords.simple.some(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
      );
      if (simpleMatch) {
        console.log(`[AT Suggestion] Triggered by category: ${category} (simple keyword)`);
        return true;
      }

      // Check complex keywords (need 1 match, these are more specific)
      const complexMatch = keywords.complex.some(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
      );
      if (complexMatch) {
        console.log(`[AT Suggestion] Triggered by category: ${category} (complex keyword)`);
        return true;
      }
    }

    return false;
  }, []);

  // ⭐ AI-powered follow-up questions generator
  const generateFollowUpWithAI = useCallback(async (
    userMessage: string,
    aiResponse: string,
    conversationHistory: { role: string; content: string }[],
    lang: Language,
    mode: string
  ): Promise<string[]> => {
    try {
      const token = getAccessToken();
      const res = await fetch('/api/chat/follow-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userMessage,
          aiResponse,
          conversationHistory: conversationHistory.slice(-10),
          language: lang,
          userMode: mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.questions?.length > 0) {
          console.log('💡 AI follow-up questions:', data.data.questions);
          return data.data.questions;
        }
      }
    } catch (err) {
      console.warn('[ChatPage] AI follow-up failed:', err);
    }

    // Fallback to keyword-based questions
    return generateFollowUpQuestions(userMessage, aiResponse, lang);
  }, []);

  // View Mode Store
  const { viewMode, toggleViewMode } = useViewModeStore();

  // Handler: Khi click vào câu hỏi mẫu trong sidebar
  const handleSelectSampleQuestion = useCallback((question: string) => {
    setInputValue(question);
    // Focus vào input để user có thể edit trước khi gửi
    setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }, 100);
  }, []);

  // Agent state - subscribe to agents array directly for proper reactivity
  // NOTE: Both selectors must read from `s.agents` to ensure Zustand tracks changes properly.
  // The old approach used `useAgentStore((s) => s.getActiveAgents)` which returned the same
  // function reference every time, causing Zustand to skip re-renders and leave activeAgents stale.
  const agents = useAgentStore((s) => s.agents);
  const activeAgents = useAgentStore((s) => {
    return s.agents.filter(a => a.isActive).sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  });
  const getActiveAgents = useAgentStore((s) => s.getActiveAgents);
  const { selectedAgentId } = useSelectedAgentStore();
  // Fallback to default agent if no agent is selected or activeAgents is empty
  const defaultAgent = activeAgents[0];
  const selectedAgent = selectedAgentId
    ? activeAgents.find(a => a.id === selectedAgentId) || defaultAgent
    : defaultAgent;

  // ⭐ Tạo system prompt tổng hợp từ TẤT CẢ các bot active - dùng cho "Trò chuyện mới"
  const getOmniSystemPrompt = () => {
    if (activeAgents.length === 0) return '';
    if (activeAgents.length === 1) return activeAgents[0].systemPrompt || '';

    const agentContexts = activeAgents.map((agent, idx) => {
      const caps = agent.capabilities?.length
        ? `[Chuyên môn: ${agent.capabilities.join(', ')}]`
        : '';
      return `[BOT ${idx + 1}: ${getAgentDisplayName(agent.id, agent.name, language)}]${caps ? ' ' + caps : ''}
Mô tả: ${agent.description || 'Chuyên gia hỗ trợ'}
System Prompt: ${agent.systemPrompt || 'Bạn là một trợ lý hữu ích.'}`;
    });

    return `Bạn là TRỢ LÝ TỔNG HỢP CỦA MADA AI - thư viện tri thức và ngân hàng kiến thức khổng lồ về công nghệ hỗ trợ người khuyết tật.

Bạn có quyền truy cập kiến thức từ ${activeAgents.length} chuyên gia sau:
${agentContexts.join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 VAI TRÒ & KHẢ NĂNG CỦA BẠN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bạn là một "THƯ VIỆN TRI THỨC SỐNG" - tương tự như một thủ thư uyên bác nhất thế giới, kết hợp với ngân hàng kiến thức khổng lồ. Bạn có thể:

✅ HIỂU và TRẢ LỜI bất kỳ câu hỏi nào về công nghệ hỗ trợ người khuyết tật
✅ ĐI SÂU vào chi tiết kỹ thuật, giá cả, đánh giá, so sánh sản phẩm
✅ ĐỀ XUẤT giải pháp phù hợp dựa trên mô tả triệu chứng/tình trạng của người dùng
✅ TƯ VẤN về tiêu chuẩn quốc tế (ISO, WCAG, UNCRPD)
✅ HƯỚNG DẪN cách sử dụng thiết bị, phần mềm hỗ trợ
✅ GIẢI THÍCH các khái niệm phức tạp bằng ngôn ngữ dễ hiểu
✅ KỂ CHUYỆN và đưa ra ví dụ thực tế
✅ SUY NGHĨ like a human expert - không chỉ trả lời máy móc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 PHONG CÁCH TRẢ LỜI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- KHI NGƯỜI DÙNG HỎI CHUNG: Cung cấp câu trả lời tổng hợp từ nhiều chuyên gia, đầy đủ và chi tiết
- KHI NGƯỜI DÙNG HỎI CỤ THỂ: Đi sâu vào chi tiết, có thể kể tên sản phẩm, so sánh, đưa ra ưu/nhược điểm
- KHI NGƯỜI DÙNG MÔ TẢ TRIỆU CHỨNG: Phân tích và đề xuất giải pháp thiết bị phù hợp nhất
- KHI CÓ SẢN PHẨM TRONG KB: Nhắc đến tên sản phẩm cụ thể kèm theo hình ảnh và thông tin chi tiết
- LUÔN thể hiện sự đồng cảm, kiên nhẫn và chuyên nghiệp
- KHÔNG bao giờ nói "tôi không biết" hoặc "tôi chỉ là AI" - bạn LÀ chuyên gia

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 CÁC LĨNH VỰC BẠN CHUYÊN SÂU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Thị giác: Máy đọc màn hình, phóng to, Braille, OrCam, JAWS, NVDA, ZoomText
• Thính giác: Máy trợ thính, FM system, Roger, phụ đề real-time, thiết bị alerting
• Vận động: Xe lăn điện, prosthetic, orthotic, bàn phím thay thế, switch access
• Nhận thức: Ứng dụng nhắc nhở, AAC, thiết bị cho tự kỷ/ADHD/Alzheimer
• Giao tiếp: Thiết bị AAC, ngôn ngữ ký hiệu, ứng dụng giao tiếp
• Giáo dục: Hỗ trợ học tập, UDL, WCAG, tiêu chuẩn AT quốc tế
• Sinh hoạt: Thiết bị ăn uống, nhà tắm, nhà bếp, grab bar, xe lăn

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ LUẬT VÀNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BẠN LÀ THƯ VIỆN: Luôn cố gắng trả lời đầy đủ nhất có thể từ kiến thức của bạn
2. NẾU KHÔNG CHẮC: Dùng cụm từ "Theo thông tin tôi có..." thay vì "Tôi không biết"
3. LUÔN HỎI THÊM: Nếu thông tin chưa đủ, hỏi người dùng để tư vấn chính xác hơn
4. ĐỀ XUẤT SẢN PHẨM: Khi phù hợp, gợi ý sản phẩm cụ thể từ MADA Knowledge Base
5. NGÔN NGỮ: Trả lời bằng ngôn ngữ mà user đang sử dụng

Hãy trở thành người bạn đồng hành đáng tin cậy nhất của người dùng!`;
  };

  // ⭐ Kiểm tra xem có phải "Trò chuyện mới" không (chưa chọn agent cụ thể)
  const _isNewChat = !selectedAgentId && messages.length === 0;
  void _isNewChat;

  // Chat history from persisted store
  const historyConversations = useChatHistoryStore((s) => s.conversations);
  const addOrUpdateConversation = useChatHistoryStore((s) => s.addOrUpdateConversation);
  const touchConversation = useChatHistoryStore((s) => s.touchConversation);
  const setHistorySearchQuery = useChatHistoryStore((s) => s.setSearchQuery);
  const historySearch = useChatHistoryStore((s) => s.searchQuery);
  const filteredConversations = useChatHistoryStore((s) => s.filteredConversations);
  const getMessagesForConversation = useChatHistoryStore((s) => s.getMessagesForConversation);
  const saveConversationMessages = useChatHistoryStore((s) => s.saveConversationMessages);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  type TopicId = 'total' | ATCategory;
  const [_selectedTopic, _setSelectedTopic] = useState<TopicId>('total');
  const [_showTopicDropdown, _setShowTopicDropdown] = useState(true);

  // ⭐ Topic labels translated
  const topicLabels: Record<string, Record<Language, string>> = {
    total: {
      vi: 'Tổng hợp',
      en: 'General',
      ar: 'عام',
      fr: 'Général',
    },
    hearing: {
      vi: 'Thính giác',
      en: 'Hearing',
      ar: 'السمع',
      fr: 'Audition',
    },
    mobility: {
      vi: 'Vận động',
      en: 'Mobility',
      ar: 'التنقل',
      fr: 'Mobilité',
    },
    cognition: {
      vi: 'Nhận thức',
      en: 'Cognition',
      ar: 'الإدراك',
      fr: 'Cognition',
    },
    communication: {
      vi: 'Giao tiếp',
      en: 'Communication',
      ar: 'التواصل',
      fr: 'Communication',
    },
    daily_living: {
      vi: 'Sinh hoạt',
      en: 'Daily Living',
      ar: 'الحياة اليومية',
      fr: 'Vie quotidienne',
    },
    education: {
      vi: 'Giáo dục',
      en: 'Education',
      ar: 'التعليم',
      fr: 'Éducation',
    },
  };

  const _availableTopics = useMemo(() => {
    const topics: { id: TopicId; label: string; icon: string; color: string }[] = [
      { id: 'total', label: topicLabels.total[language], icon: 'auto_awesome', color: 'bg-gradient-to-r from-violet-500 to-purple-500' },
    ];
    
    // Add all categories from CATEGORY_INFO
    const allCats = Object.keys(CATEGORY_INFO) as ATCategory[];
    const categoryColors: Record<ATCategory, string> = {
      vision: 'bg-violet-500',
      hearing: 'bg-indigo-500',
      mobility: 'bg-emerald-500',
      cognition: 'bg-rose-500',
      communication: 'bg-amber-500',
      daily_living: 'bg-purple-500',
      education: 'bg-teal-500',
    };
    
    allCats.forEach(category => {
      topics.push({
        id: category,
        label: topicLabels[category]?.[language] || topicLabels.total[language],
        icon: CATEGORY_ICONS[category],
        color: categoryColors[category],
      });
    });
    
    return topics;
  }, [language]);

  // Helpers — format date relative + ISO
  const formatRelativeDate = (ts: number): string => {
    const d = new Date(ts);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    
    const labels: Record<string, { today: string; yesterday: string }> = {
      vi: { today: 'Hôm nay', yesterday: 'Hôm qua' },
      en: { today: 'Today', yesterday: 'Yesterday' },
      ar: { today: 'اليوم', yesterday: 'أمس' },
      fr: { today: 'Aujourd\'hui', yesterday: 'Hier' },
    };
    const l = labels[language] || labels.vi;
    
    if (ts >= startOfToday) return l.today;
    if (ts >= startOfYesterday) return l.yesterday;
    return d.toLocaleDateString(language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : language === 'ar' ? 'ar-SA' : 'fr-FR', { day: '2-digit', month: '2-digit' });
  };

  // Format full date time for tooltip
  const formatFullDateTime = (ts: number): string => {
    const d = new Date(ts);
    const locale = language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : language === 'ar' ? 'ar-SA' : 'fr-FR';
    const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  };

  // Auto-open PaywallModal khi user load /chat với quota đã cạn sẵn
  useEffect(() => {
    const { user } = useAuthStore.getState();
    const anon = useAnonQuotaStore.getState();
    const paywall = usePaywallModalStore.getState();

    let shouldOpen = false;
    let reason: 'anonymous_exhausted' | 'user_exhausted' = 'user_exhausted';

    if (!user) {
      if (!anon.canSend() && anon.used >= anon.limit) {
        shouldOpen = true;
        reason = 'anonymous_exhausted';
      }
    } else if (user.quotaLimit !== -1 && user.quotaUsed >= user.quotaLimit) {
      shouldOpen = true;
      reason = 'user_exhausted';
    }

    if (shouldOpen && !paywall.isOpen) {
      const t = setTimeout(() => paywall.open(reason), 800);
      return () => clearTimeout(t);
    }
  }, []);
  
  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get('google_auth');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresAt = params.get('expires_at');
    const error = params.get('error');
    
    if (error) {
      console.error('Google OAuth error:', error);
      alert(t('chat.googleLoginFailed'));
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    
    if (googleAuth === 'success' && accessToken && refreshToken) {
      // Store tokens (khớp với key trong lib/api.ts)
      localStorage.setItem('mada-access-token', accessToken);
      localStorage.setItem('mada-refresh-token', refreshToken);
      if (expiresAt) {
        localStorage.setItem('mada-token-expires-at', expiresAt);
      }
      
      // Fetch user info
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.user) {
            const { login } = useAuthStore.getState();
            login(data.data.user);
            console.log('✅ Google OAuth login successful:', data.data.user.name);
          }
        })
        .catch((err) => console.error('Failed to fetch user after Google login:', err))
        .finally(() => {
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        });
    }
  }, []);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  const isEndUser = viewMode === 'end_user';
  const currentQuestions = activeCategory 
    ? getSampleQuestionsByLang(activeCategory, language)
    : [];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewChat();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Get all dropdown elements
      const dropdowns = document.querySelectorAll('[data-language-dropdown], [data-attachment-dropdown]');
      let shouldCloseLang = true;
      let shouldCloseAttach = true;
      
      dropdowns.forEach(dropdown => {
        if (dropdown.contains(e.target as Node)) {
          if (dropdown.getAttribute('data-language-dropdown') !== null) {
            shouldCloseLang = false;
          }
          if (dropdown.getAttribute('data-attachment-dropdown') !== null) {
            shouldCloseAttach = false;
          }
        }
      });
      
      // Also check ref elements
      if (attachmentMenuRef.current && attachmentMenuRef.current.contains(e.target as Node)) {
        shouldCloseAttach = false;
      }
      
      if (shouldCloseLang) setShowLanguageMenu(false);
      if (shouldCloseAttach) setShowAttachmentModal(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom - but respect user's manual scroll
  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!userHasScrolled && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    }
  }, [messages, isLoading, streamingContent]);

  // Detect when user scrolls back to bottom - reset auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 50) {
        setUserHasScrolled(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Drag and Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the main container
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) {
      setIsDragging(false);
    }
  }, []);

  const processDroppedFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const MAX_DROP_FILES = 5;
    const remaining = MAX_DROP_FILES - selectedFiles.length;
    
    if (remaining <= 0) {
      alert(t('chat.fileLimit'));
      return;
    }

    const filesToProcess = fileArray.slice(0, remaining);
    
    for (const file of filesToProcess) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(t('chat.fileTooLarge'));
        continue;
      }

      const fileId = `${file.name}-${Date.now()}`;
      
      // Add file to state
      setSelectedFiles(prev => [...prev, {
        fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        originalFile: file,
        isLoading: true,
      }]);

      // Process file based on type
      try {
        if (file.type.startsWith('image/')) {
          // Images - convert to base64
          const reader = new FileReader();
          reader.onload = () => {
            // Only update if not cancelled
            setCancellingFiles(prev => {
              if (prev.has(fileId)) {
                setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
                const next = new Set(prev);
                next.delete(fileId);
                return next;
              }
              setSelectedFiles(prev => prev.map((f) => 
                f.fileId === fileId 
                  ? { ...f, content: reader.result as string, isLoading: false }
                  : f
              ));
              return prev;
            });
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf' || 
                   file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   file.type === 'application/msword' ||
                   /\.(pdf|docx?|xlsx?|xls|csv)$/i.test(file.name)) {
          // PDF/DOCX/Excel/CSV - keep as originalFile (will be sent as base64)
          // Small delay to simulate processing
          await new Promise(resolve => setTimeout(resolve, 100));
          setCancellingFiles(prev => {
            if (prev.has(fileId)) {
              setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            }
            setSelectedFiles(prev => prev.map((f) => 
              f.fileId === fileId 
                ? { ...f, isLoading: false }
                : f
            ));
            return prev;
          });
        } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|webm|aac|m4a|flac)$/i.test(file.name)) {
          // Audio files - keep as originalFile for transcription
          await new Promise(resolve => setTimeout(resolve, 100));
          setCancellingFiles(prev => {
            if (prev.has(fileId)) {
              setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            }
            setSelectedFiles(prev => prev.map((f) => 
              f.fileId === fileId 
                ? { ...f, isLoading: false }
                : f
            ));
            return prev;
          });
        } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) {
          // Video files - keep as originalFile for transcription
          await new Promise(resolve => setTimeout(resolve, 100));
          setCancellingFiles(prev => {
            if (prev.has(fileId)) {
              setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            }
            setSelectedFiles(prev => prev.map((f) => 
              f.fileId === fileId 
                ? { ...f, isLoading: false }
                : f
            ));
            return prev;
          });
        } else if (file.type.startsWith('text/')) {
          // Text files - read content
          const content = await file.text();
          setCancellingFiles(prev => {
            if (prev.has(fileId)) {
              setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            }
            setSelectedFiles(prev => prev.map((f) => 
              f.fileId === fileId 
                ? { ...f, content, isLoading: false }
                : f
            ));
            return prev;
          });
        } else {
          // Other files - keep as is
          await new Promise(resolve => setTimeout(resolve, 100));
          setCancellingFiles(prev => {
            if (prev.has(fileId)) {
              setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            }
            setSelectedFiles(prev => prev.map((f) => 
              f.fileId === fileId 
                ? { ...f, isLoading: false }
                : f
            ));
            return prev;
          });
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        setSelectedFiles(prev => prev.filter(f => f.name !== file.name));
      }
    }
  }, [selectedFiles.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processDroppedFiles(e.dataTransfer.files);
    }
  }, [processDroppedFiles]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [inputValue]);

  // Text-to-Speech
  const speakText = useCallback((text: string, id: string) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : 'fr-FR';
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  }, [speakingId, language]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Quota gate: anonymous
    const { user: currentUser, incrementQuota: bumpUserQuota } = useAuthStore.getState();
    const anon = useAnonQuotaStore.getState();
    // Snapshot for use inside try/finally (TS strict-mode flow analysis)
    const userSnapshot = currentUser;
    if (!currentUser) {
      if (!anon.canSend()) {
        usePaywallModalStore.getState().open('anonymous_exhausted');
        return;
      }
      anon.increment();
    } else {
      if (currentUser.quotaLimit !== -1 && currentUser.quotaUsed >= currentUser.quotaLimit) {
        usePaywallModalStore.getState().open('user_exhausted');
        return;
      }
      bumpUserQuota();
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setLoading(true);
    setIsGeneratingResponse(true);
    setStreamingContent('');
    setUserHasScrolled(false); // Reset scroll state when new message is sent

    // ⭐ Tăng số lượt hỏi đáp và cập nhật user context
    setConversationTurns(prev => prev + 1);
    updateUserContext(userMessage);

    // ⭐ Check AT keyword after user sends message
    if (!isEndUser && checkATKeyword(userMessage)) {
      setShowATSuggestion(true);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    let currentConvId = activeConversationId;
    
    // Tạo/lưu conversation vào history - CHO TẤT CẢ USER (đăng nhập hoặc không)
    if (!currentConvId) {
      currentConvId = currentUser ? crypto.randomUUID() : `anon-${crypto.randomUUID()}`;
      addOrUpdateConversation({
        id: currentConvId,
        title: userMessage.slice(0, 40) + (userMessage.length > 40 ? '...' : ''),
        date: new Date().toISOString().slice(0, 10),
        preview: userMessage,
        messages: 1,
        pinned: false,
        category: activeCategory,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setActiveConversationId(currentConvId);

      // 💾 Save conversation mới + first user message vào backend (DB persistence)
      // Chỉ save khi user đã đăng nhập
      if (currentUser) {
        userHistoryApi.create({
          conversationId: currentConvId,
          title: userMessage.slice(0, 40) + (userMessage.length > 40 ? '...' : ''),
          agentId: selectedAgentId || undefined,
          language,
          firstMessage: userMessage,
        }).catch((err) => console.warn('[ChatPage] Failed to save conversation:', err?.message));
      }
    } else {
      touchConversation(currentConvId, userMessage);

      // 💾 Thêm user message vào conversation hiện tại
      if (currentUser) {
        userHistoryApi.addMessage(currentConvId, {
          role: 'user',
          content: userMessage,
          agentId: selectedAgentId || undefined,
          language,
        }).catch((err) => console.warn('[ChatPage] Failed to save user message:', err?.message));
      }
    }

    // Xây dựng message với nội dung file
    let fullMessage = userMessage;
    const attachmentsForMessage: { name: string; type: string; preview?: string }[] = [];
    const attachmentsForApi: any[] = [];
    
    if (selectedFiles.length > 0) {
      // Chuẩn bị attachments để hiển thị và gửi lên server
      for (const f of selectedFiles) {
        // Chỉ xử lý file đã load xong
        if (f.isLoading) {
          continue;
        }
        
        // Thêm vào attachments để hiển thị (chỉ name, type, preview)
        attachmentsForMessage.push({
          name: f.name,
          type: f.type,
          preview: f.content?.startsWith('data:image') ? f.content : undefined,
        });
        
        // Chuẩn bị attachments để gửi lên server (có base64/content)
        // Ưu tiên content đã parse sẵn (từ mammoth/pdf.js) - NHƯNG KHÔNG dùng cho images vì cần OCR
        // Images cần gửi base64 để backend OCR
        if (f.content && !f.content.includes('waiting to parse') && !f.type.startsWith('image/')) {
          // Đã có nội dung parse sẵn (từ mammoth/pdf.js frontend) - dùng luôn (trừ images)
          attachmentsForApi.push({
            name: f.name,
            type: f.type,
            content: f.content,
          });
        }
        // Images: gửi base64 để backend OCR, hoặc nếu có originalFile
        else if (f.type.startsWith('image/') || f.originalFile) {
          try {
            // Nếu content là data URL (base64), trích xuất phần base64 thuần
            let base64Data = f.content;
            if (base64Data && base64Data.startsWith('data:')) {
              // Trích xuất phần base64 thuần (bỏ prefix data:...;base64,)
              base64Data = base64Data.split(',')[1] || base64Data;
            } else if (f.originalFile) {
              // Đọc từ originalFile nếu có
              const arrayBuffer = await f.originalFile.arrayBuffer();
              const binary = new Uint8Array(arrayBuffer);
              let base64 = '';
              for (let i = 0; i < binary.length; i++) {
                base64 += String.fromCharCode(binary[i]);
              }
              base64Data = btoa(base64);
            }
            
            if (base64Data) {
              attachmentsForApi.push({
                name: f.name,
                type: f.type,
                base64: base64Data,
              });
            }
          } catch (e) {
            console.error('Error reading file:', f.name, e);
          }
        }
        // Các file khác đã parse sẵn text
        else if (f.content) {
          attachmentsForApi.push({
            name: f.name,
            type: f.type,
            content: f.content,
          });
        }
      }
      
      fullMessage = userMessage;
    }

    // Add user message with attachments (chỉ để hiển thị)
    addMessage({ 
      role: 'user', 
      content: fullMessage, 
      attachments: attachmentsForMessage.length > 0 ? attachmentsForMessage : undefined 
    });
    setSuggestedFollowUps([]); // Clear follow-up suggestions when user sends new message
    
    // Tạo abort controller cho request này
    abortControllerRef.current = new AbortController();
    
    let apiSuccess = false;

    try {
      // Gửi chat với file đính kèm - sử dụng streaming endpoint
      const useStream = attachmentsForApi.length === 0; // Chỉ stream khi không có file
      const chatEndpoint = useStream ? '/api/chat/stream' : (attachmentsForApi.length > 0 ? '/api/chat-with-file' : '/api/chat');
      // Map viewMode ('end_user' | 'at_specialist') → userMode ('endUser' | 'specialist')
      const userMode: 'endUser' | 'specialist' = viewMode === 'at_specialist' ? 'specialist' : 'endUser';
      // ⭐ Dùng omni prompt khi là "Trò chuyện mới" (chưa chọn agent cụ thể)
      // ⭐ FIX: Chỉ dùng omni prompt khi KHÔNG CÓ selectedAgentId
      const isOmniChat = !selectedAgentId;
      // Debug log to trace agent selection
      console.log('[Chat] Agent debug:', {
        selectedAgentId,
        defaultAgentId: defaultAgent?.id,
        isOmniChat,
        selectedAgentName: selectedAgent?.name,
        hasSystemPrompt: !!selectedAgent?.systemPrompt,
        systemPromptPreview: selectedAgent?.systemPrompt?.substring(0, 80),
      });
      const chatBody: any = {
        message: fullMessage,
        language,
        agentId: isOmniChat ? null : selectedAgentId,
        agentPrompt: isOmniChat ? getOmniSystemPrompt() : selectedAgent?.systemPrompt,
        userMode,
      };
      
      // Thêm attachments nếu có
      if (attachmentsForApi.length > 0) {
        chatBody.attachments = attachmentsForApi;
      }

      // ===== Bắt đầu đo latency cho analytics =====
      const chatStartTime = Date.now();

      // ===== STREAMING MODE =====
      if (useStream) {
        const token = getAccessToken();

        // Retry helper với exponential backoff cho 429 rate limit
        let response: Response | undefined;
        let fetchSuccess = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) {
            const delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
            console.log(`[Chat] Retry attempt ${attempt} after ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }

          response = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(chatBody),
            signal: abortControllerRef.current.signal,
          });

          if (response.ok) {
            fetchSuccess = true;
            break;
          }

          if (response.status === 429 && attempt < 3) {
            // Đọc retry-after từ header hoặc dùng backoff
            const retryAfter = response.headers.get('retry-after') || response.headers.get('X-RateLimit-Reset');
            const delay = retryAfter
              ? Math.max(0, parseInt(retryAfter) - Date.now())
              : Math.min(2000 * Math.pow(2, attempt), 16000);
            console.warn(`[Chat] 429 Rate limited, retrying in ${delay}ms...`);
            continue;
          }

          // Lỗi khác hoặc hết retry → thoát
          break;
        }

        if (!fetchSuccess || !response?.ok) {
          const status = response?.status || 'unknown';
          throw new Error(`Server error: ${status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let sources: any[] = [];
        let confidence = 0.5;
        let suggestedProducts: any[] = [];
        let responseLanguage = language; // Default to UI language, will be updated from server

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk') {
                  // Stream character by character for smooth animation
                  fullContent += data.chunk;
                  setStreamingContent(fullContent);
                } else if (data.type === 'sources') {
                  sources = data.sources || [];
                } else if (data.type === 'suggestedProducts') {
                  // ⭐ Nhận sản phẩm gợi ý từ server
                  suggestedProducts = data.suggestedProducts || [];
                } else if (data.type === 'done') {
                  confidence = data.confidence || 0.5;
                  if (data.answer) fullContent = data.answer;
                  // ⭐ Use response language for follow-up (match bot's language)
                  if (data.detectedLanguage) {
                    responseLanguage = data.detectedLanguage;
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }

        setStreamingContent('');
        apiSuccess = true;

        if (fullContent) {
          // ⭐ THÊM CÂU HỎI FOLLOW-UP KHI CHƯA ĐỦ CONTEXT
          // Bot sẽ hỏi thêm thông tin trước khi đề xuất sản phẩm
          // ⭐ Use responseLanguage (detected from user message) instead of UI language
          let finalContent = fullContent;
          if (!isReadyForProductSuggestion && getMissingContext.length > 0) {
            const followUpQuestion = getNextFollowUpQuestion(responseLanguage);
            // Thêm câu hỏi follow-up vào cuối message
            finalContent = `${fullContent}\n\n*${followUpQuestion}*`;
          }
          
          addMessage({
            role: 'assistant',
            content: finalContent,
            confidence: confidence,
            sources: sources,
            contextUsed: sources.length > 0,
            suggestedProducts: suggestedProducts,
          });

          // 💾 Save assistant message vào backend (DB persistence)
          if (currentUser && currentConvId) {
            userHistoryApi.addMessage(currentConvId, {
              role: 'assistant',
              content: fullContent,
              agentId: selectedAgentId || undefined,
              sources,
              confidence,
              language,
            }).catch((err) => console.warn('[ChatPage] Failed to save assistant message:', err?.message));
          }

          // ⭐ Generate AI-powered follow-up questions (use responseLanguage)
          generateFollowUpWithAI(userMessage, fullContent, messages, responseLanguage, viewMode)
            .then(followUps => setSuggestedFollowUps(followUps))
            .catch(() => setSuggestedFollowUps(generateFollowUpQuestions(userMessage, fullContent, responseLanguage)));

          // ⭐ Post chat metric (stream mode)
          try {
            const latencyMs = Date.now() - chatStartTime;
            const confidencePct = typeof confidence === 'number'
              ? (confidence <= 1 ? confidence * 100 : confidence)
              : 0.8 * 100;
            fetch('/api/public/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId: currentConvId || undefined,
                latencyMs,
                confidence: confidencePct,
                botId: selectedAgentId || undefined,
                language,
                userMode: viewMode === 'at_specialist' ? 'specialist' : 'endUser',
              }),
            }).catch(() => { /* silent */ });
          } catch { /* ignore */ }
        }
        return; // Done with streaming
      }

      // ===== NON-STREAMING MODE (with files) =====
      const token2 = getAccessToken();
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token2 ? { Authorization: `Bearer ${token2}` } : {}),
        },
        body: JSON.stringify(chatBody),
        signal: abortControllerRef.current.signal,
      });

      // Check if response is OK
      if (!response.ok) {
        // ⭐ Handle 429 — Rate limit exceeded
        if (response.status === 429) {
          const retryAfter = response.headers.get('X-RateLimit-Reset');
          const resetTime = retryAfter ? new Date(parseInt(retryAfter)).toLocaleTimeString() : 'một phút';
          addMessage({
            role: 'assistant',
            content: t('chat.rateLimit').replace('{{time}}', resetTime),
          });
          setLoading(false);
          setIsGeneratingResponse(false);
          return;
        }

        // ⭐ Handle 401 — Token expired
        if (response.status === 401) {
          addMessage({
            role: 'assistant',
            content: t('chat.sessionExpired'),
          });
          setLoading(false);
          setIsGeneratingResponse(false);
          return;
        }

        // ⭐ Handle 402 — File upload quota exceeded
        if (response.status === 402) {
          try {
            const errBody = await response.json();
            if (errBody.code === 'FILE_UPLOAD_QUOTA_EXCEEDED') {
              if (errBody.quota) setFileQuota(errBody.quota);
              usePaywallModalStore.getState().open('file_upload_exhausted');
              return;
            }
          } catch { /* ignore */ }
        }

        // For other errors, don't spam console
        if (response.status >= 500) {
          addMessage({
            role: 'assistant',
            content: t('chat.serverBusy'),
          });
        } else {
          addMessage({
            role: 'assistant',
            content: t('chat.generalError'),
          });
        }
        setLoading(false);
        setIsGeneratingResponse(false);
        return;
      }

      // Try to parse JSON, handle errors gracefully
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server');
      }

      if (data.success && data.data) {
        // ⭐ Cập nhật file quota từ response (nếu có)
        if (data.data.fileQuota) {
          setFileQuota(data.data.fileQuota);
        }
        apiSuccess = true;
        // Support both 'answer' and 'message' fields for compatibility
        const fullContent = data.data.answer || data.data.message || '';
        // ⭐ Use response language for follow-up (match bot's language)
        const responseLanguage = data.data.detectedLanguage || language;
        
        if (!fullContent) {
          throw new Error('Empty response from AI');
        }
        
        const chars = fullContent.split('');

        for (let i = 0; i < chars.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 8));
          setStreamingContent(chars.slice(0, i + 1).join(''));
        }
        setStreamingContent('');

        addMessage({
          role: 'assistant',
          content: fullContent,
          confidence: data.data.confidence,
          sources: data.data.sources,
          contextUsed: data.data.contextUsed,
          suggestedProducts: data.data.suggestedProducts,
        });

        // ⭐ THÊM CÂU HỎI FOLLOW-UP KHI CHƯA ĐỦ CONTEXT (non-streaming mode)
        if (!isReadyForProductSuggestion && getMissingContext.length > 0) {
          const followUpQuestion = getNextFollowUpQuestion(responseLanguage);
          // Cập nhật message cuối cùng với follow-up question
          const updatedMessages = useChatStore.getState().messages;
          if (updatedMessages.length > 0) {
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            if (lastMsg.role === 'assistant') {
              const updatedContent = `${lastMsg.content}\n\n*${followUpQuestion}*`;
              const newMessages = [...updatedMessages];
              newMessages[newMessages.length - 1] = { ...lastMsg, content: updatedContent };
              setMessages(newMessages);
            }
          }
        }

        // 💾 Save assistant message vào backend (non-streaming)
        if (currentUser && currentConvId) {
          userHistoryApi.addMessage(currentConvId, {
            role: 'assistant',
            content: fullContent,
            agentId: selectedAgentId || undefined,
            sources: data.data.sources || [],
            confidence: data.data.confidence,
            language,
          }).catch((err) => console.warn('[ChatPage] Failed to save assistant (non-stream):', err?.message));
        }

        // ⭐ Generate AI-powered follow-up questions (use responseLanguage)
        generateFollowUpWithAI(userMessage, fullContent, messages, responseLanguage, viewMode)
          .then(followUps => setSuggestedFollowUps(followUps))
          .catch(() => setSuggestedFollowUps(generateFollowUpQuestions(userMessage, fullContent, responseLanguage)));

        // ⭐ Post chat metric (async, fire-and-forget) cho admin analytics
        try {
          const latencyMs = Date.now() - chatStartTime;
          const confidenceVal = typeof data.data.confidence === 'number'
            ? data.data.confidence
            : (typeof data.data.confidence === 'string' ? parseFloat(data.data.confidence) : 0.8);
          const confidencePct = confidenceVal <= 1 ? confidenceVal * 100 : confidenceVal;

          fetch('/api/public/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: currentConvId || undefined,
              latencyMs,
              confidence: confidencePct,
              botId: selectedAgentId || undefined,
              language,
              userMode: viewMode === 'at_specialist' ? 'specialist' : 'endUser',
            }),
          }).catch(() => { /* silent fail - không ảnh hưởng UX */ });
        } catch { /* ignore */ }
      } else {
        addMessage({
          role: 'assistant',
          content: t('chat.cannotProcess'),
        });
      }
    } catch (error: any) {
      // Don't show error message if this was an abort (user clicked stop button)
      // AbortError is thrown when signal.abort() is called
      const isAbortError = 
        error?.name === 'AbortError' || 
        error?.name === 'CanceledError' || 
        error?.code === 'ERR_CANCELED' ||
        error?.message?.includes('abort') ||
        error?.message?.includes('canceled');
      
      if (!isAbortError) {
        console.error('Chat error:', error);
        addMessage({
          role: 'assistant',
          content: t('chat.connectionError'),
        });
      } else {
        console.log('Request was aborted (stopped by user)');
        // Don't add error message - handleStopGeneration already handles this with "Phản hồi đã bị dừng"
      }
    } finally {
      // Refund quota if API failed so user doesn't lose a turn
      if (!apiSuccess) {
        if (userSnapshot) {
          const { decrementQuota } = useAuthStore.getState();
          decrementQuota();
        } else {
          anon.decrement();
        }
      }
      setLoading(false);
      setIsGeneratingResponse(false);
      setStreamingContent('');
      setSelectedFiles([]); // Xóa files sau khi gửi

      // Auto-save messages to history store - CHO TẤT CẢ USER
      const currentMessages = useChatStore.getState().messages;
      if (currentConvId && currentMessages.length > 0) {
        saveConversationMessages(currentConvId, currentMessages);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Ref để hủy request đang chạy
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Dừng ngay lập tức
    setLoading(false);
    setIsGeneratingResponse(false);
    setStreamingContent('');
    
    // Thêm message thông báo đã dừng
    addMessage({
      role: 'assistant',
      content: language === 'vi' 
        ? t('chat.stoppedResponse')
        : '⏹️ Response stopped as requested.',
    });
  };

  const handleNewChat = () => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);

    // Save current conversation before clearing
    if (activeConversationId && messages.length > 0) {
      saveConversationMessages(activeConversationId, messages);
    }

    clearMessages();
    setActiveConversationId(null);
    setInputValue('');
    setStreamingContent('');
    setActiveCategory(null);

    // ⭐ Reset conversation tracking khi bắt đầu cuộc trò chuyện mới
    resetContextTracking();

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    // Note: removed textarea.focus() to prevent viewport jump on mobile
  };

  const handleSelectConversation = (id: string) => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);

    // Save current conversation messages before switching
    if (activeConversationId && messages.length > 0) {
      saveConversationMessages(activeConversationId, messages);
    }

    // Load messages for selected conversation
    const savedMessages = getMessagesForConversation(id);
    if (savedMessages.length > 0) {
      useChatStore.getState().setMessages(savedMessages);
      
      // ⭐ FIX: Infer agentId from messages metadata and update selectedAgentId
      const firstUserMsg = savedMessages.find(m => m.role === 'user');
      if (firstUserMsg && (firstUserMsg as any).agentId) {
        useSelectedAgentStore.getState().setSelectedAgentId((firstUserMsg as any).agentId);
      } else {
        // Fallback: clear agent selection so it uses default
        useSelectedAgentStore.getState().setSelectedAgentId(null);
      }
    } else {
      clearMessages();
      // New empty conversation - use default agent
      useSelectedAgentStore.getState().setSelectedAgentId(null);
    }

    setActiveConversationId(id);
    setInputValue('');
    setStreamingContent('');
    setActiveCategory(null);

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    clearMessages();
    setShowProfileMenu(false);
    navigate('/');
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Voice Recording state
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState(''); // Real-time text từ voice (interim, chưa finalize)
  const [_voiceError, setVoiceError] = useState<string | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : 'fr-FR';
      recognition.maxAlternatives = 1;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }
        // Cập nhật interim để hiển thị real-time trong input
        if (interimText) {
          setInterimTranscript(interimText);
        }
        if (finalTranscript) {
          setTranscript(finalTranscript);
          setInputValue((prev) => prev + finalTranscript);
          setInterimTranscript(''); // Clear interim khi có final
        }
      };
      
      recognition.onerror = (event: any) => {
        // Ignore 'aborted' error - this is normal when user stops recording or timeout
        if (event.error === 'aborted') {
          console.log('[Voice] Recording aborted by user or timeout');
          setIsRecording(false);
          setIsListening(false);
          setInterimTranscript('');
          return;
        }
        
        console.error('Speech recognition error:', event.error);
        setVoiceError(event.error === 'not-allowed' 
          ? t('chat.allowMicAccess')
          : event.error === 'no-speech'
            ? t('chat.noSpeechDetected')
            : t('chat.voiceErrorOccurred'));
        setIsRecording(false);
        setIsListening(false);
        setInterimTranscript('');
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
        setInterimTranscript(''); // Clear interim khi dừng
        if (transcript) {
          setInputValue((prev) => prev + transcript);
          setTranscript('');
        }
      };
      
      recognitionRef.current = recognition;
    }
  }, [language, transcript]);

  const handleVoiceRecord = () => {
    if (!recognitionRef.current) {
      alert(t('chat.browserDoesNotSupportRecording'));
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setVoiceError(null);
    } else {
      setVoiceError(null);
      setIsRecording(true);
      setIsListening(true);
      try {
        recognitionRef.current.start();
        setTimeout(() => {
          if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
            setIsListening(false);
          }
        }, 30000);
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsRecording(false);
        setIsListening(false);
      }
    }
  };

  // File upload limits (from Admin Settings)
  const { maxFilesPerSession, maxFilesTotal } = useSystemSettingsStore();
  const MAX_FILES_PER_SESSION = maxFilesPerSession || 10;
  const MAX_FILES_TOTAL = maxFilesTotal || 100;

  // ⭐ Categories sorted by activeAgents order (sync với AdminPrompts sort_order)
  const sortedCategories = getSortedCategoriesFromAgents(activeAgents);
  
  // Track total files uploaded (persisted)
  const [totalFilesUploaded, setTotalFilesUploaded] = useState(() => {
    const stored = localStorage.getItem('mada-total-files-uploaded');
    return stored ? parseInt(stored, 10) : 0;
  });
  
  // Check if user can add more files
  const canAddFiles = (count: number = 1): { allowed: boolean; reason?: string } => {
    if (selectedFiles.length + count > MAX_FILES_PER_SESSION) {
      return { allowed: false, reason: language === 'vi' 
        ? `Chi co the dinh kem toi da ${MAX_FILES_PER_SESSION} file/phien chat.`
        : `Max ${MAX_FILES_PER_SESSION} files per session.` };
    }
    if (totalFilesUploaded + count > MAX_FILES_TOTAL) {
      return { allowed: false, reason: language === 'vi'
        ? `Da dat gioi han ${MAX_FILES_TOTAL} file. Vui long dang nhap de tang gioi han.`
        : `Reached total limit of ${MAX_FILES_TOTAL} files.` };
    }
    return { allowed: true };
  };

  const handleFileAttach = () => {
    if (fileQuotaExhausted) return;
    setShowAttachmentModal(true);
  };

  // Handle attachment option selection from modal
  const handleAttachmentOptionSelect = (option: 'document' | 'image' | 'camera' | 'ocr') => {
    setShowAttachmentModal(false);

    const acceptMap: Record<string, string> = {
      document: '.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.md',
      image: 'image/*',
      camera: 'image/*',
      ocr: 'image/*',
    };

    // For camera and ocr, we could trigger camera mode
    if (option === 'camera' || option === 'ocr') {
      // Open camera/file input for now
      triggerFileInput(acceptMap[option]);
      return;
    }

    triggerFileInput(acceptMap[option]);
  };

  // Helper function to trigger file input
  const triggerFileInput = (accept: string) => {
    const limitCheck = canAddFiles();
    if (!limitCheck.allowed) {
      alert(limitCheck.reason);
      return;
    }

    if (fileQuotaExhausted) {
      usePaywallModalStore.getState().open('file_upload_exhausted');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.click();
  };

  const handleAttachmentSelect = (_type: string, accept: string) => {
    // Check session limit before opening file picker
    const limitCheck = canAddFiles();
    if (!limitCheck.allowed) {
      alert(limitCheck.reason);
      setShowAttachmentModal(false);
      return;
    }

    // ⭐ Check monthly file upload quota
    if (fileQuotaExhausted) {
      setShowAttachmentModal(false);
      usePaywallModalStore.getState().open('file_upload_exhausted');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true; // Allow multiple file selection
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Check limit again with actual file count
        const limitCheck = canAddFiles(files.length);
        if (!limitCheck.allowed) {
          alert(limitCheck.reason);
          return;
        }
        
        // Add placeholder files with loading state immediately
        const placeholders = Array.from(files).map((file, index) => ({
          fileId: `placeholder-${file.name}-${Date.now()}-${index}`,
          name: file.name,
          type: file.type,
          size: file.size,
          isLoading: true as boolean,
        }));
        
        // Get the starting index of these files
        const startIndex = selectedFiles.length;
        
        // Add placeholders first to show loading state
        setSelectedFiles(prev => [...prev, ...placeholders]);
        
        // Update total files
        const newTotal = totalFilesUploaded + placeholders.length;
        setTotalFilesUploaded(newTotal);
        localStorage.setItem('mada-total-files-uploaded', String(newTotal));
        
        // Process files in background
        const processedFiles = await Promise.all(
          Array.from(files).map(async (file, index) => {
            const fileId = `batch-${file.name}-${Date.now()}-${index}`;
            const fileData: { fileId: string; name: string; type: string; size: number; content?: string; originalFile?: File; isLoading: boolean } = {
              fileId,
              name: file.name,
              type: file.type,
              size: file.size,
              isLoading: true,
            };
            
            // Đọc nội dung file
            try {
              if (file.type.startsWith('image/')) {
                // Image - convert to base64 for preview
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                  reader.onload = (e) => resolve(e.target?.result as string);
                });
                reader.readAsDataURL(file);
                fileData.content = await base64Promise;
              } else if (file.type.startsWith('text/') || 
                  file.name.endsWith('.txt') || 
                  file.name.endsWith('.md') ||
                  file.name.endsWith('.json')) {
                const text = await file.text();
                fileData.content = text;
              } else if (file.type === 'application/pdf') {
                // PDF - gửi file lên server để parse
                // Lưu file để gửi kèm request
                fileData.content = t('chat.pdfFilePending');
                fileData.originalFile = file; // Lưu file gốc để gửi lên server
              } else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
                // DOCX - đọc bằng mammoth
                const arrayBuffer = await file.arrayBuffer();
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ arrayBuffer });
                fileData.content = result.value.slice(0, 10000);
              } else if (file.type.includes('excel') || file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                // Excel/CSV - server sẽ parse bằng xlsx library
                fileData.content = t('chat.pdfFilePending');
                fileData.originalFile = file;
              } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|webm|aac|m4a|flac)$/i.test(file.name)) {
                // Audio - server sẽ transcribe bằng Whisper API
                fileData.content = t('chat.pdfFilePending');
                fileData.originalFile = file;
              } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) {
                // Video - server sẽ trích xuất audio + transcribe
                fileData.content = t('chat.pdfFilePending');
                fileData.originalFile = file;
              } else {
                // Các loại file khác - thử đọc như text
                try {
                  fileData.content = await file.text();
                } catch {
                  fileData.content = t('chat.binaryFile').replace('{{name}}', file.name);
                }
              }
            } catch (err) {
              console.error('Error reading file:', err);
              fileData.content = t('chat.cannotReadFile');
            }
            
            fileData.isLoading = false;
            console.log('[MADA] File processed:', fileData);
            return fileData;
          })
        );
        
        // Update files with processed content
        setSelectedFiles(prev => {
          const updated = [...prev];
          processedFiles.forEach((processed, idx) => {
            updated[startIndex + idx] = processed;
          });
          return updated;
        });
      }
    };
    
    input.click();
    setShowAttachmentModal(false);
  };

  const handleRemoveFile = (index: number) => {
    const file = selectedFiles[index];
    
    // If file is still loading, mark it as cancelling
    if (file && file.isLoading && file.fileId) {
      setCancellingFiles(prev => new Set(prev).add(file.fileId!));
    }
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch content from URL
  const handleFetchUrl = async () => {
    if (!urlInputValue.trim()) return;

    let url = urlInputValue.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setIsFetchingUrl(true);
    setShowAttachmentModal(false);

    try {
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (data.success) {
        // Thêm vào selectedFiles để gửi cùng chat
        setSelectedFiles(prev => [...prev, {
          fileId: `url-${Date.now()}`,
          name: data.data?.title || new URL(url).hostname,
          type: 'text/url',
          size: (data.data?.content || '').length,
          content: data.data?.content || '',
        }]);

        // Không hiển thị tin nhắn riêng - nội dung URL sẽ được gửi cùng câu hỏi tiếp theo
        // Đóng input và clear
        setShowUrlInput(false);
        setUrlInputValue('');
      } else {
        addMessage({
          role: 'assistant',
          content: t('chat.urlLoadError'),
        });
      }
    } catch (error) {
      console.error('Fetch URL error:', error);
      addMessage({
        role: 'assistant',
        content: t('chat.urlError'),
      });
    } finally {
      setIsFetchingUrl(false);
      setUrlInputValue('');
      setShowUrlInput(false);
    }
  };

  const handleConsultationSubmit = (data: { name: string; email: string; phone: string; message: string; attachments?: { name: string; type: string; size: number }[] }) => {
    console.log('Consultation submitted:', data);
    addMessage({
      role: 'user',
      content: t('chat.consultationSent'),
    });
  };

  return (
    <div 
      id="main-content"
      className="flex h-screen bg-[#f9f9ff] dark:bg-[#191b23] overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-violet-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-dashed border-violet-400">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-600 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  file_upload
                </span>
              </div>
              <p className="text-xl font-bold text-violet-700">
                {t('chat.dropFiles')}
              </p>
              <p className="text-sm text-slate-500">
                {t('chat.supportedFormats')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={() => {}}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
      />
      <input
        type="file"
        ref={imageInputRef}
        onChange={() => {}}
        className="hidden"
        accept="image/*"
      />

      {/* Consultation Modal */}
      <ConsultationModal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        onSubmit={handleConsultationSubmit}
        language={language}
      />

      {/* ============== SIDEBAR ============== */}
      <aside
        className={clsx(
          'h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shrink-0',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden',
          'max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50',
          !sidebarOpen && 'max-md:-translate-x-full'
        )}
      >
          {/* Logo Area */}
          <div className="p-4 border-b border-white/50 shrink-0">
            <div className="flex items-center justify-between">
              {/* Close button on mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                aria-label={t('chat.closeMenu')}
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
              {/* Logo */}
              <div className={clsx(sidebarOpen ? 'flex-1 flex justify-center' : 'hidden')}>
                <img src={madaLogo} alt="MADA" className="h-14" />
              </div>
              {/* Spacer for alignment when close button is hidden on desktop */}
              <div className="hidden md:block w-8" />
            </div>
          </div>

        {/* New Chat Button */}
        <div className="px-4 mb-3 mt-2 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full text-white rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-semibold shadow-md hover:opacity-90 transition-all bg-primary hover:bg-primary/90 text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('chat.newChat')}
          </button>
        </div>

        {/* Use Widget Button - Only for Admin/Super Admin */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <div className="px-4 mb-3 shrink-0">
            <button
              onClick={() => navigate('/guest-widget')}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-amber-500/30"
            >
              <span className="material-symbols-outlined text-base">widgets</span>
              <span>{t('chat.useWidget')}</span>
            </button>
          </div>
        )}

        {/* All Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          
          {/* ⭐ Collapsible Bot Section Header - Compact Pill Style */}
          <div 
            className="flex items-center justify-between mx-3 my-2 px-3 py-2 rounded-xl cursor-pointer bg-slate-100/80 hover:bg-slate-200/80 transition-all border border-slate-200/60 group"
            onClick={() => setIsBotsCollapsed(!isBotsCollapsed)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-base flex-shrink-0 group-hover:scale-110 transition-transform">smart_toy</span>
              <span className="text-xs font-bold text-slate-700 truncate">
                {language === 'vi' ? '7 Chuyên Gia AT' : language === 'en' ? '7 AT Specialists' : language === 'ar' ? '7 متخصصين AT' : '7 Spécialistes AT'}
              </span>
            </div>
            <span className={clsx(
              'material-symbols-outlined text-slate-400 text-sm flex-shrink-0 transition-transform duration-200',
              isBotsCollapsed ? 'rotate-90' : '-rotate-90'
            )}>
              expand_more
            </span>
          </div>

          {/* ⭐ Category Navigation - Collapsible */}
          {!isBotsCollapsed && (
            <nav className="space-y-0.5 px-2.5 py-1.5">
              {sortedCategories.map((category) => {
                const isActive = activeCategory === category;
                const label = CATEGORY_LABELS[category];

                const categoryColors: Record<ATCategory, { bg: string; icon: string; active: string; activeText: string; activeIconBg: string }> = {
                  vision: { bg: 'bg-violet-100', icon: 'text-violet-600', active: 'bg-violet-50 ring-1 ring-violet-400', activeText: 'text-violet-700', activeIconBg: 'bg-violet-100' },
                  hearing: { bg: 'bg-indigo-100', icon: 'text-indigo-600', active: 'bg-indigo-50 ring-1 ring-indigo-400', activeText: 'text-indigo-700', activeIconBg: 'bg-indigo-100' },
                  mobility: { bg: 'bg-emerald-100', icon: 'text-emerald-600', active: 'bg-emerald-50 ring-1 ring-emerald-400', activeText: 'text-emerald-700', activeIconBg: 'bg-emerald-100' },
                  cognition: { bg: 'bg-rose-100', icon: 'text-rose-500', active: 'bg-rose-50 ring-1 ring-rose-400', activeText: 'text-rose-700', activeIconBg: 'bg-rose-100' },
                  communication: { bg: 'bg-amber-100', icon: 'text-amber-600', active: 'bg-amber-50 ring-1 ring-amber-400', activeText: 'text-amber-700', activeIconBg: 'bg-amber-100' },
                  daily_living: { bg: 'bg-purple-100', icon: 'text-purple-600', active: 'bg-purple-50 ring-1 ring-purple-400', activeText: 'text-purple-700', activeIconBg: 'bg-purple-100' },
                  education: { bg: 'bg-teal-100', icon: 'text-teal-600', active: 'bg-teal-50 ring-1 ring-teal-400', activeText: 'text-teal-700', activeIconBg: 'bg-teal-100' },
                };
                const colors = categoryColors[category];

                return (
                  <button
                    key={category}
                    onClick={() => {
                      if (isActive) {
                        setActiveCategory(null);
                      } else {
                      const hasMessages = messages.length > 0;
                      if (hasMessages && activeConversationId && messages.length > 0) {
                        addOrUpdateConversation({
                          id: activeConversationId,
                          title: messages[0]?.content?.slice(0, 40) || t('chat.conversation'),
                          date: new Date().toISOString().slice(0, 10),
                          preview: messages[messages.length - 1]?.content ?? '',
                          messages: messages.length,
                          pinned: false,
                          category: activeCategory,
                          createdAt: Date.now() - 60_000,
                          updatedAt: Date.now(),
                        });
                      }
                      window.speechSynthesis?.cancel();
                      setSpeakingId(null);
                      clearMessages();
                      setActiveConversationId(null);
                      setInputValue('');
                      setStreamingContent('');
                      setActiveCategory(category);
                    }

                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors rounded-lg group',
                    isActive
                      ? colors.active
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  )}>
                  <div className={clsx(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                    isActive ? colors.activeIconBg : colors.bg
                  )}>
                    <span className={clsx(
                      'material-symbols-outlined text-sm',
                      isActive ? colors.icon : colors.icon
                    )}>
                      {CATEGORY_ICONS[category]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={clsx(
                      'text-[11px] font-bold uppercase tracking-tight leading-tight',
                      isActive ? colors.activeText : 'text-slate-600'
                    )}>
                      {language === 'vi' ? label.title : language === 'en' ? label.titleEn : language === 'ar' ? label.titleAr : label.titleFr}
                    </p>
                    <p className={clsx(
                      'text-[10px] truncate mt-0.5',
                      isActive ? 'text-slate-500' : 'text-slate-400'
                    )}>
                      {language === 'vi' ? label.desc : language === 'en' ? label.descEn : language === 'ar' ? label.descAr : label.descFr}
                    </p>
                  </div>
                </button>
              );
            })}
            </nav>
          )}

          {/* Sample Questions - Hiển thị khi có category được chọn (Ưu tiên custom questions từ Admin, fallback sang SAMPLE_QUESTIONS) */}
          {activeCategory && (
            (() => {
              // Ưu tiên custom questions từ API, fallback sang SAMPLE_QUESTIONS
              const customQ = customQuestions[activeCategory];
              const defaultQ = SAMPLE_QUESTIONS[activeCategory]?.[viewMode]?.[language];
              const questions = customQ?.length > 0 ? customQ : (defaultQ || []);
              
              if (questions.length === 0) return null;
              
              return (
                <div className="mt-3 pt-3 border-t border-slate-100 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 px-3 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">lightbulb</span>
                    {t('chat.suggestedQuestions')}
                    {customQ?.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-[9px] rounded-full">Admin</span>
                    )}
                  </p>
                  <div className="space-y-0.5 px-2 pb-1">
                    {questions.slice(0, 4).map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSampleQuestion(question)}
                        className={clsx(
                          'w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left',
                          'text-[11px] text-slate-600 hover:bg-violet-50 hover:text-violet-700',
                          'transition-colors duration-150 group'
                        )}
                      >
                        <span className="text-violet-400 group-hover:text-violet-500 mt-0 flex-shrink-0 text-sm leading-none">
                          •
                        </span>
                        <span className="line-clamp-2 leading-snug">{question}</span>
                      </button>
                    ))}
                    {questions.length > 4 && (
                      <button className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                        {language === 'vi' ? `Xem thêm ${questions.length - 4} câu` :
                         language === 'en' ? `Show ${questions.length - 4} more` :
                         language === 'ar' ? `عرض ${questions.length - 4} أخرى` :
                         `Voir ${questions.length - 4} de plus`}
                        <span className="material-symbols-outlined text-sm">expand_more</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          {/* ⭐ Thông tin bổ trợ - HIỂN THỊ CHUNG CHO TẤT CẢ CÁC BOT (Ưu tiên custom questions từ Admin) */}
          {activeCategory && activeCategory !== 'education' && (
            (() => {
              const customQ = customQuestions['education'];
              const defaultQ = SAMPLE_QUESTIONS['education']?.[viewMode]?.[language];
              const questions = customQ?.length > 0 ? customQ : (defaultQ || []);
              
              if (questions.length === 0) return null;
              
              return (
                <div className="mt-3 pt-3 border-t border-indigo-100 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 px-4 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    {language === 'vi' ? 'Thông tin bổ trợ' : language === 'en' ? 'Supplementary Information' : language === 'ar' ? 'معلومات إضافية' : 'Informations supplémentaires'}
                  </p>
                  <div className="space-y-1 px-2">
                    {questions.slice(0, 4).map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          // Switch to education category first, then send question
                          setActiveCategory('education');
                          setTimeout(() => handleSelectSampleQuestion(question), 50);
                        }}
                        className={clsx(
                          'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left',
                          'text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-700',
                          'transition-colors duration-200 group'
                        )}
                      >
                        <span className="text-indigo-400 group-hover:text-indigo-500 mt-0.5 flex-shrink-0">
                          +
                        </span>
                        <span className="line-clamp-2 leading-relaxed">{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          {/* Custom Agents (không thuộc 7 category cố định) */}
          {agents.filter(a => a.isActive && !a.madaCategory).map((agent) => {
            const isActive = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => {
                  const hasMessages = messages.length > 0;
                  if (hasMessages && activeConversationId && messages.length > 0) {
                    addOrUpdateConversation({
                      id: activeConversationId,
                      title: messages[0]?.content?.slice(0, 40) || t('chat.conversation'),
                      date: new Date().toISOString().slice(0, 10),
                      preview: messages[messages.length - 1]?.content ?? '',
                      messages: messages.length,
                      pinned: false,
                      category: activeCategory,
                      createdAt: Date.now() - 60_000,
                      updatedAt: Date.now(),
                    });
                  }
                  window.speechSynthesis?.cancel();
                  setSpeakingId(null);
                  clearMessages();
                  setActiveConversationId(null);
                  setInputValue('');
                  setStreamingContent('');
                  setActiveCategory(null);
                  useSelectedAgentStore.getState().setSelectedAgentId(agent.id);

                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={clsx(
                  'w-full flex items-center gap-4 px-5 py-3.5 transition-colors rounded-xl group',
                  isActive
                    ? 'bg-orange-50 ring-1 ring-orange-300'
                    : 'text-slate-500 hover:bg-surface-container-low hover:text-on-background'
                )}
              >
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-lg',
                  isActive ? 'bg-orange-100' : 'bg-orange-100'
                )}>
                  <span className={clsx(
                    isActive ? 'text-orange-600' : 'text-orange-600'
                  )}>
                    {agent.avatar}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={clsx(
                    'text-sm font-bold uppercase tracking-tight',
                    isActive ? 'text-orange-700' : 'text-slate-700'
                  )}>
                    {getAgentDisplayName(agent.id, agent.name, language)}
                  </p>
                  <p className={clsx(
                    'text-xs truncate',
                    isActive ? 'text-orange-500' : 'text-on-surface-variant'
                  )}>
                    {agent.description || t('chat.customAgent')}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Recent Chats Section - Scrollable với 7 con bot (chung scroll) */}
          <div className="border-t border-slate-200/80 mt-2">
            <button 
              onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
              className="flex items-center justify-between mx-3 my-2 px-3 py-2 w-full hover:bg-slate-100/80 rounded-xl transition-all cursor-pointer"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t('chat.recentHistory')}
              </span>
              <div className="flex items-center gap-1.5">
                {historyConversations.length > 0 && (
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {historyConversations.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isHistoryCollapsed ? '-rotate-90' : 'rotate-0'}`} />
              </div>
            </button>

            {!isHistoryCollapsed && (
              <>
              <div className="px-2 mb-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder={t('chat.searchConversations')}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 text-slate-700 placeholder:text-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* History list - KHÔNG có max-h để scroll chung với 7 con bot */}
              <div className="px-1 space-y-1 pb-2">
              {historyConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center px-4 py-4 text-slate-400">
                  <MessageSquare className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-xs font-medium">{t('chat.noChatsYet')}</p>
                  <p className="text-[10px] mt-1 opacity-70">{t('chat.startToSave')}</p>
                </div>
              )}

              {filteredConversations().reduce((acc, conv, idx, arr) => {
                const prevDate = idx > 0 ? formatRelativeDate(arr[idx - 1].updatedAt) : null;
                const curDate = formatRelativeDate(conv.updatedAt);
                const showHeader = prevDate !== curDate;
                acc.push(
                  <div key={conv.id}>
                    {showHeader && (
                      <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        {curDate}
                      </p>
                    )}
                    <button
                      title={formatFullDateTime(conv.updatedAt)}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={clsx(
                        'w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left group',
                        conv.id === activeConversationId
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-slate-50 text-slate-600'
                      )}
                    >
                      <MessageSquare className={clsx('w-3.5 h-3.5 mt-0.5 flex-shrink-0', conv.id === activeConversationId ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[11px] font-semibold truncate">{conv.title}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{conv.preview}</p>
                        <p className="text-[9px] text-slate-300 mt-0.5 group-hover:hidden">{formatFullDateTime(conv.updatedAt)}</p>
                      </div>
                    </button>
                  </div>
                );
                return acc;
              }, [] as React.ReactNode[])}
            </div>
            </>
            )}
          </div>
        </div>

        {/* User Profile */}
        <div className="shrink-0 p-4 mx-3 mb-3 border-t border-slate-100 bg-white">
          <div className="bg-slate-50 rounded-2xl p-4">
            <button
              type="button"
              onClick={() => user ? setShowProfileMenu(!showProfileMenu) : authModal.open('login')}
              className="w-full flex items-center gap-3 text-left"
            >
              {user ? (
                <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-black text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <img
                  alt={t('chat.guest')}
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-white"
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous-mada&backgroundColor=e0e7ff"
                />
              )}
              <div className="flex-1 min-w-0">
                {user ? (
                  <>
                    <p className="text-sm font-bold truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold truncate">{t('chat.guest')}</p>
                    <p className="text-xs text-slate-400 truncate">{t('chat.notLoggedIn')}</p>
                  </>
                )}
              </div>
              <ChevronRight className={clsx('w-4 h-4 text-slate-400 transition-transform', showProfileMenu && 'rotate-90')} />
            </button>

            {showProfileMenu && user && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute left-4 right-4 bottom-24 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    <span className={clsx(
                      'inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest',
                      user.plan === 'pro'
                        ? 'bg-violet-100 text-violet-700'
                        : user.plan === 'enterprise'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                    )}>
                      {user.plan}
                    </span>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t('chat.profile')}
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('chat.upgradePlan')}
                    </button>
                    <hr className="my-1 border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('chat.logout')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ============== MAIN CONTENT ============== */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        
        {/* Top Navigation Bar - Glass Morphism - Unified Style */}
        <header className="hidden md:flex items-center justify-between p-4 bg-white/40 backdrop-blur-md border-b border-white/40 z-20 sticky top-0 h-16">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Status Badge - Premium */}
            <div className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full border border-white/80">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-sm font-semibold text-on-background">
                {isEndUser ? t('chat.premiumIntelligence') : t('chat.atSpecialistMode')}
              </span>
            </div>
          </div>
          
          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Quota Indicator */}
            <QuotaIndicator />

            {/* Divider */}
            <div className="w-px h-6 bg-outline-variant/50"></div>
            
            {/* Language Selector - Dropdown Style */}
            <div className="relative" data-language-dropdown>
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-full border border-white/80 hover:bg-white/80 transition-colors"
              >
                <Globe className="w-4 h-4 text-slate-600" />
                <span className="text-base">{LANGUAGES.find(l => l.code === language)?.flag}</span>
                <span className="text-sm font-medium text-on-background hidden lg:inline">{LANGUAGES.find(l => l.code === language)?.name}</span>
                <ChevronDown className={clsx('w-4 h-4 text-on-surface-variant transition-transform', showLanguageMenu && 'rotate-180')} />
              </button>

              {showLanguageMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 bg-white border border-black/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                  dir="ltr"
                >
                  <div className="p-2 space-y-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as Language);
                          setShowLanguageMenu(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                          language === lang.code
                            ? 'bg-emerald-500 text-white'
                            : 'hover:bg-gray-50 text-gray-700'
                        )}
                      >
                        <span className="text-lg flex-shrink-0">{lang.flag}</span>
                        <span className={clsx(
                          'flex-1 text-left text-sm font-medium',
                          language === lang.code ? 'text-white' : ''
                        )}>
                          {lang.name}
                        </span>
                        <span className={clsx(
                          'text-xs',
                          language === lang.code ? 'text-white/80' : 'text-gray-400'
                        )}>
                          {lang.code.toUpperCase()}
                        </span>
                        {language === lang.code && (
                          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Chat Area - Welcome State */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {messages.length === 0 && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-start pt-16 px-4 md:px-8">
              <div className="w-full max-w-4xl mx-auto">
                
                {/* Welcome Section */}
                <div className="text-center mb-10 max-w-2xl mx-auto">
                  {/* Welcome Typography */}
                  <h2 className="text-2xl font-bold text-on-background mb-2">
                    {greeting[language] || greeting.vi}
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {description[language] || description.vi}
                  </p>

                  {/* Language Selector đã được chuyển lên Header Bar - chỉ giữ 1 chỗ duy nhất */}
                </div>

                {/* Section Header: Câu hỏi gợi ý */}
                {showSuggestedQuestions && (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {t('chat.suggestedQuestions')}
                    </h3>
                  </div>
                </div>
                )}

                {/* Prompt Cards Grid - Material Design 3 Style */}
                {showSuggestedQuestions && (
                <div className="w-full max-w-3xl">
                  <div className="grid grid-cols-2 gap-3">
                    {(activeCategory ? currentQuestions : suggestedPrompts.map(prompt => ({
                      text: language === 'vi' ? prompt.text : prompt.textEn,
                      desc: language === 'vi' ? prompt.desc : prompt.descEn,
                      icon: prompt.icon,
                    }))).map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue(typeof item === 'string' ? item : item.text);
                        }}
                        className="group bg-white border border-outline-variant rounded-2xl p-4 text-left hover:shadow-lg hover:border-primary/30 transition-all duration-200"
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon chỉ hiện khi KHÔNG có category đang chọn */}
                          {!activeCategory && (
                            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0 group-hover:bg-primary-fixed-dim transition-colors">
                              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {typeof item === 'string' ? (index === 0 ? 'search' : index === 1 ? 'smart_toy' : index === 2 ? 'support_agent' : 'bolt') : item.icon}
                              </span>
                            </div>
                          )}
                          <div className={clsx('flex-1 min-w-0', !activeCategory && '')}>
                            <p className="text-sm font-semibold text-on-background mb-1 line-clamp-1">
                              {typeof item === 'string' ? item : item.text}
                            </p>
                            <p className="text-xs text-on-surface-variant line-clamp-2">
                              {typeof item === 'string' ? '' : item.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col h-full w-full">
              {/* Agent Header */}
              <div className="flex items-center mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h2 className="font-bold text-slate-900 uppercase tracking-tight">
                    {activeCategory 
                      ? (language === 'vi' ? CATEGORY_LABELS[activeCategory].title : language === 'en' ? CATEGORY_LABELS[activeCategory].titleEn : language === 'ar' ? CATEGORY_LABELS[activeCategory].titleAr : CATEGORY_LABELS[activeCategory].titleFr)
                      : t('chat.supplementaryInfo')}
                  </h2>
                </div>
              </div>

              {/* Messages */}
              <div 
                className="flex-1 space-y-6 mb-8 overflow-y-auto pb-48 hide-scrollbar"
                ref={messagesContainerRef}
                onScroll={(e) => {
                  // Debounce scroll detection - Fix null reference
                  if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                  }
                  scrollTimeoutRef.current = setTimeout(() => {
                    const target = e.currentTarget as HTMLElement | null;
                    if (!target) return;
                    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                    // User is at bottom if within 50px
                    const isAtBottom = distanceFromBottom < 50;
                    setUserHasScrolled(!isAtBottom);
                  }, 100);
                }}
              >
                {messages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    onCopy={handleCopy}
                    copiedId={copiedId}
                    onSpeak={speakText}
                    speakingId={speakingId}
                    onRequestConsultation={() => setShowConsultationModal(true)}
                    language={language}
                    activeConversationId={activeConversationId}
                  />
                ))}

                {/* Streaming indicator */}
                {streamingContent && (
                  <div className={`flex items-start gap-3 animate-fade-in ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className={`flex-1 max-w-[80%] px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 ${language === 'ar' ? 'rounded-br-none' : 'rounded-bl-none'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language === 'ar' ? 'ar' : language === 'vi' ? 'vi' : language === 'en' ? 'en' : 'fr'}>
                      <div className="text-sm whitespace-pre-wrap [&_p]:mb-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                        <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && !streamingContent && (
                  <div className="flex items-start gap-3 animate-fade-in">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

            </div>
          )}
        </div>

        {/* ============== INPUT AREA - Sticky Bottom Bar ============== */}
        <div className="bg-[#f9f9ff] pt-4 pb-6 px-4 md:px-8 border-t border-slate-200/50">
          <div className="max-w-3xl mx-auto relative flex flex-col">

            {/* File upload status with limits */}
            {fileAttachmentEnabled && selectedFiles.length > 0 && (
              <div className="mb-3">
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-full px-4 py-2 flex flex-col gap-1 w-full relative overflow-hidden">
                <div className="flex justify-between items-center w-full z-10 text-[11px] text-[#3b82f6] font-medium">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] transform rotate-45">attach_file</span>
                    {language === 'vi' ? `${selectedFiles.length}/${MAX_FILES_PER_SESSION} tệp (phiên này)` : language === 'en' ? `${selectedFiles.length}/${MAX_FILES_PER_SESSION} files (this session)` : language === 'ar' ? `${selectedFiles.length}/${MAX_FILES_PER_SESSION} ملفات (هذه الجلسة)` : `${selectedFiles.length}/${MAX_FILES_PER_SESSION} fichiers (cette session)`}
                  </div>
                  <span className="">{language === 'vi' ? `Tổng đã dùng: ${totalFilesUploaded}/${MAX_FILES_TOTAL}` : language === 'en' ? `Total used: ${totalFilesUploaded}/${MAX_FILES_TOTAL}` : language === 'ar' ? `الإجمالي المستخدم: ${totalFilesUploaded}/${MAX_FILES_TOTAL}` : `Total utilisé: ${totalFilesUploaded}/${MAX_FILES_TOTAL}`}</span>
                </div>
                <div className="w-full bg-[#dbeafe] h-1.5 rounded-full z-10">
                  <div 
                    className="bg-[#3b82f6] h-1.5 rounded-full"
                    style={{ width: `${Math.min((selectedFiles.length / MAX_FILES_PER_SESSION) * 100, 100)}%` }}
                  />
                </div>
              </div>
              </div>
            )}

            {/* File attachments display - Grid 2 cột, full width bên ngoài pill input */}
            {fileAttachmentEnabled && selectedFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 w-full" role="list" aria-label={t('chat.attachedFilesList')}>
                {selectedFiles.map((file, index) => {
                  const isError = file.size > 50 * 1024 * 1024; // 50MB limit
                  const status = file.isLoading ? 'loading' : isError ? 'error' : 'ready';

                  // Helper format file size
                  const formatSize = (bytes: number) => {
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };

                  // Determine file type category for styling
                  const isDocument = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(file.type) || /\.(pdf|docx?|xlsx?|xls|csv)$/i.test(file.name);
                  const isImage = file.type.startsWith('image/');
                  const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|webm|aac|m4a|flac)$/i.test(file.name);
                  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name);
                  const isText = file.type.startsWith('text/') || /\.(txt|md|json|xml|html|css|js|ts)$/i.test(file.name);

                  // Get preview text for non-image files
                  const getPreviewText = () => {
                    if (!file.content || isImage) return null;
                    const text = file.content.slice(0, 120);
                    return text.length < file.content.length ? `${text}...` : text;
                  };
                  const previewText = getPreviewText();

                  // Get file type label
                  const getTypeLabel = () => {
                    if (isDocument) return t('chat.document');
                    if (isAudio) return t('chat.audio');
                    if (isVideo) return t('chat.video');
                    if (isText) return t('chat.text');
                    return '';
                  };

                  return (
                    <div
                      key={index}
                      role="listitem"
                      className={clsx(
                        'group/file relative flex items-start gap-2.5 rounded-xl border px-3 py-2 transition-all min-w-0',
                        status === 'ready' && 'bg-white border-emerald-300 hover:border-emerald-500 hover:shadow-md',
                        status === 'loading' && 'bg-blue-50 border-blue-300',
                        status === 'error' && 'bg-red-50 border-red-300'
                      )}
                      aria-label={`${file.name} - ${status}`}
                    >
                      {/* File type icon */}
                      <div className={clsx(
                        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                        isDocument && 'bg-purple-100 text-purple-600',
                        isImage && 'bg-pink-100 text-pink-600',
                        isAudio && 'bg-amber-100 text-amber-600',
                        isVideo && 'bg-indigo-100 text-indigo-600',
                        isText && 'bg-teal-100 text-teal-600',
                        !isDocument && !isImage && !isAudio && !isVideo && !isText && 'bg-slate-100 text-slate-600'
                      )}>
                        {isDocument ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                        ) : isImage ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
                        ) : isAudio ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                        ) : isVideo ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>videocam</span>
                        ) : isText ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>article</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>attach_file</span>
                        )}
                      </div>

                      {/* File info - flex-1 min-w-0 để truncate đúng */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {file.name}
                          </p>
                          {getTypeLabel() && (
                            <span className={clsx(
                              'flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide',
                              isDocument && 'bg-purple-100 text-purple-700',
                              isAudio && 'bg-amber-100 text-amber-700',
                              isVideo && 'bg-indigo-100 text-indigo-700',
                              isText && 'bg-teal-100 text-teal-700',
                            )}>
                              {getTypeLabel()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 min-w-0">
                          {status === 'ready' && (
                            <>
                              <span className="material-symbols-outlined text-[12px] text-emerald-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                                check_circle
                              </span>
                              <span className="text-[10px] font-medium text-emerald-700 truncate">
                                {language === 'vi' ? `Sẵn sàng · ${formatSize(file.size)}` : `Ready · ${formatSize(file.size)}`}
                              </span>
                            </>
                          )}
                          {status === 'loading' && (
                            <>
                              <Loader2 className="w-3 h-3 text-blue-600 animate-spin flex-shrink-0" />
                              <span className="text-[10px] font-medium text-blue-700 truncate">
                                {t('chat.processing')}
                              </span>
                            </>
                          )}
                          {status === 'error' && (
                            <>
                              <span className="material-symbols-outlined text-[12px] text-red-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                                error
                              </span>
                              <span className="text-[10px] font-medium text-red-700 truncate">
                                {t('chat.tooLarge')}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Show preview text for non-image files */}
                        {previewText && (
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate italic">
                            📝 {previewText}
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      {!file.isLoading && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-500 hover:text-red-600 transition-all hover:scale-110"
                          title={t('chat.remove')}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}

                      {/* Loading overlay */}
                      {file.isLoading && (
                        <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center pointer-events-none">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Redesigned Pill Input with Layered Shadow - Material Design 3 Style */}
            <div className="relative">
              {/* Floating Lightning Icon */}
              <div className="absolute -top-3 -right-3 z-50">
                <div className="w-8 h-8 bg-secondary-container rounded-full flex items-center justify-center border-[2px] border-on-background shadow-[3px_3px_0_0_rgba(25,27,35,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(25,27,35,1)] transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                </div>
              </div>

              {/* Shadow Layer */}
              <div className="absolute inset-0 bg-slate-900 rounded-full translate-y-[2px] -z-10"></div>
              
              <div className={clsx(
                'bg-white border-[3px] border-on-background rounded-full flex items-center gap-2 relative z-10',
                fileAttachmentEnabled ? 'p-1.5' : 'px-3 py-1.5'
              )}>
                {/* Left Icons - Attachment Button */}
                {fileAttachmentEnabled && (
                <div className="flex items-center gap-1 pl-1 relative" ref={attachmentMenuRef}>
                  <button
                    onClick={handleFileAttach}
                    disabled={fileQuotaExhausted}
                    className={clsx(
                      'p-2 rounded-full transition-colors',
                      fileQuotaExhausted
                        ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                        : 'text-on-surface-variant hover:text-on-background hover:bg-surface-container-low'
                    )}
                    title={
                      fileQuotaExhausted
                        ? t('chat.monthlyLimitReached')
                        : 'Đính kèm tệp & Dữ liệu'
                    }
                    id="attachment-btn"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  {/* File upload quota badge — nhỏ, hiện cạnh nút attach khi có user */}
                  {user && fileQuota && fileQuota.limit !== -1 && (
                    <button
                      onClick={() => {
                        if (fileQuotaExhausted) {
                          usePaywallModalStore.getState().open('file_upload_exhausted');
                        }
                      }}
                      className={clsx(
                        'hidden md:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors',
                        fileQuotaExhausted
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                          : fileQuota.remaining <= 3
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      )}
                      title={
                        fileQuotaExhausted
                          ? t('chat.uploadQuotaExhausted')
                          : (language === 'vi' ? `Còn ${fileQuota.remaining}/${fileQuota.limit} lượt upload tháng này` : `${fileQuota.remaining}/${fileQuota.limit} uploads left this month`)
                      }
                    >
                      <span className="material-symbols-outlined text-[12px]">cloud_upload</span>
                      <span>{fileQuotaExhausted ? '0' : fileQuota.remaining}/{fileQuota.limit}</span>
                    </button>
                  )}

                  {/* Attachment Menu */}
                  <AttachmentModal
                    isOpen={showAttachmentModal}
                    onClose={() => setShowAttachmentModal(false)}
                    onSelectOption={handleAttachmentOptionSelect}
                  />
                </div>
                )}

                {/* Voice Recording Bubble - Hiển thị real-time transcript với waveform */}
                {(isRecording || isListening || transcript) && (
                  <div 
                    className="mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border-2 bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border-red-300 shadow-sm animate-fade-in"
                    role="status"
                    aria-live="polite"
                    aria-label={t('chat.recordingVoice')}
                  >
                    {/* Animated waveform bars */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <div
                          key={bar}
                          className="w-1 bg-red-500 rounded-full animate-pulse"
                          style={{
                            height: `${8 + (bar * 3)}px`,
                            animationDelay: `${bar * 0.1}s`,
                            animationDuration: '1s'
                          }}
                        />
                      ))}
                    </div>

                    {/* Mic icon với pulse animation */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                      <Mic className="w-4 h-4 text-white" />
                    </div>

                    {/* Transcript text - hiển thị interim real-time */}
                    <div className="flex-1 min-w-0">
                      {interimTranscript ? (
                        <p className="text-xs text-slate-700 italic leading-relaxed">
                          <span className="font-bold text-red-600 uppercase text-[10px] tracking-wider mr-1">
                            {t('chat.listening')}
                          </span>
                          <span className="opacity-70">{interimTranscript}</span>
                          <span className="inline-block w-1 h-3 bg-red-500 ml-0.5 animate-pulse" />
                        </p>
                      ) : transcript ? (
                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-bold text-red-600 uppercase text-[10px] tracking-wider mr-1">
                            {t('chat.recorded')}
                          </span>
                          {transcript}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          {t('chat.speakIntoMic')}
                        </p>
                      )}
                    </div>

                    {/* Status indicator */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                        REC
                      </span>
                    </div>
                  </div>
                )}

                {/* Input Field - Material Design 3 Style */}
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isEndUser ? t('chat.messageMadaAi') : t('chat.askAtSpecialist')}
                  rows={1}
                  className="flex-1 border-none focus:border-transparent focus:outline-none focus:ring-0 text-on-background bg-transparent py-2 text-sm placeholder:text-on-surface-variant/60 resize-none leading-relaxed outline-none"
                  style={{ minHeight: '40px', maxHeight: '100px' }}
                />

                {/* Right Icons & Send - Material Design 3 Style */}
                <div className="flex items-center gap-1 pr-1">
                  {/* Voice Button */}
                  <button
                    onClick={handleVoiceRecord}
                    className={clsx(
                      'p-2 rounded-full transition-all',
                      isRecording
                        ? 'bg-error text-white animate-pulse'
                        : isListening
                          ? 'bg-error/80 text-white animate-ping'
                          : 'text-on-surface-variant hover:text-on-background hover:bg-surface-container-low'
                    )}
                    title={isRecording ? t('chat.stopRecording') : t('chat.record')}
                  >
                    {isRecording || isListening ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  
                  {/* Send Button - Compact */}
                  {isGeneratingResponse ? (
                    <button
                      onClick={handleStopGeneration}
                      className="relative w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center border-[2px] border-on-background shadow-[2px_2px_0_0_rgba(25,27,35,1)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(25,27,35,1)] transition-all"
                      title={t('chat.stop')}
                    >
                      <span className="w-3 h-3 bg-white rounded-sm" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      className="relative w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center border-[2px] border-on-background shadow-[2px_2px_0_0_rgba(25,27,35,1)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(25,27,35,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5 transform rotate-[-15deg]" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ⭐ AT Specialist Suggestion Banner - clickable */}
            {showATSuggestion && (
              <button
                onClick={() => {
                  toggleViewMode();
                  setShowATSuggestion(false);
                }}
                className="w-full mx-3 mb-2 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50 animate-fadeIn hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {t('chat.relatedToAssistiveDevice')}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 flex items-center gap-1">
                      <Accessibility className="w-3 h-3" />
                      {t('chat.clickToAskAt')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                </div>
              </button>
            )}

            {/* Footer - Professional AI Support */}
            <p className="text-center text-[11px] text-on-surface-variant/70 mt-6 uppercase tracking-wider font-medium">
              {t('chat.disclaimerFooter')}
            </p>
            {/* Powered by */}
            <p className="text-center text-[10px] text-on-surface-variant/60 mt-2 tracking-wider font-mono flex items-center justify-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] leading-none animate-pulse">auto_awesome</span>
                {t('poweredBy', language)}
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============== PRODUCT CARD ITEM COMPONENT ==============
// Fixed: Move useState out of map to avoid React hooks violation
interface ProductCardItemProps {
  product: SuggestedProduct;
  language: string;
  onRequestConsultation: () => void;
}

function ProductCardItem({ product, language, onRequestConsultation }: ProductCardItemProps) {
  const [imageError, setImageError] = useState(false);
  
  // ⭐ Lấy image URL đã xử lý (có thể bị reject → trả về empty)
  const processedImageUrl = getImageUrl(product.image_url);
  
  // Thông tin sản phẩm
  const productTitle = language === 'en' && product.title_en ? product.title_en : product.title;
  const productLink = product.product_url && /^https?:\/\//i.test(product.product_url)
    ? product.product_url
    : `/products/${product.id}`;
  const isExternalLink = product.product_url && /^https?:\/\//i.test(product.product_url);
  const brandDisplay = product.brand || 'MADA';
  const madaAdvice = product.mada_advice || '';

  // Xác định màu gradient dựa trên category
  const categoryLower = (product.category || '').toLowerCase();
  let gradientClass = 'from-blue-500 to-cyan-500';
  if (categoryLower.includes('hearing') || categoryLower.includes('thính')) {
    gradientClass = 'from-cyan-500 to-blue-600';
  } else if (categoryLower.includes('vision') || categoryLower.includes('thị')) {
    gradientClass = 'from-purple-500 to-pink-500';
  } else if (categoryLower.includes('mobility') || categoryLower.includes('vận')) {
    gradientClass = 'from-emerald-500 to-teal-500';
  } else if (categoryLower.includes('cognition') || categoryLower.includes('nhận')) {
    gradientClass = 'from-amber-500 to-orange-500';
  }

  return (
    <div className="group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 transition-all duration-200 hover:-translate-y-0.5">
      {/* Hình ảnh sản phẩm - LỚN VÀ NỔI BẬT */}
      <div className={`relative h-32 bg-gradient-to-br ${gradientClass} overflow-hidden`}>
        {/* ⭐ Fix: Check processedImageUrl thay vì product.image_url */}
        {processedImageUrl && !imageError ? (
          <img
            src={processedImageUrl}
            alt={productTitle}
            className="w-full h-full object-cover object-center"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              console.warn(`[ProductImage] Failed to load: ${product.image_url} -> ${processedImageUrl}`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-400 to-slate-600">
            <Accessibility className="w-14 h-14 text-white/90" strokeWidth={1.5} />
            <span className="text-[10px] text-white/70 font-medium">AT Product</span>
          </div>
        )}

        {/* Badge brand */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full">
          <span className="text-[10px] font-semibold text-slate-700">{brandDisplay}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Tên sản phẩm */}
        <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 group-hover:text-secondary transition-colors leading-tight">
          {productTitle}
        </p>

        {/* Mô tả ngắn */}
        {madaAdvice && (
          <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
            {madaAdvice.substring(0, 60)}{madaAdvice.length > 60 ? '...' : ''}
          </p>
        )}

        {/* 2 Buttons như thiết kế */}
        <div className="mt-3 flex flex-col gap-2">
          {/* Nút chính: Xem chi tiết & Mua sản phẩm */}
          <a
            href={productLink}
            target={isExternalLink ? '_blank' : '_self'}
            rel={isExternalLink ? 'noopener noreferrer' : ''}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#006D77] to-[#0A9396] hover:from-[#005A63] hover:to-[#087E8B] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{language === 'vi' ? 'Xem chi tiết & Mua sản phẩm' : language === 'en' ? 'View Details & Buy' : language === 'ar' ? 'عرض التفاصيل والشراء' : 'Voir détails et acheter'}</span>
          </a>

          {/* Nút phụ: Liên hệ tư vấn viên */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRequestConsultation();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-[#83C5BE]/50 hover:border-[#83C5BE] text-[#006D77] text-xs font-semibold rounded-lg transition-all duration-200 hover:bg-[#EDF6F9] active:scale-[0.98]"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#83C5BE] to-[#006D77] flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
            </div>
            <span>{language === 'vi' ? 'Liên hệ tư vấn viên chuyên khoa' : language === 'en' ? 'Contact Specialist Advisor' : language === 'ar' ? 'تواصل مع مستشار متخصص' : 'Contacter un conseiller'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== PRODUCT CARDS GRID ==============
function ProductCardsGrid({ products, language, onRequestConsultation }: {
  products: SuggestedProduct[];
  language: string;
  onRequestConsultation: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {products.slice(0, 3).map((product, index) => (
        <ProductCardItem
          key={product.id || index}
          product={product}
          language={language}
          onRequestConsultation={onRequestConsultation}
        />
      ))}
    </div>
  );
}

// Message Bubble Component - SIMPLIFIED UI với Smart Product Suggestions & Feedback
function MessageBubble({
  message,
  onCopy: _onCopy,
  copiedId: _copiedId,
  onSpeak: _onSpeak,
  speakingId: _speakingId,
  onRequestConsultation,
  language = 'vi' as Language,
  activeConversationId,
}: {
  message: Message;
  onCopy: (content: string, id: string) => void;
  copiedId: string | null;
  onSpeak: (text: string, id: string) => void;
  speakingId: string | null;
  onRequestConsultation: () => void;
  language?: Language;
  activeConversationId?: string | null;
}) {
  const [showSources, _setShowSources] = useState(false);
  void showSources;

  
  // ⭐ Feedback state
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(message.feedback || null);
  const [showDislikeReason, setShowDislikeReason] = useState(false);
  const [dislikeMessageId, setDislikeMessageId] = useState<string>('');
  const [_dislikeReason, _setDislikeReason] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // ⭐ Lock body scroll when feedback modal is open
  useEffect(() => {
    if (showDislikeReason) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showDislikeReason]);

  // ⭐ Edit message state from store
  const { editingMessageId, setEditingMessage, setMessages, setLoading } = useChatStore();
  const [localEditText, setLocalEditText] = useState('');
  const currentEditingId = editingMessageId;
  
  // Detect category từ nội dung message (có thể dùng cho analytics sau)
  const detectedCategory = detectCategoryFromQuery(message.content);
  void detectedCategory;
  
  // ⭐ Submit feedback to backend
  const submitFeedback = async (rating: 'like' | 'dislike', reason?: string) => {
    if (submittingFeedback) return;
    
    setSubmittingFeedback(true);
    setFeedback(rating);
    
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: message.id,
          rating,
          reason: reason || undefined,
          language,
        }),
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (message.role === 'user') {
    const isEditing = currentEditingId === message.id;

    return (
      <div className="flex items-end gap-3 justify-end animate-fade-in group flex-col items-end">
        {/* Hiển thị file cards đã gửi */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2 justify-end mb-1 max-w-[80%]" role="list" aria-label={t('chat.sentAttachments')}>
            {message.attachments.map((attachment, idx) => (
              <div
                key={idx}
                role="listitem"
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl rounded-br-sm text-sm border-2 transition-all hover:shadow-md',
                  attachment.preview
                    ? 'bg-white/95 backdrop-blur-sm border-white/40 shadow-md'
                    : 'bg-white/90 border-white/30 shadow-sm'
                )}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                  {attachment.preview ? (
                    <img src={attachment.preview} alt={attachment.name} className="w-10 h-10 object-cover rounded-lg" />
                  ) : (
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {attachment.type.includes('pdf') ? 'picture_as_pdf' :
                       attachment.type.includes('image') ? 'image' :
                       attachment.type.includes('word') || attachment.type.includes('document') ? 'description' :
                       'attach_file'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">{attachment.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {t('chat.attached')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* User Message Bubble - Enhanced with gradient effect */}
        <div className="relative max-w-[85%]">
          {/* Gradient border effect */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-2xl rounded-tl-sm blur-[2px] opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
          
          {/* Main bubble */}
          <div className="relative bg-gradient-to-br from-[#0047ff] to-[#0033cc] text-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-all duration-300" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={localEditText}
                onChange={(e) => setLocalEditText(e.target.value)}
                className="w-full p-2 rounded-lg bg-white/20 text-white placeholder-white/60 resize-none text-sm"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setEditingMessage(null);
                    setLocalEditText('');
                  }}
                  className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm"
                >
                  {t('chat.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (localEditText.trim()) {
                      const currentMessages = useChatStore.getState().messages;
                      const msgIndex = currentMessages.findIndex(m => m.id === message.id);
                      if (msgIndex !== -1) {
                        const updatedMessages = [...currentMessages];
                        updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], content: localEditText.trim() };
                        setMessages(updatedMessages.slice(0, msgIndex + 1));
                        setLoading(true);
                        setEditingMessage(null);
                        setLocalEditText('');
                        localStorage.setItem('resendMessage', localEditText.trim());
                        window.location.reload();
                      }
                    }
                  }}
                  className="px-3 py-1 text-xs bg-white text-[#0047ff] hover:bg-white/90 rounded-full font-medium transition-colors shadow-sm"
                >
                  {t('chat.resend')}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in group">
      {/* Avatar - Enhanced with glow effect */}
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e0e7ff] to-[#c7d2fe] flex items-center justify-center flex-shrink-0 border-2 border-[#191b23] shadow-lg shadow-indigo-100/50 group-hover:shadow-xl group-hover:shadow-indigo-200/50 transition-all duration-300">
          <BotIcon className="w-5 h-5 text-[#0047ff]" />
        </div>
        {/* Online indicator dot */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
      </div>

      <div className="flex-1 max-w-[85%]">
        {/* ⭐ AI Message Content - Enhanced styling */}
        <div className="relative">
          {/* Message bubble background with gradient border effect */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-[2px] opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
          
          {/* Main message content */}
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl rounded-tl-sm border border-slate-200/50 p-4 shadow-sm group-hover:shadow-md group-hover:bg-white/90 transition-all duration-300">
            <div className="text-sm text-slate-700 leading-relaxed [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_li]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:font-bold [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-blue-500 [&_a]:underline" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* ⭐ FOOTER: Feedback + Consultation - ENHANCED UI */}
        <div className="mt-3 flex items-center justify-between gap-3">
          
          {/* ⭐ LIKE/DISLIKE Buttons - Enhanced with tooltips and animations */}
          <div className="flex items-center gap-1 relative">
            {feedback ? (
              <div className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
                feedback === 'like' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm shadow-emerald-100' 
                  : 'bg-red-50 border border-red-200 text-red-500 shadow-sm shadow-red-100'
              )}>
                {feedback === 'like' ? (
                  <>
                    <ThumbsUp className="w-4 h-4 fill-current" />
                    <span className="hidden sm:inline">{t('chat.liked')}</span>
                  </>
                ) : (
                  <>
                    <ThumbsDown className="w-4 h-4 fill-current" />
                    <span className="hidden sm:inline">{t('chat.feedbackSent')}</span>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* ⭐ Like Button - Enhanced with tooltip */}
                <div className="relative group/like">
                  <button
                    onClick={() => submitFeedback('like')}
                    disabled={submittingFeedback}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all duration-200 disabled:opacity-50 hover:scale-105 active:scale-95"
                  >
                    <ThumbsUp className="w-4 h-4 group-hover/like:fill-emerald-500 transition-all duration-200" />
                    <span className="hidden sm:inline">{t('chat.helpful')}</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/like:opacity-100 group-hover/like:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                    {t('chat.helpful')}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-800"></div>
                  </div>
                </div>
                
                {/* ⭐ Dislike Button - Enhanced with tooltip */}
                <div className="relative group/dislike">
                  <button
                    onClick={() => {
                      setDislikeMessageId(message.id);
                      setShowDislikeReason(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('chat.notHelpful')}</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/dislike:opacity-100 group-hover/dislike:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                    {t('chat.notHelpful')}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-800"></div>
                  </div>
                </div>
                
                {/* ⭐ Nút liên hệ tư vấn viên - Enhanced */}
                <div className="relative group/consult">
                  <button 
                    onClick={onRequestConsultation}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-amber-900 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 shadow-sm shadow-amber-200/50 hover:shadow-lg hover:shadow-amber-300/50 active:scale-95 border border-amber-300/50 hover:-translate-y-0.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">support_agent</span>
                    <span className="hidden sm:inline">{t('chat.consult')}</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-amber-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/consult:opacity-100 group-hover/consult:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                    {t('chat.contactConsultant')}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-amber-800"></div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* ⭐ Response Time - Enhanced with pulse animation */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-500 transition-colors duration-200">
            <span className="material-symbols-outlined text-[14px] animate-pulse">schedule</span>
            <span className="hidden sm:inline">{t('chat.responseTime')}</span>
          </div>
        </div>



        {/* ⭐ Suggested Products - Hiển thị khi server gửi sản phẩm */}
        {/* ⭐ LUÔN hiển thị khi có sản phẩm - không chờ đủ context */}
        {message.suggestedProducts && message.suggestedProducts.length > 0 && (
          <div className="mt-4" dir="ltr" role="region" aria-label="Sản phẩm được giới thiệu">

            {/* ⭐ Text giới thiệu TỰ NHIÊN - Như lời chatbot nói */}
            <p className="text-[13px] text-on-surface-variant leading-relaxed mb-3">
              {language === 'vi'
                ? `Với các biểu hiện trên của bạn thì tôi khuyên bạn nên tham khảo các sản phẩm dưới đây nhé:`
                : language === 'en'
                ? `Based on your description, I recommend checking out these products:`
                : language === 'ar'
                ? `بناءً على وصفك، أنصحك بالاطلاع على هذه المنتجات:`
                : `Selon votre description, je vous recommande de consulter ces produits:`}
            </p>

            {/* ⭐ Product Cards Grid - Sử dụng component để tránh hooks violation */}
            <ProductCardsGrid
              products={message.suggestedProducts}
              language={language}
              onRequestConsultation={onRequestConsultation}
            />
          </div>
        )}

        {/* ⭐ NEW DISLIKE FEEDBACK FORM */}
        <DislikeFeedbackForm
          isOpen={showDislikeReason}
          onClose={() => {
            setShowDislikeReason(false);
            setFeedback('dislike');
          }}
          onSubmit={() => {
            setShowDislikeReason(false);
          }}
          messageContent={message.content}
          messageId={dislikeMessageId}
          conversationId={activeConversationId || ''}
          language={language}
        />
      </div>
    </div>
  );
}

export default ChatPage;
