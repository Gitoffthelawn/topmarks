# Tab Groups in the Bookmarks Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the browser's native tab groups — including closed ones — in the Topmarks bookmarks bar, via a single icon whose dropdown lists closed groups and reopens them as fresh native groups on click.

**Architecture:** The WebExtension APIs expose only *open* tab groups, never saved/closed ones, so Topmarks becomes the missing persistence layer. A background event page watches native groups and **snapshots** each (title, color, member URLs) into `storage.local`; the new-tab page renders the *closed* snapshots and reopens them with `tabs.create` + `tabs.group` + `tabGroups.update`. All browser API access goes through the shared `Platform` interface, implemented per package. The feature is opt-in and its `tabs`/`tabGroups` permissions are optional, requested only on enable.

**Tech Stack:** TypeScript, esbuild (IIFE bundles), MV3 WebExtensions (`chrome.*` / `browser.*`), `chrome.tabGroups` / `chrome.tabs` / `chrome.permissions`. No unit-test runner exists in this repo.

> **Verification model (read first):** This repo has **no unit-test framework**. Adding one is out of scope (YAGNI). Per-task verification therefore uses the project's real loop:
> - `npm run typecheck` (root) — `tsc -b` across all packages.
> - `npm run build:chrome` / `npm run build:firefox` — esbuild + `validateDist` (fails if a required dist file is missing).
> - `npm run lint -w @topmarks/firefox` — `web-ext lint` on the built dist.
> - Manual browser checks (Task 8), run with `npm run dev:chrome` / `npm run dev:firefox`.
> Commit after each task once its verification passes. Work happens on the existing `feature/tab-groups` branch.

**Source spec:** [`docs/plans/2026-06-02-tab-groups.html`](../../plans/2026-06-02-tab-groups.html) (status: Approved).

**File structure (decomposition):**
- `packages/shared/src/platform.ts` — extend `Platform` with optional `tabGroups` + `permissions` surfaces and shared types.
- `packages/shared/src/tab-groups-store.ts` **(new, DOM-free)** — snapshot CRUD, signature reconcile, resync, watcher. Importable by both the page and the background worker.
- `packages/shared/src/tab-groups-bar.ts` **(new, DOM)** — bar icon, dropdown, click-to-reopen, kebab→Forget. Page-only.
- `packages/{chrome,firefox}/src/platform.ts` — implement the new surfaces.
- `packages/{chrome,firefox}/src/background.ts` **(new)** — per-platform background entry that binds the platform and starts the watcher.
- `packages/{chrome,firefox}/build.ts` — add a background bundle + `background.js` to required dist files.
- `packages/{chrome,firefox}/manifest.json` — `optional_permissions` + `background`.
- `packages/shared/src/settings.ts`, `assets/newtab.html`, `assets/newtab.css`, `src/newtab.ts` — toggle, permission wiring, render hookup, styles.
- `packages/shared/_locales/en/messages.json` — new strings.

---

## Task 1: Extend the `Platform` interface

**Files:**
- Modify: `packages/shared/src/platform.ts`

- [ ] **Step 1: Add the shared tab-group types and optional platform surfaces**

In `packages/shared/src/platform.ts`, add these exported types just below `BookmarkNode`:

```ts
// A tab group as read from the browser while it is open. `id` is the native
// groupId — stable only within a session (it changes across restarts/reopens).
export interface LiveTabGroup {
  id: number;
  title: string;
  color: string;
  tabs: { url: string; title: string }[];
}

// The minimum needed to re-create a group: open these URLs and bundle them.
export interface ReopenableGroup {
  title: string;
  color: string;
  tabs: { url: string }[];
}
```

Then add two optional members to the `Platform` interface (optional so platform
objects that don't implement them — and the existing ones until Tasks 3–4 —
still satisfy the type):

```ts
  // Present only on platforms that support tab groups. Guard with `?.`.
  tabGroups?: {
    queryOpen(): Promise<LiveTabGroup[]>;
    reopen(group: ReopenableGroup): Promise<void>;
    // Fires on any group/tab change relevant to snapshots. Caller debounces
    // and re-queries via queryOpen(); the payload is intentionally empty.
    onChanged(handler: () => void): () => void;
  };
  // optional-permission management. The permissions API itself is always
  // available; these wrap request/contains/remove + a grant event.
  permissions?: {
    contains(perms: string[]): Promise<boolean>;
    request(perms: string[]): Promise<boolean>;
    remove(perms: string[]): Promise<boolean>;
    onAdded(handler: () => void): () => void;
  };
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (no errors — the new members are optional and unused so far).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/platform.ts
git commit -m "Add tabGroups + permissions to the Platform interface"
```

