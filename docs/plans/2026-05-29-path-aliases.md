<!--
  PLAN DOC — docs/plans/2026-05-29-path-aliases.md
  See CLAUDE.md ("Plan docs") for the convention.
-->

# Path aliases — `import … from "@/…"`

> Replace same-directory relative imports (`./settings.js`) with a per-package
> `@/` alias rooted at each package's `src/`. Verified working across `tsc -b`
> and the esbuild bundle.

**Status:** Built · **Date:** 2026-05-29 · **Scope:** build/tooling · both stores

## What changes

No user-facing or runtime change. This is an authoring-ergonomics change.

- Inside a package, imports read `@/settings` instead of `./settings.js`.
- The alias is **package-local**: `@/` = that package's `src/`. Cross-package imports keep using the workspace name (`@topmarks/shared`).
- The `.js` extension can be dropped on aliased imports.

## Why / context

Two honest caveats up front, because they shape whether this is worth doing:

- **There is no deep nesting to flatten.** Every intra-package import today is same-directory (`./foo.js`) — a grep for `../` inside `packages/*/src` returns nothing. So this is *cosmetic / consistency*, not a rescue from `../../../` chains.
- **It pays off mainly if `src/` gains subdirectories** (e.g. `src/ui/`, `src/features/`). Then `@/settings` stays stable regardless of the importing file's depth, and files can move without rewriting their imports.

The reason it's safe in this monorepo (the part I was unsure about and tested):
**esbuild auto-discovers the nearest `tsconfig.json` per source file**, so when
the firefox/chrome build inlines shared's source, `@/` inside `shared/src/*`
resolves against *shared's* config — not the consumer's. Confirmed with a decoy
sibling file that a wrong resolution would have picked up; it didn't.

## Approach

Per-package `paths` (not in `tsconfig.base.json` — a base-level relative path
would resolve against the repo root, pointing all packages at the wrong `src/`).
With `moduleResolution: "Bundler"`, no `baseUrl` is needed.

| File | Change |
|------|--------|
| `packages/shared/tsconfig.json` | Add `"paths": { "@/*": ["./src/*"] }` to `compilerOptions`. |
| `packages/firefox/tsconfig.json` | Same `paths` entry. (Only 2 src files, so low payoff here — added for consistency.) |
| `packages/chrome/tsconfig.json` | Same `paths` entry. |
| `packages/shared/src/*.ts` | Rewrite the ~20 same-dir imports: `./x.js` → `@/x`. Main beneficiary (bookmarks, settings, newtab, search, i18n, unsplash, folder-emojis, platform). |
| `packages/{firefox,chrome}/src/*.ts` | No intra-package relative imports to change (both only import `@topmarks/shared`). |

*Out of scope: `build.ts`'s `../shared/src/build-helpers/…` import. It lives
outside `src/` and crosses packages, so the `@/*→./src/*` alias doesn't cover
it. Leaving it as a plain relative import.*

```
shared/src/bookmarks.ts: @/i18n → shared's tsconfig → shared/src/i18n.ts
firefox build inlines shared → esbuild finds shared/tsconfig.json → resolves @/ correctly
```

## Verification

All of the following were run during a throwaway trial (then reverted) and passed:

| Check | Result |
|-------|--------|
| `npm run typecheck` (`tsc -b`, all 3 packages) | ✓ exit 0 |
| esbuild bundle of firefox entry (inlines shared) | ✓ resolves, 0 unresolved `@/` |
| decoy-sibling cross-package test | ✓ picked correct package's file |

On the real change, re-run: `npm run typecheck` and `npm run build` (both
stores), then a quick manual load of the dev extension to confirm the new tab
renders.

---

## Decisions

> **✓ Per-package paths, not base config** — a relative `paths` in `tsconfig.base.json` resolves against the base file's dir (repo root), so each package gets its own entry.

> **✓ No build.ts / runtime changes** — esbuild + tsx already resolve tsconfig `paths` per file; no plugin, alias map, or bundler config needed.

> **✓ Drop the `.js` extension on aliased imports** — bundler resolution doesn't need it; `@/settings` reads cleaner than `@/settings.js`.

## Open / to confirm

> **? Scope of the rewrite** — convert **all** existing imports now, or just wire up the config so `@/` is *available* and let new code opt in? Given there's no nesting to fix, “config-only” is a defensible middle ground.

> **? Is this worth doing at all right now?** — purely cosmetic on the current flat layout. Strongest justification is a near-term plan to add subdirectories under `src/`. If none is planned, deferring is reasonable.
