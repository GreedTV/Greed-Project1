// Service worker: makes Sinners installable as an app, and shows a friendly page instead of the
// browser's error when there's no internet. It caches nothing else: pages, streams and the Worker
// always come fresh from the network, so updates show up right away.

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · Sinners</title>
<style>
  html { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    font-family: Inter, system-ui, sans-serif; color: #efeff1; background: #0e0e10; text-align: center; }
  .box { max-width: 420px; }
  .mark { display: inline-grid; place-items: center; width: 56px; height: 56px; margin-bottom: 14px; font: 800 1.8rem/1 sans-serif;
    color: #fff; background: #e0123c; border-radius: 8px; }
  h1 { margin: 0 0 8px; font-size: 1.6rem; }
  p { margin: 0 0 18px; color: #adadb8; }
  button { padding: 10px 18px; font: inherit; font-weight: 600; color: #fff; background: #e0123c; border: 0; border-radius: 4px; cursor: pointer; }
</style>
</head>
<body>
  <div class="box">
    <div class="mark">S</div>
    <h1>You're offline</h1>
    <p>Sinners needs the internet for streams and chat. Check your connection and try again.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Only full page loads; everything else goes straight to the network as usual
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
