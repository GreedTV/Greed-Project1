# Sinners

A gaming and streaming website built with plain HTML, CSS and JavaScript.

Live at https://greedtv.github.io/Greed-Project1/

## Pages

- `index.html`: home page with live/next-stream badge, stats, latest clips and socials
- `watch.html`: watch Twitch, YouTube and Kick streams, one at a time with chat or up to 4 at once
- `schedule.html`: weekly stream schedule (today is highlighted automatically)
- `gallery.html`: filterable image gallery with a click-to-enlarge viewer
- `about.html`: about, setup and collab info

## Other files

- `styles.css`: colors, layout and animations
- `script.js`: menu, scroll animations, live badge, gallery filters and viewer
- `watch.js`: the Watch page (players, multi-view, adding and fixing streamers)
- `images/`: gallery and clip images

## Editing

- **Colors:** change `--accent` and `--accent-2` at the top of `styles.css`.
- **Social links:** replace the `href="#"` links (marked with comments) in each page.
- **Schedule:** edit the rows in `schedule.html`, and update the `STREAMS` list at the top of `script.js` so the home page badge matches.
- **Gallery:** add an image to `images/`, then copy one `<button class="gallery-item">` block in `gallery.html`. The `data-category` value must match a filter button.
- **Stats:** change the `data-count` numbers in `index.html`.
- **Streamers on the Watch page:** visitors can add streamers by name or link with the "Add a streamer" box, but those are saved only in their own browser. To show streamers to everyone, add them to `DEFAULT_STREAMERS` at the top of `watch.js`.
  - YouTube can't look up names, so use a live video link (`youtube.com/watch?v=…`) or a channel link with `/channel/UC…`.
  - Volume controls work for Twitch and YouTube; the quality picker (Auto, Source, 360p–1080p) works for Twitch. Kick has no player API, so Kick streams use the Kick player's own controls, and YouTube quality is set from the ⚙ in its player.
  - Twitch chat and players only work when the site is opened through a web address (GitHub Pages or a local server), not by double-clicking the file.

## Kick HD player (Cloudflare Worker)

Kick's official embed is limited in quality and can't be controlled by the page. For HD Kick streams with volume and quality controls, the site uses a small Cloudflare Worker (`worker/kick-proxy.js`):

1. The Worker asks Kick's (unofficial) API for the stream and returns its master playlist with CORS headers.
2. The Watch page plays it with [hls.js](https://github.com/video-dev/hls.js). Quality playlists and video chunks load straight from Kick's video servers, so the Worker handles one small request per stream start.
3. If the Worker is down or blocked, the page falls back to Kick's official player.

To set it up: create a Worker in the Cloudflare dashboard, paste in `worker/kick-proxy.js`, deploy, then put the Worker's address in `KICK_PROXY` at the top of `watch.js`. If you use a custom domain, add it to `ALLOWED_ORIGINS` in the Worker.

This relies on Kick's private API, so Kick may change or block it at any time.

## Run it locally

Open `index.html` in a browser, or run `python -m http.server` in this folder and visit http://localhost:8000.
