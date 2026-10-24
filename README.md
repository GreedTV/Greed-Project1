# Sinners

Watch Kick, Twitch and YouTube streams side by side, plus a community gallery of shared images and clips.
Plain HTML, CSS and JavaScript, hosted on GitHub Pages, with a small Cloudflare Worker for the parts that need a server.

Live at https://sinnerstv.com/

## Pages

- `index.html`: home page with a quick "watch a streamer" box
- `watch.html`: watch streams one at a time with chat, or up to 4 at once
- `content.html`: watch YouTube videos and playlists while waiting for a stream, with a Kick live alert
- `gallery.html`: community gallery with Images and Clips sections; visitors share links
- `about.html`: short, plain about page (to be filled in later)
- `admin.html`: review shared gallery links (password protected, not in the menu)

## Scripts

- `config.js`: the Worker address (`WORKER_URL`)
- `theme.js`: light / dark theme toggle, loaded in <head> on all pages
- `script.js`: menu and scroll animations (all pages)
- `auth.js`: Discord login and the menu's Log in / profile button (all pages)
- `chat.js`: Sinners chat (our own chat room per stream)
- `watch.js`: the Watch page (players, multi-view, volume/quality, chat column, adding and fixing streamers)
- `gallery.js`: loads approved items, the viewer, and the share forms
- `content.js`: YouTube queue (saved per visitor), community picks from the gallery, Kick live alert
- `admin.js`: approve / reject / remove gallery items
- `worker/sinners-worker.js`: the Cloudflare Worker

## Watch page

- Visitors add streamers by name or link; they're saved in their own browser. To show streamers to everyone, add them to `DEFAULT_STREAMERS` at the top of `watch.js`.
- YouTube can't look up names, so use a live video link (`youtube.com/watch?v=…`) or a channel link with `/channel/UC…`.
- Volume works for all platforms; the quality menu works for Twitch and Kick. YouTube quality is set from the ⚙ in its player.
- Kick streams play in HD through the Worker (see below). If it's unavailable, Kick's own player is used.

## Chat and login

- **Sinners chat:** a chat room for each stream on our site. Anyone can read; logging in with Discord lets you write. Messages are stored in Cloudflare D1, and the page checks for new ones every 3 seconds (paused in background tabs).
- **Platform chat:** a second tab shows the streamer's real chat. Twitch and YouTube chat are embedded (viewers log in with their Twitch/YouTube account there). Kick chat can't be embedded, so it opens in a small Kick window.
- **Moderation:** `admin.html` lists recent messages with Delete and Ban user. Banning removes that user's messages from the last day and blocks them from chatting and logging in.
- Limits: 300 characters per message, one message per 1.5 seconds per user.

## Gallery

- Anyone can share an image link or a Kick / Twitch / YouTube clip link.
- Shared links go into a review queue and only appear after they're approved on `admin.html`.
- Each visitor can share up to 5 links per hour; image links must point to an actual image; mature Kick clips are refused.

## Cloudflare Worker

`worker/sinners-worker.js` does four jobs:

1. **Kick HD:** asks Kick's (unofficial) API for the stream and returns its master playlist with CORS headers. Video chunks load straight from Kick's servers. Kick may change or block this at any time.
2. **Gallery:** stores shared links in Workers KV and handles the review queue.
3. **Discord login:** sends visitors to Discord and back with a signed session token.
4. **Sinners chat:** stores messages in D1, with admin delete and ban.

Setup in the Cloudflare dashboard (Workers & Pages → the Worker → Settings):

1. **Edit code** → paste `worker/sinners-worker.js` → **Deploy**.
2. **Bindings** → **Add binding** → **KV namespace** → variable name `GALLERY` → namespace `sinners-gallery`.
3. **Bindings** → **Add binding** → **D1 database** → variable name `DB` → database `sinners-chat` (create it under Storage & databases → D1). Tables are created automatically.
4. **Runtime variables and secrets** → **Add variable**:
   - `ADMIN_PASSWORD` (secret): your admin password
   - `DISCORD_CLIENT_ID` (text) and `DISCORD_CLIENT_SECRET` (secret): from your Discord application
   - `SESSION_SECRET` (secret): a long random string used to sign logins

Discord application (https://discord.com/developers/applications → your app → OAuth2): add the redirect
`https://<your worker>.workers.dev/auth/discord/callback`.

If you use a custom domain, add it to `ALLOWED_ORIGINS` in the Worker.

## Run it locally

Run `python -m http.server 8080` in this folder and visit http://localhost:8080. (Twitch players need a real web address, so opening the files directly won't work.)
