// Shop page: adventure gear by tier and potions / scrolls (from the Worker's /shop/adventure), and the
// Redeem section with rewards the admin adds (/shop). Everything is paid with points.

const API = WORKER_URL.replace(/\/$/, "");
const SLOT_ICON = { helmet: "🪖", chest: "🥋", legs: "👖", shoes: "🥾", gloves: "🧤", weapon: "⚔️", shield: "🛡️", ring: "💍" };
const RARITY_COLOR = { common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b" };
const TABS = ["adventure", "extras", "cosmetics", "redeem"];

const $ = (id) => document.getElementById(id);
let adv = null; // gear catalog, extras, your level, boosts and points
let redeemItems = null;
let points = null;
let cos = null; // cosmetics catalog and what you own

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const authHeaders = () => (SinnersAuth.user ? { Authorization: `Bearer ${SinnersAuth.token}` } : {});

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) SinnersAuth.expire();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function statChips(s) {
  const box = el("div", "stat-chips");
  [["⚔️", s.atk, "Attack"], ["🛡️", s.def, "Defense"], ["❤️", s.hp, "HP"]].forEach(([icon, v, label]) => {
    if (!v) return;
    const chip = el("span", "stat-chip", `${icon} +${v}`);
    chip.title = label;
    box.append(chip);
  });
  return box;
}

// ---------- Tabs ----------

function showTab(tab) {
  if (!TABS.includes(tab)) tab = "adventure";
  document.querySelectorAll("#shop-tabs button").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  TABS.forEach((t) => ($(`tab-${t}`).hidden = t !== tab));
  history.replaceState(null, "", `#${tab}`);
}

