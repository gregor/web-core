// Derives every peerDependency from its devDependency pin: `~<pin>` by default,
// the bare pin for EXACT_PEERS.
//
// Each shared package is declared twice: the peer is what consumers resolve
// against, the devDependency is what Dependabot bumps. Dependabot does rewrite a
// matching peer in the same PR (#76 did), so this is the one-command fix for when
// the pair drifts anyway — a hand edit, or a peer that was never dual-declared.
//
// Peers are tilde ranges so an upstream patch does not break installs before
// Dependabot has caught up: react-dom 19.3.1 requires react ^19.3.1, and against an
// exact react 19.3.0 peer every fresh install was an ERESOLVE (#83). A minor still
// needs a bump here, so the apps still cannot drift further than a patch apart.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// @vitest/coverage-v8 is a regular dependency pinned exactly, and it peer-depends on
// that exact vitest, so a looser vitest peer lets an app resolve an ERESOLVE.
export const EXACT_PEERS = ['vitest'];

export const peerRangeFor = (name, pin) => (EXACT_PEERS.includes(name) ? pin : `~${pin}`);

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));

  const drifted = Object.keys(pkg.peerDependencies).filter(
    (name) => pkg.devDependencies[name] && peerRangeFor(name, pkg.devDependencies[name]) !== pkg.peerDependencies[name],
  );

  for (const name of drifted) {
    const range = peerRangeFor(name, pkg.devDependencies[name]);
    console.log(`${name}: ${pkg.peerDependencies[name]} -> ${range}`);
    pkg.peerDependencies[name] = range;
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
}
