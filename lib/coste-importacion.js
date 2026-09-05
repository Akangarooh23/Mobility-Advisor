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
 * Y la banda, que no puede ser siempre la misma.
 *
 * Lo destapó un Kia Sorento 2.4 de gasolina: se le estimaron 1.420 € de
 * impuesto y salieron 2.491. Mil setenta y un euros, y no era un caso raro —
 * con un tipo fijo del 4,75 %, la segunda banda más baja de cuatro, **todos**
 * los SUV grandes salen así.
 *
 * Las bandas son por CO₂: 0 hasta 120 g/km, 4,75 hasta 159, 9,75 hasta 199 y
 * 14,75 por encima. Cuando el anuncio trae el CO₂ se usa esa y no hay nada que
 * estimar. **Casi nunca lo trae**: el scraper alemán no lo pide, así que de
 * 25.498 ofertas hay cinco con el dato, buscadas a mano una a una. En el resto
 * se estima con lo que sí viene: combustible, potencia, cilindrada, carrocería
 * y si lleva tracción total.
 *
 * Contra esos cinco se ha medido, y las cinco bandas salen bien. La quinta solo
 * desde que la carrocería entró en la cuenta: al Sorento de 2021 se le estimaban
 * 151 g y son 177, porque en su anuncio no pone en ninguna parte que sea un SUV.
 *
 * **La banda es lo único que se estima.** La base no: es el precio de la
 * factura de compra, y ese lo sabemos. Aquí se aproximó durante un tiempo con
 * el 60 % del precio de un usado comparable en España, hasta que el asesor
 * aclaró que Hacienda toma el precio de la factura. El primer coche lo
 * confirma al céntimo: 16.890 × 14,75 % = 2.491,28, y la gestoría cobró 2.491.
 */

const BANDAS_CO2 = [
  { hasta: 120, tipo: 0 },
  { hasta: 159, tipo: 0.0475 },
  { hasta: 199, tipo: 0.0975 },
  { hasta: Infinity, tipo: 0.1475 },
];

/** La banda de verdad, cuando el anuncio trae el CO₂. */
function bandaPorCo2(co2) {
  const g = Number(co2);
  if (!Number.isFinite(g) || g <= 0) return null;
  return BANDAS_CO2.find((b) => g <= b.hasta).tipo;
}

/**
 * Cuánto emite un coche del que solo sabemos el combustible y la potencia.
 *
 * Las bandas son de CO₂, así que se estima el CO₂ y se mira en qué banda cae,
 * en vez de inventar una escalera propia por potencia. La diferencia no es
 * cosmética: un 320d de 190 CV y un Sorento de gasolina de 190 CV tienen la
 * misma potencia y no están ni en la misma banda —el diésel ronda 140 g/km y
 * el SUV de gasolina pasa de 200—. Con una escalera por potencia, al BMW se le
 * cobrarían dos mil euros de más y el anuncio no lo abriría nadie.
 *
 * Los números salen de la nube de homologaciones WLTP europeas de 2016 en
 * adelante, que es lo que se importa: un suelo por el peso y la carrocería, más
 * lo que añade cada caballo. El gasóleo quema menos carbono por caballo, y por
 * eso tiene los dos números más bajos.
 */
const CO2_BASE = { gasolina: 95, diesel: 85 };
const CO2_POR_CV = { gasolina: 0.42, diesel: 0.33 };

/** Mover cuatro ruedas cuesta en torno a un 12 % más. */
const CO2_TRACCION_TOTAL = 1.12;

/**
 * Y un motor grande y perezoso, en torno a un 20 % más.
 *
 * «Perezoso» es medible: **caballos por litro**. Un 1.5 turbo moderno da 100 CV
 * por litro; un 2.4 atmosférico de hace ocho años da 74. A igual potencia, el
 * segundo quema bastante más, y con la potencia sola los dos salen iguales.
 *
 * Esto es lo que se le escapaba al Kia Sorento: 175 CV en 2,4 litros, con la
 * potencia sola caía en la banda de 9,75 % y la suya era la de 14,75.
 *
 * Solo en gasolina: los diésel están todos entre 70 y 80 CV por litro, así que
 * ahí la cuenta no separa nada y el suelo del gasóleo ya lo recoge.
 */
