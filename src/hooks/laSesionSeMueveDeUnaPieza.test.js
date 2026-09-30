/**
 * La sesión se mueve de una pieza.
 *
 * ## Qué había
 *
 * Cuatro `useState` en `App`, y **dos de ellos cuentan el mismo hecho**:
 * `currentUser` —quién es— e `isUserLoggedIn` —si hay alguien—. Se movían por
 * separado, en cuatro ficheros:
 *
 *   · `useAppBootstrap` los ponía juntos en tres sitios;
 *   · `App` los ponía juntos en dos;
 *   · `useAuthSessionReset` ponía **solo** `currentUser` a nulo;
 *   · `useAdvisorController` ponía **solo** `isUserLoggedIn` a falso.
 *
 * Los dos últimos se compensaban porque `handleLogout` llamaba a los dos, uno
 * detrás del otro. Funcionaba, pero la coherencia de «no hay nadie» dependía de
 * que dos ficheros distintos se llamaran en el orden correcto: quien llamara a
 * `resetLoggedUser` desde otro sitio se quedaba con `currentUser` a nulo e
 * `isUserLoggedIn` a cierto —la aplicación creyendo que hay alguien, y sin nadie.
 *
 * Aquí se prueba que ya no se pueden separar.
 */

import { renderHook, act } from "@testing-library/react";
import { useLaSesion } from "./useLaSesion";
import { writeAuthUser, clearAuthUser, readAuthUser } from "../utils/storage";

jest.mock("../utils/storage", () => ({
  writeAuthUser: jest.fn(),
  clearAuthUser: jest.fn(),
  readAuthUser: jest.fn(),
}));

const ANA = { id: 7, email: "ana@popcar.es", consentLegalAt: "2026-09-29T00:00:00.000Z" };

beforeEach(() => jest.clearAllMocks());

describe("entrar", () => {
  test("mueve los dos estados a la vez", () => {
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));

    expect(result.current.currentUser).toBe(ANA);
    expect(result.current.isUserLoggedIn).toBe(true);
  });

  test("y lo guarda en el navegador, que es lo que evita el parpadeo", () => {
    /*
     * Sin esto, al recargar se ve la portada un instante antes de que el
     * servidor conteste.
     */
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));

    expect(writeAuthUser).toHaveBeenCalledWith(ANA);
  });

  test("un usuario sin correo NO es alguien dentro", () => {
    /*
     * El arranque llama a esto con lo que haya en el navegador, que puede ser
     * nulo o un resto a medias. Sin esta comprobación, `isUserLoggedIn` se
     * pondría a cierto con un usuario sin correo y el panel saldría en blanco.
     */
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(null));
    expect(result.current.isUserLoggedIn).toBe(false);

    act(() => result.current.entra({ nombre: "a medias" }));
    expect(result.current.isUserLoggedIn).toBe(false);
  });
});

describe("salir", () => {
  test("mueve los dos estados a la vez", () => {
    // Es lo que estaba repartido entre dos ficheros.
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));
    act(() => result.current.sale());

    expect(result.current.currentUser).toBeNull();
    expect(result.current.isUserLoggedIn).toBe(false);
  });

  test("y borra lo guardado", () => {
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));
    act(() => result.current.sale());

    expect(clearAuthUser).toHaveBeenCalled();
  });

  test("pero NO olvida que ya se preguntó", () => {
    /*
     * `sesionComprobada` distingue «no hay nadie» de «todavía no lo sé».
     * Apagarlo al salir haría que media aplicación volviera a tratar el momento
     * como una pregunta sin contestar, y parpadearía.
     */
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.setSesionComprobada(true));
    act(() => result.current.entra(ANA));
    act(() => result.current.sale());

    expect(result.current.sesionComprobada).toBe(true);
  });
});

