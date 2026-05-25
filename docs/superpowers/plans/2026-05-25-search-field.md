# Search Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, default-on search field to the Topmarks new-tab page that submits queries through Firefox's default search engine.

**Architecture:** A single `<input>` lives inside `<main id="content">`, attached/detached based on a `showSearch` setting (default `true`). Submit goes through `browser.search.search({ query, tabId })`. The `"search"` permission is declared as required in `manifest.json`. Styling reuses existing `--glass-*` and theme tokens so glass/classic + light/dark all work for free. No build step, no test framework — verification is manual via `web-ext run` and `npm run lint`.

**Tech Stack:** Firefox WebExtensions MV2 (`browser.search`, `browser.tabs.getCurrent()`, `browser.storage.local`), vanilla DOM, `web-ext` for lint and run.

**Spec:** `docs/superpowers/specs/2026-05-25-search-field-design.md`

---

## Files touched

- **Modify** `manifest.json` — add `"search"` to `permissions`.
- **Modify** `_locales/{en,es,fr,de,it,ja,zh_CN}/messages.json` — add `searchPlaceholder` and `showSearchField` keys.
- **Modify** `newtab.html` — add the `<input id="search-input">` inside `<main id="content">`, add a toggle row in the settings panel.
- **Modify** `newtab.css` — add styles for `#search-input` and the layout rule on `#content`.
- **Modify** `newtab.js`:
  - Add `showSearch: true` to `SETTINGS_DEFAULTS`.
  - Extend `applyI18n()` with `data-i18n-placeholder` support.
  - Add `setupSearch()` and call from `init()`.
  - Extend `handleSettingChange()` to attach/detach the field and refocus.

---

## Task 1: Add locale strings and required `search` permission

**Files:**
- Modify: `manifest.json:12-16`
- Modify: `_locales/en/messages.json`, `_locales/es/messages.json`, `_locales/fr/messages.json`, `_locales/de/messages.json`, `_locales/it/messages.json`, `_locales/ja/messages.json`, `_locales/zh_CN/messages.json`

- [ ] **Step 1: Add `"search"` to manifest permissions**

In `manifest.json`, replace the `permissions` array:

```json
  "permissions": [
    "bookmarks",
    "storage",
    "search",
    "https://api.unsplash.com/*"
  ],
```

- [ ] **Step 2: Add the two new keys to every locale**

Insert these two keys in each `_locales/<lang>/messages.json` right after `"showBackgroundImage"`. The keys must be the same in every file; only the message text differs.

**`_locales/en/messages.json`**

```json
  "showSearchField": { "message": "Show search field" },
  "searchPlaceholder": { "message": "Search…" },
```

**`_locales/es/messages.json`**

```json
  "showSearchField": { "message": "Mostrar campo de búsqueda" },
  "searchPlaceholder": { "message": "Buscar…" },
```

**`_locales/fr/messages.json`**

```json
  "showSearchField": { "message": "Afficher le champ de recherche" },
  "searchPlaceholder": { "message": "Rechercher…" },
```

**`_locales/de/messages.json`**

```json
  "showSearchField": { "message": "Suchfeld anzeigen" },
  "searchPlaceholder": { "message": "Suchen…" },
```

**`_locales/it/messages.json`**

```json
  "showSearchField": { "message": "Mostra campo di ricerca" },
  "searchPlaceholder": { "message": "Cerca…" },
```

**`_locales/ja/messages.json`**

```json
  "showSearchField": { "message": "検索欄を表示" },
  "searchPlaceholder": { "message": "検索…" },
```

**`_locales/zh_CN/messages.json`**

