#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveBin } from '../lib/resolve-bin.js';
import { releaseNotes } from '../lib/release-notes.js';

/** Run a tool. cwd is deliberately not set, so it stays the consumer repo. */
function run(pkg, binName, args) {
  const { status, error } = spawnSync(process.execPath, [resolveBin(pkg, binName), ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (error) throw error;
  return status ?? 1;
}

const LINT_TARGETS = ['src', 'server'];

// Shipped baseline ignore. Only two of the five apps ever had a .prettierignore,
// so `format` failed locally after a build in the other three. --ignore-path may
// be repeated, and a missing file is not an error, so an app's own
// .prettierignore still applies on top of this.
const PRETTIER_IGNORE = [
  '--ignore-path',
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../config/prettierignore'),
  // Anything git ignores is not ours to format. Without this, untracked local files
  // such as .env.local, .credentials.json and .token.json fail `format` on a
  // developer's machine while passing in CI, where they do not exist.
  '--ignore-path',
  '.gitignore',
  '--ignore-path',
  '.prettierignore',
];

const commands = {
  'build:frontend': (rest) => run('vite', 'vite', ['build', ...rest]),
  'build:server': (rest) => run('typescript', 'tsc', ['-p', 'tsconfig.server.json', ...rest]),
  build(rest) {
    const code = commands['build:frontend'](rest);
    return code === 0 ? commands['build:server'](rest) : code;
  },
  typecheck(rest) {
    const code = run('typescript', 'tsc', ['--noEmit', ...rest]);
    return code === 0 ? run('typescript', 'tsc', ['-p', 'tsconfig.server.json', '--noEmit', ...rest]) : code;
  },
  lint: (rest) => run('eslint', 'eslint', [...LINT_TARGETS, ...rest]),
  'lint:fix': (rest) => run('eslint', 'eslint', [...LINT_TARGETS, '--fix', ...rest]),
  format: (rest) => run('prettier', 'prettier', [...PRETTIER_IGNORE, '--check', '.', ...rest]),
  'format:fix': (rest) => run('prettier', 'prettier', [...PRETTIER_IGNORE, '--write', '.', ...rest]),
  // --passWithNoTests so every app can carry a test script from day one, and the
  // first test someone writes runs without any further wiring.
  test: (rest) => run('vitest', 'vitest', ['run', '--passWithNoTests', ...rest]),
  'test:watch': (rest) => run('vitest', 'vitest', [...rest]),
  'test:coverage': (rest) => run('vitest', 'vitest', ['run', '--passWithNoTests', '--coverage', ...rest]),
  preview: (rest) => run('vite', 'vite', ['preview', ...rest]),
  // Raw passthroughs, so app-shaped invocations keep their arguments in the app.
  vite: (rest) => run('vite', 'vite', rest),
  tsc: (rest) => run('typescript', 'tsc', rest),
  tsx: (rest) => run('tsx', 'tsx', rest),
  eslint: (rest) => run('eslint', 'eslint', rest),
  prettier: (rest) => run('prettier', 'prettier', rest),
  concurrently: (rest) => run('concurrently', 'concurrently', rest),
  vitest: (rest) => run('vitest', 'vitest', rest),
  // Prints the Markdown an app's bump PR uses to say what actually changed.
  // Best-effort by design: a thin PR description is a nuisance, a bump PR that
  // failed to open is a broken release, so this never fails the caller.
  async 'release-notes'([from, to]) {
    if (!from || !to) {
      console.error('usage: web-core release-notes <from-version> <to-version>');
      return 1;
    }
    const { url } = createRequire(import.meta.url)('../package.json').repository;
    const repo = url.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');
    try {
      process.stdout.write(await releaseNotes({ repo, from, to, token: process.env.GITHUB_TOKEN }));
    } catch {
      // Nothing to say; the caller falls back to its plain body.
    }
    return 0;
  },
};

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(`web-core <command> [...args]\n\n  ${Object.keys(commands).join('\n  ')}`);
  process.exit(cmd ? 0 : 1);
}
if (!Object.hasOwn(commands, cmd)) {
  console.error(`web-core: unknown command "${cmd}"\nRun "web-core --help".`);
  process.exit(1);
}
const status = commands[cmd](rest);
process.exit(status instanceof Promise ? await status : status);
