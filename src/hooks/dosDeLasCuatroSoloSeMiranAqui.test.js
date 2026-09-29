/**
 * Cambiar la contraseña: las cuatro comprobaciones, y las dos que solo están aquí.
 *
 * ## Qué había
 *
 * Cinco `useState` en `App`, los cinco `set...` pasados a `useAuthSessionReset`
 * para poder limpiarlos al salir, y las cuatro comprobaciones metidas dentro del
 * `useCallback` que manda el formulario. Sin una sola prueba.
 *
 * ## Por qué importan
 *
 * De las cuatro, el servidor solo repite dos: que la nueva tenga seis
 * caracteres y que no sea igual a la anterior (`api/auth.js:1352-1360`).
 *
 * Las otras dos —que los tres campos estén rellenos y, sobre todo, **que la
 * confirmación coincida**— se miran **solo aquí**. Si alguien las quita
 * pensando que el servidor las cubre, se manda a guardar una contraseña que la
 * persona escribió mal en el segundo campo, y el servidor la acepta: se queda
 * fuera de su propia cuenta sin saber por qué.
 *
 * De ahí que la comprobación sea una función suelta y probada, y no cuatro `if`
 * dentro de un manejador de formulario.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useElCambioDeContrasena,
  queFaltaEnElCambio,
  MINIMO_DE_CARACTERES,
} from "./useElCambioDeContrasena";
import { postAuthJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({ postAuthJson: jest.fn() }));

const BIEN = { currentPassword: "laDeAntes1", newPassword: "laNueva123", confirmPassword: "laNueva123" };

beforeEach(() => {
  jest.clearAllMocks();
  postAuthJson.mockResolvedValue({ data: { user: { email: "ana@popcar.es" }, message: "Hecho." } });
});

describe("las dos que el servidor NO repite", () => {
  test("la confirmación tiene que coincidir", () => {
    /*
     * Ésta es la importante. Sin ella se guarda lo que se escribió en el
     * segundo campo, y el servidor lo acepta: quien se equivocó al teclear se
     * queda fuera de su cuenta.
     */
    expect(queFaltaEnElCambio({ ...BIEN, confirmPassword: "laNuevo123" }))
      .toBe("La confirmación no coincide con la nueva contraseña.");
  });

  test("y los tres campos tienen que estar", () => {
    for (const vacio of ["currentPassword", "newPassword", "confirmPassword"]) {
      expect(queFaltaEnElCambio({ ...BIEN, [vacio]: "" }))
        .toBe("Completa los tres campos de contraseña.");
    }
  });
});

describe("las dos que el servidor también mira", () => {
  test("la nueva necesita seis caracteres", () => {
    const corta = "a".repeat(MINIMO_DE_CARACTERES - 1);
    expect(queFaltaEnElCambio({ currentPassword: "laDeAntes1", newPassword: corta, confirmPassword: corta }))
      .toContain(`al menos ${MINIMO_DE_CARACTERES}`);
  });

  test("y no puede ser la misma de antes", () => {
    expect(queFaltaEnElCambio({ currentPassword: "laMisma123", newPassword: "laMisma123", confirmPassword: "laMisma123" }))
      .toBe("La nueva contraseña no puede ser igual a la actual.");
  });

  test("el mínimo es el mismo que pide el servidor", () => {
    // Si aquí fuera menor, el servidor rechazaría algo que la web dejó pasar.
    expect(MINIMO_DE_CARACTERES).toBe(6);
  });
});

describe("el orden de los avisos", () => {
  test("se avisa de lo primero que falta, no de todo a la vez", () => {
    /*
     * Con los tres campos vacíos también «no llega a seis» y también «no
     * coincide», pero decirlo así no ayuda a nadie.
     */
    expect(queFaltaEnElCambio({ currentPassword: "", newPassword: "", confirmPassword: "" }))
      .toBe("Completa los tres campos de contraseña.");
  });

  test("y con todo bien no falta nada", () => {
    expect(queFaltaEnElCambio(BIEN)).toBeNull();
  });

  test("ni se cae con un formulario que no llega", () => {
    // Se llama desde un manejador de formulario, que puede llegar sin nada.
    expect(queFaltaEnElCambio()).toBe("Completa los tres campos de contraseña.");
    expect(queFaltaEnElCambio({})).toBe("Completa los tres campos de contraseña.");
  });
});

