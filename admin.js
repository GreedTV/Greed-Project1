// Gallery review: approve or reject links people shared. The password is checked by the Worker.

const API = WORKER_URL.replace(/\/$/, "");
const PASSWORD_KEY = "sinners-admin";

const loginForm = document.getElementById("login");
const passwordInput = document.getElementById("password");
const loginMsg = document.getElementById("login-msg");
const panel = document.getElementById("admin");

let password = "";
try {
  password = sessionStorage.getItem(PASSWORD_KEY) || "";
} catch (e) {}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}`, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

async function refresh() {
  try {
    const data = await api("/gallery/pending");
    loginForm.hidden = true;
    panel.hidden = false;
    renderList("pending", data.pending || []);
    renderList("approved", data.approved || []);
  } catch (err) {
    if (err.status === 401) return logout("Wrong password.");
    loginMsg.textContent = err.message;
  }
  refreshChat();
  refreshGames();
  refreshShop();
  refreshBot();
}

// ---------- Discord bot ----------

async function refreshBot() {
  const box = document.getElementById("bot-admin");
  let s;
  try {
    s = await api("/discord-admin");
  } catch (err) {
    box.replaceChildren(el("p", "gallery-empty", `Bot status unavailable: ${err.message}`));
    return;
  }
  const checks = el("ul", "bot-checks");
  [
    [s.clientId, "DISCORD_CLIENT_ID (Text)"],
    [s.publicKey, "DISCORD_PUBLIC_KEY (Text): Developer Portal → General Information → Public Key"],
    [s.botToken, "DISCORD_BOT_TOKEN (Secret): Developer Portal → Bot → Reset Token"],
    [s.notifyChannel, s.notifyChannel ? `Notifications go to channel ${s.notifyChannel}` : "Notification channel: type /notify-here in a Discord channel"],
    [
      s.statsBoard && !s.statsBoard.error,
      s.statsBoard
        ? `Live stats board in channel ${s.statsBoard.channel}, every ${s.statsBoard.every} min` +
          (s.statsBoard.last ? `, last update ${new Date(s.statsBoard.last).toLocaleString()}` : "") +
          (s.statsBoard.error ? ` (${s.statsBoard.error})` : "") +
          (s.statsBoard.last && Date.now() - s.statsBoard.last > (s.statsBoard.every * 2 + 10) * 60000
            ? ". ⚠️ Not updating: check the Cron Trigger (Cloudflare → Worker → Settings → Trigger events, every 5 minutes)"
            : "")
        : "Live stats board: type /stats-live in a Discord channel. It also needs a Cron Trigger every 5 minutes (Cloudflare → Worker → Settings → Trigger events)",
    ],
  ].forEach(([ok, label]) => checks.append(el("li", ok ? "ok" : "missing", `${ok ? "✓" : "✕"} ${label}`)));

  const endpoint = el("p", "hint");
  endpoint.append("Interactions Endpoint URL (Developer Portal → General Information): ", el("code", null, s.interactionsUrl));

  const actions = el("div", "admin-bar");
  if (s.inviteUrl) {
    const invite = el("a", "button ghost", "Add bot to a server");
    invite.href = s.inviteUrl;
    invite.target = "_blank";
    invite.rel = "noopener noreferrer";
    actions.append(invite);
  }
  const register = el("button", "button", "Register commands");
  register.type = "button";
  register.disabled = !(s.clientId && s.botToken);
  const msg = el("p", "form-msg");
  register.addEventListener("click", async () => {
    register.disabled = true;
    msg.className = "form-msg";
    msg.textContent = "Registering…";
    try {
      const r = await api("/discord-admin", { method: "POST", body: JSON.stringify({ action: "register" }) });
      msg.className = "form-msg ok";
      msg.textContent = `Done: ${r.commands.map((c) => "/" + c).join(", ")}. They can take a minute to show up in Discord.`;
    } catch (err) {
      msg.className = "form-msg error";
      msg.textContent = err.message;
    } finally {
      register.disabled = false;
    }
  });
  actions.append(register);
  box.replaceChildren(
    el("p", null, `Commands: ${s.commands.map((c) => "/" + c).join("  ")}`),
    checks,
    endpoint,
    actions,
    msg
  );
}

// ---------- Shop ----------

const shopForm = document.getElementById("shop-form");
const shopFile = document.getElementById("shop-file");
const shopPreview = document.getElementById("shop-preview");
const shopDropText = document.getElementById("shop-drop-text");
const shopMsg = document.getElementById("shop-msg");
const shopFields = ["name", "desc", "price", "stock"].map((f) => document.getElementById(`shop-${f}`));
const shopExtra = Object.fromEntries(["tier", "kind", "slot", "rarity", "power"].map((f) => [f, document.getElementById(`shop-${f}`)]));
const showGearFields = () => {
  const gear = shopExtra.kind.value === "gear";
  document.getElementById("shop-gear").hidden = !gear;
  document.getElementById("shop-gear-hint").hidden = !gear;
};
shopExtra.kind.addEventListener("change", showGearFields);
let shopImage = ""; // data URL of the picked picture
let editingItem = null;

function setShopMsg(text, type) {
  shopMsg.className = "form-msg" + (type ? ` ${type}` : "");
  shopMsg.textContent = text;
}

// Pictures are shrunk to at most 800px in the browser so they load fast. GIFs are kept as they are (to keep the animation).
function readPicture(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error("Pick a JPG, PNG, WebP or GIF picture."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      if (file.type === "image/gif") {
        if (file.size > 1500000) return reject(new Error("GIFs can be at most 1.5 MB."));
        return resolve(reader.result);
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't open that picture."));
      img.onload = () => {
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL("image/webp", 0.85);
        if (!url.startsWith("data:image/webp")) url = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function pickPicture(file) {
  if (!file) return;
  try {
    shopImage = await readPicture(file);
    shopPreview.src = shopImage;
    shopPreview.hidden = false;
    shopDropText.hidden = true;
    setShopMsg("");
  } catch (err) {
    setShopMsg(err.message, "error");
  }
}

shopFile.addEventListener("change", () => pickPicture(shopFile.files[0]));
const drop = document.getElementById("shop-drop");
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  pickPicture(e.dataTransfer.files[0]);
});

function resetShopForm() {
  editingItem = null;
  shopImage = "";
  shopForm.reset();
  shopPreview.hidden = true;
  shopPreview.removeAttribute("src");
  shopDropText.hidden = false;
  document.getElementById("shop-form-title").textContent = "Add an item";
  document.getElementById("shop-save").textContent = "Add to shop";
  document.getElementById("shop-cancel").hidden = true;
  showGearFields();
}

function editItem(item) {
  editingItem = item;
  shopImage = "";
  const [name, desc, price, stock] = shopFields;
  name.value = item.name;
  desc.value = item.description;
  price.value = item.price;
  stock.value = item.stock == null ? "" : item.stock;
  shopExtra.tier.value = item.tier || 1;
  shopExtra.kind.value = item.kind || "reward";
  shopExtra.slot.value = item.slot || "helmet";
  shopExtra.rarity.value = item.rarity || "common";
  shopExtra.power.value = item.power || "";
  showGearFields();
  shopPreview.src = API + item.image;
  shopPreview.hidden = false;
  shopDropText.hidden = true;
  document.getElementById("shop-form-title").textContent = `Edit "${item.name}"`;
  document.getElementById("shop-save").textContent = "Save changes";
  document.getElementById("shop-cancel").hidden = false;
  setShopMsg("Pick a new picture only if you want to change it.");
  shopForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("shop-cancel").addEventListener("click", () => {
  resetShopForm();
  setShopMsg("");
});

shopForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingItem && !shopImage) return setShopMsg("Choose a picture for the item.", "error");
  const [name, desc, price, stock] = shopFields.map((f) => f.value.trim());
  const body = { action: editingItem ? "update" : "add", name, description: desc, price, stock };
  Object.entries(shopExtra).forEach(([k, input]) => (body[k] = input.value));
  if (editingItem) body.id = editingItem.id;
  if (shopImage) body.image = shopImage;
  const save = document.getElementById("shop-save");
  save.disabled = true;
  setShopMsg("Saving…");
  try {
    await api("/shop-admin", { method: "POST", body: JSON.stringify(body) });
    const added = !editingItem;
    resetShopForm();
    setShopMsg(added ? `"${name}" is in the shop now.` : "Saved.", "ok");
    await refreshShop();
  } catch (err) {
    setShopMsg(err.message, "error");
  } finally {
    save.disabled = false;
  }
});

async function shopAction(body, confirmText, button) {
  if (confirmText && !confirm(confirmText)) return;
  button.disabled = true;
  try {
    await api("/shop-admin", { method: "POST", body: JSON.stringify(body) });
    await refreshShop();
  } catch (err) {
    button.disabled = false;
    alert(err.message);
  }
}

async function refreshShop() {
  const list = document.getElementById("shop-list");
  const bought = document.getElementById("purchase-list");
  let data;
  try {
    data = await api("/shop-admin");
  } catch (err) {
    list.replaceChildren(el("p", "gallery-empty", `Shop unavailable: ${err.message}`));
    bought.replaceChildren();
    return;
  }
  const items = data.items || [];
  document.getElementById("shop-count").textContent = items.length ? `(${items.length})` : "";
  if (!items.length) list.replaceChildren(el("p", "gallery-empty", "The shop is empty. Add the first item above."));
  else
    list.replaceChildren(
      ...items.map((item) => {
        const row = el("div", "review-item");
        const pic = el("div", "review-preview");
        const img = el("img");
        img.src = API + item.image;
        img.alt = "";
        pic.append(img);
        const info = el("div", "review-info");
        info.append(el("strong", null, item.name));
        if (item.description) info.append(el("span", null, item.description));
        info.append(
          el(
            "small",
            null,
            `🪙 ${item.price} · ${item.stock == null ? "unlimited" : `${item.stock} left`} · tier ${item.tier || 1} · ` +
              (item.kind === "gear" ? `gear: ${item.rarity} ${item.slot}, +${item.power} power` : "reward")
          )
        );
        const actions = el("div", "review-actions");
        const edit = el("button", "button ghost", "Edit");
        edit.type = "button";
        edit.addEventListener("click", () => editItem(item));
        const del = el("button", "button ghost", "Delete");
        del.type = "button";
        del.addEventListener("click", () => shopAction({ action: "delete", id: item.id }, `Delete "${item.name}" from the shop?`, del));
        actions.append(edit, del);
        row.append(pic, info, actions);
        return row;
      })
    );

  const purchases = data.purchases || [];
  if (!purchases.length) return bought.replaceChildren(el("p", "gallery-empty", "Nobody has bought anything yet."));
  bought.replaceChildren(
    ...purchases.map((p) => {
      const row = el("div", "review-item chat-review" + (p.delivered ? " delivered" : ""));
      const info = el("div", "review-info");
      info.append(el("strong", null, `${p.name} bought ${p.item}`));
      info.append(el("small", null, `🪙 ${p.price} · ${new Date(p.created).toLocaleString()} · Discord ID ${p.userId}`));
      const actions = el("div", "review-actions");
      const mark = el("button", p.delivered ? "button ghost" : "button", p.delivered ? "Undo" : "✓ Mark delivered");
      mark.type = "button";
      mark.addEventListener("click", () => shopAction({ action: "deliver", purchaseId: p.id, delivered: !p.delivered }, null, mark));
      actions.append(mark);
      row.append(info, actions);
      return row;
    })
  );
}

// ---------- Game leaderboards ----------

const GAME_NAMES = {
  reaction: ["⚡ Quick Draw", (v) => `${Math.round(v)} ms`],
  aim: ["🎯 Target Rush", (v) => `${v} hits`],
  typing: ["⌨️ Chat Typer", (v) => `${v} words`],
};

async function gameAction(body, confirmText, button) {
  if (confirmText && !confirm(confirmText)) return;
  button.disabled = true;
  try {
    await api("/games-admin", { method: "POST", body: JSON.stringify(body) });
    await refreshGames();
  } catch (err) {
    button.disabled = false;
    alert(err.message);
  }
}

async function refreshGames() {
  const box = document.getElementById("games-admin");
  let boards;
  try {
    boards = await api("/games-admin");
  } catch (err) {
    box.replaceChildren(el("p", "gallery-empty", `Leaderboards unavailable: ${err.message}`));
    return;
  }
  // Points (earned in games, bet in Color Clash / Lucky Number)
  const richest = boards.richest || [];
  const pointsCard = el("div", "side-box games-admin-card");
  const pointsHead = el("div", "side-head");
  pointsHead.append(el("h3", null, `🪙 Points (${richest.length} players)`));
  const resetPoints = el("button", "button ghost", "Reset all points");
  resetPoints.type = "button";
  resetPoints.disabled = !richest.length;
  resetPoints.addEventListener("click", () =>
    gameAction(
      { action: "reset-points" },
      "Reset everyone's points? Every player goes back to the starting amount, and all bets and round history are cleared.",
      resetPoints
    )
  );
  pointsHead.append(resetPoints);
  pointsCard.append(pointsHead);
  if (!richest.length) pointsCard.append(el("p", "lb-empty", "Nobody has points yet."));
  else {
    const list = el("ol", "lb-list");
    richest.forEach((p, i) => {
      const li = el("li", "lb-row admin-row");
      li.append(el("span", "lb-rank", `${i + 1}`), el("span", "lb-name", p.name), el("span", "lb-score", `${p.points} 🪙`), el("span"));
      list.append(li);
    });
    pointsCard.append(list);
  }

  box.replaceChildren(
    pointsCard,
    ...Object.entries(GAME_NAMES).map(([id, [name, format]]) => {
      const scores = boards[id] || [];
      const card = el("div", "side-box games-admin-card");
      const head = el("div", "side-head");
      head.append(el("h3", null, `${name} (${scores.length})`));
      const reset = el("button", "button ghost", "Reset leaderboard");
      reset.type = "button";
      reset.disabled = !scores.length;
      reset.addEventListener("click", () => gameAction({ action: "reset", game: id }, `Delete every ${name} score? This can't be undone.`, reset));
      head.append(reset);
      card.append(head);
      if (!scores.length) {
        card.append(el("p", "lb-empty", "No scores yet."));
        return card;
      }
      const list = el("ol", "lb-list");
      scores.forEach((s, i) => {
        const li = el("li", "lb-row admin-row");
        li.append(el("span", "lb-rank", `${i + 1}`), el("span", "lb-name", s.name), el("span", "lb-score", format(s.score)));
        const remove = el("button", "link-btn", "Remove");
        remove.type = "button";
        remove.addEventListener("click", () => gameAction({ action: "delete", game: id, userId: s.userId }, `Remove ${s.name}'s ${name} score?`, remove));
        li.append(remove);
        list.append(li);
      });
      card.append(list);
      return card;
    })
  );
}

