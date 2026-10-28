// Home page: quick start (pick a platform, type a streamer, go to Watch), community numbers,
// this week's world boss (live HP), last week's Clip of the Week, and the guide's tabs.

const API = WORKER_URL.replace(/\/$/, "");
const strip = document.getElementById("boss-strip");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function loadBoss() {
  try {
    const res = await fetch(`${API}/boss`);
    if (!res.ok) return;
    const { boss: b, fighters } = await res.json();
    const pct = Math.max(0, (b.hpLeft / b.hpMax) * 100);
    const bar = el("div", "boss-hp");
    const fill = el("span");
    fill.style.width = `${pct}%`;
    bar.append(fill);
    const hours = Math.max(0, (b.endsAt - Date.now()) / 3600000);
    const left = hours < 48 ? `${Math.ceil(hours)} h left` : `${Math.floor(hours / 24)} days left`;
    const text = el("div", "boss-strip-text");
    text.append(
      el("strong", null, b.defeatedAt ? `${b.name} has fallen!` : `This week's boss: ${b.name}`),
      el("span", "hint", b.defeatedAt ? `${fighters} fighters took it down. Claim your rewards on your Profile.` : `${b.hpLeft.toLocaleString()} / ${b.hpMax.toLocaleString()} HP · ${fighters} fighters · ${left}`),
      bar
    );
    strip.replaceChildren(el("span", "boss-strip-emoji", b.emoji), text, el("span", "button", b.defeatedAt ? "🎁 Rewards" : "⚔️ Fight"));
    strip.classList.toggle("defeated", !!b.defeatedAt);
    document.getElementById("boss-strip-section").hidden = false;
  } catch (e) {}
}

// ---------- Clip of the Week ----------
async function loadClip() {
  try {
    const res = await fetch(`${API}/gallery/votes`);
    if (!res.ok) return;
    const { winner: w } = await res.json();
    if (!w) return;
    const card = document.getElementById("cotw-home");
    const thumb = el("span", "cotw-thumb");
    if (w.thumb) {
      const img = el("img");
      img.src = w.thumb;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      thumb.append(img);
    } else thumb.append("🎬");
    const text = el("div", "boss-strip-text");
    text.append(el("strong", null, `🏆 Clip of the Week: ${w.title || "Untitled clip"}`), el("span", "hint", `${w.name ? `Shared by ${w.name} · ` : ""}${w.votes} vote${w.votes === 1 ? "" : "s"} · vote for this week's in the Gallery`));
    card.replaceChildren(thumb, text, el("span", "button ghost", "▶ Watch"));
    card.hidden = false;
    document.getElementById("boss-strip-section").hidden = false;
  } catch (e) {}
}

// ---------- Quick start ----------
const quick = document.getElementById("quick-watch");
let quickPlatform = "kick";
quick.querySelectorAll("[data-platform]").forEach((b) =>
  b.addEventListener("click", () => {
    quickPlatform = b.dataset.platform;
    quick.querySelectorAll("[data-platform]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("qw-name").placeholder = quickPlatform === "youtube" ? "Channel name, @handle or link" : "Streamer name or link";
    document.getElementById("qw-name").focus();
  })
);
quick.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("qw-name").value.trim();
  if (!name) return;
  SinnersNav.go(`${location.origin}/watch?platform=${quickPlatform}&add=${encodeURIComponent(name)}`);
});

// ---------- Community numbers ----------
async function loadNumbers() {
  try {
    const res = await fetch(`${API}/stats`);
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, n) => (document.getElementById(id).textContent = Number(n || 0).toLocaleString());
    set("home-online", s.online);
    set("home-today", s.today && s.today.visitors);
    set("home-players", s.community && s.community.players);
  } catch (e) {}
}

// ---------- Guide tabs ----------
document.querySelectorAll("#guide-tabs [data-guide]").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll("#guide-tabs [data-guide]").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab);
    });
    document.querySelectorAll("[data-guide-panel]").forEach((p) => (p.hidden = p.dataset.guidePanel !== tab.dataset.guide));
  })
);

loadBoss();
loadClip();
loadNumbers();
const timer = setInterval(() => !document.hidden && loadBoss(), 60000);
SinnersNav.onLeave(() => clearInterval(timer));
