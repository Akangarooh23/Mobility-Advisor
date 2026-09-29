/**
 * El aviso de cookies, ahora que vive en un solo sitio.
 *
 * ## Qué había
 *
 * Tres `useState` en `App` —entre los 127 que tiene—, encendidos desde
 * `useAppBootstrap` y apagados desde `useAppPreferences`. Para responder
 * «¿cuándo sale la barra de cookies?» había que abrir tres ficheros y
 * cruzarlos, y cualquiera de ellos podía cambiar sin que los otros dos se
 * enteraran.
 *
 * ## Qué se fija
 *
 * Lo que decide si una persona ve la barra o no, que es lo único que se
 * notaría si esto se torciera:
 *
 *   · sin respuesta guardada, se pregunta;
 *   · con respuesta guardada, no se vuelve a preguntar —aunque fuera «solo las
 *     necesarias»—, porque si no la barra saldría eternamente a quien ya dijo
 *     que no;
 *   · lo que se eligió la última vez vuelve marcado;
 *   · y `necessary` no se puede desmarcar, venga como venga de lo guardado.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useAppPreferences } from "./useAppPreferences";
import { readCookieConsent, writeCookieConsent } from "../utils/storage";

jest.mock("../utils/storage", () => ({
  readCookieConsent: jest.fn(),
  writeCookieConsent: jest.fn(),
}));

const OPCIONES = { themeStorageKey: "ma.theme", themeMode: "light" };

beforeEach(() => {
  readCookieConsent.mockReset();
  writeCookieConsent.mockReset();
});

describe("si sale la barra o no", () => {
  test("sin nada guardado, se pregunta", async () => {
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.showCookieGate).toBe(true));
  });

  test("con respuesta guardada, no se vuelve a preguntar", async () => {
    readCookieConsent.mockReturnValue({ status: "all", preferences: {} });
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.showCookieGate).toBe(false));
  });

  test("y tampoco a quien dijo «solo las necesarias»", async () => {
    /*
     * Es el caso que más se nota si se rompe: a quien rechazó le saldría la
     * barra en cada visita, que es justo lo contrario de respetar su decisión.
     */
    readCookieConsent.mockReturnValue({
      status: "necessary",
      preferences: { necessary: true, analytics: false, personalization: false, marketing: false },
    });
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.showCookieGate).toBe(false));
  });
});

describe("lo que se eligió la última vez", () => {
  test("vuelve marcado como se dejó", async () => {
    readCookieConsent.mockReturnValue({
      status: "custom",
      preferences: { necessary: true, analytics: true, personalization: false, marketing: false },
    });
    const { result } = renderHook(() => useAppPreferences(OPCIONES));

    await waitFor(() => expect(result.current.cookiePreferences.marketing).toBe(false));
    expect(result.current.cookiePreferences.analytics).toBe(true);
    expect(result.current.cookiePreferences.personalization).toBe(false);
  });

  test("y las necesarias no se pueden desmarcar", async () => {
    // Aunque lo guardado diga que no: sin ellas la web no funciona, y
    // ofrecerlo como elección sería mentir.
    readCookieConsent.mockReturnValue({ status: "custom", preferences: { necessary: false } });
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.cookiePreferences.necessary).toBe(true));
  });
});

describe("al guardar", () => {
  test("«aceptar todas» las enciende todas y cierra la barra", async () => {
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.showCookieGate).toBe(true));

    act(() => result.current.saveCookieConsent("all"));

    expect(writeCookieConsent).toHaveBeenCalledWith("all", expect.objectContaining({
      preferences: { necessary: true, analytics: true, personalization: true, marketing: true },
    }));
    await waitFor(() => expect(result.current.showCookieGate).toBe(false));
  });

  test("«solo las necesarias» apaga el resto", async () => {
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));

    act(() => result.current.saveCookieConsent("necessary"));

    expect(writeCookieConsent).toHaveBeenCalledWith("necessary", expect.objectContaining({
      preferences: { necessary: true, analytics: false, personalization: false, marketing: false },
    }));
  });

  test("y un modo que no existe se trata como «todas», no como nada", async () => {
    // Un valor raro no puede acabar guardando un consentimiento vacío que
    // luego nadie sepa interpretar.
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));

    act(() => result.current.saveCookieConsent("lo-que-sea"));

    expect(writeCookieConsent.mock.calls[0][0]).toBe("all");
  });
});

describe("y el detalle del aviso", () => {
  test("se abre y se cierra", async () => {
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));

    expect(result.current.showCookieSettings).toBe(false);
    act(() => result.current.alternarAjustes());
    expect(result.current.showCookieSettings).toBe(true);
    act(() => result.current.alternarAjustes());
    expect(result.current.showCookieSettings).toBe(false);
  });

  test("y una categoría se marca y se desmarca", async () => {
    readCookieConsent.mockReturnValue(null);
    const { result } = renderHook(() => useAppPreferences(OPCIONES));
    await waitFor(() => expect(result.current.cookiePreferences.marketing).toBe(true));

    act(() => result.current.alternarPreferencia("marketing"));
    expect(result.current.cookiePreferences.marketing).toBe(false);
  });
});
