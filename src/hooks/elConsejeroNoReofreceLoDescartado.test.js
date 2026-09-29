/**
 * El consejero: qué se tira al cambiar las respuestas y, sobre todo, qué no.
 *
 * ## La parte fácil
 *
 * Si cambian las respuestas, el análisis y el anuncio encontrado dejan de
 * valer. Eso ya estaba escrito en `useDecisionResetState`, con el estado en
 * `App` y la regla en otro fichero; ahora están juntos.
 *
 * ## La parte que importa
 *
 * El reinicio **no lo borra todo**, y eso es deliberado.
 *
 * Las dos listas de descartados —por dirección y por título— y el contador que
 * pide otra tanda sobreviven al cambio de respuestas. Si alguien dijo «este
 * no» a un coche y luego afina el presupuesto, volver a ofrecérselo es peor
 * que no haberle hecho caso: es la app diciéndole que no le escuchó.
 *
 * Repartido entre catorce `useState` en un sitio y una lista de cinco `set…`
 * en otro, esa diferencia no se veía. Se podía «arreglar» el reinicio añadiendo
 * los tres que faltaban, muy razonablemente, y romper esto sin enterarse.
 *
 * Por eso se prueba con su nombre.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useElConsejero } from "./useElConsejero";

describe("al cambiar las respuestas", () => {
  test("el análisis y el anuncio dejan de valer", async () => {
    const { result } = renderHook(() => useElConsejero());

    act(() => {
      result.current.setDecisionAiResult({ recomendacion: "un Golf" });
      result.current.setDecisionListingResult({ anuncio: "sí" });
      result.current.setDecisionError("algo pasó");
      result.current.setDecisionListingError("y aquí también");
      result.current.setDecisionListingLoading(true);
    });
    await waitFor(() => expect(result.current.decisionAiResult).not.toBeNull());

    act(() => result.current.setDecisionAnswers((prev) => ({ ...prev, presupuesto: "15000" })));

    await waitFor(() => expect(result.current.decisionAiResult).toBeNull());
    expect(result.current.decisionListingResult).toBeNull();
    expect(result.current.decisionError).toBeNull();
    expect(result.current.decisionListingError).toBeNull();
    expect(result.current.decisionListingLoading).toBe(false);
  });

  test("pero lo que descartó NO vuelve a ofrecerse", async () => {
    /*
     * Ésta es la que hay que leer si alguien piensa en «completar» el reinicio.
     * Añadir estas tres al borrado parece coherente y es exactamente lo que
     * hace que la app deje de escuchar.
     */
    const { result } = renderHook(() => useElConsejero());

    act(() => {
      result.current.setDecisionMarketExcludeUrls(["https://portal/coche-1"]);
      result.current.setDecisionMarketExcludeTitles(["Seat León 2018"]);
      result.current.setDecisionMarketRefreshNonce(1234);
    });
    await waitFor(() => expect(result.current.decisionMarketExcludeUrls).toHaveLength(1));

    act(() => result.current.setDecisionAnswers((prev) => ({ ...prev, presupuesto: "18000" })));

    // El análisis sí se fue; los descartados siguen.
    await waitFor(() => expect(result.current.decisionAiResult).toBeNull());
    expect(result.current.decisionMarketExcludeUrls).toEqual(["https://portal/coche-1"]);
    expect(result.current.decisionMarketExcludeTitles).toEqual(["Seat León 2018"]);
    expect(result.current.decisionMarketRefreshNonce).toBe(1234);
  });

  test("y las ofertas del mercado tampoco se borran solas", async () => {
    /*
     * Las trae y las quita el efecto de `App`, que es quien las pide. Borrarlas
     * aquí además dejaría la lista en blanco un instante, cada vez que se
     * mueve una respuesta.
     */
    const { result } = renderHook(() => useElConsejero());

    act(() => result.current.setDecisionMarketListings([{ id: "of-1" }]));
    await waitFor(() => expect(result.current.decisionMarketListings).toHaveLength(1));

    act(() => result.current.setDecisionAnswers((prev) => ({ ...prev, uso: "ciudad" })));

    await waitFor(() => expect(result.current.decisionAiResult).toBeNull());
    expect(result.current.decisionMarketListings).toHaveLength(1);
  });
});

describe("y arranca con algo que tiene sentido", () => {
  test("las respuestas iniciales no son nulas", () => {
    // Las pantallas leen `decisionAnswers.algo` sin comprobar.
    const { result } = renderHook(() => useElConsejero());
    expect(result.current.decisionAnswers).not.toBeNull();
    expect(typeof result.current.decisionAnswers).toBe("object");
  });

  test("y las listas son listas, no nulos", () => {
    // Se recorren con `.map` y `.includes` sin comprobar antes.
    const { result } = renderHook(() => useElConsejero());
    expect(Array.isArray(result.current.decisionMarketListings)).toBe(true);
    expect(Array.isArray(result.current.decisionMarketExcludeUrls)).toBe(true);
    expect(Array.isArray(result.current.decisionMarketExcludeTitles)).toBe(true);
  });
});
