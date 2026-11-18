// Notification bell in the header: one place for what's waiting for you.
//   - streamers you follow going live (🔔 alerts from the Watch page and your squad on Home)
//   - logged in: a dungeon floor ready to fight or won, skill points to spend, a class to pick,
//     the daily streak and finished quests to claim, world boss rewards
// Checked when the page opens and every 2 minutes while it's visible. Opening the bell marks
// everything as seen; a red count shows what's new since.

const SinnersNotify = (() => {
  const API = WORKER_URL.replace(/\/$/, "");
  const SEEN_KEY = "sinners-notify-seen";
  const EVERY_MS = 120000;
  let notes = [];
  let seen = new Set();
  try {
    seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch (e) {}

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const readJson = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  };

  // Everyone this visitor follows: Watch page alerts and the Home squad
  function followed() {
    const out = new Map();
    readJson("sinners-live-alerts").forEach((a) => a && a.platform && a.channel && out.set(`${a.platform}:${a.channel}`, { platform: a.platform, name: a.channel, label: a.label || a.channel }));
    readJson("sinners-squad").forEach((s) => s && s.platform && s.name && out.set(`${s.platform}:${s.name}`, { platform: s.platform, name: s.name, label: s.name.replace(/^@/, "") }));
    return [...out.values()].slice(0, 24);
  }

  async function liveNotes() {
    const list = followed();
    if (!list.length) return [];
    const res = await fetch(`${API}/live?ch=${list.map((s) => encodeURIComponent(`${s.platform}:${s.name}`)).join(",")}`);
    if (!res.ok) return [];
    const data = await res.json();
    return list
      .filter((s) => data[`${s.platform}:${s.name}`] && data[`${s.platform}:${s.name}`].live)
      .map((s) => {
        const info = data[`${s.platform}:${s.name}`];
        return {
          id: `live:${s.platform}:${s.name}:${info.id || info.title || ""}`,
          icon: "🔴",
          title: `${s.label} is live`,
          text: info.title || `Live now on ${s.platform === "youtube" ? "YouTube" : s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}`,
          url: `/watch?platform=${s.platform}&add=${encodeURIComponent(s.name)}`,
          live: true,
        };
      });
  }

  async function accountNotes() {
    if (typeof SinnersAuth === "undefined" || !SinnersAuth.token) return [];
    const get = (path) =>
      fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${SinnersAuth.token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const [hero, daily, boss] = await Promise.all([get("/hero"), get("/daily"), get("/boss")]);
    const out = [];
    if (hero) {
      const run = hero.run;
      const d = run && hero.dungeons.find((x) => x.id === run.dungeon);
      if (run && run.wait)
        out.push({ id: `run:${run.dungeon}:${run.floor}:wait`, icon: "🏆", title: `Floor ${run.floor} of ${d.name} cleared`, text: "Go deeper, or retreat with your loot", url: "/profile#world-map" });
      else if (run && Date.now() >= run.end)
        out.push({ id: `run:${run.dungeon}:${run.floor}:ready`, icon: "⚔️", title: `Floor ${run.floor} of ${d.name} is ready`, text: `Fight the ${run.monster.name}`, url: "/profile#world-map" });
      if (!hero.hero.cls && hero.hero.level >= hero.classLevel)
        out.push({ id: "class:pick", icon: "🔮", title: "Pick your class", text: "Warrior, Rogue or Mage, with 3 skills each", url: "/profile#skills" });
      else if (hero.hero.cls && hero.hero.skillPoints > 0)
        out.push({ id: `skill:${hero.hero.level}`, icon: "✨", title: `${hero.hero.skillPoints} skill point${hero.hero.skillPoints === 1 ? "" : "s"} to spend`, text: "Rank up your skills", url: "/profile#skills" });
    }
    if (daily) {
      if (daily.streak && daily.streak.hasHero && !daily.streak.claimedToday)
        out.push({ id: `streak:${daily.day}`, icon: "🔥", title: `Day ${daily.streak.day} streak reward`, text: "Claim it on your Profile", url: "/profile#daily" });
      const done = (daily.quests || []).filter((q) => q.done && !q.claimed);
      if (done.length)
        out.push({ id: `quests:${daily.day}:${done.map((q) => q.index).join("")}`, icon: "📋", title: `${done.length} quest${done.length === 1 ? "" : "s"} done`, text: "Claim the coins and XP", url: "/profile#daily" });
    }
    if (boss && boss.me && (boss.me.canClaim || boss.me.lastWeek))
      out.push({ id: `boss:${boss.me.lastWeek || boss.boss.week}`, icon: "👹", title: "World boss rewards are waiting", text: "Open your chest on the Profile", url: "/profile#boss" });
    return out;
  }

  // ---------- The bell ----------
  const bell = el("button", "icon-action notify-btn");
  bell.type = "button";
  bell.setAttribute("aria-haspopup", "true");
  bell.setAttribute("aria-expanded", "false");
  const badge = el("span", "notify-count");
  badge.hidden = true;
  bell.append(el("span", "notify-icon", "🔔"), badge);
  const panel = el("div", "notify-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Notifications");
  const wrap = el("div", "notify-wrap");
  wrap.append(bell, panel);
  const actions = document.getElementById("nav-actions");
  if (actions) actions.prepend(wrap);

  function label() {
    const fresh = notes.filter((n) => !seen.has(n.id)).length;
    badge.hidden = !fresh;
    badge.textContent = fresh > 9 ? "9+" : String(fresh);
    bell.title = fresh ? `${fresh} new notification${fresh === 1 ? "" : "s"}` : "Notifications";
    bell.setAttribute("aria-label", bell.title);
    bell.classList.toggle("has-new", !!fresh);
  }

  function renderPanel() {
    const head = el("div", "notify-head");
    head.append(el("strong", null, "Notifications"));
    const body = el("div", "notify-list");
    if (!notes.length) {
      const empty = el("div", "notify-empty");
      empty.append(
        el("span", "notify-empty-icon", "🔔"),
        el("strong", null, "All caught up"),
        el("span", null, typeof SinnersAuth !== "undefined" && SinnersAuth.user ? "Turn on 🔔 for streamers on the Watch page to hear when they go live." : "Log in to see your adventure here. Turn on 🔔 for streamers on Watch to hear when they go live.")
      );
      body.append(empty);
    }
    notes.forEach((n) => {
      const a = el("a", "notify-item" + (seen.has(n.id) ? "" : " new") + (n.live ? " live" : ""));
      a.href = n.url;
      const text = el("span", "notify-text");
      text.append(el("strong", null, n.title), el("span", null, n.text));
      const icon = el("span", "notify-item-icon", n.live ? null : n.icon);
      if (n.live) icon.append(el("span", "notify-live-dot"));
      a.append(icon, text);
      a.addEventListener("click", close);
      body.append(a);
    });
    panel.replaceChildren(head, body);
  }

  function markSeen() {
    notes.forEach((n) => seen.add(n.id));
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-80)));
    } catch (e) {}
    label();
  }

  function open() {
    renderPanel();
    panel.hidden = false;
    bell.setAttribute("aria-expanded", "true");
    setTimeout(markSeen, 600);
  }

  function close() {
    panel.hidden = true;
    bell.setAttribute("aria-expanded", "false");
    renderPanel();
  }

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });
  document.addEventListener("click", (e) => !panel.hidden && !wrap.contains(e.target) && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && !panel.hidden && (close(), bell.focus()));

  let busy = false;
  let lastAt = 0;
  async function refresh(force) {
    if (busy || document.hidden || (!force && Date.now() - lastAt < 30000)) return;
    busy = true;
    lastAt = Date.now();
    try {
      const [live, mine] = await Promise.all([liveNotes().catch(() => []), accountNotes().catch(() => [])]);
      notes = [...live, ...mine];
      label();
      if (!panel.hidden) renderPanel();
    } finally {
      busy = false;
    }
  }

  setTimeout(() => refresh(true), 2500);
  setInterval(() => refresh(true), EVERY_MS);
  document.addEventListener("visibilitychange", () => !document.hidden && refresh());
  document.addEventListener("sinners:page", () => setTimeout(refresh, 1500));
  if (typeof SinnersAuth !== "undefined" && SinnersAuth.onChange) SinnersAuth.onChange(() => setTimeout(() => refresh(true), 500));

  return { refresh };
})();
