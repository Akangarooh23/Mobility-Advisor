/**
 * Carga un volcado de cualquier portal en moveadvisor_market_offers.
 *
 *   npm run carga-volcado -- <fichero.jsonl.gz>            (solo mira)
 *   npm run carga-volcado -- <fichero.jsonl.gz> --ensayo   (escribe y deshace)
 *   npm run carga-volcado -- <fichero.jsonl.gz> --aplica
 *
 * Hermano de carga-volcado-cochesnet.js, que se queda como está porque ya hizo
 * su trabajo y su mapeo está comprobado contra los 285.119 de aquel fichero.
 * Este sirve para milanuncios y wallapop, y para los que vengan.
 *
 * ── LO QUE APORTA CADA UNO ─────────────────────────────────────────────────
 *
 *     wallapop      579.264 en el volcado, teníamos 4.215   falta el 99 %
 *     milanuncios   271.307 en el volcado, teníamos 4.397   falta el 99 %
 *
 * Y no es latencia como en AutoScout24: falta parejo en todos los tramos de
 * edad (98-100 %). Sencillamente no cubrimos esos portales, y ahora se sabe por
 * qué: nuestro scraper de Wallapop es «Scraper (particulares)» y el volcado
 * trae 295.302 ofertas de profesionales que no miramos jamás; el de milanuncios
 * va con LIMIT 40 por pasada.
 *
 * ── LA FECHA QUE SE GUARDA ES LA DEL VOLCADO ───────────────────────────────
 *
 * last_seen_at = ref_day, no NOW(). Igual que en coches.net y por lo mismo: ese
 * día constaba que estaban a la venta, hoy no lo sabemos. Así envejecen solas y
 * el filtro de 90 días del comparable las va sacando.
 *
 * CON UNA CONSECUENCIA QUE HAY QUE TENER PRESENTE: estas 823.550 filas llevarán
 * todas la misma fecha, así que **caducan el mismo día, el 20-dic-2026**, junto
 * a las 282.164 de coches.net. Ese día salen del pool 1,1 millones de filas de
 * golpe. No es una pérdida -se vuelve a donde estamos hoy, no por debajo- pero
 * conviene no acostumbrarse a la cobertura de en medio.
 *
 * ── LO QUE SE COMPROBÓ ANTES DE MAPEAR NADA ────────────────────────────────
 *
 * En Autohero di por buena una traducción heredada y 839 coches acabaron con el
 * combustible equivocado. Aquí se miraron los valores reales de los 850.571
 * registros, y aparecieron dos trampas:
 *
 *   1. EN MILANUNCIOS, `body_type` NO ES LA CARROCERÍA: son las puertas.
 *      «5 puertas» 183.832, «4 puertas» 34.254, «3 puertas» 21.393, «2 puertas»
 *      14.913. Mapearlo por el nombre habría puesto «5 puertas» como carrocería
 *      de 183.832 coches. En wallapop sí es la carrocería de verdad
 *      -SUV/4X4, Berlina, Pequeño, Monovolumen...-.
 *
 *   2. EL COMBUSTIBLE VIENE EN DOS IDIOMAS. milanuncios mezcla «Diésel»,
 *      «Gasolina» e «Híbrido» con `plug_in_hybrid`, `electric` y `cng`.
 *      Wallapop usa «Híbrido enchufable» y «Gas licuado (GPL)».
 *
 * Y una tercera que no es trampa sino suciedad: wallapop trae kilometrajes
 * de -654.965.796 y precios de 111.111.112. Son casos sueltos -el 96,2 % de sus
 * filas está bien- pero entran en la mediana, así que se filtran.
 *
 * ── LOS FRENOS ─────────────────────────────────────────────────────────────
 *
 *   - Se descarta lo que no sirve de comparable: precio fuera de 300-300.000,
 *     km fuera de 0-800.000, año fuera de 1980-2027, o sin marca o sin modelo.
 *   - Lo que ya tengamos NO se pisa, salvo el precio: lo que llenó el
 *     enriquecedor se queda.
 *   - --ensayo escribe lotes de verdad dentro de BEGIN/ROLLBACK, porque los
 *     fallos que importan -un texto que no cabe, un tipo que no cuadra- solo
 *     aparecen cuando Postgres los ve.
 */
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const FICHERO = process.argv.find((a) => a.indexOf(".jsonl") !== -1);
const APLICA = process.argv.includes("--aplica");
const ENSAYO = process.argv.includes("--ensayo");
const LOTES_ENSAYO = 6;
const POR_LOTE = 500;

