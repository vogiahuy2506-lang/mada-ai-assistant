import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatSettingsStore, useLanguageStore } from '@/stores';
import {
  Send, Paperclip, X, Minimize2, Loader2, ImageIcon, FileText, Copy, Check, Bot
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Language } from '@/types';
import { t } from '@/lib/translations';
import { getAccessToken } from '@/lib/api';

// Translation helper for EmbedWidget
const useWidgetTranslation = (lang: Language) => ({
  chatWithMada: t('embedWidget.chatWithMada', lang),
  online: t('embedWidget.online', lang),
  changeLanguage: t('embedWidget.changeLanguage', lang),
  embeddedPlaceholder: t('embedWidget.embeddedPlaceholder', lang),
  copy: t('embedWidget.copy', lang),
});

interface Message {
  id: string;
  role: string;
  content: string;
  confidence?: number;
  isStreaming?: boolean;
  attachments?: { name: string; type: string; preview?: string }[];
}

interface EmbedWidgetProps {
  botName?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  defaultLanguage?: Language;
  allowFileUpload?: boolean;
  allowLanguageSwitch?: boolean;
  apiKey?: string;
  welcomeTitle?: string;
  isOpen?: boolean;
  onClose?: () => void;
  // New settings
  widgetType?: 'popup' | 'embedded' | 'floating';
  chatBubbleEnabled?: boolean;
  chatBubbleIcon?: string;
  showLabel?: boolean;
  labelPosition?: 'bottom' | 'top';
  labelName?: string;
  labelColor?: string;
  allowFaq?: boolean;
  onFaqClick?: (question: string) => void;
}

// Get language name translations based on current language
const getLanguageName = (code: Language, currentLang: Language): string => {
  const names: Record<Language, Record<Language, string>> = {
    vi: {
      vi: 'Tiếng Việt',
      en: 'English',
      ar: 'العربية',
      fr: 'Français',
    },
    en: {
      vi: 'Vietnamese',
      en: 'English',
      ar: 'Arabic',
      fr: 'French',
    },
    ar: {
      vi: 'الفيتنامية',
      en: 'الإنجليزية',
      ar: 'العربية',
      fr: 'الفرنسية',
    },
    fr: {
      vi: 'Vietnamien',
      en: 'Anglais',
      ar: 'Arabe',
      fr: 'Français',
    },
  };
  return names[currentLang][code];
};

// Language options with flags (always show same flags regardless of language)
const LANGUAGES_FLAGS: { code: Language; flag: string }[] = [
  { code: 'vi', flag: '🇻🇳' },
  { code: 'en', flag: '🇺🇸' },
  { code: 'ar', flag: '🇸🇦' },
  { code: 'fr', flag: '🇫🇷' },
];

// Icon mapping: admin IDs -> emoji
const ICON_MAP: Record<string, string> = {
  'chat': '💬',
  'sparkles': '✨',
  'bot': '🤖',
  'plus': '➕',
};

// Default FAQ prompts
const DEFAULT_FAQ_PROMPTS = [
  { id: 'faq1', vi: '💡 Hướng dẫn tích hợp API', en: '💡 API Integration Guide', ar: '💡 دليل تكامل API', fr: '💡 Guide d\'intégration API' },
  { id: 'faq2', vi: '📊 Bảng giá và chính sách dịch vụ', en: '📊 Pricing & Service Policy', ar: '📊 التسعير وسياسة الخدمة', fr: '📊 Tarification et politique de service' },
  { id: 'faq3', vi: '🔧 Hỗ trợ kỹ thuật', en: '🔧 Technical Support', ar: '🔧 الدعم الفني', fr: '🔧 Support technique' },
];

