import { setPlatform, type Platform } from "./platform.js";
import { applyI18n } from "./i18n.js";
import { renderBookmarks, setupBookmarksListeners, closeAllDropdowns } from "./bookmarks.js";
import { loadBackground, updateBackgroundErrorVisibility } from "./unsplash.js";
import {
  loadSettings,
  applyTheme,
  applyStyle,
  applyBookmarksPosition,
  applyClassSettings,
  syncSettingsUi,
  setupSettingsPanel,
  setupBackoffStorageListener,
  getSettings,
} from "./settings.js";
import { setupSearch } from "./search.js";

export async function startApp(platform: Platform): Promise<void> {
  setPlatform(platform);

  document.addEventListener("click", () => closeAllDropdowns());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
      const panel = document.getElementById("settings-panel");
      const btn = document.getElementById("settings-btn");
      if (panel && !panel.hidden) {
        panel.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
      }
    }
  });

  applyI18n();
  await loadSettings();
  const settings = getSettings();

  applyTheme();
  applyStyle();
  applyBookmarksPosition();
  applyClassSettings();
  syncSettingsUi();
  setupSettingsPanel();
  setupSearch(settings.showSearch);
  setupBookmarksListeners();
  setupBackoffStorageListener();

  renderBookmarks();
  loadBackground({
    enabled: settings.backgroundEnabled,
    intervalHours: settings.backgroundIntervalHours,
  });
  updateBackgroundErrorVisibility({
    enabled: settings.backgroundEnabled,
    intervalHours: settings.backgroundIntervalHours,
  });
}
