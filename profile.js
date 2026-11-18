// Profile page: your stats, your pixel adventurer (Attack / Defense / HP, 8 gear slots, a bag, potion
// boosts, a class with skills), a world map of dungeons fought floor by floor, the forge (materials,
// crafting, +1 to +10 upgrades) and the Arena for duels with other players. Everything is decided by the
// Worker (/hero, /profile, /arena); fights are played out here in a battle scene, blow by blow.

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
// Where each region sits on the map (in a 1000 x 600 picture)
const MAP_SPOTS = {
  forest: { x: 160, y: 370 },
  crypt: { x: 270, y: 470 },
  caves: { x: 310, y: 245 },
  hollow: { x: 190, y: 150 },
  swamp: { x: 450, y: 395 },
  desert: { x: 585, y: 490 },
  mountains: { x: 610, y: 160 },
  volcano: { x: 760, y: 300 },
  abyss: { x: 860, y: 465 },
  spire: { x: 895, y: 110 },
};

const $ = (id) => document.getElementById(id);
const itemName = (i) => `${i.name}${i.plus ? ` +${i.plus}` : ""}`;
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

// Any response that earned achievements shows them as pop-ups
async function api(path, body) {
  const data = await rawApi(path, body);
  if (data && data.achievements && Array.isArray(data.achievements) && data.achievements.length) {
    SinnersToast.achievements(data.achievements);
    loadExtras();
  }
  return data;
}

async function rawApi(path, body) {
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
  if (item.plus) box.append(el("span", "plus-badge", `+${item.plus}`));
  return box;
}

function renderHero() {
  const h = state.hero;
  const worn = wornMap();
  $("hero-name").textContent = h.name;
  $("hero-level").textContent = `Level ${h.level}`;
  const cls = state.classes.find((c) => c.id === h.cls);
  $("hero-class").hidden = !cls;
  if (cls) $("hero-class").textContent = `${cls.emoji} ${cls.name}`;
  $("xp-fill").style.width = h.next ? `${Math.min(100, (h.xp / h.next) * 100)}%` : "100%";
  $("xp-text").textContent = h.next ? `${h.xp} / ${h.next} XP to level ${h.level + 1}` : "Max level reached!";
  const figure = $("hero-figure");
  figure.replaceChildren(heroSvg(h.look, worn, h.style || {}));
  const pet = petEmoji(h.style);
  if (pet) figure.append(el("span", "hero-pet", pet));
  figure.classList.toggle("away", !!state.run);
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
    b.title = item ? `${itemName(item)}: ${statText(item)}` : `${SLOT_INFO[name][1]}: empty`;
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
    b.title = `${itemName(item)}: ${statText(item)}`;
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
  const name = el("strong", null, itemName(item));
  name.style.color = color;
  const info = el("div");
  info.append(name, el("span", "hint", `${label} ${SLOT_INFO[item.slot][1].toLowerCase()} · tier ${item.tier} · ${{ shop: "bought in the shop", forge: "made in the forge" }[item.source] || "found in a dungeon"}`));
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
        if (res.soldFor) showResult(`🪙 Sold ${itemName(item)} for ${res.soldFor} points.`);
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
    act(`Sell for ${item.sell} 🪙`, "button ghost", { action: "sell", item: item.id }, `You get 🪙 ${item.sell} points for ${itemName(item)}.`);
  }

  // The forge: upgrade (+1 to +10) and salvage into materials
  const forge = el("div", "item-forge");
  const mat = state.materials.find((m) => m.id === item.mat) || state.materials[0];
  const up = item.upgrade;
  if (up) {
    const ok = mat.n >= up.n;
    const row = el("div", "upgrade-row");
    const cost = el("span", "craft-cost");
    const chip = matIcon(mat, null);
    chip.querySelector("strong").textContent = `${mat.n} / ${up.n}`;
    chip.classList.toggle("short", !ok);
    cost.append(chip, el("span", "pouch-coins", `🪙 ${up.coins}`));
    const b = el("button", "button upgrade-btn", `🔨 Upgrade to +${up.to}`);
    b.type = "button";
    b.disabled = !ok;
    b.addEventListener("click", async () => {
      const r = await heroDo({ action: "upgrade", item: item.id }, { quiet: true });
      if (!r) return;
      showResult(r.upgraded ? `✨ ${r.item} is now +${r.plus}!` : `💥 The upgrade failed. ${r.item} stays at +${r.plus}; the materials and coins are gone.`);
      $("adv-result").classList.toggle("win", r.upgraded);
    });
    row.append(cost, b);
    forge.append(el("span", "forge-label", `Upgrade: +${state.forge.plusStep * 100}% stats per level · ${Math.round(up.chance * 100)}% chance${up.chance < 1 ? " (a failure uses up the cost)" : ""}`), row);
  } else forge.append(el("span", "forge-label", "✨ Fully upgraded (+10)"));
  if (!item.equipped) {
    const salvage = el("button", "link-btn", `♻️ Salvage for ${mat.emoji} ${item.salvage} ${mat.name}`);
    salvage.type = "button";
    salvage.addEventListener("click", async () => {
      if (!(await SinnersDialog.confirm(`Break ${itemName(item)} down into ${item.salvage} ${mat.name}? The item is gone for good.`, { title: "Salvage this item?", yes: "Salvage", icon: "♻️" }))) return;
      const r = await heroDo({ action: "salvage", item: item.id }, { quiet: true });
      if (r) showResult(`♻️ Salvaged ${r.salvaged.name} into ${r.salvaged.emoji} ${r.salvaged.n} ${r.salvaged.mat}.`);
    });
    forge.append(salvage);
  }
  panel.replaceChildren(head, compare, actions, forge, msg);
}

// ---------- World map ----------
// A 1000 x 600 continent with ten regions, a road between them in level order, and a medallion per
// region with its monster. Click a medallion to see its dungeon below the map.

const WORLD_W = 1000;
const WORLD_H = 600;
const ROAD_ORDER = ["forest", "crypt", "caves", "hollow", "swamp", "desert", "mountains", "volcano", "abyss", "spire"];
const TIER_RING = ["#a16207", "#9ca3af", "#14b8a6", "#38bdf8", "#ef4444"];

