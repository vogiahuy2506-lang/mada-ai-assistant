/**
 * Chat Routes — AI/RAG powered conversational endpoints
 * Tuần 1 — AI/RAG Pipeline
 * 
 * Endpoints:
 * - POST /api/chat              → Basic chat with RAG
 * - POST /api/chat-with-file    → Chat with file attachments
 * - POST /api/chat/stream       → SSE streaming chat
 * - POST /api/chat/follow-up    → AI-powered follow-up questions
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ragEngine } from '../lib/rag/ragEngine';
import { guardrails } from '../lib/guardrails';
import { buildSystemPrompt } from '../lib/prompts/systemPrompts';
import db from '../lib/db';
import { getSystemSettings } from '../lib/db';
import { verifyAccessToken } from '../lib/auth';
import { getFileUploadQuota, trackFileUpload } from '../lib/db';
import { chatHistory, waitForRagReady } from '../lib/chat-context';
import { logActivity } from '../index';

const router = express.Router();

// ============== HELPERS ==============

/**
 * Convert MADA image URL to proxy URL
 */
function toProxyImageUrl(madaUrl: string): string {
  if (!madaUrl || typeof madaUrl !== 'string' || !madaUrl.startsWith('http')) {
    return '';
  }
  if (madaUrl.includes('mada.org.qa') || madaUrl.includes('cdn.at.mada.org.qa')) {
    return `/api/mada-image?url=${encodeURIComponent(madaUrl)}`;
  }
  const shopDomains = ['tgdd.vn', 'cellphones.com.vn', 'fptshop.com.vn', 'dienmayxanh.com', 'hstatic.net', 'viettelstore.vn'];
  if (shopDomains.some(d => madaUrl.includes(d))) {
    return madaUrl;
  }
  if (madaUrl.includes('upload.wikimedia.org')) {
    return madaUrl;
  }
  return madaUrl;
}

// MADA Agent to Category mapping
const AGENT_TO_MADA: Record<string, { botId: string; madaCategory: string }> = {
  'bot-hearing':    { botId: 'bot-hearing',    madaCategory: 'sensory-hearing' },
  'bot-vision':     { botId: 'bot-vision',     madaCategory: 'sensory-vision' },
  'bot-speech':     { botId: 'bot-speech',     madaCategory: 'voice-and-speech' },
  'bot-cognitive':  { botId: 'bot-cognitive',  madaCategory: 'mental-cognitive' },
  'bot-neuro':      { botId: 'bot-neuro',      madaCategory: 'neuromusculoskeletal-movement' },
  'bot-mobility':   { botId: 'bot-mobility',   madaCategory: 'mobility-and-transportation' },
  'bot-regulatory': { botId: 'bot-regulatory', madaCategory: 'regulatory-standards' },
};

// Multi-language match reason
const MATCH_REASON_I18N: Record<string, { found: string; category: (cat: string) => string }> = {
  vi: { found: 'Tìm thấy trong MADA Knowledge Base', category: (cat) => `Phù hợp category: ${cat}` },
  en: { found: 'Found in MADA Knowledge Base', category: (cat) => `Matched category: ${cat}` },
  ar: { found: 'تم العثور عليها في قاعدة معرفة MADA', category: (cat) => `فئة متطابقة: ${cat}` },
  fr: { found: 'Trouvé dans la base de connaissances MADA', category: (cat) => `Catégorie correspondante: ${cat}` },
};

function getMatchReason(lang: string, kind: 'found' | 'category', context?: string): string {
  const langCode = (['vi', 'en', 'ar', 'fr'].includes(lang) ? lang : 'vi') as 'vi' | 'en' | 'ar' | 'fr';
  const dict = MATCH_REASON_I18N[langCode];
  if (kind === 'found') return dict.found;
  return dict.category(context || '');
}

