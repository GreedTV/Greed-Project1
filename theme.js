// Display settings: theme (dark / light) and accent color, remembered per visitor.
// The accent can be one of the presets or any custom color code.
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
  ];

  let settings = { theme: "dark", accent: "crimson", custom: "#00c2a8" };
  try {
    settings = { ...settings, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (e) {}
  if (!THEMES.some(([key]) => key === settings.theme)) settings.theme = "dark";

  // "#abc", "abc", "#aabbcc" -> "#aabbcc", or null if it isn't a color code
  function normalizeHex(value) {
    let hex = String(value || "").trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.replace(/./g, "$&$&");
    return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
  }

  function hexToHsl(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hsl = (h, s, l) => `hsl(${Math.round(h % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

  function apply() {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    const custom = settings.accent === "custom" ? normalizeHex(settings.custom) : null;
    root.dataset.accent = custom ? "custom" : settings.accent;
    if (custom) {
      // Second color: a neighboring hue; dark shade: the same hue, darker (for gradients and light-mode links)
      const [h, s, l] = hexToHsl(custom);
      root.style.setProperty("--accent", custom);
      root.style.setProperty("--accent-2", hsl(h + 35, clamp(s, 55, 95), clamp(l + 10, 50, 70)));
      root.style.setProperty("--accent-dark", hsl(h, clamp(s, 40, 90), clamp(l - 18, 22, 42)));
    } else {
      ["--accent", "--accent-2", "--accent-dark"].forEach((p) => root.style.removeProperty(p));
    }
  }

  function set(changes) {
    settings = { ...settings, ...changes };
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {}
    apply();
  }

  apply();

  return { ACCENTS, THEMES, normalizeHex, get settings() { return settings; }, set };
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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    const { theme, accent, custom } = SinnersDisplay.settings;
    panel.replaceChildren();

    panel.append(el("p", "display-title", "Theme"));
    const themes = el("div", "theme-options");
    SinnersDisplay.THEMES.forEach(([key, label, icon]) => {
      const b = el("button", "theme-option" + (theme === key ? " active" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", theme === key);
      b.append(el("span", null, icon), label);
      b.addEventListener("click", () => {
        SinnersDisplay.set({ theme: key });
        render();
      });
      themes.append(b);
    });
    panel.append(themes);

    panel.append(el("p", "display-title", "Accent color"));
    const swatches = el("div", "accent-options");
    SinnersDisplay.ACCENTS.forEach(([key, label, color]) => {
      const b = el("button", "accent-swatch" + (accent === key ? " active" : ""));
      b.type = "button";
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

    // Custom color: a color wheel plus a text box for a color code like #00ffaa
    panel.append(el("p", "display-title", "Custom color"));
    const row = el("form", "custom-color" + (accent === "custom" ? " active" : ""));
    const picker = el("input");
    picker.type = "color";
    picker.value = SinnersDisplay.normalizeHex(custom) || "#00c2a8";
    picker.setAttribute("aria-label", "Pick a color");
    const code = el("input");
    code.type = "text";
    code.value = picker.value;
    code.maxLength = 7;
    code.placeholder = "#00ffaa";
    code.spellcheck = false;
    code.setAttribute("aria-label", "Color code");
    const use = el("button", "button", "Use");
    use.type = "submit";
    const msg = el("p", "custom-msg");
    row.append(picker, code, use);

    const useColor = (value) => {
      const hex = SinnersDisplay.normalizeHex(value);
      if (!hex) {
        msg.textContent = "Use a color code like #00ffaa";
        return;
      }
      msg.textContent = "";
      picker.value = hex;
      code.value = hex;
      SinnersDisplay.set({ accent: "custom", custom: hex });
      row.classList.add("active");
      swatches.querySelectorAll(".accent-swatch").forEach((s) => {
        s.classList.remove("active");
        s.setAttribute("aria-pressed", "false");
      });
    };
    picker.addEventListener("input", () => useColor(picker.value));
    row.addEventListener("submit", (e) => {
      e.preventDefault();
      useColor(code.value);
    });
    panel.append(row, msg);
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
