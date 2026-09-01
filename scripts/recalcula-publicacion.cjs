/**
 * Decidir qué ofertas alemanas se publican, con las mismas cuentas que la ficha.
 *
 * Esta decisión vivía en un nodo SQL del flujo de n8n, y el código no sabía
 * nada. Había dos fórmulas diciendo cosas distintas y la que mandaba era la que
 * nadie miraba: el catálogo estuvo desde el 17 de agosto publicado con un coste
 * medio de 1.580 € cuando el real era 3.666, y sin descontar lo que gana PopCar.
 * Por eso las 1.568 ofertas pasaban un filtro del 10 %: el listón estaba puesto
 * sobre una vara que medía mal.
 *
 * Ahora sale de `lib/coste-importacion.js`, que es lo que pinta el precio en la
 * ficha. No se pueden separar.
 *
 *   node scripts/recalcula-publicacion.cjs          → en seco, no escribe nada
 *   node scripts/recalcula-publicacion.cjs --aplica → escribe
 *
 * Respeta `import_locked`: una oferta que alguien haya fijado a mano no se toca.
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const {
  precioPuestoAqui, ahorroDelCliente, sePublica,
  AHORRO_MINIMO, AHORRO_MAXIMO, COMPARABLES_MINIMOS,
  TRANSPORTE, PAPELEO_ESTIMADO,
} = require("../lib/coste-importacion.js");

const APLICA = process.argv.includes("--aplica");

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`transporte ${TRANSPORTE} € · papeleo ${PAPELEO_ESTIMADO} € · ` +
    `ahorro mínimo ${(AHORRO_MINIMO * 100).toFixed(0)} % · máximo ${(AHORRO_MAXIMO * 100).toFixed(0)} % · ` +
    `mínimo ${COMPARABLES_MINIMOS} comparables\n`);

  const { rows } = await pool.query(
    `SELECT id, price::numeric AS al, market_price_es::numeric AS es,
            import_comps AS comps, import_published AS publicada, import_locked AS fijada,
            COALESCE(is_active, TRUE) AS viva
       FROM moveadvisor_market_offers
      WHERE country = 'DE'`
  );

  const decididas = rows.map((f) => {
    const al = Number(f.al) || 0;
    const es = Number(f.es) || 0;
    const publica = sePublica({ precioAleman: al, precioEspanol: es, comparables: f.comps, viva: f.viva !== false });
    const { euros, pct } = ahorroDelCliente(al, es);
    return {
      id: f.id, al, es, comps: Number(f.comps) || 0,
      fijada: Boolean(f.fijada), antes: Boolean(f.publicada),
      publica, euros, pct,
      puesto: Math.round(precioPuestoAqui(al, es)),
    };
  });

  const libres = decididas.filter((x) => !x.fijada);
  const publicar = libres.filter((x) => x.publica);
  const entran = publicar.filter((x) => !x.antes);
  const salen = libres.filter((x) => !x.publica && x.antes);

  console.log(`ofertas alemanas : ${decididas.length}`);
  console.log(`fijadas a mano   : ${decididas.length - libres.length} (no se tocan)`);
  console.log(`publicadas antes : ${libres.filter((x) => x.antes).length}`);
  console.log(`publicadas ahora : ${publicar.length}`);
  console.log(`  entran         : ${entran.length}`);
  console.log(`  salen          : ${salen.length}`);

  if (publicar.length) {
    const medio = Math.round(publicar.reduce((s, x) => s + x.euros, 0) / publicar.length);
    const peor = publicar.reduce((a, b) => (a.pct < b.pct ? a : b));
    console.log(`\nde las que quedan: ahorro medio ${medio} € · el más flojo ${peor.euros} € (${(peor.pct * 100).toFixed(1)} %)`);
  }

  if (!APLICA) {
    console.log("\nen seco: no se ha escrito nada. Con --aplica se escribe.");
    await pool.end();
    return;
  }

  // De quinientas en quinientas: son miles de filas y la base está lejos.
  const LOTE = 500;
  let escritas = 0;
  for (let i = 0; i < libres.length; i += LOTE) {
    const lote = libres.slice(i, i + LOTE);
    const valores = lote.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2}::boolean)`).join(", ");
    const params = lote.flatMap((x) => [x.id, x.publica]);
    const r = await pool.query(
      `UPDATE moveadvisor_market_offers AS o
          SET import_published = v.publica,
              import_scored_at = NOW()
         FROM (VALUES ${valores}) AS v(id, publica)
        WHERE o.id = v.id
          AND COALESCE(o.import_locked, FALSE) = FALSE`,
      params
    );
    escritas += r.rowCount;
  }
  console.log(`\nactualizadas ${escritas} filas`);
  await pool.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
