import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, UserStats, KnowledgeStats } from './adminApi';
import { useSystemSettingsStore } from '@/stores';
import clsx from 'clsx';

type Tab = 'general' | 'plans' | 'security' | 'ai' | 'integrations' | 'live';

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>('general');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [kbStats, setKbStats] = useState<KnowledgeStats | null>(null);
  
  const { 
    anonymousLimit, 
    defaultPlanLimit, 
    maxFilesPerSession,
    maxFilesTotal,
    maxFileSizeMB,
    setAnonymousLimit, 
    setDefaultPlanLimit,
    setMaxFilesPerSession,
    setMaxFilesTotal,
    setMaxFileSizeMB,
  } = useSystemSettingsStore();

  useEffect(() => {
    if (tab === 'live') {
      Promise.all([adminApi.getUserStats(), adminApi.getKnowledgeStats()]).then(([u, k]) => {
        if (u.success && u.data) setUserStats(u.data);
        if (k.success && k.data) setKbStats(k.data);
      });
    }
  }, [tab]);

  const save = () => {
    setSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setTimeout(() => setSavedAt(null), 3000);
  };

  return (
    <AdminLayout
      title="Cấu hình Hệ thống"
      subtitle="Điều chỉnh các tham số cốt lõi của MADA AI: gói giá, bảo mật, mô hình AI và tích hợp bên thứ ba."
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              Cấu hình Hệ thống
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Điều chỉnh các tham số cốt lõi của MADA AI: gói giá, bảo mật, mô hình AI và tích hợp bên thứ ba.
            </p>
          </div>
        </div>
      </section>

      {/* TABS */}
      <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black mb-12 w-fit">
        {(
          [
            { id: 'general', label: 'Chung', icon: 'tune' },
            { id: 'plans', label: 'Gói & Quota', icon: 'workspace_premium' },
            { id: 'security', label: 'Bảo mật', icon: 'shield' },
            { id: 'ai', label: 'AI Models', icon: 'psychology' },
            { id: 'integrations', label: 'Tích hợp', icon: 'extension' },
            { id: 'live', label: 'Trạng thái thật', icon: 'monitor_heart' },
          ] as { id: Tab; label: string; icon: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all border-2',
              tab === t.id
                ? 'bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-transparent text-on-surface-variant hover:bg-white/80 border-transparent hover:border-black'
            )}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* GENERAL */}
      {tab === 'general' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-6">
            <h3 className="text-xl font-black text-on-surface mb-6">Thông tin chung</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tên hệ thống</label>
                <input
                  defaultValue="MADA AI"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">URL hệ thống</label>
                <input
                  defaultValue="https://mada.ai"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email liên hệ</label>
                <input
                  type="email"
                  defaultValue="contact@mada.vn"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ngôn ngữ mặc định</label>
                <select className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option>Tiếng Việt</option>
                  <option>English</option>
                  <option>Français</option>
                  <option>العربية</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Mô tả hệ thống</label>
              <textarea
                rows={3}
                defaultValue="MADA AI - Trợ lý ảo thông minh hỗ trợ người khuyết tật tiếp cận công nghệ."
                className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={save}
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
              >
                Lưu thay đổi
              </button>
              {savedAt && (
                <span className="font-bold text-secondary animate-pulse">
                  ✓ Đã lưu lúc {savedAt}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PLANS & QUOTA */}
      {tab === 'plans' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-8">
            <h3 className="text-xl font-black text-on-surface mb-6">Cấu hình Gói & Quota</h3>

            {/* Anonymous User Quota */}
            <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <h4 className="font-bold text-on-surface mb-4">Quota cho người dùng ẩn danh</h4>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="anonUnlimited"
                    checked={anonymousLimit === -1}
                    onChange={(e) => setAnonymousLimit(e.target.checked ? -1 : 10)}
                    className="w-5 h-5 rounded accent-primary"
                  />
                  <label htmlFor="anonUnlimited" className="font-medium text-on-surface">
                    Không giới hạn
                  </label>
                </div>
                {!anonymousLimit || anonymousLimit !== -1 ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={anonymousLimit === -1 ? '' : anonymousLimit}
                      onChange={(e) => setAnonymousLimit(parseInt(e.target.value) || 10)}
                      className="w-24 px-4 py-2 rounded-xl bg-white border-2 border-black text-sm font-mono text-center"
                    />
                    <span className="text-sm text-on-surface-variant">tin nhắn/phiên</span>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                Người dùng chưa đăng nhập sẽ có giới hạn này. Đặt "Không giới hạn" để bỏ giới hạn.
              </p>
            </div>

            {/* File Upload Limits */}
            <div className="p-6 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <h4 className="font-bold text-on-surface mb-4">Giới hạn Upload File</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="font-medium text-on-surface whitespace-nowrap">File/phiên chat:</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={maxFilesPerSession}
                      onChange={(e) => setMaxFilesPerSession(parseInt(e.target.value) || 10)}
                      className="w-20 px-3 py-2 rounded-xl bg-white border-2 border-black text-sm font-mono text-center"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant flex-shrink-0">
                    Tối đa file cho mỗi cuộc trò chuyện
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="font-medium text-on-surface whitespace-nowrap">Tổng file:</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={maxFilesTotal}
                      onChange={(e) => setMaxFilesTotal(parseInt(e.target.value) || 100)}
                      className="w-20 px-3 py-2 rounded-xl bg-white border-2 border-black text-sm font-mono text-center"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant flex-shrink-0">
                    Tổng số file tối đa cho tất cả phiên
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="font-medium text-on-surface whitespace-nowrap">Dung lượng/file:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={maxFileSizeMB}
                      onChange={(e) => setMaxFileSizeMB(parseInt(e.target.value) || 50)}
                      className="w-20 px-3 py-2 rounded-xl bg-white border-2 border-black text-sm font-mono text-center"
                    />
                    <span className="font-medium text-on-surface-variant">MB</span>
                  </div>
                  <p className="text-xs text-on-surface-variant flex-shrink-0">
                    Kích thước tối đa cho mỗi file
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t-2 border-black/10">
                <p className="text-sm text-on-surface-variant mb-2">Định dạng hỗ trợ:</p>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'DOCX', 'TXT', 'PNG', 'JPEG', 'JPG', 'PPTX'].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/30"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Plan Quotas */}
            <div className="space-y-4">
              <h4 className="font-bold text-on-surface">Quota theo Gói dịch vụ</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: 'Free', color: 'gray', price: '0', current: false, planKey: 'free' },
                  { name: 'Pro', color: 'primary', price: '199,000', current: true, planKey: 'pro' },
                  { name: 'Enterprise', color: 'tertiary', price: 'Liên hệ', current: false, planKey: 'enterprise' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className={`p-5 rounded-2xl border-3 border-black shadow-[6px_6px_0px_0px_#000] ${
                      p.current ? 'bg-primary/10' : 'bg-white/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-black">{p.name}</span>
                      {p.current && (
                        <span className="px-2.5 py-1 rounded-full bg-primary text-white text-xs font-bold border-2 border-black">
                          HIỆN TẠI
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Giá (VND/tháng)</label>
                        <input
                          defaultValue={p.price}
                          className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Quota/tháng</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={defaultPlanLimit === -1}
                            onChange={(e) => setDefaultPlanLimit(e.target.checked ? -1 : 50)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="text-xs text-on-surface-variant">Không giới hạn</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-6">
            <h3 className="text-xl font-black text-on-surface mb-6">Bảo mật</h3>

            {([
              {
                label: 'Bắt buộc 2FA cho Admin',
                desc: 'Tất cả tài khoản admin phải bật xác thực 2 yếu tố.',
                value: true,
              },
              {
                label: 'Cho phép đăng nhập Google',
                desc: 'Người dùng có thể đăng nhập bằng tài khoản Google.',
                value: true,
              },
              {
                label: 'Giới hạn IP Whitelist',
                desc: 'Chỉ cho phép admin đăng nhập từ IP được phê duyệt.',
                value: false,
              },
              {
                label: 'Audit log chi tiết',
                desc: 'Ghi lại mọi hành động admin vào bảng admin_audit_log.',
                value: true,
              },
              {
                label: 'Tự động khóa sau 5 lần sai',
                desc: 'Khóa tài khoản sau 5 lần đăng nhập thất bại.',
                value: true,
              },
            ] as { label: string; desc: string; value: boolean }[]
            ).map((item, idx) => (
              <ToggleRow key={idx} label={item.label} desc={item.desc} value={item.value} />
            ))}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                JWT Secret (chỉ hiển thị một lần)
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value="sk_live_●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●"
                  className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-black text-sm font-mono"
                />
                <button className="px-4 py-2 rounded-xl bg-gray-100 border-2 border-black hover:bg-gray-200 font-bold transition-colors shadow-[2px_2px_0px_0px_#000]">
                  <span className="material-symbols-outlined text-sm">refresh</span>
                </button>
              </div>
            </div>

            <button
              onClick={save}
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-6">
            <h3 className="text-xl font-black text-on-surface mb-6">Cấu hình AI Models</h3>

            {([
              {
                name: 'MADA-LLM',
                version: 'v4.2.1',
                status: 'active',
                desc: 'Mô hình ngôn ngữ chính cho trợ lý ảo.',
                color: 'primary',
              },
              {
                name: 'MADA-Vision',
                version: 'v2.0',
                status: 'active',
                desc: 'Nhận diện hình ảnh thiết bị hỗ trợ.',
                color: 'tertiary',
              },
              {
                name: 'MADA-Voice',
                version: 'v1.5',
                status: 'beta',
                desc: 'TTS/STT đa ngôn ngữ (Vi, En, Fr, Ar).',
                color: 'secondary',
              },
            ] as { name: string; version: string; status: string; desc: string; color: string }[]
            ).map((m) => (
              <div
                key={m.name}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000]"
              >
                <div className={`w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] ${
                  m.color === 'primary' ? 'bg-primary/20' : m.color === 'secondary' ? 'bg-secondary/20' : 'bg-tertiary/20'
                }`}>
                  <span className={`material-symbols-outlined text-xl ${
                    m.color === 'primary' ? 'text-primary' : m.color === 'secondary' ? 'text-secondary' : 'text-tertiary'
                  }`}>psychology</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-on-surface">{m.name}</h4>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-on-surface-variant border border-black/20">{m.version}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 border-black ${
                      m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{m.desc}</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[3px_3px_0px_0px_#000] transition-all">
                  Cập nhật
                </button>
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Temperature (0–1)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue="0.7"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Max tokens</label>
                <input
                  type="number"
                  defaultValue="2048"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border-2 border-black text-sm font-mono"
                />
              </div>
            </div>

            <button
              onClick={save}
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#000] transition-all"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === 'integrations' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-4">
            <h3 className="text-xl font-black text-on-surface mb-6">Tích hợp bên thứ ba</h3>

            {([
              { name: 'OpenAI API', desc: 'GPT-4 cho RAG fallback', icon: 'auto_awesome', connected: true, color: 'primary' },
              { name: 'Google Cloud', desc: 'Storage & Translation', icon: 'cloud', connected: true, color: 'tertiary' },
              { name: 'Stripe', desc: 'Thanh toán Pro/Enterprise', icon: 'credit_card', connected: false, color: 'secondary' },
              { name: 'SendGrid', desc: 'Email thông báo', icon: 'mail', connected: true, color: 'error' },
              { name: 'Sentry', desc: 'Error tracking', icon: 'bug_report', connected: true, color: 'primary' },
            ] as { name: string; desc: string; icon: string; connected: boolean; color: string }[]
            ).map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white/60 border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] transition-all"
              >
                <div className={`w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] ${
                  s.color === 'primary' ? 'bg-primary/20' : s.color === 'secondary' ? 'bg-secondary/20' : s.color === 'tertiary' ? 'bg-tertiary/20' : 'bg-error/20'
                }`}>
                  <span className={`material-symbols-outlined text-xl ${
                    s.color === 'primary' ? 'text-primary' : s.color === 'secondary' ? 'text-secondary' : s.color === 'tertiary' ? 'text-tertiary' : 'text-error'
                  }`}>{s.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface">{s.name}</p>
                    {s.connected && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant">{s.desc}</p>
                </div>
                <button
                  className={clsx(
                    'px-4 py-2 rounded-xl font-bold text-sm border-2 border-black transition-all shadow-[2px_2px_0px_0px_#000]',
                    s.connected
                      ? 'bg-red-100 text-red-600 hover:shadow-[3px_3px_0px_0px_#000]'
                      : 'bg-primary text-white hover:-translate-y-1 hover:shadow-[3px_3px_0px_0px_#000]'
                  )}
                >
                  {s.connected ? 'Ngắt' : 'Kết nối'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE STATUS */}
      {tab === 'live' && (
        <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border-3 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000]">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-3xl"></div>
          <div className="relative z-10 space-y-6">
            <div>
              <h3 className="text-xl font-black text-on-surface">Trạng thái hệ thống (real-time)</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Dữ liệu đọc trực tiếp từ backend MADA AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-primary/10 border-2 border-primary/30 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-xl">group</span>
                  <h4 className="font-bold text-on-surface">Người dùng</h4>
                </div>
                {userStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/60 border border-black/10">
                      <p className="text-xs text-on-surface-variant">Tổng</p>
                      <p className="text-xl font-black">{userStats.total}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/60 border border-black/10">
                      <p className="text-xs text-on-surface-variant">Active</p>
                      <p className="text-xl font-black text-secondary">{userStats.active}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/60 border border-black/10">
                      <p className="text-xs text-on-surface-variant">Suspended</p>
                      <p className="text-xl font-black text-error">{userStats.suspended}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/60 border border-black/10">
                      <p className="text-xs text-on-surface-variant">Pending</p>
                      <p className="text-xl font-black text-tertiary">{userStats.pending}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-on-surface-variant py-4 text-center">Đang tải...</p>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-secondary/10 border-2 border-secondary/30 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-secondary text-xl">storage</span>
                  <h4 className="font-bold text-on-surface">Knowledge Base</h4>
                </div>
                {kbStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 rounded-xl bg-white/60 border border-black/10">
                      <span className="text-sm text-on-surface-variant">Tổng tài liệu</span>
                      <span className="text-lg font-black text-primary">{kbStats.totalDocuments}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-white/60 border border-black/10">
                      <span className="text-sm text-on-surface-variant">Danh mục</span>
                      <span className="text-lg font-black text-secondary">{kbStats.totalCategories}</span>
                    </div>
                    {kbStats.totalSize !== undefined && (
                      <div className="flex justify-between p-3 rounded-xl bg-white/60 border border-black/10">
                        <span className="text-sm text-on-surface-variant">Dung lượng</span>
                        <span className="text-lg font-black text-tertiary">{(kbStats.totalSize / 1024).toFixed(2)} KB</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-on-surface-variant py-4 text-center">Đang tải...</p>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-tertiary/10 border-2 border-tertiary/30 shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary text-xl">api</span>
                <h4 className="font-bold text-on-surface">Endpoints</h4>
              </div>
              <div className="font-mono text-sm space-y-1 text-on-surface-variant p-4 bg-white/60 rounded-xl border border-black/10">
                <p>• GET /api/health</p>
                <p>• GET /api/users | PATCH /api/users/:id</p>
                <p>• GET /api/knowledge/stats | GET /api/knowledge/search</p>
                <p>• GET /api/admin/logs | GET /api/admin/analytics</p>
                <p>• POST /api/auth/login | POST /api/auth/register</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function ToggleRow({ label, desc, value }: { label: string; desc: string; value: boolean }) {
  const [enabled, setEnabled] = useState(value);
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white/60 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
      <div className="flex-1">
        <p className="font-bold text-on-surface">{label}</p>
        <p className="text-sm text-on-surface-variant">{desc}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={clsx(
          'relative w-14 h-8 rounded-full transition-colors flex-shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]',
          enabled ? 'bg-primary' : 'bg-gray-200'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform border border-black/20',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
