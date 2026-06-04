/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          dz: '#006233',
          dark: '#004d28',
          light: '#00843f',
        },
        gold: {
          dz: '#D4A017',
          light: '#e8b830',
          dark: '#a67c10',
        },
        navy: {
          dz: '#0D1B2A',
          mid: '#152236',
          light: '#1e3048',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
