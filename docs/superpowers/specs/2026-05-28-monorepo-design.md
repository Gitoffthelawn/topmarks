# Monorepo Conversion — Design

**Status:** Draft
**Date:** 2026-05-28

## Summary

Convert the single Firefox extension into an npm-workspaces monorepo with three packages:

- `@topmarks/shared` — browser-agnostic app logic, assets, and locales. Holds nearly all the code.
- `@topmarks/firefox` — thin platform package: a Firefox MV3 manifest and a ~30-line platform shim.
- `@topmarks/chrome` — thin platform package: a Chrome MV3 manifest and a ~30-line platform shim.

Cross-browser differences (bookmarks-toolbar ID, search API shape, runtime globals) are isolated behind a typed `Platform` interface in shared. Each platform package implements that interface using `browser.*` or `chrome.*`. esbuild bundles shared + the active platform shim into a self-contained `dist/` directory per package, which `web-ext` then zips for store submission.

Both extensions ship at the same version (sourced from `packages/shared/package.json`). Translations live once in `packages/shared/_locales/` and are copied into each extension at build time. The Firefox extension migrates from MV2 to MV3 as part of this work so both packages share a manifest shape.

## Goals

- Reuse as much code as possible between Firefox and Chrome — platform packages contain only what genuinely differs.
- Strong type-checked boundary between browser-agnostic logic and platform glue, so API drift fails at compile time.
- Preserve the current developer workflow (`web-ext run`, `web-ext build`) and CI shape (GitHub Actions release builds zips).
- Single source of truth for translations and version number.

## Non-goals

