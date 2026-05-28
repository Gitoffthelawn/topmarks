import { getPlatform } from "./platform.js";
import { scheduleReflow } from "./bookmarks.js";
import { loadBackground, updateBackgroundErrorVisibility } from "./unsplash.js";
import { applyShowSearch } from "./search.js";

export const SETTINGS_DEFAULTS = {
  hideFolderIcons: false,
  centerBookmarks: false,
  backgroundEnabled: true,
  backgroundIntervalHours: 6,
  theme: "auto" as "auto" | "light" | "dark",
  style: "glass" as "glass" | "classic",
  bookmarksPosition: "top" as "top" | "bottom",
  showSearch: true,
};

export type Settings = typeof SETTINGS_DEFAULTS;

const systemDarkMq = window.matchMedia("(prefers-color-scheme: dark)");

let settings: Settings = { ...SETTINGS_DEFAULTS };

export function getSettings(): Readonly<Settings> {
  return settings;
}

export async function loadSettings(): Promise<void> {
  const stored = await getPlatform().storage.get(SETTINGS_DEFAULTS as any);
  settings = { ...SETTINGS_DEFAULTS, ...(stored as Partial<Settings>) };
}

async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  settings[key] = value;
  await getPlatform().storage.set({ [key]: value });
}

function effectiveTheme(): "light" | "dark" {
  if (settings.theme === "light" || settings.theme === "dark") return settings.theme;
  return systemDarkMq.matches ? "dark" : "light";
}

export function applyClassSettings(): void {
  document.body.classList.toggle("hide-folder-icons", settings.hideFolderIcons);
  document.body.classList.toggle("centered", settings.centerBookmarks);
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = effectiveTheme();
  try {
    localStorage.setItem("theme", settings.theme);
  } catch {
    /* ignore */
  }
}

export function applyStyle(): void {
  document.documentElement.dataset.style = settings.style;
  try {
    localStorage.setItem("style", settings.style);
  } catch {
    /* ignore */
  }
}

export function applyBookmarksPosition(): void {
  document.documentElement.dataset.bookmarksPosition = settings.bookmarksPosition;
  try {
    localStorage.setItem("bookmarksPosition", settings.bookmarksPosition);
  } catch {
    /* ignore */
  }
}

export function syncSettingsUi(): void {
  document.querySelectorAll<HTMLElement>("[data-setting]").forEach((el) => {
    const key = el.dataset.setting as keyof Settings | undefined;
    if (!key || !(key in settings)) return;
    if (el.classList.contains("toggle-group")) {
      el.querySelectorAll<HTMLButtonElement>("button[data-value]").forEach((btn) => {
        btn.setAttribute(
          "aria-checked",
          String(btn.dataset.value === String(settings[key]))
        );
      });
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = !!settings[key];
    } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.value = String(settings[key]);
    }
  });
}

function handleSettingChange(key: keyof Settings): void {
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
    loadBackground({
      enabled: settings.backgroundEnabled,
      intervalHours: settings.backgroundIntervalHours,
    });
    if (key === "backgroundEnabled") {
      updateBackgroundErrorVisibility({
        enabled: settings.backgroundEnabled,
        intervalHours: settings.backgroundIntervalHours,
      });
    }
  } else if (key === "showSearch") {
    applyShowSearch(settings.showSearch);
  }
}

export function setupSettingsPanel(): void {
  const btn = document.getElementById("settings-btn") as HTMLButtonElement | null;
  const panel = document.getElementById("settings-panel");
  if (!btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      updateBackgroundErrorVisibility({
        enabled: settings.backgroundEnabled,
        intervalHours: settings.backgroundIntervalHours,
      });
    }
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    if (!panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-setting]').forEach((input) => {
    input.addEventListener("change", async () => {
      const key = input.dataset.setting as keyof Settings;
      await saveSetting(key, input.checked as Settings[typeof key]);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll<HTMLSelectElement>("select[data-setting]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const key = sel.dataset.setting as keyof Settings;
      const value =
        key === "backgroundIntervalHours" ? parseInt(sel.value, 10) : (sel.value as Settings[typeof key]);
      await saveSetting(key, value as Settings[typeof key]);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll<HTMLElement>(".toggle-group[data-setting]").forEach((group) => {
    group.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const tgtBtn = target.closest<HTMLButtonElement>("button[data-value]");
      if (!tgtBtn || !group.contains(tgtBtn)) return;
      const key = group.dataset.setting as keyof Settings;
      const value = tgtBtn.dataset.value as Settings[typeof key];
      if (settings[key] === value) return;
      await saveSetting(key, value);
      syncSettingsUi();
      handleSettingChange(key);
    });
  });

  systemDarkMq.addEventListener("change", () => {
    if (settings.theme === "auto") applyTheme();
  });
}

export function setupBackoffStorageListener(): () => void {
  return getPlatform().storage.onChanged((changes, area) => {
    if (area === "local" && changes.unsplashBackoff) {
      updateBackgroundErrorVisibility({
        enabled: settings.backgroundEnabled,
        intervalHours: settings.backgroundIntervalHours,
      });
    }
  });
}
