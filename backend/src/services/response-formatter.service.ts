// Response Formatter Service - Format AI responses consistently
import { getFollowUpQuestions, RESPONSE_TEMPLATES } from '../agents/system-instructions.js';
import type { IntentType } from './intent-detection.service.js';

export interface StructuredProduct {
  name: string;
  brand?: string;
  category?: string;
  priceRange?: string;
  description: string;
  keyFeatures: string[];
  pros: string[];
  cons: string[];
  suitableFor: string[];
  source?: string;
  score?: number;
}

export interface FormattedResponse {
  text: string;
  metadata: {
    intent: IntentType;
    confidence: number;
    category?: string;
    language: string;
    followUpQuestions?: string[];
    disclaimer?: string;
  };
}

export interface ProductInfo {
  name: string;
  description?: string;
  price?: string;
  features?: string[];
  pros?: string[];
  cons?: string[];
}

export class ResponseFormatter {
  // Format response based on intent
  formatResponse(
    baseResponse: string,
    intent: IntentType,
    confidence: number,
    language: string = 'vi',
    category?: string
  ): FormattedResponse {
    let enhancedResponse = baseResponse;
    
    // Add confidence-based disclaimer
    if (confidence < 0.7) {
      const templates = RESPONSE_TEMPLATES[language as keyof typeof RESPONSE_TEMPLATES] || RESPONSE_TEMPLATES.vi;
      enhancedResponse += '\n\n' + templates.disclaimer;
    }
    
    // Generate follow-up questions
    const followUpQuestions = getFollowUpQuestions(category || 'default', language);
    const selectedFollowUps = followUpQuestions.slice(0, 2);
    
    return {
      text: enhancedResponse,
      metadata: {
        intent,
        confidence,
        category,
        language,
        followUpQuestions: selectedFollowUps.length > 0 ? selectedFollowUps : undefined,
        disclaimer: confidence < 0.7 ? 'Low confidence - verify information' : undefined,
      },
    };
  }
  
  // Format product recommendation with structured data
  formatProductRecommendation(
    products: StructuredProduct[],
    language: string = 'vi'
  ): string {
    if (products.length === 0) return '';
    
    const labels = {
      vi: {
        recommended: '🎯 Sản phẩm được gợi ý',
        pros: '✅ Ưu điểm',
        cons: '⚠️ Lưu ý',
        features: '📋 Tính năng chính',
        suitable: '👤 Phù hợp với',
        price: '💰 Giá tham khảo',
        source: '📚 Nguồn',
      },
      en: {
        recommended: '🎯 Recommended Products',
        pros: '✅ Pros',
        cons: '⚠️ Considerations',
        features: '📋 Key Features',
        suitable: '👤 Suitable for',
        price: '💰 Price Range',
        source: '📚 Source',
      },
    };
    
    const l = labels[language as keyof typeof labels] || labels.vi;
    
    let formatted = `\n\n## ${l.recommended}\n`;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const num = i + 1;
      
      formatted += `\n### ${num}. ${product.name}`;
      if (product.brand) formatted += ` (${product.brand})`;
      if (product.priceRange) formatted += `\n${l.price}: ${product.priceRange}`;
      formatted += `\n\n${product.description}`;
      
      if (product.keyFeatures.length > 0) {
        formatted += `\n\n${l.features}:\n`;
        product.keyFeatures.forEach(f => formatted += `- ${f}\n`);
      }
      
      if (product.pros.length > 0) {
        formatted += `\n${l.pros}:\n`;
        product.pros.forEach(p => formatted += `- ${p}\n`);
      }
      
      if (product.cons.length > 0) {
        formatted += `\n${l.cons}:\n`;
        product.cons.forEach(c => formatted += `- ${c}\n`);
      }
      
      if (product.suitableFor.length > 0) {
        formatted += `\n${l.suitable}: ${product.suitableFor.join(', ')}`;
      }
      
      if (product.source) {
        formatted += `\n${l.source}: ${product.source}`;
      }
      
      formatted += '\n---\n';
    }
    
