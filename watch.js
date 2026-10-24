// Streamers everyone sees when they first open the Watch page.
// Each entry: { platform: "twitch" | "kick", channel: "name" }
//         or: { platform: "youtube", video: "VIDEO_ID" } / { platform: "youtube", channel: "UC..." }
// Add a "label" to show a different display name.
const DEFAULT_STREAMERS = [];

const STORAGE_KEY = "sinners-streamers";
const MAX_MULTI = 4;
const HOST = location.hostname || "localhost";

const stage = document.getElementById("stage");
const list = document.getElementById("streamer-list");
const title = document.getElementById("now-title");
const multiToggle = document.getElementById("multi-toggle");
const form = document.getElementById("add-form");
const formTitle = document.getElementById("form-title");
const platformSelect = document.getElementById("add-platform");
const input = document.getElementById("add-input");
const submitBtn = document.getElementById("add-submit");
const cancelBtn = document.getElementById("add-cancel");
const msg = document.getElementById("add-msg");

let streamers = load();
let selected = []; // ids currently playing
let editingId = null;

// ---------- Storage ----------

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return DEFAULT_STREAMERS.map((s) => ({ ...s, id: makeId(s) }));
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streamers));
  } catch (e) {}
}

function makeId(s) {
  return `${s.platform}:${s.video || s.channel}`.toLowerCase();
}

// ---------- Parsing names and links ----------

const NAME_RULES = {
  twitch: /^[a-z0-9_]{3,25}$/i,
  kick: /^[a-z0-9_-]{2,30}$/i,
};

function looksLikeLink(text) {
  return /^https?:\/\//i.test(text) || /(twitch\.tv|kick\.com|youtube\.com|youtu\.be)/i.test(text);
}

// Returns a streamer object, or throws an Error with a friendly message.
function parse(text, platform) {
  text = text.trim();
  if (!text) throw new Error("Type a name or paste a link.");
  const s = looksLikeLink(text) ? parseLink(text) : parseName(text.replace(/^@/, ""), platform);
  return s.platform === "youtube" ? checkYouTube(s) : s;
}

function parseName(name, platform) {
  if (platform === "youtube") {
    if (/^UC[\w-]{22}$/.test(name)) return { platform, channel: name };
    if (/^[\w-]{11}$/.test(name)) return { platform, video: name };
    throw new Error("YouTube names can't be looked up. Paste the live video link (youtube.com/watch?v=…) instead.");
  }
  if (!NAME_RULES[platform].test(name)) {
    throw new Error(`"${name}" isn't a valid ${cap(platform)} name. Try pasting their channel link.`);
  }
  return { platform, channel: name.toLowerCase(), label: name };
}

function parseLink(text) {
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch (e) {
    throw new Error("That link doesn't look right.");
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "twitch.tv") {
    if (!parts[0] || !NAME_RULES.twitch.test(parts[0])) throw new Error("Paste a Twitch channel link, like twitch.tv/name.");
    return { platform: "twitch", channel: parts[0].toLowerCase(), label: parts[0] };
  }

  if (host === "kick.com") {
    if (!parts[0] || !NAME_RULES.kick.test(parts[0])) throw new Error("Paste a Kick channel link, like kick.com/name.");
    return { platform: "kick", channel: parts[0].toLowerCase(), label: parts[0] };
  }

  if (host === "youtu.be" && parts[0]) return { platform: "youtube", video: parts[0] };

  if (host === "youtube.com") {
    const v = url.searchParams.get("v");
    if (v) return { platform: "youtube", video: v };
    if ((parts[0] === "live" || parts[0] === "embed") && parts[1]) return { platform: "youtube", video: parts[1] };
    if (parts[0] === "channel" && parts[1]) return { platform: "youtube", channel: parts[1] };
    if (parts[0] && parts[0].startsWith("@")) {
      throw new Error("YouTube @handle links can't be embedded. Open their live stream and paste that video link instead.");
    }
    throw new Error("Paste a YouTube live video link, like youtube.com/watch?v=….");
  }

  throw new Error("Only Twitch, YouTube and Kick links work here.");
}