// Language detection
function detectMessageLanguage(message: string): 'vi' | 'en' | 'ar' | 'fr' {
  const text = message || '';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  const viDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (viDiacritics.test(text) && viDiacritics.test(text)) return 'vi';
  const frWords = /\b(je|tu|il|elle|nous|vous|ils|elles|bonjour|merci|oui|non|parce que|s'il vous plaît|désolé|excusez-moi|vous êtes|je suis|estre|être)\b/i;
  if (frWords.test(text)) return 'fr';
  return 'en';
}

function detectAnswerLanguage(answer: string): 'vi' | 'en' | 'ar' | 'fr' | 'unknown' {
  const text = (answer || '').trim();
  if (!text || text.length < 10) return 'unknown';
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicChars / text.length > 0.3) return 'ar';
  const viDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/;
  if (viDiacritics.test(text)) return 'vi';
  const frCommon = /\b(le|la|les|un|une|des|du|de|et|ou|est|sont|avec|pour|sans|dans|sur|sous|tres|aussi|etre|avoir|faire|aller|venir|voir|savoir|prendre|parler)\b/i;
  if ((text.match(frCommon) || []).length >= 2) return 'fr';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'unknown';
}

function isAnswerInExpectedLanguage(answer: string, expectedLang: 'vi' | 'en' | 'ar' | 'fr'): boolean {
  const detected = detectAnswerLanguage(answer);
  if (detected === 'unknown') return true;
  return detected === expectedLang;
}

// Build system instruction
function getSystemInstruction(lang: string, agentPrompt?: string, userMode: 'endUser' | 'specialist' = 'endUser'): string {
  return buildSystemPrompt(lang, userMode, agentPrompt);
}

