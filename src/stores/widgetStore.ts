import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/types';

export interface WidgetConfig {
  // Basic settings
  botName: string;
  botNameEn: string;
  botNameAr: string;
  botNameFr: string;
  
  // Appearance
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  showBranding: boolean;
  
  // Behavior
  defaultLanguage: Language;
  allowFileUpload: boolean;
  allowLanguageSwitch: boolean;
  
  // Welcome message
  welcomeTitle: string;
  welcomeTitleEn: string;
  welcomeTitleAr: string;
  welcomeTitleFr: string;
  
  // Advanced
  customCss: string;
  apiKeyRequired: boolean;
  allowedDomains: string[];
}

interface WidgetSettingsState {
  config: WidgetConfig;
  isLoading: boolean;
  
  // Actions
  loadConfig: () => Promise<void>;
  updateConfig: (config: Partial<WidgetConfig>) => void;
  saveConfig: () => Promise<void>;
  resetConfig: () => void;
  generateEmbedCode: (type: 'iframe' | 'script') => string;
  generateWidgetScript: () => string;
}

// Default widget configuration
const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  botName: 'MADA AI',
  botNameEn: 'MADA AI',
  botNameAr: 'MADA AI',
  botNameFr: 'MADA AI',
  
  primaryColor: '#0891b2',
  position: 'bottom-right',
  showBranding: true,
  
  defaultLanguage: 'vi',
  allowFileUpload: true,
  allowLanguageSwitch: true,
  
  welcomeTitle: 'Xin chào! Mình là MADA AI.',
  welcomeTitleEn: 'Hello! I am MADA AI.',
  welcomeTitleAr: 'مرحباً! أنا MADA AI.',
  welcomeTitleFr: 'Bonjour! Je suis MADA AI.',
  
  customCss: '',
  apiKeyRequired: false,
  allowedDomains: [],
};

export const useWidgetSettingsStore = create<WidgetSettingsState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_WIDGET_CONFIG },
      isLoading: false,

      loadConfig: async () => {
        set({ isLoading: true });
        try {
          // Try to load from API first
          const res = await fetch('/api/widget/config');
          
          // If API fails (404, 500, etc.), fall back to persisted state or defaults
          if (!res.ok) {
            console.warn('Widget config API returned', res.status, '- using defaults');
            set({ isLoading: false });
            return;
          }
          
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            console.warn('Widget config API returned invalid JSON - using defaults');
            set({ isLoading: false });
            return;
          }
          
          if (data.success && data.data) {
            set({ config: { ...DEFAULT_WIDGET_CONFIG, ...data.data } });
          }
        } catch (e) {
          console.warn('Failed to load widget config from API:', e);
          // Silently fail - store will use default config
        } finally {
          set({ isLoading: false });
        }
      },

      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
      },

      saveConfig: async () => {
        const { config } = get();
        try {
          const token = localStorage.getItem('mada-access-token');
          if (!token) {
            throw new Error('No access token found');
          }

          const res = await fetch('/api/widget/config', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(config),
          });

          // Check if response is OK
          if (!res.ok) {
            const text = await res.text();
            let errorMsg = `Server error: ${res.status}`;
            try {
              const data = JSON.parse(text);
              errorMsg = data.error || errorMsg;
            } catch {
              // Use the text as error message
              errorMsg = text || errorMsg;
            }
            throw new Error(errorMsg);
          }

          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            // If we can't parse JSON but got OK status, consider it success
            return;
          }
          
          if (!data.success) {
            throw new Error(data.error || 'Failed to save widget config');
          }
        } catch (e) {
          console.error('Failed to save widget config:', e);
          throw e;
        }
      },

      resetConfig: () => {
        set({ config: { ...DEFAULT_WIDGET_CONFIG } });
      },

      generateEmbedCode: (type) => {
        const { config } = get();
        const baseUrl = window.location.origin;
        
        if (type === 'iframe') {
          return `<iframe
  src="${baseUrl}/embed"
  width="400"
  height="600"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
  allow="microphone"
  title="${config.botName}"
></iframe>`;
        }
        
        return get().generateWidgetScript();
      },

      generateWidgetScript: () => {
        const { config } = get();
        const baseUrl = window.location.origin;
        
        return `<!-- MADA AI Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['MadaWidget']=o;w[o]=w[o]||function(){
    (w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','mw','${baseUrl}/embed/widget.js'));
  
  mw('init', {
    botName: '${config.botName}',
    primaryColor: '${config.primaryColor}',
    position: '${config.position}',
    defaultLanguage: '${config.defaultLanguage}',
    allowFileUpload: ${config.allowFileUpload},
    allowLanguageSwitch: ${config.allowLanguageSwitch}
  });
</script>`;
      },
    }),
    {
      name: 'mada-widget-settings',
      onRehydrateStorage: () => (state) => {
        // Handle potential storage errors gracefully
        if (state) {
          // Ensure config has all required fields
          const missingFields = Object.keys(DEFAULT_WIDGET_CONFIG).filter(
            key => !(key in state.config)
          );
          if (missingFields.length > 0) {
            console.warn('Widget config missing fields:', missingFields);
            state.config = { ...DEFAULT_WIDGET_CONFIG, ...state.config };
          }
        }
      },
    }
  )
);
