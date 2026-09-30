/**
 * Ni una cuarta copia: el barrido que me faltaba.
 *
 * ## Lo que pasó
 *
 * Al mudar el mercado de VO dije que «meter la oferta por delante de la lista»
 * estaba escrito **dos veces** y que quedaba unificado en `metePorDelante`.
 *
 * Había una tercera, en `useAdvisorController`, dentro de
 * `openPortalVoOfferDetail`. No la vi porque busqué en `App.js` y no en los
 * hooks —el mismo descuido que me había hecho dejar `setAuthForm` con tres
 * claves en `useAuthSessionReset` dos rebanadas antes—. Y la prueba que escribí
 * entonces probaba la función nueva, no que fuera la única.
 *
 * Así que el arreglo de verdad no es quitar la tercera copia: es que la cuarta
 * no pueda entrar sin que salte algo. Eso es este fichero.
 *
 * ## Qué barre
 *
 * Los tres cuerpos que se han unificado, en `App.js` y en todos los hooks:
 * meter una oferta al principio de la lista, abrir la ficha de un coche, y
 * volver al mercado cuando un enlace no lleva a nada.
 */

const fs = require("fs");
const path = require("path");

const HOOKS = __dirname;
const APP = path.join(__dirname, "..", "App.js");

function leeApp() {
  return fs.readFileSync(APP, "utf8").replace(/\r\n/g, "\n");
}

/** `App.js` y todos los hooks que no son pruebas. */
function losFicheros({ salvo = [] } = {}) {
  const hooks = fs
    .readdirSync(HOOKS)
    .filter((n) => n.endsWith(".js") && !n.endsWith(".test.js") && !salvo.includes(n))
    .map((n) => path.join(HOOKS, n));

  return [APP, ...hooks];
}

function quienesLoEscriben(patron, opciones) {
  const culpables = [];

  for (const fichero of losFicheros(opciones)) {
    const fuente = fs.readFileSync(fichero, "utf8").replace(/\r\n/g, "\n");
    const linea = fuente.split("\n").findIndex((l) => patron.test(l));
    if (linea >= 0) culpables.push(`${path.basename(fichero)}:${linea + 1}`);
  }

  return culpables;
}

describe("meter una oferta por delante de la lista", () => {
  test("solo lo escribe `useElMercadoVo`", () => {
    /*
     * Era una línea de `setPortalVoOffersLive` con un `some` dentro. Tres copias,
     * y la tercera vivía en un hook que mi búsqueda no miraba.
     */
    const culpables = quienesLoEscriben(
      /setPortalVoOffersLive\(\(prev\)\s*=>.*some\(/,
      { salvo: ["useElMercadoVo.js"] }
    );

    expect(culpables).toEqual([]);
  });

  test("y nadie más recibe el setter de la lista", () => {
    /*
     * Es lo que hacía posible la copia: `useAdvisorController` recibía
     * `setPortalVoOffersLive` y se escribía su propia versión. Sin el setter no
     * se puede escribir otra.
     */
    const culpables = quienesLoEscriben(
      /^\s*setPortalVoOffersLive,?\s*$/,
      { salvo: ["useElMercadoVo.js"] }
    );

    expect(culpables).toEqual([]);
  });
});

describe("abrir la ficha de un coche", () => {
  test("hay dos sitios, y el segundo es a propósito", () => {
    /*
     * Eran CUATRO copias de siete líneas, y lo único que cambiaba era a dónde se
     * vuelve. El botón de volver de la ficha lee eso: con una copia mal puesta,
     * volver te saca a otra pantalla.
     *
     * A la cuarta —la de la pantalla de decisión— le faltaba además el
     * `setStep(-1)` que tenían las otras tres. NO daba error, porque ese
     * manejador solo existe dentro de una pantalla que ya exige `step === -1`:
     * era inocua por accidente. Unificada, lo es a propósito.
     *
     * El segundo sitio que queda es el efecto que lee la dirección, y NO puede
     * usar la función: la función hace `syncBrowserPath(..., "push")` y ahí la
     * dirección ya es la buena —se está reaccionando a ella—, así que apilaría
     * una entrada de historial de más y el botón de atrás dejaría de funcionar.
     */
    const veces = leeApp().split("setVehicleDetailBackTarget(").length - 1;

    expect(veces).toBe(2);
  });

  test("y la función existe y dice a dónde se vuelve", () => {
    const fuente = leeApp();

    expect(fuente).toContain("const abreLaFichaDelCoche = useCallback((oferta, volverA)");
    for (const llamada of [
      'abreLaFichaDelCoche(offer, "buscarCoche")',
      'abreLaFichaDelCoche(offer, "advice")',
      'abreLaFichaDelCoche(fullOffer, "advice")',
      'abreLaFichaDelCoche(offer, "decision")',
    ]) {
      expect(fuente).toContain(llamada);
    }
  });
});

describe("volver al mercado cuando un enlace no lleva a nada", () => {
  test("se escribe una vez y se llama cinco", () => {
    /*
     * Eran cinco copias del par `setEntryMode("portalVo"); setStep(-1);` en la
     * misma rama: sin id en la dirección, sin ficha que enseñar, y en los tres
     * sitios donde puede fallar la petición.
     */
    const fuente = leeApp();

    expect(fuente).toContain("const vuelveAlMercado = useCallback(");
    // Su definición y las cinco llamadas.
    expect(fuente.split("vuelveAlMercado").length - 1).toBeGreaterThanOrEqual(6);
  });

  test("y en el efecto de la dirección ya no queda el par a mano", () => {
    /*
     * Fuera de ese efecto sí quedan seis `setEntryMode("portalVo"); setStep(-1)`
     * más —menús, botones, el enlace de registro—, que son «ir al mercado»
     * normal y no la caída de un enlace roto.
     *
     * Van con el trabajo pendiente de darle un nombre al par, que aparece
     * OCHENTA veces en el fichero y es lo más repetido que hay en él.
     */
    const fuente = leeApp();
    const efecto = fuente.slice(
      fuente.indexOf("const pathEntryMode = resolveEntryModeFromPublicPath"),
      fuente.indexOf("if (!pathEntryMode) {")
    );

    expect(efecto.length).toBeGreaterThan(500);   // que de verdad sea el efecto
    expect(efecto).not.toMatch(/setEntryMode\("portalVo"\);\s*\n\s*setStep\(-1\);/);
  });
});

describe("y los envoltorios que no envolvían nada", () => {
  test("nadie apaga el menú móvil antes de llamar a quien ya lo apaga", () => {
    /*
     * `openPublicPage` hace `setShowHeaderMobileNav(false)` en su primera línea, y
     * cuatro funciones lo repetían justo antes de llamarla. No hacía daño; hacía
     * creer que hacía falta, que es cómo se llega a la quinta.
     */
    expect(leeApp()).not.toMatch(/setShowHeaderMobileNav\(false\);\s*\n\s*openPublicPage\(/);
  });

  test("y openPublicPage sigue apagándolo, que es quien debe", () => {
    // Si se quitara de ahí, se quedaría abierto en toda la navegación pública.
    const fuente = leeApp();
    const funcion = fuente.slice(
      fuente.indexOf("const openPublicPage = useCallback("),
      fuente.indexOf("const openInternalLandingFlow")
    );

    expect(funcion).toContain("setShowHeaderMobileNav(false)");
  });
});
