import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('--bg'),
        surface: c('--surface'),
        'surface-raised': c('--surface-raised'),
        'surface-sunken': c('--surface-sunken'),
        text: {
          DEFAULT: c('--text'),
          secondary: c('--text-secondary'),
          muted: c('--text-muted'),
          inverse: c('--text-inverse'),
        },
        border: {
          DEFAULT: c('--border'),
          strong: c('--border-strong'),
        },
        accent: {
          DEFAULT: c('--accent'),
          hover: c('--accent-hover'),
          soft: c('--accent-soft'),
        },
        tier: {
          cheap: { DEFAULT: c('--tier-cheap'), bg: c('--tier-cheap-bg'), bd: c('--tier-cheap-bd'), solid: c('--tier-cheap-solid') },
          mid: { DEFAULT: c('--tier-mid'), bg: c('--tier-mid-bg'), bd: c('--tier-mid-bd'), solid: c('--tier-mid-solid') },
          strong: { DEFAULT: c('--tier-strong'), bg: c('--tier-strong-bg'), bd: c('--tier-strong-bd'), solid: c('--tier-strong-solid') },
        },
        success: c('--success'),
        warning: c('--warning'),
        danger: { DEFAULT: c('--danger'), bg: c('--danger-bg'), solid: c('--danger-solid') },
        savings: c('--savings'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        accent: 'var(--shadow-accent)',
      },
      maxWidth: {
        column: '768px',
        council: '1120px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        settle: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        printIn: {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0 0 0)' },
        },
        blinkSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
      },
      animation: {
        settle: 'settle 200ms cubic-bezier(0.22,1,0.36,1)',
        printIn: 'printIn 200ms cubic-bezier(0.22,1,0.36,1)',
        blinkSoft: 'blinkSoft 1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
