import { Zap, Infinity as InfinityIcon, LogIn, Crown } from 'lucide-react';
import { useAuthStore, useAnonQuotaStore, useAuthModalStore, usePaywallModalStore, useLanguageStore, useSystemSettingsStore } from '@/stores';

export function QuotaIndicator() {
  const user = useAuthStore((s) => s.user);
  const anon = useAnonQuotaStore();
  const authModal = useAuthModalStore();
  const paywall = usePaywallModalStore();
  const language = useLanguageStore((s) => s.language ?? 'vi');
  const systemSettings = useSystemSettingsStore();

  const labels = {
    vi: { outOfQuota: 'Đã hết lượt miễn phí', trialUsage: 'Lượt dùng thử (chưa đăng nhập)', proUnlimited: 'Gói Pro — không giới hạn', remaining: 'Còn', usages: 'lượt', unlimited: 'Không giới hạn' },
    en: { outOfQuota: 'Free quota exhausted', trialUsage: 'Trial usage (not logged in)', proUnlimited: 'Pro Plan — unlimited', remaining: 'Remaining', usages: 'usages', unlimited: 'Unlimited' },
    ar: { outOfQuota: 'انتهت الحصة المجانية', trialUsage: 'الاستخدام التجريبي (لم يتم تسجيل الدخول)', proUnlimited: 'خطة برو — غير محدود', remaining: 'متبقي', usages: 'استخدامات', unlimited: 'غير محدود' },
    fr: { outOfQuota: 'Quota gratuit épuisé', trialUsage: 'Utilisation d\'essai (non connecté)', proUnlimited: 'Plan Pro — illimité', remaining: 'Restant', usages: 'utilisations', unlimited: 'Illimité' },
  };
  const l = labels[language as keyof typeof labels] || labels.vi;

  if (!user) {
    // Anonymous user - use system settings for limit
    const serverLimit = systemSettings.anonymousLimit;
    const isUnlimited = serverLimit === -1;
    const remaining = isUnlimited ? -1 : Math.max(0, serverLimit - anon.used);
    const percent = isUnlimited ? 100 : (anon.used / serverLimit) * 100;
    const isLow = !isUnlimited && remaining <= 1;
    const isOut = !isUnlimited && remaining === 0;

    if (isUnlimited) {
      return (
        <button
          onClick={() => authModal.open('login')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/60 text-green-700 hover:from-green-100 hover:to-emerald-100 transition-all"
          title={l.trialUsage}
        >
          <InfinityIcon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black tracking-tight">{l.unlimited}</span>
          <LogIn className="w-3 h-3 opacity-50" />
        </button>
      );
    }

    return (
      <button
        onClick={() => isOut ? authModal.open('register') : authModal.open('login')}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
          isOut
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : isLow
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200/60 text-violet-700 hover:from-violet-100 hover:to-blue-100'
        }`}
        title={isOut ? l.outOfQuota : l.trialUsage}
      >
        {isOut ? (
          <Crown className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5" fill="currentColor" />
        )}
        <span className="text-[11px] font-black tracking-tight">
          {anon.used}/{serverLimit}
        </span>
        {!isOut && (
          <LogIn className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        )}
        {isLow && !isOut && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        )}
        <div className="hidden md:block w-12 h-1 rounded-full bg-white/60 overflow-hidden">
          <div
            className={`h-full transition-all ${
              isOut ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-gradient-to-r from-violet-500 to-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </button>
    );
  }

  const limit = user.quotaLimit;
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - user.quotaUsed);
  const isPro = user.plan === 'pro' || user.plan === 'enterprise';
  const isOut = !isUnlimited && remaining === 0;
  const isLow = !isUnlimited && remaining <= 2;

  return (
    <button
      onClick={() => isOut ? paywall.open('user_exhausted') : undefined}
      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
        isPro
          ? 'bg-gradient-to-r from-violet-500 to-blue-500 border-violet-500 text-white shadow-md shadow-violet-500/30'
          : isOut
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : isLow
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200/60 text-violet-700 hover:from-violet-100 hover:to-blue-100'
      }`}
      title={isUnlimited ? l.proUnlimited : `${l.remaining} ${remaining}/${limit} ${l.usages}`}
    >
      {isPro ? (
        <Crown className="w-3.5 h-3.5" fill="currentColor" />
      ) : isUnlimited ? (
        <InfinityIcon className="w-3.5 h-3.5" />
      ) : (
        <Zap className="w-3.5 h-3.5" fill="currentColor" />
      )}
      <span className="text-[11px] font-black tracking-tight">
        {isUnlimited ? `${user.plan.toUpperCase()}` : `${remaining}/${limit}`}
      </span>
      {!isPro && !isUnlimited && (
        <div className="hidden md:block w-12 h-1 rounded-full bg-white/60 overflow-hidden">
          <div
            className={`h-full transition-all ${
              isOut ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-gradient-to-r from-violet-500 to-blue-500'
            }`}
            style={{ width: `${(user.quotaUsed / limit) * 100}%` }}
          />
        </div>
      )}
    </button>
  );
}
