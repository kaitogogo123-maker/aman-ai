import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: ['.next/**', '.open-next/**', '.wrangler/**', 'out/**', 'dist/**', 'coverage/**']
  },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@next/next/no-img-element': 'off'
    }
  }
];

export default eslintConfig;
