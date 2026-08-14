/**
 * Un coche publicado varias veces pasa a contarse una.
 *
 * ─── Qué hace, en tres pasos ────────────────────────────────────────────────
 *
 *   1. AGRUPA con la huella validada y elige un canónico por grupo.
 *   2. PROMOCIONA si el canónico murió: el grupo no puede desaparecer del
 *      catálogo porque se cayera justo el anuncio que lo representaba.
 *   3. RELLENA `ubicaciones` y `apariciones` en el canónico, que es lo que la
 *      web necesita para enseñar "también está en Málaga" y para que el filtro
 *      por ubicación devuelva el coche por cualquiera de las suyas.
 *
 * ─── Por qué vive aquí y no en Jarvis ───────────────────────────────────────
 *
 * Escribe en `moveadvisor_market_offers`, que es del negocio. Jarvis no escribe
 * en CarsWise ni cuando tiene razón: emite comandos y decide el dominio. Esto es
 * dominio, así que es código de este repo, con sus credenciales, igual que
 * `jarvis-command-processor.js`.
 *
 * ─── Cuándo corre, y por qué DESPUÉS de las 07:00 ───────────────────────────
 *
 * `mantenimiento-activas` recalcula `is_active` de todas las ofertas a las
 * 07:00. Si esto corriera antes, agruparía sobre un estado que está a punto de
 * cambiar: elegiría canónicos entre anuncios que en media hora estarán muertos.
 *
 * ─── El canónico es PEGAJOSO, y no es un detalle ────────────────────────────
 *
 * Se elige por `first_seen_at` más antiguo, y solo cambia si muere. La
 * alternativa evidente —"el actualizado más recientemente"— cambiaría casi cada
 * noche, y con él cambiaría la oferta que ve un cliente, el enlace que
 * compartiste y cualquier cosa que apunte a ese id.
 *
 *   node --env-file=.env.local scripts/agrupar-duplicados.js [--aplicar]
 *
 * Sin `--aplicar` no escribe: cuenta lo que haría y lo enseña. Ése es el modo
 * por defecto a propósito — esto oculta 160.000 ofertas del catálogo y no debe
 * poder pasar por teclear mal un comando.
 */
const { Pool } = require("pg");

const APLICAR = process.argv.includes("--aplicar");

/**
 * La huella. Es la misma que valida `duplicados.mjs` en Jarvis y la que usa la
 * tasación, y está comprobada: 54.161 grupos, de los que solo un 0,24 % se
 * contradice en algo físico. Ana revisó doce a ojo, con las fotos delante.
 *
 * Cada pieza se eligió contra los datos:
 *
 *  · `version` y no `model`: el mismo BMW es "Serie 2" en un portal y "216" en
 *    otro. Agrupar por modelo daba un 57 % de duplicados, casi todo falso.
 *  · Kilometraje exacto y NO redondo: el 18,8 % marca múltiplos de mil, y
 *    "100.000 km" junta coches distintos de verdad.
 *  · Grupo de vendedor = primer token: sin eso, "CLICARS MADRID" y "CLICARS
 *    MÁLAGA" son dos vendedores y sus coches dos coches. Normalizarlo recuperó
 *    87.059 duplicados reales.
 *  · Precio idéntico: decisión de Ana. Los mismos coches con precio distinto
 *    entre portales NO se fusionan solos — se le preguntan.
 */
const HUELLA = `
  lower(regexp_replace(brand, '[^a-zA-Z0-9]', '', 'g'))   || '|' ||
  lower(regexp_replace(version, '[^a-zA-Z0-9]', '', 'g')) || '|' ||
  year::text || '|' || mileage::text || '|' || price::text || '|' ||
  lower(split_part(btrim(dealer_name), ' ', 1))
`;

const APLICABLE = `
  is_active
  AND coalesce(version, '') <> ''
  AND coalesce(dealer_name, '') <> ''
  AND year IS NOT NULL
  AND price > 0
  AND mileage > 1000
  AND mileage % 1000 <> 0
`;

/**
 * La coherencia. Si el grupo se contradice en algo físico, no se fusiona.
 *
 * Los umbrales salen de los datos y no del sentido común: de 807 conflictos de
 * potencia, 744 difieren en 5 CV o menos —un portal dice 100 y otro 102 del
 * mismo motor— y de 285 de color, 147 son "Gris" contra "Plata". Descartar
 * cualquier diferencia habría tirado 1.146 grupos buenos para quitar unos 130.
 */
