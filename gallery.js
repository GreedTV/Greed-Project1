// Community gallery: shows approved image and clip links from the Worker,
// and lets visitors share new ones (they appear after approval on admin.html).

const API = WORKER_URL.replace(/\/$/, "");
const HOST = location.hostname || "localhost";

const grids = { image: document.getElementById("images-grid"), clip: document.getElementById("clips-grid") };
const counts = { image: document.getElementById("count-images"), clip: document.getElementById("count-clips") };
const lightbox = document.getElementById("lightbox");
const media = document.getElementById("lightbox-media");
const caption = document.getElementById("lightbox-caption");

let items = { image: [], clip: [] };
let current = { kind: "image", index: 0 };
let stopMedia = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cap(word) {
  return word === "youtube" ? "YouTube" : word.charAt(0).toUpperCase() + word.slice(1);
}

// ---------- Tabs ----------

const tabs = document.querySelectorAll(".tab");
function showTab(name) {
  tabs.forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  document.getElementById("panel-images").hidden = name !== "images";
  document.getElementById("panel-clips").hidden = name !== "clips";
  history.replaceState(null, "", name === "clips" ? "#clips" : location.pathname);
}
tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
if (location.hash === "#clips") showTab("clips");

// ---------- Loading ----------

async function load() {
  setStatus("image", "Loading…");
  setStatus("clip", "Loading…");
  try {
    const res = await fetch(`${API}/gallery`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't load the gallery.");
    items = { image: data.images || [], clip: data.clips || [] };
    renderImages();
    renderClips();
  } catch (err) {
    setStatus("image", "The gallery couldn't be loaded right now. Try again later.");
    setStatus("clip", "The gallery couldn't be loaded right now. Try again later.");
  }
}

function setStatus(kind, text) {
  grids[kind].replaceChildren(el("p", "gallery-empty", text));
}

function byLine(item) {
  const parts = [];
  if (item.channel) parts.push(item.channel);
  if (item.name) parts.push(`shared by ${item.name}`);
  return parts.join(" · ");
}

function renderImages() {
  counts.image.textContent = items.image.length || "";
  if (!items.image.length) return setStatus("image", "No images yet. Be the first to share one!");
  grids.image.replaceChildren(
    ...items.image.map((item, i) => {
      const btn = el("button", "gallery-item");
      btn.type = "button";
      const img = el("img");
      img.src = item.url;
      img.alt = item.title || "Shared image";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      // Hide images whose host stopped serving them
      img.addEventListener("error", () => btn.remove());
      btn.append(img);
      if (item.title || item.name) btn.append(el("span", "item-caption", item.title || `shared by ${item.name}`));
      btn.addEventListener("click", () => open("image", i));
      return btn;
    })
  );
}

function renderClips() {
  counts.clip.textContent = items.clip.length || "";
  if (!items.clip.length) return setStatus("clip", "No clips yet. Be the first to share one!");
  grids.clip.replaceChildren(
    ...items.clip.map((item, i) => {
      const card = el("button", "clip-card");
      card.type = "button";
      const thumb = el("div", `clip-thumb ${item.platform}`);
      if (item.thumb) {
        const img = el("img");
        img.src = item.thumb;
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        thumb.append(img);
      } else {
        thumb.append(el("span", "clip-thumb-label", cap(item.platform)));
      }
      thumb.append(el("span", "play-icon", "▶"));

      const body = el("div", "clip-body");
      body.append(el("span", `platform ${item.platform}`, item.platform));
      body.append(el("h3", null, item.title || `${cap(item.platform)} clip`));
      const by = byLine(item);
      if (by) body.append(el("p", null, by));

      card.append(thumb, body);
      card.addEventListener("click", () => open("clip", i));
      return card;
    })
  );
}

// ---------- Viewer ----------

function open(kind, index) {
  current = { kind, index };
  show();
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
}

function close() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  clearMedia();
}

function clearMedia() {
  if (stopMedia) stopMedia();
  stopMedia = null;
  media.replaceChildren();
}

function step(delta) {
  const list = items[current.kind];
  current.index = (current.index + delta + list.length) % list.length;
  show();
}

function show() {
  clearMedia();
  const item = items[current.kind][current.index];
  if (!item) return;
  const by = byLine(item);
  caption.textContent = [item.title, by].filter(Boolean).join(" — ");

  if (item.kind === "image") {
    const img = el("img");
    img.src = item.url;
    img.alt = item.title || "Shared image";
    img.referrerPolicy = "no-referrer";
    media.append(img);
    return;
  }

  const link = el("a", "clip-open", `Open on ${cap(item.platform)} ↗`);
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener";

  if (item.platform === "kick") {
    const video = el("video");
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    media.append(video);
    playKickClip(video, item.video);
  } else {
    const frame = el("iframe");
    frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.src =
      item.platform === "twitch"
        ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(item.clipId)}&parent=${HOST}&autoplay=true`
        : `https://www.youtube.com/embed/${encodeURIComponent(item.clipId)}?autoplay=1`;
    media.append(frame);
  }
  caption.append(" ", link);
}

let hlsLoading;
// hls.js first: some browsers say they can play HLS natively but then fail
function playKickClip(video, src) {
  hlsLoading ||= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    tag.onload = resolve;
    tag.onerror = reject;
    document.head.append(tag);
  });
  hlsLoading
    .then(() => {
      if (!video.isConnected) return;
      if (!Hls.isSupported()) {
        video.src = src; // Safari
        return;
      }
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      stopMedia = () => hls.destroy();
    })
    .catch(() => (video.src = src));
}

lightbox.querySelector(".close").addEventListener("click", close);
lightbox.querySelector(".prev").addEventListener("click", () => step(-1));
lightbox.querySelector(".next").addEventListener("click", () => step(1));
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) close();
});
document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("open")) return;
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

// ---------- Sharing ----------

document.querySelectorAll(".share-form").forEach((form) => {
  const msg = form.querySelector(".form-msg");
  const button = form.querySelector("button");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    msg.className = "form-msg";
    msg.textContent = "Sending…";
    button.disabled = true;
    try {
      const res = await fetch(`${API}/gallery/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: form.dataset.kind, ...data }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Couldn't share that link.");
      form.reset();
      msg.className = "form-msg ok";
      msg.textContent = "Thanks! It will show up here after a quick review.";
    } catch (err) {
      msg.className = "form-msg error";
      msg.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
});

load();
