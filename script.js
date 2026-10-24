// Footer year
document.querySelectorAll("#year").forEach((el) => (el.textContent = new Date().getFullYear()));

// Mobile menu
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", open);
    menuToggle.textContent = open ? "✕" : "☰";
  });
}

// Scroll reveal, staggered for items that appear together
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries
      .filter((e) => e.isIntersecting)
      .forEach((entry, i) => {
        entry.target.style.transitionDelay = `${i * 80}ms`;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
  },
  { threshold: 0.12 }
);
// Also called by nav.js for page content that's swapped in
function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.visible)").forEach((el) => revealObserver.observe(el));
}
observeReveals();

// Background glow: soft colors in Kick green, Twitch purple and YouTube red (styles.css .ambient).
// Added once; nav.js only swaps <main>, so it stays while moving around the site.
if (!document.querySelector(".ambient")) {
  const ambient = document.createElement("div");
  ambient.className = "ambient";
  ambient.setAttribute("aria-hidden", "true");
  document.body.prepend(ambient);
}

// Sinners-styled pop-ups in place of the browser's confirm() / alert() boxes.
//   await SinnersDialog.confirm("Text", { title, yes, no, icon, danger })  -> true / false
//   await SinnersDialog.alert("Text", { title, icon })
const SinnersDialog = (() => {
  let open = null;

  function show(message, { title = "", yes = "Yes", no = "Cancel", icon = "", danger = false, alertOnly = false } = {}) {
    if (open) open(false); // only one at a time
    return new Promise((resolve) => {
      const lastFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "dialog-overlay";
      const box = document.createElement("div");
      box.className = "dialog-box";
      box.setAttribute("role", alertOnly ? "alertdialog" : "dialog");
      box.setAttribute("aria-modal", "true");
      if (icon) box.append(Object.assign(document.createElement("div"), { className: "dialog-icon", textContent: icon }));
      if (title) {
        const h = Object.assign(document.createElement("h2"), { className: "dialog-title", textContent: title, id: "dialog-title" });
        box.setAttribute("aria-labelledby", "dialog-title");
        box.append(h);
      }
      box.append(Object.assign(document.createElement("p"), { className: "dialog-text", textContent: message }));
      const actions = document.createElement("div");
      actions.className = "dialog-actions";
      const ok = Object.assign(document.createElement("button"), { type: "button", className: "button" + (danger ? " danger" : ""), textContent: alertOnly ? "OK" : yes });
      if (!alertOnly) {
        const cancel = Object.assign(document.createElement("button"), { type: "button", className: "button ghost", textContent: no });
        cancel.addEventListener("click", () => close(false));
        actions.append(cancel);
      }
      ok.addEventListener("click", () => close(true));
      actions.append(ok);
      box.append(actions);
      overlay.append(box);

      function close(answer) {
        if (!overlay.isConnected) return;
        document.removeEventListener("keydown", onKey, true);
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 150);
        open = null;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        resolve(alertOnly ? undefined : answer);
      }
      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          close(false);
        } else if (e.key === "Tab") {
          // keep focus inside the dialog
          const buttons = [...actions.querySelectorAll("button")];
          const i = buttons.indexOf(document.activeElement);
          e.preventDefault();
          buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        }
      }
      overlay.addEventListener("click", (e) => e.target === overlay && close(false));
      document.addEventListener("keydown", onKey, true);
      open = close;
      document.body.append(overlay);
      void overlay.offsetWidth; // apply the start state, so the fade-in runs
      overlay.classList.add("show");
      ok.focus();
    });
  }

  return {
    confirm: (message, options) => show(message, options),
    alert: (message, options) => show(message, { ...options, alertOnly: true }),
  };
})();
