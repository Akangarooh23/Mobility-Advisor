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
 * Si esa dirección es de un portal cuya ficha sabemos leer.
 *
 * Cualquier dominio de autoscout24, no solo el español: los importados vienen
 * de autoscout24.de y son justo los que más problema dan, porque un dañado
 * alemán barato sube solo en el orden por calidad-precio.
 */
function sabemosMirarla(url) {
  const dominio = (texto(url).replace(/^https?:\/\//, "").split("/")[0] || "").split(":")[0];

  /*
   * El dominio tiene que TERMINAR en autoscout24.algo, no contenerlo.
   *
   * Con `[a-z.]+$` pasaba `autoscout24.es.falso.com`, que es un dominio
   * cualquiera: iriamos a pedirle una pagina a un tercero creyendo que es el
   * portal.
   */
  return /(^|\.)autoscout24\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(dominio);
}

/**
 * Lo que dice la ficha: `true`, `false` o `null` si no se ha podido saber.
 *
 * El JSON está dentro de un `<script id="__NEXT_DATA__">`. Es el mismo sitio
 * del que lo lee el comprobador de importaciones alemanas.
 */
async function laFichaDiceSiEstaDanado(url, opciones) {
  const {
    fetchImpl = typeof fetch === "function" ? fetch : null,
    topeMs = LO_QUE_SE_ESPERA_MS,
  } = opciones || {};

  if (!texto(url) || !fetchImpl || !sabemosMirarla(url)) {
    return { danado: null, nota: "" };
  }

  try {
    const respuesta = await fetchImpl(url, {
      headers: COMO_UN_NAVEGADOR,
      redirect: "follow",
      signal: AbortSignal.timeout(topeMs),
    });

    if (!respuesta.ok) return { danado: null, nota: "" };

    const pagina = await respuesta.text();
    const dentro = pagina.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (!dentro) return { danado: null, nota: "" };

    const datos = JSON.parse(dentro[1]);
    const coche = (((datos.props || {}).pageProps || {}).listingDetails || {}).vehicle;
    if (!coche) return { danado: null, nota: "" };

    /*
     * Que el campo NO venga no es que este sano: es que no lo dice. Por eso se
     * mira si la clave existe antes de dar un veredicto.
     */
    if (!("damageConditions" in coche)) {
      return { danado: coche.hadAccident === true ? true : null, nota: "" };
    }

    const danos = Array.isArray(coche.damageConditions) ? coche.damageConditions.filter(Boolean) : [];
    return {
      danado: danos.length > 0 || coche.hadAccident === true,
      nota: danos.join(", ").slice(0, 200),
    };
  } catch {
    // Se ha caido, ha tardado o no era JSON. No se sabe, y no se sabe no es si.
    return { danado: null, nota: "" };
  }
}

/**
 * Las que de verdad se pueden enseñar, de entre las que iban a enseñarse.
 *
 * Devuelve la lista sin las que su ficha declara dañadas, y cuántas se han
 * quitado. Las que no se han podido comprobar se quedan.
 */
async function lasQueLaFichaNoDescarta(ofertas, opciones) {
  const lista = Array.isArray(ofertas) ? ofertas : [];
  if (!lista.length) return { cumplen: lista, danadas: 0 };

  const aMirar = lista.slice(0, CUANTAS_A_LA_VEZ);
  const veredictos = await Promise.all(
    aMirar.map((o) => laFichaDiceSiEstaDanado(o && o.url, opciones))
  );

  const danadas = new Set();
  veredictos.forEach((v, i) => {
    if (v.danado === true) danadas.add(aMirar[i]);
  });

  return {
    cumplen: lista.filter((o) => !danadas.has(o)),
    danadas: danadas.size,
  };
}

module.exports = {
  laFichaDiceSiEstaDanado,
  lasQueLaFichaNoDescarta,
  sabemosMirarla,
  LO_QUE_SE_ESPERA_MS,
  CUANTAS_A_LA_VEZ,
};
