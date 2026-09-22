import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmbedWidget } from '@/components/widget/EmbedWidget';
import type { Language } from '@/types';

// Simple language store subscription for reactivity
import { useLanguageStore } from '@/stores';

// Translation helper - just to subscribe to language changes
const useWidgetTranslation = () => {
  useLanguageStore((s) => s.language ?? 'vi');
};

// Default config từ backend
interface WidgetConfigFromAPI {
  botName?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  defaultLanguage?: Language;
  allowFileUpload?: boolean;
  allowLanguageSwitch?: boolean;
  welcomeTitle?: string;
  widgetType?: 'popup' | 'embedded' | 'floating';
  chatBubbleEnabled?: boolean;
  chatBubbleIcon?: string;
  showLabel?: boolean;
  labelPosition?: 'bottom' | 'top';
  labelName?: string;
  labelColor?: string;
  allowFaq?: boolean;
}

export function WidgetPage() {
  useWidgetTranslation(); // Subscribe to language changes for reactivity
  const [searchParams] = useSearchParams();
  const [configFromAPI, setConfigFromAPI] = useState<WidgetConfigFromAPI | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Get configuration from URL params or defaults từ API
  const botName = searchParams.get('botName') || configFromAPI?.botName || undefined;
  const primaryColor = searchParams.get('primaryColor') || configFromAPI?.primaryColor || undefined;
  const position = (searchParams.get('position') as 'bottom-right' | 'bottom-left') || configFromAPI?.position || undefined;
  const defaultLanguage = (searchParams.get('lang') as Language) || configFromAPI?.defaultLanguage || undefined;
  const allowFileUpload = searchParams.get('allowFileUpload') !== 'false' && (configFromAPI?.allowFileUpload !== false);
  const allowLanguageSwitch = searchParams.get('allowLanguageSwitch') !== 'false' && (configFromAPI?.allowLanguageSwitch !== false);
  const apiKey = searchParams.get('apiKey') || undefined;
  const welcomeTitle = searchParams.get('welcomeTitle') || configFromAPI?.welcomeTitle || undefined;
  
  // New widget settings
  const widgetType = (searchParams.get('widgetType') as 'popup' | 'embedded' | 'floating') || configFromAPI?.widgetType || undefined;
  const chatBubbleEnabled = searchParams.get('chatBubbleEnabled') !== 'false' && (configFromAPI?.chatBubbleEnabled !== false);
  const chatBubbleIcon = searchParams.get('chatBubbleIcon') || configFromAPI?.chatBubbleIcon || undefined;
  const showLabel = searchParams.get('showLabel') !== 'false' && (configFromAPI?.showLabel !== false);
  const labelPosition = (searchParams.get('labelPosition') as 'bottom' | 'top') || configFromAPI?.labelPosition || undefined;
  const labelName = searchParams.get('labelName') || configFromAPI?.labelName || undefined;
  const labelColor = searchParams.get('labelColor') || configFromAPI?.labelColor || undefined;
  const allowFaq = searchParams.get('allowFaq') !== 'false' && (configFromAPI?.allowFaq !== false);

  // Load config từ API
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/widget/config');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setConfigFromAPI(data.data);
          }
        }
      } catch (e) {
        console.warn('Failed to load widget config:', e);
      } finally {
        setConfigLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Remove default styles for embed
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
  }, []);

  // Show loading state while fetching config
  if (configLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-sky-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Đang tải cấu hình...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen">
      <EmbedWidget
        botName={botName}
        primaryColor={primaryColor}
        position={position}
        defaultLanguage={defaultLanguage}
        allowFileUpload={allowFileUpload}
        allowLanguageSwitch={allowLanguageSwitch}
        apiKey={apiKey}
        welcomeTitle={welcomeTitle}
        widgetType={widgetType}
        chatBubbleEnabled={chatBubbleEnabled}
        chatBubbleIcon={chatBubbleIcon}
        showLabel={showLabel}
        labelPosition={labelPosition}
        labelName={labelName}
        labelColor={labelColor}
        allowFaq={allowFaq}
      />
    </div>
  );
}

export default WidgetPage;
