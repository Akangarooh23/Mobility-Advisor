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
 * Lo que cobra PopCar: un fee por el servicio de importación.
 *
 * **PopCar no compra el coche.** El coche lo vende el concesionario alemán al
 * cliente español; nosotros nos encargamos de todo lo demás. Eso no es un
 * matiz jurídico: cambia quién responde de la garantía, a nombre de quién se
 * matricula y qué se factura. Nosotros facturamos **el servicio**, no un coche.
 *
 * Lo que cubre el fee:
 *
 * - Revisar el coche allí, en persona, antes de que se libere ni un euro.
 * - Recogerlo y traerlo hasta Zaragoza.
 * - La ITV de homologación y toda la documentación.
 * - Revisarlo al llegar.
 * - Llevárselo a su casa.
 *
 * Lo que **no** cubre, y se dice en la ficha para que el precio no crezca
 * después: el **impuesto de matriculación**, que depende del coche y no de
 * nosotros, y la **garantía mecánica**, que la pone un tercero y el cliente
 * añade si quiere.
 *
 * Es plano y no por tramos porque el trabajo es el mismo: el mismo viaje, la
 * misma ITV, las mismas gestiones. Lo que sí cambia con el precio del coche es
 * si al cliente le compensa, y eso lo resuelve `PRECIO_MINIMO_COCHE`.
 *
 * Antes esto era un margen por tramos —de 1.000 a 2.500 €— sobre un coche que
 * comprábamos nosotros. Ese modelo ya no es el que hay.
 */
const FEE_POPCAR = 3000;

/**
 * El IVA del servicio.
 *
 * Un servicio de gestion prestado a un particular en España lo lleva. No es una
 * decision nuestra ni una eleccion de precio: es lo que hay.
 *
 * Se declara aparte del fee porque son dos cosas distintas y se confunden con
 * facilidad: **los 3.000 € son nuestros y los 630 son de Hacienda**. Meterlos en
 * la misma constante haria pensar que ganamos 3.630 por coche.
 */
const IVA_SERVICIO = 0.21;

/**
 * La base: lo nuestro de esos 3.000, sin el IVA que va dentro.
 *
 * 3.000 / 1,21 = 2.479,34. Los otros 520,66 son de Hacienda: los cobramos y los
 * ingresamos. Lo que ganamos se cuenta sobre esta cifra, no sobre el precio.
 */
const FEE_POPCAR_BASE = Math.round(FEE_POPCAR / (1 + IVA_SERVICIO));

/**
 * Por debajo de este precio no se importa.
 *
 * Con un fee de 3.000 €, un coche de 5.000 € sale por 8.000 antes del impuesto:
 * el servicio cuesta más de la mitad de la operación y la diferencia con
 * comprarlo aquí no da para pagarlo. Medido sobre el catálogo: por debajo de
 * 10.000 € la brecha mediana con España es de 2.050 €, y el fee más el impuesto
 * se la comen entera.
 *
 * No es una regla de precio, es una regla de sentido: traer un coche barato de
 * Alemania cuesta lo mismo que traer uno caro, y solo el caro lo sostiene.
 */
const PRECIO_MINIMO_COCHE = 12000;

/**
 * Lo que nos cuesta a nosotros dar el servicio.
 *
 * Ya no es lo que paga el cliente: eso es el fee. Esto es lo que sale de
 * nuestra caja por cada coche —transporte, ITV, gestoría, placas— y sirve para
 * una sola cosa, saber si el fee da o no da. Hoy: 3.000 de fee menos 1.343 de
 * coste, 1.657 € por coche antes de nuestro tiempo.
 *
 * El impuesto de matriculación **no está aquí**: lo paga el cliente aparte y no
 * pasa por nosotros.
 */
function costeDelServicio() {
  return TRANSPORTE + PAPELEO_ESTIMADO;
}

/** Lo que nos queda del fee, sin el IVA, después de los costes que sabemos. */
function margenDelServicio() {
  // Sobre la **base**, no sobre lo que paga: el IVA no es nuestro, lo cobramos
  // y lo ingresamos. Contarlo aquí sería creerse 630 € de margen que no existen.
  return FEE_POPCAR_BASE - costeDelServicio();
}

/**
 * Lo que le cuesta al cliente el coche puesto en su casa.
 *
 * Tres cosas y nada más: **el coche**, que se lo paga al vendedor alemán;
 * **nuestro fee**, por encargarnos de todo; y **el impuesto de matriculación**,
 * que es de Hacienda y no nuestro.
 *
 * La garantía no está: es opcional y la pone un tercero. Se suma aparte cuando
 * el cliente la elige.
 */
function precioPuestoAqui(precioAleman, precioEspanol) {
  const referencia = Number(precioEspanol) || 0;
  return (Number(precioAleman) || 0) + FEE_POPCAR + IMPUESTO_MATRICULACION * referencia;
}

