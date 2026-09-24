/**
 * El cerebro no se apaga con el hueco de las ofertas vacío.
 *
 * ## Lo que vio Ana
 *
 * El cerebro terminaba de pensar, aparecía «Tu solución de movilidad óptima»
 * y debajo el recuadro de las ofertas **vacío**, con su texto de presentación
 * y ningún coche. Ni un aviso.
 *
 * ## Por qué pasaba, con los números
 *
 * El navegador cortaba la búsqueda a los **240 segundos** y la función de
 * Vercel tiene **300**. Una búsqueda con los siete criterios contestados tarda
 * **253 segundos** medidos contra producción: el navegador tiraba a la basura
 * una respuesta que iba a llegar trece segundos después.
 *
 * Y aquí se daba por buena igual. El `catch` se tragaba el fallo, se apagaba el
 * cerebro y se enseñaba el resultado sin los coches, que es enseñar la mitad
 * del trabajo.
 *
 * ## Las dos cosas que lo arreglan
 *
 * Que el navegador espere a que conteste la función —quien corta es siempre
 * ella, que sabe contestar lo que haya encontrado, y nunca el navegador, que
 * solo sabe tirar la respuesta— y que si aun así no hay ofertas se vuelva a
 * intentar sin apagar el cerebro.
 */
import fs from "fs";
import path from "path";

const APP = fs
  .readFileSync(path.join(__dirname, "..", "App.js"), "utf8")
  .replace(/\r\n/g, "\n");

describe("el navegador espera a la función", () => {
  test("el corte tiene nombre y no es un número suelto", () => {
    expect(APP).toMatch(/const LO_QUE_ESPERA_EL_NAVEGADOR_MS = \d+;/);
  });

  test("y espera menos que el tope de la función, pero no mucho menos", () => {
    /*
     * El tope de la funcion son 300 s (vercel.json). El navegador tiene que
     * quedarse por debajo -si no, corta el la respuesta que ya viene- pero lo
     * bastante cerca como para que una busqueda de 253 s termine.
     */
    const ms = Number(APP.match(/const LO_QUE_ESPERA_EL_NAVEGADOR_MS = (\d+);/)[1]);

    expect(ms).toBeLessThan(300000);
    expect(ms).toBeGreaterThan(260000);
  });

  test("y es lo que usa el abort, no otro número escrito a mano", () => {
    expect(APP).toContain("controller.abort(), LO_QUE_ESPERA_EL_NAVEGADOR_MS");
  });
});

describe("y si no hay ofertas, sigue pensando", () => {
  test("la búsqueda dice cuántas ha traído", () => {
    /*
     * No devolvia nada, asi que quien la llamaba no podia distinguir entre
     * «hay tres ofertas» y «hay un hueco»: apagaba el cerebro igual.
     */
    const desde = APP.indexOf("const searchRealListing = useCallback");
    const busca = APP.slice(desde, APP.indexOf("useListingQuickValidationRefresh({", desde));

    expect(busca).toContain("return visibleListings;");
  });

  test("se intenta más de una vez antes de enseñar el resultado", () => {
    const veces = Number(APP.match(/const LOS_INTENTOS_DE_BUSQUEDA = (\d+);/)[1]);
    expect(veces).toBeGreaterThan(1);
  });

  test("y el bucle para en cuanto hay ofertas", () => {
    const analiza = APP.slice(APP.indexOf("const analyzeWithAI = async"));
    const bucle = analiza.slice(
      analiza.indexOf("for (let intento = 1"),
      analiza.indexOf("setResultView(\"analysis\")")
    );

    expect(bucle).toContain("LOS_INTENTOS_DE_BUSQUEDA");
    expect(bucle).toMatch(/if \(ofertas\.length > 0\) \{\s*break;/);
  });

  test("y el resultado sigue pintándose después de la búsqueda", () => {
    /*
     * Lo de siempre: en cuanto `result` tiene valor la pantalla pinta el
     * resultado DEBAJO del cerebro que aun piensa. Ver
     * elPasoDePensarNoEsUnaPregunta.test.js.
     */
    const analiza = APP.slice(APP.indexOf("const analyzeWithAI = async"));

    expect(analiza.indexOf("for (let intento = 1"))
      .toBeLessThan(analiza.indexOf("setResult(normalizedResult)"));
  });
});

/**
 * Y por qué no hay ofertas, cuando no las hay.
 *
 * Ana volvió a ver la pantalla del resultado con el recuadro de las ofertas
 * vacío, esta vez **sin ningún aviso**: solo el texto de bienvenida rellenando
 * el hueco. La búsqueda había terminado bien y había devuelto cero.
 *
 * Y no es que no supiéramos por qué. La API lo explicaba desde hacía horas
 * —«no hay ninguna oferta que cumpla lo que pediste: las que hay tienen más
 * kilómetros de los que pusiste»— y `searchRealListing` **no leía ese campo de
 * la respuesta**. El mensaje moría ahí.
 */
describe("el porqué llega a la pantalla", () => {
  test("la búsqueda lee el mensaje de la respuesta", () => {
    expect(APP).toContain("setListingInsight(data?.filterInsight || null)");
  });

  test("y se limpia al empezar otra, para no dejar el de antes", () => {
    const busca = APP.slice(APP.indexOf("const searchRealListing = useCallback"));
    const limpia = busca.indexOf("setListingInsight(null)");
    const guarda = busca.indexOf("setListingInsight(data?.filterInsight");

    expect(limpia).toBeGreaterThan(0);
    expect(limpia).toBeLessThan(guarda);
  });

  test("y llega a la vista de ofertas", () => {
    expect(APP).toContain("listingInsight={listingInsight}");
  });
});