---

## Task 2: Snapshot store + watcher (DOM-free)

**Files:**
- Create: `packages/shared/src/tab-groups-store.ts`
- Modify: `packages/shared/package.json` (add an exports entry)

- [ ] **Step 1: Write the store module**

Create `packages/shared/src/tab-groups-store.ts`:

```ts
import { getPlatform, type LiveTabGroup } from "@/platform";

// Persisted shape. `id` is our own stable id (NOT the native groupId).
// `nativeId` tracks the live group within a session; cleared once closed.
// `sig` is a content signature used to re-link a snapshot to a group that was
// reopened (and thus got a fresh nativeId) or survived a restart.
export interface GroupSnapshot {
  id: string;
  sig: string;
  nativeId?: number;
  title: string;
  color: string;
  tabs: { url: string; title: string }[];
  state: "open" | "closed";
  lastSeenAt: number;
}

const STORE_KEY = "tabGroups";

// Permissions the feature needs. Exported so settings.ts requests the same set.
export const TAB_GROUP_PERMISSIONS = ["tabs", "tabGroups"] as const;

function signature(g: { title: string; color: string; tabs: { url: string }[] }): string {
  const urls = g.tabs.map((t) => t.url).sort().join("|");
  return `${g.title} ${g.color} ${urls}`;
}

export async function loadStore(): Promise<GroupSnapshot[]> {
  const raw = await getPlatform().storage.get([STORE_KEY]);
  const list = (raw as { tabGroups?: unknown }).tabGroups;
  return Array.isArray(list) ? (list as GroupSnapshot[]) : [];
}

async function saveStore(list: GroupSnapshot[]): Promise<void> {
  await getPlatform().storage.set({ [STORE_KEY]: list });
}

export async function getClosedGroups(): Promise<GroupSnapshot[]> {
  return (await loadStore()).filter((s) => s.state === "closed");
}

export async function forgetGroup(id: string): Promise<void> {
  const next = (await loadStore()).filter((s) => s.id !== id);
  await saveStore(next);
}

// Re-read every open group and reconcile the store against it. Open groups are
// upserted (matched by nativeId, else by signature); snapshots previously open
// whose native group has vanished are flipped to "closed" (never deleted).
export async function resyncOpenGroups(): Promise<void> {
  const tg = getPlatform().tabGroups;
  if (!tg) return;

  const live = await tg.queryOpen();
  const store = await loadStore();
  const liveNativeIds = new Set(live.map((g) => g.id));

  for (const g of live) {
    const sig = signature(g);
    const match =
      store.find((s) => s.nativeId === g.id) ?? store.find((s) => s.sig === sig);
    if (match) {
      match.sig = sig;
      match.nativeId = g.id;
      match.title = g.title;
      match.color = g.color;
      match.tabs = g.tabs;
      match.state = "open";
      match.lastSeenAt = Date.now();
    } else {
      store.push({
        id: crypto.randomUUID(),
        sig,
        nativeId: g.id,
        title: g.title,
        color: g.color,
        tabs: g.tabs,
        state: "open",
        lastSeenAt: Date.now(),
      });
    }
  }

  for (const s of store) {
    if (s.state === "open" && (s.nativeId === undefined || !liveNativeIds.has(s.nativeId))) {
      s.state = "closed";
      s.nativeId = undefined;
    }
  }

  await saveStore(store);
}

// Reopen a snapshot as a fresh native group, then mark it open via resync.
export async function reopenGroup(id: string): Promise<void> {
  const tg = getPlatform().tabGroups;
  if (!tg) return;
  const snap = (await loadStore()).find((s) => s.id === id);
  if (!snap) return;
  await tg.reopen({
    title: snap.title,
    color: snap.color,
    tabs: snap.tabs.map((t) => ({ url: t.url })),
  });
  await resyncOpenGroups();
}

// Start the background watcher: resync once, then on every relevant change
// (debounced). Returns an unsubscribe. Caller must ensure permission is held.
export function startTabGroupsWatcher(): () => void {
  const tg = getPlatform().tabGroups;
  if (!tg) return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      void resyncOpenGroups();
    }, 250);
  };

  void resyncOpenGroups();
  const off = tg.onChanged(schedule);
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    off();
  };
}
```

- [ ] **Step 2: Export the store from the shared package**

In `packages/shared/package.json`, add an entry to `"exports"` so the background
entry can import it:

```json
  "exports": {
    ".": "./src/newtab.ts",
    "./platform": "./src/platform.ts",
    "./tab-groups-store": "./src/tab-groups-store.ts",
    "./theme-init": "./src/theme-init.ts"
  }
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/tab-groups-store.ts packages/shared/package.json
git commit -m "Add DOM-free tab-group snapshot store and watcher"
```

