/// <reference types="firefox-webext-browser" />
const SETTINGS_DEFAULTS = {
  hideFolderIcons: false,
  centerBookmarks: false,
  backgroundEnabled: true,
  backgroundIntervalHours: 6,
  theme: "auto",
  style: "glass",
  bookmarksPosition: "top",
  showSearch: true,
};

const systemDarkMq = window.matchMedia("(prefers-color-scheme: dark)");

let settings: typeof SETTINGS_DEFAULTS = { ...SETTINGS_DEFAULTS };

function applyClassSettings() {
  document.body.classList.toggle("hide-folder-icons", settings.hideFolderIcons);
  document.body.classList.toggle("centered", settings.centerBookmarks);
}

function effectiveTheme() {
  if (settings.theme === "light" || settings.theme === "dark") return settings.theme;
  return systemDarkMq.matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
  // Mirror to localStorage so the FOUC-prevention script in the HTML head can read
  // it synchronously on the next page load.
  try {
    localStorage.setItem("theme", settings.theme);
  } catch {}
}

function applyStyle() {
  document.documentElement.dataset.style = settings.style;
  try {
    localStorage.setItem("style", settings.style);
  } catch {}
}

function applyBookmarksPosition() {
  document.documentElement.dataset.bookmarksPosition = settings.bookmarksPosition;
  try {
    localStorage.setItem("bookmarksPosition", settings.bookmarksPosition);
  } catch {}
}

systemDarkMq.addEventListener("change", () => {
  if (settings.theme === "auto") applyTheme();
});

async function loadSettings() {
  const stored = await browser.storage.local.get(SETTINGS_DEFAULTS);
  settings = { ...SETTINGS_DEFAULTS, ...stored };
}

async function saveSetting(key: keyof typeof SETTINGS_DEFAULTS, value: any): Promise<void> {
  (settings as any)[key] = value;
  await browser.storage.local.set({ [key]: value });
}

function syncSettingsUi() {
  document.querySelectorAll("[data-setting]").forEach((el) => {
    const hel = el as HTMLElement;
    const key = hel.dataset.setting;
    if (!key || !(key in settings)) return;
    if (hel.classList.contains("toggle-group")) {
      hel.querySelectorAll("button[data-value]").forEach((btn) => {
        btn.setAttribute(
          "aria-checked",
          String((btn as HTMLElement).dataset.value === String((settings as any)[key]))
        );
      });
    } else if ((hel as HTMLInputElement).type === "checkbox") {
      (hel as HTMLInputElement).checked = !!(settings as any)[key];
    } else {
      (hel as HTMLInputElement).value = String((settings as any)[key]);
    }
  });
}

function setupSettingsPanel() {
  const btn = document.getElementById("settings-btn");
  const panel = document.getElementById("settings-panel");
  if (!btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) updateBackgroundErrorVisibility();
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    if (!panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  panel.querySelectorAll('input[type="checkbox"][data-setting]').forEach((input) => {
    const inp = input as HTMLInputElement;
    inp.addEventListener("change", async () => {
      const key = inp.dataset.setting ?? "";
      await saveSetting(key as keyof typeof SETTINGS_DEFAULTS, inp.checked);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll("select[data-setting]").forEach((sel) => {
    const s = sel as HTMLSelectElement;
    s.addEventListener("change", async () => {
      const key = s.dataset.setting ?? "";
      const value = key === "backgroundIntervalHours" ? parseInt(s.value, 10) : s.value;
      await saveSetting(key as keyof typeof SETTINGS_DEFAULTS, value);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll(".toggle-group[data-setting]").forEach((group) => {
    const grp = group as HTMLElement;
    grp.addEventListener("click", async (e) => {
      const btn = (e.target as Element | null)?.closest("button[data-value]");
      if (!btn || !grp.contains(btn)) return;
      const key = grp.dataset.setting ?? "";
      const value = (btn as HTMLElement).dataset.value ?? "";
      if ((settings as any)[key] === value) return;
      await saveSetting(key as keyof typeof SETTINGS_DEFAULTS, value);
      syncSettingsUi();
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll('input[type="text"][data-setting]').forEach((input) => {
    const inp = input as HTMLInputElement;
    let timer: ReturnType<typeof setTimeout>;
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const key = inp.dataset.setting ?? "";
        await saveSetting(key as keyof typeof SETTINGS_DEFAULTS, inp.value);
        handleSettingChange(key);
      }, 500);
    });
  });

}

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

function handleSettingChange(key: string): void {
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
    loadBackground();
    if (key === "backgroundEnabled") updateBackgroundErrorVisibility();
  } else if (key === "showSearch") {
    applyShowSearch();
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