    return formatted;
  }
  
  // Format comparison table
  formatComparison(
    products: StructuredProduct[],
    criteria: string[],
    language: string = 'vi'
  ): string {
    if (products.length < 2) return '';
    
    const labels = {
      vi: {
        title: '📊 So sánh sản phẩm',
        product: 'Sản phẩm',
        winner: '✓ Khuyến nghị',
      },
      en: {
        title: '📊 Product Comparison',
        product: 'Product',
        winner: '✓ Recommended',
      },
    };
    
    const l = labels[language as keyof typeof labels] || labels.vi;
    
    let table = `\n\n## ${l.title}\n\n`;
    table += `| ${l.product} | ${criteria.join(' | ')} |\n`;
    table += `|${'|---'.repeat(criteria.length + 1)}|\n`;
    
    // Find best product for each criterion (simple scoring)
    const scores = products.map((_, idx) => ({
      idx,
      totalScore: 0,
    }));
    
    for (let i = 0; i < criteria.length; i++) {
      const maxFeature = Math.max(...products.map(p => p.keyFeatures.length));
      for (let j = 0; j < products.length; j++) {
        if (products[j].keyFeatures.length >= maxFeature * 0.7) {
          scores[j].totalScore++;
        }
      }
    }
    
    const bestIdx = scores.reduce((best, current) => 
      current.totalScore > best.totalScore ? current : best
    ).idx;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const isWinner = i === bestIdx;
      const winnerMark = isWinner ? ` ${l.winner}` : '';
      
      table += `| **${product.name}**${winnerMark}`;
      
      for (const criterion of criteria) {
        // Simple matching based on criterion keywords
        const matchingFeatures = product.keyFeatures.filter(f => 
          f.toLowerCase().includes(criterion.toLowerCase())
        );
        table += ` | ${matchingFeatures.length > 0 ? matchingFeatures[0] : '-'}`;
      }
      
      table += ' |\n';
    }
    
    return table;
  }
  
  // Format steps/instructions
  formatSteps(
    steps: { step: string; explanation?: string; tip?: string }[],
    language: string = 'vi'
  ): string {
    const labels = {
      vi: { steps: '📝 Các bước thực hiện', tip: '💡 Mẹo' },
      en: { steps: '📝 Steps to Follow', tip: '💡 Tip' },
    };
    
    const l = labels[language as keyof typeof labels] || labels.vi;
    
    let formatted = `\n\n## ${l.steps}\n`;
    
    for (let i = 0; i < steps.length; i++) {
      const { step, explanation, tip } = steps[i];
      formatted += `\n**${i + 1}.** ${step}`;
      if (explanation) {
        formatted += `\n   ${explanation}`;
      }
      if (tip && i === steps.length - 1) {
        formatted += `\n\n${l.tip}: ${tip}`;
      }
    }
    
    return formatted;
  }
  
  // Format summary with key takeaways
  formatSummary(
    summary: string,
    keyPoints: string[],
    language: string = 'vi'
  ): string {
    const labels = {
      vi: { summary: '📋 Tóm tắt', keyPoints: '🔑 Điểm chính' },
      en: { summary: '📋 Summary', keyPoints: '🔑 Key Points' },
    };
    
    const l = labels[language as keyof typeof labels] || labels.vi;
    
    let formatted = `\n\n## ${l.summary}\n${summary}`;
    
    if (keyPoints.length > 0) {
      formatted += `\n\n### ${l.keyPoints}\n`;
      keyPoints.forEach(point => formatted += `- ${point}\n`);
    }
    
    return formatted;
  }
  
  // Add structured context to prompt
  buildContextPrompt(
    ragResults: { name: string; description: string; score: number; category?: string }[],
    userIntent: IntentType,
    language: string = 'vi'
  ): string {
    if (ragResults.length === 0) return '';
    
    const labels = {
      vi: {
        contextHeader: '[THÔNG TIN SẢN PHẨM TỪ HỆ THỐNG]',
        instruction: 'Hãy dựa trên thông tin sản phẩm trên để trả lời.',
        instructionComparison: 'Hãy SO SÁNH các sản phẩm trên dựa trên: giá cả, tính năng, và phù hợp với người dùng.',
        instructionRecommendation: 'Hãy đề xUẤT sản phẩm PHÙ HỢP NHẤT dựa trên nhu cầu của người dùng.',
      },
      en: {
        contextHeader: '[PRODUCT INFORMATION FROM SYSTEM]',
        instruction: 'Based on the product information above, please answer.',
        instructionComparison: 'Please COMPARE the products above based on: price, features, and user suitability.',
        instructionRecommendation: 'Please RECOMMEND the MOST SUITABLE product based on user needs.',
      },
    };
    
    const l = labels[language as keyof typeof labels] || labels.vi;
    
    const contextItems = ragResults
      .map((r, i) => {
        let item = `${i + 1}. **${r.name}**`;
        if (r.category) item += ` (${r.category})`;
        item += `\n   - ${r.description}`;
        item += `\n   - Relevance: ${Math.round(r.score * 100)}%`;
        return item;
      })
      .join('\n\n');
    
    let instruction = l.instruction;
    if (userIntent === 'comparison') {
      instruction = l.instructionComparison;
    } else if (userIntent === 'recommendation' || userIntent === 'product_inquiry') {
      instruction = l.instructionRecommendation;
    }
    
    return `\n\n${l.contextHeader}\n${contextItems}\n\n---\n${instruction}`;
  }
}

export const responseFormatter = new ResponseFormatter();
