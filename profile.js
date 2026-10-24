// Profile page: your stats, your pixel adventurer (Attack / Defense / HP, 8 gear slots, a bag, potion
// boosts), a world map to send them on timed adventures, and the Arena for duels with other players.
// Everything is decided by the Worker (/hero, /profile, /arena); fights are replayed here blow by blow.

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
const statText = (s) => [s.atk && `⚔️ +${s.atk}`, s.def && `🛡️ +${s.def}`, s.hp && `❤️ +${s.hp}`].filter(Boolean).join("  ");
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

// The pixel adventurer and gear icons come from gear-art.js (shared with the Shop page)
const heroSvg = SinnersArt.heroSvg;

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
  } else box.append(SinnersArt.gearIcon(item));
  box.classList.add(`tier-${item.tier || 1}`);
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
  const stat = (icon, label, key) => {
    const box = el("div", "hero-stat");
    const boosted = h.fighting[key] > h.stats[key];
    box.title = `${label}: ${h.base[key]} from level ${h.level}, +${h.stats[key] - h.base[key]} from gear${boosted ? `, ${h.fighting[key]} with your potion` : ""}`;
    box.append(el("span", null, icon), el("strong", boosted ? "boosted" : null, String(boosted ? h.fighting[key] : h.stats[key])), el("small", null, label));
    return box;
  };
  $("hero-stats").replaceChildren(stat("⚔️", "Attack", "atk"), stat("🛡️", "Defense", "def"), stat("❤️", "HP", "hp"));
  $("hero-power").textContent = `💪 Power ${h.power} · 🏆 ${h.wins} / ${h.runs} adventures won`;
  const buffs = Object.entries(h.buffs || {});
  const boostBox = $("hero-buffs");
  if (!buffs.length) {
    const link = el("a", "link-btn", "🧪 Get potions and scrolls");
    link.href = "/shop#extras";
    boostBox.replaceChildren(link);
  } else {
    boostBox.replaceChildren(
      el("span", "hint", "Active boosts:"),
      ...buffs.map(([k, n]) => {
        const x = state.extras.find((e) => e.buff === k) || { emoji: "✨", name: k, text: "" };
        const chip = el("span", "buff-chip", `${x.emoji} ×${n}`);
        chip.title = `${x.name}: ${x.text}, ${n} use${n === 1 ? "" : "s"} left`;
        return chip;
      })
    );
  }

  const slot = (name) => {
    const item = worn[name];
    const b = el("button", "gear-slot" + (item ? " filled" : ""));
    b.type = "button";
    b.title = item ? `${item.name}: ${statText(item)}` : `${SLOT_INFO[name][1]}: empty`;
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
    b.title = `${item.name}: ${statText(item)}`;
    b.append(itemIcon(item), el("span", "bag-power", `⚡${item.power}`));
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
  const compare = el("div", "item-stats");
  [["⚔️", "atk", "Attack"], ["🛡️", "def", "Defense"], ["❤️", "hp", "HP"]].forEach(([icon, k, label]) => {
    if (!item[k] && !(worn && worn[k])) return;
    const row = el("div", "item-stat");
    row.append(el("span", null, `${icon} ${label}`), el("strong", null, `+${item[k] || 0}`));
    if (!item.equipped && worn) {
      const diff = (item[k] || 0) - (worn[k] || 0);
      if (diff) row.append(el("span", diff > 0 ? "up" : "down", `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}`));
    }
    compare.append(row);
  });
  if (!item.equipped && worn) compare.append(el("span", "hint", `Compared with your ${worn.name}`));
  const actions = el("div", "item-actions");
  const msg = el("p", "form-msg");
  const act = (text, cls, body, confirmText) => {
    const b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", async () => {
      if (confirmText && !(await SinnersDialog.confirm(confirmText, { title: "Sell this item?", yes: "Sell", icon: "🪙" }))) return;
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
    act(`Sell for ${item.sell} 🪙`, "button ghost", { action: "sell", item: item.id }, `You get 🪙 ${item.sell} points for ${item.name}.`);
  }
  panel.replaceChildren(head, compare, actions, msg);
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

const powerOf = (s) => Math.round(s.atk + 0.8 * s.def + 0.25 * s.hp);

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
  const m = d.monster;
  const facts = el("ul", "trip-facts");
  [
    [m.emoji, `Boss: ${m.name} (⚔️ ${m.atk} · 🛡️ ${m.def} · ❤️ ${m.hp})`],
    ["🎯", `${d.chance}% chance to win (your power ${powerOf(state.hero.fighting)} vs. ${d.monsterPower})`],
    ["⏱️", `${d.minutes >= 60 ? `${d.minutes / 60} h` : `${d.minutes} min`} · ✨ ${d.xp[0]}–${d.xp[1]} XP`],
    ["🎁", `Win: 🪙 ${d.coins[0]}–${d.coins[1]} coins and a ${Math.round(d.loot * 100)}% chance of loot`],
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
    const before = state;
    state = r.state;
    clockSkew = state.now - Date.now();
    const m = r.dungeon.monster;
    const lines = [
      r.won ? `🏆 Beat the ${m.name} in ${r.dungeon.name}! +${r.xp} XP · +${r.coins} 🪙` : `💀 The ${m.name} won this time… but you still learned something: +${r.xp} XP`,
    ];
    if (r.item) {
      const [label] = RARITY[r.item.rarity];
      lines.push(r.soldFor ? `Found a ${label} ${r.item.name}, but your bag was full, so it was sold for ${r.soldFor} 🪙.` : `🎁 Found: ${r.item.name} (${label}, ${statText(r.item)}). It's in your bag.`);
    } else if (r.won) lines.push("No loot this time.");
    if (r.levels.length) lines.push(`⬆️ Level up! You're level ${r.level} now (+${r.reward} 🪙).`);
    if (r.bossDealt) lines.push(`👹 It also hit the world boss for ${r.bossDealt.toLocaleString()}.`);
    await playFight({
      title: `${r.dungeon.emoji} ${r.dungeon.name}`,
      a: { name: before.hero.name, look: before.hero.look, worn: wornFrom(before), ...r.me },
      b: { name: m.name, emoji: m.emoji, ...m },
      log: r.log,
      won: r.won,
      result: lines,
    });
    showResult(lines);
    $("adv-result").classList.toggle("win", r.won);
    renderAll();
    loadProfile();
    loadDaily();
    loadBoss();
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

// ---------- Fight replay ----------

const wornFrom = (s) => Object.fromEntries(s.items.filter((i) => i.equipped).map((i) => [i.slot, i]));
let fightDone = null;

function fighterBox(box, f) {
  const pic = el("div", "fighter-pic");
  if (f.look) pic.append(heroSvg(f.look, f.worn || {}));
  else pic.append(el("span", "fighter-emoji", f.emoji || "👾"));
  const bar = el("div", "hp-bar");
  const fill = el("span");
  bar.append(fill);
  const hp = el("span", "hp-text", `${f.hp} / ${f.hp}`);
  box.replaceChildren(pic, el("strong", null, f.name), el("span", "hint", `⚔️ ${f.atk} · 🛡️ ${f.def} · ❤️ ${f.hp}`), bar, hp);
  return {
    set(value) {
      fill.style.width = `${Math.max(0, (value / f.hp) * 100)}%`;
      fill.classList.toggle("low", value / f.hp < 0.3);
      hp.textContent = `${value} / ${f.hp}`;
    },
    hit(text, crit) {
      pic.classList.remove("hurt");
      void pic.offsetWidth; // restart the shake
      pic.classList.add("hurt");
      const pop = el("span", "dmg-pop" + (crit ? " crit" : ""), text);
      pic.append(pop);
      setTimeout(() => pop.remove(), 900);
    },
  };
}

// Plays a fight log (from the Worker) blow by blow; resolves when the player closes it
function playFight({ title, a, b, log, won, result }) {
  const overlay = $("fight");
  $("fight-title").textContent = title;
  const A = fighterBox($("fighter-a"), a);
  const B = fighterBox($("fighter-b"), b);
  A.set(a.hp);
  B.set(b.hp);
  $("fight-result").replaceChildren();
  $("fight-line").textContent = "";
  $("fight-skip").hidden = false;
  $("fight-close").hidden = true;
  overlay.hidden = false;
  let i = 0;
  let timer = null;
  const finish = () => {
    clearInterval(timer);
    const last = log[log.length - 1] || { hpA: a.hp, hpB: b.hp };
    A.set(last.hpA);
    B.set(last.hpB);
    $("fight-result").replaceChildren(el("strong", won ? "win" : "lose", won ? "🏆 Victory!" : "💀 Defeat"), ...result.map((line) => el("p", null, line)));
    $("fight-skip").hidden = true;
    $("fight-close").hidden = false;
    $("fight-close").focus();
  };
  const step = () => {
    if (i >= log.length) return finish();
    const s = log[i++];
    const attacker = s.by === "a" ? a : b;
    const target = s.by === "a" ? B : A;
    if (s.miss) $("fight-line").textContent = `${attacker.name} misses!`;
    else {
      target.hit(s.crit ? `${s.dmg}!` : String(s.dmg), s.crit);
      $("fight-line").textContent = `${attacker.name} hits for ${s.dmg}${s.crit ? " (critical!)" : ""}`;
    }
    A.set(s.hpA);
    B.set(s.hpB);
  };
  timer = setInterval(step, matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 550);
  $("fight-skip").onclick = finish;
  return new Promise((resolve) => {
    fightDone = () => {
      clearInterval(timer);
      overlay.hidden = true;
      resolve();
    };
    $("fight-close").onclick = fightDone;
  });
}

// ---------- Arena ----------

async function loadArena() {
  let top = [];
  try {
    top = (await (await fetch(`${API}/arena`)).json()).top || [];
  } catch (e) {}
  const h = state.hero;
  const me = $("arena-me");
  const find = el("button", "button", "⚔️ Find an opponent");
  find.type = "button";
  find.disabled = h.duelsLeft <= 0 || busy;
  find.addEventListener("click", () => fightDuel());
  me.replaceChildren(
    el("strong", "arena-rating", `🏟️ ${h.rating}`),
    el("span", "hint", `Arena rating · ${h.duelWins} wins, ${h.duelLosses} losses`),
    el("span", "hint", `${h.duelsLeft} of 10 duels left today · wins pay 🪙 10 and 25 XP`),
    find
  );
  const myId = SinnersAuth.user && SinnersAuth.user.id;
  $("arena-top").replaceChildren(
    ...(top.length ? top : []).map((p, i) => {
      const li = el("li", "arena-row" + (p.userId === myId ? " me" : ""));
      li.append(el("span", "lb-rank", ["🥇", "🥈", "🥉"][i] || `${i + 1}`), el("span", "lb-name", `${p.name} · Lv ${p.level}`), el("span", "lb-score", `${p.rating}`));
      if (p.userId !== myId) {
        const b = el("button", "link-btn", "Duel");
        b.type = "button";
        b.disabled = h.duelsLeft <= 0;
        b.addEventListener("click", () => fightDuel(p.userId));
        li.append(b);
      } else li.append(el("span", "hint", "you"));
      return li;
    })
  );
  if (!top.length) $("arena-top").replaceChildren(el("li", "lb-empty", "No adventurers yet."));
}

async function fightDuel(opponent) {
  if (busy) return;
  busy = true;
  try {
    const before = state;
    const r = await api("/hero", { action: "duel", opponent });
    state = r.state;
    const lines = [
      `Rating ${r.ratingChange > 0 ? "+" : ""}${r.ratingChange} → ${r.rating}`,
      `${r.pointsEarned ? `+${r.pointsEarned} 🪙 · ` : ""}+${r.xp} XP${r.levels.length ? ` · ⬆️ level ${r.level}!` : ""}`,
      `${r.duelsLeft} duels left today`,
      r.bossDealt && `👹 +${r.bossDealt.toLocaleString()} damage to the world boss`,
    ].filter(Boolean);
    await playFight({
      title: `🏟️ ${r.me.name} vs ${r.foe.name}`,
      a: { ...r.me, worn: wornFrom(before) },
      b: { ...r.foe, worn: {} },
      log: r.log,
      won: r.won,
      result: lines,
    });
    showResult([r.won ? `🏟️ You beat ${r.foe.name} in the arena!` : `🏟️ ${r.foe.name} beat you in the arena.`, ...lines]);
    $("adv-result").classList.toggle("win", r.won);
    renderAll();
    loadArena();
    loadProfile();
    loadDaily();
    loadBoss();
  } catch (err) {
    showResult(`⚠️ ${err.message}`);
  } finally {
    busy = false;
  }
}

// ---------- Daily quests and streak ----------

let daily = null;

async function dailyPost(body) {
  const r = await api("/daily", body);
  daily = r.state;
  renderDaily();
  document.dispatchEvent(new CustomEvent("sinners:daily", { detail: daily }));
  return r;
}

function renderDaily() {
  if (!daily) return;
  const s = daily.streak;
  // Streak: flame, count, and the 7-day cycle (day 7 is the big one)
  const box = $("streak-box");
  const head = el("div", "streak-head");
  head.append(el("span", "streak-big", `🔥 ${s.current}`), el("span", "hint", `day streak · best ${s.best}`));
  const track = el("div", "streak-track");
  const cycleStart = Math.floor((s.claimedToday ? s.current - 1 : s.current) / 7) * 7;
  for (let i = 1; i <= 7; i++) {
    const n = cycleStart + i;
    const got = n <= s.current; // days already claimed in this streak
    const dot = el("div", "streak-day" + (got ? " got" : "") + (n === s.day && !s.claimedToday ? " today" : "") + (i === 7 ? " big" : ""));
    dot.append(el("small", null, `Day ${n}`), el("span", null, i === 7 ? "🎁" : "🪙"), el("strong", null, String(20 + 10 * Math.min(n - 1, 6) + (n % 7 === 0 ? 100 : 0))));
    track.append(dot);
  }
  const parts = [head, track];
  if (!s.claimedToday) {
    const b = el("button", "button", `Claim day ${s.day}: 🪙 ${s.reward.coins}${s.reward.potion ? " + potion" : ""}${s.reward.epic ? " + epic item" : ""}`);
    b.type = "button";
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        const r = await dailyPost({ action: "checkin" });
        showResult([`🔥 Day ${r.streak} streak! +${r.coins} 🪙`, r.potion && `${r.potion.emoji} ${r.potion.name} ×${r.potion.uses}`, r.item && `🎁 ${r.item.name}${r.item.soldFor ? " (sold, bag was full)" : " is in your bag"}`].filter(Boolean));
        loadHero();
        loadProfile();
      } catch (err) {
        showResult(`⚠️ ${err.message}`);
        b.disabled = false;
      }
    });
    parts.push(b);
  } else parts.push(el("span", "hint", "✅ Claimed today. Come back tomorrow to keep the streak going."));
  box.replaceChildren(...parts);

  // Quests
  $("quest-list").replaceChildren(
    ...daily.quests.map((q) => {
      const li = el("li", "quest" + (q.claimed ? " claimed" : q.done ? " done" : ""));
      const info = el("div", "quest-info");
      const bar = el("div", "xp-bar quest-bar");
      const fill = el("span");
      fill.style.width = `${(q.progress / q.target) * 100}%`;
      bar.append(fill);
      info.append(el("strong", null, `${q.emoji} ${q.text}`), bar, el("span", "hint", `${q.progress} / ${q.target} · 🪙 ${q.coins} + ${q.xp} XP`));
      li.append(info);
      if (q.claimed) li.append(el("span", "quest-state", "✅"));
      else if (q.done) {
        const b = el("button", "button", "Claim");
        b.type = "button";
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            const r = await dailyPost({ action: "claim", index: q.index });
            showResult([`${q.emoji} Quest done: +${r.coins} 🪙 +${r.xp} XP`, r.levels.length && `⬆️ Level up! You're level ${r.level} now.`].filter(Boolean));
            loadHero();
            loadProfile();
          } catch (err) {
            showResult(`⚠️ ${err.message}`);
            b.disabled = false;
          }
        });
        li.append(b);
      } else li.append(el("span", "quest-state hint", `${Math.round((q.progress / q.target) * 100)}%`));
      return li;
    })
  );
  const bonus = $("quest-bonus");
  if (daily.bonus.claimed) bonus.replaceChildren(el("span", "hint", "🎁 Bonus chest opened. New quests tomorrow!"));
  else {
    const b = el("button", "button" + (daily.bonus.ready ? "" : " ghost"), `🎁 Bonus chest: 🪙 ${daily.bonus.coins} + a potion`);
    b.type = "button";
    b.disabled = !daily.bonus.ready;
    b.title = daily.bonus.ready ? "Open it!" : "Finish and claim all 3 quests to open it";
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        const r = await dailyPost({ action: "bonus" });
        showResult(`🎁 Bonus chest: +${r.coins} 🪙 and ${r.potion.emoji} ${r.potion.name} ×${r.potion.uses}`);
        loadHero();
        loadProfile();
      } catch (err) {
        showResult(`⚠️ ${err.message}`);
        b.disabled = false;
      }
    });
    bonus.replaceChildren(b);
  }
  renderReset();
}

