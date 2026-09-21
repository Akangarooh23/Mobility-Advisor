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
  AHORRO_MINIMO, AHORRO_MINIMO_EUROS, AHORRO_MAXIMO, COMPARABLES_MINIMOS,
  FEE_POPCAR, PRECIO_MINIMO_COCHE,
} = require("../lib/coste-importacion.js");
const { catalogoDeGarantias, opcionesParaElCoche } = require("../lib/garantias.js");
const { SSL_POSTGRES } = require("../lib/postgres-ssl");

const APLICA = process.argv.includes("--aplica");

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: SSL_POSTGRES,
  });

  console.log(`fee ${FEE_POPCAR} € · coche desde ${PRECIO_MINIMO_COCHE} € · ` +
    `ahorro mínimo ${AHORRO_MINIMO_EUROS.toLocaleString("es")} € y ${(AHORRO_MINIMO * 100).toFixed(0)} % · ` +
    `máximo ${(AHORRO_MAXIMO * 100).toFixed(0)} % · ` +
    `mínimo ${COMPARABLES_MINIMOS} comparables\n`);

  /**
   * El catálogo, porque el precio publicado lleva una garantía dentro.
   *
   * Y por tanto el ahorro que se anuncia también sale de ese precio. Decidir
   * aquí sobre uno sin garantía publicaría coches cuyo ahorro real, el que el
   * cliente ve en la ficha, está por debajo del listón.
   */
  const garantias = await catalogoDeGarantias(pool);
  console.log(`garantías en catálogo: ${garantias.length}
`);

  const { rows } = await pool.query(
    // El combustible, la potencia, la cilindrada, el CO₂ y el título no son
    // decoración: de ellos sale la banda del impuesto, y el impuesto entra en
    // el precio que se publica. Sin ellos, aquí se decidiría con un 4,75 %
    // para todos y el listado enseñaría otra cosa.
    `SELECT id, price::numeric AS al, market_price_es::numeric AS es, year, mileage,
            title, fuel, power_cv, co2, displacement, body_type,
            import_comps AS comps, import_published AS publicada, import_locked AS fijada,
            COALESCE(is_active, TRUE) AS viva,
            -- Los daños mandan tanto como el precio: ver sePublica.
            --
            -- La prueba de que se han mirado es is_damaged IS NOT NULL, no la
            -- fecha: cuando AutoScout24 nos bloquea, el comprobador estampa
            -- damage_checked_at y deja is_damaged en NULL para volver a
            -- intentarlo, así que la fecha solo dice «se intentó». Tomándola
            -- por veredicto, un NULL contaba como «mirado y limpio» y esto
            -- publicaba lo que nadie ha podido mirar —hoy hay 555 coches así—.
            -- Es la misma regla que pide el flujo de scoring y la que usa
            -- ajusta-publicadas-importacion.js: mirado y limpio, las dos.
            is_damaged AS danado, (is_damaged IS NOT NULL) AS danos_vistos,
            -- Un precio neto —sin IVA, de furgoneta comercial— frente a un
            -- comparable español con IVA inventa un ahorro del 19 %. El flujo
            -- lo exige y el comprobador retira en el acto lo que lo lleva; sin
            -- mirarlo aquí, cada recálculo volvía a publicarlo.
            COALESCE(price_is_net, FALSE) AS precio_neto
       FROM moveadvisor_market_offers
      WHERE country = 'DE'`
  );

  const decididas = rows.map((f) => {
    const al = Number(f.al) || 0;
    const es = Number(f.es) || 0;
    // La que lleva su precio: la más barata que se le pueda dar a **este**
    // coche. A uno de quince años no se le puede dar ninguna y no sube nada.
    const gar = opcionesParaElCoche(garantias, f).porDefecto?.precio || 0;
    const publica = !f.precio_neto && sePublica({
      precioAleman: al, precioEspanol: es, comparables: f.comps,
      viva: f.viva !== false,
      danado: f.danado === true, danosComprobados: f.danos_vistos === true,
      garantia: gar, coche: f,
    });
    const { euros, pct } = ahorroDelCliente(al, es, gar, f);
    return {
      id: f.id, al, es, comps: Number(f.comps) || 0,
      fijada: Boolean(f.fijada), antes: Boolean(f.publicada),
      publica, euros, pct,
      // Para el resumen: de las que se caen, cuáles no son cosa del precio.
      // Un dañado o un vendido publicado es un problema distinto de un margen
      // flojo, y en el recuento de «salen» se confundían.
      motivo: f.viva === false ? "vendido"
        : f.danado === true ? "dañado"
        : f.danos_vistos !== true ? "sin comprobar daños"
        : "las cuentas",
      gar,
      puesto: Math.round(precioPuestoAqui(al, es, gar, f)),
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
  for (const motivo of ["vendido", "dañado", "sin comprobar daños", "las cuentas"]) {
    const n = salen.filter((x) => x.motivo === motivo).length;
    if (n) console.log(`    por ${motivo.padEnd(20)}: ${n}`);
  }

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
