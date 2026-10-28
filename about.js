// About page: live community numbers (from the Worker's /stats) and the login button.

const API = WORKER_URL.replace(/\/$/, "");
const $ = (id) => document.getElementById(id);

async function loadNumbers() {
  try {
    const res = await fetch(`${API}/stats`);
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, n) => ($(id).textContent = Number(n || 0).toLocaleString());
    set("n-online", s.online);
    set("n-players", s.community.players);
    set("n-visitors", s.allTime.visitors);
    set("n-chat", s.community.chatMessages);
    set("n-gallery", s.community.galleryItems);
  } catch (e) {}
}

// Already logged in: the button opens your profile instead
function loginButton() {
  const b = $("about-login");
  b.textContent = SinnersAuth.user ? "👤 Your profile" : "Log in";
}
$("about-login").addEventListener("click", () => (SinnersAuth.user ? SinnersNav.go(`${location.origin}/profile`) : SinnersAuth.login()));

// Our Discord: live member and online counts, the server's name, icon and animated banner
async function loadDiscord() {
  try {
    const code = DISCORD_INVITE.split("/").pop();
    const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
    if (!res.ok) return;
    const d = await res.json();
    const g = d.guild || {};
    $("dc-online").textContent = Number(d.approximate_presence_count || 0).toLocaleString();
    $("dc-members").textContent = Number(d.approximate_member_count || 0).toLocaleString();
    if (g.name) $("dc-name").textContent = g.name;
    if (g.icon) $("dc-icon").src = `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith("a_") ? "gif" : "png"}?size=128`;
    const art = g.banner ? `banners/${g.id}/${g.banner}.${g.banner.startsWith("a_") ? "gif" : "png"}` : g.splash ? `splashes/${g.id}/${g.splash}.jpg` : null;
    if (art) $("dc-banner").style.backgroundImage = `url("https://cdn.discordapp.com/${art}?size=1024")`;
  } catch (e) {}
}

loadNumbers();
loadDiscord();
loginButton();
const stopAuth = SinnersAuth.onChange(loginButton);
SinnersNav.onLeave(() => stopAuth());
