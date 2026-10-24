// Cloudflare Worker: gives the Sinners site the HD playlist for a Kick stream.
//
// GET /kick/<channel>.m3u8  ->  the stream's master playlist (all qualities), or 404 if offline.
//
// Only this first playlist is fetched here. Browsers can load the quality playlists and
// video chunks straight from Kick's video servers, so the video itself never passes
// through this Worker.
//
// Deploy: Cloudflare dashboard -> Workers & Pages -> your Worker -> Edit code -> paste this file -> Deploy.

// Websites allowed to use this Worker. Add your own domain here if you get one.
const ALLOWED_ORIGINS = [
  "https://greedtv.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json",
};

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return text("Method not allowed", 405, cors);

    // Requests from other websites are refused, so this can't be used as an open proxy
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return text("Origin not allowed", 403, cors);

    const match = new URL(request.url).pathname.match(/^\/kick\/([a-zA-Z0-9_-]{2,30})\.m3u8$/);
    if (!match) return text("Use /kick/<channel>.m3u8", 404, cors);
    const channel = match[1].toLowerCase();

    // 1. Ask Kick for the current livestream and its playback address
    const api = await fetch(`https://kick.com/api/v2/channels/${channel}/livestream`, { headers: BROWSER_HEADERS });
    if (!api.ok) return text(`Kick API error (${api.status})`, 502, cors);
    const info = await api.json();
    const playback = info && info.data && info.data.playback_url;
    if (!playback) return text("offline", 404, cors);

    // Only ever fetch Kick's video servers
    const playbackUrl = new URL(playback);
    if (!playbackUrl.hostname.endsWith(".live-video.net")) return text("Unexpected playback host", 502, cors);

    // 2. Fetch the master playlist and pass it on with CORS headers
    const master = await fetch(playbackUrl, { headers: BROWSER_HEADERS });
    if (!master.ok) return text(`Playlist error (${master.status})`, 502, cors);
    const body = absolutize(await master.text(), playbackUrl);

    return new Response(body, {
      headers: {
        ...cors,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    });
  },
};

// Make any relative playlist links absolute, since the playlist is now served from this Worker
function absolutize(playlist, base) {
  return playlist
    .split("\n")
    .map((line) => (line && !line.startsWith("#") && !/^https?:\/\//.test(line) ? new URL(line, base).href : line))
    .join("\n");
}

function text(message, status, cors) {
  return new Response(message, { status, headers: { ...cors, "Content-Type": "text/plain" } });
}
