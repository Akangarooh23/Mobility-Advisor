"use strict";

/**
 * El detalle de un error no sale al navegador en producción.
 *
 * ## Por qué existe esto
 *
 * Sesenta y dos respuestas de `lib/` y `api/` metían el mensaje del error en el cuerpo.
 * Y no es teórico: el 1 de octubre, recorriendo el camino de compra con la aplicación en
 * marcha, una petición que cualquiera puede hacer devolvía
 *
 *     GET /api/search-offers?brand=Audi
 *     500  {"ok":false,"error":"operator does not exist: text = integer"}
 *
 * Un error de Postgres lleva dentro nombres de columna y de tabla —medido contra la base
 * que corre—. No es una fuga de datos: el valor va en `.detail` y nadie lo devuelve. Lo
 * que de verdad se nota es que **un 500 con jerga de Postgres es lo que lee un cliente**
 * en vez de «no hemos podido buscar».
 *
 * ## Qué se fija aquí
 *
 * Las dos mitades del ayudante —que en producción no salga nada y que el error quede
 * apuntado— y un techo de los sitios que quedan sin convertir, para que solo pueda bajar.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { elDetalle, elDetalleSoloFuera, enProduccion, elTexto } = require("./el-detalle-no-sale");

const RAIZ = path.join(__dirname, "..");

describe("en producción no sale el detalle", () => {
  const ERR = new Error('relation "moveadvisor_market_offers" does not exist');

  test("el mensaje del error no viaja, y lo que viaja es para leer", () => {
    for (const entorno of [{ NODE_ENV: "production" }, { VERCEL: "1" }, { NODE_ENV: "production", VERCEL: "1" }]) {
      const texto = elDetalle(ERR, "prueba", {}, entorno);
      assert.ok(!texto.includes("relation"), `se ha colado el mensaje: ${texto}`);
      assert.ok(!texto.includes("moveadvisor_market_offers"), "se ha colado un nombre de tabla");
      assert.match(texto, /Vuelve a intentarlo/, "y tiene que decirle a la persona qué hacer");
    }
  });

  test("fuera de producción sí sale, porque quien lo ve es quien lo arregla", () => {
    const texto = elDetalle(ERR, "prueba", {}, { NODE_ENV: "development" });
    assert.match(texto, /relation "moveadvisor_market_offers" does not exist/);
  });

  test("y `elDetalleSoloFuera` hace que la clave desaparezca del JSON", () => {
    /*
     * Es la diferencia con devolver una cadena vacía. Esos sitios ya tienen un código
     * estable —`{ error: "db_error", detail: … }`— y el navegador lo trata; lo único que
     * sobra es el detalle. Con `undefined`, `JSON.stringify` se come la clave y la
     * respuesta queda exactamente igual que si nunca hubiera estado.
     */
    const enProd = { error: "db_error", detail: elDetalleSoloFuera(ERR, "p", {}, { VERCEL: "1" }) };
    assert.equal(JSON.stringify(enProd), '{"error":"db_error"}');

    const enDev = { error: "db_error", detail: elDetalleSoloFuera(ERR, "p", {}, {}) };
    assert.match(JSON.stringify(enDev), /relation/);
  });

  test("no revienta con lo que no es un Error", () => {
    /*
     * Un `catch` recoge lo que le echen. Si esto levantara, convertiría un 500 con un
     * mensaje feo en un 500 sin respuesta ninguna, que es peor.
     */
    for (const basura of [null, undefined, "una cadena", 42, { message: "un objeto" }, []]) {
      const texto = elDetalle(basura, "prueba", {}, { NODE_ENV: "production" });
      assert.equal(typeof texto, "string");
      assert.ok(texto.length > 0);
    }
    assert.equal(elTexto({ message: "un objeto" }), "un objeto");
  });

  test("y el entorno se detecta igual que en el resto del proyecto", () => {
    // La misma regla que `api/identidad.js`: Vercel, o un NODE_ENV que lo diga.
    assert.equal(enProduccion({ NODE_ENV: "production" }), true);
    assert.equal(enProduccion({ VERCEL: "1" }), true);
    assert.equal(enProduccion({}), false);
    assert.equal(enProduccion({ NODE_ENV: "test" }), false);
  });
});

