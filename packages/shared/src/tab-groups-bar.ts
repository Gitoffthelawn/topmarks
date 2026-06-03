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
