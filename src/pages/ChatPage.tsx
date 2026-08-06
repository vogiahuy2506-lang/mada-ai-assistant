import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, useChatHistoryStore, useLanguageStore, useViewModeStore, useAuthStore, useAnonQuotaStore, usePaywallModalStore, useAuthModalStore, useAgentStore, useSelectedAgentStore } from '@/stores';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';
import { QuotaIndicator } from '@/components/auth/QuotaIndicator';
import { RobotLogo } from '@/components/icons/RobotLogo';
import {
  Send, Plus, Menu, User, History, Mic,
  Trash2, Volume2, ChevronDown, Check, Copy, ThumbsUp, ThumbsDown,
  Speaker, BookOpen, Zap, Bot as BotIcon, HelpCircle, ChevronRight,
  FileText, Video, Mic2, ImageIcon, File, X, Eye, Shield,
  Globe, ExternalLink, Star, Award, FileCheck, MessageCircle,
  Phone, Mail, UserCircle, Briefcase, LogOut, Sparkles,
  Search, Pin, MessageSquare, PinOff, Loader2, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CATEGORY_INFO, SAMPLE_QUESTIONS, type ATCategory, type Language, type ViewMode } from '@/types';

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

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const categories = Object.keys(CATEGORY_INFO) as ATCategory[];

// Category Icons
const CATEGORY_ICONS: Record<ATCategory, string> = {
  hearing: 'hearing',
  vision: 'visibility',
  communication: 'record_voice_over',
  cognition: 'psychology',
  mobility: 'accessible_forward',
  daily_living: 'commute',
  education: 'school',
};

const CATEGORY_LABELS: Record<ATCategory, { title: string; titleEn: string; desc: string; descEn: string }> = {
  hearing: { 
    title: 'CẢM GIÁC - THÍNH GIÁC', 
    titleEn: 'HEARING SENSORY', 
    desc: 'Máy trợ thính, thiết bị phản hồi...', 
    descEn: 'Hearing aids, alerting devices...' 
  },
  vision: { 
    title: 'CẢM GIÁC - THỊ GIÁC', 
    titleEn: 'VISION SENSORY', 
    desc: 'Phần mềm đọc màn hình, chữ nổi...', 
    descEn: 'Screen readers, braille displays...' 
  },
  communication: { 
    title: 'GIỌNG NÓI VÀ LỜI NÓI', 
    titleEn: 'SPEECH & VOICE', 
    desc: 'Thiết bị giao tiếp tăng cường...', 
    descEn: 'Augmentative communication devices...' 
  },
  cognition: { 
    title: 'TÂM THẦN - NHẬN THỨC', 
    titleEn: 'COGNITIVE', 
    desc: 'Thiết bị hỗ trợ trí nhớ, sắp xếp...', 
    descEn: 'Memory aids, organization tools...' 
  },
  mobility: { 
    title: 'VẬN ĐỘNG THẦN KINH', 
    titleEn: 'NEUROMUSCULAR', 
    desc: 'Nẹp chỉnh hình, bàn phím thay thế...', 
    descEn: 'Orthoses, alternative keyboards...' 
  },
  daily_living: { 
    title: 'DI CHUYỂN VÀ GIAO THÔNG', 
    titleEn: 'MOBILITY', 
    desc: 'Xe lăn thông minh, cải tiến...', 
    descEn: 'Smart wheelchairs, improvements...' 
  },
  education: { 
    title: 'THÔNG TIN BỔ TRỢ', 
    titleEn: 'EDUCATION', 
    desc: 'Tiêu chuẩn Công nghệ hỗ trợ...', 
    descEn: 'Assistive Technology standards...' 
  },
};

// Category prompts - sent to AI when user clicks a category
const CATEGORY_PROMPTS: Record<ATCategory, Record<Language, string>> = {
  hearing: {
    vi: 'Hãy giới thiệu về các thiết bị công nghệ hỗ trợ cho người khiếm thính, bao gồm máy trợ thính, hệ thống FM, thiết bị phản hồi âm thanh, và giải pháp kết nối.',
    en: 'Introduce assistive technology devices for hearing impaired, including hearing aids, FM systems, alerting devices, and connectivity solutions.',
    ar: 'قدم أجهزة تقنية مساعدة للمصابين بضعف السمع، بما في ذلك أجهزة السمع وأنظمة FM وأجهزة التنبيه.',
    fr: 'Présentez les appareils technologiques d\'assistance pour les malentendants, y compris les appareils auditifs, les systèmes FM et les solutions de connectivité.',
  },
  vision: {
    vi: 'Hãy giới thiệu về các thiết bị công nghệ hỗ trợ cho người khiếm thị, bao gồm phần mềm đọc màn hình, màn hình Braille, kính thông minh OrCam, và các công cụ tiếp cận khác.',
    en: 'Introduce assistive technology devices for visually impaired, including screen readers, Braille displays, smart glasses like OrCam, and other accessibility tools.',
    ar: 'قدم أجهزة تقنية مساعدة للمكفوفين، بما في ذلك قارئات الشاشة وشاشات برايل والنظارات الذكية.',
    fr: 'Présentez les appareils technologiques d\'assistance pour les malvoyants, y compris les lecteurs d\'écran, les plages braille et les lunettes intelligentes.',
  },
  communication: {
    vi: 'Hãy giới thiệu về các thiết bị giao tiếp tăng cường (AAC) cho người khó khăn trong giao tiếp, bao gồm thiết bị AAC, ứng dụng di động, và tổng hợp giọng nói.',
    en: 'Introduce augmentative and alternative communication (AAC) devices for people with speech difficulties, including AAC devices, mobile apps, and speech synthesis.',
    ar: 'قدم أجهزة الاتصال المعزز والبديل للأشخاص الذين يعانون من صعوبات في الكلام.',
    fr: 'Présentez les appareils de communication augmentative et alternative (CAA) pour les personnes ayant des difficultés d\'élocution.',
  },
  cognition: {
    vi: 'Hãy giới thiệu về các thiết bị hỗ trợ nhận thức cho người gặp khó khăn về trí nhớ, chú ý, và học tập, bao gồm thiết bị trợ nhớ, ứng dụng sắp xếp, và công cụ hỗ trợ nhận thức.',
    en: 'Introduce cognitive support devices for people with memory, attention, and learning difficulties, including memory aids, organization apps, and cognitive support tools.',
    ar: 'قدم أجهزة الدعم المعرفي للأشخاص الذين يعانون من صعوبات في الذاكرة والانتباه والتعلم.',
    fr: 'Présentez les appareils de soutien cognitif pour les personnes ayant des difficultés de mémoire, d\'attention et d\'apprentissage.',
  },
  mobility: {
    vi: 'Hãy giới thiệu về các thiết bị hỗ trợ vận động và di chuyển, bao gồm xe lăn điện, xe lăn thông minh, prosthetics, và các thiết bị hỗ trợ khác.',
    en: 'Introduce mobility support devices including electric wheelchairs, smart wheelchairs, prosthetics, and other mobility aids.',
    ar: 'قدم أجهزة دعم الحركة بما في ذلك الكراسي المتحركة الكهربائية والأطراف الصناعية.',
    fr: 'Présentez les appareils de soutien à la mobilité incluant les fauteuils roulants électriques et les prothèses.',
  },
  daily_living: {
    vi: 'Hãy giới thiệu về các thiết bị hỗ trợ sinh hoạt hàng ngày cho người khuyết tật, bao gồm dụng cụ ăn uống, thiết bị phòng tắm, và công cụ nhà bếp đặc biệt.',
    en: 'Introduce daily living aids for people with disabilities, including eating aids, bathroom equipment, and special kitchen tools.',
    ar: 'قدم أجهزة المعيشة اليومية للأشخاص ذوي الإعاقة، بما في ذلك أدوات الأكل ومعدات الحمام.',
    fr: 'Présentez les aides à la vie quotidienne pour les personnes handicapées, incluant les ustensiles de repas et les équipements de salle de bain.',
  },
  education: {
    vi: 'Hãy giới thiệu về các công nghệ hỗ trợ giáo dục cho người khuyết tật, bao gồm phần mềm đọc văn bản, công cụ accessibility, và các tài liệu học tập tiếp cận.',
    en: 'Introduce educational assistive technologies for people with disabilities, including text-to-speech software, accessibility tools, and accessible learning materials.',
    ar: 'قدم تقنيات المساعدة التعليمية للأشخاص ذوي الإعاقة، بما في ذلك برامج تحويل النص إلى كلام.',
    fr: 'Présentez les technologies d\'assistance éducative pour les personnes handicapées, incluant les logiciels de synthèse vocale.',
  },
};

