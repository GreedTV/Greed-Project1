// Cloudflare Worker for the Sinners site.
//
// Kick HD
//   GET  /kick/<channel>.m3u8   -> the stream's master playlist (all qualities), or 404 if offline.
//
// Kick chat drawn by Sinners (Kick's own chat server only accepts kick.com, so the page reads it here)
//   GET  /kick/chat/<channel>          -> { channelId, broadcasterId, name, subBadges, emotes }  (cached 10 min)
//   GET  /kick/messages/<channelId>    -> { messages: [...] } the latest ~25, oldest first        (cached 2 s)
//
// Community gallery (people share image and clip links; they show after approval)
//   GET  /gallery               -> { images: [...], clips: [...] } approved items, newest first
//   POST /gallery/submit        -> { kind: "image" | "clip", link, title?, name? }  queued for approval
//   GET  /gallery/pending       -> pending items             (admin: "Authorization: Bearer <ADMIN_PASSWORD>")
//   POST /gallery/moderate      -> { id, action: "approve" | "reject" | "delete" }   (admin)
//
// YouTube channels
//   GET  /youtube/channel?q=<@handle | name | channel link | UC id>  -> { id, name }
//   GET  /youtube/live?channel=<UC id>                               -> { live, videoId, title, name }
//   GET  /youtube/search?q=<words>&live=1?                           -> { videos: [...] } (Content page browsing)
//
// Shop (Games page; items are bought with points)
//   GET  /shop                         -> { items: [...] }
//   GET  /shop/image/<id>              -> the item's picture
//   GET  /shop/mine                    -> your purchases   (logged in)
//   POST /shop/buy                     -> { id }   (logged in)
//   GET  /shop-admin                   -> items and recent purchases   (admin)
//   POST /shop-admin                   -> { action: "add", name, description, price, stock?, image: <data URL> }
//                                         | { action: "update", id, ...same fields, image optional } | { action: "delete", id }
//                                         | { action: "deliver", purchaseId, delivered }   (admin)
//
// Mini game leaderboards (Games page)
//   GET  /games/leaderboard?game=<id>   -> { game, scores: [top 10] }
//   POST /games/score                  -> { game, score }  (logged in; only your best counts)
//   GET  /games-admin                  -> every game's top 50   (admin)
//   POST /games-admin                  -> { action: "reset", game } | { action: "delete", game, userId }
//                                         | { action: "reset-points" }   (admin)
//
// Points and betting games (points are earned by playing the games above; just for fun, no real value)
//   GET  /points                       -> your wallet { points, earnedToday, dailyCap }   (logged in)
//   GET  /points/top                   -> the 10 players with the most points
//   GET  /bets/state?game=colors|lucky -> the current round, its bets, recent results (and your bet if logged in)
//   POST /bets/place                   -> { game, choice, amount }   (logged in)
//
// Adventure (Profile page): an adventurer with gear, a bag and dungeon runs
//   GET  /hero                         -> your adventurer, items, regions and the current run   (logged in)
//   POST /hero                         -> { action: "dungeon", dungeon } | { action: "collect" } | { action: "equip" | "sell", item }
//                                         | { action: "unequip", slot } | { action: "look" } | { action: "duel", opponent? }
//                                         | { action: "watch" }  once a minute while watching streams: a little XP   (logged in)
//   GET  /profile                      -> your profile numbers   (logged in)
//   GET  /arena                        -> top adventurers by arena rating
//   GET  /boss                         -> this week's world boss, top damage dealers (and yours if logged in)
//   POST /boss                         -> { action: "strike" } (every 4 hours) | { action: "claim", week? }   (logged in)
//   GET  /profile/extras               -> achievements, badge, cosmetics owned / worn   (logged in)
//   POST /profile/extras               -> { action: "badge", badge } | { action: "buy" | "wear", id }   (logged in)
//   GET  /party/<room>?since=&beat=1   -> who's watching this stream, new emoji reactions
//   POST /party/<room>                 -> { emoji }   (logged in)
//   GET  /gallery/votes                -> this week's Clip of the Week votes, your vote, last week's winner
//   POST /gallery/vote                 -> { id }   (logged in)
//   GET  /daily                        -> today's 3 quests with progress, the bonus chest and the login streak   (logged in)
//   POST /daily                        -> { action: "checkin" } | { action: "claim", index } | { action: "bonus" }   (logged in)
//   GET  /shop/adventure               -> gear for each tier, potions and scrolls (and your level and boosts if logged in)
//   POST /shop/adventure               -> { item }  buy gear (into the bag) or a potion / scroll   (logged in)
//
// Site stats (anonymous: a random ID kept in the visitor's browser, no IPs or accounts)
//   POST /presence                     -> { visitor, page, view? }  heartbeat every minute; returns { online }
//   GET  /stats                        -> online now, visitors and views (today, 7 days), community numbers
//
// Discord bot (slash commands arrive here from Discord; set this as the app's Interactions Endpoint URL)
//   POST /discord/interactions         -> /dungeon, /duel, /stats, /stats-live, /stats-live-off, /points, /top, /shop, /round, /sinners,
//                                         /notify-here, /notify-off
//   (scheduled)                        -> keeps the /stats-live board up to date (needs a Cron Trigger, see Setup)
//   GET  /discord-admin                -> bot setup status and invite link   (admin)
//   POST /discord-admin                -> { action: "register" }  (re)creates the slash commands   (admin)
//
// Linked accounts (chat as yourself on Twitch from the Watch page)
//   GET  /link                         -> your linked accounts   (logged in)
//   POST /link/start                   -> { platform, back }  a link to open to connect that account   (logged in)
//   POST /link/remove                  -> { platform }   (logged in)
//   GET  /auth/<discord|twitch|kick>[/callback]   log in, or connect another login (opened by the browser)
//   POST /chat/send                    -> { platform: "twitch" | "kick", channel, text }  sent as you   (logged in)
//
// Login (Discord, Twitch or Kick; one account can have all three connected)
//   GET  /auth/<provider>?return=<page url>  -> sends the visitor to that site, then back to the page with #session=<token>
//   GET  /me                              -> the logged-in user ("Authorization: Bearer <session token>")
//
// Sinners chat (one room per stream, e.g. "kick:lexor2k")
//   GET  /chat/<room>?after=<id>  -> { messages, deleted }  newest 50, or only messages after <id>
//   POST /chat/<room>             -> { text }  (logged in)
//   GET  /chat-admin              -> recent messages and banned users   (admin)
//   POST /chat-admin              -> { action: "delete", id } | { action: "ban" | "unban", userId }   (admin)
//
// Setup (Cloudflare dashboard -> Workers & Pages -> this Worker):
//   1. Edit code -> paste this file -> Deploy.
//   2. Settings -> Bindings -> Add -> KV namespace -> variable name GALLERY -> select a namespace.
//   3. Settings -> Bindings -> Add -> D1 database -> variable name DB -> select a database.
//   4. Settings -> Variables and Secrets -> add as Secret: ADMIN_PASSWORD, DISCORD_CLIENT_SECRET, SESSION_SECRET
//      and as Text: DISCORD_CLIENT_ID.
//   Twitch login + chat (optional): TWITCH_CLIENT_ID (Text) and TWITCH_CLIENT_SECRET (Secret) from a Twitch app whose
//      OAuth Redirect URL is <this Worker>/auth/twitch/callback.
//   Kick login (optional): KICK_CLIENT_ID (Text) and KICK_CLIENT_SECRET (Secret) from a Kick app (kick.com/settings/developer)
//      with the redirect URL <this Worker>/auth/kick/callback.
//   5. Discord bot (optional): add DISCORD_BOT_TOKEN as Secret and DISCORD_PUBLIC_KEY as Text, then in the
//      Discord Developer Portal set Interactions Endpoint URL to <this Worker>/discord/interactions.
//   6. Live stats board (optional): Settings -> Trigger events -> Add -> Cron Triggers -> every 5 minutes (*/5 * * * *).

