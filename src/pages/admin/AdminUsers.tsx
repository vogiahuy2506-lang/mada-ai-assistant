import { useState, useMemo, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { useLanguageStore } from '@/stores';
import clsx from 'clsx';
import { usersApi, type ApiUser } from '@/lib/api';

type UserRole = 'admin' | 'data_manager' | 'expert' | 'user';
type UserStatus = 'active' | 'suspended' | 'pending';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: 'free' | 'pro' | 'enterprise';
  status: UserStatus;
  joinedAt: string;
  lastActive: string;
  quotaUsed: number;
  quotaLimit: number;
}

function fromApiUser(u: ApiUser, lang: string): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    plan: u.plan,
    status: u.status,
    joinedAt: new Date(u.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN'),
    lastActive: u.lastLogin ? new Date(u.lastLogin).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN') : '—',
    quotaUsed: u.quotaUsed,
    quotaLimit: u.quotaLimit,
  };
}

const ROLE_LABELS_VI: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  data_manager: 'Quản lý dữ liệu',
  expert: 'Chuyên gia',
  user: 'Người dùng',
};

const ROLE_LABELS_EN: Record<UserRole, string> = {
  admin: 'Administrator',
  data_manager: 'Data Manager',
  expert: 'Expert',
  user: 'User',
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-error/10 text-error',
  data_manager: 'bg-tertiary/10 text-tertiary',
  expert: 'bg-primary-container/30 text-primary',
  user: 'bg-surface-variant text-on-surface-variant',
};

const STATUS_BADGE: Record<UserStatus, string> = {
  active: 'bg-secondary/10 text-secondary',
  suspended: 'bg-error/10 text-error',
  pending: 'bg-outline/20 text-on-surface-variant',
};

const STATUS_LABELS_VI: Record<UserStatus, string> = {
  active: 'Hoạt động',
  suspended: 'Tạm khóa',
  pending: 'Chờ duyệt',
};

const STATUS_LABELS_EN: Record<UserStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending',
};