/** Lo mismo, partido, que es como hay que poder enseñarlo y auditarlo. */
function partidasDeTraerlo(precioAleman, precioEspanol) {
  const referencia = Number(precioEspanol) || 0;
  return [
    { concepto: "Precio en Alemania", importe: Number(precioAleman) || 0, firme: true },
    { concepto: "Servicio PopCar", importe: FEE_POPCAR, firme: true },
    { concepto: "Impuesto de matriculación", importe: IMPUESTO_MATRICULACION * referencia, firme: false },
  ];
}

/**
 * El precio partido como se le enseña al cliente.
 *
 * Tres líneas, y cada una va a un sitio distinto. Eso es lo que hay que
 * entender de este negocio y lo que la ficha tiene que dejar claro:
 *
 * - **El coche** se lo paga al concesionario alemán. Nosotros no se lo
 *   vendemos: se lo compra él, y nosotros nos ocupamos de que llegue.
 * - **El servicio** es lo nuestro, y es lo único que facturamos.
 * - **El impuesto** es de Hacienda. Ni lo cobramos ni lo tocamos.
 *
 * El fee va suelto y con su nombre, al revés que el margen de antes, que iba
 * escondido dentro del precio del coche. Cuando vendes un coche, lo que ganas
 * no se desglosa. Cuando vendes un servicio, **lo que se vende es eso**: el
 * cliente tiene que ver qué le estás haciendo por ese dinero.
 *
 * La garantía no está en el precio, y no puede estarlo: no somos nosotros
 * quien le vende el coche, así que no somos nosotros quien se la debe. La pone
 * un tercero y él decide si la quiere.
 */
function desgloseParaElCliente(precioAleman, precioEspanol) {
  const aleman = Number(precioAleman) || 0;
  const referencia = Number(precioEspanol) || 0;

  const lineas = [
    { concepto: "Precio del coche", importe: aleman, aQuien: "al vendedor en Alemania" },
    // Con el IVA dentro, porque a un particular los precios se le dicen así.
    // De esos 3.630, 3.000 son nuestros y 630 son de Hacienda.
    { concepto: "Servicio PopCar · IVA incluido", importe: FEE_POPCAR, aQuien: "a nosotros" },
    {
      concepto: "Impuesto de matriculación",
      importe: IMPUESTO_MATRICULACION * referencia,
      aQuien: "a Hacienda",
    },
  ];

  return {
    lineas: lineas.map((l) => ({ ...l, importe: Math.round(l.importe) })),
    total: Math.round(lineas.reduce((t, l) => t + l.importe, 0)),
    // Qué cubre el fee. Va aquí y no en la pantalla para que no se lo invente,
    // y porque es literalmente lo que se está vendiendo.
    cubreElFee: [
      "Revisamos el coche allí, en persona, antes de liberar tu dinero",
      "Lo recogemos y lo traemos",
      "ITV de homologación y toda la documentación",
      "Lo revisamos al llegar",
      "Te lo llevamos a casa",
    ],
    // Lo que no va dentro, dicho aquí para que el precio no crezca después.
    aparte: ["Garantía mecánica, si la quieres"],
    incluido: [],
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
  // En una sola línea: se pega dentro de un ORDER BY y de un WHERE, y un salto
  // de línea ahí hace que la consulta escrita y la comparada no coincidan.
  return `(COALESCE(${c}price,0) + ${FEE_POPCAR} + ${IMPUESTO_MATRICULACION}*COALESCE(${c}market_price_es,0))`;
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
function sePublica({ precioAleman, precioEspanol, comparables, viva = true }) {
  // Un coche vendido no se publica por muy bueno que fuera el ahorro. El
  // 1 de septiembre había 454 publicados de 484 que llevaban vendidos desde
  // julio, y se podía pedir uno y pagar la fianza.
  if (viva === false) return false;
  if (!(Number(precioAleman) > 0) || !(Number(precioEspanol) > 0)) return false;
  // Un coche barato no se importa: el fee es el mismo y no lo sostiene.
  if (Number(precioAleman) < PRECIO_MINIMO_COCHE) return false;
  if (!(Number(comparables) >= COMPARABLES_MINIMOS)) return false;
  const { pct } = ahorroDelCliente(precioAleman, precioEspanol);
  return pct >= AHORRO_MINIMO && pct <= AHORRO_MAXIMO;
}
module.exports = {
  FEE_POPCAR_BASE,
  IVA_SERVICIO,
  TRANSPORTE,
  TRANSPORTE_A_ZARAGOZA,
  TRANSPORTE_A_CASA,
  PAPELEO_ESTIMADO,
  ITV_HOMOLOGACION,
  GESTORIA_Y_DGT,
  PLACAS,
  IMPUESTO_MATRICULACION,
  FEE_POPCAR,
  PRECIO_MINIMO_COCHE,
  costeDelServicio,
  margenDelServicio,
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
