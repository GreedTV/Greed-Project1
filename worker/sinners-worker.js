// Cloudflare Worker for the Sinners site.
//
// Kick HD
//   GET  /kick/<channel>.m3u8   -> the stream's master playlist (all qualities), or 404 if offline.
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
//
// Mini game leaderboards (Games page)
//   GET  /games/leaderboard?game=<id>   -> { game, scores: [top 10] }
//   POST /games/score                  -> { game, score }  (logged in; only your best counts)
//   GET  /games-admin                  -> every game's top 50   (admin)
//   POST /games-admin                  -> { action: "reset", game } | { action: "delete", game, userId }   (admin)
//
// Discord login
//   GET  /auth/discord?return=<page url>  -> sends the visitor to Discord, then back to the page with #session=<token>
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
  async fetch(request, env) {
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

      if (path === "/youtube/channel" && request.method === "GET") return await youtubeChannel(url, cors);
      if (path === "/youtube/live" && request.method === "GET") return await youtubeLive(url, cors);

      // Login pages are opened by the browser directly, so they answer with redirects
      if (path === "/auth/discord") return await discordStart(url, env);
      if (path === "/auth/discord/callback") return await discordCallback(url, env);
      if (path === "/me" && request.method === "GET") return json({ user: await requireUser(request, env) }, 200, cors);

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
        if (path === "/gallery/submit" && request.method === "POST") return await submit(request, env, cors);
        if (path === "/gallery/pending" && request.method === "GET") return await pending(request, env, cors);
        if (path === "/gallery/moderate" && request.method === "POST") return await moderate(request, env, cors);
      }
      return text("Not found", 404, cors);
    } catch (err) {
      return json({ error: err.message || "Something went wrong" }, err.status || 500, cors);
    }
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
  // The channel's Live tab lists its streams; one that's on air carries a LIVE badge.
  // (The /live page itself is a video page, which YouTube may not show to servers.)
  const html = await youtubePage(`/channel/${id}/streams`);
  if (!html) fail("Couldn't reach YouTube", 502);

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
  return json(
    { live, videoId, title: live ? clean(decodeHtml(title), 120) : "", name: clean(decodeHtml(name || ""), 80) },
    200,
    { ...cors, "Cache-Control": "public, max-age=60" }
  );
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
  const items = await getList(env, "approved");
  return json(
    { images: items.filter((i) => i.kind === "image"), clips: items.filter((i) => i.kind === "clip") },
    200,
    { ...cors, "Cache-Control": "public, max-age=30" }
  );
}

async function submit(request, env, cors) {
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

  const approved = await getList(env, "approved");
  if ([...queue, ...approved].some((i) => i.key === item.key)) fail("That link has already been shared.", 409);

  queue.push(item);
  await env.GALLERY.put("pending", JSON.stringify(queue));
  await env.GALLERY.put(rateKey, String(count + 1), { expirationTtl: 3700 });
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

async function discordStart(url, env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return text("Discord login isn't set up yet.", 503, {});
  }
  const back = url.searchParams.get("return") || "";
  if (!ALLOWED_ORIGINS.some((o) => back.startsWith(`${o}/`))) return text("Bad return address", 400, {});

  const state = await signToken(env, { r: back, exp: Date.now() + 10 * 60000 });
  const discord = new URL("https://discord.com/oauth2/authorize");
  discord.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${url.origin}/auth/discord/callback`,
    scope: "identify",
    state,
    prompt: "none",
  });
  return Response.redirect(discord.href, 302);
}

async function discordCallback(url, env) {
  const state = await verifyToken(env, url.searchParams.get("state"));
  if (!state) return text("Login expired. Go back and try again.", 400, {});
  const back = (hash) => Response.redirect(`${state.r}#${hash}`, 302);

  const code = url.searchParams.get("code");
  if (!code) return back("login=cancelled");

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/auth/discord/callback`,
    }),
  });
  if (!tokenRes.ok) return back("login=failed");
  const { access_token } = await tokenRes.json();

  const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!meRes.ok) return back("login=failed");
  const me = await meRes.json();

  const user = {
    id: `discord:${me.id}`,
    name: clean(me.global_name || me.username, 32) || "Discord user",
    avatar: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64` : "",
  };

  if (env.DB) {
    await ensureSchema(env);
    const existing = await env.DB.prepare("SELECT banned FROM users WHERE id = ?").bind(user.id).first();
    if (existing && existing.banned) return back("login=banned");
    await env.DB.prepare(
      "INSERT INTO users (id, name, avatar, banned, created) VALUES (?, ?, ?, 0, ?) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar"
    )
      .bind(user.id, user.name, user.avatar, Date.now())
      .run();
  }

  const session = await signToken(env, { ...user, exp: Date.now() + SESSION_DAYS * 86400000 });
  return back(`session=${session}`);
}

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

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
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
  ]);
  schemaReady = true;
}

function checkRoom(room) {
  if (!ROOM_PATTERN.test(room)) fail("Unknown chat room", 400);
}

const MESSAGE_COLUMNS = "id, user_id AS userId, name, avatar, text, created";

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
  const result = await env.DB.prepare("INSERT INTO messages (room, user_id, name, avatar, text, created) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(room, user.id, user.name, user.avatar, message, created)
    .run();
  return json(
    { message: { id: result.meta.last_row_id, userId: user.id, name: user.name, avatar: user.avatar, text: message, created } },
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
  reaction: { lowerIsBetter: true, min: 90, max: 3000 }, // average reaction time in ms
  aim: { lowerIsBetter: false, min: 1, max: 120 }, // targets hit in 30 seconds
  typing: { lowerIsBetter: false, min: 1, max: 90 }, // words typed in 30 seconds
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
  return json({ best: mine.score, rank: ahead.n + 1, newBest: mine.score === score }, 200, cors);
}

async function gamesAdminList(request, env, cors) {
  checkAdmin(request, env);
  const boards = {};
  for (const id of Object.keys(GAMES)) boards[id] = await topScores(env, id, 50);
  return json(boards, 200, cors);
}

async function gamesAdminAction(request, env, cors) {
  checkAdmin(request, env);
  const { action, game: id, userId } = await readJson(request);
  gameOf(id);
  if (action === "reset") await env.DB.prepare("DELETE FROM scores WHERE game = ?").bind(id).run();
  else if (action === "delete") await env.DB.prepare("DELETE FROM scores WHERE game = ? AND user_id = ?").bind(id, String(userId)).run();
  else fail("Unknown action", 400);
  return json({ ok: true }, 200, cors);
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
