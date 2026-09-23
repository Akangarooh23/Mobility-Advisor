"use strict";

/**
 * Sin ficha técnica no se tasa.
 *
 * ## Por qué
 *
 * Una tasación es comparar su coche con los que son como él, y **la versión es
 * lo que dice cuáles son**. Una gama tiene tres «1.5» que no valen lo mismo: el
 * R-Line y el básico son el mismo motor y miles de euros de diferencia.
 *
 * Esa versión la elige el cliente de una lista, de memoria y con prisa. Si
 * elige una que no es la suya, el número que sale no está mal por poco: está
 * comparado con **otros coches**. Y ese número es del que se habla luego con él
 * y del que sale el precio de salida.
 *
 * La ficha técnica lo fija sin opinión: cilindrada, potencia en kilovatios,
 * código de motor y los códigos de homologación. Con ella se puede comprobar
 * que la versión elegida es la suya antes de comparar nada.
 *
 * ## Qué bloquea exactamente
 *
 * Tasar **un coche de su garaje** sin la ficha técnica subida. La tasación
 * suelta de la web —quien todavía no tiene el coche dado de alta— no pasa por
 * aquí: allí no hay IDCar, ni ficha, ni nada que comprobar.
 *
 * ## Y por qué en el servidor
 *
 * En la pantalla el botón ya sale apagado, y eso no es un bloqueo: un botón
 * apagado se salta con la pantalla anterior abierta, con el botón de atrás o
 * llamando a la dirección. Si la regla importa, vive donde se escribe.
 */

/** El papel que hace falta. Es el mismo nombre con el que se guarda. */
const LA_FICHA = "technical_sheet";

const SQL_TIENE_FICHA = `
  SELECT 1
    FROM moveadvisor_user_vehicle_documents
   WHERE vehicle_id = $1
     AND document_type = $2
     AND (COALESCE(file_url, '') <> '' OR COALESCE(file_content_base64, '') <> '')
   LIMIT 1`;

/** Lo que se le dice cuando no la tiene. Dice qué falta y para qué. */
const PORQUE = "Para tasar este coche falta su ficha técnica. "
  + "De ahí sacamos la versión real, y sin ella la tasación compararía tu coche "
  + "con otros que no son el tuyo.";

/**
 * Si se puede tasar eso. Devuelve el motivo por el que no, o cadena vacía.
 *
 * Sin `vehicleId` no se bloquea nada: es la tasación suelta de la web, donde no
 * hay coche dado de alta al que pedirle papeles.
 *
 * Y si la consulta falla, **deja pasar**. Una tabla que no responde no puede
 * dejar sin tasar a todo el mundo: el daño de una tasación con la versión sin
 * comprobar es mucho menor que el de tirar la funcionalidad entera.
 */
async function porQueNoSePuedeTasar(pool, vehicleId) {
  const id = String(vehicleId ?? "").trim();
  if (!id || !pool) return "";
  try {
    const r = await pool.query(SQL_TIENE_FICHA, [id, LA_FICHA]);
    return r.rows.length ? "" : PORQUE;
  } catch {
    return "";
  }
}

module.exports = { LA_FICHA, SQL_TIENE_FICHA, PORQUE, porQueNoSePuedeTasar };
