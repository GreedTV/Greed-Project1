// Light / dark theme, remembered per visitor.
// Loaded in <head> so the saved theme applies before the page is drawn (no flash).

const SinnersTheme = (() => {
  const KEY = "sinners-display";
  let theme = "dark";
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (saved.theme === "light") theme = "light";
  } catch (e) {}

  function apply() {
    document.documentElement.dataset.theme = theme;
  }

  function toggle() {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme }));
    } catch (e) {}
    apply();
    return theme;
  }

  apply();
  return { get theme() { return theme; }, toggle };
})();

// Theme button in the header
document.addEventListener("DOMContentLoaded", () => {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-action";

  const update = () => {
    const dark = SinnersTheme.theme === "dark";
    btn.textContent = dark ? "☀️" : "🌙";
    btn.title = dark ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("aria-label", btn.title);
  };
  btn.addEventListener("click", () => {
    SinnersTheme.toggle();
    update();
  });
  update();
  actions.prepend(btn);
});
