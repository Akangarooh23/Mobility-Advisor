/**
 * Devuelve updated_at a las ofertas a las que se lo pisó el enriquecedor.
 *
 *   node scripts/repara-fechas-enriquecidas.js            (solo mira)
 *   ESCRIBIR=1 node scripts/repara-fechas-enriquecidas.js (aplica)
 *
 * ── Qué pasó ───────────────────────────────────────────────────────────────
 *
 * Los tres enriquecedores sellaban updated_at al guardar. Parece inofensivo,
 * pero el escaparate ordena por portal_score y los tres concesionarios valen 80,
 * así que el desempate real es updated_at DESC
 * (carswise-erp-backoffice apps/api/src/routes/marketplace.ts:570).
 *
 * O sea que rellenar la carrocería de un coche lo ponía por delante de todo el
 * catálogo de los otros dos, sin que el anuncio hubiera cambiado y sin que el
 * cliente notara nada. El 2026-09-09, con 1.249 de las 1.988 de Modrive
 * enriquecidas, Modrive ocupaba desde la posición 1.
 *
 * Los enriquecedores ya no tocan updated_at. Este script arregla las que se
 * quedaron con la fecha pisada.
 *
 * ── Qué fecha se les pone, y por qué esa ───────────────────────────────────
 *
 * created_at: cuándo vimos la oferta por primera vez.
 *
 * No es la fecha original -esa se perdió cuando el enriquecedor la sobreescribió
 * y no hay tabla de histórico de la que sacarla-. Pero es la única que
 * significa algo: «no tenemos constancia de que este anuncio haya cambiado desde
 * que lo conocemos». Y no se pierde nada al ponerla, porque lo que hay ahora es
 * la hora a la que pasó el enriquecedor, que no significa nada en absoluto.
 *
 * ── A quién NO se toca ─────────────────────────────────────────────────────
 *
 * Solo entran las filas cuyo updated_at coincide con enrich_tried_at en menos de
 * 3 segundos: esas son, por construcción, las que selló el enriquecedor. Si el
 * scraper movió la fecha después -porque cambió el precio, los kilómetros o el
 * título- las dos fechas ya no coinciden y la fila se queda como está.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const ESCRIBIR = process.env.ESCRIBIR === "1";
const PORTALES = ["modrive", "vian", "gamboa"];

// Las que selló el enriquecedor: updated_at y enrich_tried_at a menos de 3
// segundos. El scraper, si tocó la fila después, las habría separado.
const CONDICION = `portal = ANY($1)
  AND enrich_tried_at IS NOT NULL
  AND created_at IS NOT NULL
  AND abs(extract(epoch FROM updated_at - enrich_tried_at)) < 3
  AND updated_at IS DISTINCT FROM created_at`;

async function escaparate(c, titulo) {
  const o = await c.query(`WITH orden AS (
      SELECT portal, row_number() OVER (ORDER BY portal_score DESC, updated_at DESC) pos
      FROM moveadvisor_marketplace_vo_offers WHERE is_active)
    SELECT portal, min(pos) primera, count(*) n FROM orden
    WHERE portal = ANY($1) GROUP BY portal ORDER BY primera`, [PORTALES]);
  console.log("      " + titulo);
  for (const x of o.rows) {
    console.log("        " + String(x.portal).padEnd(10) + "desde la "
      + String(x.primera).padStart(5) + "   " + String(x.n).padStart(5) + " ofertas");
  }
}

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const r = await c.query(`SELECT portal, count(*) n,
      to_char(min(created_at),'DD/MM') desde, to_char(max(created_at),'DD/MM') hasta
    FROM moveadvisor_marketplace_vo_offers
    WHERE is_active AND ${CONDICION} GROUP BY portal ORDER BY n DESC`, [PORTALES]);

  const total = r.rows.reduce((a, x) => a + Number(x.n), 0);
  console.log("  OFERTAS CON updated_at PISADO POR EL ENRIQUECEDOR"
    + (ESCRIBIR ? "   ESCRIBIENDO." : "   (solo mirando)"));
  for (const x of r.rows) {
    console.log("      " + String(x.portal).padEnd(10) + String(x.n).padStart(5)
      + "   se les pondra su created_at, entre el " + x.desde + " y el " + x.hasta);
  }
  console.log("      " + "".padEnd(10) + String(total).padStart(5) + "   en total");

  if (!total) { console.log("\n  Nada que reparar."); await c.end(); return; }

  console.log();
  await escaparate(c, "ANTES:");

  if (!ESCRIBIR) {
    // Enseñar cómo quedaría, sin escribir.
    await c.query("BEGIN");
    await c.query(`UPDATE moveadvisor_marketplace_vo_offers
      SET updated_at = created_at WHERE ${CONDICION}`, [PORTALES]);
    console.log();
    await escaparate(c, "QUEDARIA ASI:");
    await c.query("ROLLBACK");
    console.log("\n  Nada escrito. Para aplicarlo:"
      + "  ESCRIBIR=1 node scripts/repara-fechas-enriquecidas.js");
    await c.end();
    return;
  }

  const res = await c.query(`UPDATE moveadvisor_marketplace_vo_offers
    SET updated_at = created_at WHERE ${CONDICION}`, [PORTALES]);
  console.log("\n      devueltas a su created_at: " + res.rowCount);
  console.log();
  await escaparate(c, "DESPUES:");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
