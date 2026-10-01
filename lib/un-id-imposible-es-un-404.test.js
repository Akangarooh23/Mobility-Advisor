"use strict";

/**
 * Un identificador imposible es un 404, no un 500.
 *
 * ## Cómo se encontró
 *
 * Ejecutando, no leyendo. Después de convertir las fugas de `.message`, comprobé contra
 * producción que las rutas de citas seguían bien, y salió esto:
 *
 *     ?route=propuesta&bookingId=00000000-0000-0000-0000-000000000000  ->  404 «Cita no encontrada»
 *     ?route=propuesta&bookingId=noesuuid                              ->  500
 *
 * El 404 ya estaba tratado —`if (e.message === "not_found")`— pero solo para «no hay
 * ninguna fila». Un identificador que no se puede ni convertir al tipo de la columna no
 * llega ahí: revienta en el cast, dentro de Postgres, con el código `22P02`.
 *
 * ## Por qué importa
 *
 * Porque esas rutas son **las que abre el enlace del correo**. Un enlace que el cliente
 * de correo ha cortado por la mitad contestaba «no hemos podido completarlo, vuelve a
 * intentarlo» —o sea «vuelve a probar»— por algo que no va a funcionar nunca.
 *
 * ## Mi primer arreglo estaba mal, y lo dijeron 71 pruebas
 *
 * Validaba que el `bookingId` tuviera forma de UUID antes de consultar. Puso rojas 71
 * pruebas y el rojo tenía razón: esa comprobación **asume que la columna es `uuid`**, y
 * en esta misma base `vehicle_visit_bookings.id` es `uuid` pero
 * **`vehicle_visit_requests.id` es `text`**. Una validación de forma en la capa HTTP se
 * queda mintiendo en cuanto una tabla cambia de tipo, y nadie se enteraría.
 *
 * Mirar el código de error no asume nada: lo dice Postgres, que es quien sabe de qué
 * tipo es cada columna.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { elFallo, noPuedeExistir } = require("./el-detalle-no-sale");

/** Un `res` de mentira que apunta el código y el cuerpo. */
function elRes() {
  const r = { code: 0, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return b; };
  return r;
}

const PROD = { VERCEL: "1" };

describe("se distingue «no puede existir» de «algo se ha roto»", () => {
  test("el 22P02 de Postgres es lo primero y es un 404", () => {
    assert.equal(noPuedeExistir({ code: "22P02" }), true);
    assert.equal(noPuedeExistir({ code: "22P02", message: 'invalid input syntax for type uuid: "noesuuid"' }), true);
  });

  test("y cualquier otro error no lo es", () => {
    for (const otro of [
      new Error("relation \"x\" does not exist"),
      { code: "42703" },                    // columna que no existe
      { code: "23505" },                    // clave duplicada
      { code: "08006" },                    // se cayó la conexión
      null, undefined, "una cadena", 42,
    ]) {
      assert.equal(noPuedeExistir(otro), false, `${JSON.stringify(otro)} no es «no puede existir»`);
    }
  });

  test("un identificador imposible contesta 404 y no dice «vuelve a intentarlo»", () => {
    const res = elRes();
    elFallo(res, { code: "22P02", message: 'invalid input syntax for type uuid: "noesuuid"' }, "prueba", {}, PROD);

    assert.equal(res.code, 404);
    assert.ok(!/intentarlo/i.test(res.body.error), `no se le pide reintentar algo imposible: ${res.body.error}`);
    assert.ok(!/uuid/i.test(res.body.error), "ni se le cuenta el tipo de la columna");
  });

  test("y algo roto de verdad sigue siendo 500, sin el detalle", () => {
    const res = elRes();
    elFallo(res, new Error('relation "moveadvisor_market_offers" does not exist'), "prueba", {}, PROD);

    assert.equal(res.code, 500);
    assert.ok(!res.body.error.includes("relation"), "el mensaje de Postgres no sale");
    assert.match(res.body.error, /Vuelve a intentarlo/, "y a esto sí se le reintenta");
  });

  test("las dos respuestas conservan `ok: false`, que es lo que lee el navegador", () => {
    for (const err of [{ code: "22P02" }, new Error("otra cosa")]) {
      const res = elRes();
      elFallo(res, err, "prueba", {}, PROD);
      assert.equal(res.body.ok, false);
    }
  });
});

describe("y las dieciocho rutas de las citas lo usan", () => {
  const FUENTE = fs.readFileSync(path.join(__dirname, "api", "visit-availability-handler.js"), "utf8");

  test("las dieciocho pasan por `elFallo`", () => {
    const n = [...FUENTE.matchAll(/return elFallo\(res, e, "/g)].length;
    assert.equal(n, 18, `esperaba 18 llamadas a elFallo y hay ${n}`);
  });

  test("y ninguna fuerza ya un 500 con el mensaje dentro", () => {
    /*
     * Lo que había antes era `res.status(500).json({ ok:false, error: e.message })`
     * dieciocho veces. Que no vuelva ni en su forma original ni en la intermedia
     * —`elDetalle` dentro de un 500 fijo—, porque la intermedia tapaba la fuga pero
     * seguía contestando 500 a un enlace roto.
     */
    assert.ok(!/status\(500\)\.json\(\{ ok: false, error: e\.message \}\)/.test(FUENTE), "ha vuelto el mensaje crudo");
    assert.ok(
      !/status\(500\)\.json\(\{ ok: false, error: elDetalle\(e,/.test(FUENTE),
      "ha vuelto el 500 fijo: un identificador imposible volvería a pedir que se reintente"
    );
  });

  test("y cada una dice en el registro qué ruta era", () => {
    /*
     * El nombre es lo único que sirve para buscar en `moveadvisor_errores`, y tiene que
     * ser distinto en cada sitio: la primera versión los sacó del comentario de ruta y
     * tres de los dieciocho salieron iguales.
     */
    const nombres = [...FUENTE.matchAll(/return elFallo\(res, e, "([^"]+)"\)/g)].map((m) => m[1]);
    assert.equal(nombres.length, 18);
    assert.equal(new Set(nombres).size, 18, `hay nombres repetidos: ${nombres.join(", ")}`);
    for (const n of nombres) {
      assert.match(n, /^visit-availability: (get|post|delete|patch) /, `«${n}» tendría que decir método y ruta`);
    }
  });
});
