/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#060912', up: '#2EE6A6', down: '#FF5D7D', muted: '#8A93AD',
        gold: '#F2C14E', diamond: '#5CE1FF', bitcoin: '#B38CFF',
      },
    },
  },
  plugins: [],
};
