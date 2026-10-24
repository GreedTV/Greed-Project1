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
// Setup (Cloudflare dashboard -> Workers & Pages -> this Worker):
//   1. Edit code -> paste this file -> Deploy.
//   2. Bindings -> Add -> KV namespace -> variable name GALLERY -> create/select a namespace.
//   3. Settings -> Variables and Secrets -> Add -> type Secret -> name ADMIN_PASSWORD -> your password.

// Websites allowed to use this Worker. Add your own domain here if you get one.
const ALLOWED_ORIGINS = [
  "https://greedtv.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const SUBMITS_PER_HOUR = 5; // per visitor
const MAX_PENDING = 100;
const MAX_APPROVED = 500;

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

    const path = new URL(request.url).pathname;
    try {
      const kick = path.match(/^\/kick\/([a-zA-Z0-9_-]{2,30})\.m3u8$/);
      if (kick && request.method === "GET") return await kickPlaylist(kick[1].toLowerCase(), cors);

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
