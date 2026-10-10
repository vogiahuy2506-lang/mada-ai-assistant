import { useEffect } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-5 h-5 text-emerald-600" />,
  error: <X className="w-5 h-5 text-rose-600" />,
  info: <Info className="w-5 h-5 text-blue-600" />,
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200',
  error: 'bg-rose-50 border-rose-200',
  info: 'bg-blue-50 border-blue-200',
};

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${bgColors[type]}`}>
        {icons[type]}
        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">{message}</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/60 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