---

## Task 3: Chrome platform implementation

**Files:**
- Modify: `packages/chrome/src/platform.ts`

- [ ] **Step 1: Implement `tabGroups` and `permissions`**

In `packages/chrome/src/platform.ts`, import the new types:

```ts
import type {
  Platform,
  BookmarkNode,
  StorageChanges,
  LiveTabGroup,
  ReopenableGroup,
} from "@topmarks/shared/platform";
```

Add these two members to the exported `platform` object (e.g. after `search`):

```ts
  tabGroups: {
    async queryOpen(): Promise<LiveTabGroup[]> {
      const groups = await chrome.tabGroups.query({});
      const out: LiveTabGroup[] = [];
      for (const g of groups) {
        const tabs = await chrome.tabs.query({ groupId: g.id });
        out.push({
          id: g.id,
          title: g.title ?? "",
          color: g.color,
          tabs: tabs
            .filter((t) => !!t.url)
            .map((t) => ({ url: t.url!, title: t.title ?? "" })),
        });
      }
      return out;
    },
    async reopen(group: ReopenableGroup): Promise<void> {
      const ids: number[] = [];
      for (const t of group.tabs) {
        const tab = await chrome.tabs.create({ url: t.url, active: false });
        if (tab.id != null) ids.push(tab.id);
      }
      if (!ids.length) return;
      const groupId = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(groupId, {
        title: group.title,
        color: group.color as chrome.tabGroups.Color,
      });
    },
    onChanged(handler) {
      chrome.tabGroups.onCreated.addListener(handler);
      chrome.tabGroups.onUpdated.addListener(handler);
      chrome.tabGroups.onRemoved.addListener(handler);
      chrome.tabs.onUpdated.addListener(handler);
      chrome.tabs.onRemoved.addListener(handler);
      chrome.tabs.onAttached.addListener(handler);
      chrome.tabs.onDetached.addListener(handler);
      return () => {
        chrome.tabGroups.onCreated.removeListener(handler);
        chrome.tabGroups.onUpdated.removeListener(handler);
        chrome.tabGroups.onRemoved.removeListener(handler);
        chrome.tabs.onUpdated.removeListener(handler);
        chrome.tabs.onRemoved.removeListener(handler);
        chrome.tabs.onAttached.removeListener(handler);
        chrome.tabs.onDetached.removeListener(handler);
      };
    },
  },
  permissions: {
    contains(perms) {
      return chrome.permissions.contains({ permissions: perms });
    },
    request(perms) {
      return chrome.permissions.request({ permissions: perms });
    },
    remove(perms) {
      return chrome.permissions.remove({ permissions: perms });
    },
    onAdded(handler) {
      chrome.permissions.onAdded.addListener(handler);
      return () => chrome.permissions.onAdded.removeListener(handler);
    },
  },
```

> Note: `chrome.tabGroups.onUpdated`/`onRemoved` listeners registered at module
> top level (which this is — `platform` is a module-level const) wake the MV3
> service worker on group changes, so the watcher catches closes even when the
> worker was idle.

- [ ] **Step 2: Verify Chrome typecheck passes**

Run: `npm run typecheck`
Expected: PASS. (`@types/chrome@0.0.280` includes `chrome.tabGroups`.)

- [ ] **Step 3: Commit**

```bash
git add packages/chrome/src/platform.ts
git commit -m "Implement tabGroups + permissions in the Chrome platform"
```

---

## Task 4: Firefox platform implementation (+ types)

**Files:**
- Modify: `packages/firefox/src/platform.ts`
- Possibly modify: `package.json` (root devDependency), or create `packages/firefox/src/tabgroups.d.ts`

- [ ] **Step 1: Ensure `browser.tabGroups` is typed**

`@types/firefox-webext-browser@120` predates the tab-groups API. First try bumping it:

Run: `npm i -D @types/firefox-webext-browser@latest`
Then: `npm run typecheck`

If `browser.tabGroups` / `browser.tabs.group` now type-check, skip to Step 2.
If they still error, create `packages/firefox/src/tabgroups.d.ts` with a minimal
ambient declaration (delete it later if the types catch up):