function renderMap() {
  const map = $("world-map");
  const root = svg("svg", { viewBox: `0 0 ${WORLD_W} ${WORLD_H}`, class: "map-svg world" });
  root.append(worldScenery());

  // The road, through every region in level order
  const pts = ROAD_ORDER.map((id) => MAP_SPOTS[id]).filter(Boolean);
  const road = pts
    .map((p, i) => {
      if (!i) return `M${p.x} ${p.y}`;
      const q = pts[i - 1];
      return `Q${(p.x + q.x) / 2 + (i % 2 ? -40 : 40)} ${(p.y + q.y) / 2 + (i % 2 ? 36 : -30)} ${p.x} ${p.y}`;
    })
    .join(" ");
  root.append(svg("path", { d: road, class: "map-road-edge" }), svg("path", { d: road, class: "map-road" }));

  const run = state.run;
  state.dungeons.forEach((d, i) => {
    const spot = MAP_SPOTS[d.id];
    if (!spot) return;
    const { x, y } = spot;
    const g = svg("g", { class: `map-spot${d.open ? "" : " locked"}${selectedPlace === d.id ? " selected" : ""}${run && run.dungeon === d.id ? " active" : ""}`, tabindex: 0, role: "button" });
    g.setAttribute("aria-label", d.open ? `${d.name}, level ${d.level}` : `${d.name}, unlocks at level ${d.level}`);
    g.style.setProperty("--ring", TIER_RING[d.tier - 1]);
    g.append(svg("ellipse", { cx: x, cy: y + 34, rx: 30, ry: 8, class: "spot-shadow" }));
    g.append(svg("circle", { cx: x, cy: y, r: 38, class: "spot-halo" }));
    g.append(svg("circle", { cx: x, cy: y, r: 32, class: "spot-ring" }));
    // The monster's portrait, cut to a circle
    const clipId = `spotclip-${i}`;
    const clip = svg("clipPath", { id: clipId });
    clip.append(svg("circle", { cx: x, cy: y, r: 28 }));
    g.append(clip);
    g.append(svg("circle", { cx: x, cy: y, r: 28, class: "spot-disc" }));
    const portrait = d.monster.art && SinnersArt.monsterSvg(d.monster.art);
    if (portrait) {
      portrait.setAttribute("x", x - 34);
      portrait.setAttribute("y", y - 30);
      portrait.setAttribute("width", 68);
      portrait.setAttribute("height", 68);
      const holder = svg("g", { "clip-path": `url(#${clipId})`, class: "spot-portrait" });
      holder.append(portrait);
      g.append(holder);
    } else g.append(mapIcon(d.emoji, x, y, 34));
    if (!d.open) g.append(mapIcon("🔒", x + 22, y - 22, 22));
    // Name plate under the medallion
    const text = d.open ? d.name : `${d.name} · Lv ${d.level}`;
    const w = Math.max(80, text.length * 7.4 + 20);
    const px = Math.min(WORLD_W - w / 2 - 8, Math.max(w / 2 + 8, x));
    g.append(svg("rect", { x: px - w / 2, y: y + 40, width: w, height: 21, rx: 3, class: "spot-plate" }));
    const label = svg("text", { x: px, y: y + 55, "text-anchor": "middle", class: "spot-label" });
    label.textContent = text;
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
  // The adventurer's flag while in a dungeon
  if (run && MAP_SPOTS[run.dungeon]) {
    const { x, y } = MAP_SPOTS[run.dungeon];
    const flag = mapIcon(run.wait || run.done ? "🎁" : "🚩", x + 30, y - 40, 28);
    flag.classList.add("trip-flag");
    root.append(flag);
  }
  map.replaceChildren(root);
}

// The painted land: sea, the continent, ten biomes, rivers, clouds, a compass and the title.
// Built once and copied, since it never changes.
let scenery = null;
function worldScenery() {
  if (scenery) return scenery.cloneNode(true);
  const g = svg("g", { class: "world-scenery", "aria-hidden": "true" });
  g.innerHTML = `
  <defs>
    <linearGradient id="w-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b3a5a"/><stop offset="1" stop-color="#061a2c"/></linearGradient>
    <linearGradient id="w-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d7a3a"/><stop offset="1" stop-color="#3f5626"/></linearGradient>
    <radialGradient id="w-lava" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fde047"/><stop offset="0.5" stop-color="#f97316"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>
    <radialGradient id="w-abyss" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fca5a5"/><stop offset="0.35" stop-color="#b91c1c"/><stop offset="1" stop-color="#1c0508"/></radialGradient>
    <radialGradient id="w-vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
    <linearGradient id="w-snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    <linearGradient id="w-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#b45309"/></linearGradient>
  </defs>
  <rect width="1000" height="600" fill="url(#w-sea)"/>
  ${Array.from({ length: 34 }, (_, i) => `<path d="M${(i * 137) % 980 + 10} ${(i * 89) % 580 + 10} q6 -4 12 0 q6 4 12 0" class="wave" style="animation-delay:${(i % 7) * -0.6}s"/>`).join("")}
  <!-- the continent, with a coastline and shallow water -->
  <path d="M70 140 Q110 60 230 70 Q330 30 420 60 Q520 30 610 54 Q700 34 770 70 Q850 60 900 120 Q960 200 930 300 Q970 400 920 470 Q880 560 760 548 Q660 580 560 556 Q460 584 360 556 Q250 580 160 540 Q60 520 50 430 Q20 340 50 260 Q30 190 70 140 Z" fill="#1e5a7a" opacity="0.6" transform="translate(-8 -6) scale(1.016)"/>
  <path d="M70 140 Q110 60 230 70 Q330 30 420 60 Q520 30 610 54 Q700 34 770 70 Q850 60 900 120 Q960 200 930 300 Q970 400 920 470 Q880 560 760 548 Q660 580 560 556 Q460 584 360 556 Q250 580 160 540 Q60 520 50 430 Q20 340 50 260 Q30 190 70 140 Z" fill="url(#w-land)" stroke="#d6c08a" stroke-width="5" stroke-linejoin="round"/>
  <!-- the spire's island -->
  <path d="M820 40 Q880 10 940 40 Q980 90 950 150 Q900 180 850 160 Q800 120 820 40 Z" fill="#3a3f4a" stroke="#d6c08a" stroke-width="4"/>

  <!-- Whispering Forest: pines -->
  <ellipse cx="160" cy="380" rx="110" ry="80" fill="#2f5d27" opacity="0.85"/>
  ${[[100, 340], [130, 320], [160, 345], [200, 330], [225, 360], [110, 395], [145, 410], [190, 415], [230, 400], [90, 375]].map(([x, y]) => `<path d="M${x} ${y - 26} L${x + 13} ${y} L${x - 13} ${y} Z" fill="#1a3d17" stroke="#0f2a0d" stroke-width="1.5"/><path d="M${x} ${y - 16} L${x + 9} ${y + 2} L${x - 9} ${y + 2} Z" fill="#245a1f"/><rect x="${x - 2}" y="${y}" width="4" height="6" fill="#5b3a1e"/>`).join("")}

  <!-- Sunken Crypt: grey ground and tombstones -->
  <ellipse cx="270" cy="480" rx="90" ry="55" fill="#55585e" opacity="0.85"/>
  ${[[230, 470], [260, 460], [290, 475], [320, 465], [250, 500], [300, 505]].map(([x, y]) => `<path d="M${x - 7} ${y + 10} L${x - 7} ${y - 4} Q${x} ${y - 13} ${x + 7} ${y - 4} L${x + 7} ${y + 10} Z" fill="#9ca3af" stroke="#374151" stroke-width="1.5"/><path d="M${x} ${y - 3} L${x} ${y + 5} M${x - 3} ${y} L${x + 3} ${y}" stroke="#4b5563" stroke-width="1.4"/>`).join("")}

  <!-- Goblin Caves: brown hills with a cave mouth -->
  <path d="M220 290 Q260 200 310 230 Q350 180 400 260 L410 300 Z" fill="#6b4e2e" stroke="#3b2a17" stroke-width="2"/>
  <path d="M290 296 Q310 262 330 296 Z" fill="#120a06"/><circle cx="304" cy="286" r="2" fill="#ef4444"/><circle cx="314" cy="286" r="2" fill="#ef4444"/>

  <!-- Spider Hollow: dark purple woods and webs -->
  <ellipse cx="190" cy="160" rx="100" ry="62" fill="#2e1f3d" opacity="0.9"/>
  ${[[140, 150], [175, 130], [215, 140], [245, 170], [150, 190], [205, 190]].map(([x, y]) => `<path d="M${x} ${y + 14} L${x} ${y - 6} M${x} ${y} L${x - 9} ${y - 12} M${x} ${y + 2} L${x + 10} ${y - 10}" stroke="#4c1d95" stroke-width="3" stroke-linecap="round"/>`).join("")}
  <g stroke="#e9d5ff" stroke-width="0.8" fill="none" opacity="0.6"><circle cx="232" cy="122" r="6"/><circle cx="232" cy="122" r="11"/><path d="M220 110 L244 134 M244 110 L220 134 M232 108 L232 136 M218 122 L246 122"/></g>

  <!-- Rotting Swamp: murky pools and reeds -->
  <ellipse cx="450" cy="400" rx="105" ry="65" fill="#3d5a2a" opacity="0.9"/>
  <ellipse cx="420" cy="410" rx="34" ry="14" fill="#1f3b2e" stroke="#0f2219" stroke-width="1.5"/><ellipse cx="490" cy="385" rx="26" ry="11" fill="#1f3b2e" stroke="#0f2219" stroke-width="1.5"/>
  ${[[395, 395], [405, 392], [470, 372], [515, 380], [455, 420]].map(([x, y]) => `<path d="M${x} ${y} L${x - 2} ${y - 14} M${x + 3} ${y} L${x + 5} ${y - 12}" stroke="#65a30d" stroke-width="1.6"/><ellipse cx="${x - 2}" cy="${y - 15}" rx="1.6" ry="3.4" fill="#78350f"/>`).join("")}

  <!-- Scorched Desert: dunes and cacti -->
  <ellipse cx="580" cy="490" rx="125" ry="60" fill="url(#w-sand)" opacity="0.95"/>
  <path d="M480 500 Q520 470 560 500 Q600 470 640 500 Q680 470 700 495" fill="none" stroke="#92400e" stroke-width="2" opacity="0.6"/>
  ${[[530, 470], [640, 475], [600, 515]].map(([x, y]) => `<path d="M${x} ${y + 14} L${x} ${y - 12} M${x} ${y} L${x - 7} ${y} L${x - 7} ${y - 7} M${x} ${y - 4} L${x + 7} ${y - 4} L${x + 7} ${y - 11}" stroke="#166534" stroke-width="4" stroke-linecap="round" fill="none"/>`).join("")}

  <!-- Frostpeak Mountains: snowy peaks -->
  ${[[540, 170, 70], [610, 130, 90], [680, 175, 64], [580, 205, 50]].map(([x, y, h]) => `<path d="M${x - h * 0.8} ${y + h * 0.5} L${x} ${y - h * 0.6} L${x + h * 0.8} ${y + h * 0.5} Z" fill="#64748b" stroke="#334155" stroke-width="2"/><path d="M${x - h * 0.28} ${y - h * 0.18} L${x} ${y - h * 0.6} L${x + h * 0.28} ${y - h * 0.18} L${x + h * 0.1} ${y - h * 0.1} L${x - h * 0.05} ${y - h * 0.22} Z" fill="url(#w-snow)"/>`).join("")}

  <!-- Ember Volcano: dark rock, a cone with lava and smoke -->
  <ellipse cx="760" cy="300" rx="100" ry="70" fill="#2a1d18" opacity="0.95"/>
  <path d="M700 340 L745 250 L775 250 L820 340 Z" fill="#3b2a24" stroke="#120a06" stroke-width="2"/>
  <ellipse cx="760" cy="250" rx="16" ry="5" fill="url(#w-lava)"/>
  <path d="M752 252 Q745 290 735 335 M766 252 Q776 295 790 335" fill="none" stroke="#f97316" stroke-width="3" class="lava"/>
  <g class="smoke" fill="#57534e" opacity="0.7"><circle cx="760" cy="230" r="10"/><circle cx="770" cy="214" r="13"/><circle cx="756" cy="196" r="15"/></g>

  <!-- Abyss of Sinners: a glowing chasm -->
  <ellipse cx="860" cy="470" rx="100" ry="62" fill="#2a0a0e" opacity="0.95"/>
  <path d="M790 480 Q830 440 860 470 Q890 440 930 480 Q890 500 860 490 Q830 505 790 480 Z" fill="url(#w-abyss)" class="glow"/>
  ${[[820, 440], [905, 445], [840, 515], [890, 510]].map(([x, y]) => `<path d="M${x} ${y + 10} L${x - 4} ${y - 8} L${x + 2} ${y} L${x + 5} ${y - 12} L${x + 6} ${y + 10} Z" fill="#450a0a" stroke="#1c0508" stroke-width="1.4"/>`).join("")}

  <!-- Dragon's Spire: a dark tower with lightning -->
  <path d="M880 150 L888 70 L904 70 L912 150 Z" fill="#1f2937" stroke="#0b0f14" stroke-width="2"/>
  <path d="M880 74 L896 48 L912 74 Z" fill="#7f1d1d" stroke="#0b0f14" stroke-width="2"/>
  <rect x="892" y="92" width="8" height="10" fill="#facc15" opacity="0.85"/>
  <path d="M940 30 L928 56 L938 56 L926 84" fill="none" stroke="#fde047" stroke-width="2.4" class="bolt"/>

  <!-- rivers -->
  <path d="M610 120 Q560 260 470 330 Q430 360 440 410" fill="none" stroke="#3b82c4" stroke-width="6" opacity="0.75" stroke-linecap="round"/>
  <path d="M300 300 Q260 330 240 400 Q230 450 160 520" fill="none" stroke="#3b82c4" stroke-width="5" opacity="0.7" stroke-linecap="round"/>

  <!-- clouds -->
  <g class="clouds" fill="#ffffff" opacity="0.18"><ellipse cx="380" cy="120" rx="50" ry="14"/><ellipse cx="410" cy="110" rx="30" ry="12"/><ellipse cx="700" cy="420" rx="56" ry="14"/><ellipse cx="120" cy="250" rx="40" ry="11"/></g>

  <!-- compass and title -->
  <g transform="translate(70 540)"><circle r="26" fill="#0b1e2e" stroke="#d6c08a" stroke-width="2"/><path d="M0 -22 L6 0 L0 22 L-6 0 Z" fill="#d6c08a"/><path d="M0 -22 L6 0 L-6 0 Z" fill="#ef4444"/><text y="-30" text-anchor="middle" class="compass-n">N</text></g>
  <g transform="translate(500 30)"><rect x="-120" y="-18" width="240" height="32" rx="4" fill="#0b1e2e" stroke="#d6c08a" stroke-width="2"/><text y="5" text-anchor="middle" class="map-title">THE SINLANDS</text></g>
  <rect width="1000" height="600" fill="url(#w-vignette)" pointer-events="none"/>`;
  scenery = g;
  return g.cloneNode(true);
}

function mapIcon(emoji, x, y, size) {
  const art = typeof SinnersIcons !== "undefined" && SinnersIcons.svg(emoji);
  if (!art) {
    const t = svg("text", { x, y: y + size / 3, "text-anchor": "middle", "font-size": size * 0.88 });
    t.textContent = emoji;
    return t;
  }
  // Sized in map units, without the text-sized .px styles
  art.setAttribute("class", ["px-map-pin", ...[...art.classList].filter((c) => c.startsWith("fx-"))].join(" "));
  art.setAttribute("x", x - size / 2);
  art.setAttribute("y", y - size / 2);
  art.setAttribute("width", size);
  art.setAttribute("height", size);
  return art;
}

const powerOf = (s) => Math.round(s.atk + 0.8 * s.def + 0.25 * s.hp);

const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s % 60).padStart(2, "0")}`;
};

let clockSkew = 0;

// ---------- Dungeon panel (under the map) ----------
// No run: the picked region's floors, odds and rewards. During a run: the floors so far, the timer
// and the loot. After a won floor: go deeper or retreat.

const minutesText = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);
const matIcon = (m, n) => {
  const chip = el("span", "mat-chip" + (n === 0 ? " none" : ""));
  chip.title = m.name;
  chip.append(el("span", "mat-emoji", m.emoji), el("strong", null, n != null ? String(n) : ""));
  return chip;
};

function monsterIcon(m, big) {
  const box = el("span", "floor-icon" + (big ? " big" : "") + (m.boss ? " is-boss" : ""));
  const art = m.art && SinnersArt.monsterSvg(m.art, { boss: m.boss, label: m.name });
  box.append(art || document.createTextNode(m.emoji || "👾"));
  return box;
}

function floorTrack(d, run) {
  const track = el("ol", "floor-track");
  d.floors.forEach((f, i) => {
    const n = i + 1;
    let cls = "floor-node";
    if (run) {
      if (n < run.floor || (n === run.floor && run.wait)) cls += " cleared";
      else if (n === run.floor) cls += " current";
    }
    if (f.boss) cls += " boss";
    const li = el("li", cls);
    li.title = `Floor ${n}: ${f.name} (⚔️ ${f.atk} · 🛡️ ${f.def} · ❤️ ${f.hp})`;
    li.append(monsterIcon(f), el("small", null, f.boss ? "👑 Boss" : `F${n}`));
    track.append(li);
  });
  return track;
}

function pouchLine(pouch) {
  const line = el("div", "pouch");
  line.append(el("span", "hint", "Loot so far:"), el("span", "pouch-coins", `🪙 ${pouch.coins}`));
  pouch.mats.forEach((m) => line.append(matIcon(m, m.n)));
  pouch.items.forEach((item) => {
    const chip = el("span", "pouch-item");
    chip.title = `${item.name} (${RARITY[item.rarity][0]})`;
    chip.append(itemIcon(item));
    line.append(chip);
  });
  return line;
}

function renderTrip() {
  const box = $("trip");
  const run = state.run;
  if (run) {
    const d = state.dungeons.find((x) => x.id === run.dungeon);
    const parts = [el("strong", "trip-title", `${d.emoji} ${d.name} · floor ${run.floor} of ${run.floors}`), floorTrack(d, run)];
    if (run.wait) {
      const n = run.next;
      const nextBox = el("div", "next-floor");
      nextBox.append(monsterIcon(n, true), el("div", null));
      nextBox.lastChild.append(
        el("strong", null, `Next: floor ${run.floor + 1}${n.boss ? " · the BOSS" : ""} · ${n.name}`),
        el("span", "hint", `⚔️ ${n.atk} · 🛡️ ${n.def} · ❤️ ${n.hp} · ${n.chance}% chance to win · ${minutesText(n.minutes)}`)
      );
      const actions = el("div", "trip-actions");
      const deeper = el("button", "button", n.boss ? "⚔️ Face the boss" : "⬇️ Go deeper");
      deeper.type = "button";
      deeper.addEventListener("click", goDeeper);
      const back = el("button", "button ghost", "🏃 Retreat with the loot");
      back.type = "button";
      back.addEventListener("click", retreat);
      actions.append(deeper, back);
      parts.push(el("p", "trip-win", `🏆 Floor ${run.floor} cleared!`), pouchLine(run.pouch), nextBox, actions, el("span", "hint", "Losing a floor ends the run: you keep the XP and half the coins, but the items and materials found are lost."));
    } else {
      const now = Date.now() + clockSkew;
      const done = now >= run.end;
      const pct = Math.min(100, ((now - run.start) / (run.end - run.start)) * 100);
      const bar = el("div", "xp-bar trip-bar");
      const fill = el("span");
      fill.style.width = `${pct}%`;
      bar.append(fill);
      const m = run.monster;
      parts.push(el("span", "hint", `${m.boss ? "👑 Boss: " : "Monster: "}${m.name} (⚔️ ${m.atk} · 🛡️ ${m.def} · ❤️ ${m.hp})`), bar);
      if (run.pouch.coins || run.pouch.items.length || run.pouch.mats.length) parts.push(pouchLine(run.pouch));
      if (done) {
        const b = el("button", "button fight-btn", `⚔️ Fight the ${m.name}`);
        b.type = "button";
        b.addEventListener("click", collect);
        parts.push(b);
      } else parts.push(el("span", "hint", `Reaching the ${m.name} in ${fmtTime(run.end - now)}. You can close the page; they'll keep going.`));
    }
    box.replaceChildren(...parts);
    return;
  }
  const d = state.dungeons.find((x) => x.id === selectedPlace) || state.dungeons.find((x) => x.open);
  if (!d) return box.replaceChildren();
  const facts = el("ul", "trip-facts");
  [
    ["🏰", `${d.floors.length} floors, ${minutesText(d.floorMinutes)} each · boss: ${d.monster.name}`],
    ["🎯", `${d.chance}% to win floor 1 · ${d.bossChance}% against the boss (your power ${powerOf(state.hero.fighting)})`],
    ["🎁", `Coins, XP, ${d.mat.emoji} ${d.mat.name} and gear on every won floor; the boss drops the best`],
  ].forEach(([i, t]) => {
    const li = el("li");
    li.append(el("span", null, i), document.createTextNode(` ${t}`));
    facts.append(li);
  });
  const parts = [el("strong", "trip-title", `${d.open ? d.emoji : "🔒"} ${d.name}`), floorTrack(d, null), facts];
  if (d.open) {
    const go = el("button", "button", `Enter ${d.name}`);
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
  renderSkills();
  renderForge();
  if (selectedItem) {
    selectedItem = state.items.find((i) => i.id === selectedItem.id) || null;
    if (selectedItem) selectItem(selectedItem);
  }
}

