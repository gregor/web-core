import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Resolve a tool's executable from web-core's OWN dependency tree.
 *
 * Anchoring on import.meta.url rather than the consumer's cwd is what makes the
 * tools resolve here instead of in the app. Subpaths like `vite/bin/vite.js` are
 * blocked by those packages' `exports` (vite, eslint, tsx and concurrently all
 * throw ERR_PACKAGE_PATH_NOT_EXPORTED), but every one of them still exports
 * `./package.json`, so go through the manifest and read its `bin` field.
 */
export function resolveBin(pkg, binName = pkg) {
  const manifestPath = require.resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // `bin` is a bare string for single-binary packages (tsx), an object otherwise.
  const rel = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!rel) throw new Error(`web-core: package "${pkg}" declares no bin "${binName}"`);
  return path.join(path.dirname(manifestPath), rel);
}