document.querySelectorAll("#shop-tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------- Points bar ----------

function renderBar() {
  const bar = $("shop-bar");
  if (!SinnersAuth.user) {
    const login = el("button", "button discord-btn", "Log in");
    login.type = "button";
    login.addEventListener("click", SinnersAuth.login);
    bar.replaceChildren(el("span", null, "🪙 Log in to get 100 free points and start shopping."), login);
    return;
  }
  const profile = el("a", "button ghost shop-jump", "🎒 Your bag");
  profile.href = "/profile";
  bar.replaceChildren(
    el("strong", "points-total", `🪙 ${points == null ? "…" : points.toLocaleString()} points`),
    el("span", null, adv ? `Adventurer level ${adv.level}` : ""),
    profile
  );
}

// ---------- Adventure gear ----------

function buyButton(label, enabled, onClick, msg) {
  const b = el("button", "button", label);
  b.type = "button";
  b.disabled = !enabled;
  if (enabled) b.addEventListener("click", () => onClick(b, msg));
  return b;
}

function canAfford(price) {
  return points == null || points >= price;
}

function renderGear() {
  const box = $("gear-tiers");
  if (!adv) return box.replaceChildren(el("p", "shop-empty", "The adventure shop is unavailable right now."));
  box.replaceChildren(
    ...adv.gear.flatMap((tier) => {
      const head = el("div", `shop-tier-head tier-${tier.tier}` + (tier.open ? "" : " locked"));
      head.append(
        el("strong", null, `${tier.open ? "" : "🔒 "}Tier ${tier.tier} · ${SinnersArt.tiers[tier.tier].name}`),
        el("span", "hint", tier.open ? (tier.tier === 1 ? "Open to everyone" : `Unlocked at adventurer level ${tier.level}`) : `Unlocks at adventurer level ${tier.level} (you're level ${adv.level})`)
      );
      const grid = el("div", "gear-grid");
      tier.items.forEach((item) => {
        const card = el("article", `gear-card tier-${tier.tier}` + (tier.open ? "" : " locked"));
        card.style.setProperty("--rarity", RARITY_COLOR[item.rarity]);
        const top = el("div", "gear-top");
        const icon = el("span", "gear-icon");
        icon.append(SinnersArt.gearIcon(item));
        top.append(icon, el("div", "gear-name"));
        top.lastChild.append(el("strong", null, item.name), el("span", "hint", `${item.slot} · power ${item.power}`));
        const msg = el("p", "form-msg");
        const foot = el("div", "shop-foot");
        foot.append(el("span", "shop-price", `🪙 ${item.price}`));
        let label = "Buy";
        let ok = true;
        if (!tier.open) [label, ok] = [`🔒 Level ${tier.level}`, false];
        else if (!SinnersAuth.user) label = "Log in to buy";
        else if (!canAfford(item.price)) [label, ok] = [`Need ${item.price - points} more`, false];
        foot.append(buyButton(label, ok, SinnersAuth.user ? (b, m) => buyAdventure(item, b, m) : SinnersAuth.login, msg));
        card.append(top, statChips(item), el("span", "gear-sell", `Sells back for ${item.sell} 🪙`), foot, msg);
        grid.append(card);
      });
      return [head, grid];
    })
  );
}

function renderExtras() {
  const box = $("extras");
  if (!adv) return box.replaceChildren();
  box.replaceChildren(
    ...adv.extras.map((x) => {
      const card = el("article", "extra-card");
      const have = adv.buffs[x.buff] || 0;
      card.append(el("span", "extra-icon", x.emoji), el("strong", null, x.name), el("span", "extra-effect", x.text), el("span", "hint", `${adv.buffUses} uses per purchase`));
      if (have) card.append(el("span", "extra-have", `Active: ${have} use${have === 1 ? "" : "s"} left`));
      const msg = el("p", "form-msg");
      const foot = el("div", "shop-foot");
      foot.append(el("span", "shop-price", `🪙 ${x.price}`));
      let label = "Buy";
      let ok = true;
      if (!SinnersAuth.user) label = "Log in to buy";
      else if (have + adv.buffUses > adv.buffMax) [label, ok] = ["Full", false];
      else if (!canAfford(x.price)) [label, ok] = [`Need ${x.price - points} more`, false];
      foot.append(buyButton(label, ok, SinnersAuth.user ? (b, m) => buyAdventure(x, b, m) : SinnersAuth.login, msg));
      card.append(foot, msg);
      return card;
    })
  );
}

async function buyAdventure(item, button, msg) {
  if (!(await SinnersDialog.confirm(`It costs 🪙 ${item.price} points.${item.slot ? ` It goes into your bag and sells back for ${item.sell}.` : ` Active for your next ${adv.buffUses} fights.`}`, { title: `Buy ${item.name}?`, yes: "Buy", icon: item.emoji || SLOT_ICON[item.slot] }))) return;
  button.disabled = true;
  try {
    const r = await post("/shop/adventure", { item: item.id });
    points = r.points;
    adv.buffs = r.buffs;
    renderAll();
    flash(r.bought === "gear" ? `🎒 ${item.name} is in your bag. Equip it on your Profile.` : `${item.emoji} ${item.name} is active for your next ${adv.buffUses} fights.`);
  } catch (err) {
    button.disabled = false;
    msg.className = "form-msg error";
    msg.textContent = err.message;
  }
}

function flash(text) {
  let box = document.querySelector(".shop-flash");
  if (!box) {
    box = el("div", "shop-flash");
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  box.textContent = text;
  box.classList.add("show");
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => box.classList.remove("show"), 3500);
}

// ---------- Cosmetics ----------

const PREVIEW_LOOK = { skin: "#e0ac87", hair: "#2b1b17", style: 0, eyes: "#1e293b", shirt: "#475569", pants: "#334155" };

function renderCosmetics() {
  const box = $("cosmetics");
  if (!cos) return box.replaceChildren(el("p", "shop-empty", "Cosmetics are unavailable right now."));
  const owned = new Set(cos.owned || []);
  const labels = { hat: "Hats", cape: "Capes", pet: "Pets", color: "Name colors" };
  box.replaceChildren(
    ...Object.entries(labels).flatMap(([kind, label]) => {
      const grid = el("div", "gear-grid");
      cos.catalog
        .filter((c) => c.kind === kind)
        .forEach((c) => {
          const card = el("article", "cosmetic-card" + (owned.has(c.id) ? " owned" : ""));
          const preview = el("div", "cosmetic-preview");
          if (kind === "hat" || kind === "cape") preview.append(SinnersArt.heroSvg(PREVIEW_LOOK, {}, { [kind]: c.id }));
          else if (kind === "pet") preview.append(el("span", "cosmetic-pet", c.emoji));
          else preview.append(el("strong", `name-color name-${c.id.slice(6)} cosmetic-name`, SinnersAuth.user ? SinnersAuth.user.name : "YourName"));
          const msg = el("p", "form-msg");
          const foot = el("div", "shop-foot");
          foot.append(el("span", "shop-price", `🪙 ${c.price.toLocaleString()}`));
          let label2 = "Buy";
          let ok = true;
          if (owned.has(c.id)) [label2, ok] = ["✓ Owned", false];
          else if (!SinnersAuth.user) label2 = "Log in to buy";
          else if (!canAfford(c.price)) [label2, ok] = [`Need ${(c.price - points).toLocaleString()} more`, false];
          foot.append(buyButton(label2, ok, SinnersAuth.user ? (b, m) => buyCosmetic(c, b, m) : SinnersAuth.login, msg));
          card.append(preview, el("strong", null, `${c.emoji} ${c.name}`), foot, msg);
          grid.append(card);
        });
      return [el("div", "shop-tier-head", label), grid];
    })
  );
}

async function buyCosmetic(c, button, msg) {
  if (!(await SinnersDialog.confirm(`It costs 🪙 ${c.price.toLocaleString()} points. You'll wear it right away; swap it any time in your Wardrobe.`, { title: `Buy ${c.name}?`, yes: "Buy", icon: c.emoji }))) return;
  button.disabled = true;
  try {
    const r = await post("/profile/extras", { action: "buy", id: c.id });
    points = r.points;
    cos = { catalog: r.catalog, owned: r.cosmetics.owned };
    renderAll();
    flash(`${c.emoji} ${c.name} is yours, and you're wearing it!`);
  } catch (err) {
    button.disabled = false;
    msg.className = "form-msg error";
    msg.textContent = err.message;
  }
}

// ---------- Redeem (admin rewards) ----------

function renderRedeem() {
  const grid = $("shop-grid");
  if (!redeemItems) return grid.replaceChildren(el("p", "shop-empty", "Rewards are unavailable right now."));
  if (!redeemItems.length) {
    const empty = el("div", "shop-empty");
    empty.append(el("span", "shop-empty-icon", "🎁"), el("strong", null, "No rewards right now."), el("span", null, "New rewards are coming soon. Keep earning points!"));
    return grid.replaceChildren(empty);
  }
  grid.replaceChildren(
    ...redeemItems.map((item) => {
      const card = el("article", "shop-item");
      const pic = el("div", "shop-pic");
      const img = el("img");
      img.src = API + item.image;
      img.alt = item.name;
      img.loading = "lazy";
      pic.append(img);
      if (item.stock != null) pic.append(el("span", "shop-stock" + (item.stock ? "" : " out"), item.stock ? `${item.stock} left` : "Sold out"));
      const body = el("div", "shop-body");
      body.append(el("h3", null, item.name));
      if (item.description) body.append(el("p", null, item.description));
      const msg = el("p", "form-msg");
      const foot = el("div", "shop-foot");
      foot.append(el("span", "shop-price", `🪙 ${item.price}`));
      let label = "Buy";
      let ok = true;
      if (item.stock === 0) [label, ok] = ["Sold out", false];
      else if (!SinnersAuth.user) label = "Log in to buy";
      else if (!canAfford(item.price)) [label, ok] = [`Need ${item.price - points} more`, false];
      foot.append(buyButton(label, ok, SinnersAuth.user ? (b, m) => buyRedeem(item, b, m) : SinnersAuth.login, msg));
      body.append(foot, msg);
      card.append(pic, body);
      return card;
    })
  );
}

async function buyRedeem(item, button, msg) {
  if (!(await SinnersDialog.confirm(`It costs 🪙 ${item.price} points. The Sinners team hands it out after you buy it.`, { title: `Buy ${item.name}?`, yes: "Buy", icon: "🎁" }))) return;
  button.disabled = true;
  try {
    const r = await post("/shop/buy", { id: item.id });
    points = r.points;
    item.stock = r.stock;
    renderAll();
    loadMine();
    flash(`🎁 Bought ${item.name}! The team will hand it out to you.`);
  } catch (err) {
    button.disabled = false;
    msg.className = "form-msg error";
    msg.textContent = err.message;
  }
}

async function loadMine() {
  const box = $("shop-mine");
  if (!SinnersAuth.user) return (box.hidden = true);
  try {
    const res = await fetch(`${API}/shop/mine`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const list = data.purchases || [];
    box.hidden = !list.length;
    $("shop-mine-list").replaceChildren(
      ...list.map((p) => {
        const li = el("li", "shop-mine-row");
        li.append(
          el("strong", null, p.name),
          el("span", "lb-score", `🪙 ${p.price}`),
          el("small", null, new Date(p.created).toLocaleDateString()),
          el("span", "shop-status" + (p.delivered ? " done" : ""), p.delivered ? "✓ Delivered" : "Waiting for the team")
        );
        return li;
      })
    );
  } catch (e) {
    box.hidden = true;
  }
}

// ---------- Start ----------

function renderAll() {
  renderBar();
  renderGear();
  renderExtras();
  renderCosmetics();
  renderRedeem();
}

async function load() {
  const [a, r] = await Promise.allSettled([
    fetch(`${API}/shop/adventure`, { headers: authHeaders() }).then((res) => res.json().then((d) => (res.ok ? d : Promise.reject(d)))),
    fetch(`${API}/shop`).then((res) => res.json().then((d) => (res.ok ? d : Promise.reject(d)))),
  ]);
  adv = a.status === "fulfilled" ? a.value : null;
  // Cosmetics: the catalog comes with your profile extras (logged in) or the public list
  try {
    if (SinnersAuth.user) {
      const res = await fetch(`${API}/profile/extras`, { headers: authHeaders() });
      const d = await res.json();
      cos = res.ok ? { catalog: d.catalog, owned: d.cosmetics.owned } : null;
    } else {
      const res = await fetch(`${API}/cosmetics`);
      cos = res.ok ? { catalog: (await res.json()).catalog, owned: [] } : null;
    }
  } catch (e) {
    cos = null;
  }
  redeemItems = r.status === "fulfilled" ? r.value.items || [] : null;
  points = adv && adv.points != null ? adv.points : null;
  renderAll();
  loadMine();
}

showTab(location.hash.slice(1));
renderBar();
load();
const stopAuthWatch = SinnersAuth.onChange(load);
SinnersNav.onLeave(() => stopAuthWatch());
