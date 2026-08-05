import { Zap, Infinity as InfinityIcon, LogIn, Crown } from 'lucide-react';
import { useAuthStore, useAnonQuotaStore, useAuthModalStore, usePaywallModalStore } from '@/stores';

export function QuotaIndicator() {
  const user = useAuthStore((s) => s.user);
  const anon = useAnonQuotaStore();
  const authModal = useAuthModalStore();
  const paywall = usePaywallModalStore();

  if (!user) {
    const remaining = anon.remaining();
    const total = anon.limit;
    const percent = total > 0 ? (anon.used / total) * 100 : 100;
    const isLow = remaining <= 1;
    const isOut = remaining === 0;

    return (
      <button
        onClick={() => isOut ? paywall.open('anonymous_exhausted') : authModal.open('login')}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
          isOut
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : isLow
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200/60 text-violet-700 hover:from-violet-100 hover:to-blue-100'
        }`}
        title={isOut ? 'Đã hết lượt miễn phí' : 'Lượt dùng thử (chưa đăng nhập)'}
      >
        {isOut ? (
          <Crown className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5" fill="currentColor" />
        )}
        <span className="text-[11px] font-black tracking-tight">
          {anon.used}/{total}
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
      title={isUnlimited ? 'Gói Pro — không giới hạn' : `Còn ${remaining}/${limit} lượt`}
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
