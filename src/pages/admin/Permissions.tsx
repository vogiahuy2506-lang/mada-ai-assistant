/**
 * Permissions Management Page - MADA AI Assistant
 * 
 * Trang quản lý phân quyền cho Admin/Super Admin
 */

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken, getRefreshToken, type UserPermissions } from '../../lib/api';
import { useAuthStore, useLanguageStore, type Permission } from '@/stores';
import clsx from 'clsx';
import {
  Shield, ShieldCheck, Key, Users, Package, 
  Loader2, Save, RotateCcw, X, ChevronDown, ChevronUp,
  AlertTriangle
} from 'lucide-react';

type TabType = 'users' | 'roles' | 'plans';
type Language = 'vi' | 'en' | 'ar' | 'fr';

// ============== TRANSLATIONS ==============
const permissionsTranslations: Record<string, Record<Language, string>> = {
  // Header
  'permissions.title': { vi: 'Quản lý Phân quyền', en: 'Permissions Management', ar: 'إدارة الأذونات', fr: 'Gestion des autorisations' },
  'permissions.subtitle': { vi: 'Cấu hình permissions cho roles, plans và users', en: 'Configure permissions for roles, plans and users', ar: 'تكوين الأذونات للأدوار والخطط والمستخدمين', fr: 'Configurer les autorisations pour les rôles, plans et utilisateurs' },

  // Tabs
  'permissions.tab.users': { vi: 'User Permissions', en: 'User Permissions', ar: 'أذونات المستخدم', fr: 'Autorisations utilisateur' },
  'permissions.tab.roles': { vi: 'Role Permissions', en: 'Role Permissions', ar: 'أذونات الدور', fr: 'Autorisations de rôle' },
  'permissions.tab.plans': { vi: 'Plan Permissions', en: 'Plan Permissions', ar: 'أذونات الخطة', fr: 'Autorisations du plan' },

  // User Permissions Tab
  'permissions.selectUser': { vi: 'Chọn User', en: 'Select User', ar: 'اختر المستخدم', fr: 'Sélectionner un utilisateur' },
  'permissions.enterUserId': { vi: 'Nhập user ID...', en: 'Enter user ID...', ar: 'أدخل معرف المستخدم...', fr: 'Entrez l\'ID utilisateur...' },
  'permissions.userInfo': { vi: 'Thông tin User', en: 'User Info', ar: 'معلومات المستخدم', fr: 'Info utilisateur' },
  'permissions.role': { vi: 'Role', en: 'Role', ar: 'الدور', fr: 'Rôle' },
  'permissions.plan': { vi: 'Plan', en: 'Plan', ar: 'الخطة', fr: 'Plan' },
  'permissions.rolePermissions': { vi: 'Role Permissions', en: 'Role Permissions', ar: 'أذونات الدور', fr: 'Autorisations de rôle' },
  'permissions.customPermissions': { vi: 'Custom Permissions', en: 'Custom Permissions', ar: 'أذونات مخصصة', fr: 'Autorisations personnalisées' },
  'permissions.saveChanges': { vi: 'Lưu thay đổi', en: 'Save changes', ar: 'حفظ التغييرات', fr: 'Enregistrer les modifications' },
  'permissions.default': { vi: 'Default', en: 'Default', ar: 'افتراضي', fr: 'Par défaut' },
  'permissions.granted': { vi: 'Granted', en: 'Granted', ar: 'ممنوح', fr: 'Accordé' },
  'permissions.denied': { vi: 'Denied', en: 'Denied', ar: 'مرفوض', fr: 'Refusé' },
  'permissions.permissions': { vi: 'permissions', en: 'permissions', ar: 'أذونات', fr: 'autorisations' },

  // Super Admin Warning
  'permissions.superAdminRequired': { vi: 'Cần quyền Super Admin', en: 'Super Admin Required', ar: 'مطلوب مشرف أعلى', fr: 'Super Admin requis' },
  'permissions.superAdminEditRoles': { vi: 'Chỉ Super Admin mới có thể chỉnh sửa role permissions.', en: 'Only Super Admin can edit role permissions.', ar: 'فقط المشرف الأعلى يمكنه تحرير أذونات الدور.', fr: 'Seul le Super Admin peut modifier les autorisations de rôle.' },
  'permissions.superAdminEditPlans': { vi: 'Chỉ Super Admin mới có thể chỉnh sửa plan permissions.', en: 'Only Super Admin can edit plan permissions.', ar: 'فقط المشرف الأعلى يمكنه تحرير أذونات الخطة.', fr: 'Seul le Super Admin peut modifier les autorisations du plan.' },

  // Actions
  'permissions.reset': { vi: 'Reset', en: 'Reset', ar: 'إعادة تعيين', fr: 'Réinitialiser' },
  'permissions.save': { vi: 'Lưu', en: 'Save', ar: 'حفظ', fr: 'Enregistrer' },

  // Group names
  'permissions.group.users': { vi: 'Người dùng', en: 'Users', ar: 'المستخدمين', fr: 'Utilisateurs' },
  'permissions.group.knowledgeBase': { vi: 'Knowledge Base', en: 'Knowledge Base', ar: 'قاعدة المعرفة', fr: 'Base de connaissances' },
  'permissions.group.products': { vi: 'Sản phẩm', en: 'Products', ar: 'المنتجات', fr: 'Produits' },

  // Error messages
  'permissions.error.requestInterrupted': { vi: 'Yêu cầu bị gián đoạn. Vui lòng thử lại.', en: 'Request interrupted. Please try again.', ar: 'انقطع الطلب. يرجى المحاولة مرة أخرى.', fr: 'Demande interrompue. Veuillez réessayer.' },
  'permissions.error.sessionExpired': { vi: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', en: 'Session expired. Please login again.', ar: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.', fr: 'Session expirée. Veuillez vous reconnecter.' },
  'permissions.error.noPermission': { vi: 'Bạn không có quyền thực hiện hành động này.', en: 'You do not have permission to perform this action.', ar: 'ليس لديك إذن لتنفيذ هذا الإجراء.', fr: 'Vous n\'avez pas la permission d\'effectuer cette action.' },
  'permissions.error.server': { vi: 'Lỗi máy chủ', en: 'Server error', ar: 'خطأ الخادم', fr: 'Erreur serveur' },

  // Success messages
  'permissions.success.roleSaved': { vi: 'Đã lưu permissions cho role "{role}"', en: 'Saved permissions for role "{role}"', ar: 'تم حفظ الأذونات للدور "{role}"', fr: 'Autorisations enregistrées pour le rôle "{role}"' },
  'permissions.success.planSaved': { vi: 'Đã lưu permissions cho plan "{plan}"', en: 'Saved permissions for plan "{plan}"', ar: 'تم حفظ الأذونات للخطة "{plan}"', fr: 'Autorisations enregistrées pour le plan "{plan}"' },
  'permissions.success.userSaved': { vi: 'Đã lưu permissions cho user', en: 'Saved permissions for user', ar: 'تم حفظ الأذونات للمستخدم', fr: 'Autorisations enregistrées pour l\'utilisateur' },
  'permissions.success.roleReset': { vi: 'Đã reset role "{role}" về mặc định', en: 'Reset role "{role}" to default', ar: 'تمت إعادة تعيين الدور "{role}" إلى الافتراضي', fr: 'Rôle "{role}" réinitialisé par défaut' },
  'permissions.success.planReset': { vi: 'Đã reset plan "{plan}" về mặc định', en: 'Reset plan "{plan}" to default', ar: 'تمت إعادة تعيين الخطة "{plan}" إلى الافتراضي', fr: 'Plan "{plan}" réinitialisé par défaut' },
};

