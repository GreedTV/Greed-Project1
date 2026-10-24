// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Dark mode toggle, remembered between visits
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

try {
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
} catch (e) {}

toggle.addEventListener("click", () => {
  const isDark =
    root.dataset.theme === "dark" ||
    (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = isDark ? "light" : "dark";
  try {
    localStorage.setItem("theme", root.dataset.theme);
  } catch (e) {}
});
