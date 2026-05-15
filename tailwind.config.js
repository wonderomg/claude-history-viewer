/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        t: {
          bg: 'rgb(var(--t-bg) / <alpha-value>)',
          raised: 'rgb(var(--t-bg-raised) / <alpha-value>)',
          overlay: 'rgb(var(--t-bg-overlay) / <alpha-value>)',
          text: 'rgb(var(--t-text) / <alpha-value>)',
          muted: 'rgb(var(--t-text-muted) / <alpha-value>)',
          border: 'rgb(var(--t-border) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--t-bg) / <alpha-value>)',
          raised: 'rgb(var(--t-bg-raised) / <alpha-value>)',
          overlay: 'rgb(var(--t-bg-overlay) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#d97757',
          muted: '#b85c3f',
        },
      },
      transitionDuration: {
        theme: '350ms',
      },
    },
  },
  plugins: [],
}
