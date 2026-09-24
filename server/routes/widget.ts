import { Router } from 'express';
import db from '../lib/db';
import { authenticate, requireRole } from '../lib/auth';

const router = Router();

// Widget configuration keys stored in system_settings
const WIDGET_CONFIG_KEYS = [
  'widget_bot_name',
  'widget_bot_name_en',
  'widget_bot_name_ar',
  'widget_bot_name_fr',
  'widget_primary_color',
  'widget_position',
  'widget_show_branding',
  'widget_default_language',
  'widget_allow_file_upload',
  'widget_allow_language_switch',
  'widget_welcome_title',
  'widget_welcome_title_en',
  'widget_welcome_title_ar',
  'widget_welcome_title_fr',
  'widget_custom_css',
  'widget_api_key_required',
  'widget_allowed_domains',
  // New widget settings
  'widget_widget_type',
  'widget_chat_bubble_enabled',
  'widget_chat_bubble_icon',
  'widget_show_label',
  'widget_label_position',
  'widget_label_name',
  'widget_label_color',
  'widget_allow_faq',
];

// Helper: convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// GET /api/widget/config — get widget configuration (public)
router.get('/config', (_req, res) => {
  try {
    const placeholders = WIDGET_CONFIG_KEYS.map(() => '?').join(',');
    const settings = db.prepare(`SELECT \`key\`, value FROM system_settings WHERE \`key\` IN (${placeholders})`).all(...WIDGET_CONFIG_KEYS) as any[];

    const result: Record<string, any> = {};
    for (const s of settings) {
      // Strip widget_ prefix, then convert snake_case to camelCase
      const key = snakeToCamel(s.key.replace(/^widget_/, ''));
      const value = s.value;

      // Parse booleans
      if (key === 'showBranding' || key === 'allowFileUpload' || key === 'allowLanguageSwitch' ||
          key === 'apiKeyRequired' || key === 'chatBubbleEnabled' || key === 'showLabel' || key === 'allowFaq') {
        result[key] = value === 'true';
      } else if (key === 'primaryColor') {
        result[key] = value || '#0891b2';
      } else if (key === 'allowedDomains') {
        try {
          result[key] = JSON.parse(value || '[]');
        } catch {
          result[key] = [];
        }
      } else {
        result[key] = value;
      }
    }

    // Apply defaults
    const defaults: Record<string, any> = {
      botName: 'MADA AI',
      primaryColor: '#0891b2',
      position: 'bottom-right',
      showBranding: true,
      defaultLanguage: 'vi',
      allowFileUpload: true,
      allowLanguageSwitch: true,
      widgetType: 'popup',
      chatBubbleEnabled: true,
      chatBubbleIcon: 'chat', // Use ID instead of emoji for consistency
      showLabel: true,
      labelPosition: 'bottom',
      labelName: 'Chat với MADA',
      labelColor: '#0891b2',
      allowFaq: true,
    };

    const config = { ...defaults, ...result };

    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/widget/config — update widget configuration (admin only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.put('/config', authenticate as any, requireRole('admin', 'super_admin') as any, (req: any, res) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO system_settings (\`key\`, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(\`key\`) DO UPDATE SET value = ?, type = ?, description = ?, updated_at = ?
    `);
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = `widget_${key}`;
      
      let type = 'string';
      let strValue = String(value);
      
      if (typeof value === 'boolean') {
        type = 'boolean';
        strValue = String(value);
      } else if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'object') {
        type = 'json';
        strValue = JSON.stringify(value);
      }
      
      stmt.run(dbKey, strValue, type, '', now, strValue, type, '', now);
    }
    
    res.json({ success: true, message: 'Widget configuration updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/widget/embed-code — generate embed code (admin only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.get('/embed-code', authenticate as any, requireRole('admin', 'super_admin') as any, (req: any, res) => {
  try {
    const { type = 'iframe' } = req.query;
    const baseUrl = process.env.PUBLIC_URL || 'https://mada.ai';
    
    // Get current config
    const placeholders = WIDGET_CONFIG_KEYS.map(() => '?').join(',');
    const settings = db.prepare(`SELECT \`key\`, value FROM system_settings WHERE \`key\` IN (${placeholders})`).all(...WIDGET_CONFIG_KEYS) as any[];
    
    const config: Record<string, any> = {};
    for (const s of settings) {
      config[s.key.replace('widget_', '')] = s.value;
    }
    
    const botName = config.botName || 'MADA AI';
    const primaryColor = config.primaryColor || '#0891b2';
    const position = config.position || 'bottom-right';
    const defaultLanguage = config.defaultLanguage || 'vi';
    const allowFileUpload = config.allowFileUpload !== 'false';
    const allowLanguageSwitch = config.allowLanguageSwitch !== 'false';
    
    if (type === 'iframe') {
      const iframeCode = `<iframe
  src="${baseUrl}/embed?botName=${encodeURIComponent(botName)}&primaryColor=${encodeURIComponent(primaryColor)}&position=${position}&lang=${defaultLanguage}&allowFileUpload=${allowFileUpload}&allowLanguageSwitch=${allowLanguageSwitch}"
  width="380"
  height="600"
  style="border: none; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
  allow="microphone"
  title="${botName}"
></iframe>`;
      
      res.json({
        success: true,
        data: {
          type: 'iframe',
          code: iframeCode,
        },
      });
    } else {
      // JavaScript Widget
      const scriptCode = `<!-- ${botName} - Chat Widget -->
<!-- Copy and paste this code into your website's <body> tag -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/embed/widget.js';
    script.async = true;
    document.head.appendChild(script);
    
    script.onload = function() {
      if (window.MadaWidget) {
        window.MadaWidget('init', {
          botName: '${botName}',
          primaryColor: '${primaryColor}',
          position: '${position}',
          defaultLanguage: '${defaultLanguage}',
          allowFileUpload: ${allowFileUpload},
          allowLanguageSwitch: ${allowLanguageSwitch}
        });
      }
    };
  })();
</script>`;
      
      res.json({
        success: true,
        data: {
          type: 'script',
          code: scriptCode,
        },
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
