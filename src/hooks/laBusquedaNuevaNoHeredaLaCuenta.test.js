/**
 * La búsqueda nueva no hereda la cuenta de la anterior.
 *
 * ## Qué pasaba
 *
 * Los siete estados de la búsqueda tenían **tres listas distintas de «esto ya
 * no vale»**, en tres ficheros, y no coincidían: la cobertura estaba en una y
 * no en las otras dos; el porqué estaba en otra y no en las otras dos. Cada
 * lista se escribió mirando el problema de su día.
 *
 * La línea de cobertura no es decorativa: afirma con números «se han revisado
 * 12 páginas de 4/7 portales **para esta búsqueda** de compra». Y se dibuja
 * siempre que tenga texto, sin mirar si se está buscando.
 *
 * Como nadie la borraba al arrancar otra búsqueda, esa frase seguía en
 * pantalla -con los números de la anterior- durante los **253 segundos** que
 * puede tardar la nueva, y se quedaba para siempre si la nueva fallaba: el
 * aviso de que la búsqueda no terminó, y justo encima el recuento exacto de
 * una búsqueda que no es ésa.
 *
 * ## Y lo que NO se borra, a propósito
 *
 * El resultado y las opciones se conservan al empezar otra búsqueda. Son las
 * dos cosas que parecen faltar en la lista y no faltan: se sigue viendo lo que
 * ya había mientras llega la tanda nueva -vaciarlo deja la pantalla en blanco
 * cuatro minutos- y de esa lista sale lo que hay que pedir que **no** se
 * repita.
 */

import { renderHook, act } from "@testing-library/react";
import { useLaBusquedaDeOfertas, sinFiltros } from "./useLaBusquedaDeOfertas";

/** Deja el hook como queda tras una búsqueda que salió bien. */
function conUnaBusquedaHecha(result) {
  act(() => {
    result.current.setListingFilters({ ...sinFiltros(), budget: "15000" });
    result.current.setListingResult({ title: "Un Golf", url: "https://portal/golf" });
    result.current.setListingOptions([{ url: "https://portal/golf" }, { url: "https://portal/leon" }]);
    result.current.setListingSearchCoverage({ visitedProviderPages: 12, visitedCompanyCount: 4, configuredCompanyCount: 7 });
    result.current.setListingInsight("las que hay tienen más kilómetros de los que pusiste");
    result.current.setListingError("algo salió mal antes");
  });
}

describe("al empezar otra búsqueda", () => {
  test("caduca lo que contó la anterior: cobertura, fallo y porqué", () => {
    const { result } = renderHook(() => useLaBusquedaDeOfertas());
    conUnaBusquedaHecha(result);

    act(() => result.current.olvidaLoQueContoLaAnterior());

    // La cobertura es la que faltaba, y la que se veía con sus números.
    expect(result.current.listingSearchCoverage).toBeNull();
    expect(result.current.listingError).toBeNull();
    expect(result.current.listingInsight).toBeNull();
  });

  test("pero el resultado y las opciones se conservan", () => {
    /*
     * Ésta es la que hay que leer si alguien piensa en «completar» el borrado.
     * Añadirlas parece coherente y es lo que deja la pantalla en blanco los
     * cuatro minutos que puede durar la búsqueda, y lo que hace que vuelvan a
     * salir las mismas ofertas al recalcular.
     */
    const { result } = renderHook(() => useLaBusquedaDeOfertas());
    conUnaBusquedaHecha(result);

    act(() => result.current.olvidaLoQueContoLaAnterior());

    expect(result.current.listingResult).not.toBeNull();
    expect(result.current.listingOptions).toHaveLength(2);
    expect(result.current.listingFilters.budget).toBe("15000");
  });
});

describe("al empezar de cero", () => {
  test("no queda nada de la búsqueda anterior", () => {
    const { result } = renderHook(() => useLaBusquedaDeOfertas());
    conUnaBusquedaHecha(result);
    act(() => result.current.setListingLoading(true));

    act(() => result.current.resetListingDiscovery());

    expect(result.current.listingFilters).toEqual(sinFiltros());
    expect(result.current.listingResult).toBeNull();
    expect(result.current.listingOptions).toEqual([]);
    expect(result.current.listingSearchCoverage).toBeNull();
    expect(result.current.listingError).toBeNull();
    // El porqué tampoco: era el que faltaba en ESTA de las tres listas.
    expect(result.current.listingInsight).toBeNull();
    expect(result.current.listingLoading).toBe(false);
  });

  test("y tampoco la memoria de lo que ya se enseñó", () => {
    /*
     * Si sobreviviera, la primera búsqueda de las respuestas nuevas pediría
     * que no le repitan coches que esa persona no ha visto nunca.
     */
    const { result } = renderHook(() => useLaBusquedaDeOfertas());

    act(() => result.current.setListingOptions([{ url: "https://portal/golf", title: "Un Golf" }]));
    expect(result.current.listingSeenRef.current.urls).toContain("https://portal/golf");

    act(() => result.current.resetListingDiscovery());

    expect(result.current.listingSeenRef.current.urls).toEqual([]);
    expect(result.current.listingSeenRef.current.titles).toEqual([]);
    expect(result.current.listingOptionsRef.current).toEqual([]);
  });
});

describe("y arranca con algo que tiene sentido", () => {
  test("los filtros son un objeto con las siete claves", () => {
    // Las pantallas leen `listingFilters.company` sin comprobar.
    const { result } = renderHook(() => useLaBusquedaDeOfertas());
    expect(Object.keys(result.current.listingFilters).sort()).toEqual(
      ["budget", "company", "income", "location", "maxPrice", "minPrice", "priceRange"]
    );
  });

  test("y las opciones son una lista, no un nulo", () => {
    // Se recorren con `.map` sin comprobar antes.
    const { result } = renderHook(() => useLaBusquedaDeOfertas());
    expect(Array.isArray(result.current.listingOptions)).toBe(true);
  });

  test("y cada búsqueda parte de sus propios filtros vacíos", () => {
    /*
     * `sinFiltros()` devuelve un objeto nuevo cada vez. Compartir uno haría
     * que tocar los filtros de una búsqueda cambiara el valor de partida de
     * todas las siguientes.
     */
    expect(sinFiltros()).not.toBe(sinFiltros());
    expect(sinFiltros()).toEqual(sinFiltros());
  });
});
