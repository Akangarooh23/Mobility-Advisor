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

const { comoSeBusca } = require("./de-donde-quiere-el-coche");
const {
  laMotorizacionQuePidio,
  laEtiquetaQueLeCorresponde,
  dejaEntrarEnLaZbe,
} = require("./la-motorizacion-que-pidio");

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
 * Y las tres que estrechan de verdad.
 *
 * Las tres salen de columnas que el pool tiene rellenas: el cambio y el
 * vendedor en el 100% de las ofertas, la potencia en el 95%. Se midió antes de
 * escribir la pregunta, porque una pregunta cuya respuesta la base no sabe
 * aplicar no estrecha nada: solo alarga el test.
 */
const EL_CAMBIO = {
  /*
   * «automat» y no «automatico» a proposito.
   *
   * El pool escribe «Automatica» y el test dice «automático». El filtro fino
   * comparaba con `includes` una palabra contra la otra, no casaba nunca, y la
   * busqueda devolvia CERO ofertas en 339 segundos. La raiz comun casa con las
   * dos escrituras.
   */
  automatico: "automat",
  manual: "manual",
  indiferente_cambio: null,
};

const QUIEN_VENDE = {
  profesional: "profesional",
  particular: "particular",
  indiferente_vendedor: null,
};

/**
 * Si acepta un coche importado.
 *
 * Uno de cada siete anuncios viene de Alemania -6.214 de 47.696 medidos- y la
 * columna esta rellena en el 100%. Ademas la mediana con la que se juzga el
 * precio se calcula SOLO con coches ya matriculados en Espana, asi que un
 * importado sale siempre por debajo del mercado en parte porque le falta la
 * matriculacion. Quien no quiera papeleo no los ve.
 */
const DE_DONDE_VIENE = {
  solo_nacional: "ES",
  importado_vale: null,
};

const LA_POTENCIA = {
  al_menos_110: 110,
  al_menos_150: 150,
  indiferente_potencia: null,
};

/**
 * La etiqueta, deducida de las ZBE y no preguntada aparte.
 *
 * Ya se pregunta cuánto le afectan las zonas restringidas, y la respuesta lleva
 * dentro la etiqueta que necesita: a Madrid Central no se entra con una B ni
 * con una C. Preguntar la etiqueta por separado sería pedirle al cliente que
 * traduzca su propia respuesta.
 *
 * Solo se filtra con «mucho». Con «algo» se le esconderían coches que le valen
 * la mayoría de los días.
 */
const LA_ETIQUETA_POR_ZBE = {
  alta: "eco_o_cero",
};

/**
 * Si la motorización que ha elegido puede llevar esa etiqueta.
 *
 * Quien no ha elegido ninguna deja que se decida por él, y entonces sí se le
 * buscan coches que entren en la ZBE. Quien ha pedido gasolina o diésel ya ha
 * elegido, y exigirle además ECO o CERO es dejarle sin nada.
 */
function laEtiquetaEsPosible(answers) {
  const suyas = laMotorizacionQuePidio(answers);
  if (!suyas) return true;

  return suyas.some((m) => dejaEntrarEnLaZbe(laEtiquetaQueLeCorresponde([m])));
}

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

  /*
   * Y de donde quiere el coche.
   *
   * Va como lista de escrituras y no como un nombre: la columna del pool
   * lleva tildes y el nombre sin ellas no encuentra nada. Buscar en Malaga no
   * devolvia ni una de las 44.469 ofertas malaguenas, y no fallaba: devolvia
   * cero y seguia.
   */
  const provincia = comoSeBusca(answers.provincia_del_coche);
  if (provincia) encargo.provinciaFormas = provincia;

  const cambio = EL_CAMBIO[texto(answers.cambio_preferido)];
  if (cambio) encargo.transmission = cambio;

  const vendedor = QUIEN_VENDE[texto(answers.quien_vende)];
  if (vendedor) encargo.sellerType = vendedor;

  const potencia = LA_POTENCIA[texto(answers.potencia_minima)];
  if (potencia) encargo.minPowerCv = potencia;

  const pais = DE_DONDE_VIENE[texto(answers.coche_importado)];
  if (pais) encargo.country = pais;

  /*
   * La etiqueta, solo si no contradice la motorización que ha pedido.
   *
   * Esto estuvo mal y se vio en producción. A quien pidió un compacto de
   * gasolina de menos de 10.000 € y dijo que las ZBE le afectan mucho, se le
   * exigía además etiqueta ECO o CERO. Medido sobre el pool:
   *
   *     86.077  precio y kilómetros
   *     59.263  + gasolina
   *      3.740  + compacto
   *          0  + etiqueta ECO o CERO
   *
   * Cero en 2.360.000 anuncios. Un gasolina barato no lleva ECO, así que las
   * dos respuestas se contradicen y el filtro resolvía la contradicción en
   * silencio dejando al cliente sin una sola oferta.
   *
   * Ahora la etiqueta solo estrecha cuando la motorización elegida puede
   * llevarla. Si no, no se filtra: la tensión entre «quiero gasolina» y «entro
   * en ZBE» es algo que hay que contarle, no algo que se arregle escondiéndole
   * el mercado entero.
   */
  const etiqueta = LA_ETIQUETA_POR_ZBE[texto(answers.zbe_impacto)];
  if (etiqueta && laEtiquetaEsPosible(answers)) encargo.environmentalLabel = etiqueta;

  return encargo;
}

module.exports = { elEncargoDeBusqueda, EL_PRECIO, LOS_KILOMETROS, EL_CAMBIO, QUIEN_VENDE, LA_POTENCIA, DE_DONDE_VIENE };
