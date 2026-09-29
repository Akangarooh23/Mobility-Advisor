/**
 * La revisión de consentimientos, y por qué sus dos botones no son iguales.
 *
 * ## Qué había
 *
 * Siete `useState` en `App` y, en los dos botones del aviso, **el mismo bloque
 * de veinte líneas duplicado**: montar el paquete con la procedencia guardada
 * —idioma, UTMs, referente, datos de afiliado— y mandarlo a `save_consents`.
 * Cambiaban los cinco valores y una línea del final.
 *
 * Veinte líneas repetidas es el sitio donde se arregla uno y no el otro. Y
 * aquí eso no es cosmético: lo que se manda es el consentimiento de una
 * persona, que es justo lo que hay que poder demostrar que se guardó bien.
 *
 * ## La diferencia, que sí es a propósito
 *
 * «Guardar selección» se queda con el usuario que devuelve el servidor;
 * «Continuar sin aceptar» no lo toca. Parece un olvido y no lo es: dejando
 * `consentLegalAt` vacío, el aviso vuelve a salir en el siguiente acceso, que
 * es lo que tiene que pasarle a quien no ha aceptado las condiciones.
 *
 * Se prueba con ese nombre para que nadie lo «arregle».
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useRevisionDeConsentimientos } from "./useRevisionDeConsentimientos";
import { postAuthJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({ postAuthJson: jest.fn() }));

const USUARIO = { email: "ana@popcar.es", consentLegalAt: "2026-09-29T00:00:00.000Z" };

beforeEach(() => {
  jest.clearAllMocks();
  postAuthJson.mockResolvedValue({ data: { user: USUARIO } });
  window.localStorage.setItem("ma.landing", JSON.stringify({
    language: "es-ES",
    utms: { utm_source: "google", utm_medium: "cpc" },
    referer: "https://google.com",
  }));
});

describe("guardar la selección", () => {
  test("manda lo que se marcó", async () => {
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));

    act(() => result.current.abre());
    act(() => result.current.alterna("legal"));
    act(() => result.current.alterna("marketingEmail"));
    await act(async () => { await result.current.guardaLoElegido(); });

    const payload = postAuthJson.mock.calls[0][0];
    expect(payload.action).toBe("save_consents");
    expect(payload.consentLegal).toBe(true);
    expect(payload.consentMarketingEmail).toBe(true);
    expect(payload.consentMarketingSms).toBe(false);
  });

  test("y se queda con el usuario que devuelve el servidor", async () => {
    /*
     * Ese usuario ya trae `consentLegalAt`, y por eso el aviso no vuelve a
     * salir en el siguiente acceso.
     */
    const recibido = jest.fn();
    const { result } = renderHook(() => useRevisionDeConsentimientos({ alRecibirUsuario: recibido }));

    act(() => result.current.abre());
    await act(async () => { await result.current.guardaLoElegido(); });

    expect(recibido).toHaveBeenCalledWith(USUARIO);
  });
});

describe("continuar sin aceptar", () => {
  test("manda cinco noes", async () => {
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));

    act(() => result.current.abre());
    act(() => result.current.alterna("legal"));       // aunque hubiera marcado
    await act(async () => { await result.current.continuarSinAceptar(); });

    const payload = postAuthJson.mock.calls[0][0];
    expect(payload.consentLegal).toBe(false);
    expect(payload.consentMarketingEmail).toBe(false);
    expect(payload.consentMarketingSms).toBe(false);
    expect(payload.consentThirdPartyEmail).toBe(false);
    expect(payload.consentThirdPartySms).toBe(false);
  });

  test("y NO se queda con el usuario, a propósito", async () => {
    /*
     * Si lo recogiera, `consentLegalAt` quedaría puesto en el usuario local y
     * el aviso no volvería a salir: quien no aceptó las condiciones dejaría de
     * ser preguntado.
     */
    const recibido = jest.fn();
    const { result } = renderHook(() => useRevisionDeConsentimientos({ alRecibirUsuario: recibido }));

    act(() => result.current.abre());
    await act(async () => { await result.current.continuarSinAceptar(); });

    expect(recibido).not.toHaveBeenCalled();
  });
});

describe("lo que los dos comparten", () => {
  test("la procedencia viaja con el consentimiento", async () => {
    // Es lo que permite demostrar de dónde venía quien consintió.
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));
    act(() => result.current.abre());
    await act(async () => { await result.current.guardaLoElegido(); });

    const payload = postAuthJson.mock.calls[0][0];
    expect(payload.language).toBe("es-ES");
    expect(payload.utmSource).toBe("google");
    expect(payload.utmMedium).toBe("cpc");
    expect(payload.referer).toBe("https://google.com");
  });

  test("y si el servidor falla, el aviso se cierra igual", async () => {
    /*
     * Dejar a alguien encerrado delante de un aviso que no se puede guardar es
     * peor: el servidor lo volverá a pedir en el siguiente acceso.
     */
    postAuthJson.mockRejectedValue(new Error("se cayó"));
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));

    act(() => result.current.abre());
    expect(result.current.abierta).toBe(true);

    await act(async () => { await result.current.guardaLoElegido(); });

    await waitFor(() => expect(result.current.abierta).toBe(false));
    expect(result.current.guardando).toBe(false);
  });

  test("y un localStorage ilegible no impide guardar", async () => {
    // Un consentimiento no se puede perder porque la procedencia esté rota.
    window.localStorage.setItem("ma.landing", "{esto no es json");
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));

    act(() => result.current.abre());
    await act(async () => { await result.current.guardaLoElegido(); });

    expect(postAuthJson).toHaveBeenCalled();
  });
});

describe("al abrirse", () => {
  test("empieza con todo sin marcar", () => {
    // Las opcionales tienen que venir sin marcar: lo contrario no es un
    // consentimiento, es una casilla que alguien no vio.
    const { result } = renderHook(() => useRevisionDeConsentimientos({}));
    act(() => result.current.abre());

    expect(result.current.elegido).toEqual({
      legal: false,
      marketingEmail: false,
      marketingSms: false,
      thirdPartyEmail: false,
      thirdPartySms: false,
    });
  });
});
