import { clsx } from 'clsx';

interface RobotLogoProps {
  className?: string;
  variant?: 'brand' | 'mono' | 'white';
}

const palette = {
  brand: {
    body: 'url(#robot-brand-body)',
    accent: '#006572',
    accentSoft: '#008B8B',
    eye: '#0f172a',
    glow: '#40E0D0',
  },
  mono: {
    body: '#0f172a',
    accent: '#0f172a',
    accentSoft: '#334155',
    eye: '#ffffff',
    glow: '#94a3b8',
  },
  white: {
    body: '#ffffff',
    accent: '#ffffff',
    accentSoft: '#e2e8f0',
    eye: '#0f172a',
    glow: '#cbd5e1',
  },
};

export function RobotLogo({ className, variant = 'brand' }: RobotLogoProps) {
  const p = palette[variant];

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('flex-shrink-0', className)}
      aria-hidden="true"
    >
      {variant === 'brand' && (
        <defs>
          <linearGradient id="robot-brand-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#006572" />
            <stop offset="100%" stopColor="#008B8B" />
          </linearGradient>
        </defs>
      )}

      {/* Antenna */}
      <line x1="32" y1="9" x2="32" y2="16" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="7" r="2.5" fill={p.accent} />
      <circle cx="32" cy="7" r="1.2" fill={p.glow} />

      {/* Head */}
      <rect x="11" y="16" width="42" height="30" rx="9" ry="9" fill={p.body} stroke={p.accent} strokeWidth="2" />

      {/* Side ears */}
      <rect x="7" y="24" width="4" height="14" rx="2" fill={p.accent} />
      <rect x="53" y="24" width="4" height="14" rx="2" fill={p.accent} />

      {/* Eyes */}
      <circle cx="22" cy="30" r="4" fill={p.eye} />
      <circle cx="42" cy="30" r="4" fill={p.eye} />
      <circle cx="23.5" cy="28.5" r="1.2" fill="#ffffff" />
      <circle cx="43.5" cy="28.5" r="1.2" fill="#ffffff" />

      {/* Smile (mouth) */}
      <path
        d="M 24 38 Q 32 42 40 38"
        stroke={p.eye}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Neck */}
      <rect x="27" y="46" width="10" height="4" rx="1.5" fill={p.accent} />

      {/* Body */}
      <rect x="15" y="50" width="34" height="8" rx="3" fill={p.body} stroke={p.accent} strokeWidth="2" />

      {/* Chest LED */}
      <circle cx="32" cy="54" r="2" fill={p.glow} />
    </svg>
  );
}

export default RobotLogo;
