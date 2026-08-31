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
 * El papeleo de matricular un coche importado.
 *
 * Antes eran `400 + 200`, dos números sin comentario que se pusieron de prueba
 * cuando se montó la sección. Ya se sabe que no salían de ningún sitio: no eran
 * un coste medido, eran un hueco para que la fórmula tuviera algo.
 *
 * Se quedan como **estimación del papeleo** —honorarios de la gestoría, tasa de
 * la DGT, ITV de homologación y placas— hasta que la gestoría dé su precio. La
 * tarifa que tenemos de Bernal cubre transferencias y duplicados, pero **no la
 * matriculación de un vehículo importado**, que es justo este trámite.
 *
 * Cuando llegue ese precio, esto deja de ser una constante y sale de su tarifa,
 * como ya sale el transporte de las suyas.
 */
const PAPELEO_ESTIMADO = 600;

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
  return TRANSPORTE + PAPELEO_ESTIMADO + IMPUESTO_MATRICULACION * referencia;
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
    { concepto: "Matriculación y papeleo", importe: PAPELEO_ESTIMADO, firme: false },
    { concepto: "Impuesto de matriculación", importe: IMPUESTO_MATRICULACION * referencia, firme: false },
    { concepto: "Margen PopCar", importe: margenDePopCar(coste), firme: true },
  ];
}

/**
 * El precio partido como se le enseña al cliente.
 *
 * Tres líneas, no cinco. **El margen va dentro del precio del coche**, no
 * suelto: nadie desglosa lo que gana el que le vende, y sacarlo aparte solo
 * invita a discutirlo. Lo que sí se separa es lo que el cliente reconoce como
 * un servicio —traerlo y matricularlo—, porque es lo que explica por qué el
 * coche cuesta más que en el anuncio alemán.
 *
 * Reacondicionado y seguro **no están aquí**: se facturan aparte, y decirlo es
 * lo que evita que el precio parezca crecer después.
 *
 * La garantía sí está dentro, y no por generosidad: vendiendo como empresa a un
 * particular es obligatoria. Eso la convierte en un **coste que sale del**
 * **margen**, no en un servicio que se factura. En un coche barato, de los
 * 1.000 € de margen hay que descontarla.
 */
function desgloseParaElCliente(precioAleman, precioEspanol) {
  const aleman = Number(precioAleman) || 0;
  const referencia = Number(precioEspanol) || 0;
  const coste = aleman + costeDeTraerlo(referencia);
  const margen = margenDePopCar(coste);

  const lineas = [
    { concepto: "Precio del coche", importe: aleman + margen },
    { concepto: "Transporte desde Alemania", importe: TRANSPORTE },
    {
      concepto: "Matriculación y papeleo",
      importe: PAPELEO_ESTIMADO + IMPUESTO_MATRICULACION * referencia,
    },
  ];

  return {
    lineas: lineas.map((l) => ({ ...l, importe: Math.round(l.importe) })),
    total: Math.round(lineas.reduce((t, l) => t + l.importe, 0)),
    // Lo que no va dentro, dicho aquí para que la pantalla no se lo invente.
    aparte: ["Reacondicionado, si hace falta", "Seguro"],
    // Y lo que sí, por si alguien duda: es obligatorio y no se cobra aparte.
    incluido: ["Garantía"],
  };
}

/**
 * El precio puesto aquí, escrito en SQL.
 *
 * La lista se ordena y se filtra por este precio en la base, y se enseña con
 * el cálculo de arriba. Si fueran dos fórmulas distintas, ordenar por «precio
 * más bajo» daría un orden que no se corresponde con los números en pantalla,
 * y eso se lee como que el filtro está roto. Se genera desde las mismas
 * constantes para que no puedan separarse.
 *
 * `alias` es el prefijo de la tabla, por si la consulta la lleva.
 */
function sqlPrecioPuestoAqui(alias = "") {
  const c = alias ? `${alias}.` : "";
  const traerlo = `(${TRANSPORTE} + ${PAPELEO_ESTIMADO} + ${IMPUESTO_MATRICULACION}*COALESCE(${c}market_price_es,0))`;
  const coste = `(COALESCE(${c}price,0) + ${traerlo})`;
  const tramos = MARGEN
    .map((t) => `WHEN ${coste} <= ${t.hasta} THEN ${t.importe}`)
    .join(" ");
  return `(${coste} + CASE ${tramos} ELSE round(${coste} * ${MARGEN_PORCENTAJE}) END)`;
}

/**
 * Lo que se ahorra el cliente, en tanto por uno, escrito en SQL.
 *
 * Es lo mismo que se pinta en la tarjeta —«ahorras ~7.789 € (26 %)»— pero
 * calculado en la base para poder ordenar por ello.
 *
 * **No se usa la columna `import_margin_pct`**, que sería lo cómodo: esa la
 * escribe el flujo de n8n una vez al día y con la fórmula que tuviera ese día.
 * Ordenar por ella daría una lista cuyos porcentajes no coinciden con los que
 * se están viendo, que es exactamente lo que hace pensar que un filtro está
 * roto.
 *
 * Un coche sin precio español de comparables no tiene con qué compararse: se
 * queda sin porcentaje y cae al final de la lista.
 */
function sqlAhorroPct(alias = "") {
  const c = alias ? `${alias}.` : "";
  return `((COALESCE(${c}market_price_es,0) - ${sqlPrecioPuestoAqui(alias)})
           / NULLIF(${c}market_price_es,0))`;
}

module.exports = {
  TRANSPORTE,
  PAPELEO_ESTIMADO,
  IMPUESTO_MATRICULACION,
  MARGEN,
  MARGEN_PORCENTAJE,
  margenDePopCar,
  costeDeTraerlo,
  precioPuestoAqui,
  partidasDeTraerlo,
  desgloseParaElCliente,
  sqlPrecioPuestoAqui,
  sqlAhorroPct,
};
