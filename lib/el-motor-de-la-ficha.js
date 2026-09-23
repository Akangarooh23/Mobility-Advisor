"use strict";

/**
 * El motor que dice la ficha técnica de un coche suyo.
 *
 * ## Para qué
 *
 * Para que el cliente elija bien su versión. Elige de una lista de cuarenta, de
 * memoria y con prisa, y esa versión es la que decide **con qué coches se
 * compara el suyo** al tasarlo: una gama tiene tres «1.5» que no valen lo mismo.
 *
 * Su ficha técnica ya está leída —el ERP lo hace en cuanto la sube— y de ahí
 * salen los dos números que ningún cliente se inventa: la cilindrada (P.1) y
 * los kilovatios (P.2). Con eso, la lista se puede ordenar poniendo delante las
 * versiones que su motor **puede** tener.
 *
 * ## Lo que no hace
 *
 * No esconde ninguna versión. Poner delante las que encajan ayuda; quitar las
 * demás deja al cliente sin la suya y sin saber por qué, y el papel puede venir
 * mal leído. Ordenar es una sugerencia, filtrar es una afirmación.
 *
 * Y no sirve de nada al **dar de alta** el coche: la ficha se sube en ese mismo
 * formulario, así que todavía no hay nada leído. Esto es para cuando vuelve a
 * editarlo.
 */

/** Lo leído vive en la tabla que escribe el ERP. Aquí solo se mira. */
const SQL_EL_MOTOR = `
  SELECT codigos
    FROM erp_fichas_tecnicas_leidas
   WHERE vehicle_id = $1
     AND COALESCE(fallo, '') = ''`;

/**
 * El número entero de un valor del papel: «1.498», «1498 cm3», «110 kW».
 *
 * Se quitan **todos** los caracteres que no son cifras, y no se interpreta
 * ningún punto como decimal. En un papel español «1.498» son mil cuatrocientos
 * noventa y ocho, y leyéndolo como decimal salía **1**: una cilindrada de un
 * centímetro cúbico con la que no encajaba ninguna versión.
 *
 * Los dos datos que se leen aquí —cilindrada y kilovatios— son enteros por
 * definición, así que no se pierde nada.
 */
function elEntero(v) {
  /*
   * La primera tirada de cifras, con sus separadores, y nada más.
   *
   * Quitando **todos** los caracteres que no son cifras, «1.498 cm3» daba
   * 14.983: el 3 de «cm3» se pegaba al final. Y en «860 / 850» —así vienen las
   * masas por eje— se cogen los dos como si fueran uno.
   */
  const trozo = String(v ?? "").match(/\d[\d.,\s]*/);
  if (!trozo) return null;
  const cifras = trozo[0].replace(/[^0-9]/g, "");
  if (!cifras) return null;
  const n = Number(cifras);
  return Number.isFinite(n) ? n : null;
}

/**
 * La cilindrada y los kilovatios, de los códigos del papel.
 *
 * Devuelve `null` en lo que no diga. Un cero no es «no lo dice»: es un motor de
 * cero centímetros cúbicos, y con eso no encajaría ninguna versión.
 */
function elMotorQueDice(codigos) {
  const c = codigos ?? {};
  const cc = elEntero(c["P.1"]);
  const kw = elEntero(c["P.2"]);
  return {
    cc: cc && cc > 0 ? Math.round(cc) : null,
    kw: kw && kw > 0 ? Math.round(kw) : null,
  };
}

/**
 * Lo que sabemos del motor de ese coche suyo.
 *
 * Que la tabla no exista o que la consulta falle devuelve un motor vacío, no un
 * error: sin esto la lista sale como salía hasta ahora, y eso es mucho mejor
 * que no poder editar el coche.
 */
async function elMotorDeLaFicha(pool, vehicleId) {
  const id = String(vehicleId ?? "").trim();
  const vacio = { cc: null, kw: null };
  if (!id || !pool) return vacio;
  try {
    const r = await pool.query(SQL_EL_MOTOR, [id]);
    if (!r.rows.length) return vacio;
    return elMotorQueDice(r.rows[0].codigos);
  } catch {
    return vacio;
  }
}

module.exports = { SQL_EL_MOTOR, elMotorQueDice, elMotorDeLaFicha };
