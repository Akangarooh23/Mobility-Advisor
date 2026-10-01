"use strict";

/**
 * Las puertas que usa la app tienen que contestar al permiso del navegador.
 *
 * ── Lo que pasó ────────────────────────────────────────────────────────────
 *
 * 1-oct-2026: guardar las franjas de visita desde la app instalada decía
 * «Failed to fetch». No es un error de la API: es que la petición no llegó a
 * salir. La app instalada no vive en nuestro dominio —su origen es
 * `https://localhost`— y manda la sesión en `Authorization`, así que el
 * navegador pide permiso antes (un `OPTIONS`) y solo envía si se lo dan.
 *
 * `api/visit-availability.js` se escribía las cabeceras a mano y declaraba
 * `Access-Control-Allow-Headers: Content-Type`. Sin `Authorization` en esa
 * lista, el permiso se deniega y la llamada muere en el navegador, sin tocar
 * el servidor y sin dejar rastro en ningún registro.
 *
 * ── Qué se fija aquí ───────────────────────────────────────────────────────
 *
 * Dos cosas, y ninguna comprueba «que haya CORS» a secas:
 *
 *  1. Nadie se escribe las cabeceras a mano. Quien las ponga que use
 *     `lib/cors.js`, que es el único sitio donde está la lista de orígenes y
 *     el único que sabe qué cabeceras hacen falta.
 *  2. `aplicaCors` deja pasar de verdad lo que la app manda: `Authorization`
 *     y `X-PopCar-Client`, y contesta al `OPTIONS`.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CARPETA = path.join(__dirname, "..", "..", "api");

describe("nadie se escribe el CORS a mano", () => {
  test("todas las cabeceras de permiso salen de lib/cors.js", () => {
    const aMano = [];
    for (const fichero of fs.readdirSync(CARPETA).filter((f) => f.endsWith(".js"))) {
      const fuente = fs.readFileSync(path.join(CARPETA, fichero), "utf8");
      // El comentario puede nombrarlas; lo que no vale es ponerlas.
      const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      if (/setHeader\(\s*["']Access-Control-/i.test(sinComentarios)) aMano.push(fichero);
    }

    assert.deepEqual(
      aMano,
      [],
      `estas puertas se escriben el CORS a mano y se les va a olvidar una cabecera: ${aMano.join(", ")}`
    );
  });
});

describe("y el permiso que se da sirve para lo que manda la app", () => {
  const { aplicaCors } = require("../cors");

  /** Un `res` de mentira que solo apunta lo que le ponen. */
  function respuesta() {
    const r = { cabeceras: {}, codigo: 0, terminada: false };
    r.setHeader = (k, v) => { r.cabeceras[k] = v; };
    r.status = (c) => { r.codigo = c; return r; };
    r.end = () => { r.terminada = true; return r; };
    return r;
  }

  const conOrigen = (metodo) => ({ method: metodo, headers: { origin: "https://localhost" } });

  function conLaLista(fn) {
    const antes = process.env.CORS_ORIGENES;
    process.env.CORS_ORIGENES = "capacitor://localhost,https://localhost";
    try { return fn(); } finally {
      if (antes === undefined) delete process.env.CORS_ORIGENES;
      else process.env.CORS_ORIGENES = antes;
    }
  }

  test("deja pasar la cabecera donde viaja la sesión", () => {
    conLaLista(() => {
      const res = respuesta();
      aplicaCors(conOrigen("POST"), res);
      const permitidas = String(res.cabeceras["Access-Control-Allow-Headers"] || "");
      assert.match(permitidas, /Authorization/i, "sin esto la app no puede mandar su sesión");
      assert.match(permitidas, /Content-Type/i);
      assert.match(permitidas, /X-PopCar-Client/i);
    });
  });

  test("y los métodos con los que se guardan y se quitan las franjas", () => {
    conLaLista(() => {
      const res = respuesta();
      aplicaCors(conOrigen("POST"), res);
      const metodos = String(res.cabeceras["Access-Control-Allow-Methods"] || "");
      for (const m of ["GET", "POST", "DELETE"]) {
        assert.ok(metodos.includes(m), `falta ${m}`);
      }
    });
  });

  test("el origen se devuelve concreto, nunca con comodín", () => {
    // Con credenciales de por medio el navegador rechaza el `*`, así que un
    // comodín aquí es lo mismo que no tener CORS.
    conLaLista(() => {
      const res = respuesta();
      aplicaCors(conOrigen("GET"), res);
      assert.equal(res.cabeceras["Access-Control-Allow-Origin"], "https://localhost");
      assert.equal(res.cabeceras["Access-Control-Allow-Credentials"], "true");
      assert.equal(res.cabeceras["Vary"], "Origin");
    });
  });

  test("al preflight se le contesta y ahí se acaba", () => {
    conLaLista(() => {
      const res = respuesta();
      const corta = aplicaCors(conOrigen("OPTIONS"), res);
      assert.equal(corta, true, "quien llama tiene que parar aquí");
      assert.equal(res.codigo, 204);
      assert.equal(res.terminada, true);
    });
  });

  test("y a un origen de fuera de la lista no se le da permiso", () => {
    conLaLista(() => {
      const res = respuesta();
      aplicaCors({ method: "GET", headers: { origin: "https://ejemplo-malo.es" } }, res);
      assert.equal(res.cabeceras["Access-Control-Allow-Origin"], undefined);
    });
  });
});
