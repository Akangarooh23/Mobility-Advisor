"use strict";

/**
 * Sin ficha técnica no se tasa su coche.
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
 * Tasar **un coche que tiene dado de alta**. En cuanto existe el IDCar, la
 * ficha técnica es obligatoria para tasarlo.
 *
 * La tasación suelta de la web —de quien todavía no tiene el coche dado de
 * alta— no se bloquea: ahí no hay papeles que pedir, y lo que salga depende de
 * lo que él haya escrito, que es cosa suya. Es la puerta de entrada y cerrarla
 * sería cerrar el negocio.
 *
 * ## Y si no se puede comprobar, tampoco se tasa
 *
 * Esto empezó dejando pasar cuando la consulta fallaba, con el argumento de que
 * una tabla caída no puede dejar sin tasar a nadie. Es el argumento equivocado:
 * **una tasación vale lo que vale su fiabilidad**. Si no podemos comprobar con
 * qué coche estamos comparando, lo que sale no es una tasación peor, es un
 * número sin respaldo — y encima se le cobra o se le gasta la gratuita.
 *
 * Así que si la comprobación no se puede hacer, no se tasa y se le dice que lo
 * intente en un rato. No se le cobra nada y no se le gasta la gratuita.
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

/**
 * Su coche por la matrícula.
 *
 * La tasación de pago llega con la matrícula que escribió, no con el
 * identificador: es la misma manera de engancharla que usa `lib/tasacion.js`
 * para saber a qué coche colgarle el informe.
 */
const SQL_SU_COCHE = `
  SELECT v.id
    FROM moveadvisor_user_vehicles v
    LEFT JOIN moveadvisor_users u ON u.id = v.user_id
   WHERE upper(regexp_replace(COALESCE(v.plate, ''), '[^A-Za-z0-9]', '', 'g')) = $1
     AND (lower(COALESCE(v.user_email, '')) = $2 OR lower(COALESCE(u.email, '')) = $2)
   LIMIT 1`;

/** Lo que se le dice cuando no la tiene. Dice qué falta y para qué. */
const PORQUE = "Para tasar este coche falta su ficha técnica. "
  + "De ahí sacamos la versión real, y sin ella la tasación compararía tu coche "
  + "con otros que no son el tuyo.";

/**
 * Y lo que se le dice cuando no hemos podido comprobarlo.
 *
 * No dice «sube la ficha técnica», porque a lo mejor ya la tiene: dice la
 * verdad, que es que ahora mismo no podemos comprobarlo.
 */
const NO_SE_PUEDE_COMPROBAR = "No hemos podido comprobar la ficha técnica de tu coche. "
  + "No te hemos cobrado nada: vuelve a intentarlo en unos minutos.";

/** La matrícula como se compara: sin espacios ni guiones y en mayúsculas. */
const comoSeCompara = (m) => String(m ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Si se puede tasar ese coche suyo. Devuelve el motivo por el que no, o "".
 *
 * Sin `vehicleId` no se bloquea nada: es la tasación suelta, donde no hay coche
 * dado de alta al que pedirle papeles.
 */
async function porQueNoSePuedeTasar(pool, vehicleId) {
  const id = String(vehicleId ?? "").trim();
  if (!id) return "";
  if (!pool) return NO_SE_PUEDE_COMPROBAR;
  try {
    const r = await pool.query(SQL_TIENE_FICHA, [id, LA_FICHA]);
    return r.rows.length ? "" : PORQUE;
  } catch {
    return NO_SE_PUEDE_COMPROBAR;
  }
}

/**
 * Lo mismo, cuando lo que hay es la matrícula.
 *
 * Primero se mira si esa matrícula es de un coche suyo. Si no lo es, es la
 * tasación suelta y pasa. Si lo es, le hace falta la ficha.
 *
 * Que la búsqueda falle también para: sin saber si tiene IDCar no se puede
 * decir que no hace falta comprobarlo, y tasar «por si acaso» es justo lo que
 * no queremos cobrarle.
 */
async function porQueNoSePuedeTasarSuCoche(pool, email, matricula) {
  const placa = comoSeCompara(matricula);
  const correo = String(email ?? "").trim().toLowerCase();
  if (!placa || !correo) return "";
  if (!pool) return NO_SE_PUEDE_COMPROBAR;

  let suyo;
  try {
    const r = await pool.query(SQL_SU_COCHE, [placa, correo]);
    suyo = r.rows[0];
  } catch {
    return NO_SE_PUEDE_COMPROBAR;
  }
  // No es ninguno de los suyos: tasación suelta, y lo que salga depende de lo
  // que haya escrito él.
  if (!suyo) return "";
  return porQueNoSePuedeTasar(pool, suyo.id);
}

module.exports = {
  LA_FICHA,
  SQL_TIENE_FICHA,
  SQL_SU_COCHE,
  PORQUE,
  NO_SE_PUEDE_COMPROBAR,
  porQueNoSePuedeTasar,
  porQueNoSePuedeTasarSuCoche,
};
