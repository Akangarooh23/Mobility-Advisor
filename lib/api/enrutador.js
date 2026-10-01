"use strict";

/**
 * Una sola puerta de entrada para las tres que hay.
 *
 * ## De dónde viene esto
 *
 * Vercel cobra por función desplegada, así que las 49 reglas de `vercel.json`
 * no apuntan a 49 ficheros: apuntan a tres —`api/market`, `api/user`,
 * `api/billing`— que miran el parámetro `route` y reparten. Es una decisión
 * correcta y no se toca.
 *
 * Lo que sí sobraba es que la mecánica del reparto estuviera escrita tres
 * veces. Los tres ficheros tenían su propio `resolveRoute` idéntico, su propia
 * llamada a `aplicaCors`, su propio `switch` de veinte casos y su propio 404.
 * Cambiar cómo se resuelve una ruta obligaba a acordarse de los tres, y no
 * acordarse no rompía nada visible: simplemente una de las tres puertas se
 * comportaba distinto que las otras dos.
 *
 * Y se nota que pasó. En `api/billing.js` el `resolveRoute` devolvía
 * `"webhook"` para una ruta que el `switch` no tenía: el webhook vive en su
 * propia función desde hace tiempo. La rama llevaba ahí sin hacer nada,
 * porque un `switch` sin ese caso cae al 404 sin quejarse.
 *
 * ## Por qué los manejadores se cargan al usarse
 *
 * `api/market.js` requería sus 24 manejadores arriba del todo. Cada uno arrastra
 * su almacén, su cliente de Postgres, su generador de PDF. Medido: **311
 * módulos y 313 ms solo en cargar el fichero**, y eso lo pagaba *cada* petición
 * a *cualquiera* de sus 23 rutas, aunque fuese la que solo devuelve una foto.
 *
 * Aquí cada ruta trae una función que hace el `require` cuando toca. Una
 * petición carga su manejador y ninguno más.
 *
 * El precio de eso es que un fallo de sintaxis en un manejador ya no revienta
 * al arrancar —revienta al pedir esa ruta, que es más tarde y más callado—.
 * Por eso existe `enrutador.test.js`: carga todos los manejadores de las tres
 * puertas y falla en las pruebas, que es antes y más ruidoso que antes.
 *
 * ## Qué NO hace
 *
 * No toca la resolución de rutas. El `?route=` explícito sigue mandando, y la
 * lista de alias sigue mirando con `includes` sobre la URL entera —incluida la
 * query—, que es exactamente lo que hacían los tres. Es frágil y está dicho en
 * el informe, pero arreglarlo cambia comportamiento y eso va aparte.
 */

const { aplicaCors } = require("../cors");

/**
 * Crea el manejador de una puerta de entrada.
 *
 * @param {Object}   opciones
 * @param {Object}   opciones.rutas   nombre de ruta -> función que devuelve el
 *                                    manejador. La función se llama al
 *                                    despachar, no al cargar: ahí está el
 *                                    ahorro. `{ price: () => require("./x") }`
 * @param {Array}    [opciones.alias] pares `[trozo de url, ruta]` en orden,
 *                                    para cuando no viene `?route=`. El orden
 *                                    importa y se respeta: gana el primero que
 *                                    encaja, igual que la cadena de `if` que
 *                                    había.
 * @param {string}   opciones.noEncontrada  el texto del 404, que es distinto en
 *                                    cada puerta y sale en los registros.
 * @param {Function} [opciones.antesDeDespachar] gancho `(ruta, req, res)` para
 *                                    lo que solo tiene una puerta -el
 *                                    interruptor de los crons-. Si devuelve
 *                                    algo, se corta ahí.
 */
function creaEnrutador({ rutas, alias = [], noEncontrada, antesDeDespachar }) {
  if (!rutas || typeof rutas !== "object") {
    throw new TypeError("creaEnrutador: hace falta el mapa de rutas");
  }
  if (!noEncontrada) {
    throw new TypeError("creaEnrutador: hace falta el texto del 404");
  }

  /*
   * Un alias que apunta a una ruta que no existe es la avería de
   * `api/billing.js`: nadie la ve porque el 404 la tapa. Se comprueba al
   * cargar, que es cuando se puede hacer algo al respecto.
   */
  for (const [trozo, ruta] of alias) {
    if (!Object.prototype.hasOwnProperty.call(rutas, ruta)) {
      throw new Error(
        `creaEnrutador: el alias "${trozo}" apunta a la ruta "${ruta}", que no existe`
      );
    }
  }

  function resuelve(req) {
    const explicita = String(req.query?.route || "").trim().toLowerCase();
    if (explicita) return explicita;

    /*
     * El camino, y solo el camino.
     *
     * Esto miraba `req.url` **entera, con la cadena de consulta dentro**, y buscaba
     * trozos con `includes`. Dos de los alias de `/api/user` son cortos —`leads` y
     * `error`—, así que una petición a
     *
     *     /api/user?email=alguien@error.com
     *
     * sin `route` se resolvía a la ruta `error`. Y se llega ahí desde fuera, porque
     * `vercel.json` tiene un `/api/(.*) → /api/$1` que sirve el fichero por su
     * nombre.
     *
     * No era un agujero de permisos —cada ruta es alcanzable por su propio camino de
     * todas formas, así que no se llegaba a nada nuevo— pero era una trampa puesta
     * para el día que alguien añadiera un alias corto a una ruta con privilegios.
     * `market.js` ya tiene `fianza-devolucion`, que lleva la clave de Stripe.
     *
     * ── Por qué esto y no exigir `?route=` ──────────────────────────────────────
     *
     * Exigirlo era mi primera idea y habría roto el desarrollo en local y con él el
     * CI: `local-api-server.js` mapea caminos directos a los manejadores
     * —`/api/leads` → `userHandler`— y no manda `route` ninguno, así que dependía de
     * esta caída. Cortar el alias al camino quita el riesgo entero sin cambiarle
     * nada a quien llama bien: los alias son trozos de camino, ninguno es un
     * parámetro.
     */
    const camino = String(req.url || "").split("?")[0].toLowerCase();
    for (const [trozo, ruta] of alias) {
      if (camino.includes(trozo)) return ruta;
    }
    return "";
  }

  async function enruta(req, res) {
    if (aplicaCors(req, res)) return undefined;

    const ruta = resuelve(req);

    if (antesDeDespachar) {
      const cortado = antesDeDespachar(ruta, req, res);
      if (cortado !== undefined) return cortado;
    }

    const trae = Object.prototype.hasOwnProperty.call(rutas, ruta) ? rutas[ruta] : null;
    if (!trae) {
      return res.status(404).json({ error: noEncontrada });
    }

    const manejador = trae();
    if (typeof manejador !== "function") {
      // Mejor caerse con el nombre de la ruta que con «manejador is not a
      // function» en un fichero que no dice cuál era.
      throw new TypeError(`La ruta "${ruta}" no ha devuelto un manejador`);
    }

    return manejador(req, res);
  }

  // Para las pruebas: qué rutas hay y cómo cargarlas, sin cargarlas.
  enruta.rutas = rutas;
  enruta.alias = alias;
  enruta.resuelve = resuelve;

  return enruta;
}

module.exports = { creaEnrutador };
