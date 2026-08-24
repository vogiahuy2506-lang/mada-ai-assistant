import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { formatPrice } from '../../lib/formatPrice';
import clsx from 'clsx';
import { 
  Users, Search, Shield, ShieldOff, Trash2, 
  CheckCircle2, XCircle, Loader2, MoreVertical,
  Mail, Calendar, Clock
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'pending' | 'suspended';
  provider: 'email' | 'google';
  quota_used: number;
  quota_limit: number;
  created_at: string;
  last_login_at: string | null;
}

type FilterStatus = 'all' | 'active' | 'pending' | 'suspended';
type FilterRole = 'all' | 'admin' | 'user';

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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        let items = data.data || [];
        
        // Filter by search
        if (search) {
          const q = search.toLowerCase();
          items = items.filter((u: User) => 
            u.name.toLowerCase().includes(q) || 
            u.email.toLowerCase().includes(q)
          );
        }
        
        // Filter by status
        if (filterStatus !== 'all') {
          items = items.filter((u: User) => u.status === filterStatus);
        }
        
        // Filter by role
        if (filterRole !== 'all') {
          items = items.filter((u: User) => u.role === filterRole);
        }
        
        setTotalUsers(items.length);
        setUsers(items.slice(page * pageSize, (page + 1) * pageSize));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterStatus, filterRole, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(0); }, [search, filterStatus, filterRole]);

  const handleUpdateStatus = async (userId: string, status: 'active' | 'suspended') => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) await loadUsers();
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Xóa user "${user.name}" (${user.email})?\n\n⚠️ Hành động này không thể hoàn tác!`)) return;
    if (user.role === 'admin' && !confirm('⚠️ Đây là tài khoản admin. Bạn có chắc muốn xóa?')) return;
    
    setActionLoading(userId => userId);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) await loadUsers();
    } finally { setActionLoading(null); }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'user') => {
    if (!confirm(`Thay đổi role thành "${role}"?`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ role })
      });
      if (res.ok) await loadUsers();
    } finally { setActionLoading(null); }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const getStatusBadge = (status: User['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      pending: 'bg-amber-100 text-amber-700 border-amber-300',
      suspended: 'bg-red-100 text-red-700 border-red-300',
    };
    const labels = { active: 'Hoạt động', pending: 'Chờ duyệt', suspended: 'Bị khóa' };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold border', styles[status])}>
        {labels[status]}
      </span>
    );
  };

  const getRoleBadge = (role: User['role']) => (
    <span className={clsx(
      'px-2 py-0.5 rounded-full text-xs font-black border-2 border-black',
      role === 'admin' 
        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
        : 'bg-slate-100 text-slate-600'
    )}>
      {role === 'admin' ? '👑 Admin' : '👤 User'}
    </span>
  );

  const getPlanBadge = (plan: User['plan']) => {
    const styles = {
      free: 'bg-slate-100 text-slate-600',
      pro: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
    };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', styles[plan])}>
        {plan.toUpperCase()}
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
      title="Quản lý Người dùng"
      subtitle="Xem, khóa, xóa tài khoản người dùng trong hệ thống."
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              Quản lý Người dùng
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Xem, khóa, xóa tài khoản người dùng trong hệ thống.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng user" value={totalUsers} icon={<Users className="w-5 h-5" />} color="bg-indigo-500" />
        <StatCard 
          label="Đang hoạt động" 
          value={users.filter(u => u.status === 'active').length} 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          color="bg-emerald-500" 
        />
        <StatCard 
          label="Chờ duyệt" 
          value={users.filter(u => u.status === 'pending').length} 
          icon={<Clock className="w-5 h-5" />} 
          color="bg-amber-500" 
        />
        <StatCard 
          label="Bị khóa" 
          value={users.filter(u => u.status === 'suspended').length} 
          icon={<XCircle className="w-5 h-5" />} 
          color="bg-red-500" 
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-black p-4 mb-4 shadow-[2px_2px_0px_0px_#000]">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-black font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 rounded-lg border-2 border-black font-medium text-sm bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="pending">Chờ duyệt</option>
            <option value="suspended">Bị khóa</option>
          </select>
          
          {/* Role filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as FilterRole)}
            className="px-3 py-2 rounded-lg border-2 border-black font-medium text-sm bg-white"
          >
            <option value="all">Tất cả role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
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
          <p className="text-slate-500 font-medium">Không tìm thấy người dùng nào</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-black">
                  <tr>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Người dùng</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Trạng thái</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Role</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Plan</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Đăng nhập</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Ngày tạo</th>
                    <th className="text-right px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">Hành động</th>
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
                              title="Khóa tài khoản"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          ) : user.status === 'suspended' ? (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all border-2 border-black disabled:opacity-50"
                              title="Mở khóa tài khoản"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all border-2 border-black disabled:opacity-50"
                              title="Duyệt tài khoản"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          
                          {user.role === 'user' ? (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'admin')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all border-2 border-black disabled:opacity-50"
                              title="Nâng cấp thành Admin"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'user')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border-2 border-black disabled:opacity-50"
                              title="Hạ cấp thành User"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={actionLoading === user.id}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all border-2 border-black disabled:opacity-50"
                            title="Xóa tài khoản"
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
                ← Trước
              </button>
              <span className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                Sau →
              </button>
            </div>
          )}
        </>
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