- Edge, Safari, or any other browser target. The design accommodates adding one (it's a new package + a new platform shim), but only Firefox and Chrome ship in this work.
- Background scripts, content scripts, or service workers. The extension is a newtab override only.
- A monorepo task runner (Turborepo, Nx). npm workspaces is sufficient for three packages.
- HMR / dev-server tooling beyond what `web-ext run` already provides.
- Polyfill libraries (`webextension-polyfill`). The platform shim handles cross-browser differences directly.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Sharing strategy | esbuild bundler with `@platform` alias | Lets shared package import a typed `Platform` interface; platform packages resolve the alias to their own implementation. Real module boundaries, tree-shaking, ~80-line build script per package. |
| Workspace tool | npm workspaces | Repo already uses npm; zero new CI tooling; sufficient for three packages. |
| Firefox manifest version | MV3 (migrated from MV2) | Both packages share a manifest shape; no MV2 host_permissions / action-API divergence to maintain. Firefox MV3 is stable; this extension has no background script so the risky MV3 changes don't apply. |
| Locales source of truth | Single shared `_locales/`, copied at build | Translations stay in lockstep across browsers. Build copies the tree into each `dist/_locales/`. |
| Language | TypeScript | esbuild handles TS natively; `tsc --noEmit` does type-checking; catches Firefox/Chrome API drift at compile time. |
| Cross-browser API | Hand-rolled platform shim, no polyfill | Chrome MV3 `chrome.*` returns promises natively for the four namespaces this extension uses. The shim forces differences (toolbar ID, search API shape) to live at the boundary instead of being smeared across shared code. |
| Versioning | Synced, sourced from `packages/shared/package.json` | One number to bump per release. A small `scripts/sync-versions.mjs` propagates it to all package.json files; build stamps it into both manifests. |
| Manifest authoring | Two hand-edited `manifest.json` files, version stamped at build | The two manifests are short enough that diff-by-eye beats templating; only `version` must match across them, and that's automated. |

## Repo layout

```
firefox-bookmarks/
├── package.json                        ← workspaces: ["packages/*"], root scripts
├── tsconfig.base.json                  ← strict TS config, extended by each package
├── tsconfig.json                       ← solution file (project references)
├── .nvmrc                              ← unchanged (Node 22)
├── .env.example                        ← unchanged
├── .gitignore                          ← + packages/*/dist/, packages/*/web-ext-artifacts/
├── README.md, LICENSE, PRIVACY.md      ← stay at root, updated for monorepo
├── docs/superpowers/                   ← unchanged
├── scripts/
│   └── sync-versions.mjs               ← reads packages/shared/package.json, writes to other package.jsons
├── .github/workflows/
│   └── release.yml                     ← matrix build (firefox + chrome), attaches both zips
└── packages/
    ├── shared/
    │   ├── package.json                ← name: "@topmarks/shared", private
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── newtab.ts               ← startApp(platform) — public entrypoint
    │   │   ├── theme-init.ts           ← runs synchronously before stylesheet
    │   │   ├── bookmarks.ts
    │   │   ├── unsplash.ts
    │   │   ├── settings.ts
    │   │   ├── search.ts
    │   │   ├── i18n.ts
    │   │   ├── platform.ts             ← TYPE-ONLY: Platform interface
    │   │   └── build-helpers/
    │   │       ├── load-env.ts         ← shared .env loader for both build.ts files
    │   │       └── esbuild-config.ts   ← shared esbuild options
    │   ├── assets/
    │   │   ├── newtab.html
    │   │   ├── newtab.css
    │   │   ├── fonts/Cookie-Regular.ttf
    │   │   └── icons/{icon.svg,icon.png,bmc-logo.svg}
    │   ├── _locales/{en,de,es,fr,it,ja,zh_CN}/messages.json
    │   └── sample-bookmarks.html       ← dev fixture, not shipped
    │
    ├── firefox/
    │   ├── package.json                ← name: "@topmarks/firefox", dep on @topmarks/shared
    │   ├── tsconfig.json
    │   ├── manifest.json               ← MV3 + browser_specific_settings.gecko, version "0.0.0" placeholder
    │   ├── src/
    │   │   ├── entry.ts                ← imports startApp from shared, passes platform impl
    │   │   └── platform.ts             ← ~30 lines: implements Platform via browser.*
    │   ├── build.ts                    ← esbuild + static-copy + version stamp
    │   └── web-ext-config.cjs          ← packages dist/ into a zip
    │
    └── chrome/
        ├── package.json                ← name: "@topmarks/chrome", dep on @topmarks/shared
        ├── tsconfig.json
        ├── manifest.json               ← MV3, Chrome-shaped, version "0.0.0" placeholder
        ├── src/
        │   ├── entry.ts
        │   └── platform.ts             ← ~30 lines: implements Platform via chrome.*
        ├── build.ts
        └── web-ext-config.cjs          ← web-ext build --target=chromium
```

### Package boundaries (one sentence each)

- **`@topmarks/shared`** — Browser-agnostic app logic, assets, and locales. Imports the typed `Platform` interface from its own `platform.ts` but never an implementation. Knows nothing about `browser` or `chrome` globals.
- **`@topmarks/firefox`** — Provides Firefox's `Platform` impl and the Gecko-shaped manifest. Its build pulls `@topmarks/shared` and emits a Firefox-loadable directory + zip.
- **`@topmarks/chrome`** — Same shape as firefox, mirrored for Chrome.

### Files deleted from the repo root during migration

`newtab.html`, `newtab.css`, `newtab.js`, `theme-init.js`, `manifest.json`, `web-ext-config.cjs`, `build-config.sh`, `_locales/`, `icons/`, `fonts/`, `sample-bookmarks.html`. All move into `packages/`. `config.local.js` (generated, never committed) stops existing.

## Build pipeline

Each platform package has a `build.ts` (executed via `tsx`) that performs the same five-step sequence:

1. **Stamp version.** Read `version` from `packages/shared/package.json`. Compose the final `manifest.json` by deep-merging the placeholder `0.0.0` field with the real version. Result is held in memory and written to `dist/manifest.json` in step 4.

2. **esbuild bundle #1 — page script.**
   ```
   entryPoints: ['src/entry.ts']
   outfile:     'dist/newtab.js'
   format:      'iife'                  ← classic page script, no module loader needed
   bundle:      true
   platform:    'browser'
   target:      'firefox142' | 'chrome120'
   minify:      production only
   sourcemap:   dev only
   define:      { 'process.env.UNSPLASH_ACCESS_KEY': '"<from .env>"' }
   ```
   The shared package imports the `Platform` type only (no runtime dependency on a specific browser). Each platform package's `entry.ts` imports `startApp` from shared, imports its local `./platform`, and calls `startApp(platform)`. The shared bundle resolves through normal `@topmarks/shared` package resolution.

3. **esbuild bundle #2 — theme-init.**
   ```
   entryPoints: ['../shared/src/theme-init.ts']
   outfile:     'dist/theme-init.js'
   format:      'iife'                  ← must run synchronously before stylesheet
   minify:      production only
   ```

4. **Static copy.** No bundler; plain file copy:
   ```
   shared/assets/newtab.html    → dist/newtab.html
   shared/assets/newtab.css     → dist/newtab.css
   shared/assets/fonts/**       → dist/fonts/**
   shared/assets/icons/**       → dist/icons/**
   shared/_locales/**           → dist/_locales/**
   <platform>/manifest.json     → dist/manifest.json   (with version stamped)
   ```

5. **(release builds only) `web-ext build`** packages `dist/` into `web-ext-artifacts/topmarks-{firefox,chrome}-vX.Y.Z.zip`.

### Dev mode

`npm run dev -w @topmarks/firefox` runs `build.ts --watch` and spawns `web-ext run --source-dir=dist`. Edits to any file in `packages/shared/` or `packages/firefox/` trigger a rebuild; `web-ext` reloads the extension. Same for Chrome via `web-ext run --source-dir=dist --target=chromium`.

### Type-checking is separate from bundling

`npm run typecheck` at the root runs `tsc -b` across all packages via project references. esbuild bundles without consulting `tsc`. The two stay orthogonal: bundling is fast, type-checking is strict.

### Secrets

`.env` stays at repo root. Both `build.ts` scripts read it via the same loader (`packages/shared/src/build-helpers/load-env.ts`, ~10 lines). The Unsplash access key is injected into the bundle via esbuild's `define`. `build-config.sh` is deleted; `config.local.js` no longer exists.

## Platform abstraction

### The `Platform` interface (in `packages/shared/src/platform.ts`)

This file holds the `Platform` interface (type) plus a tiny runtime binding (`setPlatform()` / `getPlatform()`) used by `startApp` to make the platform impl available to other shared modules. The shape of the interface is derived from how today's `newtab.js` uses the WebExtensions APIs — not from union-ing the full surface. ~16 call sites collapse into the methods below. Anything not used today is not in the interface.

```typescript
// Type
export interface Platform {
  bookmarks: {
    getToolbar(): Promise<BookmarkNode>;       // hides Firefox's "toolbar_____" vs Chrome's "1"
    onChanged(handler: () => void): () => void; // returns unsubscribe fn
  };
  storage: {
    get<K extends string>(keys: K[]): Promise<Record<K, unknown>>;
    set(values: Record<string, unknown>): Promise<void>;
    onChanged(handler: (changes: StorageChanges) => void): () => void;
  };
  search: {
    submit(query: string, opts: { newTab: boolean }): Promise<void>;
    // Firefox: browser.search.search() + browser.tabs.getCurrent()
    // Chrome:  chrome.search.query()  (MV3, "search" permission)
  };
  i18n: {
    getMessage(key: string): string;
    getUILanguage(): string;
  };
  runtime: {
    isFirefox: boolean;                         // last-resort escape hatch
  };
}

export interface BookmarkNode { /* subset shared/bookmarks.ts actually uses */ }
export interface StorageChanges { /* ... */ }

// Runtime binding (used internally by startApp; shared modules read via getPlatform())
let current: Platform | null = null;
export function setPlatform(p: Platform) { current = p; }
export function getPlatform(): Platform {
  if (!current) throw new Error('Platform not initialized. Did entry.ts forget startApp()?');
  return current;
}
```

### Firefox implementation (`packages/firefox/src/platform.ts`, ~30 lines)

```typescript
import type { Platform } from '@topmarks/shared/platform';
const TOOLBAR_ID = 'toolbar_____';

export const platform: Platform = {
  bookmarks: {
    getToolbar: async () => (await browser.bookmarks.getSubTree(TOOLBAR_ID))[0],
    onChanged: (h) => {
      const events = ['onCreated','onRemoved','onChanged','onMoved'] as const;
      events.forEach(e => browser.bookmarks[e].addListener(h));
      return () => events.forEach(e => browser.bookmarks[e].removeListener(h));
    },
  },
  storage: { /* browser.storage.local.{get,set,onChanged} */ },
  search: { /* browser.search.search + browser.tabs.getCurrent */ },
  i18n: { /* browser.i18n.{getMessage,getUILanguage} */ },
  runtime: { isFirefox: true },
};
```

### Chrome implementation (`packages/chrome/src/platform.ts`, ~30 lines)

```typescript
import type { Platform } from '@topmarks/shared/platform';
const TOOLBAR_ID = '1';  // Chrome's bookmarks-bar root

export const platform: Platform = {
  bookmarks: { /* chrome.bookmarks.* — promises native in MV3 */ },
  storage:   { /* chrome.storage.local.* */ },
  search:    { /* chrome.search.query({text: query, disposition: ...}) */ },
  i18n:      { /* chrome.i18n.* */ },
  runtime:   { isFirefox: false },
};
```

### Wiring (`packages/{firefox,chrome}/src/entry.ts`)

```typescript
import { startApp } from '@topmarks/shared';
import { platform } from './platform';
startApp(platform);
```

`@topmarks/shared` exports exactly one public function: `startApp(platform: Platform)`. Internally, `startApp` calls `setPlatform(platform)` first thing; every other shared module reads the active platform via `getPlatform()`. This avoids threading `platform` through every function call site and keeps shared modules testable — tests construct a mock `Platform`, call `startApp(mock)`, then exercise the modules.

### Why no `webextension-polyfill`

Chrome MV3's `chrome.*` returns promises natively for the four namespaces used (`bookmarks`, `storage`, `search`, `i18n`). The 30KB polyfill would buy nothing the shim doesn't already provide, and the shim has the additional benefit of forcing platform differences (toolbar IDs, manifest-shape leakage) to be expressed at the boundary rather than smeared across shared code.

### Chrome `search` API contingency

`chrome.search.query()` exists in MV3 with the `"search"` permission and submits to the user's default engine. If a blocker surfaces during Chrome implementation, the `Platform.search.submit()` boundary lets us swap to `chrome.tabs.update({url: defaultEngineUrl + encodeURIComponent(query)})` in Chrome's `platform.ts` only. Shared code is unaffected.

## Manifests, versioning, secrets

### Two manifests (committed, hand-edited)

```jsonc
// packages/firefox/manifest.json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "0.0.0",                                  // placeholder, stamped at build
  "description": "__MSG_extDescription__",
  "default_locale": "en",
  "homepage_url": "https://github.com/nx-alejandrolacasa/topmarks",
  "permissions": ["bookmarks", "storage", "search"],
  "host_permissions": ["https://api.unsplash.com/*"],  // MV3 split: host perms move out of "permissions"
  "icons": { "48": "icons/icon.svg", "96": "icons/icon.svg", "128": "icons/icon.svg" },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "browser_specific_settings": {
    "gecko": {
      "id": "topmarks@nx-alejandrolacasa.github.io",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  }
}
```

```jsonc
// packages/chrome/manifest.json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "0.0.0",                                  // placeholder
  "description": "__MSG_extDescription__",
  "default_locale": "en",
  "homepage_url": "https://github.com/nx-alejandrolacasa/topmarks",
  "permissions": ["bookmarks", "storage", "search"],
  "host_permissions": ["https://api.unsplash.com/*"],
  "icons": { "48": "icons/icon.png", "128": "icons/icon.png" },   // Chrome Web Store requires PNG
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "minimum_chrome_version": "120"
}
```

No templating engine. The manifests are short; diff-by-eye is easier than a template. The only field that must match across them is `version`, which is automated.

### Versioning model

Both packages always ship at the same version. Single source: `packages/shared/package.json`. Per the standing project convention, a release with new features bumps the **minor** from the last released version (not a patch on intermediate working numbers).

`scripts/sync-versions.mjs` (~15 lines) reads `packages/shared/package.json` and writes the same version into the root and platform `package.json` files. Run manually (`npm run sync-versions`) as part of cutting a release — not on every build. Build-time manifest stamping is separate and reads `packages/shared/package.json` directly.

### Secrets

`UNSPLASH_ACCESS_KEY` lives in repo-root `.env` for local dev (unchanged from today) and in the same-named GitHub Actions secret for CI (unchanged). esbuild's `define` substitutes it into the bundle at build time. The previous `build-config.sh` → `config.local.js` pipeline is removed.

### Permission re-prompt on Firefox update

The MV2→MV3 migration plus the `host_permissions` split will trigger a one-time permission prompt for existing Firefox users on update. Acceptable precedent — the search-field rollout (2026-05-25) already added a permission prompt; users have seen this pattern before. Documented in release notes.

## Locales & static assets

### Locales

Single source of truth: `packages/shared/_locales/{en,de,es,fr,it,ja,zh_CN}/messages.json`. The seven directories that exist today move there verbatim. The build copies the whole tree into `packages/<platform>/dist/_locales/`. Both extensions ship byte-identical translation files.

No platform-specific override mechanism (YAGNI). If translations ever need to differ per browser, a `packages/<platform>/_locales/` overlay applied after the shared copy would be the extension point — not building it now.

### Asset relocation

| Today | Tomorrow |
|---|---|
| `newtab.html` | `packages/shared/assets/newtab.html` |
| `newtab.css` | `packages/shared/assets/newtab.css` |
| `fonts/Cookie-Regular.ttf` | `packages/shared/assets/fonts/Cookie-Regular.ttf` |
| `icons/icon.svg` | `packages/shared/assets/icons/icon.svg` |
| `icons/icon.png` | `packages/shared/assets/icons/icon.png` |
| `icons/bmc-logo.svg` | `packages/shared/assets/icons/bmc-logo.svg` |
| `_locales/` | `packages/shared/_locales/` |
| `sample-bookmarks.html` | `packages/shared/sample-bookmarks.html` (dev-only fixture) |

`newtab.html` references `./newtab.js`, `./theme-init.js`, `./newtab.css`, `./fonts/Cookie-Regular.ttf`, `./icons/*` — all relative, all resolve identically once the build assembles `dist/`. No path rewrites needed.

### Icon nuance

Firefox accepts SVG icons; Chrome Web Store requires PNG for the store listing icon. Both manifests reference PNG for the 128px slot (`icons/icon.png` already exists). Firefox additionally references SVG at 48/96 for sharper rendering. Both files ship in both extensions — wasted bytes are negligible.

### `.gitignore` updates

```
# At repo root
node_modules/
packages/*/dist/
packages/*/web-ext-artifacts/
# Removed entries:
#   config.local.js   ← file no longer exists
```

## Dev workflow

### Root `package.json` scripts

```jsonc
{
  "name": "topmarks-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:firefox":   "npm run dev -w @topmarks/firefox",
    "dev:chrome":    "npm run dev -w @topmarks/chrome",
    "build":         "npm run build -w @topmarks/firefox && npm run build -w @topmarks/chrome",
    "build:firefox": "npm run build -w @topmarks/firefox",
    "build:chrome":  "npm run build -w @topmarks/chrome",
    "lint":          "npm run lint --workspaces --if-present",
    "typecheck":     "tsc -b",
    "sync-versions": "node scripts/sync-versions.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.24",
    "tsx": "^4",
    "typescript": "^5.6",
    "web-ext": "^10.1.0"
  }
}
```

### Per-package scripts

```jsonc
// packages/firefox/package.json
{
  "name": "@topmarks/firefox",
  "version": "1.8.0",
  "private": true,
  "scripts": {
    "build":   "tsx build.ts",
    "dev":     "tsx build.ts --watch & web-ext run --source-dir=dist",
    "lint":    "web-ext lint --source-dir=dist",
    "package": "npm run build && web-ext build --source-dir=dist --overwrite-dest"
  },
  "dependencies": { "@topmarks/shared": "*" }
}

// packages/chrome/package.json — same shape; "dev" uses web-ext run --source-dir=dist --target=chromium
```

### Typical developer flows

```
# First-time setup
npm install

# Iterating on Firefox
npm run dev:firefox        → esbuild watch + web-ext run (Firefox)

# Iterating on Chrome
npm run dev:chrome         → esbuild watch + web-ext run (Chromium)

# Before pushing (build first — lint reads from dist/)
npm run typecheck && npm run build && npm run lint

# Cutting a release
# 1. Bump version in packages/shared/package.json (minor bump per project convention)
# 2. npm run sync-versions
# 3. git commit -am "Bump to X.Y.Z"
# 4. Tag + push — CI builds both zips (see "CI / release workflow")
```

### Mapping from today's commands

| Today | New equivalent |
|---|---|
| `npm start` | `npm run dev:firefox` (chrome added: `npm run dev:chrome`) |
| `npm run build` | `npm run build` (builds both) |
| `npm run lint` | `npm run lint` (lints both via `--workspaces --if-present`) |
| `./build-config.sh` | Gone — happens inside esbuild's `define` |

### TypeScript project references

`tsconfig.base.json` at the root sets strict TS config. Each package's `tsconfig.json` extends it. Root `tsconfig.json` is a solution file:

```jsonc
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/firefox" },
    { "path": "./packages/chrome" }
  ]
}
```

`tsc -b` at the root type-checks everything in dependency order. esbuild ignores this entirely — they are orthogonal.

## CI / release workflow

```yaml
# .github/workflows/release.yml
name: Build extension ZIPs

on:
  release:
    types: [created]
  workflow_dispatch:

permissions:
  contents: write

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: [firefox, chrome]
      fail-fast: false                  # if one breaks, still emit the other zip
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version-file: ".nvmrc"
          cache: "npm"

      - run: npm ci

      - name: Write .env from secrets
        env:
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
        run: |
          if [ -z "$UNSPLASH_ACCESS_KEY" ]; then
            echo "::error::UNSPLASH_ACCESS_KEY secret is not set."; exit 1
          fi
          printf 'UNSPLASH_ACCESS_KEY=%s\n' "$UNSPLASH_ACCESS_KEY" > .env

      - run: npm run typecheck

      - run: npm run build:${{ matrix.target }}

      - run: npm run lint -w @topmarks/${{ matrix.target }}

      - run: npm run package -w @topmarks/${{ matrix.target }}

      - name: Attach ZIP to release
        if: github.event_name == 'release'
        uses: softprops/action-gh-release@v3
        with:
          files: packages/${{ matrix.target }}/web-ext-artifacts/*.zip

      - name: Upload ZIP as workflow artifact
        if: github.event_name == 'workflow_dispatch'
        uses: actions/upload-artifact@v4
        with:
          name: topmarks-${{ matrix.target }}
          path: packages/${{ matrix.target }}/web-ext-artifacts/*.zip
```

A tagged release produces two zips — `topmarks-firefox-vX.Y.Z.zip` and `topmarks-chrome-vX.Y.Z.zip` — both attached to the release. Uploading to addons.mozilla.org and the Chrome Web Store remains a manual step; CI produces the artifacts.

The matrix shape makes adding a third browser (e.g., Edge) later a one-line change.

## Migration order

Six phases. Each phase ends with **a runnable, releasable Firefox extension** so the work can be paused and resumed safely.

### Phase 1 — Scaffold the monorepo (no behavior change)

- Create `packages/shared/`, `packages/firefox/`, `packages/chrome/` empty.
- Add root `package.json` with workspaces, `tsconfig.base.json`, root `tsconfig.json` with project references.
- `git mv` today's files into `packages/firefox/`: `newtab.html`, `newtab.css`, `newtab.js`, `theme-init.js`, `manifest.json`, `web-ext-config.cjs`, `_locales/`, `icons/`, `fonts/`, `sample-bookmarks.html`, `build-config.sh`.
- Verify `npm install` + `npm run build -w @topmarks/firefox` produces a Firefox zip identical to today's. `web-ext lint` passes.
- **Checkpoint:** Firefox extension works exactly as before. PR-able as a move-only diff.

### Phase 2 — Introduce the build pipeline in the Firefox package

- Add `esbuild`, `tsx`, `typescript` as root dev deps.
- Create `packages/firefox/build.ts` and `packages/firefox/tsconfig.json`.
- Rename `newtab.js` → `newtab.ts` and `theme-init.js` → `theme-init.ts`. No logic change; no TS types beyond `any`.
- esbuild now bundles into `packages/firefox/dist/`; static-copy step assembles HTML/CSS/locales/icons/fonts/manifest in `dist/`.
- Delete `build-config.sh`; replace with esbuild `define` reading `.env`.
- `npm run dev` (web-ext run pointed at `dist/`) works.
- **Checkpoint:** Firefox extension still works, now via the new build pipeline.

### Phase 3 — Extract shared package from Firefox (no Chrome yet)

- Move browser-agnostic logic from `packages/firefox/src/` into `packages/shared/src/`: `theme-init.ts`, `bookmarks.ts`, `unsplash.ts`, `settings.ts`, `search.ts`, `i18n.ts`, `newtab.ts` (orchestrator). Each file gets proper TS types as it's extracted.
- Move assets and locales to `packages/shared/assets/` and `packages/shared/_locales/`.
- Define `Platform` interface in `packages/shared/src/platform.ts`.
- `packages/firefox/src/platform.ts` implements `Platform` using `browser.*`.
- `packages/firefox/src/entry.ts` becomes the three-line wiring described in the Platform abstraction section.
- esbuild alias `@platform` → `./src/platform.ts`.
- **Checkpoint:** Firefox extension still works, identical user-facing behavior. The shared/firefox boundary is real and type-checked.

### Phase 4 — Stand up the Chrome package

- Create `packages/chrome/manifest.json` (MV3, Chrome-shaped).
- Create `packages/chrome/src/platform.ts` implementing `Platform` via `chrome.*`. Toolbar ID `"1"`, `chrome.search.query()` for search submit.
- Mirror `packages/chrome/src/entry.ts` and `packages/chrome/build.ts` from firefox.
- `npm run dev:chrome` launches Chromium with the unpacked extension. Smoke-test every feature: bookmarks render, wallpaper loads, settings persist, theme toggle, search submit (same-tab + new-tab), localization.
- Fix any platform-interface gaps that surface (likely candidates: storage change events, bookmarks event names — adjust the `Platform` interface and both impls).
- **Checkpoint:** Both extensions work end-to-end locally.

### Phase 5 — Migrate Firefox manifest MV2 → MV3

- Edit `packages/firefox/manifest.json` to MV3 shape (`manifest_version: 3`, `host_permissions` split).
- Re-test in Firefox 142+. Newtab override, bookmarks, search, storage all work identically — none of these APIs changed across MV2/MV3 for the surfaces used.
- If anything breaks, fix it in Firefox's `platform.ts` (most likely) or the manifest. Shared code shouldn't need changes.
- **Checkpoint:** Both extensions are MV3, both pass `web-ext lint`, both run.

### Phase 6 — CI + release

- Update `.github/workflows/release.yml` to the matrix build.
- Run a `workflow_dispatch` to confirm both zips build and upload as artifacts.
- Bump `packages/shared/package.json` from `1.8.0` to `1.9.0` (minor bump per the project versioning convention — this release adds a Chrome target).
- `npm run sync-versions`, commit, tag, release.
- **Checkpoint:** Tagged release produces both zips. Manual upload to AMO and the Chrome Web Store.

### Ordering rationale

Chrome (Phase 4) lands before the Firefox MV3 migration (Phase 5) because Chrome forces the platform abstraction to be honest. Migrating Firefox to MV3 second means that step only has one variable to debug (manifest shape) rather than two (manifest + new platform boundary).

Phases 1 and 2 could combine into one PR. Splitting them gives a clean "no behavior change" first PR.

## Risks & mitigations

- **`chrome.search.query()` behaves differently than expected.** The `Platform.search.submit()` boundary lets us swap to `chrome.tabs.update({url: defaultEngineUrl + encodeURIComponent(query)})` in Chrome's `platform.ts` only. Shared code unaffected. Tested in Phase 4.
- **Existing Firefox users see a permission re-prompt on the MV3 upgrade.** Same precedent as the search-field rollout. Document in release notes.
- **Translation drift if anyone touches `_locales/` during the migration.** A single PR moves locales in Phase 1; subsequent changes go to `packages/shared/_locales/` only. No multi-PR exposure window.
- **`config.local.js` getting committed.** It stops existing after Phase 2. Removed from `.gitignore` to prevent future confusion.
- **TypeScript strictness surprising the existing code.** Phase 2 keeps `any` everywhere. Phase 3 adds types incrementally as files move into shared, so type errors surface in small batches tied to the file being moved.

## Testing

End-to-end manual smoke test in both browsers after Phase 4 and again after Phase 5. For each browser:

- Bookmarks bar renders folders and links.
- Folder dropdown opens and works.
- Wallpaper loads from Unsplash; attribution appears.
- Wallpaper backoff/error UI surfaces when Unsplash is unreachable (toggle airplane mode mid-load).
- Settings persist across reloads: hide folder icons, center bookmarks, bookmarks position, theme (auto/light/dark), style (glass/classic), background enabled, refresh interval, show search field.
- Theme + style switching has no flash of incorrect state (theme-init.ts works).
- Search field: type query + Enter → same tab navigates to default engine. Shift+Enter → new tab with results, Topmarks tab stays.
- Localization: each of the seven locales renders correctly (test by changing browser language).

Type-check (`tsc -b`) and `web-ext lint` for both packages must pass in CI.

## Open questions

None. Design is ready for an implementation plan.
