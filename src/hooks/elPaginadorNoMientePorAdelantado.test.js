/**
 * El paginador del mercado no dice que estás en una página que no ha llegado.
 *
 * ## Qué pasaba
 *
 * `goToMarketplacePage` subía el número de página y **después** pedía la
 * página. El aviso de «no se ha podido cargar» solo se ponía cuando la página
 * era la primera; en cualquier otra, las ofertas se quedaban como estaban —a
 * propósito, para no vaciar la pantalla— pero el número ya había subido.
 *
 * Y el paginador resalta la página actual: `isActive = page === currentPage`,
 * en `PortalVoMarketplacePage`. Así que quien pulsaba «3» y tenía mala suerte
 * se quedaba mirando los quince coches de la página 2 con el 3 resaltado, sin
 * un solo aviso. Los coches eran reales; la página, mentira.
 *
 * Ahora el número lo mueve la respuesta, no el clic.
 *
 * ## Lo que sigue faltando, y no se inventa aquí
 *
 * Un aviso visible cuando falla una página que no es la primera. Hoy el clic
 * no hace nada, que es peor que un aviso y mejor que una mentira.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useElMercadoVo, MARKETPLACE_PAGE_SIZE } from "./useElMercadoVo";
import { getMarketplaceVoJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({
  getMarketplaceVoJson: jest.fn(),
  rutaApi: (r) => r,
}));
jest.mock("../utils/funnelTracker", () => ({ trackFunnelEvent: jest.fn() }));

/** Una respuesta buena, con la fuente que el hook considera válida. */
function conOfertas(cuantas, totalUniverse = 300) {
  return {
    data: {
      source: "postgres-marketplace-table",
      totalUniverse,
      offers: Array.from({ length: cuantas }, (_, n) => ({ id: `of-${n}` })),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: false }) });
  window.scrollTo = jest.fn();
});

/** El hook fuera del mercado: sus efectos no piden nada. */
function fueraDelMercado() {
  return renderHook(() => useElMercadoVo({ entryMode: "advisor", currentUser: null }));
}

describe("al ir a otra página", () => {
  test("si llega, el número sube", async () => {
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();

    await act(async () => { await result.current.goToMarketplacePage(3); });

    expect(result.current.marketplaceVoPage).toBe(3);
    expect(result.current.portalVoOffersLive).toHaveLength(MARKETPLACE_PAGE_SIZE);
  });

  test("y se pide el trozo que toca, no el primero", async () => {
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();

    await act(async () => { await result.current.goToMarketplacePage(3); });

    const params = getMarketplaceVoJson.mock.calls.at(-1)[0];
    expect(params.offset).toBe(3 * MARKETPLACE_PAGE_SIZE);
    expect(params.limit).toBe(MARKETPLACE_PAGE_SIZE);
  });

  test("si NO llega, el número se queda donde estaba", async () => {
    /*
     * Ésta es la del fallo. Antes el número subía primero y el paginador
     * resaltaba una página cuyas ofertas no estaban debajo.
     */
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();
    await act(async () => { await result.current.goToMarketplacePage(2); });
    expect(result.current.marketplaceVoPage).toBe(2);
    const loQueSeVe = result.current.portalVoOffersLive;

    getMarketplaceVoJson.mockRejectedValue(new Error("se cayó la base"));
    await act(async () => { await result.current.goToMarketplacePage(3); });

    expect(result.current.marketplaceVoPage).toBe(2);
    // Y lo que hay en pantalla sigue siendo lo de la 2, que es lo que dice.
    expect(result.current.portalVoOffersLive).toBe(loQueSeVe);
  });

  test("tampoco sube si la respuesta viene de otra fuente", async () => {
    /*
     * Una respuesta con `source` distinto es un fallo disfrazado: llega un 200
     * con ofertas que no son del catálogo dedicado.
     */
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();
    await act(async () => { await result.current.goToMarketplacePage(2); });

    getMarketplaceVoJson.mockResolvedValue({ data: { source: "fallback-scrape", offers: [{ id: "x" }] } });
    await act(async () => { await result.current.goToMarketplacePage(3); });

    expect(result.current.marketplaceVoPage).toBe(2);
  });

  test("y no se pide nada mientras se está pidiendo", async () => {
    // Dos clics seguidos en el paginador no deben lanzar dos peticiones.
    let suelta;
    getMarketplaceVoJson.mockImplementation(
      () => new Promise((ok) => { suelta = () => ok(conOfertas(MARKETPLACE_PAGE_SIZE)); })
    );
    const { result } = fueraDelMercado();

    let primera;
    act(() => { primera = result.current.goToMarketplacePage(1); });
    await waitFor(() => expect(result.current.marketplaceVoLoading).toBe(true));

    await act(async () => { await result.current.goToMarketplacePage(2); });
    expect(getMarketplaceVoJson).toHaveBeenCalledTimes(1);

    await act(async () => { suelta(); await primera; });
    expect(result.current.marketplaceVoPage).toBe(1);
  });
});

