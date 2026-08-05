import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Building2, Loader2, Crown, ArrowRight, Zap } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';
import { useAuthStore, useAuthModalStore, usePaywallModalStore } from '@/stores';
import type { UserPlan } from '@/types';

interface Plan {
  id: UserPlan;
  name: string;
  price: string;
  priceNote: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0đ',
    priceNote: 'vĩnh viễn',
    desc: 'Trải nghiệm MADA AI cơ bản cho người dùng cá nhân.',
    features: [
      '10 lượt trò chuyện miễn phí',
      'Truy cập 7 danh mục AT chuẩn ISO 9999',
      'Tra cứu tiêu chuẩn ISO/WCAG/WHO',
      'Gợi ý sản phẩm AT phù hợp',
      'Hỗ trợ qua cộng đồng',
    ],
    cta: 'Bắt đầu miễn phí',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '299.000đ',
    priceNote: '/tháng',
    desc: 'Dành cho chuyên gia AT và người dùng thường xuyên.',
    features: [
      'Không giới hạn lượt trò chuyện',
      'Phân tích chuyên sâu theo ISO 9999',
      'Xuất báo cáo PDF chuyên nghiệp',
      'Lịch sử hội thoại không giới hạn',
      'Hỗ trợ ưu tiên 24/7',
      'Tích hợp API nâng cao',
      'Truy cập sớm tính năng mới',
    ],
    highlight: true,
    cta: 'Nâng cấp Pro ngay',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Liên hệ',
    priceNote: 'báo giá',
    desc: 'Giải pháp cho tổ chức, trường học, bệnh viện, chính phủ.',
    features: [
      'Mọi tính năng của Pro',
      'Dashboard quản trị đa người dùng',
      'Tùy chỉnh tri thức & dữ liệu riêng',
      'SLA 99.9% & bảo mật cấp doanh nghiệp',
      'Đào tạo chuyên gia AT chuyên trách',
      'Triển khai on-premise tùy chọn',
      'Hỗ trợ riêng 24/7 qua hotline',
    ],
    cta: 'Liên hệ tư vấn',
  },
];

