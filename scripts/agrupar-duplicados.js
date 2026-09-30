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

/**
 * Quién agrupó. Cambiar la huella obliga a cambiar esto: los grupos viejos se
 * rehacen.
 *
 * v2 (30-sep-2026): versión y vendedor normalizados, y los grupos incoherentes
 * se parten en vez de tirarse.
 */
const AUTOR = "huella.v2";

/**
 * Lo que esta pasada puede borrar: lo que agrupó ELLA o una versión anterior
 * suya.
 *
 * Tiene que borrar también las de `huella.v1`, porque si no conviven dos
 * agrupaciones automáticas sobre las mismas ofertas y la tabla deja de tener
 * sentido. Lo que NO se toca es lo que firmó una persona contestando una
 * pregunta: eso tiene otro `agrupado_por` y una pasada automática no deshace
 * una decisión humana.
 */
const MIAS = "huella.%";

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
/*
 * La versión, normalizada. El 29-sep-2026 esto era `version` tal cual.
 *
 * El mismo coche llega escrito de tres maneras según el portal, y la huella
 * solo les quitaba los espacios y los guiones:
 *
 *     1.5 TSI R-Line DSG 110kW              cochescom
 *     VOLKSWAGEN Taigo RLine 1.5 TSI DSG    cochesnet
 *     R-Line 1.5 TSI 110 kW (150 CV) DSG    wallapop
 *
 * Tres huellas distintas para el mismo VW Taigo de 2022 con 31.779 km a
 * 26.690 EUR del mismo concesionario, y el cliente lo veía tres veces.
 *
 * Se parte por espacios y se quita lo que no distingue al coche: la marca y
 * el modelo, que ya van en su columna, y la potencia -`110kw`, `150`, `cv`-,
 * que ya está en `power_cv`. Lo que queda se ordena y se pega. Las tres dan
 * `15-dsg-rline-tsi`, y el 1.0 TSI da `10-dsg-rline-tsi`: distingue el motor,
 * que es lo que tiene que hacer.
 *
 * EL COALESCE NO ES DEFENSIVO, ES NECESARIO. Cuando la versión es solo la
 * marca y el modelo -«VOLKSWAGEN - TAIGO», de milanuncios- no queda nada y el
 * resultado es NULL. Sin el coalesce esas ofertas se caerían de la agrupación
 * entera; con él, vuelven a agruparse por la versión cruda, que es lo que se
 * hacía antes. Medido: sin coalesce la candidata salía peor que no hacer nada.
 */
const VERSION_NORMAL = `
  COALESCE(
    (SELECT string_agg(t, '-' ORDER BY t) FROM (
       SELECT DISTINCT regexp_replace(lower(w), '[^a-z0-9]', '', 'g') AS t
         FROM unnest(string_to_array(o.version, ' ')) AS w) x
      WHERE t <> ''
        AND t <> lower(regexp_replace(o.brand, '[^a-zA-Z0-9]', '', 'g'))
        AND t <> lower(regexp_replace(o.model, '[^a-zA-Z0-9]', '', 'g'))
        AND t !~ '^[0-9]{3,}$'
        AND t !~ '^[0-9]+(kw|cv|ps|hp)$'
        AND t NOT IN ('kw', 'cv', 'ps', 'hp')),
    lower(regexp_replace(o.version, '[^a-zA-Z0-9]', '', 'g')))
`;

/*
 * El vendedor. Antes era `split_part(dealer_name, ' ', 1)`, y fallaba igual.
 *
 *     cochescom   "Flexicar"             -> flexicar
 *     cochesnet   "Flexicar Alcobendas"  -> flexicar
 *     flexicar    "Alcobendas"           -> alcobendas   <- se rompia aqui
 *
 *     cochescom   "OcasionPlus"          -> ocasionplus
 *     cochesnet   "OcasionPlus-Girona"   -> ocasionplus-girona   <- y aqui
 *
 * Dos arreglos concretos. Partir por cualquier carácter que no sea letra o
 * número -no solo por el espacio- resuelve el guion de OcasionPlus. Y cuando
 * el portal ES la cadena, el grupo de vendedor es el portal: en su propia web
 * no repiten la marca en el nombre del concesionario porque es obvia.
 */
