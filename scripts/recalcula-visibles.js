/**
 * Decide qué ofertas se le pueden enseñar a un cliente.
 *
 *   npm run recalcula-visibles              (solo cuenta)
 *   npm run recalcula-visibles -- --aplica
 *
 * ── Quién escribe esta columna ─────────────────────────────────────────────
 *
 * Solo esto. Nadie más.
 *
 * No es una preferencia de estilo. `import_published` lo escribían DOS cosas
 * -el nodo del scoring con una regla de tramos y lib/coste-importacion.js con
 * otra- y cada día a las 13:10 una despublicaba lo que había publicado la otra.
 * El catálogo estuvo semanas ofreciendo ahorros que no existían.
 *
 * El buscador y el consejero LEEN `visible`. Si alguien necesita una regla
 * nueva, se añade aquí, no en su consulta.
 *
 * ── Por qué una columna y no un filtro en cada consulta ────────────────────
 *
 * Porque un filtro calculado no sabe decir «esta oferta concreta, no». Con la
 * columna se puede ocultar una a mano -`visible_a_mano`- y el recálculo la
 * respeta, igual que agrupar-duplicados.js respeta los grupos que decidió una
 * persona.
 *
 * Y porque preguntar «¿por qué no se ve este coche?» pasa a tener respuesta:
 * `visible_motivo`.
 *
 * ── Los motivos, y de dónde salen ──────────────────────────────────────────
 *
 * Medido el 24-sep-2026 sobre 1.580.308 ofertas españolas vivas:
 *
 *     duplicada       231.936   el mismo coche ya se enseña en otra tarjeta
 *     sin_foto        360.848   la tarjeta seria un hueco gris
 *     precio_bajo    ~160.000   por debajo de 4.500 EUR
 *     km_imposible      4.041   mas de 500.000 km
 *     no_es_coche         378   es_coche = FALSE
 *     danada                0   is_damaged = TRUE
 *
 * EL PRECIO BAJO NO ES UN CHOLLO: ordenando de menor a mayor salian T-Roc de
 * 2023 con 62.958 km «a 301 EUR». Es la cuota mensual publicada como precio.
 * Wallapop tiene 6.500 ofertas por debajo de 1.000 EUR.
 *
 * LOS DAÑOS SE MIRAN DISTINTO QUE EN LA IMPORTACIÓN, y a propósito. Allí la
 * regla es «no publicar lo que no se haya COMPROBADO», porque publicar sin
 * mirar puso un Range Rover con el frontal destrozado delante de un cliente.
 * Aquí eso escondería 1.577.154 de 1.580.308: de las españolas solo hay 3.154
 * con los daños mirados. Así que oculta `is_damaged = TRUE`, no el NULL.
 *
 * El orden de los motivos importa: se guarda el PRIMERO que aplica, así que
 * están puestos de más informativo a menos. Saber que una oferta es duplicada
 * dice más que saber que además no tiene foto.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");

const PRECIO_MINIMO = 4500;
const PRECIO_MAXIMO = 200000;
const KM_MAXIMO = 500000;

/*
 * En orden: el primero que aplica es el que se guarda.
 *
 * `duplicada` va primero porque es el unico motivo que no es un defecto de la
 * oferta: el coche SE ENSEÑA, solo que en otra tarjeta. Confundirlo con «sin
 * foto» llevaria a buscar una foto que no arregla nada.
 */
const MOTIVOS = [
  ["duplicada", `EXISTS (SELECT 1 FROM moveadvisor_offer_duplicates d
                          WHERE d.offer_id = o.id AND d.canonical_id <> d.offer_id)`],
  ["no_es_coche", `o.es_coche IS FALSE`],
  ["danada", `o.is_damaged IS TRUE`],
  ["sin_foto", `COALESCE(o.image_url, '') = ''`],
  ["precio_bajo", `o.price IS NULL OR o.price < ${PRECIO_MINIMO}`],
  ["precio_alto", `o.price > ${PRECIO_MAXIMO}`],
  ["km_imposible", `o.mileage IS NOT NULL AND (o.mileage < 0 OR o.mileage > ${KM_MAXIMO})`],
];

