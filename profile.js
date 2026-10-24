// Profile page: your stats, your pixel adventurer with 8 gear slots and a bag, and a world map to
// send the adventurer on timed adventures. Everything is decided by the Worker (/hero, /profile).

const API = WORKER_URL.replace(/\/$/, "");
const SVG_NS = "http://www.w3.org/2000/svg";
const SLOT_INFO = {
  helmet: ["🪖", "Helmet"],
  chest: ["🥋", "Chest"],
  legs: ["👖", "Legs"],
  shoes: ["🥾", "Shoes"],
  gloves: ["🧤", "Gloves"],
  weapon: ["⚔️", "Weapon"],
  shield: ["🛡️", "Shield"],
  ring: ["💍", "Ring"],
};
const LEFT_SLOTS = ["helmet", "chest", "legs", "shoes"];
const RIGHT_SLOTS = ["weapon", "shield", "gloves", "ring"];
const RARITY = {
  common: ["Common", "#9ca3af", "#6b7280"],
  uncommon: ["Uncommon", "#22c55e", "#15803d"],
  rare: ["Rare", "#3b82f6", "#1d4ed8"],
  epic: ["Epic", "#a855f7", "#7e22ce"],
  legendary: ["Legendary", "#f59e0b", "#b45309"],
};
// Where each region sits on the map (in a 600 x 340 picture)
const MAP_SPOTS = {
  forest: { x: 110, y: 240 },
  caves: { x: 225, y: 105 },
  swamp: { x: 330, y: 255 },
  mountains: { x: 460, y: 95 },
  abyss: { x: 520, y: 250 },
};

const $ = (id) => document.getElementById(id);
let state = null;
let selectedItem = null;
let selectedPlace = null;
let busy = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) SinnersAuth.expire();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// ---------- Pixel adventurer ----------
// A 16 x 22 pixel character drawn as SVG squares. Gear is drawn over the body in its rarity color.

function heroSvg(look, worn) {
  const px = [];
  const put = (x, y, w, h, color) => px.push([x, y, w, h, color]);
  const shade = (slot) => RARITY[(worn[slot] || {}).rarity || "common"];

  // Body
  put(5, 2, 6, 6, look.skin); // head
  put(6, 4, 1, 1, look.eyes);
  put(9, 4, 1, 1, look.eyes);
  put(7, 6, 2, 1, "rgba(0,0,0,0.25)"); // mouth
  put(7, 8, 2, 1, look.skin); // neck
  put(4, 9, 8, 5, look.shirt); // shirt
  put(2, 9, 2, 2, look.shirt); // sleeves
  put(12, 9, 2, 2, look.shirt);
  put(2, 11, 2, 3, look.skin); // arms
  put(12, 11, 2, 3, look.skin);
  put(2, 14, 2, 1, look.skin); // hands
  put(12, 14, 2, 1, look.skin);
  put(4, 14, 8, 1, "#3f2d20"); // belt
  put(5, 15, 3, 4, look.pants); // legs
  put(8, 15, 3, 4, look.pants);
  put(4, 19, 4, 1, "#2b1d14"); // feet
  put(8, 19, 4, 1, "#2b1d14");

  // Hair (hidden under a helmet)
  if (!worn.helmet) {
    const h = look.hair;
    if (look.style === 2) [5, 7, 9].forEach((x) => put(x, 0, 1, 1, h));
    if (look.style === 3) {
      put(7, 0, 2, 2, h);
      put(6, 2, 4, 1, h);
    } else {
      put(5, 1, 6, 1, h);
      put(4, 2, 8, 1, h);
      put(4, 3, 1, 1, h);
      put(11, 3, 1, 1, h);
      if (look.style === 1) {
        put(4, 3, 1, 6, h);
        put(11, 3, 1, 6, h);
      }
    }
  }

  // Gear
  if (worn.legs) {
    const [, c, d] = shade("legs");
    put(5, 15, 3, 4, c);
    put(8, 15, 3, 4, c);
    put(7, 15, 1, 4, d);
  }
  if (worn.chest) {
    const [, c, d] = shade("chest");
    put(4, 9, 8, 5, c);
    put(2, 9, 2, 2, c);
    put(12, 9, 2, 2, c);
    put(7, 10, 2, 3, d);
  }
  if (worn.shoes) {
    const [, c] = shade("shoes");
    put(4, 18, 4, 2, c);
    put(8, 18, 4, 2, c);
  }
  if (worn.gloves) {
    const [, c] = shade("gloves");
    put(2, 13, 2, 2, c);
    put(12, 13, 2, 2, c);
  }
  if (worn.helmet) {
    const [, c, d] = shade("helmet");
    put(5, 0, 6, 1, c);
    put(4, 1, 8, 2, c);
    put(4, 3, 1, 3, c);
    put(11, 3, 1, 3, c);
    put(7, 1, 2, 1, d);
  }
  if (worn.ring) {
    const [, c] = shade("ring");
    put(3, 14, 1, 1, c);
    put(2, 15, 1, 1, "rgba(255,255,255,0.8)"); // sparkle
  }
  if (worn.weapon) {
    const [, c, d] = shade("weapon");
    put(14, 4, 1, 9, c); // blade
    put(15, 5, 1, 7, "rgba(255,255,255,0.35)");
    put(13, 13, 3, 1, d); // guard
    put(14, 14, 1, 2, "#5b3a1e"); // grip
  }
  if (worn.shield) {
    const [, c, d] = shade("shield");
    put(0, 10, 3, 5, c);
    put(1, 11, 1, 3, d);
  }

  const root = svg("svg", { viewBox: "-1 -1 18 23", class: "hero-sprite", "shape-rendering": "crispEdges", role: "img" });
  root.setAttribute("aria-label", "Your adventurer");
  px.forEach(([x, y, w, h, fill]) => root.append(svg("rect", { x, y, width: w, height: h, fill })));
  return root;
}

