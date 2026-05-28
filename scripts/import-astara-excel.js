/**
 * Importa ofertas de compra desde un Excel de Astara al marketplace VO de Neon.
 * Uso: node scripts/import-astara-excel.js "public/Excels VO/archivo.xlsx" [--skip-images]
 *
 * --skip-images  Importa sin descargar fotos (más rápido, útil para actualizar precios)
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const cheerio = require("cheerio");
const { upsertMarketplaceVoOffers } = require("../lib/inventoryStore");
const { uploadBufferToSupabase } = require("../lib/supabaseStorage");

const SKIP_IMAGES = process.argv.includes("--skip-images");

const ASTARA_LOCATION_MAP = {
  "ALCOBENDAS": "Madrid",
  "ALCOBENDAS CALLE": "Madrid",
  "CAFLER": "Toda España",
  "CLIENTE": "Toda España",
  "LEGANÉS": "Madrid",
  "LEGANES": "Madrid",
  "MOLLET": "Barcelona",
  "ORVIPAL": "Toda España",
};

function mapAstaraLocation(ubicacion) {
  const key = String(ubicacion || "").trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normalized = Object.entries(ASTARA_LOCATION_MAP).find(([k]) =>
    k.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase() === key
  );
  return normalized ? normalized[1] : ubicacion || "";
}

function excelDateToYear(value) {
  if (!value) return null;
  // Número serial de Excel (ej: 44604)
  if (typeof value === "number" && !isNaN(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.getUTCFullYear();
  }
  // String de fecha (ej: "6/29/2023", "12/28/2023")
  if (typeof value === "string") {
    const match = value.match(/(\d{4})/);
    if (match) return parseInt(match[1], 10);
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return null;
}

function slugify(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function downloadAndUpload(imageUrl, storagePath) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    return await uploadBufferToSupabase(buffer, contentType, storagePath);
  } catch {
    return null;
  }
}

/**
 * Las URLs de Astara son informes HTML en CDN de Azure (dekra-starfleet.com).
 * Las imágenes están embebidas directamente como <img src="...cdn-prod.dekra-starfleet.com/secure/iop-bli/images/UUID?SAS...">.
 * Las URLs tienen SAS tokens con expiración, por eso las descargamos y subimos a Supabase.
 */
