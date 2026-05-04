const TOOLBAR_ID = "toolbar_____";
const SVG_NS = "http://www.w3.org/2000/svg";
// Tabliss's curated wallpaper collection — ~545 hand-picked, consistent high quality.
const UNSPLASH_COLLECTION_ID = "1053828";
// Exponential-backoff bounds for Unsplash failures. Doubles each consecutive
// failure (30s → 1m → 2m → 4m → 8m → 16m → 30m).
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;

function backoffDelayMs(failures) {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, failures - 1), BACKOFF_MAX_MS);
}
// Per Unsplash API guidelines, every link back to unsplash.com must include UTM
// params. The `utm_source` should match the application name you registered at
// https://unsplash.com/oauth/applications.
const UNSPLASH_UTM_SOURCE = "firefox-bookmarks";
const UNSPLASH_HOME = "https://unsplash.com/";

function withUtm(urlString) {
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

function t(key) {
  try {
    const msg = browser.i18n.getMessage(key);
    if (msg) return msg;
  } catch {}
  return key;
}

function applyI18n() {
  try {
    const lang = browser.i18n.getUILanguage();
    if (lang) document.documentElement.lang = lang;
  } catch {}
  document.title = t("newTabTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const msg = t(el.dataset.i18nAriaLabel);
    if (msg) el.setAttribute("aria-label", msg);
  });
}

const SETTINGS_DEFAULTS = {
  hideFolderIcons: false,
  centerBookmarks: false,
  backgroundEnabled: true,
  backgroundIntervalHours: 6,
  theme: "auto",
  style: "glass",
};

const systemDarkMq = window.matchMedia("(prefers-color-scheme: dark)");

let settings = { ...SETTINGS_DEFAULTS };

function isFolder(node) {
  return node.type === "folder" || (!node.url && Array.isArray(node.children));
}

function sortFoldersFirst(nodes) {
  return [...nodes].sort((a, b) => (isFolder(a) ? 0 : 1) - (isFolder(b) ? 0 : 1));
}

function faviconSources(url) {
  // 1. `page-icon:` — undocumented Firefox URL scheme that returns the favicon
  //    Firefox already has cached for the page. No network request, no third
  //    parties. Falls through silently if the scheme isn't accessible from this
  //    context.
  // 2. The site's own `/favicon.ico` — direct fetch, no third-party service.
  //
  // Third-party favicon services (Google, DuckDuckGo, etc.) are deliberately
  // avoided: they would receive each bookmark's hostname, transmitting browsing
  // data to a third party under Firefox add-on policies.
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return [];
    return [`page-icon:${url}`, `${u.origin}/favicon.ico`];
  } catch {
    return [];
  }
}

function createFolderIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "folder-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
  );
  svg.append(path);
  return svg;
}

function createGlobeIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bookmark-icon globe-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");

  const equator = document.createElementNS(SVG_NS, "line");
  equator.setAttribute("x1", "2");
  equator.setAttribute("y1", "12");
  equator.setAttribute("x2", "22");
  equator.setAttribute("y2", "12");

  const meridian = document.createElementNS(SVG_NS, "path");
  meridian.setAttribute(
    "d",
    "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
  );

  svg.append(circle, equator, meridian);
  return svg;
}

function createBookmarkLink(node) {
  const a = document.createElement("a");
  a.className = "bookmark-item";
  a.href = node.url;
  a.title = `${node.title || node.url}\n${node.url}`;

  const sources = faviconSources(node.url);
  let icon;
  if (sources.length === 0) {
    icon = createGlobeIcon();
  } else {
    icon = document.createElement("img");
    icon.className = "bookmark-icon";
    icon.alt = "";
    icon.loading = "lazy";
    let attempt = 0;
    const tryNext = () => {
      attempt += 1;
      if (attempt < sources.length) {
        icon.src = sources[attempt];
      } else if (icon.parentNode) {
        icon.replaceWith(createGlobeIcon());
      }
    };
    icon.addEventListener("error", tryNext);
    icon.addEventListener("load", () => {
      // 1×1 placeholder responses some hosts serve in lieu of a real 404.
      if (icon.naturalWidth <= 1) tryNext();
    });
    icon.src = sources[0];
  }

  const span = document.createElement("span");
  span.className = "bookmark-title";
  span.textContent = node.title || node.url;

  a.append(icon, span);
  return a;
}

