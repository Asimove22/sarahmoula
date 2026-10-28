/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        // Rouge Clausia : bandes obliques, boutons, éléments actifs.
        brand: {
          50: '#FFF1F1',
          100: '#FFE0E0',
          200: '#FFC6C5',
          300: '#F19A97',
          400: '#EC5A55',
          500: '#E1251B',
          600: '#D7000F',
          700: '#B3000C',
          800: '#8F0A10',
          900: '#6E0D12',
          950: '#3D0306',
        },
        // Anthracite : barre latérale et typographie de marque.
        ink: {
          700: '#3A3A39',
          800: '#2B2B2A',
          900: '#1F1F1E',
          950: '#141413',
        },
      },
    },
  },
  plugins: [],
};
