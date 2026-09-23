/**
 * Carga el fichero de vendedores de coches.net.
 *
 *   npm run carga-dealers -- <dealers.jsonl.gz>             (solo mira)
 *   npm run carga-dealers -- <dealers.jsonl.gz> --ensayo    (escribe y deshace)
 *   npm run carga-dealers -- <dealers.jsonl.gz> --aplica
 *
 * QUÉ ES
 *
 * El tercer fichero del volcado del 21-sep-2026, el que no se había cargado:
 * 106.907 vendedores de coches.net. Hace dos cosas:
 *
 *   1. Crea moveadvisor_market_dealers y mete las 106.907 fichas.
 *   2. Rellena dealer_name en las ofertas de coches.net, que está VACÍO en
 *      282.130 de 282.280. Hoy sabemos que un coche lo vende un profesional
 *      pero no cuál.
 *
 * DATOS PERSONALES: 99.920 DE LAS 106.907 SON PARTICULARES
 *
 * Se carga entero por decisión de Ana, dicha el 23-sep-2026 después de que se
 * le presentara el reparto y la alternativa de cargar solo los 6.987
 * profesionales. Queda escrito aquí porque dentro de un año nadie se acordará
 * de que fue una decisión y no un descuido:
 *
 *     profesionales    6.987    los 6.987 con teléfono
 *     particulares    99.920    727 con teléfono
 *
 * De los particulares lo que hay es un nombre de pila -«Bernardo»- y una
 * ciudad. Son personas físicas. Si algún día hay que borrarlos:
 *
 *     DELETE FROM moveadvisor_market_dealers WHERE dealer_type = 'particular';
 *     UPDATE moveadvisor_market_offers SET dealer_name = NULL
 *      WHERE portal = 'cochesnet' AND seller_type = 'particular';
 *
 * EL CRUCE ESTÁ COMPROBADO, NO SUPUESTO
 *
 * Los dealer_id vienen en tres formatos -numéricos, hashes de 64 y otros- y
 * parecía que el fichero de vendedores y el de ofertas usaban formatos
 * distintos. Se cruzaron los dos ficheros enteros: de las 284.661 ofertas con
 * dealer_id, enlazan las 284.661. El 100 %.
 *
 * NUEVE CAMPOS NO EXISTEN
 *
 * company_email, email_1, email_2, email_3, phone_1, phone_2, phone_3, fax_no
 * y owner vienen vacíos en las 106.907 fichas, sin una sola excepción. No se
 * les crea columna: una columna que siempre es NULL solo sirve para que dentro
 * de seis meses alguien la cruce y crea que ha perdido los datos.
 *
 * El teléfono bueno es `phone`, que sí viene en 7.714.
 *
 * Y `name` no es un nombre: es la URL de la ficha en coches.net. Se guarda
 * como profile_url, con su nombre de verdad.
 */
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const FICHERO = process.argv.find((a) => a.indexOf(".jsonl.gz") !== -1);
const APLICA = process.argv.includes("--aplica");
/*
 * --ensayo escribe de verdad los primeros lotes y luego hace ROLLBACK.
 *
 * Un ensayo que no toca la base no prueba nada: los fallos que importan -un
 * texto que no cabe, un tipo que no cuadra, una clave repetida- solo aparecen
 * cuando Postgres los ve. En Autohero un «ciudad» de 136 caracteres reventó
 * una columna de 120 en la primera ejecución de verdad.
 */
const ENSAYO = process.argv.includes("--ensayo");
const LOTES_ENSAYO = 6;
const POR_LOTE = 500;