// Get suggested products from RAG sources
async function getSuggestedProducts(ragSources: any[], message: string, effectiveLanguage: string): Promise<any[]> {
  let suggestedProducts: any[] = [];
  
  // Strategy 1: From RAG sources
  if (ragSources.length > 0) {
    const sourceUrls = ragSources.slice(0, 4).map((src: any) => src.source || src.metadata?.source || '').filter(Boolean);
    let thumbnailMap: Record<string, string> = {};
    
    if (sourceUrls.length > 0) {
      try {
        const placeholders = sourceUrls.map(() => '?').join(',');
        const thumbnailRows = db.prepare(`
          SELECT url, source, json_extract(metadata, '$.thumbnailUrl') as thumbnail
          FROM knowledge_items
          WHERE url IN (${placeholders}) OR source IN (${placeholders})
        `).all(...sourceUrls, ...sourceUrls) as any[];
        
        for (const row of thumbnailRows) {
          if (row.thumbnail) {
            if (row.url) thumbnailMap[row.url] = row.thumbnail;
            if (row.source) thumbnailMap[row.source] = row.thumbnail;
          }
        }
      } catch (e) { /* ignore */ }
    }
    
    suggestedProducts = ragSources.slice(0, 4).map((src: any, idx: number) => {
      const meta = src.metadata || {};
      const sourceUrl = meta.source || meta.url || src.source || '';
      const thumbnail = meta.thumbnailUrl || thumbnailMap[sourceUrl] || '';
      return {
        id: src.id || `src-${idx}`,
        title: meta.title || 'Assistive Technology',
        title_en: meta.title || 'Assistive Technology',
        description: (src.content || '').slice(0, 200),
        category: meta.category || 'general',
        brand: meta.brand || 'MADA Qatar AT Portal',
        price_range: 'Contact MADA Center',
        product_url: sourceUrl,
        source_url: sourceUrl,
        image_url: toProxyImageUrl(thumbnail),
        confidence: src.score || 0.7,
        match_reason: getMatchReason(effectiveLanguage, 'found'),
      };
    });
  }
  
  // Strategy 2: By category keyword
  if (suggestedProducts.length === 0) {
    const contentLower = message.toLowerCase();
    const categoryKeywords: Record<string, string[]> = {
      hearing: ['deaf', 'hear', 'ear', 'sound', 'điếc', 'thính', 'thính giác', 'hearing loss', 'audio', 'fm system'],
      vision: ['blind', 'visual', 'eye', 'sight', 'mắt', 'thị giác', 'blindness', 'low vision'],
      mobility: ['wheelchair', 'walk', 'move', 'physical', 'mobility', 'vận động', 'di chuyển'],
      communication: ['speak', 'talk', 'communicate', 'voice', 'speech', 'giao tiếp', 'ngôn ngữ', 'aac'],
      cognition: ['memory', 'learn', 'cognitive', 'think', 'nhận thức', 'học tập'],
      daily_living: ['daily', 'living', 'self-care', 'sinh hoạt', 'ăn uống'],
      education: ['education', 'school', 'study', 'giáo dục', 'học'],
    };
    
    let detectedCat: string | null = null;
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
        detectedCat = cat;
        break;
      }
    }
    
    if (detectedCat) {
      try {
        const madaItems = db.prepare(`
          SELECT id, title, content, source, url, category, language, metadata
          FROM knowledge_items
          WHERE category = ? AND source LIKE '%mada.org.qa%' AND status IN ('draft','published','approved')
          ORDER BY confidence DESC, created_at DESC LIMIT 4
        `).all(detectedCat) as any[];
        
        suggestedProducts = madaItems.map((item: any) => {
          const url = item.url || item.source || '';
          let thumbnail = '';
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            thumbnail = meta?.thumbnailUrl || '';
            if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';
          } catch { /* ignore */ }
          return {
            id: item.id, title: item.title, title_en: item.title,
            description: (item.content || '').slice(0, 200),
            category: item.category, brand: 'MADA Qatar AT Portal',
            price_range: 'Contact MADA Center', product_url: url, source_url: url,
            image_url: toProxyImageUrl(thumbnail), confidence: 0.7,
            match_reason: getMatchReason(effectiveLanguage, 'category', detectedCat!),
          };
        });
        
        // Deduplicate by URL
        const seenUrls = new Set<string>();
        suggestedProducts = suggestedProducts.filter((p: any) => {
          if (seenUrls.has(p.product_url)) return false;
          seenUrls.add(p.product_url);
          return true;
        });
      } catch (dbErr) { /* ignore */ }
    }
  }
  
  // Strategy 3: Random MADA item
  if (suggestedProducts.length === 0) {
    try {
      const randomMada = db.prepare(`
        SELECT id, title, content, source, url, category, language, metadata
        FROM knowledge_items
        WHERE source LIKE '%mada.org.qa%' AND status IN ('draft','published','approved')
        ORDER BY RANDOM() LIMIT 4
      `).all() as any[];
      
      suggestedProducts = randomMada.map((item: any) => {
        const url = item.url || item.source || '';
        let thumbnail = '';
        try {
          const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          thumbnail = meta?.thumbnailUrl || '';
          if (thumbnail && !thumbnail.startsWith('http')) thumbnail = '';
        } catch { /* ignore */ }
        return {
          id: item.id, title: item.title, title_en: item.title,
          description: (item.content || '').slice(0, 200),
          category: item.category, brand: 'MADA Qatar AT Portal',
          price_range: 'Contact MADA Center', product_url: url, source_url: url,
          image_url: toProxyImageUrl(thumbnail), confidence: 0.6,
          match_reason: getMatchReason(effectiveLanguage, 'found'),
        };
      });
    } catch (dbErr) { /* ignore */ }
  }
  
  return suggestedProducts;
}

// ============== ROUTES ==============

