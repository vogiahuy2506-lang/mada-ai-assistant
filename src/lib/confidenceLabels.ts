/**
 * ⭐ Confidence Labels - i18n đầy đủ 4 ngôn ngữ
 *
 * Confidence score từ RAG engine (0-100) được mapping thành:
 *   - 'very-high' (≥90): Rất cao / Highly reliable / عالٍ جدًا / Très élevé
 *   - 'high' (75-89):    Cao / High / عالٍ / Élevé
 *   - 'medium' (60-74):  Trung bình / Medium / متوسط / Moyen
 *   - 'low' (40-59):     Thấp / Low / منخفض / Faible
 *   - 'very-low' (<40):  Rất thấp / Very low / منخفض جدًا / Très faible
 */

export type ConfidenceLevel = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
export type Language = 'vi' | 'en' | 'ar' | 'fr';

export interface ConfidenceLabel {
  level: ConfidenceLevel;
  label: string;        // Tên ngắn (1-2 từ)
  description: string;  // Mô tả đầy đủ (1 câu)
  color: string;        // Mã màu cho badge (CSS)
  icon: string;         // Emoji
}

const CONFIDENCE_I18N: Record<Language, Record<ConfidenceLevel, ConfidenceLabel>> = {
  vi: {
    'very-high': {
      level: 'very-high',
      label: 'Rất cao',
      description: 'Kết quả rất đáng tin cậy, dựa trên nguồn dữ liệu chính thức của MADA.',
      color: '#10b981',
      icon: '✓'
    },
    'high': {
      level: 'high',
      label: 'Cao',
      description: 'Kết quả đáng tin cậy, có dẫn chứng tiêu chuẩn rõ ràng.',
      color: '#22c55e',
      icon: '✓'
    },
    'medium': {
      level: 'medium',
      label: 'Trung bình',
      description: 'Kết quả tương đối phù hợp, nên kiểm tra thêm với chuyên gia.',
      color: '#eab308',
      icon: '~'
    },
    'low': {
      level: 'low',
      label: 'Thấp',
      description: 'Kết quả chưa chắc chắn, nên tham khảo chuyên gia CNHT.',
      color: '#f97316',
      icon: '!'
    },
    'very-low': {
      level: 'very-low',
      label: 'Rất thấp',
      description: 'Không tìm thấy thông tin phù hợp. Vui lòng liên hệ chuyên gia MADA.',
      color: '#ef4444',
      icon: '✗'
    }
  },
  en: {
    'very-high': {
      level: 'very-high',
      label: 'Very high',
      description: 'Highly reliable result, based on official MADA sources.',
      color: '#10b981',
      icon: '✓'
    },
    'high': {
      level: 'high',
      label: 'High',
      description: 'Reliable result with clear standards citation.',
      color: '#22c55e',
      icon: '✓'
    },
    'medium': {
      level: 'medium',
      label: 'Medium',
      description: 'Somewhat relevant; verify with a specialist.',
      color: '#eab308',
      icon: '~'
    },
    'low': {
      level: 'low',
      label: 'Low',
      description: 'Uncertain; please consult an AT specialist.',
      color: '#f97316',
      icon: '!'
    },
    'very-low': {
      level: 'very-low',
      label: 'Very low',
      description: 'No matching information. Please contact a MADA expert.',
      color: '#ef4444',
      icon: '✗'
    }
  },
  ar: {
    'very-high': {
      level: 'very-high',
      label: 'عالٍ جدًا',
      description: 'نتيجة موثوقة جدًا، بناءً على مصادر مادا الرسمية.',
      color: '#10b981',
      icon: '✓'
    },
    'high': {
      level: 'high',
      label: 'عالٍ',
      description: 'نتيجة موثوقة مع استشهاد واضح بالمعايير.',
      color: '#22c55e',
      icon: '✓'
    },
    'medium': {
      level: 'medium',
      label: 'متوسط',
      description: 'ذو صلة إلى حد ما؛ تحقق مع متخصص.',
      color: '#eab308',
      icon: '~'
    },
    'low': {
      level: 'low',
      label: 'منخفض',
      description: 'غير مؤكد؛ يرجى استشارة متخصص في التكنولوجيا المساعدة.',
      color: '#f97316',
      icon: '!'
    },
    'very-low': {
      level: 'very-low',
      label: 'منخفض جدًا',
      description: 'لا توجد معلومات مطابقة. يرجى الاتصال بخبير مادا.',
      color: '#ef4444',
      icon: '✗'
    }
  },
  fr: {
    'very-high': {
      level: 'very-high',
      label: 'Très élevé',
      description: 'Résultat très fiable, basé sur les sources officielles MADA.',
      color: '#10b981',
      icon: '✓'
    },
    'high': {
      level: 'high',
      label: 'Élevé',
      description: 'Résultat fiable avec citation claire des normes.',
      color: '#22c55e',
      icon: '✓'
    },
    'medium': {
      level: 'medium',
      label: 'Moyen',
      description: 'Partiellement pertinent ; vérifiez avec un spécialiste.',
      color: '#eab308',
      icon: '~'
    },
    'low': {
      level: 'low',
      label: 'Faible',
      description: 'Incertain ; veuillez consulter un spécialiste TA.',
      color: '#f97316',
      icon: '!'
    },
    'very-low': {
      level: 'very-low',
      label: 'Très faible',
      description: 'Aucune information correspondante. Contactez un expert MADA.',
      color: '#ef4444',
      icon: '✗'
    }
  }
};

/**
 * Convert confidence score (0-100) → ConfidenceLevel
 */
export function scoreToLevel(score: number): ConfidenceLevel {
  if (typeof score !== 'number' || isNaN(score)) return 'very-low';
  if (score >= 90) return 'very-high';
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very-low';
}

/**
 * Lấy label đầy đủ theo ngôn ngữ + score
 */
export function getConfidenceLabel(score: number, language: Language): ConfidenceLabel {
  const level = scoreToLevel(score);
  const lang = (['vi', 'en', 'ar', 'fr'].includes(language) ? language : 'vi') as Language;
  return CONFIDENCE_I18N[lang][level];
}

/**
 * Lấy nhãn ngắn (label) theo ngôn ngữ + score
 */
export function getConfidenceShortLabel(score: number, language: Language): string {
  return getConfidenceLabel(score, language).label;
}

export default {
  scoreToLevel,
  getConfidenceLabel,
  getConfidenceShortLabel,
};