function showResult(html) {
  const box = $("adv-result");
  box.replaceChildren(...(Array.isArray(html) ? html : [html]).map((line) => el("p", null, line)));
  box.hidden = false;
}

// Runs an adventure action; returns the Worker's answer (and refreshes everything)
async function heroDo(body, { quiet } = {}) {
  if (busy) return null;
  busy = true;
  try {
    const r = await api("/hero", body);
    state = r.state;
    clockSkew = state.now - Date.now();
    if (!quiet) $("adv-result").hidden = true;
    renderAll();
    return r;
  } catch (err) {
    showResult(`⚠️ ${err.message}`);
    $("adv-result").classList.remove("win");
    return null;
  } finally {
    busy = false;
  }
}

const send = (d) => heroDo({ action: "dungeon", dungeon: d.id });
const goDeeper = () => heroDo({ action: "deeper" });

const matsText = (mats) => mats.map((m) => `${m.emoji} ${m.n} ${m.name}`).join(", ");
function haulLines(c) {
  const lines = [];
  if (c.coins) lines.push(`🪙 ${c.coins} coins`);
  if (c.mats && c.mats.length) lines.push(matsText(c.mats));
  (c.items || []).forEach((i) => lines.push(`🎁 ${i.name} (${RARITY[i.rarity][0]})`));
  if (c.soldFor) lines.push(`Your bag was full, so some items were sold for 🪙 ${c.soldFor}.`);
  return lines;
}