// Websites allowed to use this Worker. Add your own domain here if you get one.
const ALLOWED_ORIGINS = [
  "https://sinnerstv.com",
  "https://www.sinnerstv.com",
  "https://greedtv.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const SUBMITS_PER_HOUR = 5; // per visitor
const MAX_PENDING = 100;
const MAX_APPROVED = 500;

const SESSION_DAYS = 30;
const CHAT_MAX_LENGTH = 300;
const CHAT_MIN_GAP_MS = 1500; // per user, between messages
const ROOM_PATTERN = /^(kick|twitch|youtube):[a-z0-9_-]{2,40}$/;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json",
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // Requests from other websites are refused, so this can't be used by anyone else
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return text("Origin not allowed", 403, cors);

    const url = new URL(request.url);
    const path = url.pathname;
    try {
      const kick = path.match(/^\/kick\/([a-zA-Z0-9_-]{2,30})\.m3u8$/);
      if (kick && request.method === "GET") return await kickPlaylist(kick[1].toLowerCase(), cors);
      const kickChat = path.match(/^\/kick\/chat\/([a-zA-Z0-9_-]{2,30})$/);
      if (kickChat && request.method === "GET") return await kickChatInfo(kickChat[1].toLowerCase(), cors);
      const kickMsgs = path.match(/^\/kick\/messages\/(\d{1,12})$/);
      if (kickMsgs && request.method === "GET") return await kickMessages(kickMsgs[1], cors, url.searchParams.has("fresh"));

      // Discord calls this directly (no browser, no Origin)
      if (path === "/discord/interactions" && request.method === "POST") return await discordInteraction(request, env, ctx);
      if (path === "/discord-admin") {
        if (request.method === "GET") return await discordAdminStatus(request, env, cors);
        if (request.method === "POST") return await discordAdminAction(request, env, cors);
      }

      const party = path.replace(/%3A/gi, ":").match(/^\/party\/([a-z]+:[a-z0-9_-]+)$/);
      if (party || path === "/gallery/votes" || path === "/gallery/vote") {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (party && request.method === "GET") return await partyGet(party[1], request, url, env, cors);
        if (party && request.method === "POST") return await partyReact(party[1], request, env, cors);
        if (path === "/gallery/votes" && request.method === "GET") return await clipVotesGet(request, env, cors);
        if (path === "/gallery/vote" && request.method === "POST") return await clipVote(request, env, cors);
      }

      if (path === "/hero" || path === "/profile" || path === "/profile/extras" || path === "/arena" || path === "/daily" || path === "/boss") {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/hero" && request.method === "GET") return await heroGet(request, env, cors);
        if (path === "/hero" && request.method === "POST") return await heroAction(request, env, cors);
        if (path === "/profile" && request.method === "GET") return await profileGet(request, env, cors);
        if (path === "/profile/extras" && request.method === "GET") return await profileExtrasGet(request, env, cors);
        if (path === "/profile/extras" && request.method === "POST") return await profileExtrasAction(request, env, cors);
        if (path === "/arena" && request.method === "GET") return await arenaGet(request, env, cors);
        if (path === "/daily" && request.method === "GET") return await dailyGet(request, env, cors);
        if (path === "/boss" && request.method === "GET") return await bossGet(request, env, cors);
        if (path === "/boss" && request.method === "POST") return await bossAction(request, env, cors, ctx);
        if (path === "/daily" && request.method === "POST") return await dailyAction(request, env, cors);
      }

      if (path === "/presence" || path === "/stats") {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/presence" && request.method === "POST") return await presence(request, env, cors);
        if (path === "/stats" && request.method === "GET") return json(await siteStats(env), 200, { ...cors, "Cache-Control": "public, max-age=30" });
      }

      if (path === "/youtube/channel" && request.method === "GET") return await youtubeChannel(url, cors);
      if (path === "/youtube/live" && request.method === "GET") return await youtubeLive(url, cors);
      if (path === "/live" && request.method === "GET") return await liveStatus(url, env, cors);
      if (path === "/youtube/search" && request.method === "GET") return await youtubeSearch(url, cors);

      const shopImage = path.match(/^\/shop\/image\/(\d+)$/);
      if (shopImage && request.method === "GET") {
        if (!env.GALLERY) return text("Not found", 404, cors);
        return await shopImageGet(shopImage[1], env, cors);
      }
      if (path.startsWith("/shop") || path === "/cosmetics") {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/shop" && request.method === "GET") return await shopList(request, env, cors);
        if (path === "/shop/adventure" && request.method === "GET") return await adventureShopGet(request, env, cors);
        if (path === "/cosmetics" && request.method === "GET") return json({ catalog: COSMETICS }, 200, cors);
        if (path === "/shop/adventure" && request.method === "POST") return await adventureShopBuy(request, env, cors);
        if (path === "/shop/mine" && request.method === "GET") return await shopMine(request, env, cors);
        if (path === "/shop/buy" && request.method === "POST") return await shopBuy(request, env, cors, ctx);
        if (path === "/shop-admin" && request.method === "GET") return await shopAdminList(request, env, cors);
        if (path === "/shop-admin" && request.method === "POST") return await shopAdminAction(request, env, cors);
      }

      // Login pages are opened by the browser directly, so they answer with redirects
      if (path === "/auth/providers") return json({ available: providerReady(env) }, 200, { ...cors, "Cache-Control": "public, max-age=300" });
      const login = path.match(/^\/auth\/(discord|twitch|kick)(\/callback)?$/);
      if (login) return login[2] ? await authCallback(login[1], url, env) : await authStart(login[1], url, env);
      if (path === "/link" || path === "/link/start" || path === "/link/remove" || path === "/chat/send") {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/link" && request.method === "GET") return await linksGet(request, env, cors);
        if (path === "/link/start" && request.method === "POST") return await linkStart(request, env, cors);
        if (path === "/link/remove" && request.method === "POST") return await linkRemove(request, env, cors);
        if (path === "/chat/send" && request.method === "POST") return await chatSend(request, env, cors);
      }
      if (path === "/me" && request.method === "GET") return json({ user: await requireUser(request, env) }, 200, cors);

      if (path.startsWith("/points") || path.startsWith("/bets")) {
        if (!env.DB) return json({ error: "Storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/points" && request.method === "GET") return await pointsMine(request, env, cors);
        if (path === "/points/top" && request.method === "GET") return await pointsTop(env, cors);
        if (path === "/bets/state" && request.method === "GET") return await betState(request, url, env, cors);
        if (path === "/bets/place" && request.method === "POST") return await betPlace(request, env, cors);
      }

      if (path.startsWith("/games")) {
        if (!env.DB) return json({ error: "Leaderboard storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (path === "/games/leaderboard" && request.method === "GET") return await gameLeaderboard(url, env, cors);
        if (path === "/games/score" && request.method === "POST") return await gameScore(request, env, cors);
        if (path === "/games-admin" && request.method === "GET") return await gamesAdminList(request, env, cors);
        if (path === "/games-admin" && request.method === "POST") return await gamesAdminAction(request, env, cors);
      }

      const room = path.replace(/%3A/gi, ":").match(/^\/chat\/([a-z]+:[a-z0-9_-]+)$/);
      if (room || path === "/chat-admin") {
        if (!env.DB) return json({ error: "Chat storage isn't set up yet (DB binding missing)." }, 503, cors);
        await ensureSchema(env);
        if (room && request.method === "GET") return await chatList(room[1], url, env, cors);
        if (room && request.method === "POST") return await chatPost(room[1], request, env, cors);
        if (path === "/chat-admin" && request.method === "GET") return await chatAdminList(request, env, cors);
        if (path === "/chat-admin" && request.method === "POST") return await chatAdminAction(request, env, cors);
      }

      if (path.startsWith("/gallery")) {
        if (!env.GALLERY) return json({ error: "Gallery storage isn't set up yet (GALLERY binding missing)." }, 503, cors);
        if (path === "/gallery" && request.method === "GET") return await listGallery(env, cors);
        if (path === "/gallery/submit" && request.method === "POST") return await submit(request, env, cors, ctx);
        if (path === "/gallery/pending" && request.method === "GET") return await pending(request, env, cors);
        if (path === "/gallery/moderate" && request.method === "POST") return await moderate(request, env, cors);
      }
      return text("Not found", 404, cors);
    } catch (err) {
      return json({ error: err.message || "Something went wrong" }, err.status || 500, cors);
    }
  },

  // Cron Trigger (every 5 minutes): refresh the live stats board in Discord when it's due
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(updateStatsBoard(env).catch(() => {}));
  },
};

// ---------- YouTube channels ----------
// YouTube has no public way to look up a channel or its live stream without an API key, so this reads
// the public channel pages. The SOCS cookie answers YouTube's cookie-consent page ("reject all"),
// which would otherwise be shown instead of the channel in some countries.

const YT_HEADERS = {
  "User-Agent": BROWSER_HEADERS["User-Agent"],
  "Accept-Language": "en",
  Cookie: "SOCS=CAI",
};
const UC_ID = /^UC[\w-]{22}$/;

async function youtubePage(path) {
  const res = await fetch(`https://www.youtube.com${path}`, { headers: YT_HEADERS, redirect: "follow" });
  return res.ok ? await res.text() : null;
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function channelFromPage(html) {
  if (!html) return null;
  const id = (html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/channel_id=(UC[\w-]{22})/) || [])[1];
  const name = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
  return id ? { id, name: clean(decodeHtml(name || ""), 80) } : null;
}

async function youtubeChannel(url, cors) {
  let q = String(url.searchParams.get("q") || "").trim();
  if (!q) fail("Type a YouTube channel name or @handle.");

  // Links: youtube.com/@name, /channel/UC..., /c/name, /user/name
  const link = q.match(/youtube\.com\/(@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)/i);
  if (link) q = link[1].startsWith("channel/") ? link[1].slice(8) : link[1];

  let channel = null;
  if (UC_ID.test(q)) channel = channelFromPage(await youtubePage(`/channel/${q}`));
  else if (/^(c|user)\//.test(q)) channel = channelFromPage(await youtubePage(`/${q}`));
  else {
    const handle = q.replace(/^@/, "").replace(/\s+/g, "");
    if (/^[\w.-]{3,30}$/.test(handle)) channel = channelFromPage(await youtubePage(`/@${encodeURIComponent(handle)}`));
    // Not a handle: search YouTube for a channel with that name
    if (!channel) {
      const results = await youtubePage(`/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`);
      const id = results && (results.match(/"channelRenderer":\{"channelId":"(UC[\w-]{22})"/) || [])[1];
      if (id) channel = channelFromPage(await youtubePage(`/channel/${id}`));
    }
  }
  if (!channel) fail("Couldn't find that YouTube channel. Try their @handle or channel link.", 404);
  return json(channel, 200, { ...cors, "Cache-Control": "public, max-age=86400" });
}

async function youtubeLive(url, cors) {
  const id = url.searchParams.get("channel") || "";
  if (!UC_ID.test(id)) fail("Unknown YouTube channel", 400);
  const info = await youtubeLiveInfo(id);
  if (!info) fail("Couldn't reach YouTube", 502);
  return json(info, 200, { ...cors, "Cache-Control": "public, max-age=60" });
}

// The channel's Live tab lists its streams; one that's on air carries a LIVE badge.
// (The /live page itself is a video page, which YouTube may not show to servers.)
async function youtubeLiveInfo(id) {
  const html = await youtubePage(`/channel/${id}/streams`);
  if (!html) return null;

  let videoId = null;
  let title = "";
  const badge = html.indexOf('"badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE"');
  if (badge !== -1) {
    const start = html.lastIndexOf('"lockupViewModel":{', badge);
    const next = html.indexOf('"lockupViewModel":{', badge);
    const block = html.slice(start, next === -1 ? badge + 20000 : next);
    videoId = (block.match(/"contentId":"([\w-]{11})"/) || [])[1] || null;
    title = (block.match(/"lockupMetadataViewModel":\{"title":\{"content":"([^"]*)"/) || [])[1] || "";
  } else {
    // Older page layout
    const old = html.indexOf('"style":"LIVE"');
    if (old !== -1) {
      const before = html.slice(Math.max(0, old - 8000), old);
      const ids = [...before.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"/g)];
      if (ids.length) videoId = ids[ids.length - 1][1];
    }
  }
  const live = !!videoId;
  const name = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
  return { live, videoId, title: live ? clean(decodeHtml(title), 120) : "", name: clean(decodeHtml(name || ""), 80) };
}

// Search results for the Content page. The page's data sits in a "ytInitialData" JSON blob;
// every video in it is a "videoRenderer" object.
const SEARCH_LIVE = "EgJAAQ%253D%253D"; // YouTube's "Live" search filter

async function youtubeSearch(url, cors) {
  const q = clean(url.searchParams.get("q"), 100);
  if (!q) fail("Type something to search for.");
  const live = url.searchParams.get("live") === "1";
  const html = await youtubePage(`/results?search_query=${encodeURIComponent(q)}${live ? `&sp=${SEARCH_LIVE}` : ""}`);
  if (!html) fail("Couldn't reach YouTube", 502);
  const start = html.indexOf("var ytInitialData = ");
  let data = null;
  if (start !== -1) {
    const from = start + "var ytInitialData = ".length;
    try {
      data = JSON.parse(html.slice(from, html.indexOf(";</script>", from)));
    } catch (e) {}
  }
  if (!data) fail("Couldn't read YouTube's results", 502);

  const words = (t) => (t ? t.simpleText || (t.runs || []).map((r) => r.text).join("") : "");
  const videos = [];
  const seen = new Set();
  (function walk(node) {
    if (!node || typeof node !== "object" || videos.length >= 40) return;
    if (Array.isArray(node)) return node.forEach(walk);
    for (const key in node) {
      const v = node[key];
      if (key !== "videoRenderer") {
        walk(v);
        continue;
      }
      if (!v || !v.videoId || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      const owner = ((v.ownerText || v.longBylineText || {}).runs || [])[0] || {};
      const isLive =
        (v.badges || []).some((b) => /LIVE/.test((b.metadataBadgeRenderer || {}).style || "")) ||
        (v.thumbnailOverlays || []).some((o) => (o.thumbnailOverlayTimeStatusRenderer || {}).style === "LIVE");
      videos.push({
        id: v.videoId,
        title: clean(words(v.title), 150),
        channel: clean(owner.text, 80),
        channelId: ((owner.navigationEndpoint || {}).browseEndpoint || {}).browseId || "",
        length: clean(words(v.lengthText), 12),
        views: clean(words(v.shortViewCountText) || words(v.viewCountText), 40).replace(/^[\d.,]+[KMB]?$/, "$& views"),
        published: clean(words(v.publishedTimeText), 40),
        live: isLive,
      });
    }
  })(data);
  return json({ videos }, 200, { ...cors, "Cache-Control": "public, max-age=600" });
}

// ---------- Kick chat (read for the page) ----------
// Kick's live chat server refuses browsers from other sites, so the page asks here instead: channel
// details (ids, subscriber badges, emotes) and the latest messages from Kick's public chat history.
// Short in-memory caches let everyone watching the same channel share one request to Kick.

const kickCache = new Map(); // key -> { at, data }
async function cached(key, ms, load) {
  const hit = kickCache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.data;
  const data = await load();
  kickCache.set(key, { at: Date.now(), data });
  if (kickCache.size > 300) kickCache.delete(kickCache.keys().next().value);
  return data;
}

async function kickChannel(slug) {
  return cached(`ch:${slug}`, 600000, async () => {
    const res = await fetch(`https://kick.com/api/v2/channels/${slug}`, { headers: BROWSER_HEADERS });
    if (res.status === 404) fail("Couldn't find that Kick channel.", 404);
    if (!res.ok) fail(`Kick didn't answer (${res.status}).`, 502);
    return res.json();
  });
}

// ---------- Live status (the streamers on the Home page) ----------
// GET /live?ch=kick:name,twitch:name,youtube:@handle -> { "kick:name": { live, viewers, title, avatar }, ... }
// Live status is checked at most every 90 seconds per channel, whoever asks; channel pictures once a day.

const LIVE_CHECKS = {
  async kick(slug) {
    const res = await fetch(`https://kick.com/api/v2/channels/${slug.toLowerCase()}`, { headers: BROWSER_HEADERS });
    if (!res.ok) return { live: false };
    const ch = await res.json();
    const ls = ch.livestream;
    const avatar = (ch.user && ch.user.profile_pic) || "";
    return ls ? { live: true, viewers: ls.viewer_count || 0, title: clean(ls.session_title, 120), avatar } : { live: false, avatar };
  },
  async twitch(login, env) {
    const token = await twitchAppToken(env);
    if (!token) return { live: false };
    const headers = { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` };
    const name = encodeURIComponent(login.toLowerCase());
    const [streams, avatar] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?user_login=${name}`, { headers }).then((r) => (r.ok ? r.json() : {})),
      cached(`av:twitch:${name}`, 86400000, async () => {
        const res = await fetch(`https://api.twitch.tv/helix/users?login=${name}`, { headers });
        return res.ok ? (((await res.json()).data || [])[0] || {}).profile_image_url || "" : "";
      }),
    ]);
    const stream = (streams.data || [])[0];
    return stream ? { live: true, viewers: stream.viewer_count || 0, title: clean(stream.title, 120), avatar } : { live: false, avatar };
  },
  async youtube(handle) {
    const channel = await cached(`yt:${handle.toLowerCase()}`, 86400000, async () => {
      const html = await youtubePage(UC_ID.test(handle) ? `/channel/${handle}` : `/@${encodeURIComponent(handle.replace(/^@/, ""))}`);
      const found = channelFromPage(html);
      if (found) found.avatar = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || "";
      return found;
    });
    if (!channel) return { live: false };
    const info = await youtubeLiveInfo(channel.id);
    return info && info.live ? { live: true, title: info.title, avatar: channel.avatar } : { live: false, avatar: channel.avatar };
  },
};

let twitchApp = null; // { token, until }
async function twitchAppToken(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return null;
  if (twitchApp && twitchApp.until > Date.now()) return twitchApp.token;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  if (!res.ok) return null;
  const tok = await res.json();
  twitchApp = { token: tok.access_token, until: Date.now() + (tok.expires_in - 300) * 1000 };
  return twitchApp.token;
}

async function liveStatus(url, env, cors) {
  const channels = String(url.searchParams.get("ch") || "").split(",").slice(0, 24);
  const out = {};
  await Promise.all(
    channels.map(async (key) => {
      const m = key.match(/^(kick|twitch|youtube):(@?[\w.-]{2,40})$/i);
      if (!m) return;
      try {
        out[key] = await cached(`live:${key.toLowerCase()}`, 90000, () => LIVE_CHECKS[m[1].toLowerCase()](m[2], env));
      } catch (e) {
        out[key] = { live: false };
      }
    })
  );
  return json(out, 200, { ...cors, "Cache-Control": "public, max-age=60" });
}

async function kickChatInfo(slug, cors) {
  const ch = await kickChannel(slug);
  const emotes = await cached(`em:${slug}`, 600000, async () => {
    const res = await fetch(`https://kick.com/emotes/${slug}`, { headers: BROWSER_HEADERS });
    const groups = res.ok ? await res.json() : [];
    return (Array.isArray(groups) ? groups : []).map((g) => ({
      name: g.id === "Global" || g.id === "Emoji" ? g.name : (ch.user && ch.user.username) || slug,
      kind: g.id === "Global" ? "global" : g.id === "Emoji" ? "emoji" : "channel",
      emotes: (g.emotes || []).map((e) => ({ id: e.id, name: e.name, subs: !!e.subscribers_only })),
    }));
  });
  return json(
    {
      channelId: ch.id,
      broadcasterId: ch.user_id,
      name: (ch.user && ch.user.username) || slug,
      subBadges: (ch.subscriber_badges || []).map((b) => ({ months: b.months, src: b.badge_image && b.badge_image.src })).filter((b) => b.src),
      emotes,
    },
    200,
    { ...cors, "Cache-Control": "public, max-age=300" }
  );
}

async function kickMessages(channelId, cors, fresh = false) {
  // fresh: right after someone sends, so their message shows without waiting for the cache
  const messages = await cached(`msg:${channelId}`, fresh ? 300 : 2000, async () => {
    const res = await fetch(`https://kick.com/api/v2/channels/${channelId}/messages`, { headers: BROWSER_HEADERS });
    if (!res.ok) fail(`Kick chat didn't answer (${res.status}).`, 502);
    const data = ((await res.json()).data || {}).messages || [];
    return data
      .map((m) => {
        let meta = {};
        try {
          meta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata || {};
        } catch (e) {}
        const id = (m.sender && m.sender.identity) || {};
        return {
          id: m.id,
          at: m.created_at,
          type: m.type,
          content: m.content,
          user: m.sender && m.sender.username,
          color: id.color || "",
          badges: (id.badges || []).map((b) => ({ type: b.type, count: b.count || 0 })),
          images: (id.badges_v2 || []).filter((b) => b.image_url && b.selected !== false).map((b) => ({ name: b.name, src: b.image_url })),
          reply: meta.original_sender ? { user: meta.original_sender.username, text: (meta.original_message && meta.original_message.content) || "" } : null,
        };
      })
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  });
  return json({ messages }, 200, cors);
}

// ---------- Kick HD ----------
// Only this first playlist is fetched here. Browsers load the quality playlists and video
// chunks straight from Kick's video servers, so the video never passes through this Worker.

async function kickPlaylist(channel, cors) {
  const api = await fetch(`https://kick.com/api/v2/channels/${channel}/livestream`, { headers: BROWSER_HEADERS });
  if (!api.ok) return text(`Kick API error (${api.status})`, 502, cors);
  const info = await api.json();
  const playback = info && info.data && info.data.playback_url;
  if (!playback) return text("offline", 404, cors);

  const playbackUrl = new URL(playback);
  if (!playbackUrl.hostname.endsWith(".live-video.net")) return text("Unexpected playback host", 502, cors);

  const master = await fetch(playbackUrl, { headers: BROWSER_HEADERS });
  if (!master.ok) return text(`Playlist error (${master.status})`, 502, cors);
  const body = absolutize(await master.text(), playbackUrl);

  return new Response(body, {
    headers: { ...cors, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
  });
}

// Make any relative playlist links absolute, since the playlist is now served from this Worker
function absolutize(playlist, base) {
  return playlist
    .split("\n")
    .map((line) => (line && !line.startsWith("#") && !/^https?:\/\//.test(line) ? new URL(line, base).href : line))
    .join("\n");
}

// ---------- Gallery ----------
// Approved and pending items are each kept as one JSON list in KV, so showing the gallery is a single read.

async function getList(env, key) {
  return (await env.GALLERY.get(key, "json")) || [];
}

async function listGallery(env, cors) {
  // who shared an item (userId) stays private
  const items = (await getList(env, "approved")).map(({ userId, ...item }) => item);
  return json(
    { images: items.filter((i) => i.kind === "image"), clips: items.filter((i) => i.kind === "clip") },
    200,
    { ...cors, "Cache-Control": "public, max-age=30" }
  );
}

async function submit(request, env, cors, ctx) {
  const body = await readJson(request);

  // Spam limit per visitor
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `rate:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const count = Number(await env.GALLERY.get(rateKey)) || 0;
  if (count >= SUBMITS_PER_HOUR) fail(`You can share up to ${SUBMITS_PER_HOUR} links per hour. Try again later.`, 429);

  const queue = await getList(env, "pending");
  if (queue.length >= MAX_PENDING) fail("Too many links are waiting for review. Try again later.", 503);

  const item = body.kind === "image" ? await imageItem(body.link) : await clipItem(body.link);
  item.id = crypto.randomUUID();
  item.title = clean(body.title, 80) || item.title || "";
  item.name = clean(body.name, 30);
  item.created = Date.now();
  // Logged in? Remember who shared it, so a Clip of the Week win can pay them
  const sharer = request.headers.get("Authorization") && env.DB ? await optionalUser(request, env) : null;
  if (sharer) item.userId = sharer.id;

  const approved = await getList(env, "approved");
  if ([...queue, ...approved].some((i) => i.key === item.key)) fail("That link has already been shared.", 409);

  queue.push(item);
  await env.GALLERY.put("pending", JSON.stringify(queue));
  await env.GALLERY.put(rateKey, String(count + 1), { expirationTtl: 3700 });
  later(ctx, discordNotify(env, {
    title: "🖼️ New gallery link to review",
    description: `${item.title || "(no title)"}${item.name ? ` · shared by ${item.name}` : ""}\n${item.link || item.url}`,
    url: `${SITE_URL}/admin`,
  }));
  return json({ ok: true }, 200, cors);
}

async function pending(request, env, cors) {
  checkAdmin(request, env);
  return json({ pending: await getList(env, "pending"), approved: await getList(env, "approved") }, 200, cors);
}

async function moderate(request, env, cors) {
  checkAdmin(request, env);
  const { id, action } = await readJson(request);
  let queue = await getList(env, "pending");
  let approved = await getList(env, "approved");

  if (action === "approve") {
    const item = queue.find((i) => i.id === id);
    if (!item) fail("Item not found", 404);
    queue = queue.filter((i) => i.id !== id);
    approved = [{ ...item, approvedAt: Date.now() }, ...approved].slice(0, MAX_APPROVED);
  } else if (action === "reject") {
    queue = queue.filter((i) => i.id !== id);
  } else if (action === "delete") {
    approved = approved.filter((i) => i.id !== id);
  } else {
    fail("Unknown action", 400);
  }

  await env.GALLERY.put("pending", JSON.stringify(queue));
  await env.GALLERY.put("approved", JSON.stringify(approved));
  return json({ ok: true }, 200, cors);
}

// An image link: must be https and actually be an image
async function imageItem(link) {
  const url = httpsUrl(link);
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] }, redirect: "follow" });
  const type = res.headers.get("Content-Type") || "";
  res.body && res.body.cancel();
  if (!res.ok || !type.startsWith("image/")) fail("That link isn't a direct image. Right-click the image and choose 'Copy image address'.");
  return { kind: "image", url: url.href, key: `image:${url.href}` };
}

// A clip link from Kick, Twitch or YouTube
async function clipItem(link) {
  const url = httpsUrl(link);
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "kick.com") {
    const id = (url.searchParams.get("clip") || parts.find((p) => p.startsWith("clip_")) || "").match(/^clip_[A-Za-z0-9]+$/);
    if (!id) fail("Paste a Kick clip link, like kick.com/name/clips/clip_…");
    const res = await fetch(`https://kick.com/api/v2/clips/${id[0]}`, { headers: BROWSER_HEADERS });
    if (!res.ok) fail("Couldn't find that Kick clip.");
    const clip = (await res.json()).clip;
    if (!clip || !clip.video_url) fail("Couldn't find that Kick clip.");
    if (clip.is_mature) fail("Mature clips can't be shared here.");
    const video = new URL(clip.video_url);
    if (!video.hostname.endsWith("kick.com")) fail("Unexpected Kick clip address.");
    return {
      kind: "clip",
      platform: "kick",
      clipId: clip.id,
      video: video.href,
      thumb: clip.thumbnail_url,
      title: clean(clip.title, 80),
      channel: clean(clip.channel && (clip.channel.username || clip.channel.slug), 30),
      link: `https://kick.com/${(clip.channel && clip.channel.slug) || parts[0]}/clips/${clip.id}`,
      key: `kick:${clip.id}`,
    };
  }

  if (host === "clips.twitch.tv" || host === "twitch.tv") {
    const slug = host === "clips.twitch.tv" ? parts[0] : parts[1] === "clip" ? parts[2] : null;
    if (!slug || !/^[A-Za-z0-9_-]{3,100}$/.test(slug)) fail("Paste a Twitch clip link, like clips.twitch.tv/… or twitch.tv/name/clip/…");
    return { kind: "clip", platform: "twitch", clipId: slug, link: `https://clips.twitch.tv/${slug}`, key: `twitch:${slug}` };
  }

  if (host === "youtube.com" || host === "youtu.be") {
    const id =
      host === "youtu.be"
        ? parts[0]
        : url.searchParams.get("v") || (["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : null);
    if (!id || !/^[\w-]{11}$/.test(id)) fail("Paste a YouTube video or Shorts link.");
    return {
      kind: "clip",
      platform: "youtube",
      clipId: id,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      link: `https://www.youtube.com/watch?v=${id}`,
      key: `youtube:${id}`,
    };
  }

  fail("Clips must be from Kick, Twitch or YouTube.");
}

// ---------- Discord login ----------
// After Discord confirms who the visitor is, the Worker signs a session token and sends the
// visitor back to the page they came from with it in the URL fragment (#session=...).

// The logged-in user from "Authorization: Bearer <session>", or a 401 error
async function requireUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const user = auth.startsWith("Bearer ") && env.SESSION_SECRET ? await verifyToken(env, auth.slice(7)) : null;
  if (!user || !user.id) fail("Please log in.", 401);
  if (env.DB) {
    await ensureSchema(env);
    const row = await env.DB.prepare("SELECT banned FROM users WHERE id = ?").bind(user.id).first();
    if (row && row.banned) fail("Your account has been banned from chat.", 403);
  }
  return { id: user.id, name: user.name, avatar: user.avatar };
}

// Signed tokens: base64url(JSON) + "." + base64url(HMAC-SHA256)
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function signToken(env, data) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

async function verifyToken(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(sig), new TextEncoder().encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return data.exp > Date.now() ? data : null;
  } catch (e) {
    return null;
  }
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- Sinners chat ----------
// Messages live in D1. Viewers poll for new messages every few seconds.

// Folds account `from` into account `to` (used when two logins of the same person each had an account):
// the stronger adventurer is kept and gets every item, coins earned on `from` are added (minus its free
// starting 100), and scores, bets, boss damage, quests, streaks, achievements, cosmetics, logins and
// chat links move over (combined where both have one).
async function mergeAccount(env, from, to) {
  if (!from || !to || from === to) return;
  const run = (sql, ...args) => env.DB.prepare(sql).bind(...args).run();
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const tryRun = async (sql, ...args) => {
    try {
      await run(sql, ...args);
    } catch (e) {} // table or column not there yet
  };
  // Wallet
  const oldW = await one("SELECT points FROM wallets WHERE user_id = ?", from);
  if (oldW) {
    const newW = await one("SELECT points FROM wallets WHERE user_id = ?", to);
    if (newW) await run("UPDATE wallets SET points = points + ? WHERE user_id = ?", Math.max(0, oldW.points - START_POINTS), to);
    else await run("UPDATE wallets SET user_id = ? WHERE user_id = ?", to, from);
    await run("DELETE FROM wallets WHERE user_id = ?", from);
  }
  // Adventurer: keep the one with more progress; items from both end up with it
  const oldH = await one("SELECT level, xp FROM heroes WHERE user_id = ?", from);
  if (oldH) {
    const newH = await one("SELECT level, xp FROM heroes WHERE user_id = ?", to);
    const keepOld = !newH || oldH.level > newH.level || (oldH.level === newH.level && oldH.xp > newH.xp);
    if (keepOld) {
      if (newH) {
        await run("DELETE FROM heroes WHERE user_id = ?", to);
        await run("UPDATE hero_items SET equipped = 0 WHERE user_id = ?", to);
      }
      await run("UPDATE heroes SET user_id = ? WHERE user_id = ?", to, from);
      await run("UPDATE hero_items SET user_id = ? WHERE user_id = ?", to, from);
    } else {
      await run("UPDATE hero_items SET user_id = ?, equipped = 0 WHERE user_id = ?", to, from);
      await run("DELETE FROM heroes WHERE user_id = ?", from);
    }
  } else {
    await tryRun("UPDATE hero_items SET user_id = ?, equipped = 0 WHERE user_id = ?", to, from);
  }
  // Combine rows both accounts have
  await tryRun(
    "UPDATE boss_hits SET damage = damage + COALESCE((SELECT o.damage FROM boss_hits o WHERE o.week = boss_hits.week AND o.user_id = ?), 0), " +
      "hits = hits + COALESCE((SELECT o.hits FROM boss_hits o WHERE o.week = boss_hits.week AND o.user_id = ?), 0) WHERE user_id = ?",
    from,
    from,
    to
  );
  await tryRun(
    "UPDATE daily SET " +
      DAILY_COUNTERS.map((k) => `${k} = ${k} + COALESCE((SELECT o.${k} FROM daily o WHERE o.day = daily.day AND o.user_id = ?), 0)`).join(", ") +
      " WHERE user_id = ?",
    ...DAILY_COUNTERS.map(() => from),
    to
  );
  await tryRun("UPDATE streaks SET best = MAX(best, COALESCE((SELECT o.best FROM streaks o WHERE o.user_id = ?), 0)) WHERE user_id = ?", from, to);
  // Move the rest (where `to` already has a row, `to` keeps its own)
  for (const table of ["bets", "scores", "purchases", "boss_hits", "daily", "streaks", "score_limits", "achievements", "cosmetics", "linked_accounts", "clip_votes", "party"]) {
    await tryRun(`UPDATE OR IGNORE ${table} SET user_id = ? WHERE user_id = ?`, to, from);
    await tryRun(`DELETE FROM ${table} WHERE user_id = ?`, from);
  }
  await tryRun("UPDATE messages SET user_id = ? WHERE user_id = ?", to, from);
  await tryRun("UPDATE identities SET user_id = ? WHERE user_id = ?", to, from);
  // A ban on either account stays
  await tryRun("UPDATE users SET banned = MAX(banned, COALESCE((SELECT o.banned FROM users o WHERE o.id = ?), 0)) WHERE id = ?", from, to);
}

// The first Discord bot saved players under their bare Discord id while the website used
// "discord:<id>"; this folds each of those into the website account (runs once with the schema update).
async function mergeSplitAccounts(env) {
  const ids = new Set();
  for (const table of ["wallets", "heroes", "hero_items", "bets", "scores", "purchases", "boss_hits", "daily", "streaks"]) {
    try {
      const { results } = await env.DB.prepare(`SELECT DISTINCT user_id AS id FROM ${table} WHERE user_id NOT LIKE '%:%'`).all();
      results.forEach((r) => /^\d{5,25}$/.test(r.id) && ids.add(r.id));
    } catch (e) {} // table not made yet
  }
  for (const raw of ids) await mergeAccount(env, raw, `discord:${raw}`);
}

// Every account made before logins could be combined gets its login written down (once)
async function backfillIdentities(env) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO identities (provider, ext_id, user_id, name, avatar, created) " +
        "SELECT 'discord', substr(id, 9), id, name, avatar, created FROM users WHERE id LIKE 'discord:%'"
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO identities (provider, ext_id, user_id, name, avatar, created) " +
        "SELECT 'twitch', ext_id, user_id, ext_name, NULL, created FROM linked_accounts WHERE platform = 'twitch'"
    ),
  ]);
}

// Bump SCHEMA_VERSION whenever tables or columns change. The database remembers the version it has,
// so the full setup below runs once per change instead of on every cold start (which was slow
// enough to miss Discord's 3-second limit).
const SCHEMA_VERSION = 17;
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  try {
    const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'schema'").first();
    if (row && Number(row.value) >= SCHEMA_VERSION) {
      schemaReady = true;
      return;
    }
  } catch (e) {} // no meta table yet: set everything up
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, user_id TEXT NOT NULL, " +
        "name TEXT NOT NULL, avatar TEXT, text TEXT NOT NULL, created INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER)"
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS messages_room ON messages (room, id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS messages_user ON messages (user_id, id)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT, banned INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS scores (game TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, score REAL NOT NULL, " +
        "created INTEGER NOT NULL, PRIMARY KEY (game, user_id))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS score_limits (user_id TEXT PRIMARY KEY, at INTEGER NOT NULL)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT, points INTEGER NOT NULL, " +
        "earned_day TEXT NOT NULL DEFAULT '', earned_today INTEGER NOT NULL DEFAULT 0)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS bets (game TEXT NOT NULL, round INTEGER NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, " +
        "choice TEXT NOT NULL, amount INTEGER NOT NULL, payout INTEGER, bonus INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, " +
        "PRIMARY KEY (game, round, user_id))"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS rounds (game TEXT NOT NULL, round INTEGER NOT NULL, outcome TEXT NOT NULL, pot INTEGER NOT NULL DEFAULT 0, " +
        "winners INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, settled_at INTEGER NOT NULL, PRIMARY KEY (game, round))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pools (game TEXT PRIMARY KEY, jackpot INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shop_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', " +
        "price INTEGER NOT NULL, stock INTEGER, created INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'reward', slot TEXT, rarity TEXT, " +
        "power INTEGER NOT NULL DEFAULT 0, tier INTEGER NOT NULL DEFAULT 1)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, item_name TEXT NOT NULL, " +
        "user_id TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, price INTEGER NOT NULL, delivered INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)"
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS purchases_user ON purchases (user_id, id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS presence (visitor TEXT PRIMARY KEY, page TEXT NOT NULL, seen INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS site_days (day TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, visitors INTEGER NOT NULL DEFAULT 0, peak INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS site_pages (day TEXT NOT NULL, page TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, page))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS day_visitors (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS heroes (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, look TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, " +
        "xp INTEGER NOT NULL DEFAULT 0, runs INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, exp_dungeon TEXT, exp_start INTEGER, " +
        "exp_end INTEGER, exp_power INTEGER, exp_stats TEXT, buffs TEXT NOT NULL DEFAULT '{}', rating INTEGER NOT NULL DEFAULT 1000, " +
        "duel_wins INTEGER NOT NULL DEFAULT 0, duel_losses INTEGER NOT NULL DEFAULT 0, duel_day TEXT NOT NULL DEFAULT '', duel_count INTEGER NOT NULL DEFAULT 0, " +
        "watch_at INTEGER, watch_day TEXT NOT NULL DEFAULT '', watch_minutes INTEGER NOT NULL DEFAULT 0, " +
        "created INTEGER NOT NULL)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS hero_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, slot TEXT NOT NULL, name TEXT NOT NULL, " +
        "rarity TEXT NOT NULL, power INTEGER NOT NULL, atk INTEGER NOT NULL DEFAULT 0, def INTEGER NOT NULL DEFAULT 0, hp INTEGER NOT NULL DEFAULT 0, " +
        "tier INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL, icon TEXT, sell INTEGER NOT NULL DEFAULT 0, " +
        "equipped INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)"
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS hero_items_user ON hero_items (user_id, equipped)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS daily (user_id TEXT NOT NULL, day TEXT NOT NULL, games INTEGER NOT NULL DEFAULT 0, dungeons INTEGER NOT NULL DEFAULT 0, " +
        "dungeon_wins INTEGER NOT NULL DEFAULT 0, duels INTEGER NOT NULL DEFAULT 0, duel_wins INTEGER NOT NULL DEFAULT 0, claimed TEXT NOT NULL DEFAULT '', " +
        "bonus INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS streaks (user_id TEXT PRIMARY KEY, last_day TEXT NOT NULL, streak INTEGER NOT NULL, best INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bets_user ON bets (user_id, created)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, ext_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT, avatar TEXT, created INTEGER NOT NULL, " +
        "PRIMARY KEY (provider, ext_id))"
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS linked_accounts (user_id TEXT NOT NULL, platform TEXT NOT NULL, ext_id TEXT NOT NULL, ext_name TEXT NOT NULL, " +
        "access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at INTEGER NOT NULL, last_sent INTEGER, created INTEGER NOT NULL, PRIMARY KEY (user_id, platform))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS achievements (user_id TEXT NOT NULL, id TEXT NOT NULL, earned INTEGER NOT NULL, PRIMARY KEY (user_id, id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cosmetics (user_id TEXT NOT NULL, id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, id))"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS season_results (season TEXT NOT NULL, rank INTEGER NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, rating INTEGER NOT NULL, PRIMARY KEY (season, rank))"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS party (room TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, seen INTEGER NOT NULL, last_react INTEGER, PRIMARY KEY (room, user_id))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, emoji TEXT NOT NULL, created INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS reactions_room ON reactions (room, created)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS clip_votes (week TEXT NOT NULL, user_id TEXT NOT NULL, item_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (week, user_id))"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS clip_winners (week TEXT PRIMARY KEY, item_id TEXT NOT NULL, votes INTEGER NOT NULL, title TEXT, link TEXT, thumb TEXT, platform TEXT, name TEXT)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS bosses (week TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, hp_max INTEGER NOT NULL, " +
        "hp_left INTEGER NOT NULL, defeated_at INTEGER)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS boss_hits (week TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, damage INTEGER NOT NULL DEFAULT 0, " +
        "hits INTEGER NOT NULL DEFAULT 0, last_strike INTEGER, claimed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (week, user_id))"
    ),
  ]);
  // Added later: tables made before this need the column (fails harmlessly when it's already there)
  for (const sql of [
    "ALTER TABLE bets ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE site_days ADD COLUMN peak INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE shop_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'reward'",
    "ALTER TABLE shop_items ADD COLUMN slot TEXT",
    "ALTER TABLE shop_items ADD COLUMN rarity TEXT",
    "ALTER TABLE shop_items ADD COLUMN power INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE shop_items ADD COLUMN tier INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE heroes ADD COLUMN exp_stats TEXT",
    "ALTER TABLE heroes ADD COLUMN buffs TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE heroes ADD COLUMN rating INTEGER NOT NULL DEFAULT 1000",
    "ALTER TABLE heroes ADD COLUMN duel_wins INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN duel_losses INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN duel_day TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE heroes ADD COLUMN duel_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE hero_items ADD COLUMN atk INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE hero_items ADD COLUMN def INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE hero_items ADD COLUMN hp INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN watch_at INTEGER",
    "ALTER TABLE heroes ADD COLUMN watch_day TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE heroes ADD COLUMN watch_minutes INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN badge TEXT",
    "ALTER TABLE heroes ADD COLUMN style TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE heroes ADD COLUMN cleared TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE heroes ADD COLUMN watch_total INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN quests_done INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE heroes ADD COLUMN duel_wins_total INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE messages ADD COLUMN badge TEXT",
    "ALTER TABLE messages ADD COLUMN color TEXT",
    "ALTER TABLE daily ADD COLUMN chats INTEGER NOT NULL DEFAULT 0",
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch (e) {}
  }
  await mergeSplitAccounts(env);
  await backfillIdentities(env);
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(SCHEMA_VERSION)),
  ]);
  schemaReady = true;
}

function checkRoom(room) {
  if (!ROOM_PATTERN.test(room)) fail("Unknown chat room", 400);
}

const MESSAGE_COLUMNS = "id, user_id AS userId, name, avatar, text, created, badge, color";

async function chatList(room, url, env, cors) {
  checkRoom(room);
  const after = Number(url.searchParams.get("after")) || 0;
  const { results: messages } = after
    ? await env.DB.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE room = ? AND id > ? AND deleted = 0 ORDER BY id LIMIT 100`)
        .bind(room, after)
        .all()
    : await env.DB.prepare(
        `SELECT * FROM (SELECT ${MESSAGE_COLUMNS} FROM messages WHERE room = ? AND deleted = 0 ORDER BY id DESC LIMIT 50) ORDER BY id`
      )
        .bind(room)
        .all();
  const { results: removed } = await env.DB.prepare("SELECT id FROM messages WHERE room = ? AND deleted = 1 AND deleted_at > ?")
    .bind(room, Date.now() - 10 * 60000)
    .all();
  return json({ messages, deleted: removed.map((r) => r.id) }, 200, cors);
}

async function chatPost(room, request, env, cors) {
  checkRoom(room);
  const user = await requireUser(request, env);
  const { text: raw } = await readJson(request);
  // Only control characters are removed: the site always shows chat as plain text, so "<3" stays "<3"
  const message = String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
  if (!message) fail("Type a message first.");

  const last = await env.DB.prepare("SELECT created FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(user.id).first();
  if (last && Date.now() - last.created < CHAT_MIN_GAP_MS) fail("You're sending messages too fast.", 429);

  const created = Date.now();
  const style = await nameStyle(env, user.id); // badge and name color, shown next to the name
  const result = await env.DB.prepare("INSERT INTO messages (room, user_id, name, avatar, text, created, badge, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(room, user.id, user.name, user.avatar, message, created, style.badge, style.color)
    .run();
  return json(
    { message: { id: result.meta.last_row_id, userId: user.id, name: user.name, avatar: user.avatar, text: message, created, badge: style.badge, color: style.color } },
    200,
    cors
  );
}

async function chatAdminList(request, env, cors) {
  checkAdmin(request, env);
  const { results: messages } = await env.DB.prepare(
    `SELECT ${MESSAGE_COLUMNS}, room FROM messages WHERE deleted = 0 ORDER BY id DESC LIMIT 100`
  ).all();
  const { results: banned } = await env.DB.prepare("SELECT id, name, avatar FROM users WHERE banned = 1 ORDER BY name").all();
  return json({ messages, banned }, 200, cors);
}

async function chatAdminAction(request, env, cors) {
  checkAdmin(request, env);
  const { action, id, userId } = await readJson(request);
  const now = Date.now();
  if (action === "delete") {
    await env.DB.prepare("UPDATE messages SET deleted = 1, deleted_at = ? WHERE id = ?").bind(now, Number(id)).run();
  } else if (action === "ban") {
    // Ban and remove their messages from the last day
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, name, banned, created) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET banned = 1").bind(
        String(userId),
        "Banned user",
        now
      ),
      env.DB.prepare("UPDATE messages SET deleted = 1, deleted_at = ? WHERE user_id = ? AND created > ?").bind(now, String(userId), now - 86400000),
      env.DB.prepare("DELETE FROM scores WHERE user_id = ?").bind(String(userId)),
    ]);
  } else if (action === "unban") {
    await env.DB.prepare("UPDATE users SET banned = 0 WHERE id = ?").bind(String(userId)).run();
  } else {
    fail("Unknown action", 400);
  }
  return json({ ok: true }, 200, cors);
}

// ---------- Mini game leaderboards ----------
// Scores come from the visitor's browser, so they can't be fully trusted: impossible scores are
// refused, submissions are rate limited, banned users can't post, and the admin can remove entries.

const GAMES = {
  // points: how many points one finished game earns (better play earns more)
  reaction: { lowerIsBetter: true, min: 90, max: 3000, points: (s) => clampInt((600 - s) / 10, 5, 40) }, // average ms
  aim: { lowerIsBetter: false, min: 1, max: 120, points: (s) => clampInt(s, 3, 50) }, // targets hit in 30 s
  typing: { lowerIsBetter: false, min: 1, max: 90, points: (s) => clampInt(s, 3, 50) }, // words typed in 30 s
};
const SCORE_GAP_MS = 4000;

function gameOf(id) {
  const game = GAMES[id];
  if (!game) fail("Unknown game", 400);
  return game;
}

async function topScores(env, id, limit) {
  const order = gameOf(id).lowerIsBetter ? "ASC" : "DESC";
  const { results } = await env.DB.prepare(
    `SELECT user_id AS userId, name, avatar, score, created FROM scores WHERE game = ? ORDER BY score ${order}, created ASC LIMIT ?`
  )
    .bind(id, limit)
    .all();
  return results;
}

async function gameLeaderboard(url, env, cors) {
  const id = url.searchParams.get("game") || "";
  return json({ game: id, scores: await topScores(env, id, 10) }, 200, cors);
}

async function gameScore(request, env, cors) {
  const user = await requireUser(request, env);
  const { game: id, score: raw } = await readJson(request);
  const game = gameOf(id);
  const score = Math.round(Number(raw));
  if (!Number.isFinite(score) || score < game.min || score > game.max) fail("That score doesn't look possible.", 400);

  const now = Date.now();
  const last = await env.DB.prepare("SELECT at FROM score_limits WHERE user_id = ?").bind(user.id).first();
  if (last && now - last.at < SCORE_GAP_MS) fail("Slow down a little before sending another score.", 429);

  const better = game.lowerIsBetter ? "excluded.score < scores.score" : "excluded.score > scores.score";
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO scores (game, user_id, name, avatar, score, created) VALUES (?, ?, ?, ?, ?, ?) " +
        `ON CONFLICT(game, user_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, ` +
        `created = CASE WHEN ${better} THEN excluded.created ELSE scores.created END, ` +
        `score = CASE WHEN ${better} THEN excluded.score ELSE scores.score END`
    ).bind(id, user.id, user.name, user.avatar, score, now),
    env.DB.prepare("INSERT INTO score_limits (user_id, at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET at = excluded.at").bind(user.id, now),
  ]);

  const mine = await env.DB.prepare("SELECT score FROM scores WHERE game = ? AND user_id = ?").bind(id, user.id).first();
  const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE game = ? AND score ${game.lowerIsBetter ? "<" : ">"} ?`)
    .bind(id, mine.score)
    .first();
  const earned = await awardPoints(env, user, game.points(score));
  const hero = await addHeroXp(env, user.id, earned.pointsEarned);
  await bumpDaily(env, user.id, { games: 1 });
  const achievements = await checkAchievements(env, user.id);
  return json({ achievements, best: mine.score, rank: ahead.n + 1, newBest: mine.score === score, ...earned, heroXp: hero.xp, heroLevels: hero.levels }, 200, cors);
}

async function gamesAdminList(request, env, cors) {
  checkAdmin(request, env);
  const boards = {};
  for (const id of Object.keys(GAMES)) boards[id] = await topScores(env, id, 50);
  const { results: richest } = await env.DB.prepare("SELECT user_id AS userId, name, points FROM wallets ORDER BY points DESC LIMIT 20").all();
  return json({ ...boards, richest }, 200, cors);
}

async function gamesAdminAction(request, env, cors) {
  checkAdmin(request, env);
  const { action, game: id, userId } = await readJson(request);
  if (action === "reset-points") {
    await env.DB.batch(["wallets", "bets", "rounds", "pools"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
    return json({ ok: true }, 200, cors);
  }
  gameOf(id);
  if (action === "reset") await env.DB.prepare("DELETE FROM scores WHERE game = ?").bind(id).run();
  else if (action === "delete") await env.DB.prepare("DELETE FROM scores WHERE game = ? AND user_id = ?").bind(id, String(userId)).run();
  else fail("Unknown action", 400);
  return json({ ok: true }, 200, cors);
}

// ---------- Points ----------

const START_POINTS = 100;
const DAILY_CAP = 300; // most points a player can earn from games per day

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

async function wallet(env, user) {
  await env.DB.prepare(
    "INSERT INTO wallets (user_id, name, avatar, points) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar"
  )
    .bind(user.id, user.name, user.avatar, START_POINTS)
    .run();
  return env.DB.prepare("SELECT points, earned_day AS day, earned_today AS today FROM wallets WHERE user_id = ?").bind(user.id).first();
}

async function awardPoints(env, user, amount) {
  const w = await wallet(env, user);
  const day = new Date().toISOString().slice(0, 10);
  const today = w.day === day ? w.today : 0;
  const earned = Math.max(0, Math.min(amount, DAILY_CAP - today));
  await env.DB.prepare("UPDATE wallets SET points = points + ?, earned_day = ?, earned_today = ? WHERE user_id = ?")
    .bind(earned, day, today + earned, user.id)
    .run();
  return { pointsEarned: earned, points: w.points + earned, earnedToday: today + earned, dailyCap: DAILY_CAP };
}

async function pointsMine(request, env, cors) {
  const user = await requireUser(request, env);
  const w = await wallet(env, user);
  const day = new Date().toISOString().slice(0, 10);
  return json({ points: w.points, earnedToday: w.day === day ? w.today : 0, dailyCap: DAILY_CAP }, 200, cors);
}

async function pointsTop(env, cors) {
  const { results } = await env.DB.prepare("SELECT user_id AS userId, name, avatar, points FROM wallets ORDER BY points DESC LIMIT 10").all();
  return json({ players: results }, 200, cors);
}

// ---------- Betting games ----------
// A new round starts every minute for everyone. Each round's result comes from a keyed hash of the
// round number (HMAC with SESSION_SECRET), so it can't be predicted or changed from a browser.
// Winners split the round's pot (plus any jackpot) in proportion to their bets; if nobody picked
// the result, the pot rolls over into the jackpot. On top of that, every winning bet gets a site bonus
// (a share of the bet, made by the site), so a win always pays even for someone playing alone. Bonuses
// count toward the same daily earning cap as the games, so extra accounts can't farm endless points. Rounds are paid out once, by whichever request
// first sees that a round has finished.

const ROUND_MS = 60000;
const BET_CLOSE_MS = 5000; // betting closes this long before the round ends
const BET_GAMES = {
  colors: { choices: ["red", "green", "blue"], bonus: 0.1 }, // +10% of a winning bet
  lucky: { choices: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], bonus: 0.2 }, // +20% of a winning bet
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function betGameOf(id) {
  const game = BET_GAMES[id];
  if (!game) fail("Unknown game", 400);
  return game;
}

async function roundOutcome(env, id, round) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(`bet:${id}:${round}`));
  const n = new DataView(sig).getUint32(0);
  const { choices } = BET_GAMES[id];
  return choices[n % choices.length];
}

// The last `count` finished rounds, including ones nobody bet on: every round's result comes from the
// same keyed hash, so it can be worked out any time. Pot and winners come from rounds that had bets.
async function recentRounds(env, id, current, count) {
  const { results } = await env.DB.prepare("SELECT round, pot, winners, paid FROM rounds WHERE game = ? AND round >= ? AND round < ?")
    .bind(id, current - count, current)
    .all();
  const played = Object.fromEntries(results.map((r) => [r.round, r]));
  const out = [];
  for (let r = current - 1; r >= current - count; r--) {
    const p = played[r];
    out.push({ round: r, outcome: await roundOutcome(env, id, r), pot: p ? p.pot : 0, winners: p ? p.winners : 0, paid: p ? p.paid : 0, bets: !!p });
  }
  return out;
}

async function settleRounds(env, id) {
  const current = Math.floor(Date.now() / ROUND_MS);
  const { results: pending } = await env.DB.prepare(
    "SELECT DISTINCT round FROM bets WHERE game = ? AND round < ? AND round NOT IN (SELECT round FROM rounds WHERE game = ?) ORDER BY round LIMIT 20"
  )
    .bind(id, current, id)
    .all();

  for (const { round } of pending) {
    const outcome = await roundOutcome(env, id, round);
    // Claim the round; if another request already did, skip it
    const claim = await env.DB.prepare("INSERT INTO rounds (game, round, outcome, settled_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(id, round, outcome, Date.now())
      .run();
    if (!claim.meta || claim.meta.changes !== 1) continue;

    const { results: bets } = await env.DB.prepare("SELECT user_id, choice, amount FROM bets WHERE game = ? AND round = ?").bind(id, round).all();
    const pot = bets.reduce((sum, b) => sum + b.amount, 0);
    const winners = bets.filter((b) => b.choice === outcome);
    await env.DB.prepare("INSERT INTO pools (game, jackpot) VALUES (?, 0) ON CONFLICT DO NOTHING").bind(id).run();
    const pool = await env.DB.prepare("SELECT jackpot FROM pools WHERE game = ?").bind(id).first();

    const writes = [env.DB.prepare("UPDATE bets SET payout = 0 WHERE game = ? AND round = ?").bind(id, round)];
    let paid = 0;
    if (winners.length) {
      const total = pot + pool.jackpot;
      const winningStake = winners.reduce((sum, b) => sum + b.amount, 0);
      const day = today();
      for (const b of winners) {
        const payout = Math.floor((total * b.amount) / winningStake);
        paid += payout;
        const w = await env.DB.prepare("SELECT earned_day AS day, earned_today AS today FROM wallets WHERE user_id = ?").bind(b.user_id).first();
        const earned = w && w.day === day ? w.today : 0;
        const bonus = Math.max(0, Math.min(Math.floor(b.amount * BET_GAMES[id].bonus), DAILY_CAP - earned));
        writes.push(
          env.DB.prepare("UPDATE wallets SET points = points + ?, earned_day = ?, earned_today = ? WHERE user_id = ?").bind(
            payout + bonus,
            day,
            earned + bonus,
            b.user_id
          )
        );
        writes.push(
          env.DB.prepare("UPDATE bets SET payout = ?, bonus = ? WHERE game = ? AND round = ? AND user_id = ?").bind(payout, bonus, id, round, b.user_id)
        );
      }
      writes.push(env.DB.prepare("UPDATE pools SET jackpot = ? WHERE game = ?").bind(total - paid, id)); // leftover from rounding
    } else {
      writes.push(env.DB.prepare("UPDATE pools SET jackpot = jackpot + ? WHERE game = ?").bind(pot, id));
    }
    writes.push(
      env.DB.prepare("UPDATE rounds SET pot = ?, winners = ?, paid = ? WHERE game = ? AND round = ?").bind(pot, winners.length, paid, id, round)
    );
    await env.DB.batch(writes);
  }
}

async function optionalUser(request, env) {
  try {
    return await requireUser(request, env);
  } catch (e) {
    return null;
  }
}

async function betState(request, url, env, cors) {
  const id = url.searchParams.get("game") || "";
  const game = betGameOf(id);
  await settleRounds(env, id);
  const now = Date.now();
  const round = Math.floor(now / ROUND_MS);
  const user = request.headers.get("Authorization") ? await optionalUser(request, env) : null;

  const { results: bets } = await env.DB.prepare(
    "SELECT user_id AS userId, name, avatar, choice, amount FROM bets WHERE game = ? AND round = ? ORDER BY created DESC"
  )
    .bind(id, round)
    .all();
  const choices = Object.fromEntries(game.choices.map((c) => [c, { total: 0, count: 0 }]));
  bets.forEach((b) => {
    choices[b.choice].total += b.amount;
    choices[b.choice].count += 1;
  });
  const pool = await env.DB.prepare("SELECT jackpot FROM pools WHERE game = ?").bind(id).first();
  const history = await recentRounds(env, id, round, 10);

  const out = {
    game: id,
    round,
    now,
    endsAt: (round + 1) * ROUND_MS,
    closesAt: (round + 1) * ROUND_MS - BET_CLOSE_MS,
    choices,
    pot: bets.reduce((sum, b) => sum + b.amount, 0),
    jackpot: pool ? pool.jackpot : 0,
    bets: bets.slice(0, 30),
    history,
    bonusRate: game.bonus,
  };
  if (user) {
    out.myBet = bets.find((b) => b.userId === user.id) || null;
    out.myLast = await env.DB.prepare(
      "SELECT b.round, b.choice, b.amount, b.payout, b.bonus, r.outcome FROM bets b JOIN rounds r ON r.game = b.game AND r.round = b.round " +
        "WHERE b.game = ? AND b.user_id = ? ORDER BY b.round DESC LIMIT 1"
    )
      .bind(id, user.id)
      .first();
    const w = await wallet(env, user);
    out.points = w.points;
    out.bonusLeft = Math.max(0, DAILY_CAP - (w.day === today() ? w.today : 0));
  }
  return json(out, 200, cors);
}

async function betPlace(request, env, cors) {
  const user = await requireUser(request, env);
  const { game: id, choice: rawChoice, amount: raw } = await readJson(request);
  const game = betGameOf(id);
  const choice = String(rawChoice);
  if (!game.choices.includes(choice)) fail("Pick one of the options.", 400);
  const amount = Math.floor(Number(raw));
  if (!Number.isFinite(amount) || amount < 1) fail("Bet at least 1 point.", 400);

  const now = Date.now();
  const round = Math.floor(now / ROUND_MS);
  if (now >= (round + 1) * ROUND_MS - BET_CLOSE_MS) fail("Betting is closed for this round. Wait a few seconds for the next one.", 409);

  await wallet(env, user);
  const existing = await env.DB.prepare("SELECT 1 FROM bets WHERE game = ? AND round = ? AND user_id = ?").bind(id, round, user.id).first();
  if (existing) fail("You already bet this round.", 409);

  // Take the points only if there are enough
  const take = await env.DB.prepare("UPDATE wallets SET points = points - ? WHERE user_id = ? AND points >= ?").bind(amount, user.id, amount).run();
  if (!take.meta || take.meta.changes !== 1) fail("You don't have enough points for that bet.", 400);
  try {
    await env.DB.prepare(
      "INSERT INTO bets (game, round, user_id, name, avatar, choice, amount, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, round, user.id, user.name, user.avatar, choice, amount, now)
      .run();
  } catch (e) {
    await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(amount, user.id).run();
    fail("You already bet this round.", 409);
  }
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json({ ok: true, points: w.points, round }, 200, cors);
}

// ---------- Shop ----------
// Admin adds items (picture, name, description, price, optional stock); players buy them with points.
// Pictures are stored in the GALLERY KV namespace; purchases are listed for the admin to hand out.

const SHOP_IMAGE_MAX = 1500000; // bytes
const SHOP_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const SHOP_COLUMNS = "id, name, description, price, stock, created, kind, slot, rarity, power, tier";

function shopItemOut(item) {
  return { ...item, image: `/shop/image/${item.id}?v=${item.created}` };
}

async function shopImageGet(id, env, cors) {
  const { value, metadata } = await env.GALLERY.getWithMetadata(`shop-img:${id}`, "arrayBuffer");
  if (!value) return text("Not found", 404, cors);
  return new Response(value, {
    headers: { ...cors, "Content-Type": (metadata && metadata.type) || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

// The Redeem section: rewards the admin adds and hands out (adventure gear is in /shop/adventure)
async function shopList(request, env, cors) {
  const { results } = await env.DB.prepare(`SELECT ${SHOP_COLUMNS} FROM shop_items ORDER BY price, id`).all();
  return json({ items: results.map(shopItemOut) }, 200, cors);
}

async function shopMine(request, env, cors) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    "SELECT id, item_id AS itemId, item_name AS name, price, delivered, created FROM purchases WHERE user_id = ? ORDER BY id DESC LIMIT 50"
  )
    .bind(user.id)
    .all();
  return json({ purchases: results }, 200, cors);
}

async function shopBuy(request, env, cors, ctx) {
  const user = await requireUser(request, env);
  const { id } = await readJson(request);
  const item = await env.DB.prepare(`SELECT ${SHOP_COLUMNS} FROM shop_items WHERE id = ?`).bind(Math.floor(Number(id)) || 0).first();
  if (!item) fail("That item isn't in the shop anymore.", 404);
  await wallet(env, user);

  // Hold one from the stock first (no limit when stock is empty), then take the points
  const hold = await env.DB.prepare("UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND (stock IS NULL OR stock > 0)").bind(item.id).run();
  if (!hold.meta || hold.meta.changes !== 1) fail("Sold out.", 409);
  const take = await env.DB.prepare("UPDATE wallets SET points = points - ? WHERE user_id = ? AND points >= ?")
    .bind(item.price, user.id, item.price)
    .run();
  if (!take.meta || take.meta.changes !== 1) {
    await env.DB.prepare("UPDATE shop_items SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL").bind(item.id).run();
    fail("You don't have enough points for that.", 400);
  }
  await env.DB.prepare(
    "INSERT INTO purchases (item_id, item_name, user_id, name, avatar, price, created) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(item.id, item.name, user.id, user.name, user.avatar, item.price, Date.now())
    .run();
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  const left = await env.DB.prepare("SELECT stock FROM shop_items WHERE id = ?").bind(item.id).first();
  later(ctx, discordNotify(env, {
    title: "🛒 New shop purchase",
    description: `${user.id.startsWith("discord:") ? `<@${discordIdOf(user.id)}> ` : ""}(${user.name}) bought **${item.name}** for ${item.price} 🪙.\nHand it out, then mark it delivered on the admin page.`,
    url: `${SITE_URL}/admin`,
  }));
  return json({ ok: true, points: w.points, stock: left ? left.stock : null }, 200, cors);
}

async function shopAdminList(request, env, cors) {
  checkAdmin(request, env);
  const { results: items } = await env.DB.prepare(`SELECT ${SHOP_COLUMNS} FROM shop_items ORDER BY price, id`).all();
  const { results: purchases } = await env.DB.prepare(
    "SELECT id, item_name AS item, user_id AS userId, name, price, delivered, created FROM purchases ORDER BY id DESC LIMIT 100"
  ).all();
  return json({ items: items.map(shopItemOut), purchases }, 200, cors);
}

// "data:image/png;base64,...." -> { type, bytes }
function decodeImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !SHOP_IMAGE_TYPES.includes(match[1])) fail("Pick a JPG, PNG, WebP or GIF picture.");
  const bin = atob(match[2]);
  if (bin.length > SHOP_IMAGE_MAX) fail("That picture is too big (1.5 MB max).");
  return { type: match[1], bytes: Uint8Array.from(bin, (c) => c.charCodeAt(0)) };
}

function shopFields(body) {
  const name = clean(body.name, 60);
  if (!name) fail("Give the item a name.");
  const price = Math.floor(Number(body.price));
  if (!Number.isFinite(price) || price < 1 || price > 1000000) fail("Price must be between 1 and 1,000,000 points.");
  let stock = null;
  if (body.stock !== "" && body.stock != null) {
    stock = Math.floor(Number(body.stock));
    if (!Number.isFinite(stock) || stock < 0 || stock > 100000) fail("Stock must be a number (leave it empty for unlimited).");
  }
  return { name, description: clean(body.description, 300), price, stock, tier: 1, kind: "reward", slot: null, rarity: null, power: 0 };
}

async function shopAdminAction(request, env, cors) {
  checkAdmin(request, env);
  const body = await readJson(request);
  const { action } = body;

  if (action === "add" || action === "update") {
    if (!env.GALLERY) fail("Picture storage isn't set up yet (GALLERY binding missing).", 503);
    const f = shopFields(body);
    const image = action === "add" || body.image ? decodeImage(body.image) : null;
    const created = Date.now();
    let id;
    if (action === "add") {
      const row = await env.DB.prepare(
        "INSERT INTO shop_items (name, description, price, stock, created, tier, kind, slot, rarity, power) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
      )
        .bind(f.name, f.description, f.price, f.stock, created, f.tier, f.kind, f.slot, f.rarity, f.power)
        .first();
      id = row.id;
    } else {
      id = Math.floor(Number(body.id)) || 0;
      // "created" also versions the picture's address, so a new picture isn't hidden by the browser cache
      const res = await env.DB.prepare(
        `UPDATE shop_items SET name = ?, description = ?, price = ?, stock = ?, tier = ?, kind = ?, slot = ?, rarity = ?, power = ?${image ? ", created = ?" : ""} WHERE id = ?`
      )
        .bind(f.name, f.description, f.price, f.stock, f.tier, f.kind, f.slot, f.rarity, f.power, ...(image ? [created] : []), id)
        .run();
      if (!res.meta || res.meta.changes !== 1) fail("That item doesn't exist anymore.", 404);
    }
    if (image) await env.GALLERY.put(`shop-img:${id}`, image.bytes, { metadata: { type: image.type } });
    return json({ ok: true, id }, 200, cors);
  }
  if (action === "delete") {
    const id = Math.floor(Number(body.id)) || 0;
    await env.DB.prepare("DELETE FROM shop_items WHERE id = ?").bind(id).run();
    if (env.GALLERY) await env.GALLERY.delete(`shop-img:${id}`);
    return json({ ok: true }, 200, cors);
  }
  if (action === "deliver") {
    await env.DB.prepare("UPDATE purchases SET delivered = ? WHERE id = ?")
      .bind(body.delivered ? 1 : 0, Math.floor(Number(body.purchaseId)) || 0)
      .run();
    return json({ ok: true }, 200, cors);
  }
  fail("Unknown action", 400);
}

// ---------- Adventure (Profile page, Shop page, /dungeon and /duel) ----------
// Every player gets an adventurer the first time they open their profile: a small pixel character
// with a random look, a level, Attack / Defense / HP, 8 equipment slots and a bag. Levels raise the
// base stats; gear adds more (rarer gear adds more). Adventurers are sent to a region of the world map
// for real time and fight its monster when they arrive; the Arena pits them against other players'
// adventurers. Win chances come from a power score (attack + 0.8 x defense + 0.25 x HP): being a bit
// stronger gives a good chance, being much stronger an almost sure win. The fight shown to the player
// is played out to match the result.

const TIER_LEVELS = [1, 5, 10, 20, 30]; // adventurer level that unlocks tier 1-5 (shop gear and regions)
const MAX_LEVEL = 50;
const BAG_SIZE = 30;
const SLOTS = ["helmet", "chest", "legs", "shoes", "gloves", "weapon", "shield", "ring"];
const RARITIES = [
  { id: "common", chance: 55, mult: 1, sell: 2, word: "" },
  { id: "uncommon", chance: 28, mult: 1.3, sell: 5, word: "Sturdy " },
  { id: "rare", chance: 12, mult: 1.7, sell: 12, word: "Gleaming " },
  { id: "epic", chance: 4, mult: 2.2, sell: 30, word: "Cursed " },
  { id: "legendary", chance: 1, mult: 3, sell: 75, word: "Sinful " },
];
const TIER_STAT = [3, 8, 16, 30, 50]; // stat budget of a common item in each tier
// What each slot gives: [attack, defense, hp] per point of budget
const SLOT_PROFILE = {
  weapon: [1.5, 0, 0],
  gloves: [0.6, 0.3, 0],
  ring: [0.5, 0, 3],
  shield: [0, 1.2, 2.25],
  helmet: [0, 0.7, 3],
  chest: [0, 1, 4.5],
  legs: [0, 0.8, 3],
  shoes: [0, 0.5, 1.5],
};
const DUNGEONS = [
  { id: "forest", name: "Whispering Forest", emoji: "🌲", tier: 1, minutes: 10, xp: [40, 60], loot: 0.25, coins: [8, 14], monster: { name: "Dire Wolf", emoji: "🐺", atk: 4, def: 5, hp: 20 } },
  { id: "caves", name: "Goblin Caves", emoji: "🕳️", tier: 2, minutes: 30, xp: [150, 210], loot: 0.3, coins: [25, 40], monster: { name: "Goblin Chief", emoji: "👺", atk: 22, def: 24, hp: 98 } },
  { id: "swamp", name: "Rotting Swamp", emoji: "🐸", tier: 3, minutes: 60, xp: [340, 460], loot: 0.35, coins: [60, 90], monster: { name: "Bog Witch", emoji: "🧙", atk: 48, def: 52, hp: 214 } },
  { id: "mountains", name: "Frostpeak Mountains", emoji: "🏔️", tier: 4, minutes: 120, xp: [750, 1000], loot: 0.4, coins: [150, 220], monster: { name: "Frost Giant", emoji: "🧊", atk: 93, def: 102, hp: 419 } },
  { id: "abyss", name: "Abyss of Sinners", emoji: "😈", tier: 5, minutes: 240, xp: [1700, 2300], loot: 0.45, coins: [380, 520], monster: { name: "Sin Demon", emoji: "👹", atk: 162, def: 179, hp: 730 } },
];
const MATERIALS = ["Wooden", "Iron", "Bogsteel", "Frost", "Abyssal"];
const SLOT_NOUNS = {
  helmet: ["Helmet", "Hood", "Cap"],
  chest: ["Armor", "Tunic", "Plate"],
  legs: ["Greaves", "Leggings", "Pants"],
  shoes: ["Boots", "Treads", "Sandals"],
  gloves: ["Gloves", "Gauntlets", "Wraps"],
  weapon: ["Sword", "Axe", "Mace", "Dagger"],
  shield: ["Shield", "Buckler", "Aegis"],
  ring: ["Ring", "Bracelet", "Band"],
};
// Adventure shop: one uncommon item per slot in each tier, never sold out; sells back for half.
// Higher tiers take weeks to months to reach, and players have earned a lot of points by then.
const GEAR_PRICES = [30, 150, 500, 1500, 4000];
// Potions and scrolls: each purchase adds 3 uses (up to 9), used up by fights / adventures
const EXTRAS = [
  { id: "strength", name: "Potion of Strength", emoji: "🧪", buff: "atk", text: "+25% Attack", price: 30 },
  { id: "ironskin", name: "Iron Skin Potion", emoji: "🪨", buff: "def", text: "+25% Defense", price: 30 },
  { id: "vitality", name: "Vitality Potion", emoji: "❤️", buff: "hp", text: "+25% HP", price: 30 },
  { id: "wisdom", name: "Scroll of Wisdom", emoji: "📜", buff: "xp", text: "+50% XP from adventures", price: 45 },
  { id: "fortune", name: "Scroll of Fortune", emoji: "🍀", buff: "luck", text: "+15% loot chance on adventures", price: 45 },
];
const BUFF_EFFECT = { atk: 0.25, def: 0.25, hp: 0.25, xp: 0.5, luck: 0.15 };
// Potions and scrolls cost more as the adventurer levels up (x1.1 at level 1, x4 at level 30)
const extraPrice = (x, level) => Math.round(x.price * (1 + level / 10));
const extrasFor = (level) => EXTRAS.map((x) => ({ ...x, price: extraPrice(x, level) }));
// Watching streams: a little XP each minute (1 + 1 per 5 levels), up to 2 hours a day
const WATCH_MINUTES_PER_DAY = 120;
const watchXpPerMinute = (level) => 1 + Math.floor(level / 5);
const BUFF_USES = 3;
const BUFF_MAX = 9;
const DUELS_PER_DAY = 10;
const LOOKS = {
  skin: ["#f5d0b5", "#e0ac87", "#c68642", "#8d5524", "#5c3a21"],
  hair: ["#2b1b17", "#6b3f1f", "#d9a441", "#b23b2e", "#e5e7eb", "#3b5bdb", "#db2777"],
  style: [0, 1, 2, 3],
  eyes: ["#1e293b", "#2563eb", "#16a34a", "#7c3aed", "#b45309"],
  shirt: ["#475569", "#7f1d1d", "#14532d", "#1e3a8a", "#78350f", "#581c87"],
  pants: ["#334155", "#3f2d20", "#1f2937", "#3f3f46"],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const xpToNext = (level) => Math.round(80 * Math.pow(level, 1.6));
const tierOpen = (level, tier) => level >= TIER_LEVELS[(tier || 1) - 1];
const rarityOf = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
const powerOf = (s) => Math.round(s.atk + 0.8 * s.def + 0.25 * s.hp);
const baseStats = (level) => ({ atk: 5 + 2 * (level - 1), def: 3 + Math.floor((3 * (level - 1)) / 2), hp: 30 + 6 * (level - 1) });
// Logistic odds on the power ratio: equal = 50%, 30% stronger = about 82%
const winChance = (a, b, lo = 0.05, hi = 0.97) => Math.max(lo, Math.min(hi, 1 / (1 + Math.exp(-5 * (powerOf(a) / powerOf(b) - 1)))));

function randomLook() {
  return Object.fromEntries(Object.entries(LOOKS).map(([k, list]) => [k, pick(list)]));
}

function itemStats(slot, tier, rarity, roll = 1) {
  const budget = TIER_STAT[tier - 1] * rarityOf(rarity).mult * roll;
  const [a, d, h] = SLOT_PROFILE[slot];
  const s = { atk: Math.round(budget * a), def: Math.round(budget * d), hp: Math.round(budget * h) };
  return { ...s, power: powerOf(s) };
}

const HERO_COLUMNS =
  "user_id AS userId, name, look, level, xp, runs, wins, buffs, rating, duel_wins AS duelWins, duel_losses AS duelLosses, " +
  "duel_day AS duelDay, duel_count AS duelCount, exp_dungeon AS expDungeon, exp_start AS expStart, exp_end AS expEnd, exp_stats AS expStats, style";
const ITEM_COLUMNS = "id, slot, name, rarity, power, atk, def, hp, tier, source, icon, sell, equipped, created";

function parseHero(hero) {
  if (!hero) return hero;
  hero.look = JSON.parse(hero.look || "{}");
  hero.buffs = JSON.parse(hero.buffs || "{}");
  hero.style = JSON.parse(hero.style || "{}");
  return hero;
}

async function heroOf(env, user, create = true) {
  let hero = await env.DB.prepare(`SELECT ${HERO_COLUMNS} FROM heroes WHERE user_id = ?`).bind(user.id).first();
  if (!hero && create) {
    await env.DB.prepare("INSERT INTO heroes (user_id, name, look, created) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(user.id, user.name, JSON.stringify(randomLook()), Date.now())
      .run();
    hero = await env.DB.prepare(`SELECT ${HERO_COLUMNS} FROM heroes WHERE user_id = ?`).bind(user.id).first();
  } else if (hero && user.name && hero.name !== user.name) {
    await env.DB.prepare("UPDATE heroes SET name = ? WHERE user_id = ?").bind(user.name, user.id).run();
    hero.name = user.name;
  }
  return parseHero(hero);
}

async function heroLevel(env, userId) {
  const row = await env.DB.prepare("SELECT level FROM heroes WHERE user_id = ?").bind(userId).first();
  return row ? row.level : 1;
}

async function heroItems(env, userId) {
  const { results } = await env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM hero_items WHERE user_id = ? ORDER BY equipped DESC, power DESC, id`)
    .bind(userId)
    .all();
  // Items from before Attack / Defense / HP existed get their stats now
  for (const item of results.filter((i) => !i.atk && !i.def && !i.hp)) {
    Object.assign(item, itemStats(item.slot, item.tier || 1, item.rarity));
    await env.DB.prepare("UPDATE hero_items SET atk = ?, def = ?, hp = ?, power = ? WHERE id = ?")
      .bind(item.atk, item.def, item.hp, item.power, item.id)
      .run();
  }
  return results;
}

// Level + equipped gear; with buffs = the stats used in a fight (potions active)
function heroStats(hero, items, withBuffs = false) {
  const s = baseStats(hero.level);
  items.filter((i) => i.equipped).forEach((i) => ["atk", "def", "hp"].forEach((k) => (s[k] += i[k])));
  if (withBuffs) ["atk", "def", "hp"].forEach((k) => hero.buffs[k] > 0 && (s[k] = Math.round(s[k] * (1 + BUFF_EFFECT[k]))));
  return s;
}

// Uses up one charge of each listed buff that's active
async function useBuffs(env, hero, kinds) {
  let changed = false;
  kinds.forEach((k) => {
    if (hero.buffs[k] > 0) {
      hero.buffs[k] -= 1;
      if (!hero.buffs[k]) delete hero.buffs[k];
      changed = true;
    }
  });
  if (changed) await env.DB.prepare("UPDATE heroes SET buffs = ? WHERE user_id = ?").bind(JSON.stringify(hero.buffs), hero.userId).run();
}

// A blow-by-blow fight that ends the way `aWins` says (the result is decided by winChance first)
function fightLog(a, b, aWins) {
  const hit = (atk, def, boost) => {
    if (Math.random() < 0.1) return { dmg: 0, miss: true };
    const crit = Math.random() < 0.15;
    return { dmg: Math.max(1, Math.round(((atk * atk) / (atk + def)) * (0.5 + Math.random()) * (crit ? 2 : 1) * boost)), crit };
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    // After a few tries, tilt the blows toward the decided winner
    const tilt = attempt < 20 ? 1 : 1 + (attempt - 19) * 0.08;
    const boostA = aWins ? tilt : 1 / tilt;
    const boostB = aWins ? 1 / tilt : tilt;
    let hpA = a.hp;
    let hpB = b.hp;
    const log = [];
    for (let turn = 0; turn < 40 && hpA > 0 && hpB > 0; turn++) {
      const aTurn = turn % 2 === 0;
      const h = aTurn ? hit(a.atk, b.def, boostA) : hit(b.atk, a.def, boostB);
      if (aTurn) hpB = Math.max(0, hpB - h.dmg);
      else hpA = Math.max(0, hpA - h.dmg);
      log.push({ by: aTurn ? "a" : "b", dmg: h.dmg, crit: !!h.crit, miss: !!h.miss, hpA, hpB });
    }
    if (hpA > 0 && hpB > 0) continue;
    if (hpB <= 0 === aWins) return log.length > 24 ? log.slice(-24) : log;
  }
  // Fallback: one decisive blow
  return [{ by: aWins ? "a" : "b", dmg: aWins ? b.hp : a.hp, crit: true, miss: false, hpA: aWins ? a.hp : 0, hpB: aWins ? 0 : b.hp }];
}

async function heroState(env, user) {
  const hero = await heroOf(env, user);
  const items = await heroItems(env, user.id);
  const stats = heroStats(hero, items);
  const fighting = heroStats(hero, items, true);
  const now = Date.now();
  const day = today();
  return {
    hero: {
      name: hero.name,
      look: hero.look,
      style: hero.style,
      level: hero.level,
      xp: hero.xp,
      next: hero.level >= MAX_LEVEL ? null : xpToNext(hero.level),
      base: baseStats(hero.level),
      stats,
      fighting,
      power: powerOf(stats),
      buffs: hero.buffs,
      runs: hero.runs,
      wins: hero.wins,
      rating: hero.rating,
      duelWins: hero.duelWins,
      duelLosses: hero.duelLosses,
      duelsLeft: DUELS_PER_DAY - (hero.duelDay === day ? hero.duelCount : 0),
    },
    items,
    expedition: hero.expDungeon ? { dungeon: hero.expDungeon, start: hero.expStart, end: hero.expEnd, done: now >= hero.expEnd } : null,
    dungeons: DUNGEONS.map((d) => ({
      ...d,
      level: TIER_LEVELS[d.tier - 1],
      open: tierOpen(hero.level, d.tier),
      chance: Math.round(winChance(fighting, d.monster) * 100),
      monsterPower: powerOf(d.monster),
    })),
    extras: extrasFor(hero.level),
    buffEffect: BUFF_EFFECT,
    tiers: TIER_LEVELS,
    bagSize: BAG_SIZE,
    maxLevel: MAX_LEVEL,
    now,
  };
}

// Adds XP and handles level-ups (each new level pays 5 x level points). Returns what changed.
async function addHeroXp(env, userId, amount) {
  const hero = await env.DB.prepare("SELECT level, xp FROM heroes WHERE user_id = ?").bind(userId).first();
  if (!hero || amount <= 0) return { xp: 0, levels: [], reward: 0, level: hero ? hero.level : 1 };
  let { level, xp } = hero;
  xp += amount;
  const levels = [];
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levels.push(level);
  }
  if (level >= MAX_LEVEL) xp = 0;
  const reward = levels.reduce((s, l) => s + l * 5, 0);
  const writes = [env.DB.prepare("UPDATE heroes SET level = ?, xp = ? WHERE user_id = ?").bind(level, xp, userId)];
  if (reward) writes.push(env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(reward, userId));
  await env.DB.batch(writes);
  return { xp: amount, levels, level, reward };
}

function lootItem(tier) {
  let roll = Math.random() * 100;
  const rarity = RARITIES.find((r) => (roll -= r.chance) < 0) || RARITIES[0];
  const slot = pick(SLOTS);
  return {
    slot,
    rarity: rarity.id,
    tier,
    ...itemStats(slot, tier, rarity.id, 0.85 + Math.random() * 0.3),
    name: `${rarity.word}${MATERIALS[tier - 1]} ${pick(SLOT_NOUNS[slot])}`,
    sell: rarity.sell * tier,
  };
}

async function bagCount(env, userId) {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM hero_items WHERE user_id = ? AND equipped = 0").bind(userId).first()).n;
}

async function startDungeon(env, user, dungeonId) {
  const dungeon = DUNGEONS.find((d) => d.id === dungeonId);
  if (!dungeon) fail("Unknown place.", 400);
  const hero = await heroOf(env, user);
  if (hero.expDungeon) fail("Your adventurer is already away. Collect the rewards first.", 409);
  if (!tierOpen(hero.level, dungeon.tier)) fail(`${dungeon.name} unlocks at adventurer level ${TIER_LEVELS[dungeon.tier - 1]}.`, 409);
  const items = await heroItems(env, user.id);
  // Stats and boosts are fixed when they set off
  const snap = { ...heroStats(hero, items, true), xp: hero.buffs.xp > 0 ? BUFF_EFFECT.xp : 0, luck: hero.buffs.luck > 0 ? BUFF_EFFECT.luck : 0 };
  const now = Date.now();
  const end = now + dungeon.minutes * 60000;
  const res = await env.DB.prepare(
    "UPDATE heroes SET exp_dungeon = ?, exp_start = ?, exp_end = ?, exp_stats = ? WHERE user_id = ? AND exp_dungeon IS NULL"
  )
    .bind(dungeon.id, now, end, JSON.stringify(snap), user.id)
    .run();
  if (!res.meta || res.meta.changes !== 1) fail("Your adventurer is already away.", 409);
  await useBuffs(env, hero, ["atk", "def", "hp", "xp", "luck"]);
  return { dungeon, end, chance: Math.round(winChance(snap, dungeon.monster) * 100) };
}

async function collectDungeon(env, user) {
  const hero = await heroOf(env, user);
  if (!hero.expDungeon) fail("Your adventurer isn't on an adventure.", 409);
  const now = Date.now();
  if (now < hero.expEnd) fail(`Still exploring. Back in ${Math.ceil((hero.expEnd - now) / 60000)} min.`, 409);
  // Claim it once, even if two requests arrive together
  const claim = await env.DB.prepare("UPDATE heroes SET exp_dungeon = NULL WHERE user_id = ? AND exp_dungeon = ? AND exp_end = ?")
    .bind(user.id, hero.expDungeon, hero.expEnd)
    .run();
  if (!claim.meta || claim.meta.changes !== 1) fail("Already collected.", 409);

  const dungeon = DUNGEONS.find((d) => d.id === hero.expDungeon) || DUNGEONS[0];
  const snap = JSON.parse(hero.expStats || "null") || baseStats(hero.level);
  const won = Math.random() < winChance(snap, dungeon.monster);
  const log = fightLog(snap, dungeon.monster, won);
  const xp = Math.round((won ? between(...dungeon.xp) : between(...dungeon.xp) * 0.4) * (1 + (snap.xp || 0)));
  await wallet(env, user);
  let item = null;
  let soldFor = 0;
  if (won && Math.random() < dungeon.loot + (snap.luck || 0)) {
    item = lootItem(dungeon.tier);
    if ((await bagCount(env, user.id)) >= BAG_SIZE) {
      soldFor = item.sell; // bag full: sold on the spot
      await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(soldFor, user.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO hero_items (user_id, slot, name, rarity, power, atk, def, hp, tier, source, sell, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'dungeon', ?, ?)"
      )
        .bind(user.id, item.slot, item.name, item.rarity, item.power, item.atk, item.def, item.hp, item.tier, item.sell, now)
        .run();
    }
  }
  // Remember which regions they've beaten (for achievements)
  if (won) await env.DB.prepare("UPDATE heroes SET cleared = cleared || ',' || ? WHERE user_id = ? AND instr(cleared, ?) = 0").bind(dungeon.id, user.id, dungeon.id).run();
  // A win also pays coins; longer, harder regions pay more per hour
  const coins = won ? between(...dungeon.coins) : 0;
  await env.DB.batch([
    env.DB.prepare("UPDATE heroes SET runs = runs + 1, wins = wins + ? WHERE user_id = ?").bind(won ? 1 : 0, user.id),
    env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(coins, user.id),
  ]);
  const gained = await addHeroXp(env, user.id, xp);
  await bumpDaily(env, user.id, { dungeons: 1, dungeon_wins: won ? 1 : 0 });
  // Every adventure also hits the weekly boss (harder regions hit harder; a loss does half)
  const bossDealt = await bossDamage(env, user, (60 + powerOf(snap)) * dungeon.tier * (won ? 1 : 0.5));
  return {
    bossDealt,
    dungeon: { id: dungeon.id, name: dungeon.name, emoji: dungeon.emoji, monster: dungeon.monster },
    me: { name: hero.name, ...snap },
    log,
    won,
    xp,
    coins,
    item,
    soldFor,
    levels: gained.levels,
    level: gained.level,
    reward: gained.reward,
  };
}

// ---------- Arena ----------
// Duel another player's adventurer (they don't need to be online). Ratings use Elo; the attacker's
// potions count, the defender fights with plain stats. 10 duels a day; wins pay a few points.

async function duel(env, user, opponentId) {
  await seasonRollover(env);
  const hero = await heroOf(env, user);
  const day = today();
  const used = hero.duelDay === day ? hero.duelCount : 0;
  if (used >= DUELS_PER_DAY) fail(`You've fought ${DUELS_PER_DAY} duels today. The arena opens again tomorrow.`, 429);
  let foe;
  if (opponentId) {
    if (String(opponentId) === user.id) fail("You can't duel yourself.", 400);
    foe = await env.DB.prepare(`SELECT ${HERO_COLUMNS} FROM heroes WHERE user_id = ?`).bind(String(opponentId)).first();
    if (!foe) fail("That player doesn't have an adventurer yet.", 404);
  } else {
    foe =
      (await env.DB.prepare(`SELECT ${HERO_COLUMNS} FROM heroes WHERE user_id != ? AND rating BETWEEN ? AND ? ORDER BY RANDOM() LIMIT 1`)
        .bind(user.id, hero.rating - 250, hero.rating + 250)
        .first()) ||
      (await env.DB.prepare(`SELECT ${HERO_COLUMNS} FROM heroes WHERE user_id != ? ORDER BY RANDOM() LIMIT 1`).bind(user.id).first());
    if (!foe) fail("Nobody else has an adventurer yet. Invite a friend!", 404);
  }
  parseHero(foe);
  const banned = await env.DB.prepare("SELECT banned FROM users WHERE id = ?").bind(foe.userId).first();
  if (banned && banned.banned) fail("That player can't be challenged.", 403);

  const mine = heroStats(hero, await heroItems(env, user.id), true);
  const theirs = heroStats(foe, await heroItems(env, foe.userId));
  const won = Math.random() < winChance(mine, theirs, 0.05, 0.95);
  const log = fightLog(mine, theirs, won);
  const expected = 1 / (1 + Math.pow(10, (foe.rating - hero.rating) / 400));
  const change = Math.max(1, Math.round(24 * Math.abs((won ? 1 : 0) - expected)));
  const delta = won ? change : -change;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE heroes SET rating = MAX(0, rating + ?), duel_wins = duel_wins + ?, duel_wins_total = duel_wins_total + ?, duel_losses = duel_losses + ?, duel_day = ?, duel_count = ? WHERE user_id = ?`
    ).bind(delta, won ? 1 : 0, won ? 1 : 0, won ? 0 : 1, day, used + 1, user.id),
    env.DB.prepare("UPDATE heroes SET rating = MAX(0, rating - ?), duel_wins = duel_wins + ?, duel_losses = duel_losses + ? WHERE user_id = ?").bind(
      delta,
      won ? 0 : 1,
      won ? 1 : 0,
      foe.userId
    ),
  ]);
  await useBuffs(env, hero, ["atk", "def", "hp"]);
  await bumpDaily(env, user.id, { duels: 1, duel_wins: won ? 1 : 0 });
  const bossDealt = await bossDamage(env, user, 40 + powerOf(mine) / 2);
  const earned = won ? await awardPoints(env, user, 10) : { pointsEarned: 0 };
  const gained = await addHeroXp(env, user.id, won ? 25 : 8);
  return {
    me: { name: hero.name, look: hero.look, style: hero.style, level: hero.level, ...mine },
    foe: { userId: foe.userId, name: foe.name, look: foe.look, style: foe.style, level: foe.level, rating: foe.rating - delta, ...theirs },
    won,
    log,
    rating: hero.rating + delta,
    ratingChange: delta,
    pointsEarned: earned.pointsEarned,
    xp: gained.xp,
    levels: gained.levels,
    level: gained.level,
    duelsLeft: DUELS_PER_DAY - used - 1,
    bossDealt,
  };
}

async function arenaGet(request, env, cors) {
  await seasonRollover(env);
  const { results } = await env.DB.prepare(
    "SELECT h.user_id AS userId, h.name, h.level, h.look, h.rating, h.badge, h.duel_wins AS wins, h.duel_losses AS losses FROM heroes h " +
      "LEFT JOIN users u ON u.id = h.user_id WHERE COALESCE(u.banned, 0) = 0 ORDER BY h.rating DESC, h.level DESC LIMIT 15"
  ).all();
  const badgeOf = (id) => (ACHIEVEMENTS.find((a) => a.id === id) || {}).emoji || null;
  return json({ top: results.map((r) => ({ ...r, badge: badgeOf(r.badge), look: JSON.parse(r.look || "{}") })), season: await seasonInfo(env) }, 200, cors);
}

// ---------- Adventure shop ----------

function gearCatalog(level) {
  return TIER_LEVELS.map((lvl, i) => {
    const tier = i + 1;
    return {
      tier,
      level: lvl,
      open: level >= lvl,
      items: SLOTS.map((slot) => {
        const price = Math.round(GEAR_PRICES[i] * (slot === "weapon" ? 1.4 : 1));
        return { id: `t${tier}-${slot}`, tier, slot, rarity: "uncommon", name: `${MATERIALS[i]} ${SLOT_NOUNS[slot][0]}`, price, sell: Math.floor(price / 2), ...itemStats(slot, tier, "uncommon") };
      }),
    };
  });
}

async function adventureShopGet(request, env, cors) {
  const user = request.headers.get("Authorization") ? await optionalUser(request, env) : null;
  let level = 1;
  let buffs = {};
  let points = null;
  if (user) {
    const hero = await heroOf(env, user);
    level = hero.level;
    buffs = hero.buffs;
    points = (await wallet(env, user)).points;
  }
  return json({ gear: gearCatalog(level), extras: extrasFor(level), buffEffect: BUFF_EFFECT, buffUses: BUFF_USES, buffMax: BUFF_MAX, level, buffs, points, loggedIn: !!user }, 200, cors);
}

async function adventureShopBuy(request, env, cors) {
  const user = await requireUser(request, env);
  const { item: id } = await readJson(request);
  const hero = await heroOf(env, user);
  await wallet(env, user);
  const extra = extrasFor(hero.level).find((e) => e.id === id);
  const gear = extra ? null : gearCatalog(hero.level).flatMap((t) => t.items).find((i) => i.id === id);
  if (!extra && !gear) fail("That item isn't in the shop.", 404);
  if (gear && !tierOpen(hero.level, gear.tier)) fail(`Tier ${gear.tier} unlocks at adventurer level ${TIER_LEVELS[gear.tier - 1]}.`, 409);
  if (gear && (await bagCount(env, user.id)) >= BAG_SIZE) fail("Your bag is full. Sell something on your Profile first.", 409);
  if (extra && (hero.buffs[extra.buff] || 0) + BUFF_USES > BUFF_MAX) fail(`You can hold at most ${BUFF_MAX} uses of ${extra.name}. Use some first.`, 409);
  const price = (extra || gear).price;
  const take = await env.DB.prepare("UPDATE wallets SET points = points - ? WHERE user_id = ? AND points >= ?").bind(price, user.id, price).run();
  if (!take.meta || take.meta.changes !== 1) fail("You don't have enough points for that.", 400);
  if (extra) {
    hero.buffs[extra.buff] = (hero.buffs[extra.buff] || 0) + BUFF_USES;
    await env.DB.prepare("UPDATE heroes SET buffs = ? WHERE user_id = ?").bind(JSON.stringify(hero.buffs), user.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO hero_items (user_id, slot, name, rarity, power, atk, def, hp, tier, source, sell, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop', ?, ?)"
    )
      .bind(user.id, gear.slot, gear.name, gear.rarity, gear.power, gear.atk, gear.def, gear.hp, gear.tier, gear.sell, Date.now())
      .run();
  }
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json({ ok: true, points: w.points, buffs: hero.buffs, bought: extra ? "extra" : "gear" }, 200, cors);
}

// ---------- Watch-time XP ----------
// The Watch page calls this once a minute while a stream is open and the tab is visible. Calls closer
// than 50 seconds apart don't count, and only 2 hours a day earn XP.

async function watchTick(env, user) {
  const hero = await env.DB.prepare("SELECT level, watch_at AS at, watch_day AS day, watch_minutes AS minutes FROM heroes WHERE user_id = ?")
    .bind(user.id)
    .first();
  if (!hero) return { counted: false, reason: "no-hero" };
  const now = Date.now();
  const day = today();
  const minutes = hero.day === day ? hero.minutes : 0;
  const base = { minutesToday: minutes, cap: WATCH_MINUTES_PER_DAY, perMinute: watchXpPerMinute(hero.level) };
  if (minutes >= WATCH_MINUTES_PER_DAY) return { ...base, counted: false, reason: "cap" };
  if (now - (hero.at || 0) < 50000) return { ...base, counted: false, reason: "early" };
  // Claim this minute (a second tab at the same moment won't count twice)
  const claim = await env.DB.prepare(
    "UPDATE heroes SET watch_at = ?, watch_day = ?, watch_minutes = ?, watch_total = watch_total + 1 WHERE user_id = ? AND COALESCE(watch_at, 0) = ?"
  )
    .bind(now, day, minutes + 1, user.id, hero.at || 0)
    .run();
  if (!claim.meta || claim.meta.changes !== 1) return { ...base, counted: false, reason: "early" };
  const gained = await addHeroXp(env, user.id, watchXpPerMinute(hero.level));
  return { ...base, counted: true, minutesToday: minutes + 1, xp: gained.xp, levels: gained.levels, level: gained.level };
}

// ---------- Hero endpoints ----------

async function heroGet(request, env, cors) {
  const user = await requireUser(request, env);
  await wallet(env, user);
  return json(await heroState(env, user), 200, cors);
}

async function heroAction(request, env, cors) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const action = body.action;
  let result = {};

  if (action === "dungeon") result = await startDungeon(env, user, body.dungeon);
  else if (action === "collect") result = await collectDungeon(env, user);
  else if (action === "duel") result = await duel(env, user, body.opponent);
  else if (action === "watch") {
    await wallet(env, user);
    return json(await watchTick(env, user), 200, cors);
  }
  else if (action === "look") {
    await heroOf(env, user);
    await env.DB.prepare("UPDATE heroes SET look = ? WHERE user_id = ?").bind(JSON.stringify(randomLook()), user.id).run();
  } else if (action === "equip" || action === "sell") {
    const item = await env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM hero_items WHERE id = ? AND user_id = ?`)
      .bind(Math.floor(Number(body.item)) || 0, user.id)
      .first();
    if (!item) fail("That item isn't in your bag.", 404);
    if (action === "equip") {
      await env.DB.batch([
        env.DB.prepare("UPDATE hero_items SET equipped = 0 WHERE user_id = ? AND slot = ?").bind(user.id, item.slot),
        env.DB.prepare("UPDATE hero_items SET equipped = 1 WHERE id = ?").bind(item.id),
      ]);
    } else {
      if (item.equipped) fail("Take it off before selling it.", 409);
      await wallet(env, user);
      const del = await env.DB.prepare("DELETE FROM hero_items WHERE id = ? AND user_id = ? AND equipped = 0").bind(item.id, user.id).run();
      if (!del.meta || del.meta.changes !== 1) fail("That item isn't in your bag.", 404);
      await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(item.sell, user.id).run();
      result = { soldFor: item.sell };
    }
  } else if (action === "unequip") {
    if (!SLOTS.includes(body.slot)) fail("Unknown slot.", 400);
    if ((await bagCount(env, user.id)) >= BAG_SIZE) fail("Your bag is full. Sell something first.", 409);
    await env.DB.prepare("UPDATE hero_items SET equipped = 0 WHERE user_id = ? AND slot = ?").bind(user.id, body.slot).run();
  } else fail("Unknown action", 400);

  const achievements = ["collect", "duel", "equip"].includes(action) ? await checkAchievements(env, user.id) : [];
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json({ ...result, achievements, points: w ? w.points : 0, state: await heroState(env, user) }, 200, cors);
}

// The Profile page's numbers
async function profileGet(request, env, cors) {
  const user = await requireUser(request, env);
  const w = await wallet(env, user);
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const [joined, rank, bets, wins, purchases, messages, scores] = await Promise.all([
    one("SELECT created FROM users WHERE id = ?", user.id),
    one("SELECT COUNT(*) AS n FROM wallets WHERE points > ?", w.points),
    one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS staked FROM bets WHERE user_id = ?", user.id),
    one("SELECT COUNT(*) AS n, COALESCE(SUM(payout + bonus - amount), 0) AS profit FROM bets WHERE user_id = ? AND payout > 0", user.id),
    one("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?", user.id),
    one("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND deleted = 0", user.id),
    env.DB.prepare("SELECT game, score FROM scores WHERE user_id = ?").bind(user.id).all(),
  ]);
  return json(
    {
      user,
      joined: joined ? joined.created : null,
      points: w.points,
      rank: rank.n + 1,
      bets: { placed: bets.n, staked: bets.staked, won: wins.n, profit: wins.profit },
      purchases: purchases.n,
      messages: messages.n,
      bests: Object.fromEntries(scores.results.map((s) => [s.game, s.score])),
    },
    200,
    cors
  );
}

// ---------- Daily quests and login streak ----------
// Every day (UTC) each player gets 3 quests picked from QUEST_POOL (the same 3 all day, different per
// player). Progress comes from what they already do: watching (heroes.watch_minutes), games, adventures
// and duels (the "daily" table), bets and chat messages (counted from their tables). Each finished quest
// pays coins and adventurer XP; finishing all 3 opens a bonus chest. Opening the site on a new day
// claims the login streak reward; missing a day starts the streak again.

const QUEST_POOL = [
  { id: "watch20", family: "watch", kind: "watch", target: 20, emoji: "📺", text: "Watch streams for 20 minutes", coins: 40 },
  { id: "watch45", family: "watch", kind: "watch", target: 45, emoji: "📺", text: "Watch streams for 45 minutes", coins: 70 },
  { id: "games3", family: "games", kind: "games", target: 3, emoji: "🎮", text: "Finish 3 mini games", coins: 35 },
  { id: "games6", family: "games", kind: "games", target: 6, emoji: "🎮", text: "Finish 6 mini games", coins: 60 },
  { id: "adv3", family: "adventure", kind: "dungeons", target: 3, emoji: "🗺️", text: "Complete 3 adventures", coins: 50 },
  { id: "advwin2", family: "adventure", kind: "dungeon_wins", target: 2, emoji: "🏆", text: "Win 2 adventures", coins: 50 },
  { id: "duel2", family: "arena", kind: "duels", target: 2, emoji: "🏟️", text: "Fight 2 arena duels", coins: 40 },
  { id: "duelwin1", family: "arena", kind: "duel_wins", target: 1, emoji: "⚔️", text: "Win an arena duel", coins: 45 },
  { id: "bet2", family: "bets", kind: "bets", target: 2, emoji: "🎲", text: "Place 2 bets in Color Clash or Lucky Number", coins: 30 },
  { id: "chat3", family: "chat", kind: "chats", target: 3, emoji: "💬", text: "Send 3 chat messages on Sinners", coins: 30 },
];
const DAILY_COUNTERS = ["games", "dungeons", "dungeon_wins", "duels", "duel_wins", "chats"];
const QUEST_BONUS_COINS = 60;
const levelScale = (level) => 1 + level / 10; // rewards grow with the adventurer's level

// A small seeded random generator, so a player's quests stay the same all day
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function questsFor(userId, day) {
  const rnd = seeded(`${userId}:${day}`);
  const pool = [...QUEST_POOL].sort(() => rnd() - 0.5);
  const picked = [];
  for (const q of pool) {
    if (picked.length < 3 && !picked.some((p) => p.family === q.family)) picked.push(q);
  }
  return picked;
}

// Adds to today's counters, e.g. bumpDaily(env, id, { games: 1 })
async function bumpDaily(env, userId, add) {
  const keys = Object.keys(add).filter((k) => DAILY_COUNTERS.includes(k) && add[k]);
  if (!keys.length) return;
  await env.DB.prepare(
    `INSERT INTO daily (user_id, day, ${keys.join(", ")}) VALUES (?, ?, ${keys.map(() => "?").join(", ")}) ` +
      `ON CONFLICT(user_id, day) DO UPDATE SET ${keys.map((k) => `${k} = ${k} + excluded.${k}`).join(", ")}`
  )
    .bind(userId, today(), ...keys.map((k) => add[k]))
    .run();
}

function streakReward(day) {
  const coins = 20 + 10 * Math.min(day - 1, 6) + (day % 7 === 0 ? 100 : 0);
  return { coins, potion: day % 7 === 0, epic: day === 30 || (day > 30 && day % 30 === 0) };
}

async function dailyState(env, user) {
  const day = today();
  const startOfDay = Date.parse(day + "T00:00:00Z");
  const yesterday = new Date(startOfDay - 86400000).toISOString().slice(0, 10);
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const [row, hero, bets, chats, streak] = await Promise.all([
    one(`SELECT ${DAILY_COUNTERS.join(", ")}, claimed, bonus FROM daily WHERE user_id = ? AND day = ?`, user.id, day),
    one("SELECT level, watch_day AS watchDay, watch_minutes AS watchMinutes FROM heroes WHERE user_id = ?", user.id),
    one("SELECT COUNT(*) AS n FROM bets WHERE user_id = ? AND created >= ?", user.id, startOfDay),
    one("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND created >= ? AND deleted = 0", user.id, startOfDay),
    one("SELECT last_day AS lastDay, streak, best FROM streaks WHERE user_id = ?", user.id),
  ]);
  const level = hero ? hero.level : 1;
  const counts = {
    ...Object.fromEntries(DAILY_COUNTERS.map((k) => [k, row ? row[k] : 0])),
    watch: hero && hero.watchDay === day ? hero.watchMinutes : 0,
    bets: bets.n,
    chats: chats.n + (row ? row.chats : 0), // Sinners chat + messages sent to Twitch from Sinners
  };
  const claimed = String((row && row.claimed) || "");
  const quests = questsFor(user.id, day).map((q, index) => {
    const progress = Math.min(q.target, counts[q.kind] || 0);
    return {
      index,
      id: q.id,
      emoji: q.emoji,
      text: q.text,
      target: q.target,
      progress,
      done: progress >= q.target,
      claimed: claimed.includes(`,${index},`),
      coins: Math.round(q.coins * levelScale(level)),
      xp: Math.round(xpToNext(level) * 0.2),
    };
  });
  const current = streak && (streak.lastDay === day || streak.lastDay === yesterday) ? streak.streak : 0;
  const claimedToday = !!streak && streak.lastDay === day;
  const nextDay = claimedToday ? current : current + 1;
  return {
    day,
    resetsAt: startOfDay + 86400000,
    level,
    quests,
    bonus: {
      coins: Math.round(QUEST_BONUS_COINS * levelScale(level)),
      ready: quests.every((q) => q.claimed),
      claimed: !!(row && row.bonus),
    },
    streak: { current, best: streak ? streak.best : 0, claimedToday, day: nextDay, reward: streakReward(nextDay), hasHero: !!hero },
  };
}

// A random potion or scroll, `uses` times (up to the usual 9)
async function giveRandomBuff(env, user, uses) {
  const hero = await heroOf(env, user);
  const pick = EXTRAS[Math.floor(Math.random() * EXTRAS.length)];
  hero.buffs[pick.buff] = Math.min(BUFF_MAX, (hero.buffs[pick.buff] || 0) + uses);
  await env.DB.prepare("UPDATE heroes SET buffs = ? WHERE user_id = ?").bind(JSON.stringify(hero.buffs), user.id).run();
  return { name: pick.name, emoji: pick.emoji, uses };
}

async function dailyCheckin(env, user) {
  const day = today();
  const yesterday = new Date(Date.parse(day + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const row = await env.DB.prepare("SELECT last_day AS lastDay, streak, best FROM streaks WHERE user_id = ?").bind(user.id).first();
  if (row && row.lastDay === day) fail("You already claimed today's reward. Come back tomorrow!", 409);
  const streak = row && row.lastDay === yesterday ? row.streak + 1 : 1;
  // Claim the day once, even if two requests arrive together
  const claim = row
    ? await env.DB.prepare("UPDATE streaks SET last_day = ?, streak = ?, best = MAX(best, ?) WHERE user_id = ? AND last_day = ?")
        .bind(day, streak, streak, user.id, row.lastDay)
        .run()
    : await env.DB.prepare("INSERT INTO streaks (user_id, last_day, streak, best) VALUES (?, ?, 1, 1) ON CONFLICT DO NOTHING").bind(user.id, day).run();
  if (!claim.meta || claim.meta.changes !== 1) fail("You already claimed today's reward.", 409);

  const reward = streakReward(streak);
  await wallet(env, user);
  await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(reward.coins, user.id).run();
  const out = { streak, coins: reward.coins };
  if (reward.potion) out.potion = await giveRandomBuff(env, user, 3);
  if (reward.epic) {
    const hero = await heroOf(env, user);
    const tier = TIER_LEVELS.filter((l) => hero.level >= l).length;
    let item = lootItem(tier);
    // force it to epic
    item = { ...item, rarity: "epic", ...itemStats(item.slot, tier, "epic"), name: `Cursed ${MATERIALS[tier - 1]} ${SLOT_NOUNS[item.slot][0]}`, sell: 30 * tier };
    if ((await bagCount(env, user.id)) < BAG_SIZE) {
      await env.DB.prepare(
        "INSERT INTO hero_items (user_id, slot, name, rarity, power, atk, def, hp, tier, source, sell, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'streak', ?, ?)"
      )
        .bind(user.id, item.slot, item.name, item.rarity, item.power, item.atk, item.def, item.hp, item.tier, item.sell, Date.now())
        .run();
      out.item = item;
    } else {
      await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(item.sell, user.id).run();
      out.item = { ...item, soldFor: item.sell };
    }
  }
  return out;
}

async function dailyClaim(env, user, index) {
  const state = await dailyState(env, user);
  const q = state.quests[Math.floor(Number(index))];
  if (!q) fail("Unknown quest.", 400);
  if (!q.done) fail("That quest isn't finished yet.", 409);
  if (q.claimed) fail("Already claimed.", 409);
  await env.DB.prepare("INSERT INTO daily (user_id, day) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(user.id, state.day).run();
  const mark = await env.DB.prepare("UPDATE daily SET claimed = claimed || ? WHERE user_id = ? AND day = ? AND instr(claimed, ?) = 0")
    .bind(`,${q.index},`, user.id, state.day, `,${q.index},`)
    .run();
  if (!mark.meta || mark.meta.changes !== 1) fail("Already claimed.", 409);
  await wallet(env, user);
  await heroOf(env, user);
  await env.DB.batch([
    env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(q.coins, user.id),
    env.DB.prepare("UPDATE heroes SET quests_done = quests_done + 1 WHERE user_id = ?").bind(user.id),
  ]);
  const gained = await addHeroXp(env, user.id, q.xp);
  return { quest: q, coins: q.coins, xp: q.xp, levels: gained.levels, level: gained.level };
}

async function dailyBonus(env, user) {
  const state = await dailyState(env, user);
  if (!state.bonus.ready) fail("Finish and claim all 3 quests first.", 409);
  if (state.bonus.claimed) fail("You already opened today's chest.", 409);
  const mark = await env.DB.prepare("UPDATE daily SET bonus = 1 WHERE user_id = ? AND day = ? AND bonus = 0").bind(user.id, state.day).run();
  if (!mark.meta || mark.meta.changes !== 1) fail("You already opened today's chest.", 409);
  await wallet(env, user);
  await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(state.bonus.coins, user.id).run();
  return { coins: state.bonus.coins, potion: await giveRandomBuff(env, user, 2) };
}

async function dailyGet(request, env, cors) {
  const user = await requireUser(request, env);
  return json(await dailyState(env, user), 200, cors);
}

async function dailyAction(request, env, cors) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  let result;
  if (body.action === "checkin") result = await dailyCheckin(env, user);
  else if (body.action === "claim") result = await dailyClaim(env, user, body.index);
  else if (body.action === "bonus") result = await dailyBonus(env, user);
  else fail("Unknown action", 400);
  const achievements = await checkAchievements(env, user.id);
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json({ ...result, achievements, points: w ? w.points : 0, state: await dailyState(env, user) }, 200, cors);
}

// ---------- Weekly world boss ----------
// A new boss every Monday (UTC) for the whole community. Its HP is set when the week's first visitor
// sees it, from how many adventurers exist. Every adventure, duel and Strike (once every 4 hours)
// damages it. If it falls, everyone who hit it can claim a chest, and the top 3 get extra coins and
// gear; if it survives the week, helpers still get a small reward. Last week's rewards can be claimed
// until the end of this week.

const BOSSES = [
  { name: "Abyssal Leviathan", emoji: "🐉" },
  { name: "Crimson Titan", emoji: "🔥" },
  { name: "Lord of Sins", emoji: "👁️" },
  { name: "Bone Colossus", emoji: "💀" },
  { name: "Storm Wyrm", emoji: "⚡" },
  { name: "Broodmother", emoji: "🕷️" },
];
const BOSS_MIN_HP = 15000;
const BOSS_HP_PER_HERO = 4000;
const STRIKE_COOLDOWN_MS = 4 * 3600000;
const BOSS_TOP_REWARDS = [
  { coins: 500, rarity: "epic" },
  { coins: 300, rarity: "rare" },
  { coins: 200, rarity: "rare" },
];

// Monday of the given UTC week, e.g. "2026-10-19"
function weekOf(time = Date.now()) {
  const d = new Date(time);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}
const weekEnds = (week) => Date.parse(week + "T00:00:00Z") + 7 * 86400000;

async function bossOf(env, week = weekOf()) {
  let boss = await env.DB.prepare("SELECT week, name, emoji, hp_max AS hpMax, hp_left AS hpLeft, defeated_at AS defeatedAt FROM bosses WHERE week = ?")
    .bind(week)
    .first();
  if (!boss && week === weekOf()) {
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM heroes").first();
    const pick = BOSSES[Math.floor(Date.parse(week + "T00:00:00Z") / (7 * 86400000)) % BOSSES.length];
    const hp = Math.max(BOSS_MIN_HP, n * BOSS_HP_PER_HERO);
    await env.DB.prepare("INSERT INTO bosses (week, name, emoji, hp_max, hp_left) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(week, pick.name, pick.emoji, hp, hp)
      .run();
    boss = await env.DB.prepare("SELECT week, name, emoji, hp_max AS hpMax, hp_left AS hpLeft, defeated_at AS defeatedAt FROM bosses WHERE week = ?")
      .bind(week)
      .first();
  }
  return boss;
}

// Deals damage to this week's boss; returns the damage done (0 if it's already down)
async function bossDamage(env, user, amount, ctx) {
  amount = Math.max(1, Math.round(amount));
  const boss = await bossOf(env);
  if (!boss || boss.hpLeft <= 0) return 0;
  const hit = await env.DB.prepare("UPDATE bosses SET hp_left = MAX(0, hp_left - ?) WHERE week = ? AND hp_left > 0").bind(amount, boss.week).run();
  if (!hit.meta || hit.meta.changes !== 1) return 0;
  const dealt = Math.min(amount, boss.hpLeft);
  await env.DB.prepare(
    "INSERT INTO boss_hits (week, user_id, name, damage, hits) VALUES (?, ?, ?, ?, 1) " +
      "ON CONFLICT(week, user_id) DO UPDATE SET damage = damage + excluded.damage, hits = hits + 1, name = excluded.name"
  )
    .bind(boss.week, user.id, user.name, dealt)
    .run();
  // The final blow: mark it defeated (once) and tell Discord
  const down = await env.DB.prepare("UPDATE bosses SET defeated_at = ? WHERE week = ? AND hp_left = 0 AND defeated_at IS NULL").bind(Date.now(), boss.week).run();
  if (down.meta && down.meta.changes === 1) {
    later(ctx, discordNotify(env, {
      title: `${boss.emoji} The ${boss.name} has fallen!`,
      description: `${user.name} dealt the final blow. Everyone who fought can claim their rewards on their Profile or with \`/boss status\`.`,
      url: `${SITE_URL}/profile#boss`,
    }));
  }
  return dealt;
}

async function bossState(env, user) {
  const week = weekOf();
  const boss = await bossOf(env, week);
  const { results: top } = await env.DB.prepare("SELECT user_id AS userId, name, damage, hits FROM boss_hits WHERE week = ? ORDER BY damage DESC LIMIT 10")
    .bind(week)
    .all();
  const { n: fighters } = await env.DB.prepare("SELECT COUNT(*) AS n FROM boss_hits WHERE week = ?").bind(week).first();
  const out = { boss: { ...boss, endsAt: weekEnds(week) }, top, fighters, strikeCooldown: STRIKE_COOLDOWN_MS };
  if (user) {
    const mine = await env.DB.prepare("SELECT damage, hits, last_strike AS lastStrike, claimed FROM boss_hits WHERE week = ? AND user_id = ?").bind(week, user.id).first();
    const rank = mine ? (await env.DB.prepare("SELECT COUNT(*) AS n FROM boss_hits WHERE week = ? AND damage > ?").bind(week, mine.damage).first()).n + 1 : null;
    out.me = {
      damage: mine ? mine.damage : 0,
      hits: mine ? mine.hits : 0,
      rank,
      nextStrike: mine && mine.lastStrike ? mine.lastStrike + STRIKE_COOLDOWN_MS : 0,
      canClaim: !!(mine && boss.defeatedAt && !mine.claimed && mine.damage > 0),
      claimed: !!(mine && mine.claimed),
    };
    // Last week's rewards that weren't claimed yet
    const lastWeek = weekOf(Date.parse(week + "T00:00:00Z") - 86400000);
    const old = await env.DB.prepare("SELECT damage, claimed FROM boss_hits WHERE week = ? AND user_id = ?").bind(lastWeek, user.id).first();
    if (old && !old.claimed && old.damage > 0) out.me.lastWeek = lastWeek;
  }
  return out;
}

async function bossStrike(env, user, ctx) {
  const hero = await heroOf(env, user);
  const week = weekOf();
  const boss = await bossOf(env, week);
  if (boss.hpLeft <= 0) fail(`The ${boss.name} is already defeated. Claim your rewards!`, 409);
  const mine = await env.DB.prepare("SELECT last_strike AS lastStrike FROM boss_hits WHERE week = ? AND user_id = ?").bind(week, user.id).first();
  const now = Date.now();
  if (mine && mine.lastStrike && now - mine.lastStrike < STRIKE_COOLDOWN_MS) {
    fail(`You can strike again in ${Math.ceil((mine.lastStrike + STRIKE_COOLDOWN_MS - now) / 60000)} min.`, 429);
  }
  // Mark the strike first, so two clicks at once count once
  await env.DB.prepare("INSERT INTO boss_hits (week, user_id, name) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").bind(week, user.id, user.name).run();
  const mark = await env.DB.prepare("UPDATE boss_hits SET last_strike = ? WHERE week = ? AND user_id = ? AND COALESCE(last_strike, 0) = ?")
    .bind(now, week, user.id, (mine && mine.lastStrike) || 0)
    .run();
  if (!mark.meta || mark.meta.changes !== 1) fail("Too fast! Try again in a moment.", 429);
  const stats = heroStats(hero, await heroItems(env, user.id), true);
  const crit = Math.random() < 0.15;
  const dmg = (100 + powerOf(stats) * 2) * (0.8 + Math.random() * 0.4) * (crit ? 2 : 1);
  const dealt = await bossDamage(env, user, dmg, ctx);
  return { dealt, crit, nextStrike: now + STRIKE_COOLDOWN_MS };
}

async function bossClaim(env, user, week) {
  week = week || weekOf();
  const boss = await bossOf(env, week);
  if (!boss) fail("No boss that week.", 404);
  const current = week === weekOf();
  if (current && !boss.defeatedAt) fail(`The ${boss.name} is still standing. Keep fighting!`, 409);
  const mine = await env.DB.prepare("SELECT damage FROM boss_hits WHERE week = ? AND user_id = ?").bind(week, user.id).first();
  if (!mine || mine.damage <= 0) fail("You didn't fight this boss.", 409);
  const mark = await env.DB.prepare("UPDATE boss_hits SET claimed = 1 WHERE week = ? AND user_id = ? AND claimed = 0").bind(week, user.id).run();
  if (!mark.meta || mark.meta.changes !== 1) fail("You already claimed these rewards.", 409);

  const hero = await heroOf(env, user);
  await wallet(env, user);
  const out = { boss: { name: boss.name, emoji: boss.emoji }, defeated: !!boss.defeatedAt };
  if (!boss.defeatedAt) {
    // It survived the week: a small thank-you
    out.coins = 50;
  } else {
    const rank = (await env.DB.prepare("SELECT COUNT(*) AS n FROM boss_hits WHERE week = ? AND damage > ?").bind(week, mine.damage).first()).n + 1;
    const top = BOSS_TOP_REWARDS[rank - 1];
    out.rank = rank;
    out.coins = Math.round(150 * levelScale(hero.level)) + (top ? top.coins : 0);
    if (top) out.achievement = await grantAchievement(env, user.id, "bosstop");
    out.potion = await giveRandomBuff(env, user, 3);
    if (top) {
      const tier = TIER_LEVELS.filter((l) => hero.level >= l).length;
      const base = lootItem(tier);
      const r = rarityOf(top.rarity);
      const item = { ...base, rarity: r.id, ...itemStats(base.slot, tier, r.id), name: `${r.word}${MATERIALS[tier - 1]} ${SLOT_NOUNS[base.slot][0]}`, sell: r.sell * tier };
      if ((await bagCount(env, user.id)) < BAG_SIZE) {
        await env.DB.prepare(
          "INSERT INTO hero_items (user_id, slot, name, rarity, power, atk, def, hp, tier, source, sell, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'boss', ?, ?)"
        )
          .bind(user.id, item.slot, item.name, item.rarity, item.power, item.atk, item.def, item.hp, item.tier, item.sell, Date.now())
          .run();
        out.item = item;
      } else {
        out.coins += item.sell;
        out.item = { ...item, soldFor: item.sell };
      }
    }
  }
  await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(out.coins, user.id).run();
  return out;
}

async function bossGet(request, env, cors) {
  const user = request.headers.get("Authorization") ? await optionalUser(request, env) : null;
  return json(await bossState(env, user), 200, cors);
}

async function bossAction(request, env, cors, ctx) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  let result;
  if (body.action === "strike") result = await bossStrike(env, user, ctx);
  else if (body.action === "claim") result = await bossClaim(env, user, body.week);
  else fail("Unknown action", 400);
  const achievements = await checkAchievements(env, user.id);
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json({ ...result, achievements, points: w ? w.points : 0, state: await bossState(env, user) }, 200, cors);
}

// ---------- Achievements and badges ----------
// Earned automatically from what players do (checked when they open their profile and after games,
// adventures, duels, quests and boss fights). Each pays coins once. One earned achievement (or season
// title) can be shown as a badge next to the player's name in chat, the arena and the boss board.

const ACHIEVEMENTS = [
  { id: "welcome", emoji: "👋", name: "Welcome, Sinner", text: "Log in to Sinners", coins: 25, check: (s) => s.joined },
  { id: "lvl5", emoji: "🌱", name: "Rookie Adventurer", text: "Reach adventurer level 5", coins: 50, check: (s) => s.level >= 5, progress: (s) => [s.level, 5] },
  { id: "lvl10", emoji: "🗡️", name: "Seasoned Adventurer", text: "Reach adventurer level 10", coins: 100, check: (s) => s.level >= 10, progress: (s) => [s.level, 10] },
  { id: "lvl20", emoji: "🛡️", name: "Veteran", text: "Reach adventurer level 20", coins: 250, check: (s) => s.level >= 20, progress: (s) => [s.level, 20] },
  { id: "lvl30", emoji: "👑", name: "Living Legend", text: "Reach adventurer level 30", coins: 500, check: (s) => s.level >= 30, progress: (s) => [s.level, 30] },
  { id: "wins10", emoji: "🐺", name: "Monster Hunter", text: "Win 10 adventures", coins: 75, check: (s) => s.wins >= 10, progress: (s) => [s.wins, 10] },
  { id: "wins100", emoji: "⚔️", name: "Slayer", text: "Win 100 adventures", coins: 300, check: (s) => s.wins >= 100, progress: (s) => [s.wins, 100] },
  { id: "abyss", emoji: "😈", name: "Demon Slayer", text: "Beat the Sin Demon in the Abyss", coins: 500, check: (s) => s.cleared.includes("abyss") },
  { id: "duel10", emoji: "🏟️", name: "Gladiator", text: "Win 10 arena duels", coins: 100, check: (s) => s.duelWins >= 10, progress: (s) => [s.duelWins, 10] },
  { id: "rating1200", emoji: "🏆", name: "Arena Elite", text: "Reach 1200 arena rating", coins: 250, check: (s) => s.rating >= 1200, progress: (s) => [s.rating, 1200] },
  { id: "streak7", emoji: "🔥", name: "On Fire", text: "Keep a 7-day login streak", coins: 100, check: (s) => s.bestStreak >= 7, progress: (s) => [s.bestStreak, 7] },
  { id: "streak30", emoji: "☄️", name: "Unstoppable", text: "Keep a 30-day login streak", coins: 500, check: (s) => s.bestStreak >= 30, progress: (s) => [s.bestStreak, 30] },
  { id: "quests30", emoji: "📋", name: "Questmaster", text: "Finish 30 daily quests", coins: 200, check: (s) => s.quests >= 30, progress: (s) => [s.quests, 30] },
  { id: "boss1", emoji: "👹", name: "Boss Fighter", text: "Hit a world boss", coins: 50, check: (s) => s.bossFights >= 1 },
  { id: "bosstop", emoji: "🥇", name: "Boss Slayer", text: "Finish top 3 on a defeated world boss", coins: 300, check: () => false },
  { id: "games50", emoji: "🎮", name: "Gamer", text: "Finish 50 mini games", coins: 100, check: (s) => s.games >= 50, progress: (s) => [s.games, 50] },
  { id: "watch600", emoji: "📺", name: "Couch Sinner", text: "Watch streams for 10 hours on Sinners", coins: 150, check: (s) => s.watch >= 600, progress: (s) => [s.watch, 600] },
  { id: "legendary", emoji: "🟠", name: "Legendary Find", text: "Own a legendary item", coins: 300, check: (s) => s.legendary },
  { id: "abyssal", emoji: "🔴", name: "Abyssal Lord", text: "Wear 5 Abyssal (tier 5) items at once", coins: 500, check: (s) => s.tier5Worn >= 5, progress: (s) => [s.tier5Worn, 5] },
  { id: "rich", emoji: "💰", name: "High Roller", text: "Have 10,000 points at once", coins: 200, check: (s) => s.points >= 10000, progress: (s) => [s.points, 10000] },
  { id: "clip", emoji: "🎬", name: "Clip of the Week", text: "Share the week's most-voted clip", coins: 0, check: () => false },
  { id: "champion", emoji: "👑", name: "Season Champion", text: "Finish an arena season in 1st place", coins: 0, check: () => false },
  { id: "podium", emoji: "🎖️", name: "Season Podium", text: "Finish an arena season in the top 3", coins: 0, check: () => false },
];

async function achievementStats(env, userId) {
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const [w, h, streak, quests, boss, games, items] = await Promise.all([
    one("SELECT points FROM wallets WHERE user_id = ?", userId),
    one("SELECT level, wins, rating, duel_wins_total AS duelWins, cleared, watch_total AS watch FROM heroes WHERE user_id = ?", userId),
    one("SELECT best FROM streaks WHERE user_id = ?", userId),
    one("SELECT quests_done AS n FROM heroes WHERE user_id = ?", userId),
    one("SELECT COUNT(*) AS n FROM boss_hits WHERE user_id = ? AND damage > 0", userId),
    one("SELECT COALESCE(SUM(games), 0) AS n FROM daily WHERE user_id = ?", userId),
    one(
      "SELECT SUM(CASE WHEN rarity = 'legendary' THEN 1 ELSE 0 END) AS legendary, SUM(CASE WHEN equipped = 1 AND tier >= 5 THEN 1 ELSE 0 END) AS t5 FROM hero_items WHERE user_id = ?",
      userId
    ),
  ]);
  return {
    joined: !!w,
    points: w ? w.points : 0,
    level: h ? h.level : 0,
    wins: h ? h.wins : 0,
    rating: h ? h.rating : 0,
    duelWins: h ? h.duelWins : 0,
    cleared: h ? String(h.cleared || "").split(",") : [],
    watch: h ? h.watch : 0,
    bestStreak: streak ? streak.best : 0,
    quests: quests ? quests.n : 0,
    bossFights: boss.n,
    games: games.n,
    legendary: !!(items && items.legendary),
    tier5Worn: (items && items.t5) || 0,
  };
}

// Gives an achievement once (with its coins); returns it if it's new
async function grantAchievement(env, userId, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return null;
  const add = await env.DB.prepare("INSERT INTO achievements (user_id, id, earned) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").bind(userId, id, Date.now()).run();
  if (!add.meta || add.meta.changes !== 1) return null;
  if (a.coins) await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(a.coins, userId).run();
  return { id: a.id, emoji: a.emoji, name: a.name, coins: a.coins };
}

// Checks every achievement and gives the new ones; returns what was just earned
async function checkAchievements(env, userId) {
  const s = await achievementStats(env, userId);
  const { results } = await env.DB.prepare("SELECT id FROM achievements WHERE user_id = ?").bind(userId).all();
  const have = new Set(results.map((r) => r.id));
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!have.has(a.id) && a.check(s)) {
      const got = await grantAchievement(env, userId, a.id);
      if (got) fresh.push(got);
    }
  }
  return fresh;
}

async function achievementsState(env, userId) {
  const s = await achievementStats(env, userId);
  const { results } = await env.DB.prepare("SELECT id, earned FROM achievements WHERE user_id = ?").bind(userId).all();
  const earned = Object.fromEntries(results.map((r) => [r.id, r.earned]));
  const hero = await env.DB.prepare("SELECT badge FROM heroes WHERE user_id = ?").bind(userId).first();
  return {
    badge: hero ? hero.badge : null,
    list: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      emoji: a.emoji,
      name: a.name,
      text: a.text,
      coins: a.coins,
      earned: earned[a.id] || null,
      progress: !earned[a.id] && a.progress ? a.progress(s).map((n) => Math.max(0, Math.min(n, a.progress(s)[1]))) : null,
    })),
  };
}

// Badge emoji and name color shown next to a player's name
async function nameStyle(env, userId) {
  const h = await env.DB.prepare("SELECT badge, style FROM heroes WHERE user_id = ?").bind(userId).first();
  if (!h) return { badge: null, color: null };
  const a = ACHIEVEMENTS.find((x) => x.id === h.badge);
  const style = JSON.parse(h.style || "{}");
  return { badge: a ? a.emoji : null, color: style.color || null };
}

// ---------- Cosmetics ----------
// Looks only (no stats): hats and capes drawn on the adventurer, a pet next to them, and a name color
// in chat. Bought once in the Shop's Cosmetics tab, then worn or taken off on the Profile.

const COSMETICS = [
  { id: "hat-horns", kind: "hat", name: "Devil Horns", emoji: "😈", price: 600 },
  { id: "hat-wizard", kind: "hat", name: "Wizard Hat", emoji: "🧙", price: 800 },
  { id: "hat-halo", kind: "hat", name: "Halo", emoji: "😇", price: 1000 },
  { id: "hat-crown", kind: "hat", name: "Golden Crown", emoji: "👑", price: 1500 },
  { id: "cape-red", kind: "cape", name: "Crimson Cape", emoji: "🟥", price: 700 },
  { id: "cape-purple", kind: "cape", name: "Royal Cape", emoji: "🟪", price: 900 },
  { id: "cape-gold", kind: "cape", name: "Golden Cape", emoji: "🟨", price: 1800 },
  { id: "pet-slime", kind: "pet", name: "Slime", emoji: "🟢", price: 800 },
  { id: "pet-fox", kind: "pet", name: "Fox", emoji: "🦊", price: 1200 },
  { id: "pet-ghost", kind: "pet", name: "Ghost", emoji: "👻", price: 1500 },
  { id: "pet-dragon", kind: "pet", name: "Baby Dragon", emoji: "🐲", price: 2500 },
  { id: "color-gold", kind: "color", name: "Gold Name", emoji: "✨", price: 800 },
  { id: "color-toxic", kind: "color", name: "Toxic Name", emoji: "☢️", price: 1000 },
  { id: "color-ice", kind: "color", name: "Ice Name", emoji: "❄️", price: 1200 },
  { id: "color-fire", kind: "color", name: "Fire Name", emoji: "🔥", price: 1500 },
  { id: "color-rainbow", kind: "color", name: "Rainbow Name", emoji: "🌈", price: 2500 },
];

async function cosmeticsState(env, userId) {
  const { results } = await env.DB.prepare("SELECT id FROM cosmetics WHERE user_id = ?").bind(userId).all();
  const h = await env.DB.prepare("SELECT style FROM heroes WHERE user_id = ?").bind(userId).first();
  return { owned: results.map((r) => r.id), style: h ? JSON.parse(h.style || "{}") : {} };
}

async function cosmeticBuy(env, user, id) {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c) fail("That cosmetic isn't in the shop.", 404);
  await heroOf(env, user);
  await wallet(env, user);
  const owned = await env.DB.prepare("SELECT 1 FROM cosmetics WHERE user_id = ? AND id = ?").bind(user.id, id).first();
  if (owned) fail("You already own that.", 409);
  const take = await env.DB.prepare("UPDATE wallets SET points = points - ? WHERE user_id = ? AND points >= ?").bind(c.price, user.id, c.price).run();
  if (!take.meta || take.meta.changes !== 1) fail("You don't have enough points for that.", 400);
  await env.DB.prepare("INSERT INTO cosmetics (user_id, id, created) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").bind(user.id, id, Date.now()).run();
  await cosmeticWear(env, user, id); // wear it right away
  return c;
}

// Wears a cosmetic (or takes off a kind when id is "none:<kind>")
async function cosmeticWear(env, user, id) {
  const hero = await env.DB.prepare("SELECT style FROM heroes WHERE user_id = ?").bind(user.id).first();
  const style = JSON.parse((hero && hero.style) || "{}");
  if (String(id).startsWith("none:")) {
    delete style[id.slice(5)];
  } else {
    const c = COSMETICS.find((x) => x.id === id);
    if (!c) fail("Unknown cosmetic.", 404);
    const owned = await env.DB.prepare("SELECT 1 FROM cosmetics WHERE user_id = ? AND id = ?").bind(user.id, id).first();
    if (!owned) fail("Buy it in the Shop first.", 409);
    style[c.kind] = c.kind === "color" ? c.id.slice(6) : c.id;
  }
  await env.DB.prepare("UPDATE heroes SET style = ? WHERE user_id = ?").bind(JSON.stringify(style), user.id).run();
  return style;
}

// ---------- Arena seasons ----------
// A season is a calendar month (UTC). The first arena visit of a new month closes the last one: the
// top 3 by rating (with at least 5 duels) get coins and a title, everyone with 10+ duels gets a little,
// ratings move halfway back to 1000 and season records start over.

const SEASON_PRIZES = [1000, 600, 400];
const seasonOf = (time = Date.now()) => new Date(time).toISOString().slice(0, 7);
const seasonEnds = (season) => Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5, 7)), 1);

async function seasonRollover(env) {
  const now = seasonOf();
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'season'").first();
  if (!row) {
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('season', ?) ON CONFLICT DO NOTHING").bind(now).run();
    return;
  }
  if (row.value === now) return;
  // Only one request closes the season
  const claim = await env.DB.prepare("UPDATE meta SET value = ? WHERE key = 'season' AND value = ?").bind(now, row.value).run();
  if (!claim.meta || claim.meta.changes !== 1) return;
  const { results: top } = await env.DB.prepare(
    "SELECT user_id AS userId, name, rating FROM heroes WHERE duel_wins + duel_losses >= 5 ORDER BY rating DESC, level DESC LIMIT 3"
  ).all();
  const writes = [];
  top.forEach((p, i) => {
    writes.push(
      env.DB.prepare("INSERT INTO season_results (season, rank, user_id, name, rating) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(row.value, i + 1, p.userId, p.name, p.rating),
      env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(SEASON_PRIZES[i], p.userId)
    );
  });
  writes.push(env.DB.prepare("UPDATE wallets SET points = points + 100 WHERE user_id IN (SELECT user_id FROM heroes WHERE duel_wins + duel_losses >= 10)"));
  writes.push(env.DB.prepare("UPDATE heroes SET rating = 1000 + (rating - 1000) / 2, duel_wins = 0, duel_losses = 0"));
  await env.DB.batch(writes);
  for (const [i, p] of top.entries()) {
    await grantAchievement(env, p.userId, "podium");
    if (i === 0) await grantAchievement(env, p.userId, "champion");
  }
}

async function seasonInfo(env) {
  const season = seasonOf();
  const { results: last } = await env.DB.prepare(
    "SELECT season, rank, name, rating FROM season_results WHERE season = (SELECT MAX(season) FROM season_results) ORDER BY rank"
  ).all();
  return { id: season, endsAt: seasonEnds(season), prizes: SEASON_PRIZES, last };
}

// ---------- Watch parties ----------
// Logged-in viewers of the same stream see each other (a heartbeat every ~30 s) and can send emoji
// reactions that float over the video for everyone watching. Rooms are the same as chat rooms.

const PARTY_EMOJIS = ["🔥", "😂", "😮", "👏", "💀", "❤️", "🎉", "😡"];

async function partyGet(room, request, url, env, cors) {
  checkRoom(room);
  const now = Date.now();
  if (url.searchParams.get("beat") === "1" && request.headers.get("Authorization")) {
    const user = await optionalUser(request, env);
    if (user) {
      await env.DB.prepare(
        "INSERT INTO party (room, user_id, name, avatar, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(room, user_id) DO UPDATE SET seen = excluded.seen, name = excluded.name, avatar = excluded.avatar"
      )
        .bind(room, user.id, user.name, user.avatar, now)
        .run();
    }
  }
  const since = Math.max(Number(url.searchParams.get("since")) || 0, now - 15000);
  const [{ results: watchers }, { results: reactions }] = await Promise.all([
    env.DB.prepare("SELECT name, avatar FROM party WHERE room = ? AND seen > ? ORDER BY seen DESC LIMIT 24").bind(room, now - 75000).all(),
    env.DB.prepare("SELECT emoji, created FROM reactions WHERE room = ? AND created > ? ORDER BY created LIMIT 40").bind(room, since).all(),
  ]);
  if (Math.random() < 0.02) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM reactions WHERE created < ?").bind(now - 120000),
      env.DB.prepare("DELETE FROM party WHERE seen < ?").bind(now - 3600000),
    ]);
  }
  return json({ watchers, reactions, now }, 200, cors);
}

async function partyReact(room, request, env, cors) {
  checkRoom(room);
  const user = await requireUser(request, env);
  const { emoji } = await readJson(request);
  if (!PARTY_EMOJIS.includes(emoji)) fail("Pick one of the reactions.", 400);
  const now = Date.now();
  // At most one reaction a second per viewer
  const ok = await env.DB.prepare(
    "INSERT INTO party (room, user_id, name, avatar, seen, last_react) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(room, user_id) DO UPDATE SET last_react = excluded.last_react, seen = excluded.seen WHERE COALESCE(party.last_react, 0) < ?"
  )
    .bind(room, user.id, user.name, user.avatar, now, now, now - 1000)
    .run();
  if (!ok.meta || ok.meta.changes !== 1) fail("Slow down a little.", 429);
  await env.DB.prepare("INSERT INTO reactions (room, emoji, created) VALUES (?, ?, ?)").bind(room, emoji, now).run();
  return json({ ok: true }, 200, cors);
}

// ---------- Clip of the Week ----------
// Logged-in viewers vote for one gallery clip a week (they can change it). The first visit of a new week
// crowns last week's most-voted clip; whoever shared it (if they were logged in) gets coins.

const CLIP_PRIZE = 300;

async function clipRollover(env) {
  const week = weekOf();
  const lastWeek = weekOf(Date.parse(week + "T00:00:00Z") - 86400000);
  const done = await env.DB.prepare("SELECT 1 FROM clip_winners WHERE week = ?").bind(lastWeek).first();
  if (done) return;
  const top = await env.DB.prepare("SELECT item_id AS id, COUNT(*) AS votes FROM clip_votes WHERE week = ? GROUP BY item_id ORDER BY votes DESC LIMIT 1")
    .bind(lastWeek)
    .first();
  if (!top) return;
  const item = (await getList(env, "approved")).find((i) => i.id === top.id);
  if (!item) return;
  const add = await env.DB.prepare(
    "INSERT INTO clip_winners (week, item_id, votes, title, link, thumb, platform, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING"
  )
    .bind(lastWeek, item.id, top.votes, item.title || "", item.link || item.url || "", item.thumb || "", item.platform || "", item.name || "")
    .run();
  if (add.meta && add.meta.changes === 1 && item.userId) {
    await env.DB.prepare("UPDATE wallets SET points = points + ? WHERE user_id = ?").bind(CLIP_PRIZE, item.userId).run();
    await grantAchievement(env, item.userId, "clip");
  }
}

async function clipVotesGet(request, env, cors) {
  await clipRollover(env);
  const week = weekOf();
  const { results } = await env.DB.prepare("SELECT item_id AS id, COUNT(*) AS votes FROM clip_votes WHERE week = ? GROUP BY item_id").bind(week).all();
  const user = request.headers.get("Authorization") ? await optionalUser(request, env) : null;
  const mine = user ? await env.DB.prepare("SELECT item_id AS id FROM clip_votes WHERE week = ? AND user_id = ?").bind(week, user.id).first() : null;
  const winner = await env.DB.prepare("SELECT week, item_id AS id, votes, title, link, thumb, platform, name FROM clip_winners ORDER BY week DESC LIMIT 1").first();
  return json({ week, endsAt: weekEnds(week), votes: Object.fromEntries(results.map((r) => [r.id, r.votes])), mine: mine ? mine.id : null, winner, prize: CLIP_PRIZE }, 200, cors);
}

async function clipVote(request, env, cors) {
  const user = await requireUser(request, env);
  const { id } = await readJson(request);
  const item = (await getList(env, "approved")).find((i) => i.id === id && i.kind !== "image" && i.platform);
  if (!item) fail("That clip isn't in the gallery.", 404);
  await env.DB.prepare(
    "INSERT INTO clip_votes (week, user_id, item_id, created) VALUES (?, ?, ?, ?) ON CONFLICT(week, user_id) DO UPDATE SET item_id = excluded.item_id, created = excluded.created"
  )
    .bind(weekOf(), user.id, id, Date.now())
    .run();
  return clipVotesGet(request, env, cors);
}

// ---------- Profile extras: achievements, badge, cosmetics ----------

async function profileExtrasGet(request, env, cors) {
  const user = await requireUser(request, env);
  const fresh = await checkAchievements(env, user.id);
  return json({ achievements: await achievementsState(env, user.id), cosmetics: await cosmeticsState(env, user.id), catalog: COSMETICS, fresh }, 200, cors);
}

async function profileExtrasAction(request, env, cors) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  let result = {};
  if (body.action === "badge") {
    const id = body.badge || null;
    if (id) {
      const has = await env.DB.prepare("SELECT 1 FROM achievements WHERE user_id = ? AND id = ?").bind(user.id, id).first();
      if (!has) fail("Earn that achievement first.", 409);
    }
    await heroOf(env, user);
    await env.DB.prepare("UPDATE heroes SET badge = ? WHERE user_id = ?").bind(id, user.id).run();
  } else if (body.action === "buy") result = { bought: await cosmeticBuy(env, user, body.id) };
  else if (body.action === "wear") result = { style: await cosmeticWear(env, user, body.id) };
  else fail("Unknown action", 400);
  const w = await env.DB.prepare("SELECT points FROM wallets WHERE user_id = ?").bind(user.id).first();
  return json(
    { ...result, points: w ? w.points : 0, achievements: await achievementsState(env, user.id), cosmetics: await cosmeticsState(env, user.id), catalog: COSMETICS },
    200,
    cors
  );
}

// ---------- Linked accounts (chat as yourself on Twitch and Kick) ----------
// A player whose account has Twitch or Kick connected can type in the Watch page's Twitch or Kick chat,
// and the message is sent as them through the official APIs (Twitch Helix "Send Chat Message", Kick
// POST /public/v1/chat). Their tokens are kept encrypted (AES-GCM, key from SESSION_SECRET) and never
// sent to the browser. Reading happens in the browser (Twitch's public chat connection, Kick's embed).
// Kick needs the scopes user:read chat:write; logins made before that connect Kick once more.
// Setup: a Twitch app at dev.twitch.tv with the redirect URL <this Worker>/auth/twitch/callback, and the
// Worker variables TWITCH_CLIENT_ID (Text) and TWITCH_CLIENT_SECRET (Secret).

const LINK_PLATFORMS = ["discord", "twitch", "kick"];
const TWITCH_SCOPES = "user:write:chat";
const SEND_GAP_MS = 1200;

async function tokenKey(env) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`link-tokens:${env.SESSION_SECRET}`));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sealToken(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(env), new TextEncoder().encode(text)));
  return `${b64url(iv)}.${b64url(data)}`;
}

