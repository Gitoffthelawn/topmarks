# Tab groups in the bookmarks bar

> Surface the browser's native tab groups in Topmarks — including ones that are
> currently closed — so they can be reopened in one click from where they
> belong: the bookmarks bar.

**Status:** Proposed · **Date:** 2026-06-02 · **Scope:** both stores · new background worker · opt-in permissions

## What changes

1. A single **tab-groups icon** appears in the bookmarks bar (a native-ish glyph with Topmarks' personality). It's hidden when the feature is off; when on it stays visible even with no saved groups — the menu then shows an explanatory empty-state note.
2. Clicking it opens a dropdown listing the user's **closed** tab groups — each row a **color dot + name** (and tab count). Open groups aren't listed; they're already visible in the tab strip.
3. **Clicking a row reopens the group**: its tabs open and bundle into a real native tab group with the same name and color.
4. Each row has a **kebab (⋮)** on the right to manage it — for the MVP, *Forget* (remove from Topmarks). Rename/recolor are left as room to grow.
5. The feature is **off by default**. Enabling it in Settings prompts for the extra permissions; a default install ships today's permission set unchanged.

## Why / context

Browsers put saved tab groups in the bookmarks bar — it's where users expect to
manage and reopen them — so Topmarks, which renders that bar, feels incomplete
without them.

The hard constraint: **no WebExtension API exposes saved / closed tab groups.**
`tabGroups.query` only returns groups currently open in a window (its
`collapsed` filter means *visually collapsed but still open*, not closed), and a
`TabGroup` has no “saved” flag — every one carries a `windowId`. Chrome's team
confirmed saved/pinned groups aren't returned and can't be detected. Firefox is
the same.

So we can't read the browser's saved groups directly. Instead Topmarks becomes
the persistence layer the API lacks: **while a group is open we can read its
name, color, and member URLs** (`tabGroups` + `tabs`), so we snapshot it to our
own storage and reopen it later as a fresh native group. Reopening is a faithful
*re-creation* (a new native `groupId`), independent of the browser's own saved
copy.

## Approach

### Data model — a snapshot store in `storage.local`

A `tabGroups` array of snapshots:

```
{ id, nativeId?, title, color, tabs: [{ url, title }], state: "open" | "closed", lastSeenAt }
```

- `id` — our own stable id (`crypto.randomUUID()`), *not* the native `groupId`, which changes across restarts and reopens.
- `nativeId` — the live group's `groupId` while open; cleared on close. Used to relink a snapshot to its live group within a session.
- **Reconciliation by identity.** A live group is matched to its snapshot by `nativeId` first, then by **title + color** (URLs drift across reopen, so they're not part of the key — except for *unnamed* groups, where the URL set is the only discriminator). This stops a reopened group from duplicating its entry while keeping distinct groups separate.
- **Never auto-deleted.** `onRemoved` fires for both *close* and *delete* — the API can't tell them apart, and true deletion of a saved group emits no event at all. So we treat the store as the user's archive: `onRemoved` only flips `state → "closed"`; removal is user-only (kebab → Forget).

### Capture — both watcher and backstop

```
group opens/changes → background watcher upserts snapshot (open)
group removed → watcher marks snapshot closed (never deletes)
new tab loads → backstop queries open groups, upserts (catches misses)
```

### Reopen flow

```
click row → tabs.create(urls) → tabs.group(tabIds) → tabGroups.update(title, color) → mark snapshot open
```

### UI — one icon, reusing existing machinery

The icon button and its dropdown reuse the bookmarks bar's existing
folder-button + `.folder-dropdown` patterns (open/close, outside-click dismiss,
position flipping). Rows render color dot + name + count; the kebab opens a small
manage menu.

### Permissions — opt-in, base stays minimal

Reading group members needs `tabs` + `tabGroups`. These go in
`optional_permissions`, requested via `permissions.request()` only when the user
enables the feature (a user gesture in Settings). The background watcher
registers its listeners only once permission is held. Disabling can relinquish
them.

### Files

| File | Change |
|------|--------|
| `shared/src/tab-groups.ts` _(new)_ | Snapshot store (load/upsert/reconcile/forget), reopen logic, and the bar icon + dropdown rendering. The feature's core. |
| `shared/src/background.ts` _(new)_ | Platform-agnostic watcher: subscribes to group/tab events, upserts snapshots, marks closed on removal. Started by each platform's background entry. |
| `chrome/src/background.ts` _(new)_ | MV3 service-worker entry: binds the Chrome platform and runs the shared watcher. |
| `firefox/src/background.ts` _(new)_ | Firefox background entry — a non-persistent event page (`background.scripts`): binds the Firefox platform and runs the shared watcher. |
| `shared/src/platform.ts` | Extend `Platform` with a `tabGroups` surface: `queryOpen()`, `reopen(snapshot)`, group/tab change events, and permission request/contains/remove helpers. |
| `chrome/src/platform.ts` | Implement `tabGroups` over `chrome.tabGroups` / `chrome.tabs` / `chrome.permissions`. |
| `firefox/src/platform.ts` | Same over `browser.*` equivalents. |
| `shared/src/settings.ts` | New `tabGroupsEnabled` setting; enabling triggers the optional-permission request, disabling relinquishes them and stops the watcher. The snapshot archive is kept (user purges manually). |
| `shared/src/newtab.ts` | Wire the tab-groups icon into the bar render path and the new-tab snapshot backstop; render only when enabled. |
| `shared/assets/newtab.html, newtab.css` | Settings tile for the toggle; styles for the icon, dropdown rows, color dots, and kebab menu. |
| `chrome/manifest.json, firefox/manifest.json` | Add `optional_permissions: ["tabs", "tabGroups"]` and a `background` entry per platform. |
| `shared/_locales/*/messages.json` | New strings: icon label, empty state, Forget, errors. |

## Verification

- Type-check and build both packages (`tsc` + the package build); `validate-dist` passes.
- **Chrome manual:** enable the feature (permission prompt appears) → create a tab group → close it → confirm it now appears in the dropdown → click → confirm it reopens as a native group with matching name + color.
- **Firefox manual:** same walk-through.
- **Lifecycle:** reopen-via-browser doesn't duplicate the snapshot (signature reconcile); *Forget* removes it; deleting a group in the browser leaves the Topmarks archive entry (expected — no signal).
- **Privacy:** a default install (feature off) requests no new permissions; disabling relinquishes them.

---

## Decisions

> **✓ Native groups, not folder stand-ins** — the unit is the browser's real tab group, captured live — not a bookmark folder reframed as a group.

> **✓ Topmarks persists snapshots; reopen re-creates** — since saved/closed groups aren't queryable, we snapshot open groups to our storage and rebuild them as fresh native groups on click.

> **✓ Never auto-delete** — `onRemoved` can't distinguish close from delete, so it only marks a snapshot closed. The store is the user's archive; only the user forgets entries.

> **✓ Capture = watcher + new-tab backstop** — background worker for reliability, plus a snapshot on each new-tab load as a safety net.

> **✓ Opt-in, optional permissions** — `tabs` + `tabGroups` are requested only on enable, preserving the minimal default install.

> **✓ One bar icon → dropdown → click-to-reopen + kebab** — a single entry point that reuses the existing folder dropdown machinery; kebab manages each group.

> **✓ Dropdown lists closed groups only** — open groups are already visible in the tab strip; the value is reopening closed ones. We still snapshot open groups — we just don't list them.

> **✓ Disable keeps the archive; purge is manual** — turning the feature off relinquishes permissions and stops the watcher but keeps snapshots, so re-enabling restores the list. Removal is the user's call, via kebab → Forget.

> **✓ Kebab MVP = Forget only** — two deliberate steps (kebab → Forget), no one-click bin. Rename/recolor are deferred.

> **✓ Firefox background = non-persistent event page** — Chrome uses `background.service_worker`; Firefox uses `background.scripts` (event page). Each manifest carries its own key; the shared watcher registers listeners at top level so a suspended page re-wakes on group/tab events.