/*
 * Los prefijos están comprobados contra moveadvisor_market_offers, no supuestos:
 * milanuncios es 'mil_' y no 'ml_', que es lo que ponía limpia-con-volcado.js.
 * Un prefijo equivocado no da error, da cero coincidencias.
 */
const PORTALES = {
  "wallapop.com": { portal: "wallapop", prefijo: "wp_", puertasEnBodyType: false },
  "milanuncios.com": { portal: "milanuncios", prefijo: "mil_", puertasEnBodyType: true },
  "autoscout24.es": { portal: "autoscout24", prefijo: "as_", puertasEnBodyType: false },
  "coches.net": { portal: "cochesnet", prefijo: "cn_", puertasEnBodyType: false },
};

// Las horquillas de lo que puede ser un comparable.
const PRECIO_MIN = 300, PRECIO_MAX = 300000;
const KM_MAX = 800000;
const ANIO_MIN = 1980, ANIO_MAX = 2027;

function combustible(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  // El orden importa: «híbrido enchufable» tiene que mirarse antes que «híbrido».
  if (s.indexOf("enchufa") !== -1 || s.indexOf("plug_in") !== -1 || s.indexOf("plug-in") !== -1) return "Híbrido";
  if (s.indexOf("híbrid") !== -1 || s.indexOf("hibrid") !== -1 || s === "hybrid" || s.indexOf("hev") !== -1) return "Híbrido";
  if (s.indexOf("eléctric") !== -1 || s.indexOf("electric") !== -1) return "Eléctrico";
  if (s.indexOf("diés") !== -1 || s.indexOf("dies") !== -1 || s.indexOf("gasóleo") !== -1) return "Diesel";
  if (s.indexOf("gasolina") !== -1 || s === "petrol") return "Gasolina";
  // GLP, GPL, GNC, cng, gas natural: todo va a «Gas», que es lo que usamos.
  if (s.indexOf("glp") !== -1 || s.indexOf("gpl") !== -1 || s.indexOf("gnc") !== -1
    || s === "cng" || s === "lpg" || s.indexOf("gas ") !== -1) return "Gas";
  return "";   // «Otros», «Otro» y lo que no se reconozca: no se inventa
}

function cambio(raw) {
  const s = String(raw || "").toLowerCase();
  // «Semiautomático» es automático a efectos de compra: no lo lleva el pie.
  if (s.indexOf("autom") !== -1) return "Automatica";
  if (s.indexOf("manual") !== -1) return "Manual";
  return "";
}

function etiqueta(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s || s === "NO_LABEL") return "";   // NO_LABEL es «sin etiqueta», no un valor
  if (s === "0" || s === "ECO" || s === "B" || s === "C") return s;
  return "";
}

const LARGO = {
  country: 2, id: 40, listing_type: 40, co2: 50, displacement: 50,
  environmental_label: 50, fuel: 60, portal: 60, transmission: 60,
  body_type: 80, color: 80, seller_type: 80, brand: 100, traction: 100,
  city: 120, model: 120, province: 120, location: 160, version: 180,
  dealer_name: 200, title: 500, url: 1024, image_url: 2000,
};
function txt(v, col) {
  let s = String(v === null || v === undefined ? "" : v);
  const max = LARGO[col];
  if (max && s.length > max) s = s.slice(0, max);
  return "'" + s.replace(/'/g, "''") + "'";
}
const nulo = (v) => (v === null || v === undefined || v === "" ? "NULL" : String(v));
const anio = (s) => { const m = String(s || "").match(/^(\d{4})/); return m ? Number(m[1]) : null; };
const entero = (v) => { const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10); return isNaN(n) ? null : n; };

