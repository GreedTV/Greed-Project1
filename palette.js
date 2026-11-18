// Quick search (Ctrl+K, ⌘K or "/"): jump to any page or section, start watching a streamer by name,
// switch the theme, log in or out. Arrow keys pick, Enter opens, Esc closes. Also a search button in the header.

const SinnersPalette = (() => {
  const PAGES = [
    { icon: "🏠", label: "Home", hint: "Featured streamers", url: "/" },
    { icon: "▶️", label: "Watch", hint: "Kick, Twitch and YouTube side by side", url: "/watch" },
    { icon: "📺", label: "Content", hint: "Browse YouTube while you wait", url: "/content" },
    { icon: "🛒", label: "Shop", hint: "Gear, potions, cosmetics, rewards", url: "/shop" },
    { icon: "🖼️", label: "Gallery", hint: "Community clips and images", url: "/gallery" },
    { icon: "👤", label: "Profile", hint: "Your adventurer and stats", url: "/profile" },
    { icon: "🗺️", label: "Dungeons", hint: "World map and dungeon floors", url: "/profile#world-map" },
    { icon: "🔮", label: "Class & skills", hint: "Warrior, Rogue or Mage", url: "/profile#skills" },
    { icon: "🔨", label: "Forge", hint: "Upgrade and craft gear", url: "/profile#forge" },
    { icon: "🏟️", label: "Arena", hint: "Duel other players", url: "/profile#arena" },
    { icon: "👹", label: "World boss", hint: "This week's boss", url: "/profile#boss" },
    { icon: "📅", label: "Daily quests", hint: "Quests and login streak", url: "/profile#daily" },
    { icon: "📊", label: "Stats", hint: "Who's online, visitors", url: "/stats" },
    { icon: "ℹ️", label: "About", hint: "What Sinners is", url: "/about" },
  ];
  const PLATFORMS = [
    { id: "kick", label: "Kick" },
    { id: "twitch", label: "Twitch" },
    { id: "youtube", label: "YouTube" },
  ];
  let overlay = null;
  let input = null;
  let list = null;
  let items = [];
  let active = 0;
  let lastFocus = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const go = (url) => {
    close();
    if (typeof SinnersNav !== "undefined") SinnersNav.go(new URL(url, location.href).href);
    else location.href = url;
  };

  function actions() {
    const user = typeof SinnersAuth !== "undefined" && SinnersAuth.user;
    const out = [
      {
        icon: document.documentElement.dataset.theme === "light" ? "🌙" : "☀️",
        label: document.documentElement.dataset.theme === "light" ? "Dark theme" : "Light theme",
        hint: "Switch colors",
        run: () => {
          SinnersTheme.toggle();
          close();
        },
      },
      { icon: "💬", label: "Join the Discord", hint: "Shadow Station", run: () => (close(), window.open(DISCORD_INVITE, "_blank", "noopener")) },
    ];
    if (user) out.push({ icon: "🚪", label: "Log out", hint: user.name, run: () => (close(), SinnersAuth.logout()) });
    else out.push({ icon: "🔑", label: "Log in", hint: "Discord, Twitch or Kick", run: () => (close(), SinnersAuth.login()) });
    return out;
  }

  // Every entry that matches the words typed, best matches first
  function search(text) {
    const q = text.trim().toLowerCase();
    const score = (e) => {
      const label = e.label.toLowerCase();
      if (!q) return 1;
      if (label.startsWith(q)) return 3;
      if (label.includes(q)) return 2;
      return (e.hint || "").toLowerCase().includes(q) ? 1 : 0;
    };
    const found = [...PAGES.map((p) => ({ ...p, run: () => go(p.url) })), ...actions()]
      .map((e) => ({ e, s: score(e) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
    // Anything that could be a channel name: watch it
    const name = text.trim().replace(/^@/, "");
    if (/^[\w.-]{2,40}$/.test(name)) {
      PLATFORMS.forEach((p) =>
        found.push({
          icon: "▶️",
          label: `Watch ${name} on ${p.label}`,
          hint: "Opens on the Watch page",
          run: () => go(`/watch?platform=${p.id}&add=${encodeURIComponent(p.id === "youtube" ? `@${name}` : name)}`),
        })
      );
    }
    return found.slice(0, 12);
  }

  function render() {
    items = search(input.value);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren(
      ...items.map((item, i) => {
        const li = el("li", "palette-item" + (i === active ? " active" : ""));
        li.id = `palette-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === active));
        li.append(el("span", "palette-icon", item.icon), el("span", "palette-label", item.label), el("span", "palette-hint", item.hint || ""));
        li.addEventListener("mousemove", () => {
          if (active === i) return;
          active = i;
          paintActive();
        });
        li.addEventListener("click", () => item.run());
        return li;
      })
    );
    if (!items.length) list.append(el("li", "palette-empty", "Nothing found"));
    input.setAttribute("aria-activedescendant", items.length ? `palette-${active}` : "");
  }

  function paintActive() {
    [...list.children].forEach((li, i) => {
      li.classList.toggle("active", i === active);
      li.setAttribute("aria-selected", String(i === active));
    });
    input.setAttribute("aria-activedescendant", `palette-${active}`);
    const li = list.children[active];
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  function build() {
    overlay = el("div", "palette-overlay");
    overlay.hidden = true;
    const box = el("div", "palette");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Quick search");
    const head = el("div", "palette-head");
    input = el("input", "palette-input");
    input.type = "search";
    input.placeholder = "Search pages, or type a streamer to watch…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", "palette-list");
    head.append(el("span", "palette-glass", "⌕"), input, el("kbd", null, "Esc"));
    list = el("ul", "palette-list");
    list.id = "palette-list";
    list.setAttribute("role", "listbox");
    const foot = el("div", "palette-foot");
    foot.append(el("span", null, "↑↓ to pick"), el("span", null, "Enter to open"), el("span", null, "Ctrl K anywhere"));
    box.append(head, list, foot);
    overlay.append(box);
    document.body.append(overlay);
    overlay.addEventListener("click", (e) => e.target === overlay && close());
    input.addEventListener("input", () => {
      active = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        paintActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (items[active]) items[active].run();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
  }

  function open() {
    if (!overlay) build();
    if (!overlay.hidden) return;
    lastFocus = document.activeElement;
    input.value = "";
    active = 0;
    render();
    overlay.hidden = false;
    document.documentElement.classList.add("palette-open");
    input.focus();
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove("palette-open");
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      overlay && !overlay.hidden ? close() : open();
    } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      open();
    }
  });

  // The search button in the header
  const actionsBox = document.getElementById("nav-actions");
  if (actionsBox) {
    const btn = el("button", "icon-action palette-btn");
    btn.type = "button";
    btn.title = "Search (Ctrl K)";
    btn.setAttribute("aria-label", "Search");
    btn.append(el("span", "palette-glass", "⌕"), el("kbd", null, /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"));
    btn.addEventListener("click", open);
    actionsBox.prepend(btn);
  }

  return { open, close };
})();