const CADENAS = "('flexicar','clicars','ocasionplus','autohero','canalcar','modrive','vian','gamboa')";
const VENDEDOR = `
  CASE WHEN o.portal IN ${CADENAS} THEN o.portal
       ELSE lower((regexp_split_to_array(btrim(o.dealer_name), '[^a-zA-Z0-9]+'))[1]) END
`;

const HUELLA = `
  lower(regexp_replace(o.brand, '[^a-zA-Z0-9]', '', 'g')) || '|' ||
  ${VERSION_NORMAL} || '|' ||
  o.year::text || '|' || o.mileage::text || '|' || o.price::text || '|' ||
  ${VENDEDOR}
`;

/*
 * ── El color, normalizado ─────────────────────────────────────────────────
 *
 * WALLAPOP DA LOS COLORES EN INGLÉS Y TODOS LOS DEMÁS EN ESPAÑOL. Medido el
 * 30-sep-2026, cada forma inglesa aparece en UN solo portal y cada española
 * en diez u once:
 *
 *     blanco  256.491  11 portales      white   94.199   solo wallapop
 *     gris    209.014  11 portales      gray    68.791   solo wallapop
 *     negro   180.343  11 portales      black   48.905   solo wallapop
 *     azul    122.328  11 portales      blue    33.084   solo wallapop
 *     rojo     73.891  11 portales      red     21.381   solo wallapop
 *
 * Sin esto, el mismo coche en wallapop y en coches.net tiene «red» y «Rojo»,
 * el grupo se considera incoherente y se parte en dos. Se vio en una muestra
 * de cinco grupos: en tres de ellos, todos los miembros idénticos salvo uno
 * que traía el color en el otro idioma.
 *
 * Y hay tres formas de suciedad más, todas con volumen:
 *   «gris / plata» (60.712)      -> se queda con lo de antes de la barra
 *   «blanco (blanco)» de milanuncios -> se quita el paréntesis
 *   «marron» sin tilde            -> se quitan las tildes
 */
const COLOR_BASE = `
  translate(
    btrim(split_part(
      regexp_replace(lower(btrim(coalesce(color, ''))), '\\s*\\(.*\\)$', '', 'g'),
      '/', 1)),
    'áéíóúàèìòùâêîôûäëïöü', 'aeiouaeiouaeiouaeiou')
`;

/** El color en una forma comparable, o NULL si no dice nada. */
const COLOR = `
  CASE ${COLOR_BASE}
    WHEN '' THEN NULL WHEN '-' THEN NULL
    WHEN 'otro' THEN NULL WHEN 'other' THEN NULL WHEN 'multicolor' THEN NULL
    WHEN 'white' THEN 'blanco'   WHEN 'black' THEN 'negro'
    WHEN 'blue' THEN 'azul'      WHEN 'red' THEN 'rojo'
    WHEN 'green' THEN 'verde'    WHEN 'yellow' THEN 'amarillo'
    WHEN 'orange' THEN 'naranja' WHEN 'maroon' THEN 'granate'
    WHEN 'brown' THEN 'marron'   WHEN 'gold' THEN 'dorado'
    WHEN 'violet' THEN 'violeta' WHEN 'purple' THEN 'violeta'
    /* La plata y el gris se confundian ya antes de esto: de 285 conflictos
       de color, 147 eran «Gris» contra «Plata» del mismo coche. */
    WHEN 'gray' THEN 'gris'      WHEN 'grey' THEN 'gris'
    WHEN 'silver' THEN 'gris'    WHEN 'plata' THEN 'gris'
    WHEN 'plateado' THEN 'gris'
    ELSE ${COLOR_BASE}
  END
`;