describe("actualizarse sin volver a entrar", () => {
  test("cambia el usuario y no toca si está dentro", () => {
    /*
     * Es lo que pasa al aceptar los consentimientos o al cambiar la contraseña:
     * la sesión es la misma, el usuario trae un campo nuevo.
     */
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));
    const conConsentimiento = { ...ANA, consentMarketingAt: "2026-09-30T10:00:00.000Z" };
    act(() => result.current.seActualiza(conConsentimiento));

    expect(result.current.currentUser).toBe(conConsentimiento);
    expect(result.current.isUserLoggedIn).toBe(true);
  });

  test("y también se guarda", () => {
    // Si no, al recargar se pierde el campo nuevo y vuelve a preguntarse.
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.entra(ANA));
    act(() => result.current.seActualiza({ ...ANA, telefono: "600111222" }));

    expect(writeAuthUser).toHaveBeenCalledTimes(2);
  });
});

describe("todavía no lo sé", () => {
  test("al arrancar no se sabe, y eso no es «no hay nadie»", () => {
    /*
     * Sin esta diferencia, el guardián de /mis-coches veía el valor inicial y le
     * pedía la contraseña a quien ya estaba dentro.
     */
    const { result } = renderHook(() => useLaSesion());

    expect(result.current.sesionComprobada).toBe(false);
    expect(result.current.isUserLoggedIn).toBe(false);
  });

  test("y se sabe una vez, para siempre", () => {
    const { result } = renderHook(() => useLaSesion());

    act(() => result.current.setSesionComprobada(true));

    expect(result.current.sesionComprobada).toBe(true);
  });
});

describe("«hace falta entrar»", () => {
  test("no es lo contrario de estar dentro", () => {
    /*
     * Se enciende al pedir una página que necesita cuenta. Puede estar encendido
     * con alguien dentro —un instante, antes de retirarse— y apagado sin nadie
     * —en una página pública.
     */
    const { result } = renderHook(() => useLaSesion());

    expect(result.current.authRequired).toBe(false);
    expect(result.current.isUserLoggedIn).toBe(false);

    act(() => result.current.setAuthRequired(true));
    act(() => result.current.entra(ANA));

    // Entrar no lo apaga: lo apaga quien lo encendió, cuando consigue lo que
    // pedía.
    expect(result.current.authRequired).toBe(true);
    expect(result.current.isUserLoggedIn).toBe(true);
  });
});

describe("y nadie puede separarlos", () => {
  test("el hook no deja los dos setters sueltos", () => {
    /*
     * Es lo que hacía posible el problema: cuatro ficheros con acceso a
     * `setCurrentUser` y `setIsUserLoggedIn` por separado.
     */
    const { result } = renderHook(() => useLaSesion());

    expect(result.current.setCurrentUser).toBeUndefined();
    expect(result.current.setIsUserLoggedIn).toBeUndefined();
  });

  test("y no queda ningún fichero moviéndolos a mano", () => {
    const fs = require("fs");
    const path = require("path");

    const aBarrer = [
      path.join(__dirname, "..", "App.js"),
      ...fs.readdirSync(__dirname)
        .filter((n) => n.endsWith(".js") && !n.endsWith(".test.js") && n !== "useLaSesion.js")
        .map((n) => path.join(__dirname, n)),
    ];

    const culpables = [];

    for (const fichero of aBarrer) {
      const fuente = fs.readFileSync(fichero, "utf8");
      for (const nombre of ["setCurrentUser(", "setIsUserLoggedIn("]) {
        if (fuente.includes(nombre)) culpables.push(`${path.basename(fichero)}: ${nombre}`);
      }
    }

    expect(culpables).toEqual([]);
  });
});

describe("y lo que el hook NO hace", () => {
  test("preguntar al servidor", () => {
    /*
     * Eso es `useAppBootstrap`, que arranca media aplicación. Esto guarda la
     * respuesta y la mantiene coherente.
     */
    renderHook(() => useLaSesion());

    expect(readAuthUser).not.toHaveBeenCalled();
  });
});
