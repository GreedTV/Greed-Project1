// Streamers everyone sees when they first open the Watch page.
// Each entry: { platform: "twitch" | "kick", channel: "name" }
//         or: { platform: "youtube", video: "VIDEO_ID" } / { platform: "youtube", channel: "UC..." }
// Add a "label" to show a different display name.
const DEFAULT_STREAMERS = [];

// Kick streams play in HD through the Worker (set in config.js) with volume and quality controls.
// If it's empty, Kick's own player is used.
const KICK_PROXY = WORKER_URL;

const STORAGE_KEY = "sinners-streamers";
const MAX_MULTI = 4;
const HOST = location.hostname || "localhost";

const stage = document.getElementById("stage");
const list = document.getElementById("streamer-list");
const title = document.getElementById("now-title");
const multiToggle = document.getElementById("multi-toggle");
const chatToggle = document.getElementById("chat-toggle");
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

// ---------- Players and controls ----------
// Twitch and YouTube have player APIs we can control from the page.
// Kick doesn't, so Kick streams either play in our own HD player (through KICK_PROXY)
// or fall back to Kick's embed with its built-in controls.

const players = new Map(); // box id -> player API, for the tiles currently on screen
const cleanups = []; // stop functions for players that keep loading after their tile is gone
const scripts = {};
let youtubeReady;

function loadScript(src) {
  return (scripts[src] ||= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.onload = resolve;
    tag.onerror = reject;
    document.head.append(tag);
  }));
}

function loadYouTube() {
  return (youtubeReady ||= new Promise((resolve) => {
    if (window.YT && YT.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    loadScript("https://www.youtube.com/iframe_api");
  }));
}

function makeFrame(src, s) {
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  frame.allowFullscreen = true;
  frame.title = `${displayName(s)} stream`;
  return frame;
}

function kickEmbed(s, box, controls, muted, note = "Volume and quality: use the Kick player's own controls.") {
  box.replaceChildren(makeFrame(playerUrl(s, muted), s));
  controls.replaceChildren(el("span", "controls-note", note));
}

// Plays the Kick stream's HD playlist (from the Worker) with hls.js
async function setupKickHD(s, box, controls, muted) {
  const volume = volumeControl(muted);
  const quality = qualityControl();
  const full = el("button", "icon-btn", "⛶");
  full.type = "button";
  full.title = "Fullscreen";
  full.setAttribute("aria-label", "Fullscreen");
  full.addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen()));
  controls.append(volume.el, quality.el, full);

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = muted;
  box.append(video);

  // Browsers block autoplay with sound until the viewer interacts, so offer a play button
  const play = () =>
    video.play().catch(() => {
      if (box.querySelector(".big-play")) return;
      const btn = el("button", "big-play", "▶ Click to play");
      btn.type = "button";
      btn.addEventListener("click", () => {
        btn.remove();
        video.play();
      });
      box.append(btn);
    });
  video.addEventListener("click", () => (video.paused ? video.play() : video.pause()));

  const src = `${KICK_PROXY.replace(/\/$/, "")}/kick/${s.channel}.m3u8`;
  try {
    await loadScript("https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js");
  } catch (e) {
    return kickEmbed(s, box, controls, muted);
  }
  if (!box.isConnected) return;

  if (!window.Hls || !Hls.isSupported()) {
    // Safari plays HLS by itself, but without quality switching
    video.src = src;
    quality.el.remove();
    const api = mediaApi(video);
    players.set(box.id, api);
    volume.attach(api, { readValues: false });
    volume.apply();
    play();
    return;
  }

  const hls = new Hls({ lowLatencyMode: true });
  cleanups.push(() => hls.destroy());
  const api = {
    ...mediaApi(video),
    qualities: () => [
      { name: "Auto", group: "auto" },
      ...hls.levels
        .map((l, i) => ({
          name: `${l.height}p${l.frameRate > 30 ? Math.round(l.frameRate) : ""}`,
          group: String(i),
        }))
        .reverse(), // highest quality first
    ],
    getQuality: () => (hls.autoLevelEnabled ? "auto" : String(hls.currentLevel)),
    setQuality: (q) => (hls.currentLevel = q === "auto" ? -1 : Number(q)),
  };
  players.set(box.id, api);
  volume.attach(api, { readValues: false });
  volume.apply();

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    quality.attach(api);
    play();
  });
  hls.on(Hls.Events.ERROR, (event, data) => {
    if (!data.fatal) return;
    hls.destroy();
    if (data.response && data.response.code === 404) {
      quality.offline();
      // Offer something to watch meanwhile, with a live alert already set for this streamer
      const offline = el("div", "player-offline");
      const wait = el("a", null, "Watch something while you wait →");
      wait.href = `content.html?alert=${encodeURIComponent(s.channel)}`;
      offline.append(el("p", null, `${displayName(s)} is offline.`), wait);
      box.replaceChildren(offline);
    } else {
      // Worker or HD feed not working: use Kick's own player instead
      kickEmbed(s, box, controls, muted, "HD player unavailable, using Kick's player.");
    }
  });
  hls.loadSource(src);
  hls.attachMedia(video);
}

