/**
 * MADA AT ASSISTANT - Response Formatter
 * 
 * Format AI response thành structured output
 */

import type { SupportedLanguage } from './system-instructions';
import type { IntentResult } from './intent-detector';
import type { RAGSource } from './context-builder';

/** Response metadata */
export interface ResponseMetadata {
  confidence: number;
  tokensUsed: number;
  model: string;
  processingTimeMs: number;
  finishReason: string;
  intent?: IntentResult;
  sources?: RAGSource[];
  suggestions?: string[];
}

/** Formatted response */
export interface FormattedResponse {
  message: string;
  metadata: ResponseMetadata;
  suggestions: string[];
  sources: SourceDisplay[];
  language: SupportedLanguage;
  intent?: string;
}

/** Source for display */
export interface SourceDisplay {
  type: 'product' | 'standard' | 'guide';
  name: string;
  description: string;
  url?: string;
  relevance?: number;
}

/** Response templates */
const RESPONSE_TEMPLATES = {
  vi: {
    greeting: 'Xin chào! Tôi là Mada AT Assistant - chuyên gia về Công nghệ Hỗ trợ. Tôi có thể giúp bạn tìm hiểu về các thiết bị và giải pháp hỗ trợ người khuyết tật.',
    productIntro: 'Dựa trên nhu cầu của bạn, đây là một số đề xuất:',
    standardIntro: 'Về tiêu chuẩn và quy định, đây là thông tin bạn cần biết:',
    comparisonIntro: 'So sánh các lựa chọn:',
    medicalRedirect: '⚠️ **Lưu ý quan trọng:** Tôi là chuyên gia về Công nghệ Hỗ trợ, không phải bác sĩ. Về vấn đề y tế, tôi khuyên bạn nên tham khảo ý kiến bác sĩ chuyên khoa.',
    outOfScope: 'Xin lỗi, câu hỏi của bạn nằm ngoài phạm vi tư vấn về Công nghệ Hỗ trợ. Tôi có thể giúp bạn về thiết bị AT, phần mềm tiếp cận, và các giải pháp công nghệ cho người khuyết tật.',
    nextSteps: '**Bước tiếp theo:**',
    learnMore: 'Tìm hiểu thêm:',
    professionalConsult: '💡 Để được tư vấn chi tiết hơn về lựa chọn phù hợp, bạn nên tham khảo ý kiến của chuyên gia.'
  },
  en: {
    greeting: 'Hello! I am Mada AT Assistant - an Assistive Technology specialist. I can help you learn about assistive devices and solutions for persons with disabilities.',
    productIntro: 'Based on your needs, here are some recommendations:',
    standardIntro: 'Regarding standards and regulations, here is what you need to know:',
    comparisonIntro: 'Comparing the options:',
    medicalRedirect: '⚠️ **Important Note:** I am an Assistive Technology specialist, not a doctor. For medical issues, I recommend consulting a qualified healthcare professional.',
    outOfScope: 'I apologize, your question is outside my scope of Assistive Technology consulting. I can help you with AT devices, accessibility software, and technology solutions for persons with disabilities.',
    nextSteps: '**Next Steps:**',
    learnMore: 'Learn more:',
    professionalConsult: '💡 For more detailed guidance on suitable options, you should consult with a specialist.'
  },
  ar: {
    greeting: 'مرحبا! أنا مساعد تقنية المعلومات - متخصص في التكنولوجيا المساعدة. يمكنني مساعدتك في معرفة الأجهزة والحلول المساعدة للأشخاص ذوي الإعاقة.',
    productIntro: 'بناءً على احتياجاتك، إليك بعض التوصيات:',
    standardIntro: 'فيما يتعلق بالمعايير واللوائح، إليك ما تحتاج إلى معرفته:',
    comparisonIntro: 'مقارنة الخيارات:',
    medicalRedirect: '⚠️ **ملاحظة مهمة:** أنا متخصص في التكنولوجيا المساعدة، ولست طبيباً. للمشاكل الطبية، أوصي باستشارة متخصص في الرعاية الصحية.',
    outOfScope: 'أعتذر، سؤالك خارج نطاق استشارات التكنولوجيا المساعدة. يمكنني مساعدتك في أجهزة TA، وبرامج الوصول، والحلول التقنية للأشخاص ذوي الإعاقة.',
    nextSteps: '**الخطوات التالية:**',
    learnMore: 'اعرف المزيد:',
    professionalConsult: '💡 للحصول على إرشادات أكثر تفصيلاً حول الخيارات المناسبة، يجب عليك استشارة متخصص.'
  },
  fr: {
    greeting: 'Bonjour! Je suis Mada AT Assistant - un spécialiste en Technologie d\'Assistance. Je peux vous aider à en savoir plus sur les appareils et solutions d\'assistance pour les personnes handicapées.',
    productIntro: 'Selon vos besoins, voici quelques recommandations:',
    standardIntro: 'Concernant les normes et réglementations, voici ce que vous devez savoir:',
    comparisonIntro: 'Comparaison des options:',
    medicalRedirect: '⚠️ **Note importante:** Je suis un spécialiste en Technologie d\'Assistance, pas un médecin. Pour les problèmes médicaux, je vous recommande de consulter un professionnel de santé qualifié.',
    outOfScope: 'Je m\'excuse, votre question est hors du champ de consultation en Technologie d\'Assistance. Je peux vous aider avec les appareils TA, les logiciels d\'accessibilité et les solutions technologiques pour les personnes handicapées.',
    nextSteps: '**Étapes suivantes:**',
    learnMore: 'En savoir plus:',
    professionalConsult: '💡 Pour des conseils plus détaillés sur les options appropriées, vous devriez consulter un spécialiste.'
  }
};

