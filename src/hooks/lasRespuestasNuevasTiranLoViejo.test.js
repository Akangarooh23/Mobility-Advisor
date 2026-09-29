/**
 * Vender: si cambian las respuestas, lo calculado con las anteriores se tira.
 *
 * ## Por qué esto importa más que parecer ordenado
 *
 * De este flujo salen tres cosas: el análisis, el anuncio y la foto del
 * mercado. Las tres se calculan a partir de las respuestas.
 *
 * Si alguien cambia una respuesta —el año, los kilómetros, el estado— y los
 * resultados viejos se quedan en pantalla, **no hay error y no hay aviso**.
 * Solo un precio que ya no corresponde a lo que acaba de contestar, y con el
 * que puede decidir por cuánto pone su coche a la venta.
 *
 * ## Qué cambió
 *
 * La regla existía —`useSellResetState`— pero los once `useState` vivían en
 * `App` y el hook recibía nueve `set…` para poder borrarlos. Once piezas en un
 * sitio y la regla que las gobierna en otro. Ahora están juntas.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useElFlujoDeVenta } from "./useElFlujoDeVenta";

describe("cuando cambian las respuestas", () => {
  test("los tres resultados dejan de valer", async () => {
    const { result } = renderHook(() => useElFlujoDeVenta());

    act(() => {
      result.current.setSellAiResult({ precio: 12000 });
      result.current.setSellListingResult({ anuncio: "sí" });
      result.current.setSellMarketSnapshot({ media: 11500 });
    });

    await waitFor(() => expect(result.current.sellAiResult).not.toBeNull());

    // La persona corrige los kilómetros.
    act(() => result.current.setSellAnswers((prev) => ({ ...prev, mileage: "180000" })));

    await waitFor(() => expect(result.current.sellAiResult).toBeNull());
    expect(result.current.sellListingResult).toBeNull();
    expect(result.current.sellMarketSnapshot).toBeNull();
  });

  test("y los fallos y los «cargando» también", async () => {
    /*
     * Un fallo viejo en pantalla es tan confuso como un resultado viejo: dice
     * que algo salió mal de un cálculo que ya no existe.
     */
    const { result } = renderHook(() => useElFlujoDeVenta());

    act(() => {
      result.current.setSellError("no se pudo");
      result.current.setSellListingError("tampoco");
      result.current.setSellListingLoading(true);
      result.current.setSellMarketSnapshotError("ni esto");
      result.current.setSellMarketSnapshotLoading(true);
    });
    await waitFor(() => expect(result.current.sellError).toBe("no se pudo"));

    act(() => result.current.setSellAnswers((prev) => ({ ...prev, year: "2016" })));

    await waitFor(() => expect(result.current.sellError).toBeNull());
    expect(result.current.sellListingError).toBeNull();
    expect(result.current.sellListingLoading).toBe(false);
    expect(result.current.sellMarketSnapshotError).toBe("");
    expect(result.current.sellMarketSnapshotLoading).toBe(false);
  });

  test("pero el tipo de flujo NO se toca", async () => {
    /*
     * `sellFlowType` dice si viene a por el informe de mercado o a por el
     * certificado: es de qué producto se trata, no un resultado. Borrarlo al
     * corregir una respuesta dejaría la pantalla sin saber qué está vendiendo.
     */
    const { result } = renderHook(() => useElFlujoDeVenta());

    act(() => result.current.setSellFlowType("report"));
    act(() => result.current.setSellAnswers((prev) => ({ ...prev, year: "2019" })));

    await waitFor(() => expect(result.current.sellAiResult).toBeNull());
    expect(result.current.sellFlowType).toBe("report");
  });
});

describe("y arranca con algo que tiene sentido", () => {
  test("las respuestas iniciales no son nulas", () => {
    // La pantalla lee `sellAnswers.algo` sin comprobar: con null reventaría al
    // primer renderizado.
    const { result } = renderHook(() => useElFlujoDeVenta());
    expect(result.current.sellAnswers).not.toBeNull();
    expect(typeof result.current.sellAnswers).toBe("object");
  });

  test("y no hay ni resultados ni fallos de entrada", () => {
    const { result } = renderHook(() => useElFlujoDeVenta());
    expect(result.current.sellAiResult).toBeNull();
    expect(result.current.sellError).toBeNull();
    expect(result.current.sellLoading).toBe(false);
    expect(result.current.sellFlowType).toBe("");
  });
});
