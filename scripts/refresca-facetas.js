/**
 * Crea si faltan y refresca las vistas de los desplegables del buscador.
 *
 *   npm run refresca-facetas                 (las dos)
 *   npm run refresca-facetas -- mmo_facetas  (solo una)
 *
 * En producción esto lo hace una tarea programada de Vercel cada hora, contra
 * lib/api/cron-facetas-buscador-handler.js. Esto es lo mismo desde aquí, para
 * cuando hace falta ya: después de aplicar una migración que tira una vista,
 * o después de cargar un volcado grande.
 *
 * ── Por qué `prepara` antes de `refresca` ──────────────────────────────────
 *
 * Porque la migración 0011 TIRA `mmo_facetas` para que se recree con la
 * definición nueva -la que lee la provincia normalizada-. Si esto solo
 * refrescara, se encontraría con que la vista no existe y fallaría. `prepara`
 * la crea si falta, con su índice único, y refrescar sin ese índice no podría
 * ser CONCURRENTLY.
 *
 * Refrescar las dos cuesta unos tres minutos contra los 4,3 GB del pool.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { prepara, refresca } = require("../lib/facetas-del-buscador");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

/* La vista concreta, si se pide. Las banderas no cuentan. */
const CUAL = process.argv.slice(2).find((a) => !a.startsWith("-")) || "";

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 1800000 });
  await c.connect();

  console.log("\n  creando lo que falte...");
  await prepara(c);

  console.log("  refrescando" + (CUAL ? " solo " + CUAL : " las dos") + ", esto tarda...");
  for (const { vista, ms } of await refresca(c, CUAL)) {
    console.log("      " + vista.padEnd(14) + (ms / 1000).toFixed(0) + " s");
  }

  const r = (await c.query(
    `SELECT tipo, count(*)::int n FROM mmo_facetas GROUP BY 1 ORDER BY 1`)).rows;
  console.log("\n  lo que hay ahora en los desplegables");
  for (const x of r) {
    console.log("      " + String(x.tipo).padEnd(16) + String(x.n).padStart(6) + " valores");
  }

  const p = (await c.query(
    `SELECT valor, n FROM mmo_facetas WHERE tipo = 'province' ORDER BY n DESC LIMIT 8`)).rows;
  console.log("\n      las ocho provincias con más oferta:");
  for (const x of p) {
    console.log("        " + String(x.valor).padEnd(26) + Number(x.n).toLocaleString("es").padStart(9));
  }
  console.log("");
  await c.end();
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
