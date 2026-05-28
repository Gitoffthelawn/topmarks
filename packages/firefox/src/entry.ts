/// <reference types="firefox-webext-browser" />
// Tabliss's curated wallpaper collection — ~545 hand-picked, consistent high quality.
const UNSPLASH_COLLECTION_ID = "1053828";
// Exponential-backoff bounds for Unsplash failures. Doubles each consecutive
// failure (30s → 1m → 2m → 4m → 8m → 16m → 30m).
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;

function backoffDelayMs(failures: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, failures - 1), BACKOFF_MAX_MS);
}
// Per Unsplash API guidelines, every link back to unsplash.com must include UTM
// params. The `utm_source` should match the application name you registered at
// https://unsplash.com/oauth/applications.
const UNSPLASH_UTM_SOURCE = "firefox-bookmarks";
const UNSPLASH_HOME = "https://unsplash.com/";

function withUtm(urlString: string): string {
  try {
    const u = new URL(urlString);
    u.searchParams.set("utm_source", UNSPLASH_UTM_SOURCE);
    u.searchParams.set("utm_medium", "referral");
    u.searchParams.set("utm_campaign", "api-credit");
    return u.toString();
  } catch {
    return urlString;
  }
}

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

function preloadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

const UNSPLASH_ACCESS_KEY: string = (process as any).env?.UNSPLASH_ACCESS_KEY ?? "";
function hasUnsplashKey() {
  return UNSPLASH_ACCESS_KEY.length > 0;
}

function targetImageWidth() {
  const dpr = window.devicePixelRatio || 1;
  const raw = window.screen.width * dpr;
  // Snap to 240px increments so the CDN can cache effectively across users.
  const snapped = Math.round(raw / 240) * 240;
  return Math.max(1920, Math.min(snapped, 3840));
}

function buildImageUrl(rawUrl: string): string {
  const w = targetImageWidth();
  return `${rawUrl}&w=${w}&q=85`;
}

async function fetchUnsplashRandomPhoto() {
  if (!hasUnsplashKey()) throw new Error("Unsplash access key not configured");
  const url = new URL("https://api.unsplash.com/photos/random");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("collections", UNSPLASH_COLLECTION_ID);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });
  if (!res.ok) throw new Error(`Unsplash API ${res.status}`);
  const photo = await res.json();

  return {
    rawUrl: photo.urls.raw,
    color: photo.color,
    authorName: photo.user?.name || "Unknown",
    authorUrl: withUtm(photo.user?.links?.html || UNSPLASH_HOME),
    photoUrl: withUtm(photo.links?.html || UNSPLASH_HOME),
    downloadLocation: photo.links?.download_location,
  };
}

async function triggerUnsplashDownload(downloadLocation: string | undefined) {
  if (!downloadLocation || !hasUnsplashKey()) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
  } catch {
    /* tracking ping; ignore failures */
  }
}

function applyBackground(photo: any): void {
  const body = document.body;
  if (!photo || !photo.imageUrl) return;
  if (photo.color) body.style.backgroundColor = photo.color;
  body.style.backgroundImage = `url("${photo.imageUrl}")`;
  body.classList.add("has-background");

  const attr = document.getElementById("bg-attribution");
  const photoLink = document.getElementById("bg-photo-link") as HTMLAnchorElement | null;
  const author = document.getElementById("bg-author") as HTMLAnchorElement | null;
  const unsplashLink = document.getElementById("bg-unsplash-link") as HTMLAnchorElement | null;
  if (photo.authorName && photo.authorUrl) {
    if (photoLink) photoLink.href = photo.photoUrl || withUtm(UNSPLASH_HOME);
    if (author) { author.textContent = photo.authorName; author.href = photo.authorUrl; }
    if (unsplashLink) unsplashLink.href = withUtm(UNSPLASH_HOME);
    if (attr) attr.hidden = false;
  } else {
    if (attr) attr.hidden = true;
  }
}

function clearBackground() {
  const body = document.body;
  body.classList.remove("has-background");
  body.style.backgroundImage = "";
  const attr = document.getElementById("bg-attribution");
  if (attr) attr.hidden = true;
}