// POST /api/chat — Basic chat with RAG
router.post('/', async (req, res) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;
    
    // Wait for RAG engine
    const ready = await waitForRagReady(15000);
    if (!ready) {
      const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
      const errMsgs: Record<string, string> = {
        vi: 'Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây.',
        en: 'System is initializing, please retry in a few seconds.',
        ar: 'النظام قيد التهيئة، يرجى إعادة المحاولة.',
        fr: "Le système s'initialise, veuillez réessayer.",
      };
      return res.status(503).json({ success: false, error: errMsgs[lang] || errMsgs.vi, retryable: true });
    }
    
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : detectedLanguage;
    
    console.log('🌍 Language settings:', { uiLanguage, detectedLanguage, effectiveLanguage, messagePreview: message?.slice(0, 30) });
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    const safetyScore = guardrails.calculateSafetyScore(message);
    
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: safetyScore,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
          conversationId: conversationId || uuidv4(),
        },
      });
    }
    
    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });
    
    // Build RAG config
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode);
    const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
    
    const ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (madaMapping) {
      ragConfig.botId = madaMapping.botId;
      ragConfig.madaCategory = madaMapping.madaCategory;
      ragConfig.priority = true;
    } else if (agentId) {
      // ⭐ Custom agent: filter by agentId to get agent's own KB docs
      ragConfig.agentId = agentId;
      ragConfig.priority = true;
    }
    
    // Query RAG
    const ragResponse = await ragEngine.query(message, chatHistory.get(convId) || [], ragConfig);
    
    // Post-validation: ensure correct language
    let finalAnswer = ragResponse.answer;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount < maxRetries && finalAnswer && !isAnswerInExpectedLanguage(finalAnswer, effectiveLanguage as 'vi' | 'en' | 'ar' | 'fr')) {
      retryCount++;
      console.warn(`[Chat] ⚠️ Response not in expected language (${effectiveLanguage}), retry #${retryCount}`);
      const strongerInstruction = `${agentInstruction}\n\n⚠️ CRITICAL REMINDER: The UI language is ${effectiveLanguage.toUpperCase()}. Your previous response was in WRONG language. Respond ONLY in ${effectiveLanguage.toUpperCase()} NOW.`;
      const retryConfig = { ...ragConfig, systemInstruction: strongerInstruction };
      const retryResponse = await ragEngine.query(message, chatHistory.get(convId) || [], retryConfig);
      finalAnswer = retryResponse.answer;
      ragResponse.sources = retryResponse.sources;
      ragResponse.confidence = retryResponse.confidence;
    }
    
    ragResponse.answer = finalAnswer;
    
    // Validate response
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = guardrailsResult.redirectResponse || 'Response filtered by safety guardrails.';
    }
    
    // Get suggested products
    const suggestedProducts = await getSuggestedProducts(ragResponse.sources || [], message, effectiveLanguage);
    
    // Store assistant response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    logActivity('info', `Chat: ${agentId || 'default'} - "${message.slice(0, 50)}..."`, 'Chat');
    
    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        safetyScore,
        agentId,
        detectedLanguage: effectiveLanguage,
        suggestedProducts,
      },
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// POST /api/chat-with-file — Chat with file attachments
router.post('/with-file', async (req, res) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentPrompt, attachments } = req.body;
    
    const ready = await waitForRagReady(15000);
    if (!ready) {
      const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
      const errMsgs: Record<string, string> = {
        vi: 'Hệ thống đang khởi tạo, vui lòng thử lại sau vài giây.',
        en: 'System is initializing, please retry in a few seconds.',
        ar: 'النظام قيد التهيئة، يرجى إعادة المحاولة.',
        fr: "Le système s'initialise, veuillez réessayer.",
      };
      return res.status(503).json({ success: false, error: errMsgs[lang] || errMsgs.vi, retryable: true });
    }
    
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : detectedLanguage;
    
    console.log('📎 Chat with files:', { message: message?.slice(0, 50), fileCount: attachments?.length || 0 });
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // File upload quota check
    let fileUserId: string | null = null;
    let fileUserPlan: 'free' | 'pro' | 'enterprise' | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = verifyAccessToken(token) as any;
        if (payload?.userId) {
          const u = db.prepare('SELECT id, plan FROM users WHERE id = ?').get(payload.userId) as { id: string; plan: 'free' | 'pro' | 'enterprise' } | undefined;
          if (u) {
            fileUserId = u.id;
            fileUserPlan = u.plan;
          }
        }
      } catch { /* ignore */ }
    }
    
    if (attachments && Array.isArray(attachments) && attachments.length > 0 && fileUserId && fileUserPlan) {
      const preQuota = getFileUploadQuota(fileUserId, fileUserPlan);
      if (preQuota.limit !== -1 && preQuota.remaining < attachments.length) {
        const lang = (req.body.language || uiLanguage || 'vi').slice(0, 2);
        const errMsgs: Record<string, string> = {
          vi: `Bạn chỉ còn ${preQuota.remaining}/${preQuota.limit} lượt tải file tháng này.`,
          en: `You only have ${preQuota.remaining}/${preQuota.limit} file uploads left this month.`,
          ar: `لديك ${preQuota.remaining}/${preQuota.limit} عمليات تحميل متبقية.`,
          fr: `Il ne vous reste que ${preQuota.remaining}/${preQuota.limit} téléchargements.`,
        };
        return res.status(402).json({ success: false, error: errMsgs[lang] || errMsgs.vi, code: 'FILE_UPLOAD_QUOTA_EXCEEDED', quota: preQuota });
      }
    }
    
    // Parse attachments
    let fileContext = '';
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        try {
          if (att.type?.startsWith('image/') && att.base64) {
            // OCR for images - simplified
            fileContext += `\n[Image attached: ${att.name || 'image'}]`;
          } else if (att.type === 'application/pdf' && att.base64) {
            fileContext += `\n[PDF attached: ${att.name || 'document'}]`;
          } else if ((att.type === 'text/plain' || att.type === 'text/markdown') && att.content) {
            fileContext += `\n[File content: ${att.name}]\n${att.content}`;
          }
        } catch (attErr) {
          console.log('⚠️ Attachment processing error:', attErr);
        }
      }
      
      // Track uploads
      if (fileUserId && attachments.length > 0) {
        for (const att of attachments) {
          trackFileUpload({
            userId: fileUserId,
            filename: att.name || 'unknown',
            fileSizeBytes: att.size || 0,
            fileType: att.type,
          });
        }
      }
    }
    
    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });
    
    // Build RAG config with file context
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, 'endUser');
    const ragConfig: any = { 
      systemInstruction: agentInstruction, 
      language: effectiveLanguage,
    };
    
    // Append file context to message if present
    const fullMessage = fileContext ? `${message}\n\n--- Attachment Context ---\n${fileContext}` : message;
    
    // Query RAG
    const ragResponse = await ragEngine.query(fullMessage, chatHistory.get(convId) || [], ragConfig);
    
    // Validate response
    let finalAnswer = ragResponse.answer;
    let retryCount = 0;
    while (retryCount < 2 && finalAnswer && !isAnswerInExpectedLanguage(finalAnswer, effectiveLanguage as 'vi' | 'en' | 'ar' | 'fr')) {
      retryCount++;
      const strongerInstruction = `${agentInstruction}\n\n⚠️ CRITICAL: Respond ONLY in ${effectiveLanguage.toUpperCase()}.`;
      const retryConfig = { ...ragConfig, systemInstruction: strongerInstruction };
      const retryResponse = await ragEngine.query(fullMessage, chatHistory.get(convId) || [], retryConfig);
      finalAnswer = retryResponse.answer;
      ragResponse.sources = retryResponse.sources;
      ragResponse.confidence = retryResponse.confidence;
    }
    ragResponse.answer = finalAnswer;
    
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = 'Response filtered by safety guardrails.';
    }
    
    // Get suggested products
    const suggestedProducts = await getSuggestedProducts(ragResponse.sources || [], message, effectiveLanguage);
    
    // Store assistant response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });
    
    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        detectedLanguage: effectiveLanguage,
        suggestedProducts,
        attachmentsProcessed: attachments?.length || 0,
      },
    });
  } catch (error) {
    console.error('❌ Chat with file error:', error);
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// POST /api/chat/stream — SSE streaming chat
router.post('/stream', async (req: any, res: any) => {
  try {
    const { message, conversationId, language: uiLanguage = 'vi', agentId, agentPrompt, userMode } = req.body;
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    sendEvent({ type: 'connected', timestamp: Date.now() });
    
    // Anonymous quota check
    const isAuthenticated = req.headers.authorization?.startsWith('Bearer ');
    if (!isAuthenticated) {
      const systemSettings = getSystemSettings();
      const anonymousLimit = systemSettings.anonymousLimit;
      
      if (anonymousLimit !== -1) {
        const anonQuotaHeader = req.headers['x-anon-quota'] ? parseInt(req.headers['x-anon-quota'] as string) : 0;
        
        if (anonQuotaHeader >= anonymousLimit) {
          sendEvent({
            type: 'done',
            answer: `⚠️ Bạn đã sử dụng hết ${anonymousLimit} lần trò chuyện miễn phí. Vui lòng đăng nhập để tiếp tục.`,
            sources: [],
            quotaExceeded: true,
          });
          return res.end();
        }
      }
    }
    
    // Language detection
    const detectedLanguage = detectMessageLanguage(message);
    const effectiveLanguage = (uiLanguage && ['vi', 'en', 'ar', 'fr'].includes(uiLanguage)) ? uiLanguage : detectedLanguage;
    
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, effectiveLanguage);
    if (guardrailsResult.shouldRedirect) {
      sendEvent({ type: 'done', answer: guardrailsResult.redirectResponse, sources: [] });
      return res.end();
    }
    
    // Store conversation
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });
    
    // Build RAG config
    const validUserMode: 'endUser' | 'specialist' = userMode === 'specialist' ? 'specialist' : 'endUser';
    const agentInstruction = getSystemInstruction(effectiveLanguage, agentPrompt, validUserMode);
    const madaMapping = agentId ? AGENT_TO_MADA[agentId] : null;
    
    let ragConfig: any = { systemInstruction: agentInstruction, language: effectiveLanguage };
    if (madaMapping) {
      ragConfig.botId = madaMapping.botId;
      ragConfig.madaCategory = madaMapping.madaCategory;
      ragConfig.priority = true;
    } else if (agentId) {
      // ⭐ Custom agent: filter by agentId to get agent's own KB docs
      ragConfig.agentId = agentId;
      ragConfig.priority = true;
    }
    
    // Check RAG engine
    if (!ragEngine.isConfigured) {
      const ready = await waitForRagReady(15000);
      if (!ready) {
        console.warn('[chat/stream] RAG engine not configured after 15s wait');
        const geminiErrors: Record<string, string> = {
          vi: '⚠️ Hệ thống đang khởi tạo, vui lòng thử lại.',
          en: '⚠️ System is initializing, please retry.',
          ar: '⚠️ النظام قيد التهيئة، يرجى إعادة المحاولة.',
          fr: "⚠️ Le système s'initialise, veuillez réessayer.",
        };
        sendEvent({ type: 'error', error: geminiErrors[effectiveLanguage] || geminiErrors.vi, retryable: true });
        return res.end();
      }
    }
    
    // Stream from RAG
    try {
      const streamResult = await ragEngine.queryStream(message, chatHistory.get(convId) || [], ragConfig);
      
      if (streamResult.sources && streamResult.sources.length > 0) {
        sendEvent({ type: 'sources', sources: streamResult.sources });
      }
      
      // Get suggested products
      try {
        const suggestedProducts = await getSuggestedProducts(streamResult.sources || [], message, effectiveLanguage);
        if (suggestedProducts.length > 0) {
          sendEvent({ type: 'suggestedProducts', suggestedProducts });
        }
      } catch (suggErr) {
        console.log('⚠️ suggestedProducts error:', suggErr);
      }
      
      // Stream response
      if (streamResult.stream) {
        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            sendEvent({ type: 'chunk', chunk: chunkText });
          }
        }
      } else if (streamResult.answer) {
        sendEvent({ type: 'chunk', chunk: streamResult.answer });
      }
      
      sendEvent({
        type: 'done',
        conversationId: convId,
        confidence: streamResult.confidence || 0.5,
      });
      
      chatHistory.get(convId)!.push({ role: 'assistant', content: streamResult.answer || '' });
      
    } catch (streamError) {
      console.error('❌ Stream error:', streamError);
      if (!res.writableEnded) {
        sendEvent({ type: 'error', error: streamError instanceof Error ? streamError.message : 'Stream failed' });
      }
    }
    
    if (!res.writableEnded) {
      try {
        return res.end();
      } catch (e) {
        console.warn('⚠️ res.end() error:', (e as Error).message);
        return;
      }
    }
    return;
  } catch (error) {
    console.error('❌ Chat stream error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    if (!res.writableEnded) {
      try {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: `Lỗi server: ${errMsg}`, retryable: true })}\n\n`);
          res.end();
        } else {
          res.status(503).json({ success: false, error: `Error: ${errMsg}`, retryable: true });
        }
      } catch (e) {
        console.warn('⚠️ Cannot send error response:', (e as Error).message);
      }
    }
  }
});

// POST /api/chat/follow-up — AI-powered follow-up questions
router.post('/follow-up', async (req, res) => {
  try {
    const { userMessage, aiResponse, conversationHistory, language = 'vi', userMode: _userMode = 'endUser' } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ success: false, error: 'userMessage is required' });
    }
    
    console.log('💡 Generating follow-up questions for:', userMessage.slice(0, 50));
    
    // Build context
    const historyContext = conversationHistory
      ?.slice(-10)
      ?.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      ?.join('\n') || '';
    
    // Prompt templates
    const prompts: Record<string, string> = {
      vi: `Bạn là trợ lý MADA AI chuyên về Công nghệ Hỗ trợ (AT).
