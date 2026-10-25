// Kick chat drawn by Sinners (no Kick window, no second login): messages come from Kick's chat through
// the Worker (Kick's live chat server only accepts kick.com itself) and are checked every few seconds.
// Typing sends the message as you with your Kick account (the Kick login you use on Sinners), and the
// 😀 picker has the channel's emotes, Kick's global emotes and emojis, and the channel's 7TV emotes.
//   const stop = mountKickChat(container, "channelname");

function mountKickChat(container, channel) {
  const API = WORKER_URL.replace(/\/$/, "");
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

  let info = null; // { channelId, broadcasterId, name, subBadges, emotes }
  const kickEmotes = new Map(); // emote name -> Kick emote id (for sending)
  const sevenTv = new Map(); // emote name -> picture (7TV emotes are plain words in chat)
  const groups = []; // for the picker
  const seen = new Set();
  let stopped = false;
  let timer = null;
  let first = true;
  let failures = 0;

  // ---------- Drawing ----------
  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  function add(node) {
    const stick = nearBottom();
    list.append(node);
    while (list.children.length > 200) list.firstChild.remove();
    if (stick) list.scrollTop = list.scrollHeight;
  }
  const system = (text) => add(el("p", "tchat-system", text));

  const BADGES = { broadcaster: "🎬", moderator: "🗡️", vip: "💎", og: "🏅", founder: "⭐", verified: "✔️", staff: "🛠️", sub_gifter: "🎁" };
  const FALLBACK_COLORS = ["#53fc18", "#ff7f50", "#1e90ff", "#ff69b4", "#daa520", "#00ced1", "#b47dff", "#f87171"];

  function emoteImg(src, name) {
    const img = el("img", "tchat-emote");
    img.src = src;
    img.alt = img.title = name;
    img.loading = "lazy";
    return img;
  }

  // Text with Kick emotes ([emote:id:name]) and 7TV emote words as pictures
  function body(text) {
    const out = el("span", "tchat-text");
    const parts = String(text || "").split(/\[emote:(\d+):([^\]]*)\]/);
    for (let i = 0; i < parts.length; i += 3) {
      parts[i].split(/(\s+)/).forEach((word) => {
        if (sevenTv.has(word)) out.append(emoteImg(sevenTv.get(word), word));
        else if (word) out.append(word);
      });
      if (parts[i + 1]) out.append(emoteImg(`https://files.kick.com/emotes/${parts[i + 1]}/fullsize`, parts[i + 2]));
    }
    return out;
  }

  function subBadge(months) {
    const fits = ((info && info.subBadges) || []).filter((b) => b.months <= Math.max(1, months)).sort((a, b) => b.months - a.months)[0];
    if (!fits) return el("span", "tchat-badge", "⭐");
    const img = el("img", "tchat-badge-img");
    img.src = fits.src;
    img.alt = img.title = `Subscriber (${months} month${months === 1 ? "" : "s"})`;
    return img;
  }

  function message(m) {
    const row = el("div", "tchat-msg");
    if (m.reply) {
      const r = el("div", "tchat-reply", `↪ ${m.reply.user}: `);
      r.append(body(m.reply.text));
      row.append(r);
    }
    const badges = el("span", "tchat-badges");
    m.badges.forEach((b) => {
      if (b.type === "subscriber") badges.append(subBadge(b.count));
      else if (BADGES[b.type]) badges.append(el("span", "tchat-badge", BADGES[b.type]));
    });
    m.images.forEach((b) => {
      const img = el("img", "tchat-badge-img");
      img.src = b.src;
      img.alt = img.title = b.name;
      img.loading = "lazy";
      badges.append(img);
    });
    if (badges.childNodes.length) row.append(badges);
    const user = m.user || "someone";
    const name = el("strong", "tchat-name", user);
    name.style.color = m.color || FALLBACK_COLORS[[...user].reduce((h, c) => h + c.charCodeAt(0), 0) % FALLBACK_COLORS.length];
    row.append(name, el("span", "tchat-colon", ": "), body(m.content));
    add(row);
  }

  // Your own messages show at once (faded) and are swapped for Kick's copy when it arrives
  const pending = [];
  function sending(text) {
    const me = (SinnersLinks.links && SinnersLinks.links.kick) || "You";
    message({ id: "", user: me, color: "", badges: [], images: [], content: text, reply: null });
    const row = list.lastElementChild;
    row.classList.add("pending");
    const item = { row, me: me.toLowerCase() };
    pending.push(item);
    const drop = () => {
      row.remove();
      const i = pending.indexOf(item);
      if (i >= 0) pending.splice(i, 1);
    };
    setTimeout(drop, 20000);
    return {
      fail() {
        row.classList.add("failed");
        setTimeout(drop, 3000);
      },
    };
  }

  // ---------- Reading ----------
  async function poll(fresh = false) {
    clearTimeout(timer);
    if (stopped) return;
    try {
      const res = await fetch(`${API}/kick/messages/${info.channelId}${fresh ? "?fresh=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (first) {
        list.querySelector(".tchat-system").textContent = `Welcome to ${info.name}'s chat!`;
        first = false;
      }
      if (failures >= 3) system("Back in chat.");
      failures = 0;
      data.messages.forEach((m) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        const mine = pending.findIndex((p) => p.me === String(m.user || "").toLowerCase());
        if (mine >= 0) pending.splice(mine, 1)[0].row.remove();
        message(m);
      });
      if (seen.size > 600) [...seen].slice(0, 300).forEach((id) => seen.delete(id));
    } catch (e) {
      if (++failures === 3) system("Can't reach Kick chat right now. Trying again…");
    }
    if (!stopped) timer = setTimeout(poll, document.hidden ? 8000 : failures ? 6000 : 2500);
  }

  async function start() {
    try {
      const res = await fetch(`${API}/kick/chat/${channel}`);
      info = await res.json();
      if (!res.ok) throw new Error(info.error);
    } catch (e) {
      list.replaceChildren(el("p", "tchat-system", `Couldn't load ${channel}'s Kick chat. ${e.message || ""}`));
      return;
    }
    if (stopped) return;
    info.emotes.forEach((g) => {
      g.emotes.forEach((e) => kickEmotes.set(e.name, e.id));
      groups.push({
        name: g.kind === "global" ? "Kick" : g.kind === "emoji" ? "Emoji" : g.name,
        emotes: g.emotes.map((e) => ({ name: e.name, src: `https://files.kick.com/emotes/${e.id}/fullsize`, note: e.subs ? "Subscribers only" : "" })),
      });
    });
    poll();
    // 7TV: the channel's set plus 7TV's global emotes (shown as pictures, sent as words)
    try {
      const [user, global] = await Promise.all([
        fetch(`https://7tv.io/v3/users/kick/${info.broadcasterId}`).then((r) => (r.ok ? r.json() : null)),
        fetch("https://7tv.io/v3/emote-sets/global").then((r) => (r.ok ? r.json() : null)),
      ]);
      const sevenGroup = { name: "7TV", emotes: [] };
      [((user && user.emote_set) || {}).emotes, (global || {}).emotes].forEach((set) =>
        (set || []).forEach((e) => {
          const host = e.data && e.data.host;
          if (!host || sevenTv.has(e.name)) return;
          const src = `https:${host.url}/1x.webp`;
          sevenTv.set(e.name, src);
          sevenGroup.emotes.push({ name: e.name, src });
        })
      );
      if (sevenGroup.emotes.length) groups.push(sevenGroup);
    } catch (e) {}
  }

  // ---------- Typing ----------
  const stopSend = mountChatSend(foot, "kick", channel, {
    picker: () => groups,
    // Kick emotes picked by name are sent as Kick's emote codes, so they show as emotes on Kick too
    encode: (text) =>
      text
        .split(/(\s+)/)
        .map((w) => (kickEmotes.has(w) ? `[emote:${kickEmotes.get(w)}:${w}]` : w))
        .join(""),
    extra: () => ({ broadcasterId: info && info.broadcasterId }),
    onSending: sending,
    onSent: () => {
      clearTimeout(timer);
      timer = setTimeout(() => poll(true), 400);
    },
  });

  const wake = () => !document.hidden && info && !stopped && poll();
  document.addEventListener("visibilitychange", wake);
  start();

  return () => {
    stopped = true;
    clearTimeout(timer);
    stopSend();
    document.removeEventListener("visibilitychange", wake);
  };
}
