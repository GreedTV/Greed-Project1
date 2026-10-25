// Twitch chat drawn by Sinners (no Twitch window): messages come from Twitch's public chat connection
// (read-only, no login needed); typing sends the message as you through the Worker, once your Twitch
// account is linked on your Profile. Used by the Watch page.
//   const stop = mountTwitchChat(container, "channelname");

const SinnersLinks = (() => {
  let links = null; // chat links: { twitch: "DisplayName" }, or null before loading
  let identities = {}; // connected logins: { discord: "name", twitch: "name", kick: "name" }
  let available = {};
  const listeners = [];
  async function load() {
    if (!SinnersAuth.user) {
      links = {};
      listeners.forEach((fn) => fn());
      return;
    }
    try {
      const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/link`, { headers: { Authorization: `Bearer ${SinnersAuth.token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      links = Object.fromEntries(data.links.map((l) => [l.platform, l.name]));
      identities = Object.fromEntries((data.identities || []).map((i) => [i.provider, i.name]));
      available = data.available || {};
    } catch (e) {
      links = {};
    }
    listeners.forEach((fn) => fn());
  }
  // Opens the platform's login to connect it, then comes back to this page
  async function link(platform) {
    const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/link/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
      body: JSON.stringify({ platform, back: location.href.split("#")[0] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    location.href = data.url;
  }
  async function unlink(platform) {
    const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/link/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't disconnect that.");
    await load();
  }
  SinnersAuth.onChange(load);
  load();
  return {
    get links() {
      return links;
    },
    get available() {
      return available;
    },
    get identities() {
      return identities;
    },
    load,
    link,
    unlink,
    onChange(fn) {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    },
  };
})();

// Back from linking an account (#linked=twitch / kick / cancelled / failed)
(() => {
  const m = location.hash.match(/^#linked=(\w+)/);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  const done = () =>
    m[1] === "twitch"
      ? SinnersToast.show("Twitch connected! You can chat from the Watch page now.", "💜")
      : m[1] === "kick" || m[1] === "discord"
      ? SinnersToast.show(`${m[1] === "kick" ? "Kick" : "Discord"} connected!`, m[1] === "kick" ? "💚" : "💙")
      : SinnersToast.show(m[1] === "cancelled" ? "Linking was cancelled." : "Linking didn't work. Please try again.", "⚠️");
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", done) : setTimeout(done, 300);
})();

function mountTwitchChat(container, channel) {
  channel = String(channel).toLowerCase();
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const list = el("div", "tchat-list");
  const foot = el("div", "tchat-foot");
  container.replaceChildren(list, foot);
  list.append(el("p", "tchat-system", `Connecting to ${channel}'s chat…`));

  // ---------- Reading ----------
  let ws = null;
  let stopped = false;
  let retry = 0;

  function parse(line) {
    const msg = { tags: {}, prefix: "", command: "", params: [], text: "" };
    let rest = line;
    if (rest[0] === "@") {
      const i = rest.indexOf(" ");
      rest
        .slice(1, i)
        .split(";")
        .forEach((kv) => {
          const j = kv.indexOf("=");
          msg.tags[kv.slice(0, j)] = kv.slice(j + 1).replace(/\\s/g, " ").replace(/\\:/g, ";").replace(/\\\\/g, "\\");
        });
      rest = rest.slice(i + 1);
    }
    if (rest[0] === ":") {
      const i = rest.indexOf(" ");
      msg.prefix = rest.slice(1, i);
      rest = rest.slice(i + 1);
    }
    const t = rest.indexOf(" :");
    if (t >= 0) {
      msg.text = rest.slice(t + 2);
      rest = rest.slice(0, t);
    }
    const parts = rest.split(" ");
    msg.command = parts[0];
    msg.params = parts.slice(1);
    return msg;
  }

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  function add(node) {
    const stick = nearBottom();
    list.append(node);
    while (list.children.length > 200) list.firstChild.remove();
    if (stick) list.scrollTop = list.scrollHeight;
  }

  const BADGES = { broadcaster: "🎬", moderator: "🗡️", vip: "💎", subscriber: "⭐", founder: "⭐", partner: "✔️", staff: "🛠️" };
  const FALLBACK_COLORS = ["#ff7f50", "#9acd32", "#1e90ff", "#ff69b4", "#daa520", "#00ced1", "#b47dff", "#f87171"];

  // Message text with Twitch emotes as images (positions are counted in characters, not UTF-16 units)
  function body(text, emotes) {
    const chars = Array.from(text);
    const spots = [];
    (emotes || "").split("/").filter(Boolean).forEach((e) => {
      const [id, ranges] = e.split(":");
      (ranges || "").split(",").forEach((r) => {
        const [a, b] = r.split("-").map(Number);
        if (Number.isFinite(a) && Number.isFinite(b)) spots.push({ id, a, b });
      });
    });
    spots.sort((x, y) => x.a - y.a);
    const out = el("span", "tchat-text");
    let i = 0;
    for (const s of spots) {
      if (s.a > i) out.append(chars.slice(i, s.a).join(""));
      const img = el("img", "tchat-emote");
      img.src = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(s.id)}/default/dark/1.0`;
      img.alt = img.title = chars.slice(s.a, s.b + 1).join("");
      out.append(img);
      i = s.b + 1;
    }
    if (i < chars.length) out.append(chars.slice(i).join(""));
    return out;
  }

  function privmsg(m) {
    let text = m.text;
    const action = text.startsWith("\u0001ACTION ") && text.endsWith("\u0001");
    if (action) text = text.slice(8, -1);
    const user = m.tags["display-name"] || m.prefix.split("!")[0];
    const row = el("div", "tchat-msg" + (action ? " action" : ""));
    row.dataset.id = m.tags.id || "";
    row.dataset.user = (m.prefix.split("!")[0] || "").toLowerCase();
    const badges = (m.tags.badges || "").split(",").map((b) => BADGES[b.split("/")[0]]).filter(Boolean);
    if (badges.length) row.append(el("span", "tchat-badges", badges.join("")));
    const name = el("strong", "tchat-name", user);
    name.style.color = m.tags.color || FALLBACK_COLORS[[...user].reduce((h, c) => h + c.charCodeAt(0), 0) % FALLBACK_COLORS.length];
    row.append(name, el("span", "tchat-colon", action ? " " : ": "), body(text, m.tags.emotes));
    add(row);
  }

  function system(text) {
    add(el("p", "tchat-system", text));
  }

  function handle(line) {
    if (!line) return;
    if (line.startsWith("PING")) return ws.send("PONG :tmi.twitch.tv");
    const m = parse(line);
    if (m.command === "PRIVMSG") privmsg(m);
    else if (m.command === "USERNOTICE") system(`🎉 ${m.tags["system-msg"] || "Something happened"}${m.text ? `: ${m.text}` : ""}`);
    else if (m.command === "CLEARMSG") list.querySelector(`[data-id="${CSS.escape(m.tags["target-msg-id"] || "")}"]`)?.remove();
    else if (m.command === "CLEARCHAT") {
      if (m.text) list.querySelectorAll(`[data-user="${CSS.escape(m.text.toLowerCase())}"]`).forEach((r) => r.remove());
      else list.replaceChildren(el("p", "tchat-system", "Chat was cleared by a moderator."));
    } else if (m.command === "ROOMSTATE" && retry === 0 && list.querySelector(".tchat-system")) {
      list.querySelector(".tchat-system").textContent = `Welcome to ${channel}'s chat!`;
      const modes = [m.tags["emote-only"] === "1" && "emote-only", Number(m.tags["followers-only"]) >= 0 && "followers-only", m.tags["subs-only"] === "1" && "subscribers-only", Number(m.tags.slow) > 0 && `slow mode ${m.tags.slow}s`].filter(Boolean);
      if (modes.length) system(`Chat modes: ${modes.join(", ")}.`);
    } else if (m.command === "NOTICE") system(m.text);
  }

  function connect() {
    if (stopped) return;
    ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send("PASS SCHMOOPIIE");
      ws.send(`NICK justinfan${Math.floor(Math.random() * 80000 + 10000)}`);
      ws.send(`JOIN #${channel}`);
    };
    ws.onmessage = (e) => e.data.split("\r\n").forEach(handle);
    ws.onclose = () => {
      if (stopped) return;
      system("Reconnecting to chat…");
      setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };
  }
  connect();

  // ---------- Typing ----------
  const stopSend = mountChatSend(foot, "twitch", channel);

  return () => {
    stopped = true;
    stopSend();
    try {
      ws.close();
    } catch (e) {}
  };
}

// The "type as yourself" box under Twitch or Kick chat. Messages go through the Worker as your own
// Twitch / Kick account (connected on your Profile, or the login you used).
//   const stop = mountChatSend(footElement, "kick", "channelname", { picker, encode, onSent });
// picker: () => [{ name, emotes: [{ name, src, note? }] }] adds a 😀 emote picker (inserts the name);
// encode: (text) => text to send (e.g. emote names to codes); onSent: called after a message is sent.
function mountChatSend(foot, platform, channel, opts = {}) {
  const NAME = platform === "kick" ? "Kick" : "Twitch";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  function render() {
    const links = SinnersLinks.links;
    if (!SinnersAuth.user) {
      const b = el("button", "button discord-btn", "Log in to chat");
      b.type = "button";
      b.addEventListener("click", SinnersAuth.login);
      return foot.replaceChildren(el("span", "hint", `Log in with ${NAME} (or connect it on your Profile) to chat here.`), b);
    }
    if (!links) return foot.replaceChildren(el("span", "hint", "…"));
    if (!links[platform]) {
      if (SinnersLinks.available[platform] === false) return foot.replaceChildren(el("span", "hint", "Chatting from Sinners isn't set up yet. Reading works!"));
      const b = el("button", `button ${platform}-btn`, `🔗 Connect ${NAME} to chat`);
      b.type = "button";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await SinnersLinks.link(platform);
        } catch (err) {
          b.disabled = false;
          SinnersDialog.alert(err.message, { title: `Couldn't connect ${NAME}`, icon: "⚠️" });
        }
      });
      // Logged in with Kick before Sinners could chat: one more approval adds the chat permission
      const note = SinnersLinks.identities[platform] ? el("span", "hint", `One quick approval lets Sinners send messages as ${SinnersLinks.identities[platform]}.`) : null;
      return foot.replaceChildren(...[note, b].filter(Boolean));
    }
    const form = el("form", "tchat-form");
    const input = el("input");
    input.maxLength = 500;
    input.placeholder = `Chat as ${links[platform]} on ${NAME}…`;
    input.setAttribute("aria-label", "Message");
    const send = el("button", "button", "Send");
    send.type = "submit";
    const err = el("p", "tchat-error");
    if (opts.picker) {
      const smile = el("button", "icon-btn emote-toggle", "😀");
      smile.type = "button";
      smile.title = "Emotes";
      smile.setAttribute("aria-label", "Emotes");
      smile.setAttribute("aria-expanded", "false");
      const panel = el("div", "emote-picker");
      panel.hidden = true;
      smile.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        smile.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) fillPicker(panel, opts.picker(), (name) => {
          const at = input.selectionStart ?? input.value.length;
          const before = input.value.slice(0, at);
          const insert = `${before && !/\s$/.test(before) ? " " : ""}${name} `;
          input.value = before + insert + input.value.slice(at);
          input.focus();
          input.setSelectionRange(at + insert.length, at + insert.length);
        });
      });
      form.append(input, smile, send);
      foot.replaceChildren(panel, form, err);
    } else form.append(input, send);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const typed = input.value.trim();
      if (!typed) return;
      const text = opts.encode ? opts.encode(typed) : typed;
      send.disabled = true;
      err.textContent = "";
      try {
        const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/chat/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
          body: JSON.stringify({ platform, channel, text }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && new RegExp(NAME).test(data.error || "")) SinnersLinks.load();
        if (!res.ok) throw new Error(data.error || "Couldn't send that.");
        input.value = ""; // it shows up in the chat from the platform in a moment
        foot.querySelector(".emote-picker")?.setAttribute("hidden", "");
        if (opts.onSent) opts.onSent();
      } catch (e2) {
        err.textContent = e2.message;
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
    if (!opts.picker) foot.replaceChildren(form, err);
  }

  // The emote picker: one tab per group, a search box and a grid of emotes
  function fillPicker(panel, groups, pick) {
    if (!groups.length) return panel.replaceChildren(el("p", "hint", "Emotes are still loading…"));
    let current = Math.min(Number(panel.dataset.tab) || 0, groups.length - 1);
    const tabs = el("div", "emote-tabs");
    const search = el("input", "emote-search");
    search.placeholder = "Search emotes";
    search.setAttribute("aria-label", "Search emotes");
    const grid = el("div", "emote-grid");
    function draw() {
      tabs.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === current && !search.value));
      const q = search.value.trim().toLowerCase();
      const items = q ? groups.flatMap((g) => g.emotes).filter((e) => e.name.toLowerCase().includes(q)).slice(0, 120) : groups[current].emotes;
      grid.replaceChildren(
        ...items.map((e) => {
          const b = el("button", "emote-btn");
          b.type = "button";
          b.title = e.note ? `${e.name} (${e.note})` : e.name;
          const img = el("img");
          img.src = e.src;
          img.alt = e.name;
          img.loading = "lazy";
          b.append(img);
          b.addEventListener("click", () => pick(e.name));
          return b;
        })
      );
      if (!items.length) grid.append(el("p", "hint", "No emotes found."));
    }
    groups.forEach((g, i) => {
      const t = el("button", "emote-tab", g.name);
      t.type = "button";
      t.addEventListener("click", () => {
        current = i;
        panel.dataset.tab = i;
        search.value = "";
        draw();
      });
      tabs.append(t);
    });
    search.addEventListener("input", draw);
    panel.replaceChildren(tabs, search, grid);
    draw();
  }
  render();
  return SinnersLinks.onChange(render);
}
