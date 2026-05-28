/// <reference types="firefox-webext-browser" />

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

async function init(): Promise<void> {
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
}
init();