// ---------- Chat moderation ----------

async function refreshChat() {
  const chatList = document.getElementById("chat-list");
  const bannedList = document.getElementById("banned-list");
  try {
    const data = await api("/chat-admin");
    renderChat(chatList, data.messages || []);
    renderBanned(bannedList, data.banned || []);
  } catch (err) {
    chatList.replaceChildren(el("p", "gallery-empty", `Chat moderation unavailable: ${err.message}`));
    bannedList.replaceChildren();
  }
}

function chatAction(body, confirmText) {
  return async (e) => {
    if (confirmText && !confirm(confirmText)) return;
    e.target.disabled = true;
    try {
      await api("/chat-admin", { method: "POST", body: JSON.stringify(body) });
      await refreshChat();
    } catch (err) {
      e.target.disabled = false;
      alert(err.message);
    }
  };
}

function renderChat(container, messages) {
  if (!messages.length) return container.replaceChildren(el("p", "gallery-empty", "No chat messages yet."));
  container.replaceChildren(
    ...messages.map((m) => {
      const row = el("div", "review-item chat-review");
      const info = el("div", "review-info");
      info.append(el("strong", null, m.name));
      info.append(el("span", null, m.text));
      info.append(el("small", null, `${m.room} · ${new Date(m.created).toLocaleString()}`));
      const actions = el("div", "review-actions");
      const del = el("button", "button ghost", "Delete");
      del.type = "button";
      del.addEventListener("click", chatAction({ action: "delete", id: m.id }));
      const ban = el("button", "button ghost", "Ban user");
      ban.type = "button";
      ban.addEventListener("click", chatAction({ action: "ban", userId: m.userId }, `Ban ${m.name}? Their messages from the last day will be removed.`));
      actions.append(del, ban);
      row.append(info, actions);
      return row;
    })
  );
}

