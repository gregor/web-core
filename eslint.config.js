import js from '@eslint/js';
import shared from './config/eslint.js';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test/fixtures/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Node 24 globals this repo actually uses. fetch/Response are how
      // lib/release-notes.js talks to the GitHub API, with no dependency.
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
  ...shared,
];