async function retreat() {
  const r = await heroDo({ action: "retreat" }, { quiet: true });
  if (!r) return;
  const t = r.retreated;
  showResult([`🏃 Back from ${t.dungeon.name} after floor ${t.floor}, with:`, ...(haulLines(t).length ? haulLines(t) : ["nothing this time"])]);
  $("adv-result").classList.add("win");
  loadProfile();
}

async function collect() {
  if (busy) return;
  busy = true;
  try {
    const before = state;
    const r = await api("/hero", { action: "collect" });
    state = r.state;
    clockSkew = state.now - Date.now();
    const m = r.monster;
    const lines = [r.won ? `Beat the ${m.name} on floor ${r.floor}! +${r.xp} XP` : `The ${m.name} won this time… +${r.xp} XP`];
    const loot = [];
    if (r.found.coins) loot.push({ icon: "🪙", text: `+${r.found.coins}` });
    if (r.found.mats) {
      const mat = state.materials[r.dungeon.tier - 1];
      loot.push({ icon: mat.emoji, text: `+${r.found.mats} ${mat.name}` });
    }
    if (r.found.item) loot.push({ item: r.found.item });
    if (r.ended === "cleared") lines.push("👑 Dungeon cleared! Everything you found is yours:", ...haulLines(r.claimed));
    else if (r.ended === "defeat") lines.push(`The run is over. You keep the XP and half the coins (🪙 ${r.claimed.coins}); the items and materials found are lost.`);
    if (r.levels.length) lines.push(`⬆️ Level up! You're level ${r.level} now (+${r.reward} 🪙).`);
    if (r.bossDealt) lines.push(`👹 It also hit the world boss for ${r.bossDealt.toLocaleString()}.`);
    await playFight({
      title: `${r.dungeon.emoji} ${r.dungeon.name} · floor ${r.floor} of ${r.floors}`,
      region: r.dungeon.id,
      a: { name: before.hero.name, look: before.hero.look, style: before.hero.style, worn: wornFrom(before), ...r.me },
      b: { ...m },
      log: r.log,
      won: r.won,
      result: lines,
      loot,
      next: !r.ended && state.run && state.run.wait ? state.run : null,
    });
    showResult([r.won ? `🏆 ${lines[0]}` : `💀 ${lines[0]}`, ...lines.slice(1)]);
    $("adv-result").classList.toggle("win", r.won);
    renderAll();
    loadProfile();
    loadDaily();
    loadBoss();
    loadExtras();
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

// ---------- Share card ----------
// A 1200 x 630 picture of your adventurer (the size Discord and X show best) to download, copy or share.

const svgImage = (node, w, h) =>
  new Promise((resolve, reject) => {
    const copy = node.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", w);
    copy.setAttribute("height", h);
    copy.removeAttribute("class");
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  });

async function drawShareCard() {
  const h = state.hero;
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  await Promise.all(["700 64px 'Barlow Semi Condensed'", "600 24px Inter", "700 28px Inter"].map((f) => document.fonts.load(f).catch(() => {})));
  const cls = state.classes.find((x) => x.id === h.cls);
  const accent = { warrior: "#f59e0b", rogue: "#22c55e", mage: "#a855f7" }[h.cls] || "#e0123c";

  // Background: night, a glow in the class color, and a floor
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#120c18");
  bg.addColorStop(1, "#07060a");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(300, 330, 20, 300, 330, 330);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, "transparent");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,0.03)";
  for (let x = 0; x < W; x += 40) c.fillRect(x, 0, 1, H);
  c.fillStyle = "#e0123c";
  c.fillRect(0, 0, W, 8);

  // The adventurer, big and crisp
  c.imageSmoothingEnabled = false;
  const sprite = await svgImage(heroSvg(h.look, wornMap(), h.style || {}), 320, 530);
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(300, 560, 150, 22, 0, 0, Math.PI * 2);
  c.fill();
  c.drawImage(sprite, 140, 40, 320, 530);

  // Name, level and class
  const x0 = 560;
  c.fillStyle = "#ffffff";
  c.font = "700 72px 'Barlow Semi Condensed', sans-serif";
  let name = h.name;
  while (c.measureText(name).width > W - x0 - 60 && name.length > 3) name = name.slice(0, -2);
  c.fillText(name === h.name ? name : `${name}…`, x0, 140);
  c.font = "700 30px Inter, sans-serif";
  c.fillStyle = accent;
  c.fillText(`Level ${h.level}${cls ? ` ${cls.name}` : " Adventurer"}`, x0, 190);

  // Stats
  const stats = [
    ["ATTACK", h.stats.atk],
    ["DEFENSE", h.stats.def],
    ["HP", h.stats.hp],
    ["POWER", h.power],
  ];
  stats.forEach(([label, value], i) => {
    const x = x0 + i * 150;
    c.fillStyle = "rgba(255,255,255,0.06)";
    c.fillRect(x, 230, 136, 96);
    c.fillStyle = accent;
    c.fillRect(x, 230, 136, 4);
    c.fillStyle = "#ffffff";
    c.font = "700 44px 'Barlow Semi Condensed', sans-serif";
    c.fillText(String(value), x + 16, 288);
    c.fillStyle = "#a1a1aa";
    c.font = "600 16px Inter, sans-serif";
    c.fillText(label, x + 16, 314);
  });

  // Gear
  const worn = SLOTS_ORDER.map((s) => wornMap()[s]).filter(Boolean);
  if (worn.length) {
    c.fillStyle = "#a1a1aa";
    c.font = "600 16px Inter, sans-serif";
    c.fillText("GEAR", x0, 370);
    const icons = await Promise.all(worn.map((item) => svgImage(SinnersArt.gearIcon(item), 56, 56).catch(() => null)));
    icons.forEach((img, i) => {
      if (!img) return;
      const x = x0 + i * 70;
      c.fillStyle = "rgba(255,255,255,0.05)";
      c.fillRect(x, 384, 62, 62);
      c.strokeStyle = (RARITY[worn[i].rarity] || RARITY.common)[1];
      c.lineWidth = 2;
      c.strokeRect(x + 1, 385, 60, 60);
      c.drawImage(img, x + 3, 387, 56, 56);
      if (worn[i].plus) {
        c.fillStyle = "#fbbf24";
        c.font = "800 14px Inter, sans-serif";
        c.fillText(`+${worn[i].plus}`, x + 36, 442);
      }
    });
  }

  // Record
  c.fillStyle = "#d4d4d8";
  c.font = "600 22px Inter, sans-serif";
  c.fillText(`${h.wins} dungeon floors won  ·  Arena rating ${h.rating}`, x0, 500);

  // Brand
  c.fillStyle = "#e0123c";
  c.fillRect(x0, 545, 44, 44);
  c.fillStyle = "#ffffff";
  c.font = "800 30px 'Barlow Semi Condensed', sans-serif";
  c.fillText("S", x0 + 13, 578);
  c.fillText("SINNERS", x0 + 58, 578);
  c.fillStyle = "#a1a1aa";
  c.font = "600 20px Inter, sans-serif";
  c.fillText("sinnerstv.com", x0 + 190, 576);
  return canvas;
}

