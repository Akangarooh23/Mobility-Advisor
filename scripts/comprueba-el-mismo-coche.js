/**
 * Comprueba lib/el-mismo-coche.js contra la base de verdad.
 *
 *   npm run test:mismo-coche
 *
 * Nada de SQL de mentira: se ejecuta contra el pool real y se mira que salgan
 * los números que se esperan. Un agrupador que agrupa de más esconde coches, y
 * uno que agrupa de menos no sirve para nada; las dos cosas se ven aquí.
 *
 * SOLO LEE. No escribe una fila.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { agrupaPorCoche, huellaSql, normalizaProvincia } = require("../lib/el-mismo-coche");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

let fallos = 0;
const ok = (b, t, extra) => {
  console.log((b ? "  ok    " : "  FALLA ") + t + (extra ? "   " + extra : ""));
  if (!b) fallos++;
};

// Lo presentable, como lo define el consejero, mas el precio minimo nuevo.
const PRESENTABLE = `COALESCE(country,'ES')='ES' AND is_active
  AND COALESCE(image_url,'') <> '' AND price BETWEEN 4500 AND 200000
  AND (mileage IS NULL OR mileage BETWEEN 0 AND 500000) AND es_coche IS NOT FALSE`;

const COLUMNAS = "id, portal, province, brand, model, version, year, mileage, fuel, power_cv, price, image_url";
const interior = (extra) => `SELECT ${COLUMNAS} FROM moveadvisor_market_offers
   WHERE ${PRESENTABLE} ${extra}`;

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 600000 });
  await c.connect();

  // ── El caso que lo motiva ────────────────────────────────────────────────
  console.log("\nEL T-ROC, QUE ES DONDE SE VIO");
  const filtro = " AND lower(brand)='volkswagen' AND lower(model) LIKE '%t-roc%'";
  const sinAgrupar = Number((await c.query(
    `SELECT count(*)::int n FROM (${interior(filtro)}) z`)).rows[0].n);

  const a = agrupaPorCoche(interior(filtro), {});
  const filas = (await c.query(`SELECT count(*)::int n FROM (${a.sql}) z`, a.valores)).rows[0].n;
  console.log("      sin agrupar: " + sinAgrupar.toLocaleString("es")
    + "   agrupado: " + Number(filas).toLocaleString("es"));
  ok(filas < sinAgrupar, "agrupa: salen menos tarjetas que filas");
  ok(filas > sinAgrupar * 0.5,
    "pero no se pasa: sigue habiendo mas de la mitad", "(" + Math.round(100 * filas / sinAgrupar) + " %)");

  // Cada tarjeta, un coche distinto: no puede repetirse ninguna huella.
  const rep = (await c.query(
    `SELECT count(*)::int n FROM (
       SELECT ${huellaSql("z")} FROM (${a.sql}) z GROUP BY ${huellaSql("z")} HAVING count(*) > 1) y`,
    a.valores)).rows[0].n;
  ok(Number(rep) === 0, "ninguna huella sale dos veces", "(" + rep + " repetidas)");

  // ── Lo que la tarjeta cuenta ─────────────────────────────────────────────
  console.log("\nLO QUE SE LE ENSENA AL CLIENTE");
  const muestra = (await c.query(
    `SELECT price, mileage, power_cv, copias, provincias, portales
       FROM (${a.sql}) z WHERE copias > 1 ORDER BY copias DESC LIMIT 3`, a.valores)).rows;
  for (const m of muestra) {
    console.log("      " + String(m.copias).padStart(2) + " anuncios   "
      + Number(m.price).toLocaleString("es") + " EUR   " + m.power_cv + " CV   "
      + (m.provincias || []).join(", ").slice(0, 52));
  }
  ok(muestra.length > 0, "hay grupos de varios anuncios");
  ok(muestra.every((m) => Array.isArray(m.provincias)), "cada uno trae su lista de provincias");
  // La normalizacion: sin ella la tarjeta diria "CORDOBA, Córdoba" como si
  // fueran dos sitios distintos.
  ok(muestra.every((m) => (m.provincias || []).every((p) => p === p.toLowerCase())),
    "las provincias vienen normalizadas, sin mayusculas sueltas");
  ok(muestra.every((m) => new Set(m.provincias || []).size === (m.provincias || []).length),
    "y sin repetir la misma provincia dos veces");

  // ── El representante ─────────────────────────────────────────────────────
  console.log("\nQUE ANUNCIO DEL GRUPO SE ENSENA");
  /*
   * El precio esta DENTRO de la huella, asi que todas las copias de un grupo
   * valen lo mismo y "el mas barato" no distingue nada. Lo que hay que
   * comprobar es que el representante sea uno de los anuncios del grupo -no
   * una fila inventada- y que el desempate por id menor se cumpla.
   *
   * La primera version de esto comparaba contra el minimo de las filas con
   * igual marca/modelo/version/ano/km/CV, SIN el precio: o sea, contra otros
   * grupos. Daba 353 "fallos" que no lo eran.
   */
  const noEsElMenor = (await c.query(
    `WITH t AS (${a.sql})
     SELECT count(*)::int n FROM t
      WHERE t.id <> (SELECT min(o.id) FROM moveadvisor_market_offers o
                      WHERE ${PRESENTABLE} ${filtro}
                        AND o.brand = t.brand AND o.model = t.model
                        AND COALESCE(o.version,'') = COALESCE(t.version,'')
                        AND o.year = t.year AND o.mileage = t.mileage
                        AND o.fuel IS NOT DISTINCT FROM t.fuel
                        AND o.power_cv IS NOT DISTINCT FROM t.power_cv
                        AND o.price = t.price)`,
    a.valores)).rows[0].n;
  ok(Number(noEsElMenor) === 0, "el representante es un anuncio real del grupo, el de id menor",
    "(" + noEsElMenor + " que no)");

  // Dos veces la misma consulta tiene que dar lo mismo: sin un desempate fijo,
  // el representante cambiaria entre una busqueda y la siguiente.
  const uno = (await c.query(`SELECT id FROM (${a.sql}) z ORDER BY price, id LIMIT 30`, a.valores)).rows.map((x) => x.id);
  const dos = (await c.query(`SELECT id FROM (${a.sql}) z ORDER BY price, id LIMIT 30`, a.valores)).rows.map((x) => x.id);
  ok(uno.join() === dos.join(), "y es el mismo si se repite la busqueda");

  // ── El filtro de provincia ───────────────────────────────────────────────
  console.log("\nFILTRAR POR PROVINCIA");
  const conProv = (await c.query(
    `SELECT unnest(provincias) p, count(*)::int n FROM (${a.sql}) z
      GROUP BY 1 ORDER BY n DESC LIMIT 1`, a.valores)).rows[0];
  if (!conProv) {
    ok(false, "no encuentro ninguna provincia para probar");
  } else {
    const p = agrupaPorCoche(interior(filtro), { provincia: conProv.p });
    const n = (await c.query(`SELECT count(*)::int n FROM (${p.sql}) z`, p.valores)).rows[0].n;
    console.log("      filtrando por «" + conProv.p + "»: " + Number(n).toLocaleString("es")
      + " de " + Number(filas).toLocaleString("es"));
    ok(Number(n) > 0, "devuelve coches");
    ok(Number(n) < Number(filas), "y menos que sin filtrar");
    /*
     * El filtro usa LIKE, igual que el del consejero, asi que "madrid" tambien
     * encuentra "las rozas de madrid". Contar coincidencias EXACTAS daba 770
     * contra 800 y parecia un fallo del agrupador; era mi cuenta.
     */
    const conLike = (await c.query(
      `SELECT count(*)::int n FROM (${a.sql}) z
        WHERE EXISTS (SELECT 1 FROM unnest(z.provincias) p WHERE p LIKE $${a.valores.length + 1})`,
      [...a.valores, "%" + conProv.p + "%"])).rows[0].n;
    ok(Number(n) === Number(conLike), "los mismos que si se cuenta con la misma regla LIKE",
      "(" + n + " vs " + conLike + ")");

    /*
     * Lo que de verdad se pedia: un coche cuyo anuncio mas barato NO esta en
     * esa provincia, pero que tiene otro anuncio alli, tiene que aparecer.
     * Sin esto el filtro escondería coches que si estan disponibles.
     */
    const cruzados = (await c.query(
      `SELECT count(*)::int n FROM (${p.sql}) z
        WHERE ${normalizaSql("z.province")} IS DISTINCT FROM $${p.valores.length + 1}`,
      [...p.valores, conProv.p])).rows[0].n;
    ok(Number(cruzados) > 0,
      "y salen los que estan alli aunque su anuncio mas barato sea de otra provincia",
      "(" + cruzados + ")");
  }

  // ── La normalizacion, en JavaScript y en SQL, tiene que coincidir ────────
  console.log("\nLA NORMALIZACION DICE LO MISMO EN LOS DOS SITIOS");
  for (const t of ["MADRID", "Córdoba", "CÁDIZ", "A Coruña", "Almería"]) {
    const enSql = (await c.query(
      `SELECT lower(translate($1, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) AS v`, [t])).rows[0].v;
    ok(enSql === normalizaProvincia(t), "«" + t + "» -> " + enSql);
  }

  await c.end();
  console.log(fallos ? "\n  " + fallos + " FALLOS\n" : "\n  Todo correcto.\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });

function normalizaSql(col) {
  return `NULLIF(lower(translate(${col}, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '')`;
}
