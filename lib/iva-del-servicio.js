"use strict";

/**
 * Qué IVA lleva nuestra factura, según quién la recibe.
 *
 * Casi siempre el 21 %: un servicio de intermediación y gestión prestado a un
 * particular residente lo lleva, y eso lo confirmó el asesor.
 *
 * La excepción es una empresa de otro país de la UE con NIF-IVA: entonces la
 * factura va **sin IVA** y el impuesto lo autoliquida ella en su país. Es la
 * inversión del sujeto pasivo, y también la confirmó. Hoy el sistema no lo
 * contempla y le pondría el 21 % igual, que para esa empresa es un 21 % que no
 * puede deducirse aquí y tiene que pedir por el modelo 360, meses después.
 *
 * **Y no basta con que el número parezca extranjero.** Aplicar la exención es
 * dejar de ingresar un IVA, y si el cliente no está de verdad registrado, ese
 * IVA lo debemos nosotros. Por eso hace falta que alguien lo haya comprobado en
 * el censo europeo —VIES— y lo haya dejado marcado: sin esa marca, 21 %.
 *
 * Eso deja el sistema del lado seguro mientras no exista ni la pantalla para
 * pedir el NIF-IVA ni la comprobación contra VIES. Las dos están apuntadas en
 * los pendientes.
 */

const IVA_GENERAL = 21;

/**
 * Los prefijos de NIF-IVA de la Unión, sin España.
 *
 * España no está porque a un cliente español se le repercute IVA español, sea
 * empresa o particular: la inversión del sujeto pasivo es para operaciones
 * entre estados distintos.
 *
 * Irlanda del Norte usa XI desde el Brexit y sigue dentro a estos efectos; el
 * resto del Reino Unido, no.
 */
const PREFIJOS_UE = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "FI", "FR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE",
  "SI", "SK", "XI",
];

/** El país de un NIF-IVA, si lo lleva delante. */
function paisDelNifIva(nif) {
  const limpio = String(nif ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefijo = limpio.slice(0, 2);
  return PREFIJOS_UE.includes(prefijo) && limpio.length > 2 ? prefijo : null;
}

/**
 * Si a este cliente se le factura sin IVA.
 *
 * Las tres condiciones, y hacen falta las tres: que tenga NIF-IVA, que sea de
 * otro estado de la UE, y que **alguien lo haya comprobado** en VIES.
 */
function vaSinIva(cliente = {}) {
  const pais = paisDelNifIva(cliente.tax_id ?? cliente.nifIva);
  if (!pais) return false;
  return Boolean(cliente.nif_iva_verificado ?? cliente.nifIvaVerificado);
}

/** El tipo que le toca, en tanto por ciento. */
function tipoDeIvaDelServicio(cliente = {}) {
  return vaSinIva(cliente) ? 0 : IVA_GENERAL;
}

/**
 * Y la línea que tiene que llevar la factura cuando va sin IVA.
 *
 * Una factura exenta sin decir por qué está incompleta: quien la recibe —y
 * quien la revise— tiene que poder leer en el papel por qué no hay cuota.
 */
const POR_QUE_SIN_IVA =
  "Operación no sujeta en España: inversión del sujeto pasivo "
  + "(art. 84.Uno.2.º LIVA). El IVA lo autoliquida el destinatario.";

/**
 * Lo que falta para poder dejar de repercutir el IVA a este cliente.
 *
 * Se contesta con una lista y no con un sí o un no, porque quien lo mire tiene
 * que saber **qué** le falta: casi siempre será la comprobación en VIES, y esa
 * la hace una persona.
 */
function faltaParaFacturarSinIva(cliente = {}) {
  const nif = String(cliente.tax_id ?? cliente.nifIva ?? "").trim();
  if (!nif) return ["el NIF-IVA del cliente"];
  // Con un NIF que no es de otro estado no hay exención que pedir, así que
  // mandarle a comprobarlo en VIES sería mandarle a perder el rato.
  if (!paisDelNifIva(nif)) return ["un NIF-IVA de otro país de la UE"];
  if (!(cliente.nif_iva_verificado ?? cliente.nifIvaVerificado)) {
    return ["comprobarlo en VIES y dejarlo marcado"];
  }
  return [];
}

module.exports = {
  IVA_GENERAL,
  PREFIJOS_UE,
  paisDelNifIva,
  vaSinIva,
  tipoDeIvaDelServicio,
  POR_QUE_SIN_IVA,
  faltaParaFacturarSinIva,
};