Dựa vào cuộc trò chuyện sau:
---
Người dùng: ${userMessage}
MADA AI: ${aiResponse || '(chưa có phản hồi)'}
${historyContext ? `Lịch sử:\n${historyContext}` : ''}
---
Hãy đề xuất 3 câu hỏi TIẾP THEO mà người dùng có thể hỏi.
QUY TẮC:
1. Câu hỏi phải CỤ THỂ, liên quan đến nội dung đang thảo luận
2. Đa dạng: có thể hỏi về giá, cách dùng, so sánh, mua ở đâu...
3. Ngắn gọn 10-20 từ
4. Trả lời JSON: {"questions": ["câu 1", "câu 2", "câu 3"]}
5. Không hỏi lại những gì đã được trả lời
7. CHỈ trả về JSON, không giải thích.`,
      en: `You are MADA AI assistant specializing in Assistive Technology (AT).
Based on this conversation:
---
User: ${userMessage}
MADA AI: ${aiResponse || '(no response yet)'}
${historyContext ? `History:\n${historyContext}` : ''}
---
Suggest 3 NEXT questions the user might ask.
RULES:
1. Questions must be SPECIFIC and relevant
2. Diverse: pricing, usage, comparison, where to buy...
3. Concise 10-20 words
4. Respond ONLY in JSON: {"questions": ["q1", "q2", "q3"]}
5. Don't repeat answered questions
7. ONLY return JSON.`,
      ar: `أنت مساعد MADA AI المتخصص في التكنولوجيا المساعدة.
