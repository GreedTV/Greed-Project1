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

loadNumbers();
loginButton();
const stopAuth = SinnersAuth.onChange(loginButton);
SinnersNav.onLeave(() => stopAuth());