/**
 * Format raw AI response
 */
export function formatResponse(
  rawResponse: string,
  metadata: ResponseMetadata,
  language: SupportedLanguage = 'vi'
): FormattedResponse {
  const templates = RESPONSE_TEMPLATES[language];
  
  // Extract sources from RAG
  const sources: SourceDisplay[] = (metadata.sources || [])
    .slice(0, 5)
    .map(source => ({
      type: source.type as 'product' | 'standard' | 'guide',
      name: source.name,
      description: source.description,
      url: source.url,
      relevance: Math.round(source.score * 100)
    }));

  // Generate suggestions based on intent
  const suggestions = generateSuggestions(metadata.intent, language);

  return {
    message: rawResponse,
    metadata,
    suggestions,
    sources,
    language,
    intent: metadata.intent?.primary
  };
}

/**
 * Generate follow-up suggestions
 */
function generateSuggestions(
  intent: IntentResult | undefined,
  language: SupportedLanguage
): string[] {
  const templates = RESPONSE_TEMPLATES[language];
  const suggestions: string[] = [];

  if (!intent) {
    return [
      language === 'vi' ? 'Khám phá danh mục sản phẩm' : 
      language === 'ar' ? 'استكشف فئات المنتجات' :
      language === 'fr' ? 'Explorer les catégories de produits' :
      'Explore product categories',
      language === 'vi' ? 'Tìm hiểu về tiêu chuẩn WCAG' :
      language === 'ar' ? 'تعرف على معايير WCAG' :
      language === 'fr' ? 'En savoir plus sur les normes WCAG' :
      'Learn about WCAG standards'
    ];
  }

  switch (intent.primary) {
    case 'product_inquiry':
      suggestions.push(
        language === 'vi' ? '🔍 So sánh các sản phẩm tương tự' :
        language === 'ar' ? '🔍 قارن بين المنتجات المماثلة' :
        language === 'fr' ? '🔍 Comparer les produits similaires' :
        '🔍 Compare similar products'
      );
      suggestions.push(
        language === 'vi' ? '💰 Kiểm tra giá và tính khả dụng' :
        language === 'ar' ? '💰 تحقق من السعر والتوفر' :
        language === 'fr' ? '💰 Vérifier le prix et la disponibilité' :
        '💰 Check price and availability'
      );
      break;

    case 'category_exploration':
      suggestions.push(
        language === 'vi' ? '📋 Xem tất cả sản phẩm trong danh mục' :
        language === 'ar' ? '📋 عرض جميع المنتجات في الفئة' :
        language === 'fr' ? '📋 Voir tous les produits de la catégorie' :
        '📋 View all products in this category'
      );
      break;

    case 'recommendation_request':
      suggestions.push(
        language === 'vi' ? '✅ Tìm nhà cung cấp gần bạn' :
        language === 'ar' ? '✅ ابحث عن موردين بالقرب منك' :
        language === 'fr' ? '✅ Trouver des fournisseurs près de chez vous' :
        '✅ Find suppliers near you'
      );
      suggestions.push(
        language === 'vi' ? '📞 Liên hệ tư vấn miễn phí' :
        language === 'ar' ? '📞 اتصل للاستشارة المجانية' :
        language === 'fr' ? '📞 Contactez pour une consultation gratuite' :
        '📞 Contact for free consultation'
      );
      break;

    case 'price_inquiry':
      suggestions.push(
        language === 'vi' ? '🏥 Kiểm tra bảo hiểm hỗ trợ' :
        language === 'ar' ? '🏥 تحقق من دعم التأمين' :
        language === 'fr' ? '🏥 Vérifier le soutien de l\'assurance' :
        '🏥 Check insurance coverage'
      );
      suggestions.push(
        language === 'vi' ? '🏛️ Tìm hiểu hỗ trợ từ chính phủ' :
        language === 'ar' ? '🏛️ تعرف على الدعم الحكومي' :
        language === 'fr' ? '🏛️ Découvrir les aides gouvernementales' :
        '🏛️ Learn about government assistance'
      );
      break;

    case 'standards_question':
      suggestions.push(
        language === 'vi' ? '📖 Đọc tài liệu WCAG chi tiết' :
        language === 'ar' ? '📖 اقرأ وثائق WCAG المفصلة' :
        language === 'fr' ? '📖 Lire la documentation WCAG détaillée' :
        '📖 Read detailed WCAG documentation'
      );
      break;

    case 'medical_symptoms':
      suggestions.push(
        language === 'vi' ? '👨‍⚕️ Tìm bác sĩ chuyên khoa' :
        language === 'ar' ? '👨‍⚕️ ابحث عن متخصص طبي' :
        language === 'fr' ? '👨‍⚕️ Trouver un spécialiste médical' :
        '👨‍⚕️ Find a medical specialist'
      );
      suggestions.push(
        language === 'vi' ? '🏥 Cơ sở y tế gần nhất' :
        language === 'ar' ? '🏥 أقرب منشأة طبية' :
        language === 'fr' ? '🏥 Établissement médical le plus proche' :
        '🏥 Nearest medical facility'
      );
      break;

    default:
      suggestions.push(
        language === 'vi' ? '❓ Đặt câu hỏi khác' :
        language === 'ar' ? '❓ اطرح سؤالاً آخر' :
        language === 'fr' ? '❓ Poser une autre question' :
        '❓ Ask another question'
      );
  }

  return suggestions;
}