// Sample Products Data - theo từng category (anh thuc cua san pham)
const SAMPLE_PRODUCTS: Record<string, any[]> = {
  vision: [
    { name: 'OrCam MyEye Pro', nameVi: 'OrCam MyEye Pro', brand: 'OrCam Technologies', image: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=600&h=400&fit=crop', price: '~$6,500 USD', features: ['Nhận diện khuôn mặt', 'Đọc văn bản 100+ ngôn ngữ', 'Nhận diện tiền giấy'] },
    { name: 'JAWS Screen Reader', nameVi: 'JAWS Screen Reader', brand: 'Freedom Scientific', image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=600&h=400&fit=crop', price: '~$1,000 USD/năm', features: ['Đọc màn hình Windows', 'Hỗ trợ 40+ ngôn ngữ', 'Tương thích Braille'] },
    { name: 'NVDA Screen Reader', nameVi: 'NVDA Screen Reader', brand: 'NV Access', image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=400&fit=crop', price: 'Miễn phí (donation)', features: ['Đọc màn hình mã nguồn mở', 'Hỗ trợ 50+ ngôn ngữ', 'Chạy trên Windows'] },
  ],
  hearing: [
    { name: 'Phonak Paradise P90', nameVi: 'Phonak Paradise P90', brand: 'Phonak', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=400&fit=crop', price: '~$3,500 USD/đôi', features: ['Kết nối Bluetooth', 'Chống ồn AI', 'Pin sạc lithium'] },
    { name: 'Roger Pen Microphone', nameVi: 'Roger Pen Microphone', brand: 'Phonak', image: 'https://images.unsplash.com/photo-1506499039984-8dd3cc33c99e?w=600&h=400&fit=crop', price: '~$1,200 USD', features: ['Hệ thống FM', 'Microphone định hướng', 'Kết nối đa thiết bị'] },
    { name: 'Oticon More Hearing Aid', nameVi: 'Oticon More Hearing Aid', brand: 'Oticon', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=400&fit=crop', price: '~$4,200 USD/đôi', features: ['Deep Neural Network', 'Chống ồn thông minh', 'Kết nối iPhone/Android'] },
  ],
  mobility: [
    { name: 'Permobil F5 Wheelchair', nameVi: 'Permobil F5 Xe lăn điện', brand: 'Permobil', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop', price: '~$25,000 USD', features: ['Đứng thẳng tự động', 'Leo dốc 12°', 'Điều khiển smartphone'] },
    { name: 'Scalamobil S95', nameVi: 'Scalamobil S95 Leo cầu thang', brand: 'Scala', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop', price: '~$4,500 USD', features: ['Leo cầu thang an toàn', 'Pin sạc', 'Gắn được nhiều xe lăn'] },
    { name: 'Quickie Q700-UP M', nameVi: 'Quickie Q700-UP M Xe lăn', brand: 'Sunrise Medical', image: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=600&h=400&fit=crop', price: '~$18,500 USD', features: ['Hệ thống đứng', 'C-Leg technology', 'Cấu hình tùy chỉnh'] },
  ],
  cognition: [
    { name: 'Tobii Dynavox TD I-13', nameVi: 'Tobii Dynavox TD I-13 Eye Tracker', brand: 'Tobii Dynavox', image: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=600&h=400&fit=crop', price: '~$8,500 USD', features: ['Eye-tracking', 'Màn hình 13.3 inch', 'AAC software'] },
    { name: 'Proloquo2Go App', nameVi: 'Proloquo2Go AAC App', brand: 'AssistiveWare', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&h=400&fit=crop', price: '~$250 USD/lifetime', features: ['iOS app', 'Symbol-based AAC', 'Giọng Việt/Eng'] },
    { name: 'Memo Smart Calendar', nameVi: 'Memo Smart Calendar', brand: 'Memo', image: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=600&h=400&fit=crop', price: '~$300 USD', features: ['Đồng hồ nhắc nhở', 'Màn hình LCD', 'Chống nhầm lẫn thuốc'] },
  ],
  communication: [
    { name: 'LightWriter SL40 AAC', nameVi: 'LightWriter SL40 Thiết bị AAC', brand: 'Tobii Dynavox', image: 'https://images.unsplash.com/photo-1590650213165-c1fef80648c4?w=600&h=400&fit=crop', price: '~$4,200 USD', features: ['Bàn phím vật lý', 'Màn hình chia đôi', 'Tổng hợp giọng nói'] },
    { name: 'TouchChat HD AAC', nameVi: 'TouchChat HD AAC App', brand: 'Prentke Romich', image: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?w=600&h=400&fit=crop', price: '~$300 USD', features: ['iPad app', 'Vocabulary pages', 'Customizable'] },
    { name: 'Big Mack Communicator', nameVi: 'Big Mack Communicator', brand: 'AbleNet', image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&h=400&fit=crop', price: '~$160 USD', features: ['1 nút bấm lớn', 'Ghi âm 75 giây', 'Dùng cho trẻ em'] },
  ],
  daily_living: [
    { name: 'Easy Grip Eating Aids', nameVi: 'Dụng cụ ăn uống Easy Grip', brand: 'Performance Health', image: 'https://images.unsplash.com/photo-1584346133934-a3afd2a33c4c?w=600&h=400&fit=crop', price: '~$30-50 USD', features: ['Tay cầm dày', 'Chống trượt', 'Bộ 4 món'] },
    { name: 'Mediplanner Timer', nameVi: 'Hộp thuốc Mediplanner', brand: 'TabTimer', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=400&fit=crop', price: '~$120 USD', features: ['8 ngăn thuốc', 'Báo động', 'Nhắc nhở tự động'] },
    { name: 'Grab Bar Bathroom', nameVi: 'Thanh vịn nhà tắm', brand: 'Moen', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop', price: '~$80-200 USD', features: ['Thép không gỉ', 'Chịu lực 250kg', 'Lắp đặt dễ dàng'] },
  ],
  education: [
    { name: 'Kurzweil 3000', nameVi: 'Kurzweil 3000 Phần mềm học tập', brand: 'Cambium Learning', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop', price: '~$1,500 USD/năm', features: ['Đọc văn bản', 'Hỗ trợ dyslexia', 'Scan tài liệu'] },
    { name: 'Dragon NaturallySpeaking', nameVi: 'Dragon Speech Recognition', brand: 'Nuance', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop', price: '~$500 USD', features: ['Speech-to-text', '99% accuracy', 'Vocabulary tùy chỉnh'] },
    { name: 'C-Pen Reader', nameVi: 'C-Pen Reader Scanner', brand: 'C-Pen', image: 'https://images.unsplash.com/photo-1553729784-e91953dec042?w=600&h=400&fit=crop', price: '~$300 USD', features: ['Scan văn bản', 'Đọc to', 'Từ điển tích hợp'] },
  ],
};

// Sample Standards Data
const STANDARDS_DATA = [
  { code: 'ISO 9999', name: 'Assistive Products Classification', source: 'ISO' },
  { code: 'WCAG 2.1', name: 'Web Content Accessibility Guidelines', source: 'W3C' },
  { code: 'WHO GATE', name: 'Global Assistive Technology', source: 'WHO' },
  { code: 'EN 1332', name: 'European AT Standards', source: 'CEN' },
];

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
}

// Sidebar conversation shape sourced from `useChatHistoryStore` (HistoryConversation)

// Consultation Modal Component
function ConsultationModal({ 
  isOpen, 
  onClose,
  onSubmit 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; phone: string; message: string }) => void;
}) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Gửi email về MADA thông qua API
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          timestamp: new Date().toISOString(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSubmit(formData);
        setFormData({ name: '', email: '', phone: '', message: '' });
        onClose(); // Đóng modal sau khi gửi thành công
      } else {
        alert(data.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Consultation submit error:', error);
      // Fallback: vẫn thông báo thành công nếu API không hoạt động
      onSubmit(formData);
      setFormData({ name: '', email: '', phone: '', message: '' });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Yêu cầu Tư vấn Chuyên gia</h3>
                <p className="text-xs text-blue-100">MADA Center, Doha, Qatar</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <UserCircle className="w-3.5 h-3.5" /> Họ và tên *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="email@example.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Số điện thoại
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="+84 123 456 789"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> Yêu cầu kỹ thuật *
            </label>
            <textarea
              required
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors resize-none"
              placeholder="Mô tả chi tiết nhu cầu về thiết bị công nghệ hỗ trợ..."
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-800">MADA Center Qatar</p>
                <p className="text-xs text-blue-600 mt-0.5">Chuyên gia AT sẽ liên hệ trong 24-48 giờ</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Gửi Yêu cầu Tư vấn
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({ product, viewMode }: { product: any; viewMode: ViewMode }) {
  const isSpecialist = viewMode === 'at_specialist';

  // Lay category tu product hoac detect tu ten
  const getCategoryInfo = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('orcam') || n.includes('jaws') || n.includes('nvda') || n.includes('screen reader') || n.includes('braille') || n.includes('vision') || n.includes('eye')) {
      return { gradient: 'from-violet-600 to-purple-800', icon: '👁️', label: 'Hỗ trợ thị giác' };
    }
    if (n.includes('phonak') || n.includes('oticon') || n.includes('roger') || n.includes('hearing') || n.includes('trợ thính') || n.includes('tai')) {
      return { gradient: 'from-blue-500 to-cyan-600', icon: '👂', label: 'Hỗ trợ thính giác' };
    }
    if (n.includes('wheelchair') || n.includes('xe lăn') || n.includes('permobil') || n.includes('scalamobil') || n.includes('mobility') || n.includes('leo cầu')) {
      return { gradient: 'from-emerald-500 to-teal-600', icon: '🦽', label: 'Hỗ trợ vận động' };
    }
    if (n.includes('tobii') || n.includes('aac') || n.includes('communicator') || n.includes('touchchat') || n.includes('lightwriter') || n.includes('proloquo')) {
      return { gradient: 'from-orange-500 to-red-500', icon: '💬', label: 'Thiết bị giao tiếp' };
    }
    if (n.includes('dragon') || n.includes('speech') || n.includes(' Kurzweil') || n.includes('c-pen') || n.includes('học') || n.includes('education')) {
      return { gradient: 'from-amber-500 to-orange-600', icon: '📚', label: 'Hỗ trợ giáo dục' };
    }
    if (n.includes('medication') || n.includes('mediplanner') || n.includes('eat') || n.includes('grab') || n.includes('bathroom')) {
      return { gradient: 'from-pink-500 to-rose-600', icon: '🏠', label: 'Sinh hoạt hàng ngày' };
    }
    if (n.includes('memo') || n.includes('calendar') || n.includes('memory') || n.includes('cognitive')) {
      return { gradient: 'from-indigo-500 to-blue-600', icon: '🧠', label: 'Hỗ trợ nhận thức' };
    }
    return { gradient: 'from-slate-600 to-slate-800', icon: '🔧', label: 'Thiết bị AT' };
  };

  const categoryInfo = getCategoryInfo(product.name);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 group">
      {/* Product Image Area - Gradient + Icon */}
      <div className={`aspect-video relative overflow-hidden bg-gradient-to-br ${categoryInfo.gradient}`}>
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
          {/* Category icon */}
          <div className="text-5xl mb-2 group-hover:scale-110 transition-transform duration-300">{categoryInfo.icon}</div>

          {/* Product name */}
          <h4 className="text-white font-bold text-center text-sm leading-tight drop-shadow-lg">{product.name}</h4>

          {/* Category label */}
          <span className="mt-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-white text-[10px] font-semibold">
            {categoryInfo.label}
          </span>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Price badge */}
        {product.price && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-xl shadow-lg">
            {product.price}
          </div>
        )}

        {/* Brand badge (specialist mode) */}
        {isSpecialist && product.brand && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-lg shadow">
            {product.brand}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Features list */}
        <div className="space-y-2 mb-4">
          {product.features.slice(0, isSpecialist ? 5 : 3).map((feature: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Action link */}
        <a
          href="https://mada.org.qa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow"
        >
          Tìm hiểu thêm <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// Standards Badge Component
function StandardsBadge({ standards }: { standards: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {standards.map((standard, idx) => (
        <span 
          key={idx}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono text-blue-700"
        >
          <Award className="w-3.5 h-3.5" />
          {standard}
        </span>
      ))}
      {standards.length === 0 && STANDARDS_DATA.slice(0, 3).map((std, idx) => (
        <span 
          key={idx}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600"
        >
          <FileCheck className="w-3.5 h-3.5" />
          {std.code}
        </span>
      ))}
    </div>
  );
}

// Confidence Rating Bar Component
function ConfidenceBar({ confidence }: { confidence: number }) {
  const getColor = (value: number) => {
    if (value >= 85) return 'bg-teal-500';
    if (value >= 70) return 'bg-blue-500';
    if (value >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Độ tin cậy</span>
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

// View Mode Toggle Component - Compact icon pill
function ViewModeToggle({ viewMode, onToggle }: { viewMode: ViewMode; onToggle: () => void }) {
  const isEndUser = viewMode === 'end_user';

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-all group"
      title={isEndUser ? 'Người dùng - Chế độ thân thiện' : 'Chuyên gia AT - Chế độ chuyên sâu'}
    >
      <div className="relative w-9 h-5 bg-slate-300 rounded-full p-0.5 transition-colors">
        <div
          className={clsx(
            'w-4 h-4 bg-white rounded-full shadow-sm transition-transform flex items-center justify-center',
            !isEndUser && 'translate-x-4'
          )}
        >
          {isEndUser ? (
            <Eye className="w-2.5 h-2.5 text-slate-600" />
          ) : (
            <Shield className="w-2.5 h-2.5 text-blue-600" />
          )}
        </div>
      </div>
      <span className="hidden xl:inline text-[11px] font-semibold text-slate-600">
        {isEndUser ? 'Người dùng' : 'Chuyên gia'}
      </span>
    </button>
  );
}

export function ChatPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguageStore();
  const { viewMode, toggleViewMode } = useViewModeStore();
  const { messages, addMessage, clearMessages, isLoading, setLoading } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const authModal = useAuthModalStore();

  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; size: number; content?: string; originalFile?: File }[]>([]);
  const [activeCategory, setActiveCategory] = useState<ATCategory | null>(null);

  // Agent state
  const activeAgents = useAgentStore((s) => s.getActiveAgents());
  const { selectedAgentId, setSelectedAgentId } = useSelectedAgentStore();
  const selectedAgent = activeAgents.find(a => a.id === selectedAgentId) || activeAgents[0];

  // Chat history from persisted store
  const historyConversations = useChatHistoryStore((s) => s.conversations);
  const addOrUpdateConversation = useChatHistoryStore((s) => s.addOrUpdateConversation);
  const touchConversation = useChatHistoryStore((s) => s.touchConversation);
  const pinConversation = useChatHistoryStore((s) => s.pinConversation);
  const removeFromHistory = useChatHistoryStore((s) => s.removeConversation);
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

  // Helpers — format date relative + ISO
  const formatRelativeDate = (ts: number): string => {
    const d = new Date(ts);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    if (ts >= startOfToday) return 'Today';
    if (ts >= startOfYesterday) return 'Yesterday';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
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
  
  // DEBUG: Log selectedFiles changes
  useEffect(() => {
    console.log('[MADA DEBUG] selectedFiles changed:', selectedFiles);
  }, [selectedFiles]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const isEndUser = viewMode === 'end_user';
  const currentQuestions = activeCategory 
    ? SAMPLE_QUESTIONS[activeCategory][viewMode]
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
      if (e.key === 'Escape') {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setShowLanguageMenu(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

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
    setStreamingContent('');

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
    } else {
      touchConversation(currentConvId, userMessage);
    }

    addMessage({ role: 'user', content: userMessage });

    // Xây dựng message với nội dung file
    let fullMessage = userMessage;
    let attachments: any[] = [];
    
    if (selectedFiles.length > 0) {
      console.log('[DEBUG] Processing files:', selectedFiles.length);
      
      // Chuẩn bị attachments để gửi lên server
      for (const f of selectedFiles) {
        if (f.content && !f.content.includes('đang chờ parse')) {
          // Text content đã có sẵn
          attachments.push({
            type: 'text',
            name: f.name,
            content: f.content,
          });
        } else if (f.originalFile) {
          // File cần parse - đọc base64
          try {
            const arrayBuffer = await f.originalFile.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            attachments.push({
              type: f.type || f.name,
              name: f.name,
              base64: base64,
            });
          } catch (e) {
            console.log('[DEBUG] Failed to read file:', f.name);
          }
        }
      }
      
      fullMessage = userMessage;
    }

    let apiSuccess = false;

    try {
      // Gửi chat với file đính kèm
      const chatEndpoint = attachments.length > 0 ? '/api/chat-with-file' : '/api/chat';
      const chatBody: any = { 
        message: fullMessage, 
        language,
        agentId: selectedAgentId,
        agentPrompt: selectedAgent?.systemPrompt,
      };
      
      // Thêm attachments nếu có
      if (attachments.length > 0) {
        chatBody.attachments = attachments;
      }
      
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
      });

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
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
        });
      } else {
        addMessage({
          role: 'assistant',
          content: 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.',
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: 'Đã xảy ra lỗi kết nối. Vui lòng kiểm tra kết nối internet và thử lại.',
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

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
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

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeFromHistory(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      clearMessages();
    }
  };

  const handlePinConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    pinConversation(id);
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

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInputValue('Tôi cần tìm thiết bị hỗ trợ người khiếm thị');
      }, 2000);
    }
  };

  const handleFileAttach = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  const handleAttachmentSelect = (type: string, accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = type === 'file';
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const processedFiles = await Promise.all(
          Array.from(files).map(async (file) => {
            const fileData: { name: string; type: string; size: number; content?: string; originalFile?: File } = {
              name: file.name,
              type: file.type,
              size: file.size,
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
                fileData.content = `[File PDF: ${file.name}]\n(Kích thước: ${(file.size / 1024).toFixed(1)} KB - đang chờ parse...)`;
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
                  fileData.content = `[File nhị phân: ${file.name}]`;
                }
              }
            } catch (err) {
              console.error('Error reading file:', err);
              fileData.content = `[Không thể đọc nội dung file: ${file.name}]`;
            }
            
            console.log('[MADA] File processed:', fileData);
            return fileData;
          })
        );
        
        setSelectedFiles(prev => [...prev, ...processedFiles]);
        
        // Hiển thị file preview trong chat với nội dung
        const fileList = Array.from(files).map(f => f.name).join(', ');
        if (processedFiles.length === 1 && processedFiles[0].content) {
          // Nếu là file text/URL, hiển thị preview
          const file = processedFiles[0];
          const fileContent = file.content || '';
          const previewContent = fileContent.length > 500 
            ? fileContent.slice(0, 500) + '...\n\n*(nội dung đầy đủ sẽ được gửi kèm)*'
            : fileContent;
          
          if (file.type === 'text/url') {
            addMessage({
              role: 'user',
              content: `📎 Đã đính kèm: **${file.name}**\n\n${previewContent}`,
            });
          } else if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json)$/)) {
            addMessage({
              role: 'user',
              content: `📄 Đã đính kèm: **${file.name}**\n\`\`\`\n${previewContent}\n\`\`\``,
            });
          } else if (file.type === 'application/pdf') {
            addMessage({
              role: 'user',
              content: `📕 Đã đính kèm: **${file.name}**\n*(File PDF - ${(file.size / 1024).toFixed(1)} KB)*`,
            });
          } else if (file.type.includes('word') || file.name.endsWith('.docx')) {
            addMessage({
              role: 'user',
              content: `📘 Đã đính kèm: **${file.name}**\n*(File Word - ${(file.size / 1024).toFixed(1)} KB)*`,
            });
          } else if (file.type.startsWith('image/')) {
            addMessage({
              role: 'user',
              content: `🖼️ Đã đính kèm: **${file.name}**`,
            });
          } else if (file.type.startsWith('video/')) {
            addMessage({
              role: 'user',
              content: `🎬 Đã đính kèm: **${file.name}**\n*(Video - ${(file.size / (1024 * 1024)).toFixed(1)} MB)*`,
            });
          } else if (file.type.startsWith('audio/')) {
            addMessage({
              role: 'user',
              content: `🎵 Đã đính kèm: **${file.name}**\n*(Audio - ${(file.size / (1024 * 1024)).toFixed(1)} MB)*`,
            });
          } else {
            addMessage({
              role: 'user',
              content: `📎 Đã đính kèm: **${file.name}**\n*(Nội dung đã được đọc, sẽ gửi kèm khi bạn nhấn Enter)*`,
            });
          }
        } else if (processedFiles.length > 1) {
          addMessage({
            role: 'user',
            content: `📎 Đã đính kèm ${processedFiles.length} files: ${fileList}`,
          });
        } else {
          addMessage({
            role: 'user',
            content: `📎 Đã đính kèm: ${fileList}`,
          });
        }
      }
    };
    
    input.click();
    setShowAttachmentMenu(false);
  };

  const handleRemoveFile = (index: number) => {
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
          name: data.data?.title || new URL(url).hostname,
          type: 'text/url',
          size: (data.data?.content || '').length,
          content: `[Nguồn: ${url}]\n\n${data.data?.content || ''}`,
        }]);

        addMessage({
          role: 'user',
          content: `🔗 Đã tải nội dung từ: ${url}\n\n**${data.data?.title || 'Không có tiêu đề'}**\n\n${(data.data?.content || '').slice(0, 500)}${(data.data?.content || '').length > 500 ? '...' : ''}`,
        });
      } else {
        addMessage({
          role: 'assistant',
          content: `❌ Không thể tải nội dung từ URL: ${data.error || 'Lỗi không xác định'}`,
        });
      }
    } catch (error) {
      console.error('Fetch URL error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ Không thể kết nối đến URL. Vui lòng kiểm tra lại đường dẫn.`,
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
      content: `📋 Đã gửi yêu cầu tư vấn chuyên gia MADA`,
    });
  };

  return (
    <div className="flex h-screen bg-[#f9f9ff] dark:bg-[#191b23] overflow-hidden">
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
      />

      {/* Auth Modal - Login / Register / Google */}
      <AuthModal />

      {/* Paywall Modal - shown when quota exhausted */}
      <PaywallModal />

      {/* ============== SIDEBAR ============== */}
      <aside
        className={clsx(
          'h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden',
          'max-md:fixed max-md:left-0 max-md:top-0 max-md:z-50 max-md:h-screen',
          !sidebarOpen && 'max-md:-translate-x-full'
        )}
      >
        {/* Logo Area */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1.5">
            <RobotLogo variant="white" className="w-full h-full" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight">MADA AI</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Universal Access</p>
          </div>
        </div>

        {/* View Mode Toggle đã di chuyển lên Header */}

        {/* New Chat Button */}
        <div className="px-4 mb-4 mt-2">
          <button
            onClick={handleNewChat}
            className="w-full text-white rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-semibold shadow-lg hover:opacity-90 transition-all bg-blue-600 hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {language === 'vi' ? 'Trò chuyện mới' : language === 'en' ? 'New Chat' : language === 'ar' ? 'محادثة جديدة' : 'Nouvelle conversation'}
          </button>
        </div>

        {/* Category Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {categories.map((category) => {
            const isActive = activeCategory === category;
            const label = CATEGORY_LABELS[category];
            
            return (
              <button
                key={category}
                onClick={() => {
                  if (isActive) {
                    // Đang chọn category này -> bỏ chọn (giữ chat hiện tại)
                    setActiveCategory(null);
                  } else {
                    // Chọn category khác -> clear chat cũ, mở chat mới
                    const hasMessages = messages.length > 0;
                    if (hasMessages) {
                      // Lưu chat cũ vào history store
                      if (activeConversationId && messages.length > 0) {
                        addOrUpdateConversation({
                          id: activeConversationId,
                          title: messages[0]?.content?.slice(0, 40) || 'Cuộc trò chuyện',
                          date: new Date().toISOString().slice(0, 10),
                          preview: messages[messages.length - 1]?.content ?? '',
                          messages: messages.length,
                          pinned: false,
                          category: activeCategory,
                          createdAt: Date.now() - 60_000,
                          updatedAt: Date.now(),
                        });
                      }
                    }
                    // Mở chat mới + set category mới
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

                    // Tự động hỏi AI về category được chọn
                    setTimeout(() => {
                      const categoryPrompt = CATEGORY_PROMPTS[category]?.[language] || CATEGORY_PROMPTS[category]?.vi || '';
                      if (categoryPrompt) {
                        setInputValue(categoryPrompt);
                        setTimeout(() => {
                          handleSend();
                        }, 50);
                      }
                    }, 100);
                  }
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-2xl group',
                  isActive
                    ? 'bg-blue-500 text-white font-semibold shadow-md'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  isActive ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                )}>
                  <span className="material-symbols-outlined text-lg">
                    {CATEGORY_ICONS[category]}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold uppercase tracking-tight">
                    {isEndUser ? label.title : label.titleEn}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {isEndUser ? label.desc : label.descEn}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Recent Chats Section */}
          <div className="pt-6 pb-4">
            <div className="flex items-center justify-between px-4 mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lịch sử gần đây</p>
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
                  <p className="text-xs font-medium">{language === 'vi' ? 'Chưa có hội thoại nào' : language === 'en' ? 'No conversations yet' : language === 'ar' ? 'لا توجد محادثات' : 'Pas de conversations'}</p>
                  <p className="text-[10px] mt-1 opacity-70">{language === 'vi' ? 'Bắt đầu chat để lưu lịch sử tự động' : language === 'en' ? 'Start chatting to save history automatically' : language === 'ar' ? 'ابدأ المحادثة للحفظ التلقائي' : 'Commencez à discuter'}</p>
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
                    <div
                      onClick={() => handleSelectConversation(conv.id)}
                      className={clsx(
                        'group relative flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all',
                        activeConversationId === conv.id
                          ? 'bg-slate-800 text-white shadow-md'
                          : 'hover:bg-slate-50 text-slate-600'
                      )}
                    >
                      {conv.pinned ? (
                        <Pin className={clsx(
                          'w-3.5 h-3.5 flex-shrink-0 fill-current',
                          activeConversationId === conv.id ? 'text-amber-400' : 'text-amber-500'
                        )} />
                      ) : (
                        <History className={clsx('w-3.5 h-3.5 flex-shrink-0', activeConversationId === conv.id ? 'text-slate-300' : 'text-slate-400')} />
                      )}
                      <p className="flex-1 text-sm truncate font-medium">{conv.title}</p>
                      <span className={clsx(
                        'text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                        activeConversationId === conv.id
                          ? 'bg-white/15 text-white'
                          : 'bg-slate-100 text-slate-500'
                      )}>
                        {conv.messages}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handlePinConversation(e, conv.id)}
                          className={clsx(
                            'p-1.5 rounded transition-colors',
                            activeConversationId === conv.id
                              ? 'hover:bg-white/10'
                              : 'hover:bg-slate-200'
                          )}
                          title={conv.pinned ? 'Bỏ ghim' : 'Ghim'}
                        >
                          {conv.pinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className={clsx(
                            'p-1.5 rounded transition-colors',
                            activeConversationId === conv.id
                              ? 'hover:bg-white/10'
                              : 'hover:bg-slate-200'
                          )}
                          title="Xóa cuộc trò chuyện"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
                return acc;
              }, [] as React.ReactNode[])}

              {historyConversations.length > 0 && filteredConversations().length === 0 && historySearch.trim() !== '' && (
                <div className="text-center px-4 py-6 text-xs text-slate-400">
                  Không tìm thấy hội thoại "{historySearch}"
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-100">
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
                  alt="Khách"
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
                    <p className="text-sm font-bold truncate">Khách</p>
                    <p className="text-xs text-slate-400 truncate">Chưa đăng nhập</p>
                  </>
                )}
              </div>
              <ChevronRight className={clsx('w-4 h-4 text-slate-400 transition-transform', showProfileMenu && 'rotate-90')} />
            </button>

            {showProfileMenu && user && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute left-4 right-4 bottom-24 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
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
                      Hồ sơ
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/pricing'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Nâng cấp gói
                    </button>
                    <hr className="my-1 border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
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
        {/* Top Navigation Bar */}
        <header className="h-16 flex items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-slate-100 z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-slate-400 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-slate-300 mx-2 hidden lg:block">|</span>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {isEndUser 
                ? (language === 'vi' ? 'Premium Intelligence' : language === 'en' ? 'Premium Intelligence' : language === 'ar' ? 'ذكاء متميز' : 'Intelligence Premium')
                : (language === 'vi' ? 'AT Specialist Mode' : language === 'en' ? 'AT Specialist Mode' : language === 'ar' ? 'وضع خبير AT' : 'Mode Spécialiste AT')
              }
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            {/* View Mode Toggle - Compact pill */}
            <ViewModeToggle viewMode={viewMode} onToggle={toggleViewMode} />

            {/* Quota Indicator */}
            <QuotaIndicator />

            {/* Agent Selector */}
            <div className="relative" ref={languageMenuRef}>
              <button
                onClick={() => setShowAgentMenu(!showAgentMenu)}
                className="flex items-center gap-2 text-slate-600 hover:text-blue-500 transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <span className="text-lg">{selectedAgent?.avatar || '🤖'}</span>
                <span className="hidden lg:inline max-w-[120px] truncate">{selectedAgent?.name || 'Agent'}</span>
                <ChevronDown className={clsx('w-4 h-4 transition-transform', showAgentMenu && 'rotate-180')} />
              </button>

              {showAgentMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 px-2 py-1">Chọn Agent</p>
                  </div>
                  {activeAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setShowAgentMenu(false);
                      }}
                      className={clsx(
                        'w-full flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left',
                        selectedAgentId === agent.id && 'bg-blue-50'
                      )}
                    >
                      <span className="text-2xl mt-0.5">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{agent.name}</span>
                          {selectedAgentId === agent.id && (
                            <Check className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{agent.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
              <a className="hover:text-blue-500 transition-colors" href="#">Mô hình</a>
              <a className="hover:text-blue-500 transition-colors" href="#">API</a>
              <a className="hover:text-blue-500 transition-colors" href="#">Tài liệu</a>
            </nav>
            
            <div className="flex items-center gap-4 border-l border-slate-200 pl-5">
              {/* Language Selector */}
              <div className="relative" ref={languageMenuRef}>
                <button
                  onClick={() => {
                    setShowLanguageMenu(!showLanguageMenu);
                  }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-slate-50"
                >
                  <span className="text-lg">{currentLanguage.flag}</span>
                  <span className="hidden lg:inline">{currentLanguage.name}</span>
                  <ChevronDown className={clsx('w-4 h-4 transition-transform', showLanguageMenu && 'rotate-180')} />
                </button>

                {showLanguageMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase">{language === 'vi' ? 'Ngôn ngữ' : language === 'en' ? 'Language' : language === 'ar' ? 'اللغة' : 'Langue'}</p>
                  </div>
                    <div className="p-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code as Language);
                            setShowLanguageMenu(false);
                          }}
                          className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                            language === lang.code
                              ? 'bg-blue-500 text-white'
                              : 'hover:bg-slate-50'
                          )}
                        >
                          <span className="text-lg">{lang.flag}</span>
                          <span className="font-medium">{lang.name}</span>
                          {language === lang.code && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8">
          {messages.length === 0 && !streamingContent ? (
            <>
              <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h2 className="font-bold text-slate-900 uppercase tracking-tight">
                      {activeCategory 
                        ? (isEndUser ? CATEGORY_LABELS[activeCategory].title : CATEGORY_LABELS[activeCategory].titleEn)
                        : 'THÔNG TIN BỔ TRỢ & TIÊU CHUẨN'}
                    </h2>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 tracking-widest hidden md:block">
                    {isEndUser ? 'AGENT_ID: MADA_USER' : 'AGENT_ID: REGULATORY_STANDARDS_RAG_3.5'}
                  </div>
                </div>

                {/* Welcome Logo */}
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-blue-100 flex items-center justify-center relative z-10 border border-slate-100 p-3">
                    <RobotLogo className="w-full h-full" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-slate-900 rounded-[2rem] -z-0 opacity-5"></div>
                </div>

                {/* Welcome Typography */}
                <div className="text-center mb-12 max-w-2xl mx-auto">
                  <h2 className="text-4xl font-extrabold tracking-tight mb-4 text-slate-900">
                    {activeCategory 
                      ? (isEndUser ? CATEGORY_LABELS[activeCategory].title : CATEGORY_LABELS[activeCategory].titleEn)
                      : 'MADA AI Assistant'}
                  </h2>
                  <p className="text-slate-500 text-lg">
                    {activeCategory 
                      ? (language === 'en' ? CATEGORY_LABELS[activeCategory].descEn : CATEGORY_LABELS[activeCategory].desc)
                      : (language === 'vi' ? 'Hệ thống tư vấn Công nghệ Hỗ trợ bằng trí tuệ nhân tạo' : language === 'en' ? 'AI-powered Assistive Technology consultation system' : language === 'ar' ? 'نظام استشارة التكنولوجيا المساعدة بالذكاء الاصطناعي' : 'Système de consultation en technologie d\'assistance par IA')
                    }
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    {language === 'vi' ? 'Mẹo: Nhấn' : language === 'en' ? 'Tip: Press' : language === 'ar' ? 'تلميح: اضغط' : 'Astuce: Appuyez sur'} <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 mx-1 font-mono">Ctrl + Enter</kbd> {language === 'vi' ? 'để gửi nhanh' : language === 'en' ? 'to send quickly' : language === 'ar' ? 'للإرسال السريع' : 'pour envoyer'}
                  </div>
                </div>

                {/* Dynamic Category Questions or Sample Questions - Beautiful Design */}
                <div className="w-full max-w-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider px-4">
                      {activeCategory 
                        ? (language === 'vi' ? 'Câu hỏi gợi ý' : language === 'en' ? 'Suggested questions' : language === 'ar' ? 'أسئلة مقترحة' : 'Questions suggérées')
                        : (language === 'vi' ? 'Khám phá ngay' : language === 'en' ? 'Explore now' : language === 'ar' ? 'استكشف الآن' : 'Explorer')
                      }
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(activeCategory ? currentQuestions : [
                      isEndUser ? 'Làm thế nào để tra cứu nhanh xem một thiết bị trợ giúp có an toàn và đạt quy chuẩn kỹ thuật không?' : 'Compare WCAG 2.1 Level AAA compliance for screen readers',
                      isEndUser ? 'Tôi cần tìm thiết bị hỗ trợ cho người khiếm thị' : 'What AT devices are available for blind users?',
                      isEndUser ? 'Máy trợ thính có những loại nào và giá bao nhiêu?' : 'What types of hearing aids are available?',
                      isEndUser ? 'Tiêu chuẩn WCAG là gì và áp dụng ra sao?' : 'What are the ISO 9999 classification standards?',
                    ]).map((question, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue(question);
                          textareaRef.current?.focus();
                        }}
                        className="group relative bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 transition-all duration-300 overflow-hidden"
                      >
                        {/* Gradient background on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 via-purple-50/0 to-blue-50/0 group-hover:from-violet-50/50 group-hover:via-purple-50/30 group-hover:to-blue-50/30 transition-all duration-500 opacity-0 group-hover:opacity-100" />
                        
                        {/* Number indicator */}
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                          {index + 1}
                        </div>
                        
                        {/* Icon */}
                        <div className="relative z-10 flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center flex-shrink-0 group-hover:from-violet-200 group-hover:to-blue-200 transition-colors">
                            <span className="material-symbols-outlined text-lg text-violet-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {activeCategory ? CATEGORY_ICONS[activeCategory] : (index === 0 ? 'search' : index === 1 ? 'visibility' : index === 2 ? 'hearing' : 'rule')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 group-hover:text-slate-800 leading-relaxed flex-1">
                            {question}
                          </p>
                        </div>
                        
                        {/* Arrow indicator */}
                        <div className="relative z-10 mt-3 flex items-center gap-1 text-[10px] font-medium text-slate-400 group-hover:text-violet-500 transition-colors">
                          <span>{language === 'vi' ? 'Nhấn để hỏi' : language === 'en' ? 'Press to ask' : language === 'ar' ? 'اضغط للسؤال' : 'Appuyez pour demander'}</span>
                          <svg className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col h-full w-full">
              {/* Agent Header */}
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h2 className="font-bold text-slate-900 uppercase tracking-tight">
                    {activeCategory 
                      ? (isEndUser ? CATEGORY_LABELS[activeCategory].title : CATEGORY_LABELS[activeCategory].titleEn)
                      : 'THÔNG TIN BỔ TRỢ & TIÊU CHUẨN'}
                  </h2>
                </div>
                <div className="text-[10px] font-mono text-slate-400 tracking-widest hidden md:block">
                  {isEndUser ? 'AGENT_ID: MADA_USER' : 'AGENT_ID: REGULATORY_STANDARDS_RAG_3.5'}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-6 mb-8 overflow-y-auto">
                {messages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    onCopy={handleCopy}
                    copiedId={copiedId}
                    onSpeak={speakText}
                    speakingId={speakingId}
                    viewMode={viewMode}
                    onRequestConsultation={() => setShowConsultationModal(true)}
                    language={language}
                  />
                ))}

                {/* Streaming indicator */}
                {streamingContent && (
                  <div className="flex items-start gap-3 animate-fade-in">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 max-w-[80%] px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none border border-slate-200">
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

              {/* Category Quick Questions - Show AFTER AI finishes responding */}
              {activeCategory && !inputValue && messages.length > 0 && !isLoading && (
                <div className="mb-4 group">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-xl group-hover:shadow-violet-500/40 transition-all">
                      <span className="material-symbols-outlined text-lg text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {CATEGORY_ICONS[activeCategory]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        {isEndUser 
                          ? (language === 'vi' ? 'Gợi ý câu hỏi' : language === 'en' ? 'Suggested Questions' : 'اقتراحات سريعة')
                          : 'Quick suggestions'
                        }
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {language === 'vi' ? 'Chạm để hỏi ngay • Tap to ask' : language === 'en' ? 'Tap to ask instantly' : 'انقر للسؤال'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveCategory(null)}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all opacity-0 group-hover:opacity-100"
                      aria-label={language === 'vi' ? 'Đóng' : 'Close'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Suggestions Grid - Modern Card Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentQuestions.slice(0, 6).map((question, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue(question);
                          textareaRef.current?.focus();
                        }}
                        className="group/item relative overflow-hidden p-4 bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300 text-left active:scale-[0.98]"
                      >
                        {/* Background gradient on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 via-purple-50/0 to-indigo-50/0 group-hover/item:from-violet-50/50 group-hover/item:via-purple-50/50 group-hover/item:to-indigo-50/50 transition-all duration-300 rounded-2xl" />
                        
                        <div className="relative flex items-start gap-3">
                          {/* Icon Badge */}
                          <div className={clsx(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                            index === 0 && 'bg-amber-100 text-amber-600 group-hover/item:bg-amber-200',
                            index === 1 && 'bg-emerald-100 text-emerald-600 group-hover/item:bg-emerald-200',
                            index === 2 && 'bg-blue-100 text-blue-600 group-hover/item:bg-blue-200',
                            index === 3 && 'bg-rose-100 text-rose-600 group-hover/item:bg-rose-200',
                            index === 4 && 'bg-violet-100 text-violet-600 group-hover/item:bg-violet-200',
                            index === 5 && 'bg-cyan-100 text-cyan-600 group-hover/item:bg-cyan-200',
                          )}>
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {index === 0 ? 'lightbulb' : index === 1 ? 'search' : index === 2 ? 'info' : index === 3 ? 'help' : index === 4 ? 'smart_toy' : 'chat'}
                            </span>
                          </div>
                          
                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 leading-snug group-hover/item:text-violet-700 transition-colors font-medium">
                              {question.length > 50 ? question.slice(0, 50) + '…' : question}
                            </p>
                          </div>
                          
                          {/* Arrow indicator */}
                          <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <ArrowRight className="w-4 h-4 text-violet-500" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============== INPUT AREA ============== */}
        <div className="p-8 w-full max-w-5xl mx-auto">
          <div className="relative max-w-4xl mx-auto">
            {/* Floating Lightning Button */}
            <div className="absolute -top-6 -right-2 z-20">
              <button className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-slate-900 hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </button>
            </div>

            {/* DEBUG: Show file count */}
            {selectedFiles.length > 0 && (
              <div className="mb-2 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-lg text-xs text-yellow-800 flex items-center gap-2">
                <span className="font-bold">📎</span>
                <span>{selectedFiles.length} file(s) đính kèm</span>
                <span className="text-yellow-600">•</span>
                <span>{selectedFiles.map(f => f.name).join(', ')}</span>
              </div>
            )}

            {/* Selected Files Preview - Enhanced Display */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* File Type Icon / Image Preview */}
                    <div className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden',
                      file.type.startsWith('image/') && 'bg-pink-100 text-pink-600',
                      file.type.startsWith('video/') && 'bg-purple-100 text-purple-600',
                      file.type.startsWith('audio/') && 'bg-amber-100 text-amber-600',
                      file.type === 'application/pdf' && 'bg-red-100 text-red-600',
                      file.type.includes('word') && 'bg-blue-100 text-blue-600',
                      file.type === 'text/url' && 'bg-green-100 text-green-600',
                      !file.type.startsWith('image/') && !file.type.startsWith('video/') &&
                        !file.type.startsWith('audio/') && file.type !== 'application/pdf' &&
                        !file.type.includes('word') && file.type !== 'text/url' && 'bg-gray-100 text-gray-600'
                    )}>
                      {file.type.startsWith('image/') && file.content ? (
                        // Image preview - check if it's a base64 data URL
                        file.content.startsWith('data:') ? (
                          <img src={file.content} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5" />
                        )
                      ) : file.type.startsWith('image/') ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : file.type.startsWith('video/') ? (
                        <Video className="w-5 h-5" />
                      ) : file.type.startsWith('audio/') ? (
                        <Mic2 className="w-5 h-5" />
                      ) : file.type === 'application/pdf' ? (
                        <FileText className="w-5 h-5" />
                      ) : file.type === 'text/url' ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <File className="w-5 h-5" />
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : 'Đã đọc nội dung'}
                      </p>
                    </div>

                    {/* File Status Badge */}
                    <div className="flex items-center gap-2">
                      {file.content ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          ✓ Sẵn sàng
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                          ⚠ Chờ xử lý
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors group"
                        title="Xóa file"
                      >
                        <X className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Action Hint */}
                <p className="text-xs text-slate-400 text-center">
                  Nhấn Enter hoặc bấm nút gửi để AI đọc file này
                </p>
              </div>
            )}

            {/* Redesigned Pill Input with Layered Shadow - Compact */}
            <div className="relative">
              {/* Shadow Layer */}
              <div className="absolute inset-0 bg-slate-900 rounded-full translate-y-1.5 translate-x-0.5 -z-10"></div>
              
              <div className="bg-white border-2 border-slate-900 rounded-full p-1 flex items-center gap-1 relative z-10">
                {/* Left Icons - Attachment Button */}
                <div className="flex items-center gap-0.5 pl-2 relative" ref={attachmentMenuRef}>
                  <button
                    onClick={handleFileAttach}
                    className={clsx(
                      'p-1.5 rounded-full transition-colors',
                      showAttachmentMenu
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                    title="Đính kèm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Attachment Menu */}
                  {showAttachmentMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-700">Thêm tệp đính kèm</p>
                        <button
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className={clsx(
                            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                            showUrlInput
                              ? 'bg-blue-500 text-white'
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          )}
                        >
                          🌐 URL
                        </button>
                      </div>

                      {/* URL Input Section */}
                      {showUrlInput && (
                        <div className="p-3 border-b border-slate-100 bg-blue-50">
                          <p className="text-xs text-blue-600 mb-2">Nhập link web để AI đọc và phân tích nội dung:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={urlInputValue}
                              onChange={(e) => setUrlInputValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                              placeholder="https://example.com"
                              className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleFetchUrl}
                              disabled={!urlInputValue.trim() || isFetchingUrl}
                              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
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
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                              <option.icon className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700">{option.label}</p>
                              <p className="text-[10px] text-slate-400">{option.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Field - Compact */}
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
                  className="flex-1 border-none focus:ring-0 text-slate-800 bg-transparent py-2 text-sm placeholder:text-slate-400 resize-none leading-tight"
                  style={{ minHeight: '36px', maxHeight: '100px' }}
                />

                {/* Right Icons & Send */}
                <div className="flex items-center gap-0.5 pr-1.5">
                  <button
                    onClick={handleVoiceRecord}
                    className={clsx(
                      'p-1.5 rounded-full transition-colors',
                      isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                    title="Ghi âm"
                  >
                    {isRecording ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  
                  {/* Send Button - Compact */}
                  <div className="relative ml-1">
                    <div className="absolute inset-0 bg-slate-900 rounded-full translate-y-0.5 translate-x-0.5"></div>
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      className="relative w-9 h-9 bg-blue-500 text-white rounded-full flex items-center justify-center border-2 border-slate-900 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Disclaimer */}
            <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-mono">
              MADA AI CAN MAKE MISTAKES. VERIFY IMPORTANT INFO.
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
  viewMode,
  onRequestConsultation,
  language = 'vi' as Language
}: { 
  message: Message; 
  onCopy: (content: string, id: string) => void;
  copiedId: string | null;
  onSpeak: (text: string, id: string) => void;
  speakingId: string | null;
  viewMode: ViewMode;
  onRequestConsultation: () => void;
  language?: Language;
}) {
  const [showSources, setShowSources] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const isEndUser = viewMode === 'end_user';
  const confidence = message.confidence || 85;
  
  // Detect category từ nội dung message và chọn sản phẩm phù hợp
  const detectedCategory = detectCategoryFromQuery(message.content);
  const sampleProducts = SAMPLE_PRODUCTS[detectedCategory] || SAMPLE_PRODUCTS.vision;
  
  // Standards theo category
  const categoryStandards: Record<string, string[]> = {
    mobility: ['ISO 9999:12.21', 'ISO 7176', 'EN 12184'],
    vision: ['ISO 9999:24.09', 'WCAG 2.1', 'EN 1332-20'],
    hearing: ['ISO 9999:22.06', 'IEC 60118-4', 'WHO GATE'],
    cognition: ['ISO 9999:05.15', 'WHO GATE', 'WCAG 2.1'],
    communication: ['ISO 9999:05.15.06', 'WCAG 2.1', 'EN 1332'],
    daily_living: ['ISO 9999:09', 'ADA Compliance', 'WHO APL'],
    education: ['WCAG 2.2', 'UDL Guidelines', 'Section 508'],
    general: ['ISO 9999', 'WCAG 2.1', 'WHO GATE'],
  };
  const relevantStandards = categoryStandards[detectedCategory] || categoryStandards.general;
  
  if (message.role === 'user') {
    return (
      <div className="flex items-start gap-3 justify-end animate-fade-in group">
        <div className="max-w-[80%] px-4 py-3 bg-blue-500 text-white rounded-2xl rounded-tr-none">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in group">
      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
        <BotIcon className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 max-w-[85%]">
        {/* Agent Header */}
        <div className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest">
          [ TRỢ LÝ CNHT MADA // {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) } ]
        </div>
        
        <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm text-slate-700 leading-relaxed">
          <div className="text-sm [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_li]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:font-bold [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-blue-500 [&_a]:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="mt-4 flex items-center gap-4">
          <ConfidenceBar confidence={confidence} />
          <button 
            onClick={onRequestConsultation}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">support_agent</span>
            {isEndUser 
              ? (language === 'vi' ? 'Tư vấn Chuyên gia' : language === 'en' ? 'Request Specialist' : language === 'ar' ? 'طلب خبير' : 'Demander un spécialiste')
              : 'Request Specialist'
            }
          </button>
        </div>

        {/* Product Cards - Show for assistant messages */}
        <div className="mt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            {language === 'vi' ? 'Thiết bị được gợi ý' : language === 'en' ? 'Recommended Devices' : language === 'ar' ? 'الأجهزة الموصى بها' : 'Appareils recommandés'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sampleProducts.slice(0, 2).map((product, idx) => (
              <ProductCard key={idx} product={product} viewMode={viewMode} />
            ))}
          </div>
        </div>

        {/* Standards Badges */}
        <div className="mt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            {language === 'vi' ? 'Tiêu chuẩn kỹ thuật' : language === 'en' ? 'Technical Standards' : language === 'ar' ? 'المعايير التقنية' : 'Normes techniques'}
          </p>
          <StandardsBadge standards={message.standards && message.standards.length > 0 ? message.standards : relevantStandards} />
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* Sources Panel */}
        {showSources && message.sources && message.sources.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
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
      </div>
    </div>
  );
}
