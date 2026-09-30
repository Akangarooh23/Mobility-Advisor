"use strict";

/**
 * Antes de enseñar una oferta, se mira su ficha por si declara daños.
 *
 * ## Por qué bajo demanda y no enriqueciendo el pool
 *
 * Porque el dato solo está en la ficha de cada anuncio, y eso es **una
 * petición por coche**. Enriquecer el pool entero, medido con el proceso que
 * ya existe: 2.000 al día contra 368.000 ofertas activas de autoscout24, seis
 * meses para la primera vuelta. Y eso solo cubre el 19% del mercado español:
 *
 *     276.113  21%  coches.net    con dato de daño: 0
 *     253.109  20%  milanuncios   con dato de daño: 0
 *     251.173  19%  autoscout24   con dato de daño: 4.900
 *     213.876  17%  wallapop      con dato de daño: 0
 *     197.480  15%  autocasion    con dato de daño: 0
 *
 * Pero el consejero no enseña 1,6 millones de coches: enseña **tres o cuatro**.
 * Mirar la ficha de esos cuatro son cuatro peticiones, no seis meses. Es la
 * misma comprobación, hecha donde de verdad importa.
 *
 * ## Lo que cubre y lo que no, dicho claro
 *
 * Solo autoscout24, que es el único portal del que sabemos que su ficha lo
 * declara. De los otros cuatro —el 73% del mercado— nadie ha mirado nunca si
 * lo traen. Una oferta de coches.net sale sin comprobar, igual que antes.
 *
 * ## Y qué pasa si la ficha no contesta
 *
 * Se enseña. «No he podido comprobarlo» no es «está dañado», y quedarse sin
 * ofertas porque un portal tarde en responder sería mucho peor que el problema
 * que esto resuelve.
 */

/** Lo que tarda como mucho en mirarse una ficha. */
const LO_QUE_SE_ESPERA_MS = 4000;

/**
 * Cuántas se miran a la vez.
 *
 * Son las que caben en la pantalla. Más sería pedirle al portal más de lo que
 * hace falta.
 */
const CUANTAS_A_LA_VEZ = 6;

const COMO_UN_NAVEGADOR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

const texto = (v) => String(v ?? "").trim();

/**
 * Si esa direccion es de un portal cuya ficha sabemos LEER.
 *
 * Cualquier dominio de autoscout24, no solo el espanol: los importados vienen
 * de autoscout24.de y son justo los que mas problema dan, porque un danado
 * aleman barato sube solo en el orden por calidad-precio.
 *
 * Leer la ficha es entender su HTML, y eso solo lo sabemos hacer con este
 * portal. Para saber si el anuncio SIGUE VIVO no hace falta entender nada:
 * eso es `esDeUnPortalNuestro`, que cubre los once.
 */
function sabemosMirarla(url) {
  const dominio = elDominioDe(url);

  /*
   * El dominio tiene que TERMINAR en autoscout24.algo, no contenerlo.
   *
   * Con `[a-z.]+$` pasaba `autoscout24.es.falso.com`, que es un dominio
   * cualquiera: iriamos a pedirle una pagina a un tercero creyendo que es el
   * portal.
   */
  return /(^|\.)autoscout24\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(dominio);
}