function checkYouTube(s) {
  if (s.video && !/^[\w-]{11}$/.test(s.video)) throw new Error("That YouTube video link doesn't look right.");
  if (s.channel && !/^UC[\w-]{22}$/.test(s.channel)) throw new Error("That YouTube channel link doesn't look right.");
  return s;
}

// ---------- Embed URLs ----------

function playerUrl(s, muted) {
  if (s.platform === "twitch") {
    return `https://player.twitch.tv/?channel=${s.channel}&parent=${HOST}&muted=${muted}`;
  }
  if (s.platform === "kick") {
    return `https://player.kick.com/${s.channel}?autoplay=true&muted=${muted}`;
  }
  const mute = muted ? 1 : 0;
  return s.video
    ? `https://www.youtube.com/embed/${s.video}?autoplay=1&mute=${mute}`
    : `https://www.youtube.com/embed/live_stream?channel=${s.channel}&autoplay=1&mute=${mute}`;
}

function chatUrl(s) {
  if (s.platform === "twitch") return `https://www.twitch.tv/embed/${s.channel}/chat?parent=${HOST}&darkpopout`;
  if (s.platform === "youtube" && s.video) return `https://www.youtube.com/live_chat?v=${s.video}&embed_domain=${HOST}`;
  return null;
}

function pageUrl(s) {
  if (s.platform === "twitch") return `https://www.twitch.tv/${s.channel}`;
  if (s.platform === "kick") return `https://kick.com/${s.channel}`;
  return s.video ? `https://www.youtube.com/watch?v=${s.video}` : `https://www.youtube.com/channel/${s.channel}`;
}

function displayName(s) {
  return s.label || s.channel || `YouTube video ${s.video}`;
}

// ---------- Rendering ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function platformBadge(s) {
  return el("span", `platform ${s.platform}`, s.platform);
}

function renderList() {
  list.replaceChildren();
  if (!streamers.length) {
    list.append(el("li", "list-empty", "No streamers yet. Add one above."));
    return;
  }
  streamers.forEach((s) => {
    const li = el("li", "streamer" + (selected.includes(s.id) ? " selected" : ""));
    li.tabIndex = 0;
    li.append(platformBadge(s), el("span", "name", displayName(s)));

    const actions = el("span", "actions");
    const fix = el("button", null, "✎ Fix");
    fix.type = "button";
    fix.title = "Wrong streamer? Replace with a link";
    fix.addEventListener("click", (e) => {
      e.stopPropagation();
      startEdit(s);
    });
    const remove = el("button", null, "✕");
    remove.type = "button";
    remove.title = "Remove";
    remove.setAttribute("aria-label", `Remove ${displayName(s)}`);
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeStreamer(s.id);
    });
    actions.append(fix, remove);
    li.append(actions);

    li.addEventListener("click", () => pick(s.id));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(s.id);
      }
    });
    list.append(li);
  });
}

function renderStage() {
  const multi = multiToggle.checked;
  const playing = selected.map((id) => streamers.find((s) => s.id === id)).filter(Boolean);

  stage.replaceChildren();
  stage.className = "stage" + (multi ? ` multi count-${playing.length}` : "");

  if (!playing.length) {
    stage.append(
      el("div", "stage-empty", multi
        ? `Multi-view is on. Click up to ${MAX_MULTI} streamers in the list to watch them together.`
        : "Click a streamer in the list to start watching.")
    );
    title.textContent = "Pick a streamer";
    return;
  }

  playing.forEach((s, i) => {
    const tile = el("div", "tile");
    const frame = document.createElement("iframe");
    // In multi-view only the first stream has sound, so they don't talk over each other
    frame.src = playerUrl(s, multi && i > 0);
    frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.title = `${displayName(s)} stream`;

    const bar = el("div", "tile-bar");
    bar.append(platformBadge(s), el("span", null, displayName(s)));
    const open = el("a", null, `Open on ${cap(s.platform)} ↗`);
    open.href = pageUrl(s);
    open.target = "_blank";
    open.rel = "noopener";
    bar.append(open);
    if (multi) {
      const close = el("button", null, "✕");
      close.type = "button";
      close.setAttribute("aria-label", `Close ${displayName(s)}`);
      close.addEventListener("click", () => pick(s.id));
      bar.append(close);
    }

    tile.append(frame, bar);
    stage.append(tile);
  });

  if (!multi) {
    const s = playing[0];
    const chat = el("div", "chat");
    const url = chatUrl(s);
    if (url) {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.title = `${displayName(s)} chat`;
      chat.append(frame);
    } else {
      const none = el("div", "chat-none");
      const link = el("a", null, `Open chat on ${cap(s.platform)} ↗`);
      link.href = pageUrl(s);
      link.target = "_blank";
      link.rel = "noopener";
      none.append(el("p", null, "Chat can't be shown here for this stream."), link);
      chat.append(none);
    }
    stage.append(chat);
    title.textContent = displayName(s);
  } else {
    title.textContent = `Multi-view (${playing.length}/${MAX_MULTI})`;
  }
}

