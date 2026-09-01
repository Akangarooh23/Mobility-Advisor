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
 * El viaje entero del coche, **un coche por pedido**.
 *
 * Son dos tramos y aquí van sumados, porque el cliente paga un viaje:
 *
 * - **750 €** de la ciudad alemana a Zaragoza. Precio real acordado con el
 *   transportista habitual, no una media. Está por debajo del rango de mercado
 *   observado para esa ruta, que va de 400 a 1.100 €.
 * - **363 €** de Zaragoza a casa del cliente: 300 € más IVA, fijo e igual para
 *   cualquier destino peninsular.
 *
 * Zaragoza está en medio porque ahí se pasa la ITV de homologación, y porque
 * queda a media distancia de Madrid, Barcelona, Valencia y Bilbao.
 *
 * Antes eran 1.500 € de un tirón, y antes 700. Ninguno de los dos salía de un
 * presupuesto: eran un hueco para que la fórmula tuviera algo.
 */
const TRANSPORTE_A_ZARAGOZA = 750;
const TRANSPORTE_A_CASA = 363;
const TRANSPORTE = TRANSPORTE_A_ZARAGOZA + TRANSPORTE_A_CASA;

/**
 * El papeleo de matricular un coche importado.
 *
 * Ya no es una estimación. Son tres cosas con su factura detrás:
 *
 * - **122,20 €** de ITV de homologación en Zaragoza: ficha técnica reducida
 *   84,70 con IVA más la inspección de matriculación, 37,50 en gasolina. En
 *   diésel son 46,76, así que este número se queda corto por unos euros en los
 *   diésel; se coge el de gasolina porque son dos tercios del catálogo.
 * - **83,60 €** de gestión, tasa de la DGT y cuota del colegio de gestores.
 *   Tarifario real del proveedor, fila de transferencias.
 * - **24 €** de placas físicas, que el gestor no incluye en su tarifa.
 *
 * Todo esto presupone **COC europeo válido**, que es como se compra. Un coche
 * sin COC necesita homologación individual, de 1.500 a 3.500 €, y ese no es el
 * mismo negocio: no se compra.
 *
 * Antes eran 600 €, escritos como `400 + 200` sin comentario. Se pusieron de
 * prueba cuando se montó la sección y se quedaron.
 */
const ITV_HOMOLOGACION = 122.2;
const GESTORIA_Y_DGT = 83.6;
const PLACAS = 24;
const PAPELEO_ESTIMADO = Math.round(ITV_HOMOLOGACION + GESTORIA_Y_DGT + PLACAS);

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
 * **El transporte cubre el viaje entero, hasta su casa**, y son dos tramos: de
 * la ciudad alemana a Zaragoza, y de Zaragoza a su puerta. En Zaragoza pasa la
 * ITV de homologación y se prepara, y está ahí y no en Madrid porque queda a
 * media distancia de Madrid, Barcelona, Valencia y Bilbao.
 *
 * Los dos tramos van en esta línea. El cliente paga un viaje, no dos: que por
 * dentro sean dos camiones —o el mismo conductor— es cosa nuestra.
 *
 * Reacondicionado y seguro **no están aquí**: se contratan aparte y **no entran
 * en la fianza**. Decirlo es lo que evita que el precio parezca crecer después.
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
    { concepto: "Transporte desde Alemania hasta tu casa", importe: TRANSPORTE },
    {
      concepto: "Matriculación y papeleo",
      importe: PAPELEO_ESTIMADO + IMPUESTO_MATRICULACION * referencia,
    },
  ];

  return {
    lineas: lineas.map((l) => ({ ...l, importe: Math.round(l.importe) })),
    total: Math.round(lineas.reduce((t, l) => t + l.importe, 0)),
    // Lo que no va dentro, dicho aquí para que la pantalla no se lo invente.
    aparte: ["Seguro", "Reacondicionado, si hace falta"],
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


/**
 * Cuánto tiene que ahorrar el cliente para que publiquemos el coche.
 *
 * Un 15 % sobre lo que costaría el mismo coche comprado aquí. Por debajo de eso
 * el anuncio juega en contra: alguien se toma la molestia de traer un coche de
 * Alemania, esperar tres semanas y matricularlo, para ahorrarse lo que cuesta
 * una revisión. Enseñar esas ofertas no llena el catálogo, lo diluye.
 *
 * Antes el suelo era el 10 %, y estaba puesto sobre un coste que era menos de la
 * mitad del real y que no descontaba lo que gana PopCar: por eso lo pasaban las
 * 1.568 ofertas. Un filtro que no filtra nada no es un filtro.
 */
const AHORRO_MINIMO = 0.15;

/**
 * Y un techo, que suena raro pero no lo es.
 *
 * Un ahorro del 60 % sobre el precio español no es una ganga: es que uno de los
 * dos precios está mal. O el coche alemán tiene algo que el anuncio no dice, o
 * los comparables españoles no son comparables. Publicarlo es prometer algo que
 * al llamar no se puede sostener.
 */
const AHORRO_MAXIMO = 0.50;

/**
 * Cuántos coches parecidos hacen falta en España para fiarse del precio.
 *
 * La referencia española es la mediana de anuncios comparables. Con cuatro
 * anuncios, la mediana es el capricho de cuatro vendedores.
 */
const COMPARABLES_MINIMOS = 15;

/**
 * Lo que se ahorra el cliente por traerlo, en euros y en tanto por uno.
 *
 * Es la diferencia entre lo que le costaría aquí y lo que le va a costar con
 * nosotros —con nuestro margen ya dentro—. No es nuestro beneficio: es el suyo.
 *
 * En la base hay una columna que se llama `import_margin` y que es exactamente
 * esto, el ahorro del cliente. El nombre confunde y ha confundido.
 */
function ahorroDelCliente(precioAleman, precioEspanol) {
  const referencia = Number(precioEspanol) || 0;
  const puesto = precioPuestoAqui(precioAleman, referencia);
  const euros = referencia - puesto;
  return { euros: Math.round(euros), pct: referencia > 0 ? euros / referencia : 0 };
}

/**
 * Si esta oferta se publica.
 *
 * Vive aquí y no en el flujo de n8n a propósito. Estaban las dos, decían cosas
 * distintas, y la que decidía era la que nadie miraba: el catálogo llevaba
 * semanas publicado con los números de un modelo que ya no existía. Con esto,
 * el precio que ve el cliente y la decisión de enseñárselo salen de las mismas
 * constantes y no se pueden separar.
 */
function sePublica({ precioAleman, precioEspanol, comparables }) {
  if (!(Number(precioAleman) > 0) || !(Number(precioEspanol) > 0)) return false;
  if (!(Number(comparables) >= COMPARABLES_MINIMOS)) return false;
  const { pct } = ahorroDelCliente(precioAleman, precioEspanol);
  return pct >= AHORRO_MINIMO && pct <= AHORRO_MAXIMO;
}
module.exports = {
  TRANSPORTE,
  TRANSPORTE_A_ZARAGOZA,
  TRANSPORTE_A_CASA,
  PAPELEO_ESTIMADO,
  ITV_HOMOLOGACION,
  GESTORIA_Y_DGT,
  PLACAS,
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
  AHORRO_MINIMO,
  AHORRO_MAXIMO,
  COMPARABLES_MINIMOS,
  ahorroDelCliente,
  sePublica,
};