```ts
// Minimal ambient types for the Firefox tab-groups API (Firefox 139+), in case
// @types/firefox-webext-browser lags. Mirrors only what platform.ts uses.
declare namespace browser.tabGroups {
  type Color = string;
  interface TabGroup { id: number; title?: string; color: Color; windowId: number; }
  function query(info: Record<string, unknown>): Promise<TabGroup[]>;
  function update(id: number, props: { title?: string; color?: Color }): Promise<TabGroup>;
  const onCreated: { addListener(cb: () => void): void; removeListener(cb: () => void): void };
  const onUpdated: { addListener(cb: () => void): void; removeListener(cb: () => void): void };
  const onRemoved: { addListener(cb: () => void): void; removeListener(cb: () => void): void };
}
declare namespace browser.tabs {
  function group(opts: { tabIds: number[] }): Promise<number>;
}
```

- [ ] **Step 2: Implement `tabGroups` and `permissions`**

In `packages/firefox/src/platform.ts`, import the new types:

```ts
import type {
  Platform,
  BookmarkNode,
  StorageChanges,
  LiveTabGroup,
  ReopenableGroup,
} from "@topmarks/shared/platform";
```

Add to the exported `platform` object (after `search`):

```ts
  tabGroups: {
    async queryOpen(): Promise<LiveTabGroup[]> {
      const groups = await browser.tabGroups.query({});
      const out: LiveTabGroup[] = [];
      for (const g of groups) {
        const tabs = await browser.tabs.query({ groupId: g.id } as any);
        out.push({
          id: g.id,
          title: g.title ?? "",
          color: g.color,
          tabs: tabs
            .filter((t) => !!t.url)
            .map((t) => ({ url: t.url!, title: t.title ?? "" })),
        });
      }
      return out;
    },
    async reopen(group: ReopenableGroup): Promise<void> {
      const ids: number[] = [];
      for (const t of group.tabs) {
        const tab = await browser.tabs.create({ url: t.url, active: false });
        if (tab.id != null) ids.push(tab.id);
      }
      if (!ids.length) return;
      const groupId = await browser.tabs.group({ tabIds: ids });
      await browser.tabGroups.update(groupId, { title: group.title, color: group.color });
    },
    onChanged(handler) {
      browser.tabGroups.onCreated.addListener(handler);
      browser.tabGroups.onUpdated.addListener(handler);
      browser.tabGroups.onRemoved.addListener(handler);
      browser.tabs.onUpdated.addListener(handler);
      browser.tabs.onRemoved.addListener(handler);
      browser.tabs.onAttached.addListener(handler);
      browser.tabs.onDetached.addListener(handler);
      return () => {
        browser.tabGroups.onCreated.removeListener(handler);
        browser.tabGroups.onUpdated.removeListener(handler);
        browser.tabGroups.onRemoved.removeListener(handler);
        browser.tabs.onUpdated.removeListener(handler);
        browser.tabs.onRemoved.removeListener(handler);
        browser.tabs.onAttached.removeListener(handler);
        browser.tabs.onDetached.removeListener(handler);
      };
    },
  },
  permissions: {
    contains(perms) {
      return browser.permissions.contains({ permissions: perms });
    },
    request(perms) {
      return browser.permissions.request({ permissions: perms });
    },
    remove(perms) {
      return browser.permissions.remove({ permissions: perms });
    },
    onAdded(handler) {
      browser.permissions.onAdded.addListener(handler);
      return () => browser.permissions.onAdded.removeListener(handler);
    },
  },
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/firefox/src/platform.ts package.json package-lock.json
# include packages/firefox/src/tabgroups.d.ts only if you created it
git commit -m "Implement tabGroups + permissions in the Firefox platform"
```

---

## Task 5: Background entry + build + manifests

**Files:**
- Create: `packages/chrome/src/background.ts`
- Create: `packages/firefox/src/background.ts`
- Modify: `packages/chrome/build.ts`, `packages/firefox/build.ts`
- Modify: `packages/chrome/manifest.json`, `packages/firefox/manifest.json`

- [ ] **Step 1: Write the Chrome background entry**

Create `packages/chrome/src/background.ts`:

```ts
import { setPlatform } from "@topmarks/shared/platform";
import { startTabGroupsWatcher, TAB_GROUP_PERMISSIONS } from "@topmarks/shared/tab-groups-store";
import { platform } from "@/platform";

setPlatform(platform);

let stop: (() => void) | null = null;

async function syncWatcher(): Promise<void> {
  const granted = await platform.permissions!.contains([...TAB_GROUP_PERMISSIONS]);
  if (granted && !stop) {
    stop = startTabGroupsWatcher();
  } else if (!granted && stop) {
    stop();
    stop = null;
  }
}

// Re-evaluate when the user grants the optional permissions from the new-tab UI.
platform.permissions!.onAdded(() => {
  void syncWatcher();
});

void syncWatcher();
```

- [ ] **Step 2: Write the Firefox background entry**

Create `packages/firefox/src/background.ts` with identical contents to Step 1
(same imports — `@/platform` resolves to the Firefox platform within this package):

