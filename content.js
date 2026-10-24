// Content page: a YouTube queue to watch while waiting for a stream.

const QUEUE_KEY = "sinners-content";

const playerBox = document.getElementById("content-player");
const nowPlaying = document.getElementById("now-playing");
const queueList = document.getElementById("queue");
const form = document.getElementById("content-form");
const input = document.getElementById("content-input");
const msg = document.getElementById("content-msg");

let queue = [];
let current = -1;
try {
  const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}");
  if (Array.isArray(saved.queue)) queue = saved.queue;
  if (Number.isInteger(saved.current)) current = saved.current;
} catch (e) {}

function save() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ queue, current }));
  } catch (e) {}
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = "form-msg" + (type ? ` ${type}` : "");
}

// ---------- YouTube links ----------

// Returns { type: "video" | "playlist", yt } or throws with a friendly message
function parseYouTube(text) {
  text = text.trim();
  if (/^[\w-]{11}$/.test(text)) return { type: "video", yt: text };
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch (e) {
    throw new Error("Paste a YouTube video or playlist link.");
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let video = null;
  if (host === "youtu.be") video = parts[0];
  else if (host === "youtube.com") {
    video = url.searchParams.get("v") || (["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : null);
    const list = url.searchParams.get("list");
    if (!video && list && /^[\w-]{10,64}$/.test(list)) return { type: "playlist", yt: list };
  } else {
    throw new Error("Only YouTube links work here.");
  }
  if (video && /^[\w-]{11}$/.test(video)) return { type: "video", yt: video };
  throw new Error("Paste a YouTube video or playlist link.");
}

async function fetchTitle(item) {
  const link =
    item.type === "playlist" ? `https://www.youtube.com/playlist?list=${item.yt}` : `https://www.youtube.com/watch?v=${item.yt}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`);
    if (res.ok) return (await res.json()).title;
  } catch (e) {}
  return item.type === "playlist" ? "YouTube playlist" : "YouTube video";
}

// ---------- Player ----------

let player = null;
let playerReady;
let playerCreating = null;

function loadYouTubeApi() {
  return (playerReady ||= new Promise((resolve) => {
    if (window.YT && YT.Player) return resolve(); // already loaded by another page
    window.onYouTubeIframeAPIReady = resolve;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.append(tag);
  }));
}

async function play(index) {
  if (index < 0 || index >= queue.length) return;
  current = index;
  save();
  render();
  await loadYouTubeApi();

  // Only one player is ever created, even if play() is called again while it loads
  playerCreating ||= new Promise((resolve) => {
    const mount = el("div");
    playerBox.replaceChildren(mount);
    const p = new YT.Player(mount, {
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
      events: { onReady: () => resolve(p), onStateChange: onState },
    });
  });
  player = await playerCreating;

  // Load whatever is current now, in case the visitor picked something else meanwhile
  if (index !== current) return;
  const item = queue[current];
  if (item.type === "playlist") player.loadPlaylist({ list: item.yt, listType: "playlist" });
  else player.loadVideoById(item.yt);
}

function onState(e) {
  if (e.data !== YT.PlayerState.ENDED) return;
  const item = queue[current];
  // A playlist moves on by itself until its last video
  if (item && item.type === "playlist") {
    const list = player.getPlaylist() || [];
    if (player.getPlaylistIndex() < list.length - 1) return;
  }
  if (current < queue.length - 1) play(current + 1);
}

function step(delta) {
  const item = queue[current];
  if (player && item && item.type === "playlist") {
    const index = player.getPlaylistIndex();
    const last = (player.getPlaylist() || []).length - 1;
    if (delta > 0 && index < last) return player.nextVideo();
    if (delta < 0 && index > 0) return player.previousVideo();
  }
  play(current + delta);
}

document.getElementById("prev").addEventListener("click", () => step(-1));
document.getElementById("next").addEventListener("click", () => step(1));

// Mini player: keep watching in a small floating window while scrolling the page
const mini = makeMinimizable(playerBox, {
  title: () => (queue[current] ? queue[current].title : "Sinners"),
  onClose: () => player && player.pauseVideo(),
});
document.getElementById("mini").addEventListener("click", () => {
  if (!queue[current]) return;
  mini.isMini() ? mini.restore() : mini.minimize();
});

// ---------- Queue ----------

function render() {
  nowPlaying.textContent = queue[current] ? queue[current].title : "Nothing yet";
  queueList.replaceChildren();
  if (!queue.length) {
    queueList.append(el("li", "list-empty", "Your queue is empty."));
    return;
  }
  queue.forEach((item, i) => {
    const li = el("li", "queue-item" + (i === current ? " playing" : ""));
    li.tabIndex = 0;
    const thumb = el("div", "queue-thumb");
    if (item.type === "video") {
      const img = el("img");
      img.src = `https://i.ytimg.com/vi/${item.yt}/mqdefault.jpg`;
      img.alt = "";
      img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.append(el("span", null, "▤ Playlist"));
    }
    const name = el("span", "queue-title", item.title);
    const remove = el("button", "link-btn", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${item.title}`);
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      queue.splice(i, 1);
      if (i < current) current--;
      else if (i === current) current = Math.min(current, queue.length - 1);
      save();
      render();
    });
    li.append(thumb, name, remove);
    li.addEventListener("click", () => play(i));
    li.addEventListener("keydown", (e) => e.key === "Enter" && play(i));
    queueList.append(li);
  });
}

async function addToQueue(item, { playNow = false } = {}) {
  const existing = queue.findIndex((q) => q.type === item.type && q.yt === item.yt);
  if (existing !== -1) {
    if (playNow) play(existing);
    return false;
  }
  item.title ||= await fetchTitle(item);
  queue.push(item);
  save();
  render();
  // Start right away only if nothing has been picked yet
  if (playNow || current === -1) play(queue.length - 1);
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let item;
  try {
    item = parseYouTube(input.value);
  } catch (err) {
    showMsg(err.message, "error");
    return;
  }
  showMsg("Adding…");
  const added = await addToQueue(item);
  input.value = "";
  showMsg(added ? `Added "${item.title}".` : "That's already in your queue.", added ? "ok" : "error");
});

document.getElementById("clear-queue").addEventListener("click", async () => {
  if (!queue.length || !(await SinnersDialog.confirm("Every video in your queue will be removed.", { title: "Clear your queue?", yes: "Clear", icon: "🗑️", danger: true }))) return;
  queue = [];
  current = -1;
  save();
  render();
});

// ---------- Browse YouTube ----------
// Search results come from the Worker (YouTube has no keyless search for websites).

const API = WORKER_URL.replace(/\/$/, "");
const CHIPS = [
  ["🎮 Gaming", "gaming"],
  ["🔴 Live now", "gaming", true],
  ["🎬 Streamer highlights", "streamer highlights"],
  ["🏆 Esports", "esports highlights"],
  ["🔫 CS2", "cs2"],
  ["🎯 Valorant", "valorant"],
  ["⛏️ Minecraft", "minecraft"],
  ["🚗 GTA", "gta"],
  ["🎵 Music", "music mix"],
  ["🎙️ Podcasts", "podcast"],
  ["😂 Funny", "funny moments"],
  ["⚽ Football", "football highlights"],
];

const chipsBox = document.getElementById("yt-chips");
const grid = document.getElementById("yt-grid");
const searchForm = document.getElementById("yt-search");
const searchInput = document.getElementById("yt-q");
const browseMsg = document.getElementById("yt-msg");
let searchId = 0;

function renderChips(active) {
  chipsBox.replaceChildren(
    ...CHIPS.map(([label, q, live], i) => {
      const chip = el("button", "yt-chip" + (i === active ? " active" : ""), label);
      chip.type = "button";
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", i === active);
      chip.addEventListener("click", () => {
        searchInput.value = "";
        renderChips(i);
        search(q, live);
      });
      return chip;
    })
  );
}

function skeletons() {
  grid.replaceChildren(...Array.from({ length: 8 }, () => el("div", "video-card skeleton")));
}

async function search(q, live = false) {
  const id = ++searchId;
  browseMsg.textContent = "";
  browseMsg.className = "form-msg";
  skeletons();
  let videos;
  try {
    const res = await fetch(`${API}/youtube/search?q=${encodeURIComponent(q)}${live ? "&live=1" : ""}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    videos = data.videos || [];
  } catch (e) {
    if (id !== searchId) return;
    grid.replaceChildren();
    browseMsg.textContent = "Couldn't load YouTube right now. Try again in a moment.";
    browseMsg.className = "form-msg error";
    return;
  }
  if (id !== searchId) return; // a newer search started meanwhile
  if (!videos.length) {
    grid.replaceChildren();
    browseMsg.textContent = `No videos found for "${q}".`;
    return;
  }
  grid.replaceChildren(...videos.map(videoCard));
}

function videoCard(v) {
  const card = el("article", "video-card");
  const thumb = el("button", "video-thumb");
  thumb.type = "button";
  thumb.setAttribute("aria-label", `Play ${v.title}`);
  const img = el("img");
  img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  img.alt = "";
  img.loading = "lazy";
  thumb.append(img, el("span", "video-play", "▶"));
  if (v.live) thumb.append(el("span", "video-badge live", "● LIVE"));
  else if (v.length) thumb.append(el("span", "video-badge", v.length));
  thumb.addEventListener("click", () => playVideo(v));

  const body = el("div", "video-body");
  const title = el("h3", "video-title", v.title);
  title.title = v.title;
  const channel = el("button", "video-channel", v.channel);
  channel.type = "button";
  channel.title = `More from ${v.channel}`;
  channel.addEventListener("click", () => {
    searchInput.value = v.channel;
    renderChips(-1);
    search(v.channel);
  });
  const meta = el("span", "video-meta", [v.views, v.published].filter(Boolean).join(" · "));
  const add = el("button", "video-add", "+ Queue");
  add.type = "button";
  add.title = "Add to your queue";
  add.addEventListener("click", async () => {
    const added = await addToQueue({ type: "video", yt: v.id, title: v.title });
    add.textContent = added ? "✓ Queued" : "✓ In queue";
    add.disabled = true;
  });
  body.append(title, channel, meta, add);
  card.append(thumb, body);
  return card;
}

function playVideo(v) {
  addToQueue({ type: "video", yt: v.id, title: v.title }, { playNow: true });
  if (!mini.isMini()) playerBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  // A pasted YouTube link goes straight to the player
  if (/youtu\.?be/i.test(q)) {
    try {
      addToQueue(parseYouTube(q), { playNow: true });
      searchInput.value = "";
      playerBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    } catch (err) {}
  }
  renderChips(-1);
  search(q);
});

renderChips(0);
search(CHIPS[0][1]);

// ---------- Start ----------

render();
// Pick up where the visitor left off, without autoplaying sound on page load
if (queue[current]) nowPlaying.textContent = queue[current].title;
playerBox.addEventListener("click", () => !playerCreating && queue[current] && play(current));
if (queue[current]) playerBox.querySelector(".player-offline").textContent = "▶ Click to continue watching";
