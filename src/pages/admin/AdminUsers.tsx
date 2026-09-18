import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken, getRefreshToken } from '../../lib/api';
import { useAuthStore, useLanguageStore } from '@/stores';
import { useTranslation, Language } from '@/lib/translations';
import clsx from 'clsx';
import {
  Users, Search, Shield, ShieldOff, Trash2,
  CheckCircle2, XCircle, Loader2,
  Mail, Calendar, Clock, UserPlus, Copy, Check, Eye, EyeOff, X,
  KeyRound, RefreshCw, Sparkles, AlertTriangle, ShieldCheck,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'pending' | 'suspended';
  provider: 'email' | 'google';
  quota_used: number;
  quota_limit: number;
  created_at: string;
  last_login_at: string | null;
}

type FilterStatus = 'all' | 'active' | 'pending' | 'suspended';
type FilterRole = 'all' | 'admin' | 'super_admin' | 'user';

interface CreatedUserResult {
  user: { id: string; email: string; name: string; role: string; plan: string };
  tempPassword: string;
  message: string;
}

// ─── Translation helper function ───
function useAdminUsersTranslation() {
  const language = useLanguageStore((state) => state.language);
  const { t } = useTranslation();

  // Get locale code for date formatting
  const getLocale = (): string => {
    switch (language) {
      case 'vi': return 'vi-VN';
      case 'en': return 'en-US';
      case 'ar': return 'ar-SA';
      case 'fr': return 'fr-FR';
      default: return 'en-US';
    }
  };

  // Format date based on current language
  const formatDate = (date: string | null): string => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(getLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return {
    t,
    language,
    formatDate,
    getLocale,
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [totalUsers, setTotalUsers] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check if current user is Super Admin
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { t, language, formatDate } = useAdminUsersTranslation();

  // ─── Auth helper with auto-refresh + friendly error ───
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
        throw new Error(t('admin.users.requestInterrupted'));
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
        throw new Error(t('admin.users.sessionExpired'));
      }
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.success) {
          localStorage.setItem('mada-access-token', data.data.accessToken);
          localStorage.setItem('mada-refresh-token', data.data.refreshToken);
          return adminFetch(path, init, false);
        }
      }
      // Refresh failed → logout
      localStorage.removeItem('mada-access-token');
      localStorage.removeItem('mada-refresh-token');
      throw new Error(t('admin.users.sessionExpired'));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Make Vietnamese error messages friendly
      let msg = data.error || `${t('admin.users.error')} ${res.status}`;
      if (res.status === 401) msg = t('admin.users.sessionExpired');
      if (res.status === 403) msg = t('admin.users.noPermission');
      if (res.status === 409) msg = data.error || t('admin.users.emailExists');
      throw new Error(msg);
    }
    return data;
  }, [t]);

  // ─── Create user modal ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [autoGenPassword, setAutoGenPassword] = useState(true);

  // ─── After-create result modal ───
  const [createdResult, setCreatedResult] = useState<CreatedUserResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ─── Reset password modal ───
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/admin/users');
      if (data.success) {
        let items = data.data || [];

        if (search) {
          const q = search.toLowerCase();
          items = items.filter((u: User) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
          );
        }
        if (filterStatus !== 'all') items = items.filter((u: User) => u.status === filterStatus);
        if (filterRole !== 'all') items = items.filter((u: User) => u.role === filterRole);

        setTotalUsers(items.length);
        setUsers(items.slice(page * pageSize, (page + 1) * pageSize));
      }
    } catch (e) {
      console.error('Load users error:', e);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterRole, page, adminFetch]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(0); }, [search, filterStatus, filterRole]);

  const handleUpdateStatus = async (userId: string, status: 'active' | 'suspended') => {
    setActionLoading(userId);
    try {
      await adminFetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || t('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(t('admin.users.confirmDeleteUser', { name: user.name, email: user.email }))) return;
    if (user.role === 'admin' && !confirm(t('admin.users.confirmDeleteAdmin'))) return;

    setActionLoading(user.id);
    try {
      await adminFetch(`/admin/users/${user.id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || t('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'user') => {
    if (!confirm(t('admin.users.confirmRoleChange', { role }))) return;
    setActionLoading(userId);
    try {
      await adminFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || t('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  // ─── Generate password client-side for preview ───
  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digit = '23456789';
    const all = upper + lower + digit;
    let pwd =
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length)) +
      digit.charAt(Math.floor(Math.random() * digit.length));
    for (let i = 0; i < 9; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  // ─── Create user ───
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError(t('admin.users.nameRequired'));
      return;
    }
    if (!autoGenPassword && createForm.password.length < 6) {
      setCreateError(t('admin.users.pwdMinChars'));
      return;
    }

    setCreateLoading(true);
    try {
      const payload: any = {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
        plan: createForm.plan,
      };
      if (!autoGenPassword) payload.password = createForm.password;

      const data = await adminFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.success) {
        setCreatedResult({
          user: data.data,
          tempPassword: data.data.tempPassword,
          message: data.data.message,
        });
        // Reset form + close create modal
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', role: 'user', plan: 'free' });
        setAutoGenPassword(true);
        await loadUsers();
      } else {
        setCreateError(data.error || t('admin.users.createFailed'));
      }
    } catch (err: any) {
      setCreateError(err.message || t('admin.users.connectionError'));
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Reset password ───
  const handleResetPassword = async (user: User) => {
    if (!confirm(t('admin.users.confirmResetPwd', { name: user.name, email: user.email }))) return;
    setResetTarget(user);
    setResetResult(null);
    setResetLoading(true);
    try {
      const data = await adminFetch(`/admin/users/${user.id}/reset-password`, { method: 'POST' });
      if (data.success) {
        setResetResult({ email: data.data.email, tempPassword: data.data.tempPassword });
      } else {
        alert(data.error || t('admin.users.resetFail'));
        setResetTarget(null);
      }
    } catch (err: any) {
      alert(err.message || t('admin.users.connectionError'));
      setResetTarget(null);
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Copy to clipboard helper ───
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const getStatusBadge = (status: User['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      pending: 'bg-amber-100 text-amber-700 border-amber-300',
      suspended: 'bg-red-100 text-red-700 border-red-300',
    };
    const labelKeys = {
      active: t('admin.users.activeUsers'),
      pending: t('admin.users.pending'),
      suspended: t('admin.users.locked'),
    };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0', styles[status])}>
        {labelKeys[status]}
      </span>
    );
  };

  const getRoleBadge = (role: User['role']) => (
    <span className={clsx(
      'px-2 py-0.5 rounded-full text-[10px] font-black border-2 border-black whitespace-nowrap shrink-0',
      role === 'super_admin'
        ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white'
        : role === 'admin'
        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
        : 'bg-slate-100 text-slate-600'
    )}>
      {role === 'super_admin' ? t('admin.users.superAdminBadge') : role === 'admin' ? `👑 ${t('admin.users.admin')}` : `👤 ${t('admin.users.staff')}`}
    </span>
  );

  const getPlanBadge = (plan: User['plan']) => {
    const styles = {
      free: 'bg-slate-100 text-slate-600',
      pro: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
    };
    const planLabels = {
      free: t('admin.users.planFree'),
      pro: t('admin.users.planPro'),
      enterprise: t('admin.users.planEnterprise'),
    };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0', styles[plan])}>
        {planLabels[plan]}
      </span>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <AdminLayout
      title={t('admin.users.title')}
      titleEn="User Management"
      titleAr="إدارة المستخدمين"
      titleFr="Gestion des utilisateurs"
      subtitle={t('admin.users.subtitle')}
      subtitleEn="View, lock, delete and create staff accounts in the system."
      subtitleAr="عرض وقفل وحذف وإنشاء حسابات الموظفين في النظام."
      subtitleFr="Voir, verrouiller, supprimer et créer des comptes du personnel."
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative gap-4 flex-wrap">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-6 px-6">
            <h2 className="text-3xl md:text-4xl font-black text-on-surface mb-2 tracking-tight">
              {t('admin.users.heroTitle')}
            </h2>
            <p className="text-sm md:text-base font-medium text-on-surface-variant border-l-4 border-primary pl-4 py-1 bg-white/40 backdrop-blur-sm rounded-r-xl"
               dangerouslySetInnerHTML={{ __html: t('admin.users.heroSubtitle') }}
            />
          </div>
          {/* Role Badge + Create User Button */}
          <div className="relative z-10 py-6 px-6 flex items-center gap-3">
            {/* Role Badge */}
            {isSuperAdmin ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-bold text-sm">{t('admin.users.superAdmin')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-bold text-sm">{t('admin.users.admin')}</span>
                <span className="text-xs opacity-70">{t('admin.users.limited')}</span>
              </div>
            )}
            <button
              onClick={() => {
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
            >
              <UserPlus className="w-4 h-4" />
              {t('admin.users.createUser')}
            </button>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={t('admin.users.totalUsers')} value={totalUsers} icon={<Users className="w-5 h-5" />} color="bg-indigo-500" />
        <StatCard
          label={t('admin.users.activeUsers')}
          value={users.filter(u => u.status === 'active').length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="bg-emerald-500"
        />
        <StatCard
          label={t('admin.users.pendingUsers')}
          value={users.filter(u => u.status === 'pending').length}
          icon={<Clock className="w-5 h-5" />}
          color="bg-amber-500"
        />
        <StatCard
          label={t('admin.users.lockedUsers')}
          value={users.filter(u => u.status === 'suspended').length}
          icon={<XCircle className="w-5 h-5" />}
          color="bg-red-500"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-black p-4 mb-4 shadow-[2px_2px_0px_0px_#000]">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-black font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 rounded-lg border-2 border-black font-medium text-sm bg-white"
          >
            <option value="all">{t('admin.users.allStatus')}</option>
            <option value="active">{t('admin.users.active')}</option>
            <option value="pending">{t('admin.users.pending')}</option>
            <option value="suspended">{t('admin.users.locked')}</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as FilterRole)}
            className="px-3 py-2 rounded-lg border-2 border-black font-medium text-sm bg-white"
          >
            <option value="all">{t('admin.users.allRoles')}</option>
            <option value="admin">{t('admin.users.admin')}</option>
            <option value="user">{t('admin.users.user')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-black">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">{t('admin.users.noUsers')}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-black">
                  <tr>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.userCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.statusCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.roleCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.planCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.loginCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.createdCol')}</th>
                    <th className="text-right px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{t('admin.users.actionsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-black">{user.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3">{getPlanBadge(user.plan)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(user.last_login_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'active' ? (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'suspended')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all border-2 border-black disabled:opacity-50"
                              title={t('admin.users.lockAccount')}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all border-2 border-black disabled:opacity-50"
                              title={user.status === 'suspended' ? t('admin.users.unlockAccount') : t('admin.users.approveAccount')}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}

                          {user.role === 'user' ? (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'admin')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all border-2 border-black disabled:opacity-50"
                              title={t('admin.users.promoteToAdmin')}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'user')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border-2 border-black disabled:opacity-50"
                              title={t('admin.users.demoteToUser')}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reset password */}
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={actionLoading === user.id}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all border-2 border-black disabled:opacity-50"
                            title={t('admin.users.resetPassword')}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(user)}
                            disabled={actionLoading === user.id}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all border-2 border-black disabled:opacity-50"
                            title={t('admin.users.deleteAccount')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                ← {t('admin.users.prev')}
              </button>
              <span className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold">
                {t('admin.users.page')} {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                {t('admin.users.next')} →
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ MODAL: Tạo nhân viên ═══════════════ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_#000] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-violet-500 to-blue-500 text-white px-6 py-4 border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-black text-lg">{t('admin.users.createAccountTitle')}</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  {t('admin.users.fullName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder={t('admin.users.namePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-black font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  {t('admin.users.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder={t('admin.users.emailPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-black font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role + Plan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Role {!isSuperAdmin && <span className="text-amber-500 text-[10px]">{t('admin.users.superAdminOnly')}</span>}
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-lg border-2 border-black font-medium text-sm bg-white"
                  >
                    <option value="user">👤 {t('admin.users.staff')}</option>
                    {isSuperAdmin && (
                      <>
                        <option value="admin">👑 {t('admin.users.admin')}</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    {t('admin.users.plan')}
                  </label>
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-lg border-2 border-black font-medium text-sm bg-white"
                  >
                    <option value="free">� {t('admin.users.free')} ({t('admin.users.freeQuota')})</option>
                    <option value="pro">⭐ {t('admin.users.pro')} ({t('admin.users.proQuota')})</option>
                    <option value="enterprise">🏢 {t('admin.users.enterprise')} ({t('admin.users.enterpriseQuota')})</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t('admin.users.password')}
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenPassword}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutoGenPassword(checked);
                        // Khi bật auto-gen: tự sinh MK. Khi tắt: clear để user tự nhập.
                        setCreateForm({
                          ...createForm,
                          password: checked ? generatePassword() : '',
                        });
                        setShowCreatePassword(false);
                      }}
                      className="w-3.5 h-3.5 accent-violet-500"
                    />
                    <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">
                      {t('admin.users.autoGenerate')}
                    </span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={autoGenPassword ? createForm.password : createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder={
                      autoGenPassword
                        ? t('admin.users.autoGenPlaceholder')
                        : t('admin.users.enterManually')
                    }
                    disabled={autoGenPassword}
                    className="w-full px-4 py-2.5 pr-20 rounded-lg border-2 border-black font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="p-1.5 rounded hover:bg-slate-100"
                      tabIndex={-1}
                      title={showCreatePassword ? t('admin.users.hidePassword') : t('admin.users.showPassword')}
                    >
                      {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {autoGenPassword && (
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}
                        className="p-1.5 rounded hover:bg-slate-100"
                        tabIndex={-1}
                        title={t('admin.users.generateNew')}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {autoGenPassword ? (
                  <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    {t('admin.users.autoGenDesc')}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-blue-600 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    {t('admin.users.manualEntryDesc')}
                  </p>
                )}
              </div>

              {createError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border-2 border-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">{createError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-lg border-2 border-black bg-white text-black font-bold text-sm hover:bg-slate-50"
                >
                  {t('admin.users.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white font-bold text-sm border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('admin.users.creating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t('admin.users.create')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: Sau khi tạo thành công - show password ═══════════════ */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_#000] max-w-md w-full">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-black text-lg">{t('admin.users.accountCreatedSuccess')}</h3>
              </div>
              <button
                onClick={() => setCreatedResult(null)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                <p className="text-sm text-emerald-800 font-medium">
                  {createdResult.message}
                </p>
              </div>

              {/* Email + Password blocks */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {t('admin.users.loginEmail')}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg border-2 border-black bg-slate-50 font-mono text-sm font-bold">
                    {createdResult.user.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdResult.user.email, 'email')}
                    className="p-2.5 rounded-lg border-2 border-black bg-white hover:bg-slate-50"
                    title={t('admin.users.titleCopyEmail')}
                  >
                    {copiedField === 'email' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {t('admin.users.tempPassword')}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg border-2 border-black bg-amber-50 font-mono text-sm font-bold text-amber-900">
                    {createdResult.tempPassword}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdResult.tempPassword, 'password')}
                    className="p-2.5 rounded-lg border-2 border-black bg-white hover:bg-slate-50"
                    title={t('admin.users.titleCopyPassword')}
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('admin.users.passwordShownOnce')}
                </p>
              </div>

              {/* Combined copy for chat apps */}
              <button
                onClick={() =>
                  copyToClipboard(
                    t('admin.users.chatTemplate', { email: createdResult.user.email, password: createdResult.tempPassword, url: window.location.origin }),
                    'all'
                  )
                }
                className="w-full py-2.5 rounded-lg border-2 border-black bg-violet-50 hover:bg-violet-100 text-sm font-bold flex items-center justify-center gap-2"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    {t('admin.users.copiedAllInfo')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {t('admin.users.copyForChat')}
                  </>
                )}
              </button>

              <button
                onClick={() => setCreatedResult(null)}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-700"
              >
                {t('admin.users.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: Reset password ═══════════════ */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_0px_#000] max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-4 border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-black text-lg">{t('admin.users.resetPasswordTitle')}</h3>
              </div>
              <button
                onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {resetLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : resetResult ? (
                <>
                  <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      {t('admin.users.newPasswordCreated')} <b>{resetResult.email}</b>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      {t('admin.users.newPassword')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 rounded-lg border-2 border-black bg-amber-50 font-mono text-sm font-bold text-amber-900">
                        {resetResult.tempPassword}
                      </div>
                      <button
                        onClick={() => copyToClipboard(resetResult.tempPassword, 'resetPassword')}
                        className="p-2.5 rounded-lg border-2 border-black bg-white hover:bg-slate-50"
                      >
                        {copiedField === 'resetPassword' ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => { setResetTarget(null); setResetResult(null); }}
                    className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm"
                  >
                    {t('admin.users.close')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border-2 border-black p-4 shadow-[2px_2px_0px_0px_#000]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black text-black">{value}</p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}