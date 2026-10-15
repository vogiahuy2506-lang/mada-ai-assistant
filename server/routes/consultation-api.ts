/**
 * Consultation API Routes
 * API endpoints cho hệ thống tư vấn sản phẩm với hỏi lại khách hàng
 */

import { Router } from 'express';
import { 
  createConsultationSession, 
  getConsultationQuestions, 
  recordConsultationAnswer, 
  shouldRecommend,
  completeConsultation,
  getConsultationSession,
  clearConsultationSession,
  getConsultationStatus,
  detectCategory
} from '../lib/consultationEngine';
import { ragEngine } from '../lib/rag/ragEngine';
import { detectMessageLanguage } from './chat';

const router = Router();

// Language-specific messages
const CONSULTATION_MESSAGES: Record<string, {
  welcome: string;
  gathering: string;
  recommend: string;
  complete: string;
  noMoreQuestions: string;
}> = {
  vi: {
    welcome: 'Cảm ơn bạn đã chia sẻ! Để tư vấn chính xác hơn, mình cần hỏi thêm một vài câu nhé.',
    gathering: 'Mình đang thu thập thông tin để tư vấn sản phẩm phù hợp nhất cho bạn.',
    recommend: 'Dựa trên thông tin bạn cung cấp, đây là những gợi ý của mình:',
    complete: 'Bạn có muốn mình tư vấn thêm về sản phẩm nào không?',
    noMoreQuestions: 'Mình đã có đủ thông tin để tư vấn cho bạn rồi. Đây là những gợi ý:'
  },
  en: {
    welcome: 'Thank you for sharing! To provide more accurate recommendations, I need to ask a few more questions.',
    gathering: 'I\'m gathering information to recommend the best products for you.',
    recommend: 'Based on the information you provided, here are my suggestions:',
    complete: 'Would you like me to provide more details about any of these products?',
    noMoreQuestions: 'I have enough information to recommend for you. Here are my suggestions:'
  },
  ar: {
    welcome: 'شكراً لمشاركتك! لتقديم توصيات أكثر دقة، أحتاج إلى طرح بعض الأسئلة الإضافية.',
    gathering: 'أجمع المعلومات للتوصية بأفضل المنتجات لك.',
    recommend: 'بناءً على المعلومات التي قدمتها، إليك اقتراحاتي:',
    complete: 'هل تريد مني تقديم المزيد من التفاصيل حول أي من هذه المنتجات؟',
    noMoreQuestions: 'لدي معلومات كافية للتوصية لك. إليك اقتراحاتي:'
  },
  fr: {
    welcome: 'Merci de votre partage ! Pour fournir des recommandations plus précises, j\'ai besoin de poser quelques questions supplémentaires.',
    gathering: 'Je rassemble les informations pour recommander les meilleurs produits pour vous.',
    recommend: 'Basé sur les informations que vous avez fournies, voici mes suggestions :',
    complete: 'Voulez-vous que je vous donne plus de détails sur l\'un de ces produits ?',
    noMoreQuestions: 'J\'ai assez d\'informations pour vous recommander. Voici mes suggestions :'
  }
};

/**
 * POST /api/consultation/start
 * Bắt đầu phiên tư vấn mới
 */
