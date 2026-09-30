"use strict";

/**
 * Qué consultas se llevan el tiempo, de verdad.
 *
 * ## Por qué existe
 *
 * Porque medir a mano no sirve en esta base. Midiendo la misma consulta tres veces
 * seguidas salió 4.384, 5.920 y 18.721 ms: cuatro veces de varianza. Con ese ruido
 * creé un índice de 131 MB que parecía ayudar en la primera medición y resultó
 * empeorar las cosas.
 *
 * `pg_stat_statements` acumula **miles de llamadas reales** y promedia el ruido. Y
 * contesta la pregunta que ningún `EXPLAIN` a mano contesta: *cuál* de las
 * consultas se lleva el tiempo, no cuál se te ocurrió mirar.
 *
 * ## Lo primero que enseña, y por qué
 *
 * El tiempo **total**, no el peor caso. Una consulta de 40 ms llamada cien mil
 * veces pesa más que una de diez segundos llamada dos, y es la que hay que
 * arreglar primero. El peor caso va después, porque es el que se nota cuando le
 * toca a alguien.
 *
 * Uso:
 *
 *   node scripts/consultas-lentas.js          → las 15 que más tiempo total
 *   node scripts/consultas-lentas.js --lentas → las 15 más lentas de media
 *   node scripts/consultas-lentas.js --reinicia → empieza a contar de cero
 */

require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../lib/postgres-ssl");

const POR_LENTITUD = process.argv.includes("--lentas");
const REINICIA = process.argv.includes("--reinicia");
const CUANTAS = 15;

function ms(n) {
  const v = Number(n || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(1)} s`;
  return `${Math.round(v)} ms`;
}

function conPuntos(n) {
  return Number(n || 0).toLocaleString("es-ES");
}

async function main() {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!cadena) {
    console.error("Falta DATABASE_URL en .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: cadena, ssl: SSL_POSTGRES });

  try {
    if (REINICIA) {
      await pool.query("SELECT pg_stat_statements_reset()");
      console.log("Contadores a cero. Vuelve dentro de un rato.");
      return;
    }

    const { rows: desde } = await pool.query(
      "SELECT stats_reset FROM pg_stat_statements_info"
    );
    console.log(
      `\nContando desde ${desde[0]?.stats_reset ? String(desde[0].stats_reset).slice(0, 16) : "(no se sabe)"}\n`
    );

    const { rows } = await pool.query(
      `SELECT round(total_exec_time::numeric)      AS total_ms,
              calls,
              round(mean_exec_time::numeric, 1)    AS media_ms,
              round(max_exec_time::numeric)        AS peor_ms,
              rows,
              left(regexp_replace(query, '\\s+', ' ', 'g'), 130) AS consulta
         FROM pg_stat_statements
        WHERE query NOT ILIKE '%pg_stat_statements%'
          AND query NOT ILIKE 'EXPLAIN%'
        ORDER BY ${POR_LENTITUD ? "mean_exec_time" : "total_exec_time"} DESC
        LIMIT $1`,
      [CUANTAS]
    );

    console.log(
      POR_LENTITUD
        ? "LAS MÁS LENTAS DE MEDIA — el caso que se nota cuando le toca a alguien:\n"
        : "LAS QUE MÁS TIEMPO TOTAL CONSUMEN — lo que hay que arreglar primero:\n"
    );

    for (const r of rows) {
      console.log(
        `  ${ms(r.total_ms).padStart(9)} en total  ·  ${conPuntos(r.calls).padStart(9)} veces  ·  ` +
          `${ms(r.media_ms).padStart(8)} de media  ·  peor ${ms(r.peor_ms)}`
      );
      console.log(`      ${r.consulta}`);
      console.log("");
    }

    if (!rows.length) {
      console.log("  Nada todavía. La extensión acaba de encenderse o se reinició.\n");
    } else if (!POR_LENTITUD) {
      console.log("  Y con --lentas, las más lentas de media.\n");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const mensaje = err instanceof Error ? err.message : String(err);
  if (/pg_stat_statements/.test(mensaje)) {
    console.error(
      "pg_stat_statements no está instalada.\n" +
        "La declara migrations/0018; aplícala con `npm run migra`."
    );
  } else {
    console.error(mensaje);
  }
  process.exit(1);
});