async function openToken(env, sealed) {
  const [iv, data] = String(sealed || "").split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await tokenKey(env), fromB64url(data));
  return new TextDecoder().decode(plain);
}

// Step 1 (logged in, from the page): a short-lived signed link to start linking
async function linkStart(request, env, cors) {
  const user = await requireUser(request, env);
  const { platform, back } = await readJson(request);
  if (!LINK_PLATFORMS.includes(platform)) fail("That platform can't be linked yet.", 400);
  if (!PROVIDERS[platform].ready(env)) fail(`${platform[0].toUpperCase() + platform.slice(1)} isn't set up yet.`, 503);
  const returnUrl = ALLOWED_ORIGINS.some((o) => String(back || "").startsWith(o + "/")) ? String(back) : `${SITE_URL}/profile`;
  const state = await signToken(env, { kind: "link", platform, userId: user.id, back: returnUrl, exp: Date.now() + 10 * 60000 });
  return json({ url: `${new URL(request.url).origin}/auth/${platform}?state=${encodeURIComponent(state)}` }, 200, cors);
}

const CHAT_TOKEN_URLS = { twitch: "https://id.twitch.tv/oauth2/token", kick: "https://id.kick.com/oauth/token" };
const PLATFORM_NAMES = { twitch: "Twitch", kick: "Kick" };

