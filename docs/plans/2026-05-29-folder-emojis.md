# Per-folder emoji icons for top-level folders

> Let users replace the generic folder icon of any first-level toolbar folder
> with an emoji of their choice — pasted from the OS emoji picker — managed
> through a new settings overlay. Shipped to both Chrome & Firefox from one
> shared codebase, plus marketing copy.

**Status:** Built · **Date:** 2026-05-29 · **Scope:** Both stores (shared package) · no build-system changes · 7 locales

## What the user sees

1. A new **“Folder emojis”** action row appears in the settings panel.
2. Tapping it opens a centered **overlay** listing every first-level toolbar folder.
3. Each row shows the folder name, a small paste field, and a clear (`✕`) button.
4. The user pastes an emoji from the OS picker (⌃⌘Space on macOS); it immediately replaces that folder's icon in the bar.
5. Clearing the field reverts the folder to its default SVG icon.

## Why this is cheap to ship to both stores

All UI and behaviour live in `packages/shared`. Chrome and Firefox each consume
it through a thin `platform.ts` shim (`storage`, `bookmarks`, `i18n` are already
abstracted). **One implementation covers both stores** — no per-package code, no
manifest changes, no new permissions.

## Storage model

Emojis are keyed by folder `id` (stable per browser). Add one field to the
existing settings object:

```ts
// settings.ts → SETTINGS_DEFAULTS
folderEmojis: {} as Record<string, string>   // folderId → emoji
```

It loads & persists with the existing settings machinery for free. Stale ids
(from deleted folders) are harmless — the overlay only ever lists folders that
currently exist.

## Files to change

| File | Change |
|------|--------|
| `shared/src/settings.ts` | Add `folderEmojis` default + helpers `getFolderEmoji`, `setFolderEmoji`, `clearFolderEmoji`, and a `storage.onChanged` listener that updates the in-memory map & re-renders. **Remove** the obsolete `hideFolderIcons` default and its `applyClassSettings` branch (keep `centerBookmarks`). |
| `shared/src/bookmarks.ts` | In `createTopLevelFolder` *only*: render a `<span class="folder-emoji">` in place of the SVG when an emoji exists. Export `isFolder` for reuse. Submenu folders untouched. |
| `shared/src/folder-emojis.ts` _(new)_ | The overlay: open/close wiring, builds the folder list from the toolbar, and the emoji-validation logic. |
| `shared/src/newtab.ts` | Call `setupFolderEmojiOverlay()` and the storage listener in `startApp`. |
| `shared/assets/newtab.html` | Add the settings action row + the overlay dialog markup (with `data-i18n` hooks). **Remove** the “Hide folder icons” setting row. |
| `shared/assets/newtab.css` | `.folder-emoji` sizing, overlay/backdrop/card + per-folder row styles, reusing existing glass tokens. **Remove** the `body.hide-folder-icons` rule. |
| `shared/_locales/*/messages.json` | Add new keys across all 7 locales (en, es, fr, it, de, ja, zh_CN). **Remove** the `hideFolderIcons` key from each. |

## Emoji input restriction

No custom picker — paste only, per the requirement. Restriction is **best-effort
and never blocks a real emoji**:

1. Take the first grapheme cluster via `Intl.Segmenter` (handles multi-codepoint emoji).
2. Validate against `/\p{RGI_Emoji}/v` — covers ZWJ sequences, flags, skin tones. Supported in current Chrome & Firefox.
3. Fallback if the `v` flag / RGI is unavailable: `/\p{Extended_Pictographic}/u`.
4. If *no* Unicode-property regex is supported at all, accept the input unrestricted — so the picker is never crippled.
5. Empty field = clear the emoji.

*Net effect: on today's browsers paste is restricted to genuine emoji; on
hypothetical old engines it degrades to “accept anything” rather than rejecting
valid emoji.*

## Data flow

```
paste emoji → sanitizeEmoji() → setFolderEmoji(id, emoji)
  → storage.set({ folderEmojis })
  → storage.onChanged fires (this tab + every other open new-tab)
  → in-memory map updated → renderBookmarks() → bar shows the emoji
```

*A single render path (driven by `storage.onChanged`) keeps every open tab in
sync and avoids double-rendering.*

## Marketing & docs

- `site/index.html` — a new feature card (“Folders with personality”) in the `#features` grid, and update the “Tuned to taste” copy (which currently cites “hide folder icons”) to mention emoji folders instead.
- `README.md` — a Features bullet + a Configuration entry, and remove the “Hide folder icons” line from the Configuration list.
- `LISTING_CWS.md` & `LISTING_AMO.md` — add the feature to both store listings; remove any “hide folder icons” mention.
- `PRIVACY.md` & `CWS_SUBMISSION.md` — update the stored-settings lists: drop “hide folder icons”, add “folder emojis”.

*Historical plan/spec files under `docs/superpowers/` are left as-is — they
record past work.*

## Verification

- `npm run typecheck` · `npm run build` (both packages) · `npm run lint`
- Manual: load in Chrome + Firefox, paste & clear emojis, confirm persistence, confirm other open tabs update live.

---

## Decisions (confirmed with you)

> **✓ Scope** — first-level folders only; submenu folders keep the default SVG icon.

> **✓ “Hide folder icons” toggle — removed** — the toggle is dropped entirely. Every folder always shows one icon: its emoji if set, otherwise the default SVG. This removes the conflict of two parallel icon systems. Existing users' stored `hideFolderIcons` value is simply ignored (harmless leftover).

> **✓ Entry point** — a “Folder emojis” action row in settings opens a dedicated centered overlay listing the folders.

## Open / worth a glance before I build

> **? Restriction strictness** — on modern browsers the field will reject non-emoji text (e.g. pasting a word does nothing). That's the intended “restrict to emoji” behaviour — flag me if you'd rather it always accept whatever is pasted.

> **? Marketing reach** — plan touches site + README + both store listings. If you also want the screenshot set refreshed to show emoji folders, that's a separate follow-up (needs new captures).