```ts
import { setPlatform } from "@topmarks/shared/platform";
import { startTabGroupsWatcher, TAB_GROUP_PERMISSIONS } from "@topmarks/shared/tab-groups-store";
import { platform } from "@/platform";

setPlatform(platform);

let stop: (() => void) | null = null;

async function syncWatcher(): Promise<void> {
  const granted = await platform.permissions!.contains([...TAB_GROUP_PERMISSIONS]);
  if (granted && !stop) {
    stop = startTabGroupsWatcher();
  } else if (!granted && stop) {
    stop();
    stop = null;
  }
}

platform.permissions!.onAdded(() => {
  void syncWatcher();
});

void syncWatcher();
```

- [ ] **Step 3: Add a background bundle to both build scripts**

In **both** `packages/chrome/build.ts` and `packages/firefox/build.ts`:

(a) Add `"background.js"` to the `REQUIRED_DIST_FILES` array (after `"newtab.js"`).

(b) Add a bundle-options function next to `themeInitBundleOptions` (use the
matching `target` per package — `"chrome120"` for Chrome, `"firefox142"` for Firefox):

```ts
function backgroundBundleOptions(): BuildOptions {
  return {
    entryPoints: [path.join(HERE, "src", "background.ts")],
    outfile: path.join(DIST, "background.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome120"], // firefox: ["firefox142"]
    sourcemap: DEV ? "inline" : false,
    minify: !DEV,
    logLevel: "info",
  };
}
```

(c) In `main()`, include the background bundle in both the watch and one-shot paths:

```ts
  if (WATCH) {
    const pageCtx = await context(pageBundleOptions(unsplashKey));
    const themeCtx = await context(themeInitBundleOptions());
    const bgCtx = await context(backgroundBundleOptions());
    await Promise.all([pageCtx.watch(), themeCtx.watch(), bgCtx.watch()]);
    console.log("esbuild watching… (Ctrl+C to exit)");
  } else {
    await Promise.all([
      build(pageBundleOptions(unsplashKey)),
      build(themeInitBundleOptions()),
      build(backgroundBundleOptions()),
    ]);
    await validateDist(DIST, REQUIRED_DIST_FILES);
    console.log(`Built … v${version} → ${path.relative(REPO_ROOT, DIST)}`);
  }
```

- [ ] **Step 4: Add `background` + `optional_permissions` to the manifests**

In `packages/chrome/manifest.json`, add these top-level keys:

```json
  "optional_permissions": ["tabs", "tabGroups"],
  "background": { "service_worker": "background.js" },
```

In `packages/firefox/manifest.json`, add:

```json
  "optional_permissions": ["tabs", "tabGroups"],
  "background": { "scripts": ["background.js"] },
```

- [ ] **Step 5: Verify both builds pass (incl. validateDist)**

Run: `npm run build:chrome && npm run build:firefox`
Expected: both print "Built … v<version>", no validateDist error (confirms
`background.js` is emitted).

- [ ] **Step 6: Lint the Firefox build**

Run: `npm run lint -w @topmarks/firefox`
Expected: `web-ext lint` reports 0 errors (warnings about optional permissions are acceptable).

- [ ] **Step 7: Commit**

```bash
git add packages/chrome/src/background.ts packages/firefox/src/background.ts \
        packages/chrome/build.ts packages/firefox/build.ts \
        packages/chrome/manifest.json packages/firefox/manifest.json
git commit -m "Add background watcher entry, bundle, and manifest wiring"
```

---

## Task 6: Settings toggle + permission wiring

**Files:**
- Modify: `packages/shared/src/settings.ts`
- Modify: `packages/shared/assets/newtab.html`
- Modify: `packages/shared/_locales/en/messages.json`

- [ ] **Step 1: Add the setting and its default**

In `packages/shared/src/settings.ts`, add to `SETTINGS_DEFAULTS` (before the closing brace):

```ts
  // When on, Topmarks watches native tab groups and lists closed ones in the
  // bar for one-click reopen. Off by default; enabling requests tabs+tabGroups.
  tabGroupsEnabled: false,
```

- [ ] **Step 2: Wire the toggle to request/relinquish permissions**

In `packages/shared/src/settings.ts`, add imports at the top:

```ts
import { TAB_GROUP_PERMISSIONS } from "@/tab-groups-store";
import { renderTabGroups } from "@/tab-groups-bar";
```

Then add a case to `handleSettingChange` (inside the `if/else if` chain):

```ts
  } else if (key === "tabGroupsEnabled") {
    void applyTabGroupsEnabled();
  }
```

And add this exported function (used by the change handler and at startup):

