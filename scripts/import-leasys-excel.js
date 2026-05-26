/**
 * Importa ofertas de compra desde un Excel de Leasys al marketplace VO de Neon.
 * Uso: node scripts/import-leasys-excel.js "public/Excels VO/archivo.xlsx" [--skip-images]
 *
 * --skip-images  Importa sin descargar fotos (más rápido, útil para actualizar precios)
 */

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const cheerio = require("cheerio");
const { upsertMarketplaceVoOffers } = require("../lib/inventoryStore");
const { uploadBufferToSupabase } = require("../lib/supabaseStorage");

const SKIP_IMAGES = process.argv.includes("--skip-images");

function excelDateToYear(serial) {
  if (!serial || isNaN(serial)) return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.getUTCFullYear();
}

function slugify(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Descarga una imagen desde una URL y la sube a Supabase Storage.
 * Devuelve la URL pública de Supabase o null si falla.
 */
async function downloadAndUpload(imageUrl, storagePath) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null; // página HTML (login redirect), no imagen

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null; // demasiado pequeño, descartamos

    return await uploadBufferToSupabase(buffer, contentType, storagePath);
  } catch {
    return null;
  }
}

/**
 * Las URLs de peritaje de DEKRA tienen este formato:
 *   verIntervencionSinImporte.htm?intervencionId=XXX&codigoAccesoSinImporte=YYY
 * Las fotos están en una página distinta:
 *   verFotosSinImportes.htm?intervencionId=XXX&codigoAcceso=YYY
 * Esta función construye la URL de fotos a partir de la del peritaje.
 */
function buildFotosUrl(peritajeUrl) {
  try {
    const u = new URL(peritajeUrl);
    const intervencionId = u.searchParams.get("intervencionId");
    const codigoAcceso =
      u.searchParams.get("codigoAccesoSinImporte") ||
      u.searchParams.get("codigoAcceso");
    if (!intervencionId || !codigoAcceso) return null;
    return `${u.origin}/public/verFotosSinImportes.htm?intervencionId=${intervencionId}&codigoAcceso=${codigoAcceso}`;
  } catch {
    return null;
  }
}

/**
 * Scrapes la página de FOTOGRAFÍAS de DEKRA (verFotosSinImportes.htm),
 * descarga cada imagen y la sube a Supabase Storage.
 * Devuelve array de URLs públicas de Supabase.
 */
