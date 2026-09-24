/**
 * Arregla las potencias que la carga del volcado multiplico por diez.
 *
 *   npm run arregla-potencia              (solo mira)
 *   npm run arregla-potencia -- --aplica
 *
 * QUE PASO
 *
 * El 24-sep-2026 carga-volcado.js metio wallapop y milanuncios. Su funcion
 * entero() hacia esto:
 *
 *     parseInt(String(v).replace(/[^\d-]/g, ""), 10)
 *
 * que QUITA el punto decimal y PEGA los digitos: "90.0" -> 900. El 96 % de los
 * `power` de wallapop y el 93 % de los de milanuncios vienen con decimal, asi
 * que 620.175 coches quedaron con la potencia x10. Un Volkswagen T-Roc de
 * 110 CV aparecia en el buscador como 1.100 CV, y asi lo vio Ana.
 *
 * Y HAY UN SEGUNDO DANO, MAS CALLADO: el cargador descartaba lo que pasara de
 * 2.000 CV. Un coche de 200 CV se convertia en 2.000 y se guardaba como NULL,
 * asi que ademas de los inflados hay coches SIN potencia que si la tenian.
 *
 * COMO SE ARREGLA, Y POR QUE NO DIVIDIENDO ENTRE DIEZ
 *
 * Porque no todos estan mal: el 4 % de los valores venia sin decimal y se
 * guardo bien. Dividir a ciegas romperia esos. Asi que se vuelve a leer el
 * volcado y se recalcula cada uno, que es exacto.
 *
 * Solo se tocan las filas que entraron del volcado -scraped_at = su ref_day- y
 * solo cuando el valor guardado NO coincide con el que sale del fichero.
 */
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");
const POR_LOTE = 2000;
const VOLCADOS = "C:/Users/Anapi/Volcados/2026-09-21/";
const REF = "2026-09-21";

const FICHEROS = [
  ["wallapop", "wp_", "objects_auto_wallapop_com_es_20260921.jsonl.gz"],
  ["milanuncios", "mil_", "objects_auto_milanuncios_com_es_20260921.jsonl.gz"],
];

// La buena: parsea como numero en vez de pegar los digitos.
const entero = (v) => {
  const s = String(v === null || v === undefined ? "" : v).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Math.round(parseFloat(s));
  return isNaN(n) ? null : n;
};

async function* lineas(f) {
  const gz = fs.createReadStream(f).pipe(zlib.createGunzip());
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
  const c = new Client({ connectionString: DB_URL, statement_timeout: 1800000 });
  await c.connect();

  let totalMal = 0, totalVacias = 0, totalBien = 0, totalEscritas = 0;

  for (const [portal, prefijo, fichero] of FICHEROS) {
    const ruta = path.join(VOLCADOS, fichero);
    if (!fs.existsSync(ruta)) { console.log("\n  falta " + fichero + ", me lo salto"); continue; }

    // Lo que tenemos guardado de ese portal, de la carga del volcado.
    const actual = new Map();
    for (const r of (await c.query(
      `SELECT id, power_cv FROM moveadvisor_market_offers
        WHERE portal = $1 AND scraped_at = $2::date`, [portal, REF])).rows) {
      actual.set(r.id, r.power_cv === null ? null : Number(r.power_cv));
    }

    let mal = 0, vacias = 0, bien = 0, fuera = 0;
    const arreglos = [];
    for await (const o of lineas(ruta)) {
      const id = prefijo + String(o.article_id || "");
      if (!actual.has(id)) continue;
      const bueno = entero(o.power);
      const valido = bueno !== null && bueno > 0 && bueno < 2000 ? bueno : null;
      const guardado = actual.get(id);
      if (guardado === valido) { bien++; continue; }
      if (valido === null) { fuera++; continue; }   // no hay dato bueno que poner
      if (guardado === null) vacias++; else mal++;
      arreglos.push([id, valido]);
    }

    console.log("\n  " + portal.toUpperCase() + "   " + actual.size.toLocaleString("es") + " filas del volcado");
    console.log("      ya estaban bien           : " + bien.toLocaleString("es"));
    console.log("      con la potencia x10       : " + mal.toLocaleString("es"));
    console.log("      VACIAS que si tenian dato : " + vacias.toLocaleString("es")
      + "   (las que pasaban de 2.000 al multiplicarse)");
    if (fuera) console.log("      sin dato utilizable       : " + fuera.toLocaleString("es"));
    totalMal += mal; totalVacias += vacias; totalBien += bien;

    if (!APLICA) continue;

    console.log("      escribiendo " + arreglos.length.toLocaleString("es") + "...");
    for (let i = 0; i < arreglos.length; i += POR_LOTE) {
      const lote = arreglos.slice(i, i + POR_LOTE);
      const r = await c.query(
        `UPDATE moveadvisor_market_offers o SET power_cv = v.cv
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::int[]) AS cv) v
          WHERE o.id = v.id AND o.portal = $3`,
        [lote.map((x) => x[0]), lote.map((x) => x[1]), portal]);
      totalEscritas += r.rowCount;
    }
    console.log("      escritas: " + totalEscritas.toLocaleString("es"));
  }

  console.log("\n  EN TOTAL");
  console.log("      correctas ya            : " + totalBien.toLocaleString("es"));
  console.log("      con la potencia x10     : " + totalMal.toLocaleString("es"));
  console.log("      vacias recuperables     : " + totalVacias.toLocaleString("es"));

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run arregla-potencia -- --aplica\n");
    await c.end();
    return;
  }

  const q = (await c.query(`SELECT count(*) FILTER (WHERE power_cv > 700)::int absurdas,
      count(*) FILTER (WHERE power_cv IS NOT NULL)::int con_potencia, count(*)::int total
    FROM moveadvisor_market_offers
    WHERE COALESCE(country,'ES')='ES' AND is_active`)).rows[0];
  console.log("\n  DESPUES, en todas las ofertas espanolas vivas");
  console.log("      con mas de 700 CV : " + q.absurdas.toLocaleString("es") + "   (antes 620.175)");
  console.log("      con potencia      : " + q.con_potencia.toLocaleString("es") + " de " + q.total.toLocaleString("es"));
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
