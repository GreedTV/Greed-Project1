// Home page: the streamer stage and this week's world boss.
// Featured streamers and the viewer's own squad (up to 10, saved in this browser) float over the stage as
// their channel picture, with effects that fit them; clicking one opens their stream on the Watch page.
// Live status and channel pictures come from the Worker (/live); pictures are remembered for next time.

const API = WORKER_URL.replace(/\/$/, "");
const strip = document.getElementById("boss-strip");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ---------- Streamers ----------
// color: their glow; fx: the effect around their picture (frost, speed, bolt, glitch, gold, aim, cash, fire,
// smoke, confetti; spark for anyone else)
// picture: their channel picture, so it shows before the Worker answers (the Worker's newer one replaces it)
const FEATURED = [
  {
    platform: "kick",
    name: "lexor2k",
    label: "Lexor2k",
    color: "#22d3ee",
    fx: "frost",
    picture: "https://files.kick.com/images/user/32870913/profile_image/conversion/9c1f9140-d07a-493c-8c51-baaedf9982d6-fullsize.webp",
  },
  {
    platform: "youtube",
    name: "@IShowSpeed",
    label: "IShowSpeed",
    color: "#ff2a3d",
    fx: "speed",
    picture: "https://yt3.googleusercontent.com/ieK0j0sDqI_AHDwYxZ2Wly07-R7PG4S3YMtxOWCEe1QH-I0FgimJ92tlydQa6M78YD0VaywCaw=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    platform: "twitch",
    name: "caseoh_",
    label: "CaseOh",
    color: "#a855f7",
    fx: "bolt",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/ef28ba12-c8ed-46d4-838b-a4c95ef5b469-profile_image-300x300.png",
  },
  {
    platform: "kick",
    name: "xqc",
    label: "xQc",
    color: "#53fc18",
    fx: "glitch",
    picture: "https://files.kick.com/images/user/676/profile_image/conversion/931b4e8f-5445-427c-bd82-b473530390cc-fullsize.webp",
  },
  {
    platform: "twitch",
    name: "ohnepixel",
    label: "ohnePixel",
    color: "#f5b70a",
    fx: "gold",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/5742b015-e6ed-4f7c-a1dd-87cd88fe1eb9-profile_image-300x300.png",
  },
  {
    platform: "twitch",
    name: "tenz",
    label: "TenZ",
    color: "#ff4655",
    fx: "aim",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/dfb5c790-5ea6-4543-bc2b-0f5f79b1f959-profile_image-300x300.png",
  },
  {
    platform: "kick",
    name: "adinross",
    label: "Adin Ross",
    color: "#4ade80",
    fx: "cash",
    picture: "https://files.kick.com/images/user/904404/profile_image/conversion/e344be03-aff2-4791-ae5a-22a9ac4cf89a-fullsize.webp",
  },
  {
    platform: "twitch",
    name: "jynxzi",
    label: "Jynxzi",
    color: "#fb923c",
    fx: "fire",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/645d98a0-a2eb-48a3-b687-cfbc55243e4a-profile_image-300x300.png",
  },
  {
    platform: "twitch",
    name: "shroud",
    label: "shroud",
    color: "#cbd5e1",
    fx: "smoke",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/c754eebf-745b-4e0a-814a-10bcaecaabbc-profile_image-300x300.png",
  },
  {
    platform: "youtube",
    name: "@ludwig",
    label: "Ludwig",
    color: "#facc15",
    fx: "confetti",
    picture: "https://yt3.googleusercontent.com/ytc/AIdro_nBvD2_i9JPqMIZoH-3Pct438PAEd1d4rLEd1LCCLEEmKc=s900-c-k-c0x00ffffff-no-rj",
  },
];

