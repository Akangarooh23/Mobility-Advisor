/**
 * Rellena `provincia` mirando todo lo que la oferta diga de dónde está.
 *
 *   npm run normaliza-provincias              (solo cuenta, no escribe)
 *   npm run normaliza-provincias -- --aplica
 *
 * La tabla de conversión vive en lib/las-provincias.js, que es donde hay que
 * tocar si aparece una forma nueva. Aquí solo está el ir y venir a la base.
 *
 * ── Las capas, en orden de confianza ───────────────────────────────────────
 *
 *   1. `province`   lo que el portal llama provincia. Cubre el 77,9 %.
 *   2. `city`       la ciudad. Añade 133.819 ofertas, un 8,5 % más.
 *   3. genérico     lo que no dice nada de nada.
 *
 * NO se mira `location`. Se midió: es una copia literal de `city` en todas las
 * filas y aporta CERO ofertas nuevas. Mirarla sería un barrido más de la tabla
 * para no encontrar nada.
 *
 * Tampoco se mira el código postal del concesionario, y no por olvido:
 * scripts/carga-dealers.js YA rellena `province` desde el CP del vendedor
 * durante la carga. Las que siguen sin provincia teniendo concesionario son
 * justamente las que no traían CP utilizable. Esa vía está agotada.
 *
 * ── Por qué el genérico, y qué significa ───────────────────────────────────
 *
 * Quedan ~198.000 ofertas que no dicen absolutamente nada: ni provincia, ni
 * ciudad, ni concesionario. Son de autocasión (183.403), ocasionplus (12.726)
 * y clicars (1.073), y en esos tres portales el scraper no se trae el dato.
 *
 * Esconderlas sería perder el 12,5 % del catálogo en cuanto alguien filtre por
 * provincia. Así que se marcan con el genérico y el buscador las enseña en
 * CUALQUIER provincia: quien busque en Valencia las ve, y quien busque en
 * Madrid también.
 *
 * Es una decisión de producto, no un apaño: preferimos enseñar un coche sin
 * ubicación conocida -y decirlo en la tarjeta- a esconderlo.
 *
 * ── NULL y el genérico no son lo mismo ─────────────────────────────────────
 *
 * genérico = lo hemos mirado y no se puede saber.
 * NULL     = todavía no lo hemos mirado.
 *
 * La diferencia importa: una oferta recién raspada tiene NULL hasta que pase
 * esto, y hasta entonces no debe tratarse como «ubicación desconocida» sino
 * como «sin decidir». Por eso el genérico se escribe en su propia capa y solo
 * después de que las otras hayan pasado.
 *
 * ── Un barrido por capa, no uno por provincia ──────────────────────────────
 *
 * La primera versión de esto lanzaba un UPDATE por provincia con la lista de
 * formas que le tocaban: 52 UPDATE, y cada uno un barrido completo de 2,36
 * millones de filas. Tardaba horas.
 *
 * Ahora todas las formas van juntas en un `unnest` de dos arrays y Postgres
 * resuelve el cruce con una tabla hash: UN barrido por capa. Lo mismo, en
 * minutos.
 *
 * ── Solo donde falta ───────────────────────────────────────────────────────
 *
 * Cada capa escribe únicamente donde `provincia` sigue vacía. Sin eso, volver
 * a lanzarlo reescribiría millones de filas en la tabla más caliente del
 * sistema para dejarlas igual, y eso son millones de tuplas muertas que el
 * autovacuum tiene que limpiar.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { laProvincia, PROVINCIAS } = require("../lib/las-provincias");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const APLICA = process.argv.includes("--aplica");

/** Lo que se escribe cuando se ha mirado y no se puede saber. Ver la cabecera. */
const GENERICO = "Sin especificar";

/** Las columnas que se miran, en orden. `location` no está a propósito. */
const CAPAS = ["province", "city"];

const mil = (n) => Number(n).toLocaleString("es");
const ES = "COALESCE(o.country, 'ES') = 'ES'";
const MUDA = "COALESCE(o.province,'') = '' AND COALESCE(o.city,'') = ''";

