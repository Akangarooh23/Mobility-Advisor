"use strict";

/**
 * Los desplegables del buscador de coches, calculados una vez y no en cada clic.
 *
 * ## Lo que pasaba
 *
 * Cada desplegable —marca, modelo, combustible, cambio, carrocería, provincia—
 * se calculaba en el momento con un `GROUP BY` sobre el pool entero. El pool
 * tiene **2.359.000 ofertas y 4,3 GB**, así que cada uno era un recorrido de la
 * tabla completa. Medido contra producción:
 *
 *     el desplegable de marcas          41 s
 *     los modelos de una marca          12 s
 *     combustible / cambio / provincia   8-15 s cada uno
 *
 * Y la pantalla pedía cuatro de esos a la vez, y los volvía a pedir al cambiar
 * cualquier filtro. De ahí que las marcas no se abrieran hasta que cargaba
 * todo, y que elegir Audi tardara lo que tardaba.
 *
 * ## Lo que hace esto
 *
 * Dos vistas materializadas que se refrescan solas cada hora. Leerlas es
 * inmediato porque son tablas pequeñas: lo que antes era recorrer un millón y
 * medio de filas ahora es leer unos miles.
 *
 * ## Y de paso, los modelos dejan de ser versiones
 *
 * En el desplegable de modelos de Audi salían «A1» con 8.511 ofertas y debajo
 * «A1 1.0 TFSI 95CV Adrenalin» con una, «A1 1.2 TFSI 86cv Ambition» con dos...
 * Ochocientos seis «modelos» para una marca que tiene treinta.
 *
 * No es un fallo del buscador: los volcados de wallapop y milanuncios traen la
 * versión metida en el campo del modelo —wallapop llega a mandar «1.8 TFSI
 * 180CV SLine» como modelo— y se cargaron tal cual. Son 408 y 532 grafías
 * distintas respectivamente, contra las 30 de autocasion.
 *
 * `mmo_modelos` pega cada grafía al modelo del catálogo con el que empieza, y
 * gana el más largo: «A1 Sportback 30 TFSI» es un A1 Sportback y no un A1. Lo
 * que no pega con nada se queda como está —mejor un modelo raro que perder la
 * oferta—. En Audi eso deja 155 modelos en vez de 902.
 *
 * **No se toca ni una fila del pool.** La grafía original se guarda aquí al
 * lado, que es lo que permite seguir filtrando: elegir «A1» busca las ofertas
 * cuya grafía cuelga de A1.
 */

/**
 * De dónde salen los desplegables.
 *
 * Solo lo que se enseña: `is_active AND country = 'ES'`. El resto del pool
 * —ofertas caídas y coches de Alemania— no sale en el buscador.
 */
const VISIBLE = `is_active AND country = 'ES'`;

const ENSURE_MODELOS = `
  CREATE MATERIALIZED VIEW IF NOT EXISTS mmo_modelos AS
  WITH visibles AS (
    /*
     * Por grafía en minúsculas, no por el texto tal cual: «124 Spider» y
     * «124 spider» son la misma, y contarlas por separado duplicaba la fila
     * —el índice único lo cazó al crearse—. Para enseñar se queda la forma
     * más repetida, que es la que mejor escribe el nombre.
     */
    SELECT lower(brand) AS marca,
           lower(model) AS grafia,
           (array_agg(model ORDER BY n DESC))[1] AS model,
           SUM(n)::int AS n
      FROM (SELECT brand, model, count(*)::int AS n
              FROM moveadvisor_market_offers
             WHERE ${VISIBLE} AND brand <> '' AND model IS NOT NULL
               -- Un modelo tiene que tener alguna letra o algun numero. Hay 49
               -- ofertas de Audi cuyo modelo es «-» y una cuyo modelo es «.».
               AND model ~ '[A-Za-z0-9]'
             GROUP BY brand, model) x
     GROUP BY 1, 2
  ), catalogo AS (
    SELECT lower(b.name) AS marca, m.name
      FROM moveadvisor_vehicle_models m
      JOIN moveadvisor_vehicle_brands b ON b.id = m.brand_id
     WHERE m.is_active AND b.is_active AND m.name <> '-' AND m.name <> ''
  )
  SELECT v.marca,
         v.grafia,
         -- El del catálogo con el que empieza, el más largo; si ninguno, el
         -- suyo. Nunca nulo: un modelo raro se sigue pudiendo elegir.
         COALESCE(pegado.name, v.model) AS modelo,
         /*
          * Si pegó con el catálogo o no.
          *
          * Lo que no pega es lo que los portales mandan mal: wallapop tiene un
          * modelo llamado «1.8 TFSI 180CV SLine» y milanuncios uno llamado
          * «.». Con una oferta cada uno, y el desplegable ordena alfabético,
          * así que salían los primeros. Se guardan —la oferta existe y hay que
          * poder llegar a ella— pero el desplegable solo los enseña cuando
          * pesan algo.
          */
         (pegado.name IS NOT NULL) AS del_catalogo,
         v.n
    FROM visibles v
    LEFT JOIN LATERAL (
      SELECT c.name FROM catalogo c
       WHERE c.marca = v.marca
         AND (v.grafia = lower(c.name) OR v.grafia LIKE lower(c.name) || ' %')
       ORDER BY length(c.name) DESC
       LIMIT 1
    ) pegado ON TRUE`;

