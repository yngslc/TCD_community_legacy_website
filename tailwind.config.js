/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        tcd: {
          bg: '#0E0B08',
          surface: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.08)',
          gold: '#b9dfde',
          text: '#bfddd7',
          muted: 'rgba(255,255,255,0.4)',
          dim: 'rgba(255,255,255,0.15)',
        }
      }
    },
  },
  plugins: [],
}
