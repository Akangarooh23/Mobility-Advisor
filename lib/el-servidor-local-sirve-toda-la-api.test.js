"use strict";

/**
 * El servidor de desarrollo sirve toda la API, no la mitad.
 *
 * ## Lo que pasaba
 *
 * `local-api-server.js` tenía su mapa de rutas **escrito a mano** y `vercel.json` tiene
 * 49 reescrituras. Medido el 1-oct-2026, pidiendo las 42 rutas concretas una a una:
 *
 *     la conocen: 21    no la conocen: 21
 *
 * **La mitad de la API no existía en desarrollo.** Entre las que faltaban:
 *
 *  - `/api/error`, el recogedor de fallos del navegador. En local no grababa nada.
 *  - `/api/invoice-pdf`, las facturas.
 *  - `/api/fianza-devolucion` y `/api/fianza-confirmar`, el pago de la fianza.
 *  - `/api/mandato-firmado`, `/api/papeles-venta`, `/api/clausula-precio`: los papeles
 *    de la venta.
 *  - `/api/whatsapp`, `/api/ping`, `/api/cita-taller` y los seis crons.
 *
 * ## Por qué esto es un hallazgo y no una incomodidad
 *
 * Porque es la razón de que **nadie recorriera esos caminos nunca**. Y el día que se
 * recorrieron —arrancando la aplicación, que es la capa 5— apareció que **cualquier
 * filtro de la búsqueda devolvía un 500 en producción** (§34.1): un fallo que dieciocho
 * clases de defecto, el lint, los tipos y 1.765 pruebas no habían visto.
 *
 * Un servidor de desarrollo que no sirve la mitad de la API es un servidor que
 * garantiza que no se pruebe la mitad de la aplicación.
 *
 * ## Qué fija esta prueba
 *
 * Que cada reescritura concreta de `vercel.json` llegue a un manejador. No que
 * funcione —eso es de cada manejador— sino que **exista el camino**. Si alguien añade
 * una reescritura y el servidor local no la sirve, esto se pone rojo aquí y no dentro
 * de seis meses, cuando alguien intente probar ese camino y crea que está roto.
 *
 * Se importa `local-api-server.js` de verdad, no una copia de su lógica. Para eso lleva
 * su `require.main === module`: importarlo no levanta ningún servidor.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const { REESCRITURAS, reescrituraDe, handlers } = require("../local-api-server");
const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));

/** Las reescrituras que un navegador pide tal cual: sin comodines ni parámetros. */
function lasConcretas() {
  return (vercel.rewrites || [])
    .map((r) => String(r.source || ""))
    .filter((s) => s.startsWith("/api/"))
    .filter((s) => !s.includes("(") && !s.includes(":"));
}

describe("toda reescritura de vercel.json llega a un manejador en local", () => {
  test("ninguna se queda sin camino", () => {
    const huerfanas = lasConcretas().filter((s) => !handlers[s] && !REESCRITURAS.has(s));
    assert.deepEqual(
      huerfanas,
      [],
      "estas rutas existen en vercel.json y el servidor local no las sirve, " +
        "así que no se pueden probar en desarrollo:\n  " + huerfanas.join("\n  ")
    );
  });

  test("y son las 42 que hay, no menos", () => {
    /*
     * Un suelo, no un techo: si mañana hay 45 reescrituras la prueba de arriba las
     * cubre, pero si alguien **borra** rutas de `vercel.json` y este número baja, hay
     * que mirarlo. Cuarenta y dos es lo que había el 1 de octubre.
     */
    assert.ok(
      lasConcretas().length >= 42,
      `había 42 rutas concretas y ahora hay ${lasConcretas().length}. Si se han quitado a propósito, baja el suelo y di por qué.`
    );
  });

  test("el fichero de destino de cada reescritura existe", () => {
    /*
     * Una reescritura que apunta a un fichero que no está es un 404 que nadie entiende.
     * Y esto ya pasó en este proyecto: `api/billing.js` tenía un alias apuntando a una
     * ruta inexistente y el 404 lo tapaba —está en §12.4—.
     */
    const faltan = [];
    for (const [origen, r] of REESCRITURAS) {
      const destino = path.join(RAIZ, "api", `${r.fichero}.js`);
      if (!fs.existsSync(destino)) faltan.push(`${origen} -> api/${r.fichero}.js`);
    }
    assert.deepEqual(faltan, [], "reescrituras que apuntan a un fichero que no existe:\n  " + faltan.join("\n  "));
  });

  test("y el `route` del destino se traslada a la consulta", () => {
    /*
     * Es la mitad del trabajo y la que se puede olvidar: Vercel traduce
     * `/api/viewing-get` a `/api/user?route=viewing-get`, y sin ese `route` el
     * enrutador de `api/user.js` contesta su propio 404 —que es lo que pasaba antes y
     * lo que hizo que yo creyera que `viewing-get` estaba roto en producción—.
     */
    const r = reescrituraDe("/api/viewing-get");
    assert.ok(r, "/api/viewing-get tendría que resolverse");
    assert.equal(r.query.route, "viewing-get");

    const f = reescrituraDe("/api/fianza-devolucion");
    assert.ok(f, "/api/fianza-devolucion tendría que resolverse");
    assert.equal(f.query.route, "fianza-devolucion");
  });

  test("y las que llevan comodín se dejan en paz, a propósito", () => {
    /*
     * `/api/(.*)` y las de `:vehicleId` las sirve Vercel con su propia semántica.
     * Imitarla a medias sería peor que no servirlas: un servidor de desarrollo que
     * enruta *parecido* a producción es más peligroso que uno que dice «no la tengo».
     */
    for (const [origen] of REESCRITURAS) {
      assert.ok(!origen.includes("("), `no debería haber comodines en el mapa: ${origen}`);
      assert.ok(!origen.includes(":"), `no debería haber parámetros en el mapa: ${origen}`);
    }
  });
});
