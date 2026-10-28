# Sinners

Watch Kick, Twitch and YouTube streams side by side, plus a community gallery of shared images and clips.
Plain HTML, CSS and JavaScript, hosted on GitHub Pages, with a small Cloudflare Worker for the parts that need a server.

Live at https://sinnerstv.com/

## Pages

GitHub Pages serves each page without `.html` (e.g. `/watch`), and the site links that way.


- `index.html` (`/`): home page: a stage of featured streamers plus up to 10 of the viewer's own (saved in the browser), shown as their channel picture floating with an effect of their own (frost, speed streaks, lightning, glitch) and a LIVE sign (Worker `/live`); click one to watch on the Watch page. This week's world boss sits top right
- `watch.html` (`/watch`): watch streams one at a time with chat, or up to 4 at once
- `content.html` (`/content`): browse and search YouTube (categories, live now) and watch videos and playlists in a queue while waiting for a stream
- `games.html` (`/games`): mini games (Quick Draw, Target Rush, Chat Typer) with leaderboards, plus betting games (Color Clash, Lucky Number) played with points, and a shop where points buy items the admin adds
- `gallery.html` (`/gallery`): community gallery with Images and Clips sections; visitors share links
- `about.html` (`/about`): short, plain about page (to be filled in later)
- `profile.html` (`/profile`): your stats plus your adventurer: a pixel character with Attack / Defense / HP, 8 gear slots, a 30-slot bag, a world map (Forest, Caves, Swamp, Mountains, Abyss) for timed adventures against a boss, and the Arena for duels. Also `/dungeon` and `/duel` in Discord
- `shop.html` (`/shop`): Adventure gear for each tier (unlocks at adventurer level 1/5/10/20/30, never sells out, sells back for half), Extras (potions and scrolls: +25% Attack / Defense / HP, +50% XP, +15% loot, 3 uses each) and Redeem (rewards the admin adds)
- `stats.html` (`/stats`): live visitors online, daily visitors and page views, and community numbers
- `admin.html` (`/admin`): review shared gallery links, moderate chat, reset games and points, and manage the shop (password protected, not in the menu)

## Scripts

- `config.js`: the Worker address (`WORKER_URL`)
- `theme.js`: light / dark theme toggle, loaded in <head> on all pages
- `icons.js`: pixel-art drawings that replace the game's emojis everywhere (bosses, monsters, places, potions, coins, medals, quests, cosmetics, reactions); the data still uses emojis and this swaps them as pages are built, skipping chat and inputs
- `design.css`: the site's look, loaded after `styles.css` on every page (colors, type, header, footer, buttons, tabs, Home layout)
- `script.js`: menu and scroll animations (all pages)
- `auth.js`: Discord login and the menu's Log in / profile button (all pages)
- `alerts.js`: live alerts (🔔 on the Watch page) for Kick and YouTube streamers; checks every minute and shows a banner on any page
- `chat.js`: Sinners chat (our own chat room per stream)
- `twitch-chat.js`: Twitch chat drawn by Sinners, connected logins, and the shared send box with the emote picker
- `kick-chat.js`: Kick chat drawn by Sinners (messages through the Worker), sending as your Kick account
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
- **Color Clash / Lucky Number:** everyone bets on the same one-minute round. The Worker decides the result (unpredictable from a browser) and winners split the pot in proportion to their bets; if nobody picked the result, the pot rolls over into a jackpot. Every winning bet also gets a small site bonus (Color Clash +10% of the bet, Lucky Number +20%), which counts toward the 300-a-day earning limit. Every winning bet also gets a site bonus (Color Clash +50% of the bet, Lucky Number 3×), which counts toward the 300-a-day earning limit. Points have no real value and can't be bought or cashed out.
- Admin can reset all points (which also clears bets and round history).
- **Shop:** the admin adds items on `admin.html` (picture, name, description, price, optional stock). Players buy them with points; each purchase shows up on `admin.html` with the buyer's Discord name and ID, to hand out and mark as delivered.
- Scores come from the browser, so they can't be fully cheat-proof: impossible scores are refused, submissions are rate limited, banned users can't post, and `admin.html` can remove entries or reset a game.

## Gallery

- Anyone can share an image link or a Kick / Twitch / YouTube clip link.
- Shared links go into a review queue and only appear after they're approved on `admin.html`.
- Each visitor can share up to 5 links per hour; image links must point to an actual image; mature Kick clips are refused.

## Cloudflare Worker

`worker/sinners-worker.js` does eleven jobs:

