const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function getQueryValue(req, key) {
  if (req?.query && typeof req.query === "object" && req.query[key]) {
    return String(req.query[key]);
  }

  try {
    const requestUrl = new URL(req?.url || "/", "http://localhost");
    return requestUrl.searchParams.get(key) || "";
  } catch {
    return "";
  }
}

function normalizeSearchQuery(value = "") {
  return String(value || "")
    .replace(/[|·]/g, " ")
    .replace(/\b(?:oferta|renting|segunda mano|ocasion|ocasión|seminuevo|nuevo|cuota|mes|km|cv)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateHostname(hostname = "") {
  const lowered = String(hostname || "").toLowerCase();

  return (
    lowered === "localhost"
    || lowered === "::1"
    || /^127\./.test(lowered)
    || /^10\./.test(lowered)
    || /^192\.168\./.test(lowered)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(lowered)
  );
}

function guessImageContentType(targetUrl, contentType = "", buffer = Buffer.alloc(0)) {
  const loweredType = String(contentType || "").toLowerCase();
  if (loweredType.startsWith("image/")) {
    return loweredType;
  }

  const path = String(targetUrl?.pathname || "").toLowerCase();
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.avif$/i.test(path)) return "image/avif";
  if (/\.(jpg|jpeg)$/i.test(path)) return "image/jpeg";

  const hex = buffer.subarray(0, 12).toString("hex");
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  return "";
}

function escapeSvgText(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendPlaceholderImage(res, label = "Coche de ocasión") {
  const safeLabel = escapeSvgText(label).slice(0, 64) || "Coche de ocasión";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700" role="img" aria-label="${safeLabel}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#071226" />
        <stop offset="100%" stop-color="#0f3b68" />
      </linearGradient>
    </defs>
    <rect width="1200" height="700" rx="28" fill="url(#bg)" />
    <text x="80" y="150" fill="#67e8f9" font-family="Arial, sans-serif" font-size="28" font-weight="700">Foto del vehículo en preparación</text>
    <text x="80" y="310" fill="#ffffff" font-family="Arial, sans-serif" font-size="84">🚗</text>
    <text x="80" y="430" fill="#f8fafc" font-family="Arial, sans-serif" font-size="42" font-weight="700">${safeLabel}</text>
    <text x="80" y="490" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="26">MoveAdvisor VO</text>
  </svg>`;

  const buffer = Buffer.from(svg, "utf8");
  res.status(200);
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return res.end(buffer);
}

async function resolveImageUrlFromCommons(rawQuery) {
  const normalizedQuery = normalizeSearchQuery(rawQuery);
  if (!normalizedQuery) {
    return "";
  }

  const queryAttempts = [
    normalizedQuery,
    normalizedQuery.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim(),
    normalizedQuery.split(/\s+/).slice(0, 3).join(" "),
    normalizedQuery.split(/\s+/).slice(0, 2).join(" "),
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);

  for (const candidate of queryAttempts) {
    try {
      const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
      apiUrl.search = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrnamespace: "6",
        gsrlimit: "5",
        gsrsearch: candidate,
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "1280",
      }).toString();

      const response = await fetch(apiUrl.toString(), {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const pages = Object.values(data?.query?.pages || {});
      const match = pages.find((page) => {
        const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
        return Boolean(info?.thumburl || info?.url);
      });

      const info = Array.isArray(match?.imageinfo) ? match.imageinfo[0] : null;
      const imageUrl = String(info?.thumburl || info?.url || "").trim();

      if (imageUrl) {
        return imageUrl;
      }
    } catch {
      // Intento siguiente
    }
  }

  return "";
}

module.exports = async function handler(req, res) {
  if (req?.method && !["GET", "HEAD"].includes(String(req.method).toUpperCase())) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = getQueryValue(req, "url");
  const rawQuery = getQueryValue(req, "query");

  let resolvedUrl = rawUrl;

  if (!resolvedUrl && rawQuery) {
    resolvedUrl = await resolveImageUrlFromCommons(rawQuery);
  }

  if (!resolvedUrl) {
    return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
  }

  let targetUrl;
  try {
    targetUrl = new URL(resolvedUrl);
  } catch {
    return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
  }

  if (!/^https?:$/i.test(targetUrl.protocol) || isPrivateHostname(targetUrl.hostname)) {
    return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        referer: `${targetUrl.protocol}//${targetUrl.host}/`,
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
    }

    const upstreamType = String(response.headers.get("content-type") || "").toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = guessImageContentType(targetUrl, upstreamType, buffer);
    if (!contentType) {
      return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
    }

    const upstreamCache = String(response.headers.get("cache-control") || "");

    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader(
      "Cache-Control",
      upstreamCache && !/private|no-store/i.test(upstreamCache)
        ? upstreamCache
        : "public, max-age=86400, s-maxage=604800"
    );

    return res.end(buffer);
  } catch {
    return sendPlaceholderImage(res, rawQuery || "Coche de ocasión");
  }
};
