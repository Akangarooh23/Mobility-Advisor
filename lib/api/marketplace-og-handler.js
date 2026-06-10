"use strict";

const fs   = require("fs");
const path = require("path");
const { getMarketplaceVoOfferById } = require("../inventoryStore");

const SITE_URL         = "https://www.carswiseai.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// Cache the built index.html in memory (immutable per deployment)
let _cachedHtml = null;

function readIndexHtml() {
  if (_cachedHtml) return _cachedHtml;
  try {
    _cachedHtml = fs.readFileSync(path.join(process.cwd(), "build", "index.html"), "utf8");
    return _cachedHtml;
  } catch {
    return null;
  }
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatEur(num) {
  return Number(num).toLocaleString("es-ES") + " €";
}

module.exports = async function marketplaceOgHandler(req, res) {
  const offerId = String(req.query?.id || "").trim();

  if (!offerId) {
    res.setHeader("Location", "/marketplace-vo");
    return res.status(302).end();
  }

  let offer = null;
  try { offer = await getMarketplaceVoOfferById(offerId); } catch {}

  if (!offer) {
    res.setHeader("Location", "/marketplace-vo");
    return res.status(302).end();
  }

  // ── Build meta content ───────────────────────────────────────────────────
  const price    = offer.salePrice || offer.price;
  const titleParts = [
    `${offer.brand} ${offer.model}`,
    offer.year  ? String(offer.year) : null,
    price > 0   ? formatEur(price)   : null,
  ].filter(Boolean);
  const ogTitle = titleParts.join(" · ");

  const descParts = [
    offer.power        || null,
    offer.transmission || null,
    offer.fuel         || null,
    offer.mileage > 0  ? Number(offer.mileage).toLocaleString("es-ES") + " km" : null,
    offer.location     || null,
  ].filter(Boolean);
  const ogDesc = descParts.length
    ? descParts.join(" · ")
    : (offer.description || "Vehículo de ocasión en CarsWise Marketplace VO");

  const images   = Array.isArray(offer.images) && offer.images.length
    ? offer.images
    : offer.image ? [offer.image] : [];
  const ogImage  = images[0] || DEFAULT_OG_IMAGE;
  const offerUrl = `${SITE_URL}/marketplace-vo/${encodeURIComponent(offerId)}`;

  // ── Inject into index.html ───────────────────────────────────────────────
  const tags = `
  <!-- Dynamic OG / Twitter card for this offer -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="CarsWise" />
  <meta property="og:title"       content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:image"       content="${esc(ogImage)}" />
  <meta property="og:url"         content="${esc(offerUrl)}" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image"       content="${esc(ogImage)}" />`;

  const indexHtml = readIndexHtml();

  if (!indexHtml) {
    // Local dev without build: minimal page that redirects real users
    const fallback = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${tags}
  <title>${esc(ogTitle)} | CarsWise</title>
  <script>window.location.replace(${JSON.stringify(offerUrl)});</script>
</head>
<body></body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).end(fallback);
  }

  let html = indexHtml
    // Replace static <title> with offer-specific title
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(ogTitle)} | CarsWise</title>`)
    // Remove static meta description so ours takes precedence
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    // Inject OG tags just before </head>
    .replace("</head>", `${tags}\n</head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=60");
  return res.status(200).end(html);
};
