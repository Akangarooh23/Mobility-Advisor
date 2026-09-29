/**
 * Antes de enseñar una oferta, se mira su ficha por si declara daños.
 *
 * ## Por qué bajo demanda
 *
 * El dato solo está en la ficha de cada anuncio: una petición por coche.
 * Enriquecer el pool entero, medido con el proceso que ya existe, son 2.000 al
 * día contra 368.000 ofertas activas — **seis meses** para la primera vuelta, y
 * solo del 19% del mercado español:
 *
 *     276.113  21%  coches.net    con dato de daño: 0
 *     253.109  20%  milanuncios   con dato de daño: 0
 *     251.173  19%  autoscout24   con dato de daño: 4.900
 *     213.876  17%  wallapop      con dato de daño: 0
 *     197.480  15%  autocasion    con dato de daño: 0
 *
 * Pero el consejero no enseña 1,6 millones de coches: enseña tres o cuatro.
 * Mirar la ficha de esos cuatro son cuatro peticiones.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  laFichaDiceSiEstaDanado,
  lasQueLaFichaNoDescarta,
  sabemosMirarla,
} = require("../la-ficha-dice-si-esta-danado");

/** Una ficha de mentira, con el JSON donde lo pone el portal. */
function unaFichaCon(vehicle, { ok = true } = {}) {
  const pedidas = [];
  const fetchImpl = async (url) => {
    pedidas.push(url);
    return {
      ok,
      text: async () =>
        '<html><script id="__NEXT_DATA__" type="application/json">'
        + JSON.stringify({ props: { pageProps: { listingDetails: { vehicle } } } })
        + "</script></html>",
    };
  };
  return { fetchImpl, pedidas };
}

const UNA_DE_AUTOSCOUT = "https://www.autoscout24.es/anuncios/abc-123";

describe("solo se piden fichas que sabemos leer", () => {
  test("autoscout24, en cualquier pais", () => {
    assert.equal(sabemosMirarla("https://www.autoscout24.es/anuncios/x"), true);
    // Los importados vienen del aleman, y son los que mas problema dan.
    assert.equal(sabemosMirarla("https://www.autoscout24.de/angebote/x"), true);
  });

  test("y ningun otro portal", () => {
    for (const u of [
      "https://www.coches.net/x",
      "https://www.milanuncios.com/x",
      "https://es.wallapop.com/x",
      "https://www.autocasion.com/x",
    ]) {
      assert.equal(sabemosMirarla(u), false, u);
    }
  });

  test("y un dominio que solo LO CONTIENE, tampoco", () => {
    /*
     * `autoscout24.es.falso.com` es un dominio cualquiera. Pasaba con la
     * primera version del filtro, y eso es ir a pedirle una pagina a un
     * tercero creyendo que es el portal.
     */
    assert.equal(sabemosMirarla("https://autoscout24.es.falso.com/x"), false);
    assert.equal(sabemosMirarla("https://falsoautoscout24.es/x"), false);
  });

  test("a un portal desconocido ni se le llama", async () => {
    const { fetchImpl, pedidas } = unaFichaCon({ damageConditions: ["Dañado"] });

    const veredicto = await laFichaDiceSiEstaDanado("https://www.coches.net/x", { fetchImpl });

    assert.equal(veredicto.danado, null);
    assert.equal(pedidas.length, 0);
  });
});

describe("lo que dice la ficha", () => {
  test("con daños declarados, danado", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: ["Dañado"] });
    const veredicto = await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl });

    assert.equal(veredicto.danado, true);
    assert.equal(veredicto.nota, "Dañado");
  });

  test("con la lista vacia, NO danado", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: [] });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, false);
  });

  test("y si ha tenido un accidente, tambien cuenta", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: [], hadAccident: true });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, true);
  });

  test("si el campo NO viene, no se sabe", async () => {
    /*
     * Que no lo diga no es que este sano. La diferencia importa: con `false`
     * se estaria afirmando algo que la ficha no dice.
     */
    const { fetchImpl } = unaFichaCon({ make: "Audi" });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, null);
  });
});

describe("y si la ficha no contesta, la oferta sale", () => {
  test("con un error del portal", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: ["Dañado"] }, { ok: false });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, null);
  });

  test("si revienta la peticion", async () => {
    const fetchImpl = async () => { throw new Error("se ha caido"); };
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, null);
  });

  test("y si la pagina no trae el JSON", async () => {
    const fetchImpl = async () => ({ ok: true, text: async () => "<html>una pagina cualquiera</html>" });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).danado, null);
  });
});

describe("las que salen a pantalla", () => {
  const oferta = (url) => ({ url, brand: "Audi", model: "A4" });

  test("se quita la que la ficha declara danada, y solo esa", async () => {
    const danada = oferta("https://www.autoscout24.es/anuncios/danada");
    const sana = oferta("https://www.autoscout24.es/anuncios/sana");
    const deOtroPortal = oferta("https://www.coches.net/x");

    const fetchImpl = async (url) => ({
      ok: true,
      text: async () => '<script id="__NEXT_DATA__" type="application/json">'
        + JSON.stringify({
          props: { pageProps: { listingDetails: { vehicle: {
            damageConditions: /danada/.test(url) ? ["Dañado"] : [],
          } } } },
        })
        + "</script>",
    });

    const salida = await lasQueLaFichaNoDescarta([danada, sana, deOtroPortal], { fetchImpl });

    assert.equal(salida.danadas, 1);
    assert.deepEqual(salida.cumplen, [sana, deOtroPortal]);
  });

  test("sin ofertas no se pide nada", async () => {
    let llamadas = 0;
    const fetchImpl = async () => { llamadas += 1; return { ok: false }; };

    const salida = await lasQueLaFichaNoDescarta([], { fetchImpl });

    assert.deepEqual(salida.cumplen, []);
    assert.equal(llamadas, 0);
  });

  test("y el circuito lo hace justo antes de devolverlas", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");

    assert.match(fuente, /const trasLaFicha = await lasQueLaFichaNoDescarta\(rankedInventory\)/);
    assert.ok(
      fuente.indexOf("const trasLaFicha = await lasQueLaFichaNoDescarta(")
        < fuente.indexOf("        listing: rankedInventory[0] || null,"),
      "se mira la ficha despues de devolver las ofertas, que ya no sirve"
    );
  });
});
