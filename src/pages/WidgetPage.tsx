import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmbedWidget } from '@/components/widget/EmbedWidget';
import type { Language } from '@/types';

export function WidgetPage() {
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
      />
    </div>
  );
}

export default WidgetPage;
