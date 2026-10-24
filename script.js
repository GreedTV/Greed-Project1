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
