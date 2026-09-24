"use strict";

/**
 * Lo que el test le encarga al buscador de ofertas.
 *
 * ## Para qué está esto
 *
 * El test preguntaba casi todo sobre **la modalidad** —comprar, financiar,
 * renting, carsharing— y casi nada sobre **el coche**. Así que cuando llegaba
 * el momento de enseñar ofertas, la búsqueda no tenía con qué filtrar: se
 * traía lo más reciente del pool y confiaba en que algo encajara.
 *
 * Eso tenía dos caras, y las dos se arreglan con lo mismo. La visible era que
 * las ofertas no venían a cuento. La otra era el tiempo: medido contra
 * producción, una búsqueda con carrocería y combustible tarda 15-22 segundos y
 * **una sin ningún criterio, 107**. Filtrar no es solo mejor: es más rápido,
 * porque el precio y los kilómetros sí tienen índice y el texto libre no.
 *
 * ## Las dos que faltaban
 *
 * Hasta cuánto quiere gastarse y hasta cuántos kilómetros acepta. Son las dos
 * cosas que cualquiera mira primero en un coche de segunda mano, y el test no
 * las preguntaba: el precio se deducía de la cuota mensual —lo que obliga a
 * inventarse un plazo y un interés— y los kilómetros no se preguntaban en
 * absoluto.
 */

const texto = (v) => String(v ?? "").trim();

/**
 * Hasta cuánto quiere gastarse, en euros.
 *
 * El tope de cada tramo es el que se manda a la búsqueda. Del tramo abierto de
 * arriba no se manda nada: quien puede gastar más de 45.000 no quiere que le
 * escondan un coche de 60.000.
 */
const EL_PRECIO = {
  hasta_10k: 10000,
  "10k_15k": 15000,
  "15k_20k": 20000,
  "20k_30k": 30000,
  "30k_45k": 45000,
  mas_45k: null,
};

/**
 * Y hasta cuántos kilómetros.
 *
 * «Me da igual» no manda tope: hay coches de 200.000 km que son la compra
 * correcta para quien hace 5.000 al año, y esconderlos sería decidir por él.
 */
const LOS_KILOMETROS = {
  hasta_50k: 50000,
  hasta_100k: 100000,
  hasta_150k: 150000,
  sin_limite_km: null,
};

/**
 * Traduce las respuestas del test a los filtros de la búsqueda.
 *
 * Solo pone lo que el cliente ha dicho. Lo que no ha contestado no se rellena
 * con una suposición: un tope de precio inventado deja fuera ofertas que él
 * habría mirado.
 */
function elEncargoDeBusqueda(answers = {}) {
  const encargo = {};

  const precio = EL_PRECIO[texto(answers.presupuesto_total)];
  if (precio) encargo.maxPrice = precio;

  const kms = LOS_KILOMETROS[texto(answers.km_maximos_coche)];
  if (kms) encargo.maxMileage = kms;

  return encargo;
}

module.exports = { elEncargoDeBusqueda, EL_PRECIO, LOS_KILOMETROS };