const CV_POR_LITRO_PEREZOSO = 80;
const CO2_MOTOR_GRANDE = 1.2;

/** Y un híbrido recupera frenada y apaga el motor parado: en torno a un 25 % menos. */
const CO2_HIBRIDO = 0.75;

/**
 * Y un cuerpo grande, en torno a un 12 % más — **solo en gasóleo**.
 *
 * Lo de «solo en gasóleo» no es un capricho: es lo único que sostienen los
 * cinco coches que hemos medido contra su CO₂ real.
 *
 * - Los **dos diésel** eran cuerpos grandes —un SUV y un monovolumen— y los dos
 *   salieron unos 25 g **por encima** de lo estimado. El de 2021 se nos fue una
 *   banda entera: 151 estimados contra 177 reales, 810 € de impuesto.
 * - Los **tres de gasolina**, dos de ellos también SUV y monovolumen, salieron
 *   entre 6 y 13 g **por debajo**. Ahí el suelo de la gasolina ya recoge el
 *   peso, y añadirle un factor los metería en la banda de arriba sin motivo.
 *
 * Son cinco coches y no demuestran una ley. Cuando haya veinte pares de
 * estimado y real se vuelve a mirar, y este número se moverá.
 */
const CO2_CUERPO_GRANDE = 1.12;

/**
 * Qué carrocerías cuentan como cuerpo grande.
 *
 * Las que mueven mucha masa y van de pie contra el aire. La lista sale de las
 * etiquetas que usan los portales españoles, que es de donde se rellena la
 * carrocería de los coches alemanes: el scraper alemán no la trae.
 */
const CUERPOS_GRANDES = /suv|todo\s*terreno|todoterreno|pick\s*up|pickup|4x4|monovolumen|furgon/i;

const ES_TRACCION_TOTAL = /\b4x4\b|\bawd\b|4matic|quattro|xdrive|allrad|4motion/i;