```json
  "showSearchField": { "message": "显示搜索框" },
  "searchPlaceholder": { "message": "搜索…" },
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS, no errors. (`web-ext lint` will validate JSON syntax in every locale and validate the manifest. Any trailing-comma slip-up will be caught here.)

- [ ] **Step 4: Commit**

```bash
git add manifest.json _locales/*/messages.json
git commit -m "Add search permission and locale strings"
```

---

## Task 2: Add HTML markup

**Files:**
- Modify: `newtab.html:23` (the empty `<main id="content">`)
- Modify: `newtab.html:74-75` (after the existing checkbox-style settings)

- [ ] **Step 1: Add the search input inside `<main id="content">`**

Replace this line in `newtab.html`:

```html
    <main id="content"></main>
```

with:

```html
    <main id="content">
      <input
        id="search-input"
        type="search"
        autocomplete="off"
        spellcheck="false"
        data-i18n-placeholder="searchPlaceholder"
        data-i18n-aria-label="searchPlaceholder"
        aria-label="Search"
      />
    </main>
```

Notes:
- `type="search"` rather than `type="text"` — Firefox renders this in a way that still allows our styling; semantically correct.
- `autocomplete="off"` and `spellcheck="false"` keep the field free of browser autofill chrome / red squiggles.
- `data-i18n-placeholder` is a new attribute name; the existing `applyI18n()` in `newtab.js` will be extended to handle it in Task 4.
- `data-i18n-aria-label="searchPlaceholder"` reuses the same string for the accessible name (no need for a second locale key).
- `aria-label="Search"` is a fallback that `applyI18n()` overwrites with the localized message.

- [ ] **Step 2: Add the settings toggle row**

In `newtab.html`, after the existing "Show background image" setting block (it ends with `</label>` around line 74) and before the next `<div class="setting setting-text">` (theme), insert:

```html
      <label class="setting">
        <span data-i18n="showSearchField">Show search field</span>
        <input type="checkbox" data-setting="showSearch" />
        <span class="switch" aria-hidden="true"></span>
      </label>
```

- [ ] **Step 3: Verify markup loads**

Run: `npm run lint`
Expected: PASS.

Then run: `npm start` (this launches `web-ext run`, opening a fresh Firefox profile with the extension loaded).
Open a new tab.
Expected: An unstyled input field appears somewhere in the content area (likely top-left because no CSS yet). The settings panel shows the new "Show search field" toggle. The toggle is enabled by default (default is set in Task 4, but the checkbox starts unchecked here because storage hasn't been initialized for the new key yet — that's fine for this step).

Close the dev Firefox window when done.

- [ ] **Step 4: Commit**

```bash
git add newtab.html
git commit -m "Add search input markup and settings toggle"
```

---

## Task 3: Add CSS styling

**Files:**
- Modify: `newtab.css:342-344` (the existing `#content` rule)
- Modify: `newtab.css` (append new rules below the `#content` rule)

- [ ] **Step 1: Update the `#content` rule**

Replace this rule:

```css
#content {
  padding: 24px;
}
```

with:

```css
#content {
  padding: 24px;
}

body:has(#search-input) #content {
  display: flex;
  justify-content: center;
  padding-top: 33vh;
}
```

`:has()` requires Firefox 121+; this extension's `strict_min_version` is 142, so it's safe to use. When the input is detached in JS (Task 5), the rule stops applying and `#content` returns to its default 24px padding with no layout shift artifacts.

- [ ] **Step 2: Add the search-input styles**

Append below the rule from Step 1:

```css
#search-input {
  width: min(600px, 90vw);
  padding: 12px 18px;
  font: inherit;
  font-size: 1.1rem;
  color: var(--fg);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  box-shadow: var(--glass-shadow);
  /* Remove the default search-type clear button — spec says no buttons. */
  appearance: none;
  -webkit-appearance: none;
}

#search-input::-webkit-search-cancel-button,
#search-input::-webkit-search-decoration {
  -webkit-appearance: none;
  display: none;
}

#search-input::placeholder {
  color: inherit;
  opacity: 0.5;
}

#search-input:focus-visible {
  outline: none;
  border-color: var(--accent);
}

/* Classic style: solid surface, smaller radius, no glass blur or shadow. */
:root[data-style="classic"] #search-input {
  background: var(--glass-bg-strong);
  border-radius: 6px;
  box-shadow: none;
}
```

The glass tokens (`--glass-bg`, `--glass-blur`, `--glass-shadow`, `--glass-border`) and the `--accent` color are already overridden per theme and per style elsewhere in the file, so this rule automatically does the right thing for glass-light, glass-dark, classic-light, and classic-dark. The `prefers-reduced-transparency` media query at the bottom of `newtab.css` already strips backdrop-filter from elements that use it; we'll add `#search-input` to that list next.

- [ ] **Step 3: Honor `prefers-reduced-transparency`**

In `newtab.css`, find the `@media (prefers-reduced-transparency: reduce)` block near the bottom (~line 674). It currently lists `#bookmarks-bar, #settings-btn, #settings-panel, .folder-dropdown, #bg-attribution`. Add `#search-input` to that selector list:

```css
  #bookmarks-bar,
  #settings-btn,
  #settings-panel,
  .folder-dropdown,
  #bg-attribution,
  #search-input {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
```

- [ ] **Step 4: Verify styling**

Run: `npm start`
Open a new tab.
Expected:
- The search input is centered horizontally, positioned at roughly the top third of the viewport.
- In default (glass + auto theme), it has a translucent blurred background.
- Open settings → switch Style to Classic. The field becomes flat and opaque with a smaller radius. Switch back to Glass.
- Switch Theme between Light and Dark. The field's background and text colors follow.
- Switch Bookmarks position to Bottom. The field stays at the top third; bookmarks pin to the bottom.
- Resize the window narrow (~400px). The field clamps to 90vw and doesn't overflow.

Close the dev Firefox window when done.

- [ ] **Step 5: Commit**

```bash
git add newtab.css
git commit -m "Style search input for glass and classic"
```

---

## Task 4: Add `showSearch` default and i18n placeholder support

**Files:**
- Modify: `newtab.js:39-53` (`applyI18n()`)
- Modify: `newtab.js:55-63` (`SETTINGS_DEFAULTS`)

- [ ] **Step 1: Extend `applyI18n()` to handle `data-i18n-placeholder`**

Find the `applyI18n` function (around line 39):

```js
function applyI18n() {
  try {
    const lang = browser.i18n.getUILanguage();
    if (lang) document.documentElement.lang = lang;
  } catch {}
  document.title = t("newTabTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const msg = t(el.dataset.i18nAriaLabel);
    if (msg) el.setAttribute("aria-label", msg);
  });
}
```

Add a third loop right before the closing brace:

```js
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const msg = t(el.dataset.i18nPlaceholder);
    if (msg) el.setAttribute("placeholder", msg);
  });
```

- [ ] **Step 2: Add `showSearch` to `SETTINGS_DEFAULTS`**

Find the `SETTINGS_DEFAULTS` constant (around line 55):

```js
const SETTINGS_DEFAULTS = {
  hideFolderIcons: false,
  centerBookmarks: false,
  backgroundEnabled: true,
  backgroundIntervalHours: 6,
  theme: "auto",
  style: "glass",
  bookmarksPosition: "top",
};
```

Add `showSearch: true` to the object:

```js
const SETTINGS_DEFAULTS = {
  hideFolderIcons: false,
  centerBookmarks: false,
  backgroundEnabled: true,
  backgroundIntervalHours: 6,
  theme: "auto",
  style: "glass",
  bookmarksPosition: "top",
  showSearch: true,
};
```

- [ ] **Step 3: Verify the placeholder localizes**