const FAQS = [
  {
    q: 'MADA AI có hỗ trợ tiếng Việt không?',
    a: 'Có. MADA AI được tối ưu hoàn toàn cho tiếng Việt, đồng thời hỗ trợ tiếng Anh, Pháp và tiếng Ả-rập. Bạn có thể chuyển đổi ngôn ngữ bất kỳ lúc nào.',
  },
  {
    q: 'Tôi có thể hủy gói Pro bất kỳ lúc nào không?',
    a: 'Được. Bạn có thể hủy gói Pro bất kỳ lúc nào trong phần Cài đặt tài khoản. Gói sẽ vẫn active đến hết chu kỳ thanh toán hiện tại.',
  },
  {
    q: 'Dữ liệu của tôi có được bảo mật không?',
    a: 'Tuyệt đối. Toàn bộ cuộc trò chuyện được mã hoá AES-256. Chúng tôi không bán dữ liệu cho bên thứ ba và tuân thủ GDPR + Nghị định 13/2023/NĐ-CP của Việt Nam.',
  },
  {
    q: 'Gói Enterprise có triển khai on-premise không?',
    a: 'Có. Gói Enterprise hỗ trợ triển khai on-premise (on-premise) cho các tổ chức yêu cầu bảo mật dữ liệu tuyệt đối. Liên hệ sales@mada.ai để được tư vấn chi tiết.',
  },
  {
    q: 'Có dùng thử miễn phí gói Pro không?',
    a: 'Có. Khi đăng ký lần đầu, bạn nhận 7 ngày dùng thử Pro miễn phí — không cần thẻ tín dụng. Sau 7 ngày bạn có thể tiếp tục dùng Free hoặc nâng cấp Pro.',
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPlan = useAuthStore((s) => s.setPlan);
  const resetQuota = useAuthStore((s) => s.resetQuota);
  const authModal = useAuthModalStore();
  const paywall = usePaywallModalStore();
  const [loadingPlan, setLoadingPlan] = useState<UserPlan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleChoose = async (plan: UserPlan) => {
    if (plan === 'enterprise') {
      window.open('mailto:sales@mada.ai?subject=MADA%20Enterprise%20Inquiry', '_blank');
      return;
    }
    if (!user) {
      authModal.open('register');
      return;
    }
    if (user.plan === plan) {
      navigate('/chat');
      return;
    }
    setLoadingPlan(plan);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setPlan(plan);
      resetQuota();
      paywall.close();
      navigate('/chat');
    } catch (err) {
      console.error('Pricing plan error:', err);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50/40">
      <Header />

      {/* Hero */}
      <section className="pt-40 pb-12 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-violet-200 backdrop-blur mb-6">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Bảng giá</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-violet-600 via-blue-500 to-violet-600 bg-clip-text text-transparent">
            Chọn gói phù hợp
          </span>
          <br />
          với nhu cầu của bạn
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          Bắt đầu miễn phí với 10 lượt trò chuyện. Nâng cấp lên Pro để mở khóa toàn bộ sức mạnh MADA AI.
        </p>
      </section>

      {/* Plan cards */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 transition-all hover:-translate-y-1 ${
                plan.highlight ? 'shadow-2xl shadow-violet-500/30 scale-[1.02]' : 'shadow-lg'
              }`}
              style={{
                background: plan.highlight
                  ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(245,243,255,1) 100%)'
                  : 'white',
                border: plan.highlight ? '2px solid transparent' : '1px solid rgba(226,232,240,1)',
                ...(plan.highlight && {
                  backgroundImage:
                    'linear-gradient(white, white), linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                }),
              }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                  <Crown className="w-3 h-3" fill="currentColor" />
                  Phổ biến nhất
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                {plan.id === 'enterprise' ? (
                  <Building2 className="w-5 h-5 text-slate-500" />
                ) : (
                  <Sparkles className={`w-5 h-5 ${plan.highlight ? 'text-violet-500' : 'text-slate-400'}`} />
                )}
                <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
              </div>

              <div className="flex items-baseline gap-1.5 mb-2">
                <span className={`text-4xl font-black tracking-tight ${plan.highlight ? 'bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                  {plan.price}
                </span>
                <span className="text-xs font-bold text-slate-400">{plan.priceNote}</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">{plan.desc}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                      plan.highlight ? 'bg-violet-100' : 'bg-slate-100'
                    }`}>
                      <Check className={`w-3 h-3 ${plan.highlight ? 'text-violet-600' : 'text-slate-500'}`} strokeWidth={3} />
                    </div>
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChoose(plan.id)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
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
                ) : user?.plan === plan.id ? (
                  <>
                    <Zap className="w-4 h-4" />
                    Đang dùng — Tiếp tục
                  </>
                ) : (
                  <>
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Tất cả gói đều bao gồm cập nhật miễn phí & hỗ trợ qua email. Thanh toán an toàn qua Stripe / PayPal / VNPay.
        </p>
      </section>

      {/* Compare features - highlight */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-2xl font-black mb-6 text-center">So sánh tính năng</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-slate-400">Tính năng</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-slate-400">Free</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-violet-600">Pro</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-slate-400">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['Lượt trò chuyện', '10', 'Không giới hạn', 'Không giới hạn'],
                  ['Danh mục AT (ISO 9999)', '7', '7 + Chuyên sâu', '7 + Tùy chỉnh'],
                  ['Tiêu chuẩn ISO/WCAG/WHO', '✓', '✓', '✓'],
                  ['Xuất báo cáo PDF', '—', '✓', '✓'],
                  ['Lịch sử hội thoại', '7 ngày', 'Không giới hạn', 'Không giới hạn'],
                  ['Hỗ trợ ưu tiên', '—', '24/7', '24/7 + Hotline'],
                  ['Triển khai on-premise', '—', '—', '✓'],
                  ['SLA', '—', '99%', '99.9%'],
                ].map(([feat, free, pro, ent]) => (
                  <tr key={feat} className="border-b border-slate-100">
                    <td className="py-3 px-2 font-medium text-slate-700">{feat}</td>
                    <td className="py-3 px-2 text-center text-slate-500">{free}</td>
                    <td className="py-3 px-2 text-center font-bold text-violet-600">{pro}</td>
                    <td className="py-3 px-2 text-center text-slate-500">{ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-32 max-w-3xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-10">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {FAQS.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="font-bold text-slate-900">{item.q}</span>
                <span className={`text-slate-400 transition-transform text-2xl ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-slate-600 text-sm leading-relaxed animate-in slide-in-from-top-2">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Footer />

      <AuthModal />
      <PaywallModal />
    </div>
  );
}