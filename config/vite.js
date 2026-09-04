import path from "node:path";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Build a manualChunks function from a { chunkName: [packageName] } map.
 * First match wins, so order the map from most specific to least — keep the
 * react bucket last, since half the tree lives under node_modules/react*.
 */
export function manualChunksFromMap(map) {
  const entries = Object.entries(map).map(([chunk, pkgs]) => [
    chunk,
    pkgs.map((p) => `node_modules/${p}/`),
  ]);
  return (id) => {
    const normalized = id.replaceAll("\\", "/");
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

  const base = defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(root, "./src") } },
    build: chunks
      ? {
          rollupOptions: {
            output: { manualChunks: manualChunksFromMap(chunks) },
          },
        }
      : {},
    server: {
      // PORT is assigned by the Claude Code preview when 3000 is taken; be strict
      // about it then, since silently drifting to another port points the preview
      // pane at the wrong app. Plain `npm start` keeps the old fall-through behaviour.
      port: Number(process.env.PORT) || 3000,
      strictPort: process.env.PORT !== undefined,
      proxy: {
        "/api": {
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
