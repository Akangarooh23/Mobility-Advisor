import { useCallback, useState } from "react";
import { useListingDiscoveryMemory } from "./useListingDiscoveryMemory";

/**
 * La búsqueda de ofertas reales: los filtros con los que se busca y lo que la
 * búsqueda devuelve.
 *
 * ## Qué había
 *
 * Siete `useState` en `App` y **tres listas distintas de «esto ya no vale»**,
 * en tres ficheros, para los mismos siete estados:
 *
 *   · `resetListingDiscovery` en `App` -filtros, resultado, opciones,
 *     cobertura, fallo, «buscando» y la memoria-, que llaman `analyzeWithAI`,
 *     `useAdvisorController` (dos veces) y `useResumeQuestionnaireDraft`;
 *   · el arranque de `useListingBootstrap` -filtros, resultado, opciones,
 *     fallo y «buscando»-, que corre al llegar a la pantalla de resultados;
 *   · el principio de `searchRealListing` -«buscando», fallo y el porqué.
 *
 * Las tres no coincidían, y no por criterio: `listingSearchCoverage` estaba en
 * la primera y no en las otras dos, y `listingInsight` estaba en la tercera y
 * no en las otras dos. Cada una se escribió mirando el problema de su día.
 *
 * ## Lo que eso dejaba en pantalla
 *
 * La línea de cobertura dice, con números: «Se han revisado 12 páginas de 4/7
 * portales **para esta búsqueda** de compra». Se dibuja siempre que tenga
 * texto, sin mirar si se está buscando.
 *
 * Como nadie la borraba al empezar otra búsqueda, esa frase -con los números
 * de la búsqueda anterior- seguía ahí mientras corría la nueva. Y una búsqueda
 * con los siete criterios contestados tarda **253 segundos medidos contra
 * producción**. Si además terminaba en fallo o se cortaba, se quedaba para
 * siempre: el aviso de que la búsqueda no terminó, y justo encima el recuento
 * exacto de una búsqueda que no es ésa.
 *
 * ## Qué hace ahora
 *
 * Una sola dueña de los siete estados y **dos** listas, con nombre y con la
 * diferencia escrita:
 *
 *   · `resetListingDiscovery()` -se empieza de cero: no queda nada, ni la
 *     memoria de lo ya visto;
 *   · `olvidaLoQueContoLaAnterior()` -arranca otra búsqueda: caduca lo que
 *     **contó** la anterior (cobertura, fallo y porqué) y **se conservan a
 *     propósito el resultado y las opciones**.
 *
 * Esa conservación no es pereza. Al pulsar «recalcular» se siguen viendo las
 * ofertas que ya había mientras llega la tanda nueva -vaciar la lista durante
 * cuatro minutos es una pantalla en blanco-, y `searchRealListing` lee
 * `listingOptionsRef` para pedir que **no** le repitan las que ya se
 * enseñaron. Vaciarlas rompería las dos cosas.
 */

/** Los filtros recién puestos, sin nada elegido. */
export function sinFiltros() {
  return {
    company: "",
    budget: "",
    income: "",
    location: "",
    priceRange: "",
    minPrice: null,
    maxPrice: null,
  };
}

export function useLaBusquedaDeOfertas() {
  const [listingFilters, setListingFilters] = useState(sinFiltros);
  const [listingResult, setListingResult] = useState(null);
  const [listingOptions, setListingOptions] = useState([]);
  const [listingSearchCoverage, setListingSearchCoverage] = useState(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState(null);
  // Lo que cuenta la búsqueda cuando salen menos ofertas de las esperadas.
  const [listingInsight, setListingInsight] = useState(null);

  /*
   * La memoria de lo ya enseñado se pide aquí, no en `App`: es de esta
   * búsqueda, se alimenta de `listingOptions` y su borrado forma parte del
   * reinicio. Tenerla fuera obligaba a `App` a enlazar las dos cosas a mano.
   */
  const { listingOptionsRef, listingSeenRef, resetListingDiscoveryMemory } =
    useListingDiscoveryMemory(listingOptions);

  /**
   * Arranca otra búsqueda: lo que **contó** la anterior caduca.
   *
   * El resultado y las opciones se quedan a propósito -está explicado arriba.
   */
  const olvidaLoQueContoLaAnterior = useCallback(() => {
    setListingSearchCoverage((prev) => (prev === null ? prev : null));
    setListingError((prev) => (prev === null ? prev : null));
    setListingInsight((prev) => (prev === null ? prev : null));
  }, []);

  /**
   * Se empieza de cero: no queda nada de lo anterior, ni la memoria de lo ya
   * visto.
   *
   * Es lo que pasa al volver a analizar, al empezar el cuestionario otra vez y
   * al retomar un borrador: lo que se buscó con las respuestas viejas no tiene
   * nada que ver con lo que se va a buscar.
   */
  const resetListingDiscovery = useCallback(() => {
    setListingFilters(sinFiltros());
    setListingResult(null);
    setListingOptions([]);
    resetListingDiscoveryMemory();
    olvidaLoQueContoLaAnterior();
    setListingLoading(false);
  }, [olvidaLoQueContoLaAnterior, resetListingDiscoveryMemory]);

  return {
    listingFilters, setListingFilters,
    listingResult, setListingResult,
    listingOptions, setListingOptions,
    listingSearchCoverage, setListingSearchCoverage,
    listingLoading, setListingLoading,
    listingError, setListingError,
    listingInsight, setListingInsight,

    listingOptionsRef,
    listingSeenRef,
    resetListingDiscovery,
    olvidaLoQueContoLaAnterior,
  };
}
