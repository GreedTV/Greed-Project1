// Live alerts: visitors turn on 🔔 for Kick or YouTube streamers on the Watch page.
// While any page of the site is open, this checks them every minute and shows a banner
// (with a short sound) when one goes live. Twitch can't be checked without a developer key.
//
// SinnersAlerts.has(s) / toggle(s) / canAlert(s)   s = { platform, channel, label }

const SinnersAlerts = (() => {
  const KEY = "sinners-live-alerts";
  const SHOWN_KEY = "sinners-live-shown"; // already announced in this browser session
  const EVERY_MS = 60000;

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(KEY) || "[]").filter((a) => a && a.platform && a.channel);
  } catch (e) {}

  let shown = new Set();
  try {
    shown = new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) || "[]"));
  } catch (e) {}

  const idOf = (s) => `${s.platform}:${s.channel}`.toLowerCase();
  const listeners = [];

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]));
    } catch (e) {}
  }

  const canAlert = (s) => (s.platform === "kick" && !!s.channel) || (s.platform === "youtube" && /^UC[\w-]{22}$/.test(s.channel || ""));
  const has = (s) => list.some((a) => idOf(a) === idOf(s));

  function toggle(s) {
    if (has(s)) list = list.filter((a) => idOf(a) !== idOf(s));
    else if (canAlert(s)) list.push({ platform: s.platform, channel: s.channel, label: s.label || s.channel });
    save();
    listeners.forEach((fn) => fn());
    if (has(s)) check(); // see right away whether they're already live
    return has(s);
  }

  // { live, title } for one streamer
  async function status(a) {
    if (a.platform === "kick") {
      const res = await fetch(`https://kick.com/api/v2/channels/${a.channel}`);
      if (!res.ok) return { live: false };
      const data = await res.json();
      return { live: !!data.livestream, title: data.livestream && data.livestream.session_title };
    }
    const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/youtube/live?channel=${a.channel}`);
    if (!res.ok) return { live: false };
    const data = await res.json();
    return { live: !!data.live, title: data.title };
  }

  // ---------- Banner ----------

  let banner = null;
  const originalTitle = () => document.title.replace(/^🔴 /, "");

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

  function announce(a, title) {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "live-banner";
      banner.setAttribute("role", "alert");
      document.body.append(banner);
    }
    banner.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "live-dot";
    const text = document.createElement("strong");
    text.textContent = `${a.label} is live${title ? `: ${title}` : "!"}`;
    const watch = document.createElement("a");
    watch.className = "button";
    watch.textContent = "Watch now";
    watch.href = `/watch?platform=${a.platform}&add=${encodeURIComponent(a.channel)}`;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-action";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Dismiss");
    const hide = () => {
      banner.hidden = true;
      document.title = originalTitle();
    };
    close.addEventListener("click", hide);
    watch.addEventListener("click", hide);
    banner.append(dot, text, watch, close);
    banner.hidden = false;
    document.title = `🔴 ${originalTitle()}`;
    beep();
  }

  // ---------- Checking ----------

  let checking = false;
  async function check() {
    if (checking || !list.length) return;
    checking = true;
    try {
      for (const a of [...list]) {
        try {
          const now = await status(a);
          const id = idOf(a);
          if (now.live && !shown.has(id)) {
            shown.add(id);
            announce(a, now.title);
          } else if (!now.live) {
            shown.delete(id); // announce again next time they go live
          }
        } catch (e) {}
      }
      save();
    } finally {
      checking = false;
    }
  }

  setTimeout(check, 3000);
  setInterval(check, EVERY_MS);

  return { has, toggle, canAlert, onChange: (fn) => listeners.push(fn) };
})();