const SLOTS_ORDER = ["weapon", "shield", "helmet", "chest", "gloves", "legs", "shoes", "ring"];

async function openShareCard() {
  const canvas = await drawShareCard();
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const file = new File([blob], `sinners-${state.hero.name.replace(/[^\w-]+/g, "") || "adventurer"}.png`, { type: "image/png" });
  const box = el("div", "share-card-box");
  const preview = el("img", "share-preview");
  preview.src = canvas.toDataURL("image/png");
  preview.alt = `${state.hero.name}'s adventurer card`;
  const msg = el("p", "hint share-msg", "Post it on Discord, X or anywhere. It shows your adventurer, gear and stats.");
  const row = el("div", "share-actions");
  const download = el("a", "button", "⬇️ Download");
  download.href = preview.src;
  download.download = file.name;
  row.append(download);
  if (navigator.clipboard && window.ClipboardItem) {
    const copy = el("button", "button ghost", "📋 Copy image");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        msg.textContent = "Copied! Paste it in Discord with Ctrl+V.";
      } catch (e) {
        msg.textContent = "Your browser didn't allow copying. Use Download instead.";
      }
    });
    row.append(copy);
  }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    const share = el("button", "button ghost", "📤 Share");
    share.type = "button";
    share.addEventListener("click", () => navigator.share({ files: [file], title: "My Sinners adventurer", text: "sinnerstv.com" }).catch(() => {}));
    row.append(share);
  }
  box.append(preview, row, msg);
  await SinnersDialog.alert(box, { title: "Your adventurer card", icon: "📤", wide: true });
}

$("hero-share").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  b.disabled = true;
  try {
    await openShareCard();
  } catch (err) {
    showResult(`⚠️ Couldn't make the card: ${err.message}`);
  } finally {
    b.disabled = false;
  }
});

// ---------- Battle scene ----------
// Plays a fight log from the Worker turn by turn: lunges, hits, criticals, dodges, skills with their
// own effects (Fireball, Arcane Surge, Cleave, poison, Last Stand), then victory with the loot or defeat.

const wornFrom = (s) => Object.fromEntries(s.items.filter((i) => i.equipped).map((i) => [i.slot, i]));
const CLASS_EMOJI = { warrior: "🛡️", rogue: "🗡️", mage: "🔮" };
const SKILL_FX = {
  Fireball: { cls: "fx-fireball", banner: "🔥 Fireball!", projectile: true },
  "Arcane Surge": { cls: "fx-arcane", banner: "✨ Arcane Surge!" },
  Cleave: { cls: "fx-cleave", banner: "⚔️ Cleave!" },
  Poison: { cls: "fx-poison" },
  "Last Stand": { cls: "fx-heal", banner: "❤️ Last Stand!" },
};
let fightDone = null;

