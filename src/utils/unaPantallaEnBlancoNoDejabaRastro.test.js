/**
 * Una pantalla en blanco no dejaba rastro.
 *
 * ## Qué no se veía
 *
 * Todo el seguimiento de errores que hay vive del lado del servidor. Así que si a
 * alguien se le quedaba la web **en blanco** en su móvil —un error de JavaScript
 * en una pantalla concreta, con un coche concreto— no se enteraba nadie.
 *
 * Y es el fallo más caro que hay precisamente por eso: no hay un 500 en los
 * registros, no hay una petición fallida, no hay nada. Solo alguien que se va y no
 * escribe.
 *
 * ## Lo que se prueba
 *
 * Sobre todo que esto no sea parte del problema. Un avisador de fallos mal hecho
 * es peor que ninguno: manda miles de peticiones desde el móvil de alguien que ya
 * está teniendo un mal rato, o lanza su propio error encima del que iba a contar.
 */

import {
  avisaDeUnFallo,
  enganchaLosAvisos,
  elContextoLoDa,
  olvidaLoMandado,
  TOPE_POR_SESION,
} from "./avisaDeLosFallos";

/** Lo que se ha mandado al endpoint. */
function loMandado() {
  return global.fetch.mock.calls.map(([, opciones]) => JSON.parse(opciones.body));
}

