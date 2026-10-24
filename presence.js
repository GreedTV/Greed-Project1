// Live visitor count, shared by all pages: tells the Worker this tab is open (once a minute, only while
// visible) and counts one view per page opened. The visitor ID is random and stays in this browser;
// nothing else about the visitor is sent. Shows "🟢 N online" in the header, linking to the Stats page.

(() => {
  const API = WORKER_URL.replace(/\/$/, "");
  const KEY = "sinners-visitor";
  const EVERY_MS = 60000;

  let visitor = "";
  try {
    visitor = localStorage.getItem(KEY) || "";
    if (!/^[a-f0-9-]{36}$/.test(visitor)) {
      visitor = crypto.randomUUID();
      localStorage.setItem(KEY, visitor);
    }
  } catch (e) {
    visitor = crypto.randomUUID(); // storage blocked: counts as a new visitor each time
  }

  const pill = document.createElement("a");
  pill.className = "online-pill";
  pill.href = "/stats";
  pill.title = "People on Sinners right now";
  pill.hidden = true;
  const count = document.createElement("span");
  const label = document.createElement("span");
  label.className = "online-label";
  label.textContent = " online";
  pill.append(count, label);
  const actions = document.getElementById("nav-actions");
  if (actions) actions.prepend(pill);

  const page = () => location.pathname.split("/").pop().replace(/\.html$/, "") || "index";
  let lastSent = 0;

  async function beat(view = false) {
    if (document.hidden && !view) return;
    lastSent = Date.now();
    try {
      const res = await fetch(`${API}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor, page: page(), view }),
        keepalive: true,
      });
      const data = await res.json();
      if (!res.ok) return;
      count.textContent = data.online;
      pill.hidden = false;
      document.dispatchEvent(new CustomEvent("sinners:online", { detail: data.online }));
    } catch (e) {}
  }

  beat(true);
  setInterval(beat, EVERY_MS);
  // Back to the tab after a while: say hello right away instead of waiting for the next minute
  document.addEventListener("visibilitychange", () => !document.hidden && Date.now() - lastSent > EVERY_MS / 2 && beat());
  // In-site navigation (nav.js) opened another page
  document.addEventListener("sinners:page", () => beat(true));
})();
