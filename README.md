# Sinners

Watch Kick, Twitch and YouTube streams side by side, plus a community gallery of shared images and clips.
Plain HTML, CSS and JavaScript, hosted on GitHub Pages, with a small Cloudflare Worker for the parts that need a server.

Live at https://greedtv.github.io/Greed-Project1/

## Pages

- `index.html`: home page with a quick "watch a streamer" box
- `watch.html`: watch streams one at a time with chat, or up to 4 at once
- `gallery.html`: community gallery with Images and Clips sections; visitors share links
- `about.html`: about page
- `admin.html`: review shared gallery links (password protected, not in the menu)

## Scripts

- `config.js`: the Worker address (`WORKER_URL`)
- `script.js`: menu and scroll animations (all pages)
- `watch.js`: the Watch page (players, multi-view, volume/quality, adding and fixing streamers)
- `gallery.js`: loads approved items, the viewer, and the share forms
- `admin.js`: approve / reject / remove gallery items
- `worker/sinners-worker.js`: the Cloudflare Worker

## Watch page

- Visitors add streamers by name or link; they're saved in their own browser. To show streamers to everyone, add them to `DEFAULT_STREAMERS` at the top of `watch.js`.
- YouTube can't look up names, so use a live video link (`youtube.com/watch?v=…`) or a channel link with `/channel/UC…`.
- Volume works for all platforms; the quality menu works for Twitch and Kick. YouTube quality is set from the ⚙ in its player.
- Kick streams play in HD through the Worker (see below). If it's unavailable, Kick's own player is used.

## Gallery

- Anyone can share an image link or a Kick / Twitch / YouTube clip link.
- Shared links go into a review queue and only appear after they're approved on `admin.html`.
- Each visitor can share up to 5 links per hour; image links must point to an actual image; mature Kick clips are refused.

## Cloudflare Worker

`worker/sinners-worker.js` does two jobs:

1. **Kick HD:** asks Kick's (unofficial) API for the stream and returns its master playlist with CORS headers. Video chunks load straight from Kick's servers. Kick may change or block this at any time.
2. **Gallery:** stores shared links in Workers KV and handles the review queue.

Setup in the Cloudflare dashboard (Workers & Pages → the Worker):

1. **Edit code** → paste `worker/sinners-worker.js` → **Deploy**.
2. **Bindings** → **Add binding** → **KV namespace** → variable name `GALLERY` → create a namespace (e.g. `sinners-gallery`).
3. **Settings** → **Variables and Secrets** → **Add** → type **Secret**, name `ADMIN_PASSWORD`, value: your admin password.

If you use a custom domain, add it to `ALLOWED_ORIGINS` in the Worker.

## Run it locally

Run `python -m http.server 8080` in this folder and visit http://localhost:8080. (Twitch players need a real web address, so opening the files directly won't work.)