/*
 * ── Reintento, porque n8n escribe en la misma tabla al mismo tiempo ────────
 *
 * El 24-sep-2026 esto se cayó en la capa del genérico con «deadlock detected»
 * después de haber escrito bien las dos primeras. No fue un fallo de la
 * consulta: un verificador de n8n estaba dando bajas en las mismas filas, cada
 * uno tenía bloqueado lo que el otro esperaba, y Postgres mató a uno de los
 * dos. Eso es lo correcto por su parte.
 *
 * Un deadlock es transitorio por definición -la víctima se deshace entera y el
 * otro sigue-, así que la respuesta es volver a intentarlo, no rediseñar nada.
 * Se espera un poco más en cada intento para no volver a chocar con la misma
 * ejecución de n8n, que suele durar minutos.
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
      const espera = 15 * i;
      console.log("      " + etiqueta + ": " + e.message + " (intento " + i + " de "
        + INTENTOS + "), reintento en " + espera + " s");
      await new Promise((r) => setTimeout(r, espera * 1000));
    }
  }
}

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 3600000 });
  await c.connect();

  const hay = (await c.query(
    `SELECT count(*)::int n FROM information_schema.columns
      WHERE table_name = 'moveadvisor_market_offers' AND column_name = 'provincia'`)).rows[0].n;
  if (!hay) {
    console.log("\n  Falta la columna `provincia`. Aplica antes la migración:");
    console.log("      migrations/0010-la-provincia-normalizada.sql\n");
    await c.end();
    process.exit(1);
  }

  const capas = [];

  for (const col of CAPAS) {
    console.log("\n  CAPA " + col + "  ·  leyendo las formas que hay...");
    const filas = (await c.query(
      `SELECT ${col} AS v, count(*)::int n
         FROM moveadvisor_market_offers o
        WHERE ${ES} AND o.provincia IS NULL AND COALESCE(${col}, '') <> ''
        GROUP BY 1`)).rows;

    const formas = [];
    const destinos = [];
    let reconocidas = 0;
    let sinReconocer = 0;
    const huerfanos = [];
    for (const f of filas) {
      const p = laProvincia(f.v);
      if (!p) { sinReconocer += f.n; huerfanos.push([f.v, f.n]); continue; }
      reconocidas += f.n;
      formas.push(f.v);
      destinos.push(p);
    }
    const total = reconocidas + sinReconocer;
    console.log("      formas distintas : " + mil(filas.length));
    console.log("      filas que cubre  : " + mil(total));
    console.log("      se reconocen     : " + mil(reconocidas)
      + "   (" + (100 * reconocidas / (total || 1)).toFixed(1) + " %)");
    console.log("      se quedan sin    : " + mil(sinReconocer));

    huerfanos.sort((a, b) => b[1] - a[1]);
    if (huerfanos.length) {
      console.log("\n      las diez sin reconocer con más volumen:");
      for (const [v, n] of huerfanos.slice(0, 10)) {
        console.log("        " + String(v).slice(0, 34).padEnd(36) + String(n).padStart(7));
      }
      if (huerfanos.length > 10) {
        console.log("        y " + mil(huerfanos.length - 10) + " formas más, "
          + mil(huerfanos.slice(10).reduce((a, x) => a + x[1], 0)) + " filas");
      }
    }
    capas.push({ col, formas, destinos });
  }

  /* Las que no dicen nada en ninguna de las dos columnas. */
  const mudas = (await c.query(
    `SELECT count(*)::int n FROM moveadvisor_market_offers o
      WHERE ${ES} AND o.provincia IS NULL AND ${MUDA}`)).rows[0].n;
  console.log("\n  CAPA genérico");
  console.log("      no dicen nada    : " + mil(mudas) + "   -> " + GENERICO);

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run normaliza-provincias -- --aplica\n");
    await c.end();
    return;
  }

  console.log("\n  ESCRIBIENDO");
  let escritas = 0;
  for (const { col, formas, destinos } of capas) {
    if (!formas.length) { console.log("      " + col.padEnd(10) + "nada que escribir"); continue; }
    const t0 = Date.now();
    /*
     * `unnest` de dos arrays en lugar de 52 UPDATE. Postgres monta una tabla
     * hash con las formas y hace UN barrido, en vez de uno por provincia.
     */
    const r = await conReintento(c, col,
      `UPDATE moveadvisor_market_offers o
          SET provincia = v.prov
         FROM (SELECT unnest($1::text[]) AS forma, unnest($2::text[]) AS prov) v
        WHERE o.${col} = v.forma AND o.provincia IS NULL AND ${ES}`, [formas, destinos]);
    escritas += r.rowCount;
    console.log("      " + col.padEnd(10) + mil(r.rowCount).padStart(11) + " filas   de "
      + mil(formas.length) + " formas   en " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
  }

  const t0 = Date.now();
  const g = await conReintento(c, "genérico",
    `UPDATE moveadvisor_market_offers o
        SET provincia = $1
      WHERE ${ES} AND o.provincia IS NULL AND ${MUDA}`, [GENERICO]);
  escritas += g.rowCount;
  console.log("      genérico  " + mil(g.rowCount).padStart(11) + " filas"
    + "                     en " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
  console.log("\n      " + mil(escritas) + " filas escritas en total");

  const fin = (await c.query(
    `SELECT count(*) FILTER (WHERE provincia IS NOT NULL AND provincia <> $1)::int con,
            count(*) FILTER (WHERE provincia = $1)::int generico,
            count(*) FILTER (WHERE provincia IS NULL)::int sin_decidir,
            count(*)::int total
       FROM moveadvisor_market_offers o
      WHERE ${ES} AND is_active`, [GENERICO])).rows[0];
  const pct = (n) => (100 * n / (fin.total || 1)).toFixed(1) + " %";
  console.log("\n  DESPUÉS, en las ofertas españolas vivas");
  console.log("      con provincia de verdad : " + mil(fin.con).padStart(11) + "   " + pct(fin.con));
  console.log("      genérico                : " + mil(fin.generico).padStart(11) + "   " + pct(fin.generico));
  console.log("      todavía sin decidir     : " + mil(fin.sin_decidir).padStart(11) + "   " + pct(fin.sin_decidir)
    + (fin.sin_decidir ? "   (dicen algo que no sabemos leer)" : ""));
  console.log("      total                   : " + mil(fin.total).padStart(11));

  const reparto = (await c.query(
    `SELECT provincia, count(*)::int n FROM moveadvisor_market_offers o
      WHERE ${ES} AND is_active AND provincia IS NOT NULL
      GROUP BY 1 ORDER BY n DESC`)).rows;
  console.log("\n      provincias con oferta: "
    + reparto.filter((x) => x.provincia !== GENERICO).length + " de " + PROVINCIAS.length);
  console.log("      las diez con más:");
  for (const x of reparto.slice(0, 10)) {
    console.log("        " + String(x.provincia).padEnd(26) + mil(x.n).padStart(9));
  }
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