describe("y el error queda apuntado, que antes no quedaba en ninguna parte", () => {
  test("`elDetalle` pasa por `registra`", () => {
    /*
     * Ésta es la mitad que se olvida. Antes el mensaje viajaba al navegador y **no se
     * guardaba**: en cuanto el cliente cerraba la pestaña, se había perdido. Ahora el
     * cliente recibe un texto genérico y el detalle va a `moveadvisor_errores`, donde el
     * aviso horario lo cuenta.
     *
     * Se comprueba por el código y no interceptando `registra`, porque lo que importa es
     * que la llamada esté: si alguien la quita para «simplificar», esto se pone rojo.
     */
    const fuente = fs.readFileSync(path.join(__dirname, "el-detalle-no-sale.js"), "utf8");
    assert.match(fuente, /require\(["']\.\/registra["']\)/, "tiene que usar registra()");

    for (const fn of ["function elDetalle(", "function elDetalleSoloFuera("]) {
      const i = fuente.indexOf(fn);
      assert.ok(i > 0, `no encuentro ${fn}`);
      const cuerpo = fuente.slice(i, fuente.indexOf("\n}", i));
      assert.match(cuerpo, /registra\(/, `${fn} tiene que apuntar el error`);
      // Y que un fallo al apuntar no tumbe la respuesta.
      assert.match(cuerpo, /try\s*\{/, `${fn}: registra() va dentro de un try`);
    }
  });
});

describe("el techo de los que quedan sin convertir", () => {
  test("no sube de 26", () => {
    /*
     * Un techo que solo puede bajar, como los otros trinquetes del proyecto.
     *
     * Eran **62**, y van 36:
     *
     *  - 18 de `visit-availability-handler` y 5 de `viewing-handler`: los dos caminos de
     *    las citas.
     *  - 7 que ya tenían código estable y solo les faltaba tapar el `detail`
     *    —`invoice-pdf`, `storage-presign`, `user-alerts`, `user-erp-appointments`,
     *    `compare-cars`, `cron-appointment-reminders`—.
     *  - 6 de `marketplace-vo-handler`: el escaparate, las tres fichas, el contador de
     *    visitas y el listado.
     *
     * **Quedan 26, y seis de ellas son legítimas**: `billing-checkout-handler` (×3),
     * `fianza-confirmar` y `fianza-devolucion` devuelven el mensaje de **Stripe**, que
     * está escrito para que lo lea una persona —«tu tarjeta ha sido rechazada»— y
     * convertirlo en un código sería una regresión.
     *
     * Por eso es un techo y no un cero: el que falte hay que mirarlo uno a uno, y el 27
     * habrá que justificarlo.
     */
    const TECHO = 26;
    const sitios = [];

    const recorre = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!["node_modules", "build", "dist"].includes(e.name)) recorre(p);
          continue;
        }
        if (!e.name.endsWith(".js") || /\.test\./.test(e.name)) continue;
        const texto = fs.readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
          .replace(/^(\s*)\/\/.*$/gm, (_l, b) => b);
        const re = /res\s*(?:\.status\([^)]*\))?\s*\.json\(\s*\{[^;]{0,400}?\.message/g;
        for (const m of texto.matchAll(re)) {
          sitios.push(`${path.relative(RAIZ, p)}:${texto.slice(0, m.index).split("\n").length}`);
        }
      }
    };
    recorre(path.join(RAIZ, "lib"));
    recorre(path.join(RAIZ, "api"));

    assert.ok(
      sitios.length <= TECHO,
      `había ${TECHO} respuestas con el mensaje del error dentro y ahora hay ${sitios.length}. ` +
        `Si el nuevo viene de Stripe o de un error propio escrito para leer, baja el techo y di por qué; ` +
        `si viene de lo que caiga, usa elDetalle().\n  ${sitios.join("\n  ")}`
    );
  });

  test("y los ficheros convertidos están limpios", () => {
    /*
     * Lo de arriba es un techo global y se puede cumplir sin arreglar nada: basta no
     * añadir. Esto fija que lo ya convertido **no vuelva atrás**, que es lo que de verdad
     * se ha hecho.
     *
     * `marketplace-vo-handler` entra aquí porque es el manejador público del marketplace
     * —el escaparate de la portada, las fichas, el contador— y es el que más tráfico sin
     * sesión tiene de todo el repositorio.
     */
    for (const f of [
      "lib/api/visit-availability-handler.js",
      "lib/api/viewing-handler.js",
      "lib/api/marketplace-vo-handler.js",
    ]) {
      const texto = fs.readFileSync(path.join(RAIZ, f), "utf8");
      const re = /res\s*(?:\.status\([^)]*\))?\s*\.json\(\s*\{[^;]{0,400}?\.message/g;
      const n = [...texto.matchAll(re)].length;
      assert.equal(n, 0, `${f} ha vuelto a meter el mensaje del error en ${n} respuesta(s)`);
    }
  });
});