// The chat link is gone or no longer works: forget it, so the page offers to connect again
async function dropChatLink(env, link) {
  await env.DB.prepare("DELETE FROM linked_accounts WHERE user_id = ? AND platform = ?").bind(link.user_id, link.platform).run();
  fail(`Your ${PLATFORM_NAMES[link.platform]} connection expired. Connect ${PLATFORM_NAMES[link.platform]} again to chat.`, 401);
}

// A working Twitch or Kick access token for this player (refreshed when it's about to expire)
async function chatToken(env, link, force = false) {
  if (!force && link.expires_at > Date.now() + 60000) return openToken(env, link.access_token);
  const id = link.platform === "kick" ? env.KICK_CLIENT_ID : env.TWITCH_CLIENT_ID;
  const secret = link.platform === "kick" ? env.KICK_CLIENT_SECRET : env.TWITCH_CLIENT_SECRET;
  const res = await fetch(CHAT_TOKEN_URLS[link.platform], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "refresh_token", refresh_token: await openToken(env, link.refresh_token) }),
  });
  if (!res.ok) await dropChatLink(env, link);
  const tok = await res.json();
  await env.DB.prepare("UPDATE linked_accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND platform = ?")
    .bind(
      await sealToken(env, tok.access_token),
      await sealToken(env, tok.refresh_token || (await openToken(env, link.refresh_token))),
      Date.now() + (tok.expires_in || 3600) * 1000,
      link.user_id,
      link.platform
    )
    .run();
  return tok.access_token;
}