/** El dominio a secas de una url, sin esquema, ruta ni puerto. */
function elDominioDe(url) {
  return (texto(url).replace(/^https?:\/\//, "").split("/")[0] || "").split(":")[0].toLowerCase();
}

/**
 * Los once portales de los que sale el catalogo.
 *
 * Solo se le pide una pagina a estos. La lista no es una comodidad: sin ella,
 * una url mal guardada nos mandaria a pedirle una pagina a un tercero
 * cualquiera con la cara del navegador de un cliente.
 */
const LOS_PORTALES = [
  "autoscout24", "wallapop", "milanuncios", "coches.net", "autocasion",
  "coches.com", "flexicar", "ocasionplus", "autohero", "clicars", "canalcar",
];

/**
 * Si la direccion es de uno de nuestros portales, sea cual sea.
 *
 * Vale para preguntar si el anuncio sigue existiendo, que es lo unico que se
 * mira en los diez portales cuyo HTML no sabemos interpretar.
 */
function esDeUnPortalNuestro(url) {
  const dominio = elDominioDe(url);
  if (!dominio) return false;

  return LOS_PORTALES.some((portal) => {
    // Igual que arriba: tiene que TERMINAR en el portal, no contenerlo.
    const escapado = portal.replace(/\./g, "\\.");
    return new RegExp("(^|\\.)" + escapado + "(\\.[a-z]{2,3}){0,2}$", "i").test(dominio);
  });
}

/**
 * Lo que dice la ficha: `true`, `false` o `null` si no se ha podido saber.
 *
 * El JSON está dentro de un `<script id="__NEXT_DATA__">`. Es el mismo sitio
 * del que lo lee el comprobador de importaciones alemanas.
 *
 * ## Dos preguntas distintas, y una es mucho más barata
 *
 * **¿Está dañado?** Hay que entender el HTML del portal, y eso solo sabemos
 * hacerlo con autoscout24.
 *
 * **¿Sigue existiendo?** No hay que entender nada: basta el código de
 * respuesta. Así que esa se le pregunta a los once portales, no a uno.
 *
 * Por eso se pide la página siempre que la dirección sea de un portal
 * nuestro, y el JSON solo se busca cuando además sabemos leerlo. La petición
 * es la misma; lo que cambia es cuánto se saca de ella.
 */
async function laFichaDiceSiEstaDanado(url, opciones) {
  const {
    fetchImpl = typeof fetch === "function" ? fetch : null,
    topeMs = LO_QUE_SE_ESPERA_MS,
  } = opciones || {};

  if (!texto(url) || !fetchImpl || !esDeUnPortalNuestro(url)) {
    return { danado: null, existe: null, nota: "" };
  }

  try {
    const respuesta = await fetchImpl(url, {
      headers: COMO_UN_NAVEGADOR,
      redirect: "follow",
      signal: AbortSignal.timeout(topeMs),
    });

    /*
     * 404 y 410 son una RESPUESTA, no un silencio: el portal dice que esa
     * ficha ya no esta. Es la unica senal en vivo que tenemos de que un coche
     * se ha vendido, y hace falta porque el pool va muy por detras: medido hoy,
     * solo el 5,6% de las 1,9 millones de ofertas activas se ha verificado en
     * las ultimas 24 horas, y Wallapop y Milanuncios -795.000 entre los dos-
     * tardarian meses en completar una vuelta.
     *
     * Los demas codigos NO cuentan. Un 403 o un 429 es el portal echandonos,
     * y un 500 es que le pasa algo a el: tirar la oferta por eso seria dejar
     * al cliente sin coches porque un servidor ajeno tiene un mal dia.
     */
    if (respuesta.status === 404 || respuesta.status === 410) {
      return { danado: null, existe: false, nota: "" };
    }
    if (!respuesta.ok) return { danado: null, existe: null, nota: "" };

    /*
     * Hasta aqui llegan los once portales; de aqui en adelante, solo el que
     * sabemos leer. La pagina ha cargado, asi que el anuncio existe, y eso ya
     * es todo lo que se le puede sacar a los otros diez.
     */
    if (!sabemosMirarla(url)) return { danado: null, existe: true, nota: "" };

    const pagina = await respuesta.text();
    const dentro = pagina.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (!dentro) return { danado: null, existe: null, nota: "" };

    const datos = JSON.parse(dentro[1]);
    const coche = (((datos.props || {}).pageProps || {}).listingDetails || {}).vehicle;
    if (!coche) return { danado: null, existe: null, nota: "" };

    /*
     * Que el campo NO venga no es que este sano: es que no lo dice. Por eso se
     * mira si la clave existe antes de dar un veredicto.
     */
    if (!("damageConditions" in coche)) {
      return { danado: coche.hadAccident === true ? true : null, existe: true, nota: "" };
    }

    const danos = Array.isArray(coche.damageConditions) ? coche.damageConditions.filter(Boolean) : [];
    return {
      existe: true,
      danado: danos.length > 0 || coche.hadAccident === true,
      nota: danos.join(", ").slice(0, 200),
    };
  } catch {
    // Se ha caido, ha tardado o no era JSON. No se sabe, y no se sabe no es si.
    return { danado: null, existe: null, nota: "" };
  }
}

/**
 * Las que de verdad se pueden ensenar, de entre las que iban a ensenarse.
 *
 * Quita dos cosas distintas y las cuenta por separado:
 *
 *   - `danadas`: su ficha declara danos o un accidente.
 *   - `vendidas`: su ficha ya no existe. El anuncio se ha retirado, que en un
 *     portal de coches casi siempre significa vendido.
 *
 * Las que no se han podido comprobar se quedan: no saber no es que no.
 */
async function lasQueLaFichaNoDescarta(ofertas, opciones) {
  const lista = Array.isArray(ofertas) ? ofertas : [];
  if (!lista.length) return { cumplen: lista, danadas: 0, vendidas: 0 };

  const aMirar = lista.slice(0, CUANTAS_A_LA_VEZ);
  const veredictos = await Promise.all(
    aMirar.map((o) => laFichaDiceSiEstaDanado(o && o.url, opciones))
  );

  const fuera = new Set();
  let danadas = 0;
  let vendidas = 0;

  veredictos.forEach((v, i) => {
    if (v.danado === true) { fuera.add(aMirar[i]); danadas += 1; return; }
    if (v.existe === false) { fuera.add(aMirar[i]); vendidas += 1; }
  });

  return { cumplen: lista.filter((o) => !fuera.has(o)), danadas, vendidas };
}

module.exports = {
  laFichaDiceSiEstaDanado,
  lasQueLaFichaNoDescarta,
  sabemosMirarla,
  esDeUnPortalNuestro,
  LOS_PORTALES,
  LO_QUE_SE_ESPERA_MS,
  CUANTAS_A_LA_VEZ,
};