function fighterBox(box, f, side) {
  const head = el("div", "fighter-head");
  const name = el("strong", null, f.name);
  if (f.cls && CLASS_EMOJI[f.cls]) name.prepend(el("span", "fighter-cls", CLASS_EMOJI[f.cls]));
  if (f.boss) name.append(el("span", "boss-tag", "BOSS"));
  const bar = el("div", "hp-bar");
  const fill = el("span");
  const lag = el("i");
  bar.append(lag, fill);
  const hp = el("span", "hp-text", `${f.hp} / ${f.hp}`);
  head.append(name, bar, hp);
  const pic = el("div", "fighter-pic");
  if (f.look) pic.append(heroSvg(f.look, f.worn || {}, f.style || {}));
  else {
    const art = f.art && SinnersArt.monsterSvg(f.art, { boss: f.boss, label: f.name });
    pic.append(art || el("span", "fighter-emoji", f.emoji || "👾"));
  }
  const fx = el("div", "fighter-fx");
  pic.append(fx);
  box.className = `fighter side-${side}${f.boss ? " is-boss" : ""}`;
  box.replaceChildren(head, pic, el("span", "fighter-stats hint", `⚔️ ${f.atk} · 🛡️ ${f.def} · ❤️ ${f.hp}`));
  const restart = (node, cls) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  const pop = (text, kind) => {
    const p = el("span", `dmg-pop ${kind || ""}`, text);
    p.style.setProperty("--x", `${Math.round(Math.random() * 40 - 20)}px`);
    fx.append(p);
    setTimeout(() => p.remove(), 1100);
  };
  const effect = (cls) => {
    const e = el("span", `skill-fx ${cls}`);
    fx.append(e);
    setTimeout(() => e.remove(), 900);
  };
  return {
    pic,
    set(value) {
      const pct = `${Math.max(0, (value / f.hp) * 100)}%`;
      fill.style.width = pct;
      setTimeout(() => (lag.style.width = pct), 350);
      fill.classList.toggle("low", value / f.hp < 0.3);
      hp.textContent = `${value} / ${f.hp}`;
    },
    lunge: () => restart(pic, "lunge"),
    hurt: (crit) => restart(pic, crit ? "hurt-big" : "hurt"),
    dodge: () => restart(pic, "dodging"),
    glow: () => restart(pic, "healing"),
    fall: () => pic.classList.add("fallen"),
    pop,
    effect,
  };
}

function playFight({ title, region, a, b, log, won, result, loot = [], next = null }) {
  const overlay = $("fight");
  const stage = $("battle-stage");
  stage.className = `battle-stage bg-${region || "arena"}`;
  $("fight-title").textContent = title;
  const A = fighterBox($("fighter-a"), a, "a");
  const B = fighterBox($("fighter-b"), b, "b");
  A.set(a.hp);
  B.set(b.hp);
  const banner = $("battle-banner");
  banner.textContent = "";
  $("fight-result").replaceChildren();
  $("fight-result").className = "fight-result";
  $("fight-line").textContent = "Fight!";
  $("fight-skip").hidden = false;
  $("fight-close").hidden = true;
  $("fight-next").replaceChildren();
  overlay.hidden = false;
  const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const showBanner = (text) => {
    if (!text) return;
    banner.textContent = text;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
  };
  let i = 0;
  let timer = null;
  const finish = () => {
    clearTimeout(timer);
    const last = log[log.length - 1] || { hpA: a.hp, hpB: b.hp };
    A.set(last.hpA);
    B.set(last.hpB);
    (won ? B : A).fall();
    showBanner(won ? "🏆 VICTORY" : "💀 DEFEAT");
    stage.classList.add(won ? "won" : "lost");
    const res = $("fight-result");
    res.classList.add(won ? "win" : "lose");
    const lootRow = el("div", "loot-row");
    loot.forEach((l, n) => {
      const card = el("div", "loot-card");
      card.style.animationDelay = `${0.15 + n * 0.18}s`;
      if (l.item) {
        card.append(itemIcon(l.item, true), el("strong", null, l.item.name), el("small", null, RARITY[l.item.rarity][0]));
        card.style.setProperty("--rarity", RARITY[l.item.rarity][1]);
        card.classList.add("item", l.item.rarity);
      } else card.append(el("span", "loot-icon", l.icon), el("strong", null, l.text));
      lootRow.append(card);
    });
    res.replaceChildren(...(loot.length ? [lootRow] : []), ...result.map((line) => el("p", null, line)));
    $("fight-skip").hidden = true;
    $("fight-close").hidden = false;
    $("fight-close").textContent = next ? "Decide later" : "Continue";
    if (next) {
      const deeper = el("button", "button", next.next.boss ? "⚔️ Face the boss" : `⬇️ Go deeper (${next.next.chance}%)`);
      deeper.type = "button";
      // After the fight's own wrap-up (which runs as the window closes)
      deeper.addEventListener("click", () => {
        fightDone();
        setTimeout(goDeeper);
      });
      const back = el("button", "button ghost", "🏃 Retreat with the loot");
      back.type = "button";
      back.addEventListener("click", () => {
        fightDone();
        setTimeout(retreat);
      });
      $("fight-next").replaceChildren(deeper, back);
    }
    $("fight-close").focus();
  };
  const step = () => {
    if (i >= log.length) return finish();
    const s = log[i++];
    const attacker = s.by === "a" ? A : B;
    const target = s.by === "a" ? B : A;
    const who = s.by === "a" ? a : b;
    const foe = s.by === "a" ? b : a;
    const fx = s.skill && SKILL_FX[s.skill];
    let delay = fast ? 120 : 700;
    if (s.kind === "heal") {
      attacker.glow();
      attacker.effect("fx-heal");
      attacker.pop(`+${s.dmg}`, "heal");
      showBanner(fx && fx.banner);
      $("fight-line").textContent = `${who.name} refuses to fall and heals ${s.dmg}!`;
    } else if (s.kind === "poison") {
      target.effect("fx-poison");
      target.pop(`☠ ${s.dmg}`, "poison");
      target.hurt(false);
      $("fight-line").textContent = `Poison eats at ${foe.name} for ${s.dmg}.`;
      delay = fast ? 100 : 520;
    } else {
      attacker.lunge();
      if (fx) {
        showBanner(fx.banner);
        if (fx.projectile) {
          const ball = el("span", `projectile from-${s.by}`);
          stage.append(ball);
          setTimeout(() => ball.remove(), 600);
        }
        setTimeout(() => target.effect(fx.cls), fx.projectile ? 280 : 60);
      }
      const land = () => {
        if (s.kind === "dodge") {
          target.dodge();
          target.pop("MISS", "miss");
          $("fight-line").textContent = `${foe.name} dodges${s.skill ? ` the ${s.skill}` : ""}!`;
          return;
        }
        target.hurt(s.kind === "crit");
        if (s.kind === "crit" && !fast) {
          stage.classList.remove("shake");
          void stage.offsetWidth;
          stage.classList.add("shake");
        }
        target.pop(s.kind === "crit" ? `${s.dmg}!` : String(s.dmg), s.kind === "crit" ? "crit" : "");
        $("fight-line").textContent = `${who.name}${s.skill ? `'s ${s.skill}` : ""} hits for ${s.dmg}${s.kind === "crit" ? " (critical!)" : ""}`;
      };
      setTimeout(land, fx && fx.projectile && !fast ? 300 : fast ? 0 : 160);
      if (fx && fx.projectile && !fast) delay += 250;
    }
    A.set(s.hpA);
    B.set(s.hpB);
    timer = setTimeout(step, delay);
  };
  timer = setTimeout(step, fast ? 100 : 700);
  $("fight-skip").onclick = finish;
  return new Promise((resolve) => {
    fightDone = () => {
      clearTimeout(timer);
      overlay.hidden = true;
      stage.classList.remove("won", "lost", "shake");
      fightDone = null;
      resolve();
    };
    $("fight-close").onclick = fightDone;
  });
}

// ---------- Class and skills ----------

const SKILL_ICON = { cleave: "⚔️", bulwark: "🛡️", laststand: "❤️", backstab: "🗡️", evasion: "💨", poison: "☠️", fireball: "🔥", frostarmor: "❄️", arcane: "✨" };

