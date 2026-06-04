import { getPlatform } from "@/platform";

// Persisted shape. `id` is our own stable id (NOT the native groupId).
// `nativeId` tracks the live group within a session; cleared once closed.
export interface GroupSnapshot {
  id: string;
  nativeId?: number;
  title: string;
  color: string;
  tabs: { url: string; title: string }[];
  state: "open" | "closed";
  lastSeenAt: number;
}

// storage.local key (not a module path) under which snapshots are persisted.
const STORE_KEY = "tabGroups";
// Coalesce bursts of group/tab events into a single resync.
const DEBOUNCE_MS = 250;

// Permissions the feature needs. Exported so settings.ts requests the same set.
export const TAB_GROUP_PERMISSIONS = ["tabs", "tabGroups"] as const;

function urlKey(tabs: { url: string }[]): string {
  return tabs.map((t) => t.url).sort().join("\n");
}

// A NAMED closed group is re-identified by title + color, not by its exact tab
// set: URLs drift across reopen (redirects, trailing slashes, load states), so
// a content signature would fragment the same group into duplicates. An UNNAMED
// group (no title) isn't distinctive by colour alone, so it additionally
// requires a matching URL set — otherwise two different untitled same-colour
// groups would relink/merge into one (losing one of them).
function sameIdentity(
  a: { title: string; color: string; tabs: { url: string }[] },
  b: { title: string; color: string; tabs: { url: string }[] }
): boolean {
  if (a.color !== b.color) return false;
  const title = a.title.trim();
  if (title !== b.title.trim()) return false;
  if (title === "") return urlKey(a.tabs) === urlKey(b.tabs);
  return true;
}

async function loadStore(): Promise<GroupSnapshot[]> {
  const raw = await getPlatform().storage.get([STORE_KEY]);
  const list = (raw as { tabGroups?: unknown }).tabGroups;
  return Array.isArray(list) ? (list as GroupSnapshot[]) : [];
}

async function saveStore(list: GroupSnapshot[]): Promise<void> {
  await getPlatform().storage.set({ [STORE_KEY]: list });
}

// Serializes the user-visible store content, excluding the volatile lastSeenAt
// timestamp. Used to skip no-op writes: tabs.onUpdated fires constantly (any
// tab loading anywhere), and rewriting storage on every resync would fire a
// storage-change event that re-renders — and closes — an open menu.
function contentKey(list: GroupSnapshot[]): string {
  return JSON.stringify(
    list.map((s) => ({
      id: s.id,
      nativeId: s.nativeId,
      title: s.title,
      color: s.color,
      state: s.state,
      tabs: s.tabs,
    }))
  );
}

export async function getClosedGroups(): Promise<GroupSnapshot[]> {
  return (await loadStore()).filter((s) => s.state === "closed");
}

export async function forgetGroup(id: string): Promise<void> {
  const next = (await loadStore()).filter((s) => s.id !== id);
  await saveStore(next);
}

// Re-read every open group and reconcile the store against it. Open groups are
// upserted (matched by nativeId, else by title+color identity); snapshots
// previously open whose native group has vanished are flipped to "closed"
// (never deleted).
export async function resyncOpenGroups(): Promise<void> {
  const tg = getPlatform().tabGroups;
  if (!tg) return;

  const live = await tg.queryOpen();
  const store = await loadStore();
  const before = contentKey(store);
  const liveNativeIds = new Set(live.map((g) => g.id));

  for (const g of live) {
    // Match a live group to its snapshot by nativeId; fall back to title+color
    // identity only for UNLINKED snapshots (nativeId === undefined), so two
    // distinct live groups never collapse into one snapshot, while a reopened
    // closed group updates its existing entry instead of duplicating it.
    const match =
      store.find((s) => s.nativeId === g.id) ??
      store.find((s) => s.nativeId === undefined && sameIdentity(s, g));
    if (match) {
      match.nativeId = g.id;
      match.title = g.title;
      match.color = g.color;
      match.tabs = g.tabs;
      match.state = "open";
      match.lastSeenAt = Date.now();
    } else {
      store.push({
        id: crypto.randomUUID(),
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

  // Collapse any snapshots that share an identity — including duplicates left
  // behind by an earlier URL-based key. Prefer a currently-open one, else the
  // most recently seen.
  const byIdentity = new Map<string, GroupSnapshot>();
  for (const s of store) {
    // Named: title+color. Unnamed: also keyed by URL set so distinct untitled
    // same-colour groups don't collapse together.
    const base = `${s.title.trim()}::${s.color}`;
    const key = s.title.trim() === "" ? `${base}::${urlKey(s.tabs)}` : base;
    const prev = byIdentity.get(key);
    if (!prev) {
      byIdentity.set(key, s);
      continue;
    }
    const prefersS =
      s.state !== prev.state ? s.state === "open" : s.lastSeenAt >= prev.lastSeenAt;
    byIdentity.set(key, prefersS ? s : prev);
  }

  const next = [...byIdentity.values()];
  // Skip the write (and the re-render it would trigger) when nothing
  // user-visible changed — only lastSeenAt churning doesn't count.
  if (contentKey(next) === before) return;
  await saveStore(next);
}

// Reopen a snapshot as a fresh native group, then mark it open via resync.
export async function reopenGroup(id: string): Promise<void> {
  const tg = getPlatform().tabGroups;
  if (!tg) return;
  const store = await loadStore();
  const snap = store.find((s) => s.id === id);
  if (!snap) return;
  await tg.reopen({
    title: snap.title,
    color: snap.color,
    tabs: snap.tabs.map((t) => ({ url: t.url })),
  });
  // Optimistically mark open and persist so the closed-list UI updates
  // immediately, without waiting for the watcher's debounced resync.
  snap.state = "open";
  await saveStore(store);
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
    }, DEBOUNCE_MS);
  };

  void resyncOpenGroups();
  const off = tg.onChanged(schedule);
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    off();
  };
}
