/**
 * enrich-autohero-offers.js
 *
 * Enriquece las ofertas de Autohero en Postgres que tienen datos incompletos.
 * Para cada oferta sin imagen, sin powerCv o sin bodyType, visita la URL de
 * detalle de Autohero y extrae los campos que faltan.
 *
 * Campos enriquecidos:
 *   image_url, images, power_cv, power_kw, body_type, transmission, fuel,
 *   city, province, location, displacement, co2, traction, environmental_label
 *
 * Uso:
 *   node scripts/enrich-autohero-offers.js
 *   node scripts/enrich-autohero-offers.js --dry-run   (solo muestra qué haría)
 *   node scripts/enrich-autohero-offers.js --limit 10  (máximo 10 ofertas)
 *
 * Requiere en .env.local:
 *   DATABASE_URL
 */

"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");

// ── cargar .env.local ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_IDX = process.argv.indexOf("--limit");
const LIMIT = LIMIT_IDX !== -1 ? Number(process.argv[LIMIT_IDX + 1]) || 50 : 200;
const DELAY_MS = 1200; // pausa entre requests para no saturar Autohero

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está definida en .env.local");
  process.exit(1);
}

// ── helpers HTTP ───────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      timeout: timeoutMs,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        "Cache-Control": "no-cache",
      },
    };

    const req = https.request(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location || "";
        if (loc) return fetchUrl(loc.startsWith("http") ? loc : `https://${parsed.hostname}${loc}`, timeoutMs).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── parser de página Autohero ──────────────────────────────────────────────
function unescapeJson(s) {
  return String(s || "")
    .replace(/\\"/g, '"')
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, "");
}

function tryJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function safeStr(v) {
  if (v == null) return "";
  return String(v).trim();
}

function safeInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function safeNum(v) {
  const n = parseFloat(String(v || "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Busca un valor por múltiples claves en un objeto anidado (BFS simple)
function deepFind(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = deepFind(val, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// Normaliza valores de tipo de carrocería al español
function normalizeBodyType(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  if (/suv|crossover|4x4/.test(s)) return "SUV";
  if (/berlina|sedan|saloon/.test(s)) return "Berlina";
  if (/familiar|estate|combi|wagon|avant/.test(s)) return "Familiar";
  if (/coupe|coupé/.test(s)) return "Coupé";
  if (/cabrio|convert/.test(s)) return "Cabrio";
  if (/mono|van|mpv/.test(s)) return "Monovolumen";
  if (/pick.?up/.test(s)) return "Pick-up";
  if (/hatchback|3\s*puertas|5\s*puertas/.test(s)) return "Berlina";
  // Capitalizamos lo que venga si no coincide
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeFuel(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  if (/diesel|d[íi]esel/.test(s)) return "Diesel";
  if (/gasolin|petrol|bensin/.test(s)) return "Gasolina";
  if (/el[eé]ctric/.test(s)) return "Eléctrico";
  if (/h[íi]brido|hybrid/.test(s)) return "Híbrido";
  if (/gas|gnc|glp/.test(s)) return "Gas";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeTransmission(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  if (/auto|dct|tiptronic|cvt|dsg/.test(s)) return "Automatica";
  if (/manual/.test(s)) return "Manual";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Parsea el HTML de la página de detalle de Autohero.
 * Devuelve un objeto con los campos encontrados (solo los que tienen valor).
 */
function parseAutoheroDetailPage(html, offerUrl) {
  const result = {};
  const content = unescapeJson(html);

  // ── 1. Intentar __NEXT_DATA__ (Next.js) ─────────────────────────────────
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    const nextData = tryJson(nextDataMatch[1]);
    if (nextData) {
      // Buscar el objeto del vehículo en la jerarquía de Next.js
      const props = nextData?.props?.pageProps || nextData?.props || {};

      // Autohero suele tener vehicle/car/listing data bajo estas claves
      const vehicleObj =
        props.vehicle || props.car || props.listing || props.ad ||
        props.carDetails || props.initialData?.vehicle ||
        props.dehydratedState?.queries?.[0]?.state?.data ||
        props.pageData;

      if (vehicleObj) {
        // powerCv: buscar powerPs, power, powerCv, ps, cv, kW
        const powerPs = deepFind(vehicleObj, ["powerPs", "powerCV", "powerCv", "power_cv", "ps", "cv"]);
        const powerKw = deepFind(vehicleObj, ["powerKw", "power_kw", "kw"]);
        if (powerPs) result.powerCv = safeInt(powerPs);
        if (powerKw) result.powerKw = safeInt(powerKw);

        // bodyType
        const bt = deepFind(vehicleObj, ["bodyType", "body_type", "carType", "car_type", "carBodyType"]);
        if (bt) result.bodyType = normalizeBodyType(bt);

        // fuel
        const fuel = deepFind(vehicleObj, ["fuelType", "fuel_type", "fuel", "combustible"]);
        if (fuel) result.fuel = normalizeFuel(fuel);

        // transmission
        const gear = deepFind(vehicleObj, ["gearType", "transmission", "transmision", "gearbox"]);
        if (gear) result.transmission = normalizeTransmission(gear);

        // city/province/location — Autohero usa "hub" para la ciudad de entrega
        const city = deepFind(vehicleObj, ["city", "hub", "location.city", "deliveryCity"]);
        const province = deepFind(vehicleObj, ["province", "region", "area"]);
        if (city) result.city = safeStr(city);
        if (province) result.province = safeStr(province);

        // displacement
        const displ = deepFind(vehicleObj, ["displacement", "engineDisplacement", "engine_displacement", "cubicCapacity"]);
        if (displ) result.displacement = safeStr(displ);

        // co2
        const co2 = deepFind(vehicleObj, ["co2", "co2Emission", "co2_emission", "emissions"]);
        if (co2) result.co2 = safeStr(co2);

        // traction
        const traction = deepFind(vehicleObj, ["driveType", "traction", "drive", "traccion"]);
        if (traction) result.traction = safeStr(traction);

        // environmental label
        const envLabel = deepFind(vehicleObj, ["environmentalLabel", "environmental_label", "ecoLabel", "badge"]);
        if (envLabel) result.environmentalLabel = safeStr(envLabel);

        // images
        const imgs = deepFind(vehicleObj, ["images", "gallery", "photos", "imageUrls"]);
        if (Array.isArray(imgs) && imgs.length > 0) {
          const urls = imgs
            .map((img) => {
              if (typeof img === "string") return img;
              return img?.url || img?.src || img?.href || "";
            })
            .filter(Boolean)
            .slice(0, 10);
          if (urls.length > 0) {
            result.imageUrl = urls[0];
            result.images = urls;
          }
        }
      }
    }
  }

  // ── 2. Buscar patrones JSON inline (misma técnica que extractAutoheroSearchListings) ──
  // Imagen principal
  if (!result.imageUrl) {
    const imgMatch =
      content.match(/"ahMainImageUrl":"([^"]+)"/i)?.[1] ||
      content.match(/"mainImageUrl":"([^"]+)"/i)?.[1] ||
      content.match(/"primaryImageUrl":"([^"]+)"/i)?.[1] ||
      content.match(/"imageUrl":"(https:[^"]+autohero[^"]+)"/i)?.[1];
    if (imgMatch) {
      result.imageUrl = imgMatch.replace(/\\/g, "");
      result.images = [result.imageUrl];
    }
  }

  // Galería de imágenes (buscar arrays de URLs de imágenes de Autohero)
  if (!result.images || result.images.length === 0) {
    const galleryMatch = content.match(/"(https:\/\/img-eu[^"]+autohero[^"]+)"/gi);
    if (galleryMatch && galleryMatch.length > 0) {
      const urls = [...new Set(galleryMatch.map((m) => m.replace(/"/g, "").replace(/\\/g, "")))].slice(0, 10);
      result.imageUrl = result.imageUrl || urls[0];
      result.images = urls;
    }
  }

  // powerCv desde patrones inline
  if (!result.powerCv) {
    const psMatch =
      content.match(/"powerPs":(\d+)/i)?.[1] ||
      content.match(/"powerCv":(\d+)/i)?.[1] ||
      content.match(/"power_cv":(\d+)/i)?.[1] ||
      content.match(/"ps":(\d+)/i)?.[1];
    if (psMatch) result.powerCv = safeInt(psMatch);
  }
  if (!result.powerKw) {
    const kwMatch =
      content.match(/"powerKw":(\d+)/i)?.[1] ||
      content.match(/"power_kw":(\d+)/i)?.[1] ||
      content.match(/"kw":(\d+)/i)?.[1];
    if (kwMatch) result.powerKw = safeInt(kwMatch);
  }

  // bodyType inline
  if (!result.bodyType) {
    const btMatch =
      content.match(/"bodyType":"([^"]+)"/i)?.[1] ||
      content.match(/"carType":"([^"]+)"/i)?.[1];
    if (btMatch) result.bodyType = normalizeBodyType(btMatch);
  }

  // fuel inline
  if (!result.fuel) {
    const fuelMatch =
      content.match(/"fuelType":"([^"]+)"/i)?.[1] ||
      content.match(/"fuel":"([^"]+)"/i)?.[1];
    if (fuelMatch) result.fuel = normalizeFuel(fuelMatch);
  }

  // transmission inline
  if (!result.transmission) {
    const gearMatch =
      content.match(/"gearType":"([^"]+)"/i)?.[1] ||
      content.match(/"transmission":"([^"]+)"/i)?.[1];
    if (gearMatch) result.transmission = normalizeTransmission(gearMatch);
  }

  // city/hub inline
  if (!result.city) {
    const hubMatch =
      content.match(/"hub(?:Name)?":"([^"]+)"/i)?.[1] ||
      content.match(/"city":"([^"]+)"/i)?.[1];
    if (hubMatch) result.city = safeStr(hubMatch);
  }

  // ── 3. JSON-LD ────────────────────────────────────────────────────────────
  if (!result.imageUrl) {
    const ldScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of ldScripts) {
      const ld = tryJson(s[1]);
      if (!ld) continue;
      const nodes = Array.isArray(ld) ? ld : [ld];
      for (const node of nodes) {
        const img = node?.image?.url || node?.image || "";
        if (typeof img === "string" && img.startsWith("http")) {
          result.imageUrl = img;
          result.images = [img];
          break;
        }
        if (!result.powerCv && node?.vehicleEngine?.enginePower?.value) {
          result.powerCv = safeInt(node.vehicleEngine.enginePower.value);
        }
        if (!result.bodyType && node?.bodyType) {
          result.bodyType = normalizeBodyType(node.bodyType);
        }
      }
    }
  }

  return result;
}

