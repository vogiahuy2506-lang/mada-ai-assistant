import { useEffect, useState, useCallback } from 'react';
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
  const [filterBotId, setFilterBotId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [us, kbs, users] = await Promise.all([
        adminApi.getUserStats(),
        adminApi.getKnowledgeStats(filterBotId ? { botId: filterBotId } : undefined),
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
  }, [filterBotId]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout
      title="Tổng quan hệ thống"
      subtitle="Theo dõi người dùng, kho tri thức và hoạt động của MADA AI theo thời gian thực."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              Tổng quan hệ thống
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Theo dõi người dùng, kho tri thức và hoạt động của MADA AI theo thời gian thực.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TỔNG NGƯỜI DÙNG</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.total ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">{userStats?.active ?? 0} đang hoạt động</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TÀI LIỆU KB</p>
            <h3 className="text-xl font-black text-on-surface">{kbStats?.totalDocuments ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {filterBotId ? `Bot: ${filterBotId}` : `${kbStats?.totalCategories ?? 0} danh mục`}
            </p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-tertiary/10 to-tertiary/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[-0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-tertiary/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">GÓI ENTERPRISE</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.enterprise ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">Khách hàng cao cấp</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-error/10 to-error/5 backdrop-blur-xl rounded-2xl p-4 border-3 border-black flex items-center gap-4 transform rotate-[0.5deg] hover:rotate-0 transition-transform shadow-[6px_6px_0px_0px_#000] hover:shadow-[8px_8px_0px_0px_#000]">
          <div className="w-10 h-10 rounded-xl bg-error/20 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
            <span className="material-symbols-outlined text-error text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TÀI KHOẢN TREO</p>
            <h3 className="text-xl font-black text-on-surface">{userStats?.suspended ?? '—'}</h3>
            <p className="text-[10px] text-on-surface-variant mt-1">Cần xử lý</p>
          </div>
        </div>
      </section>

      {/* KB Filter + Per-Bot Breakdown */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] mb-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-black text-on-surface">Kho tri thức theo Bot</h3>
            <p className="text-sm text-on-surface-variant">Lọc theo 7 bot MADA chuyên biệt</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Bot ID:</label>
            <select
              value={filterBotId}
              onChange={(e) => setFilterBotId(e.target.value)}
              className="h-10 px-3 rounded-lg border-2 border-black font-label-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tất cả 7 bot</option>
              <option value="bot-hearing">Bot 1: Hearing</option>
              <option value="bot-vision">Bot 2: Vision</option>
              <option value="bot-speech">Bot 3: Speech</option>
              <option value="bot-cognitive">Bot 4: Cognitive</option>
              <option value="bot-neuro">Bot 5: Neuro-Movement</option>
              <option value="bot-mobility">Bot 6: Mobility</option>
              <option value="bot-regulatory">Bot 7: Regulatory</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {kbStats?.perBot && kbStats.perBot.length > 0 ? (
            kbStats.perBot.map((row: any) => (
              <button
                key={row.botId}
                onClick={() => setFilterBotId(filterBotId === row.botId ? '' : row.botId)}
                className={`text-left p-3 rounded-xl border-2 border-black transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] ${filterBotId === row.botId ? 'bg-primary text-white' : 'bg-white'}`}
              >
                <div className="text-[10px] font-bold uppercase opacity-70">{row.botId.replace('bot-', '')}</div>
                <div className="text-2xl font-black mt-1">{row.count}</div>
                <div className="text-[10px] mt-1 opacity-60">tài liệu</div>
              </button>
            ))
          ) : (
            <div className="col-span-7 text-sm text-on-surface-variant text-center py-8">
              Chưa có dữ liệu knowledge items theo bot. Chạy crawl + ingest trong /admin/scraper.
            </div>
          )}
        </div>
      </section>

      {/* Recent Users Table */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] mb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-black text-on-surface">Người dùng mới nhất</h3>
              <p className="text-sm text-on-surface-variant">5 tài khoản đăng ký gần đây</p>
            </div>
            <a href="/admin/users" className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all">
              Xem tất cả →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Người dùng</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Vai trò</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Gói</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Trạng thái</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Đăng nhập cuối</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">Đang tải...</td></tr>
                ) : recentUsers.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">Chưa có người dùng</td></tr>
                ) : recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-black/10 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-sm border-2 border-black">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold border-2 border-black bg-gray-100">
                        {u.role === 'admin' ? 'Quản trị' : u.role === 'expert' ? 'Chuyên gia' : u.role === 'data_manager' ? 'QL Dữ liệu' : 'Người dùng'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-black ${
                        u.plan === 'enterprise' ? 'bg-primary/20 text-primary' :
                        u.plan === 'pro' ? 'bg-secondary/20 text-secondary' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-black ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : u.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          u.status === 'active' ? 'bg-green-500' : u.status === 'suspended' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        {u.status === 'active' ? 'Hoạt động' : u.status === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface-variant">{timeAgo(u.lastLogin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-on-surface mb-6">Thao tác nhanh</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/admin/users" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-primary text-xl">person_add</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">Quản lý người dùng</h4>
              <p className="text-sm text-on-surface-variant">Thêm, sửa, phân quyền người dùng</p>
            </a>
            <a href="/admin/logs" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-secondary text-xl">receipt_long</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">Nhật ký hệ thống</h4>
              <p className="text-sm text-on-surface-variant">Theo dõi hoạt động và lỗi</p>
            </a>
            <a href="/admin/settings" className="p-6 rounded-2xl bg-white/60 border-2 border-black hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-tertiary/20 border-2 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0px_0px_#000]">
                <span className="material-symbols-outlined text-tertiary text-xl">settings_suggest</span>
              </div>
              <h4 className="font-bold text-on-surface mb-1">Cấu hình hệ thống</h4>
              <p className="text-sm text-on-surface-variant">Tinh chỉnh AI và bảo mật</p>
            </a>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
export default AdminOverview;
