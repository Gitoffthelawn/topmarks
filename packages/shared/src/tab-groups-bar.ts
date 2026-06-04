import { getPlatform } from "@/platform";
import { t } from "@/i18n";
import { getSettings, dismissTabGroupsTip } from "@/settings";
import {
  getClosedGroups,
  reopenGroup,
  forgetGroup,
  resyncOpenGroups,
  type GroupSnapshot,
} from "@/tab-groups-store";

const SVG_NS = "http://www.w3.org/2000/svg";

// Tab-groups glyph: a 2×2 grid of rounded squares, mirroring the browsers' own
// tab-groups icon. Sized in CSS to match the link favicons / folder icons.
function createTabGroupsIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "tab-groups-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  for (const [x, y] of [
    [4, 4],
    [13, 4],
    [4, 13],
    [13, 13],
  ]) {
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", "7");
    r.setAttribute("height", "7");
    r.setAttribute("rx", "2");
    svg.append(r);
  }
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

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "bookmark-item tab-group-open";
  openBtn.title = snap.title || t("unnamedFolder");
  const label = document.createElement("span");
  label.className = "bookmark-title";
  label.textContent = snap.title || t("unnamedFolder");
  const count = document.createElement("span");
  count.className = "tab-group-count";
  count.textContent = String(snap.tabs.length);
  openBtn.append(createColorDot(snap.color), label, count);
  openBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await reopenGroup(snap.id);
    } catch (err) {
      console.error("Failed to reopen tab group", err);
    }
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
    try {
      await forgetGroup(snap.id);
    } catch (err) {
      console.error("Failed to forget tab group", err);
    }
    await renderTabGroups();
  });
  forgetLi.append(forget);
  menu.append(forgetLi);

  kebab.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = li.classList.contains("menu-open");
    // Only one row's manage menu open at a time.
    li.parentElement
      ?.querySelectorAll(".tab-group-row.menu-open")
      .forEach((el) => el.classList.remove("menu-open"));
    if (!wasOpen) li.classList.add("menu-open");
  });

  li.append(openBtn, kebab, menu);
  return li;
}

// Explanatory note about how groups get captured. Doubles as the empty state
// (when there are no saved groups) and as a dismissible tip (when there are).
// The dismiss button is only present when `dismissible` — when empty the note
// is the only content, so there's nothing to dismiss it to.
function createTip(dismissible: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "tab-group-tip";

  const text = document.createElement("span");
  text.className = "tab-group-tip-text";
  text.textContent = t("tabGroupsTip");
  li.append(text);

  if (dismissible) {
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "tab-group-tip-dismiss";
    dismiss.setAttribute("aria-label", t("tabGroupsTipDismiss"));
    dismiss.textContent = "✕";
    dismiss.addEventListener("click", async (e) => {
      e.stopPropagation();
      await dismissTabGroupsTip();
      await renderTabGroups();
    });
    li.append(dismiss);
  }

  return li;
}

// Render (or remove) the single tab-groups bar item. No-op-safe to call anytime.
export async function renderTabGroups(): Promise<void> {
  const bar = document.getElementById("bookmarks-bar");
  if (!bar) return;

  // querySelectorAll (not querySelector) so any duplicate from a prior race is
  // also cleared.
  const removeExisting = () =>
    bar.querySelectorAll(".tab-groups-folder").forEach((el) => el.remove());

  if (!getSettings().tabGroupsEnabled || !getPlatform().tabGroups) {
    removeExisting();
    return;
  }

  const closed = await getClosedGroups();
  const tipDismissed = getSettings().tabGroupsTipDismissed;

  // Remove AFTER the await and immediately before the synchronous build+prepend
  // below (no await in between). Overlapping renders — e.g. the reopen click
  // handler and the storage-change listener firing together — would otherwise
  // each pass an up-front removal and then both prepend, duplicating the item.
  removeExisting();

  const wrapper = document.createElement("div");
  wrapper.className = "bookmark-folder tab-groups-folder";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "bookmark-item folder-button";
  button.title = t("tabGroupsIconLabel");
  button.setAttribute("aria-label", t("tabGroupsIconLabel"));
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  const barLabel = document.createElement("span");
  barLabel.className = "bookmark-title";
  barLabel.textContent = t("tabGroupsBarLabel");
  button.append(createTabGroupsIcon(), barLabel);

  const dropdown = document.createElement("ul");
  dropdown.className = "folder-dropdown tab-groups-dropdown";
  for (const snap of closed) dropdown.append(createGroupRow(snap));
  // The note is the empty state when there are no groups (always shown, not
  // dismissible there), and a dismissible tip once groups exist.
  if (!closed.length || !tipDismissed) dropdown.append(createTip(closed.length > 0));

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
