"use strict";

/**
 * Lo que cuesta traer un coche de Alemania y ponerlo en la calle.
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
 * Antes eran 700 €. Se subió sabiendo lo que cuesta: con 700 se publicaban 1.568
 * ofertas y con 1.500 se publican unas 800, porque el resto deja de ahorrarle al
 * cliente lo suficiente. No es que se pierdan coches: es que con el número
 * antiguo se estaban enseñando a un precio que no cubría traerlos.
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
 * El impuesto de matriculación, y dos cosas que están mal.
 *
 * 4,75 % es **una** de las cuatro bandas por emisiones (0 / 4,75 / 9,75 /
 * 14,75 %), la de 120–159 g/km. Se aplica a todos los coches por igual, así que
 * un coche de más de 200 g/km se queda corto por miles de euros.
 *
 * Y la base tampoco es esta: en un usado el impuesto no se calcula sobre lo que
 * se pagó, sino sobre el valor de mercado que publica Hacienda menos la
 * depreciación por antigüedad.
 *
 * No se arregla aquí porque falta el dato: de las ofertas alemanas publicadas,
 * **ninguna trae el CO₂**. Hasta que el scraper lo traiga, calcular la banda
 * correcta es imposible y cambiar la fórmula solo movería el error de sitio.
 */
const IMPUESTO_MATRICULACION = 0.0475;

/**
 * El coste de traer un coche, tal y como lo calcula hoy la consulta de n8n.
 *
 * Se pasa el precio alemán porque el impuesto va sobre él —ver arriba: eso es
 * justamente lo que habrá que cambiar cuando haya CO₂—.
 */
function costeDeTraerlo(precioAleman) {
  const precio = Number(precioAleman) || 0;
  return TRANSPORTE + SIN_IDENTIFICAR + IMPUESTO_MATRICULACION * precio;
}

/** Lo mismo, partido, que es como hay que poder enseñarlo y auditarlo. */
function partidasDeTraerlo(precioAleman) {
  const precio = Number(precioAleman) || 0;
  return [
    { concepto: "Transporte", importe: TRANSPORTE, firme: false },
    { concepto: "Sin identificar", importe: SIN_IDENTIFICAR, firme: false },
    { concepto: "Impuesto de matriculación", importe: IMPUESTO_MATRICULACION * precio, firme: false },
  ];
}

module.exports = {
  TRANSPORTE,
  SIN_IDENTIFICAR,
  IMPUESTO_MATRICULACION,
  costeDeTraerlo,
  partidasDeTraerlo,
};