بناءً على هذه المحادثة:
---
المستخدم: ${userMessage}
MADA AI: ${aiResponse || '(لا توجد إجابة)'}
---
اقترح 3 أسئلة NEXT.
القواعد:
1. أسئلة محددة وذات صلة
2. متنوعة
3. موجزة 10-20 كلمة
4. JSON فقط: {"questions": ["q1", "q2", "q3"]}`,
      fr: `Vous êtes l'assistant MADA AI spécialisé en Technologie d'Assistance.
Basé sur cette conversation:
---
Utilisateur: ${userMessage}
MADA AI: ${aiResponse || '(pas encore de réponse)'}
---
Suggérez 3 questions SUIVANTES.
RÈGLES:
1. Questions spécifiques et pertinentes
2. Diversifiées
3. Concises 10-20 mots
4. JSON uniquement: {"questions": ["q1", "q2", "q3"]}`
    };
    
    const prompt = prompts[language] || prompts.vi;
    
    // Check Gemini config
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      return res.json({ success: true, data: { questions: [], source: 'fallback' } });
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      console.error('❌ Gemini API error:', await geminiResponse.text());
      return res.json({ success: true, data: { questions: [], source: 'api_error' } });
    }
    
    const geminiData = await geminiResponse.json();
    let responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    responseText = responseText.replace(/```json\s*/i, '').replace(/```\s*/g, '').trim();
    
    // Parse JSON
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        return res.json({ success: true, data: { questions: questions.slice(0, 4), source: 'gemini' } });
      }
      
      // Fallback: parse text format
      const lines = responseText.split('\n').map((l: any) => l.trim()).filter(Boolean);
      const questions: string[] = [];
      for (const line of lines) {
        const match = line.match(/^[*\-\•]?\s*(?:Q?\d+[:\.)]\s*)?(.+)/i);
        if (match && match[1] && match[1].length > 10 && !match[1].startsWith('#')) {
          questions.push(match[1].replace(/^[a-z]\)\s*/i, '').trim());
        }
      }
      
      if (questions.length > 0) {
        return res.json({ success: true, data: { questions: questions.slice(0, 4), source: 'parsed' } });
      }
      
      return res.json({ success: true, data: { questions: [], source: 'no_parse' } });
    } catch (parseErr) {
      console.error('❌ Follow-up parse error:', parseErr);
      return res.json({ success: true, data: { questions: [], source: 'parse_error' } });
    }
  } catch (error) {
    console.error('❌ Follow-up error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/chat/history/:id — Get conversation history
router.get('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const history = chatHistory.get(id);
    
    if (!history) {
      return res.json({ success: true, data: { messages: [], exists: false } });
    }
    
    res.json({ success: true, data: { messages: history, exists: true } });
  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/chat/history/:id — Clear conversation history
router.delete('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = chatHistory.delete(id);
    
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('❌ Delete history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/chat/evaluate — Run RAG evaluation
// Note: This is a simplified evaluation for development purposes
router.post('/evaluate', async (req, res) => {
  try {
    const { topK = 5 } = req.body;
    
    // Simple keyword-based evaluation
    const testQueries = [
      { query: 'hearing aid', lang: 'en' },
      { query: 'wheelchair', lang: 'en' },
      { query: 'máy trợ thính', lang: 'vi' },
      { query: 'thiết bị hỗ trợ người mù', lang: 'vi' },
      { query: 'screen reader', lang: 'en' },
      { query: 'AAC device', lang: 'en' },
    ];
    
    const results: any[] = [];
    
    for (const testQuery of testQueries) {
      try {
        const searchResults = await ragEngine.query(testQuery.query, [], { topK: Number(topK) });
        
        results.push({
          query: testQuery.query,
          language: testQuery.lang,
          retrievedCount: searchResults.sources?.length || 0,
          confidence: searchResults.confidence || 0,
          contextUsed: searchResults.contextUsed || false,
        });
      } catch (err) {
        results.push({
          query: testQuery.query,
          language: testQuery.lang,
          error: (err as Error).message,
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalQueries: results.length,
          successfulQueries: results.filter((r: any) => !r.error).length,
          avgRetrieved: results.reduce((acc: number, r: any) => acc + (r.retrievedCount || 0), 0) / Math.max(results.filter((r: any) => !r.error).length, 1),
        },
      },
    });
  } catch (error) {
    console.error('❌ Evaluation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