export function EmbedWidget({
  botName: botNameProp,
  primaryColor: primaryColorProp,
  position: positionProp = 'bottom-right',
  defaultLanguage: defaultLanguageProp = 'vi',
  allowFileUpload: allowFileUploadProp = true,
  allowLanguageSwitch: allowLanguageSwitchProp = true,
  apiKey: apiKeyProp,
  welcomeTitle: welcomeTitleProp,
  isOpen: isOpenProp,
  onClose,
  // New settings
  widgetType: widgetTypeProp = 'popup',
  chatBubbleEnabled: chatBubbleEnabledProp = true,
  chatBubbleIcon: chatBubbleIconProp = 'chat',
  showLabel: showLabelProp = true,
  labelPosition: labelPositionProp = 'bottom',
  labelName: labelNameProp = 'Chat with MADA',
  labelColor: labelColorProp,
  allowFaq: allowFaqProp = true,
}: EmbedWidgetProps) {
  // Map icon ID to emoji
  const iconEmoji = ICON_MAP[chatBubbleIconProp] || '💬';
  
  // Get FAQ prompt based on language
  const getFaqPrompt = (faq: typeof DEFAULT_FAQ_PROMPTS[0]) => {
    return faq[language] || faq.vi;
  };
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Support both controlled (external isOpen) and uncontrolled (internal) modes
  const isOpen = isOpenProp !== undefined ? isOpenProp : internalIsOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    if (isOpenProp === undefined) {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    if (isOpenProp === undefined) {
      setInternalIsOpen(true);
    }
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Get language from store for translations
  const { language: storeLanguage } = useLanguageStore();
  const [language, setLanguage] = useState<Language>(defaultLanguageProp || storeLanguage || 'vi');
  const [selectedFiles, setSelectedFiles] = useState<{ fileId: string; name: string; type: string; size: number; content?: string; originalFile?: File }[]>([]);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Get widget translations
  const translations = useWidgetTranslation(language);

  // Update language when store language changes
  useEffect(() => {
    if (storeLanguage && storeLanguage !== language) {
      setLanguage(storeLanguage);
    }
  }, [storeLanguage]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  // Load settings from backend
  const { greeting, description, fileAttachmentEnabled, loadFromBackend: loadChatSettings } = useChatSettingsStore();
  
  // Get config from store or props - extract MADA AI name properly from greeting
  // greeting.vi = "Xin chào! Mình là MADA AI." -> extract "MADA AI"
  const extractBotName = (greetingText: string): string => {
    // Try to find "MADA AI" pattern in greeting
    const match = greetingText.match(/là\s+(.+?)[.!]?$/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return 'MADA AI';
  };

  const configBotName = botNameProp || extractBotName(greeting.vi) || 'MADA AI';
  const configPrimaryColor = primaryColorProp || '#0891b2';
  const configAllowFileUpload = allowFileUploadProp && fileAttachmentEnabled;
  const configAllowLanguageSwitch = allowLanguageSwitchProp;

  // Get the correct greeting based on current language - wait for greeting to be loaded
  const configWelcomeTitle = welcomeTitleProp || (greeting[language] || greeting.vi);
  const configDescription = description[language] || description.vi;

  // Reload chat settings when widget opens to get fresh data
  useEffect(() => {
    if (isOpen) {
      loadChatSettings();
    }
  }, [isOpen, loadChatSettings]);

  // Add welcome message when widget opens and greeting is loaded
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message with the correct language greeting and description
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `${configWelcomeTitle}\n\n${configDescription}`,
        },
      ]);
    }
  }, [isOpen, configWelcomeTitle, configDescription, greeting, description]);

  // Update welcome message when language changes (if chat is already open)
  useEffect(() => {
    if (isOpen && messages.length > 0 && messages[0].id === 'welcome') {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `${configWelcomeTitle}\n\n${configDescription}`,
        },
      ]);
    }
  }, [language, configWelcomeTitle, configDescription, greeting, description]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [inputValue]);

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

  const processFile = useCallback(async (file: File) => {
    const fileId = `${file.name}-${Date.now()}`;
    
    setSelectedFiles(prev => [...prev, {
      fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      originalFile: file,
    }]);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFiles(prev => prev.map(f => 
          f.fileId === fileId ? { ...f, content: reader.result as string } : f
        ));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile);
    }
    setShowAttachmentMenu(false);
  };

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.fileId !== fileId));
  };

  const handleSend = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      attachments: selectedFiles.length > 0 ? selectedFiles.map(f => ({ name: f.name, type: f.type })) : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setSelectedFiles([]);

    // Prepare attachments for API
    const attachmentsForApi: any[] = [];
    for (const file of selectedFiles) {
      if (file.content && file.type.startsWith('image/')) {
        attachmentsForApi.push({
          type: 'image',
          name: file.name,
          content: file.content,
        });
      } else if (file.originalFile) {
        // Read file as base64
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file.originalFile!);
        });
        attachmentsForApi.push({
          type: file.type.includes('pdf') ? 'pdf' : 'document',
          name: file.name,
          content,
        });
      }
    }

    try {
      const chatBody: any = {
        message: userMessage,
        language,
        userMode: 'endUser',
      };
      
      if (attachmentsForApi.length > 0) {
        chatBody.attachments = attachmentsForApi;
      }
      
      if (apiKeyProp) {
        chatBody.apiKey = apiKeyProp;
      }

      const useStream = attachmentsForApi.length === 0;
      
      if (useStream) {
        // Streaming mode
        const token = getAccessToken();
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(chatBody),
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';
        let confidence = 0.5;

        const assistantMsgId = `assistant-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        }]);

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
                  fullContent += data.chunk;
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMsgId ? { ...m, content: fullContent } : m
                  ));
                } else if (data.type === 'done') {
                  confidence = data.confidence || 0.5;
                }
              } catch {}
            }
          }
        }

        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: fullContent, confidence, isStreaming: false } : m
        ));
      } else {
        // Non-streaming mode for file uploads
        const token2 = getAccessToken();
        const response = await fetch('/api/chat-with-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token2 ? { Authorization: `Bearer ${token2}` } : {}),
          },
          body: JSON.stringify(chatBody),
        });

        const data = await response.json();
        
        if (data.success) {
          const assistantMsgId = `assistant-${Date.now()}`;
          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: data.data?.response || data.response || data.message || t('widget.error', language),
            confidence: data.confidence || 0.5,
          }]);
        } else {
          const assistantMsgId = `assistant-${Date.now()}`;
          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: data.error || t('widget.error', language),
          }]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: t('widget.sorry', language),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaqSend = async (question: string) => {
    try {
      const chatBody: any = {
        message: question,
        language,
        userMode: 'endUser',
      };
      
      if (apiKeyProp) {
        chatBody.apiKey = apiKeyProp;
      }

      const token = getAccessToken();
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(chatBody),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let confidence = 0.5;

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }]);

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
                fullContent += data.chunk;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, content: fullContent } : m
                ));
              } else if (data.type === 'done') {
                confidence = data.confidence || 0.5;
              }
            } catch {}
          }
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId ? { ...m, content: fullContent, confidence, isStreaming: false } : m
      ));
    } catch (error) {
      console.error('FAQ error:', error);
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: t('widget.sorry', language),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentLangFlag = LANGUAGES_FLAGS.find(l => l.code === language) || LANGUAGES_FLAGS[0];

  // Determine if we should show the chat button (only for popup type)
  const shouldShowChatButton = chatBubbleEnabledProp && widgetTypeProp === 'popup' && !isOpen;

  // Calculate the position of the chat button and label
  const isLeftPosition = positionProp === 'bottom-left';
  const labelBgColor = labelColorProp || configPrimaryColor;

  return (
    <>
      {/* Chat Button with optional Label */}
      {shouldShowChatButton && (
        <div className="fixed bottom-6 z-50 flex flex-col items-center gap-2">
          {/* Label (above or below button based on position) */}
          {showLabelProp && (
            <div
              className={clsx(
                'px-3 py-1.5 rounded-lg text-white text-xs font-medium shadow-lg whitespace-nowrap',
                labelPositionProp === 'top' ? 'order-1' : 'order-2'
              )}
              style={{ backgroundColor: labelBgColor }}
            >
              {labelNameProp}
            </div>
          )}
          
          {/* Chat Bubble Button */}
          <button
            onClick={handleOpen}
            className={clsx(
              'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110',
              'text-white font-bold text-2xl border-2 border-white/20',
              labelPositionProp === 'top' ? 'order-2' : 'order-1'
            )}
            style={{ 
              backgroundColor: configPrimaryColor,
              [isLeftPosition ? 'left' : 'right']: '24px'
            }}
          >
            <span className="text-2xl">{iconEmoji}</span>
          </button>
        </div>
      )}

      {/* For Embedded widget type - render without chat button */}
      {widgetTypeProp === 'embedded' && !isOpen && (
        <button
          onClick={handleOpen}
          className="w-full h-full min-h-[400px] rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-3 text-gray-500 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
          style={{ backgroundColor: `${configPrimaryColor}10` }}
        >
          <span className="text-5xl">{iconEmoji}</span>
          <span className="text-sm font-medium">{labelNameProp || translations.chatWithMada}</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={clsx(
            'bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all',
            'border border-gray-200',
            isMinimized ? 'w-16 h-16' : 'w-[380px] h-[600px]',
            // Different positioning based on widget type
            widgetTypeProp === 'popup' && 'fixed z-50',
            widgetTypeProp === 'embedded' && 'w-full h-full',
            widgetTypeProp === 'floating' && 'fixed z-50 w-[380px] h-[600px]'
          )}
          style={{
            ...(widgetTypeProp === 'popup' || widgetTypeProp === 'floating'
              ? { [positionProp === 'bottom-right' ? 'right' : 'left']: '24px', bottom: '24px' }
              : {}),
          }}
        >
          {/* Header */}
          {!isMinimized && (
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundColor: configPrimaryColor }}
            >
              <div className="flex items-center gap-3">
                {/* MADA Logo */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden p-1.5 shadow-sm">
                  <img 
                    src="/mada-logo-v2.png" 
                    alt="MADA" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to old logo if v2 not found
                      e.currentTarget.src = '/mada-logo.png';
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{configBotName}</h3>
                  <p className="text-xs text-white/80">{translations.online}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {configAllowLanguageSwitch && (
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                    title={translations.changeLanguage}
                  >
                    <span className="text-sm">{currentLangFlag.flag}</span>
                  </button>
                )}
                {/* Only show minimize for popup type */}
                {widgetTypeProp === 'popup' && (
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Language Menu */}
          {showLanguageMenu && !isMinimized && (
            <div
              ref={languageMenuRef}
              className="absolute right-16 top-14 bg-white rounded-xl shadow-lg border border-gray-200 p-2 z-10"
            >
              {LANGUAGES_FLAGS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLanguageMenu(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    language === lang.code ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{getLanguageName(lang.code, language)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Restore Button (for popup type only) */}
          {isMinimized && (
            <button
              onClick={() => setIsMinimized(false)}
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: configPrimaryColor }}
            >
              <span className="text-white text-2xl">{iconEmoji}</span>
            </button>
          )}

          {/* Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* Robot Avatar for Assistant */}
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-2 shadow-sm border-2 border-white">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={clsx(
                        'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                        msg.role === 'user'
                          ? 'text-white'
                          : 'bg-white border border-gray-200 shadow-sm',
                        msg.isStreaming && 'animate-pulse'
                      )}
                      style={msg.role === 'user' ? { backgroundColor: configPrimaryColor } : undefined}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none text-gray-800">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      
                      {/* Attachments preview */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((att, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg text-xs"
                            >
                              <FileText className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Copy button for assistant messages */}
                      {msg.role === 'assistant' && msg.content && (
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="mt-2 p-1 rounded hover:bg-gray-100 transition-colors"
                          title={translations.copy}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t('widget.replying', language)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />

                {/* FAQ Quick Prompts */}
                {allowFaqProp && messages.length <= 1 && !isLoading && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-gray-400 font-medium px-1">Câu hỏi phổ biến:</p>
                    {DEFAULT_FAQ_PROMPTS.map((faq) => (
                      <button
                        key={faq.id}
                        onClick={() => {
                          const question = getFaqPrompt(faq);
                          setInputValue(question.replace(/^[^\s]+\s/, '')); // Remove emoji
                          // Auto send
                          setTimeout(() => {
                            if (inputValue) {
                              const userMsg: Message = {
                                id: `user-${Date.now()}`,
                                role: 'user',
                                content: question.replace(/^[^\s]+\s/, ''),
                              };
                              setMessages(prev => [...prev, userMsg]);
                              setIsLoading(true);
                              // Send to API
                              handleFaqSend(question.replace(/^[^\s]+\s/, ''));
                            }
                          }, 100);
                        }}
                        className="block w-full text-left text-xs bg-white hover:bg-cyan-50/70 text-gray-700 font-medium px-3 py-2 rounded-lg border border-gray-200 shadow-xs transition-colors"
                      >
                        {getFaqPrompt(faq)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex flex-wrap gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.fileId}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs border border-gray-200"
                    >
                      {file.type.startsWith('image/') ? (
                        <ImageIcon className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span className="truncate max-w-[80px]">{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(file.fileId)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex items-end gap-2">
                  {/* Attachment Button */}
                  {configAllowFileUpload && (
                    <div className="relative" ref={attachmentMenuRef}>
                      <button
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      
                      {showAttachmentMenu && (
                        <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-lg border border-gray-200 p-2 min-w-[160px] z-10">
                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">{t('widget.image', language)}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                          </label>
                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">{t('widget.document', language)}</span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.txt"
                              multiple
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Input */}
                  <div className="flex-1">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={t('widget.typeMessage', language)}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0"
                      rows={1}
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}
                    className="p-2.5 rounded-xl text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: configPrimaryColor }}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default EmbedWidget;
