import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Hard rule 7: no hard-coded UI strings in JSX; use next-intl messages.
      'react/jsx-no-literals': ['warn', { noStrings: true, ignoreProps: true, allowedStrings: ['ImpactOS', 'i', '·', '/', '₹', '—', '|', '×', ':'] }],
    },
  },
  {
    files: ['src/components/ui/**', 'tests/**', 'scripts/**'],
    rules: { 'react/jsx-no-literals': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**', 'playwright-report/**', 'supabase/**']),
]);
