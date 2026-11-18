// In-site navigation: clicking a menu link swaps the page content instead of reloading,
// so a stream in the mini player keeps playing while you browse other sections.
//
// The header, footer and shared scripts stay. Each page's own script (watch.js, content.js, ...)
// is loaded as a module when its page opens. A page whose player is in the mini player isn't
// thrown away when you leave it: it's "parked" (hidden, still running) so the mini player keeps
// going, and coming back to it shows it exactly as it was. Several pages can be parked at once
// (a YouTube video from Content and a stream from Watch, each in its own mini player).
//
// Page scripts can use:
//   SinnersNav.beforeLeave(fn)  run fn just before the page is left (e.g. shrink a playing video to the mini player)
//   SinnersNav.onLeave(fn)      run fn when the page is closed (stop timers, players, listeners)
//   SinnersNav.onReturn(fn)     run fn(url) when a parked page is opened again

const SinnersNav = (() => {
  // The site version from this file's own address (nav.js?v=...), so page scripts load the same version
  const VERSION = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "";
  const PAGE_SCRIPTS = {
    watch: "watch.js",
    content: "content.js",
    gallery: "gallery.js",
    admin: "admin.js",
    stats: "stats.js",
    profile: "profile.js",
    shop: "shop.js",
    index: "home.js",
    about: "about.js",
  };

  // "/watch", "/watch.html" -> "watch"; "/", "/index.html" -> "index"
  const pageName = (url) => new URL(url, location.href).pathname.split("/").pop().replace(/\.html$/, "") || "index";

  // Old links ending in .html still work; show the short address instead
  const cleanPath = (pathname) => pathname.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
  if (cleanPath(location.pathname) !== location.pathname) {
    history.replaceState(null, "", cleanPath(location.pathname) + location.search + location.hash);
  }

  function makePage(main, url, title) {
    return { name: pageName(url), url, main, title, before: [], leave: [], returns: [] };
  }

  let current = makePage(document.querySelector("main"), location.href, document.title);
  const parked = new Map(); // page name -> parked page
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
    page.main.removeAttribute("id"); // "Skip to content" goes to the page on screen
    parked.set(page.name, page);
  }

  async function loadScript(page) {
    const file = PAGE_SCRIPTS[page.name];
    if (!file) return;
    // A fresh copy each time, so the page script starts clean; ?v= matches this site version
    await import(new URL(`${file}?v=${VERSION}&load=${++loads}`, location.href).href);
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

  // A thin bar at the top while the next page loads
  const progress = document.createElement("div");
  progress.className = "nav-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.prepend(progress);
  let progressTimer = null;
  function loading(on) {
    clearTimeout(progressTimer);
    if (on) {
      progress.className = "nav-progress";
      void progress.offsetWidth;
      progress.classList.add("loading");
    } else {
      progress.classList.add("done");
      progressTimer = setTimeout(() => (progress.className = "nav-progress"), 400);
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
    loading(true);
    try {
      let next;
      let returning = false;

      if (parked.has(name)) {
        // Back to a page that's playing in the mini player
        next = parked.get(name);
        parked.delete(name);
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
      leaving.before.forEach((fn) => {
        try {
          fn(target);
        } catch (e) {}
      });
      if (hasMini(leaving)) {
        park(leaving);
      } else {
        destroy(leaving);
      }

      if (returning) {
        // Already in the page, just hidden. Moving it would pause or restart its player.
        next.main.classList.remove("page-parked");
        next.main.removeAttribute("aria-hidden");
        next.main.id = "main";
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
      loading(false);
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

  // A mini player was closed while its page was parked: that page can go now
  document.addEventListener("sinners:mini-closed", () => {
    parked.forEach((page, name) => {
      if (hasMini(page)) return;
      destroy(page);
      parked.delete(name);
    });
  });

  // Start the first page's script
  loadScript(current);

  return {
    go,
    beforeLeave: (fn) => current.before.push(fn),
    onLeave: (fn) => current.leave.push(fn),
    onReturn: (fn) => current.returns.push(fn),
    // Open the parked page that holds this element (its mini player's "back to the page" button)
    goToParked: (node) => {
      for (const page of parked.values()) if (!node || page.main.contains(node)) return go(page.url);
    },
  };
})();