Run: `npm start`
Open a new tab.
Expected: The input shows the localized "Search…" placeholder (English by default — change Firefox's UI language to test other locales if desired).

The settings toggle for "Show search field" still doesn't do anything when clicked (no `handleSettingChange` wiring yet) — fine, addressed in Task 5.

Close the dev Firefox window when done.

- [ ] **Step 4: Commit**

```bash
git add newtab.js
git commit -m "Wire showSearch default and placeholder i18n"
```

---

## Task 5: Implement `setupSearch()` — attach/detach + auto-focus

**Files:**
- Modify: `newtab.js:836-850` (`handleSettingChange()`)
- Modify: `newtab.js:882-894` (`init()`)
- Modify: `newtab.js` (add the `setupSearch` block)

- [ ] **Step 1: Add the `setupSearch` block**

Add this block right above the `handleSettingChange` function (around line 836):

```js
// Reference to the search input even when detached from the DOM, so toggling
// the setting off then on restores the same element (state preserved).
let searchInput = null;
let searchInputParent = null;

function setupSearch() {
  searchInput = document.getElementById("search-input");
  if (!searchInput) return;
  searchInputParent = searchInput.parentElement;

  if (!settings.showSearch) {
    searchInput.remove();
    return;
  }

  searchInput.focus();
}

function applyShowSearch() {
  if (!searchInput) return;
  if (settings.showSearch) {
    if (!searchInput.isConnected && searchInputParent) {
      searchInputParent.appendChild(searchInput);
    }
    searchInput.focus();
  } else if (searchInput.isConnected) {
    searchInput.remove();
  }
}
```

- [ ] **Step 2: Extend `handleSettingChange` to dispatch on `showSearch`**

Find the `handleSettingChange` function (around line 836):

```js
function handleSettingChange(key) {
  if (key === "hideFolderIcons" || key === "centerBookmarks") {
    applyClassSettings();
  } else if (key === "theme") {
    applyTheme();
  } else if (key === "style") {
    applyStyle();
  } else if (key === "bookmarksPosition") {
    applyBookmarksPosition();
    scheduleReflow();
  } else if (key === "backgroundEnabled" || key === "backgroundIntervalHours") {
    loadBackground();
    if (key === "backgroundEnabled") updateBackgroundErrorVisibility();
  }
}
```

Add a branch for `showSearch`:

```js
function handleSettingChange(key) {
  if (key === "hideFolderIcons" || key === "centerBookmarks") {
    applyClassSettings();
  } else if (key === "theme") {
    applyTheme();
  } else if (key === "style") {
    applyStyle();
  } else if (key === "bookmarksPosition") {
    applyBookmarksPosition();
    scheduleReflow();
  } else if (key === "backgroundEnabled" || key === "backgroundIntervalHours") {
    loadBackground();
    if (key === "backgroundEnabled") updateBackgroundErrorVisibility();
  } else if (key === "showSearch") {
    applyShowSearch();
  }
}
```

- [ ] **Step 3: Call `setupSearch()` from `init()`**

Find the `init` IIFE at the bottom of the file (around line 882):

```js
(async function init() {
  applyI18n();
  await loadSettings();
  applyTheme();
  applyStyle();
  applyBookmarksPosition();
  applyClassSettings();
  syncSettingsUi();
  setupSettingsPanel();
  renderBookmarks();
  loadBackground();
  updateBackgroundErrorVisibility();
})();
```

Add `setupSearch()` between `setupSettingsPanel()` and `renderBookmarks()`:

```js
(async function init() {
  applyI18n();
  await loadSettings();
  applyTheme();
  applyStyle();
  applyBookmarksPosition();
  applyClassSettings();
  syncSettingsUi();
  setupSettingsPanel();
  setupSearch();
  renderBookmarks();
  loadBackground();
  updateBackgroundErrorVisibility();
})();
```

- [ ] **Step 4: Verify attach/detach and auto-focus**

Run: `npm start`
Open a new tab.
Expected: The input is focused (a cursor blinks inside it; you can start typing immediately).

Open settings → uncheck "Show search field".
Expected: The input disappears immediately, the page reflows so `#content` no longer has the 33vh padding (because `body:has(#search-input)` no longer matches).

Re-check "Show search field".
Expected: The input reappears and is focused again.

Open a brand-new tab.
Expected: The setting persists — search input shown and focused.

Toggle off and open a new tab.
Expected: The setting persists — no search input, no extra padding.

Close the dev Firefox window when done.

- [ ] **Step 5: Commit**

```bash
git add newtab.js
git commit -m "Wire search field show/hide and auto-focus"
```

---

## Task 6: Wire submit and keyboard handlers

**Files:**
- Modify: `newtab.js` (extend `setupSearch()`)

- [ ] **Step 1: Add submit and keyboard handlers**

In `newtab.js`, replace the entire `setupSearch` function from Task 5 with this expanded version:

```js
function setupSearch() {
  searchInput = document.getElementById("search-input");
  if (!searchInput) return;
  searchInputParent = searchInput.parentElement;

  searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim();
      if (!query) return;
      e.preventDefault();
      const inNewTab = e.shiftKey || e.ctrlKey || e.metaKey;
      try {
        if (inNewTab) {
          const tab = await browser.tabs.create({
            url: "about:blank",
            active: true,
          });
          await browser.search.search({ query, tabId: tab.id });
        } else {
          const current = await browser.tabs.getCurrent();
          await browser.search.search({ query, tabId: current.id });
        }
      } catch (err) {
        console.error("[Topmarks] Search submit failed:", err);
      }
    } else if (e.key === "Escape") {
      if (searchInput.value !== "") {
        searchInput.value = "";
        // Prevent the document-level Escape handler from also closing the
        // settings panel / dropdowns when the user is just clearing text.
        e.stopPropagation();
      } else {
        searchInput.blur();
      }
    }
  });

  if (!settings.showSearch) {
    searchInput.remove();
    return;
  }

  searchInput.focus();
}
```

The change vs. Task 5: we now register a `keydown` listener on the input before we may detach it. Listeners survive `remove()` and reattachment via `appendChild`, so the same listener fires when the user toggles the field back on.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Verify search submission**

Run: `npm start`
Open a new tab.

Test same-tab submit:
- Type `claude code` and press Enter.
- Expected: The current tab navigates to the default search engine's results page for "claude code".

Open another new tab.

Test new-tab submit:
- Type `firefox extension api` and press **Shift+Enter** (or Ctrl+Enter, or Cmd+Enter on macOS).
- Expected: A new tab opens with the results, and the Topmarks new tab stays open (still showing the search field).

Open another new tab.

Test Escape:
- Type `something`, then press Escape.
- Expected: The text clears, focus stays in the input.
- Press Escape again on the empty input.
- Expected: The input blurs (cursor leaves).

Test empty submit:
- With the empty input focused, press Enter.
- Expected: Nothing happens — no navigation, no error.

Test Escape doesn't close settings while clearing text:
- Open the settings panel (cog icon).
- Refocus the input and type some text.
- Press Escape.
- Expected: Text clears; the settings panel is still open. (Pressing Escape again on the now-empty input blurs it; pressing once more — with focus elsewhere — closes the panel via the document-level handler.)

Close the dev Firefox window when done.

- [ ] **Step 4: Commit**

```bash
git add newtab.js
git commit -m "Wire search submit and Escape handling"
```

---

## Task 7: Final manual verification pass

**Files:** none (verification only)

This walks the testing checklist from the spec to confirm nothing regressed.

- [ ] **Step 1: Run lint one more time**

Run: `npm run lint`
Expected: PASS, no warnings related to our changes.

- [ ] **Step 2: Full visual matrix**

Run: `npm start`. For each combination below, open a new tab and verify the search field looks right and works:

| Style   | Theme | Bookmarks | Check |
|---------|-------|-----------|-------|
| Glass   | Light | Top       | Translucent, blurred wallpaper visible through it |
| Glass   | Dark  | Top       | Dark translucent, blurred wallpaper visible |
| Classic | Light | Top       | Flat white surface, small radius |
| Classic | Dark  | Top       | Flat dark surface, small radius |
| Glass   | Light | Bottom    | Search still upper-third; bookmarks at bottom; no overlap |
| Classic | Dark  | Bottom    | Same as above with classic flat surface |

- [ ] **Step 3: Edge case — narrow viewport**

Resize the dev Firefox window to ~400px wide.
Expected: Search field stays inside the viewport (width clamps to ~90vw), no horizontal scrollbar, no overflow into the bookmarks bar.

- [ ] **Step 4: Edge case — no default search engine**

This is unusual to reproduce, but if you have a test profile with the search engine list empty, type a query and press Enter.
Expected: Console logs `[Topmarks] Search submit failed: ...`, the new tab stays on Topmarks. No alert, no crash. (Skip this step if you can't easily reproduce — it's covered by the try/catch and not worth manually engineering a broken profile.)

- [ ] **Step 5: Bookmark interactions still work**

- Click a top-level bookmark folder. The dropdown opens.
- Hover a folder with a submenu. It opens.
- Use the overflow chevron when the bar is wide enough to need it.
- Toggle "Center bookmarks in bar". The bar centers; the search field stays where it is.
- Toggle "Hide folder icons". Bookmark folders lose their icons; search field unaffected.

- [ ] **Step 6: Background interactions still work**

- Toggle "Show background image" off and on. The search field's glass blur becomes a clean tint over the solid bg color when there's no wallpaper, which is fine.

- [ ] **Step 7: Settings persistence**

- Toggle "Show search field" off.
- Close Firefox.
- Reopen Firefox and open a new tab.
- Expected: Search field is still hidden. Re-enable it via settings.

Close the dev Firefox window when done.

- [ ] **Step 8: Bump the manifest version**

The new permission means a meaningful release for existing users. In `manifest.json`, bump `version` from `1.6.0` to `1.7.0`. Also bump `version` in `package.json` to match.

```json
"version": "1.7.0",
```

- [ ] **Step 9: Final commit**

```bash
git add manifest.json package.json
git commit -m "Bump to 1.7.0 with optional search field"
```
