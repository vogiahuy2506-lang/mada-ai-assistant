// User Roles
export type UserRole = 'admin' | 'data_manager' | 'expert' | 'user';

// Plan tier for paywall
export type UserPlan = 'free' | 'pro' | 'enterprise';

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  plan: UserPlan;
  quotaUsed: number;
  quotaLimit: number; // -1 = unlimited
  provider?: 'email' | 'google';
  createdAt: Date;
  lastLogin?: Date;
}

// Assistive Technology Categories (ISO 9999)
export type ATCategory = 
  | 'vision'           // Thiết bị nhìn
  | 'hearing'          // Thiết bị nghe
  | 'mobility'         // Thiết bị vận động
  | 'cognition'        // Thiết bị nhận thức
  | 'communication'   // Thiết bị giao tiếp
  | 'daily_living'    // Hỗ trợ sinh hoạt
  | 'education';      // Giáo dục

// Product/Equipment
export interface Product {
  id: string;
  name: string;
  nameVi: string;
  nameEn: string;
  description: string;
  descriptionVi: string;
  descriptionEn: string;
  category: ATCategory;
  image?: string;
  specifications: Record<string, string>;
  isoStandard?: string;
  wcagStandard?: string;
  whoStandard?: string;
  madaPortalUrl?: string;
  priceRange?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Knowledge Base Entry
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  sourceType: 'website' | 'pdf' | 'doc' | 'manual';
  category: ATCategory;
  standards: {
    iso?: string;
    wcag?: string;
    who?: string;
  };
  embeddings?: number[];
  createdAt: Date;
  updatedAt: Date;
}

// Chat Message
export interface Source {
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  products?: Product[];
  standards?: string[];
  consultationId?: string;
  sources?: Source[];
  contextUsed?: boolean;
  attachments?: { name: string; type: string; preview?: string }[];
}

// Consultation Request
export interface ConsultationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  content: string;
  aiResponse?: string;
  expertResponse?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

