/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: { DEFAULT: '#00d4ff', dark: '#0099bb' },
        violet: { DEFAULT: '#7c3aed', light: '#a855f7' },
        sentinel: {
          bg: '#050b14',
          panel: '#0a1628',
          card: '#0f1f38',
          elevated: '#162240',
          border: 'rgba(0, 212, 255, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