const COLS = "id, portal, url, title, brand, model, version, year, mileage, price, fuel, "
  + "transmission, power_cv, environmental_label, color, body_type, doors, province, city, "
  + "dealer_name, image_url, images, seller_type, listing_type, country, warranty_months, "
  + "first_seen_at, scraped_at, last_seen_at, is_active";

const ON_CONFLICT = "ON CONFLICT (id) DO UPDATE SET "
  + "price = EXCLUDED.price, "
  + "url = COALESCE(NULLIF(moveadvisor_market_offers.url,''), EXCLUDED.url), "
  + "title = COALESCE(NULLIF(moveadvisor_market_offers.title,''), EXCLUDED.title), "
  + "version = COALESCE(NULLIF(moveadvisor_market_offers.version,''), EXCLUDED.version), "
  + "fuel = COALESCE(NULLIF(moveadvisor_market_offers.fuel,''), EXCLUDED.fuel), "
  + "transmission = COALESCE(NULLIF(moveadvisor_market_offers.transmission,''), EXCLUDED.transmission), "
  + "power_cv = COALESCE(moveadvisor_market_offers.power_cv, EXCLUDED.power_cv), "
  + "environmental_label = COALESCE(NULLIF(moveadvisor_market_offers.environmental_label,''), EXCLUDED.environmental_label), "
  + "color = COALESCE(NULLIF(moveadvisor_market_offers.color,''), EXCLUDED.color), "
  + "body_type = COALESCE(NULLIF(moveadvisor_market_offers.body_type,''), EXCLUDED.body_type), "
  + "doors = COALESCE(moveadvisor_market_offers.doors, EXCLUDED.doors), "
  + "mileage = COALESCE(moveadvisor_market_offers.mileage, EXCLUDED.mileage), "
  + "year = COALESCE(moveadvisor_market_offers.year, EXCLUDED.year), "
  + "dealer_name = COALESCE(NULLIF(moveadvisor_market_offers.dealer_name,''), EXCLUDED.dealer_name), "
  // GREATEST y no EXCLUDED a secas: si nuestro scraper la vio DESPUES del
  // volcado, esa fecha es mejor que la del fichero y no se pisa hacia atras.
  + "last_seen_at = GREATEST(moveadvisor_market_offers.last_seen_at, EXCLUDED.last_seen_at), "
  + "is_active = TRUE, updated_at = NOW()";

async function* lineas(fichero) {
  const gz = fs.createReadStream(fichero).pipe(
    fichero.endsWith(".gz") ? zlib.createGunzip() : new (require("stream").PassThrough)());
  let resto = "";
  for await (const chunk of gz) {
    resto += chunk.toString("utf8");
    const partes = resto.split("\n");
    resto = partes.pop();
    for (const l of partes) {
      if (!l.trim()) continue;
      try { yield JSON.parse(l); } catch (e) { /* una linea rota no para la carga */ }
    }
  }
  if (resto.trim()) { try { yield JSON.parse(resto); } catch (e) {} }
}

