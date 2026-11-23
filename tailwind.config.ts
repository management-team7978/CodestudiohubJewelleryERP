import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#f4f7fb',100:'#e6edf5',200:'#c9d7e8',300:'#9bb4d0',400:'#5d7fa3',500:'#002144',600:'#001b38',700:'#00152c',800:'#000f20',900:'#000814' },
        leaf: { 50:'#effaf1',100:'#d8f1dc',500:'#4a9b5b',600:'#3b8049',700:'#2f673b' },
        ink: { 900:'#00101f', 800:'#002144', 700:'#16324d', 600:'#2c4a66' },
        gold: { 300:'#f3d98a', 400:'#e8c35c', 500:'#d4a72c', 600:'#b08a1a' },
      },
      fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.12)' },
    },
  },
  plugins: [],
} satisfies Config;