describe("al mandarlo", () => {
  test("si falta algo, no se llama al servidor", () => {
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    act(() => { result.current.escribe("currentPassword", "laDeAntes1"); });
    act(() => { result.current.escribe("newPassword", "laNueva123"); });
    act(() => { result.current.escribe("confirmPassword", "otraCosa99"); });
    act(() => { result.current.manda(); });

    expect(postAuthJson).not.toHaveBeenCalled();
    expect(result.current.fallo).toContain("no coincide");
  });

  test("y con todo bien se manda solo la actual y la nueva", async () => {
    // La confirmación no viaja: al servidor no le sirve de nada.
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    for (const [campo, valor] of Object.entries(BIEN)) {
      act(() => { result.current.escribe(campo, valor); });
    }
    await act(async () => { await result.current.manda(); });

    expect(postAuthJson).toHaveBeenCalledWith({
      action: "change_password",
      currentPassword: BIEN.currentPassword,
      newPassword: BIEN.newPassword,
    });
  });

  test("al salir bien no queda la contraseña escrita en pantalla", async () => {
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    for (const [campo, valor] of Object.entries(BIEN)) {
      act(() => { result.current.escribe(campo, valor); });
    }
    act(() => result.current.alterna());
    expect(result.current.abierto).toBe(true);

    await act(async () => { await result.current.manda(); });

    expect(result.current.formulario).toEqual({ currentPassword: "", newPassword: "", confirmPassword: "" });
    expect(result.current.abierto).toBe(false);
    expect(result.current.hecho).toBe("Hecho.");
  });

  test("y se recoge el usuario que devuelve el servidor", async () => {
    const recibido = jest.fn();
    const { result } = renderHook(() => useElCambioDeContrasena({ alRecibirUsuario: recibido }));

    for (const [campo, valor] of Object.entries(BIEN)) {
      act(() => { result.current.escribe(campo, valor); });
    }
    await act(async () => { await result.current.manda(); });

    expect(recibido).toHaveBeenCalledWith({ email: "ana@popcar.es" });
  });

  test("si el servidor falla, se dice y NO se borra lo escrito", async () => {
    /*
     * Borrarlo obligaría a teclear las tres otra vez por un fallo que no es de
     * quien las escribió.
     */
    postAuthJson.mockRejectedValue(new Error("La contraseña actual no es correcta."));
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    for (const [campo, valor] of Object.entries(BIEN)) {
      act(() => { result.current.escribe(campo, valor); });
    }
    act(() => result.current.alterna());
    await act(async () => { await result.current.manda(); });

    await waitFor(() => expect(result.current.fallo).toBe("La contraseña actual no es correcta."));
    expect(result.current.formulario.currentPassword).toBe(BIEN.currentPassword);
    expect(result.current.abierto).toBe(true);
    expect(result.current.guardando).toBe(false);
  });
});

describe("al abrir y cerrar", () => {
  test("se quitan los avisos de la vez anterior", () => {
    // Abrir el formulario y ver el error de hace diez minutos es confuso.
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    act(() => { result.current.manda(); });
    expect(result.current.fallo).not.toBe("");

    act(() => result.current.alterna());

    expect(result.current.fallo).toBe("");
    expect(result.current.hecho).toBe("");
    expect(result.current.abierto).toBe(true);
  });
});

describe("al salir de la cuenta", () => {
  test("no queda nada escrito ni ningún aviso", async () => {
    /*
     * Es lo que llama `useAuthSessionReset`, que antes recibía los cinco `set`
     * por separado y podía dejarse uno.
     */
    const { result } = renderHook(() => useElCambioDeContrasena({}));

    for (const [campo, valor] of Object.entries(BIEN)) {
      act(() => { result.current.escribe(campo, valor); });
    }
    act(() => result.current.alterna());

    act(() => result.current.olvidaTodo());

    expect(result.current.formulario).toEqual({ currentPassword: "", newPassword: "", confirmPassword: "" });
    expect(result.current.abierto).toBe(false);
    expect(result.current.fallo).toBe("");
    expect(result.current.hecho).toBe("");
    expect(result.current.guardando).toBe(false);
  });
});
