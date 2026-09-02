/**
 * Quitar las marcas de "ya intentado" que dejo el enriquecedor de color.
 *
 * El enriquecedor de Wallapop salta las ofertas con `enrich_tried_at` de hace
 * menos de treinta dias, para no volver a pedir lo mismo un dia tras otro. Es
 * lo correcto, pero da por hecho que esa marca la puso el.
 *
 * No fue asi. El enriquecedor universal de color paso por Wallapop entre el 14
 * y el 17 de agosto, pidio el HTML de cada ficha, no encontro ningun color
 * -acertaba el 0,7%: 2.883 intentos, 2.862 sin color- y aun asi las marco a
 * todas como intentadas. Buscaba una cosa y bloqueo otra.
 *
 * El resultado: 2.065 ofertas activas a las que les faltan puertas, plazas,
 * cambio o carroceria estan fuera de la cola hasta mediados de septiembre, por
 * culpa de un proceso que ni siquiera miraba esos campos. La cola de hoy tiene
 * 1.327 cuando deberia tener 3.392.
 *
 * Se borran solo las marcas anteriores al 1 de septiembre, que es cuando entro
 * el enriquecedor nuevo. Las suyas se respetan: si el suyo lo intento y no pudo
 * -una autocaravana, por ejemplo, que no tiene carroceria porque no es un
 * coche- volver a intentarlo cada dia seria gastar peticiones para nada.
 *
 *   node scripts/desbloquea-enrich-wallapop.js            (en seco)
 *   ESCRIBIR=1 node scripts/desbloquea-enrich-wallapop.js (de verdad)
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const ESCRIBIR = process.env.ESCRIBIR === "1";

/** Cuando entro el enriquecedor nuevo. Todo lo anterior es del de color. */
const CORTE = "2026-09-01";

/** Lo que el enriquecedor de Wallapop sabe rellenar y estas ofertas no tienen. */
const LE_FALTA =
  "(COALESCE(transmission,'') = '' OR COALESCE(body_type,'') = '' OR doors IS NULL OR seats IS NULL)";

const CONDICION = `
  portal = 'wallapop'
  AND enrich_tried_at IS NOT NULL
  AND enrich_tried_at < '${CORTE}'
  AND COALESCE(is_active, TRUE)
  AND ${LE_FALTA}`;

async function cola(c) {
  return Number((await c.query(`
    SELECT count(*) n FROM moveadvisor_market_offers
    WHERE portal = 'wallapop' AND COALESCE(is_active, TRUE) AND ${LE_FALTA}
      AND (enrich_tried_at IS NULL OR enrich_tried_at < NOW() - INTERVAL '30 days')`)).rows[0].n);
}

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const antes = (await c.query(`SELECT count(*) n,
      to_char(min(enrich_tried_at),'YYYY-MM-DD') desde, to_char(max(enrich_tried_at),'YYYY-MM-DD') hasta
    FROM moveadvisor_market_offers WHERE ${CONDICION}`)).rows[0];
  const colaAntes = await cola(c);

  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}Wallapop:`);
  console.log(`  bloqueadas por una marca anterior al ${CORTE}: ${antes.n}`);
  if (antes.n > 0) console.log(`    marcadas entre el ${antes.desde} y el ${antes.hasta}`);
  console.log(`  cola del enriquecedor ahora mismo: ${colaAntes}`);

  if (Number(antes.n) === 0) {
    console.log("\nNo hay nada que desbloquear.");
    await c.end();
    return;
  }

  if (!ESCRIBIR) {
    console.log(`\n[EN SECO] se desbloquearian ${antes.n} ofertas. La base no se ha tocado.`);
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/desbloquea-enrich-wallapop.js");
    await c.end();
    return;
  }

  // updated_at no se toca: esto no es un cambio del anuncio, es quitar una nota
  // nuestra que estaba mal puesta.
  const r = await c.query(`UPDATE moveadvisor_market_offers SET enrich_tried_at = NULL WHERE ${CONDICION}`);
  const colaDespues = await cola(c);

  console.log(`\nDesbloqueadas ${r.rowCount} ofertas.`);
  console.log(`  la cola del enriquecedor pasa de ${colaAntes} a ${colaDespues}.`);
  console.log(`  a 800 por pasada diaria, se cubren en ${Math.ceil(colaDespues / 800)} dias.`);

  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
