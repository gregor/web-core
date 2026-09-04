import { defineAppConfig } from '@gregor_herdmann/web-core/vite';

export default defineAppConfig({
  root: import.meta.dirname,
  chunks: {
    'vendor-react': ['react', 'react-dom', 'react-is', 'react-router', 'react-router-dom', 'scheduler'],
  },
});
