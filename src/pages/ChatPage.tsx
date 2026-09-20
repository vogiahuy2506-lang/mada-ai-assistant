import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, useChatHistoryStore, useLanguageStore, useAuthStore, useAnonQuotaStore, usePaywallModalStore, useAuthModalStore, useAgentStore, useSelectedAgentStore, useSystemSettingsStore, useViewModeStore, useChatSettingsStore } from '@/stores';
import madaLogo from '@/assets/mada-logo.png';
import { QuotaIndicator } from '@/components/auth/QuotaIndicator';
import { ProductCard } from '@/components/ProductCard';
import {
  Send, Plus, User, Mic,
  Volume2, ChevronDown, Check, Copy, ThumbsUp, ThumbsDown,
  Speaker, BookOpen, Bot as BotIcon, ChevronRight,
  FileText, Video, Mic2, ImageIcon, File, X,
  MessageCircle,
  LogOut, Sparkles,
  Search, MessageSquare, Loader2,
  Settings, Smartphone, Brain, Eye, Accessibility,
  Users, MoreHorizontal, Gift, Wallet, CreditCard,
  PiggyBank, Handshake, ZoomIn, PlusCircle, Monitor,
  Ear, Edit2, Globe
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CATEGORY_INFO, SAMPLE_QUESTIONS, AT_SPECIALIST_KEYWORDS, type ATCategory, type Language, type SuggestedProduct } from '@/types';
import { t } from '@/lib/translations';
import { userHistoryApi, fileQuotaApi, getAccessToken, type FileUploadQuota } from '@/lib/api';
import { onAgentChange } from '@/lib/agentBroadcast';

// Attachment options - use getAttachmentOptions(language) inside component
function getAttachmentOptions(lang: Language) {
  const labels: Record<Language, { image: string; imageDesc: string; document: string; video: string; videoDesc: string; audio: string; audioDesc: string; file: string; fileDesc: string }> = {
    vi: { image: 'Hình ảnh', imageDesc: 'Tải lên hình ảnh', document: 'Tài liệu', video: 'Video', videoDesc: 'Tải lên video', audio: 'Âm thanh', audioDesc: 'Ghi âm hoặc file', file: 'File khác', fileDesc: 'Mọi loại file' },
    en: { image: 'Image', imageDesc: 'Upload image', document: 'Document', video: 'Video', videoDesc: 'Upload video', audio: 'Audio', audioDesc: 'Record or file', file: 'Other file', fileDesc: 'All files' },
    ar: { image: 'صورة', imageDesc: 'تحميل صورة', document: 'مستند', video: 'فيديو', videoDesc: 'تحميل فيديو', audio: 'صوت', audioDesc: 'تسجيل أو ملف', file: 'ملف آخر', fileDesc: 'جميع الملفات' },
    fr: { image: 'Image', imageDesc: 'Télécharger image', document: 'Document', video: 'Vidéo', videoDesc: 'Télécharger vidéo', audio: 'Audio', audioDesc: 'Enregistrer ou fichier', file: 'Autre fichier', fileDesc: 'Tous les fichiers' },
  };
  const l = labels[lang] || labels.vi;
  
  return [
    { id: 'image', icon: ImageIcon, label: l.image, accept: 'image/*', description: l.imageDesc },
    { id: 'document', icon: FileText, label: l.document, accept: '.pdf,.doc,.docx,.txt', description: 'PDF, Word, Text' },
    { id: 'video', icon: Video, label: l.video, accept: 'video/*', description: l.videoDesc },
    { id: 'audio', icon: Mic2, label: l.audio, accept: 'audio/*', description: l.audioDesc },
    { id: 'file', icon: File, label: l.file, accept: '*/*', description: l.fileDesc },
  ];
}

// Sample questions translated by language - Sử dụng SAMPLE_QUESTIONS từ types
function getSampleQuestionsByLang(category: ATCategory, lang: Language): string[] {
  return SAMPLE_QUESTIONS[category]?.end_user?.[lang] || SAMPLE_QUESTIONS[category]?.end_user?.vi || [];
}

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const categories = Object.keys(CATEGORY_INFO) as ATCategory[];

// Category Icons
const CATEGORY_ICONS: Record<ATCategory, string> = {
  hearing: 'headphones',
  vision: 'visibility',
  communication: 'record_voice_over',
  cognition: 'psychology',
  mobility: 'accessible_forward',
  daily_living: 'commute',
  education: 'school',
};

