import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatSettingsStore, useLanguageStore } from '@/stores';
import {
  Send, Paperclip, X, Minimize2, Loader2, ImageIcon, FileText, Copy, Check, Bot
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Language } from '@/types';

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
}

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
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
}: EmbedWidgetProps) {
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
  const [language, setLanguage] = useState<Language>(defaultLanguageProp);
  const [selectedFiles, setSelectedFiles] = useState<{ fileId: string; name: string; type: string; size: number; content?: string; originalFile?: File }[]>([]);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const configWelcomeTitle = welcomeTitleProp || greeting[language] || greeting.vi;

  useEffect(() => {
    loadChatSettings();
  }, [loadChatSettings]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `${configWelcomeTitle}\n\n${description[language] || description.vi}`,
        },
      ]);
    }
  }, [isOpen, language, configWelcomeTitle, description]);

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
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch('/api/chat-with-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatBody),
        });

        const data = await response.json();
        
        if (data.success) {
          const assistantMsgId = `assistant-${Date.now()}`;
          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: data.data?.response || data.response || data.message || 'Đã xảy ra lỗi.',
            confidence: data.confidence || 0.5,
          }]);
        } else {
          const assistantMsgId = `assistant-${Date.now()}`;
          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: data.error || 'Đã xảy ra lỗi. Vui lòng thử lại.',
          }]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.',
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

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={clsx(
            'fixed bottom-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110',
            'text-white font-bold text-xl border-2 border-white/20'
          )}
          style={{ 
            backgroundColor: configPrimaryColor,
            [positionProp === 'bottom-right' ? 'right' : 'left']: '24px'
          }}
        >
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={clsx(
            'fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all',
            'border border-gray-200',
            isMinimized ? 'w-16 h-16' : 'w-[380px] h-[600px]'
          )}
          style={{
            [positionProp === 'bottom-right' ? 'right' : 'left']: '24px',
            bottom: '24px',
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
                  <p className="text-xs text-white/80">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {configAllowLanguageSwitch && (
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                    title="Change language"
                  >
                    <span className="text-sm">{currentLang.flag}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
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
              {LANGUAGES.map((lang) => (
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
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Restore Button */}
          {isMinimized && (
            <button
              onClick={() => setIsMinimized(false)}
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: configPrimaryColor }}
            >
              <span className="text-white text-2xl">💬</span>
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
                          title="Copy"
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
                        <span className="text-sm">Đang trả lời...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
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
                            <span className="text-sm">Hình ảnh</span>
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
                            <span className="text-sm">Tài liệu</span>
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
                      placeholder="Nhập tin nhắn..."
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0"
                      style={{ focusRing: `${configPrimaryColor}40` }}
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
