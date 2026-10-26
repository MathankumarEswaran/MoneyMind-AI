// Apply the stored theme before first paint to avoid a flash of the wrong scheme.
// Served as a static file so the production CSP can forbid inline scripts.
(() => {
  try {
    const stored = localStorage.getItem("moneymind-theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "system" || !stored ? systemDark : stored === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    // Keep mobile browser chrome in sync with a manually chosen theme.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0f1211" : "#fafaf7");
  } catch {
    /* localStorage can be unavailable in hardened browsers */
  }
})();