const CATEGORY_LABELS: Record<ATCategory, { title: string; titleEn: string; titleAr: string; titleFr: string; desc: string; descEn: string; descAr: string; descFr: string }> = {
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
  vision: { 
    title: 'CẢM GIÁC - THỊ GIÁC', 
    titleEn: 'VISION SENSORY', 
    titleAr: 'الحواس - البصر',
    titleFr: 'SENS - VISION',
    desc: 'Phần mềm đọc màn hình, chữ nổi...', 
    descEn: 'Screen readers, braille displays...',
    descAr: 'قارئات الشاشة، شاشات برايل...',
    descFr: 'Lecteurs d\'écran, plages braille...',
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
  const isHearing = q.includes('thính') || q.includes('tai') || q.includes('nghe') || q.includes('hearing') || q.includes('máy trợ thính') || q.includes('hearing aid');
  const isVision = q.includes('mù') || q.includes('thị') || q.includes('nhìn') || q.includes('blind') || q.includes('vision') || q.includes('mắt') || q.includes('braille');
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
    
    // For vision
    if (isVision) {
      base.push('Phần mềm đọc màn hình nào tốt nhất?');
      base.push('Màn hình Braille giá bao nhiêu?');
      base.push('Có ứng dụng đọc văn bản cho người mù không?');
      if (isChild) base.push('Trẻ em khiếm thị nên dùng thiết bị gì?');
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
  // Vision - mắt, khiếm thị
  if (/\b(kính|mắt|khiếm thị|blind|vision|đọc màn hình|screen reader|braille|jaws|nvda|orcam|cctv|magnifier|low vision)\b/i.test(q)) {
    return 'vision';
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
  disabilityType: string;
  budget: string;
  priority: string;
  interestedDevices: string[];
  message: string;
}

// Consultation Modal Component
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
}) {
  const [formData, setFormData] = useState<ConsultationFormData>({
    name: '', email: '', phone: '',
    disabilityType: '', budget: '', priority: '',
    interestedDevices: [], message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomDeviceInput, setShowCustomDeviceInput] = useState(false);
  const [customDeviceInput, setCustomDeviceInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t('chat.validName', language);
    if (!formData.email.trim()) newErrors.email = t('chat.validEmail', language);
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('chat.validEmailFormat', language);
    if (!formData.disabilityType) newErrors.disabilityType = t('chat.validDisability', language);
    if (!formData.budget) newErrors.budget = t('chat.validBudget', language);
    if (!formData.message.trim()) newErrors.message = t('chat.validNeeds', language);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
          ...formData,
          timestamp: new Date().toISOString(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSubmit(formData);
        setFormData({ name: '', email: '', phone: '', disabilityType: '', budget: '', priority: '', interestedDevices: [], message: '' });
        onClose();
      } else {
        alert(data.error || t('chat.submitError', language));
      }
    } catch (error) {
      console.error('Consultation submit error:', error);
      onSubmit(formData);
      setFormData({ name: '', email: '', phone: '', disabilityType: '', budget: '', priority: '', interestedDevices: [], message: '' });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDevice = (device: string) => {
    setFormData(prev => ({
      ...prev,
      interestedDevices: prev.interestedDevices.includes(device)
        ? prev.interestedDevices.filter(d => d !== device)
        : [...prev.interestedDevices, device]
    }));
  };

  const handleAddCustomDevice = () => {
    const trimmed = customDeviceInput.trim();
    if (trimmed && !formData.interestedDevices.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        interestedDevices: [...prev.interestedDevices, trimmed]
      }));
      setCustomDeviceInput('');
      setShowCustomDeviceInput(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Container - Compact Neubrutalist Style */}
      <div className="relative bg-white w-full max-w-xl rounded-xl border-2 border-slate-800 shadow-[16px_16px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden animate-modal-in max-h-[85vh] flex flex-col">
        
        {/* Header - Full MADA Branding với nền trắng */}
        <div className="bg-white p-4 md:p-6 flex items-start justify-between relative overflow-hidden flex-shrink-0 border-b-2 border-slate-100">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-white to-blue-50/50" />
          
          {/* Left: Logo + Branding */}
          <div className="relative z-10 flex gap-3 md:gap-4 items-center">
            {/* MADA Logo - Chỉ hiển thị logo PNG */}
            <div className="flex items-center">
              <img 
                src="/mada-logo.png" 
                alt="MADA" 
                className="h-14 md:h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>
            
            {/* Divider */}
            <div className="hidden md:block w-px h-14 bg-slate-200 self-stretch" />
            
            {/* Title */}
            <div>
              <h1 className="text-sm md:text-base font-bold text-slate-800 leading-tight">
                {language === 'vi' ? 'Yêu cầu Tư vấn Chuyên gia AT' : 
                 language === 'en' ? 'AT Expert Consultation Request' : 
                 language === 'ar' ? 'طلب استشارة خبير AT' : 
                 'Demande de consultation AT'}
              </h1>
              <p className="text-[10px] md:text-xs text-secondary/70 mt-0.5 font-medium">MADA Center, Doha, Qatar</p>
            </div>
          </div>
          
          {/* Right: Close Button */}
          <button 
            onClick={onClose} 
            className="relative z-10 w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-slate-200 text-slate-400 hover:bg-secondary hover:border-secondary hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 md:p-5 bg-slate-50 space-y-5 overflow-y-auto flex-1">
          
          {/* Section 1: Thông tin cá nhân */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 font-mono">
              <User className="w-3.5 h-3.5" /> {language === 'vi' ? 'THÔNG TIN CÁ NHÂN' : language === 'en' ? 'PERSONAL INFORMATION' : language === 'ar' ? 'المعلومات الشخصية' : 'INFORMATIONS PERSONNELLES'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Họ và tên */}
              <div className="relative">
                <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{language === 'vi' ? 'Họ và tên *' : language === 'en' ? 'Full Name *' : language === 'ar' ? 'الاسم الكامل *' : 'Nom complet *'}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                  className={`w-full h-12 px-5 rounded-full border-2 font-medium transition-colors focus:outline-none text-sm ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                  placeholder={language === 'vi' ? 'Nguyễn Văn A' : language === 'en' ? 'John Smith' : language === 'ar' ? 'أحمد محمد' : 'Jean Dupont'}
                />
                {errors.name && <p className="text-[10px] text-red-500 mt-1 pl-4">{errors.name}</p>}
              </div>
              
              {/* Email */}
              <div className="relative">
                <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{language === 'vi' ? 'Email *' : language === 'en' ? 'Email *' : language === 'ar' ? 'البريد الإلكتروني *' : 'Email *'}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                  className={`w-full h-12 px-5 rounded-full border-2 font-medium transition-colors focus:outline-none text-sm ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                  placeholder="email@example.com"
                />
                {errors.email && <p className="text-[10px] text-red-500 mt-1 pl-4">{errors.email}</p>}
              </div>
              
              {/* Số điện thoại */}
              <div className="relative md:col-span-2">
                <label className="absolute -top-2.5 left-3.5 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500">{language === 'vi' ? 'Số điện thoại' : language === 'en' ? 'Phone Number' : language === 'ar' ? 'رقم الهاتف' : 'Numéro de téléphone'}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-12 px-5 rounded-full border-2 border-slate-300 font-medium transition-colors focus:outline-none focus:border-secondary focus:ring-0 text-sm"
                  placeholder="+974 1234 5678"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Nhu cầu tư vấn */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 font-mono">
              <Settings className="w-3.5 h-3.5" /> {language === 'vi' ? 'NHU CẦU TƯ VẤN' : language === 'en' ? 'CONSULTATION NEEDS' : language === 'ar' ? 'احتياجات الاستشارة' : 'BESOINS DE CONSULTATION'}
            </h2>
            
            {/* Loại khuyết tật */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-slate-500 block">{language === 'vi' ? 'Loại khuyết tật *' : language === 'en' ? 'Disability Type *' : language === 'ar' ? 'نوع الإعاقة *' : 'Type de handicap *'}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'visual', icon: Eye, label: language === 'vi' ? 'Khiếm thị' : language === 'en' ? 'Visual Impairment' : language === 'ar' ? 'ضعف البصر' : 'Déficience visuelle' },
                  { value: 'hearing', icon: Ear, label: language === 'vi' ? 'Khiếm thính' : language === 'en' ? 'Hearing Impairment' : language === 'ar' ? 'ضعف السمع' : 'Déficience auditive' },
                  { value: 'motor', icon: Accessibility, label: language === 'vi' ? 'Vận động' : language === 'en' ? 'Mobility' : language === 'ar' ? 'الحركة' : 'Mobilité' },
                  { value: 'cognitive', icon: Brain, label: language === 'vi' ? 'Nhận thức' : language === 'en' ? 'Cognitive' : language === 'ar' ? 'الإدراكي' : 'Cognitif' },
                  { value: 'multiple', icon: Users, label: language === 'vi' ? 'Kết hợp' : language === 'en' ? 'Multiple' : language === 'ar' ? 'متعدد' : 'Multiple' },
                  { value: 'other', icon: MoreHorizontal, label: language === 'vi' ? 'Khác' : language === 'en' ? 'Other' : language === 'ar' ? 'آخر' : 'Autre' },
                ].map((item) => (
                  <label key={item.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="disability"
                      value={item.value}
                      checked={formData.disabilityType === item.value}
                      onChange={() => { setFormData({ ...formData, disabilityType: item.value }); setErrors({ ...errors, disabilityType: '' }); }}
                      className="peer sr-only"
                    />
                    <div className="px-3 py-2 rounded-full border-2 border-slate-200 font-medium text-xs flex items-center gap-1.5 transition-all hover:bg-purple-50 peer-checked:border-secondary peer-checked:bg-purple-100 text-slate-700">
                      <item.icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.disabilityType && <p className="text-[10px] text-red-500">{errors.disabilityType}</p>}
            </div>

            {/* Ngân sách */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-slate-500 block">{language === 'vi' ? 'Ngân sách dự kiến *' : language === 'en' ? 'Expected Budget *' : language === 'ar' ? 'الميزانية المتوقعة *' : 'Budget prévu *'}</label>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                {[
                  { value: 'free', icon: Gift, label: language === 'vi' ? 'Miễn phí' : language === 'en' ? 'Free' : language === 'ar' ? 'مجاني' : 'Gratuit' },
                  { value: 'low', icon: Wallet, label: '<1K QAR' },
                  { value: 'medium', icon: CreditCard, label: '1K-5K' },
                  { value: 'high', icon: PiggyBank, label: '5K-15K' },
                  { value: 'any', icon: Handshake, label: language === 'vi' ? 'Thương lượng' : language === 'en' ? 'Negotiable' : language === 'ar' ? 'قابل للتفاوض' : 'Négociable' },
                ].map((item) => (
                  <label key={item.value} className="cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="budget"
                      value={item.value}
                      checked={formData.budget === item.value}
                      onChange={() => { setFormData({ ...formData, budget: item.value }); setErrors({ ...errors, budget: '' }); }}
                      className="peer sr-only"
                    />
                    <div className="px-3 py-2 rounded-full border-2 border-slate-200 font-medium text-xs flex items-center gap-1.5 transition-all hover:bg-purple-50 peer-checked:border-secondary peer-checked:bg-purple-100 text-slate-700 whitespace-nowrap">
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.budget && <p className="text-[10px] text-red-500">{errors.budget}</p>}
            </div>

            {/* Mức độ ưu tiên */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-slate-500 block">{language === 'vi' ? 'Mức độ ưu tiên' : language === 'en' ? 'Priority Level' : language === 'ar' ? 'مستوى الأولوية' : 'Niveau de priorité'}</label>
              <div className="flex gap-2">
                {[
                  { value: 'low', color: 'bg-blue-500', label: language === 'vi' ? 'Thấp' : language === 'en' ? 'Low' : language === 'ar' ? 'منخفض' : 'Faible' },
                  { value: 'medium', color: 'bg-orange-500', label: language === 'vi' ? 'Trung bình' : language === 'en' ? 'Medium' : language === 'ar' ? 'متوسط' : 'Moyen' },
                  { value: 'high', color: 'bg-red-500', label: language === 'vi' ? 'Cao' : language === 'en' ? 'High' : language === 'ar' ? 'مرتفع' : 'Élevé' },
                ].map((item) => (
                  <label key={item.value} className="cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="priority"
                      value={item.value}
                      checked={formData.priority === item.value}
                      onChange={() => setFormData({ ...formData, priority: item.value })}
                      className="peer sr-only"
                    />
                    <div className="px-2 py-2 rounded-full border-2 border-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all hover:bg-slate-100 text-center peer-checked:border-slate-800 peer-checked:bg-slate-800 peer-checked:text-white">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Section 3: Thiết bị quan tâm */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 font-mono">
              <Smartphone className="w-3.5 h-3.5" /> {language === 'vi' ? 'THIẾT BỊ QUAN TÂM' : language === 'en' ? 'INTERESTED DEVICES' : language === 'ar' ? 'الأجهزة المطلوبة' : 'APPAREILS D\'INTÉRÊT'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Monitor, title: language === 'vi' ? 'Phần mềm đọc màn hình' : language === 'en' ? 'Screen Reader Software' : language === 'ar' ? 'برمجيات قارئ الشاشة' : 'Logiciel de lecture d\'écran', subtitle: 'Screen Reader', key: 'Screen Reader' },
                { icon: ZoomIn, title: language === 'vi' ? 'Phóng to màn hình' : language === 'en' ? 'Screen Magnifier' : language === 'ar' ? 'تكبير الشاشة' : 'Agrandisseur d\'écran', subtitle: 'Screen Magnifier', key: 'Screen Magnifier' },
                { icon: Mic, title: language === 'vi' ? 'Nhận dạng giọng nói' : language === 'en' ? 'Speech Recognition' : language === 'ar' ? 'التعرف على الكلام' : 'Reconnaissance vocale', subtitle: 'Speech Recognition', key: 'Speech Recognition' },
              ].map((device) => (
                <div
                  key={device.key}
                  onClick={() => toggleDevice(device.key)}
                  className={`group cursor-pointer p-3 rounded-xl border-2 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,0.05)] ${formData.interestedDevices.includes(device.key) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-blue-50/30 hover:border-blue-500'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${formData.interestedDevices.includes(device.key) ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white'}`}>
                      <device.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-xs">{device.title}</h3>
                      <p className="text-[10px] text-slate-500">{device.subtitle}</p>
                    </div>
                    {formData.interestedDevices.includes(device.key) && (
                      <Check className="w-4 h-4 text-blue-500 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Custom device input */}
              {showCustomDeviceInput ? (
                <div className="p-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customDeviceInput}
                      onChange={(e) => setCustomDeviceInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomDevice()}
                      placeholder={language === 'vi' ? 'Nhập tên thiết bị...' : language === 'en' ? 'Enter device name...' : 'Entrez le nom de l\'appareil...'}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={handleAddCustomDevice}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setShowCustomDeviceInput(false); setCustomDeviceInput(''); }}
                      className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setShowCustomDeviceInput(true)}
                  className="group cursor-pointer p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-800 hover:bg-slate-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-500 text-xs">{language === 'vi' ? 'Thêm thiết bị khác' : language === 'en' ? 'Add other device' : language === 'ar' ? 'إضافة جهاز آخر' : 'Ajouter un autre appareil'}</h3>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show added custom devices */}
              {formData.interestedDevices.filter(d => !['Screen Reader', 'Screen Magnifier', 'Speech Recognition'].includes(d)).map((device) => (
                <div
                  key={device}
                  onClick={() => toggleDevice(device)}
                  className="group cursor-pointer p-3 rounded-xl border-2 border-blue-500 bg-blue-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 text-xs">{device}</h3>
                    </div>
                    <X className="w-4 h-4 text-blue-500 hover:text-red-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Mô tả */}
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 font-mono">
              <MessageCircle className="w-3.5 h-3.5" /> {language === 'vi' ? 'MÔ TẢ NHU CẦU' : language === 'en' ? 'NEEDS DESCRIPTION' : language === 'ar' ? 'وصف الاحتياجات' : 'DESCRIPTION DES BESOINS'}
            </h2>
            <div className="relative">
              <textarea
                rows={3}
                value={formData.message}
                onChange={(e) => { setFormData({ ...formData, message: e.target.value }); setErrors({ ...errors, message: '' }); }}
                className={`w-full px-4 py-3 rounded-xl border-2 font-medium transition-colors resize-none focus:outline-none text-sm ${errors.message ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-secondary'} focus:ring-0`}
                placeholder={language === 'vi' ? 'Mô tả chi tiết tình trạng và nhu cầu về thiết bị công nghệ hỗ trợ...' : language === 'en' ? 'Describe your situation and assistive technology needs in detail...' : language === 'ar' ? 'صف وضعك واحتياجاتك من التكنولوجيا المساعدة بالتفصيل...' : 'Décrivez votre situation et vos besoins en technologie d\'assistance en détail...'}
              />
              {errors.message && <p className="text-[10px] text-red-500 mt-1">{errors.message}</p>}
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="p-4 bg-white border-t-2 border-slate-800 flex flex-col sm:flex-row justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full border-2 border-slate-800 font-bold text-xs text-slate-800 bg-white hover:bg-slate-100 transition-colors"
          >
            {language === 'vi' ? 'Hủy' : language === 'en' ? 'Cancel' : language === 'ar' ? 'إلغاء' : 'Annuler'}
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
                {language === 'vi' ? 'Đang gửi...' : language === 'en' ? 'Sending...' : language === 'ar' ? 'جارٍ الإرسال...' : 'Envoi en cours...'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {language === 'vi' ? 'GỬI YÊU CẦU' : language === 'en' ? 'SUBMIT REQUEST' : language === 'ar' ? 'إرسال الطلب' : 'ENVOYER LA DEMANDE'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Product Card Component
// Confidence Rating Bar Component
function ConfidenceBar({ confidence, language = 'vi' as Language }: { confidence: number; language?: Language }) {
  const getColor = (value: number) => {
    if (value >= 85) return 'bg-teal-500';
    if (value >= 70) return 'bg-blue-500';
    if (value >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const label = language === 'vi' ? 'Độ tin cậy' : language === 'en' ? 'Confidence' : language === 'ar' ? 'الثقة' : 'Confiance';

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(confidence)} transition-all duration-500`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className={`text-xs font-bold ${
        confidence >= 85 ? 'text-teal-500' : 
        confidence >= 70 ? 'text-blue-500' : 
        confidence >= 50 ? 'text-amber-500' : 'text-red-500'
      }`}>{confidence}%</span>
    </div>
  );
}

export function ChatPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguageStore();
  const { messages, addMessage, clearMessages, isLoading, setLoading } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const authModal = useAuthModalStore();

  // Chat settings from admin
  const { greeting, description, suggestedPrompts, fileAttachmentEnabled, loadFromBackend: loadChatSettings } = useChatSettingsStore();

  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
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

  // ⭐ Sync agents from backend on mount + when window regains focus
  const loadAgents = useAgentStore((s) => s.loadAgents);
  useEffect(() => {
    // ⭐ Force reload từ backend - không dùng cache
    console.log('[ChatPage] Loading agents from backend...');
    loadAgents().then(() => {
      console.log('[ChatPage] Agents loaded, count:', useAgentStore.getState().agents.length);
    }).catch((err) => {
      console.error('[ChatPage] Failed to load agents:', err);
    });
    const onFocus = () => {
      console.log('[ChatPage] Window focus - reloading agents...');
      loadAgents();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadAgents]);

  // ⭐ Lắng nghe broadcast từ AdminAgents - cập nhật agents ngay khi admin thêm/sửa/xóa bot
  useEffect(() => {
    const cleanup = onAgentChange((event) => {
      console.log('[ChatPage] 📡 Received agent change broadcast:', event.type, event);
      // Reload agents ngay lập tức khi có thay đổi từ Admin
      loadAgents();
    });
    return cleanup;
  }, [loadAgents]);

  // Load chat settings from backend on mount
  useEffect(() => {
    loadChatSettings();
  }, [loadChatSettings]);

  const fileQuotaExhausted = !!fileQuota && fileQuota.limit !== -1 && fileQuota.remaining <= 0;
  const [activeCategory, setActiveCategory] = useState<ATCategory | null>(null);
   
  const [_suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ⭐ AT Specialist Suggestion State
  const [showATSuggestion, setShowATSuggestion] = useState(false);

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
  const agents = useAgentStore((s) => s.agents);
  const activeAgents = agents.filter(a => a.isActive);
  const { selectedAgentId } = useSelectedAgentStore();
  // Fallback to default agent if no agent is selected or activeAgents is empty
  const defaultAgent = activeAgents[0];
  const selectedAgent = selectedAgentId
    ? activeAgents.find(a => a.id === selectedAgentId) || defaultAgent
    : defaultAgent;

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
      if (shouldCloseAttach) setShowAttachmentMenu(false);
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
        alert(t('chat.fileTooLarge').replace('{{filename}}', file.name));
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
                   file.type === 'application/msword') {
          // PDF/DOCX - keep as originalFile (will be sent as base64)
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
        // Ưu tiên content đã parse (từ mammoth/pdf.js) thay vì gửi raw base64
        if (f.content && !f.content.includes('waiting to parse')) {
          // Đã có nội dung parse sẵn (từ mammoth/pdf.js frontend) - dùng luôn
          attachmentsForApi.push({
            name: f.name,
            type: f.type,
            content: f.content,
          });
        }
        // Nếu không có content nhưng có originalFile - gửi base64 để server parse
        else if (f.originalFile) {
          try {
            const arrayBuffer = await f.originalFile.arrayBuffer();
            const binary = new Uint8Array(arrayBuffer);
            let base64 = '';
            for (let i = 0; i < binary.length; i++) {
              base64 += String.fromCharCode(binary[i]);
            }
            base64 = btoa(base64);
            
            attachmentsForApi.push({
              name: f.name,
              type: f.type,
              base64: base64,
            });
          } catch (e) {
            console.error('Error reading file:', f.name, e);
          }
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
      const chatBody: any = {
        message: fullMessage,
        language,
        agentId: selectedAgentId,
        agentPrompt: selectedAgent?.systemPrompt,
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
        const response = await fetch(chatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(chatBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let sources: any[] = [];
        let confidence = 0.5;
        let suggestedProducts: any[] = []; // ✅ Capture from stream

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
                  // ✅ Capture suggested products from stream
                  suggestedProducts = data.suggestedProducts || [];
                } else if (data.type === 'done') {
                  confidence = data.confidence || 0.5;
                  if (data.answer) fullContent = data.answer;
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
          addMessage({
            role: 'assistant',
            content: fullContent,
            confidence: confidence,
            sources: sources,
            contextUsed: sources.length > 0,
            suggestedProducts: suggestedProducts, // ✅ Now captured from stream event
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

          // ⭐ Generate AI-powered follow-up questions
          generateFollowUpWithAI(userMessage, fullContent, messages, language, viewMode)
            .then(followUps => setSuggestedFollowUps(followUps))
            .catch(() => setSuggestedFollowUps(generateFollowUpQuestions(userMessage, fullContent, language)));

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

        // ⭐ Generate AI-powered follow-up questions
        generateFollowUpWithAI(userMessage, fullContent, messages, language, viewMode)
          .then(followUps => setSuggestedFollowUps(followUps))
          .catch(() => setSuggestedFollowUps(generateFollowUpQuestions(userMessage, fullContent, language)));

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
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: t('chat.connectionError'),
      });
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
    } else {
      clearMessages();
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
          ? (language === 'vi' ? 'Vui long cho phep truy cap microphone' : 'Please allow microphone access')
          : event.error === 'no-speech'
            ? (language === 'vi' ? 'Khong phat hien giong noi' : 'No speech detected')
            : (language === 'vi' ? 'Da xay ra loi Voice' : 'Voice error occurred'));
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
      alert(language === 'vi' 
        ? 'Trinh duyet khong ho tro ghi am. Vui long su dung Chrome/Edge/Safari.' 
        : 'Browser does not support recording. Please use Chrome/Edge/Safari.');
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
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  const handleAttachmentSelect = (_type: string, accept: string) => {
    // Check session limit before opening file picker
    const limitCheck = canAddFiles();
    if (!limitCheck.allowed) {
      alert(limitCheck.reason);
      setShowAttachmentMenu(false);
      return;
    }

    // ⭐ Check monthly file upload quota
    if (fileQuotaExhausted) {
      setShowAttachmentMenu(false);
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
                fileData.content = t('chat.pdfFilePending').replace('{{name}}', file.name).replace('{{size}}', (file.size / 1024).toFixed(1));
                fileData.originalFile = file; // Lưu file gốc để gửi lên server
              } else if (file.type.includes('word') || file.name.endsWith('.docx')) {
                // DOCX - đọc bằng mammoth
                const arrayBuffer = await file.arrayBuffer();
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ arrayBuffer });
                fileData.content = result.value.slice(0, 10000);
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
              fileData.content = t('chat.cannotReadFile').replace('{{name}}', file.name);
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
    setShowAttachmentMenu(false);
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
    setShowAttachmentMenu(false);

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
          content: t('chat.urlLoadError').replace('{{error}}', data.error || 'Unknown error'),
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

  const handleConsultationSubmit = (data: { name: string; email: string; phone: string; message: string }) => {
    console.log('Consultation submitted:', data);
    addMessage({
      role: 'user',
      content: t('chat.consultSent'),
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
            <div className="flex items-center justify-center">
              <img src={madaLogo} alt="MADA" className="h-14" />
            </div>
          </div>

        {/* View Mode Toggle đã di chuyển lên Header */}

        {/* View Mode Toggle */}
        <div className="px-4 mb-3 shrink-0">
          <div className="bg-slate-100 rounded-xl p-0.5 flex">
            <button
              onClick={viewMode === 'end_user' ? undefined : toggleViewMode}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200',
                viewMode === 'end_user' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <span className="material-symbols-outlined text-sm">person</span>
              <span>{language === 'vi' ? 'Người dùng' : language === 'en' ? 'End user' : language === 'ar' ? 'المستخدم' : 'Utilisateur'}</span>
            </button>
            <button
              onClick={viewMode === 'at_specialist' ? undefined : toggleViewMode}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200',
                viewMode === 'at_specialist' 
                  ? 'bg-white text-violet-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <span className="material-symbols-outlined text-sm">engineering</span>
              <span>{language === 'vi' ? 'Chuyên gia' : language === 'en' ? 'Specialist' : language === 'ar' ? 'خبير' : 'Spécialiste'}</span>
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-4 mt-2 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full text-white rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-semibold shadow-md hover:opacity-90 transition-all bg-primary hover:bg-primary/90 text-sm"
          >
            <Plus className="w-4 h-4" />
            {language === 'vi' ? 'Trò chuyện mới' : language === 'en' ? 'New Chat' : language === 'ar' ? 'محادثة جديدة' : 'Nouvelle conversation'}
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
          
          {/* Category Navigation */}
          <nav className="space-y-1 px-3 pt-2 pb-2">
            {categories.map((category) => {
              const isActive = activeCategory === category;
              const label = CATEGORY_LABELS[category];

              // Material Design 3 colors for categories
              const categoryColors: Record<ATCategory, { bg: string; icon: string; active: string }> = {
                vision: { bg: 'bg-blue-100', icon: 'text-blue-600', active: 'bg-blue-500 text-white' },
                hearing: { bg: 'bg-indigo-100', icon: 'text-indigo-600', active: 'bg-indigo-500 text-white' },
                mobility: { bg: 'bg-emerald-100', icon: 'text-emerald-600', active: 'bg-emerald-500 text-white' },
                cognition: { bg: 'bg-rose-100', icon: 'text-rose-500', active: 'bg-rose-500 text-white' },
                communication: { bg: 'bg-amber-100', icon: 'text-amber-600', active: 'bg-amber-500 text-white' },
                daily_living: { bg: 'bg-purple-100', icon: 'text-purple-600', active: 'bg-purple-500 text-white' },
                education: { bg: 'bg-teal-100', icon: 'text-teal-600', active: 'bg-teal-500 text-white' },
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

                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-2xl group',
                  isActive
                    ? colors.active
                    : 'text-slate-500 hover:bg-surface-container-low hover:text-on-background'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  isActive ? 'bg-white/20' : colors.bg
                )}>
                  <span className={clsx(
                    'material-symbols-outlined text-lg',
                    isActive ? 'text-white' : colors.icon
                  )}>
                    {CATEGORY_ICONS[category]}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold uppercase tracking-tight">
                    {language === 'vi' ? label.title : language === 'en' ? label.titleEn : language === 'ar' ? label.titleAr : label.titleFr}
                  </p>
                  <p className={clsx(
                    'text-[10px] truncate',
                    isActive ? 'text-white/70' : 'text-on-surface-variant'
                  )}>
                    {language === 'vi' ? label.desc : language === 'en' ? label.descEn : language === 'ar' ? label.descAr : label.descFr}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Sample Questions - Hiển thị khi có category được chọn (CỐ ĐỊNH theo 7 bot) */}
          {activeCategory && SAMPLE_QUESTIONS[activeCategory]?.[viewMode]?.[language]?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 px-4 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                {language === 'vi' ? 'Câu hỏi gợi ý' : language === 'en' ? 'Suggested Questions' : language === 'ar' ? 'أسئلة مقترحة' : 'Questions suggérées'}
              </p>
              <div className="space-y-1 px-2">
                {SAMPLE_QUESTIONS[activeCategory][viewMode][language].slice(0, 4).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSampleQuestion(question)}
                    className={clsx(
                      'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left',
                      'text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700',
                      'transition-colors duration-200 group'
                    )}
                  >
                    <span className="text-violet-400 group-hover:text-violet-500 mt-0.5 flex-shrink-0">
                      •
                    </span>
                    <span className="line-clamp-2 leading-relaxed">{question}</span>
                  </button>
                ))}
                {SAMPLE_QUESTIONS[activeCategory][viewMode][language].length > 4 && (
                  <button className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                    {language === 'vi' ? `Xem thêm ${SAMPLE_QUESTIONS[activeCategory][viewMode][language].length - 4} câu` : 
                     language === 'en' ? `Show ${SAMPLE_QUESTIONS[activeCategory][viewMode][language].length - 4} more` :
                     language === 'ar' ? `عرض ${SAMPLE_QUESTIONS[activeCategory][viewMode][language].length - 4} أخرى` :
                     `Voir ${SAMPLE_QUESTIONS[activeCategory][viewMode][language].length - 4} de plus`}
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </button>
                )}
              </div>
            </div>
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
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-2xl group',
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                    : 'text-slate-500 hover:bg-surface-container-low hover:text-on-background'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-lg',
                  isActive ? 'bg-white/20' : 'bg-orange-100'
                )}>
                  <span className={clsx(
                    isActive ? 'text-white' : 'text-orange-600'
                  )}>
                    {agent.avatar}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold uppercase tracking-tight">
                    {agent.name}
                  </p>
                  <p className={clsx(
                    'text-[10px] truncate',
                    isActive ? 'text-white/70' : 'text-on-surface-variant'
                  )}>
                    {agent.description || (language === 'vi' ? 'Agent tùy chỉnh' : language === 'en' ? 'Custom Agent' : 'Agent personnalisé')}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Recent Chats Header */}
        <div className="flex items-center justify-between px-4 mb-3 shrink-0 mt-2">
            {historyConversations.length > 0 && (
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                {historyConversations.length}
              </span>
            )}
          </div>

          {/* Search box */}
          <div className="px-2 mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder={language === 'vi' ? 'Tìm hội thoại...' : language === 'en' ? 'Search conversations...' : language === 'ar' ? 'البحث في المحادثات...' : 'Rechercher...'}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 text-slate-700 placeholder:text-slate-400 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1 px-1">
            {historyConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-slate-400">
                <MessageSquare className="w-7 h-7 mb-2 opacity-40" />
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
                    <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {curDate}
                    </p>
                  )}
                  <button
                    title={formatFullDateTime(conv.updatedAt)}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={clsx(
                      'w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-left group',
                      conv.id === activeConversationId
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-slate-50 text-slate-600'
                    )}
                  >
                    <MessageSquare className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', conv.id === activeConversationId ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold truncate">{conv.title}</p>
                        {conv.category && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded-full text-slate-400 flex-shrink-0">
                            {CATEGORY_ICONS[conv.category as ATCategory]}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{conv.preview}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5 group-hover:hidden">{formatFullDateTime(conv.updatedAt)}</p>
                    </div>
                  </button>
                </div>
              );
              return acc;
            }, [] as React.ReactNode[])}
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
                  alt={language === 'vi' ? 'Khách' : language === 'en' ? 'Guest' : language === 'ar' ? 'زائر' : 'Invité'}
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
                    <p className="text-sm font-bold truncate">{language === 'vi' ? 'Khách' : language === 'en' ? 'Guest' : language === 'ar' ? 'زائر' : 'Invité'}</p>
                    <p className="text-xs text-slate-400 truncate">{language === 'vi' ? 'Chưa đăng nhập' : language === 'en' ? 'Not logged in' : language === 'ar' ? 'لم يتم تسجيل الدخول' : 'Non connecté'}</p>
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
                      {language === 'vi' ? 'Hồ sơ' : language === 'en' ? 'Profile' : language === 'ar' ? 'الملف الشخصي' : 'Profil'}
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      {language === 'vi' ? 'Nâng cấp gói' : language === 'en' ? 'Upgrade Plan' : language === 'ar' ? 'ترقية الخطة' : 'Plan supérieur'}
                    </button>
                    <hr className="my-1 border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {language === 'vi' ? 'Đăng xuất' : language === 'en' ? 'Logout' : language === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}
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
                {isEndUser ? (language === 'vi' ? 'Premium Intelligence' : language === 'en' ? 'Premium Intelligence' : language === 'ar' ? 'ذكاء متميز' : 'Intelligence Premium') : (language === 'vi' ? 'AT Specialist Mode' : language === 'en' ? 'AT Specialist Mode' : language === 'ar' ? 'وضع خبير AT' : 'Mode Spécialiste AT')}
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
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500">
                    <p className="text-sm font-semibold text-white">{language === 'vi' ? 'Chọn ngôn ngữ' : language === 'en' ? 'Select language' : 'اختر اللغة'}</p>
                  </div>
                  <div className="p-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as Language);
                          setShowLanguageMenu(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                          language === lang.code
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-slate-50 text-slate-700'
                        )}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <div className="flex-1 text-left">
                          <span className="font-medium text-sm">{lang.name}</span>
                        </div>
                        {language === lang.code && (
                          <Check className="w-4 h-4 text-blue-500" />
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
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-start pt-16 px-4 md:px-8">
              <div className="w-full max-w-4xl mx-auto">
                
                {/* Welcome Section */}
                <div className="text-center mb-10 max-w-2xl mx-auto">
                  {/* Welcome Logo */}
                  <div className="mb-6">
                    <img src={madaLogo} alt="MADA" className="w-32 h-auto mx-auto" />
                  </div>
                  
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {language === 'vi' ? 'Câu hỏi gợi ý' : language === 'en' ? 'Suggested Questions' : language === 'ar' ? 'الأسئلة المقترحة' : 'Questions suggérées'}
                    </h3>
                  </div>
                  {/* Quản lý - Chỉ hiện cho admin */}
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <button
                      onClick={() => navigate('/admin/suggested-questions')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all duration-150 active:scale-95 shadow-xs"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Quản lý' : language === 'en' ? 'Manage' : language === 'ar' ? 'إدارة' : 'Gérer'}</span>
                    </button>
                  )}
                </div>

                {/* Prompt Cards Grid - Material Design 3 Style */}
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
                          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0 group-hover:bg-primary-fixed-dim transition-colors">
                            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {typeof item === 'string' ? (activeCategory ? CATEGORY_ICONS[activeCategory] : (index === 0 ? 'search' : index === 1 ? 'visibility' : index === 2 ? 'hearing' : 'rule')) : item.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
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
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col h-full w-full">
              {/* Agent Header */}
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h2 className="font-bold text-slate-900 uppercase tracking-tight">
                    {activeCategory 
                      ? (language === 'vi' ? CATEGORY_LABELS[activeCategory].title : language === 'en' ? CATEGORY_LABELS[activeCategory].titleEn : language === 'ar' ? CATEGORY_LABELS[activeCategory].titleAr : CATEGORY_LABELS[activeCategory].titleFr)
                      : (language === 'vi' ? 'THÔNG TIN BỔ TRỢ & TIÊU CHUẨN' : language === 'en' ? 'SUPPLEMENTARY INFO & STANDARDS' : language === 'ar' ? 'المعلومات والمعايير الإضافية' : 'INFO SUPPLÉMENTAIRES & NORMES')}
                  </h2>
                </div>

                {/* ⭐ Agent Selector Dropdown */}
                {activeAgents.length > 0 && (
                  <div className="relative" ref={null}>
                    <select
                      value={selectedAgentId || 'default'}
                      onChange={(e) => {
                        const newId = e.target.value === 'default' ? null : e.target.value;
                        useSelectedAgentStore.getState().setSelectedAgentId(newId);
                      }}
                      className="appearance-none bg-white border-2 border-slate-200 rounded-full px-3 py-1.5 pr-8 text-xs font-bold text-slate-700 cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
                    >
                      {activeAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.avatar} {agent.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Messages */}
              <div 
                className="flex-1 space-y-6 mb-8 overflow-y-auto pb-48"
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
          <div className="max-w-3xl mx-auto relative flex flex-col gap-3">

            {/* File upload status with limits */}
            {selectedFiles.length > 0 && (
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
            )}

            {/* File attachments display - Grid 2 cột, full width bên ngoài pill input */}
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 w-full" role="list" aria-label={language === 'vi' ? 'Danh sách tệp đính kèm' : 'Attached files list'}>
                {selectedFiles.map((file, index) => {
                  const isError = file.size > 50 * 1024 * 1024; // 50MB limit
                  const status = file.isLoading ? 'loading' : isError ? 'error' : 'ready';

                  // Helper format file size
                  const formatSize = (bytes: number) => {
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };

                  return (
                    <div
                      key={index}
                      role="listitem"
                      className={clsx(
                        'group/file relative flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all min-w-0',
                        status === 'ready' && 'bg-white border-emerald-300 hover:border-emerald-500 hover:shadow-md',
                        status === 'loading' && 'bg-blue-50 border-blue-300',
                        status === 'error' && 'bg-red-50 border-red-300'
                      )}
                      aria-label={`${file.name} - ${status}`}
                    >
                      {/* File type icon */}
                      <div className={clsx(
                        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                        file.type === 'application/pdf' && 'bg-red-100 text-red-600',
                        file.type.includes('word') && 'bg-blue-100 text-blue-600',
                        file.type.startsWith('image/') && 'bg-pink-100 text-pink-600',
                        !['application/pdf'].includes(file.type) && !file.type.includes('word') && !file.type.startsWith('image/') && 'bg-slate-100 text-slate-600'
                      )}>
                        {file.type === 'application/pdf' ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
                        ) : file.type.includes('word') ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                        ) : file.type.startsWith('image/') ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>attach_file</span>
                        )}
                      </div>

                      {/* File info - flex-1 min-w-0 để truncate đúng */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {file.name}
                        </p>
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
                                {language === 'vi' ? 'Đang xử lý...' : 'Processing...'}
                              </span>
                            </>
                          )}
                          {status === 'error' && (
                            <>
                              <span className="material-symbols-outlined text-[12px] text-red-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                                error
                              </span>
                              <span className="text-[10px] font-medium text-red-700 truncate">
                                {language === 'vi' ? 'Quá lớn (>50MB)' : 'Too large (>50MB)'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Remove button */}
                      {!file.isLoading && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-500 hover:text-red-600 transition-all hover:scale-110"
                          title={language === 'vi' ? 'Xóa' : 'Remove'}
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
              <div className="absolute inset-0 bg-slate-900 rounded-full translate-y-1 translate-x-0.5 -z-10"></div>
              
              <div className="bg-white border-[3px] border-on-background rounded-full p-1.5 flex items-center gap-2 relative z-10">
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
                        : showAttachmentMenu
                        ? 'bg-primary text-white'
                        : 'text-on-surface-variant hover:text-on-background hover:bg-surface-container-low'
                    )}
                    title={
                      fileQuotaExhausted
                        ? (language === 'vi' ? 'Đã hết lượt tải file tháng này' : language === 'en' ? 'Monthly upload limit reached' : language === 'ar' ? 'تم الوصول للحد الشهري' : 'Limite mensuelle atteinte')
                        : 'Đính kèm'
                    }
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
                          ? (language === 'vi' ? 'Đã hết lượt tải file' : language === 'en' ? 'File upload quota exhausted' : language === 'ar' ? 'تم استنفاد الحصة' : 'Quota de téléchargement épuisée')
                          : (language === 'vi' ? `Còn ${fileQuota.remaining}/${fileQuota.limit} lượt upload tháng này` : `${fileQuota.remaining}/${fileQuota.limit} uploads left this month`)
                      }
                    >
                      <span className="material-symbols-outlined text-[12px]">cloud_upload</span>
                      <span>{fileQuotaExhausted ? '0' : fileQuota.remaining}/{fileQuota.limit}</span>
                    </button>
                  )}

                  {/* Attachment Menu */}
                  {showAttachmentMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-white/80 backdrop-blur-xl rounded-2xl shadow-[4px_4px_0_0_rgba(25,27,35,1)] z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-outline-variant/50 bg-primary flex items-center justify-between">
                        <p className="text-sm font-bold text-white">Thêm tệp đính kèm</p>
                        <button
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className={clsx(
                            'px-3 py-1 text-xs font-semibold rounded-full transition-colors',
                            showUrlInput
                              ? 'bg-white text-primary'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          )}
                        >
                          🌐 URL
                        </button>
                      </div>

                      {/* URL Input Section */}
                      {showUrlInput && (
                        <div className="p-3 border-b border-outline-variant/50 bg-primary-fixed/30">
                          <p className="text-xs text-primary mb-2">Nhập link web để AI đọc và phân tích nội dung:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={urlInputValue}
                              onChange={(e) => setUrlInputValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                              placeholder="https://example.com"
                              className="flex-1 px-3 py-2 text-sm border border-outline rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                            />
                            <button
                              onClick={handleFetchUrl}
                              disabled={!urlInputValue.trim() || isFetchingUrl}
                              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                              {isFetchingUrl ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Đang tải...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Đọc
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="p-1.5 grid grid-cols-1 gap-0.5">
                        {getAttachmentOptions(language).map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleAttachmentSelect(option.id, option.accept)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low transition-colors text-left group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center group-hover:bg-primary-fixed-dim transition-colors flex-shrink-0">
                              <option.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-on-background">{option.label}</p>
                              <p className="text-xs text-on-surface-variant">{option.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Voice Recording Bubble - Hiển thị real-time transcript với waveform */}
                {(isRecording || isListening || transcript) && (
                  <div 
                    className="mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border-2 bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border-red-300 shadow-sm animate-fade-in"
                    role="status"
                    aria-live="polite"
                    aria-label={language === 'vi' ? 'Đang ghi âm' : 'Recording voice'}
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
                            {language === 'vi' ? 'Đang nghe' : 'Listening'}
                          </span>
                          <span className="opacity-70">{interimTranscript}</span>
                          <span className="inline-block w-1 h-3 bg-red-500 ml-0.5 animate-pulse" />
                        </p>
                      ) : transcript ? (
                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-bold text-red-600 uppercase text-[10px] tracking-wider mr-1">
                            {language === 'vi' ? 'Đã ghi' : 'Recorded'}
                          </span>
                          {transcript}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          {language === 'vi' ? 'Hãy nói vào microphone...' : 'Speak into the microphone...'}
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
                  placeholder={isEndUser 
                    ? (language === 'vi' ? 'Hỏi MADA AI...' : language === 'en' ? 'Message MADA AI...' : language === 'ar' ? 'رسالة MADA AI...' : 'Message MADA AI...')
                    : (language === 'vi' ? 'Hỏi chuyên gia AT...' : language === 'en' ? 'Ask AT Specialist...' : language === 'ar' ? 'اسأل خبير AT...' : 'Demander au spécialiste...')
                  }
                  rows={1}
                  className="flex-1 border-none focus:ring-0 text-on-background bg-transparent py-2.5 text-sm placeholder:text-on-surface-variant/60 resize-none leading-relaxed"
                  style={{ minHeight: '40px', maxHeight: '100px' }}
                />

                {/* Right Icons & Send - Material Design 3 Style */}
                <div className="flex items-center gap-1 pr-1">
                  {/* AT Specialist Quick Switch Button - Visible in both modes */}
                  {isEndUser ? (
                    <div className="relative group/switch">
                      <button
                        onClick={toggleViewMode}
                        className={clsx(
                          "p-2 rounded-full transition-all bg-violet-100 text-violet-600 hover:bg-violet-200",
                          showATSuggestion && "ring-2 ring-amber-400 ring-offset-2 animate-pulse"
                        )}
                        title={language === 'vi' ? 'Chuyển sang chuyên gia AT' : language === 'en' ? 'Switch to AT Specialist' : language === 'ar' ? 'التبديل إلى خبير AT' : 'Passer au spécialiste AT'}
                      >
                        <Accessibility className="w-5 h-5" />
                      </button>
                      {/* Custom Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover/switch:opacity-100 group-hover/switch:visible transition-all duration-200 translate-y-1 group-hover/switch:translate-y-0 shadow-lg z-50">
                        {language === 'vi' ? 'Chuyên gia AT' : language === 'en' ? 'AT Specialist' : language === 'ar' ? 'خبير AT' : 'Spécialiste AT'}
                        <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/switch">
                      <button
                        onClick={toggleViewMode}
                        className="p-2 rounded-full transition-all bg-violet-100 text-violet-600 hover:bg-violet-200"
                        title={language === 'vi' ? 'Chuyển về chế độ người dùng' : language === 'en' ? 'Switch to end user mode' : language === 'ar' ? 'التبديل إلى وضع المستخدم' : 'Basculer vers le mode utilisateur'}
                      >
                        <Users className="w-5 h-5" />
                      </button>
                      {/* Custom Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover/switch:opacity-100 group-hover/switch:visible transition-all duration-200 translate-y-1 group-hover/switch:translate-y-0 shadow-lg z-50">
                        {language === 'vi' ? 'Người dùng cuối' : language === 'en' ? 'End User' : language === 'ar' ? 'المستخدم النهائي' : 'Utilisateur final'}
                        <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                  )}
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
                    title={isRecording 
                      ? (language === 'vi' ? 'Dừng ghi âm' : language === 'en' ? 'Stop recording' : language === 'ar' ? 'إيقاف التسجيل' : 'Arrêter l\'enregistrement')
                      : (language === 'vi' ? 'Ghi âm' : language === 'en' ? 'Record' : language === 'ar' ? 'تسجيل' : 'Enregistrer')}
                  >
                    {isRecording || isListening ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  
                  {/* Send Button - Compact */}
                  {isGeneratingResponse ? (
                    <button
                      onClick={handleStopGeneration}
                      className="relative w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center border-[2px] border-on-background shadow-[2px_2px_0_0_rgba(25,27,35,1)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(25,27,35,1)] transition-all"
                      title={language === 'vi' ? 'Dừng' : 'Stop'}
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
                      {language === 'vi' ? 'Có vẻ câu hỏi của bạn liên quan đến thiết bị hỗ trợ' :
                       language === 'en' ? 'Your question seems related to assistive devices' :
                       language === 'ar' ? 'يبدو أن سؤالك يتعلق بأجهزة المساعدة' :
                       'Votre question semble liée aux appareils d\'assistance'}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 flex items-center gap-1">
                      <Accessibility className="w-3 h-3" />
                      {language === 'vi' ? 'Nhấn vào đây để hỏi chuyên gia AT' :
                       language === 'en' ? 'Click here to ask AT Specialist' :
                       language === 'ar' ? 'انقر هنا للسؤال عن متخصص AT' :
                       'Cliquez ici pour demander au spécialiste AT'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                </div>
              </button>
            )}

            {/* Footer - Professional AI Support */}
            <p className="text-center text-[11px] text-on-surface-variant/70 mt-6 uppercase tracking-wider font-medium">
              {language === 'vi' ? 'MADA AI - HỖ TRỢ TƯ VẤN CHUYÊN GIA AT' : language === 'en' ? 'MADA AI - SUPPORTING AT EXPERTS' : language === 'ar' ? '.MADA AI - دعم خبراء AT' : 'MADA AI - SOUTIEN AUX EXPERTS AT'}
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

// Message Bubble Component with Product Cards & Standards
function MessageBubble({
  message,
  onCopy,
  copiedId,
  onSpeak,
  speakingId,
  onRequestConsultation,
  language = 'vi' as Language
}: {
  message: Message;
  onCopy: (content: string, id: string) => void;
  copiedId: string | null;
  onSpeak: (text: string, id: string) => void;
  speakingId: string | null;
  onRequestConsultation: () => void;
  language?: Language;
}) {
  const [showSources, setShowSources] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const confidence = message.confidence || 85;

  // ⭐ Edit message state from store
  const { editingMessageId, setEditingMessage, setMessages, setLoading } = useChatStore();
  const [localEditText, setLocalEditText] = useState('');
  const currentEditingId = editingMessageId;
  
  // Detect if AI couldn't find data in Knowledge Base
  const noDataIndicators = [
    'khong tim thay', 'khong co thong tin', 'khong co du lieu',
    'no information', 'no data', 'not found', 'khong chan chan',
    'xin loi', 'toi khong', 'i don\'t have', 'i\'m not sure'
  ];
  const hasNoData = confidence < 50 || 
    noDataIndicators.some(indicator => message.content.toLowerCase().includes(indicator.toLowerCase()));
  
  // Detect category từ nội dung message (có thể dùng cho analytics sau)
  const detectedCategory = detectCategoryFromQuery(message.content);
  void detectedCategory;

  if (message.role === 'user') {
    const isEditing = currentEditingId === message.id;

    return (
      <div className="flex items-end gap-3 justify-end animate-fade-in group flex-col items-end">
        {/* Hiển thị file cards đã gửi */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2 justify-end mb-1 max-w-[80%]" role="list" aria-label={language === 'vi' ? 'Tệp đính kèm đã gửi' : 'Sent attachments'}>
            {message.attachments.map((attachment, idx) => (
              <div
                key={idx}
                role="listitem"
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl rounded-br-sm text-sm border-2 transition-all',
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
                    {language === 'vi' ? 'Đã đính kèm' : 'Attached'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="max-w-[80%] px-4 py-3 bg-[#0047ff] text-white rounded-2xl group-hover/rounded-br-sm relative" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
                  className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    if (localEditText.trim()) {
                      const currentMessages = useChatStore.getState().messages;
                      const msgIndex = currentMessages.findIndex(m => m.id === message.id);
                      if (msgIndex !== -1) {
                        // Keep messages up to and including edited one
                        const updatedMessages = [...currentMessages];
                        updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], content: localEditText.trim() };
                        // Clear AI responses after edited message
                        setMessages(updatedMessages.slice(0, msgIndex + 1));
                        setLoading(true);
                        setEditingMessage(null);
                        setLocalEditText('');
                        // Store edited text for resend
                        localStorage.setItem('resendMessage', localEditText.trim());
                        // Reload page to trigger resend
                        window.location.reload();
                      }
                    }
                  }}
                  className="px-3 py-1 text-xs bg-white text-[#0047ff] hover:bg-white/90 rounded-full font-medium transition-colors"
                >
                  {language === 'vi' ? 'Gửi lại' : language === 'en' ? 'Resend' : language === 'ar' ? 'إعادة الإرسال' : 'Renvoyer'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}
          {/* Action Buttons - chỉ hiện khi không edit */}
          {!isEditing && (
            <div className="absolute -bottom-10 left-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => navigator.clipboard.writeText(message.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white shadow-md border border-black/10 transition-all text-xs font-bold text-slate-700 hover:text-black"
                title={language === 'vi' ? 'Sao chép' : language === 'en' ? 'Copy' : language === 'ar' ? 'نسخ' : 'Copier'}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Sao chép' : language === 'en' ? 'Copy' : language === 'ar' ? 'نسخ' : 'Copier'}</span>
              </button>
              <button
                onClick={() => {
                  setEditingMessage(message.id, message.content);
                  setLocalEditText(message.content);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white shadow-md border border-black/10 transition-all text-xs font-bold text-slate-700 hover:text-black"
                title={language === 'vi' ? 'Sửa' : language === 'en' ? 'Edit' : language === 'ar' ? 'تعديل' : 'Modifier'}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Sửa' : language === 'en' ? 'Edit' : language === 'ar' ? 'تعديل' : 'Modifier'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in group">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e0e7ff] to-[#c7d2fe] flex items-center justify-center flex-shrink-0 border-2 border-[#191b23]">
        <BotIcon className="w-5 h-5 text-[#0047ff]" />
      </div>

      <div className="flex-1 max-w-[85%]">
        {/* Agent Header */}
        <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-medium">
          [ TRỢ LÝ CNHT MADA // {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) } ]
        </div>
        
        <div className="text-sm text-slate-700 leading-relaxed [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_li]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:font-bold [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-blue-500 [&_a]:underline" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Expert Consultation Banner - Always LTR */}
        {hasNoData && (
          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl" dir="ltr">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="material-symbols-outlined text-xl text-white">psychology</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-800 mb-1">
                  {t('chat.notFoundInfo')}
                </h4>
                <p className="text-xs text-amber-700 mb-3">
                  {language === 'vi' ? 'Đội ngũ chuyên gia MADA có thể hỗ trợ bạn chi tiết hơn.' :
                   language === 'en' ? 'MADA expert team can help you with more details.' :
                   language === 'ar' ? 'يمكن لفريق خبراء MADA مساعدتك بمزيد من التفاصيل.' :
                   'L\'équipe d\'experts MADA peut vous aider avec plus de détails.'}
                </p>
                <button
                  onClick={onRequestConsultation}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-xs font-bold hover:shadow-lg hover:scale-105 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">support_agent</span>
                  {language === 'vi' ? 'Gửi yêu cầu tư vấn' :
                   language === 'en' ? 'Request Expert Consultation' :
                   language === 'ar' ? 'طلب استشارة خبير' :
                   'Demander une consultation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confidence Bar */}
        <div className="mt-4 flex items-center gap-4">
          <ConfidenceBar confidence={confidence} language={language} />
          <button 
            onClick={onRequestConsultation}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">support_agent</span>
            {language === 'vi' ? 'Tư vấn Chuyên gia' : language === 'en' ? 'Request Specialist' : language === 'ar' ? 'طلب خبير' : 'Demander un spécialiste'}
          </button>
        </div>

        {/* Smart Product Suggestions - moved to message.suggestedProducts (real MADA data) below */}

        {/* Action buttons - Always on the right side, force LTR */}
        <div className="mt-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" dir="ltr">
          <button
            onClick={() => onSpeak(message.content, message.id)}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              speakingId === message.id
                ? 'bg-blue-500 text-white'
                : 'hover:bg-slate-100 text-slate-500'
            )}
            title={speakingId === message.id 
              ? (language === 'vi' ? 'Dừng đọc' : language === 'en' ? 'Stop reading' : language === 'ar' ? 'إيقاف' : 'Arrêter')
              : (language === 'vi' ? 'Đọc tin nhắn' : language === 'en' ? 'Read message' : language === 'ar' ? 'قراءة' : 'Lire')
            }
          >
            <Speaker className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCopy(message.content, message.id)}
            className={clsx(
              'p-1.5 rounded-lg transition-colors hover:bg-slate-100',
              copiedId === message.id ? 'text-green-500' : 'text-slate-500'
            )}
            title={copiedId === message.id 
              ? (language === 'vi' ? 'Đã sao chép!' : language === 'en' ? 'Copied!' : language === 'ar' ? 'تم!' : 'Copié!')
              : (language === 'vi' ? 'Sao chép' : language === 'en' ? 'Copy' : language === 'ar' ? 'نسخ' : 'Copier')
            }
          >
            {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              setFeedback(feedback === 'like' ? null : 'like');
            }}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              feedback === 'like' ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-slate-500'
            )}
            title="Thích"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setFeedback(feedback === 'dislike' ? null : 'dislike');
            }}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              feedback === 'dislike' ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-slate-500'
            )}
            title={language === 'vi' ? 'Không thích' : language === 'en' ? 'Dislike' : language === 'ar' ? 'عدم الإعجاب' : 'Pas aimer'}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          {message.sources && message.sources.length > 0 && (
            <button
              onClick={() => setShowSources(!showSources)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                showSources ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-slate-500'
              )}
              title={language === 'vi' ? 'Xem nguồn tham khảo' : language === 'en' ? 'View sources' : language === 'ar' ? 'عرض المصادر' : 'Voir les sources'}
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sources Panel - Always LTR */}
        {showSources && message.sources && message.sources.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200" dir="ltr">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-500 uppercase">{language === 'vi' ? 'Nguồn tham khảo' : language === 'en' ? 'References' : language === 'ar' ? 'المراجع' : 'Références'}</span>
              {message.contextUsed && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">RAG</span>
              )}
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {message.sources.map((source, index) => (
                <div key={index} className="text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded">{index + 1}</span>
                    <span className="font-medium text-blue-500 truncate">{source.source}</span>
                  </div>
                  <p className="text-slate-500 line-clamp-2 pl-5">{source.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Products - WCAG 2.2 Compliant ProductCard */}
        {message.suggestedProducts && message.suggestedProducts.length > 0 && (
          <div className="mt-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200" dir="ltr" role="region" aria-label="Sản phẩm được giới thiệu">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-violet-500" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                {language === 'vi' ? 'Sản phẩm được giới thiệu' : language === 'en' ? 'Recommended Products' : 'المنتجات الموصى بها'}
              </h3>
            </div>
            
            {/* Standards badges - ĐÃ FIX: nằm trong card */}
            <div className="mb-4 p-2 bg-white rounded-lg border border-slate-200">
              <p className="text-[10px] text-slate-600 font-semibold mb-1.5 uppercase tracking-wide">
                {language === 'vi' ? 'Tiêu chuẩn kỹ thuật:' : language === 'en' ? 'Technical Standards:' : 'المعايير التقنية:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {['ISO 9999', 'IEC 60118-4', 'WHO GATE', 'WCAG 2.1'].map((std, idx) => (
                  <span key={idx} className="px-2 py-1 bg-violet-50 text-violet-700 text-[10px] font-semibold rounded border border-violet-200">
                    {std}
                  </span>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {message.suggestedProducts.slice(0, 4).map((product: SuggestedProduct, index: number) => {
                const matchScore = product.confidence 
                  ? Math.round(product.confidence * 100) 
                  : 75 + Math.floor(Math.random() * 20);
                
                return (
                  <ProductCard
                    key={product.id || index}
                    product={{
                      id: product.id || `product-${index}`,
                      name: language === 'en' && product.title_en ? product.title_en : product.title,
                      category: product.category || 'Công nghệ hỗ trợ',
                      brand: product.brand,
                      description: product.description,
                      price_range: product.price_range,
                      image_url: product.image_url,
                      product_url: product.product_url || product.source_url,
                      features: product.features?.slice(0, 3) || [],
                      standards: product.standards,
                      rating: product.rating,
                      review_count: product.review_count,
                      availability: product.availability,
                    }}
                    matchScore={matchScore}
                    matchReason={product.match_reason}
                    confidence={product.confidence ? Math.round(product.confidence * 100) : undefined}
                    language={language}
                    onViewDetails={() => {
                      const url = product.product_url || product.source_url;
                      // ✅ Validate URL trước khi mở (tránh Safari báo "trang không hợp lệ" với manual:<ts>)
                      if (url && /^https?:\/\//i.test(url)) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } else {
                        // Fallback: mở consultation modal nếu URL rỗng / invalid
                        onRequestConsultation?.();
                      }
                    }}
                    onRequestConsult={() => {
                      onRequestConsultation?.();
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default ChatPage;