```ts
// Enabling requests the optional permissions; if the user declines, revert the
// toggle. Disabling relinquishes them and stops the page from listing groups.
// The snapshot archive in storage is intentionally kept (manual purge only).
export async function applyTabGroupsEnabled(): Promise<void> {
  const perms = [...TAB_GROUP_PERMISSIONS];
  const api = getPlatform().permissions;
  if (settings.tabGroupsEnabled) {
    const granted = (await api?.contains(perms)) || (await api?.request(perms)) || false;
    if (!granted) {
      // User declined — roll the setting back and re-sync the UI.
      settings.tabGroupsEnabled = false;
      await getPlatform().storage.set({ tabGroupsEnabled: false });
      syncSettingsUi();
    }
  } else {
    await api?.remove(perms);
  }
  await renderTabGroups();
}
```

> The `await api?.contains(...) || await api?.request(...)` chain only prompts
> when the permission isn't already held — `request()` must run inside the
> toggle's click gesture, which `handleSettingChange` is (it fires from the
> checkbox `change` event in `setupSettingsPanel`).

- [ ] **Step 3: Add the toggle to the settings panel HTML**

In `packages/shared/assets/newtab.html`, add this `label` right after the
existing "Hide labels" setting block:

```html
      <label class="setting">
        <span data-i18n="tabGroupsLabel">Tab groups</span>
        <input type="checkbox" data-setting="tabGroupsEnabled" />
        <span class="switch" aria-hidden="true"></span>
      </label>
```

- [ ] **Step 4: Add the i18n string**

In `packages/shared/_locales/en/messages.json`, add (before the closing brace):

```json
  "tabGroupsLabel": { "message": "Tab groups" },
  "tabGroupsIconLabel": { "message": "Tab groups" },
  "tabGroupsEmpty": { "message": "No closed tab groups yet." },
  "tabGroupsForget": { "message": "Forget" },
  "tabGroupsManageLabel": { "message": "Manage group" }
```

(Add a comma after the prior last entry `"buyMeACoffee"` so the JSON stays valid.)

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS. (`@/tab-groups-bar` is created in Task 7 — if executing tasks
strictly in order, temporarily comment the `renderTabGroups` import + calls,
or execute Task 7 Step 1 first. Subagent-driven execution should sequence Task 7
before this verification; see note below.)

> **Sequencing note:** Tasks 6 and 7 are mutually referential (settings calls
> `renderTabGroups`; the bar reads `tabGroupsEnabled`). Create the Task 7 file
> (`tab-groups-bar.ts`) before running Task 6's typecheck, or do Task 7 Step 1
> then return here. Commit them together if needed.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/settings.ts packages/shared/assets/newtab.html \
        packages/shared/_locales/en/messages.json
git commit -m "Add tab-groups settings toggle with optional-permission request"
```

---

## Task 7: Bar icon, dropdown, reopen + Forget

**Files:**
- Create: `packages/shared/src/tab-groups-bar.ts`
- Modify: `packages/shared/src/newtab.ts`
- Modify: `packages/shared/assets/newtab.css`

- [ ] **Step 1: Write the bar module**

Create `packages/shared/src/tab-groups-bar.ts`:

```ts
import { getPlatform } from "@/platform";
import { t } from "@/i18n";
import { getSettings } from "@/settings";
import {
  getClosedGroups,
  reopenGroup,
  forgetGroup,
  resyncOpenGroups,
  type GroupSnapshot,
} from "@/tab-groups-store";

const SVG_NS = "http://www.w3.org/2000/svg";

// Tab-groups glyph: two rounded "tabs" — native-adjacent, with our rounded feel.
function createTabGroupsIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "folder-icon tab-groups-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const r1 = document.createElementNS(SVG_NS, "rect");
  r1.setAttribute("x", "3"); r1.setAttribute("y", "4");
  r1.setAttribute("width", "8"); r1.setAttribute("height", "16"); r1.setAttribute("rx", "2");
  const r2 = document.createElementNS(SVG_NS, "rect");
  r2.setAttribute("x", "13"); r2.setAttribute("y", "4");
  r2.setAttribute("width", "8"); r2.setAttribute("height", "16"); r2.setAttribute("rx", "2");
  svg.append(r1, r2);
  return svg;
}

