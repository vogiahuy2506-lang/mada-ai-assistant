// Product Model - MADA Assistive Technology Products

export type MadaCategory =
  | 'vision'
  | 'hearing'
  | 'mobility'
  | 'communication'
  | 'cognition'
  | 'daily_living'
  | 'education';

export interface LocalizedString {
  en: string;
  ar: string;
  vi: string;
  fr: string;
}

export interface ProductSpecifications {
  [key: string]: string;
}

export interface ProductCompatibility {
  platforms: string[];
  disabilities: string[];
  ageGroups: string[];
}

export interface ProductPricing {
  currency: string;
  minPrice: number;
  maxPrice: number;
  unit: string;
}

export interface Product {
  id: string;
  madaId: string;
  name: LocalizedString;
  category: MadaCategory;
  subcategory: string;
  brand: string;
  manufacturer: string;
  description: LocalizedString;
  specifications: ProductSpecifications;
  compatibility: ProductCompatibility;
  pricing: ProductPricing;
  keywords: string[];
  useCases: string[];
  targetSymptoms: string[];
  imageUrl?: string;
  documentationUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  confidence: number;
}

export interface ProductChunk {
  id: string;
  productId: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  embedding?: number[];
  metadata: {
    source: string;
    pageNumber?: number;
    section?: string;
    language: string;
  };
}

export const CATEGORY_LABELS: Record<MadaCategory, LocalizedString> = {
  vision: {
    en: 'Vision Support',
    ar: 'دعم الرؤية',
    vi: 'Hỗ trợ thị giác',
    fr: 'Support visuel',
  },
  hearing: {
    en: 'Hearing Support',
    ar: 'دعم السمع',
    vi: 'Hỗ trợ thính giác',
    fr: 'Support auditif',
  },
  mobility: {
    en: 'Mobility Support',
    ar: 'دعم الحركة',
    vi: 'Hỗ trợ vận động',
    fr: 'Support mobilité',
  },
  communication: {
    en: 'Communication Support',
    ar: 'دعم التواصل',
    vi: 'Hỗ trợ giao tiếp',
    fr: 'Support communication',
  },
  cognition: {
    en: 'Cognitive Support',
    ar: 'دعم الإدراك',
    vi: 'Hỗ trợ nhận thức',
    fr: 'Support cognitif',
  },
  daily_living: {
    en: 'Daily Living Aids',
    ar: 'أدوات الحياة اليومية',
    vi: 'Hỗ trợ sinh hoạt',
    fr: 'Aides au quotidien',
  },
  education: {
    en: 'Educational Support',
    ar: 'الدعم التعليمي',
    vi: 'Hỗ trợ giáo dục',
    fr: 'Support éducatif',
  },
};
