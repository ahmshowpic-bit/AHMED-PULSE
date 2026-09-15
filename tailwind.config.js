/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./*.tsx",
    "./**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // الربط الذكي للألوان التلقائية (Light/Dark Mode)
        // هذا يمنع أي تضارب مع أكوادك الحالية في App.tsx
        black: 'rgb(var(--theme-base-black) / <alpha-value>)',
        white: 'rgb(var(--theme-base-white) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