function createDropdownEntry(node) {
  const li = document.createElement("li");

  if (isFolder(node)) {
    li.classList.add("has-submenu");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "submenu-trigger";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "bookmark-title";
    label.textContent = node.title || t("unnamedFolder");

    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.textContent = "›";
    chevron.setAttribute("aria-hidden", "true");

    trigger.append(createFolderIcon(), label, chevron);

    const submenu = document.createElement("ul");
    submenu.className = "folder-dropdown submenu";
    populateDropdown(submenu, node.children || []);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = li.classList.toggle("submenu-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
      if (li.parentElement) {
        Array.from(li.parentElement.children).forEach((sib) => {
          if (sib !== li && sib.classList.contains("submenu-open")) {
            sib.classList.remove("submenu-open");
            const sibTrigger = sib.querySelector(".submenu-trigger");
            if (sibTrigger) sibTrigger.setAttribute("aria-expanded", "false");
          }
        });
      }
    });

    li.append(trigger, submenu);
  } else if (node.url) {
    li.append(createBookmarkLink(node));
  }

  return li;
}

function populateDropdown(ul, children) {
  ul.textContent = "";
  if (!children.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = t("emptyFolder");
    ul.append(empty);
    return;
  }
  for (const child of sortFoldersFirst(children)) {
    ul.append(createDropdownEntry(child));
  }
}

function createTopLevelFolder(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "bookmark-folder";

  const button = document.createElement("button");
  button.className = "bookmark-item folder-button";
  button.title = node.title;
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "bookmark-title";
  label.textContent = node.title || t("unnamedFolder");

  button.append(createFolderIcon(), label);

  const dropdown = document.createElement("ul");
  dropdown.className = "folder-dropdown";
  populateDropdown(dropdown, node.children || []);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = wrapper.classList.contains("open");
    closeAllDropdowns();
    if (!wasOpen) {
      wrapper.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    }
  });

  wrapper.append(button, dropdown);
  return wrapper;
}