const COHERENTE = `
  count(DISTINCT CASE
    WHEN lower(btrim(coalesce(color, ''))) IN ('', 'otro', 'other', 'multicolor', '-') THEN NULL
    WHEN lower(btrim(color)) IN ('gris', 'plata', 'plateado', 'silver') THEN 'gris'
    ELSE lower(btrim(color)) END) <= 1
  AND coalesce(max(nullif(power_cv, 0)) - min(nullif(power_cv, 0)), 0) <= 20
  AND count(DISTINCT nullif(doors, 0)) <= 1
  AND count(DISTINCT nullif(seats, 0)) <= 1
`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

  try {
    const columnas = await pool.query(`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_name = 'moveadvisor_market_offers'
        AND column_name IN ('duplicate_of', 'ubicaciones', 'apariciones')
    `);
    if (columnas.rows[0].n < 3) {
      console.error("Faltan columnas. Aplica antes scripts/migrations/2026-08-14-duplicados.sql");
      process.exitCode = 1;
      return;
    }

    /*
      Todo en una transacción, y con la tabla temporal calculada UNA vez.

      El grupo se calcula sobre una foto fija del estado. Si se recalculara en
      cada paso, un scraper escribiendo a la vez podría dejar un canónico
      apuntando a una oferta que ya cambió de grupo entre paso y paso.
    */
    await pool.query("BEGIN");

    await pool.query(`
      CREATE TEMP TABLE grupos ON COMMIT DROP AS
      WITH candidatas AS (
        SELECT id, ${HUELLA} AS huella, first_seen_at, portal, city, location, url, dealer_name, price
        FROM moveadvisor_market_offers
        WHERE ${APLICABLE}
      ),
      validos AS (
        SELECT ${HUELLA} AS huella
        FROM moveadvisor_market_offers
        WHERE ${APLICABLE}
        GROUP BY ${HUELLA}
        HAVING count(*) > 1 AND ${COHERENTE}
      )
      SELECT c.*,
             /*
               El canónico: el que lleva más tiempo publicado. Pegajoso — solo
               cambia si muere, porque el siguiente más antiguo pasa a serlo.
               El id desempata para que la elección sea determinista y dos
               pasadas seguidas no den canónicos distintos.
             */
             first_value(c.id) OVER (PARTITION BY c.huella ORDER BY c.first_seen_at, c.id) AS canonico
      FROM candidatas c
      JOIN validos v ON v.huella = c.huella
    `);

    const total = await pool.query("SELECT count(*)::int AS n, count(DISTINCT canonico)::int AS coches FROM grupos");
    const { n, coches } = total.rows[0];

    if (!APLICAR) {
      const porPortal = await pool.query(`
        SELECT portal, count(*)::int AS anuncios, count(*) FILTER (WHERE id <> canonico)::int AS se_ocultan
        FROM grupos GROUP BY portal ORDER BY se_ocultan DESC
      `);
      console.log(`\nEN SECO. Nada se ha escrito.\n`);
      console.log(`  ${n} anuncios agrupados en ${coches} coches · ${n - coches} copias se ocultarían\n`);
      for (const p of porPortal.rows) {
        console.log(`  ${p.portal.padEnd(14)} ${String(p.anuncios).padStart(7)} anuncios → ${String(p.se_ocultan).padStart(7)} ocultos`);
      }
      console.log(`\n  Para aplicarlo: --aplicar\n`);
      await pool.query("ROLLBACK");
      return;
    }

    /*
      Se limpia antes de marcar, y hace falta.

      Una oferta que ayer era copia puede ser hoy canónica —porque murió la
      suya— o dejar de tener grupo. Sin este borrado arrastraría para siempre un
      `duplicate_of` que apunta a un muerto, y quedaría invisible en el catálogo
      sin que nada lo explicara.
    */
    const limpiadas = await pool.query(`
      UPDATE moveadvisor_market_offers
      SET duplicate_of = NULL, ubicaciones = NULL, apariciones = NULL
      WHERE duplicate_of IS NOT NULL OR ubicaciones IS NOT NULL
    `);

    const marcadas = await pool.query(`
      UPDATE moveadvisor_market_offers o
      SET duplicate_of = g.canonico
      FROM grupos g
      WHERE o.id = g.id AND g.id <> g.canonico
    `);

    const canonicos = await pool.query(`
      UPDATE moveadvisor_market_offers o
      SET ubicaciones = a.ubicaciones, apariciones = a.apariciones
      FROM (
        SELECT canonico,
               array_agg(DISTINCT btrim(ciudad)) FILTER (WHERE btrim(ciudad) <> '') AS ubicaciones,
               jsonb_agg(jsonb_build_object(
                 'portal', portal, 'ciudad', city, 'vendedor', dealer_name,
                 'precio', price, 'url', url) ORDER BY portal, city)               AS apariciones
        FROM (
          SELECT canonico, portal, city, dealer_name, price, url,
                 unnest(ARRAY[coalesce(city, ''), coalesce(location, '')]) AS ciudad
          FROM grupos
        ) t
        GROUP BY canonico
      ) a
      WHERE o.id = a.canonico
    `);

    await pool.query("COMMIT");

    console.log(`\nAPLICADO`);
    console.log(`  ${n} anuncios → ${coches} coches`);
    console.log(`  ${limpiadas.rowCount} marcas anteriores limpiadas`);
    console.log(`  ${marcadas.rowCount} copias marcadas`);
    console.log(`  ${canonicos.rowCount} canónicos con sus ubicaciones\n`);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error(`falló: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