// ============== TRANSLATION HELPER ==============
const tPerm = (key: string, lang: Language = 'vi', replacements?: Record<string, string>): string => {
  let text = permissionsTranslations[key]?.[lang] || permissionsTranslations[key]?.['vi'] || key;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
};

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<{ key: string; permissions: string[] }[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [planPermissions, setPlanPermissions] = useState<Record<string, string[]>>({});
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [userCustomPerms, setUserCustomPerms] = useState<{ granted: string[]; denied: string[] }>({ granted: [], denied: [] });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set<string>());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { language } = useLanguageStore();

  // Update expanded groups when language changes
  useEffect(() => {
    const lang = (language || 'vi') as Language;
    setExpandedGroups(new Set([
      tPerm('permissions.group.users', lang),
      tPerm('permissions.group.knowledgeBase', lang),
      tPerm('permissions.group.products', lang),
    ]));
  }, [language]);

  // ─── Auth helper ───
  const adminFetch = useCallback(async (path: string, init: RequestInit = {}, retry = true): Promise<any> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> || {}),
    };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`/api${path}`, { ...init, headers });
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message === 'Failed to fetch' || err instanceof TypeError) {
        throw new Error(tPerm('permissions.error.requestInterrupted', language as Language));
      }
      throw err;
    }

    if (res.status === 401 && retry && getRefreshToken()) {
      let refreshRes: Response;
      try {
        refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: getRefreshToken() }),
        });
      } catch (err: any) {
        localStorage.removeItem('mada-access-token');
        localStorage.removeItem('mada-refresh-token');
        throw new Error(tPerm('permissions.error.sessionExpired', language as Language));
      }
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.success) {
          localStorage.setItem('mada-access-token', data.data.accessToken);
          localStorage.setItem('mada-refresh-token', data.data.refreshToken);
          return adminFetch(path, init, false);
        }
      }
      localStorage.removeItem('mada-access-token');
      localStorage.removeItem('mada-refresh-token');
      throw new Error(tPerm('permissions.error.sessionExpired', language as Language));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = data.error || `${tPerm('permissions.error.server', language as Language)} ${res.status}`;
      if (res.status === 403) msg = tPerm('permissions.error.noPermission', language as Language);
      throw new Error(msg);
    }
    return data;
  }, [language]);

  // ─── Load permissions data ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, rolesRes, plansRes] = await Promise.all([
        adminFetch('/permissions/list'),
        adminFetch('/permissions/roles'),
        adminFetch('/permissions/plans'),
      ]);

      if (listRes.success) {
        setPermissions(listRes.data.permissions);
        setGroups(listRes.data.groups);
      }

      if (rolesRes.success) {
        setRolePermissions(rolesRes.data);
      }

      if (plansRes.success) {
        setPlanPermissions(plansRes.data);
      }
    } catch (e) {
      console.error('Load permissions error:', e);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Load user permissions ───
  const loadUserPermissions = useCallback(async (userId: string) => {
    if (!userId) {
      setUserPermissions(null);
      return;
    }

    try {
      const res = await adminFetch(`/permissions/user/${userId}`);
      if (res.success) {
        setUserPermissions(res.data);
        setUserCustomPerms({
          granted: res.data.customPermissions || [],
          denied: res.data.deniedPermissions || [],
        });
      }
    } catch (e) {
      console.error('Load user permissions error:', e);
    }
  }, [adminFetch]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserPermissions(selectedUserId);
    }
  }, [selectedUserId, loadUserPermissions]);

  // ─── Toggle permission ───
  const togglePermission = (permKey: string, _type: 'role' | 'plan' | 'user', key: string) => {
    setRolePermissions(prev => {
      const current = prev[key] || [];
      if (current.includes(permKey)) {
        return { ...prev, [key]: current.filter(p => p !== permKey) };
      }
      return { ...prev, [key]: [...current, permKey] };
    });
  };

  const toggleUserPermission = (permKey: string, action: 'grant' | 'deny') => {
    setUserCustomPerms(prev => {
      if (action === 'grant') {
        const newDenied = prev.denied.filter(p => p !== permKey);
        if (prev.granted.includes(permKey)) {
          return { granted: prev.granted.filter(p => p !== permKey), denied: newDenied };
        }
        return { granted: [...prev.granted, permKey], denied: newDenied };
      } else {
        const newGranted = prev.granted.filter(p => p !== permKey);
        if (prev.denied.includes(permKey)) {
          return { granted: newGranted, denied: prev.denied.filter(p => p !== permKey) };
        }
        return { granted: newGranted, denied: [...prev.denied, permKey] };
      }
    });
  };

  // ─── Save changes ───
  const saveRolePermissions = async (role: string) => {
    setSaving(true);
    try {
      await adminFetch(`/permissions/roles/${role}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: rolePermissions[role] || [] }),
      });
      setMessage({ type: 'success', text: tPerm('permissions.success.roleSaved', language as Language, { role }) });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const savePlanPermissions = async (plan: string) => {
    setSaving(true);
    try {
      await adminFetch(`/permissions/plans/${plan}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: planPermissions[plan] || [] }),
      });
      setMessage({ type: 'success', text: tPerm('permissions.success.planSaved', language as Language, { plan }) });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const saveUserPermissions = async (userId: string) => {
    setSaving(true);
    try {
      await adminFetch(`/permissions/user/${userId}/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          grant: userCustomPerms.granted,
          deny: userCustomPerms.denied,
          remove: [],
        }),
      });
      setMessage({ type: 'success', text: tPerm('permissions.success.userSaved', language as Language) });
      loadUserPermissions(userId);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async (role: string) => {
    setSaving(true);
    try {
      await adminFetch(`/permissions/roles/${role}/reset`, { method: 'POST' });
      await loadData();
      setMessage({ type: 'success', text: tPerm('permissions.success.roleReset', language as Language, { role }) });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const resetPlan = async (plan: string) => {
    setSaving(true);
    try {
      await adminFetch(`/permissions/plans/${plan}/reset`, { method: 'POST' });
      await loadData();
      setMessage({ type: 'success', text: tPerm('permissions.success.planReset', language as Language, { plan }) });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle group expansion ───
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // ─── Get permission info ───
  const getPermLabel = (permKey: string) => {
    const perm = permissions.find(p => p.key === permKey);
    return perm?.label || permKey;
  };

  // ─── Render ───
  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-800 border-red-300',
    admin: 'bg-orange-100 text-orange-800 border-orange-300',
    data_manager: 'bg-blue-100 text-blue-800 border-blue-300',
    expert: 'bg-green-100 text-green-800 border-green-300',
    user: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    data_manager: 'Data Manager',
    expert: 'Expert',
    user: 'User',
  };

  const planColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800 border-gray-300',
    pro: 'bg-purple-100 text-purple-800 border-purple-300',
    enterprise: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  const planLabels: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">{tPerm('permissions.title', language as Language)}</h1>
              <p className="text-sm text-on-surface-variant">{tPerm('permissions.subtitle', language as Language)}</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={clsx(
            'mb-6 p-4 rounded-xl flex items-center gap-3',
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          )}>
            {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-outline-variant">
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              'px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Users className="w-4 h-4" />
            {tPerm('permissions.tab.users', language as Language)}
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={clsx(
              'px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === 'roles' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Shield className="w-4 h-4" />
            {tPerm('permissions.tab.roles', language as Language)}
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={clsx(
              'px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === 'plans' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Package className="w-4 h-4" />
            {tPerm('permissions.tab.plans', language as Language)}
          </button>
        </div>

        {/* User Permissions Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-surface-variant/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {tPerm('permissions.selectUser', language as Language)}
              </h3>
              <input
                type="text"
                placeholder={tPerm('permissions.enterUserId', language as Language)}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full max-w-md px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface"
              />
            </div>

            {userPermissions && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-surface-variant/30 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4">{tPerm('permissions.userInfo', language as Language)}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-on-surface-variant">{tPerm('permissions.role', language as Language)}</p>
                      <span className={clsx('inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border', roleColors[userPermissions.role])}>
                        {roleLabels[userPermissions.role] || userPermissions.role}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-on-surface-variant">{tPerm('permissions.plan', language as Language)}</p>
                      <span className={clsx('inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border', planColors[userPermissions.plan])}>
                        {planLabels[userPermissions.plan] || userPermissions.plan}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-on-surface-variant">{tPerm('permissions.rolePermissions', language as Language)}</p>
                      <p className="mt-1 font-semibold">{userPermissions.effectivePermissions?.length || 0} {tPerm('permissions.permissions', language as Language)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-on-surface-variant">{tPerm('permissions.customPermissions', language as Language)}</p>
                      <p className="mt-1 font-semibold">
                        <span className="text-green-600">{userCustomPerms.granted.length} {tPerm('permissions.granted', language as Language)}</span>
                        {' / '}
                        <span className="text-red-600">{userCustomPerms.denied.length} {tPerm('permissions.denied', language as Language)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Permission Groups */}
                <div className="bg-surface-variant/30 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      {tPerm('permissions.customPermissions', language as Language)}
                    </h3>
                    <button
                      onClick={() => saveUserPermissions(selectedUserId)}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl bg-primary text-white font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {tPerm('permissions.saveChanges', language as Language)}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {groups.map(group => (
                      <div key={group.key} className="border border-outline rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleGroup(group.key)}
                          className="w-full px-4 py-3 bg-surface-variant/50 flex items-center justify-between hover:bg-surface-variant/70 transition-colors"
                        >
                          <span className="font-medium">{group.key}</span>
                          {expandedGroups.has(group.key) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                        {expandedGroups.has(group.key) && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.permissions.map(permKey => {
                              const isGranted = userCustomPerms.granted.includes(permKey);
                              const isDenied = userCustomPerms.denied.includes(permKey);
                              const isDefault = userPermissions.effectivePermissions?.includes(permKey);

                              return (
                                <div
                                  key={permKey}
                                  className={clsx(
                                    'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
                                    isGranted ? 'bg-green-50 border-green-200' : isDenied ? 'bg-red-50 border-red-200' : isDefault ? 'bg-blue-50 border-blue-200' : 'bg-surface border-outline hover:bg-surface-variant'
                                  )}
                                  onClick={() => toggleUserPermission(permKey, isGranted ? 'deny' : 'grant')}
                                >
                                  <div>
                                    <p className="font-medium text-sm">{getPermLabel(permKey)}</p>
                                    <p className="text-xs text-on-surface-variant">{permKey}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isDefault && !isGranted && !isDenied && (
                                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{tPerm('permissions.default', language as Language)}</span>
                                    )}
                                    {isGranted && (
                                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">{tPerm('permissions.granted', language as Language)}</span>
                                    )}
                                    {isDenied && (
                                      <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">{tPerm('permissions.denied', language as Language)}</span>
                                    )}
                                    <ShieldCheck className={clsx('w-4 h-4', isGranted ? 'text-green-600' : isDenied ? 'text-red-600' : 'text-gray-400')} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Role Permissions Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {!isSuperAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{tPerm('permissions.superAdminRequired', language as Language)}</p>
                  <p className="text-sm text-yellow-700">{tPerm('permissions.superAdminEditRoles', language as Language)}</p>
                </div>
              </div>
            )}

            {Object.entries(rolePermissions).map(([role, perms]) => (
              <div key={role} className="bg-surface-variant/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={clsx('px-3 py-1 rounded-full text-sm font-medium border', roleColors[role])}>
                      {roleLabels[role] || role}
                    </span>
                    <span className="text-sm text-on-surface-variant">{perms?.length || 0} {tPerm('permissions.permissions', language as Language)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resetRole(role)}
                      disabled={saving || !isSuperAdmin}
                      className="px-3 py-1.5 rounded-lg border border-outline text-sm font-medium flex items-center gap-1 hover:bg-surface-variant disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {tPerm('permissions.reset', language as Language)}
                    </button>
                    <button
                      onClick={() => saveRolePermissions(role)}
                      disabled={saving || !isSuperAdmin}
                      className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-1 hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {tPerm('permissions.save', language as Language)}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {permissions.map(perm => {
                    const isActive = perms?.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={clsx(
                          'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
                          isActive ? 'bg-primary/10 border-primary/30' : 'bg-surface border-outline hover:bg-surface-variant'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isActive || false}
                          onChange={() => isSuperAdmin && togglePermission(perm.key, 'role', role)}
                          disabled={!isSuperAdmin}
                          className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{perm.label}</p>
                          <p className="text-xs text-on-surface-variant truncate">{perm.group}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plan Permissions Tab */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {!isSuperAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{tPerm('permissions.superAdminRequired', language as Language)}</p>
                  <p className="text-sm text-yellow-700">{tPerm('permissions.superAdminEditPlans', language as Language)}</p>
                </div>
              </div>
            )}

            {Object.entries(planPermissions).map(([plan, perms]) => (
              <div key={plan} className="bg-surface-variant/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={clsx('px-3 py-1 rounded-full text-sm font-medium border', planColors[plan])}>
                      {planLabels[plan] || plan}
                    </span>
                    <span className="text-sm text-on-surface-variant">{perms?.length || 0} {tPerm('permissions.permissions', language as Language)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resetPlan(plan)}
                      disabled={saving || !isSuperAdmin}
                      className="px-3 py-1.5 rounded-lg border border-outline text-sm font-medium flex items-center gap-1 hover:bg-surface-variant disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {tPerm('permissions.reset', language as Language)}
                    </button>
                    <button
                      onClick={() => savePlanPermissions(plan)}
                      disabled={saving || !isSuperAdmin}
                      className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-1 hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {tPerm('permissions.save', language as Language)}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {permissions.map(perm => {
                    const isActive = perms?.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={clsx(
                          'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
                          isActive ? 'bg-primary/10 border-primary/30' : 'bg-surface border-outline hover:bg-surface-variant'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isActive || false}
                          onChange={() => isSuperAdmin && togglePermission(perm.key, 'plan', plan)}
                          disabled={!isSuperAdmin}
                          className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{perm.label}</p>
                          <p className="text-xs text-on-surface-variant truncate">{perm.group}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
