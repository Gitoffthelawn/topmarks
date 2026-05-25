# Search Field — Design

**Status:** Draft
**Date:** 2026-05-25

## Summary

Add an optional search field to the Topmarks new-tab page, positioned in the upper third of the viewport. The field submits to the user's default Firefox search engine via `browser.search.search()`. It is disabled by default; enabling it triggers a runtime request for the `search` permission so users who never enable the feature are not prompted on update.

## Goals

- Let users search from the new-tab page without going to the address bar.
- Use the user's existing default search engine — no engine picker, no third-party calls, no query storage.
- Keep the existing new-tab experience unchanged for users who do not opt in.

## Non-goals

- Search-engine selection inside Topmarks.
- Search suggestions, history, or autocomplete.
- URL detection (typing `github.com` will search, not navigate).
- Voice input, search shortcuts, or keyword/bang syntax beyond what the user's engine itself supports.

## User stories

- As a user, I open a new tab, the search field is focused, I type a query and press Enter — the current tab navigates to my default engine's results page.
- As a user, I want to keep my Topmarks tab open while searching — I press Shift+Enter (or Ctrl/Cmd+Enter) and results open in a new tab.
- As a user who does not want a search field, I never see it. On update, Firefox does not prompt me for any new permission.
- As a user who toggles the field on, Firefox prompts me once to grant the `search` permission. If I decline, the toggle reverts to off and I see a brief inline message.

## API & permission

### Firefox Search API

`browser.search.search({ query, tabId })` submits a query to the user's current default search engine in Firefox. Tab destination:

- **Same tab (default Enter):** call `search({ query, tabId })` with `tabId` obtained from `browser.tabs.getCurrent()`.
- **New tab (Shift/Ctrl/Cmd+Enter):** call `browser.tabs.create({ url: "about:blank", active: true })`, then `search({ query, tabId: newTab.id })`.

Empty query (after `.trim()`) → ignore the submit.

### Permission strategy

`"search"` is declared as an **optional permission** in `manifest.json`:

```json
"optional_permissions": ["search"]
```

When the user toggles **Show search field** on:

1. Call `browser.permissions.request({ permissions: ["search"] })`.
2. If granted: persist `showSearch: true`, render the field, focus it.
3. If denied: revert the toggle to off, do not persist, surface a one-line inline note in the settings panel: "Search permission is required to enable this feature."

When the user toggles it off:

- Persist `showSearch: false` and remove the field from the DOM.
- Do **not** call `browser.permissions.remove(...)` — leaving the permission granted means re-enabling later does not re-prompt. Users who want to revoke can do so in `about:addons`.

## Layout

- The search field lives inside `<main id="content">`, which is currently empty.
- Vertical position: upper third of the viewport — implemented by giving `<main>` a `padding-top: 33vh` (or a flex spacer). This is independent of `bookmarksPosition` (top/bottom); when bookmarks are at the bottom, the empty space below the field grows.
- Horizontal: centered.
- Width: `min(600px, 90vw)`.

## Styling

The field has no surrounding buttons, no magnifying-glass icon, and no clear button. Placeholder text "Search…" uses `opacity: 0.5`.

### Glass style (`[data-style="glass"]`)

- Translucent background: `backdrop-filter: blur(...)` plus a semi-transparent fill that uses the existing `--surface` token at reduced alpha so the wallpaper shows through.
- Subtle 1px inner border using existing border token.
- Generous border-radius (matches existing pill-like glass surfaces).
- No drop shadow — keep it unobtrusive.

### Classic style (`[data-style="classic"]`)

- Flat, opaque background using `--surface`.
- 1px border using existing border token.
- Small border-radius (4–6px) — utilitarian, not pill-shaped.
- No backdrop blur.

### Both styles

- Font: inherits the page font.
- Font-size: ~1.1rem (slightly larger than body, makes it the page focal point).
- Padding: ~12px 16px.
- Focus state: subtle border color shift using existing accent/focus tokens — no glow.
- Respect existing theme tokens for light/dark — no new theme variables needed.

## Behavior

### Focus

- On `init()`, after settings load, if `showSearch` is true, call `input.focus()`.
- Auto-focus consequence: bookmarks bar is no longer the first Tab stop. Shift+Tab from the input reaches it. This trade-off is acceptable because the primary new-tab use cases are "type to search" and "click a bookmark"; neither suffers.

### Keyboard

| Key | Action |
|---|---|
| Enter | Submit same-tab if query non-empty |
| Shift+Enter, Ctrl+Enter, Cmd+Enter (macOS) | Submit new-tab if query non-empty |
| Escape (with text) | Clear input, keep focus |
| Escape (empty) | Blur input |

### Edge cases

- Permission denied on toggle-on → toggle reverts, inline message shown.
- Permission granted but `browser.search.search()` throws (no default engine, internal error) → log to console, no user-visible change beyond the failed navigation. Same-tab submit failure leaves the new tab on Topmarks; new-tab submit leaves an `about:blank` tab. Acceptable for an edge case unlikely to occur in practice.
- Very narrow viewport: input width clamps via `90vw`.
- Settings panel open/close must not move focus away from the input. Current settings-panel code already only changes focus to its own button — verify no regression.

## Settings UI

A new row in the settings panel, placed in the checkbox group with the other on/off toggles:

```
[ ] Hide folder icons
[ ] Center bookmarks in bar
[ ] Show background image
[ ] Show search field          ← new
```

`data-setting="showSearch"`, default `false`.

When this toggle is on but the user later revokes the `search` permission externally (e.g., in `about:addons`), the next call to `browser.search.search()` will fail. We accept this as an edge case and rely on the in-extension toggle as the source of truth for whether to render the field.

## Files touched

- `manifest.json` — add `"search"` to `optional_permissions`.
- `newtab.html` — add the `<input id="search-input">` inside `<main id="content">`; add the toggle row in the settings panel.
- `newtab.css` — search-field styles for glass and classic.
- `newtab.js`:
  - Add `showSearch: false` to `SETTINGS_DEFAULTS`.
  - Add `setupSearch()` called from `init()`.
  - Extend `handleSettingChange()` for the `showSearch` key, with the permission-request flow.
  - Wire Enter / modifier-Enter / Escape handlers.
- `_locales/*/messages.json` — add:
  - `searchPlaceholder` — "Search…"
  - `showSearchField` — settings label
  - `searchPermissionDenied` — inline message when the user declines the prompt

## Testing

- Manual: toggle on → permission prompt → grant → field appears and is focused.
- Manual: toggle on → permission prompt → deny → toggle stays off, inline note appears.
- Manual: type query, Enter → current tab navigates to default engine's results.
- Manual: type query, Shift+Enter → new tab opens with results, Topmarks tab stays.
- Manual: type, Escape → clears; Escape again → blurs.
- Manual: toggle off → input removed from DOM, no layout artifacts.
- Manual: with glass + dark theme, with classic + light theme — confirm styling matches the rest of the page.
- Manual: with `bookmarksPosition: "bottom"` — confirm field is still upper-third.
- Manual: narrow viewport (~400px) — confirm field does not overflow.

## Open questions

None — design is ready for an implementation plan.
