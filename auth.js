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
    login() {
      location.href = `${WORKER_URL.replace(/\/$/, "")}/auth/discord?return=${encodeURIComponent(location.href.split("#")[0])}`;
    },
    logout() {
      set("");
    },
    // The server said the session is no longer valid (expired or banned)
    expire() {
      set("");
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };
})();

// Menu button
(() => {
  const nav = document.getElementById("nav-links");
  if (!nav) return;
  const li = document.createElement("li");
  li.className = "nav-auth";
  nav.append(li);

  const render = (user) => {
    li.replaceChildren();
    if (!user) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "login-btn";
      btn.textContent = "Log in";
      btn.title = "Log in with Discord";
      btn.addEventListener("click", SinnersAuth.login);
      li.append(btn);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "profile";
    if (user.avatar) {
      const img = document.createElement("img");
      img.src = user.avatar;
      img.alt = "";
      wrap.append(img);
    }
    const name = document.createElement("span");
    name.textContent = user.name;
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Log out";
    out.addEventListener("click", SinnersAuth.logout);
    wrap.append(name, out);
    li.append(wrap);
  };

  render(SinnersAuth.user);
  SinnersAuth.onChange(render);
  if (SinnersAuth.notice) alert(SinnersAuth.notice);
})();
