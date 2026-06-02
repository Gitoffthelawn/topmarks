# Center widget: search, clock, or nothing

> Turn the boolean “Show search field” toggle into a three-way selector (like
> Theme/Style): show the **search field**, a **big bold clock**, or **nothing**
> in the center of the new-tab page.

**Status:** Built · **Date:** 2026-06-01 · **Scope:** shared · both stores

## What changes

1. In Settings, the **“Show search field”** checkbox is replaced by a **“Center”** toggle-group with three options: **Search** · **Clock** · **None** — visually identical to the existing Theme and Style selectors.
2. **Clock** (default) — a large, bold, locale-formatted `HH:MM` clock in the center slot. Updates each minute.
3. **Search** — the rounded search pill, centered at ~33vh, auto-focused.
4. **None** — empty center, just the bookmarks bar and wallpaper.
5. Migration (“clock for everyone”): an explicit stored `showSearch: false` → **None**; explicit `showSearch: true` → **Search**; unset → the new **Clock** default (existing search-by-default users flip to clock once).

## Why / context

The center area is already a single slot: `#content` holds `#search-input` and
is centered via `body:has(#search-input)`. Today visibility is driven
imperatively — `search.ts` calls `.remove()` / re-appends the input. Adding a
second mutually-exclusive widget is cleaner as a **declarative attribute** the
CSS keys off, rather than two independent show/hide paths.

So this change introduces a single source of truth —
`data-center-widget="search|clock|none"` on `<body>` — and lets CSS decide which
child is visible. The selector UI reuses the existing `.toggle-group` +
`data-setting` machinery in `settings.ts` with zero new wiring (the generic
toggle-group click handler already handles it).

## Approach

| File | Change |
|------|--------|
| `packages/shared/src/settings.ts` | Replace `showSearch: true` with `centerWidget: "search" \| "clock" \| "none"` (default `"clock"`). Add `applyCenterWidget()` — sets `document.body.dataset.centerWidget`, starts/stops the clock, and focuses the search input when relevant. In `loadSettings()`, migrate legacy `showSearch` (fetched via `storage.get(["showSearch"])` so an unset key is distinguishable). Swap the `showSearch` branch in `handleSettingChange` for `centerWidget`. |
| `packages/shared/src/clock.ts` _(new)_ | `startClock()` / `stopClock()`. Renders `#clock` via `Intl.DateTimeFormat(undefined, {hour, minute})` (locale-aware 12/24h). Aligns updates to the next minute boundary, then ticks every 60s. Idempotent; clears its timer on stop. |
| `packages/shared/src/search.ts` | Drop the imperative `.remove()` / re-append logic. Keep `setupSearch()` for the keydown handler + initial focus; visibility is now CSS-driven. Replace `applyShowSearch()` (folded into `applyCenterWidget`) or reduce it to a focus helper. |
| `packages/shared/assets/newtab.html` | Add `<div id="clock" aria-hidden="true">` inside `#content` next to the search input. Replace the “Show search field” `<label>` checkbox with a `.toggle-group` radiogroup (`data-setting="centerWidget"`, values `search/clock/none`), mirroring the Theme block. |
| `packages/shared/assets/newtab.css` | Center `#content` when `body[data-center-widget="search"\|"clock"]` (replacing the `:has(#search-input)` rule). Show/hide each child by attribute. Style `#clock`: large bold system sans (`clamp()`-scaled), `--fg` color, glass/classic parity, drop-shadow for legibility over wallpaper. |
| `packages/shared/src/newtab.ts` | Call `applyCenterWidget()` in the startup sequence (after `setupSearch`) instead of passing `showSearch`. |
| `packages/shared/_locales/*/messages.json` | Add `centerLabel`, `centerSearch`, `centerClock`, `centerNone` across all 7 locales (en, de, es, fr, it, ja, zh_CN). Retire `showSearchField` (or leave unused). |

```
settings load → migrate showSearch→centerWidget → applyCenterWidget() → sets body[data-center-widget] → CSS shows search OR clock OR none → if clock: startClock()
```

## Verification

- `npm run build` (or per-package build) — type-checks the new setting union + module, both Chrome & Firefox.
- Load unpacked: toggle Search → Clock → None, confirm each renders and the choice persists across reload and across a second open tab.
- Clock shows correct locale format (e.g. `14:30` vs `2:30 PM`); flips at the minute boundary.
- Legacy migration: seed storage with `showSearch:false`, reload → lands on **None**.
- Glass + Classic styles, light + dark themes all legible over a wallpaper.

---

## Decisions

> **✓ Time format — follow locale** — `Intl.DateTimeFormat` with no locale arg picks 12/24h from the browser. Zero config, native everywhere.

> **✓ Detail — hours:minutes** — no seconds. Updates each minute → calm look and a cheap timer (one tick/min, aligned to the boundary).

> **✓ Typeface — bold system sans** — large, heavy system UI font (not the Cookie script font), `clamp()`-scaled for the “big bold clock” look.

> **✓ Selector shape — replace the checkbox** — a 3-way toggle-group reusing the Theme/Style pattern, not a new control type. Migrates the old boolean.

> **✓ Default — Clock, for everyone** — Clock is the default for new installs and for existing users who never changed the setting (they flip search→clock once). Only an explicit stored `showSearch:false` is preserved as None.

> **✓ Setting label — “Center”** — group label **Center**, options **Search / Clock / None**.