/*
 * Lo físico, para PARTIR un grupo incoherente en vez de tirarlo entero.
 *
 * La potencia va en tramos de 10 CV y no exacta, porque un portal dice 100 y
 * otro 102 del mismo motor: es la misma tolerancia que ya contempla COHERENTE
 * con su umbral de 20.
 */
const FISICO = `
  coalesce(${COLOR}, '?') || '|' ||
  coalesce(nullif(doors, 0)::text, '?') || '|' ||
  coalesce(nullif(seats, 0)::text, '?') || '|' ||
  coalesce((nullif(power_cv, 0) / 10)::text, '?')
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
  count(DISTINCT ${COLOR}) <= 1
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
/*
 * ── Un grupo incoherente se PARTE, no se tira ──────────────────────────────
 *
 * Antes, si un miembro se contradecía en algo físico, se descartaba el grupo
 * ENTERO. Tres coches idénticos y dos intrusos: se perdían los cinco. Eran
 * 6.403 grupos y 36.229 ofertas que el cliente veía repetidas por eso.
 *
 * Ahora los grupos sanos se quedan EXACTAMENTE igual -misma huella, mismos
 * miembros, mismo canónico, mismos enlaces- y solo a los incoherentes se les
 * añade lo físico a la huella. Los intrusos caen solos en otro grupo y los
 * buenos siguen juntos.
 *
 * Medido el 24-sep-2026 sobre 1,58 M de ofertas españolas vivas, contando
 * grupos que sobreviven y ofertas que se dejan de repetir:
 *
 *     como estaba                              68.894 grupos · 226.318 ocultas
 *     solo partir los incoherentes             76.625        · 262.547
 *     partir + version y vendedor normalizados 82.309        · 269.720
 *
 * Y los grupos que cruzan portales -los que ve el cliente- pasan de 5.567 a
 * 11.182. El doble.
 *
 * Una vía que parecía buena y NO lo era, por si alguien la reintenta: meter
 * lo físico en la clave de TODOS los grupos, no solo de los incoherentes. El
 * total mejora, pero `coalesce(color,'?')` hace que un dato AUSENTE sea un
 * cubo propio, y las ofertas de portales distintos son justo las que difieren
 * en qué campos traen rellenos: los cruces de portal caían de 5.567 a 1.300.
 */
const GRUPOS = `
  WITH base AS (
    SELECT o.id, ${HUELLA} AS h, ${FISICO} AS fis,
           o.first_seen_at, o.portal, o.city, o.location, o.url, o.dealer_name, o.price,
           o.color, o.power_cv, o.doors, o.seats
    FROM moveadvisor_market_offers o
    WHERE ${APLICABLE}
  ),
  sano AS (
    SELECT h, (${COHERENTE}) AS ok
    FROM base
    GROUP BY h
    HAVING count(*) > 1
  ),
  candidatas AS (
    SELECT b.id, b.first_seen_at, b.portal, b.city, b.location, b.url, b.dealer_name, b.price,
           b.color, b.power_cv, b.doors, b.seats,
           CASE WHEN s.ok THEN b.h ELSE b.h || '#' || b.fis END AS huella
    FROM base b
    JOIN sano s ON s.h = b.h
  ),
  validos AS (
    SELECT huella
    FROM candidatas
    GROUP BY huella
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
      Se borra lo que agrupó esta huella o una versión anterior suya.

      Un grupo con otro `agrupado_por` lo decidió una persona contestando una
      pregunta, y una pasada automática no deshace una decisión humana. Es la
      misma regla que en todo lo demás: lo que firma alguien, manda.

      Por eso el LIKE y no el igual: al pasar de `huella.v1` a `huella.v2`,
      borrar solo las de la versión nueva dejaría las viejas conviviendo con
      ellas sobre las mismas ofertas.
    */
    const borradas = await pool.query(
      "DELETE FROM moveadvisor_offer_duplicates WHERE agrupado_por LIKE $1",
      [MIAS],
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
