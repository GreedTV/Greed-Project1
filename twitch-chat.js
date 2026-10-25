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

// Back from linking an account (#linked=twitch / cancelled / failed)
(() => {
  const m = location.hash.match(/^#linked=(\w+)/);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  const done = () =>
    m[1] === "twitch"
      ? SinnersToast.show("Twitch linked! You can chat from the Watch page now.", "💜")
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
  function renderFoot() {
    const links = SinnersLinks.links;
    if (!SinnersAuth.user) {
      const b = el("button", "button discord-btn", "Log in to chat");
      b.type = "button";
      b.addEventListener("click", SinnersAuth.login);
      return foot.replaceChildren(el("span", "hint", "Log in with Twitch (or connect it on your Profile) to chat here."), b);
    }
    if (!links) return foot.replaceChildren(el("span", "hint", "…"));
    if (!links.twitch) {
      if (SinnersLinks.available.twitch === false) return foot.replaceChildren(el("span", "hint", "Chatting from Sinners isn't set up yet. Reading works!"));
      const b = el("button", "button twitch-btn", "🔗 Connect Twitch to chat");
      b.type = "button";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await SinnersLinks.link("twitch");
        } catch (err) {
          b.disabled = false;
          SinnersDialog.alert(err.message, { title: "Couldn't link Twitch", icon: "⚠️" });
        }
      });
      return foot.replaceChildren(b);
    }
    const form = el("form", "tchat-form");
    const input = el("input");
    input.maxLength = 500;
    input.placeholder = `Chat as ${links.twitch} on Twitch…`;
    input.setAttribute("aria-label", "Message");
    const send = el("button", "button", "Send");
    send.type = "submit";
    const err = el("p", "tchat-error");
    form.append(input, send);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      send.disabled = true;
      err.textContent = "";
      try {
        const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/chat/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
          body: JSON.stringify({ platform: "twitch", channel, text }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && /Twitch/.test(data.error || "")) SinnersLinks.load();
        if (!res.ok) throw new Error(data.error || "Couldn't send that.");
        input.value = ""; // it shows up in the list from Twitch in a moment
      } catch (e2) {
        err.textContent = e2.message;
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
    foot.replaceChildren(form, err);
  }
  renderFoot();
  const stopLinks = SinnersLinks.onChange(renderFoot);

  return () => {
    stopped = true;
    stopLinks();
    try {
      ws.close();
    } catch (e) {}
  };
}