function mediaApi(video) {
  return {
    setVolume: (v) => (video.volume = v / 100),
    setMuted: (m) => (video.muted = m),
    getVolume: () => Math.round(video.volume * 100),
    getMuted: () => video.muted,
  };
}

async function setupPlayer(s, box, controls, muted) {
  if (s.platform === "kick") {
    return KICK_PROXY ? setupKickHD(s, box, controls, muted) : kickEmbed(s, box, controls, muted);
  }

  const volume = volumeControl(muted);
  controls.append(volume.el);

  try {
    if (s.platform === "twitch") {
      const quality = qualityControl();
      controls.append(quality.el);
      await loadScript("https://player.twitch.tv/js/embed/v1.js");
      if (!box.isConnected) return;

      const p = new Twitch.Player(box.id, {
        channel: s.channel,
        parent: [HOST],
        width: "100%",
        height: "100%",
        muted,
        autoplay: true,
      });
      const api = {
        setVolume: (v) => p.setVolume(v / 100),
        setMuted: (m) => p.setMuted(m),
        getVolume: () => Math.round(p.getVolume() * 100),
        getMuted: () => p.getMuted(),
        qualities: () => p.getQualities(),
        getQuality: () => p.getQuality(),
        setQuality: (q) => p.setQuality(q),
      };
      players.set(box.id, api);
      volume.attach(api, { readValues: false });

      // Twitch's READY event doesn't always arrive, so also check for the quality list
      let ready = false;
      const onReady = () => {
        if (ready || !box.isConnected) return;
        ready = true;
        volume.apply();
        quality.attach(api);
      };
      p.addEventListener(Twitch.Player.READY, onReady);
      p.addEventListener(Twitch.Player.PLAYING, () => quality.attach(api));
      p.addEventListener(Twitch.Player.OFFLINE, () => quality.offline());
      let checks = 0;
      const poll = setInterval(() => {
        if (ready || !box.isConnected || checks++ > 40) return clearInterval(poll);
        if (api.qualities().length > 1) onReady();
      }, 1500);
    } else {
      const quality = el("span", "controls-note", "Quality: ⚙ in the player");
      controls.append(quality);
      const frame = makeFrame(`${playerUrl(s, muted)}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`, s);
      box.append(frame);
      await loadYouTube();
      if (!box.isConnected) return;

      new YT.Player(frame, {
        events: {
          onReady: (e) => {
            const p = e.target;
            const api = {
              setVolume: (v) => p.setVolume(v),
              setMuted: (m) => (m ? p.mute() : p.unMute()),
              getVolume: () => p.getVolume(),
              getMuted: () => p.isMuted(),
            };
            players.set(box.id, api);
            volume.attach(api);
          },
        },
      });
    }
  } catch (err) {
    controls.replaceChildren(el("span", "controls-note", "Controls couldn't load. Use the player's own controls."));
  }
}