/**
 * Format product recommendation block
 */
export function formatProductBlock(
  product: {
    name: string;
    brand?: string;
    description: string;
    priceRange?: string;
    category?: string;
  },
  language: SupportedLanguage
): string {
  const lines: string[] = [];
  
  lines.push(`**${product.name}**`);
  if (product.brand) {
    lines.push(`*${product.brand}*`);
  }
  lines.push(product.description);
  
  if (product.category) {
    const categoryLabel = language === 'vi' ? 'Danh mục' :
                         language === 'ar' ? 'الفئة' :
                         language === 'fr' ? 'Catégorie' : 'Category';
    lines.push(`${categoryLabel}: ${product.category}`);
  }
  
  if (product.priceRange) {
    const priceLabel = language === 'vi' ? 'Giá tham khảo' :
                       language === 'ar' ? 'السعر المرجعي' :
                       language === 'fr' ? 'Prix de référence' : 'Price range';
    lines.push(`${priceLabel}: ${product.priceRange}`);
  }

  return lines.join('\n');
}

/**
 * Format comparison table
 */
export function formatComparisonTable(
  items: Array<{
    name: string;
    pros: string[];
    cons: string[];
    priceRange?: string;
  }>,
  language: SupportedLanguage
): string {
  const prosLabel = language === 'vi' ? 'Ưu điểm' :
                    language === 'ar' ? 'المزايا' :
                    language === 'fr' ? 'Avantages' : 'Pros';
  const consLabel = language === 'vi' ? 'Nhược điểm' :
                    language === 'ar' ? 'العيوب' :
                    language === 'fr' ? 'Inconvénients' : 'Cons';
  const priceLabel = language === 'vi' ? 'Giá' :
                     language === 'ar' ? 'السعر' :
                     language === 'fr' ? 'Prix' : 'Price';

  const lines: string[] = [];
  lines.push(`| ${prosLabel} | ${consLabel} | ${priceLabel} |`);
  lines.push('|---|---|---|');

  for (const item of items) {
    const pros = item.pros.join(', ');
    const cons = item.cons.join(', ');
    const price = item.priceRange || '-';
    lines.push(`| **${item.name}** | ${pros} | ${cons} | ${price} |`);
  }

  return lines.join('\n');
}

