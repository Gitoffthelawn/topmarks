import { setPlatform, type Platform } from "@/platform";
import { applyI18n } from "@/i18n";
import { renderBookmarks, setupBookmarksListeners, closeAllDropdowns } from "@/bookmarks";
import { loadBackground, updateBackgroundErrorVisibility } from "@/unsplash";
import {
  loadSettings,
  applyTheme,
  applyStyle,
  applyBookmarksPosition,
  applyCenterWidget,
  applyClassSettings,
  syncSettingsUi,
  setupSettingsPanel,
  setupBackoffStorageListener,
  setupFolderEmojiStorageListener,
  getSettings,
} from "@/settings";
import { setupFolderEmojiOverlay } from "@/folder-emojis";
import { setupSearch } from "@/search";

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
  setupFolderEmojiOverlay();
  setupSearch();
  applyCenterWidget();
  setupBookmarksListeners();
  setupBackoffStorageListener();
  setupFolderEmojiStorageListener();

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
