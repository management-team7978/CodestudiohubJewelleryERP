import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eef4ff',100:'#dbe7ff',200:'#bcd1ff',300:'#8fb0fb',400:'#6d95f0',500:'#4f83e8',600:'#3b69cc',700:'#2f54a6',800:'#274585',900:'#1f3868' },
        leaf: { 50:'#effaf1',100:'#d8f1dc',500:'#4a9b5b',600:'#3b8049',700:'#2f673b' },
        ink: { 900:'#0b0d14', 800:'#12151f', 700:'#1b2030', 600:'#2a3042' },
        gold: { 300:'#f3d98a', 400:'#e8c35c', 500:'#d4a72c', 600:'#b08a1a' },
      },
      fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.12)' },
    },
  },
  plugins: [],
} satisfies Config;
