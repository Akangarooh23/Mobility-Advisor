"use strict";

/**
 * La motorización que pidió el cliente, y la etiqueta que de verdad le toca.
 *
 * ## Lo que salía en pantalla
 *
 * Ana pidió un **gasolina, compacto, de menos de 100.000 km y menos de
 * 10.000 €**. El análisis le contestó:
 *
 *     PROPULSIONES VIABLES   híbrido · PHEV · gasolina eficiente
 *     ETIQUETA DGT           CERO
 *     «Te deja mejor posicionado frente a ZBE con etiqueta CERO»
 *
 * La etiqueta CERO es de eléctricos y de híbridos enchufables con autonomía
 * declarada. **Un gasolina de menos de 10.000 € no la tiene ni la puede
 * tener**, y no es un matiz: es lo que decide si puedes entrar en el centro de
 * Madrid. Decírselo mal a quien compra por eso es mandarle a comprar el coche
 * equivocado.
 *
 * ## De dónde venía
 *
 * De dos sitios que se alimentaban el uno al otro. La lista de propulsiones se
 * deducía del garaje y del entorno de uso **sin mirar lo que el cliente había
 * contestado** —solo se le añadía la suya delante, y únicamente si le había
 * dado peso a esa pregunta— y la etiqueta se sacaba de esa lista: como llevaba
 * PHEV, salía CERO.
 *
 * ## Las dos reglas
 *
 * Si ha elegido motorización, esa es la lista. Lo deducido solo vale cuando ha
 * dicho que no tiene preferencia.
 *
 * Y de un gasolina o un diésel no se afirma una etiqueta concreta, porque
 * depende de la fecha exacta de matriculación y aquí no se sabe. Se dice «B o
 * C, según el año», que es verdad, en vez de una letra que suena mejor.
 */

/** Del vocabulario del test al que usa el motor. */
const LAS_MOTORIZACIONES = {
  electrico_puro: "electrico",
  hibrido_enchufable: "PHEV",
  hibrido_no_enchufable: "hibrido",
  gasolina: "gasolina eficiente",
  diesel: "diesel",
  glp_gnc: "GLP/GNC",
};

/** La respuesta que significa «elegid vosotros». */
const SIN_PREFERENCIA = "indiferente_motor";

const comoLista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Lo que ha elegido, o `null` si ha dicho que le da igual.
 *
 * `null` y no una lista vacía a propósito: son dos cosas distintas. Vacío
 * sería «no quiere ninguna», y lo que pasa es que no ha elegido.
 */
function laMotorizacionQuePidio(answers = {}) {
  const suyas = comoLista(answers.propulsion_preferida)
    .map((v) => String(v || "").trim())
    .filter((v) => v && v !== SIN_PREFERENCIA);

  if (!suyas.length) return null;

  const traducidas = suyas.map((v) => LAS_MOTORIZACIONES[v]).filter(Boolean);
  return traducidas.length ? [...new Set(traducidas)] : null;
}

/**
 * La etiqueta que le corresponde a esa motorización.
 *
 * El orden importa: si entre lo viable hay un eléctrico y un gasolina, la
 * etiqueta que se enseña es la de lo primero de la lista, que es lo que se le
 * está recomendando. Antes bastaba con que la palabra «PHEV» apareciera en
 * cualquier posición para afirmar CERO.
 */
function laEtiquetaQueLeCorresponde(propulsiones = []) {
  const lista = comoLista(propulsiones).map((p) => String(p || "").toLowerCase());
  const primera = lista[0] || "";

  if (primera.includes("electrico") || primera.includes("phev")) return "CERO";
  if (primera.includes("hibrido")) return "ECO";
  if (primera.includes("glp") || primera.includes("gnc")) return "ECO";

  /*
   * Y aqui no se afirma una letra.
   *
   * Un gasolina de 2007 es C y uno de 2004 es B, y la diferencia es entrar o
   * no entrar en Madrid Central. Sin la fecha de matriculacion no se sabe, y
   * decir «C» porque suena mejor es afirmar algo que no se puede sostener.
   */
  if (primera) return "B o C";

  return "";
}

/** Si la etiqueta es una de las que dejan entrar en una ZBE. */
function dejaEntrarEnLaZbe(etiqueta) {
  return etiqueta === "CERO" || etiqueta === "ECO";
}

module.exports = {
  LAS_MOTORIZACIONES,
  SIN_PREFERENCIA,
  laMotorizacionQuePidio,
  laEtiquetaQueLeCorresponde,
  dejaEntrarEnLaZbe,
};
