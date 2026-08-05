import { useEffect, useState } from 'react';
import { X, Lock, Sparkles, Check, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { usePaywallModalStore, useAuthModalStore, useAuthStore } from '@/stores';
import type { UserPlan } from '@/types';

interface PlanCard {
  id: UserPlan;
  name: string;
  price: string;
  priceNote: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

const PLANS: PlanCard[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0đ',
    priceNote: 'vĩnh viễn',
    desc: 'Dành cho người dùng cá nhân trải nghiệm',
    features: [
      '10 lượt trò chuyện miễn phí',
      'Truy cập 7 danh mục AT',
      'Tra cứu tiêu chuẩn ISO/WCAG/WHO',
      'Hỗ trợ cộng đồng',
    ],
    cta: 'Tiếp tục dùng Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '299.000đ',
    priceNote: '/tháng',
    desc: 'Dành cho chuyên gia & người dùng thường xuyên',
    features: [
      'Không giới hạn lượt trò chuyện',
      'Phân tích chuyên sâu theo ISO 9999',
      'Xuất báo cáo PDF chuyên nghiệp',
      'Lịch sử hội thoại không giới hạn',
      'Hỗ trợ ưu tiên 24/7',
      'Tích hợp API nâng cao',
    ],
    highlight: true,
    cta: 'Nâng cấp Pro ngay',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Liên hệ',
    priceNote: 'báo giá',
    desc: 'Dành cho tổ chức, trường học, bệnh viện',
    features: [
      'Mọi tính năng của Pro',
      'Dashboard quản trị đa người dùng',
      'Tùy chỉnh tri thức riêng',
      'SLA & bảo mật cấp doanh nghiệp',
      'Đào tạo chuyên gia AT chuyên trách',
      'Triển khai on-premise tùy chọn',
    ],
    cta: 'Liên hệ tư vấn',
  },
];

export function PaywallModal() {
  const { isOpen, reason, close } = usePaywallModalStore();
  const authModal = useAuthModalStore();
  const user = useAuthStore((s) => s.user);
  const setPlan = useAuthStore((s) => s.setPlan);
  const resetQuota = useAuthStore((s) => s.resetQuota);

  const [loadingPlan, setLoadingPlan] = useState<UserPlan | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const handleUpgrade = async (plan: UserPlan) => {
    if (plan === 'enterprise') {
      window.open('mailto:sales@mada.ai?subject=MADA%20Enterprise%20Inquiry', '_blank');
      close();
      return;
    }
    if (plan === 'free') {
      close();
      return;
    }
    setLoadingPlan(plan);
    try {
      await new Promise((r) => setTimeout(r, 900));
      if (!user) {
        close();
        authModal.open('register');
        return;
      }
      setPlan(plan);
      resetQuota();
      close();
    } catch (err) {
      console.error('Upgrade error:', err);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleLogin = () => {
    close();
    authModal.open('login');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="relative w-full max-w-5xl my-8 animate-in zoom-in-95 duration-300">
        <button
          onClick={close}
          className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-500 hover:text-slate-900 z-20"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className="relative rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.88) 100%)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-48 opacity-40 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(59,130,246,0.25) 100%)',
            }}
          />

          <div className="relative px-8 pt-10 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/40 mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">
              {reason === 'anonymous_exhausted'
                ? 'Bạn đã dùng hết lượt miễn phí'
                : 'Đã hết lượt trong gói Free'}
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              {reason === 'anonymous_exhausted'
                ? 'Đăng ký miễn phí để tiếp tục trò chuyện với MADA AI — nhận ngay 10 lượt trải nghiệm.'
                : 'Nâng cấp lên Pro để mở khóa cuộc trò chuyện không giới hạn và các tính năng chuyên gia.'}
            </p>

            {!user && (
              <button
                onClick={handleLogin}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm font-bold hover:bg-violet-100 transition-colors"
              >
                Đã có tài khoản? Đăng nhập
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-6 md:px-8 pb-10">
            <div className="grid md:grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 transition-all ${
                    plan.highlight
                      ? 'shadow-2xl shadow-violet-500/30 scale-[1.02]'
                      : 'shadow-md hover:shadow-xl'
                  }`}
                  style={{
                    background: plan.highlight
                      ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(245,243,255,1) 100%)'
                      : 'white',
                    border: plan.highlight
                      ? '2px solid transparent'
                      : '1px solid rgba(226,232,240,1)',
                    ...(plan.highlight && {
                      backgroundImage:
                        'linear-gradient(white, white), linear-gradient(135deg, #8b5cf6, #3b82f6)',
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                    }),
                  }}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                      <Sparkles className="w-3 h-3" />
                      Phổ biến nhất
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    {plan.id === 'enterprise' ? (
                      <Building2 className="w-5 h-5 text-slate-500" />
                    ) : (
                      <Sparkles className={`w-5 h-5 ${plan.highlight ? 'text-violet-500' : 'text-slate-400'}`} />
                    )}
                    <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-3xl font-black tracking-tight ${plan.highlight ? 'bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                      {plan.price}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{plan.priceNote}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-5">{plan.desc}</p>

                  <ul className="space-y-2.5 mb-6 min-h-[180px]">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                        <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-violet-500' : 'text-slate-400'}`} strokeWidth={3} />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                      plan.highlight
                        ? 'text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'
                    }`}
                    style={
                      plan.highlight
                        ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }
                        : undefined
                    }
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      plan.cta
                    )}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-slate-400 mt-6">
              Mọi gói đều có thể hủy bất kỳ lúc nào. Thanh toán an toàn qua Stripe/PayPal/VNPay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