function renderSkills() {
  const h = state.hero;
  const body = $("skills-body");
  $("skill-points").textContent = h.cls ? (h.skillPoints ? `${h.skillPoints} skill point${h.skillPoints === 1 ? "" : "s"} to spend` : "No points left · one more each level") : "";
  const classCard = (c, canPick) => {
    const card = el("div", "class-card" + (h.cls === c.id ? " current" : ""));
    card.dataset.cls = c.id;
    card.append(el("span", "class-emoji", c.emoji), el("strong", null, c.name), el("p", "hint", c.text));
    const list = el("ul", "class-skills");
    c.skills.forEach((s) => list.append(el("li", null, `${SKILL_ICON[s.id]} ${s.name} · Lv ${s.level}`)));
    card.append(list);
    if (canPick) {
      const b = el("button", "button", h.cls ? `Switch · 🪙 ${state.respecPrice}` : `Become a ${c.name}`);
      b.type = "button";
      b.addEventListener("click", async () => {
        if (h.cls && !(await SinnersDialog.confirm(`Become a ${c.name}? It costs 🪙 ${state.respecPrice} and your skill points come back to spend again.`, { title: "Switch class?", yes: "Switch", icon: c.emoji }))) return;
        const r = await heroDo({ action: "class", cls: c.id });
        if (r) showResult(`${c.emoji} You're a ${c.name} now! Spend your skill points below.`);
      });
      card.append(b);
    }
    return card;
  };
  if (h.level < state.classLevel) {
    const grid = el("div", "class-grid locked");
    state.classes.forEach((c) => grid.append(classCard(c, false)));
    return body.replaceChildren(el("p", "hint", `At level ${state.classLevel} your adventurer picks a class. ${state.classLevel - h.level} level${state.classLevel - h.level === 1 ? "" : "s"} to go!`), grid);
  }
  if (!h.cls) {
    const grid = el("div", "class-grid");
    state.classes.forEach((c) => grid.append(classCard(c, true)));
    return body.replaceChildren(el("p", "hint", "Pick a class. It shapes your stats and gives you 3 skills (free the first time)."), grid);
  }
  const c = state.classes.find((x) => x.id === h.cls);
  const head = el("div", "class-head");
  head.append(el("span", "class-emoji", c.emoji), el("div"));
  head.lastChild.append(el("strong", null, c.name), el("span", "hint", c.text));
  const rows = c.skills.map((s) => {
    const rank = (h.skills || {})[s.id] || 0;
    const locked = h.level < s.level;
    const row = el("div", "skill-row" + (locked ? " locked" : "") + (rank ? " learned" : ""));
    const pips = el("span", "skill-pips");
    for (let n = 1; n <= s.ranks.length; n++) pips.append(el("i", n <= rank ? "on" : null));
    const info = el("div", "skill-info");
    info.append(el("strong", null, `${s.name}`), pips, el("span", "hint", locked ? `Unlocks at level ${s.level}` : rank ? s.ranks[rank - 1] : `Rank 1: ${s.ranks[0]}`));
    if (!locked && rank && rank < s.ranks.length) info.append(el("small", "skill-next", `Next: ${s.ranks[rank]}`));
    const plus = el("button", "skill-plus", "+");
    plus.type = "button";
    plus.title = `Rank up ${s.name}`;
    plus.disabled = locked || rank >= s.ranks.length || h.skillPoints <= 0;
    plus.addEventListener("click", () => heroDo({ action: "skill", skill: s.id }));
    row.append(el("span", "skill-icon", SKILL_ICON[s.id]), info, plus);
    return row;
  });
  const others = el("details", "class-switch");
  others.append(el("summary", null, "Switch class"));
  const grid = el("div", "class-grid small");
  state.classes.filter((x) => x.id !== h.cls).forEach((x) => grid.append(classCard(x, true)));
  others.append(grid);
  body.replaceChildren(head, ...rows, others);
}

// ---------- Forge: materials, crafting ----------

let craftSlot = "weapon";
let craftTier = 1;

function renderForge() {
  $("mats").replaceChildren(
    ...state.materials.map((m) => {
      const chip = matIcon(m, m.n);
      const d = state.dungeons[m.tier - 1];
      chip.title = `${m.name}: ${m.n} · drops in ${d.name}`;
      return chip;
    })
  );
  const open = state.forge.craft.filter((c) => c.open);
  if (!open.some((c) => c.tier === craftTier)) craftTier = open.length ? open[open.length - 1].tier : 1;
  const cost = state.forge.craft.find((c) => c.tier === craftTier);
  const have = Object.fromEntries(state.materials.map((m) => [m.id, m.n]));
  const slots = el("div", "craft-slots");
  Object.entries(SLOT_INFO).forEach(([id, [icon, label]]) => {
    const b = el("button", "craft-slot" + (id === craftSlot ? " on" : ""));
    b.type = "button";
    b.title = label;
    b.append(el("span", null, icon), el("small", null, label));
    b.addEventListener("click", () => {
      craftSlot = id;
      renderForge();
    });
    slots.append(b);
  });
  const tiers = el("div", "craft-tiers");
  state.forge.craft.forEach((c) => {
    const b = el("button", "craft-tier" + (c.tier === craftTier ? " on" : ""), `T${c.tier}`);
    b.type = "button";
    b.disabled = !c.open;
    b.title = c.open ? `Tier ${c.tier}` : `Tier ${c.tier} unlocks at level ${state.tiers[c.tier - 1]}`;
    b.addEventListener("click", () => {
      craftTier = c.tier;
      renderForge();
    });
    tiers.append(b);
  });
  const needs = el("div", "craft-cost");
  let enough = true;
  cost.mats.forEach((m) => {
    const mat = state.materials.find((x) => x.id === m.id);
    const ok = (have[m.id] || 0) >= m.n;
    enough = enough && ok;
    const chip = matIcon(mat, null);
    chip.querySelector("strong").textContent = `${have[m.id] || 0} / ${m.n}`;
    chip.classList.toggle("short", !ok);
    needs.append(chip);
  });
  needs.append(el("span", "pouch-coins", `🪙 ${cost.coins}`));
  const odds = state.forge.craftRarity.map((r) => `${RARITY[r.id][0]} ${r.chance}%`).join(" · ");
  const forge = el("button", "button forge-btn", `🔨 Forge a ${SLOT_INFO[craftSlot][1].toLowerCase()}`);
  forge.type = "button";
  forge.disabled = !enough;
  forge.addEventListener("click", async () => {
    const r = await heroDo({ action: "craft", slot: craftSlot, tier: craftTier }, { quiet: true });
    if (r) {
      showResult(`🔨 The forge roars… ${r.crafted.name} (${RARITY[r.crafted.rarity][0]}, ${statText(r.crafted)}). It's in your bag.`);
      $("adv-result").classList.add("win");
      const item = state.items.filter((i) => i.source === "forge").sort((x, y) => y.id - x.id)[0];
      if (item) selectItem(item);
    }
  });
  $("forge-body").replaceChildren(
    el("p", "forge-label", "Forge new gear"),
    slots,
    tiers,
    needs,
    el("span", "hint", `Always rare or better: ${odds}`),
    forge,
    el("p", "hint forge-tip", "Upgrade (+1 to +10) and salvage items from your bag: click an item below.")
  );
}

// ---------- Arena ----------

