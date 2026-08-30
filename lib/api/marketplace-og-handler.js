"use strict";

const fs   = require("fs");
const path = require("path");
const { getMarketplaceVoOfferById } = require("../inventoryStore");
const { ofertaDeImportacionPorId } = require("./import-offers-handler");
const { MARCA } = require("../marca");

const SITE_URL         = MARCA.sitioUrl;
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

/**
 * Quita de la cabecera las meta que vamos a volver a poner con los datos de
 * esta oferta.
 *
 * No basta con anadir las nuestras: index.html ya trae og: y twitter:
 * genericas, las estaticas van antes en el <head> y el rastreador se queda con
 * la primera que encuentra. El resultado era que compartir cualquier anuncio
 * ensenaba el escarabajo y el titulo de la portada en vez del coche. La
 * description ya se quitaba por este mismo motivo; faltaban las demas.
 */
function sinMetasGenericas(html) {
  return html.replace(/<meta\b[^>]*>/gi, (etiqueta) =>
    /(property\s*=\s*["']og:|name\s*=\s*["'](twitter:|description["']))/i.test(etiqueta) ? "" : etiqueta
  );
}

module.exports = async function marketplaceOgHandler(req, res) {
  const offerId = String(req.query?.id || "").trim();

  if (!offerId) {
    res.setHeader("Location", "/marketplace-vo");
    return res.status(302).end();
  }

  let offer = null;
  try { offer = await getMarketplaceVoOfferById(offerId); } catch {}

  // Y si no está ahí, en las de importación: viven en otra tabla.
  //
  // Todo enlace a un coche de Alemania —el del panel del cliente y el del
  // expediente en el ERP— pasa por aquí, y al no encontrarlo se mandaba al
  // listado. Pinchabas «ver anuncio» y acababas en la lista de coches.
  if (!offer) {
    try { offer = await ofertaDeImportacionPorId(offerId); } catch {}
  }

  /**
   * Sin oferta, la página igualmente.
   *
   * Redirigir al listado era decidir por el navegador que ese coche no existe.
   * Puede que sí y que solo falle esta consulta; la propia pantalla sabe
   * buscarlo por dos sitios y decir que no está si de verdad no está. Lo único
   * que se pierde es la vista previa al compartirlo, que sin coche no hay.
   */
  if (!offer) {
    const html = readIndexHtml();
    if (!html) {
      res.setHeader("Location", "/marketplace-vo");
      return res.status(302).end();
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(html);
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
    : (offer.description || `Vehículo de ocasión en el Marketplace VO de ${MARCA.nombre}`);

  const images   = Array.isArray(offer.images) && offer.images.length
    ? offer.images
    : offer.image ? [offer.image] : [];
  const ogImage  = images[0] || DEFAULT_OG_IMAGE;
  const offerUrl = `${SITE_URL}/marketplace-vo/${encodeURIComponent(offerId)}`;

  // ── Inject into index.html ───────────────────────────────────────────────
  const tags = `
  <!-- Dynamic OG / Twitter card for this offer -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="${MARCA.nombre}" />
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
  <title>${esc(ogTitle)} | ${MARCA.nombre}</title>
  <script>window.location.replace(${JSON.stringify(offerUrl)});</script>
</head>
<body></body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).end(fallback);
  }

  let html = sinMetasGenericas(indexHtml)
    // Replace static <title> with offer-specific title
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(ogTitle)} | ${MARCA.nombre}</title>`)
    // Inject OG tags just before </head>
    .replace("</head>", `${tags}\n</head>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=60");
  return res.status(200).end(html);
};

// Se exporta aparte para poder comprobarla sin levantar nada.
module.exports.sinMetasGenericas = sinMetasGenericas;