const DDL = `CREATE TABLE IF NOT EXISTS moveadvisor_market_dealers (
  portal        varchar(40)  NOT NULL,
  dealer_id     varchar(80)  NOT NULL,
  dealer_type   varchar(20),
  company_name  varchar(200),
  company_url   varchar(300),
  profile_url   varchar(300),
  phone         varchar(40),
  street        varchar(200),
  city          varchar(120),
  region        varchar(80),
  zip_code      varchar(10),
  created       date,
  dealer_since  date,
  has_logo      boolean,
  culture       varchar(10),
  ref_day       date,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portal, dealer_id)
)`;
// Las columnas van holgadas respecto a lo medido -company_name llega a 100 y
// se le dan 200, street a 50 y se le dan 200- porque el siguiente volcado no
// tiene por qué parecerse a este.

const IDX = [
  // Para «¿qué stock tiene este concesionario?», que es la pregunta que
  // justifica la tabla.
  "CREATE INDEX IF NOT EXISTS idx_dealers_nombre ON moveadvisor_market_dealers (portal, company_name)",
  "CREATE INDEX IF NOT EXISTS idx_dealers_tipo ON moveadvisor_market_dealers (portal, dealer_type)",
];

const COLS = ["portal", "dealer_id", "dealer_type", "company_name", "company_url",
  "profile_url", "phone", "street", "city", "region", "zip_code", "created",
  "dealer_since", "has_logo", "culture", "ref_day"];

const ON_CONFLICT = "ON CONFLICT (portal, dealer_id) DO UPDATE SET "
  + COLS.slice(2).map((k) => k + " = EXCLUDED." + k).join(", ")
  + ", updated_at = NOW()";

// Los mismos nombres que en las ofertas, para que 'profesional' signifique lo
// mismo en las dos tablas y se puedan cruzar sin traducir.
const TIPO = { dealer: "profesional", private: "particular" };

const LARGO = { portal: 40, dealer_id: 80, dealer_type: 20, company_name: 200,
  company_url: 300, profile_url: 300, phone: 40, street: 200, city: 120,
  region: 80, zip_code: 10, culture: 10 };