/** Los centímetros cúbicos, que llegan como texto y a veces no llegan. */
function cilindrada(displacement) {
  const cc = Number(String(displacement || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(cc) && cc > 0 ? cc : null;
}

/** Lo que se estima que emite, en gramos por kilómetro. */
function co2Estimado({ fuel, power_cv, title, displacement, body_type } = {}) {
  const combustible = String(fuel || "").toLowerCase();
  const gasoleo = /di[eé]sel|gas[oó]leo/.test(combustible);
  const cv = Number(power_cv) || 0;
  const clase = gasoleo ? "diesel" : "gasolina";
  let g = CO2_BASE[clase] + CO2_POR_CV[clase] * cv;

  if (ES_TRACCION_TOTAL.test(String(title || ""))) g *= CO2_TRACCION_TOTAL;

  /*
   * El cuerpo, de la carrocería y no del título.
   *
   * Antes se buscaba «SUV» en el titular del anuncio, y así se coló el Sorento
   * de 2021: se llama «1.Hand LED Keyless Ahk Navi Finanzierung» y es un SUV de
   * dos toneladas. El título lo escribe quien vende, y no está para eso.
   */
  if (gasoleo && CUERPOS_GRANDES.test(String(body_type || ""))) g *= CO2_CUERPO_GRANDE;

  const cc = cilindrada(displacement);
  if (!gasoleo && cc && cv > 0 && cv / (cc / 1000) < CV_POR_LITRO_PEREZOSO) {
    g *= CO2_MOTOR_GRANDE;
  }

  if (/h[ií]brid/.test(combustible)) g *= CO2_HIBRIDO;
  return g;
}

/**
 * Y la banda estimada, con lo que sí trae el anuncio.
 *
 * Un eléctrico no paga: no emite. Un enchufable tampoco, que ninguno pasa de
 * 120 g/km homologados. Lo demás, por el CO₂ estimado.
 *
 * **Con una excepción: estimando no se llega nunca al 0 %.** La banda exenta
 * está en 120 g/km, y ahí abajo se amontonan los utilitarios: acertar el cero
 * exige el CO₂ de verdad, y equivocarse hacia abajo es publicar un precio que
 * luego no se puede cumplir. Pasarse es recuperable; quedarse corto, no. Si el
 * anuncio trae el CO₂, el cero sí se aplica: entonces no se está estimando.
 */
function bandaEstimada(coche = {}) {
  const combustible = String(coche.fuel || "").toLowerCase();
  if (/el[eé]ctric/.test(combustible)) return 0;
  if (/enchufa|plug/.test(combustible)) return 0;

  const tipo = BANDAS_CO2.find((b) => co2Estimado(coche) <= b.hasta).tipo;
  return tipo === 0 ? BANDAS_CO2[1].tipo : tipo;
}

/**
 * El tipo que se le aplica a un coche.
 *
 * Con CO₂, el de verdad. Sin él, el estimado. Y sin saber nada del coche, el
 * de siempre: es lo que había, y cambiarlo por un cero diría que no paga
 * impuesto.
 */
function tipoDelImpuesto(coche) {
  if (!coche) return IMPUESTO_MATRICULACION;
  const real = bandaPorCo2(coche.co2);
  return real !== null ? real : bandaEstimada(coche);
}

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
 * Y lo que el cliente paga por el servicio: 3.630 €.
 *
 * **Los 3.000 son la base y el IVA va encima**, no dentro. Durante un tiempo
 * aquí se dividía por 1,21 —salían 2.479,34 de base— y de ahí venía que este
 * coche pareciera perder dinero. Lo aclaró el asesor: 3.000 € + IVA.
 *
 * Los dos números tienen su nombre porque se usan en sitios distintos y
 * confundirlos cuesta 630 € por coche: **lo que se cobra** es esto, y **lo que
 * ganamos** se cuenta sobre `FEE_POPCAR`, que es la base. El IVA lo cobramos y
 * lo ingresamos; no es nuestro ni un solo día.
 */
const FEE_POPCAR_CON_IVA = Math.round(FEE_POPCAR * (1 + IVA_SERVICIO));

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
 * Ir a ver el coche antes de que se libere un euro.
 *
 * Es la promesa entera del producto y cuesta dinero: **289 €** por coche, que
 * es lo que factura el perito de Alemania. Precio real de la primera
 * importación, no una media.
 *
 * No estaba en ningún sitio. Y el asesor lo señaló al revisar el margen: el fee
 * tiene que cubrirlo, así que si no está aquí el margen sale 289 € mejor de lo
 * que es en todos los coches.
 */
const PERITO_EN_ALEMANIA = 289;

/**
 * Lo que nos cuesta a nosotros dar el servicio.
 *
 * Ya no es lo que paga el cliente: eso es el fee. Esto es lo que sale de
 * nuestra caja por cada coche —el perito, el transporte, la ITV, la gestoría,
 * las placas y las tasas— y sirve para una sola cosa, saber si el fee da o no
 * da. Hoy: 3.000 de fee menos 1.632 de coste, 1.368 € por coche antes de
 * nuestro tiempo.
 *
 * **Falta la preparación** —la campa de Zaragoza y el lavado—, que también sale
 * del fee y de la que todavía no tenemos el número. Con ella, el margen se
 * acerca al 30-40 % que dice el asesor.
 *
 * El impuesto de matriculación **no está aquí**: lo paga el cliente aparte, a
 * cuenta, y se liquida al matricular.
 */
function costeDelServicio() {
  return PERITO_EN_ALEMANIA + TRANSPORTE + PAPELEO_ESTIMADO;
}

/** Lo que nos queda del fee, sin el IVA, después de los costes que sabemos. */
function margenDelServicio() {
  // Sobre la **base**, no sobre lo que paga: el IVA no es nuestro, lo cobramos
  // y lo ingresamos. Contarlo aquí sería creerse 630 € de margen que no existen.
  return FEE_POPCAR - costeDelServicio();
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
/**
 * El impuesto de matriculación de un coche: la banda, sobre lo que costó.
 *
 * **La base es el precio de la factura de compra.** No el valor de mercado, ni
 * el precio de un usado comparable aquí, ni unas tablas depreciadas: lo que el
 * cliente paga por el coche. Lo confirmó el asesor y lo confirma el primer
 * coche al céntimo — 16.890 × 14,75 % = 2.491,28, y la gestoría cobró 2.491.
 *
 * Aquí se estuvo aproximando la base con el 60 % del precio de un usado
 * comparable en España, y hubo hasta una constante para eso. Era resolver un
 * problema que no existía: el dato exacto lo tenemos desde el primer minuto,
 * porque es el precio del anuncio.
 *
 * Lo que queda de estimación es **la banda**, y solo mientras no sepamos el
 * CO₂: con el CO₂ del anuncio o del COC, este número es exacto y no una
 * aproximación.
 *
 * El único caso en que Hacienda podría no aceptar la factura es un coche
 * comprado muy por debajo de lo que vale, y ese no llega hasta aquí: el techo
 * de `AHORRO_MAXIMO` no publica nada cuyo ahorro pase del 50 %.
 */
function impuestoDeMatriculacion(precioDeCompra, coche = null) {
  return tipoDelImpuesto(coche) * (Number(precioDeCompra) || 0);
}

function precioPuestoAqui(precioAleman, precioEspanol, garantia = 0, coche = null) {
  const coste = Number(precioAleman) || 0;
  return coste + FEE_POPCAR_CON_IVA
    + impuestoDeMatriculacion(coste, coche) + (Number(garantia) || 0);
}

/**
 * Lo mismo, partido, que es como hay que poder enseñarlo y auditarlo.
 *
 * `precioEspanol` ya no entra en ninguna cuenta: el impuesto va sobre lo que
 * cuesta el coche. Se mantiene en la firma porque es lo que se compara para
 * decir cuánto se ahorra, y quitarlo de aquí obligaría a cambiar cinco sitios
 * para no ganar nada.
 */
function partidasDeTraerlo(precioAleman, precioEspanol, coche = null) {
  const coste = Number(precioAleman) || 0;
  return [
    { concepto: "Precio en Alemania", importe: coste, firme: true },
    { concepto: "Servicio PopCar", importe: FEE_POPCAR_CON_IVA, firme: true },
    {
      concepto: "Impuesto de matriculación",
      importe: impuestoDeMatriculacion(coste, coche),
      /*
       * Firme cuando sabemos el CO₂.
       *
       * Con el CO₂ del anuncio la banda no se adivina y la base es la factura:
       * el número es exacto, y decirle «estimado» a un número exacto es pedirle
       * al cliente que desconfíe de un precio que se va a cumplir. Sin CO₂
       * sigue siendo una estimación y se dice.
       */
      firme: coche != null && bandaPorCo2(coche.co2) !== null,
    },
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
function desgloseParaElCliente(precioAleman, precioEspanol, garantia = null, coche = null) {
  const aleman = Number(precioAleman) || 0;
  const cobertura = garantia ? Math.round(Number(garantia.precio) || 0) : 0;

  const lineas = [
    { concepto: "Precio del coche", importe: aleman, aQuien: "al vendedor en Alemania" },
    // El precio que ve un particular lleva el IVA: de esos 3.630, 3.000 son
    // nuestros y 630 son de Hacienda.
    { concepto: "Servicio PopCar · IVA incluido", importe: FEE_POPCAR_CON_IVA, aQuien: "a nosotros" },
    {
      concepto: "Impuesto de matriculación",
      importe: impuestoDeMatriculacion(aleman, coche),
      aQuien: "a Hacienda",
    },
  ];

  /**
   * La garantía va **dentro del precio publicado**.
   *
   * Un coche que se anuncia sin garantía y luego ofrece una por 190 € parece
   * que sube de precio al final; uno que se anuncia con ella y deja quitarla,
   * baja. Es el mismo dinero y se lee al revés.
   *
   * Y por eso lleva su nombre en la línea: si el cliente cambia de garantía,
   * tiene que ver cuál es la que está pagando.
   */
  if (cobertura) {
    lineas.push({
      concepto: garantia.nombre || "Garantía mecánica",
      importe: cobertura,
      aQuien: "a la aseguradora",
      // Marcada, porque es la única línea que el cliente puede cambiar. La
      // ficha la quita y pinta la que él haya elegido; sin la marca tendría
      // que reconocerla por el nombre, y el nombre lo pone el catálogo.
      esGarantia: true,
    });
  }

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
/**
 * `garantia` es lo que cuesta la que lleva el precio publicado.
 *
 * Admite un número o un trozo de SQL, porque no cuesta lo mismo en todos los
 * coches: a uno de quince años no se le puede dar ninguna y su precio no sube.
 * `sqlGarantiaPorDefecto` devuelve ese trozo; cero es no ofrecer ninguna, que es
 * lo que pasa mientras no haya catálogo cargado.
 */
/**
 * El tipo del impuesto, escrito en SQL.
 *
 * Tiene que dar **lo mismo** que `tipoDelImpuesto`: este es el precio por el
 * que se ordena y se filtra el listado, y el otro el que se enseña al abrir la
 * ficha. Si difieren, un coche aparece en el listado a un precio y en su ficha
 * a otro, y quien lo ve deja de fiarse de los dos.
 *
 * Por eso se escribe aquí la misma escalera, en una sola línea: se pega dentro
 * de un ORDER BY y de un WHERE, y un salto de línea ahí hace que la consulta
 * escrita y la comparada no coincidan.
 */
function sqlTipoDelImpuesto(alias = "") {
  const c = alias ? `${alias}.` : "";
  const cv = `COALESCE(${c}power_cv,0)`;
  const combustible = `lower(COALESCE(${c}fuel,''))`;
  const total = `COALESCE(${c}title,'') ~* '(\\y4x4\\y|\\yawd\\y|4matic|quattro|xdrive|allrad|4motion)'`;
  const cuerpo = `COALESCE(${c}body_type,'') ~* '(suv|todo ?terreno|pick ?up|4x4|monovolumen|furgon)'`;
  /*
   * El CO₂ está guardado como texto, y a veces trae unidades o viene vacío.
   *
   * Lo raspa un scraper de un anuncio, así que puede llegar «124», «124 g/km»
   * o «-». Un cast directo revienta la consulta entera del listado: se mira
   * antes que sea un número, y si no lo es se estima como si no lo trajera.
   */
  const g = `NULLIF(regexp_replace(COALESCE(${c}co2,''), '[^0-9]', '', 'g'), '')::numeric`;

  // El CO₂ estimado, con los mismos números que `co2Estimado`: si los dos no
  // dicen lo mismo, el listado ordena por un precio y la ficha enseña otro.
  const gasoleo = `${combustible} ~ 'di[eé]sel|gas[oó]leo'`;
  // La cilindrada también llega como texto, y falta en uno de cada cuatro.
  const cc = `NULLIF(regexp_replace(COALESCE(${c}displacement,''), '[^0-9]', '', 'g'), '')::numeric`;
  const perezoso = `NOT (${gasoleo}) AND ${cv} > 0 AND COALESCE(${cc},0) > 0`
    + ` AND ${cv} / (${cc} / 1000) < ${CV_POR_LITRO_PEREZOSO}`;
  const gramos = `((CASE WHEN ${gasoleo} THEN ${CO2_BASE.diesel} + ${CO2_POR_CV.diesel}*${cv}`
    + ` ELSE ${CO2_BASE.gasolina} + ${CO2_POR_CV.gasolina}*${cv} END)`
    + ` * (CASE WHEN ${total} THEN ${CO2_TRACCION_TOTAL} ELSE 1 END)`
    + ` * (CASE WHEN ${gasoleo} AND ${cuerpo} THEN ${CO2_CUERPO_GRANDE} ELSE 1 END)`
    + ` * (CASE WHEN ${perezoso} THEN ${CO2_MOTOR_GRANDE} ELSE 1 END)`
    + ` * (CASE WHEN ${combustible} ~ 'h[ií]brid' THEN ${CO2_HIBRIDO} ELSE 1 END))`;

  return [
    `CASE`,
    // Con el CO₂ del anuncio no hay nada que estimar.
    `WHEN ${g} > 0 THEN`,
    `  CASE WHEN ${g} <= 120 THEN 0 WHEN ${g} <= 159 THEN 0.0475`,
    `       WHEN ${g} <= 199 THEN 0.0975 ELSE 0.1475 END`,
    // Un eléctrico o un enchufable no emiten.
    `WHEN ${combustible} ~ '(el[eé]ctric|enchufa|plug)' THEN 0`,
    // Y lo demás, por el CO₂ que se le estima. Estimando no se baja del
    // 4,75 %: el 0 % exige el CO₂ de verdad, y quedarse corto en un precio
    // público es prometer algo que luego no se puede cumplir.
    `ELSE CASE WHEN ${gramos} <= 159 THEN 0.0475`,
    `          WHEN ${gramos} <= 199 THEN 0.0975 ELSE 0.1475 END`,
    `END`,
    // Cada trozo se escribe indentado para poder leerlo, pero sale en una sola
    // línea y con un espacio entre palabras: esta cadena se compara con la que
    // acaba en la consulta, y ahí los saltos y las sangrías ya se han comido.
  ].map((trozo) => trozo.trim()).join(" ");
}

/**
 * El precio puesto aquí, en SQL.
 *
 * Sobre el mismo precio que la versión de JavaScript: el impuesto va sobre lo
 * que cuesta el coche —`price`, el del anuncio, que es el que irá en su
 * factura— y no sobre el comparable español, que solo sirve para decir cuánto
 * se ahorra.
 */
function sqlPrecioPuestoAqui(alias = "", garantia = 0) {
  const c = alias ? `${alias}.` : "";
  const g = typeof garantia === "string" ? garantia : Math.round(Number(garantia) || 0);
  return `(COALESCE(${c}price,0) + ${FEE_POPCAR_CON_IVA} + ${g} + (${sqlTipoDelImpuesto(alias)})*COALESCE(${c}price,0))`;
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
function sqlAhorroPct(alias = "", garantia = 0) {
  const c = alias ? `${alias}.` : "";
  // Con la garantía dentro, igual que el precio: si el cliente ve 21.500 €, el
  // porcentaje por el que se ordena tiene que salir de esos 21.500.
  return `((COALESCE(${c}market_price_es,0) - ${sqlPrecioPuestoAqui(alias, garantia)})
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
function ahorroDelCliente(precioAleman, precioEspanol, garantia = 0, coche = null) {
  const referencia = Number(precioEspanol) || 0;
  const puesto = precioPuestoAqui(precioAleman, referencia, garantia, coche);
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
/**
 * `garantia` es la que lleva el precio publicado.
 *
 * Entra en la cuenta porque entra en el precio: si el cliente ve 21.500 €, el
 * ahorro que se le anuncia tiene que salir de esos 21.500 y no de 21.310.
 */
/**
 * Cuándo un coche es «nuevo» para Hacienda, que no es lo que parece.
 *
 * **Menos de seis meses O menos de 6.000 km.** Con que se cumpla una de las
 * dos, el coche es un medio de transporte nuevo aunque esté matriculado y
 * tenga dueño, y eso cambia la operación entera: el concesionario alemán tiene
 * que venderlo sin IVA y el cliente liquida aquí el 21 % con el modelo 309.
 *
 * Sobre un SEAT Leon de 24.370 € son 5.118 € que nadie le habría dicho. Es el
 * fallo que más caro le puede salir a un cliente, y hasta hoy no lo miraba
 * nadie: hay 4.759 coches así en el catálogo alemán, 4.680 de ellos con menos
 * de 6.000 km y muchos con cero.
 */
const KM_DE_UN_COCHE_NUEVO = 6000;

/**
 * Y si podría serlo, que es lo único que podemos contestar.
 *
 * Los kilómetros los sabemos; la antigüedad no: del anuncio solo llega el
 * **año**, y no la fecha de primera matriculación. Con el año basta para
 * descartar los de años anteriores —uno de 2025 tiene por fuerza más de seis
 * meses— pero no los de este año, que pueden tener tres.
 *
 * Así que esto no dice «es nuevo»: dice «no puedo garantizar que no lo sea».
 * Para afirmarlo hace falta la fecha exacta, y esa viene en el COC.
 */
function podriaSerMedioDeTransporteNuevo({ mileage, year } = {}, hoy = new Date()) {
  const km = Number(mileage);
  if (Number.isFinite(km) && km < KM_DE_UN_COCHE_NUEVO) return true;
  const anio = Number(year);
  // Sin año no se puede descartar, y un coche de este año puede tener meses.
  return !Number.isFinite(anio) || anio <= 0 || anio >= hoy.getFullYear();
}

function sePublica({ precioAleman, precioEspanol, comparables, viva = true, garantia = 0, coche = null }) {
  // Un coche vendido no se publica por muy bueno que fuera el ahorro. El
  // 1 de septiembre había 454 publicados de 484 que llevaban vendidos desde
  // julio, y se podía pedir uno y pagar la fianza.
  if (viva === false) return false;
  if (!(Number(precioAleman) > 0) || !(Number(precioEspanol) > 0)) return false;
  // Un coche barato no se importa: el fee es el mismo y no lo sostiene.
  if (Number(precioAleman) < PRECIO_MINIMO_COCHE) return false;
  if (!(Number(comparables) >= COMPARABLES_MINIMOS)) return false;
  /*
   * Y uno que pueda ser nuevo para Hacienda, tampoco.
   *
   * No es que no se pueda traer: es que es **otra operación**, con el coche
   * comprado sin IVA en Alemania y un 21 % que el cliente liquida aquí con el
   * modelo 309. Publicarlo con el precio de un usado es prometerle un precio
   * al que le faltan cinco mil euros.
   *
   * Ese flujo no existe todavía, así que no se publica.
   */
  if (coche && podriaSerMedioDeTransporteNuevo(coche)) return false;
  const { pct } = ahorroDelCliente(precioAleman, precioEspanol, garantia, coche);
  return pct >= AHORRO_MINIMO && pct <= AHORRO_MAXIMO;
}
module.exports = {
  tipoDelImpuesto,
  sqlTipoDelImpuesto,
  podriaSerMedioDeTransporteNuevo,
  KM_DE_UN_COCHE_NUEVO,
  impuestoDeMatriculacion,
  bandaPorCo2,
  bandaEstimada,
  co2Estimado,
  CO2_BASE,
  CO2_POR_CV,
  CO2_TRACCION_TOTAL,
  CO2_CUERPO_GRANDE,
  CUERPOS_GRANDES,
  CO2_MOTOR_GRANDE,
  CO2_HIBRIDO,
  CV_POR_LITRO_PEREZOSO,
  BANDAS_CO2,
  FEE_POPCAR_CON_IVA,
  IVA_SERVICIO,
  TRANSPORTE,
  TRANSPORTE_A_ZARAGOZA,
  TRANSPORTE_A_CASA,
  PAPELEO_ESTIMADO,
  PERITO_EN_ALEMANIA,
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
