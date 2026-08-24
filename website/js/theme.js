/* Theme: ivory ⇄ burgundy. Load this in <head> (synchronously) so the
   saved choice applies before first paint. */
(() => {
  "use strict";
  const KEY = "wam_theme";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark") document.documentElement.dataset.theme = "dark";
  } catch (e) { /* private mode: default theme */ }

  window.wamTheme = {
    current() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; },
    toggle() {
      const next = this.current() === "dark" ? "light" : "dark";
      if (next === "dark") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
      window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".themetoggle").forEach((btn) => {
      btn.addEventListener("click", () => window.wamTheme.toggle());
    });
  });
})();
