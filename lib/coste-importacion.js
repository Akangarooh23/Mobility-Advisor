"use strict";

/**
 * Lo que cuesta traer un coche de Alemania, y a cuánto se vende.
 *
 * Este número **se le suma al precio del anuncio** para enseñarle al cliente lo
 * que le costaría puesto aquí, y decide qué ofertas se publican. No es un dato
 * interno: es medio precio público.
 *
 * Vivía dentro de un SQL en un JSON de n8n, como cuatro números pegados sin un
 * comentario. Aquí están con nombre, para que se pueda decir qué es cada uno y
 * cuál hay que tocar cuando cambie. La consulta de n8n sigue siendo la que
 * calcula —esto no la sustituye todavía— pero una prueba comprueba que las dos
 * dicen lo mismo, para que no se separen en silencio.
 */

/**
 * Traer el coche desde Alemania, **un coche por pedido**.
 *
 * Provisional: es lo que Ana espera pagar mientras no haya presupuestos
 * cerrados. Cuando los transportistas den tarifa por corredor, este número deja
 * de usarse para los viajes que estén tarifados.
 *
 * Antes eran 700 €, el mismo número para Múnich que para Hamburgo y para un
 * coche solo que para uno acompañado.
 */
const TRANSPORTE = 1500;

/**
 * Seiscientos euros que nadie ha sabido explicar.
 *
 * En la fórmula original eran `400 + 200`, sin comentario. Por lo que cobran las
 * gestorías, la hipótesis es que sean matricular un coche importado —honorarios,
 * tasa de la DGT, ITV de homologación y placas—, pero **es una hipótesis**: la
 * tarifa que tenemos no incluye ese trámite.
 *
 * Se deja con este nombre a propósito. Llamarlo «gestoría» sería ponerle una
 * etiqueta que parece verdad, y dentro de seis meses nadie volvería a mirarlo.
 */
const SIN_IDENTIFICAR = 600;

/**
 * El impuesto de matriculación: una aproximación, y por qué esta y no otra.
 *
 * El impuesto de verdad es un porcentaje según las emisiones —hay cuatro bandas:
 * 0, 4,75, 9,75 y 14,75 %— sobre un valor fiscal que sale de las tablas de
 * precios medios de Hacienda depreciadas por antigüedad. Nada de eso se puede
 * calcular hoy: **ninguna oferta alemana trae el CO₂**, y no tenemos las tablas.
 *
 * Así que se aproxima con la banda de 120-159 g/km sobre el precio español de
 * coches comparables. Dos avisos, los dos importantes:
 *
 * - **La base es el precio español, no el alemán.** Antes se aplicaba sobre lo
 *   que cuesta el coche en Alemania, que no se parece al valor fiscal de nada.
 *   El precio español de un usado comparable se le acerca más.
 * - **No se le aplica coeficiente de antigüedad.** El coeficiente sirve para
 *   convertir el precio de nuevo en el de usado, y el precio español que usamos
 *   ya es de usado: aplicárselo encima sería depreciar dos veces, y el impuesto
 *   saldría por debajo de un tercio de lo que sale hoy.
 *
 * Se equivoca hacia arriba, y es a propósito: en un precio público pasarse es
 * recuperable y quedarse corto es una promesa que no se puede cumplir.
 *
 * Para hacerlo bien hacen falta tres cosas que hoy no están: el CO₂ de cada
 * coche, la fecha exacta de primera matriculación —con solo el año, un coche de
 * diciembre y otro de enero caen en tramos distintos— y las tablas oficiales.
 */
const IMPUESTO_MATRICULACION = 0.0475;

/**
 * Lo que gana PopCar por coche.
 *
 * Hasta ahora, nada: el precio que se enseñaba era el coste, y lo que la base
 * llama `import_margin` no es nuestro margen sino **el ahorro del cliente**.
 * Vender al coste no es una estrategia, es un descuido.
 *
 * Va por tramos y no por porcentaje porque el trabajo de traer un coche de
 * 6.000 € y uno de 25.000 € es casi el mismo: las gestiones, el transporte y las
 * llamadas no bajan porque el coche sea barato. Solo a partir de 40.000 € pasa a
 * porcentaje, donde el riesgo sí crece con el precio.
 *
 * Los tramos van por el **coste puesto en España**, no por el precio de venta:
 * si fueran por el precio, el margen se mordería la cola.
 */
const MARGEN = [
  { hasta: 10000, importe: 1000 },
  { hasta: 15000, importe: 1200 },
  { hasta: 20000, importe: 1500 },
  { hasta: 25000, importe: 1700 },
  { hasta: 30000, importe: 2000 },
  { hasta: 40000, importe: 2500 },
];

/** A partir del último tramo, el margen crece con el coche. */
const MARGEN_PORCENTAJE = 0.06;

function margenDePopCar(costePuesto) {
  const coste = Number(costePuesto) || 0;
  const tramo = MARGEN.find((t) => coste <= t.hasta);
  return tramo ? tramo.importe : Math.round(coste * MARGEN_PORCENTAJE);
}

/**
 * El coste de traer un coche, tal y como lo calcula hoy la consulta de n8n.
 *
 * `precioEspanol` es la mediana de comparables en España, que es la base del
 * impuesto aproximado. Sin ella no se puede estimar: no se inventa un cero.
 */
function costeDeTraerlo(precioEspanol) {
  const referencia = Number(precioEspanol) || 0;
  return TRANSPORTE + SIN_IDENTIFICAR + IMPUESTO_MATRICULACION * referencia;
}

/**
 * Lo que costaría el coche puesto aquí, con el margen dentro.
 *
 * El margen se calcula sobre el coste, y se suma después: es lo que se le cobra
 * al cliente, no un coste más.
 */
function precioPuestoAqui(precioAleman, precioEspanol) {
  const coste = (Number(precioAleman) || 0) + costeDeTraerlo(precioEspanol);
  return coste + margenDePopCar(coste);
}

/** Lo mismo, partido, que es como hay que poder enseñarlo y auditarlo. */
function partidasDeTraerlo(precioAleman, precioEspanol) {
  const referencia = Number(precioEspanol) || 0;
  const coste = (Number(precioAleman) || 0) + costeDeTraerlo(precioEspanol);
  return [
    { concepto: "Precio en Alemania", importe: Number(precioAleman) || 0, firme: true },
    { concepto: "Transporte", importe: TRANSPORTE, firme: false },
    { concepto: "Sin identificar", importe: SIN_IDENTIFICAR, firme: false },
    { concepto: "Impuesto de matriculación", importe: IMPUESTO_MATRICULACION * referencia, firme: false },
    { concepto: "Margen PopCar", importe: margenDePopCar(coste), firme: true },
  ];
}

module.exports = {
  TRANSPORTE,
  SIN_IDENTIFICAR,
  IMPUESTO_MATRICULACION,
  MARGEN,
  MARGEN_PORCENTAJE,
  margenDePopCar,
  costeDeTraerlo,
  precioPuestoAqui,
  partidasDeTraerlo,
};