function createColorDot(color: string): HTMLSpanElement {
  const dot = document.createElement("span");
  dot.className = "tab-group-dot";
  dot.dataset.color = color;
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function createGroupRow(snap: GroupSnapshot): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "tab-group-row";

  const open = document.createElement("button");
  open.type = "button";
  open.className = "bookmark-item tab-group-open";
  open.title = snap.title || t("unnamedFolder");
  const label = document.createElement("span");
  label.className = "bookmark-title";
  label.textContent = snap.title || t("unnamedFolder");
  const count = document.createElement("span");
  count.className = "tab-group-count";
  count.textContent = String(snap.tabs.length);
  open.append(createColorDot(snap.color), label, count);
  open.addEventListener("click", async (e) => {
    e.stopPropagation();
    await reopenGroup(snap.id);
    await renderTabGroups();
  });

  const kebab = document.createElement("button");
  kebab.type = "button";
  kebab.className = "tab-group-kebab";
  kebab.setAttribute("aria-label", t("tabGroupsManageLabel"));
  kebab.setAttribute("aria-haspopup", "true");
  kebab.textContent = "⋮";

  const menu = document.createElement("ul");
  menu.className = "folder-dropdown submenu tab-group-menu";
  const forgetLi = document.createElement("li");
  const forget = document.createElement("button");
  forget.type = "button";
  forget.className = "bookmark-item";
  forget.textContent = t("tabGroupsForget");
  forget.addEventListener("click", async (e) => {
    e.stopPropagation();
    await forgetGroup(snap.id);
    await renderTabGroups();
  });
  forgetLi.append(forget);
  menu.append(forgetLi);

  kebab.addEventListener("click", (e) => {
    e.stopPropagation();
    li.classList.toggle("menu-open");
  });

  li.append(open, kebab, menu);
  return li;
}

// Render (or remove) the single tab-groups bar item. No-op-safe to call anytime.
export async function renderTabGroups(): Promise<void> {
  const bar = document.getElementById("bookmarks-bar");
  if (!bar) return;

  const existing = bar.querySelector(".tab-groups-folder");
  if (existing) existing.remove();

  if (!getSettings().tabGroupsEnabled || !getPlatform().tabGroups) return;

  const closed = await getClosedGroups();
  if (!closed.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "bookmark-folder tab-groups-folder";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "bookmark-item folder-button";
  button.title = t("tabGroupsIconLabel");
  button.setAttribute("aria-label", t("tabGroupsIconLabel"));
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.append(createTabGroupsIcon());

  const dropdown = document.createElement("ul");
  dropdown.className = "folder-dropdown tab-groups-dropdown";
  for (const snap of closed) dropdown.append(createGroupRow(snap));

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = wrapper.classList.contains("open");
    document.querySelectorAll(".bookmark-folder.open").forEach((el) => el.classList.remove("open"));
    if (!wasOpen) {
      wrapper.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    }
  });

  wrapper.append(button, dropdown);
  // Insert as the first bar item (groups lead, before folders/links).
  bar.prepend(wrapper);
}

// Page-load backstop: snapshot whatever groups are open right now, then render.
export async function setupTabGroups(): Promise<void> {
  if (!getSettings().tabGroupsEnabled || !getPlatform().tabGroups) return;
  await resyncOpenGroups();
  await renderTabGroups();
}

// Keep the bar in sync when the background watcher updates the store.
export function setupTabGroupsStorageListener(): () => void {
  return getPlatform().storage.onChanged((changes, area) => {
    if (area === "local" && changes.tabGroups) void renderTabGroups();
  });
}
```

> The `.tab-groups-folder` reuses the existing `.bookmark-folder`/`.folder-dropdown`
> open/close CSS and the document-level outside-click handler in `newtab.ts`
> (which calls `closeAllDropdowns`, already matching `.bookmark-folder.open`).

- [ ] **Step 2: Wire it into `startApp`**

In `packages/shared/src/newtab.ts`, add imports:

```ts
import { setupTabGroups, setupTabGroupsStorageListener } from "@/tab-groups-bar";
```

In `startApp`, after `setupFolderEmojiStorageListener();`, add:

```ts
  setupTabGroupsStorageListener();
```

And after `renderBookmarks();`, add:

```ts
  void setupTabGroups();