async function loadArena() {
  let top = [];
  let season = null;
  try {
    const r = await (await fetch(`${API}/arena`)).json();
    top = r.top || [];
    season = r.season;
  } catch (e) {}
  if (season) {
    const name = new Date(season.endsAt - 86400000).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    const bar = $("season-bar");
    bar.replaceChildren(
      el("strong", null, `🗓️ Season: ${name}`),
      el("span", "hint", `ends in ${fmtTime(season.endsAt - Date.now())} · top 3 win 🪙 ${season.prizes.join(" / ")} and a title · 10+ duels earn 🪙 100`),
      ...(season.last.length ? [el("span", "hint", `Last season: ${season.last.map((p) => `${["👑", "🥈", "🥉"][p.rank - 1]} ${p.name} (${p.rating})`).join("  ")}`)] : [])
    );
  }
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
      li.append(el("span", "lb-rank", ["🥇", "🥈", "🥉"][i] || `${i + 1}`), el("span", "lb-name", `${p.badge ? p.badge + " " : ""}${p.name} · Lv ${p.level}`), el("span", "lb-score", `${p.rating}`));
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

// ---------- Achievements, badge and wardrobe ----------

let extras = null;
const petEmoji = (style) => {
  const c = extras && style && style.pet && extras.catalog.find((x) => x.id === style.pet);
  return c ? c.emoji : style && style.pet ? "🐾" : "";
};

async function extrasPost(body) {
  const r = await rawApi("/profile/extras", body);
  extras = { ...extras, achievements: r.achievements, cosmetics: r.cosmetics, catalog: r.catalog };
  renderExtras();
  return r;
}

function renderExtras() {
  if (!extras) return;
  const a = extras.achievements;
  const earned = a.list.filter((x) => x.earned).length;
  $("ach-count").textContent = `(${earned} / ${a.list.length})`;
  $("ach-grid").replaceChildren(
    ...a.list.map((x) => {
      const b = el("button", "ach" + (x.earned ? " earned" : "") + (a.badge === x.id ? " badge" : ""));
      b.type = "button";
      b.title = `${x.name}: ${x.text}${x.coins ? ` (+${x.coins} 🪙)` : ""}${x.earned ? (a.badge === x.id ? "\nShown as your badge (click to remove)" : "\nClick to show it as your badge") : ""}`;
      b.append(el("span", "ach-emoji", x.emoji), el("strong", null, x.name), el("small", null, x.text));
      if (x.progress) {
        const bar = el("div", "xp-bar ach-bar");
        const fill = el("span");
        fill.style.width = `${(x.progress[0] / x.progress[1]) * 100}%`;
        bar.append(fill);
        b.append(bar, el("small", "ach-progress", `${x.progress[0].toLocaleString()} / ${x.progress[1].toLocaleString()}`));
      }
      if (a.badge === x.id) b.append(el("span", "ach-tag", "Badge"));
      b.disabled = !x.earned;
      b.addEventListener("click", async () => {
        try {
          await extrasPost({ action: "badge", badge: a.badge === x.id ? null : x.id });
          SinnersToast.show(a.badge === x.id ? "Badge removed" : `${x.name} is your badge now`, x.emoji);
        } catch (err) {
          showResult(`⚠️ ${err.message}`);
        }
      });
      return b;
    })
  );

  // Wardrobe: what they own, by kind
  const { owned, style } = extras.cosmetics;
  const kinds = [["hat", "🎩 Hat"], ["cape", "🧣 Cape"], ["pet", "🐾 Pet"], ["color", "🎨 Name color"]];
  const list = $("wardrobe-list");
  if (!owned.length) {
    const link = el("a", "button ghost", "✨ Browse cosmetics");
    link.href = "/shop#cosmetics";
    list.replaceChildren(el("p", "hint", "Hats, capes, pets and name colors from the Shop show up here."), link);
  } else {
    list.replaceChildren(
      ...kinds.map(([kind, label]) => {
        const mine = extras.catalog.filter((c) => c.kind === kind && owned.includes(c.id));
        const row = el("div", "wardrobe-row");
        row.append(el("span", "hint", label));
        const opts = el("div", "wardrobe-opts");
        const current = kind === "color" ? style.color && `color-${style.color}` : style[kind];
        const chip = (id, text, on) => {
          const b = el("button", "wardrobe-chip" + (on ? " on" : ""), text);
          b.type = "button";
          b.addEventListener("click", async () => {
            try {
              await extrasPost({ action: "wear", id });
              await loadHero();
            } catch (err) {
              showResult(`⚠️ ${err.message}`);
            }
          });
          return b;
        };
        opts.append(chip(`none:${kind}`, "None", !current));
        mine.forEach((c) => opts.append(chip(c.id, `${c.emoji} ${c.name}`, current === c.id)));
        if (!mine.length) opts.append(el("span", "hint", "none owned"));
        row.append(opts);
        return row;
      })
    );
  }
}

async function loadExtras() {
  try {
    const r = await rawApi("/profile/extras");
    extras = r;
    renderExtras();
    if (r.fresh && r.fresh.length) SinnersToast.achievements(r.fresh);
    if (state) renderHero(); // pet
  } catch (e) {}
}

// ---------- Linked accounts ----------
// One Sinners account, several logins: connect Discord, Twitch and Kick here without logging out.
// Any connected one logs you in; Twitch also lets you type in Twitch chat on the Watch page.

function renderLinks() {
  const box = $("links-list");
  const links = SinnersLinks.links;
  if (!links) return box.replaceChildren(el("p", "hint", "…"));
  const ids = SinnersLinks.identities;
  const count = Object.keys(ids).length;
  const PROVIDERS = [
    ["discord", "💬", "Discord", "Use the Discord bot as yourself"],
    ["twitch", "💜", "Twitch", "Type in Twitch chat on the Watch page"],
    ["kick", "🟢", "Kick", "Log in with Kick too"],
  ];
  const rows = PROVIDERS.map(([id, icon, name, perk]) => {
    const r = el("div", "link-row");
    const info = el("div", "link-info");
    r.append(el("span", "link-icon", icon), info);
    if (ids[id]) {
      info.append(el("strong", null, `${name} · ${ids[id]}`), el("span", "hint", `Connected · ${perk}`));
      const b = el("button", "link-btn", "Disconnect");
      b.type = "button";
      b.disabled = count <= 1;
      b.title = count <= 1 ? "Your only login: connect another one first" : `Disconnect ${name}`;
      b.addEventListener("click", async () => {
        if (!(await SinnersDialog.confirm(`You won't be able to log in with ${name} until you connect it again.`, { title: `Disconnect ${name}?`, yes: "Disconnect", icon })))
          return;
        try {
          await SinnersLinks.unlink(id);
        } catch (err) {
          showResult(`⚠️ ${err.message}`);
        }
      });
      r.append(b);
    } else {
      const ready = SinnersLinks.available[id] !== false;
      info.append(el("strong", null, name), el("span", "hint", ready ? perk : "Coming soon"));
      const b = el("button", `button login-${id}-btn`, "Connect");
      b.type = "button";
      b.disabled = !ready;
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await SinnersLinks.link(id);
        } catch (err) {
          b.disabled = false;
          showResult(`⚠️ ${err.message}`);
        }
      });
      r.append(b);
    }
    return r;
  });
  const youtube = el("div", "link-row");
  youtube.append(el("span", "link-icon", "▶️"), el("div", "link-info"));
  youtube.lastChild.append(el("strong", null, "YouTube"), el("span", "hint", "Not available yet"));
  box.replaceChildren(...rows, youtube);
}
const stopLinksWatch = SinnersLinks.onChange(renderLinks);

// ---------- Profile numbers ----------

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
      ["🏆", "Adventures won", state ? `${state.hero.wins} / ${state.hero.runs}` : "–"],
      ["🏟️", "Arena rating", state ? state.hero.rating : "–", state ? `${state.hero.duelWins} wins` : null],
      ["🛒", "Shop purchases", p.purchases],
      ["💬", "Chat messages", p.messages],
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
  if (!selectedPlace) selectedPlace = state.run ? state.run.dungeon : (state.dungeons.filter((d) => d.open).pop() || {}).id;
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
    loadExtras();
    renderLinks();
    if (["#arena", "#daily", "#boss", "#achievements", "#wardrobe", "#links", "#skills", "#forge", "#world-map"].includes(location.hash)) $(location.hash.slice(1)).scrollIntoView();
  } catch (err) {
    $("profile-head").replaceChildren(el("p", "hint", `Couldn't load your profile: ${err.message}`));
  }
}

$("profile-login-btn").addEventListener("click", SinnersAuth.login);
start();
const stopAuthWatch = SinnersAuth.onChange(start);
// Count down a dungeon floor; when its time is up, show the Fight button
const ticker = setInterval(() => {
  if (!document.hidden && Date.now() % 30000 < 1000) {
    renderReset();
    renderBoss(); // strike cooldown and time left
  }
  if (!state || !state.run || state.run.wait || document.hidden) return;
  renderTrip();
  const done = Date.now() + clockSkew >= state.run.end;
  if (done && !state.run.done) {
    state.run.done = true;
    renderMap();
  }
}, 1000);

SinnersNav.onLeave(() => {
  stopLinksWatch();
  if (fightDone) fightDone();
  clearInterval(ticker);
  stopAuthWatch();
});
