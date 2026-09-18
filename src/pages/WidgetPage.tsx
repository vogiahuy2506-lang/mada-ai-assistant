import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmbedWidget } from '@/components/widget/EmbedWidget';
import { useLanguageStore } from '@/stores';
import type { Language } from '@/types';
import { translations } from '@/lib/translations';

// Translation helper function using useLanguageStore
const useTranslation = () => {
  const language = useLanguageStore((state) => state.language) as Language;
  return (key: string): string => {
    return translations[language]?.[key] || translations.vi[key] || key;
  };
};

export function WidgetPage() {
  const t = useTranslation();
  const [searchParams] = useSearchParams();
  
  // Get configuration from URL params or defaults
  const botName = searchParams.get('botName') || undefined;
  const primaryColor = searchParams.get('primaryColor') || undefined;
  const position = (searchParams.get('position') as 'bottom-right' | 'bottom-left') || undefined;
  const defaultLanguage = (searchParams.get('lang') as Language) || undefined;
  const allowFileUpload = searchParams.get('allowFileUpload') !== 'false';
  const allowLanguageSwitch = searchParams.get('allowLanguageSwitch') !== 'false';
  const apiKey = searchParams.get('apiKey') || undefined;
  const welcomeTitle = searchParams.get('welcomeTitle') || undefined;
  
  // New widget settings
  const widgetType = (searchParams.get('widgetType') as 'popup' | 'embedded' | 'floating') || undefined;
  const chatBubbleEnabled = searchParams.get('chatBubbleEnabled') !== 'false';
  const chatBubbleIcon = searchParams.get('chatBubbleIcon') || undefined;
  const showLabel = searchParams.get('showLabel') !== 'false';
  const labelPosition = (searchParams.get('labelPosition') as 'bottom' | 'top') || undefined;
  const labelName = searchParams.get('labelName') || undefined;
  const labelColor = searchParams.get('labelColor') || undefined;

  // Remove default styles for embed
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
  }, []);

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
      />
    </div>
  );
}

export default WidgetPage;
