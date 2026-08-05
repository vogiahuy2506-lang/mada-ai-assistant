import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, AdminUser, KnowledgeStats, UserStats } from './adminApi';

function timeAgo(iso: string | null): string {
  if (!iso) return 'Chưa đăng nhập';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export function AdminOverview() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const [us, kbs, users] = await Promise.all([
          adminApi.getUserStats(),
          adminApi.getKnowledgeStats(),
          adminApi.listUsers(),
        ]);
        if (us.success && us.data) setUserStats(us.data);
        if (kbs.success && kbs.data) setKbStats(kbs.data);
        if (users.success && users.data) {
          setRecentUsers(
            [...users.data.users]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5)
          );
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    {
      label: 'Tổng người dùng',
      value: userStats?.total != null ? userStats.total.toLocaleString('vi-VN') : '—',
      icon: 'group',
      color: 'primary',
      sub: `${userStats?.active ?? 0} đang hoạt động`,
    },
    {
      label: 'Tài liệu KB',
      value: kbStats?.totalDocuments != null ? kbStats.totalDocuments.toLocaleString('vi-VN') : '—',
      icon: 'description',
      color: 'secondary',
      sub: `${kbStats?.totalCategories ?? 0} danh mục`,
    },
    {
      label: 'Gói Enterprise',
      value: userStats?.enterprise != null ? userStats.enterprise.toLocaleString('vi-VN') : '—',
      icon: 'workspace_premium',
      color: 'tertiary',
      sub: 'Khách hàng cao cấp',
    },
    {
      label: 'Tài khoản treo',
      value: userStats?.suspended != null ? userStats.suspended.toLocaleString('vi-VN') : '—',
      icon: 'block',
      color: 'error',
      sub: 'Cần xử lý',
    },
  ];

  return (
    <AdminLayout
      title="Tổng quan hệ thống"
      subtitle="Theo dõi người dùng, kho tri thức và hoạt động của MADA AI theo thời gian thực."
    >
      {/* STATS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-${stat.color}/10 flex items-center justify-center text-${stat.color}`}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {stat.icon}
                </span>
              </div>
              <span className="font-label-sm text-on-surface-variant">{liveTime.toLocaleTimeString('vi-VN')}</span>
            </div>
            <h3 className="font-label-md text-on-surface-variant">{stat.label}</h3>
            <p className="font-display-lg text-headline-lg font-bold mt-1">{loading && stat.value === '—' ? <span className="opacity-40">...</span> : stat.value}</p>
            <p className="font-label-sm text-on-surface-variant mt-2">{stat.sub}</p>
          </div>
        ))}
      </section>

      {/* TWO COLUMN: USERS + KB */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Users */}
        <div className="lg:col-span-2 backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-headline-md text-on-surface">Người dùng mới nhất</h3>
              <p className="font-label-sm text-on-surface-variant">5 tài khoản đăng ký gần đây</p>
            </div>
            <a href="/admin/users" className="text-primary font-label-sm hover:underline">Xem tất cả →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-on-surface-variant font-label-sm border-b border-outline-variant/30">
                  <th className="py-3">Người dùng</th>
                  <th className="py-3">Vai trò</th>
                  <th className="py-3">Gói</th>
                  <th className="py-3">Trạng thái</th>
                  <th className="py-3">Đăng nhập cuối</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">Đang tải...</td></tr>
                ) : recentUsers.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">Chưa có người dùng</td></tr>
                ) : recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-outline-variant/10 hover:bg-primary/5 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-label-md">{u.name}</p>
                          <p className="font-label-sm text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="font-label-sm">{u.role === 'admin' ? 'Quản trị' : u.role === 'expert' ? 'Chuyên gia' : u.role === 'data_manager' ? 'QL Dữ liệu' : 'Người dùng'}</span>
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        u.plan === 'enterprise' ? 'bg-primary-container/30 text-primary' :
                        u.plan === 'pro' ? 'bg-secondary/10 text-secondary' :
                        'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 font-label-sm ${
                        u.status === 'active' ? 'text-secondary' : u.status === 'suspended' ? 'text-error' : 'text-on-surface-variant'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          u.status === 'active' ? 'bg-secondary' : u.status === 'suspended' ? 'bg-error' : 'bg-on-surface-variant/40'
                        }`} />
                        {u.status === 'active' ? 'Hoạt động' : u.status === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt'}
                      </span>
                    </td>
                    <td className="py-3 font-label-sm text-on-surface-variant">{timeAgo(u.lastLogin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan distribution */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <h3 className="font-headline-md text-on-surface mb-6">Phân bổ gói dịch vụ</h3>
          {loading || !userStats ? (
            <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="space-y-4">
              {[
                { name: 'Enterprise', count: userStats.enterprise, color: 'primary', total: userStats.total },
                { name: 'Pro', count: userStats.pro, color: 'secondary', total: userStats.total },
                { name: 'Free', count: userStats.free, color: 'tertiary', total: userStats.total },
              ].map((p) => {
                const pct = p.total > 0 ? Math.round((p.count / p.total) * 100) : 0;
                return (
                  <div key={p.name}>
                    <div className="flex justify-between font-label-sm mb-1">
                      <span>{p.name}</span>
                      <span className="font-bold">{p.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className={`h-full bg-${p.color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* KB stats */}
          <div className="mt-8 pt-6 border-t border-outline-variant/20">
            <h4 className="font-label-md text-on-surface-variant mb-3">Kho tri thức</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-primary/5 rounded-2xl">
                <p className="font-label-sm text-on-surface-variant">Tài liệu</p>
                <p className="font-display-lg text-headline-md font-bold text-primary">{kbStats?.totalDocuments ?? '—'}</p>
              </div>
              <div className="p-4 bg-secondary/5 rounded-2xl">
                <p className="font-label-sm text-on-surface-variant">Danh mục</p>
                <p className="font-display-lg text-headline-md font-bold text-secondary">{kbStats?.totalCategories ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <section className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <h3 className="font-headline-md text-on-surface mb-6">Thao tác nhanh</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/users" className="p-6 rounded-2xl border border-outline-variant/20 hover:border-primary hover:bg-primary/5 transition-all group">
            <span className="material-symbols-outlined text-3xl text-primary mb-3">person_add</span>
            <h4 className="font-label-md mb-1">Quản lý người dùng</h4>
            <p className="font-label-sm text-on-surface-variant">Thêm, sửa, phân quyền người dùng</p>
          </a>
          <a href="/admin/logs" className="p-6 rounded-2xl border border-outline-variant/20 hover:border-secondary hover:bg-secondary/5 transition-all group">
            <span className="material-symbols-outlined text-3xl text-secondary mb-3">receipt_long</span>
            <h4 className="font-label-md mb-1">Nhật ký hệ thống</h4>
            <p className="font-label-sm text-on-surface-variant">Theo dõi hoạt động và lỗi</p>
          </a>
          <a href="/admin/settings" className="p-6 rounded-2xl border border-outline-variant/20 hover:border-tertiary hover:bg-tertiary/5 transition-all group">
            <span className="material-symbols-outlined text-3xl text-tertiary mb-3">settings_suggest</span>
            <h4 className="font-label-md mb-1">Cấu hình hệ thống</h4>
            <p className="font-label-sm text-on-surface-variant">Tinh chỉnh AI và bảo mật</p>
          </a>
        </div>
      </section>
    </AdminLayout>
  );
}
