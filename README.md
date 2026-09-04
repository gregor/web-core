# @gregor_herdmann/web-core

Shared build, lint and format toolchain for the `web-*` apps.

The point is **dependency consolidation**, not config sharing. The five apps used to
each carry the same 18 tooling devDependencies at the same pins, so every Dependabot
update was reviewed and merged five times. Those 18 now live here as regular
`dependencies`, and each app carries one devDependency instead.

## Using it in an app

```jsonc
// package.json
{
  "scripts": {
    "build": "web-core build",
    "typecheck": "web-core typecheck",
    "lint": "web-core lint",
    "format": "web-core format",
  },
  "prettier": "@gregor_herdmann/web-core/prettier",
  "devDependencies": { "@gregor_herdmann/web-core": "1.0.0" },
}
```

```js
// eslint.config.js
export { default } from '@gregor_herdmann/web-core/eslint';
```

```jsonc
// tsconfig.json — paths and include stay HERE, see below
{
  "extends": "@gregor_herdmann/web-core/tsconfig.base.json",
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
  "include": ["src"],
}
```

```ts
// vite.config.ts
import { defineAppConfig } from '@gregor_herdmann/web-core/vite';

export default defineAppConfig({
  chunks: {
    'vendor-react': ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
});
```

Delete the app's `prettier.config.ts` and `.npmrc`, and remove every tooling
devDependency. **`vite` in particular must go** — two copies of vite means two plugin
instances and confusing failures.

## Things that will bite you

- **`paths`, `include`, `outDir` and `rootDir` must stay in each app's tsconfig.**
  TypeScript resolves relative paths against the file that _declares_ them, so a
  shared `outDir: "dist"` would emit the server build into `node_modules/` and
  production would fail on a missing `dist/server/index.js`.
- **The CLI is insurance, not magic.** npm hoists transitive bins, so `vite` and `tsc`
  would land in an app's `.bin` anyway. The wrapper makes resolution deterministic
  (and survives pnpm), which is also why ejecting is cheap.
- **Consumers must not add `vite` back** as a direct dependency.

## Releasing

```sh
npm version minor && git push --follow-tags
```

The tag triggers publish to npm with provenance, then a `repository_dispatch` fan-out
that opens a bump PR in all five apps. Releases are deliberately manual: Dependabot
auto-merges patch and minor bumps _into main_ here, but never publishes.

Required secrets: `NPM_TOKEN` (granular, read-write on `@gregor_herdmann/*`) and
`FANOUT_TOKEN` (fine-grained PAT with Contents + Pull requests write on the five app
repos). The fan-out must use a PAT rather than `GITHUB_TOKEN`, because pushes made
with `GITHUB_TOKEN` do not trigger the app's CI.

## Ejecting

Add the 18 pins back to the app (they are listed in this package's `dependencies`),
restore the config files from the app's `pre-web-core` tag, and revert the scripts.
Around 15 mechanical minutes per repo, and the app keeps working mid-eject.

## Tests

`npm test` packs this package, installs the tarball into `test/fixtures/app`, and runs
the real toolchain against it. The negative cases matter most — they distinguish "the
check passed" from "the check ran on zero files", which is how a bad `include` or a
misrouted ESLint config would otherwise slip through as a green build.
