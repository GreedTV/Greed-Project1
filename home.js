// Home page: a banner for this week's world boss (its live HP), linking to the Profile.

const API = WORKER_URL.replace(/\/$/, "");
const strip = document.getElementById("boss-strip");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function loadBoss() {
  try {
    const res = await fetch(`${API}/boss`);
    if (!res.ok) return;
    const { boss: b, fighters } = await res.json();
    const pct = Math.max(0, (b.hpLeft / b.hpMax) * 100);
    const bar = el("div", "boss-hp");
    const fill = el("span");
    fill.style.width = `${pct}%`;
    bar.append(fill);
    const hours = Math.max(0, (b.endsAt - Date.now()) / 3600000);
    const left = hours < 48 ? `${Math.ceil(hours)} h left` : `${Math.floor(hours / 24)} days left`;
    const text = el("div", "boss-strip-text");
    text.append(
      el("strong", null, b.defeatedAt ? `${b.name} has fallen!` : `This week's boss: ${b.name}`),
      el("span", "hint", b.defeatedAt ? `${fighters} fighters took it down. Claim your rewards on your Profile.` : `${b.hpLeft.toLocaleString()} / ${b.hpMax.toLocaleString()} HP · ${fighters} fighters · ${left}`),
      bar
    );
    strip.replaceChildren(el("span", "boss-strip-emoji", b.emoji), text, el("span", "button", b.defeatedAt ? "🎁 Rewards" : "⚔️ Fight"));
    strip.classList.toggle("defeated", !!b.defeatedAt);
    document.getElementById("boss-strip-section").hidden = false;
  } catch (e) {}
}

loadBoss();
const timer = setInterval(() => !document.hidden && loadBoss(), 60000);
SinnersNav.onLeave(() => clearInterval(timer));