describe("cuando la primera página no se puede cargar", () => {
  test("se dice que no se ha podido, que no es lo mismo que «no hay»", async () => {
    /*
     * Con la base caída la web invitaba a crear una alerta para coches que sí
     * existían, porque una lista vacía se pintaba igual en los dos casos.
     */
    getMarketplaceVoJson.mockRejectedValue(new Error("se cayó la base"));
    const { result } = fueraDelMercado();

    await act(async () => { await result.current.goToMarketplacePage(0); });

    expect(result.current.marketplaceVoUnavailable).toBe(true);
    expect(result.current.portalVoOffersLive).toEqual([]);
    expect(result.current.marketplaceVoTotal).toBe(0);
  });

  test("y al cargarse bien deja de decirse", async () => {
    getMarketplaceVoJson.mockRejectedValue(new Error("se cayó la base"));
    const { result } = fueraDelMercado();
    await act(async () => { await result.current.goToMarketplacePage(0); });
    expect(result.current.marketplaceVoUnavailable).toBe(true);

    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    await act(async () => { await result.current.goToMarketplacePage(0); });

    expect(result.current.marketplaceVoUnavailable).toBe(false);
  });
});

describe("meter una oferta por delante", () => {
  test("la pone primera si no estaba", () => {
    // Es para los enlaces directos a una ficha: la ficha lee de esta lista.
    const { result } = fueraDelMercado();

    act(() => result.current.metePorDelante({ id: "of-nueva" }));

    expect(result.current.portalVoOffersLive[0].id).toBe("of-nueva");
  });

  test("y no la duplica si ya estaba", () => {
    const { result } = fueraDelMercado();

    act(() => result.current.metePorDelante({ id: "of-nueva" }));
    act(() => result.current.metePorDelante({ id: "of-nueva" }));

    expect(result.current.portalVoOffersLive).toHaveLength(1);
  });

  test("y una oferta sin id no entra", () => {
    // Llega de una respuesta de la API, que puede venir vacía.
    const { result } = fueraDelMercado();

    act(() => result.current.metePorDelante(null));
    act(() => result.current.metePorDelante({}));

    expect(result.current.portalVoOffersLive).toEqual([]);
  });
});

describe("cambiar entre compra y renting", () => {
  test("se vuelve a la primera página: es otro catálogo", async () => {
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();
    await act(async () => { await result.current.goToMarketplacePage(4); });
    expect(result.current.marketplaceVoPage).toBe(4);

    await act(async () => { result.current.handleMarketplaceModalityChange("renting"); });

    expect(result.current.marketplaceVoPage).toBe(0);
    expect(result.current.portalVoModalityMode).toBe("renting");
  });

  test("y se pide con la modalidad nueva, no con la anterior", async () => {
    /*
     * Se pasa a mano porque el estado todavía no la tiene: dejarlo al valor por
     * omisión pediría el catálogo de antes.
     */
    getMarketplaceVoJson.mockResolvedValue(conOfertas(MARKETPLACE_PAGE_SIZE));
    const { result } = fueraDelMercado();

    await act(async () => { result.current.handleMarketplaceModalityChange("renting"); });

    expect(getMarketplaceVoJson.mock.calls.at(-1)[0].modalityMode).toBe("renting");
  });
});

describe("los filtros", () => {
  test("empiezan y vuelven al mismo sitio", () => {
    // Estaba escrito igual en tres sitios.
    const { result } = fueraDelMercado();
    const alEmpezar = result.current.portalVoFilters;

    act(() => result.current.setPortalVoFilters((prev) => ({ ...prev, brand: "Seat" })));
    expect(result.current.portalVoFilters.brand).toBe("Seat");

    act(() => result.current.empiezaSinFiltros());

    expect(result.current.portalVoFilters).toEqual(alEmpezar);
  });
});
