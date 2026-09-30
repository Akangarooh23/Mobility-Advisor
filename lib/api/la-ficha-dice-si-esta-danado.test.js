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
function unaFichaCon(vehicle, { ok = true, status } = {}) {
  const pedidas = [];
  const fetchImpl = async (url) => {
    pedidas.push(url);
    return {
      ok,
      status: status !== undefined ? status : (ok ? 200 : 500),
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

/**
 * Una ficha que ya no existe: el coche se ha vendido.
 *
 * ## Por qué hace falta
 *
 * El pool va muy por detrás del mercado. Medido sobre la base el 30 de
 * septiembre de 2026, de 1.911.806 ofertas marcadas como activas **solo el
 * 5,6% se había verificado en las últimas 24 horas**:
 *
 *     wallapop     532.107 vivas   1,1% en 24h    9,4% en 7 días
 *     milanuncios  263.260 vivas   0,1% en 24h    0,6% en 7 días
 *     cochesnet    282.161 vivas     0%           0%   (scraper parado)
 *     autoscout24  532.577 vivas   5,1% en 24h   44,0% en 7 días
 *
 * A ese ritmo Wallapop tardaría 74 días en dar una vuelta completa. Así que
 * una oferta puede llevar semanas vendida y seguir en la base como viva.
 *
 * Antes, un 404 caía en el `!respuesta.ok` y devolvía «no sé»: la oferta se
 * enseñaba igual. Se le podía recomendar a un cliente un coche vendido hacía
 * un mes, y encima el primero de la lista, porque un anuncio retirado deja de
 * bajar de precio y parece el chollo de la selección.
 *
 * ## La distinción que hace todo el trabajo
 *
 * 404 y 410 son una **respuesta**: el portal afirma que la ficha no está.
 * 403, 429 y 500 son silencio o rechazo, y no dicen nada del coche. Meterlos
 * en el mismo saco dejaría al cliente sin ofertas cada vez que un portal nos
 * echa o tiene un mal día.
 */
describe("una ficha que ya no existe", () => {
  test("un 404 dice que la oferta ya no esta", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: [] }, { ok: false, status: 404 });
    const veredicto = await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl });

    assert.equal(veredicto.existe, false);
    assert.equal(veredicto.danado, null, "no existir no es estar danado");
  });

  test("y un 410 tambien", async () => {
    const { fetchImpl } = unaFichaCon({}, { ok: false, status: 410 });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).existe, false);
  });

  test("pero un 403 no: eso es el portal echandonos", async () => {
    /*
     * Si un bloqueo contara como «vendido», bastaria que un portal nos cerrara
     * la puerta un rato para dejar al cliente sin ninguna oferta.
     */
    const { fetchImpl } = unaFichaCon({}, { ok: false, status: 403 });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).existe, null);
  });

  test("ni un 500, que es cosa suya", async () => {
    const { fetchImpl } = unaFichaCon({}, { ok: false, status: 500 });
    assert.equal((await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl })).existe, null);
  });

  test("una ficha que carga bien dice que existe", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: [] });
    const veredicto = await laFichaDiceSiEstaDanado(UNA_DE_AUTOSCOUT, { fetchImpl });

    assert.equal(veredicto.existe, true);
    assert.equal(veredicto.danado, false);
  });

  test("y una que no sabemos mirar no afirma nada", async () => {
    const { fetchImpl } = unaFichaCon({ damageConditions: [] });
    assert.equal((await laFichaDiceSiEstaDanado("https://www.coches.net/x", { fetchImpl })).existe, null);
  });
});

describe("y la vendida no llega a la pantalla", () => {
  const conUrl = (u) => ({ url: u, brand: "Seat", model: "Leon" });
  const VIVA = "https://www.autoscout24.es/anuncios/viva-1";
  const IDA = "https://www.autoscout24.es/anuncios/ida-2";

  /** Contesta 404 a una url concreta y bien a las demas. */
  function unPortalDonde(urlQueNoEsta) {
    return async (url) => ({
      ok: url !== urlQueNoEsta,
      status: url === urlQueNoEsta ? 404 : 200,
      text: async () =>
        '<html><script id="__NEXT_DATA__" type="application/json">'
        + JSON.stringify({ props: { pageProps: { listingDetails: { vehicle: { damageConditions: [] } } } } })
        + "</script></html>",
    });
  }

  test("se cae de la lista y se cuenta aparte de las danadas", async () => {
    const salida = await lasQueLaFichaNoDescarta(
      [conUrl(VIVA), conUrl(IDA)],
      { fetchImpl: unPortalDonde(IDA) }
    );

    assert.equal(salida.vendidas, 1);
    assert.equal(salida.danadas, 0, "no estaba danada, es que ya no esta");
    assert.deepEqual(salida.cumplen.map((o) => o.url), [VIVA]);
  });

  test("sin ofertas no revienta y contesta con los dos contadores", async () => {
    assert.deepEqual(await lasQueLaFichaNoDescarta([], {}), { cumplen: [], danadas: 0, vendidas: 0 });
  });
});

/**
 * El circuito tiene que aplicar el recorte, no solo contarlo.
 *
 * Esta prueba existe porque al escribir el cambio se me perdió la línea
 * `rankedInventory = trasLaFicha.cumplen` al reordenar el bloque: contaba las
 * vendidas en el registro y las enseñaba igual. Un fallo que no rompe nada y
 * no se ve en ninguna pantalla.
 */
describe("el buscador se queda con lo que devuelve el filtro", () => {
  const fs = require("node:fs");
  const fuente = fs.readFileSync(require("node:path").join(__dirname, "../../api/find-listing.js"), "utf8");

  test("asigna el resultado, no solo lo registra", () => {
    const bloque = fuente.slice(fuente.indexOf("const trasLaFicha"));
    const hasta = bloque.slice(0, bloque.indexOf("\n      }"));

    assert.match(hasta, /rankedInventory = trasLaFicha\.cumplen/);
  });

  test("y entra tambien cuando solo hay vendidas", () => {
    assert.match(fuente, /trasLaFicha\.danadas > 0 \|\| trasLaFicha\.vendidas > 0/);
  });
});
