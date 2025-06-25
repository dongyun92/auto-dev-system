/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'atc-blue': '#1e40af',
        'atc-green': '#16a34a',
        'atc-yellow': '#facc15',
        'atc-red': '#dc2626',
        'atc-gray': '#374151',
        'atc-dark': '#111827',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}