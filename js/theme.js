// Runs synchronously in <head>; no inline-script CSP exception is needed.
(() => {
  const prefix = "music-like-shows:v1:setting:";
  let theme = "system",
    reduce = false;
  try {
    theme = JSON.parse(localStorage.getItem(prefix + "theme")) || "system";
    reduce = JSON.parse(localStorage.getItem(prefix + "reduceGlass")) === true;
  } catch {}
  if (!["system", "light", "dark"].includes(theme)) theme = "system";
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.reduceGlass = String(reduce);
})();
