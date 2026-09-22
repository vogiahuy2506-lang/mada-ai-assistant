import { create } from 'zustand';
import { getAccessToken, validateLocalToken, clearTokens } from '@/lib/api';

// Permission types
export type Permission =
  | 'users:read' | 'users:create' | 'users:update' | 'users:delete' | 'users:manage_roles'
  | 'kb:read' | 'kb:create' | 'kb:update' | 'kb:delete' | 'kb:publish' | 'kb:import' | 'kb:export'
  | 'products:read' | 'products:create' | 'products:update' | 'products:delete' | 'products:approve' | 'products:import' | 'products:export'
  | 'agents:read' | 'agents:create' | 'agents:update' | 'agents:delete' | 'agents:configure' | 'agents:view_logs'
  | 'prompts:read' | 'prompts:create' | 'prompts:update' | 'prompts:delete' | 'prompts:publish'
  | 'settings:read' | 'settings:update' | 'settings:manage_permissions' | 'settings:manage_plans'
  | 'scrape:read' | 'scrape:create' | 'scrape:execute' | 'scrape:cancel'
  | 'analytics:read' | 'analytics:export'
  | 'audit:read'
  | 'consultations:read' | 'consultations:respond' | 'consultations:delete'
  | 'files:upload' | 'files:delete'
  | 'chat:use' | 'chat:export';

// Feature types for easier checking
export type Feature =
  | 'admin_panel' | 'user_management' | 'kb_management' | 'product_management'
  | 'scraper' | 'analytics' | 'audit_logs' | 'consultations'
  | 'file_upload' | 'chat_export';

// Permission store for caching user permissions
interface PermissionsState {
  effectivePermissions: string[];
  customPermissions: string[];
  deniedPermissions: string[];
  features: Record<Feature, boolean>;
  isLoaded: boolean;
  
  // Actions
  loadPermissions: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasFeature: (feature: Feature) => boolean;
  clear: () => void;
}

export const usePermissionsStore = create<PermissionsState>()((set, get) => ({
  effectivePermissions: [],
  customPermissions: [],
  deniedPermissions: [],
  features: {
    admin_panel: false,
    user_management: false,
    kb_management: false,
    product_management: false,
    scraper: false,
    analytics: false,
    audit_logs: false,
    consultations: false,
    file_upload: false,
    chat_export: false,
  },
  isLoaded: false,
  
  loadPermissions: async () => {
    // Skip if not logged in OR token is locally invalid (prevents 401 errors)
    const tokenCheck = validateLocalToken();
    if (!tokenCheck.valid) {
      set({ 
        effectivePermissions: [], 
        customPermissions: [], 
        deniedPermissions: [], 
        features: {
          admin_panel: false, 
          user_management: false, 
          kb_management: false,
          product_management: false, 
          scraper: false, 
          analytics: false,
          audit_logs: false, 
          consultations: false, 
          file_upload: false, 
          chat_export: false,
        }, 
        isLoaded: false 
      });
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch('/api/permissions/my', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        // Token invalid on server — clear and skip
        clearTokens();
        set({ effectivePermissions: [], customPermissions: [], deniedPermissions: [], isLoaded: false });
        return;
      }
      const data = await res.json();
      if (data.success) {
        const { effectivePermissions, customPermissions, deniedPermissions, features } = data.data;
        set({
          effectivePermissions,
          customPermissions,
          deniedPermissions,
          features,
          isLoaded: true,
        });
      }
    } catch (e) {
      // Network error — silently skip, don't crash
      console.warn('Failed to load permissions:', e);
    }
  },
  
  hasPermission: (permission) => {
    const { effectivePermissions } = get();
    return effectivePermissions.includes(permission);
  },
  
  hasFeature: (feature) => {
    const { features } = get();
    return features[feature] || false;
  },
  
  clear: () => {
    set({
      effectivePermissions: [],
      customPermissions: [],
      deniedPermissions: [],
      features: {
        admin_panel: false,
        user_management: false,
        kb_management: false,
        product_management: false,
        scraper: false,
        analytics: false,
        audit_logs: false,
        consultations: false,
        file_upload: false,
        chat_export: false,
      },
      isLoaded: false,
    });
  },
}));

// Hook for checking permissions - use this inside React components
export function useHasPermission(permission: Permission): boolean {
  return usePermissionsStore((s) => s.effectivePermissions.includes(permission));
}

// Hook for checking features - use this inside React components
export function useHasFeature(feature: Feature): boolean {
  return usePermissionsStore((s) => s.features[feature] || false);
}
