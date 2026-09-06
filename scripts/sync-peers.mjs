// Copies every runtime package's devDependencies pin into peerDependencies.
//
// Each shared package is declared twice: the peer is what consumers resolve
// against, the devDependency is what Dependabot bumps. Whether Dependabot also
// rewrites peerDependencies for npm is not something this repo has ever exercised
// — vitest has been dual-declared since 1.2.0 and has not needed a bump since — so
// the suite asserts the pair matches and this script is the one-command fix when
// it does not. Run it on a Dependabot PR that touched a shared package.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const pkg = JSON.parse(readFileSync(file, 'utf8'));

const drifted = Object.keys(pkg.peerDependencies).filter(
  (name) => pkg.devDependencies[name] && pkg.devDependencies[name] !== pkg.peerDependencies[name],
);

for (const name of drifted) {
  console.log(`${name}: ${pkg.peerDependencies[name]} -> ${pkg.devDependencies[name]}`);
  pkg.peerDependencies[name] = pkg.devDependencies[name];
}

// A peer with no devDependency cannot be bumped by Dependabot at all, which is how
// @testing-library/react sat at one version from 1.2.0 until it was noticed.
const unbumpable = Object.keys(pkg.peerDependencies).filter((name) => !pkg.devDependencies[name]);
if (unbumpable.length) {
  console.error(`\nPeers with no matching devDependency, so nothing will ever bump them:`);
  for (const name of unbumpable) console.error(`  ${name}`);
  process.exit(1);
}

if (!drifted.length) {
  console.log('peers already match');
  process.exit(0);
}

writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`\nsynced ${drifted.length} peer(s); run "npm install" to update the lockfile`);