function closeAllDropdowns() {
  document.querySelectorAll(".bookmark-folder.open").forEach((el) => {
    el.classList.remove("open");
    const btn = el.querySelector(".folder-button");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".has-submenu.submenu-open").forEach((el) => {
    el.classList.remove("submenu-open");
    const trigger = el.querySelector(".submenu-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

async function renderBookmarks() {
  const bar = document.getElementById("bookmarks-bar");
  bar.textContent = "";
  try {
    const [toolbar] = await browser.bookmarks.getSubTree(TOOLBAR_ID);
    const items = toolbar.children || [];
    if (!items.length) {
      const empty = document.createElement("span");
      empty.className = "empty-state";
      empty.textContent = t("emptyToolbar");
      bar.append(empty);
      return;
    }
    for (const node of sortFoldersFirst(items)) {
      if (isFolder(node)) {
        bar.append(createTopLevelFolder(node));
      } else if (node.url) {
        bar.append(createBookmarkLink(node));
      }
    }
  } catch (err) {
    const msg = document.createElement("span");
    msg.className = "empty-state";
    msg.textContent = t("loadError");
    bar.append(msg);
    console.error(err);
  }
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function hasUnsplashKey() {
  return typeof UNSPLASH_ACCESS_KEY === "string" && UNSPLASH_ACCESS_KEY.length > 0;
}

function targetImageWidth() {
  const dpr = window.devicePixelRatio || 1;
  const raw = window.screen.width * dpr;
  // Snap to 240px increments so the CDN can cache effectively across users.
  const snapped = Math.round(raw / 240) * 240;
  return Math.max(1920, Math.min(snapped, 3840));
}

function buildImageUrl(rawUrl) {
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

async function triggerUnsplashDownload(downloadLocation) {
  if (!downloadLocation || !hasUnsplashKey()) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
  } catch {
    /* tracking ping; ignore failures */
  }
}

function applyBackground(photo) {
  const body = document.body;
  if (!photo || !photo.imageUrl) return;
  if (photo.color) body.style.backgroundColor = photo.color;
  body.style.backgroundImage = `url("${photo.imageUrl}")`;
  body.classList.add("has-background");

  const attr = document.getElementById("bg-attribution");
  const photoLink = document.getElementById("bg-photo-link");
  const author = document.getElementById("bg-author");
  const unsplashLink = document.getElementById("bg-unsplash-link");
  if (photo.authorName && photo.authorUrl) {
    photoLink.href = photo.photoUrl || withUtm(UNSPLASH_HOME);
    author.textContent = photo.authorName;
    author.href = photo.authorUrl;
    unsplashLink.href = withUtm(UNSPLASH_HOME);
    attr.hidden = false;
  } else {
    attr.hidden = true;
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
        unsplashBackoff: { failures, nextAttemptAt: Date.now() + delay },
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

async function updateBackgroundErrorVisibility() {
  const errorEl = document.getElementById("setting-bg-error");
  const intervalEl = document.getElementById("setting-bg-interval");
  if (!errorEl || !intervalEl) return;

  if (!settings.backgroundEnabled) {
    errorEl.hidden = true;
    intervalEl.hidden = false;
    return;
  }

  const { unsplashBackoff } = await browser.storage.local.get(["unsplashBackoff"]);
  const active =
    unsplashBackoff &&
    unsplashBackoff.failures > 0 &&
    unsplashBackoff.nextAttemptAt > Date.now();

  errorEl.hidden = !active;
  intervalEl.hidden = active;
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

async function saveSetting(key, value) {
  settings[key] = value;
  await browser.storage.local.set({ [key]: value });
}

function syncSettingsUi() {
  document.querySelectorAll("[data-setting]").forEach((el) => {
    const key = el.dataset.setting;
    if (!(key in settings)) return;
    if (el.classList.contains("toggle-group")) {
      el.querySelectorAll("button[data-value]").forEach((btn) => {
        btn.setAttribute(
          "aria-checked",
          String(btn.dataset.value === String(settings[key]))
        );
      });
    } else if (el.type === "checkbox") {
      el.checked = !!settings[key];
    } else {
      el.value = String(settings[key]);
    }
  });
}

function setupSettingsPanel() {
  const btn = document.getElementById("settings-btn");
  const panel = document.getElementById("settings-panel");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    if (!panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  panel.querySelectorAll('input[type="checkbox"][data-setting]').forEach((input) => {
    input.addEventListener("change", async () => {
      const key = input.dataset.setting;
      await saveSetting(key, input.checked);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll("select[data-setting]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const key = sel.dataset.setting;
      const value = key === "backgroundIntervalHours" ? parseInt(sel.value, 10) : sel.value;
      await saveSetting(key, value);
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll(".toggle-group[data-setting]").forEach((group) => {
    group.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn || !group.contains(btn)) return;
      const key = group.dataset.setting;
      const value = btn.dataset.value;
      if (settings[key] === value) return;
      await saveSetting(key, value);
      syncSettingsUi();
      handleSettingChange(key);
    });
  });

  panel.querySelectorAll('input[type="text"][data-setting]').forEach((input) => {
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const key = input.dataset.setting;
        await saveSetting(key, input.value);
        handleSettingChange(key);
      }, 500);
    });
  });

}

function handleSettingChange(key) {
  if (key === "hideFolderIcons" || key === "centerBookmarks") {
    applyClassSettings();
  } else if (key === "theme") {
    applyTheme();
  } else if (key === "style") {
    applyStyle();
  } else if (key === "backgroundEnabled" || key === "backgroundIntervalHours") {
    loadBackground();
    if (key === "backgroundEnabled") updateBackgroundErrorVisibility();
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
      btn.setAttribute("aria-expanded", "false");
    }
  }
});

const bookmarkEvents = ["onCreated", "onRemoved", "onChanged", "onMoved"];
for (const ev of bookmarkEvents) {
  if (browser.bookmarks[ev]) browser.bookmarks[ev].addListener(renderBookmarks);
}

(async function init() {
  applyI18n();
  await loadSettings();
  applyTheme();
  applyStyle();
  applyClassSettings();
  syncSettingsUi();
  setupSettingsPanel();
  renderBookmarks();
  loadBackground();
  updateBackgroundErrorVisibility();
})();
