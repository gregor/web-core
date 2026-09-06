import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Build a manualChunks function from a { chunkName: [packageName] } map.
 * First match wins, so order the map from most specific to least — keep the
 * react bucket last, since half the tree lives under node_modules/react*.
 */
export function manualChunksFromMap(map) {
  const entries = Object.entries(map).map(([chunk, pkgs]) => [chunk, pkgs.map((p) => `node_modules/${p}/`)]);
  return (id) => {
    const normalized = id.replaceAll('\\', '/');
    for (const [chunk, needles] of entries) {
      if (needles.some((n) => normalized.includes(n))) return chunk;
    }
    return undefined;
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.root] App root. Defaults to cwd, which is the app repo.
 * @param {Record<string, string[]>} [options.chunks] manualChunks buckets.
 * @param {number} [options.serverPort] Dev API port fallback. Default 3001.
 * @param {import('vite').UserConfig} [options.override] Deep-merged last.
 */
export function defineAppConfig(options = {}) {
  const { root = process.cwd(), chunks, serverPort = 3001, override } = options;

  // Where this package actually lives on disk. When an app's node_modules is a
  // symlink (npm link, a linked workspace), vite resolves our setup file to its
  // real path, which sits outside the app root and is refused by the fs allowlist
  // unless it is named here.
  const webCoreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  const base = defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(root, './src') },
      // react and react-dom are required peers, so npm places one copy at the app
      // root and this should never have anything to do. It is insurance: two React
      // instances fail as "invalid hook call" from inside a component, which points
      // at the component rather than at the resolution that actually broke.
      dedupe: ['react', 'react-dom'],
    },
    build: chunks
      ? {
          rollupOptions: {
            output: { manualChunks: manualChunksFromMap(chunks) },
          },
        }
      : {},
    test: {
      // jsdom by default, since these are React apps and component tests are the
      // common case. A pure-node test opts out with a `@vitest-environment node`
      // docblock at the top of the file.
      environment: 'jsdom',
      // A bare specifier rather than an absolute path: web-core is always a direct
      // dependency of the app, so this resolves from the app root, and it keeps
      // working when node_modules is a symlink (npm link, or a linked workspace),
      // where an absolute path outside the project root is refused by vite's fs
      // allowlist.
      setupFiles: ['@gregor_herdmann/web-core/vitest-setup'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**', 'server/**'],
        exclude: ['**/*.d.ts', '**/main.tsx'],
      },
    },
    server: {
      fs: { allow: [root, webCoreRoot] },
      // PORT is assigned by the Claude Code preview when 3000 is taken; be strict
      // about it then, since silently drifting to another port points the preview
      // pane at the wrong app. Plain `npm start` keeps the old fall-through behaviour.
      port: Number(process.env.PORT) || 3000,
      strictPort: process.env.PORT !== undefined,
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.SERVER_PORT ?? serverPort}`,
          changeOrigin: true,
        },
      },
      watch: {
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
      },
    },
  });

  return override ? mergeConfig(base, override) : base;
}

export default defineAppConfig;
