// In-site navigation: clicking a menu link swaps the page content instead of reloading,
// so a stream in the mini player keeps playing while you browse other sections.
//
// The header, footer and shared scripts stay. Each page's own script (watch.js, content.js, ...)
// is loaded as a module when its page opens. A page whose player is in the mini player isn't
// thrown away when you leave it: it's "parked" (hidden, still running) so the mini player keeps
// going, and coming back to it shows it exactly as it was.
//
// Page scripts can use:
//   SinnersNav.onLeave(fn)   run fn when the page is closed (stop timers, players, listeners)
//   SinnersNav.onReturn(fn)  run fn(url) when a parked page is opened again

const SinnersNav = (() => {
  const PAGE_SCRIPTS = {
    watch: "watch.js",
    content: "content.js",
    gallery: "gallery.js",
    games: "games.js",
    admin: "admin.js",
    stats: "stats.js",
  };

  // "/watch", "/watch.html" -> "watch"; "/", "/index.html" -> "index"
  const pageName = (url) => new URL(url, location.href).pathname.split("/").pop().replace(/\.html$/, "") || "index";

  // Old links ending in .html still work; show the short address instead
  const cleanPath = (pathname) => pathname.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
  if (cleanPath(location.pathname) !== location.pathname) {
    history.replaceState(null, "", cleanPath(location.pathname) + location.search + location.hash);
  }

  function makePage(main, url, title) {
    return { name: pageName(url), url, main, title, leave: [], returns: [] };
  }

  let current = makePage(document.querySelector("main"), location.href, document.title);
  let parked = null;
  let loads = 0;
  let busy = false;

  const hasMini = (page) => !!page.main.querySelector(".player-box.mini");

  function destroy(page) {
    page.leave.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    page.main.remove();
  }

  function park(page) {
    page.main.classList.add("page-parked");
    page.main.setAttribute("aria-hidden", "true");
    parked = page;
  }

  async function loadScript(page) {
    const file = PAGE_SCRIPTS[page.name];
    if (!file) return;
    // A fresh copy each time, so the page script starts clean
    await import(new URL(`${file}?load=${++loads}`, location.href).href);
  }

  function updateMenu() {
    document.querySelectorAll("#nav-links a").forEach((a) => {
      const here = pageName(a.href) === current.name;
      here ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    });
    const links = document.getElementById("nav-links");
    const toggle = document.getElementById("menu-toggle");
    if (links && links.classList.contains("open")) {
      links.classList.remove("open");
      toggle.textContent = "☰";
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  async function go(url, { push = true } = {}) {
    if (busy) return;
    const target = new URL(url, location.href);
    const name = pageName(target);
    const leaving = current;
    if (name === leaving.name && target.search === new URL(leaving.url).search) {
      if (push && target.hash !== location.hash) history.pushState(null, "", target.href);
      return;
    }
    busy = true;
    try {
      let next;
      let returning = false;

      if (parked && parked.name === name) {
        // Back to the page that's playing in the mini player
        next = parked;
        parked = null;
        returning = true;
      } else {
        const res = await fetch(cleanPath(target.pathname) + target.search, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const main = doc.querySelector("main");
        if (!main) throw new Error("No page content");
        next = makePage(document.adoptNode(main), target.href, doc.title);
        next.description = doc.querySelector('meta[name="description"]')?.content;
      }

      // Leave the current page: park it if its player is floating, otherwise close it
      if (hasMini(leaving)) {
        if (parked) destroy(parked);
        park(leaving);
      } else {
        destroy(leaving);
      }

      if (returning) {
        // Already in the page, just hidden. Moving it would pause or restart its player.
        next.main.classList.remove("page-parked");
        next.main.removeAttribute("aria-hidden");
      } else {
        document.querySelector(".site-footer").before(next.main);
      }
      next.url = target.href;
      current = next;

      if (push) history.pushState(null, "", cleanPath(target.pathname) + target.search + target.hash);
      document.title = next.title;
      if (next.description) document.querySelector('meta[name="description"]')?.setAttribute("content", next.description);
      updateMenu();
      document.dispatchEvent(new CustomEvent("sinners:page"));
      window.scrollTo(0, 0);
      observeReveals(next.main);

      if (returning) {
        SinnersMini.restoreIn(next.main);
        next.returns.forEach((fn) => fn(target));
      } else {
        await loadScript(next);
      }
    } catch (err) {
      // Anything unexpected: fall back to a normal page load
      console.error("In-site navigation failed, reloading instead:", err);
      location.href = target.href;
    } finally {
      busy = false;
    }
  }

  // Internal links
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    // Only site pages: "/", "/watch", "/watch.html" (not files like /og-image.png)
    if (url.origin !== location.origin || !/(^|\/)([\w-]+(\.html)?)?$/.test(url.pathname)) return;
    // Same page, only a #section change: let the browser handle it
    if (pageName(url) === current.name && url.search === location.search && url.hash) return;
    e.preventDefault();
    go(url.href);
  });

  // Forms that open another page, like the home page's quick watch box
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (e.defaultPrevented || form.method.toLowerCase() !== "get" || !form.getAttribute("action")) return;
    const url = new URL(form.getAttribute("action"), location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    url.search = new URLSearchParams(new FormData(form)).toString();
    go(url.href);
  });

  window.addEventListener("popstate", () => go(location.href, { push: false }));

  // The mini player was closed while its page was parked: that page can go now
  document.addEventListener("sinners:mini-closed", () => {
    if (parked && !hasMini(parked)) {
      destroy(parked);
      parked = null;
    }
  });

  // Start the first page's script
  loadScript(current);

  return {
    go,
    onLeave: (fn) => current.leave.push(fn),
    onReturn: (fn) => current.returns.push(fn),
    goToParked: () => parked && go(parked.url),
  };
})();