const twitchIds = new Map(); // channel name -> Twitch user id (per Worker instance)

async function twitchUserId(env, token, login) {
  if (twitchIds.has(login)) return twitchIds.get(login);
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers: { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } });
  const who = res.ok ? ((await res.json()).data || [])[0] : null;
  if (!who) fail("Couldn't find that Twitch channel.", 404);
  twitchIds.set(login, who.id);
  return who.id;
}

const kickIds = new Map(); // channel slug -> Kick broadcaster user id (per Worker instance)

async function kickBroadcasterId(slug) {
  if (!kickIds.has(slug)) kickIds.set(slug, (await kickChannel(slug)).user_id);
  return kickIds.get(slug);
}

// Sends one message as this player. Returns null when the token was refused (so it can be refreshed).
const CHAT_SENDERS = {
  async twitch(env, token, link, channel, message) {
    const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers: { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster_id: await twitchUserId(env, token, channel), sender_id: link.ext_id, message }),
    });
    if (res.status === 401) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) fail(data.message || "Twitch didn't accept that message.", 400);
    const result = (data.data || [])[0] || {};
    if (!result.is_sent) fail((result.drop_reason && result.drop_reason.message) || "Twitch didn't send that message (slow mode, followers-only or a ban?).", 409);
    return true;
  },
  async kick(env, token, link, channel, message) {
    const broadcaster = await kickBroadcasterId(channel);
    const res = await fetch("https://api.kick.com/public/v1/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", broadcaster_user_id: broadcaster, content: message }),
    });
    if (res.status === 401) return null;
    if (res.status === 403) await dropChatLink(env, link); // connected before chatting was allowed
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) fail("Kick says you're sending messages too fast.", 429);
    if (!res.ok) fail(data.message || "Kick didn't accept that message (followers-only, slow mode or a ban?).", 400);
    if (data.data && data.data.is_sent === false) fail("Kick didn't send that message (followers-only, slow mode or a ban?).", 409);
    return true;
  },
};