/**
 * Add safety disclaimer if needed
 */
export function addSafetyDisclaimer(
  response: string,
  intent: IntentResult | undefined,
  language: SupportedLanguage
): string {
  if (!intent?.requiresProfessional) {
    return response;
  }

  const templates = RESPONSE_TEMPLATES[language];
  
  // Add disclaimer at the end
  return response + '\n\n---\n' + templates.medicalRedirect + '\n' + templates.professionalConsult;
}

/**
 * Get out-of-scope response
 */
export function getOutOfScopeResponse(
  originalQuery: string,
  language: SupportedLanguage
): FormattedResponse {
  const templates = RESPONSE_TEMPLATES[language];
  
  return {
    message: templates.outOfScope,
    metadata: {
      confidence: 1.0,
      tokensUsed: 0,
      model: 'mada-at-assistant',
      processingTimeMs: 0,
      finishReason: 'OUT_OF_SCOPE'
    },
    suggestions: [
      language === 'vi' ? '🔄 Đặt câu hỏi khác' :
      language === 'ar' ? '🔄 اطرح سؤالاً مختلفاً' :
      language === 'fr' ? '🔄 Poser une question différente' :
      '🔄 Ask a different question',
      language === 'vi' ? '📚 Tìm hiểu về AT' :
      language === 'ar' ? '📚 تعرف على TA' :
      language === 'fr' ? '📚 En savoir plus sur la TA' :
      '📚 Learn about AT'
    ],
    sources: [],
    language
  };
}

/**
 * Get greeting response
 */
export function getGreetingResponse(language: SupportedLanguage): FormattedResponse {
  const templates = RESPONSE_TEMPLATES[language];
  
  return {
    message: templates.greeting,
    metadata: {
      confidence: 1.0,
      tokensUsed: 0,
      model: 'mada-at-assistant',
      processingTimeMs: 0,
      finishReason: 'GREETING'
    },
    suggestions: [
      language === 'vi' ? '🔍 Tìm thiết bị hỗ trợ' :
      language === 'ar' ? '🔍 ابحث عن جهاز دعم' :
      language === 'fr' ? '🔍 Rechercher un appareil d\'assistance' :
      '🔍 Find assistive device',
      language === 'vi' ? '📖 Tìm hiểu tiêu chuẩn AT' :
      language === 'ar' ? '📖 تعرف على معايير TA' :
      language === 'fr' ? '📖 Découvrir les normes TA' :
      '📖 Learn about AT standards',
      language === 'vi' ? '💬 Bắt đầu trò chuyện' :
      language === 'ar' ? '💬 ابدأ محادثة' :
      language === 'fr' ? '💬 Commencer une conversation' :
      '💬 Start a conversation'
    ],
    sources: [],
    language
  };
}