```

- [ ] **Step 3: Add styles**

In `packages/shared/assets/newtab.css`, append:

```css
/* --- Tab groups ---------------------------------------------------------- */
.tab-groups-dropdown { min-width: 220px; }
.tab-group-row { display: flex; align-items: center; gap: 4px; position: relative; }
.tab-group-open { flex: 1; min-width: 0; }
.tab-group-open .bookmark-title { flex: 1; min-width: 0; }
.tab-group-count {
  font-size: 12px; opacity: 0.6; font-variant-numeric: tabular-nums; margin-left: auto;
}
.tab-group-dot {
  width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: var(--tab-group-color, #888);
}
.tab-group-dot[data-color="grey"]   { --tab-group-color: #5f6368; }
.tab-group-dot[data-color="blue"]   { --tab-group-color: #1a73e8; }
.tab-group-dot[data-color="red"]    { --tab-group-color: #d93025; }
.tab-group-dot[data-color="yellow"] { --tab-group-color: #f9ab00; }
.tab-group-dot[data-color="green"]  { --tab-group-color: #1e8e3e; }
.tab-group-dot[data-color="pink"]   { --tab-group-color: #d01884; }
.tab-group-dot[data-color="purple"] { --tab-group-color: #9334e6; }
.tab-group-dot[data-color="cyan"]   { --tab-group-color: #007b83; }
.tab-group-dot[data-color="orange"] { --tab-group-color: #fa903e; }
.tab-group-kebab {
  flex: none; background: none; border: none; color: inherit; cursor: pointer;
  font-size: 16px; line-height: 1; padding: 4px 6px; border-radius: 6px; opacity: 0.7;
}
.tab-group-kebab:hover { opacity: 1; }
.tab-group-menu { display: none; position: absolute; right: 0; top: 100%; }
.tab-group-row.menu-open .tab-group-menu { display: block; }
```

- [ ] **Step 4: Verify typecheck + builds pass**

Run: `npm run typecheck && npm run build:chrome && npm run build:firefox`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tab-groups-bar.ts packages/shared/src/newtab.ts \
        packages/shared/assets/newtab.css
git commit -m "Add tab-groups bar icon, dropdown, reopen, and Forget"
```

---

## Task 8: Manual verification (Chrome + Firefox)

**Files:** none (manual).

- [ ] **Step 1: Chrome happy path**

Run: `npm run dev:chrome`
In the launched Chromium:
1. Open a new tab → Settings → toggle **Tab groups** on → accept the
   `tabs`/`tabGroups` permission prompt.
2. Create a tab group (group 2–3 tabs, name + color it).
3. Close the group.
4. Open a new tab → confirm the tab-groups icon appears, and the closed group is
   listed (dot + name + count).
5. Click the row → confirm a new native group opens with the same name + color.
6. Open the kebab (⋮) → **Forget** → confirm the row disappears.

- [ ] **Step 2: Chrome lifecycle / dedup**

1. Reopen a still-snapshotted group via the browser's own UI → open a new tab →
   confirm it is **not** duplicated (signature reconcile) and shows as no longer
   closed (absent from the list while open).
2. Toggle the feature off → confirm the icon disappears and (in `chrome://extensions`)
   the optional permissions are relinquished. Toggle back on → archive returns.

- [ ] **Step 3: Firefox happy path**

Run: `npm run dev:firefox`
Repeat Step 1's happy path in Firefox. Confirm the background event page
captures a group closed while no new tab is open (close a group, wait, then open
a new tab — it should be listed, proving the watcher, not just the backstop).

- [ ] **Step 4: Privacy check**

In a clean profile, confirm a default install with the feature **off** requests
no `tabs`/`tabGroups` permissions (they appear only after enabling).

- [ ] **Step 5: Promote the plan doc to Built**

Once all checks pass, in `docs/plans/2026-06-02-tab-groups.html` change the
header chip from `status--proposed` to `status--built` and its text to `Built`.

```bash
git add docs/plans/2026-06-02-tab-groups.html
git commit -m "Mark tab-groups plan doc as Built"
```

---

## Self-review notes (author)

- **Spec coverage:** snapshot store (Task 2), never-auto-delete via resync flipping to closed (Task 2 `resyncOpenGroups`), watcher + new-tab backstop (Tasks 5 & 7), reopen as fresh native group (Tasks 2/3/4), single bar icon → dropdown → click reopen + kebab Forget (Task 7), closed-only listing (Task 7 `getClosedGroups`), opt-in optional permissions + disable keeps archive (Task 6), Firefox event page vs Chrome service worker (Task 5), i18n (Task 6). All spec decisions map to a task.
- **Cross-task type consistency:** `LiveTabGroup`/`ReopenableGroup` (Task 1) are consumed unchanged in Tasks 2–4; `GroupSnapshot`, `TAB_GROUP_PERMISSIONS`, `resyncOpenGroups`, `reopenGroup`, `forgetGroup`, `getClosedGroups`, `startTabGroupsWatcher` (Task 2) are referenced by the same names in Tasks 5–7; `renderTabGroups`/`setupTabGroups`/`setupTabGroupsStorageListener` (Task 7) match their imports in Tasks 6 & `newtab.ts`.
- **Known sequencing coupling:** Tasks 6 ↔ 7 are mutually referential — flagged inline in Task 6 Step 5.
- **No test runner:** verification is typecheck/build/lint/manual by design; no fabricated test framework.
