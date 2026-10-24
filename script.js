// Stream times used by the "live" badge on the home page.
// Keep this in sync with schedule.html. day: 0 = Sunday ... 6 = Saturday, hour: 24h clock.
const STREAMS = [
  { day: 1, hour: 20 },
  { day: 2, hour: 20 },
  { day: 4, hour: 21 },
  { day: 5, hour: 22 },
  { day: 6, hour: 18 },
];
const STREAM_LENGTH_HOURS = 3;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Footer year
document.querySelectorAll("#year").forEach((el) => (el.textContent = new Date().getFullYear()));

// Mobile menu
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", open);
    menuToggle.textContent = open ? "✕" : "☰";
  });
}

// Scroll reveal, staggered for items that appear together
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries
      .filter((e) => e.isIntersecting)
      .forEach((entry, i) => {
        entry.target.style.transitionDelay = `${i * 80}ms`;
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// Count-up numbers
const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString() + (t === 1 && target >= 100 ? "+" : "");
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countObserver.unobserve(el);
  });
});
document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

// Live badge: "Live now" during a scheduled stream, otherwise the next stream
const badge = document.getElementById("live-badge");
if (badge) {
  const now = new Date();
  const live = STREAMS.some((s) => {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() - s.day + 7) % 7));
    start.setHours(s.hour, 0, 0, 0);
    return now >= start && now < start.getTime() + STREAM_LENGTH_HOURS * 3600000;
  });

  const text = document.getElementById("live-text");
  if (live) {
    badge.classList.add("is-live");
    text.textContent = "Live now";
  } else {
    const next = STREAMS.map((s) => {
      const d = new Date(now);
      d.setDate(now.getDate() + ((s.day - now.getDay() + 7) % 7));
      d.setHours(s.hour, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 7);
      return d;
    }).sort((a, b) => a - b)[0];
    const time = next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    text.textContent = `Next stream: ${DAY_NAMES[next.getDay()]} ${time}`;
  }
}

// Highlight today on the schedule page
document.querySelectorAll(".schedule-row").forEach((row) => {
  if (Number(row.dataset.day) === new Date().getDay()) row.classList.add("today");
});

// Gallery filters
const filters = document.querySelectorAll(".filter");
const items = [...document.querySelectorAll(".gallery-item")];
filters.forEach((btn) => {
  btn.addEventListener("click", () => {
    filters.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.filter;
    items.forEach((item) => item.classList.toggle("hidden", f !== "all" && item.dataset.category !== f));
  });
});

// Lightbox
const lightbox = document.getElementById("lightbox");
if (lightbox) {
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lightbox-caption");
  let current = 0;

  const visibleItems = () => items.filter((i) => !i.classList.contains("hidden"));

  const show = (index) => {
    const list = visibleItems();
    current = (index + list.length) % list.length;
    const source = list[current].querySelector("img");
    img.src = source.src;
    img.alt = source.alt;
    caption.textContent = source.alt;
  };

  const open = (item) => {
    show(visibleItems().indexOf(item));
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
  };

  items.forEach((item) => item.addEventListener("click", () => open(item)));
  lightbox.querySelector(".close").addEventListener("click", close);
  lightbox.querySelector(".prev").addEventListener("click", () => show(current - 1));
  lightbox.querySelector(".next").addEventListener("click", () => show(current + 1));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
}
