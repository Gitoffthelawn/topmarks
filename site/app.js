/* Topmarks marketing site — interactivity */
(function () {
  "use strict";

  /* ---------- Curated wallpapers (mirrors the extension's Unsplash feature) ---------- */
  var WALLPAPERS = [
    { id: "1502790671504-542ad42d5189", by: "Aniket Deole", tone: "dark" },
    { id: "1470071459604-3b5ec3a7fe05", by: "Samuel Ferrara", tone: "dark" },
    { id: "1441974231531-c6227db76b6e", by: "Sebastian Unrau", tone: "dark" },
    { id: "1454496522488-7a8e488e8606", by: "Joshua Earle", tone: "dark" },
    { id: "1506905925346-21bda4d32df4", by: "Kalen Emsley", tone: "dark" }
  ];
  function url(id, w) {
    return "https://images.unsplash.com/photo-" + id +
      "?auto=format&fit=crop&w=" + (w || 2400) + "&q=80";
  }

  var layers = [
    document.getElementById("wp-a"),
    document.getElementById("wp-b")
  ];
  var attrName = document.getElementById("attr-name");
  var active = 0;
  var wpIndex = -1;
  var rotateTimer = null;
  var ROTATE_MS = 9000;

  function showWallpaper(i) {
    wpIndex = (i + WALLPAPERS.length) % WALLPAPERS.length;
    var wp = WALLPAPERS[wpIndex];
    var next = layers[active ^ 1];
    var cur = layers[active];
    var img = new Image();
    img.onload = function () {
      next.style.backgroundImage = "url('" + img.src + "')";
      next.classList.add("is-active");
      cur.classList.remove("is-active");
      active ^= 1;
    };
    img.onerror = function () {
      // keep gradient fallback; still update credit minimally
    };
    img.src = url(wp.id);
    if (attrName) attrName.textContent = wp.by;
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
  showWallpaper(0);
  startRotation();

  // click attribution shuffle area to advance (little easter egg / manual control)
  var shuffle = document.getElementById("wp-shuffle");
  if (shuffle) {
    shuffle.addEventListener("click", function () {
      showWallpaper(wpIndex + 1);
      startRotation();
    });
  }

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
