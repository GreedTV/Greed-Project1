// Mini player: shrinks a player box into a small floating window (bottom-right by default)
// that can be dragged anywhere, restored, or closed — like YouTube's mini player.
//
// The player itself never moves in the page (moving an iframe would restart the video);
// it just switches to position: fixed, and a placeholder keeps its spot in the layout.
//
// const mini = makeMinimizable(box, { title: () => "Name", onClose: () => {} });
// mini.minimize(); mini.restore(); mini.isMini();

const MINI_POS_KEY = "sinners-mini-pos";
const MINI_MARGIN = 16;

const SinnersMini = {
  all: new Set(),
  // Put back every mini player inside this page content (used when navigating back to it)
  restoreIn(root) {
    this.all.forEach((m) => {
      if (!m.box.isConnected) this.all.delete(m);
      else if (root.contains(m.box)) m.restore();
    });
  },
};

function makeMinimizable(box, { title = () => "", onClose = () => {} } = {}) {
  let placeholder = null;

  const bar = document.createElement("div");
  bar.className = "mini-bar";
  const label = document.createElement("span");
  label.className = "mini-title";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.textContent = "⤢";
  restoreBtn.title = "Back to the page";
  restoreBtn.setAttribute("aria-label", "Back to the page");
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close mini player");
  bar.append(label, restoreBtn, closeBtn);
  box.append(bar);

  function clampTo(left, top) {
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    return [
      Math.min(Math.max(MINI_MARGIN, left), window.innerWidth - w - MINI_MARGIN),
      Math.min(Math.max(MINI_MARGIN, top), window.innerHeight - h - MINI_MARGIN),
    ];
  }

  // Position on screen (offsetLeft isn't reliable for fixed elements)
  const pos = () => {
    const r = box.getBoundingClientRect();
    return [r.left, r.top];
  };

  function place(left, top) {
    [left, top] = clampTo(left, top);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function minimize() {
    if (placeholder) return;
    placeholder = document.createElement("button");
    placeholder.type = "button";
    placeholder.className = "mini-placeholder";
    placeholder.style.height = `${box.offsetHeight}px`;
    placeholder.textContent = "▶ Playing in mini player · Restore";
    placeholder.addEventListener("click", restore);
    box.before(placeholder);

    label.textContent = title();
    // Players that rebuild their box (e.g. when a video loads) can drop the bar
    if (bar.parentNode !== box) box.append(bar);
    box.classList.add("mini");
    // Last spot the visitor dragged it to, or the bottom-right corner
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(MINI_POS_KEY));
    } catch (e) {}
    if (saved && Number.isFinite(saved.left)) place(saved.left, saved.top);
    else place(window.innerWidth, window.innerHeight);
  }

  function restore() {
    if (!placeholder) return;
    placeholder.remove();
    placeholder = null;
    box.classList.remove("mini", "dragging");
    box.style.left = box.style.top = "";
  }

  // Dragging by the top bar
  bar.addEventListener("pointerdown", (e) => {
    if (!box.classList.contains("mini") || e.target.closest("button")) return;
    e.preventDefault();
    const [boxLeft, boxTop] = pos();
    const startX = e.clientX - boxLeft;
    const startY = e.clientY - boxTop;
    box.classList.add("dragging"); // lets the pointer pass over the video while dragging

    // Follow the pointer anywhere on the page until it's released
    const move = (ev) => place(ev.clientX - startX, ev.clientY - startY);
    const end = () => {
      box.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      try {
        const [left, top] = pos();
        localStorage.setItem(MINI_POS_KEY, JSON.stringify({ left, top }));
      } catch (err) {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });

  window.addEventListener("resize", () => box.classList.contains("mini") && place(...pos()));
  // On another section of the site, "back to the page" means going back to that page
  restoreBtn.addEventListener("click", () => {
    if (box.closest(".page-parked") && typeof SinnersNav !== "undefined") SinnersNav.goToParked();
    else restore();
  });
  closeBtn.addEventListener("click", () => {
    restore();
    onClose();
    document.dispatchEvent(new CustomEvent("sinners:mini-closed"));
  });

  const api = { box, minimize, restore, isMini: () => !!placeholder };
  SinnersMini.all.add(api);
  return api;
}
