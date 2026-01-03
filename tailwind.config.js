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
        primary: '#00c4cc',
        'primary-dark': '#00b0b8',
        'personal': '#8b5cf6',
        'personal-dark': '#7c3aed',
      },
    },
  },
  plugins: [],
}