function fila(o, cfg, refDay) {
  const id = String(o.article_id || "");
  if (!id) return null;

  const precio = Number(o.price_public_euro);
  const km = entero(o.mileage);
  const y = anio(o.first_registration || o.construction_date || o.created);
  const marca = String(o.make || "").trim();
  const modelo = String(o.model || "").trim();

  if (!(precio >= PRECIO_MIN && precio <= PRECIO_MAX)) return null;
  if (!(km !== null && km >= 0 && km <= KM_MAX)) return null;
  if (!(y && y >= ANIO_MIN && y <= ANIO_MAX)) return null;
  if (!marca || !modelo) return null;

  // La trampa de milanuncios: ahi body_type son las puertas.
  const puertas = cfg.puertasEnBodyType
    ? entero(o.body_type)
    : entero(o.doors);
  const carroceria = cfg.puertasEnBodyType ? "" : String(o.body_type || "");

  const cv = entero(o.power);
  const gar = entero(o.warranty);
  const imgs = Array.isArray(o.img_list) ? o.img_list.slice(0, 15) : [];

  return "(" + [
    txt(cfg.prefijo + id, "id"),
    txt(cfg.portal, "portal"),
    txt(o.url, "url"),
    txt([marca, modelo, o.version].filter(Boolean).join(" "), "title"),
    txt(marca, "brand"),
    txt(modelo, "model"),
    txt(o.version, "version"),
    String(y),
    String(km),
    String(Math.round(precio)),
    txt(combustible(o.fuel), "fuel"),
    txt(cambio(o.gearing), "transmission"),
    cv !== null && cv > 0 && cv < 2000 ? String(cv) : "NULL",
    txt(etiqueta(o.environmental_sticker), "environmental_label"),
    txt(o.body_color, "color"),
    txt(carroceria, "body_type"),
    puertas !== null && puertas >= 1 && puertas <= 7 ? String(puertas) : "NULL",
    txt("", "province"),
    txt(o.city, "city"),
    txt(o.company_name, "dealer_name"),
    txt(imgs[0] || "", "image_url"),
    "'" + JSON.stringify(imgs).replace(/'/g, "''") + "'",
    txt(o.dealer_type === "dealer" ? "profesional" : (o.dealer_type === "private" ? "particular" : ""), "seller_type"),
    txt("compra", "listing_type"),
    txt("ES", "country"),
    gar !== null && gar >= 0 && gar <= 120 ? String(gar) : "NULL",
    "'" + refDay + "'::date",   // first_seen_at
    "'" + refDay + "'::date",   // scraped_at
    "'" + refDay + "'::date",   // last_seen_at: la fecha del VOLCADO
    "TRUE",
  ].join(", ") + ")";
}

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run carga-volcado -- C:\\Users\\Anapi\\Volcados\\2026-09-21\\objects_xxx.jsonl.gz [--ensayo|--aplica]\n");
    process.exit(1);
  }

  let plataforma = null, refDay = null, cfg = null;
  let n = 0, buenas = 0;
  const descartes = { precio: 0, km: 0, anio: 0, marcaModelo: 0, sinId: 0 };
  const filas = [];

  for await (const o of lineas(FICHERO)) {
    if (!plataforma) {
      plataforma = String(o.platform || "");
      refDay = String(o.ref_day || "").slice(0, 10);
      cfg = PORTALES[plataforma];
      if (!cfg) {
        console.log("\n  No sé a qué portal nuestro corresponde «" + plataforma + "».");
        console.log("  Añádelo a PORTALES, con el prefijo de id que use en la tabla.\n");
        process.exit(1);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(refDay)) {
        console.log("\n  El volcado no trae una ref_day válida («" + refDay + "»).");
        console.log("  Sin ella no sé qué fecha poner en last_seen_at, y poner NOW()");
        console.log("  haría que estas filas pasaran por frescas para siempre.\n");
        process.exit(1);
      }
    }
    n++;
    const f = fila(o, cfg, refDay);
    if (f) { filas.push(f); buenas++; continue; }
    // Para el informe: por qué se ha caído
    if (!o.article_id) descartes.sinId++;
    else if (!(Number(o.price_public_euro) >= PRECIO_MIN && Number(o.price_public_euro) <= PRECIO_MAX)) descartes.precio++;
    else if (!(entero(o.mileage) !== null && entero(o.mileage) >= 0 && entero(o.mileage) <= KM_MAX)) descartes.km++;
    else if (!(anio(o.first_registration || o.construction_date || o.created) >= ANIO_MIN)) descartes.anio++;
    else descartes.marcaModelo++;
  }

  console.log("\n  EL VOLCADO");
  console.log("      plataforma : " + plataforma + "   ->  portal '" + cfg.portal + "' (ids '" + cfg.prefijo + "')");
  console.log("      fecha      : " + refDay + "   <- la que se guarda en last_seen_at");
  console.log("      registros  : " + n.toLocaleString("es"));
  console.log("      SIRVEN     : " + buenas.toLocaleString("es") + "   (" + (100 * buenas / n).toFixed(1) + " %)");
  console.log("\n      descartados");
  console.log("        precio fuera de " + PRECIO_MIN + "-" + PRECIO_MAX.toLocaleString("es") + " : " + descartes.precio.toLocaleString("es"));
  console.log("        km fuera de 0-" + KM_MAX.toLocaleString("es") + "        : " + descartes.km.toLocaleString("es"));
  console.log("        año fuera de " + ANIO_MIN + "-" + ANIO_MAX + "         : " + descartes.anio.toLocaleString("es"));
  console.log("        sin marca o sin modelo        : " + descartes.marcaModelo.toLocaleString("es"));
  if (descartes.sinId) console.log("        sin id                        : " + descartes.sinId.toLocaleString("es"));

  const c = new Client({ connectionString: DB_URL, statement_timeout: 900000 });
  await c.connect();
  const antes = (await c.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE is_active)::int vivas
    FROM moveadvisor_market_offers WHERE portal = $1`, [cfg.portal])).rows[0];
  console.log("\n  LO NUESTRO AHORA: " + antes.total.toLocaleString("es")
    + " filas de " + cfg.portal + " (" + antes.vivas.toLocaleString("es") + " vivas)");
  console.log("      quedarían unas " + (antes.total + buenas).toLocaleString("es")
    + ", contando que casi ninguna coincide");

  if (!APLICA && !ENSAYO) {
    console.log("\n  NO SE HA ESCRITO NADA. Para probarlo contra la base sin dejar rastro:");
    console.log("      npm run carga-volcado -- " + path.basename(FICHERO) + " --ensayo");
    console.log("  Y para aplicarlo:");
    console.log("      npm run carga-volcado -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  if (ENSAYO) await c.query("BEGIN");
  console.log("\n  " + (ENSAYO ? "ENSAYO: escribiendo" : "ESCRIBIENDO") + " en lotes de " + POR_LOTE);
  let hechas = 0, lotes = 0;
  for (let i = 0; i < filas.length; i += POR_LOTE) {
    const lote = filas.slice(i, i + POR_LOTE);
    await c.query("INSERT INTO moveadvisor_market_offers (" + COLS + ") VALUES "
      + lote.join(", ") + " " + ON_CONFLICT);
    hechas += lote.length;
    lotes++;
    if (lotes % 100 === 0) console.log("      " + hechas.toLocaleString("es"));
    if (ENSAYO && lotes >= LOTES_ENSAYO) break;
  }

  if (ENSAYO) {
    console.log("\n  ENSAYO CONTRA LA BASE (y deshecho)");
    console.log("      " + hechas.toLocaleString("es") + " filas escritas y aceptadas por Postgres.");
    const m = (await c.query(`SELECT fuel, count(*)::int n FROM moveadvisor_market_offers
      WHERE portal = $1 AND scraped_at = $2::date GROUP BY 1 ORDER BY n DESC LIMIT 6`,
      [cfg.portal, refDay])).rows;
    console.log("      cómo ha quedado el combustible:");
    for (const x of m) console.log("        " + String(x.fuel || "(vacío)").padEnd(14) + x.n);
    const p = (await c.query(`SELECT count(*) FILTER (WHERE doors IS NOT NULL)::int con_puertas,
        count(*) FILTER (WHERE COALESCE(body_type,'') <> '')::int con_carroceria
      FROM moveadvisor_market_offers WHERE portal = $1 AND scraped_at = $2::date`,
      [cfg.portal, refDay])).rows[0];
    console.log("      con puertas: " + p.con_puertas + "   con carrocería: " + p.con_carroceria);
    await c.query("ROLLBACK");
    console.log("      ROLLBACK hecho: la base está como estaba.\n");
    await c.end();
    return;
  }

  const desp = (await c.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE is_active)::int vivas
    FROM moveadvisor_market_offers WHERE portal = $1`, [cfg.portal])).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      filas escritas : " + hechas.toLocaleString("es"));
  console.log("      " + cfg.portal + " : " + antes.total.toLocaleString("es")
    + "  ->  " + desp.total.toLocaleString("es") + "   (" + desp.vivas.toLocaleString("es") + " vivas)");
  console.log("\n      Recuerda: llevan last_seen_at = " + refDay + ", así que salen del");
  console.log("      comparable el " + new Date(new Date(refDay).getTime() + 90 * 86400000)
    .toISOString().slice(0, 10) + ", todas el mismo día.\n");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
