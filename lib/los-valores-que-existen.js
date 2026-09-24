"use strict";

/**
 * Los valores que de verdad hay en cada columna, para poder comparar con `=`.
 *
 * ## El problema, con el plan delante
 *
 * El consejero filtraba el combustible y la carrocería con `LIKE '%gasolina%'`.
 * Un `LIKE` con comodín delante **no puede usar ningún índice**, así que cada
 * búsqueda recorría la tabla entera. Medido con `EXPLAIN` contra producción:
 *
 *     Parallel Seq Scan on moveadvisor_market_offers
 *       Rows Removed by Filter: 784.466
 *       Buffers: read=448.243
 *       Execution Time: 117.939 ms
 *
 * Y no se arregla con más índices: se probaron siete, más un `ANALYZE` y un
 * `VACUUM`. El problema no es que falte un índice, es que esa condición no
 * puede usar ninguno.
 *
 * ## Lo que hace esto
 *
 * En el pool hay **once** combustibles distintos y **cuarenta y ocho**
 * carrocerías. No hace falta buscar por parecido: se puede saber cuáles son y
 * preguntar por ellos con `=`, que sí usa índice.
 *
 * La lista sale de `mmo_facetas`, la vista de los desplegables, que ya está
 * calculada y es diminuta. Se guarda cinco minutos en memoria porque cambia
 * cuando aparece un valor nuevo, y eso pasa cada meses.
 *
 * ## Y si la vista no está
 *
 * Se devuelve nada y quien llama vuelve al `LIKE` de antes. Lento, pero
 * encuentra: quedarse sin ofertas por no poder leer una vista auxiliar sería
 * cambiar una pantalla lenta por una vacía.
 */

/** Cinco minutos. Un valor nuevo en la columna es cosa de meses. */
const LO_QUE_DURA_MS = 5 * 60 * 1000;

let cache = null;
let caduca = 0;

const plano = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Trae los valores distintos de combustible, carrocería y provincia.
 *
 * Nunca lanza: si la vista no existe todavía —la crea la tarea de los
 * desplegables— devuelve un mapa vacío y el buscador sigue con el `LIKE`.
 */
async function losQueHay(pool) {
  const ahora = Date.now();
  if (cache && ahora < caduca) return cache;
  if (!pool) return new Map();

  try {
    const { rows } = await pool.query(
      `SELECT tipo, valor FROM mmo_facetas WHERE tipo IN ('fuel', 'body_type', 'province')`
    );
    const mapa = new Map();
    for (const f of rows) {
      const tipo = String(f.tipo);
      if (!mapa.has(tipo)) mapa.set(tipo, []);
      mapa.get(tipo).push(String(f.valor));
    }
    cache = mapa;
    caduca = ahora + LO_QUE_DURA_MS;
    return mapa;
  } catch (err) {
    console.warn("[valores] no se han podido leer de mmo_facetas:", err && err.message);
    return new Map();
  }
}

/**
 * Cuáles de esos valores encajan con lo que se busca.
 *
 * `formas` son los trozos con los que se reconocía antes —«hibrid», «hybrid»,
 * «hev»— y aquí sirven para elegir de la lista real en vez de para buscar en
 * la tabla. El parecido se calcula una vez sobre cuarenta y ocho valores, no
 * un millón y medio de veces sobre las ofertas.
 */
function losQueEncajan(valoresDelTipo, formas) {
  if (!Array.isArray(valoresDelTipo) || !valoresDelTipo.length) return null;
  if (!Array.isArray(formas) || !formas.length) return null;

  const trozos = formas.map(plano).filter(Boolean);
  const encajan = valoresDelTipo.filter((v) => {
    const suyo = plano(v);
    return trozos.some((t) => suyo.includes(t));
  });

  /*
   * Si no encaja ninguno, se devuelve nada y no se filtra por esta columna.
   *
   * Un `= ANY('{}')` no devolvería ni una fila, y el cliente se quedaría sin
   * ofertas sin saber por qué. Mejor ensenarle coches de más que ninguno.
   */
  return encajan.length ? encajan.map((v) => v.toLowerCase()) : null;
}

module.exports = { losQueHay, losQueEncajan, LO_QUE_DURA_MS };
