import { describe, expect, it, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { manualChunksFromMap } from '../config/vite.js';
import { resolveBin } from '../lib/resolve-bin.js';
import { compareVersions, releaseNotes } from '../lib/release-notes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'test/fixtures/app');
const cli = path.join(fixture, 'node_modules/.bin/web-core');

/** Run the CLI in a directory and return its exit code. */
function webCore(args: string[], cwd = fixture) {
  const r = spawnSync(cli, args, { cwd, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A throwaway copy of the fixture, so negative cases cannot corrupt the original. */
function scratchFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-core-fixture-'));
  const dest = path.join(dir, 'app');
  // Copy the sources but symlink node_modules: duplicating the whole tree for every
  // negative case is slow enough to blow the test timeout.
  cpSync(fixture, dest, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'node_modules',
  });
  symlinkSync(path.join(fixture, 'node_modules'), path.join(dest, 'node_modules'), 'dir');
  rmSync(path.join(dest, 'dist'), { recursive: true, force: true });
  return dest;
}

beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error('fixture not prepared — run `node test/prepare-fixture.mjs` first');
  }
});

describe('bin resolution', () => {
  // Four of these are unreachable by direct subpath because of their `exports`.
  // This is the test that catches a dependency renaming or restricting its bin.
  it.each([
    ['vite', 'vite'],
    ['typescript', 'tsc'],
    ['eslint', 'eslint'],
    ['prettier', 'prettier'],
    ['tsx', 'tsx'],
    ['concurrently', 'concurrently'],
  ])('resolves %s to a real file', (pkg, bin) => {
    expect(existsSync(resolveBin(pkg, bin))).toBe(true);
  });
});

const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

/**
 * The runtime packages the apps no longer declare for themselves, and the tooling
 * packages their test files import by name.
 *
 * Spelled out rather than derived from the manifest on purpose. Deriving the list
 * from `peerDependencies` means demoting a package to `dependencies` also removes
 * it from the list, so the suite goes green having quietly stopped checking it —
 * the same "the check ran on zero files" failure the negative cases below exist to
 * catch. The set-equality test keeps the list honest in the other direction.
 */
const RUNTIME_PEERS = [
  'cors',
  'date-fns',
  'express',
  'express-session',
  'googleapis',
  'i18next',
  'lucide-react',
  'memorystore',
  'react',
  'react-dom',
  'react-i18next',
  'react-router-dom',
  'recharts',
];

const TOOLING_PEERS = ['vitest', '@testing-library/react', '@testing-library/user-event'];