async function chatSend(request, env, cors) {
  const user = await requireUser(request, env);
  const { platform, channel, text: raw, broadcasterId } = await readJson(request);
  if (!CHAT_SENDERS[platform]) fail("Sending isn't available for that platform.", 400);
  const login = String(channel || "").toLowerCase();
  if (!(platform === "kick" ? /^[a-z0-9_-]{2,30}$/ : /^[a-z0-9_]{3,25}$/).test(login)) fail("Unknown channel.", 400);
  const message = String(raw || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
  if (!message) fail("Type a message first.");
  // The page already knows the Kick channel's owner id, which saves asking Kick for it
  if (platform === "kick" && /^\d{1,12}$/.test(String(broadcasterId || "")) && !kickIds.has(login)) kickIds.set(login, Number(broadcasterId));
  // A small gap between messages (Twitch and Kick have their own limits too), checked alongside the link
  const [link, gap] = await Promise.all([
    env.DB.prepare("SELECT * FROM linked_accounts WHERE user_id = ? AND platform = ?").bind(user.id, platform).first(),
    env.DB.prepare("UPDATE linked_accounts SET last_sent = ? WHERE user_id = ? AND platform = ? AND COALESCE(last_sent, 0) < ?")
      .bind(Date.now(), user.id, platform, Date.now() - SEND_GAP_MS)
      .run(),
  ]);
  if (!link) fail(`Connect your ${PLATFORM_NAMES[platform]} account to chat.`, 409);
  if (!gap.meta || gap.meta.changes !== 1) fail("You're sending messages too fast.", 429);

  const send = CHAT_SENDERS[platform];
  let sent = await send(env, await chatToken(env, link), link, login, message);
  if (!sent) sent = await send(env, await chatToken(env, link, true), link, login, message);
  if (!sent) await dropChatLink(env, link);
  await bumpDaily(env, user.id, { chats: 1 }); // counts for the daily chat quest
  return json({ ok: true, as: link.ext_name }, 200, cors);
}

// Your connected logins (identities) and chat links
async function linksGet(request, env, cors) {
  const user = await requireUser(request, env);
  const [{ results: ids }, { results: chat }] = await Promise.all([
    env.DB.prepare("SELECT provider, name FROM identities WHERE user_id = ? ORDER BY created").bind(user.id).all(),
    env.DB.prepare("SELECT platform, ext_name AS name FROM linked_accounts WHERE user_id = ?").bind(user.id).all(),
  ]);
  return json({ identities: ids, links: chat, available: providerReady(env) }, 200, cors);
}

async function linkRemove(request, env, cors) {
  const user = await requireUser(request, env);
  const { platform } = await readJson(request);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM identities WHERE user_id = ?").bind(user.id).first();
  const has = await env.DB.prepare("SELECT 1 FROM identities WHERE user_id = ? AND provider = ?").bind(user.id, String(platform)).first();
  if (has && n <= 1) fail("That's your only login. Connect another one first, so you can still get in.", 409);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM identities WHERE user_id = ? AND provider = ?").bind(user.id, String(platform)),
    env.DB.prepare("DELETE FROM linked_accounts WHERE user_id = ? AND platform = ?").bind(user.id, String(platform)),
  ]);
  return linksGet(request, env, cors);
}

// ---------- Logins: Discord, Twitch and Kick, all on one Sinners account ----------
// A Sinners account can have several connected logins ("identities"); any of them logs into the same
// account. Logging in with a provider nobody has used makes a new account (id "<provider>:<id>").
// While logged in, more providers can be connected from the Profile; if that provider already had its
// own Sinners account, it's merged into this one. Twitch logins also keep a (encrypted) chat token so
// players can type in Twitch chat on the Watch page.
//   GET /auth/<provider>?return=<page>   log in           GET /auth/<provider>?state=<link>   connect
//   GET /auth/<provider>/callback        back from the provider
// Setup per provider (Worker variables): Discord DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET,
// Twitch TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET, Kick KICK_CLIENT_ID / KICK_CLIENT_SECRET;
// the redirect URL to register with each is <this Worker>/auth/<provider>/callback.

const PROVIDERS = {
  discord: {
    ready: (env) => !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    authorize: (env, redirect, state) =>
      "https://discord.com/oauth2/authorize?" +
      new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, response_type: "code", redirect_uri: redirect, scope: "identify", state, prompt: "none" }),
    async exchange(env, code, redirect) {
      const res = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: redirect }),
      });
      if (!res.ok) return null;
      const tok = await res.json();
      const me = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (!me.ok) return null;
      const u = await me.json();
      return { extId: u.id, name: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : "" };
    },
  },
  twitch: {
    ready: (env) => !!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
    authorize: (env, redirect, state) =>
      "https://id.twitch.tv/oauth2/authorize?" +
      new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: TWITCH_SCOPES, state }),
    async exchange(env, code, redirect) {
      const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirect }),
      });
      if (!res.ok) return null;
      const tok = await res.json();
      const me = await fetch("https://api.twitch.tv/helix/users", { headers: { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: `Bearer ${tok.access_token}` } });
      const u = me.ok ? ((await me.json()).data || [])[0] : null;
      if (!u) return null;
      return { extId: u.id, name: u.display_name || u.login, avatar: u.profile_image_url || "", tokens: tok };
    },
  },
  kick: {
    ready: (env) => !!(env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET),
    pkce: true,
    authorize: (env, redirect, state, challenge) =>
      "https://id.kick.com/oauth/authorize?" +
      new URLSearchParams({
        client_id: env.KICK_CLIENT_ID,
        response_type: "code",
        redirect_uri: redirect,
        scope: "user:read chat:write",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    async exchange(env, code, redirect, verifier) {
      const res = await fetch("https://id.kick.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: env.KICK_CLIENT_ID,
          client_secret: env.KICK_CLIENT_SECRET,
          redirect_uri: redirect,
          code_verifier: verifier,
          code,
        }),
      });
      if (!res.ok) return null;
      const tok = await res.json();
      const me = await fetch("https://api.kick.com/public/v1/users", { headers: { Authorization: `Bearer ${tok.access_token}` } });
      const u = me.ok ? ((await me.json()).data || [])[0] : null;
      if (!u) return null;
      return { extId: String(u.user_id), name: u.name, avatar: u.profile_picture || "", tokens: tok };
    },
  },
};

const providerReady = (env) => Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.ready(env)]));

async function authStart(provider, url, env) {
  const p = PROVIDERS[provider];
  if (!p || !p.ready(env) || !env.SESSION_SECRET) return text(`${provider[0].toUpperCase() + provider.slice(1)} login isn't set up yet.`, 503, {});
  let data;
  if (url.searchParams.get("state")) {
    // Connecting another login to the account you're in (made by /link/start)
    data = await verifyToken(env, url.searchParams.get("state"));
    if (!data || data.kind !== "link" || data.platform !== provider) return text("This link expired. Go back to Sinners and try again.", 400, {});
  } else {
    const back = url.searchParams.get("return") || "";
    if (!ALLOWED_ORIGINS.some((o) => back.startsWith(`${o}/`))) return text("Bad return address", 400, {});
    data = { kind: "login", platform: provider, back, exp: Date.now() + 10 * 60000 };
  }
  let challenge;
  if (p.pkce) {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    data = { ...data, pv: await sealToken(env, verifier) }; // kept secret inside the state
  }
  const state = await signToken(env, data);
  return Response.redirect(p.authorize(env, `${url.origin}/auth/${provider}/callback`, state, challenge), 302);
}

async function authCallback(provider, url, env) {
  const p = PROVIDERS[provider];
  const state = await verifyToken(env, url.searchParams.get("state") || "");
  if (!p || !state || state.platform !== provider) return text("This login expired. Go back to Sinners and try again.", 400, {});
  const linking = state.kind === "link";
  const back = (hash) => Response.redirect(`${state.back.split("#")[0]}#${hash}`, 302);
  const code = url.searchParams.get("code");
  if (!code) return back(linking ? "linked=cancelled" : "login=cancelled");
  const who = await p.exchange(env, code, `${url.origin}/auth/${provider}/callback`, state.pv ? await openToken(env, state.pv) : undefined);
  if (!who) return back(linking ? "linked=failed" : "login=failed");
  if (!env.DB) return text("Storage isn't set up yet (DB binding missing).", 503, {});
  await ensureSchema(env);
  const name = clean(who.name, 32) || `${provider} user`;
  const owner = await env.DB.prepare("SELECT user_id FROM identities WHERE provider = ? AND ext_id = ?").bind(provider, who.extId).first();

  let userId;
  if (linking) {
    userId = state.userId;
    // That login already had its own account: fold it into this one
    if (owner && owner.user_id !== userId) await mergeAccount(env, owner.user_id, userId);
  } else {
    userId = owner ? owner.user_id : `${provider}:${who.extId}`;
  }
  const banned = await env.DB.prepare("SELECT banned FROM users WHERE id = ?").bind(userId).first();
  if (banned && banned.banned) return back("login=banned");
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO identities (provider, ext_id, user_id, name, avatar, created) VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(provider, ext_id) DO UPDATE SET user_id = excluded.user_id, name = excluded.name, avatar = excluded.avatar"
    ).bind(provider, who.extId, userId, name, who.avatar, Date.now()),
    env.DB.prepare("INSERT INTO users (id, name, avatar, banned, created) VALUES (?, ?, ?, 0, ?) ON CONFLICT(id) DO NOTHING").bind(userId, name, who.avatar, Date.now()),
  ]);
  if (who.tokens) await saveChatTokens(env, provider, userId, who.extId, name, who.tokens);
  if (linking) return back(`linked=${provider}`);

  // Logging in: the name and picture of the login they used
  await env.DB.prepare("UPDATE users SET name = ?, avatar = ? WHERE id = ?").bind(name, who.avatar, userId).run();
  const session = await signToken(env, { id: userId, name, avatar: who.avatar, via: provider, exp: Date.now() + SESSION_DAYS * 86400000 });
  return back(`session=${session}`);
}

