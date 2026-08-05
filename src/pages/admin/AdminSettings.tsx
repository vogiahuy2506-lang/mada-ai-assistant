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
  
  // System settings state
  const { 
    anonymousLimit, 
    defaultPlanLimit, 
    setAnonymousLimit, 
    setDefaultPlanLimit,
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
    >
      {/* TABS */}
      <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-2 rounded-2xl inline-flex gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
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
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-label-md transition-all',
              tab === t.id
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container'
            )}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* GENERAL */}
      {tab === 'general' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-6">
          <h3 className="font-headline-md text-on-surface">Thông tin chung</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                Tên hệ thống
              </label>
              <input
                defaultValue="MADA AI"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                URL hệ thống
              </label>
              <input
                defaultValue="https://mada.ai"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                Email liên hệ
              </label>
              <input
                type="email"
                defaultValue="contact@mada.vn"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                Ngôn ngữ mặc định
              </label>
              <select className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm">
                <option>Tiếng Việt</option>
                <option>English</option>
                <option>Français</option>
                <option>العربية</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-label-sm text-on-surface-variant mb-1.5">
              Mô tả hệ thống
            </label>
            <textarea
              rows={3}
              defaultValue="MADA AI - Trợ lý ảo thông minh hỗ trợ người khuyết tật tiếp cận công nghệ."
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
            >
              Lưu thay đổi
            </button>
            {savedAt && (
              <span className="font-label-sm text-secondary animate-pulse">
                ✓ Đã lưu lúc {savedAt}
              </span>
            )}
          </div>
        </div>
      )}

      {/* PLANS & QUOTA */}
      {tab === 'plans' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-8">
          <h3 className="font-headline-md text-on-surface">Cấu hình Gói & Quota</h3>

          {/* Anonymous User Quota */}
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <h4 className="font-label-lg text-on-surface mb-4">Quota cho người dùng ẩn dan</h4>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonUnlimited"
                  checked={anonymousLimit === -1}
                  onChange={(e) => setAnonymousLimit(e.target.checked ? -1 : 10)}
                  className="w-5 h-5 rounded accent-primary"
                />
                <label htmlFor="anonUnlimited" className="font-label-md text-on-surface">
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
                    className="w-24 px-4 py-2 rounded-xl bg-background border border-outline-variant/30 text-sm font-mono text-center"
                  />
                  <span className="font-label-sm text-on-surface-variant">tin nhắn/phiên</span>
                </div>
              ) : null}
            </div>
            <p className="text-[12px] text-on-surface-variant mt-2">
              Người dùng chưa đăng nhập sẽ có giới hạn này. Đặt "Không giới hạn" để bỏ giới hạn.
            </p>
          </div>

          {/* Plan Quotas */}
          <div className="space-y-4">
            <h4 className="font-label-lg text-on-surface">Quota theo Gói dịch vụ</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'Free', color: 'outline', price: '0', current: false, planKey: 'free' },
                { name: 'Pro', color: 'primary', price: '199,000', current: true, planKey: 'pro' },
                { name: 'Enterprise', color: 'tertiary', price: 'Liên hệ', current: false, planKey: 'enterprise' },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`p-5 rounded-2xl border-2 ${
                    p.current ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display-lg font-bold">{p.name}</span>
                    {p.current && (
                      <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                        HIỆN TẠI
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block font-label-sm text-on-surface-variant mb-1">Giá (VND/tháng)</label>
                      <input
                        defaultValue={p.price}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-outline-variant/30 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-label-sm text-on-surface-variant mb-1">Quota/tháng</label>
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
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
          >
            Lưu cấu hình
          </button>
        </div>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-6">
          <h3 className="font-headline-md text-on-surface">Bảo mật</h3>

          {(
            [
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
            <label className="block font-label-sm text-on-surface-variant mb-1.5">
              JWT Secret (chỉ hiển thị một lần)
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value="sk_live_●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●"
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-sm font-mono"
              />
              <button className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-variant font-label-md transition-colors">
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>
          </div>

          <button
            onClick={save}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
          >
            Lưu cấu hình
          </button>
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-6">
          <h3 className="font-headline-md text-on-surface">Cấu hình AI Models</h3>

          {[
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
          ].map((m) => (
            <div
              key={m.name}
              className="flex items-start gap-4 p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30"
            >
              <div className={`w-12 h-12 rounded-2xl bg-${m.color}/10 flex items-center justify-center text-${m.color}`}>
                <span className="material-symbols-outlined">psychology</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-label-md font-bold">{m.name}</h4>
                  <span className="font-mono text-[10px] text-on-surface-variant px-1.5 py-0.5 bg-background rounded">
                    {m.version}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      m.status === 'active' ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant">{m.desc}</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-colors">
                Cập nhật
              </button>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                Temperature (0–1)
              </label>
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
              <label className="block font-label-sm text-on-surface-variant mb-1.5">
                Max tokens
              </label>
              <input
                type="number"
                defaultValue="2048"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm font-mono"
              />
            </div>
          </div>

          <button
            onClick={save}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
          >
            Lưu cấu hình
          </button>
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === 'integrations' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="font-headline-md text-on-surface mb-2">Tích hợp bên thứ ba</h3>

          {[
            { name: 'OpenAI API', desc: 'GPT-4 cho RAG fallback', icon: 'auto_awesome', connected: true, color: 'primary' },
            { name: 'Google Cloud', desc: 'Storage & Translation', icon: 'cloud', connected: true, color: 'tertiary' },
            { name: 'Stripe', desc: 'Thanh toán Pro/Enterprise', icon: 'credit_card', connected: false, color: 'secondary' },
            { name: 'SendGrid', desc: 'Email thông báo', icon: 'mail', connected: true, color: 'error' },
            { name: 'Sentry', desc: 'Error tracking', icon: 'bug_report', connected: true, color: 'primary-container' },
          ].map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/30 hover:border-primary/30 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl bg-${s.color}/10 flex items-center justify-center text-${s.color}`}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-label-md font-bold">{s.name}</p>
                  {s.connected && (
                    <span className="flex items-center gap-1 text-[10px] text-secondary font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="font-label-sm text-on-surface-variant">{s.desc}</p>
              </div>
              <button
                className={clsx(
                  'px-4 py-2 rounded-xl font-label-md transition-colors',
                  s.connected
                    ? 'border-2 border-outline-variant/30 hover:bg-error/5 hover:text-error hover:border-error/30'
                    : 'bg-primary text-white hover:bg-primary/90 shadow-md'
                )}
              >
                {s.connected ? 'Ngắt' : 'Kết nối'}
              </button>
            </div>
          ))}
        </div>
      )}
      {/* LIVE STATUS (real backend data) */}
      {tab === 'live' && (
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-8 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] space-y-6">
          <div>
            <h3 className="font-headline-md text-on-surface">Trạng thái hệ thống (real-time)</h3>
            <p className="font-label-sm text-on-surface-variant mt-1">
              Dữ liệu đọc trực tiếp từ backend MADA AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-primary/5 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary">group</span>
                <h4 className="font-label-md font-bold">Người dùng</h4>
              </div>
              {userStats ? (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><p className="font-label-sm text-on-surface-variant">Tổng</p><p className="font-display-lg text-headline-md font-bold">{userStats.total}</p></div>
                  <div><p className="font-label-sm text-on-surface-variant">Active</p><p className="font-display-lg text-headline-md font-bold text-secondary">{userStats.active}</p></div>
                  <div><p className="font-label-sm text-on-surface-variant">Suspended</p><p className="font-display-lg text-headline-md font-bold text-error">{userStats.suspended}</p></div>
                  <div><p className="font-label-sm text-on-surface-variant">Pending</p><p className="font-display-lg text-headline-md font-bold text-tertiary">{userStats.pending}</p></div>
                </div>
              ) : <p className="text-on-surface-variant py-3">Đang tải...</p>}
            </div>

            <div className="p-5 bg-secondary/5 rounded-2xl border border-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-secondary">storage</span>
                <h4 className="font-label-md font-bold">Knowledge Base</h4>
              </div>
              {kbStats ? (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><p className="font-label-sm text-on-surface-variant">Tổng tài liệu</p><p className="font-display-lg text-headline-md font-bold">{kbStats.totalDocuments}</p></div>
                  <div><p className="font-label-sm text-on-surface-variant">Danh mục</p><p className="font-display-lg text-headline-md font-bold">{kbStats.totalCategories}</p></div>
                  {kbStats.totalSize !== undefined && (
                    <>
                      <div className="col-span-2"><p className="font-label-sm text-on-surface-variant">Dung lượng</p><p className="font-display-lg text-headline-md font-bold">{(kbStats.totalSize / 1024).toFixed(2)} KB</p></div>
                    </>
                  )}
                </div>
              ) : <p className="text-on-surface-variant py-3">Đang tải...</p>}
            </div>
          </div>

          <div className="p-5 bg-tertiary/5 rounded-2xl border border-tertiary/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-tertiary">api</span>
              <h4 className="font-label-md font-bold">Endpoints</h4>
            </div>
            <div className="font-mono text-xs space-y-1 text-on-surface-variant">
              <p>• GET /api/health</p>
              <p>• GET /api/users | PATCH /api/users/:id</p>
              <p>• GET /api/knowledge/stats | GET /api/knowledge/search</p>
              <p>• GET /api/admin/logs | GET /api/admin/analytics</p>
              <p>• POST /api/auth/login | POST /api/auth/register</p>
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
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <p className="font-label-md">{label}</p>
        <p className="font-label-sm text-on-surface-variant">{desc}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={clsx(
          'relative w-12 h-7 rounded-full transition-colors flex-shrink-0',
          enabled ? 'bg-primary' : 'bg-outline-variant'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
            enabled && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}