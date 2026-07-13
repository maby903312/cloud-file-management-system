/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        'bg-primary': '#0d1117',
        'bg-secondary': '#161b22',
        'bg-card': '#21262d',
        'border-default': '#30363d',
        accent: '#58a6ff',
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
      },
    },
  },
  plugins: [],
}