const SQUAD_KEY = "sinners-squad";
const AVATAR_KEY = "sinners-avatars";
const SQUAD_SIZE = 10;
const PLATFORMS = {
  kick: { name: "Kick", color: "#53fc18", icon: "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" },
  twitch: { name: "Twitch", color: "#9146ff", icon: "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" },
  youtube: { name: "YouTube", color: "#ff0033", icon: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
};

const keyOf = (s) => `${s.platform}:${s.name}`;

function platformIcon(platform) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", PLATFORMS[platform].icon);
  svg.append(path);
  return svg;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function loadSquad() {
  const list = readJson(SQUAD_KEY, []);
  return Array.isArray(list) ? list.filter((s) => s && PLATFORMS[s.platform] && typeof s.name === "string").slice(0, SQUAD_SIZE) : [];
}

let squad = loadSquad();
const avatars = readJson(AVATAR_KEY, {}); // "kick:name" -> picture URL
const live = {}; // "kick:name" -> { live, viewers, title, avatar }
const figures = new Map(); // "kick:name" -> medallion element

function figure(s, index) {
  const a = el("a", "stage-fig");
  a.href = `/watch?platform=${s.platform}&add=${encodeURIComponent(s.name)}`;
  a.style.setProperty("--brand", PLATFORMS[s.platform].color);
  a.style.setProperty("--glow", s.color || PLATFORMS[s.platform].color);
  a.style.setProperty("--delay", `${(index % 5) * -0.9}s`);
  a.dataset.key = keyOf(s);
  const label = s.label || s.name.replace(/^@/, "");
  a.setAttribute("aria-label", `${label} on ${PLATFORMS[s.platform].name}`);

  const sign = el("span", "streamer-live");
  sign.append(el("b", null, "LIVE"), el("span", "streamer-viewers"));
  a.classList.add(`fx-${s.fx || "spark"}`);
  const mark = el("span", "mark");
  mark.append(effects(s.fx || "spark"));
  const art = el("span", "mark-art");
  // Until a picture arrives: their initials
  art.append(el("span", "mark-initials", label.replace(/[^a-z0-9 ]/gi, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"));
  mark.append(art, el("span", "mark-shadow"));
  const plate = el("span", "streamer-plate");
  plate.append(platformIcon(s.platform), el("span", null, label));
  const status = el("span", "logo-status");
  a.append(sign, mark, plate, status);
  figures.set(keyOf(s), a);
  paintLive(a);
  return a;
}

function compact(n) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
}

// Floating bits around the picture; each effect animates them differently in design.css
function effects(fx) {
  const box = el("span", "mark-fx");
  box.setAttribute("aria-hidden", "true");
  const count = fx === "bolt" ? 6 : 12;
  for (let i = 0; i < count; i++) {
    const bit = el("i");
    bit.style.setProperty("--x", `${Math.round(Math.random() * 100)}%`);
    bit.style.setProperty("--y", `${Math.round(Math.random() * 100)}%`);
    bit.style.setProperty("--d", `${(Math.random() * -4).toFixed(2)}s`);
    bit.style.setProperty("--t", `${(1.6 + Math.random() * 2.4).toFixed(2)}s`);
    box.append(bit);
  }
  if (fx === "bolt") {
    for (let i = 0; i < 2; i++) {
      const bolt = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bolt.setAttribute("viewBox", "0 0 24 48");
      bolt.setAttribute("class", `bolt bolt-${i}`);
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M14 0 4 26h7L6 48 20 18h-7L18 0Z");
      bolt.append(p);
      box.append(bolt);
    }
  }
  return box;
}

function setPicture(a, url) {
  // YouTube pictures come 900px wide; ask for a small one
  if (url) url = url.replace(/(googleusercontent\.com\/[^=]+)=s\d+/, "$1=s240");
  const art = a.querySelector(".mark-art");
  const old = art.querySelector("img");
  if (!url || (old && old.src === url)) return;
  const img = el("img", "mark-logo picture");
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.onload = () => art.replaceChildren(img);
  img.src = url;
}

function paintLive(a) {
  const key = a.dataset.key;
  const info = live[key];
  const on = !!(info && info.live);
  a.classList.toggle("is-live", on);
  a.querySelector(".streamer-viewers").textContent = on && info.viewers ? compact(info.viewers) : "";
  a.querySelector(".logo-status").textContent = on ? info.title || "Live now" : info ? "Offline" : "";
  a.title = on && info.title ? info.title : "";
  const featured = FEATURED.find((s) => keyOf(s) === key);
  setPicture(a, (info && info.avatar) || avatars[key] || (featured && featured.picture));
}

// ---------- Featured ----------
const featuredStage = document.getElementById("stage-featured");
const featuredRow = el("div", "stage-row");
FEATURED.forEach((s, i) => featuredRow.append(figure(s, i)));
featuredStage.append(skyline(), featuredRow);

// ---------- Your squad ----------
const squadStage = document.getElementById("stage-squad");

function renderSquad() {
  figures.forEach((a, key) => !FEATURED.some((s) => keyOf(s) === key) && figures.delete(key));
  const row = el("div", "stage-row");
  squad.forEach((s, i) => {
    const slot = el("div", "squad-slot");
    const remove = el("button", "squad-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${s.name}`);
    remove.addEventListener("click", () => {
      squad = squad.filter((x) => keyOf(x) !== keyOf(s));
      writeJson(SQUAD_KEY, squad);
      renderSquad();
    });
    slot.append(figure(s, i + 2), remove);
    row.append(slot);
  });
  for (let i = squad.length; i < SQUAD_SIZE; i++) row.append(emptySlot());
  squadStage.replaceChildren(row);
}

function emptySlot() {
  const slot = el("button", "squad-slot empty");
  slot.type = "button";
  slot.append(el("span", "mark-empty", "+"), el("span", "streamer-plate", "Add streamer"));
  slot.addEventListener("click", () => openForm(slot));
  return slot;
}

// "kick.com/name", "twitch.tv/name", "youtube.com/@name" or a plain name with the chosen platform
function parseStreamer(text, platform) {
  text = text.trim();
  const link = text.match(/(kick\.com|twitch\.tv|youtube\.com)\/(@?[\w.-]+)/i);
  if (link) {
    platform = { "kick.com": "kick", "twitch.tv": "twitch", "youtube.com": "youtube" }[link[1].toLowerCase()];
    text = link[2];
  }
  if (platform === "youtube" && !text.startsWith("@") && !/^UC[\w-]{22}$/.test(text)) text = `@${text.replace(/\s+/g, "")}`;
  if (platform !== "youtube") text = text.replace(/^@/, "").toLowerCase();
  return /^@?[\w.-]{2,40}$/.test(text) ? { platform, name: text } : null;
}

function openForm(slot) {
  squadStage.querySelectorAll(".squad-form").forEach((f) => f.replaceWith(emptySlot()));
  const box = el("div", "squad-slot squad-form");
  const form = el("form");
  let platform = "kick";
  const picks = el("div", "squad-platforms");
  const input = el("input");
  Object.keys(PLATFORMS).forEach((p) => {
    const b = el("button", `squad-platform ${p}`);
    b.type = "button";
    b.setAttribute("aria-pressed", String(p === platform));
    b.setAttribute("aria-label", PLATFORMS[p].name);
    b.style.setProperty("--brand", PLATFORMS[p].color);
    b.append(platformIcon(p));
    b.addEventListener("click", () => {
      platform = p;
      picks.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      input.focus();
    });
    picks.append(b);
  });
  input.placeholder = "Name or link";
  input.autocomplete = "off";
  input.maxLength = 120;
  const msg = el("span", "squad-msg");
  const add = el("button", "button", "Add");
  add.type = "submit";
  const cancel = el("button", "squad-cancel", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", renderSquad);
  form.append(picks, input, add, cancel, msg);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const s = parseStreamer(input.value, platform);
    if (!s) return (msg.textContent = "Type their channel name.");
    if ([...squad, ...FEATURED].some((x) => keyOf(x).toLowerCase() === keyOf(s).toLowerCase())) return (msg.textContent = "Already on the stage.");
    squad.push(s);
    writeJson(SQUAD_KEY, squad);
    renderSquad();
    checkLive();
  });
  box.append(form);
  slot.replaceWith(box);
  input.focus();
}

renderSquad();

// ---------- Live status and pictures ----------
async function checkLive() {
  const keys = [...figures.keys()];
  if (!keys.length) return;
  try {
    const res = await fetch(`${API}/live?ch=${keys.map(encodeURIComponent).join(",")}`);
    if (!res.ok) return;
    Object.assign(live, await res.json());
    Object.entries(live).forEach(([key, info]) => info.avatar && (avatars[key] = info.avatar));
    writeJson(AVATAR_KEY, avatars);
    figures.forEach(paintLive);
  } catch (e) {}
}

// ---------- The city behind the stage ----------
// A night skyline with lit windows, the same every visit
function skyline() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "stage-city");
  svg.setAttribute("viewBox", "0 0 320 60");
  svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rect = (x, y, w, h, cls) => {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", h);
    r.setAttribute("class", cls);
    svg.append(r);
  };
  for (let layer = 0; layer < 2; layer++) {
    for (let x = layer * 6 - 4; x < 320; ) {
      const w = 10 + Math.floor(rand() * 16);
      const h = (layer ? 14 : 24) + Math.floor(rand() * (layer ? 22 : 30));
      rect(x, 60 - h, w, h, layer ? "b2" : "b1");
      if (layer) {
        for (let wy = 60 - h + 3; wy < 57; wy += 4)
          for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.28) rect(wx, wy, 1, 2, rand() < 0.15 ? "win2" : "win");
        if (rand() < 0.3) rect(x + Math.floor(w / 2), 60 - h - 4, 1, 4, "b2");
      }
      x += w + (layer ? 3 : 1);
    }
  }
  return svg;
}

// ---------- World boss ----------
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

loadBoss();
checkLive();
const bossTimer = setInterval(() => !document.hidden && loadBoss(), 60000);
const liveTimer = setInterval(() => !document.hidden && checkLive(), 120000);
SinnersNav.onLeave(() => {
  clearInterval(bossTimer);
  clearInterval(liveTimer);
});
