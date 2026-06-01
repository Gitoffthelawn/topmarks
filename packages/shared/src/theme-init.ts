// Synchronously sets data-theme, data-style, data-bookmarks-position, and
// data-center-widget on <html> based on localStorage, before the stylesheet is
// parsed — prevents a flash of incorrect theme/style/layout.
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
    document.documentElement.dataset.bookmarksPosition =
      localStorage.getItem("bookmarksPosition") || "top";
    document.documentElement.dataset.centerWidget =
      localStorage.getItem("centerWidget") || "clock";
    var cs = parseInt(localStorage.getItem("clockSize") || "110", 10);
    document.documentElement.style.setProperty(
      "--clock-scale",
      String((isNaN(cs) ? 110 : cs) / 100)
    );
  } catch (e) {}
})();
