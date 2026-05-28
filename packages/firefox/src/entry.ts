/// <reference types="firefox-webext-browser" />

// Reference to the search input even when detached from the DOM, so toggling
// the setting off then on restores the same element (state preserved).
let searchInput: HTMLInputElement | null = null;
let searchInputParent: Element | null = null;

function setupSearch() {
  searchInput = document.getElementById("search-input") as HTMLInputElement | null;
  if (!searchInput) return;
  searchInputParent = searchInput.parentElement;

  const input = searchInput;
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const query = input.value.trim();
      if (!query) return;
      e.preventDefault();
      const inNewTab = e.shiftKey || e.ctrlKey || e.metaKey;
      try {
        if (inNewTab) {
          const tab = await browser.tabs.create({
            url: "about:blank",
            active: true,
          });
          await browser.search.search({ query, tabId: tab.id });
        } else {
          const current = await browser.tabs.getCurrent();
          await browser.search.search({ query, tabId: current?.id });
        }
      } catch (err) {
        console.error("[Topmarks] Search submit failed:", err);
      }
    } else if (e.key === "Escape") {
      if (input.value !== "") {
        input.value = "";
        // Prevent the document-level Escape handler from also closing the
        // settings panel / dropdowns when the user is just clearing text.
        e.stopPropagation();
      } else {
        input.blur();
      }
    }
  });

  if (!settings.showSearch) {
    input.remove();
    return;
  }

  input.focus();
}

function applyShowSearch() {
  if (!searchInput) return;
  if (settings.showSearch) {
    if (!searchInput.isConnected && searchInputParent) {
      searchInputParent.appendChild(searchInput);
    }
    searchInput.focus();
  } else if (searchInput.isConnected) {
    searchInput.remove();
  }
}

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