function volumeControl(startMuted) {
  const wrap = el("div", "volume");
  const btn = el("button", "icon-btn", "🔇");
  btn.type = "button";
  btn.disabled = true;
  const down = el("button", "icon-btn small", "−");
  down.type = "button";
  down.disabled = true;
  down.setAttribute("aria-label", "Volume down");
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = 100;
  slider.step = 5;
  slider.value = 80;
  slider.disabled = true;
  slider.setAttribute("aria-label", "Volume");
  const up = el("button", "icon-btn small", "+");
  up.type = "button";
  up.disabled = true;
  up.setAttribute("aria-label", "Volume up");
  const level = el("span", "volume-level", "");

  let api = null;
  let muted = startMuted;

  const update = () => {
    const v = Number(slider.value);
    btn.textContent = muted || v === 0 ? "🔇" : v < 50 ? "🔉" : "🔊";
    btn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    level.textContent = muted ? "Muted" : `${v}%`;
    slider.style.setProperty("--fill", `${muted ? 0 : v}%`);
  };

  const setLevel = (v) => {
    slider.value = Math.max(0, Math.min(100, v));
    api.setVolume(Number(slider.value));
    if (muted && slider.value > 0) {
      muted = false;
      api.setMuted(false);
    }
    update();
  };

  btn.addEventListener("click", () => {
    muted = !muted;
    api.setMuted(muted);
    if (!muted && Number(slider.value) === 0) setLevel(50);
    update();
  });
  slider.addEventListener("input", () => setLevel(Number(slider.value)));
  down.addEventListener("click", () => setLevel(Number(slider.value) - 10));
  up.addEventListener("click", () => setLevel(Number(slider.value) + 10));

  wrap.append(btn, down, slider, up, level);
  update();

  return {
    el: wrap,
    // readValues: take the player's current volume instead of ours
    attach(playerApi, { readValues = true } = {}) {
      api = playerApi;
      if (readValues) {
        const v = api.getVolume();
        if (Number.isFinite(v)) slider.value = v;
        muted = api.getMuted();
      }
      [btn, down, slider, up].forEach((c) => (c.disabled = false));
      update();
    },
    // Push our volume to the player (for players that ignore commands until loaded)
    apply() {
      api.setVolume(Number(slider.value));
      api.setMuted(muted);
    },
  };
}

// Twitch only. Shows Auto, the source quality and 360p–1080p.
function qualityControl() {
  const select = document.createElement("select");
  select.className = "quality";
  select.disabled = true;
  select.setAttribute("aria-label", "Quality");
  select.append(new Option("Quality…", ""));

  let api = null;
  let isOffline = false;
  let retries = 0;
  select.addEventListener("change", () => api && api.setQuality(select.value));

  const fill = () => {
    if (isOffline || !select.isConnected) return;
    const options = api
      .qualities()
      .filter((q) => q.group === "auto" || q.group === "chunked" || /^(360|480|720|1080)p/.test(q.name));
    // The list can arrive a moment after the player is ready
    if (!options.length) {
      if (retries++ < 10) setTimeout(fill, 2000);
      return;
    }
    const current = api.getQuality();
    select.replaceChildren(
      ...options.map((q) => {
        const label =
          q.group === "auto" ? "Auto" : q.group === "chunked" ? `${q.name.replace(/\s*\(source\)/i, "")} (Source)` : q.name;
        return new Option(label, q.group, false, q.group === current);
      })
    );
    select.disabled = false;
  };

  return {
    el: select,
    attach(playerApi) {
      api = playerApi;
      retries = 0;
      fill();
    },
    offline() {
      isOffline = true;
      select.replaceChildren(new Option("Offline", ""));
      select.disabled = true;
    },
  };
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

  if (stopChat) stopChat();
  stage.replaceChildren();
  stage.className = "stage" + (chatHidden ? " no-chat" : "");

  if (!playing.length) {
    stage.append(
      el("div", "stage-empty", multi
        ? `Multi-view is on. Click up to ${MAX_MULTI} streamers in the list to watch them together.`
        : "Click a streamer in the list to start watching.")
    );
    title.textContent = "Pick a streamer";
    return;
  }

  players.clear();
  cleanups.splice(0).forEach((stop) => stop());
  const tiles = el("div", "tiles" + (multi ? ` multi count-${playing.length}` : ""));
  stage.append(tiles);
  playing.forEach((s, i) => {
    const tile = el("div", "tile");
    const box = el("div", "player-box");
    box.id = `player-${i}`;
    const controls = el("div", "controls");

    const bar = el("div", "tile-bar");
    bar.append(platformBadge(s), el("span", null, displayName(s)));
    const open = el("a", null, `Open on ${cap(s.platform)} ↗`);
    open.href = pageUrl(s);
    open.target = "_blank";
    open.rel = "noopener";
    bar.append(open);
    if (!multi) {
      // Single view: shrink into a floating mini player
      const mini = makeMinimizable(box, {
        title: () => displayName(s),
        onClose: () => {
          selected = [];
          render();
        },
      });
      const miniBtn = el("button", "mini-btn", "⧉");
      miniBtn.type = "button";
      miniBtn.title = "Mini player";
      miniBtn.setAttribute("aria-label", "Mini player");
      miniBtn.addEventListener("click", () => (mini.isMini() ? mini.restore() : mini.minimize()));
      bar.append(miniBtn);
    }
    if (multi) {
      const close = el("button", null, "✕");
      close.type = "button";
      close.setAttribute("aria-label", `Close ${displayName(s)}`);
      close.addEventListener("click", () => pick(s.id));
      bar.append(close);
    }

    tile.append(box, controls, bar);
    tiles.append(tile);
    // In multi-view only the first stream starts with sound, so they don't talk over each other
    setupPlayer(s, box, controls, multi && i > 0);
  });

  stage.append(buildChat(playing));
  title.textContent = multi ? `Multi-view (${playing.length}/${MAX_MULTI})` : displayName(playing[0]);
}

