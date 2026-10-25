// Discord login, shared by all pages. Adds a "Log in" / profile button to the menu.
// The Worker signs the session; this page only stores it and shows the name and avatar.

const SinnersAuth = (() => {
  const KEY = "sinners-session";
  const listeners = [];
  let token = "";
  let user = null;

  function decode(t) {
    try {
      const data = JSON.parse(atob(t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
      return data.exp > Date.now() ? { id: data.id, name: data.name, avatar: data.avatar } : null;
    } catch (e) {
      return null;
    }
  }

  function set(newToken) {
    token = newToken || "";
    user = token ? decode(token) : null;
    if (!user) token = "";
    try {
      token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY);
    } catch (e) {}
    listeners.forEach((fn) => fn(user));
  }

  // Coming back from Discord: #session=... or #login=cancelled|failed|banned
  let notice = "";
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("session") || hash.has("login")) {
    if (hash.get("session")) set(hash.get("session"));
    const result = hash.get("login");
    if (result === "banned") notice = "This Discord account is banned from Sinners chat.";
    if (result === "failed") notice = "Discord login failed. Please try again.";
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (!token) {
    try {
      set(localStorage.getItem(KEY));
    } catch (e) {}
  }

  return {
    get user() {
      return user;
    },
    get token() {
      return token;
    },
    notice,
    // Shows the login choices (Discord, Twitch, Kick); all of them can be connected to one account
    login() {
      showLoginChooser();
    },
    loginWith(provider) {
      location.href = `${WORKER_URL.replace(/\/$/, "")}/auth/${provider}?return=${encodeURIComponent(location.href.split("#")[0])}`;
    },
    logout() {
      set("");
    },
    // The server said the session is no longer valid (expired or banned)
    expire() {
      set("");
    },
    // Returns a function that stops listening
    onChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
})();

// Login chooser: one Sinners account, log in with whichever you like (connect the others on your Profile)
const LOGIN_PROVIDERS = [
  ["discord", "Discord", "#5865f2", '<path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/>'],
  ["twitch", "Twitch", "#9146ff", '<path fill="currentColor" d="M4.3 2 3 5.4V19h4.6v2.5h2.6l2.5-2.5h3.7l5-5V2H4.3Zm15.4 11.1-2.9 2.9h-4.6l-2.5 2.5V16H5.8V3.8h13.9v9.3ZM16.8 6.8v5.1h-1.7V6.8h1.7Zm-4.6 0v5.1h-1.7V6.8h1.7Z"/>'],
  ["kick", "Kick", "#53fc18", '<path fill="currentColor" d="M3 3h5.5v5h2V5.5h2.3V3H18v5.5h-2.5V11h-2.3v2h2.3v2.5H18V21h-5.2v-2.5h-2.3V16h-2v5H3V3Z"/>'],
];
let loginProviders = null;

async function showLoginChooser() {
  if (!loginProviders) {
    try {
      loginProviders = (await (await fetch(`${WORKER_URL.replace(/\/$/, "")}/auth/providers`)).json()).available || {};
    } catch (e) {
      loginProviders = { discord: true };
    }
  }
  document.querySelector(".login-chooser")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay login-chooser";
  const box = document.createElement("div");
  box.className = "dialog-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = '<h2 class="dialog-title">Log in to Sinners</h2><p class="dialog-text">Pick any. You can connect the others to the same account later on your Profile.</p>';
  const list = document.createElement("div");
  list.className = "login-options";
  LOGIN_PROVIDERS.forEach(([id, name, color, icon]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `login-option login-${id}`;
    b.style.setProperty("--brand", color);
    const ready = loginProviders[id] !== false;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${ready ? `Log in with ${name}` : `${name} (coming soon)`}</span>`;
    b.disabled = !ready;
    b.addEventListener("click", () => SinnersAuth.loginWith(id));
    list.append(b);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "link-btn";
  cancel.textContent = "Cancel";
  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 150);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  cancel.addEventListener("click", close);
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  document.addEventListener("keydown", onKey);
  box.append(list, cancel);
  overlay.append(box);
  document.body.append(overlay);
  void overlay.offsetWidth;
  overlay.classList.add("show");
  list.querySelector("button:not(:disabled)")?.focus();
}

// Header button
(() => {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;
  const li = document.createElement("div");
  li.className = "nav-auth";
  actions.append(li);

  const render = (user) => {
    li.replaceChildren();
    if (!user) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "login-btn";
      btn.textContent = "Log in";
      btn.title = "Log in with Discord, Twitch or Kick";
      btn.addEventListener("click", SinnersAuth.login);
      li.append(btn);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "profile";
    // Avatar and name open the Profile page (stats, inventory, adventurer)
    const link = document.createElement("a");
    link.className = "profile-link";
    link.href = "/profile";
    link.title = "Your profile and adventurer";
    if (user.avatar) {
      const img = document.createElement("img");
      img.src = user.avatar;
      img.alt = "";
      link.append(img);
    }
    const name = document.createElement("span");
    name.textContent = user.name;
    link.append(name);
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Log out";
    out.addEventListener("click", SinnersAuth.logout);
    wrap.append(link, out);
    li.append(wrap);
  };

  render(SinnersAuth.user);
  SinnersAuth.onChange(render);
  if (SinnersAuth.notice) SinnersDialog.alert(SinnersAuth.notice, { title: "Discord login", icon: "⚠️" });
})();
