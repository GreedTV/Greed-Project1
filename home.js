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
// color: their glow; fx: the effect around their picture (cs2, warp, ice, speed, bolt, glitch, gold, aim,
// fire, smoke; spark for anyone else); deco: drawings on the picture's edge (see DECO)
// picture: their channel picture, so it shows before the Worker answers (the Worker's newer one replaces it)
const FEATURED = [
  {
    platform: "kick",
    name: "lexor2k",
    label: "Lexor2k",
    color: "#22d3ee",
    fx: "cs2",
    deco: [],
    picture: "https://files.kick.com/images/user/32870913/profile_image/conversion/9c1f9140-d07a-493c-8c51-baaedf9982d6-fullsize.webp",
  },
  {
    platform: "kick",
    name: "st0pcs",
    label: "st0pcs",
    color: "#a78bfa",
    fx: "warp",
    deco: [["blackhole", "tr"], ["timeline", "bottom"]],
    picture: "https://files.kick.com/images/user/33051287/profile_image/conversion/943402e8-ed5d-4580-9827-288cfa30a0d1-fullsize.webp",
  },
  {
    platform: "kick",
    name: "icy9x",
    label: "Icy9x",
    color: "#7dd3fc",
    fx: "ice",
    deco: [["icicles", "top"]],
    picture: "https://files.kick.com/images/user/33057902/profile_image/conversion/10c55280-1d41-4cb2-93c2-c37abf825c87-fullsize.webp",
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
  // The AK in the kill feed: a white side view of the rifle
  killak: [
    "0 0 60 16",
    `<path d="M0 4l14 1V4h20V3h2v1h8v1h9V3h2v2h3v2H44v1H34c0 3 2 6 5 7l-4 1c-3-2-5-5-6-8h-7l-2 6h-4l1-6h-3L4 11 0 10Z" fill="#e5e7eb"/>`,
  ],
  // An airdrop: a red and white parachute, its cords, and a supply crate
  airdrop: [
    "0 0 48 64",
    `<defs><linearGradient id="ad-crate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6b8a"/><stop offset="1" stop-color="#26304a"/></linearGradient></defs>
    <path d="M3 20C3 9 12 2 24 2s21 7 21 18c-3-2-6-2-8 0-3-2-7-2-9 0-3-2-5-2-8 0-3-2-6-2-9 0-3-2-5-2-8 0Z" fill="#dc2626" stroke="#450a0a" stroke-width="1.4"/>
    <path d="M11 4c-2 5-3 10-3 16M24 2v18M37 4c2 5 3 10 3 16" fill="none" stroke="#f8fafc" stroke-width="4"/>
    <path d="M5 20l13 22M20 20l3 22M28 20l-3 22M43 20L30 42" stroke="#e5e7eb" stroke-width="0.9"/>
    <rect x="13" y="41" width="22" height="20" rx="2" fill="url(#ad-crate)" stroke="#0f1424" stroke-width="1.6"/>
    <path d="M13 47h22M13 55h22M24 41v20" stroke="#0f1424" stroke-width="1.2"/>
    <path d="M15 43h8" stroke="#94a3c0" stroke-width="1.2"/>
    <rect x="21" y="49" width="6" height="4" fill="#f59e0b"/>`,
  ],
  // A football, shaded like a sphere, with its pentagon patches curving over the edge
  ball: [
    "0 0 48 48",
    `<defs>
      <radialGradient id="bl-sphere" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e6e6e6"/><stop offset="1" stop-color="#8f8f8f"/></radialGradient>
      <clipPath id="bl-clip"><circle cx="24" cy="24" r="20"/></clipPath>
    </defs>
    <circle cx="24" cy="24" r="20" fill="url(#bl-sphere)"/>
    <g clip-path="url(#bl-clip)" fill="#141414">
      <path d="M24 15l8.5 6.2-3.2 10H18.7l-3.2-10Z"/>
      <path d="M20 1h8l3 6-7 4-7-4Z"/><path d="M39 12l7 3-1 9-6 1-3-8Z"/><path d="M36 37l6-2 1 8-6 5-5-5Z"/>
      <path d="M12 37l-6-2-1 8 6 5 5-5Z"/><path d="M9 12l-7 3 1 9 6 1 3-8Z"/>
    </g>
    <g clip-path="url(#bl-clip)" stroke="#555" stroke-width="0.9" fill="none">
      <path d="M24 15V10M32.5 21.2l5-2M29.3 31.2l4 4.5M18.7 31.2l-4 4.5M15.5 21.2l-5-2"/>
    </g>
    <circle cx="24" cy="24" r="20" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>
    <ellipse cx="17" cy="13" rx="6" ry="3" transform="rotate(-30 17 13)" fill="#fff" opacity="0.7"/>`,
  ],
  // A game controller: glossy shell, rubber thumbsticks, d-pad and lit face buttons
  pad: [
    "0 0 72 46",
    `<defs>
      <linearGradient id="pd-shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a52"/><stop offset="0.4" stop-color="#25252b"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>
      <radialGradient id="pd-stick" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#55555e"/><stop offset="1" stop-color="#0d0d10"/></radialGradient>
    </defs>
    <path d="M18 6h36c10 0 15 10 16 22 1 10-3 15-10 15-5 0-8-4-11-9H23c-3 5-6 9-11 9-7 0-11-5-10-15C3 16 8 6 18 6Z" fill="url(#pd-shell)" stroke="#050506" stroke-width="1.6"/>
    <path d="M18 8h36c5 0 9 3 11 8" fill="none" stroke="#8a8a95" stroke-width="1.2" opacity="0.7"/>
    <path d="M15 17h4v-4h4v4h4v4h-4v4h-4v-4h-4Z" fill="#141418" stroke="#3a3a42" stroke-width="0.8"/>
    <circle cx="52" cy="14" r="2.8" fill="#16a34a" stroke="#052e14" stroke-width="0.8"/><circle cx="58" cy="20" r="2.8" fill="#dc2626" stroke="#450a0a" stroke-width="0.8"/>
    <circle cx="46" cy="20" r="2.8" fill="#2563eb" stroke="#0b1d4d" stroke-width="0.8"/><circle cx="52" cy="26" r="2.8" fill="#eab308" stroke="#422006" stroke-width="0.8"/>
    <circle cx="51.3" cy="13.2" r="0.9" fill="#fff" opacity="0.7"/><circle cx="57.3" cy="19.2" r="0.9" fill="#fff" opacity="0.7"/><circle cx="45.3" cy="19.2" r="0.9" fill="#fff" opacity="0.7"/><circle cx="51.3" cy="25.2" r="0.9" fill="#fff" opacity="0.7"/>
    <circle cx="27" cy="30" r="5" fill="url(#pd-stick)" stroke="#050506"/><circle cx="45" cy="30" r="5" fill="url(#pd-stick)" stroke="#050506"/>
    <circle cx="27" cy="30" r="2.6" fill="none" stroke="#2c2c33"/><circle cx="45" cy="30" r="2.6" fill="none" stroke="#2c2c33"/>
    <rect x="31" y="14" width="10" height="5" rx="2.5" fill="#1a1a1f" stroke="#3a3a42" stroke-width="0.6"/>`,
  ],
  // Gaming headphones: padded band, metal sliders, leather cushions and lit cups
  headset: [
    "0 0 150 76",
    `<defs>
      <linearGradient id="hs-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a42"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>
      <linearGradient id="hs-cup" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d3d45"/><stop offset="1" stop-color="#09090b"/></linearGradient>
    </defs>
    <path d="M16 48C16 22 43 6 75 6s59 16 59 42" fill="none" stroke="#0b0b0e" stroke-width="11" stroke-linecap="round"/>
    <path d="M16 48C16 22 43 6 75 6s59 16 59 42" fill="none" stroke="url(#hs-band)" stroke-width="8" stroke-linecap="round"/>
    <path d="M24 38C30 21 50 11 75 11" fill="none" stroke="#6b6b75" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M42 14c10-4 22-6 33-6s23 2 33 6" fill="none" stroke="#1a1a1f" stroke-width="7" stroke-linecap="round"/>
    <rect x="12" y="40" width="7" height="12" rx="1.5" fill="#9ca3af" stroke="#2a2a30"/><rect x="131" y="40" width="7" height="12" rx="1.5" fill="#9ca3af" stroke="#2a2a30"/>
    <rect x="3" y="48" width="24" height="27" rx="9" fill="url(#hs-cup)" stroke="#050506" stroke-width="1.6"/>
    <rect x="123" y="48" width="24" height="27" rx="9" fill="url(#hs-cup)" stroke="#050506" stroke-width="1.6"/>
    <rect x="9" y="54" width="12" height="15" rx="5" fill="none" stroke="#53fc18" stroke-width="2.4"/>
    <rect x="129" y="54" width="12" height="15" rx="5" fill="none" stroke="#53fc18" stroke-width="2.4"/>
    <path d="M7 52c3-2 7-3 10-3M127 52c3-2 7-3 10-3" fill="none" stroke="#6b6b75" stroke-width="1.2" stroke-linecap="round"/>`,
  ],
  // A karambit with a polished gold blade, bevelled edge, black grip and finger ring
  knife: [
    "0 0 60 60",
    `<defs>
      <linearGradient id="kn-blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.35" stop-color="#f4b324"/><stop offset="0.7" stop-color="#b7791f"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
      <linearGradient id="kn-grip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3a42"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>
    </defs>
    <path d="M14 8c22 0 38 14 40 36-8-12-19-19-32-21Z" fill="url(#kn-blade)" stroke="#5a3d00" stroke-width="1.4"/>
    <path d="M19 11c16 1 28 11 32 25" fill="none" stroke="#fffbe8" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M22 23c11 2 21 8 30 18" fill="none" stroke="#7a5200" stroke-width="1" opacity="0.6"/>
    <path d="M23 22l-9 17c-1 3 0 5 3 6l3 1 10-20Z" fill="url(#kn-grip)" stroke="#050506" stroke-width="1.4"/>
    <path d="M20 31l3 1M18 35l3 1M16 39l3 1" stroke="#55555e" stroke-width="1.2"/>
    <circle cx="13" cy="48" r="7" fill="none" stroke="#1d1d21" stroke-width="4.5"/>
    <circle cx="13" cy="48" r="7" fill="none" stroke="#55555e" stroke-width="1"/>
    <circle cx="25" cy="24" r="1.3" fill="#d4d4d8"/>`,
  ],
  // A gaming mouse: glossy black shell, split buttons, ridged wheel, side buttons and a red light strip
  mouse: [
    "0 0 40 60",
    `<defs>
      <linearGradient id="ms-shell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a52"/><stop offset="0.45" stop-color="#1c1c21"/><stop offset="1" stop-color="#050506"/></linearGradient>
    </defs>
    <path d="M20 3c11 0 17 9 17 22v11c0 13-8 21-17 21S3 49 3 36V25C3 12 9 3 20 3Z" fill="url(#ms-shell)" stroke="#000" stroke-width="1.6"/>
    <path d="M20 3v19M4 23h32" stroke="#000" stroke-width="1.4"/>
    <path d="M9 9c3-4 6-5 9-5" fill="none" stroke="#9a9aa5" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="17.5" y="9" width="5" height="10" rx="2.5" fill="#2a2a30" stroke="#000"/>
    <path d="M18.5 11h3M18.5 13h3M18.5 15h3M18.5 17h3" stroke="#55555e" stroke-width="0.8"/>
    <rect x="3" y="27" width="3" height="6" rx="1" fill="#2a2a30"/><rect x="3" y="34" width="3" height="5" rx="1" fill="#2a2a30"/>
    <path d="M8 40c2 8 7 12 12 12s10-4 12-12" fill="none" stroke="#ff4655" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M8 40c2 8 7 12 12 12s10-4 12-12" fill="none" stroke="#ff4655" stroke-width="6" stroke-linecap="round" opacity="0.25"/>`,
  ],
  // A frag grenade: shaded olive body, steel fuse, spoon lever, pin and ring
  grenade: [
    "0 0 48 60",
    `<defs>
      <radialGradient id="gn-body" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#8a9a55"/><stop offset="0.5" stop-color="#4b5a26"/><stop offset="1" stop-color="#1c230c"/></radialGradient>
      <linearGradient id="gn-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d4d4d8"/><stop offset="0.5" stop-color="#8a8f98"/><stop offset="1" stop-color="#3f434a"/></linearGradient>
    </defs>
    <ellipse cx="21" cy="38" rx="16" ry="19" fill="url(#gn-body)" stroke="#0c0f06" stroke-width="1.6"/>
    <path d="M10 28c3-4 7-6 11-7" fill="none" stroke="#c7d48f" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M7 44c9 3 19 3 28 0" fill="none" stroke="#1c230c" stroke-width="1.2" opacity="0.7"/>
    <rect x="14" y="13" width="14" height="8" rx="1.5" fill="url(#gn-steel)" stroke="#1a1c20" stroke-width="1.2"/>
    <path d="M14 16h14" stroke="#4b4f56" stroke-width="0.8"/>
    <path d="M27 14h7c3 0 4 2 4 4l-2 24c0 2-2 3-3 2" fill="none" stroke="url(#gn-steel)" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M27 14h7c3 0 4 2 4 4l-2 24" fill="none" stroke="#1a1c20" stroke-width="0.8"/>
    <path d="M12 17H8" stroke="#8a8f98" stroke-width="2" stroke-linecap="round"/>
    <circle cx="6" cy="11" r="6" fill="none" stroke="url(#gn-steel)" stroke-width="2.4"/>`,
  ],
  // A rifle scope, side view: matte tube, turrets, ribbed eyepiece and a lens catching the light
  scope: [
    "0 0 80 40",
    `<defs>
      <linearGradient id="sc-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7079"/><stop offset="0.35" stop-color="#2c2f35"/><stop offset="1" stop-color="#0b0c0f"/></linearGradient>
      <radialGradient id="sc-lens" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#bfe9ff"/><stop offset="0.5" stop-color="#2563eb"/><stop offset="1" stop-color="#0b1030"/></radialGradient>
    </defs>
    <path d="M4 14h12l6 3h36l6-4h10v16H64l-6-4H22l-6 3H4Z" fill="url(#sc-tube)" stroke="#050506" stroke-width="1.4"/>
    <path d="M6 15h10M24 18h32M66 14h8" stroke="#9aa0a8" stroke-width="1" opacity="0.7"/>
    <rect x="34" y="7" width="10" height="10" rx="1.5" fill="url(#sc-tube)" stroke="#050506" stroke-width="1.2"/>
    <path d="M36 8v8M39 8v8M42 8v8" stroke="#55595f" stroke-width="0.8"/>
    <rect x="35" y="25" width="8" height="7" rx="1.5" fill="url(#sc-tube)" stroke="#050506" stroke-width="1.2"/>
    <path d="M8 14v16M11 14v16" stroke="#15161a" stroke-width="1.2"/>
    <ellipse cx="75" cy="21" rx="3" ry="7.5" fill="url(#sc-lens)" stroke="#050506"/>
    <path d="M74.5 16c1 1 1 3 0 4" stroke="#fff" stroke-width="1" opacity="0.8"/>`,
  ],
  // A black hole with a Saturn ring: the back of the ring, the dark core with its glowing edge, then the front
  blackhole: [
    "0 0 72 48",
    `<path d="M5 27C8 18 64 14 67 22" fill="none" stroke="#f59e0b" stroke-width="3" opacity="0.55"/>
    <circle cx="36" cy="24" r="17" fill="#c084fc" opacity="0.25"/>
    <circle cx="36" cy="24" r="14" fill="#040207" stroke="#fbbf24" stroke-width="2"/>
    <circle cx="36" cy="24" r="11" fill="none" stroke="#a78bfa" stroke-width="1.2" opacity="0.8"/>
    <path d="M27 15a12 12 0 0 1 9-4" fill="none" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/>
    <path d="M5 27c3 8 59 6 62-5" fill="none" stroke="#fde68a" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M10 29c10 4 44 4 52-3" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="66" cy="8" r="1.4" fill="#fff"/><circle cx="6" cy="10" r="1" fill="#fff"/><circle cx="58" cy="42" r="1" fill="#fff"/>`,
  ],
  // A video editor's timeline: clips on two tracks, an audio wave, keyframes and a moving playhead
  timeline: [
    "0 0 160 40",
    `<rect x="2" y="6" width="156" height="32" rx="4" fill="#0f0b18" stroke="#2e2442" stroke-width="2"/>
    <path d="M10 6v3M30 6v3M50 6v3M70 6v3M90 6v3M110 6v3M130 6v3M150 6v3" stroke="#4b3d66" stroke-width="1.5"/>
    <rect x="8" y="11" width="40" height="8" rx="2" fill="#7c3aed"/><rect x="50" y="11" width="56" height="8" rx="2" fill="#2563eb"/><rect x="108" y="11" width="44" height="8" rx="2" fill="#db2777"/>
    <path d="M14 15h6M58 15h10M114 15h8" stroke="#fff" stroke-width="1.5" opacity="0.6"/>
    <rect x="8" y="22" width="144" height="8" rx="2" fill="#14532d"/>
    <path d="M10 26l3-2 3 4 3-5 3 6 3-4 3 2 3-3 3 5 3-6 3 4 3-2 3 3 3-4 3 5 3-3 3 2 3-4 3 3 3-2 3 4 3-5 3 4 3-2 3 3 3-3 3 4 3-2 3 2 3-4 3 3 3-2 3 4 3-3 3 2 3-3 3 4 3-2 3 1" fill="none" stroke="#4ade80" stroke-width="1.2"/>
    <path d="M30 34l2-2 2 2-2 2ZM70 34l2-2 2 2-2 2ZM118 34l2-2 2 2-2 2Z" fill="#facc15"/>
    <g class="playhead"><path d="M6 1h8l-4 5Z" fill="#ef4444"/><path d="M10 5v33" stroke="#ef4444" stroke-width="2"/></g>`,
  ],
  // Icicles hanging from a snowy ledge
  icicles: [
    "0 0 150 40",
    `<path d="M4 8c6-6 136-6 142 0v6H4Z" fill="#f0f9ff" stroke="#0c4a6e" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 14l5 20 5-20M26 14l3 12 3-12M40 14l5 24 5-24M58 14l3 10 3-10M72 14l5 18 5-18M90 14l3 13 3-13M104 14l5 22 5-22M122 14l3 11 3-11M134 14l4 16 4-16" fill="#bae6fd" stroke="#0c4a6e" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M13 16l2 9M43 16l2 12M75 16l2 8M107 16l2 10M137 16l1 7" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M14 7c30-3 92-3 122 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <circle cx="45" cy="38" r="1.6" fill="#e0f2fe"/><circle cx="109" cy="36" r="1.4" fill="#e0f2fe"/>`,
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
  const count = fx === "bolt" || fx === "ice" ? 6 : fx === "cs2" ? 5 : 12;
  for (let i = 0; i < count; i++) {
    const bit = el("i");
    bit.style.setProperty("--x", `${Math.round(Math.random() * 100)}%`);
    bit.style.setProperty("--y", `${Math.round(Math.random() * 100)}%`);
    bit.style.setProperty("--d", `${(Math.random() * -4).toFixed(2)}s`);
    bit.style.setProperty("--t", `${(1.6 + Math.random() * 2.4).toFixed(2)}s`);
    box.append(bit);
  }
  if (fx === "ice") box.append(el("b", "ice-ring"), el("b", "ice-ring late"));
  if (fx === "cs2") {
    // A kill feed in the corner, and kill rewards floating up
    const feed = el("span", "killfeed");
    ["Entry", "AWPer", "Lurker"].forEach((victim) => {
      const row = el("span", "kill");
      row.append(el("b", null, "Lexor2k"), decoration("killak", "feed"), el("span", "kill-hs"), el("span", null, victim));
      feed.append(row);
    });
    box.append(feed, el("b", "cash-pop", "+$300"), el("b", "cash-pop late", "+$300"));
    // An airdrop crate drifting down on its parachute
    box.append(decoration("airdrop", "drop"));
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
