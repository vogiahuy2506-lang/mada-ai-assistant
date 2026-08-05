// Standard Model - Accessibility Standards

import { MadaCategory } from './product.model.js';

export interface Standard {
  id: string;
  code: string;
  name: {
    en: string;
    ar: string;
    vi: string;
  };
  description: {
    en: string;
    ar: string;
    vi: string;
  };
  category: MadaCategory[];
  level?: 'A' | 'AA' | 'AAA';
  version?: string;
  relatedProducts: string[];
  relatedStandards: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StandardChunk {
  id: string;
  standardId: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  embedding?: number[];
  metadata: {
    source: string;
    language: string;
  };
}

export const COMMON_STANDARDS: Omit<Standard, 'id' | 'createdAt' | 'updatedAt' | 'relatedProducts' | 'relatedStandards'>[] = [
  {
    code: 'WCAG 2.1',
    name: {
      en: 'Web Content Accessibility Guidelines 2.1',
      ar: 'إرشادات إمكانية الوصول لمحتوى الويب 2.1',
      vi: 'Hướng dẫn Tiếp cận Nội dung Web 2.1',
    },
    description: {
      en: 'International guidelines for web accessibility ensuring content is perceivable, operable, understandable, and robust.',
      ar: 'إرشادات دولية للوصول إلى الويب لضمان إمكانية إدراك المحتوى وقابليته للتشغيل والفهم والمتانة.',
      vi: 'Hướng dẫn quốc tế về khả năng tiếp cận web, đảm bảo nội dung có thể nhận thức, vận hành, hiểu được và bền vững.',
    },
    category: ['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living', 'education'],
    level: undefined,
    version: '2.1',
  },
  {
    code: 'ISO 9999',
    name: {
      en: 'Assistive Products for Persons with Disability',
      ar: 'المنتجات المساعدة للأشخاص ذوي الإعاقة',
      vi: 'Sản phẩm hỗ trợ cho người khuyết tật',
    },
    description: {
      en: 'International classification system for assistive products used by persons with disability.',
      ar: 'نظام تصنيف دولي للمنتجات المساعدة التي يستخدمها الأشخاص ذوو الإعاقة.',
      vi: 'Hệ thống phân loại quốc tế cho các sản phẩm hỗ trợ được sử dụng bởi người khuyết tật.',
    },
    category: ['vision', 'hearing', 'mobility', 'communication', 'cognition', 'daily_living', 'education'],
    version: '2016',
  },
  {
    code: 'Section 508',
    name: {
      en: 'Section 508 Rehabilitation Act',
      ar: 'القسم 508 من قانون إعادة التأهيل',
      vi: 'Mục 508 Đạo luật Phục hồi chức năng',
    },
    description: {
      en: 'US federal law requiring electronic and information technology to be accessible to people with disabilities.',
      ar: 'قانون اتحادي أمريكي يتطلب أن تكون التكنولوجيا الإلكترونية والمعلومات في متناول الأشخاص ذوي الإعاقة.',
      vi: 'Luật liên bang Hoa Kỳ yêu cầu công nghệ điện tử và thông tin phải tiếp cận được đối với người khuyết tật.',
    },
    category: ['vision', 'hearing', 'mobility', 'communication', 'cognition'],
    version: '2017',
  },
];