// System Statistics
export interface SystemStats {
  totalUsers: number;
  totalDocuments: number;
  totalQueries: number;
  averageAccuracy: number;
  averageResponseTime: number;
  storageUsed: number;
  storageLimit: number;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// RAG Query
export interface RAGQuery {
  query: string;
  category?: ATCategory;
  language?: 'vi' | 'en' | 'ar' | 'fr';
  maxResults?: number;
}

// RAG Response
export interface RAGResponse {
  answer: string;
  confidence: number;
  products: Product[];
  standards: string[];
  sources: string[];
}

// Data Collection Task
export interface DataCollectionTask {
  id: string;
  type: 'website' | 'file';
  url?: string;
  status: 'pending' | 'scraping' | 'cleaning' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: KnowledgeEntry[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Notification
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Language
export type Language = 'vi' | 'en' | 'ar' | 'fr';

// View Mode - End-User Mode vs AT Specialist Mode
export type ViewMode = 'end_user' | 'at_specialist';

export const VIEW_MODE_INFO: Record<ViewMode, { name: string; nameVi: string; nameEn: string; icon: string; description: string }> = {
  end_user: {
    name: 'End-User',
    nameVi: 'Người dùng thường',
    nameEn: 'End-User Mode',
    icon: 'person',
    description: 'Chế độ thân thiện, dễ hiểu cho người dùng phổ thông',
  },
  at_specialist: {
    name: 'AT Specialist',
    nameVi: 'Chuyên gia AT',
    nameEn: 'AT Specialist Mode',
    icon: 'engineering',
    description: 'Chế độ chuyên sâu với tiêu chuẩn ISO/WCAG/WHO GATE',
  },
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

// Sample Questions cho từng category và view mode
export const SAMPLE_QUESTIONS: Record<ATCategory, Record<ViewMode, string[]>> = {
  vision: {
    end_user: [
      'Phần mềm đọc màn hình nào tốt nhất cho người khiếm thị?',
      'Kính lúp điện tử có giá bao nhiêu?',
      'Làm thế nào để người khiếm thị sử dụng máy tính?',
      'Thiết bị đọc chữ nổi Braille giá bao nhiêu?',
    ],
    at_specialist: [
      'So sánh JAWS vs NVDA về độ tương thích WCAG 2.1 Level AAA',
      'Tiêu chuẩn ISO 9999:24.09 cho thiết bị hỗ trợ thị giác?',
      'Phân tích độ phóng đại tối ưu cho CCTV Magnifier theo WHO guidelines',
      'Hướng dẫn cấu hình OrCam MyEye theo EN 1332-20',
    ],
  },
  hearing: {
    end_user: [
      'Máy trợ thính có những loại nào và giá bao nhiêu?',
      'Làm sao để chọn máy trợ thính phù hợp cho người cao tuổi?',
      'Thiết bị phản hồi âm thanh hoạt động như thế nào?',
      'Máy trợ thính có kết nối Bluetooth được không?',
    ],
    at_specialist: [
      'Phân tích tiêu chuẩn IEC 60118-4 cho hệ thống FM?',
      'So sánh công nghệ BTE vs CIC về gain frequency response',
      'Hướng dẫn cài đặt Roger FM system cho classroom',
      'Đặc điểm kỹ thuật Cochlear Implant theo ISO 9999:22.09',
    ],
  },
  mobility: {
    end_user: [
      'Xe lăn điện có giá bao nhiêu?',
      'Làm sao để chọn xe lăn phù hợp cho người khuyết tật?',
      'Xe lăn leo cầu thang hoạt động như thế nào?',
      'Nạng và khung đi khác nhau thế nào?',
    ],
    at_specialist: [
      'Tiêu chuẩn ISO 7176 cho xe lăn điện - các test parameters?',
      'So sánh joystick control vs chin control cho tetra patients',
      'Phân tích safety requirements theo ISO 9999:12.21.15 cho stair climbers',
      'Đặc điểm kỹ thuật microprocessor knee (C-Leg vs Rheo)',
    ],
  },
  cognition: {
    end_user: [
      'Thiết bị hỗ trợ trí nhớ cho người già mang tên gì?',
      'Ứng dụng nhắc nhở thuốc cho người suy giảm trí nhớ?',
      'Lịch kỹ thuật số hỗ trợ người có khó khăn về nhận thức?',
      'Thiết bị giúp sắp xếp công việc hàng ngày?',
    ],
    at_specialist: [
      'Phân tích AAC symbols systems: PCS vs SymbolStix vs Widgit',
      'Tiêu chuẩn ISO 9999:05.15 cho cognitive aids devices',
      'Evidence-based interventions cho người bị TBI sử dụng AT',
      'So sánh SGD devices: Tobii Dynavox vs Prentke Romich features',
    ],
  },
  communication: {
    end_user: [
      'Thiết bị giao tiếp tăng cường (AAC) là gì?',
      'Bảng giao tiếp bằng hình ảnh hoạt động ra sao?',
      'Ứng dụng giao tiếp cho người không nói được trên điện thoại?',
      'Thiết bị hỗ trợ giao tiếp cho trẻ tự kỷ?',
    ],
    at_specialist: [
      'So sánh unaided vs aided AAC:什么时候用哪种?',
      'Phân tích PRD (Pragmatic Rating Dimensions) cho AAC assessment',
      'Tiêu chuẩn ISO 9999:05.15.06 cho SGD devices',
      'Integration strategies cho AAC với mainstream technology',
    ],
  },
  daily_living: {
    end_user: [
      'Dụng cụ ăn uống cho người khó khớp tay?',
      'Thiết bị nhắc nhở uống thuốc đúng giờ?',
      'Đồ dùng nhà bếp hỗ trợ người khuyết tật?',
      'Thiết bị an toàn trong nhà tắm cho người già?',
    ],
    at_specialist: [
      'Phân tích lever taps vs rocker switches cho one-handed users',
      'Tiêu chuẩn ISO 9999:09 cho daily living aids classification',
      'ADA compliance requirements cho kitchen accessibility',
      'Ergonomic assessment cho adapted utensils selection',
    ],
  },
  education: {
    end_user: [
      'Phần mềm hỗ trợ học tập cho trẻ khuyết tật?',
      'Thiết bị giáo dục đặc biệt cho trường học?',
      'Tiêu chuẩn WCAG cho nội dung giáo dục?',
      'Ứng dụng học ngôn ngữ cho người khuyết tật?',
    ],
    at_specialist: [
      'Universal Design for Learning (UDL) framework implementation',
      'Accessible assessment strategies cho students với disabilities',
      'Section 508 vs WCAG 2.1 cho educational technology',
      'Research-based AT interventions cho specific learning disabilities',
    ],
  },
};

// AT Category Info
export const CATEGORY_INFO: Record<ATCategory, { name: string; nameVi: string; nameEn: string; icon: string }> = {
  vision: { name: 'Thiết bị nhìn', nameVi: 'Thiết bị nhìn', nameEn: 'Vision Devices', icon: 'visibility' },
  hearing: { name: 'Thiết bị nghe', nameVi: 'Thiết bị nghe', nameEn: 'Hearing Devices', icon: 'hearing' },
  mobility: { name: 'Thiết bị vận động', nameVi: 'Thiết bị vận động', nameEn: 'Mobility Devices', icon: 'accessible_forward' },
  cognition: { name: 'Thiết bị nhận thức', nameVi: 'Thiết bị nhận thức', nameEn: 'Cognitive Devices', icon: 'psychology' },
  communication: { name: 'Thiết bị giao tiếp', nameVi: 'Thiết bị giao tiếp', nameEn: 'Communication Devices', icon: 'record_voice_over' },
  daily_living: { name: 'Hỗ trợ sinh hoạt', nameVi: 'Hỗ trợ sinh hoạt', nameEn: 'Daily Living Aids', icon: 'home' },
  education: { name: 'Giáo dục', nameVi: 'Giáo dục', nameEn: 'Education', icon: 'school' },
};
