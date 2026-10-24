# Sinners

Watch Kick, Twitch and YouTube streams side by side, plus a community gallery of shared images and clips.
Plain HTML, CSS and JavaScript, hosted on GitHub Pages, with a small Cloudflare Worker for the parts that need a server.

Live at https://sinnerstv.com/

## Pages

GitHub Pages serves each page without `.html` (e.g. `/watch`), and the site links that way.


- `index.html` (`/`): home page with platform logo tiles and a "How to use Sinners" guide
- `watch.html` (`/watch`): watch streams one at a time with chat, or up to 4 at once
- `content.html` (`/content`): watch YouTube videos and playlists while waiting for a stream
- `games.html` (`/games`): mini games (Quick Draw, Target Rush, Chat Typer) with leaderboards, plus betting games (Color Clash, Lucky Number) played with points
- `gallery.html` (`/gallery`): community gallery with Images and Clips sections; visitors share links
- `about.html` (`/about`): short, plain about page (to be filled in later)
- `admin.html` (`/admin`): review shared gallery links (password protected, not in the menu)

## Scripts

- `config.js`: the Worker address (`WORKER_URL`)
- `theme.js`: light / dark theme toggle, loaded in <head> on all pages
- `script.js`: menu and scroll animations (all pages)
- `auth.js`: Discord login and the menu's Log in / profile button (all pages)
- `alerts.js`: live alerts (🔔 on the Watch page) for Kick and YouTube streamers; checks every minute and shows a banner on any page
- `chat.js`: Sinners chat (our own chat room per stream)
- `mini.js`: floating, draggable mini player (Watch single view and Content page)
- `nav.js`: in-site navigation that swaps page content without reloading, so the mini player keeps playing across sections; it loads each page's own script (watch.js, content.js, gallery.js, admin.js) as a module
- `watch.js`: the Watch page (players, multi-view, volume/quality, chat column, adding and fixing streamers)
- `games.js`: the three mini games, saving scores, and the leaderboard
- `gallery.js`: loads approved items, the viewer, and the share forms
- `content.js`: YouTube queue (saved per visitor)
- `admin.js`: approve / reject / remove gallery items
- `worker/sinners-worker.js`: the Cloudflare Worker

## Watch page

- Visitors add streamers by name or link; they're saved in their own browser. To show streamers to everyone, add them to `DEFAULT_STREAMERS` at the top of `watch.js`.
- YouTube channels can be added by name, @handle or channel link (looked up by the Worker). When the channel isn't live, the player says so and checks again every minute. YouTube video links work too.
- Volume works for all platforms; the quality menu works for Twitch and Kick. YouTube doesn't allow websites to change its quality, so it's set from the ⚙ in the YouTube player.
- Kick streams play in HD through the Worker (see below). If it's unavailable, Kick's own player is used.

## Chat and login

- **Sinners chat:** a chat room for each stream on our site. Anyone can read; logging in with Discord lets you write. Messages are stored in Cloudflare D1, and the page checks for new ones every 3 seconds (paused in background tabs).
- **Platform chat:** a second tab shows the streamer's real chat. Twitch and YouTube chat are embedded (viewers log in with their Twitch/YouTube account there). Kick chat can't be embedded, so it opens in a small Kick window.
- **Moderation:** `admin.html` lists recent messages with Delete and Ban user. Banning removes that user's messages from the last day and blocks them from chatting and logging in.
- Limits: 300 characters per message, one message per 1.5 seconds per user.

## Games

- Three quick original games: Quick Draw (reaction time, 5 rounds), Target Rush (targets hit in 30 s) and Chat Typer (words typed in 30 s).
- Anyone can play; logging in with Discord saves your best score to the leaderboard (top 10 shown).
- **Points 🪙:** every account starts with 100; finished games earn more (better scores earn more, up to 300 a day).
- **Color Clash / Lucky Number:** everyone bets on the same one-minute round. The Worker decides the result (unpredictable from a browser) and winners split the pot in proportion to their bets; if nobody picked the result, the pot rolls over into a jackpot. Points have no real value and can't be bought or cashed out.
- Admin can reset all points (which also clears bets and round history).
- Scores come from the browser, so they can't be fully cheat-proof: impossible scores are refused, submissions are rate limited, banned users can't post, and `admin.html` can remove entries or reset a game.

## Gallery

- Anyone can share an image link or a Kick / Twitch / YouTube clip link.
- Shared links go into a review queue and only appear after they're approved on `admin.html`.
- Each visitor can share up to 5 links per hour; image links must point to an actual image; mature Kick clips are refused.

## Cloudflare Worker

`worker/sinners-worker.js` does seven jobs:

1. **Kick HD:** asks Kick's (unofficial) API for the stream and returns its master playlist with CORS headers. Video chunks load straight from Kick's servers. Kick may change or block this at any time.
2. **Gallery:** stores shared links in Workers KV and handles the review queue.
3. **Discord login:** sends visitors to Discord and back with a signed session token.
4. **Sinners chat:** stores messages in D1, with admin delete and ban.
7. **Points and betting rounds:** wallets (100 to start, up to 300 earned per day from games), one-minute Color Clash / Lucky Number rounds whose results come from an HMAC of the round number, paid out exactly once.
6. **Game leaderboards:** saves logged-in players' best scores in D1, refuses impossible scores, and lets the admin remove entries or reset a game.
5. **YouTube channels:** finds a channel by name or @handle and checks whether it's live, by reading YouTube's public channel pages.

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

Serve this folder with any static server and visit http://localhost:8080. To use the short addresses (`/watch`) locally, the server must serve `watch.html` for `/watch` like GitHub Pages does. (Twitch players need a real web address, so opening the files directly won't work.)

## Credits

Platform icons in `icons/` (and inlined on the home page) are from [Simple Icons](https://simpleicons.org/) (CC0). Kick, Twitch and YouTube names and logos belong to their owners.