// ---------- Rendering ----------

const wornMap = () => Object.fromEntries(state.items.filter((i) => i.equipped).map((i) => [i.slot, i]));

function itemIcon(item, big) {
  const box = el("span", "item-icon" + (big ? " big" : ""));
  box.style.setProperty("--rarity", RARITY[item.rarity] ? RARITY[item.rarity][1] : "#9ca3af");
  if (item.icon) {
    const img = el("img");
    img.src = API + item.icon;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.replaceWith(document.createTextNode(SLOT_INFO[item.slot][0]));
    box.append(img);
  } else box.append(SLOT_INFO[item.slot][0]);
  return box;
}

function renderHero() {
  const h = state.hero;
  const worn = wornMap();
  $("hero-name").textContent = h.name;
  $("hero-level").textContent = `Level ${h.level}`;
  $("xp-fill").style.width = h.next ? `${Math.min(100, (h.xp / h.next) * 100)}%` : "100%";
  $("xp-text").textContent = h.next ? `${h.xp} / ${h.next} XP to level ${h.level + 1}` : "Max level reached!";
  const figure = $("hero-figure");
  figure.replaceChildren(heroSvg(h.look, worn));
  figure.classList.toggle("away", !!state.expedition && !state.expedition.done);
  $("hero-power").textContent = `💪 Power ${h.power} · 🏆 ${h.wins} / ${h.runs} adventures won`;

  const slot = (name) => {
    const item = worn[name];
    const b = el("button", "gear-slot" + (item ? " filled" : ""));
    b.type = "button";
    b.title = item ? `${item.name} (+${item.power})` : `${SLOT_INFO[name][1]}: empty`;
    if (item) {
      b.append(itemIcon(item));
      b.addEventListener("click", () => selectItem(item));
    } else {
      b.append(el("span", "slot-empty", SLOT_INFO[name][0]));
      b.disabled = true;
    }
    b.append(el("small", null, SLOT_INFO[name][1]));
    return b;
  };
  $("gear-left").replaceChildren(...LEFT_SLOTS.map(slot));
  $("gear-right").replaceChildren(...RIGHT_SLOTS.map(slot));
}

function renderBag() {
  const bagItems = state.items.filter((i) => !i.equipped);
  $("bag-count").textContent = `(${bagItems.length} / ${state.bagSize})`;
  const cells = bagItems.map((item) => {
    const b = el("button", "bag-cell" + (selectedItem && selectedItem.id === item.id ? " selected" : ""));
    b.type = "button";
    b.title = `${item.name} (+${item.power})`;
    b.append(itemIcon(item), el("span", "bag-power", `+${item.power}`));
    b.addEventListener("click", () => selectItem(item));
    return b;
  });
  while (cells.length < state.bagSize) cells.push(el("span", "bag-cell empty"));
  $("bag").replaceChildren(...cells);
}

