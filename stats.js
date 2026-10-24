// Stats page: live visitor numbers and community activity from the Worker's /stats.

const API = WORKER_URL.replace(/\/$/, "");
const PAGE_NAMES = {
  index: "Home",
  watch: "Watch",
  content: "Content",
  games: "Games",
  gallery: "Gallery",
  about: "About",
  stats: "Stats",
  terms: "Terms",
  privacy: "Privacy",
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const fmt = (n) => Number(n || 0).toLocaleString();
const dayLabel = (day, short) => new Date(day + "T12:00:00Z").toLocaleDateString(undefined, short ? { weekday: "short" } : { weekday: "long", month: "short", day: "numeric" });

function tile(label, value, note, live) {
  const box = el("div", "stat-tile" + (live ? " live" : ""));
  const head = el("span", "stat-label");
  if (live) head.append(el("span", "live-dot"));
  head.append(label);
  box.append(head, el("strong", "stat-value", fmt(value)));
  if (note) box.append(el("span", "stat-note", note));
  return box;
}

function renderTiles(s) {
  document.getElementById("stat-tiles").replaceChildren(
    tile("Online now", s.online, `peak today: ${fmt(Math.max(s.today.peak || 0, s.online))}`, true),
    tile("Visitors today", s.today.visitors, `${fmt(s.today.views)} page views`),
    tile("Visitors this week", s.weekTotals.visitors, `${fmt(s.weekTotals.views)} page views`),
    tile("All-time visitors", s.allTime.visitors, s.allTime.since ? `since ${dayLabel(s.allTime.since)}` : "counting starts now")
  );
}

// One series (visitors), so no legend: the card title names it. Views are in the tooltip and the table.
function renderChart(week) {
  const chart = document.getElementById("week-chart");
  const peak = Math.max(1, ...week.map((d) => d.visitors));
  chart.setAttribute("aria-label", "Visitors per day: " + week.map((d) => `${dayLabel(d.day, true)} ${d.visitors}`).join(", "));
  chart.replaceChildren(
    ...week.map((d, i) => {
      const col = el("div", "week-col" + (i === week.length - 1 ? " today" : ""));
      col.tabIndex = 0;
      const plot = el("div", "week-plot");
      const bar = el("div", "week-bar");
      bar.style.height = `${(d.visitors / peak) * 100}%`;
      plot.append(bar);
      const tip = el("div", "week-tip");
      tip.append(el("strong", null, dayLabel(d.day)), el("span", null, `${fmt(d.visitors)} visitors`), el("span", null, `${fmt(d.views)} page views`));
      col.append(el("span", "week-value", fmt(d.visitors)), plot, el("span", "week-day", i === week.length - 1 ? "Today" : dayLabel(d.day, true)), tip);
      return col;
    })
  );
  const table = document.getElementById("week-table");
  const head = el("tr");
  ["Day", "Visitors", "Page views"].forEach((h) => head.append(el("th", null, h)));
  table.replaceChildren(
    head,
    ...week.map((d) => {
      const tr = el("tr");
      tr.append(el("td", null, dayLabel(d.day)), el("td", null, fmt(d.visitors)), el("td", null, fmt(d.views)));
      return tr;
    })
  );
}

function renderList(id, rows, empty) {
  const list = document.getElementById(id);
  if (!rows.length) return list.replaceChildren(el("li", "stat-empty", empty));
  const peak = Math.max(...rows.map((r) => r[1]));
  list.replaceChildren(
    ...rows.map(([page, n]) => {
      const li = el("li");
      const track = el("span", "stat-track");
      const fill = el("span", "stat-fill");
      fill.style.width = `${(n / peak) * 100}%`;
      track.append(fill);
      li.append(el("span", "stat-name", PAGE_NAMES[page] || page), track, el("span", "stat-num", fmt(n)));
      return li;
    })
  );
}

function renderCommunity(c) {
  const items = [
    ["🎮", "Players", c.players],
    ["🪙", "Points in total", c.pointsTotal],
    ["💬", "Chat messages", c.chatMessages, `${fmt(c.chatToday)} today`],
    ["🏆", "Leaderboard scores", c.gamesPlayed],
    ["🎨", "Bets today", c.betsToday],
    ["🛒", "Shop purchases", c.purchases],
    ["🖼️", "Gallery posts", c.galleryItems],
  ];
  document.getElementById("community").replaceChildren(
    ...items.map(([icon, label, value, note]) => {
      const box = el("div", "community-item");
      box.append(el("span", "community-icon", icon), el("strong", null, fmt(value)), el("span", null, label));
      if (note) box.append(el("small", null, note));
      return box;
    })
  );
}

async function load() {
  try {
    const res = await fetch(`${API}/stats`);
    const s = await res.json();
    if (!res.ok) throw new Error(s.error);
    renderTiles(s);
    renderChart(s.week);
    renderList(
      "online-pages",
      Object.entries(s.pages).filter(([p]) => p !== "admin").sort((a, b) => b[1] - a[1]),
      "Nobody else right now."
    );
    renderList("top-pages", s.topPages.filter((p) => p.page !== "admin").map((p) => [p.page, p.views]), "No views yet today.");
    renderCommunity(s.community);
  } catch (e) {
    document.getElementById("stat-tiles").replaceChildren(el("p", "stat-empty", "Stats are unavailable right now."));
  }
}

load();
const timer = setInterval(() => !document.hidden && load(), 30000);
// The header's live count updates more often; keep the tile in step
const onOnline = (e) => {
  const value = document.querySelector(".stat-tile.live .stat-value");
  if (value) value.textContent = fmt(e.detail);
};
document.addEventListener("sinners:online", onOnline);

SinnersNav.onLeave(() => {
  clearInterval(timer);
  document.removeEventListener("sinners:online", onOnline);
});
