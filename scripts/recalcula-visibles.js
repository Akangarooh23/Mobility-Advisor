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

const mil = (n) => Number(n).toLocaleString("es");

/*
 * ── Reintento, porque n8n escribe en la misma tabla al mismo tiempo ────────
 *
 * Un deadlock es transitorio por definición -la víctima se deshace entera y
 * la otra sigue-, así que la respuesta es volver a intentarlo. Con lotes
 * pequeños es mucho menos probable, pero los scrapers escriben aquí a todas
 * horas y basta con que coincidan una vez.
 *
 * 40P01 es deadlock_detected y 40001 serialization_failure. Cualquier otro
 * error se deja subir: un fallo de sintaxis no se arregla insistiendo.
 */
const TRANSITORIOS = new Set(["40P01", "40001"]);
const INTENTOS = 5;

async function conReintento(c, etiqueta, sql, params) {
  for (let i = 1; ; i++) {
    try {
      return await c.query(sql, params);
    } catch (e) {
      if (!TRANSITORIOS.has(e.code) || i >= INTENTOS) throw e;
      const espera = 5 * i;
      console.log("      " + etiqueta + ": " + e.message + " (intento " + i + " de "
        + INTENTOS + "), reintento en " + espera + " s");
      await new Promise((r) => setTimeout(r, espera * 1000));
    }
  }
}

/*
 * ── El precio bajo no es el problema; el precio IMPOSIBLE sí ───────────────
 *
 * Hasta el 30-sep-2026 esto era un suelo fijo de 4.500 EUR. Se puso para
 * quitar las cuotas mensuales publicadas como precio -T-Roc de 2023 con
 * 62.958 km «a 301 EUR»-. Medido después, quitaba demasiado:
 *
 *     tramo        ofertas   año medio   km medios   cuotas disfrazadas
 *     < 1.000        3.348      2003      226.869          130
 *     1.000-2.000   15.602      2003      266.524           47
 *     2.000-3.000   25.517      2005      242.848           31
 *     3.000-4.500   40.083      2007      229.350           54
 *
 * 84.550 coches viejos de verdad escondidos para filtrar 262 malos. Un coche
 * de 2003 con 266.000 km a 1.500 EUR está bien valorado; lo que no existe es
 * un Cupra Formentor de 2024 con 65.252 km a 508 EUR.
 *
 * Lo que distingue una cuota de un coche barato NO es el precio: es el precio
 * JUNTO CON la edad y los kilómetros. Un precio bajo se acepta cuando el
 * coche lo justifica -es viejo o ha rodado mucho- y se rechaza cuando no.
 *
 * Los dos umbrales salen de la tabla de arriba: por debajo de 4.500 el coche
 * medio tiene veinte años y 240.000 km, así que diez años o 150.000 km es un
 * listón que pasan todos los legítimos y ninguna de las cuotas.
 *
 * Y lo que NO se sabe no descarta: sin año o sin kilómetros no se puede
 * juzgar, y esconder por no saber es peor que enseñar.
 */
const PRECIO_SOSPECHOSO = 4500;
const ANOS_QUE_LO_JUSTIFICAN = 10;
const KM_QUE_LO_JUSTIFICAN = 150000;