beforeEach(() => {
  olvidaLoMandado();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe("lo que manda", () => {
  test("el sitio, el mensaje y la dirección", () => {
    avisaDeUnFallo("navegador: promesa sin recoger", new Error("la API no contesta"));

    const [paquete] = loMandado();
    expect(paquete.donde).toBe("navegador: promesa sin recoger");
    expect(paquete.mensaje).toBe("la API no contesta");
    expect(paquete.direccion).toContain("http");
  });

  test("y la pantalla y quién era, que es lo que de verdad sirve", () => {
    /*
     * La pila vendrá ilegible —el JavaScript de producción está minificado, así que
     * en vez de `abreLaFichaDelCoche` se verá `a.b is not a function en
     * chunk.js:1:48219`—. Esto es lo que dice dónde mirar.
     */
    elContextoLoDa(() => ({
      pantalla: "portalVoDetail",
      quien: "ana@popcar.es",
      contexto: { step: -1 },
    }));

    avisaDeUnFallo("navegador: error sin recoger", new Error("uy"));

    const [paquete] = loMandado();
    expect(paquete.pantalla).toBe("portalVoDetail");
    expect(paquete.quien).toBe("ana@popcar.es");
    expect(paquete.contexto.step).toBe(-1);
  });

  test("unas pocas líneas de la pila, no todas", () => {
    // La pila entera de un bundle son cuarenta líneas de chunks.
    const error = new Error("uy");
    error.stack = Array.from({ length: 40 }, (_, n) => `  en algo${n}`).join("\n");

    avisaDeUnFallo("algo", error);

    expect(loMandado()[0].pila.split("\n").length).toBeLessThanOrEqual(8);
  });

  test("y con keepalive, que es lo que hace que sirva", () => {
    /*
     * Quien ve una pantalla en blanco cierra la pestaña. Sin `keepalive` el
     * navegador cancela la petición a medias y el fallo se pierde justo en el caso
     * que más importa.
     */
    avisaDeUnFallo("algo", new Error("uy"));

    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.keepalive).toBe(true);
    expect(opciones.method).toBe("POST");
  });
});

describe("no se convierte en el problema", () => {
  test("no manda dos veces lo mismo", () => {
    /*
     * Un error dentro de un `useEffect` se repite en cada renderizado. Sin esto, un
     * solo móvil mandaría miles de peticiones.
     */
    for (let n = 0; n < 50; n += 1) {
      avisaDeUnFallo("navegador: error sin recoger", new Error("el mismo"));
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("pero sí manda los distintos", () => {
    avisaDeUnFallo("algo", new Error("uno"));
    avisaDeUnFallo("algo", new Error("otro"));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("y el mismo mensaje desde otro sitio es otro fallo", () => {
    avisaDeUnFallo("al abrir la ficha", new Error("la API no contesta"));
    avisaDeUnFallo("al guardar el coche", new Error("la API no contesta"));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("y calla al llegar al tope de la sesión", () => {
    /*
     * Cuando algo se rompe de verdad se rompe en cascada. Diez por sesión bastan
     * para saber qué pasó; cien son ruido y peso.
     */
    for (let n = 0; n < TOPE_POR_SESION + 20; n += 1) {
      avisaDeUnFallo("algo", new Error(`distinto ${n}`));
    }

    expect(global.fetch).toHaveBeenCalledTimes(TOPE_POR_SESION);
  });

  test("dice si mandó o si calló", () => {
    expect(avisaDeUnFallo("algo", new Error("uno"))).toBe(true);
    expect(avisaDeUnFallo("algo", new Error("uno"))).toBe(false);
  });
});

describe("nunca deja dos errores donde había uno", () => {
  test("si el envío falla, no se propaga", async () => {
    /*
     * Puede ser la propia API la que está caída, que es justo cuando más fallos
     * hay que contar.
     */
    global.fetch = jest.fn().mockRejectedValue(new Error("sin red"));

    expect(() => avisaDeUnFallo("algo", new Error("uy"))).not.toThrow();
    // Y la promesa rechazada queda recogida, no como «unhandled rejection».
    await Promise.resolve();
  });

  test("ni si el contexto que da la aplicación se cae", () => {
    // Lo da un `useCallback` de `App`, que lee estado que puede no estar.
    elContextoLoDa(() => { throw new Error("el estado no está"); });

    expect(() => avisaDeUnFallo("algo", new Error("uy"))).not.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("ni con un error que no es un Error", () => {
    for (const cosa of [null, undefined, "una cadena", 42, { a: 1 }]) {
      expect(() => avisaDeUnFallo("algo", cosa)).not.toThrow();
    }
  });

  test("ni con un contexto que no se puede serializar", () => {
    const circular = {};
    circular.yo = circular;
    elContextoLoDa(() => ({ contexto: circular }));

    expect(() => avisaDeUnFallo("algo", new Error("uy"))).not.toThrow();
  });
});

describe("los dos sitios por donde se escapa un error", () => {
  test("lo que se lanza y nadie recoge", () => {
    const desengancha = enganchaLosAvisos();

    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("explotó"), filename: "chunk.js", lineno: 1 })
    );

    const [paquete] = loMandado();
    expect(paquete.donde).toBe("navegador: error sin recoger");
    expect(paquete.mensaje).toBe("explotó");
    expect(paquete.contexto.fichero).toBe("chunk.js");
    desengancha();
  });

  test("y una promesa que falla sin catch, que es el caso común aquí", () => {
    /*
     * Casi todo lo que hace la web es pedir algo, así que esto es lo que más se
     * escapa.
     */
    const desengancha = enganchaLosAvisos();

    const evento = new Event("unhandledrejection");
    evento.reason = new Error("la API no contesta");
    window.dispatchEvent(evento);

    const [paquete] = loMandado();
    expect(paquete.donde).toBe("navegador: promesa sin recoger");
    expect(paquete.mensaje).toBe("la API no contesta");
    desengancha();
  });

  test("y desenganchar deja de escuchar de verdad", () => {
    /*
     * El efecto que lo instala tiene que poder limpiarse, o en desarrollo se
     * engancha dos veces y todo se manda doble.
     *
     * Se comprueba con la promesa y no con el error porque jsdom trata cualquier
     * evento `error` sobre `window` como un error no capturado y lo relanza: el
     * error de mentira de la prueba haría fallar a la prueba misma. Los dos
     * oyentes los quita la misma función, así que comprobar uno vale.
     */
    const desengancha = enganchaLosAvisos();
    desengancha();

    const evento = new Event("unhandledrejection");
    evento.reason = new Error("la API no contesta");
    window.dispatchEvent(evento);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