// ── helpers Postgres ───────────────────────────────────────────────────────
async function getPostgresClient() {
  let pg;
  try { pg = require("pg"); } catch {
    console.error("ERROR: módulo 'pg' no instalado. Ejecuta: npm install pg");
    process.exit(1);
  }
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// ── main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`=== Enriquecimiento de ofertas Autohero${DRY_RUN ? " (DRY-RUN)" : ""} ===\n`);

  const client = await getPostgresClient();
  console.log("Conectado a Postgres OK\n");

  try {
    // Consultar ofertas que necesitan enriquecimiento
    const { rows } = await client.query(`
      SELECT id, url, brand, model, image_url, power_cv, body_type, city, fuel, transmission
      FROM moveadvisor_market_offers
      WHERE portal = 'autohero'
        AND (
          COALESCE(image_url, '') = ''
          OR COALESCE(power_cv, 0) = 0
          OR COALESCE(body_type, '') = ''
        )
      ORDER BY first_seen_at DESC
      LIMIT $1
    `, [LIMIT]);

    if (rows.length === 0) {
      console.log("No hay ofertas Autohero que necesiten enriquecimiento.");
      return;
    }

    console.log(`Ofertas a enriquecer: ${rows.length}\n`);

    let enriched = 0, skipped = 0, failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prefix = `[${i + 1}/${rows.length}]`;
      process.stdout.write(`${prefix} ${row.brand} ${row.model} ... `);

      try {
        if (i > 0) await sleep(DELAY_MS);

        const { status, body } = await fetchUrl(row.url);

        if (status !== 200) {
          console.log(`HTTP ${status} - skip`);
          skipped++;
          continue;
        }

        const extracted = parseAutoheroDetailPage(body, row.url);

        // Solo actualizar campos que faltaban y ahora tienen valor
        const updates = {};
        if (!row.image_url && extracted.imageUrl) {
          updates.image_url = extracted.imageUrl;
          updates.images = JSON.stringify(extracted.images || [extracted.imageUrl]);
        }
        // Calcular powerCv desde powerKw si no viene directo (1 kW = 1.3596 CV)
        const effectivePowerCv = extracted.powerCv || (extracted.powerKw ? Math.round(extracted.powerKw * 1.3596) : null);
        if ((!row.power_cv || row.power_cv === 0) && effectivePowerCv) {
          updates.power_cv = effectivePowerCv;
        }
        if (extracted.powerKw) {
          updates.power_kw = extracted.powerKw;
        }
        if (!row.body_type && extracted.bodyType) {
          updates.body_type = extracted.bodyType;
        }
        if (!row.city && extracted.city) {
          updates.city = extracted.city;
          updates.province = extracted.province || extracted.city;
          updates.location = [extracted.city, extracted.province].filter(Boolean).join(", ");
        }
        if ((!row.fuel || row.fuel === "") && extracted.fuel) {
          updates.fuel = extracted.fuel;
        }
        if ((!row.transmission || row.transmission === "") && extracted.transmission) {
          updates.transmission = extracted.transmission;
        }
        if (extracted.displacement) updates.displacement = extracted.displacement;
        if (extracted.co2) updates.co2 = extracted.co2;
        if (extracted.traction) updates.traction = extracted.traction;
        if (extracted.environmentalLabel) updates.environmental_label = extracted.environmentalLabel;

        const fields = Object.keys(updates);
        if (fields.length === 0) {
          console.log("sin datos nuevos");
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`DRY-RUN → ${fields.join(", ")}`);
          enriched++;
          continue;
        }

        // Construir UPDATE dinámico
        const setClauses = fields.map((f, idx) => `${f} = $${idx + 2}`).join(", ");
        const values = [row.id, ...fields.map((f) => updates[f])];
        await client.query(
          `UPDATE moveadvisor_market_offers SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
          values
        );

        console.log(`OK → ${fields.join(", ")}`);
        enriched++;
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n✓ Completado: ${enriched} enriquecidas, ${skipped} sin cambios, ${failed} errores`);
  } finally {
    await client.end();
  }
})();
