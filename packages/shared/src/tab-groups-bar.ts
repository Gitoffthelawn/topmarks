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
    li.classList.toggle("menu-open");
  });

  li.append(openBtn, kebab, menu);
  return li;
}

// A dismissible footer note explaining how groups get captured. Shown until the
// user dismisses it (persisted via the tabGroupsTipDismissed setting).
function createTip(): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "tab-group-tip";

  const text = document.createElement("span");
  text.className = "tab-group-tip-text";
  text.textContent = t("tabGroupsTip");

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

  li.append(text, dismiss);
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
  const tipDismissed = getSettings().tabGroupsTipDismissed;
  // Nothing to show: no captured groups and the explanatory tip is dismissed.
  if (!closed.length && tipDismissed) return;

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
  if (closed.length) {
    for (const snap of closed) dropdown.append(createGroupRow(snap));
  } else {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = t("tabGroupsEmpty");
    dropdown.append(empty);
  }
  if (!tipDismissed) dropdown.append(createTip());

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