function renderReset() {
  if (!daily) return;
  $("daily-reset").textContent = `New quests in ${fmtTime(daily.resetsAt - Date.now() - clockSkew)}`;
}

async function loadDaily() {
  try {
    daily = await api("/daily");
    renderDaily();
  } catch (e) {}
}

// The streak card (streak.js) was used on this page
document.addEventListener("sinners:daily", (e) => {
  if (e.detail && e.detail !== daily) {
    daily = e.detail;
    renderDaily();
  }
});

// ---------- World boss ----------

let boss = null;

function renderBoss() {
  if (!boss) return;
  const b = boss.boss;
  const me = boss.me || { damage: 0 };
  const pct = Math.max(0, (b.hpLeft / b.hpMax) * 100);
  const main = $("boss-main");
  const head = el("div", "boss-head");
  head.append(el("span", "boss-emoji" + (b.defeatedAt ? " defeated" : ""), b.emoji), el("div", "boss-name"));
  head.lastChild.append(el("strong", null, b.name), el("span", "hint", b.defeatedAt ? "Defeated! 🎉" : `${boss.fighters} fighters so far`));
  const bar = el("div", "boss-hp");
  const fill = el("span");
  fill.style.width = `${pct}%`;
  bar.append(fill);
  const parts = [head, bar, el("span", "hint", `${b.hpLeft.toLocaleString()} / ${b.hpMax.toLocaleString()} HP`)];
  parts.push(el("p", "boss-me", `Your damage: ${me.damage.toLocaleString()}${me.rank ? ` (#${me.rank})` : ""}`));

  const actions = el("div", "boss-actions");
  const claimWeek = (week, label) => {
    const c = el("button", "button", label);
    c.type = "button";
    c.addEventListener("click", async () => {
      c.disabled = true;
      try {
        const r = await api("/boss", { action: "claim", week });
        boss = r.state;
        renderBoss();
        showResult(
          [
            `🎁 ${r.boss.emoji} ${r.boss.name} rewards: +${r.coins} 🪙${r.rank ? ` (#${r.rank} in damage)` : ""}`,
            r.potion && `${r.potion.emoji} ${r.potion.name} ×${r.potion.uses}`,
            r.item && `${r.item.name} (${r.item.rarity})${r.item.soldFor ? ", sold because your bag was full" : " is in your bag"}`,
          ].filter(Boolean)
        );
        loadHero();
        loadProfile();
      } catch (err) {
        showResult(`⚠️ ${err.message}`);
        c.disabled = false;
      }
    });
    actions.append(c);
  };
  if (me.lastWeek) claimWeek(me.lastWeek, "🎁 Claim last week's rewards");
  if (b.defeatedAt) {
    if (me.canClaim) claimWeek(undefined, "🎁 Claim boss rewards");
    else if (me.claimed) actions.append(el("span", "hint", "✅ Rewards claimed. A new boss arrives Monday."));
    else actions.append(el("span", "hint", "You didn't fight this one. A new boss arrives Monday!"));
  } else {
    const wait = (me.nextStrike || 0) - (Date.now() + clockSkew);
    const strike = el("button", "button", wait > 0 ? `⚔️ Strike again in ${fmtTime(wait)}` : "⚔️ Strike the boss");
    strike.type = "button";
    strike.disabled = wait > 0 || busy;
    strike.addEventListener("click", async () => {
      strike.disabled = true;
      try {
        const r = await api("/boss", { action: "strike" });
        boss = r.state;
        renderBoss();
        const emoji = $("boss-main").querySelector(".boss-emoji");
        emoji.classList.add("hit");
        showResult(`⚔️ You hit the ${b.name} for ${r.dealt.toLocaleString()} damage${r.crit ? " (critical!)" : ""}!`);
      } catch (err) {
        showResult(`⚠️ ${err.message}`);
        strike.disabled = false;
      }
    });
    actions.append(strike);
    actions.append(el("span", "hint", "Every adventure and duel hits it too."));
  }
  parts.push(actions);
  main.replaceChildren(...parts);

  const medals = ["🥇", "🥈", "🥉"];
  const myId = SinnersAuth.user && SinnersAuth.user.id;
  $("boss-top").replaceChildren(
    ...(boss.top.length
      ? boss.top.map((p, i) => {
          const li = el("li", "arena-row" + (p.userId === myId ? " me" : ""));
          li.append(el("span", "lb-rank", medals[i] || `${i + 1}`), el("span", "lb-name", p.name), el("span", "lb-score", p.damage.toLocaleString()), el("span", "hint", i < 3 ? (i ? "rare" : "epic") : ""));
          return li;
        })
      : [el("li", "lb-empty", "Nobody has hit it yet. Be the first!")])
  );
  renderBossTime();
}

function renderBossTime() {
  if (!boss) return;
  const b = boss.boss;
  $("boss-ends").textContent = b.defeatedAt ? "New boss on Monday" : `Escapes in ${fmtTime(b.endsAt - Date.now() - clockSkew)}`;
}

async function loadBoss() {
  try {
    boss = await api("/boss");
    renderBoss();
  } catch (e) {}
}

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
    loadArena();
    loadDaily();
    loadBoss();
    if (["#arena", "#daily", "#boss"].includes(location.hash)) $(location.hash.slice(1)).scrollIntoView();
  } catch (err) {
    $("profile-head").replaceChildren(el("p", "hint", `Couldn't load your profile: ${err.message}`));
  }
}

$("profile-login-btn").addEventListener("click", SinnersAuth.login);
start();
const stopAuthWatch = SinnersAuth.onChange(start);
// Count down while away; when the adventurer is back, show the Collect button
const ticker = setInterval(() => {
  if (!document.hidden && Date.now() % 30000 < 1000) {
    renderReset();
    renderBoss(); // strike cooldown and time left
  }
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
  if (fightDone) fightDone();
  clearInterval(ticker);
  stopAuthWatch();
});