// ---------- Chat column ----------
// Tabs: our own Sinners chat (chat.js) and the platform's real chat.

let chatStreamId = null; // which stream's chat is shown (multi-view can switch)
let chatTab = "sinners";
let stopChat = null;
let chatHidden = false;
try {
  chatHidden = localStorage.getItem("sinners-chat-hidden") === "1";
} catch (e) {}

function buildChat(playing) {
  if (!playing.some((s) => s.id === chatStreamId)) chatStreamId = playing[0].id;
  const col = el("div", "chat");
  const head = el("div", "chat-head");
  const body = el("div", "chat-body");

  if (playing.length > 1) {
    const pickStream = document.createElement("select");
    pickStream.className = "chat-stream";
    pickStream.setAttribute("aria-label", "Which stream's chat");
    playing.forEach((s) => pickStream.append(new Option(`${displayName(s)} (${cap(s.platform)})`, s.id, false, s.id === chatStreamId)));
    pickStream.addEventListener("change", () => {
      chatStreamId = pickStream.value;
      showTabs();
    });
    head.append(pickStream);
  }

  const tabRow = el("div", "chat-tabs");
  head.append(tabRow);
  col.append(head, body);

  function showTabs() {
    const s = playing.find((x) => x.id === chatStreamId);
    tabRow.replaceChildren();
    [
      ["sinners", "Sinners chat"],
      ["platform", `${cap(s.platform)} chat`],
    ].forEach(([key, label]) => {
      const btn = el("button", "chat-tab" + (chatTab === key ? " active" : ""), label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        chatTab = key;
        showTabs();
      });
      tabRow.append(btn);
    });
    showBody(s);
  }

  function showBody(s) {
    if (stopChat) stopChat();
    stopChat = null;
    body.replaceChildren();
    if (chatTab === "sinners") {
      stopChat = mountSinnersChat(body, s.id);
      return;
    }
    const url = chatUrl(s);
    if (url) {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.title = `${displayName(s)} chat`;
      body.append(frame);
      return;
    }
    const none = el("div", "chat-none");
    if (s.platform === "kick") {
      none.append(el("p", null, "Kick chat opens in its own small window. Log in to Kick there to chat with the streamer."));
      const btn = el("button", "button", "Open Kick chat");
      btn.type = "button";
      btn.addEventListener("click", () =>
        window.open(`https://kick.com/popout/${s.channel}/chat`, `kick-chat-${s.channel}`, "width=420,height=720")
      );
      none.append(btn);
    } else {
      none.append(el("p", null, "Chat can't be shown here for this stream."));
      const link = el("a", null, `Open on ${cap(s.platform)} ↗`);
      link.href = pageUrl(s);
      link.target = "_blank";
      link.rel = "noopener";
      none.append(link);
    }
    body.append(none);
  }

  showTabs();
  return col;
}

chatToggle.addEventListener("click", () => {
  chatHidden = !chatHidden;
  try {
    localStorage.setItem("sinners-chat-hidden", chatHidden ? "1" : "0");
  } catch (e) {}
  updateChatToggle();
  stage.classList.toggle("no-chat", chatHidden);
});

function updateChatToggle() {
  chatToggle.textContent = chatHidden ? "💬 Show chat" : "💬 Hide chat";
}
updateChatToggle();

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

// Coming from the home page: watch.html?platform=kick&add=name-or-link
function addFromUrl() {
  const params = new URLSearchParams(location.search);
  const text = params.get("add");
  if (!text) return;
  history.replaceState(null, "", location.pathname);
  const platform = ["twitch", "youtube", "kick"].includes(params.get("platform")) ? params.get("platform") : "twitch";
  try {
    const s = parse(text, platform);
    s.id = makeId(s);
    if (!streamers.some((x) => x.id === s.id)) {
      streamers.push(s);
      save();
    }
    selected = [s.id];
  } catch (err) {
    input.value = text;
    platformSelect.value = platform;
    showMsg(err.message, "error");
  }
}

addFromUrl();
render();
