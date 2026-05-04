// Synchronously sets data-theme and data-style on <html> based on localStorage,
// before the stylesheet is parsed — prevents a flash of incorrect theme/style.
(function () {
  try {
    var t = localStorage.getItem("theme") || "auto";
    var resolved =
      t === "auto"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.style =
      localStorage.getItem("style") || "glass";
  } catch (e) {}
})();
