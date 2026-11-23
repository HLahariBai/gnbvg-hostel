/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        cream: '#FFFDF9',
        coral: {
          DEFAULT: '#FF5A36',
          dark: '#E04320',
          light: '#FFF0EC',
        },
        tealhostel: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
          light: '#CCFBF1',
        },
        amberwarm: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        gnbvg: {
          navy: '#0F172A',
          slate: '#334155',
          emerald: '#10B981',
          amber: '#F59E0B',
          crimson: '#DC2626',
        },
      },
      animation: {
        'marquee': 'marquee 28s linear infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scanLine 2.2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.06)', opacity: '0.35' },
        },
        scanLine: {
          '0%, 100%': { top: '12%' },
          '50%': { top: '84%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