function selectItem(item) {
  selectedItem = item;
  renderBag();
  const panel = $("item-panel");
  const [label, color] = RARITY[item.rarity] || RARITY.common;
  const head = el("div", "item-head");
  const name = el("strong", null, item.name);
  name.style.color = color;
  const info = el("div");
  info.append(name, el("span", "hint", `${label} ${SLOT_INFO[item.slot][1].toLowerCase()} · tier ${item.tier} · ${item.source === "shop" ? "bought in the shop" : "found on an adventure"}`));
  head.append(itemIcon(item, true), info);

  const worn = wornMap()[item.slot];
  const compare =
    item.equipped || !worn
      ? `+${item.power} power`
      : `+${item.power} power (${item.power >= worn.power ? "▲" : "▼"} ${Math.abs(item.power - worn.power)} vs. your ${worn.name})`;
  const actions = el("div", "item-actions");
  const msg = el("p", "form-msg");
  const act = (text, cls, body, confirmText) => {
    const b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", async () => {
      if (confirmText && !confirm(confirmText)) return;
      b.disabled = true;
      try {
        const res = await api("/hero", body);
        state = res.state;
        selectedItem = state.items.find((i) => i.id === item.id) || null;
        renderAll();
        if (res.soldFor) showResult(`🪙 Sold ${item.name} for ${res.soldFor} points.`);
        if (selectedItem) selectItem(selectedItem);
        else $("item-panel").replaceChildren(el("p", "hint", "Click an item in your bag or a gear slot to see it."));
      } catch (err) {
        msg.className = "form-msg error";
        msg.textContent = err.message;
        b.disabled = false;
      }
    });
    actions.append(b);
  };
  if (item.equipped) act("Take off", "button ghost", { action: "unequip", slot: item.slot });
  else {
    act("Equip", "button", { action: "equip", item: item.id });
    act(`Sell for ${item.sell} 🪙`, "button ghost", { action: "sell", item: item.id }, `Sell ${item.name} for ${item.sell} points?`);
  }
  panel.replaceChildren(head, el("p", "item-power", compare), actions, msg);
}

// ---------- World map ----------

function renderMap() {
  const map = $("world-map");
  const root = svg("svg", { viewBox: "0 0 600 340", class: "map-svg" });
  const defs = svg("defs");
  defs.innerHTML =
    '<radialGradient id="abyss-glow"><stop offset="0" stop-color="#ff0033" stop-opacity="0.9"/><stop offset="1" stop-color="#ff0033" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3a26"/><stop offset="1" stop-color="#1f2a1b"/></linearGradient>';
  root.append(defs);
  // Land and sea
  root.append(svg("rect", { width: 600, height: 340, rx: 14, fill: "#10202e" }));
  root.append(svg("path", { d: "M30 60 Q90 15 220 30 T430 25 Q560 30 575 120 Q590 220 560 300 Q470 335 300 320 Q120 330 45 290 Q10 200 30 60 Z", fill: "url(#land)", stroke: "#3b4a33", "stroke-width": 3 }));
  // Terrain hints
  [[70, 215], [95, 270], [140, 225], [60, 255], [150, 275]].forEach(([x, y]) => root.append(svg("path", { d: `M${x} ${y - 22} l12 22 h-24 Z`, fill: "#1f5130" })));
  [[420, 120], [455, 70], [500, 115]].forEach(([x, y]) => {
    root.append(svg("path", { d: `M${x - 34} ${y + 25} L${x} ${y - 30} L${x + 34} ${y + 25} Z`, fill: "#4b5563" }));
    root.append(svg("path", { d: `M${x - 11} ${y - 12} L${x} ${y - 30} L${x + 11} ${y - 12} Z`, fill: "#e5e7eb" }));
  });
  root.append(svg("ellipse", { cx: 330, cy: 262, rx: 70, ry: 34, fill: "#24402f", opacity: 0.9 }));
  root.append(svg("ellipse", { cx: 225, cy: 112, rx: 48, ry: 34, fill: "#3f3a35" }));
  root.append(svg("circle", { cx: 520, cy: 255, r: 55, fill: "url(#abyss-glow)", class: "abyss-glow" }));
  // The trail between places
  const order = ["forest", "caves", "swamp", "mountains", "abyss"];
  const trail = order.map((id, i) => `${i ? "L" : "M"}${MAP_SPOTS[id].x} ${MAP_SPOTS[id].y}`).join(" ");
  root.append(svg("path", { d: trail, fill: "none", stroke: "#d6c7a1", "stroke-width": 2.5, "stroke-dasharray": "6 7", opacity: 0.55 }));

  const trip = state.expedition;
  state.dungeons.forEach((d) => {
    const { x, y } = MAP_SPOTS[d.id];
    const g = svg("g", { class: `map-spot${d.open ? "" : " locked"}${selectedPlace === d.id ? " selected" : ""}${trip && trip.dungeon === d.id ? " active" : ""}`, tabindex: 0, role: "button" });
    g.setAttribute("aria-label", d.open ? `${d.name}, level ${d.level}` : `${d.name}, unlocks at level ${d.level}`);
    g.append(svg("circle", { cx: x, cy: y, r: 30, class: "spot-ring" }));
    const icon = svg("text", { x, y: y + 11, "text-anchor": "middle", "font-size": 30 });
    icon.textContent = d.open ? d.emoji : "🔒";
    g.append(icon);
    const label = svg("text", { x, y: y + 50, "text-anchor": "middle", class: "spot-label" });
    label.textContent = d.open ? d.name : `${d.name} · Lv ${d.level}`;
    g.append(label);
    const choose = () => {
      selectedPlace = d.id;
      renderMap();
      renderTrip();
    };
    g.addEventListener("click", choose);
    g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), choose()));
    root.append(g);
  });
  // The adventurer's marker while away
  if (trip) {
    const { x, y } = MAP_SPOTS[trip.dungeon];
    const flag = svg("text", { x: x + 26, y: y - 22, "font-size": 22, class: "trip-flag" });
    flag.textContent = trip.done ? "🎁" : "🚩";
    root.append(flag);
  }
  map.replaceChildren(root);
}

