// Content page: a YouTube queue to watch while waiting for a stream, community picks
// from the gallery, and a live alert for a Kick streamer.

const QUEUE_KEY = "sinners-content";
const ALERT_KEY = "sinners-live-alert";
const ALERT_EVERY_MS = 60000;

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

document.getElementById("clear-queue").addEventListener("click", () => {
  if (!queue.length || !confirm("Clear your whole queue?")) return;
  queue = [];
  current = -1;
  save();
  render();
});

// ---------- Community picks (YouTube clips from the gallery) ----------

async function loadPicks() {
  const box = document.getElementById("picks");
  try {
    const data = await (await fetch(`${WORKER_URL.replace(/\/$/, "")}/gallery`)).json();
    const picks = (data.clips || []).filter((c) => c.platform === "youtube");
    if (!picks.length) {
      box.replaceChildren(el("p", "list-empty", "No YouTube picks yet."));
      return;
    }
    box.replaceChildren(
      ...picks.map((c) => {
        const b = el("button", "pick");
        b.type = "button";
        const img = el("img");
        img.src = c.thumb;
        img.alt = "";
        img.loading = "lazy";
        b.append(img, el("span", null, c.title || "YouTube clip"));
        b.addEventListener("click", () => addToQueue({ type: "video", yt: c.clipId, title: c.title }, { playNow: true }));
        return b;
      })
    );
  } catch (e) {
    box.replaceChildren(el("p", "list-empty", "Picks couldn't be loaded."));
  }
}

// ---------- Live alert (Kick) ----------

const alertForm = document.getElementById("alert-form");
const alertInput = document.getElementById("alert-input");
const alertStatus = document.getElementById("alert-status");
const banner = document.getElementById("live-banner");
const originalTitle = document.title;
let alertName = "";
let alertTimer = null;
let alerted = false;

try {
  alertName = localStorage.getItem(ALERT_KEY) || "";
} catch (e) {}

// Suggest Kick streamers from the Watch page list
try {
  const saved = JSON.parse(localStorage.getItem("sinners-streamers") || "[]");
  const list = document.getElementById("alert-suggestions");
  saved.filter((s) => s.platform === "kick").forEach((s) => list.append(new Option(s.channel)));
} catch (e) {}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.16);
    });
  } catch (e) {}
}

function setAlertStatus(text) {
  alertStatus.replaceChildren(text ? el("span", null, text) : "");
  if (alertName) {
    const stop = el("button", "link-btn", "Stop");
    stop.type = "button";
    stop.addEventListener("click", () => startAlert(""));
    alertStatus.append(" ", stop);
  }
}

async function checkLive() {
  if (!alertName) return;
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${alertName}`);
    if (res.status === 404) {
      setAlertStatus(`Couldn't find "${alertName}" on Kick.`);
      return;
    }
    const data = await res.json();
    const name = (data.user && data.user.username) || alertName;
    if (data.livestream) {
      setAlertStatus(`🔴 ${name} is live!`);
      if (!alerted) {
        alerted = true;
        document.getElementById("live-text").textContent = `${name} is live${data.livestream.session_title ? `: ${data.livestream.session_title}` : "!"}`;
        document.getElementById("live-watch").href = `watch.html?platform=kick&add=${encodeURIComponent(alertName)}`;
        banner.hidden = false;
        document.title = `🔴 ${name} is live — Sinners`;
        beep();
      }
    } else {
      alerted = false;
      setAlertStatus(`Watching for ${name}. Offline for now; checking every minute.`);
    }
  } catch (e) {
    setAlertStatus("Couldn't reach Kick right now. Will try again.");
  }
}

function startAlert(name) {
  clearInterval(alertTimer);
  alertName = name;
  alerted = false;
  banner.hidden = true;
  document.title = originalTitle;
  try {
    name ? localStorage.setItem(ALERT_KEY, name) : localStorage.removeItem(ALERT_KEY);
  } catch (e) {}
  if (!name) {
    setAlertStatus("");
    return;
  }
  setAlertStatus(`Checking ${name}…`);
  checkLive();
  alertTimer = setInterval(checkLive, ALERT_EVERY_MS);
}

alertForm.addEventListener("submit", (e) => {
  e.preventDefault();
  let name = alertInput.value.trim().replace(/^@/, "");
  const fromLink = name.match(/kick\.com\/([a-z0-9_-]+)/i);
  if (fromLink) name = fromLink[1];
  if (!/^[a-z0-9_-]{2,30}$/i.test(name)) {
    setAlertStatus("Type a Kick name like lexor2k, or paste their kick.com link.");
    return;
  }
  alertInput.value = "";
  startAlert(name.toLowerCase());
});

document.getElementById("live-dismiss").addEventListener("click", () => {
  banner.hidden = true;
  document.title = originalTitle;
});

// ---------- Start ----------

render();
loadPicks();
// From the Watch page: content.html?alert=<kick name>
function alertFromUrl() {
  const name = new URLSearchParams(location.search).get("alert");
  if (!name || !/^[a-z0-9_-]{2,30}$/i.test(name)) return false;
  history.replaceState(null, "", location.pathname);
  alertName = name.toLowerCase();
  return true;
}
alertFromUrl();
if (alertName) startAlert(alertName);

// In-site navigation (nav.js)
SinnersNav.onLeave(() => clearInterval(alertTimer));
SinnersNav.onReturn(() => alertFromUrl() && startAlert(alertName));
// Pick up where the visitor left off, without autoplaying sound on page load
if (queue[current]) nowPlaying.textContent = queue[current].title;
playerBox.addEventListener("click", () => !playerCreating && queue[current] && play(current));
if (queue[current]) playerBox.querySelector(".player-offline").textContent = "▶ Click to continue watching";