async function fetchAndUploadAstaraImages(peritajeUrl, vehicleId) {
  if (!peritajeUrl) return [];

  let candidateUrls = [];

  try {
    const res = await fetch(peritajeUrl, {
      headers: { "Accept-Language": "es", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!res.ok) return [];

    const contentType = res.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const url = await uploadBufferToSupabase(buffer, contentType, `astara/${vehicleId}/img-0.${ext}`);
      return url ? [url] : [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const seen = new Set();
    function addUrl(raw) {
      if (!raw) return;
      // Decodificar entidades HTML (&amp; → &)
      const u = raw.replace(/&amp;/g, "&").trim();
      if (!u.startsWith("http")) return;
      if (!u.includes("cdn-prod.dekra-starfleet.com/secure/iop-bli/images/")) return;
      if (!seen.has(u)) { seen.add(u); candidateUrls.push(u); }
    }

    $("img[src]").each((_, el) => addUrl($(el).attr("src")));
    // También buscar en atributos data-src (lazy loading)
    $("img[data-src]").each((_, el) => addUrl($(el).attr("data-src")));

  } catch {
    return [];
  }

  if (candidateUrls.length === 0) return [];

  const uploaded = [];
  for (let i = 0; i < Math.min(candidateUrls.length, 20); i++) {
    const storagePath = `astara/${vehicleId}/img-${i}.jpg`;
    const publicUrl = await downloadAndUpload(candidateUrls[i], storagePath);
    if (publicUrl) uploaded.push(publicUrl);
  }

  return uploaded;
}

function normalizeTransmission(val) {
  const v = String(val || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (v.includes("auto")) return "Automático";
  if (v.includes("manual")) return "Manual";
  return String(val || "").trim();
}

function parseRow(row) {
  const matricula   = String(row["MATRÍCULA"] || "").trim();
  const bastidor    = String(row["BASTIDOR"] || "").trim();
  const marca       = String(row["MARCA"] || "").trim();
  const modelo      = String(row["Modelo"] || "").trim();
  const version     = String(row["VERSIÓN"] || "").trim();
  const ubicacion   = String(row["Ubicación"] || "").trim();
  const color       = String(row["COLOR"] || "").trim();
  const combustible = String(row["COMBUSTIBLE"] || "").trim();
  const cambio      = String(row["CAMBIO"] || "").trim();
  const kms         = Number(row["KM"] || 0);
  const precioNeto  = Number(row["Precio € (SIN IVA)"] || 0);
  const precioIva   = Number(row["Precio € (CON IVA)"] || 0);
  const valorPer    = Number(row["Valor Peritación"] || 0);
  const peritaje    = String(row["PERITACIONES"] || "").trim();
  const fechaMat    = row["MATRICULACIÓN"];

  if (!bastidor || !marca || !modelo) return null;

  const price = precioIva || precioNeto;
  if (!price || price <= 0) return null;

  return { matricula, bastidor, marca, modelo, version, ubicacion, color, combustible, cambio, kms, price, valorPer, peritaje, fechaMat };
}

async function main() {
  const filePath =
    process.argv.find((a) => !a.startsWith("--") && a.endsWith(".xlsx")) ||
    process.argv[2] ||
    "public/Excels VO/11052026 Stockastaramove B2B.xlsx";

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Archivo no encontrado: ${absPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(absPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  console.log(`Filas leídas: ${rows.length}`);

  const parsedAll = rows.map(parseRow).filter(Boolean);
  const dedupSeen = new Set();
  const parsed = parsedAll.filter((r) => {
    const key = `${r.marca}|${r.modelo}|${r.kms}|${r.price}|${r.color}`.toLowerCase();
    if (dedupSeen.has(key)) return false;
    dedupSeen.add(key);
    return true;
  });
  if (parsedAll.length !== parsed.length) {
    console.log(`Filas válidas: ${parsedAll.length} (${parsedAll.length - parsed.length} duplicados eliminados → ${parsed.length})`);
  } else {
    console.log(`Filas válidas: ${parsed.length}`);
  }

  if (SKIP_IMAGES) {
    console.log("Modo --skip-images: se omite la descarga de fotos.");
  } else {
    const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    if (!supabaseConfigured) {
      console.warn("⚠  SUPABASE_URL / SUPABASE_SERVICE_KEY no configurados — las imágenes no se subirán.");
    } else {
      console.log("Descargando imágenes de DEKRA StarFleet y subiendo a Supabase...");
    }
  }

  const offers = [];
  let withImages = 0;
  let withoutImages = 0;

  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const vehicleId = slugify(r.bastidor);
    process.stdout.write(`  [${i + 1}/${parsed.length}] ${r.matricula || r.bastidor} ${r.marca} ${r.modelo}... `);

    let images = [];
    if (!SKIP_IMAGES) {
      images = await fetchAndUploadAstaraImages(r.peritaje, vehicleId);
    }

    if (images.length > 0) {
      withImages++;
      console.log(`${images.length} foto(s) → Supabase`);
    } else {
      withoutImages++;
      console.log(SKIP_IMAGES ? "omitida" : "sin fotos");
    }

    const descParts = [r.version];
    if (r.cambio) descParts.push(r.cambio);
    if (r.valorPer > 0) descParts.push(`Daños peritados: ${r.valorPer}€`);

    offers.push({
      id: `astara-${vehicleId}`,
      title: `${r.marca} ${r.modelo}`,
      brand: r.marca,
      model: r.modelo,
      price: r.price,
      year: excelDateToYear(r.fechaMat),
      mileage: r.kms,
      location: mapAstaraLocation(r.ubicacion),
      internalLocation: r.ubicacion,
      version: r.version,
      transmission: normalizeTransmission(r.cambio),
      color: r.color,
      displacement: null,
      fuel: r.combustible,
      power: "",
      seller: "Astara",
      sellerType: "professional",
      hasGuaranteeSeal: false,
      portalScore: 75,
      warrantyMonths: 0,
      description: descParts.filter(Boolean).join(" | "),
      image: images[0] || "",
      imageUrls: images,
      url: r.peritaje,
      peritajeUrl: r.peritaje,
      portal: "marketplace-vo",
      isActive: true,
      availableForPurchase: true,
      salePrice: Math.round((r.price + 1250) * 100) / 100,
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
