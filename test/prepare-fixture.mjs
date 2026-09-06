// Installs web-core into the fixture app the way a real consumer would: from a
// packed tarball, not a `file:` symlink. A symlinked dep would not get web-core's
// own dependencies hoisted into the fixture, and the tarball additionally proves
// the `files` and `exports` fields are correct — the classic "worked locally,
// broken once published" failure.
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'test/fixtures/app');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

const packDir = mkdtempSync(path.join(tmpdir(), 'web-core-pack-'));
run('npm', ['pack', '--pack-destination', packDir], root);
const tarball = path.join(
  packDir,
  readdirSync(packDir).find((f) => f.endsWith('.tgz')),
);

rmSync(path.join(fixture, 'node_modules'), { recursive: true, force: true });
rmSync(path.join(fixture, 'package-lock.json'), { force: true });
// --no-save: recording the dependency would write this machine's temp tarball path
// into a tracked file, so every fixture prep would dirty the working tree.
run('npm', ['install', '--no-audit', '--no-fund', '--no-save', tarball], fixture);

console.log('fixture prepared');
