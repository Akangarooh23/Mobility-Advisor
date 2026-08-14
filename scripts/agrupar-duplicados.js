/**
 * Un coche publicado varias veces pasa a contarse una.
 *
 * ─── Qué hace ───────────────────────────────────────────────────────────────
 *
 * Reconstruye `moveadvisor_offer_duplicates`: qué anuncios son el mismo coche,
 * cuál lo representa, y en qué ubicaciones está publicado. **No toca la tabla
 * de ofertas**, que es de los scrapers.
 *
 * ─── Por qué se reconstruye entera y no se actualiza ────────────────────────
 *
 * Un grupo cambia solo: aparece una copia nueva, muere el canónico, un anuncio
 * baja de precio y deja de coincidir. Llevar eso por diferencias exige acertar
 * en todos los casos y equivocarse en uno deja un grupo mal para siempre —
 * apuntando a un muerto, o partido en dos.
 *
 * Rehacerla cuesta un TRUNCATE y ~220.000 inserciones en una tabla pequeña. Es
 * la razón de que sea una tabla aparte: hacer lo mismo con columnas en las
 * ofertas serían 600.000 filas reescritas cada madrugada en la tabla más
 * caliente del sistema.
 *
 * Lo único que se respeta entre pasadas son los grupos decididos a mano: si
 * `agrupado_por` no es esta huella, es una decisión de una persona y una pasada
 * automática no la deshace.
 *
 * ─── Por qué vive aquí y no en Jarvis ───────────────────────────────────────
 *
 * Escribe en la base del negocio. Jarvis no escribe en CarsWise ni cuando tiene
 * razón: emite comandos y decide el dominio. Esto es dominio, así que es código
 * de este repo, con sus credenciales, igual que `jarvis-command-processor.js`.
 *
 * ─── Cuándo corre, y por qué DESPUÉS de las 07:00 ───────────────────────────
 *
 * `mantenimiento-activas` recalcula `is_active` de todas las ofertas a las
 * 07:00. Correr antes sería agrupar sobre un estado a punto de cambiar y elegir
 * canónicos entre anuncios que en media hora estarán muertos.
 *
 *   node --env-file=.env.local scripts/agrupar-duplicados.js [--aplicar]
 *
 * Sin `--aplicar` no escribe: cuenta lo que haría. Ése es el modo por defecto a
 * propósito — esto decide qué 165.000 ofertas deja de ver un cliente, y no debe
 * poder pasar por teclear mal un comando.
 */
const { Pool } = require("pg");

const APLICAR = process.argv.includes("--aplicar");

/** Quién agrupó. Cambiar la huella obliga a cambiar esto: los grupos viejos se rehacen. */
const AUTOR = "huella.v1";

/**
 * La huella. Es la misma que valida `duplicados.mjs` en Jarvis y la que aplica
 * la tasación, y está comprobada: 54.161 grupos, de los que solo un 0,24 % se
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
 *    87.059 duplicados reales que la primera versión descartaba.
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
 * La coherencia: si el grupo se contradice en algo físico, no se fusiona.
 *
 * Los umbrales salen de los datos y no del sentido común. De 807 conflictos de
 * potencia, 744 difieren en 5 CV o menos —un portal dice 100 y otro 102 del
 * mismo motor— y de 285 de color, 147 son "Gris" contra "Plata". Descartar
 * cualquier diferencia habría tirado 1.146 grupos buenos para quitar unos 130:
 * ocho buenos por cada malo.
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

/**
 * Los grupos, calculados de una sola vez sobre una foto fija del estado.
 *
 * El canónico es el de `first_seen_at` más antiguo, y es PEGAJOSO: solo cambia
 * si muere, porque entonces el siguiente más antiguo toma el relevo. La
 * alternativa evidente —"el actualizado más recientemente"— cambiaría casi cada
 * noche, y con él la oferta que ve un cliente y el enlace que compartiste. El
 * `id` desempata para que dos pasadas seguidas den lo mismo.
 */
