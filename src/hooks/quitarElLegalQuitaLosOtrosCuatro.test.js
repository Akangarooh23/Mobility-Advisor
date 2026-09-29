/**
 * Los consentimientos del registro, y la regla que vivía en un `onChange`.
 *
 * ## Qué había
 *
 * Cinco `useState` en `App` y, dentro del JSX del formulario:
 *
 *   · la condición de «están los cinco» escrita **tres veces en diecisiete
 *     líneas**: una para decidir qué hace el interruptor de arriba, y dos más
 *     metidas dentro de sendos objetos de estilo, para el color y para la
 *     posición del círculo;
 *   · la regla de que **quitar el legal quita los otros cuatro**, dentro de un
 *     `onChange`, entre dos objetos de estilo. Es una regla de verdad —no se
 *     puede consentir publicidad sin aceptar las condiciones— y estaba escrita
 *     donde nadie la busca;
 *   · y los **siete** campos de fecha que salen de los cinco síes, porque dos
 *     son agregados.
 *
 * Nada de eso estaba probado. Se prueba aquí, con el nombre de la regla, porque
 * la regla es lo que se pierde al tocar el formulario.
 */

import { renderHook, act } from "@testing-library/react";
import {
  useLosConsentimientosDelRegistro,
  sellosDelConsentimiento,
  LOS_CINCO,
} from "./useLosConsentimientosDelRegistro";

const TODAS = Object.keys(LOS_CINCO);

describe("quitar el legal quita los otros cuatro", () => {
  test("marcadas las cinco, se quita el legal y no queda ninguna", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());
    expect(result.current.estanLosCinco).toBe(true);

    act(() => result.current.alterna("legal"));

    expect(result.current.elegido).toEqual({
      legal: false,
      marketingEmail: false,
      marketingSms: false,
      thirdPartyEmail: false,
      thirdPartySms: false,
    });
  });

  test("y volver a marcarlo no las devuelve", () => {
    /*
     * Devolverlas sería peor: quien quitó las condiciones y las vuelve a poner
     * no ha dicho nada sobre la publicidad.
     */
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());
    act(() => result.current.alterna("legal"));
    act(() => result.current.alterna("legal"));

    expect(result.current.elegido.legal).toBe(true);
    expect(result.current.elegido.marketingEmail).toBe(false);
    expect(result.current.elegido.thirdPartySms).toBe(false);
  });

  test("pero quitar una opcional no toca a las demás", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());
    act(() => result.current.alterna("marketingSms"));

    expect(result.current.elegido.marketingSms).toBe(false);
    expect(result.current.elegido.legal).toBe(true);
    expect(result.current.elegido.marketingEmail).toBe(true);
  });
});

describe("el interruptor de arriba", () => {
  test("sin nada marcado, marca las cinco", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());

    for (const clave of TODAS) expect(result.current.elegido[clave]).toBe(true);
  });

  test("con las cinco marcadas, las quita todas", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());
    act(() => result.current.alternaLosCinco());

    for (const clave of TODAS) expect(result.current.elegido[clave]).toBe(false);
  });

  test("y con algunas marcadas, marca las que faltan", () => {
    // El interruptor estaba dibujado como apagado, así que tiene que encender.
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alterna("legal"));
    act(() => result.current.alterna("marketingEmail"));
    expect(result.current.estanLosCinco).toBe(false);

    act(() => result.current.alternaLosCinco());

    expect(result.current.estanLosCinco).toBe(true);
  });

  test("«están los cinco» es una sola cosa, no tres copias", () => {
    /*
     * Estaba escrita tres veces en diecisiete líneas, dos dentro de objetos de
     * estilo: el color y la posición del círculo podían decir una cosa y el
     * comportamiento otra.
     */
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());
    expect(result.current.estanLosCinco).toBe(false);

    act(() => result.current.alternaLosCinco());
    expect(result.current.estanLosCinco).toBe(true);

    act(() => result.current.alterna("thirdPartySms"));
    expect(result.current.estanLosCinco).toBe(false);
  });
});

describe("las fechas que van al registro", () => {
  const AHORA = "2026-09-29T10:00:00.000Z";

  test("sin nada aceptado, no va ninguna", () => {
    // El servidor las acepta a nulo, así que no puede irse una fecha inventada.
    expect(sellosDelConsentimiento({}, AHORA)).toEqual({});
  });

  test("solo el legal: una fecha, y ninguna agregada", () => {
    expect(sellosDelConsentimiento({ legal: true }, AHORA)).toEqual({
      consentLegalAt: AHORA,
    });
  });

  test("un sí de publicidad trae además el agregado que lee el ERP", () => {
    expect(sellosDelConsentimiento({ legal: true, marketingSms: true }, AHORA)).toEqual({
      consentLegalAt: AHORA,
      consentMarketingSmsAt: AHORA,
      consentMarketingAt: AHORA,
    });
  });

  test("y un sí de terceros trae el de Experian", () => {
    expect(sellosDelConsentimiento({ thirdPartyEmail: true }, AHORA)).toEqual({
      consentThirdPartyEmailAt: AHORA,
      consentExperianAt: AHORA,
    });
  });

  test("las cinco: siete campos, no cinco", () => {
    // Dos son agregados. Es fácil contar cinco y dejarse dos.
    const sellos = sellosDelConsentimiento(
      { legal: true, marketingEmail: true, marketingSms: true, thirdPartyEmail: true, thirdPartySms: true },
      AHORA
    );
    expect(Object.keys(sellos).sort()).toEqual([
      "consentExperianAt",
      "consentLegalAt",
      "consentMarketingAt",
      "consentMarketingEmailAt",
      "consentMarketingSmsAt",
      "consentThirdPartyEmailAt",
      "consentThirdPartySmsAt",
    ]);
  });

  test("y todas llevan la misma hora", () => {
    // Se consintió en un solo acto: dos horas distintas serían dos actos.
    const sellos = sellosDelConsentimiento({ legal: true, marketingEmail: true }, AHORA);
    expect(new Set(Object.values(sellos))).toEqual(new Set([AHORA]));
  });

  test("el hook las saca de lo que está marcado", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alterna("legal"));
    const sellos = result.current.sellos(AHORA);

    expect(sellos).toEqual({ consentLegalAt: AHORA });
  });
});

describe("lo que mira el formulario", () => {
  test("aceptaLasCondiciones es lo único obligatorio", () => {
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());
    expect(result.current.aceptaLasCondiciones).toBe(false);

    act(() => result.current.alterna("legal"));

    expect(result.current.aceptaLasCondiciones).toBe(true);
  });

  test("aceptaPublicidad es cualquiera de los dos, no los dos", () => {
    // Decide si las cookies se guardan como «todas» o «solo las necesarias».
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alterna("marketingSms"));

    expect(result.current.aceptaPublicidad).toBe(true);
  });

  test("y los consentimientos de terceros NO cuentan como publicidad", () => {
    /*
     * Son cosas distintas: ceder datos a terceros no es recibir publicidad
     * nuestra, y es lo que decide qué cookies se guardan.
     */
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alterna("thirdPartyEmail"));
    act(() => result.current.alterna("thirdPartySms"));

    expect(result.current.aceptaPublicidad).toBe(false);
  });
});

describe("tras registrarse", () => {
  test("no queda nada marcado", () => {
    // El siguiente que use ese navegador no hereda lo que marcó el anterior.
    const { result } = renderHook(() => useLosConsentimientosDelRegistro());

    act(() => result.current.alternaLosCinco());
    act(() => result.current.empiezaSinNada());

    for (const clave of TODAS) expect(result.current.elegido[clave]).toBe(false);
  });
});
