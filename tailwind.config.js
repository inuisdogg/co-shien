/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: '#00c4cc',
        'primary-dark': '#00b0b8',
        'primary-light': '#e0fafb',
        personal: '#818CF8',
        'personal-dark': '#6366F1',
        'personal-light': '#EEF0FF',
        client: '#F6AD55',
        'client-dark': '#ED8936',
        'client-light': '#FFF8F0',
        // Semantic colors
        success: '#10b981',
        'success-light': '#d1fae5',
        warning: '#f59e0b',
        'warning-light': '#fef3c7',
        danger: '#ef4444',
        'danger-light': '#fee2e2',
        info: '#3b82f6',
        'info-light': '#dbeafe',
      },
    },
  },
  plugins: [],
}