const GRUPOS = `
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
         first_value(c.id) OVER (PARTITION BY c.huella ORDER BY c.first_seen_at, c.id) AS canonico
  FROM candidatas c
  JOIN validos v ON v.huella = c.huella
`;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

  try {
    const existe = await pool.query(
      "SELECT to_regclass('public.moveadvisor_offer_duplicates') IS NOT NULL AS hay",
    );
    if (!existe.rows[0].hay) {
      console.error("Falta la tabla. Aplica antes scripts/migrations/2026-08-14-duplicados.sql");
      process.exitCode = 1;
      return;
    }

    await pool.query("BEGIN");
    await pool.query(`CREATE TEMP TABLE grupos ON COMMIT DROP AS ${GRUPOS}`);

    const resumen = await pool.query(`
      SELECT count(*)::int AS anuncios,
             count(DISTINCT canonico)::int AS coches,
             count(*) FILTER (WHERE id <> canonico)::int AS copias
      FROM grupos
    `);
    const { anuncios, coches, copias } = resumen.rows[0];

    if (!APLICAR) {
      const porPortal = await pool.query(`
        SELECT portal, count(*)::int AS n, count(*) FILTER (WHERE id <> canonico)::int AS ocultas
        FROM grupos GROUP BY portal ORDER BY ocultas DESC
      `);
      console.log("\nEN SECO. Nada se ha escrito.\n");
      console.log(`  ${anuncios} anuncios → ${coches} coches · ${copias} copias se ocultarían\n`);
      for (const p of porPortal.rows) {
        console.log(`  ${p.portal.padEnd(14)} ${String(p.n).padStart(7)} anuncios → ${String(p.ocultas).padStart(7)} ocultos`);
      }
      console.log("\n  Para aplicarlo: --aplicar\n");
      await pool.query("ROLLBACK");
      return;
    }

    /*
      Se borra solo lo que agrupó esta huella.

      Un grupo con otro `agrupado_por` lo decidió una persona contestando una
      pregunta, y una pasada automática no deshace una decisión humana. Es la
      misma regla que en todo lo demás: lo que firma alguien, manda.
    */
    const borradas = await pool.query(
      "DELETE FROM moveadvisor_offer_duplicates WHERE agrupado_por = $1",
      [AUTOR],
    );

    const insertadas = await pool.query(
      `
      INSERT INTO moveadvisor_offer_duplicates
        (offer_id, canonical_id, huella, ubicaciones, apariciones, agrupado_por)
      SELECT g.id, g.canonico, g.huella,
             /*
               Las ubicaciones y las apariciones solo van en el canónico: es la
               fila que consulta la web. Repetirlas en cada copia sería el mismo
               dato cinco veces esperando a discrepar.
             */
             CASE WHEN g.id = g.canonico THEN u.ubicaciones END,
             CASE WHEN g.id = g.canonico THEN u.apariciones END,
             $1
      FROM grupos g
      LEFT JOIN (
        SELECT canonico,
               /*
                 NORMALIZADAS: minúsculas y sin acentos.

                 La primera versión guardaba la ciudad tal cual y salían doce
                 entradas para siete ciudades — "CORDOBA" y "Córdoba", "MADRID"
                 y "Madrid". Eso rompe justo lo que este array existe para
                 permitir: si la web filtra por "Córdoba" y aquí pone "CORDOBA",
                 el coche no sale por esa ubicación.

                 Este array es para BUSCAR. Los nombres tal y como los escribe
                 cada portal se conservan en "apariciones", que es de donde los
                 lee la ficha — así el filtro casa y la pantalla sigue diciendo
                 "Córdoba" y no "cordoba".
               */
               array_agg(DISTINCT lower(unaccent(sitio))) FILTER (WHERE sitio <> '') AS ubicaciones,
               jsonb_agg(DISTINCT jsonb_build_object(
                 'portal', portal, 'ciudad', city, 'vendedor', dealer_name,
                 'precio', price, 'url', url))                       AS apariciones
        FROM (
          SELECT canonico, portal, city, dealer_name, price, url,
                 btrim(unnest(ARRAY[coalesce(city, ''), coalesce(location, '')])) AS sitio
          FROM grupos
        ) t
        GROUP BY canonico
      ) u ON u.canonico = g.canonico
      -- Un grupo decidido a mano no se pisa.
      ON CONFLICT (offer_id) DO NOTHING
      `,
      [AUTOR],
    );

    await pool.query("COMMIT");

    console.log("\nAPLICADO");
    console.log(`  ${anuncios} anuncios → ${coches} coches`);
    console.log(`  ${borradas.rowCount} agrupaciones anteriores rehechas`);
    console.log(`  ${insertadas.rowCount} filas escritas · ${copias} copias ocultas\n`);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error(`falló: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