describe('package manifest', () => {
  // An app's test files import these by name, so they must resolve from the app's
  // own node_modules. npm auto-installs REQUIRED peers there; as plain dependencies
  // they may be nested under this package instead — they are, in web-todo — leaving
  // TypeScript unable to resolve the import even though the tests run fine.
  // Neither list may drift from the manifest: a package added to peerDependencies
  // without being listed here would go untested, and one dropped from the manifest
  // has to fail loudly rather than take its own coverage down with it.
  it('lists every peer exactly once', () => {
    expect(Object.keys(manifest.peerDependencies).sort()).toEqual([...RUNTIME_PEERS, ...TOOLING_PEERS].sort());
  });

  it.each([...TOOLING_PEERS, ...RUNTIME_PEERS])('declares %s as a required peer so it lands at the app root', (pkg) => {
    expect(manifest.peerDependencies?.[pkg]).toBeDefined();
    expect(manifest.dependencies?.[pkg]).toBeUndefined();
    // Optional peers are not auto-installed, which would defeat the point.
    expect(manifest.peerDependenciesMeta?.[pkg]?.optional).not.toBe(true);
  });

  // Dependabot does not open PRs for peerDependency-only entries, so every shared
  // package is declared twice and the devDependency is what actually gets bumped.
  // If only one of the two moves, apps silently keep the old version: the peer is
  // what they resolve against, and nothing else compares the pair.
  it.each(RUNTIME_PEERS)('pins %s identically as a peer and a devDependency', (pkg) => {
    expect(manifest.devDependencies?.[pkg]).toBe(manifest.peerDependencies?.[pkg]);
  });

  // Exact pins, not ranges: the point of centralising these is that one version is
  // in force everywhere. A caret here would let five apps drift apart again.
  it.each(RUNTIME_PEERS)('pins %s exactly', (pkg) => {
    expect(manifest.peerDependencies?.[pkg]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('runtime peers reach the app', () => {
  // The mechanism this package relies on: npm installs REQUIRED peers into the
  // consumer's own node_modules. The fixture declares none of these, so if they
  // resolve there at all, they got there as peers.
  //
  // Resolving is not enough on its own — a copy nested under this package would
  // still satisfy `require.resolve` from inside web-core while being invisible to
  // the app's own imports and to TypeScript. web-todo's lockfile really does nest
  // @vitejs/plugin-react that way, so this asserts the location, not just success.
  const nested = path.join(fixture, 'node_modules/@gregor_herdmann/web-core/node_modules');

  it.each(RUNTIME_PEERS)('resolves %s from the app root, not from inside web-core', (pkg) => {
    const resolved = createRequire(path.join(fixture, 'noop.js')).resolve(`${pkg}/package.json`);
    expect(resolved.startsWith(path.join(fixture, 'node_modules'))).toBe(true);
    expect(resolved.startsWith(nested)).toBe(false);
  });

  it.each(RUNTIME_PEERS)('installs %s at the version this package pins', (pkg) => {
    const resolved = createRequire(path.join(fixture, 'noop.js')).resolve(`${pkg}/package.json`);
    expect(JSON.parse(readFileSync(resolved, 'utf8')).version).toBe(manifest.peerDependencies[pkg]);
  });
});

describe('manualChunksFromMap', () => {
  const fn = manualChunksFromMap({
    'vendor-charts': ['recharts'],
    'vendor-react': ['react', 'react-router-dom'],
  });

  it('assigns by package name', () => {
    expect(fn('/x/node_modules/recharts/es6/index.js')).toBe('vendor-charts');
    expect(fn('/x/node_modules/react/index.js')).toBe('vendor-react');
  });

  it('does not bucket app code', () => {
    expect(fn('/x/src/App.tsx')).toBeUndefined();
  });

  it('requires an exact package segment, so react does not swallow react-router-dom', () => {
    // react-router-dom is listed explicitly; without the trailing slash in the
    // matcher, `react` alone would have captured it.
    expect(fn('/x/node_modules/react-router-dom/index.js')).toBe('vendor-react');
  });
});

describe('build', () => {
  beforeAll(() => {
    rmSync(path.join(fixture, 'dist'), { recursive: true, force: true });
    expect(webCore(['build']).code).toBe(0);
  });

  it('emits client assets', () => {
    expect(readdirSync(path.join(fixture, 'dist/assets')).some((f) => f.endsWith('.js'))).toBe(true);
  });

  it('honours manualChunks', () => {
    // Catches manualChunks silently no-op'ing, which is how a rollup/rolldown
    // output-hook change would show up.
    const assets = readdirSync(path.join(fixture, 'dist/assets'));
    expect(assets.some((f) => f.startsWith('vendor-react'))).toBe(true);
  });

  it('emits the server build outside node_modules', () => {
    // Guards the tsconfig outDir gotcha: a shared outDir would land the server
    // build inside node_modules/@gregor_herdmann/web-core.
    expect(existsSync(path.join(fixture, 'dist/server/index.js'))).toBe(true);
  });
});

describe('typecheck', () => {
  it('passes on the clean fixture', () => {
    expect(webCore(['typecheck']).code).toBe(0);
  });

  it('fails on a type error', () => {
    // Without this, a typecheck that matched zero files would look identical to
    // a passing one — which is exactly how a bad `include` would slip through.
    const dir = scratchFixture();
    writeFileSync(path.join(dir, 'src/lib/util.ts'), 'export const n: number = "not a number";\n');
    expect(webCore(['typecheck'], dir).code).not.toBe(0);
  });

  it('type-checks CSS side-effect imports without the app depending on vite', () => {
    // src/vite-env.d.ts references @gregor_herdmann/web-core/client rather than
    // vite/client. Apps no longer depend on vite, and npm does not reliably hoist
    // it to the app root — in web-todo it nested under this package instead, which
    // broke typecheck while the build kept working.
    const dir = scratchFixture();
    expect(readFileSync(path.join(dir, 'src/main.tsx'), 'utf8')).toContain("import './index.css'");
    expect(webCore(['typecheck'], dir).code).toBe(0);
  });

  it('resolves the @/ alias to the app src, not to web-core', () => {
    const dir = scratchFixture();
    rmSync(path.join(dir, 'src/lib/util.ts'));
    const { code, out } = webCore(['typecheck'], dir);
    expect(code).not.toBe(0);
    expect(out).toContain('@/lib/util');
  });
});

describe('lint', () => {
  it('passes on the clean fixture', () => {
    expect(webCore(['lint']).code).toBe(0);
  });

  it('fails on an unused variable', () => {
    const dir = scratchFixture();
    appendFileSync(path.join(dir, 'src/lib/util.ts'), 'const unused = 1;\n');
    expect(webCore(['lint'], dir).code).not.toBe(0);
  });
});

describe('test runner', () => {
  it('runs unit and component tests in an app with no test dependencies', () => {
    // The fixture depends only on react, react-dom, react-router-dom and express.
    // vitest, jsdom and Testing Library all come from web-core.
    expect(webCore(['test']).code).toBe(0);
  });

  it('fails when a test fails', () => {
    const dir = scratchFixture();
    writeFileSync(
      path.join(dir, 'src/__tests__/failing.test.ts'),
      "import { expect, it } from 'vitest';\nit('fails', () => expect(1).toBe(2));\n",
    );
    expect(webCore(['test'], dir).code).not.toBe(0);
  });

  it('passes when an app has no tests at all', () => {
    // Every app carries a test script from day one, so this must not be an error.
    const dir = scratchFixture();
    rmSync(path.join(dir, 'src/__tests__'), { recursive: true, force: true });
    expect(webCore(['test'], dir).code).toBe(0);
  });

  it('ignores a test that only exists in build output', () => {
    // tsconfig.server.json emits into dist/, so a server test lands there compiled.
    // Vitest 5 no longer excludes build output by default, and running the copy
    // means every server test runs twice — the stale one able to fail on its own.
    const dir = scratchFixture();
    mkdirSync(path.join(dir, 'dist/server'), { recursive: true });
    writeFileSync(
      path.join(dir, 'dist/server/stale.test.js'),
      "import { expect, it } from 'vitest';\nit('stale', () => expect(1).toBe(2));\n",
    );
    expect(webCore(['test'], dir).code).toBe(0);
  });

  it('ignores tests inside a worktree checked out in the repo', () => {
    // Claude Code puts worktrees under .claude/worktrees/, each a full copy of the
    // app — including its tests, at whatever revision that branch is on.
    const dir = scratchFixture();
    mkdirSync(path.join(dir, '.claude/worktrees/wip/src'), { recursive: true });
    writeFileSync(
      path.join(dir, '.claude/worktrees/wip/src/wip.test.ts'),
      "import { expect, it } from 'vitest';\nit('wip', () => expect(1).toBe(2));\n",
    );
    expect(webCore(['test'], dir).code).toBe(0);
  });

  it('collects coverage', () => {
    const dir = scratchFixture();
    expect(webCore(['test:coverage'], dir).code).toBe(0);
    expect(existsSync(path.join(dir, 'coverage/index.html'))).toBe(true);
  });
});

describe('format', () => {
  it('passes on the clean fixture', () => {
    expect(webCore(['format']).code).toBe(0);
  });

  it('fails on a badly formatted file', () => {
    const dir = scratchFixture();
    writeFileSync(path.join(dir, 'src/lib/util.ts'), 'export const x   =    {a:1,b:2}\n');
    expect(webCore(['format'], dir).code).not.toBe(0);
  });

  it('ignores files git ignores', () => {
    // Untracked local files such as .env.local or .credentials.json would
    // otherwise fail `format` on a developer's machine while passing in CI,
    // where they do not exist.
    const dir = scratchFixture();
    writeFileSync(path.join(dir, '.gitignore'), 'secrets.json\n');
    writeFileSync(path.join(dir, 'secrets.json'), '{"a"   :1}\n');
    expect(webCore(['format'], dir).code).toBe(0);
  });

  it('ignores dist even when the app has no .prettierignore', () => {
    const dir = scratchFixture();
    rmSync(path.join(dir, '.prettierignore'), { force: true });
    mkdirSync(path.join(dir, 'dist'), { recursive: true });
    writeFileSync(path.join(dir, 'dist/ugly.js'), 'const   x=1\n');
    expect(webCore(['format'], dir).code).toBe(0);
  });
});

describe('release notes', () => {
  // Stubbed rather than live: the bump PRs these feed must not depend on
  // GitHub being reachable from a test run, and the range logic is the part
  // worth pinning down.
  function stubGitHub(releases: unknown[], commits: unknown[] | null) {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      const body = String(url).includes('/releases') ? releases : { commits };
      if (commits === null && !String(url).includes('/releases')) {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as typeof fetch;
    return { calls, restore: () => (globalThis.fetch = original) };
  }

  const release = (v: string, body: string) => ({ tag_name: `v${v}`, name: `v${v}`, body });
  const commit = (sha: string, message: string) => ({
    sha,
    commit: { message },
    html_url: `https://github.com/gregor/web-core/commit/${sha}`,
  });

  it('orders versions, treating a prerelease as older than its release', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('v1.3.0', '1.3.0')).toBe(0);
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('quotes every release in the range and no others', async () => {
    const stub = stubGitHub(
      [
        release('1.4.0', '## What&apos;s Changed\n* newest'),
        release('1.3.0', 'middle'),
        release('1.2.0', 'already had this one'),
      ],
      [commit('abc1234', 'feat: a thing (#12)\n\nbody')],
    );
    try {
      const md = await releaseNotes({ repo: 'gregor/web-core', from: '1.2.0', to: '1.4.0' });
      expect(md).toContain('### v1.4.0');
      expect(md).toContain('### v1.3.0');
      expect(md).not.toContain('already had this one');
      // Newest first, as Dependabot does it.
      expect(md.indexOf('### v1.4.0')).toBeLessThan(md.indexOf('### v1.3.0'));
    } finally {
      stub.restore();
    }
  });

  it('renders collapsed sections GitHub will parse as Markdown', async () => {
    const stub = stubGitHub([release('1.4.0', 'notes')], [commit('abc1234', 'feat: a thing (#12)')]);
    try {
      const md = await releaseNotes({ repo: 'gregor/web-core', from: '1.3.0', to: '1.4.0' });
      // The blank line after </summary> is what makes the Markdown render.
      expect(md).toContain('<summary>Release notes</summary>\n\n');
      expect(md).toContain('<summary>Commits (1)</summary>\n\n');
      expect(md).toContain('[`abc1234`](https://github.com/gregor/web-core/commit/abc1234) feat: a thing (#12)');
      // Only the first line of a commit message, never the body.
      expect(md).not.toContain('body');
      expect(md).toContain('compare/v1.3.0...v1.4.0');
    } finally {
      stub.restore();
    }
  });

  it('degrades to the section it could fetch rather than throwing', async () => {
    const stub = stubGitHub([release('1.4.0', 'notes')], null);
    try {
      const md = await releaseNotes({ repo: 'gregor/web-core', from: '1.3.0', to: '1.4.0' });
      expect(md).toContain('### v1.4.0');
      expect(md).not.toContain('<summary>Commits');
    } finally {
      stub.restore();
    }
  });

  it('returns nothing when GitHub is unreachable, so the bump PR still opens', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    try {
      const md = await releaseNotes({ repo: 'gregor/web-core', from: '1.3.0', to: '1.4.0' });
      expect(md).toBe('');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('rejects a call without both versions', () => {
    const r = webCore(['release-notes', '1.3.0']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('usage:');
  });
});