function esc(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function txt(v, col) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const max = LARGO[col];
  return max && s.length > max ? s.slice(0, max) : s;
}
function fecha(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function* lineas(fichero) {
  const gz = fs.createReadStream(fichero).pipe(zlib.createGunzip());
  let resto = "";
  for await (const chunk of gz) {
    resto += chunk.toString("utf8");
    const partes = resto.split("\n");
    resto = partes.pop();
    for (const l of partes) {
      if (!l.trim()) continue;
      try { yield JSON.parse(l); } catch (e) { /* una línea rota no para la carga */ }
    }
  }
  if (resto.trim()) { try { yield JSON.parse(resto); } catch (e) { /* idem */ } }
}

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run carga-dealers -- C:\\Users\\Anapi\\Volcados\\2026-09-21\\dealers_cochesnet.jsonl.gz [--ensayo|--aplica]\n");
    process.exit(1);
  }

  // ── Leer y contar antes de tocar nada ────────────────────────────────────
  const fichas = [];
  const cuenta = { profesional: 0, particular: 0, otro: 0 };
  let conTelefono = 0, sinNombre = 0, recortados = 0;
  let refDay = null, plataforma = null;

  for await (const o of lineas(FICHERO)) {
    if (!plataforma) { plataforma = String(o.platform || ""); refDay = fecha(o.ref_day); }
    const tipo = TIPO[String(o.dealer_type || "")] || "otro";
    cuenta[tipo] = (cuenta[tipo] || 0) + 1;
    if (o.phone) conTelefono++;
    if (!o.company_name) sinNombre++;
    const f = {
      portal: "cochesnet",
      dealer_id: txt(o.dealer_id, "dealer_id"),
      dealer_type: tipo === "otro" ? null : tipo,
      company_name: txt(o.company_name, "company_name"),
      company_url: txt(o.company_url, "company_url"),
      profile_url: txt(o.name, "profile_url"),
      phone: txt(o.phone, "phone"),
      street: txt(o.street, "street"),
      city: txt(o.city, "city"),
      region: txt(o.region, "region"),
      zip_code: txt(o.zip_code, "zip_code"),
      created: fecha(o.created),
      dealer_since: fecha(o.dealer_since),
      has_logo: typeof o.has_logo === "boolean" ? o.has_logo : null,
      culture: txt(o.culture, "culture"),
      ref_day: refDay,
    };
    for (const k of Object.keys(LARGO)) {
      if (o[k === "profile_url" ? "name" : k] && f[k]
        && String(o[k === "profile_url" ? "name" : k]).trim().length > f[k].length) recortados++;
    }
    if (f.dealer_id) fichas.push(f);
  }

  console.log("\n  EL FICHERO");
  console.log("      plataforma   : " + plataforma + "   fecha: " + refDay);
  console.log("      fichas       : " + fichas.length.toLocaleString("es"));
  console.log("      profesionales: " + (cuenta.profesional || 0).toLocaleString("es"));
  console.log("      particulares : " + (cuenta.particular || 0).toLocaleString("es") + "   <- personas físicas");
  if (cuenta.otro) console.log("      tipo raro    : " + cuenta.otro.toLocaleString("es") + "   (se guardan con tipo NULL)");
  console.log("      con teléfono : " + conTelefono.toLocaleString("es"));
  console.log("      sin nombre   : " + sinNombre.toLocaleString("es"));
  if (recortados) console.log("      recortados por longitud: " + recortados);

  const ids = new Set(fichas.map((f) => f.dealer_id));
  if (ids.size !== fichas.length) {
    console.log("\n      OJO: " + (fichas.length - ids.size).toLocaleString("es")
      + " dealer_id repetidos. El upsert se queda con el último de cada uno.");
  }

  const c = new Client({ connectionString: DB_URL, statement_timeout: 900000 });
  await c.connect();

  if (!APLICA && !ENSAYO) {
    const existe = (await c.query("SELECT to_regclass('moveadvisor_market_dealers') t")).rows[0].t;
    console.log("\n      la tabla " + (existe ? "YA existe" : "NO existe todavía, se creará"));
    console.log("\n  NO SE HA ESCRITO NADA. Para probarlo contra la base sin dejar rastro:");
    console.log("      npm run carga-dealers -- " + path.basename(FICHERO) + " --ensayo");
    console.log("  Y para aplicarlo:");
    console.log("      npm run carga-dealers -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  if (ENSAYO) await c.query("BEGIN");
  await c.query(DDL);
  for (const q of IDX) await c.query(q);

  // ── 1. Las fichas ────────────────────────────────────────────────────────
  console.log("\n  " + (ENSAYO ? "ENSAYO: escribiendo" : "ESCRIBIENDO") + " las fichas");
  let hechas = 0, lotes = 0;
  for (let i = 0; i < fichas.length; i += POR_LOTE) {
    const lote = fichas.slice(i, i + POR_LOTE);
    const valores = lote.map((f) => "(" + COLS.map((k) => {
      if (k === "created" || k === "dealer_since" || k === "ref_day") {
        return f[k] ? "'" + f[k] + "'::date" : "NULL";
      }
      return esc(f[k]);
    }).join(",") + ")").join(",");
    await c.query("INSERT INTO moveadvisor_market_dealers (" + COLS.join(",")
      + ") VALUES " + valores + " " + ON_CONFLICT);
    hechas += lote.length;
    lotes++;
    if (lotes % 40 === 0) console.log("      " + hechas.toLocaleString("es"));
    if (ENSAYO && lotes >= LOTES_ENSAYO) break;
  }
  console.log("      fichas escritas: " + hechas.toLocaleString("es"));

  // ── 2. El nombre del vendedor en las ofertas ─────────────────────────────
  /*
   * Las ofertas NO guardan dealer_id, así que el puente hay que reconstruirlo
   * leyendo el volcado de ofertas: article_id -> dealer_id -> nombre.
   *
   * Sin él solo se podría cruzar por nombre de texto, que es exactamente el
   * tipo de cruce que un día casa «MundiCars» con «Mundicars S.L.» y otro no.
   */
  const VOLCADO_OFERTAS = path.join(path.dirname(FICHERO), "objects_cochesnet.jsonl.gz");
  if (!fs.existsSync(VOLCADO_OFERTAS)) {
    console.log("\n  NO se rellena dealer_name: falta " + path.basename(VOLCADO_OFERTAS)
      + " al lado del fichero de vendedores.");
  } else {
    const nombre = new Map();
    for (const f of fichas) if (f.company_name) nombre.set(f.dealer_id, f.company_name.slice(0, 200));

    console.log("\n  " + (ENSAYO ? "ENSAYO: rellenando" : "RELLENANDO") + " dealer_name en las ofertas");
    let pares = [], puestos = 0, sinFicha = 0, lotesU = 0;
    const vaciar = async () => {
      if (!pares.length) return;
      // El nombre va por parámetro, no interpolado: aquí hay apóstrofos de
      // verdad -«Casa d'Or»- y nombres que vienen del fichero, no de nosotros.
      const r = await c.query(
        `UPDATE moveadvisor_market_offers o SET dealer_name = v.nombre
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS nombre) v
          WHERE o.id = v.id AND o.portal = 'cochesnet'
            AND COALESCE(o.dealer_name, '') = ''`,
        [pares.map((p) => p[0]), pares.map((p) => p[1])]);
      puestos += r.rowCount;
      pares = [];
      lotesU++;
      if (lotesU % 40 === 0) console.log("      " + puestos.toLocaleString("es"));
    };
    for await (const o of lineas(VOLCADO_OFERTAS)) {
      const n = nombre.get(String(o.dealer_id || ""));
      if (!n) { sinFicha++; continue; }
      pares.push(["cn_" + String(o.article_id), n]);
      if (pares.length >= POR_LOTE) {
        await vaciar();
        if (ENSAYO && lotesU >= LOTES_ENSAYO) break;
      }
    }
    if (!(ENSAYO && lotesU >= LOTES_ENSAYO)) await vaciar();
    console.log("      ofertas con nombre puesto : " + puestos.toLocaleString("es"));
    console.log("      ofertas sin ficha o sin nombre de empresa: " + sinFicha.toLocaleString("es"));
  }

  // updated_at de las ofertas NO se toca: esto no es que el anuncio haya
  // cambiado, es que nosotros nos hemos enterado de quién lo vende.

  if (ENSAYO) {
    console.log("\n  ENSAYO CONTRA LA BASE (y deshecho)");
    console.log("      " + LOTES_ENSAYO + " lotes de " + POR_LOTE + " por cada paso.");
    console.log("      Postgres ha aceptado la tabla, los índices y los dos escritos.");
    await c.query("ROLLBACK");
    console.log("      ROLLBACK hecho: la base está como estaba.\n");
    await c.end();
    return;
  }

  const fin = (await c.query(`SELECT
      (SELECT count(*)::int FROM moveadvisor_market_dealers) fichas,
      (SELECT count(*)::int FROM moveadvisor_market_dealers WHERE dealer_type = 'profesional') profs,
      (SELECT count(*)::int FROM moveadvisor_market_offers
        WHERE portal = 'cochesnet' AND COALESCE(dealer_name,'') <> '') con_nombre`)).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      fichas en la tabla          : " + fin.fichas.toLocaleString("es")
    + "   (profesionales: " + fin.profs.toLocaleString("es") + ")");
  console.log("      ofertas de coches.net con nombre de vendedor: " + fin.con_nombre.toLocaleString("es"));

  const top = (await c.query(`SELECT o.dealer_name, count(*)::int n
    FROM moveadvisor_market_offers o
    WHERE o.portal = 'cochesnet' AND o.seller_type = 'profesional'
      AND COALESCE(o.dealer_name,'') <> ''
    GROUP BY 1 ORDER BY n DESC LIMIT 5`)).rows;
  if (top.length) {
    console.log("\n      los cinco con más stock:");
    for (const t of top) console.log("        " + String(t.n).padStart(5) + "  " + t.dealer_name);
  }
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
