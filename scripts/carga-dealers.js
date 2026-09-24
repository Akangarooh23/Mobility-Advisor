/**
 * Carga el fichero de vendedores de cualquier portal.
 *
 *   npm run carga-dealers-todos -- <dealers.jsonl.gz>            (solo mira)
 *   npm run carga-dealers-todos -- <dealers.jsonl.gz> --ensayo   (escribe y deshace)
 *   npm run carga-dealers-todos -- <dealers.jsonl.gz> --aplica
 *
 * Hermano de carga-dealers-cochesnet.js, que se queda como está: su trabajo ya
 * está hecho y comprobado sobre aquellas 106.907 fichas.
 *
 * ── QUÉ APORTA, Y NO ES SOLO EL NOMBRE ─────────────────────────────────────
 *
 *                      enlazan      ganan nombre    ganan CP -> provincia
 *     wallapop       579.221 (100%)     579.221            579.203
 *     milanuncios    237.901  (89%)     143.082            237.901
 *
 * LA PROVINCIA ES LO QUE MÁS PESA. El volcado de OFERTAS de wallapop no trae
 * código postal -ninguno de sus 579.264 registros-, así que sus 533.219 filas
 * se cargaron con la provincia vacía. El de VENDEDORES sí lo trae, al 100 %.
 *
 * ── DATOS PERSONALES ───────────────────────────────────────────────────────
 *
 * De las 376.126 fichas de los tres ficheros, 358.887 son PARTICULARES:
 * personas físicas con nombre, ciudad y a veces teléfono.
 *
 *     milanuncios   106.824 particulares   10.538 profesionales
 *     wallapop      237.642               3.452
 *     autoscout24    14.421               3.248
 *
 * Se cargan enteros por decisión de Ana, tomada el 24-sep-2026 después de que
 * se le presentara el reparto y tres alternativas: solo profesionales, o
 * rellenar la provincia sin guardar ninguna ficha. Queda escrito porque dentro
 * de un año nadie se acordará de que fue una decisión y no un descuido.
 *
 * Para deshacerlo:
 *
 *     DELETE FROM moveadvisor_market_dealers WHERE dealer_type = 'particular';
 *     UPDATE moveadvisor_market_offers SET dealer_name = NULL
 *      WHERE portal IN ('wallapop','milanuncios','autoscout24')
 *        AND seller_type = 'particular';
 *
 * ── LA PROVINCIA SE ESCRIBE LIMPIA AUNQUE EL RESTO NO LO ESTÉ ──────────────
 *
 * La columna `province` de la tabla es un desastre heredado: 17.639 valores
 * distintos, con municipios metidos entre las provincias -«LAS ROZAS», «SANT
 * ANDREU», «PATERNA»- y mayúsculas a medias -«MADRID» y «Madrid» conviven-.
 *
 * Lo que entra por aquí va con el nombre oficial de la provincia en formato
 * normal, que es la convención de las filas limpias. No se arregla lo que ya
 * había: eso es otra tarea y mezclarla con esta haría imposible saber qué tocó
 * cada cosa.
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

const PORTALES = {
  "coches.net": { portal: "cochesnet", prefijo: "cn_" },
  "autoscout24.es": { portal: "autoscout24", prefijo: "as_" },
  "milanuncios.com": { portal: "milanuncios", prefijo: "mil_" },
  "wallapop.com": { portal: "wallapop", prefijo: "wp_" },
};

// Los dos primeros dígitos del código postal español dan la provincia.
const PROVINCIAS = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
  "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
  "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
  "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel",
  "45": "Toledo", "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora",
  "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};
function provincia(cp) {
  const s = String(cp || "").replace(/\D/g, "").padStart(5, "0");
  if (s.length !== 5 || s === "00000") return null;
  return PROVINCIAS[s.slice(0, 2)] || null;
}

const TIPO = { dealer: "profesional", private: "particular" };
const LARGO = { portal: 40, dealer_id: 80, dealer_type: 20, company_name: 200,
  company_url: 300, profile_url: 300, phone: 40, street: 200, city: 120,
  region: 80, zip_code: 10, culture: 10 };
function txt(v, col) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const max = LARGO[col];
  return max && s.length > max ? s.slice(0, max) : s;
}
function esc(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
const fecha = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const COLS = ["portal", "dealer_id", "dealer_type", "company_name", "company_url",
  "profile_url", "phone", "street", "city", "region", "zip_code", "created",
  "dealer_since", "has_logo", "culture", "ref_day"];
const ON_CONFLICT = "ON CONFLICT (portal, dealer_id) DO UPDATE SET "
  + COLS.slice(2).map((k) => k + " = COALESCE(EXCLUDED." + k + ", moveadvisor_market_dealers." + k + ")").join(", ")
  + ", updated_at = NOW()";

async function* lineas(f) {
  const gz = fs.createReadStream(f).pipe(
    f.endsWith(".gz") ? zlib.createGunzip() : new (require("stream").PassThrough)());
  let resto = "";
  for await (const ch of gz) {
    resto += ch.toString("utf8");
    const p = resto.split("\n");
    resto = p.pop();
    for (const l of p) { if (!l.trim()) continue; try { yield JSON.parse(l); } catch (e) {} }
  }
  if (resto.trim()) { try { yield JSON.parse(resto); } catch (e) {} }
}

(async () => {
  if (!FICHERO || !fs.existsSync(FICHERO)) {
    console.log("\n  Falta el fichero. Uso:");
    console.log("      npm run carga-dealers-todos -- C:\\Users\\Anapi\\Volcados\\2026-09-21\\dealers_xxx.jsonl.gz [--ensayo|--aplica]\n");
    process.exit(1);
  }

  let plataforma = null, refDay = null, cfg = null;
  const fichas = [];
  const cuenta = { profesional: 0, particular: 0, otro: 0 };
  let conTel = 0, conCp = 0, cpIlegible = 0;

  for await (const o of lineas(FICHERO)) {
    if (!plataforma) {
      plataforma = String(o.platform || "");
      refDay = fecha(o.ref_day);
      cfg = PORTALES[plataforma];
      if (!cfg) {
        console.log("\n  No sé a qué portal nuestro corresponde «" + plataforma + "».\n");
        process.exit(1);
      }
    }
    const tipo = TIPO[String(o.dealer_type || "")] || "otro";
    cuenta[tipo]++;
    if (o.phone) conTel++;
    if (o.zip_code) { if (provincia(o.zip_code)) conCp++; else cpIlegible++; }
    const id = txt(o.dealer_id, "dealer_id");
    if (!id) continue;
    fichas.push({
      portal: cfg.portal, dealer_id: id,
      dealer_type: tipo === "otro" ? null : tipo,
      company_name: txt(o.company_name, "company_name"),
      company_url: txt(o.company_url, "company_url"),
      profile_url: txt(o.name, "profile_url"),
      phone: txt(o.phone, "phone"),
      street: txt(o.street, "street"),
      city: txt(o.city, "city"),
      region: txt(o.region, "region"),
      zip_code: txt(o.zip_code, "zip_code"),
      created: fecha(o.created), dealer_since: fecha(o.dealer_since),
      has_logo: typeof o.has_logo === "boolean" ? o.has_logo : null,
      culture: txt(o.culture, "culture"), ref_day: refDay,
    });
  }

  console.log("\n  EL FICHERO DE VENDEDORES");
  console.log("      plataforma    : " + plataforma + "   ->  portal '" + cfg.portal + "'");
  console.log("      fecha         : " + refDay);
  console.log("      fichas        : " + fichas.length.toLocaleString("es"));
  console.log("      profesionales : " + cuenta.profesional.toLocaleString("es"));
  console.log("      particulares  : " + cuenta.particular.toLocaleString("es") + "   <- personas físicas");
  if (cuenta.otro) console.log("      tipo raro     : " + cuenta.otro.toLocaleString("es"));
  console.log("      con teléfono  : " + conTel.toLocaleString("es"));
  console.log("      con CP que da provincia: " + conCp.toLocaleString("es")
    + (cpIlegible ? "   (ilegibles: " + cpIlegible.toLocaleString("es") + ")" : ""));

  const c = new Client({ connectionString: DB_URL, statement_timeout: 1800000 });
  await c.connect();

  if (!APLICA && !ENSAYO) {
    console.log("\n  NO SE HA ESCRITO NADA. Para probarlo sin dejar rastro:");
    console.log("      npm run carga-dealers-todos -- " + path.basename(FICHERO) + " --ensayo");
    console.log("  Y para aplicarlo:");
    console.log("      npm run carga-dealers-todos -- " + path.basename(FICHERO) + " --aplica\n");
    await c.end();
    return;
  }

  if (ENSAYO) await c.query("BEGIN");

  // ── 1. Las fichas ────────────────────────────────────────────────────────
  console.log("\n  " + (ENSAYO ? "ENSAYO: escribiendo" : "ESCRIBIENDO") + " las fichas");
  let hechas = 0, lotes = 0;
  for (let i = 0; i < fichas.length; i += POR_LOTE) {
    const lote = fichas.slice(i, i + POR_LOTE);
    const vals = lote.map((f) => "(" + COLS.map((k) => (
      (k === "created" || k === "dealer_since" || k === "ref_day")
        ? (f[k] ? "'" + f[k] + "'::date" : "NULL") : esc(f[k]))).join(",") + ")").join(",");
    await c.query("INSERT INTO moveadvisor_market_dealers (" + COLS.join(",") + ") VALUES "
      + vals + " " + ON_CONFLICT);
    hechas += lote.length; lotes++;
    if (lotes % 50 === 0) console.log("      " + hechas.toLocaleString("es"));
    if (ENSAYO && lotes >= LOTES_ENSAYO) break;
  }
  console.log("      fichas escritas: " + hechas.toLocaleString("es"));

  // ── 2. Nombre y provincia en las ofertas ─────────────────────────────────
  /*
   * Las ofertas no guardan dealer_id, así que el puente hay que reconstruirlo
   * leyendo el volcado de ofertas del mismo portal: article_id -> dealer_id ->
   * ficha. Por nombre de texto no vale: es el cruce que un día casa
   * «MundiCars» con «Mundicars S.L.» y otro no.
   */
  const OFERTAS = path.join(path.dirname(FICHERO),
    path.basename(FICHERO).replace(/^dealers_/, "objects_"));
  if (!fs.existsSync(OFERTAS)) {
    console.log("\n  NO se rellenan las ofertas: falta " + path.basename(OFERTAS) + " al lado.");
  } else {
    const nombre = new Map(), prov = new Map();
    for (const f of fichas) {
      if (f.company_name) nombre.set(f.dealer_id, f.company_name.slice(0, 200));
      const p = provincia(f.zip_code);
      if (p) prov.set(f.dealer_id, p);
    }
    console.log("\n  " + (ENSAYO ? "ENSAYO: rellenando" : "RELLENANDO") + " nombre y provincia en las ofertas");
    let pares = [], nom = 0, pro = 0, sinFicha = 0, lotesU = 0;
    const vaciar = async () => {
      if (!pares.length) return;
      /*
       * Solo se escribe donde está vacío -COALESCE(...,'') = ''-: lo que puso
       * el enriquecedor mirando la ficha de verdad manda sobre lo que deduzco
       * yo del código postal del vendedor, que es el de su sede y no
       * necesariamente el del coche.
       *
       * El '' final del COALESCE no es adorno: las cuatro columnas de texto de
       * esta tabla son NOT NULL con default ''. Sin él, una fila cuyo vendedor
       * no tenga ni nombre ni código postal deja el COALESCE en NULL y Postgres
       * corta la carga entera con «null value violates not-null constraint».
       * Lo cazó el --ensayo en el primer lote.
       */
      const r = await c.query(
        `UPDATE moveadvisor_market_offers o
            SET dealer_name = COALESCE(NULLIF(o.dealer_name,''), NULLIF(v.nombre,''), ''),
                province    = COALESCE(NULLIF(o.province,''),    NULLIF(v.prov,''),   '')
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS nombre,
                        unnest($3::text[]) AS prov) v
          WHERE o.id = v.id AND o.portal = $4
            AND (COALESCE(o.dealer_name,'') = '' OR COALESCE(o.province,'') = '')`,
        [pares.map((p) => p[0]), pares.map((p) => p[1] || ""), pares.map((p) => p[2] || ""), cfg.portal]);
      pares = []; lotesU++;
      if (lotesU % 100 === 0) console.log("      " + (nom + pro).toLocaleString("es") + " datos puestos");
    };
    for await (const o of lineas(OFERTAS)) {
      const id = String(o.dealer_id || "");
      const n = nombre.get(id), p = prov.get(id);
      if (!n && !p) { sinFicha++; continue; }
      if (n) nom++;
      if (p) pro++;
      pares.push([cfg.prefijo + String(o.article_id), n || "", p || ""]);
      if (pares.length >= POR_LOTE) {
        await vaciar();
        if (ENSAYO && lotesU >= LOTES_ENSAYO) break;
      }
    }
    if (!(ENSAYO && lotesU >= LOTES_ENSAYO)) await vaciar();
    console.log("      ofertas con nombre disponible   : " + nom.toLocaleString("es"));
    console.log("      ofertas con provincia disponible: " + pro.toLocaleString("es"));
    console.log("      sin ficha que las cubra         : " + sinFicha.toLocaleString("es"));
  }

  if (ENSAYO) {
    const m = (await c.query(`SELECT count(*)::int fichas,
        count(*) FILTER (WHERE dealer_type='particular')::int particulares
      FROM moveadvisor_market_dealers WHERE portal = $1`, [cfg.portal])).rows[0];
    const p = (await c.query(`SELECT count(*) FILTER (WHERE COALESCE(province,'') <> '')::int con_prov,
        count(*) FILTER (WHERE COALESCE(dealer_name,'') <> '')::int con_nombre
      FROM moveadvisor_market_offers WHERE portal = $1`, [cfg.portal])).rows[0];
    console.log("\n  ENSAYO CONTRA LA BASE (y deshecho)");
    console.log("      fichas del portal en la tabla: " + m.fichas.toLocaleString("es")
      + "   (particulares: " + m.particulares.toLocaleString("es") + ")");
    console.log("      ofertas con provincia: " + p.con_prov.toLocaleString("es")
      + "   con nombre: " + p.con_nombre.toLocaleString("es"));
    await c.query("ROLLBACK");
    console.log("      ROLLBACK hecho: la base está como estaba.\n");
    await c.end();
    return;
  }

  const fin = (await c.query(`SELECT
      (SELECT count(*)::int FROM moveadvisor_market_dealers WHERE portal = $1) fichas,
      (SELECT count(*)::int FROM moveadvisor_market_offers
        WHERE portal = $1 AND COALESCE(province,'') <> '') con_prov,
      (SELECT count(*)::int FROM moveadvisor_market_offers
        WHERE portal = $1 AND COALESCE(dealer_name,'') <> '') con_nombre,
      (SELECT count(*)::int FROM moveadvisor_market_offers WHERE portal = $1) total`,
    [cfg.portal])).rows[0];
  console.log("\n  DESPUÉS  (" + cfg.portal + ")");
  console.log("      fichas de vendedor    : " + fin.fichas.toLocaleString("es"));
  console.log("      ofertas con provincia : " + fin.con_prov.toLocaleString("es") + " de " + fin.total.toLocaleString("es"));
  console.log("      ofertas con nombre    : " + fin.con_nombre.toLocaleString("es"));
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
