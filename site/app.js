/* Topmarks marketing site — interactivity */
(function () {
  "use strict";

  /* ---------- Curated wallpapers (loaded from wallpapers.json) ----------
     Same Unsplash collection the extension uses (Tabliss, 1053828). Images are
     hotlinked from images.unsplash.com; each entry carries the attribution
     Unsplash requires. Regenerate with: node scripts/curate-wallpapers.mjs */
  var WALLPAPERS = [];

  function imageUrl(id, w) {
    return "https://images.unsplash.com/photo-" + id +
      "?auto=format&fit=crop&w=" + (w || 2400) + "&q=80";
  }

  // Per Unsplash API guidelines, links back to unsplash.com must carry UTM
  // params identifying the app (utm_source = registered application name).
  function withUtm(u) {
    if (!u) return "https://unsplash.com/?utm_source=topmarks&utm_medium=referral";
    return u + (u.indexOf("?") === -1 ? "?" : "&") +
      "utm_source=topmarks&utm_medium=referral";
  }

  var layers = [
    document.getElementById("wp-a"),
    document.getElementById("wp-b")
  ];
  var elAuthor = document.getElementById("wp-author");
  var elPhoto = document.getElementById("wp-photo");
  var active = 0;
  var wpIndex = -1;
  var rotateTimer = null;
  var ROTATE_MS = 9000;

  function showWallpaper(i) {
    if (!WALLPAPERS.length) return;
    wpIndex = (i + WALLPAPERS.length) % WALLPAPERS.length;
    var wp = WALLPAPERS[wpIndex];
    var next = layers[active ^ 1];
    var cur = layers[active];
    var img = new Image();
    img.onload = function () {
      if (wp.color) next.style.backgroundColor = wp.color;
      next.style.backgroundImage = "url('" + img.src + "')";
      next.classList.add("is-active");
      cur.classList.remove("is-active");
      active ^= 1;
    };
    img.onerror = function () {
      // keep gradient fallback
    };
    img.src = imageUrl(wp.id);

    // Attribution: Unsplash • author • photo (the Unsplash link is static in HTML)
    if (elAuthor) {
      elAuthor.textContent = wp.author || "Unsplash";
      elAuthor.href = withUtm(wp.authorUrl);
    }
    if (elPhoto) elPhoto.href = withUtm(wp.photoUrl);
  }

  function startRotation() {
    clearInterval(rotateTimer);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    rotateTimer = setInterval(function () { showWallpaper(wpIndex + 1); }, ROTATE_MS);
  }

  /* ---------- Theme + Style state (persisted) ---------- */
  var root = document.documentElement;

  function systemDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme(mode) {
    // mode: "light" | "dark"
    root.setAttribute("data-theme", mode);
    syncSeg("theme", mode);
  }
  function applyStyle(style) {
    root.setAttribute("data-style", style);
    syncSeg("style", style);
  }

  function syncSeg(group, value) {
    document.querySelectorAll('[data-seg="' + group + '"] button').forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.val === value));
    });
  }

  // init from storage or system
  var savedTheme = null, savedStyle = null;
  try {
    savedTheme = localStorage.getItem("tm_theme");
    savedStyle = localStorage.getItem("tm_style");
  } catch (e) {}
  applyTheme(savedTheme || (systemDark() ? "dark" : "light"));
  applyStyle(savedStyle || "glass");

  // segmented control clicks
  document.querySelectorAll('[data-seg] button').forEach(function (btn) {
    btn.addEventListener("click", function () {
      var group = btn.closest("[data-seg]").dataset.seg;
      var val = btn.dataset.val;
      if (group === "theme") { applyTheme(val); try { localStorage.setItem("tm_theme", val); } catch (e) {} }
      else { applyStyle(val); try { localStorage.setItem("tm_style", val); } catch (e) {} }
    });
  });

  /* ---------- Wallpaper kick-off ---------- */
  fetch("wallpapers.json")
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      WALLPAPERS = Array.isArray(list) ? list : [];
      if (!WALLPAPERS.length) return;
      // Start on a different wallpaper each load so repeat visits vary.
      var start = Math.floor((Date.now() / ROTATE_MS)) % WALLPAPERS.length;
      showWallpaper(start);
      startRotation();
    })
    .catch(function () { /* keep the mesh-gradient fallback */ });

  /* ---------- Reveal on scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.14 });
  document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });

  /* ---------- Smooth anchor scroll ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var t = document.querySelector(a.getAttribute("href"));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
  });
})();