const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s % 60).padStart(2, "0")}`;
};

let clockSkew = 0;
function renderTrip() {
  const box = $("trip");
  const trip = state.expedition;
  if (trip) {
    const d = state.dungeons.find((x) => x.id === trip.dungeon);
    const now = Date.now() + clockSkew;
    const done = now >= trip.end;
    const pct = Math.min(100, ((now - trip.start) / (trip.end - trip.start)) * 100);
    const bar = el("div", "xp-bar trip-bar");
    const fill = el("span");
    fill.style.width = `${pct}%`;
    bar.append(fill);
    const title = el("strong", null, done ? `${d.emoji} Back from ${d.name}!` : `${d.emoji} Exploring ${d.name}…`);
    const parts = [title, bar];
    if (done) {
      const b = el("button", "button", "🎁 Collect rewards");
      b.type = "button";
      b.addEventListener("click", collect);
      parts.push(b);
    } else parts.push(el("span", "hint", `Back in ${fmtTime(trip.end - now)}. You can close the page; they'll keep going.`));
    box.replaceChildren(...parts);
    return;
  }
  const d = state.dungeons.find((x) => x.id === selectedPlace) || state.dungeons.find((x) => x.open);
  if (!d) return box.replaceChildren();
  const facts = el("ul", "trip-facts");
  [
    ["⏱️", `${d.minutes >= 60 ? `${d.minutes / 60} h` : `${d.minutes} min`}`],
    ["✨", `${d.xp[0]}–${d.xp[1]} XP`],
    ["🎯", `${d.chance}% chance to win (power ${state.hero.power} vs. ${d.power} recommended)`],
    ["🎁", `${Math.round(d.loot * 100)}% chance of loot when you win`],
  ].forEach(([i, t]) => {
    const li = el("li");
    li.append(el("span", null, i), document.createTextNode(` ${t}`));
    facts.append(li);
  });
  const parts = [el("strong", null, `${d.open ? d.emoji : "🔒"} ${d.name}`), facts];
  if (d.open) {
    const go = el("button", "button", `Send ${state.hero.name} here`);
    go.type = "button";
    go.addEventListener("click", () => send(d));
    parts.push(go);
  } else parts.push(el("span", "hint", `Unlocks at adventurer level ${d.level}.`));
  box.replaceChildren(...parts);
}

function renderAll() {
  renderHero();
  renderBag();
  renderMap();
  renderTrip();
}

function showResult(html) {
  const box = $("adv-result");
  box.replaceChildren(...(Array.isArray(html) ? html : [html]).map((line) => el("p", null, line)));
  box.hidden = false;
}

async function send(d) {
  if (busy) return;
  busy = true;
  try {
    await api("/hero", { action: "dungeon", dungeon: d.id });
    await loadHero();
    $("adv-result").hidden = true;
  } catch (err) {
    showResult(`⚠️ ${err.message}`);
  } finally {
    busy = false;
  }
}