/** CASE que devuelve el primer motivo que aplica, o NULL si no aplica ninguno. */
const CASE_MOTIVO = "CASE\n"
  + MOTIVOS.map(([m, cond]) => `    WHEN ${cond} THEN '${m}'`).join("\n")
  + "\n    ELSE NULL END";

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 1800000 });
  await c.connect();

  const existe = (await c.query(
    `SELECT count(*)::int n FROM information_schema.columns
      WHERE table_name = 'moveadvisor_market_offers' AND column_name = 'visible'`)).rows[0].n;
  if (!existe) {
    console.log("\n  Falta la columna `visible`. Aplica antes la migración:");
    console.log("      migrations/0009-lo-que-se-ensena.sql\n");
    await c.end();
    process.exit(1);
  }

  /*
   * Solo las ACTIVAS y españolas. Una oferta muerta no se enseña por otra
   * razon, y decidir sobre ella seria escribir en 600.000 filas para nada.
   */
  const DONDE = `o.is_active AND COALESCE(o.country, 'ES') = 'ES' AND NOT o.visible_a_mano`;

  console.log("\n  LO QUE SE OCULTARÍA, Y POR QUÉ");
  const cuenta = (await c.query(
    `SELECT COALESCE(${CASE_MOTIVO}, '(se enseña)') AS motivo, count(*)::int n
       FROM moveadvisor_market_offers o WHERE ${DONDE}
      GROUP BY 1 ORDER BY n DESC`)).rows;
  let total = 0, visibles = 0;
  for (const x of cuenta) {
    total += x.n;
    if (x.motivo === "(se enseña)") visibles = x.n;
    console.log("      " + String(x.motivo).padEnd(16) + String(x.n.toLocaleString("es")).padStart(11));
  }
  console.log("      " + "".padEnd(16) + String(total.toLocaleString("es")).padStart(11) + "   en total");
  console.log("\n      se enseñan " + visibles.toLocaleString("es")
    + " de " + total.toLocaleString("es") + "   (" + Math.round(100 * visibles / (total || 1)) + " %)");

  const aMano = (await c.query(
    `SELECT count(*)::int n FROM moveadvisor_market_offers WHERE visible_a_mano`)).rows[0].n;
  if (aMano) console.log("      y " + aMano.toLocaleString("es") + " decididas a mano, que no se tocan");

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run recalcula-visibles -- --aplica\n");
    await c.end();
    return;
  }

  /*
   * Se escribe solo donde CAMBIA algo.
   *
   * Sin ese `WHERE`, cada pasada reescribiria 1,58 millones de filas en la
   * tabla mas caliente del sistema para dejarlas igual, y eso son 1,58 millones
   * de tuplas muertas que el autovacuum tiene que limpiar cada noche.
   */
  console.log("\n  APLICANDO");
  const r = await c.query(`
    UPDATE moveadvisor_market_offers o
       SET visible = (${CASE_MOTIVO}) IS NULL,
           visible_motivo = ${CASE_MOTIVO},
           visible_desde = NOW()
     WHERE ${DONDE}
       AND (o.visible IS DISTINCT FROM ((${CASE_MOTIVO}) IS NULL)
            OR o.visible_motivo IS DISTINCT FROM (${CASE_MOTIVO}))`);
  console.log("      filas cambiadas: " + r.rowCount.toLocaleString("es"));

  /*
   * Y las que ya no estan activas dejan de estar visibles.
   *
   * Si no, una oferta que se vende hoy se quedaria con visible = true para
   * siempre, y cualquier consulta que mire solo `visible` la seguiria
   * enseñando.
   */
  const m = await c.query(`
    UPDATE moveadvisor_market_offers
       SET visible = FALSE, visible_motivo = 'no_activa', visible_desde = NOW()
     WHERE NOT is_active AND visible IS DISTINCT FROM FALSE AND NOT visible_a_mano`);
  console.log("      vendidas que dejan de verse: " + m.rowCount.toLocaleString("es"));

  const fin = (await c.query(
    `SELECT count(*) FILTER (WHERE visible)::int se_ven,
            count(*) FILTER (WHERE visible IS NULL)::int sin_decidir,
            count(*)::int total
       FROM moveadvisor_market_offers WHERE COALESCE(country,'ES') = 'ES'`)).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      se enseñan   : " + fin.se_ven.toLocaleString("es") + " de " + fin.total.toLocaleString("es"));
  console.log("      sin decidir  : " + fin.sin_decidir.toLocaleString("es")
    + (fin.sin_decidir ? "   (son las no activas de antes de esta pasada)" : ""));
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
