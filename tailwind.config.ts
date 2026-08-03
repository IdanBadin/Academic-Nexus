import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'expert-teal': '#0D9488',
        'student-amber': '#F59E0B',
        'nexus-indigo': '#1E293B',
        cloud: '#F8FAFC',
        status: {
          green: '#16A34A',
          gold: '#EAB308',
          red: '#DC2626',
          slate: '#64748B',
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        control: '12px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        shimmer: 'shimmer 1.6s infinite',
        shake: 'shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
    },
  },
  plugins: [],
} satisfies Config
