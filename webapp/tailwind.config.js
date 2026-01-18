/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        'neon': {
          purple: '#a855f7',
          blue: '#3b82f6',
          pink: '#ec4899',
          cyan: '#06b6d4',
          green: '#22c55e',
        },
        'dark': {
          bg: '#0a0a0f',
          darker: '#050508',
          card: 'rgba(15, 15, 25, 0.8)',
        },
        'rolia': {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        }
      },
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'body': ['Rajdhani', 'sans-serif'],
        'retro': ['Press Start 2P', 'cursive'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'glitch': 'glitch 0.3s infinite',
        'stars-move': 'starsMove 60s linear infinite',
        'rotate-slow': 'rotate 10s linear infinite',
        'shimmer': 'shimmer 2s infinite',
        'border-glow': 'border-glow 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(10deg)' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        'starsMove': {
          'from': { transform: 'translateY(0)' },
          'to': { transform: 'translateY(-200px)' },
        },
        'rotate': {
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(168, 85, 247, 0.3)' },
          '50%': { borderColor: 'rgba(168, 85, 247, 0.8)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': 'linear-gradient(rgba(168, 85, 247, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
}