export function AdminUsers() {
  const { language } = useLanguageStore();
  const isEn = language === 'en';
  
  const ROLE_LABELS = isEn ? ROLE_LABELS_EN : ROLE_LABELS_VI;
  const STATUS_LABELS = isEn ? STATUS_LABELS_EN : STATUS_LABELS_VI;
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const res = await usersApi.list();
    if (res.success) {
      setUsers(res.data.users.map(u => fromApiUser(u, language)));
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (filterStatus !== 'all' && u.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterStatus]);

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    const res = await usersApi.update(id, { role: newRole });
    if (res.success) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    } else {
      alert(res.error);
    }
  };

  const handleStatusToggle = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const res = await usersApi.update(id, { status: newStatus });
    if (res.success) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)));
    } else {
      alert(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isEn ? 'Delete this user? This cannot be undone.' : 'Xóa người dùng này? Hành động không thể hoàn tác.')) return;
    const res = await usersApi.delete(id);
    if (res.success) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      alert(res.error);
    }
  };

  const handleCreate = async (data: { email: string; password: string; name: string; role: string; plan: string }) => {
    const res = await usersApi.create(data);
    if (res.success) {
      setUsers((prev) => [fromApiUser(res.data.user, language), ...prev]);
      setShowCreate(false);
    } else {
      alert(res.error);
    }
  };

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    pending: users.filter((u) => u.status === 'pending').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };

  return (
    <AdminLayout
      title="Quản lý Người dùng"
      titleEn="User Management"
      subtitle="Quản lý tài khoản, phân quyền và trạng thái của tất cả người dùng trong hệ thống MADA AI."
      subtitleEn="Manage accounts, permissions and status of all users in the MADA AI system."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {isEn ? 'User Management' : 'Quản lý Người dùng'}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {isEn ? 'Manage accounts, permissions and status of all users.' : 'Quản lý tài khoản, phân quyền và trạng thái của tất cả người dùng.'}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TOTAL</p>
            <h3 className="text-xl font-black text-on-surface">{stats.total}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-green-50/80 to-green-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.3deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-green-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">{isEn ? 'ACTIVE' : 'HOẠT ĐỘNG'}</p>
            <h3 className="text-xl font-black text-green-700">{stats.active}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-red-50/80 to-red-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.3deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-red-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-red-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">{isEn ? 'SUSPENDED' : 'TẠM KHÓA'}</p>
            <h3 className="text-xl font-black text-red-700">{stats.suspended}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-yellow-50/80 to-yellow-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-yellow-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-yellow-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1">{isEn ? 'PENDING' : 'CHỜ DUYỆT'}</p>
            <h3 className="text-xl font-black text-yellow-700">{stats.pending}</h3>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-purple-50/80 to-purple-100/40 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-3 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-purple-200 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-purple-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">ADMIN</p>
            <h3 className="text-xl font-black text-purple-700">{stats.admins}</h3>
          </div>
        </div>
      </section>

      {/* Filter & Action Row */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2">{isEn ? 'Filter:' : 'Lọc:'}</span>
          <button
            onClick={() => { setFilterRole('all'); setFilterStatus('all'); }}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              filterRole === 'all' && filterStatus === 'all'
                ? 'bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-white/80 border-transparent hover:border-black transition-colors'
            )}
          >
            {isEn ? 'All' : 'Tất cả'}
          </button>
          <button
            onClick={() => { setFilterRole('admin'); setFilterStatus('all'); }}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              filterRole === 'admin'
                ? 'bg-purple-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-purple-50 border-transparent hover:border-black transition-colors'
            )}
          >
            Admin
          </button>
          <button
            onClick={() => { setFilterRole('all'); setFilterStatus('active'); }}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              filterStatus === 'active'
                ? 'bg-green-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-green-50 border-transparent hover:border-black transition-colors'
            )}
          >
            {isEn ? 'Active' : 'Hoạt động'}
          </button>
          <button
            onClick={() => { setFilterRole('all'); setFilterStatus('suspended'); }}
            className={clsx(
              'px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              filterStatus === 'suspended'
                ? 'bg-red-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-red-50 border-transparent hover:border-black transition-colors'
            )}
          >
            {isEn ? 'Suspended' : 'Tạm khóa'}
          </button>
        </div>
        <div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <span className="material-symbols-outlined">person_add</span>
            {isEn ? 'Create User' : 'Tạo người dùng'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? 'Search by name or email...' : 'Tìm theo tên hoặc email...'}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/60 backdrop-blur-xl border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        
        {loading ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#000] animate-pulse">
              <span className="material-symbols-outlined text-gray-400 text-3xl">hourglass_empty</span>
            </div>
            <p className="text-lg font-bold text-gray-500">{isEn ? 'Loading...' : 'Đang tải dữ liệu...'}</p>
          </div>
        ) : error ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-red-100 border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#000]">
              <span className="material-symbols-outlined text-red-500 text-3xl">cloud_off</span>
            </div>
            <p className="text-lg font-bold text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchUsers}
              className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all"
            >
              {isEn ? 'Retry' : 'Thử lại'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-black flex items-center justify-center mb-6 text-gray-400 transform rotate-[-3deg] hover:rotate-0 transition-all duration-300 shadow-[8px_8px_0px_0px_#000]">
              <span className="material-symbols-outlined text-5xl">search_off</span>
            </div>
            <h4 className="text-2xl font-black text-on-surface mb-2">{isEn ? 'No users found' : 'Không tìm thấy người dùng'}</h4>
            <p className="text-base font-medium text-on-surface-variant text-center max-w-sm">
              {isEn ? 'No users match your filters.' : 'Không có người dùng nào khớp với bộ lọc của bạn.'}
            </p>
          </div>
        ) : (
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{isEn ? 'User' : 'Người dùng'}</th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Plan</th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Quota</th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{isEn ? 'Status' : 'Trạng thái'}</th>
                  <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{isEn ? 'Activity' : 'Hoạt động'}</th>
                  <th className="text-right py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{isEn ? 'Actions' : 'Thao tác'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm border-2 border-black">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className={clsx(
                          'px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black cursor-pointer',
                          ROLE_BADGE[u.role]
                        )}
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 px-4">
                      <span className={clsx(
                        'inline-block px-3 py-1 rounded-full text-xs font-bold border-2 border-black',
                        u.plan === 'enterprise' ? 'bg-primary/20 text-primary' :
                        u.plan === 'pro' ? 'bg-secondary/20 text-secondary' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {u.quotaLimit === -1 ? (
                        <span className="font-bold text-secondary">∞ Unlimited</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden border border-black/20">
                            <div
                              className={clsx('h-full', u.quotaUsed / u.quotaLimit > 0.7 ? 'bg-red-500' : 'bg-primary')}
                              style={{ width: `${(u.quotaUsed / u.quotaLimit) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums">
                            {u.quotaUsed}/{u.quotaLimit}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={clsx(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black',
                        STATUS_BADGE[u.status]
                      )}>
                        {STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-medium">{u.lastActive}</p>
                      <p className="text-xs text-on-surface-variant">{isEn ? 'Joined:' : 'Tham gia:'} {u.joinedAt}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title={u.status === 'suspended' ? (isEn ? 'Unlock' : 'Mở khóa') : (isEn ? 'Suspend' : 'Tạm khóa')}
                          onClick={() => handleStatusToggle(u.id)}
                          className="w-9 h-9 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center hover:bg-yellow-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                        >
                          <span className="material-symbols-outlined text-sm">{u.status === 'suspended' ? 'lock_open' : 'block'}</span>
                        </button>
                        <button
                          title={isEn ? 'Delete' : 'Xóa'}
                          onClick={() => handleDelete(u.id)}
                          className="w-9 h-9 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center hover:bg-red-100 text-red-500 transition-colors shadow-[2px_2px_0px_0px_#000]"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-10 right-10 z-50">
        <button
          onClick={() => setShowCreate(true)}
          className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          <span className="material-symbols-outlined text-2xl font-bold">add</span>
        </button>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div className="relative bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl rounded-3xl border-3 border-black w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[12px_12px_0px_0px_#000]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b-2 border-black p-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
                    <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-on-surface">{isEn ? 'Create New User' : 'Tạo người dùng mới'}</h3>
                    <p className="text-sm text-on-surface-variant">{isEn ? 'Add new account to system' : 'Thêm tài khoản mới vào hệ thống'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_#000]"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleCreate({
                  email: String(fd.get('email') || ''),
                  password: String(fd.get('password') || ''),
                  name: String(fd.get('name') || ''),
                  role: String(fd.get('role') || 'user'),
                  plan: String(fd.get('plan') || 'free'),
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{isEn ? 'Full Name' : 'Họ và tên'} <span className="text-red-500">*</span></label>
                <input
                  required
                  name="name"
                  type="text"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={isEn ? 'John Doe' : 'Nguyễn Văn A'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email <span className="text-red-500">*</span></label>
                <input
                  required
                  name="email"
                  type="email"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={isEn ? 'user@example.com' : 'email@mada.vn'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{isEn ? 'Password' : 'Mật khẩu'} <span className="text-red-500">*</span></label>
                <input
                  required
                  name="password"
                  type="password"
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={isEn ? 'Minimum 6 characters' : 'Tối thiểu 6 ký tự'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role</label>
                  <select name="role" className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Plan</label>
                  <select name="plan" className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm">
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-black font-bold text-sm hover:bg-gray-100 transition-colors shadow-[3px_3px_0px_0px_#000]"
                >
                  {isEn ? 'Cancel' : 'Hủy'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                >
                  {isEn ? 'Create' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}