async function fetchAndUploadDekraImages(peritajeUrl, vehicleId) {
  if (!peritajeUrl) return [];

  // Construir URL de la galería de fotos (tab "Fotografías")
  const fotosUrl = buildFotosUrl(peritajeUrl) || peritajeUrl;

  let candidateUrls = [];

  try {
    const res = await fetch(fotosUrl, {
      headers: { "Accept-Language": "es", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    if (!res.ok) return [];

    const contentType = res.headers.get("content-type") || "";

    // Si la propia URL ya es una imagen, la subimos directamente
    if (contentType.startsWith("image/")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const url = await uploadBufferToSupabase(buffer, contentType, `leasys/${vehicleId}/img-0.${ext}`);
      return url ? [url] : [];
    }

    // Es HTML — scrapeamos la galería
    const html = await res.text();
    const $ = cheerio.load(html);

    const seen = new Set();
    function addUrl(u) {
      if (!u) return;
      const clean = u.startsWith("http") ? u.trim() : new URL(u.trim(), fotosUrl).href;
      if (clean && !seen.has(clean)) { seen.add(clean); candidateUrls.push(clean); }
    }

    // Thumbnails descargarFoto.htm (el formato que usa idex-dekra.es)
    $("img[src*='descargarFoto'], a[href*='descargarFoto']").each((_, el) => {
      addUrl($(el).attr("src") || $(el).attr("href"));
    });

    // Imágenes CDN directas de DEKRA
    $("img[src*='dis.dekra-automotivesolutions.com'], img[src*='dekra-automotivesolutions']").each((_, el) => {
      addUrl($(el).attr("src"));
    });

    // Cualquier imagen con pinta de foto (fallback)
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (src.includes("foto") || src.includes("photo") || src.includes("image")) addUrl(src);
    });

  } catch {
    return [];
  }

  if (candidateUrls.length === 0) return [];

  // Descargamos y subimos cada imagen encontrada
  const uploaded = [];
  for (let i = 0; i < Math.min(candidateUrls.length, 20); i++) {
    const ext = "jpg";
    const storagePath = `leasys/${vehicleId}/img-${i}.${ext}`;
    const publicUrl = await downloadAndUpload(candidateUrls[i], storagePath);
    if (publicUrl) uploaded.push(publicUrl);
  }

  return uploaded;
}

function parseRow(row) {
  const matricula   = String(row["Matrícula"] || "").trim();
  const bastidor    = String(row["Bastidor"] || "").trim();
  const marca       = String(row["Marca"] || "").trim();
  const gamma       = String(row["GAMMA"] || "").trim();
  const modelo      = String(row["Modelo"] || "").trim();
  const campa       = String(row["Campa"] || "").trim();
  const kms         = Number(row["Kms"] || 0);
  const combustible = String(row["Combustible"] || "").trim();
  const precioNeto  = Number(row["Neto"] || 0);
  const precioIva   = Number(row["Con IVA"] || 0);
  const peritaje    = String(row["Peritaje"] || "").trim();
  const fechaMat    = row["Fecha de matrícula"];
  const danios      = Number(row["Daños Peritados"] || 0);

  if (!bastidor || !marca || !gamma) return null;

  const price = precioIva || precioNeto;
  if (!price || price <= 0) return null;

  return { bastidor, matricula, marca, gamma, modelo, campa, kms, combustible, price, peritaje, fechaMat, danios };
}

async function main() {
  const filePath = process.argv.find((a) => !a.startsWith("--") && a.endsWith(".xlsx"))
    || process.argv[2]
    || "public/Excels VO/2 Listado Leasys 21.05.2026.xlsx";

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Archivo no encontrado: ${absPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(absPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Filas leídas: ${rows.length}`);

  const parsed = rows.map(parseRow).filter(Boolean);
  console.log(`Filas válidas: ${parsed.length}`);

  if (SKIP_IMAGES) {
    console.log("Modo --skip-images: se omite la descarga de fotos.");
  } else {
    const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    if (!supabaseConfigured) {
      console.warn("⚠  SUPABASE_URL / SUPABASE_SERVICE_KEY no configurados — las imágenes no se subirán.");
    } else {
      console.log("Descargando imágenes de DEKRA y subiendo a Supabase (puede tardar unos minutos)...");
    }
  }

  const offers = [];
  let withImages = 0;
  let withoutImages = 0;

  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const vehicleId = slugify(r.bastidor);
    process.stdout.write(`  [${i + 1}/${parsed.length}] ${r.matricula || r.bastidor} ${r.marca} ${r.gamma}... `);

    let images = [];
    if (!SKIP_IMAGES) {
      images = await fetchAndUploadDekraImages(r.peritaje, vehicleId);
    }

    if (images.length > 0) {
      withImages++;
      console.log(`${images.length} foto(s) → Supabase`);
    } else {
      withoutImages++;
      console.log(SKIP_IMAGES ? "omitida" : "sin fotos");
    }

    offers.push({
      id: `leasys-${vehicleId}`,
      title: `${r.marca} ${r.gamma}`,
      brand: r.marca,
      model: r.gamma,
      price: r.price,
      year: excelDateToYear(r.fechaMat),
      mileage: r.kms,
      location: r.campa,
      color: "",
      displacement: null,
      fuel: r.combustible,
      power: "",
      seller: "Leasys",
      sellerType: "dealer",
      hasGuaranteeSeal: false,
      portalScore: 75,
      warrantyMonths: 0,
      description: r.modelo + (r.danios > 0 ? ` | Daños peritados: ${r.danios}€` : ""),
      image: images[0] || "",
      imageUrls: images,
      url: r.peritaje,
      peritajeUrl: r.peritaje,
      portal: "marketplace-vo",
      isActive: true,
      availableForPurchase: true,
      rentingAvailable: false,
      matricula: r.matricula,
    });
  }

  const result = await upsertMarketplaceVoOffers(offers);
  if (!result?.ok) {
    console.error("\nError al importar:", result);
    process.exit(1);
  }

  console.log(`\n✓ Importación completada: ${result.upserted} ofertas en ${result.source}`);
  if (!SKIP_IMAGES) {
    console.log(`  Con fotos: ${withImages}  |  Sin fotos: ${withoutImages}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