1. **Kick HD:** asks Kick's (unofficial) API for the stream and returns its master playlist with CORS headers. Video chunks load straight from Kick's servers. Kick may change or block this at any time.
2. **Gallery:** stores shared links in Workers KV and handles the review queue.
3. **Logins:** Discord, Twitch or Kick (`/auth/<provider>`), all on one account: any connected login opens the same account (`identities` table), more can be connected from the profile (an account that login already had is merged in), and the last one can't be removed. Sessions are signed tokens.
4. **Sinners chat:** stores messages in D1, with admin delete and ban.
5. **YouTube:** finds a channel by name or @handle, checks whether it's live, and searches videos for the Content page, by reading YouTube's public pages.
6. **Game leaderboards:** saves logged-in players' best scores in D1, refuses impossible scores, and lets the admin remove entries or reset a game.
7. **Points and betting rounds:** wallets (100 to start, up to 300 earned per day from games), one-minute Color Clash / Lucky Number rounds whose results come from an HMAC of the round number, paid out exactly once.
8. **Shop:** items in D1 with pictures in KV; buying takes the points and one from the stock in a way that can't oversell.
9. **Discord bot:** every command is answered within Discord's 3 seconds ("thinking…" first, then the real reply); the database setup only runs once per schema version (`SCHEMA_VERSION`), so cold starts stay fast. Commands: slash commands (`/help` guide with topic buttons, `/dungeon`, `/duel`, `/points`, `/top`, `/shop`, `/round`, `/sinners` for everyone; `/stats`, `/stats-live`, `/notify-here` for members with the Administrator permission) arrive as signed requests at `/discord/interactions`, so the bot needs no server of its own. Site logins are Discord accounts, so points and scores match up automatically. With `/notify-here`, shop purchases and new gallery links are posted to a channel. `/stats-live` keeps a site report in a channel that updates by itself (every 5 min to once a day); this needs a Cron Trigger on the Worker every 5 minutes (`*/5 * * * *`). Setup: add `DISCORD_PUBLIC_KEY` (Text) and `DISCORD_BOT_TOKEN` (Secret), set the Interactions Endpoint URL in the Discord Developer Portal, then use the Discord bot card on `admin.html`.
10. **Site stats:** every open tab sends an anonymous heartbeat once a minute (`presence.js`, a random ID kept in the browser, no IPs). The Worker keeps who's online now and daily visitor and page-view totals in D1, shown on `stats.html`, in the header's "online" badge and in the bot's `/stats`.
11. **Adventure:** adventurers, items and timed dungeon runs in D1 (results decided by the Worker, each run collected once). Win chances come from a power score (attack + 0.8 x defense + 0.25 x HP) on a logistic curve, and the fight log is played out to match. Arena ratings use Elo, 10 duels a day. Watching streams on the Watch page earns a little adventurer XP each minute (1 + 1 per 5 levels, up to 2 hours a day). Achievements (23, coins once each; one can be shown as a badge in chat and the arena), cosmetics (hats, capes, pets, chat name colors in the Shop's Cosmetics tab, worn from the profile's Wardrobe), monthly arena seasons (top 3 win coins and a title, ratings soften toward 1000), watch parties (who's watching the same stream + floating emoji reactions on the Watch page) and Clip of the Week (one gallery vote a week; the winner's sharer gets coins, the winner shows on Home). Twitch chat: the Watch page draws Twitch chat itself (`twitch-chat.js`, read from Twitch's public chat connection), and players who link Twitch on their profile can type in it; the Worker sends their messages with Twitch's Helix API (tokens stored encrypted). Needs a Twitch app (redirect `<Worker>/auth/twitch/callback`) and `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`. Kick chat is drawn by Sinners too (`kick-chat.js`, like MultiKick): Kick's live chat server only accepts kick.com, so the Worker passes on Kick's latest messages (`/kick/messages/<channelId>`, checked every 2.5 s, cached 2 s so viewers share it) and channel details with subscriber badges and emotes (`/kick/chat/<channel>`). Players type as their Kick account through Kick's API (`POST /public/v1/chat`; the Kick login asks for `user:read chat:write`, older Kick logins approve once more), with a 😀 emote picker (channel, Kick global, emoji and the channel's 7TV emotes; Kick emotes are sent as `[emote:id:name]`); YouTube chat stays as it is. World boss: a new boss every Monday (UTC) for everyone, HP from the number of adventurers; adventures, duels and Strike (every 4 hours) damage it; when it falls everyone who fought claims a chest and the top 3 get extra coins and gear (`/boss` in Discord, banner on Home, panel on Profile). Daily: 3 quests a day per player (from a pool: watch, games, adventures, duels, bets, chat) paying coins and XP, a bonus chest for all 3, and a login streak (20 to 80 coins, +100 and a potion every 7th day, an epic item on day 30); `streak.js` shows the claim card and `/daily` does it from Discord. Shop gear costs 30 / 150 / 500 / 1,500 / 4,000 per item by tier; potions and scrolls cost more as the adventurer levels up.

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