function renderBanned(container, users) {
  document.getElementById("banned-count").textContent = users.length ? `(${users.length})` : "";
  if (!users.length) return container.replaceChildren(el("p", "gallery-empty", "Nobody is banned."));
  container.replaceChildren(
    ...users.map((u) => {
      const row = el("div", "review-item chat-review");
      const info = el("div", "review-info");
      info.append(el("strong", null, u.name), el("small", null, u.id));
      const unban = el("button", "button ghost", "Unban");
      unban.type = "button";
      unban.addEventListener("click", chatAction({ action: "unban", userId: u.id }));
      const actions = el("div", "review-actions");
      actions.append(unban);
      row.append(info, actions);
      return row;
    })
  );
}

function preview(item) {
  const box = el("div", "review-preview");
  const src = item.kind === "image" ? item.url : item.thumb;
  if (src) {
    const img = el("img");
    img.src = src;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    box.append(img);
  } else {
    box.append(el("span", "clip-thumb-label", item.platform));
  }
  return box;
}

function renderList(which, list) {
  document.getElementById(`${which}-count`).textContent = list.length ? `(${list.length})` : "";
  const container = document.getElementById(`${which}-list`);
  if (!list.length) {
    container.replaceChildren(el("p", "gallery-empty", which === "pending" ? "Nothing waiting. 🎉" : "Nothing approved yet."));
    return;
  }
  container.replaceChildren(
    ...list.map((item) => {
      const row = el("div", "review-item");
      const info = el("div", "review-info");
      info.append(el("span", `platform ${item.platform || "image"}`, item.platform || "image"));
      info.append(el("strong", null, item.title || "(no title)"));
      const link = el("a", null, item.link || item.url);
      link.href = item.link || item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      info.append(link);
      const meta = [item.name && `by ${item.name}`, new Date(item.created).toLocaleString()].filter(Boolean).join(" · ");
      info.append(el("small", null, meta));

      const actions = el("div", "review-actions");
      const buttons = which === "pending" ? [["approve", "✓ Approve", "button"], ["reject", "✕ Reject", "button ghost"]] : [["delete", "Remove", "button ghost"]];
      buttons.forEach(([action, label, cls]) => {
        const btn = el("button", cls, label);
        btn.type = "button";
        btn.addEventListener("click", async () => {
          if (action === "delete" && !confirm("Remove this from the gallery?")) return;
          btn.disabled = true;
          try {
            await api("/gallery/moderate", { method: "POST", body: JSON.stringify({ id: item.id, action }) });
            await refresh();
          } catch (err) {
            btn.disabled = false;
            alert(err.message);
          }
        });
        actions.append(btn);
      });

      row.append(preview(item), info, actions);
      return row;
    })
  );
}

function logout(message = "") {
  password = "";
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch (e) {}
  panel.hidden = true;
  loginForm.hidden = false;
  loginMsg.className = message ? "form-msg error" : "form-msg";
  loginMsg.textContent = message;
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  password = passwordInput.value;
  try {
    sessionStorage.setItem(PASSWORD_KEY, password);
  } catch (e) {}
  passwordInput.value = "";
  loginMsg.className = "form-msg";
  loginMsg.textContent = "Checking…";
  refresh();
});

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("logout").addEventListener("click", () => logout());

if (password) refresh();
