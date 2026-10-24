// Display settings: theme (dark / light / system) and accent color, remembered per visitor.
// Loaded in <head> so the saved colors apply before the page is drawn (no flash).

const SinnersDisplay = (() => {
  const KEY = "sinners-display";
  const ACCENTS = [
    ["crimson", "Crimson", "#e11d48"],
    ["purple", "Purple", "#a855f7"],
    ["blue", "Blue", "#3b82f6"],
    ["green", "Green", "#22c55e"],
    ["orange", "Orange", "#f97316"],
    ["pink", "Pink", "#ec4899"],
  ];
  const THEMES = [
    ["dark", "Dark", "🌙"],
    ["light", "Light", "☀️"],
    ["system", "System", "💻"],
  ];
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  let settings = { theme: "dark", accent: "crimson" };
  try {
    settings = { ...settings, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (e) {}

  function apply() {
    const theme = settings.theme === "system" ? (systemDark.matches ? "dark" : "light") : settings.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = settings.accent;
  }

  function set(changes) {
    settings = { ...settings, ...changes };
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {}
    apply();
  }

  apply();
  systemDark.addEventListener("change", () => settings.theme === "system" && apply());

  return { ACCENTS, THEMES, get settings() { return settings; }, set };
})();

// Display button and panel in the header
document.addEventListener("DOMContentLoaded", () => {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;

  const wrap = document.createElement("div");
  wrap.className = "display-menu";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-action";
  btn.title = "Display settings";
  btn.setAttribute("aria-label", "Display settings");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "🎨";

  const panel = document.createElement("div");
  panel.className = "display-panel";
  panel.hidden = true;

  function section(title) {
    const h = document.createElement("p");
    h.className = "display-title";
    h.textContent = title;
    return h;
  }

  function render() {
    const { theme, accent } = SinnersDisplay.settings;
    panel.replaceChildren();

    panel.append(section("Theme"));
    const themes = document.createElement("div");
    themes.className = "theme-options";
    SinnersDisplay.THEMES.forEach(([key, label, icon]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-option" + (theme === key ? " active" : "");
      b.setAttribute("aria-pressed", theme === key);
      b.innerHTML = `<span aria-hidden="true">${icon}</span>${label}`;
      b.addEventListener("click", () => {
        SinnersDisplay.set({ theme: key });
        render();
      });
      themes.append(b);
    });
    panel.append(themes);

    panel.append(section("Accent color"));
    const swatches = document.createElement("div");
    swatches.className = "accent-options";
    SinnersDisplay.ACCENTS.forEach(([key, label, color]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "accent-swatch" + (accent === key ? " active" : "");
      b.style.setProperty("--swatch", color);
      b.title = label;
      b.setAttribute("aria-label", label);
      b.setAttribute("aria-pressed", accent === key);
      b.addEventListener("click", () => {
        SinnersDisplay.set({ accent: key });
        render();
      });
      swatches.append(b);
    });
    panel.append(swatches);
  }

  function toggle(open) {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open);
    if (open) render();
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle(panel.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !wrap.contains(e.target)) toggle(false);
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && toggle(false));

  wrap.append(btn, panel);
  actions.prepend(wrap);
});