// Twitch and Kick logins keep a chat token (encrypted) so the Watch page can send messages as them
async function saveChatTokens(env, platform, userId, extId, name, tok) {
  await env.DB.prepare(
    "INSERT INTO linked_accounts (user_id, platform, ext_id, ext_name, access_token, refresh_token, expires_at, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, platform) DO UPDATE SET ext_id = excluded.ext_id, ext_name = excluded.ext_name, access_token = excluded.access_token, " +
      "refresh_token = excluded.refresh_token, expires_at = excluded.expires_at"
  )
    .bind(userId, platform, extId, name, await sealToken(env, tok.access_token), await sealToken(env, tok.refresh_token || ""), Date.now() + (tok.expires_in || 3600) * 1000, Date.now())
    .run();
}

// ---------- Site stats ----------
// Every open tab sends a heartbeat once a minute (only while it's visible), plus one "view" per page
// opened. A visitor is a random ID the browser makes for itself; no IP, account or device data is kept.
// "Online" = tabs heard from in the last 90 seconds. Daily totals are kept; the per-visitor rows that
// make daily unique counts possible are deleted after two days.

const STAT_PAGES = ["index", "watch", "content", "games", "gallery", "about", "stats", "profile", "shop", "terms", "privacy", "admin"];
const ONLINE_MS = 90000;
const VISITOR_ID = /^[a-f0-9-]{36}$/;

async function onlineCounts(env) {
  const { results } = await env.DB.prepare("SELECT page, COUNT(*) AS n FROM presence WHERE seen > ? GROUP BY page")
    .bind(Date.now() - ONLINE_MS)
    .all();
  const pages = Object.fromEntries(results.map((r) => [r.page, r.n]));
  return { online: results.reduce((sum, r) => sum + r.n, 0), pages };
}

async function presence(request, env, cors) {
  const { visitor, page: rawPage, view } = await readJson(request);
  if (!VISITOR_ID.test(String(visitor))) fail("Bad visitor", 400);
  const page = STAT_PAGES.includes(rawPage) ? rawPage : "index";
  const now = Date.now();
  const day = today();
  const writes = [
    env.DB.prepare("INSERT INTO presence (visitor, page, seen) VALUES (?, ?, ?) ON CONFLICT(visitor) DO UPDATE SET page = excluded.page, seen = excluded.seen").bind(
      visitor,
      page,
      now
    ),
  ];
  if (view && page !== "admin") {
    const first = await env.DB.prepare("INSERT INTO day_visitors (day, visitor) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(day, visitor).run();
    const isNew = first.meta && first.meta.changes === 1 ? 1 : 0;
    writes.push(
      env.DB.prepare(
        "INSERT INTO site_days (day, views, visitors) VALUES (?, 1, ?) ON CONFLICT(day) DO UPDATE SET views = views + 1, visitors = visitors + ?"
      ).bind(day, isNew, isNew),
      env.DB.prepare("INSERT INTO site_pages (day, page, views) VALUES (?, ?, 1) ON CONFLICT(day, page) DO UPDATE SET views = views + 1").bind(day, page)
    );
  }
  // Now and then, tidy up rows that aren't needed anymore
  if (Math.random() < 0.02) {
    writes.push(
      env.DB.prepare("DELETE FROM presence WHERE seen < ?").bind(now - 3600000),
      env.DB.prepare("DELETE FROM day_visitors WHERE day < ?").bind(new Date(now - 2 * 86400000).toISOString().slice(0, 10))
    );
  }
  await env.DB.batch(writes);
  const { online } = await onlineCounts(env);
  // Only writes when it's a new high for the day
  await env.DB.prepare("UPDATE site_days SET peak = ? WHERE day = ? AND peak < ?").bind(online, day, online).run();
  return json({ online }, 200, cors);
}

async function siteStats(env) {
  const day = today();
  const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const { results: days } = await env.DB.prepare("SELECT day, views, visitors, peak FROM site_days WHERE day >= ? ORDER BY day").bind(since).all();
  // All 7 days, including ones without visits
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
    const row = days.find((r) => r.day === d);
    return { day: d, views: row ? row.views : 0, visitors: row ? row.visitors : 0, peak: row ? row.peak : 0 };
  });
  const { results: topPages } = await env.DB.prepare("SELECT page, views FROM site_pages WHERE day = ? ORDER BY views DESC LIMIT 6").bind(day).all();
  const all = await env.DB.prepare("SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(visitors), 0) AS visitors, MIN(day) AS since FROM site_days").first();
  const startOfDay = Date.parse(day + "T00:00:00Z");
  const count = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).first()).n;
  const approved = env.GALLERY ? (await getList(env, "approved")).length : 0;

  return {
    ...(await onlineCounts(env)),
    today: week[6],
    week,
    weekTotals: { views: week.reduce((s, d) => s + d.views, 0), visitors: week.reduce((s, d) => s + d.visitors, 0) },
    allTime: all,
    topPages,
    community: {
      players: await count("SELECT COUNT(*) AS n FROM wallets"),
      chatMessages: await count("SELECT COUNT(*) AS n FROM messages WHERE deleted = 0"),
      chatToday: await count("SELECT COUNT(*) AS n FROM messages WHERE deleted = 0 AND created >= ?", startOfDay),
      gamesPlayed: await count("SELECT COUNT(*) AS n FROM scores"),
      betsToday: await count("SELECT COUNT(*) AS n FROM bets WHERE created >= ?", startOfDay),
      pointsTotal: await count("SELECT COALESCE(SUM(points), 0) AS n FROM wallets"),
      purchases: await count("SELECT COUNT(*) AS n FROM purchases"),
      galleryItems: approved,
    },
  };
}

// ---------- Discord bot ----------
// Slash commands are sent by Discord to /discord/interactions as signed HTTP requests, so the bot needs no
// server of its own. Players log in to the site with Discord, so a Discord user ID is also their site
// account: /points works for anyone who has logged in once. Messages the bot posts by itself (shop
// purchases, gallery links) go to the channel picked with /notify-here, using DISCORD_BOT_TOKEN.
// To add a command: add it to BOT_COMMANDS, handle it in botCommand(), then press "Register commands"
// on the admin page.

const SITE_URL = "https://sinnerstv.com";
const DISCORD_API = "https://discord.com/api/v10";
const BOT_COLOR = 0xe11d48;
const ADMINISTRATOR = 0x8; // admin-only commands need Discord's Administrator permission
const isAdmin = (interaction) => !!interaction.guild_id && (BigInt((interaction.member && interaction.member.permissions) || 0) & BigInt(ADMINISTRATOR)) !== 0n;
const BOARD_CHOICES = [
  { name: "Most points", value: "points" },
  { name: "Quick Draw", value: "reaction" },
  { name: "Target Rush", value: "aim" },
  { name: "Chat Typer", value: "typing" },
];
const BOARD_FORMAT = {
  reaction: ["⚡ Quick Draw", (v) => `${Math.round(v)} ms`],
  aim: ["🎯 Target Rush", (v) => `${v} hits`],
  typing: ["⌨️ Chat Typer", (v) => `${v} words`],
};

const DUNGEON_CHOICES = [
  { name: "🌲 Whispering Forest (level 1, 10 min)", value: "forest" },
  { name: "🕳️ Goblin Caves (level 5, 30 min)", value: "caves" },
  { name: "🐸 Rotting Swamp (level 10, 1 h)", value: "swamp" },
  { name: "🏔️ Frostpeak Mountains (level 20, 2 h)", value: "mountains" },
  { name: "😈 Abyss of Sinners (level 30, 4 h)", value: "abyss" },
];
const BOARD_KEY = "discord:statsboard";
const BOARD_INTERVALS = [
  { name: "5 minutes", value: 5 },
  { name: "15 minutes", value: 15 },
  { name: "1 hour", value: 60 },
  { name: "6 hours", value: 360 },
  { name: "Once a day", value: 1440 },
];

const BOT_COMMANDS = [
  {
    name: "boss",
    description: "This week's world boss: see it, strike it, claim rewards",
    options: [
      { type: 1, name: "status", description: "The boss, its HP, top damage dealers (and claims your rewards if it's down)" },
      { type: 1, name: "strike", description: "Hit the boss (once every 4 hours)" },
    ],
  },
  { name: "daily", description: "Claim your daily streak reward and finished quests, and see today's quests" },
  {
    name: "duel",
    description: "Fight another player's adventurer in the Sinners arena",
    options: [{ type: 6, name: "opponent", description: "Who to fight (a random opponent near your rating if empty)" }],
  },
  {
    name: "dungeon",
    description: "Your Sinners adventurer: check on them, send them out, collect rewards",
    options: [
      { type: 1, name: "status", description: "Your adventurer, gear and current adventure" },
      {
        type: 1,
        name: "go",
        description: "Send your adventurer to a region",
        options: [{ type: 3, name: "place", description: "Where to go", required: true, choices: DUNGEON_CHOICES }],
      },
      { type: 1, name: "collect", description: "Collect the rewards from a finished adventure" },
    ],
  },
  {
    name: "stats",
    description: "Sinners site report: visitors, players, games, betting, chat, shop (admins)",
    default_member_permissions: String(ADMINISTRATOR),
    dm_permission: false,
  },
  { name: "help", description: "How Sinners and this bot work: commands, adventure, arena, games, shop" },
  { name: "points", description: "Show someone's Sinners points", options: [{ type: 6, name: "user", description: "Whose points (you if empty)" }] },
  { name: "top", description: "Sinners leaderboards", options: [{ type: 3, name: "board", description: "Which leaderboard", choices: BOARD_CHOICES }] },
  { name: "shop", description: "What's in the Sinners shop" },
  {
    name: "round",
    description: "The current betting round and recent results",
    options: [{ type: 3, name: "game", description: "Which game", choices: [{ name: "Color Clash", value: "colors" }, { name: "Lucky Number", value: "lucky" }] }],
  },
  { name: "sinners", description: "Links to the Sinners website" },
  {
    name: "stats-live",
    description: "Keep a site report in this channel that updates by itself",
    default_member_permissions: String(ADMINISTRATOR),
    dm_permission: false,
    options: [
      { type: 4, name: "every", description: "How often to update (default 5 minutes)", choices: BOARD_INTERVALS },
      {
        type: 3,
        name: "mode",
        description: "Update one message, or post a new report each time",
        choices: [
          { name: "Keep one message updated", value: "edit" },
          { name: "Post a new report each time", value: "post" },
        ],
      },
    ],
  },
  { name: "stats-live-off", description: "Stop the self-updating site report", default_member_permissions: String(ADMINISTRATOR), dm_permission: false },
  { name: "notify-here", description: "Post shop purchases and new gallery links in this channel", default_member_permissions: String(ADMINISTRATOR), dm_permission: false },
  { name: "notify-off", description: "Stop posting site notifications", default_member_permissions: String(ADMINISTRATOR), dm_permission: false },
];

function later(ctx, promise) {
  const safe = promise.catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(safe);
  return safe;
}

function hexBytes(hex) {
  return new Uint8Array((String(hex).match(/../g) || []).map((h) => parseInt(h, 16)));
}

// Discord signs every request; anything that doesn't verify must get a 401
async function discordVerified(request, env, body) {
  const sig = request.headers.get("X-Signature-Ed25519");
  const time = request.headers.get("X-Signature-Timestamp");
  if (!sig || !time || !env.DISCORD_PUBLIC_KEY) return false;
  const data = new TextEncoder().encode(time + body);
  try {
    const key = await crypto.subtle.importKey("raw", hexBytes(env.DISCORD_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexBytes(sig), data);
  } catch (e) {
    // Older Workers runtimes name it differently
    try {
      const alg = { name: "NODE-ED25519", namedCurve: "NODE-ED25519" };
      const key = await crypto.subtle.importKey("raw", hexBytes(env.DISCORD_PUBLIC_KEY), alg, false, ["verify"]);
      return await crypto.subtle.verify(alg, key, hexBytes(sig), data);
    } catch (e2) {
      return false;
    }
  }
}

function botReply(content, { embeds, ephemeral } = {}) {
  return json({ type: 4, data: { content: content || undefined, embeds, flags: ephemeral ? 64 : undefined, allowed_mentions: { parse: [] } } }, 200, {});
}

function embed(fields) {
  return { color: BOT_COLOR, footer: { text: "sinnerstv.com" }, ...fields };
}

async function discordInteraction(request, env, ctx) {
  const body = await request.text();
  if (!(await discordVerified(request, env, body))) return text("Bad signature", 401, {});
  const interaction = JSON.parse(body);
  if (interaction.type === 1) return json({ type: 1 }, 200, {}); // Discord checking the endpoint
  // A button on the /help guide: show that topic in the same message
  if (interaction.type === 3 && String((interaction.data || {}).custom_id).startsWith("help:")) {
    return json({ type: 7, data: helpMessage(interaction.data.custom_id.slice(5), isAdmin(interaction)) }, 200, {});
  }
  if (interaction.type !== 2) return botReply("Unknown interaction.", { ephemeral: true });
  const name = interaction.data.name;
  if (name === "help") return json({ type: 4, data: helpMessage("home", isAdmin(interaction)) }, 200, {});
  if (!env.DB) return botReply("The site's storage isn't set up yet.", { ephemeral: true });
  const adminOnly = ["stats", "stats-live", "stats-live-off", "notify-here", "notify-off"].includes(name);
  if (adminOnly && !isAdmin(interaction)) return botReply("🔒 Only server admins can do that.", { ephemeral: true });

  // Discord needs an answer within 3 seconds: say "thinking…" right away, then fill in the real
  // message when it's ready (database work can take longer, especially on a cold start)
  const origin = new URL(request.url).origin;
  later(
    ctx,
    editOriginal(env, interaction, async () => {
      await ensureSchema(env);
      if (name === "stats") return statsReport(env, interaction);
      const res = name === "stats-live" || name === "stats-live-off" ? await statsLiveCommand(interaction, env, ctx) : await botCommand(interaction, env, origin);
      const { data } = await res.json();
      delete data.flags; // a follow-up can't change who sees the message
      return data;
    })
  );
  return json({ type: 5, data: adminOnly ? { flags: 64 } : {} }, 200, {});
}

async function botCommand(interaction, env, origin) {
  const { name, options = [], resolved = {} } = interaction.data;
  const opt = (key) => (options.find((o) => o.name === key) || {}).value;
  const caller = (interaction.member && interaction.member.user) || interaction.user || {};

  if (name === "dungeon") {
    const user = await discordPlayer(env, caller);
    if (user.error) return botReply(user.error, { ephemeral: true });
    const sub = options[0] || { name: "status", options: [] };
    const RARITY_DOT = { common: "⚪", uncommon: "🟢", rare: "🔵", epic: "🟣", legendary: "🟠" };
    await wallet(env, user);
    try {
      if (sub.name === "go") {
        const place = ((sub.options || [])[0] || {}).value;
        const r = await startDungeon(env, user, place);
        return botReply(null, {
          embeds: [embed({
            title: `${r.dungeon.emoji} ${user.name} set off for ${r.dungeon.name}`,
            description: `Back <t:${Math.floor(r.end / 1000)}:R> · ${r.chance}% chance to win.\nUse \`/dungeon collect\` when they're back.`,
            url: `${SITE_URL}/profile`,
          })],
        });
      }
      if (sub.name === "collect") {
        const r = await collectDungeon(env, user);
        const lines = [
          r.won ? `🏆 **Beat the ${r.dungeon.monster.name}!** +${r.xp} XP · +${r.coins} 🪙` : `💀 **The ${r.dungeon.monster.name} won…** but they learned something: +${r.xp} XP`,
        ];
        if (r.item)
          lines.push(
            r.soldFor
              ? `Found ${RARITY_DOT[r.item.rarity]} **${r.item.name}**, but the bag was full, so it was sold for ${r.soldFor} 🪙`
              : `Found ${RARITY_DOT[r.item.rarity]} **${r.item.name}** (${r.item.rarity} ${r.item.slot}: ${statText(r.item)})`
          );
        else if (r.won) lines.push("No loot this time.");
        if (r.levels.length) lines.push(`⬆️ **Level ${r.level}!** +${r.reward} 🪙`);
        return botReply(null, { embeds: [embed({ title: `${r.dungeon.emoji} ${user.name} is back from ${r.dungeon.name}`, description: lines.join("\n"), url: `${SITE_URL}/profile` })] });
      }
    } catch (err) {
      return botReply(`⚠️ ${err.message}`, { ephemeral: true });
    }
    const s = await heroState(env, user);
    const h = s.hero;
    const worn = s.items.filter((i) => i.equipped);
    const buffs = Object.entries(h.buffs).map(([k, n]) => `${(s.extras.find((e) => e.buff === k) || {}).emoji || "✨"}×${n}`).join(" ");
    const away = s.expedition && DUNGEONS.find((d) => d.id === s.expedition.dungeon);
    const bar = h.next ? "▰".repeat(Math.round((h.xp / h.next) * 10)).padEnd(10, "▱") : "MAX";
    return botReply(null, {
      embeds: [embed({
        title: `⚔️ ${h.name} · level ${h.level}`,
        url: `${SITE_URL}/profile`,
        description:
          `${bar} ${h.next ? `${h.xp} / ${h.next} XP` : ""}\n⚔️ **${h.stats.atk}** ATK · 🛡️ **${h.stats.def}** DEF · ❤️ **${h.stats.hp}** HP · 💪 power ${h.power}\n` +
          `🏆 ${h.wins}/${h.runs} adventures won · 🏟️ arena ${h.rating} (${h.duelWins}W ${h.duelLosses}L)${buffs ? `\nActive boosts: ${buffs}` : ""}\n` +
          (away
            ? s.expedition.done
              ? `${away.emoji} Back from ${away.name}! Use \`/dungeon collect\`.`
              : `${away.emoji} Exploring ${away.name}, back <t:${Math.floor(s.expedition.end / 1000)}:R>`
            : "🏕️ Resting. Send them out with `/dungeon go`."),
        fields: [
          { name: "Gear", value: worn.length ? worn.map((i) => `${RARITY_DOT[i.rarity] || "⚪"} ${i.name}`).join("\n") : "Nothing equipped yet", inline: true },
          { name: "Regions", value: s.dungeons.map((d) => `${d.open ? d.emoji : "🔒"} ${d.name}${d.open ? ` · ${d.chance}%` : ` · level ${d.level}`}`).join("\n"), inline: true },
        ],
      })],
    });
  }

  if (name === "boss") {
    const user = await discordPlayer(env, caller);
    if (user.error) return botReply(user.error, { ephemeral: true });
    await wallet(env, user);
    const lines = [];
    const sub = (options[0] || {}).name || "status";
    try {
      if (sub === "strike") {
        const r = await bossStrike(env, user);
        lines.push(`⚔️ ${user.name} strikes for **${r.dealt.toLocaleString()}** damage${r.crit ? " (critical!)" : ""}! Next strike <t:${Math.floor(r.nextStrike / 1000)}:R>.`);
      }
    } catch (err) {
      lines.push(`⚠️ ${err.message}`);
    }
    let s = await bossState(env, user);
    // Claim rewards (this week's if it's down, and last week's if they were left)
    for (const week of [s.me.lastWeek, s.me.canClaim ? s.boss.week : null].filter(Boolean)) {
      try {
        const c = await bossClaim(env, user, week);
        lines.push(
          `🎁 ${c.boss.emoji} ${c.boss.name} rewards: +${c.coins} 🪙` +
            (c.rank ? ` (#${c.rank} damage)` : "") +
            (c.potion ? ` · ${c.potion.emoji} ${c.potion.name} ×${c.potion.uses}` : "") +
            (c.item ? ` · ${c.item.name}${c.item.soldFor ? " (sold, bag full)" : ""}` : "")
        );
      } catch (err) {}
    }
    s = await bossState(env, user);
    const b = s.boss;
    const pct = b.hpLeft / b.hpMax;
    const bar = "█".repeat(Math.round(pct * 14)).padEnd(14, "░");
    const medals = ["🥇", "🥈", "🥉"];
    return botReply(null, {
      embeds: [
        embed({
          title: `${b.emoji} ${b.name}${b.defeatedAt ? " · DEFEATED" : ""}`,
          url: `${SITE_URL}/profile#boss`,
          description:
            (lines.length ? `${lines.join("\n")}\n\n` : "") +
            `\`${bar}\` ${b.hpLeft.toLocaleString()} / ${b.hpMax.toLocaleString()} HP\n` +
            (b.defeatedAt ? "Everyone who fought can claim rewards." : `${s.fighters} fighters · escapes <t:${Math.floor(b.endsAt / 1000)}:R>`) +
            `\nYour damage: **${s.me.damage.toLocaleString()}**${s.me.rank ? ` (#${s.me.rank})` : ""}` +
            (!b.defeatedAt ? (s.me.nextStrike > Date.now() ? ` · next strike <t:${Math.floor(s.me.nextStrike / 1000)}:R>` : " · `/boss strike` is ready!") : ""),
          fields: [
            {
              name: "Top damage",
              value: s.top.length ? s.top.slice(0, 5).map((p, i) => `${medals[i] || `${i + 1}.`} ${p.name} · ${p.damage.toLocaleString()}`).join("\n") : "Nobody has hit it yet. Be the first!",
            },
          ],
        }),
      ],
    });
  }

  if (name === "daily") {
    const user = await discordPlayer(env, caller);
    if (user.error) return botReply(user.error, { ephemeral: true });
    await wallet(env, user);
    const got = [];
    // Check in, claim finished quests and the chest, all in one go
    let s = await dailyState(env, user);
    if (!s.streak.claimedToday) {
      const c = await dailyCheckin(env, user);
      got.push(`🔥 Day ${c.streak} streak: +${c.coins} 🪙${c.potion ? ` and ${c.potion.emoji} ${c.potion.name} ×${c.potion.uses}` : ""}${c.item ? ` and a ${c.item.name}!` : ""}`);
    }
    for (const q of s.quests.filter((x) => x.done && !x.claimed)) {
      const r = await dailyClaim(env, user, q.index);
      got.push(`${q.emoji} ${q.text}: +${r.coins} 🪙 +${r.xp} XP${r.levels.length ? ` ⬆️ level ${r.level}!` : ""}`);
    }
    s = await dailyState(env, user);
    if (s.bonus.ready && !s.bonus.claimed) {
      const b = await dailyBonus(env, user);
      got.push(`🎁 Bonus chest: +${b.coins} 🪙 and ${b.potion.emoji} ${b.potion.name} ×${b.potion.uses}`);
      s = await dailyState(env, user);
    }
    const bar = (q) => "▰".repeat(Math.round((q.progress / q.target) * 8)).padEnd(8, "▱");
    return botReply(null, {
      embeds: [
        embed({
          title: `📅 ${user.name}'s daily · 🔥 ${s.streak.current} day streak`,
          url: `${SITE_URL}/profile#daily`,
          description: (got.length ? `**Claimed just now**\n${got.join("\n")}\n\n` : "") + `Best streak: ${s.streak.best} day${s.streak.best === 1 ? "" : "s"} · new quests <t:${Math.floor(s.resetsAt / 1000)}:R>`,
          fields: [
            {
              name: "Today's quests",
              value: s.quests
                .map((q) => `${q.claimed ? "✅" : q.emoji} ${q.text}\n${bar(q)} ${q.progress}/${q.target} · 🪙 ${q.coins} + ${q.xp} XP`)
                .join("\n"),
            },
            { name: "Bonus chest", value: s.bonus.claimed ? "✅ Opened" : `Finish all 3 for 🪙 ${s.bonus.coins} and a potion` },
          ],
        }),
      ],
    });
  }

  if (name === "duel") {
    const user = await discordPlayer(env, caller);
    if (user.error) return botReply(user.error, { ephemeral: true });
    await wallet(env, user);
    let r;
    try {
      const foeRow = opt("opponent") ? await env.DB.prepare("SELECT user_id FROM identities WHERE provider = 'discord' AND ext_id = ?").bind(String(opt("opponent"))).first() : null;
      r = await duel(env, user, opt("opponent") && (foeRow ? foeRow.user_id : `discord:${opt("opponent")}`));
    } catch (err) {
      return botReply(`⚠️ ${err.message}`, { ephemeral: true });
    }
    const crits = r.log.filter((l) => l.crit && l.by === (r.won ? "a" : "b")).length;
    const last = r.log[r.log.length - 1];
    return botReply(null, {
      embeds: [
        embed({
          title: `🏟️ ${r.me.name} vs ${r.foe.name}`,
          url: `${SITE_URL}/profile#arena`,
          description:
            `${r.won ? `🏆 **${r.me.name} wins!**` : `💀 **${r.foe.name} wins!**`} after ${r.log.length} blows` +
            (crits ? ` (${crits} critical hit${crits === 1 ? "" : "s"})` : "") +
            `. Final blow: ${last.dmg} damage${last.crit ? " (critical!)" : ""}.\n` +
            `Rating ${r.ratingChange > 0 ? "+" : ""}${r.ratingChange} → **${r.rating}**` +
            (r.pointsEarned ? ` · +${r.pointsEarned} 🪙` : "") +
            ` · +${r.xp} XP${r.levels.length ? ` · ⬆️ level ${r.level}!` : ""}\n${r.duelsLeft} duels left today`,
          fields: [
            { name: `⚔️ ${r.me.name} (Lv ${r.me.level})`, value: `${r.me.atk} ATK · ${r.me.def} DEF · ${r.me.hp} HP`, inline: true },
            { name: `🛡️ ${r.foe.name} (Lv ${r.foe.level})`, value: `${r.foe.atk} ATK · ${r.foe.def} DEF · ${r.foe.hp} HP`, inline: true },
          ],
        }),
      ],
    });
  }

  if (name === "points") {
    const raw = opt("user") || caller.id;
    const idRow = await env.DB.prepare("SELECT user_id FROM identities WHERE provider = 'discord' AND ext_id = ?").bind(String(raw)).first();
    const id = idRow ? idRow.user_id : `discord:${raw}`;
    const discordUser = (resolved.users && resolved.users[raw]) || caller;
    const label = discordUser.global_name || discordUser.username || "That player";
    const w = await env.DB.prepare("SELECT points, earned_day AS day, earned_today AS today FROM wallets WHERE user_id = ?").bind(id).first();
    if (!w) return botReply(`${label} hasn't played on Sinners yet. Log in at ${SITE_URL}/games to get 100 free points.`, { ephemeral: !opt("user") });
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM wallets WHERE points > ?").bind(w.points).first();
    const earned = w.day === today() ? w.today : 0;
    return botReply(null, {
      embeds: [
        embed({
          title: `🪙 ${label}: ${w.points} points`,
          description: `Rank #${n + 1} on the points list · earned today ${earned} / ${DAILY_CAP}`,
          url: `${SITE_URL}/games`,
        }),
      ],
    });
  }

  if (name === "top") {
    const board = opt("board") || "points";
    let title, rows;
    if (board === "points") {
      title = "🪙 Most points";
      const { results } = await env.DB.prepare("SELECT name, points FROM wallets ORDER BY points DESC LIMIT 10").all();
      rows = results.map((r) => [r.name, `${r.points} 🪙`]);
    } else {
      const [label, format] = BOARD_FORMAT[board] || BOARD_FORMAT.reaction;
      title = `🏆 ${label}`;
      rows = (await topScores(env, BOARD_FORMAT[board] ? board : "reaction", 10)).map((r) => [r.name, format(r.score)]);
    }
    const medals = ["🥇", "🥈", "🥉"];
    const description = rows.length
      ? rows.map(([who, score], i) => `${medals[i] || `**${i + 1}.**`} ${who} · ${score}`).join("\n")
      : "Nobody's on this board yet.";
    return botReply(null, { embeds: [embed({ title, description, url: `${SITE_URL}/games` })] });
  }

  if (name === "shop") {
    const { results } = await env.DB.prepare(`SELECT ${SHOP_COLUMNS} FROM shop_items ORDER BY price, id LIMIT 25`).all();
    if (!results.length) return botReply(null, { embeds: [embed({ title: "🛒 Sinners shop", description: "The shop is empty for now. New items are coming soon!", url: `${SITE_URL}/games#shop` })] });
    return botReply(null, {
      embeds: [
        embed({
          title: "🛒 Sinners shop",
          description: `Buy with points at ${SITE_URL}/games#shop`,
          url: `${SITE_URL}/games#shop`,
          thumbnail: { url: origin + shopItemOut(results[0]).image },
          fields: results.map((i) => ({
            name: `${i.name} · ${i.price} 🪙`,
            value: `${i.description || "​"}${i.stock != null ? `\n${i.stock ? `${i.stock} left` : "Sold out"}` : ""}`.slice(0, 1024),
          })),
        }),
      ],
    });
  }

  if (name === "round") {
    const id = opt("game") || "colors";
    betGameOf(id);
    await settleRounds(env, id);
    const now = Date.now();
    const round = Math.floor(now / ROUND_MS);
    const { results: bets } = await env.DB.prepare("SELECT amount FROM bets WHERE game = ? AND round = ?").bind(id, round).all();
    const pool = await env.DB.prepare("SELECT jackpot FROM pools WHERE game = ?").bind(id).first();
    const history = await recentRounds(env, id, round, 8);
    const label = id === "colors" ? "🎨 Color Clash" : "🍀 Lucky Number";
    const dot = { red: "🔴", green: "🟢", blue: "🔵" };
    const pot = bets.reduce((s, b) => s + b.amount, 0);
    return botReply(null, {
      embeds: [
        embed({
          title: label,
          url: `${SITE_URL}/games#${id}`,
          description:
            `This round ends <t:${Math.floor(((round + 1) * ROUND_MS) / 1000)}:R> · ${bets.length} bet${bets.length === 1 ? "" : "s"} · pot ${pot} 🪙` +
            (pool && pool.jackpot ? ` · jackpot +${pool.jackpot}` : "") +
            `\nLast results: ${history.length ? history.map((h) => dot[h.outcome] || `**${h.outcome}**`).join(" ") : "none yet"}` +
            `\nPlace your bet at ${SITE_URL}/games#${id}`,
        }),
      ],
    });
  }

  if (name === "sinners") {
    return botReply(null, {
      embeds: [
        embed({
          title: "SINNERS.",
          url: SITE_URL,
          description: [
            `▶️ [Watch](${SITE_URL}/watch): Kick, Twitch and YouTube side by side`,
            `📺 [Content](${SITE_URL}/content): browse YouTube while you wait`,
            `🎮 [Games](${SITE_URL}/games): earn points, bet them, spend them in the shop`,
            `🖼️ [Gallery](${SITE_URL}/gallery): community clips and images`,
          ].join("\n"),
        }),
      ],
    });
  }

  if (name === "notify-here" || name === "notify-off") {
    if (!isAdmin(interaction)) return botReply("🔒 Only server admins can do that.", { ephemeral: true });
    if (!env.GALLERY) return botReply("The site's storage isn't set up yet.", { ephemeral: true });
    if (name === "notify-off") {
      await env.GALLERY.delete("discord:notify");
      return botReply("🔕 Site notifications are off.", { ephemeral: true });
    }
    await env.GALLERY.put("discord:notify", interaction.channel_id || (interaction.channel || {}).id);
    return botReply(
      env.DISCORD_BOT_TOKEN
        ? "🔔 Shop purchases and new gallery links will be posted in this channel. (Make sure I'm allowed to send messages here.)"
        : "🔔 Channel saved, but DISCORD_BOT_TOKEN isn't set in the Worker yet, so I can't post here until it is.",
      { ephemeral: true }
    );
  }
  return botReply("Unknown command. The admin may need to press Register commands again.", { ephemeral: true });
}

function statText(s) {
  return [s.atk && `+${s.atk} ATK`, s.def && `+${s.def} DEF`, s.hp && `+${s.hp} HP`].filter(Boolean).join(" ");
}

// ---------- /help guide ----------
// One message (only the asker sees it) with buttons that switch between topics. The Admin topic only
// appears for members with the Administrator permission.

const HELP_TOPICS = {
  home: {
    label: "Overview",
    emoji: "📖",
    title: "📖 Sinners bot guide",
    description:
      `Sinners (${SITE_URL}) is where we watch Kick, Twitch and YouTube together, chat, play games and level up an adventurer.\n` +
      "Your Discord account **is** your Sinners account: log in on the website with Discord and everything here and there is shared.\n\n" +
      "Pick a topic below to learn more.",
    fields: [
      {
        name: "Commands for everyone",
        value: [
          "`/help` this guide",
          "`/daily` streak reward and daily quests",
          "`/boss status | strike` the weekly world boss",
          "`/dungeon status | go | collect` your adventurer",
          "`/duel [@player]` fight in the arena",
          "`/points [@player]` points and rank",
          "`/top [board]` leaderboards",
          "`/shop` rewards you can redeem",
          "`/round [game]` the current betting round",
          "`/sinners` website links",
        ].join("\n"),
      },
    ],
  },
  start: {
    label: "Getting started",
    emoji: "👋",
    title: "👋 Getting started",
    fields: [
      { name: "1. Log in", value: `Open ${SITE_URL} and press **Log in** (Discord). You get **🪙 100 points** to start.` },
      { name: "2. Make your adventurer", value: `Open your **Profile** (click your name at the top of the site) or type \`/dungeon status\` here. A pixel adventurer is made for you.` },
      { name: "3. Earn points (🪙)", value: "Play the mini games, win adventures and duels, bet in Color Clash / Lucky Number, and level up. Games and duels earn up to 300 a day." },
      { name: "Every day", value: "Open the site (or type `/daily`) to claim your **login streak** reward, then do your **3 daily quests** for coins and XP. Finish all 3 for a bonus chest." },
      { name: "4. Spend them", value: `Gear, potions and scrolls in the **Shop** (${SITE_URL}/shop), or special rewards in its Redeem tab.` },
      { name: "Good to know", value: "Points are just for fun: they can't be bought or turned into money." },
    ],
  },
  adventure: {
    label: "Adventure",
    emoji: "⚔️",
    title: "⚔️ Adventure",
    description: "Send your adventurer to a region. They come back after real time with XP, coins and sometimes loot.",
    fields: [
      {
        name: "Commands",
        value: "`/dungeon status` level, stats, gear, regions\n`/dungeon go place:` send them out\n`/dungeon collect` get the rewards when they're back",
      },
      {
        name: "Regions",
        value: DUNGEONS.map((d) => `${d.emoji} **${d.name}** · level ${TIER_LEVELS[d.tier - 1]} · ${d.minutes >= 60 ? `${d.minutes / 60} h` : `${d.minutes} min`} · 🪙 ${d.coins[0]}–${d.coins[1]}`).join("\n"),
      },
      { name: "Winning", value: "Each region has a boss. Your **Attack, Defense and HP** decide the chance to win (shown before you go). A loss still gives some XP." },
      { name: "Getting stronger", value: "Level up (base stats grow), wear better gear (8 slots, rarer = stronger), and drink potions for +25% on the next 3 fights." },
      { name: "On the website", value: `${SITE_URL}/profile has the world map, your bag and a live replay of every fight.` },
      {
        name: "👹 Weekly world boss",
        value: "A new boss every Monday for everyone. Every adventure and duel hits it, and `/boss strike` (every 4 hours) hits hard. When it falls, everyone who fought gets a chest; the top 3 also get gear.",
      },
    ],
  },
  arena: {
    label: "Arena",
    emoji: "🏟️",
    title: "🏟️ Arena",
    description: "Duel another player's adventurer. They don't need to be online.",
    fields: [
      { name: "Commands", value: "`/duel` a random opponent near your rating\n`/duel opponent:@player` someone specific" },
      { name: "Rating", value: "Everyone starts at **1000**. Beating stronger players earns more rating; losing to weaker ones costs more." },
      { name: "🗓️ Monthly seasons", value: "When the month ends, the top 3 (with 5+ duels) win 🪙 1000 / 600 / 400 and a 👑 🥈 🥉 title, everyone with 10+ duels gets 🪙 100, and ratings soften back toward 1000." },
      { name: "Rewards", value: `A win pays **🪙 10** and 25 XP, a loss still 8 XP. **${DUELS_PER_DAY} duels a day.**` },
      { name: "Leaderboard", value: `${SITE_URL}/profile#arena shows the top players and lets you pick who to fight.` },
    ],
  },
  games: {
    label: "Games & points",
    emoji: "🎮",
    title: "🎮 Games & points",
    fields: [
      { name: "Mini games", value: `${SITE_URL}/games: ⚡ Quick Draw, 🎯 Target Rush, ⌨️ Chat Typer. Better scores earn more points and adventurer XP.` },
      {
        name: "Betting games",
        value: "🎨 **Color Clash** and 🍀 **Lucky Number**: a new round every minute for everyone. Winners split the pot plus a small site bonus. `/round` shows the current one.",
      },
      { name: "Watching streams", value: "While you watch on the Watch page, your adventurer earns a little XP every minute (up to 2 hours a day)." },
      { name: "Check your progress", value: "`/points` your points and rank\n`/top` leaderboards (points, Quick Draw, Target Rush, Chat Typer)" },
    ],
  },
  shop: {
    label: "Shop",
    emoji: "🛒",
    title: "🛒 Shop",
    description: `Everything is on the website: ${SITE_URL}/shop`,
    fields: [
      { name: "⚔️ Adventure", value: "Gear for all 8 slots in 5 tiers (unlock at adventurer level 1 / 5 / 10 / 20 / 30). Never sells out; sells back for half." },
      { name: "🧪 Extras", value: "Potions (+25% Attack, Defense or HP) and scrolls (+50% XP, +15% loot) for your next 3 fights or adventures." },
      { name: "✨ Cosmetics", value: "Hats, capes, pets and chat name colors. Looks only; swap them in your Wardrobe on your profile." },
      { name: "🎁 Redeem", value: "Special rewards from the Sinners team, handed out after you buy them. `/shop` lists them here." },
    ],
  },
  site: {
    label: "Website",
    emoji: "🌐",
    title: "🌐 The website",
    fields: [
      { name: "▶️ Watch", value: `${SITE_URL}/watch: Kick, Twitch and YouTube side by side, HD, mini player, Sinners chat and live alerts. Link Twitch on your profile to type in Twitch chat right on the page.` },
      { name: "📺 Content", value: `${SITE_URL}/content: browse and search YouTube while you wait for a stream.` },
      { name: "🖼️ Gallery", value: `${SITE_URL}/gallery: share clip and image links (checked before they appear).` },
      { name: "👤 Profile", value: "Click your name at the top: your stats, adventurer, world map, arena, daily quests and 🏅 achievements (pick one as your badge in chat)." },
      { name: "👀 Watch parties", value: "On the Watch page you see who else is watching the same stream and can send emoji reactions that float over the video." },
      { name: "🏆 Clip of the Week", value: "Vote for one gallery clip a week. Monday's winner goes on the home page, and whoever shared it gets coins." },
    ],
  },
  admin: {
    label: "Admin",
    emoji: "🛠️",
    admin: true,
    title: "🛠️ Admin commands",
    description: "Only members with the **Administrator** permission can see and use these.",
    fields: [
      { name: "`/stats`", value: "Full site report: who's online, visitors, players, betting, chat, shop and this server." },
      { name: "`/stats-live [every] [mode]`", value: "Keeps the report in this channel, updated every 5 min to once a day (or posts a new one each time). `/stats-live-off` stops it." },
      { name: "`/notify-here`", value: "Posts new shop purchases (to hand out) and gallery links waiting for review in this channel. `/notify-off` stops it." },
      { name: "Admin page", value: `${SITE_URL}/admin (password): gallery review, chat moderation, leaderboards and points resets, shop rewards, and **Register commands** after a bot update.` },
    ],
  },
};

function helpMessage(topic, admin) {
  const keys = Object.keys(HELP_TOPICS).filter((k) => admin || !HELP_TOPICS[k].admin);
  if (!keys.includes(topic)) topic = "home";
  const t = HELP_TOPICS[topic];
  const buttons = keys.map((k) => ({
    type: 2,
    style: k === topic ? 1 : 2,
    label: HELP_TOPICS[k].label,
    emoji: { name: HELP_TOPICS[k].emoji },
    custom_id: `help:${k}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
  return {
    flags: 64,
    allowed_mentions: { parse: [] },
    embeds: [embed({ title: t.title, description: t.description, fields: t.fields, url: SITE_URL })],
    components: rows,
  };
}

// The Discord member using a command, as their Sinners account. The website logs people in as
// "discord:<Discord ID>", so the bot uses the same id: one account, whichever side they play on.
async function discordPlayer(env, caller) {
  if (!caller || !caller.id) return { error: "Use this in a server or DM with me." };
  // Whichever login they made their account with, a connected Discord leads to it
  const known = await env.DB.prepare("SELECT user_id FROM identities WHERE provider = 'discord' AND ext_id = ?").bind(String(caller.id)).first();
  const id = known ? known.user_id : `discord:${caller.id}`;
  if (!known) {
    await env.DB.prepare("INSERT OR IGNORE INTO identities (provider, ext_id, user_id, name, avatar, created) VALUES ('discord', ?, ?, ?, NULL, ?)")
      .bind(String(caller.id), id, clean(caller.global_name || caller.username, 32) || "Adventurer", Date.now())
      .run();
  }
  const banned = await env.DB.prepare("SELECT banned FROM users WHERE id = ?").bind(id).first();
  if (banned && banned.banned) return { error: "Your account is banned from Sinners." };
  return {
    id,
    name: clean(caller.global_name || caller.username, 32) || "Adventurer",
    avatar: caller.avatar ? `https://cdn.discordapp.com/avatars/${caller.id}/${caller.avatar}.png?size=64` : "",
  };
}

const discordIdOf = (userId) => String(userId).replace(/^discord:/, "");

// Fills in a deferred reply ("Sinners is thinking…") with the real answer
async function editOriginal(env, interaction, build) {
  let message;
  try {
    message = await build();
  } catch (err) {
    message = { content: `Something went wrong: ${err.message}` };
  }
  await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...message }),
  });
}

