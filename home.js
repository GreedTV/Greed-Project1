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
// smoke, confetti; spark for anyone else); deco: drawings on the picture's edge (see DECO)
// picture: their channel picture, so it shows before the Worker answers (the Worker's newer one replaces it)
const FEATURED = [
  {
    platform: "kick",
    name: "lexor2k",
    label: "Lexor2k",
    color: "#22d3ee",
    fx: "frost",
    deco: [["ak", "bottom"], ["helmet", "tr"]],
    picture: "https://files.kick.com/images/user/32870913/profile_image/conversion/9c1f9140-d07a-493c-8c51-baaedf9982d6-fullsize.webp",
  },
  {
    platform: "youtube",
    name: "@IShowSpeed",
    label: "IShowSpeed",
    color: "#ff2a3d",
    fx: "speed",
    deco: [["ball", "br"]],
    picture: "https://yt3.googleusercontent.com/ieK0j0sDqI_AHDwYxZ2Wly07-R7PG4S3YMtxOWCEe1QH-I0FgimJ92tlydQa6M78YD0VaywCaw=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    platform: "twitch",
    name: "caseoh_",
    label: "CaseOh",
    color: "#a855f7",
    fx: "bolt",
    deco: [["pad", "br"]],
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/ef28ba12-c8ed-46d4-838b-a4c95ef5b469-profile_image-300x300.png",
  },
  {
    platform: "kick",
    name: "xqc",
    label: "xQc",
    color: "#53fc18",
    fx: "glitch",
    deco: [["headset", "top"]],
    picture: "https://files.kick.com/images/user/676/profile_image/conversion/931b4e8f-5445-427c-bd82-b473530390cc-fullsize.webp",
  },
  {
    platform: "twitch",
    name: "ohnepixel",
    label: "ohnePixel",
    color: "#f5b70a",
    fx: "gold",
    deco: [["knife", "br"]],
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/5742b015-e6ed-4f7c-a1dd-87cd88fe1eb9-profile_image-300x300.png",
  },
  {
    platform: "twitch",
    name: "tenz",
    label: "TenZ",
    color: "#ff4655",
    fx: "aim",
    deco: [["mouse", "br"]],
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/dfb5c790-5ea6-4543-bc2b-0f5f79b1f959-profile_image-300x300.png",
  },
  {
    platform: "kick",
    name: "adinross",
    label: "Adin Ross",
    color: "#4ade80",
    fx: "cash",
    deco: [["crown", "tr"]],
    picture: "https://files.kick.com/images/user/904404/profile_image/conversion/e344be03-aff2-4791-ae5a-22a9ac4cf89a-fullsize.webp",
  },
  {
    platform: "twitch",
    name: "jynxzi",
    label: "Jynxzi",
    color: "#fb923c",
    fx: "fire",
    deco: [["grenade", "br"]],
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/645d98a0-a2eb-48a3-b687-cfbc55243e4a-profile_image-300x300.png",
  },
  {
    platform: "twitch",
    name: "shroud",
    label: "shroud",
    color: "#cbd5e1",
    fx: "smoke",
    deco: [["scope", "br"]],
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/c754eebf-745b-4e0a-814a-10bcaecaabbc-profile_image-300x300.png",
  },
  {
    platform: "youtube",
    name: "@ludwig",
    label: "Ludwig",
    color: "#facc15",
    fx: "confetti",
    deco: [["trophy", "br"]],
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
  if (s.deco) {
    art.append(el("span", "mark-frame"));
    s.deco.forEach(([name, spot]) => art.append(decoration(name, spot)));
  }
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

// ---------- Decorations on the featured pictures ----------
// Small drawings that sit on a picture's edge: [viewBox, svg inside]. Placed by `deco: [[name, spot]]`
// in FEATURED; spots are tl / tr / bl / br (corners), top and bottom (across the edge).
const DECO = {
  // A level 3 style combat helmet: olive dome, ear guards, front mount and chin strap
  helmet: [
    "0 0 64 52",
    `<path d="M6 36C6 15 19 4 33 4s27 10 27 30v6h-9l-2-8H17l-3 10H6Z" fill="#3f4a1f" stroke="#141708" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M14 30C15 17 23 9 33 9" fill="none" stroke="#7a8a3a" stroke-width="3" stroke-linecap="round"/>
    <path d="M17 32h32l2 8H15Z" fill="#2c3415" stroke="#141708" stroke-width="2" stroke-linejoin="round"/>
    <rect x="27" y="11" width="13" height="8" rx="2" fill="#1b1f0c" stroke="#141708" stroke-width="1.5"/>
    <rect x="30" y="13" width="7" height="4" rx="1" fill="#5c6b2a"/>
    <path d="M6 38h8l1 7H8Z" fill="#2c3415" stroke="#141708" stroke-width="2" stroke-linejoin="round"/>
    <path d="M51 40h9v5l-7 2Z" fill="#2c3415" stroke="#141708" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12 45c6 6 34 6 42 0" fill="none" stroke="#1b1f0c" stroke-width="2.5"/>
    <circle cx="47" cy="22" r="2" fill="#1b1f0c"/><circle cx="20" cy="22" r="2" fill="#1b1f0c"/>`,
  ],
  // An AK rifle: wooden stock, grip and handguard, steel receiver, curved magazine, barrel and sights
  ak: [
    "0 0 170 52",
    `<path d="M3 15l38 5v11L11 37l-8-4Z" fill="#8b4a22" stroke="#1a0f08" stroke-width="2" stroke-linejoin="round"/>
    <path d="M9 20l26 3M9 30l24-3" stroke="#b86b38" stroke-width="1.5"/>
    <path d="M39 17h56v14H39Z" fill="#2b2b30" stroke="#0d0d10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M42 20h46" stroke="#55555e" stroke-width="2"/>
    <path d="M52 31h8l-4 15h-8Z" fill="#7a3f1c" stroke="#1a0f08" stroke-width="2" stroke-linejoin="round"/>
    <path d="M60 31q2 7 9 7" fill="none" stroke="#0d0d10" stroke-width="2"/>
    <path d="M68 31h12c2 8 6 14 12 17l-11 3c-8-4-12-11-13-20Z" fill="#1d1d21" stroke="#0d0d10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M72 35c2 5 4 9 8 12" fill="none" stroke="#3d3d45" stroke-width="1.5"/>
    <path d="M95 19h30v11H95Z" fill="#9a5426" stroke="#1a0f08" stroke-width="2" stroke-linejoin="round"/>
    <path d="M99 22v5M104 22v5M109 22v5M114 22v5M119 22v5" stroke="#6b3616" stroke-width="1.5"/>
    <path d="M95 13h38v5H95Z" fill="#2b2b30" stroke="#0d0d10" stroke-width="1.5"/>
    <path d="M125 22h42v5h-42Z" fill="#1d1d21" stroke="#0d0d10" stroke-width="1.5"/>
    <path d="M148 14h4v8h-4ZM88 11h5v6h-5Z" fill="#1d1d21" stroke="#0d0d10" stroke-width="1.2"/>
    <path d="M163 20h5v9h-5Z" fill="#111" />`,
  ],
  // A football: white with black patches
  ball: [
    "0 0 40 40",
    `<circle cx="20" cy="20" r="17" fill="#fafafa" stroke="#111" stroke-width="2.5"/>
    <path d="M20 12l7 5-3 8h-8l-3-8Z" fill="#111"/>
    <path d="M20 12V4M27 17l8-3M24 25l5 7M16 25l-5 7M13 17l-8-3" stroke="#111" stroke-width="1.8"/>
    <path d="M14 4l6 3 6-3M35 12l-1 7 4 5M31 34l-5-3-6 3M9 34l5-3 0 0M5 12l1 7-4 5" fill="none" stroke="#111" stroke-width="1.6"/>
    <path d="M10 9a14 14 0 0 1 9-5" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>`,
  ],
  // A game controller with a d-pad and colored buttons
  pad: [
    "0 0 56 36",
    `<path d="M14 5h28c8 0 12 8 13 18 1 8-3 12-8 12-4 0-6-4-9-8H18c-3 4-5 8-9 8-5 0-9-4-8-12C2 13 6 5 14 5Z" fill="#2a2333" stroke="#0e0b12" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M14 8h28" stroke="#4a3f59" stroke-width="2"/>
    <path d="M12 15h4v-4h4v4h4v4h-4v4h-4v-4h-4Z" fill="#0e0b12"/>
    <circle cx="40" cy="12" r="2.4" fill="#facc15"/><circle cx="45" cy="17" r="2.4" fill="#ef4444"/>
    <circle cx="35" cy="17" r="2.4" fill="#3b82f6"/><circle cx="40" cy="22" r="2.4" fill="#22c55e"/>
    <circle cx="22" cy="25" r="3.2" fill="#0e0b12"/><circle cx="34" cy="25" r="3.2" fill="#0e0b12"/>`,
  ],
  // Gaming headphones arching over the top
  headset: [
    "0 0 150 70",
    `<path d="M14 58C14 26 42 8 75 8s61 18 61 50" fill="none" stroke="#111114" stroke-width="10" stroke-linecap="round"/>
    <path d="M22 52C24 28 46 14 75 14" fill="none" stroke="#53fc18" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
    <rect x="2" y="40" width="22" height="30" rx="7" fill="#1b1b1f" stroke="#0a0a0c" stroke-width="2.5"/>
    <rect x="126" y="40" width="22" height="30" rx="7" fill="#1b1b1f" stroke="#0a0a0c" stroke-width="2.5"/>
    <rect x="7" y="46" width="12" height="18" rx="4" fill="#53fc18"/>
    <rect x="131" y="46" width="12" height="18" rx="4" fill="#53fc18"/>`,
  ],
  // A curved gold knife with a ring handle
  knife: [
    "0 0 48 48",
    `<path d="M10 6c18 2 30 14 32 30-6-10-16-16-26-17Z" fill="#f5b70a" stroke="#4a3200" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 9c12 2 21 10 25 20" fill="none" stroke="#fff4c2" stroke-width="2" stroke-linecap="round"/>
    <path d="M16 19l-6 13" stroke="#1d1d21" stroke-width="7" stroke-linecap="round"/>
    <path d="M14 23l-3 6" stroke="#55555e" stroke-width="2"/>
    <circle cx="8" cy="38" r="6" fill="none" stroke="#f5b70a" stroke-width="3"/>
    <circle cx="8" cy="38" r="6" fill="none" stroke="#4a3200" stroke-width="1" />`,
  ],
  // A gaming mouse with a red stripe
  mouse: [
    "0 0 32 46",
    `<path d="M16 3c8 0 13 7 13 18v8c0 9-6 14-13 14S3 38 3 29v-8C3 10 8 3 16 3Z" fill="#1d1d21" stroke="#0a0a0c" stroke-width="2.5"/>
    <path d="M16 3v14M3 18h26" stroke="#0a0a0c" stroke-width="2"/>
    <rect x="14" y="8" width="4" height="7" rx="2" fill="#ff4655"/>
    <path d="M6 30c2 6 6 9 10 9s8-3 10-9" fill="none" stroke="#ff4655" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M7 8c2-2 4-3 6-3" fill="none" stroke="#55555e" stroke-width="1.5"/>`,
  ],
  // A gold crown with gems
  crown: [
    "0 0 56 40",
    `<path d="M5 14l11 9 12-17 12 17 11-9-4 22H9Z" fill="#facc15" stroke="#5a3d00" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M9 30h38" stroke="#b7791f" stroke-width="3"/>
    <circle cx="28" cy="25" r="3.5" fill="#22c55e" stroke="#5a3d00" stroke-width="1.2"/>
    <circle cx="17" cy="27" r="2.5" fill="#ef4444"/><circle cx="39" cy="27" r="2.5" fill="#3b82f6"/>
    <circle cx="5" cy="13" r="3" fill="#fde68a" stroke="#5a3d00" stroke-width="1.2"/><circle cx="28" cy="5" r="3" fill="#fde68a" stroke="#5a3d00" stroke-width="1.2"/><circle cx="51" cy="13" r="3" fill="#fde68a" stroke="#5a3d00" stroke-width="1.2"/>
    <path d="M14 20l3 3" stroke="#fff4c2" stroke-width="2" stroke-linecap="round"/>`,
  ],
  // A grenade with its pin and ring
  grenade: [
    "0 0 40 48",
    `<ellipse cx="18" cy="30" rx="13" ry="15" fill="#3f4a1f" stroke="#141708" stroke-width="2.5"/>
    <path d="M8 24h20M6 32h24M8 40h20M14 16v28M22 16v28" stroke="#2c3415" stroke-width="2"/>
    <rect x="12" y="10" width="12" height="7" rx="1.5" fill="#55555e" stroke="#141708" stroke-width="2"/>
    <path d="M24 12h8l4 10" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="30" cy="6" r="5" fill="none" stroke="#fb923c" stroke-width="2.5"/>
    <path d="M11 22c1-3 3-5 6-6" fill="none" stroke="#7a8a3a" stroke-width="2" stroke-linecap="round"/>`,
  ],
  // A sniper scope's view: ring, cross lines and range dots
  scope: [
    "0 0 44 44",
    `<circle cx="22" cy="22" r="19" fill="rgba(10,12,16,0.75)" stroke="#cbd5e1" stroke-width="3"/>
    <circle cx="22" cy="22" r="19" fill="none" stroke="#0a0a0c" stroke-width="1"/>
    <path d="M22 5v12M22 27v12M5 22h12M27 22h12" stroke="#e5e7eb" stroke-width="1.6"/>
    <circle cx="22" cy="22" r="1.8" fill="#ef4444"/>
    <path d="M22 30v1M22 33v1M30 22h1M33 22h1M13 22h1M10 22h1" stroke="#e5e7eb" stroke-width="2"/>`,
  ],
  // A gold trophy cup
  trophy: [
    "0 0 44 48",
    `<path d="M11 5h22v10c0 8-5 13-11 13S11 23 11 15Z" fill="#facc15" stroke="#5a3d00" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M11 9H4c0 7 3 11 8 12M33 9h7c0 7-3 11-8 12" fill="none" stroke="#5a3d00" stroke-width="2.5"/>
    <path d="M11 9H5c0 6 3 9 7 10M33 9h6c0 6-3 9-7 10" fill="none" stroke="#facc15" stroke-width="1.2"/>
    <path d="M19 28h6v7h-6Z" fill="#b7791f" stroke="#5a3d00" stroke-width="2"/>
    <path d="M12 35h20v8H12Z" fill="#7c4a12" stroke="#2f1b05" stroke-width="2.5"/>
    <path d="M17 39h10" stroke="#facc15" stroke-width="2"/>
    <path d="M15 8v7c0 3 1 6 3 8" fill="none" stroke="#fff4c2" stroke-width="2" stroke-linecap="round"/>`,
  ],
};

function decoration(name, spot) {
  const [viewBox, inner] = DECO[name];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("class", `deco deco-${name} at-${spot}`);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = inner;
  return svg;
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
  img.onload = () => {
    art.querySelectorAll(".mark-initials, .mark-logo").forEach((x) => x.remove());
    art.prepend(img);
  };
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