router.post('/start', async (req, res) => {
  try {
    const { message, language: uiLanguage, botCategory } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Detect language
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) 
      ? uiLanguage 
      : detectedLanguage;
    
    // Detect category - prefer explicit botCategory from frontend, otherwise auto-detect
    const category = botCategory || detectCategory(message);
    
    // Create consultation session
    const { sessionId } = createConsultationSession(message, effectiveLanguage);
    
    // Get initial follow-up questions
    const { questions } = await getConsultationQuestions(sessionId);
    
    // Get welcome message
    const messages = CONSULTATION_MESSAGES[effectiveLanguage] || CONSULTATION_MESSAGES.vi;
    
    res.json({
      success: true,
      data: {
        sessionId,
        category,
        welcomeMessage: messages.welcome,
        initialQuestions: questions,
        phase: 'gathering',
        language: effectiveLanguage,
        tips: effectiveLanguage === 'vi' 
          ? '💡 Trả lời càng chi tiết, tư vấn càng chính xác!'
          : effectiveLanguage === 'en'
          ? '💡 The more details you provide, the more accurate the recommendations!'
          : '💡 المزيد من التفاصيل = توصيات أكثر دقة!'
      }
    });
    
  } catch (error) {
    console.error('[Consultation API] Start error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/consultation/answer
 * Gửi câu trả lời của khách hàng cho một câu hỏi
 */
router.post('/answer', async (req, res) => {
  try {
    const { sessionId, question, answer, userReady } = req.body;
    
    if (!sessionId || !question) {
      return res.status(400).json({ success: false, error: 'sessionId and question are required' });
    }
    
    // Get session
    const session = getConsultationSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Consultation session not found' });
    }
    
    // Record the answer
    const updatedSession = recordConsultationAnswer(sessionId, question, answer || '');
    
    // Check if we should recommend
    const ready = shouldRecommend(sessionId, userReady);
    
    if (ready) {
      // Complete consultation and get recommendations
      const { recommendations, explanation, confidence } = await completeConsultation(sessionId);
      
      const messages = CONSULTATION_MESSAGES[session.language] || CONSULTATION_MESSAGES.vi;
      
      res.json({
        success: true,
        data: {
          sessionId,
          phase: 'recommending',
          nextMessage: messages.noMoreQuestions,
          recommendations,
          explanation,
          confidence,
          sessionSummary: {
            answersCount: updatedSession.answers.length,
            category: updatedSession.category,
          },
          complete: true
        }
      });
    } else {
      // Get next round of questions
      const { questions } = await getConsultationQuestions(sessionId);
      
      const messages = CONSULTATION_MESSAGES[session.language] || CONSULTATION_MESSAGES.vi;
      
      res.json({
        success: true,
        data: {
          sessionId,
          phase: 'gathering',
          nextMessage: messages.gathering,
          nextQuestions: questions,
          sessionSummary: {
            answersCount: updatedSession.answers.length,
            category: updatedSession.category,
          },
          complete: false
        }
      });
    }
    
  } catch (error) {
    console.error('[Consultation API] Answer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/consultation/recommend
 * Yêu cầu đưa ra đề xuất (kết thúc quá trình hỏi)
 */
router.post('/recommend', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    
    // Complete consultation
    const { recommendations, explanation, confidence, session } = await completeConsultation(sessionId);
    
    const messages = CONSULTATION_MESSAGES[session.language] || CONSULTATION_MESSAGES.vi;
    
    res.json({
      success: true,
      data: {
        sessionId,
        phase: 'recommending',
        nextMessage: messages.recommend,
        recommendations,
        explanation,
        confidence,
        sessionSummary: {
          answersCount: session.answers.length,
          category: session.category,
        }
      }
    });
    
  } catch (error) {
    console.error('[Consultation API] Recommend error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/consultation/status/:sessionId
 * Lấy trạng thái phiên tư vấn
 */
router.get('/status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const status = getConsultationStatus(sessionId);
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('[Consultation API] Status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/consultation/:sessionId
 * Xóa phiên tư vấn
 */
router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const deleted = clearConsultationSession(sessionId);
    
    res.json({
      success: true,
      deleted
    });
    
  } catch (error) {
    console.error('[Consultation API] Delete error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/consultation/history/:sessionId
 * Lấy lịch sử phiên tư vấn
 */
router.get('/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = getConsultationSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Consultation session not found' });
    }
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        initialMessage: session.userMessage,
        category: session.category,
        language: session.language,
        phase: session.currentPhase,
        answers: session.answers,
        createdAt: session.createdAt,
      }
    });
    
  } catch (error) {
    console.error('[Consultation API] History error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/consultation/quick-recommend
 * Đề xuất nhanh không qua quá trình hỏi (cho trường hợp đơn giản)
 */
router.post('/quick-recommend', async (req, res) => {
  try {
    const { message, language: uiLanguage, botCategory } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Detect language
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) 
      ? uiLanguage 
      : detectedLanguage;
    
    // Detect category - prefer explicit botCategory from frontend, otherwise auto-detect
    const category = botCategory || detectCategory(message);
    
    // Query RAG for recommendations
    const ragResponse = await ragEngine.query(message, [], {
      systemInstruction: `You are an AT (Assistive Technology) specialist. Provide concise, helpful recommendations based on the user's needs.`,
      language: effectiveLanguage,
      topK: 5,
    });
    
    // Get detailed metadata from sources
    const recommendations: any[] = [];
    
    if (ragResponse.sources && ragResponse.sources.length > 0) {
      for (const source of ragResponse.sources.slice(0, 5)) {
        const meta = source.metadata || {};
        // Parse metadata if it's a string (JSON)
        let imageUrl = '';
        try {
          const parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
          imageUrl = parsedMeta.thumbnailUrl || parsedMeta.imageUrl || parsedMeta.galleryImages?.[0] || '';
        } catch { /* ignore */ }

        // Apply proxy for MADA CDN images only (cdn.at.mada.org.qa, cdn.mada.org.qa)
        // KHÔNG proxy at.mada.org.qa vì browser có thể load trực tiếp
        // (server proxy không hoạt động do sandbox restriction)
        let finalImageUrl = '';
        if (imageUrl) {
          if (imageUrl.includes('cdn.at.mada.org.qa') || imageUrl.includes('cdn.mada.org.qa')) {
            finalImageUrl = `/api/mada-image?url=${encodeURIComponent(imageUrl)}`;
          } else {
            finalImageUrl = imageUrl;
          }
        }

        recommendations.push({
          id: (meta as any).id || `rec-${recommendations.length}`,
          title: meta.title || 'Assistive Technology Device',
          description: (source.content || '').slice(0, 300),
          category: category || 'general',
          confidence: (source as any).rerankScore || 0.7,
          source_url: meta.source || meta.url || '',
          image_url: finalImageUrl,
        });
      }
    }
    
    const messages = CONSULTATION_MESSAGES[effectiveLanguage] || CONSULTATION_MESSAGES.vi;
    
    res.json({
      success: true,
      data: {
        category,
        recommendations,
        explanation: messages.recommend,
        confidence: ragResponse.confidence || 0.7,
        mode: 'quick',
        consultationAvailable: true
      }
    });
    
  } catch (error) {
    console.error('[Consultation API] Quick recommend error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/consultation/compare
 * So sánh các sản phẩm được đề xuất
 */
router.post('/compare', async (req, res) => {
  try {
    const { products, language: uiLanguage } = req.body;
    
    if (!products || !Array.isArray(products) || products.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 products are required for comparison' });
    }
    
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) 
      ? uiLanguage 
      : 'vi';
    
    // Generate comparison prompt
    const comparisonPrompt = effectiveLanguage === 'vi'
      ? `So sánh các thiết bị AT sau đây. Trả lời bằng JSON với cấu trúc:
{
  "summary": "Tóm tắt ngắn về sự khác biệt chính",
  "pros": ["Ưu điểm của thiết bị 1", "Ưu điểm của thiết bị 2"],
  "cons": ["Nhược điểm của thiết bị 1", "Nhược điểm của thiết bị 2"],
  "best_for": {
    "device_1": "Trường hợp sử dụng tốt nhất cho thiết bị 1",
    "device_2": "Trường hợp sử dụng tốt nhất cho thiết bị 2"
  },
  "recommendation": "Khuyến nghị cuối cùng"
}

Các thiết bị:
${products.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n\n')}`
      : `Compare the following AT devices. Respond in JSON:
{
  "summary": "Brief summary of key differences",
  "pros": ["Advantage of device 1", "Advantage of device 2"],
  "cons": ["Disadvantage of device 1", "Disadvantage of device 2"],
  "best_for": {
    "device_1": "Best use case for device 1",
    "device_2": "Best use case for device 2"
  },
  "recommendation": "Final recommendation"
}

Devices:
${products.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n\n')}`;
    
    // Check if Gemini API is available
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      return res.json({
        success: true,
        data: {
          comparison: null,
          message: 'AI comparison not available. Please provide Gemini API key.',
          products
        }
      });
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: comparisonPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    responseText = responseText.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
    
    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let comparison = null;
    
    if (jsonMatch) {
      try {
        comparison = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[Consultation API] JSON parse error:', e);
      }
    }
    
    res.json({
      success: true,
      data: {
        comparison,
        products,
        mode: comparison ? 'ai-comparison' : 'manual-comparison'
      }
    });
    
  } catch (error) {
    console.error('[Consultation API] Compare error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