const PAGE_LABELS = { index: "Home", watch: "Watch", content: "Content", games: "Games", gallery: "Gallery", about: "About", stats: "Stats", terms: "Terms", privacy: "Privacy" };

function change(now, before) {
  if (!before) return now ? "🆕 new" : "–";
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? "➖ same as the week before" : `${pct > 0 ? "📈 +" : "📉 "}${pct}% vs the week before`;
}

// The full /stats report: visitors, players, games, betting, chat, shop, gallery and this Discord server
async function statsReport(env, interaction) {
  const day = today();
  const startOfDay = Date.parse(day + "T00:00:00Z");
  const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const one = (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const many = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results;
  const n = (row) => (row ? row.n : 0);
  const guild = interaction.guild_id && env.DISCORD_BOT_TOKEN
    ? fetch(`${DISCORD_API}/guilds/${interaction.guild_id}?with_counts=true`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    : Promise.resolve(null);

  const [s, prevWeek, newToday, newWeek, rich, bigWin, roundsToday, betsToday, pools, lastColors, lastLucky, newBests, chatter, shopItems, soldToday, waiting, pending, server] =
    await Promise.all([
      siteStats(env),
      one("SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(visitors), 0) AS visitors FROM site_days WHERE day >= ? AND day <= ?", dayAgo(13), dayAgo(7)),
      one("SELECT COUNT(*) AS n FROM users WHERE created >= ?", startOfDay),
      one("SELECT COUNT(*) AS n FROM users WHERE created >= ?", startOfDay - 6 * 86400000),
      many("SELECT name, points FROM wallets ORDER BY points DESC LIMIT 3"),
      one("SELECT name, game, amount, payout + bonus AS won FROM bets WHERE created >= ? AND payout > 0 ORDER BY payout + bonus - amount DESC LIMIT 1", startOfDay - ROUND_MS),
      one("SELECT COUNT(*) AS n FROM rounds WHERE settled_at >= ?", startOfDay),
      one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS points FROM bets WHERE created >= ?", startOfDay),
      many("SELECT game, jackpot FROM pools"),
      recentRounds(env, "colors", Math.floor(Date.now() / ROUND_MS), 6),
      recentRounds(env, "lucky", Math.floor(Date.now() / ROUND_MS), 6),
      one("SELECT COUNT(*) AS n FROM scores WHERE created >= ?", startOfDay),
      one("SELECT name, COUNT(*) AS n FROM messages WHERE deleted = 0 AND created >= ? GROUP BY user_id ORDER BY n DESC LIMIT 1", startOfDay),
      one("SELECT COUNT(*) AS n FROM shop_items"),
      one("SELECT COUNT(*) AS n FROM purchases WHERE created >= ?", startOfDay),
      one("SELECT COUNT(*) AS n FROM purchases WHERE delivered = 0"),
      env.GALLERY ? getList(env, "pending").then((l) => l.length) : 0,
      guild,
    ]);

  const c = s.community;
  const where = Object.entries(s.pages)
    .filter(([p]) => p !== "admin")
    .sort((a, b) => b[1] - a[1])
    .map(([p, k]) => `${PAGE_LABELS[p] || p} ${k}`)
    .join(" · ");
  const bars = "▁▂▃▄▅▆▇█";
  const peakWeek = Math.max(1, ...s.week.map((d) => d.visitors));
  const spark = s.week.map((d) => bars[Math.round((d.visitors / peakWeek) * 7)]).join("");
  const medals = ["🥇", "🥈", "🥉"];
  const jackpot = (g) => (pools.find((p) => p.game === g) || {}).jackpot || 0;
  const dot = { red: "🔴", green: "🟢", blue: "🔵" };
  const topPage = s.topPages.find((p) => p.page !== "admin");

  const fields = [
    { name: "📅 Today", value: `**${s.today.visitors}** visitors\n**${s.today.views}** page views\n**${n(newToday)}** new players`, inline: true },
    {
      name: "📈 Last 7 days",
      value: `**${s.weekTotals.visitors}** visitors\n**${s.weekTotals.views}** page views\n\`${spark}\`\n${change(s.weekTotals.visitors, prevWeek.visitors)}`,
      inline: true,
    },
    { name: "🌍 All time", value: `**${s.allTime.visitors}** visitors\n**${s.allTime.views}** page views\n**${c.players}** players (${n(newWeek)} new this week)`, inline: true },
    {
      name: "🏆 Richest players",
      value: rich.length ? rich.map((r, i) => `${medals[i]} ${r.name} · ${r.points} 🪙`).join("\n") : "Nobody yet",
      inline: true,
    },
    {
      name: "🎲 Betting today",
      value:
        `**${n(roundsToday)}** rounds played\n**${betsToday.n}** bets · ${betsToday.points} 🪙\n` +
        (bigWin && bigWin.won > bigWin.amount ? `Biggest win: ${bigWin.name} +${bigWin.won - bigWin.amount} 🪙` : "No big wins yet"),
      inline: true,
    },
    {
      name: "💰 Jackpots",
      value:
        `🎨 Color Clash: **${jackpot("colors")}** 🪙\n${lastColors.map((r) => dot[r.outcome] || r.outcome).join(" ") || "no rounds yet"}\n` +
        `🍀 Lucky Number: **${jackpot("lucky")}** 🪙\n${lastLucky.map((r) => `\`${r.outcome}\``).join(" ") || "no rounds yet"}`,
      inline: true,
    },
    { name: "🎮 Games", value: `**${n(newBests)}** new best scores today\n**${c.gamesPlayed}** leaderboard entries\n**${c.pointsTotal}** 🪙 owned in total`, inline: true },
    {
      name: "💬 Chat",
      value: `**${c.chatToday}** messages today\n**${c.chatMessages}** in total\n${chatter ? `Most active today: ${chatter.name} (${chatter.n})` : "Quiet so far today"}`,
      inline: true,
    },
    {
      name: "🛒 Shop · 🖼️ Gallery",
      value: `**${n(shopItems)}** items for sale · **${n(soldToday)}** sold today\n${n(waiting) ? `⚠️ **${n(waiting)}** waiting to be delivered` : "✓ All purchases delivered"}\n**${c.galleryItems}** gallery posts${pending ? ` · ⚠️ **${pending}** to review` : ""}`,
      inline: true,
    },
  ];
  if (server) {
    fields.push({
      name: "👥 This server",
      value: `**${server.approximate_member_count ?? "?"}** members\n**${server.approximate_presence_count ?? "?"}** online in Discord`,
      inline: true,
    });
  }
  if (topPage) fields.push({ name: "📄 Most viewed today", value: `${PAGE_LABELS[topPage.page] || topPage.page} · ${topPage.views} views`, inline: true });

  return {
    embeds: [
      embed({
        title: "📊 Sinners · site report",
        url: `${SITE_URL}/stats`,
        description: `🟢 **${s.online} online now** · peak today **${Math.max(s.today.peak || 0, s.online)}**${where ? `\n${where}` : ""}`,
        fields,
        timestamp: new Date().toISOString(),
      }),
    ],
  };
}

// ---------- Live stats board ----------
// /stats-live saves { channel, message, guild, every, mode, last } in KV. The Cron Trigger runs every
// 5 minutes; when the board is due it edits its message (or posts a new one in "post" mode). If the
// message was deleted, a new one is posted.

function botPost(env, channel, message) {
  return fetch(`${DISCORD_API}/channels/${channel}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...message }),
  });
}

function boardMessage(report, board) {
  const label = (BOARD_INTERVALS.find((i) => i.value === board.every) || { name: `${board.every} minutes` }).name;
  const e = report.embeds[0];
  e.footer = { text: board.mode === "post" ? `sinnerstv.com · new report every ${label}` : `sinnerstv.com · updates every ${label} · last update` };
  return report;
}

async function publishBoard(env, board) {
  await ensureSchema(env);
  const message = boardMessage(await statsReport(env, { guild_id: board.guild }), board);
  let res = null;
  if (board.mode === "edit" && board.message) {
    res = await fetch(`${DISCORD_API}/channels/${board.channel}/messages/${board.message}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  }
  if (!res || res.status === 404) {
    res = await botPost(env, board.channel, message);
    if (res.ok) board.message = (await res.json()).id;
  }
  board.last = Date.now();
  board.error = res.ok ? "" : `Discord said ${res.status}`;
  await env.GALLERY.put(BOARD_KEY, JSON.stringify(board));
  return res.ok;
}

async function updateStatsBoard(env) {
  if (!env.DISCORD_BOT_TOKEN || !env.GALLERY || !env.DB) return;
  const board = await env.GALLERY.get(BOARD_KEY, "json");
  if (!board) return;
  // A little slack, so a 5-minute board isn't skipped when the trigger runs a few seconds early
  if (Date.now() - (board.last || 0) < board.every * 60000 - 30000) return;
  await publishBoard(env, board);
}

async function statsLiveCommand(interaction, env, ctx) {
  if (!isAdmin(interaction)) return botReply("🔒 Only server admins can do that.", { ephemeral: true });
  if (!env.GALLERY || !env.DB) return botReply("The site's storage isn't set up yet.", { ephemeral: true });
  if (interaction.data.name === "stats-live-off") {
    await env.GALLERY.delete(BOARD_KEY);
    return botReply("⏹️ The live stats board is off. The last report stays in the channel.", { ephemeral: true });
  }
  if (!env.DISCORD_BOT_TOKEN) return botReply("DISCORD_BOT_TOKEN isn't set in the Worker yet, so I can't post.", { ephemeral: true });
  const opts = interaction.data.options || [];
  const opt = (k) => (opts.find((o) => o.name === k) || {}).value;
  const board = {
    channel: interaction.channel_id || (interaction.channel || {}).id,
    guild: interaction.guild_id,
    every: BOARD_INTERVALS.some((i) => i.value === opt("every")) ? opt("every") : 5,
    mode: opt("mode") === "post" ? "post" : "edit",
    message: null,
    last: 0,
  };
  await ensureSchema(env);
  later(ctx, publishBoard(env, board));
  const label = BOARD_INTERVALS.find((i) => i.value === board.every).name;
  return botReply(
    `📊 Live stats board set up here: ${board.mode === "post" ? "a new report" : "the report updates"} every ${label}. ` +
      "Use /stats-live-off to stop it. (Make sure I can send messages and embeds in this channel.)",
    { ephemeral: true }
  );
}

// A message from the bot in the /notify-here channel (does nothing if that isn't set up)
async function discordNotify(env, fields) {
  if (!env.DISCORD_BOT_TOKEN || !env.GALLERY) return;
  const channel = await env.GALLERY.get("discord:notify");
  if (!channel) return;
  await fetch(`${DISCORD_API}/channels/${channel}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed(fields)], allowed_mentions: { parse: [] } }),
  });
}

async function discordAdminStatus(request, env, cors) {
  checkAdmin(request, env);
  return json(
    {
      clientId: !!env.DISCORD_CLIENT_ID,
      publicKey: !!env.DISCORD_PUBLIC_KEY,
      botToken: !!env.DISCORD_BOT_TOKEN,
      notifyChannel: env.GALLERY ? await env.GALLERY.get("discord:notify") : null,
      statsBoard: env.GALLERY ? await env.GALLERY.get(BOARD_KEY, "json") : null,
      inviteUrl: env.DISCORD_CLIENT_ID
        ? `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot+applications.commands&permissions=19456`
        : null,
      interactionsUrl: `${new URL(request.url).origin}/discord/interactions`,
      commands: BOT_COMMANDS.map((c) => c.name),
    },
    200,
    cors
  );
}

async function discordAdminAction(request, env, cors) {
  checkAdmin(request, env);
  const { action } = await readJson(request);
  if (action !== "register") fail("Unknown action", 400);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_BOT_TOKEN) fail("Add DISCORD_BOT_TOKEN (and DISCORD_CLIENT_ID) to the Worker first.");
  const res = await fetch(`${DISCORD_API}/applications/${env.DISCORD_CLIENT_ID}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(BOT_COMMANDS),
  });
  if (!res.ok) fail(`Discord said: ${res.status} ${(await res.text()).slice(0, 200)}`, 502);
  return json({ ok: true, commands: BOT_COMMANDS.map((c) => c.name) }, 200, cors);
}

// ---------- Helpers ----------

function httpsUrl(link) {
  let url;
  try {
    url = new URL(String(link || "").trim());
  } catch (e) {
    fail("That doesn't look like a link.");
  }
  if (url.protocol !== "https:") fail("Links must start with https://");
  return url;
}

function clean(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);
}

function checkAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_PASSWORD || auth !== `Bearer ${env.ADMIN_PASSWORD}`) fail("Wrong password", 401);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    fail("Bad request", 400);
  }
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function text(message, status, cors) {
  return new Response(message, { status, headers: { ...cors, "Content-Type": "text/plain" } });
}
