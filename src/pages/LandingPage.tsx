import { Header, Footer } from '@/components';
import { useTranslation } from '@/lib/translations';
import { useAuthStore, useAuthModalStore } from '@/stores';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Bot, Users, Target, ShieldCheck, Globe2, CheckCircle2, Mic, Image as ImageIcon, Cpu } from 'lucide-react';

const FEATURES = [
  { iconKey: 'feat1', Icon: Sparkles, color: 'violet' },
  { iconKey: 'feat2', Icon: Cpu, color: 'blue' },
  { iconKey: 'feat3', Icon: CheckCircle2, color: 'amber' },
  { iconKey: 'feat4', Icon: Globe2, color: 'emerald' },
  { iconKey: 'feat5', Icon: Target, color: 'rose' },
  { iconKey: 'feat6', Icon: ShieldCheck, color: 'cyan' },
] as const;

export function LandingPage() {
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const authModal = useAuthModalStore();
  const navigate = useNavigate();

  const handlePrimaryCta = () => {
    if (user) navigate('/chat');
    else authModal.open('register');
  };

  const colorMap: Record<string, { wrap: string; bg: string; icon: string }> = {
    violet: { wrap: 'hover:border-violet-400', bg: 'bg-violet-100', icon: 'text-violet-600' },
    blue: { wrap: 'hover:border-blue-400', bg: 'bg-blue-100', icon: 'text-blue-600' },
    amber: { wrap: 'hover:border-amber-400', bg: 'bg-amber-100', icon: 'text-amber-600' },
    emerald: { wrap: 'hover:border-emerald-400', bg: 'bg-emerald-100', icon: 'text-emerald-600' },
    rose: { wrap: 'hover:border-rose-400', bg: 'bg-rose-100', icon: 'text-rose-600' },
    cyan: { wrap: 'hover:border-cyan-400', bg: 'bg-cyan-100', icon: 'text-cyan-600' },
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 overflow-x-hidden">
      <Header />

      {/* ──────────────────────────  HERO  ────────────────────────── */}
      <main className="relative w-full min-h-[90vh] flex items-center justify-center pt-28 pb-20 px-6 md:px-12">
        {/* Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-violet-100 via-blue-50 to-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-300/20 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            {/* Left: copy */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white border border-violet-200 shadow-sm">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">
                  {t('landing.badge')}
                </span>
              </div>

              <h1 className="font-black text-4xl md:text-5xl lg:text-6xl text-zinc-900 leading-[1.1] mb-6 tracking-tight">
                {t('landing.title')}
              </h1>

              <p className="text-base md:text-lg text-zinc-600 mb-8 max-w-xl leading-relaxed">
                {t('landing.desc')}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-8">
                <button
                  onClick={handlePrimaryCta}
                  className="inline-flex items-center gap-2 bg-violet-500 text-white px-7 py-3.5 rounded-full font-bold text-sm border-2 border-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all active:shadow-none active:translate-x-0 active:translate-y-0"
                >
                  <Bot className="w-4 h-4" />
                  {t('landing.ctaPrimary')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 bg-white text-zinc-900 px-7 py-3.5 rounded-full font-bold text-sm border-2 border-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  {t('landing.ctaSecondary')}
                </a>
              </div>

              {/* Trust line */}
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
                {t('landing.trust')}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-zinc-500/80">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> ISO 9999
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> WCAG 2.2 AAA
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> WHO GATE
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> GDPR
                </span>
              </div>
            </div>

            {/* Right: visual */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-blue-500/10 rounded-3xl" />
              <div className="relative bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                {/* Mock chat */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">MADA AI</div>
                    <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* User */}
                  <div className="flex justify-end">
                    <div className="bg-violet-100 text-zinc-900 px-4 py-2.5 rounded-2xl rounded-tr-md text-sm max-w-[85%]">
                      {language === 'vi'
                        ? 'Tôi cần xe lăn cho người bại liệt hai chân, ngân sách 15 triệu'
                        : language === 'fr'
                        ? 'J\'ai besoin d\'un fauteuil roulant pour paraplégique, budget 15M'
                        : language === 'ar'
                        ? 'أحتاج إلى كرسي متحرك لشخص مصاب بالشلل، ميزانية 15 مليون'
                        : 'I need a wheelchair for paraplegic use, budget $600'}
                    </div>
                  </div>

                  {/* AI: text */}
                  <div className="flex">
                    <div className="bg-zinc-100 px-4 py-2.5 rounded-2xl rounded-tl-md text-sm max-w-[90%]">
                      <div className="font-bold mb-1">MADA:</div>
                      <p className="text-zinc-700 leading-relaxed">
                        {language === 'vi'
                          ? 'Với ngân sách 15 triệu, tôi đề xuất 3 mẫu xe lăn phù hợp ISO 9999:'
                          : language === 'fr'
                          ? 'Avec un budget de 600€, je recommande 3 fauteuils conformes ISO 9999:'
                          : language === 'ar'
                          ? 'بميزانية 600 دولار، أقترح 3 كراسي مطابقة لـ ISO 9999:'
                          : 'With a $600 budget, I recommend 3 wheelchairs meeting ISO 9999:'}
                      </p>
                      <ol className="mt-2 space-y-1 text-zinc-700">
                        <li>• Karma S-Ergo 125 — ISO 12.22.09</li>
                        <li>• Ottobock Start — ISO 12.22.18</li>
                        <li>• Invacare Action 3 — ISO 12.22.09</li>
                      </ol>
                    </div>
                  </div>

                  {/* AI: product cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-zinc-200 rounded-lg p-2 bg-white">
                        <div className="aspect-square bg-gradient-to-br from-zinc-100 to-zinc-50 rounded mb-1.5 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-zinc-300" />
                        </div>
                        <div className="text-[9px] font-bold truncate">Wheelchair #{i}</div>
                        <div className="text-[9px] text-violet-600 font-bold">12.22.{i}9</div>
                      </div>
                    ))}
                  </div>

                  {/* Mic button */}
                  <div className="flex justify-end pt-1">
                    <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
                      <Mic className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-white border-2 border-zinc-900 rounded-2xl px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rotate-3">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold">WCAG AAA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 md:mt-24">
            {[
              { v: '10K+', k: t('landing.statsUsers') },
              { v: '50K+', k: t('landing.statsConvos') },
              { v: '96%', k: t('landing.statsAccuracy') },
              { v: '7', k: t('landing.statsCategories') },
            ].map((s) => (
              <div
                key={s.k}
                className="bg-white border-2 border-zinc-900 p-5 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="text-3xl md:text-4xl font-black text-violet-600">{s.v}</div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ──────────────────────────  FEATURES  ────────────────────────── */}
      <section className="bg-white py-20 md:py-28 px-6 md:px-12 border-y-2 border-zinc-200" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-2 block">
              {t('landing.featuresBadge')}
            </span>
            <h2 className="font-black text-3xl md:text-4xl tracking-tight">{t('landing.featuresTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ iconKey, Icon, color }) => {
              const c = colorMap[color];
              return (
                <div
                  key={iconKey}
                  className={`group bg-zinc-50 border-2 border-zinc-200 p-6 transition-all hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 ${c.wrap}`}
                >
                  <div className={`w-12 h-12 ${c.bg} flex items-center justify-center mb-4 border-2 border-zinc-900`}>
                    <Icon className={`w-6 h-6 ${c.icon}`} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{t(`landing.${iconKey}Title`)}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{t(`landing.${iconKey}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────  HOW IT WORKS  ────────────────────────── */}
      <section className="bg-zinc-50 py-20 md:py-28 px-6 md:px-12" id="how">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-black text-3xl md:text-4xl text-center mb-12 tracking-tight">
            {t('landing.howTitle')}
          </h2>

          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-start gap-5 bg-white border-2 border-zinc-200 p-6 hover:border-violet-400 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    i === 1 ? 'bg-violet-500' : i === 2 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                >
                  {i}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{t(`landing.how${i}Title`)}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{t(`landing.how${i}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────  STANDARDS  ────────────────────────── */}
      <section className="bg-zinc-900 py-20 md:py-28 px-6 md:px-12 text-white" id="standards">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-black text-3xl md:text-4xl mb-10 tracking-tight">{t('landing.standardsTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-zinc-800 border-2 border-zinc-700 p-6 hover:border-violet-400 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-violet-500/20 flex items-center justify-center border border-violet-400">
                  <CheckCircle2 className="w-6 h-6 text-violet-400" strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-xl">{t('landing.isoTitle')}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('landing.isoDesc')}</p>
            </div>

            <div className="bg-zinc-800 border-2 border-zinc-700 p-6 hover:border-blue-400 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center border border-blue-400">
                  <Users className="w-6 h-6 text-blue-400" strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-xl">{t('landing.wcagTitle')}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('landing.wcagDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────  FINAL CTA  ────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-500 via-violet-600 to-blue-600 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="font-black text-3xl md:text-4xl mb-4 tracking-tight">
            {t('landing.ctaFinalTitle')}
          </h2>
          <p className="text-violet-100 text-lg mb-8 max-w-xl mx-auto">
            {t('landing.ctaFinalDesc')}
          </p>
          <button
            onClick={handlePrimaryCta}
            className="inline-flex items-center gap-2 bg-white text-violet-700 px-8 py-4 rounded-full font-bold text-sm border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
          >
            {t('landing.ctaFinalButton')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default LandingPage;
