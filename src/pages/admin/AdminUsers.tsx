import { useState, useMemo, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import clsx from 'clsx';
import { usersApi, type ApiUser } from '@/lib/api';
import { Loader2 } from 'lucide-react';

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

function fromApiUser(u: ApiUser): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    plan: u.plan,
    status: u.status,
    joinedAt: new Date(u.createdAt).toLocaleDateString('vi-VN'),
    lastActive: u.lastLogin ? new Date(u.lastLogin).toLocaleString('vi-VN') : '—',
    quotaUsed: u.quotaUsed,
    quotaLimit: u.quotaLimit,
  };
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  data_manager: 'Quản lý dữ liệu',
  expert: 'Chuyên gia',
  user: 'Người dùng',
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

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Hoạt động',
  suspended: 'Tạm khóa',
  pending: 'Chờ duyệt',
};

export function AdminUsers() {
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
      setUsers(res.data.users.map(fromApiUser));
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
    if (!confirm('Xóa người dùng này? Hành động không thể hoàn tác.')) return;
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
      setUsers((prev) => [fromApiUser(res.data.user), ...prev]);
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
      subtitle="Quản lý tài khoản, phân quyền và trạng thái của tất cả người dùng trong hệ thống MADA AI."
    >
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Tổng cộng', value: stats.total, color: 'bg-primary/10 text-primary', icon: 'group' },
          { label: 'Hoạt động', value: stats.active, color: 'bg-secondary/10 text-secondary', icon: 'check_circle' },
          { label: 'Tạm khóa', value: stats.suspended, color: 'bg-error/10 text-error', icon: 'block' },
          { label: 'Chờ duyệt', value: stats.pending, color: 'bg-outline/20 text-on-surface-variant', icon: 'schedule' },
          { label: 'Admin', value: stats.admins, color: 'bg-tertiary/10 text-tertiary', icon: 'admin_panel_settings' },
        ].map((s) => (
          <div
            key={s.label}
            className="backdrop-blur-xl bg-white/70 border border-white/40 p-4 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
          >
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', s.color)}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <p className="font-display-lg text-2xl font-bold">{s.value}</p>
            <p className="font-label-sm text-on-surface-variant">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ACTION BAR */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
            className="px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Tất cả role</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as UserStatus | 'all')}
            className="px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Mọi trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Tạo người dùng
        </button>
      </div>

      {/* USER TABLE */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="mt-3 font-label-md">Đang tải dữ liệu từ server...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-error">cloud_off</span>
            <p className="mt-3 font-label-md text-error">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90"
            >
              Thử lại
            </button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Người dùng</th>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Role</th>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Plan</th>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Quota</th>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Trạng thái</th>
                <th className="text-left px-6 py-4 font-label-md text-on-surface-variant">Hoạt động</th>
                <th className="text-right px-6 py-4 font-label-md text-on-surface-variant">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-label-md">{u.name}</p>
                        <p className="font-label-sm text-on-surface-variant">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className={clsx(
                        'px-3 py-1 rounded-full text-[11px] font-bold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30',
                        ROLE_BADGE[u.role]
                      )}
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        'inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                        u.plan === 'enterprise'
                          ? 'bg-primary-container/20 text-primary'
                          : u.plan === 'pro'
                            ? 'bg-tertiary/10 text-tertiary'
                            : 'bg-surface-variant text-on-surface-variant'
                      )}
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.quotaLimit === -1 ? (
                      <span className="font-label-sm text-secondary font-bold">∞ Unlimited</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full',
                              u.quotaUsed / u.quotaLimit > 0.7 ? 'bg-error' : 'bg-primary'
                            )}
                            style={{ width: `${(u.quotaUsed / u.quotaLimit) * 100}%` }}
                          />
                        </div>
                        <span className="font-label-sm tabular-nums">
                          {u.quotaUsed}/{u.quotaLimit}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold',
                        STATUS_BADGE[u.status]
                      )}
                    >
                      {STATUS_LABELS[u.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-label-sm">{u.lastActive}</p>
                    <p className="text-[10px] text-on-surface-variant">Tham gia: {u.joinedAt}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title={u.status === 'suspended' ? 'Mở khóa' : 'Tạm khóa'}
                        onClick={() => handleStatusToggle(u.id)}
                        className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {u.status === 'suspended' ? 'lock_open' : 'block'}
                        </span>
                      </button>
                      <button
                        title="Xem chi tiết"
                        className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        title="Xóa"
                        onClick={() => handleDelete(u.id)}
                        className="w-9 h-9 rounded-lg hover:bg-error/10 flex items-center justify-center text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-40">search_off</span>
              <p className="mt-2 font-label-md">Không tìm thấy người dùng nào</p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="backdrop-blur-xl bg-white border border-white/40 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md">Tạo người dùng mới</h3>
              <button onClick={() => setShowCreate(false)} className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
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
              className="space-y-4"
            >
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5">Họ và tên</label>
                <input
                  required
                  name="name"
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5">Email</label>
                <input
                  required
                  name="email"
                  type="email"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  placeholder="email@mada.vn"
                />
              </div>
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5">Mật khẩu (≥ 6 ký tự)</label>
                <input
                  required
                  name="password"
                  type="password"
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  placeholder="Mật khẩu"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1.5">Role</label>
                  <select name="role" className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1.5">Plan</label>
                  <select name="plan" className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm">
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
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-outline-variant/30 hover:bg-surface-container font-label-md transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md"
                >
                  Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}