/* Hace falta para poder refrescar sin bloquear la lectura. */
const ENSURE_MODELOS_INDICE = `
  CREATE UNIQUE INDEX IF NOT EXISTS mmo_modelos_grafia
    ON mmo_modelos (marca, grafia)`;

const ENSURE_MODELOS_BUSQUEDA = `
  CREATE INDEX IF NOT EXISTS mmo_modelos_modelo
    ON mmo_modelos (marca, lower(modelo))`;

/**
 * Los demás desplegables, todos en una y de una sola pasada.
 *
 * En una sola vista y no en cinco porque se refrescan a la vez y se leen a la
 * vez. Y con un `LATERAL` sobre los cinco campos en vez de cinco `UNION`,
 * porque cada `UNION` era otro recorrido de la tabla: cinco pasadas por 4,3 GB
 * tardaban cinco minutos, y un cron de Vercel no dura tanto.
 */
const ENSURE_FACETAS = `
  CREATE MATERIALIZED VIEW IF NOT EXISTS mmo_facetas AS
    SELECT f.tipo, f.valor, count(*)::int AS n
      FROM moveadvisor_market_offers o
      CROSS JOIN LATERAL (VALUES
        ('marca'::text,        o.brand),
        ('fuel',               o.fuel),
        ('transmission',       o.transmission),
        ('body_type',          o.body_type),
        ('province',           o.province)
      ) AS f(tipo, valor)
     WHERE o.is_active AND o.country = 'ES'
       AND f.valor IS NOT NULL AND f.valor <> ''
     GROUP BY 1, 2
    UNION ALL
    /*
     * Las grafías de marca de TODO el pool, no solo de lo visible.
     *
     * Las dos cosas hacen falta y son distintas: el nombre que se enseña y el
     * recuento salen de lo que se ve —sobre el total gana «Byd» 524 a 166,
     * pero entre lo visible gana «BYD»—, mientras que el filtro tiene que
     * conocer todas las grafías, porque una de menos deja ofertas fuera.
     *
     * Esto lo calculaba el buscador en cada petición de listado, recorriendo
     * los 2,36 millones de filas: 35 segundos, y la página no salía hasta
     * tenerlo.
     */
    SELECT 'marca_todas', brand, count(*)::int
      FROM moveadvisor_market_offers
     WHERE brand IS NOT NULL AND brand <> ''
     GROUP BY brand`;
const ENSURE_FACETAS_INDICE = `
  CREATE UNIQUE INDEX IF NOT EXISTS mmo_facetas_clave
    ON mmo_facetas (tipo, valor)`;

/** Todo lo que hay que tener creado. En orden: la vista y luego sus índices. */
const ENSURE = [
  ENSURE_MODELOS, ENSURE_MODELOS_INDICE, ENSURE_MODELOS_BUSQUEDA,
  ENSURE_FACETAS, ENSURE_FACETAS_INDICE,
];

/**
 * Las refresca.
 *
 * `CONCURRENTLY` para que el buscador siga leyendo mientras tanto: sin eso, la
 * vista se bloquea durante el refresco y la pantalla se queda esperando, que es
 * justo lo que se venía a arreglar.
 *
 * La primera vez no se puede: una vista recién creada no tiene datos y
 * Postgres no admite el refresco concurrente sobre una vista sin poblar. Por
 * eso se intenta y, si se queja de eso, se hace el normal.
 */
async function refresca(pool, cual = "") {
  /*
   * Una sola si se pide.
   *
   * Rehacer las dos cuesta unos tres minutos contra los 4,3 GB del pool, y una
   * función de Vercel no dura tanto: la tarea programada llama dos veces, a
   * horas distintas, y cada una rehace la suya.
   */
  const todas = ["mmo_modelos", "mmo_facetas"];
  const cuales = todas.includes(cual) ? [cual] : todas;

  const hechas = [];
  for (const vista of cuales) {
    const t0 = Date.now();
    try {
      await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${vista}`);
    } catch (err) {
      if (!/has not been populated/i.test(String(err && err.message))) throw err;
      await pool.query(`REFRESH MATERIALIZED VIEW ${vista}`);
    }
    hechas.push({ vista, ms: Date.now() - t0 });
  }
  return hechas;
}

/** Que existan. Se llama al refrescar, no en cada búsqueda. */
async function prepara(pool) {
  for (const sql of ENSURE) await pool.query(sql);
}

module.exports = { VISIBLE, ENSURE, prepara, refresca };
