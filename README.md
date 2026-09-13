# @gregor_herdmann/web-core

Shared toolchain and runtime dependencies for the `web-*` apps.

The point is **dependency consolidation**, not config sharing. The five apps used to
each carry the same pins, so every Dependabot update was reviewed and merged five
times. Two groups now live here instead:

- **21 tooling packages**, as regular `dependencies`. Nothing in an app imports
  these; they are reached through the `web-core` CLI, so transitive is enough.
- **13 runtime packages**, as required `peerDependencies` — react, react-dom,
  react-router-dom, lucide-react, date-fns, express, express-session, cors,
  memorystore, googleapis, i18next, react-i18next and recharts.

The distinction matters. App source really does `import 'react'`, so react has to be
resolvable from the **app's own** `node_modules`, and there has to be exactly one
copy of it. `dependencies` only land there by npm's best-effort hoisting, which is
not a guarantee — web-todo's lockfile nests `@vitejs/plugin-react` under this
package rather than hoisting it. npm installs _required_ peers at the consumer root
by construction, so that is what the runtime group uses.

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
  // A dependency, not a devDependency: peers of a devDependency are dropped by
  // `npm ci --omit=dev`, which would take express down with them at runtime.
  "dependencies": { "@gregor_herdmann/web-core": "2.0.0" },
}
```

An app declares **none** of the 13 runtime packages and none of the tooling. Its own
`dependencies` are only what is genuinely its own — `pdfkit`, `@dnd-kit/*`,
`puppeteer-core` and the like.

To deviate from a pin, use `overrides`. A plain direct dependency at a different
version is an `ERESOLVE` failure against an exact peer, which is the point:

```jsonc
{ "overrides": { "date-fns": "4.5.0" } }
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

## Testing

`web-core test` runs vitest. Apps declare no test dependencies — vitest, jsdom,
Testing Library and coverage all come from here, and `defineAppConfig` wires up the
environment and jest-dom matchers, so a test file is all an app needs to add.

```ts
// src/lib/money.test.ts — pure unit test
// @vitest-environment node
import { expect, it } from 'vitest';

// src/components/Thing.test.tsx — component test, jsdom is the default
import { render, screen } from '@testing-library/react';
```

`web-core test:watch` and `web-core test:coverage` are also available. Every app
carries a test script, and `--passWithNoTests` keeps that honest before the first
test exists.

## Shared UI

`@gregor_herdmann/web-core/ui` holds the components every app draws the same way.

| Export                                                                  | What it is                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppSwitcher`, `APPS`                                                   | Sidebar brand with a menu to the other apps; the app registry                                                                                                                                                                                                |
| `Button`, `IconButton`                                                  | `variant` primary/secondary/ghost/danger, `size` sm/md, `icon`, `pending` (spinner, width kept). `type` defaults to `"button"`. `IconButton` requires `label`; `tone="danger"` for delete                                                                    |
| `Field`, `Input`, `Select`, `Textarea`, `inputClass`                    | Label wrapping its control, and the input look                                                                                                                                                                                                               |
| `Dropdown`, `MultiDropdown`                                             | Styled single and checkbox dropdowns with keyboard support and a list that escapes `overflow`. Optional `icon` per option, `clearLabel` for a ×; `MultiDropdown` shows a `summary(count)` or a count badge. Prefer the native `Select` for plain form fields |
| `Card`, `StatCard`, `PageHeader`, `SectionTitle`, `EmptyState`, `Badge` | Page layout pieces                                                                                                                                                                                                                                           |
| `Modal`                                                                 | Dialog with `title`, `closeLabel`, optional `footer` and `size`. Escape and backdrop close it, Tab stays inside, focus returns to the opener                                                                                                                 |
| `SortableTh`, `useSort`, `compareValues`                                | Sortable column header (`aria-sort`); sort state with optional `storageKey` and `firstDir`; a comparator with German collation and blanks last                                                                                                               |
| `ThemeToggle`                                                           | Sidebar light/dark switch with `lightLabel`/`darkLabel`                                                                                                                                                                                                      |
| `formatEUR`, `formatNumber`, `formatDateDE`                             | Cached `de-DE` formatters                                                                                                                                                                                                                                    |

Rules for what goes in here:

- **Text comes in through props.** The apps are partly German, partly English, and
  budget uses i18next, so no component hardcodes a word. Icon-only controls require a
  label.
- **Presentational only.** Domain dialogs, charts and badges stay in their app.
- **`className` is appended, not merged.** Pass layout (`w-full`, margins), not colours.
- **Only `slate-*`, `emerald`/`amber`/`rose`, `accent-*` and `dark:` classes**, so each
  app's own palette and dark mode apply.

```tsx
// src/components/Sidebar.tsx
import { AppSwitcher } from '@gregor_herdmann/web-core/ui';

<AppSwitcher current="budget" icon={<WalletIcon />} label={t('app.title')} collapsed={collapsed} />;
```

```css
/* src/index.css — directly below @import 'tailwindcss' */
@import '@gregor_herdmann/web-core/ui.css';
```

**Without that CSS import the components render unstyled.** Tailwind never scans
`node_modules`, and `ui.css` is an `@source` pointing at the compiled components. It
also restores `cursor: pointer` on every enabled `button`, `[role=button]`, `select`,
`summary` and checkbox label, which Tailwind v4's preflight resets to the default arrow.
So a plain `<button>` needs no `cursor-pointer` class.

The app URLs live in `ui/apps.ts`, and nowhere else. To add or move an app, edit that
file and release. The fan-out then carries the change to every app. Components are
written in TSX and compiled into `dist/ui` by `npm run build`, which `prepack` runs, so
the published package and the test fixture always get fresh output.

## Things that will bite you

- **`paths`, `include`, `outDir` and `rootDir` must stay in each app's tsconfig.**
  TypeScript resolves relative paths against the file that _declares_ them, so a
  shared `outDir: "dist"` would emit the server build into `node_modules/` and
  production would fail on a missing `dist/server/index.js`.
- **The CLI is insurance, not magic.** npm hoists transitive bins, so `vite` and `tsc`
  would land in an app's `.bin` anyway. The wrapper makes resolution deterministic
  (and survives pnpm), which is also why ejecting is cheap.
- **Consumers must not add `vite` back** as a direct dependency.
- **Every runtime package is declared twice here**, at the same pin: once in
  `peerDependencies` (what consumers resolve against) and once in `devDependencies`
  (what Dependabot bumps, since it does not open PRs for peer-only entries). The
  suite fails if the two drift; `npm run sync-peers` is the fix. A peer with no
  matching devDependency never gets bumped at all — which is what happened to
  `@testing-library/react`.
- **Nothing in `peerDependenciesMeta` may be optional.** Optional peers are not
  auto-installed, so an app would end up with no react at all.

## Releasing

```sh
npm version minor && git push --follow-tags
```

The tag triggers publish to npm with provenance, then a `repository_dispatch` fan-out
that opens a bump PR in all seven apps. Releases are deliberately manual: Dependabot
auto-merges patch and minor bumps _into main_ here, but never publishes.

Required secrets: `NPM_TOKEN` (granular, read-write on `@gregor_herdmann/*`) and
`FANOUT_TOKEN` (fine-grained PAT with Contents + Pull requests write on the seven app
repos). The fan-out must use a PAT rather than `GITHUB_TOKEN`, because pushes made
with `GITHUB_TOKEN` do not trigger the app's CI.

`scripts/rotate-fanout-token.sh` distributes a newly minted `FANOUT_TOKEN` to this repo
and to every app in the fan-out matrix, which it reads out of `release.yml` so the list
cannot drift. `--check` reports where the secret is set without changing anything, and
`--dry-run` prints what a real run would do. Granting the PAT its repository access
stays manual — the REST API does not expose it.

## Ejecting

Add the pins back to the app — the tooling ones are listed in this package's
`dependencies`, the runtime ones in its `peerDependencies` — restore the config
files from the app's `pre-web-core` tag, and revert the scripts. Around 15
mechanical minutes per repo, and the app keeps working mid-eject: re-declaring a
package at the version it is already resolving to changes nothing about the tree.

## Tests

`npm test` packs this package, installs the tarball into `test/fixtures/app`, and runs
the real toolchain against it. The negative cases matter most — they distinguish "the
check passed" from "the check ran on zero files", which is how a bad `include` or a
misrouted ESLint config would otherwise slip through as a green build.