function render() {
  renderList();
  renderStage();
}

// ---------- Actions ----------

function pick(id) {
  if (!multiToggle.checked) {
    selected = selected[0] === id ? selected : [id];
  } else if (selected.includes(id)) {
    selected = selected.filter((x) => x !== id);
  } else if (selected.length >= MAX_MULTI) {
    showMsg(`Multi-view holds up to ${MAX_MULTI} streams. Close one first.`, "error");
    return;
  } else {
    selected = [...selected, id];
  }
  render();
  if (window.innerWidth <= 960) stage.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeStreamer(id) {
  streamers = streamers.filter((s) => s.id !== id);
  selected = selected.filter((x) => x !== id);
  if (editingId === id) stopEdit();
  save();
  render();
}

function startEdit(s) {
  editingId = s.id;
  formTitle.textContent = `Fix "${displayName(s)}"`;
  submitBtn.textContent = "Replace";
  cancelBtn.hidden = false;
  platformSelect.value = s.platform;
  input.value = "";
  input.placeholder = "Paste their correct channel link";
  showMsg("");
  input.focus();
}

function stopEdit() {
  editingId = null;
  formTitle.textContent = "Add a streamer";
  submitBtn.textContent = "Add";
  cancelBtn.hidden = true;
  input.placeholder = "Name or paste a link";
}

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = "form-msg" + (type ? ` ${type}` : "");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  let s;
  try {
    s = parse(input.value, platformSelect.value);
  } catch (err) {
    showMsg(err.message, "error");
    return;
  }
  s.id = makeId(s);

  if (streamers.some((x) => x.id === s.id && x.id !== editingId)) {
    showMsg(`${displayName(s)} is already in the list.`, "error");
    return;
  }

  if (editingId) {
    const i = streamers.findIndex((x) => x.id === editingId);
    if (i !== -1) streamers[i] = s;
    selected = selected.map((x) => (x === editingId ? s.id : x));
    showMsg(`Replaced with ${displayName(s)} (${cap(s.platform)}).`, "ok");
    stopEdit();
  } else {
    streamers.push(s);
    showMsg(`Added ${displayName(s)} (${cap(s.platform)}).`, "ok");
  }

  input.value = "";
  save();
  render();
});

cancelBtn.addEventListener("click", () => {
  stopEdit();
  showMsg("");
});

// Pasting a link picks the platform for you
input.addEventListener("input", () => {
  const v = input.value.toLowerCase();
  if (v.includes("twitch.tv")) platformSelect.value = "twitch";
  else if (v.includes("kick.com")) platformSelect.value = "kick";
  else if (v.includes("youtube.com") || v.includes("youtu.be")) platformSelect.value = "youtube";
});

multiToggle.addEventListener("change", () => {
  if (!multiToggle.checked) selected = selected.slice(0, 1);
  render();
});

function cap(word) {
  return word === "youtube" ? "YouTube" : word.charAt(0).toUpperCase() + word.slice(1);
}

render();
