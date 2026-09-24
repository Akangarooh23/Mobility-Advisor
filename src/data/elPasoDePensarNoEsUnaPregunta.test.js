/**
 * Al terminar el test, la pantalla de «pensando» tiene que salir.
 *
 * ## Lo que pasaba
 *
 * Para que las preguntas condicionales no dejaran el índice apuntando a una que
 * ya no existe, se añadió un tope: si el índice se sale de la lista, vuelve a
 * la última. Correcto dentro del cuestionario y desastroso fuera.
 *
 * Porque `step` no solo cuenta preguntas: salta a **99** cuando el cuestionario
 * termina, y ese número es lo que enciende la pantalla de «pensando». Como 99
 * es mayor que el número de preguntas, el tope lo tomaba por un índice
 * desbordado y lo devolvía de un salto a la última pregunta.
 *
 * El efecto para quien lo usaba: pulsas «Continuar» en la última, el análisis se
 * lanza, la pantalla de «pensando» no se ve **nunca**, te quedas mirando la
 * misma pregunta como si el botón estuviera roto, y un minuto después el
 * resultado aparece **debajo** del cuestionario.
 *
 * ## Por qué esta prueba y no confiar en que no se repita
 *
 * Porque el fallo no está en el tope ni en el 99, sino en que **el mismo número
 * significa dos cosas**: un índice de la lista y una señal de «ya no estamos en
 * la lista». Eso se olvida, y la siguiente persona que toque el tope lo romperá
 * igual.
 */
import fs from "fs";
import path from "path";

const APP = fs
  .readFileSync(path.join(__dirname, "..", "App.js"), "utf8")
  .replace(/\r\n/g, "\n");

describe("el 99 no es una pregunta", () => {
  test("tiene nombre, para que se sepa lo que es", () => {
    expect(APP).toMatch(/const FUERA_DEL_CUESTIONARIO = 99;/);
  });

  test("y el tope del índice lo deja en paz", () => {
    /*
     * El tope tiene que mirar que sigamos dentro del cuestionario antes de
     * corregir nada. Sin esa comprobacion, el 99 vuelve a la ultima pregunta y
     * la pantalla de «pensando» no llega a verse.
     */
    const tope = APP.slice(
      APP.indexOf("Si la lista encoge"),
      APP.indexOf("}, [step, activeSteps.length]);")
    );

    expect(tope).toContain("FUERA_DEL_CUESTIONARIO");
    expect(tope).toMatch(/step < FUERA_DEL_CUESTIONARIO/);
  });
});

describe("y al terminar se va a pensar", () => {
  test("el analisis enciende la pantalla antes de nada", () => {
    const analiza = APP.slice(
      APP.indexOf("const analyzeWithAI = async"),
      APP.indexOf("const analyzeWithAI = async") + 260
    );

    expect(analiza).toContain("setStep(99)");
    expect(analiza).toContain("setLoading(true)");
  });

  test("y no se apaga hasta que hay ofertas", () => {
    /*
     * Se apagaba con el analisis recien hecho, y las ofertas se buscaban
     * despues: el cliente veia el resultado con un hueco donde van los coches.
     */
    const analiza = APP.slice(APP.indexOf("const analyzeWithAI = async"));
    const buscaOfertas = analiza.indexOf("await searchRealListing(null, null, { resultado: normalizedResult })");
    const apaga = analiza.indexOf("setLoading(false)");

    expect(buscaOfertas).toBeGreaterThan(0);
    expect(buscaOfertas).toBeLessThan(apaga);
  });

  test("y el resultado no se pinta antes que las ofertas", () => {
    /*
     * En cuanto `result` tiene valor, la pantalla pinta "Tu solucion de
     * movilidad optima" DEBAJO del cerebro que sigue pensando, con el hueco de
     * las ofertas vacio: las dos cosas a la vez y ninguna terminada. Por eso
     * el resultado se pone DESPUES de la busqueda.
     */
    const analiza = APP.slice(APP.indexOf("const analyzeWithAI = async"));
    const buscaOfertas = analiza.indexOf("await searchRealListing(null, null, { resultado: normalizedResult })");
    const poneElResultado = analiza.indexOf("setResult(normalizedResult)");

    expect(poneElResultado).toBeGreaterThan(0);
    expect(buscaOfertas).toBeLessThan(poneElResultado);
  });
});
