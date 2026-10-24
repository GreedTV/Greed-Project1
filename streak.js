// Daily login reward card, shared by all pages: when a logged-in visitor hasn't claimed today's streak
// reward yet, a small card offers it. The quests themselves live on the Profile page (/profile#daily).

(() => {
  const API = WORKER_URL.replace(/\/$/, "");
  const HIDE_KEY = "sinners-streak-hidden"; // "closed for today" (holds the day)
  let card = null;
  let checkedFor = "";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const hiddenToday = (day) => {
    try {
      return localStorage.getItem(HIDE_KEY) === day;
    } catch (e) {
      return false;
    }
  };

  function close(day) {
    if (day) {
      try {
        localStorage.setItem(HIDE_KEY, day);
      } catch (e) {}
    }
    if (card) {
      card.classList.remove("show");
      const old = card;
      setTimeout(() => old.remove(), 300);
      card = null;
    }
  }

  function rewardText(r) {
    return [`🪙 ${r.coins}`, r.potion && "a potion", r.epic && "an epic item"].filter(Boolean).join(" + ");
  }

  function show(state) {
    const s = state.streak;
    close();
    card = el("div", "streak-card");
    card.setAttribute("role", "status");
    const x = el("button", "streak-close", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.addEventListener("click", () => close(state.day));
    const flame = el("div", "streak-flame", "🔥");
    const text = el("div", "streak-text");
    text.append(
      el("strong", null, s.day === 1 ? (s.best ? "Start a new streak!" : "Daily reward") : `Day ${s.day} streak!`),
      el("span", null, `Claim ${rewardText(s.reward)}${s.day % 7 === 0 ? " 🎉" : ""}`)
    );
    const claim = el("button", "button", "Claim");
    claim.type = "button";
    claim.addEventListener("click", async () => {
      claim.disabled = true;
      try {
        const res = await fetch(`${API}/daily`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
          body: JSON.stringify({ action: "checkin" }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error);
        const extras = [r.potion && `${r.potion.emoji} ${r.potion.name} ×${r.potion.uses}`, r.item && (r.item.soldFor ? `${r.item.name} (sold, bag full)` : r.item.name)].filter(Boolean);
        text.replaceChildren(el("strong", null, `🔥 ${r.streak} day streak · +${r.coins} 🪙`), el("span", null, extras.length ? `and ${extras.join(", ")}` : "Come back tomorrow to keep it going."));
        const link = el("a", "button ghost", "📋 Daily quests");
        link.href = "/profile#daily";
        link.addEventListener("click", () => close());
        claim.replaceWith(link);
        document.dispatchEvent(new CustomEvent("sinners:daily", { detail: r.state }));
        setTimeout(() => close(), 9000);
      } catch (err) {
        text.lastChild.textContent = err.message;
        claim.disabled = false;
      }
    });
    card.append(x, flame, text, claim);
    document.body.append(card);
    void card.offsetWidth;
    card.classList.add("show");
  }

  async function check() {
    if (!SinnersAuth.user) return close();
    const day = new Date().toISOString().slice(0, 10);
    if (checkedFor === `${SinnersAuth.user.id}:${day}` || hiddenToday(day)) return;
    checkedFor = `${SinnersAuth.user.id}:${day}`;
    try {
      const res = await fetch(`${API}/daily`, { headers: { Authorization: `Bearer ${SinnersAuth.token}` } });
      if (!res.ok) return;
      const state = await res.json();
      if (!state.streak.claimedToday) show(state);
    } catch (e) {}
  }

  // Claimed on the Profile page: no need for the card
  document.addEventListener("sinners:daily", (e) => e.detail && e.detail.streak.claimedToday && card && !card.querySelector(".ghost") && close());
  SinnersAuth.onChange(check);
  setTimeout(check, 1200); // after the page has settled
})();