async function collect() {
  if (busy) return;
  busy = true;
  try {
    const r = await api("/hero", { action: "collect" });
    state = r.state;
    clockSkew = state.now - Date.now();
    const lines = [r.won ? `🏆 Victory in ${r.dungeon.name}! +${r.xp} XP` : `💀 Defeated in ${r.dungeon.name}… but you still learned something: +${r.xp} XP`];
    if (r.item) {
      const [label] = RARITY[r.item.rarity];
      lines.push(r.soldFor ? `Found a ${label} ${r.item.name}, but your bag was full, so it was sold for ${r.soldFor} 🪙.` : `🎁 Found: ${r.item.name} (${label}, +${r.item.power} power). It's in your bag.`);
    } else if (r.won) lines.push("No loot this time.");
    if (r.levels.length) lines.push(`⬆️ Level up! You're level ${r.level} now (+${r.reward} 🪙).`);
    showResult(lines);
    $("adv-result").classList.toggle("win", r.won);
    renderAll();
    loadProfile();
  } catch (err) {
    showResult(`⚠️ ${err.message}`);
  } finally {
    busy = false;
  }
}

$("hero-reroll").addEventListener("click", async () => {
  try {
    state = (await api("/hero", { action: "look" })).state;
    renderHero();
  } catch (err) {
    showResult(`⚠️ ${err.message}`);
  }
});

// ---------- Profile numbers ----------

const GAME_FORMAT = {
  reaction: ["⚡ Quick Draw", (v) => `${Math.round(v)} ms`],
  aim: ["🎯 Target Rush", (v) => `${v} hits`],
  typing: ["⌨️ Chat Typer", (v) => `${v} words`],
};

async function loadProfile() {
  try {
    const p = await api("/profile");
    const head = $("profile-head");
    const avatar = p.user.avatar ? Object.assign(el("img", "profile-avatar"), { src: p.user.avatar, alt: "" }) : el("span", "profile-avatar", p.user.name.charAt(0).toUpperCase());
    const info = el("div", "profile-who");
    info.append(el("h1", null, p.user.name), el("span", "hint", p.joined ? `Member since ${new Date(p.joined).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}` : "Sinners member"));
    const pts = el("div", "profile-points");
    pts.append(el("strong", null, `🪙 ${p.points.toLocaleString()}`), el("span", "hint", `#${p.rank} on the points list`));
    head.replaceChildren(avatar, info, pts);

    const tiles = [
      ["⚔️", "Adventurer level", state ? state.hero.level : "–"],
      ["🎲", "Bets won", `${p.bets.won} / ${p.bets.placed}`, p.bets.profit ? `${p.bets.profit > 0 ? "+" : ""}${p.bets.profit} 🪙 won` : null],
      ["🛒", "Shop purchases", p.purchases],
      ["💬", "Chat messages", p.messages],
      ...Object.entries(GAME_FORMAT).map(([id, [label, f]]) => [label.split(" ")[0], label.slice(label.indexOf(" ") + 1), p.bests[id] != null ? f(p.bests[id]) : "–", "best"]),
    ];
    $("profile-stats").replaceChildren(
      ...tiles.map(([icon, label, value, note]) => {
        const box = el("div", "community-item");
        box.append(el("span", "community-icon", icon), el("strong", null, String(value)), el("span", null, label));
        if (note) box.append(el("small", null, note));
        return box;
      })
    );
  } catch (e) {}
}

async function loadHero() {
  state = await api("/hero");
  clockSkew = state.now - Date.now();
  if (!selectedPlace) selectedPlace = state.expedition ? state.expedition.dungeon : (state.dungeons.filter((d) => d.open).pop() || {}).id;
  renderAll();
}

// ---------- Start ----------

async function start() {
  const loggedIn = !!SinnersAuth.user;
  $("profile-login").hidden = loggedIn;
  $("profile").hidden = !loggedIn;
  if (!loggedIn) return;
  try {
    await loadHero();
    loadProfile();
  } catch (err) {
    $("profile-head").replaceChildren(el("p", "hint", `Couldn't load your profile: ${err.message}`));
  }
}

$("profile-login-btn").addEventListener("click", SinnersAuth.login);
start();
const stopAuthWatch = SinnersAuth.onChange(start);
// Count down while away; when the adventurer is back, show the Collect button
const ticker = setInterval(() => {
  if (!state || !state.expedition || document.hidden) return;
  renderTrip();
  const done = Date.now() + clockSkew >= state.expedition.end;
  if (done && !state.expedition.done) {
    state.expedition.done = true;
    renderHero();
    renderMap();
  }
}, 1000);

SinnersNav.onLeave(() => {
  clearInterval(ticker);
  stopAuthWatch();
});
