/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        // Menambahkan 'font-futura' ke dalam Tailwind
        futura: ['Futura', 'sans-serif'], 
      },
    },
  },
  plugins: [],
}