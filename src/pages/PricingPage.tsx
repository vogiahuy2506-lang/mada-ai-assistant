import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Building2, Loader2, Crown, ArrowRight, Zap, Plus, ShieldCheck, Clock, Mail, Phone, Globe2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuthStore, useAuthModalStore, usePaywallModalStore } from '@/stores';
import { useTranslation } from '@/lib/translations';
import type { UserPlan } from '@/types';
import clsx from 'clsx';

interface PlanTranslation {
  descKey: string;
  features: string[];
  cta: () => string;
}

interface Plan {
  id: UserPlan;
  name: string;
  priceMonthly: number | 'contact';
  priceYearly: number | 'contact';
  priceDisplay: { vi: string; en: string; ar: string; fr: string };
  priceNote: { vi: string; en: string; ar: string; fr: string };
  highlight?: boolean;
  translations: PlanTranslation;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    priceDisplay: { vi: '0đ', en: '$0', ar: '0', fr: '0€' },
    priceNote: {
      vi: 'vĩnh viễn',
      en: 'forever',
      ar: 'للأبد',
      fr: 'à vie',
    },
    translations: {
      descKey: 'freeDesc',
      features: ['freeF1', 'freeF2', 'freeF3', 'freeF4', 'freeF5'],
      cta: () => 'pricing.ctaFree',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 299000,
    priceYearly: 299000 * 12 * 0.8, // 20% off
    priceDisplay: { vi: '299.000đ', en: '$12', ar: '$12', fr: '12€' },
    priceNote: {
      vi: '/tháng',
      en: '/month',
      ar: '/شهر',
      fr: '/mois',
    },
    highlight: true,
    translations: {
      descKey: 'proDesc',
      features: ['proF1', 'proF2', 'proF3', 'proF4', 'proF5', 'proF6', 'proF7'],
      cta: () => 'pricing.ctaPro',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 'contact',
    priceYearly: 'contact',
    priceDisplay: {
      vi: 'Liên hệ',
      en: 'Contact',
      ar: 'تواصل',
      fr: 'Contact',
    },
    priceNote: {
      vi: 'báo giá',
      en: 'quote',
      ar: 'تسعير',
      fr: 'devis',
    },
    translations: {
      descKey: 'enterpriseDesc',
      features: ['entF1', 'entF2', 'entF3', 'entF4', 'entF5', 'entF6', 'entF7'],
      cta: () => 'pricing.ctaEnterprise',
    },
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setPlan = useAuthStore((s) => s.setPlan);
  const resetQuota = useAuthStore((s) => s.resetQuota);
  const authModal = useAuthModalStore();
  const paywall = usePaywallModalStore();
  const [loadingPlan, setLoadingPlan] = useState<UserPlan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
      // Simulate API call - in production this would call /api/billing/subscribe
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

  // Localized content (kept here because feature strings contain marketing copy
  // best maintained alongside the plan definitions)
  const localFeatures = (keys: string[]): string[] =>
    keys.map((k) => t(`pricing.${k}` as any));

  const localDesc = (key: string): string =>
    t(`pricing.${key}` as any);

  // Toggle component: monthly / yearly with savings badge
  const BillingToggle = (
    <div className="flex justify-center mb-10">
      <div className="inline-flex items-center gap-1 p-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-bold transition-all',
            billingCycle === 'monthly'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          )}
        >
          {t('pricing.monthly')}
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2',
            billingCycle === 'yearly'
              ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          )}
        >
          {t('pricing.yearly')}
          <span
            className={clsx(
              'text-[9px] font-black px-1.5 py-0.5 rounded',
              billingCycle === 'yearly'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {t('pricing.saveNote')}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50/40">
      <Header />

      {/* Hero */}
      <section className="pt-36 pb-10 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-violet-200 backdrop-blur mb-6">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">
            {t('pricing.badge')}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-violet-600 via-blue-500 to-violet-600 bg-clip-text text-transparent">
            {t('pricing.title')}
          </span>
          <br />
          <span className="text-zinc-900">{t('pricing.titleHighlight')}</span>
        </h1>
        <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {t('pricing.subtitle')}
        </p>
      </section>

      {/* Plan cards */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        {BillingToggle}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isContact = plan.priceMonthly === 'contact';
            const isYearly = billingCycle === 'yearly';
            const priceText = isContact
              ? plan.priceDisplay[language]
              : isYearly && typeof plan.priceYearly === 'number' && plan.priceYearly > 0
              ? plan.priceDisplay[language].replace(/\d+/g, String(Math.round(plan.priceYearly / 12)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
              : plan.priceDisplay[language];

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 transition-all hover:-translate-y-1 ${
                  plan.highlight
                    ? 'shadow-2xl shadow-violet-500/30 scale-[1.02] md:scale-[1.04]'
                    : 'shadow-lg'
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
                    {t('pricing.popular')}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  {plan.id === 'enterprise' ? (
                    <Building2 className="w-5 h-5 text-slate-500" />
                  ) : (
                    <Sparkles
                      className={`w-5 h-5 ${plan.highlight ? 'text-violet-500' : 'text-slate-400'}`}
                    />
                  )}
                  <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                </div>

                <div className="flex items-baseline gap-1.5 mb-2 flex-wrap">
                  <span
                    className={`text-4xl font-black tracking-tight ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent'
                        : 'text-slate-900'
                    }`}
                  >
                    {priceText}
                  </span>
                  {!isContact && (
                    <span className="text-xs font-bold text-slate-400">
                      {plan.priceNote[language]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  {localDesc(plan.translations.descKey)}
                </p>

                <ul className="space-y-3 mb-8 min-h-[220px]">
                  {localFeatures(plan.translations.features).map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                          plan.highlight ? 'bg-violet-100' : 'bg-slate-100'
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 ${
                            plan.highlight ? 'text-violet-600' : 'text-slate-500'
                          }`}
                          strokeWidth={3}
                        />
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
                      {t('pricing.processing')}
                    </>
                  ) : user?.plan === plan.id ? (
                    <>
                      <Zap className="w-4 h-4" />
                      {t('pricing.ctaCurrent')}
                    </>
                  ) : (
                    <>
                      {t(plan.translations.cta() as any)}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">{t('pricing.note')}</p>
      </section>

      {/* Trust strip */}
      <section className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { Icon: ShieldCheck, label: t('pricing.trust1') },
            { Icon: Clock, label: t('pricing.trust2') },
            { Icon: Globe2, label: t('pricing.trust3') },
            { Icon: Sparkles, label: t('pricing.trust4') },
          ].map(({ Icon, label }, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600"
            >
              <Icon className="w-3.5 h-3.5 text-emerald-500" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Compare features */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
          <h2 className="text-2xl font-black mb-6 text-center">{t('pricing.compareTitle')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-slate-400">
                    {t('pricing.featCol')}
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-slate-400">
                    Free
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-violet-600">
                    Pro
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-slate-400">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {(
                  [
                    ['cmpChats', '10', t('pricing.cmpUnlimited'), t('pricing.cmpUnlimited')],
                    ['cmpCategories', '7', '7 + ' + t('pricing.cmpDeep'), '7 + ' + t('pricing.cmpCustom')],
                    ['cmpStandards', '✓', '✓', '✓'],
                    ['cmpPdf', '—', '✓', '✓'],
                    ['cmpHistory', '7 ' + t('pricing.days'), t('pricing.cmpUnlimited'), t('pricing.cmpUnlimited')],
                    ['cmpSupport', '—', '24/7', '24/7 + Hotline'],
                    ['cmpOnPremise', '—', '—', '✓'],
                    ['cmpSLA', '—', '99%', '99.9%'],
                  ] as const
                ).map(([key, free, pro, ent]) => (
                  <tr key={key} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-2 font-medium text-slate-700">{t(`pricing.${key}` as any)}</td>
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
      <section className="px-6 pb-20 max-w-3xl mx-auto" id="faq">
        <h2 className="text-3xl font-black text-center mb-8">{t('pricing.faqTitle')}</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left gap-3"
                aria-expanded={openFaq === i}
              >
                <span className="font-bold text-slate-900 text-sm md:text-base">{t(`pricing.faq${i}Q` as any)}</span>
                <Plus
                  className={clsx(
                    'text-slate-400 transition-transform duration-200 flex-shrink-0',
                    openFaq === i && 'rotate-45'
                  )}
                  size={20}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3 animate-in slide-in-from-top-2">
                  {t(`pricing.faq${i}A` as any)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact CTA below FAQ */}
        <div className="mt-12 bg-gradient-to-br from-violet-50 to-blue-50 rounded-3xl border border-violet-100 p-6 text-center">
          <div className="flex justify-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-violet-600" />
            <Phone className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-sm text-slate-600">
            {language === 'vi'
              ? 'Bạn vẫn còn thắc mắc? Liên hệ đội ngũ MADA để được tư vấn.'
              : language === 'en'
              ? 'Still have questions? Reach out to our MADA team for a personal walkthrough.'
              : language === 'ar'
              ? 'لا تزال لديك أسئلة؟ تواصل مع فريق MADA للحصول على استشارة شخصية.'
              : 'Vous avez encore des questions ? Contactez l\'équipe MADA pour une démonstration personnalisée.'}
          </p>
          <a
            href="mailto:sales@mada.ai"
            className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-full bg-white text-violet-700 text-sm font-bold border-2 border-zinc-900 hover:bg-zinc-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
          >
            <Mail className="w-3.5 h-3.5" />
            sales@mada.ai
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default PricingPage;
