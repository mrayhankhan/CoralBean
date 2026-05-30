import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          50:  '#FFF1EE',
          100: '#FFDED5',
          200: '#FFB8A6',
          300: '#FF8E72',
          400: '#FF6242',
          500: '#FF3D17',
          600: '#DB2A05',
          700: '#A41E03',
          800: '#6E1303',
          900: '#3D0901',
        },
        risk: {
          healthy: '#10B981',
          watch:   '#F59E0B',
          danger:  '#EF4444',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