async function loadBackground({ force = false } = {}) {
  if (!settings.backgroundEnabled) {
    clearBackground();
    return;
  }

  const stored = await browser.storage.local.get([
    "cachedBackground",
    "unsplashBackoff",
  ]);
  const cachedBackground = stored.cachedBackground;
  const backoff = stored.unsplashBackoff || { failures: 0, nextAttemptAt: 0 };

  const intervalMs = (settings.backgroundIntervalHours || 6) * 60 * 60 * 1000;
  // Caches without rawUrl are from an older format and get invalidated automatically.
  const isExpired =
    !cachedBackground ||
    !cachedBackground.rawUrl ||
    !cachedBackground.fetchedAt ||
    Date.now() - cachedBackground.fetchedAt > intervalMs;

  if (cachedBackground && cachedBackground.rawUrl) {
    applyBackground({
      ...cachedBackground,
      imageUrl: buildImageUrl(cachedBackground.rawUrl),
    });
  }

  if (!force && !isExpired) return;

  // Honor the backoff window so a stream of new tabs after a failure doesn't
  // hammer the API. Backoff state is shared across all tabs via storage.
  const now = Date.now();
  if (now < backoff.nextAttemptAt) {
    const waitS = Math.ceil((backoff.nextAttemptAt - now) / 1000);
    console.warn(
      `Unsplash backoff active (${backoff.failures} consecutive failures); ` +
        `next attempt in ${waitS}s`
    );
    if (!cachedBackground?.rawUrl) clearBackground();
    return;
  }

  if (hasUnsplashKey()) {
    try {
      const fresh = await fetchUnsplashRandomPhoto();
      const imageUrl = buildImageUrl(fresh.rawUrl);
      await preloadImage(imageUrl);
      const cached = {
        rawUrl: fresh.rawUrl,
        color: fresh.color,
        authorName: fresh.authorName,
        authorUrl: fresh.authorUrl,
        photoUrl: fresh.photoUrl,
        fetchedAt: Date.now(),
      };
      await browser.storage.local.set({
        cachedBackground: cached,
        unsplashBackoff: { failures: 0, nextAttemptAt: 0 },
      });
      applyBackground({ ...cached, imageUrl });
      triggerUnsplashDownload(fresh.downloadLocation);
      return;
    } catch (err) {
      const failures = backoff.failures + 1;
      const delay = backoffDelayMs(failures);
      await browser.storage.local.set({
        unsplashBackoff: {
          failures,
          nextAttemptAt: Date.now() + delay,
          lastErrorMessage: String((err as any)?.message || err),
          lastErrorAt: Date.now(),
        },
      });
      console.warn(
        `Unsplash fetch failed (attempt ${failures}); ` +
          `next attempt in ${Math.round(delay / 1000)}s`,
        err
      );
    }
  }

  if (!cachedBackground?.rawUrl) {
    clearBackground();
  }
}

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

async function updateBackgroundErrorVisibility() {
  const errorEl = document.getElementById("setting-bg-error");
  const intervalEl = document.getElementById("setting-bg-interval");
  if (!errorEl || !intervalEl) return;

  if (!settings.backgroundEnabled) {
    errorEl.hidden = true;
    intervalEl.hidden = false;
    return;
  }

  const stored = await browser.storage.local.get([
    "unsplashBackoff",
    "cachedBackground",
  ]);
  const unsplashBackoff = stored.unsplashBackoff;
  const cachedBackground = stored.cachedBackground;
  const active =
    unsplashBackoff &&
    unsplashBackoff.failures > 0 &&
    unsplashBackoff.nextAttemptAt > Date.now();

  errorEl.hidden = !active;
  intervalEl.hidden = active;

  const now = Date.now();
  if (active) {
    console.error("[Topmarks] Wallpaper error shown in settings.", {
      consecutiveFailures: unsplashBackoff.failures,
      nextAttemptInSeconds: Math.ceil((unsplashBackoff.nextAttemptAt - now) / 1000),
      nextAttemptAt: new Date(unsplashBackoff.nextAttemptAt).toISOString(),
      lastErrorMessage: unsplashBackoff.lastErrorMessage || null,
      lastErrorAt: unsplashBackoff.lastErrorAt
        ? new Date(unsplashBackoff.lastErrorAt).toISOString()
        : null,
      cachedBackgroundShown: !!cachedBackground?.rawUrl,
      cachedBackgroundFetchedAt: cachedBackground?.fetchedAt
        ? new Date(cachedBackground.fetchedAt).toISOString()
        : null,
      cachedBackgroundAgeHours: cachedBackground?.fetchedAt
        ? Math.round((now - cachedBackground.fetchedAt) / 36e5 * 10) / 10
        : null,
      backgroundIntervalHours: settings.backgroundIntervalHours,
      hasUnsplashKey: hasUnsplashKey(),
    });
  } else {
    console.info("[Topmarks] No active wallpaper error.", {
      backoff: unsplashBackoff || null,
      cachedBackgroundShown: !!cachedBackground?.rawUrl,
    });
  }
}

if (browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.unsplashBackoff) {
      updateBackgroundErrorVisibility();
    }
  });
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