/** Por debajo de esto no hay coche que valga, tenga la edad que tenga. */
const PRECIO_ABSURDO = 300;
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
  ["precio_imposible", `(o.price IS NULL OR o.price < ${PRECIO_ABSURDO}
      OR (o.price < ${PRECIO_SOSPECHOSO}
          AND COALESCE(EXTRACT(YEAR FROM now())::int - o."year", 99) < ${ANOS_QUE_LO_JUSTIFICAN}
          AND COALESCE(o.mileage, 999999) < ${KM_QUE_LO_JUSTIFICAN}))`],
  ["precio_alto", `o.price > ${PRECIO_MAXIMO}`],
  ["km_imposible", `o.mileage IS NOT NULL AND (o.mileage < 0 OR o.mileage > ${KM_MAXIMO})`],
  /*
   * Las dos reglas que tenía el consejero y esto no. Son datos que no pueden
   * ser ciertos, no preferencias, así que su sitio es la definición común.
   *
   * Salió en una prueba un VW Taigo de 2026 con 67.481 km: en septiembre de
   * 2026 eso son 7.500 km al mes desde que se matriculó. Puede ser una flota,
   * pero lo normal es que el scraper haya leído mal. Se permiten 50.000 km por
   * año de vida contando el año en curso entero: un comercial que hace 50.000
   * al año y vende a los tres pasa de sobra con sus 200.000.
   */
  ["anio_imposible", `o."year" > EXTRACT(YEAR FROM now())::int + 1`],
  ["km_por_anio", `o.mileage IS NOT NULL AND o."year" IS NOT NULL
      AND o.mileage > 50000 * GREATEST(EXTRACT(YEAR FROM now())::int - o."year" + 1, 1)`],
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
  console.log("      un portal por sentencia, para no bloquear a los scrapers");
  /*
   * ── Un portal por sentencia ──────────────────────────────────────────────
   *
   * Escrito como un solo UPDATE sobre el millón y medio de filas, Postgres
   * mantiene el bloqueo de TODAS ellas hasta que termina. El 29-sep-2026 eso
   * dejó a un scraper de n8n esperando 14 minutos:
   *
   *     pid 22494  843s  Lock transactionid  bloqueado por: [15090]
   *
   * Y un workflow bloqueado ocupa uno de los tres huecos de concurrencia de
   * n8n, así que detrás se forma cola. Esto corre cada mañana mientras los
   * scrapers trabajan, así que no puede ser así.
   *
   * ── Y por portal, no por rangos de id ────────────────────────────────────
   *
   * El primer intento fue trocear con un cursor sobre la clave primaria,
   * `id > el último del lote anterior` con LIMIT. Funcionaba y no bloqueaba,
   * pero la pasada completa pasó a tardar 5 h 40 min.
   *
   * El culpable no era el tamaño del lote sino el ORDER BY: obliga a recorrer
   * por índice y a ir a buscar cada fila por separado, y contra el
   * almacenamiento remoto de Neon cada salto se paga. Medido sobre las mismas
   * filas, leyendo y evaluando el motivo:
   *
   *     cursor por id, LIMIT 10.000    2,25 ms/fila
   *     cursor por id, LIMIT 100.000   0,17 ms/fila
   *     por portal, sin ORDER BY       0,05 ms/fila     <- 45 veces mejor
   *
   * Sin ORDER BY, Postgres barre en secuencial, paraleliza y le pide a Neon
   * páginas seguidas. Leer el millón y medio pasa de una hora a minuto y
   * medio.
   *
   * Y los portales son trozos naturales y bastante equilibrados -wallapop
   * 532.223, coches.net 282.161, milanuncios 263.260, autoscout24 251.631,
   * autocasión 199.211, y siete más pequeños-, así que son once sentencias en
   * vez de 164, cada una bloqueando solo lo suyo.
   */
  const portales = (await c.query(
    `SELECT o.portal, count(*)::int n FROM moveadvisor_market_offers o
      WHERE ${DONDE} GROUP BY 1 ORDER BY n`)).rows;

  let escritas = 0;
  let mirados = 0;
  const t0 = Date.now();
  for (const { portal } of portales) {
    const t1 = Date.now();
    const r = await conReintento(c, portal, `
      WITH lote AS (
        SELECT o.id, ${CASE_MOTIVO} AS motivo
          FROM moveadvisor_market_offers o
         WHERE ${DONDE} AND o.portal = $1
      ),
      escrito AS (
        UPDATE moveadvisor_market_offers o
           SET visible = k.motivo IS NULL,
               visible_motivo = k.motivo,
               visible_desde = NOW()
          FROM lote k
         WHERE o.id = k.id
           AND (o.visible IS DISTINCT FROM (k.motivo IS NULL)
                OR o.visible_motivo IS DISTINCT FROM k.motivo)
        RETURNING 1
      )
      SELECT (SELECT count(*)::int FROM lote) AS mirados,
             (SELECT count(*)::int FROM escrito) AS escritos`, [portal]);

    const f = r.rows[0];
    escritas += f.escritos;
    mirados += f.mirados;
    console.log("      " + portal.padEnd(14) + mil(f.mirados).padStart(9) + " miradas   "
      + mil(f.escritos).padStart(9) + " cambiadas   "
      + ((Date.now() - t1) / 1000).toFixed(0).padStart(4) + " s");
  }
  console.log("      " + mil(mirados) + " miradas, " + mil(escritas) + " cambiadas, "
    + ((Date.now() - t0) / 1000).toFixed(0) + " s en total");

  /*
   * Y las que ya no estan activas dejan de estar visibles.
   *
   * Si no, una oferta que se vende hoy se quedaria con visible = true para
   * siempre, y cualquier consulta que mire solo `visible` la seguiria
   * enseñando.
   */
  /*
   * También por lotes, y por el mismo motivo: son 600.000 filas y un bloqueo
   * largo sobre ellas para al scraper igual que el de arriba.
   *
   * Aquí el cursor puede avanzar hasta el último ESCRITO, porque la condición
   * del WHERE deja de cumplirse en cuanto se escribe: una fila ya puesta a
   * FALSE no vuelve a entrar. Aun así se usa el último mirado, que funciona
   * en los dos casos y no obliga a razonarlo cada vez que alguien lo lea.
   */
  let bajas = 0;
  for (const { portal } of (await c.query(
    `SELECT DISTINCT portal FROM moveadvisor_market_offers
      WHERE NOT is_active AND visible IS DISTINCT FROM FALSE AND NOT visible_a_mano`)).rows) {
    const r = await conReintento(c, "vendidas de " + portal, `
      UPDATE moveadvisor_market_offers
         SET visible = FALSE, visible_motivo = 'no_activa', visible_desde = NOW()
       WHERE NOT is_active AND visible IS DISTINCT FROM FALSE
         AND NOT visible_a_mano AND portal = $1`, [portal]);
    bajas += r.rowCount;
  }
  console.log("      vendidas que dejan de verse: " + mil(bajas));

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
