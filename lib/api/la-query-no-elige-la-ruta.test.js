"use strict";

/**
 * El valor de un parámetro no puede elegir la ruta.
 *
 * ## Lo que pasaba
 *
 * Las tres puertas —`api/market.js`, `api/user.js`, `api/billing.js`— reparten por
 * `?route=`. Cuando no viene, `creaEnrutador` cae a una lista de alias y los busca
 * con `includes` sobre `req.url`… **con la cadena de consulta dentro**.
 *
 * Dos de los alias de `/api/user` son cortos: `leads` y `error`. Así que una
 * petición a `/api/user?email=alguien@error.com` sin `route` se resolvía a la ruta
 * `error`. Y se llega ahí desde fuera: `vercel.json` tiene un `/api/(.*) → /api/$1`
 * que sirve el fichero por su nombre.
 *
 * No daba acceso a nada nuevo —cada ruta es alcanzable por su propio camino— pero
 * era una trampa esperando a que alguien añadiera un alias corto a una ruta con
 * privilegios. `market.js` ya tiene `fianza-devolucion`, que lleva la clave de
 * Stripe.
 *
 * ## Por qué esta prueba y no «exigir ?route=»
 *
 * Porque exigirlo rompe el desarrollo en local y con él el CI: `local-api-server.js`
 * mapea caminos directos a los manejadores y no manda `route`. Lo que se arregló fue
 * cortar la búsqueda al **camino**. Esta prueba fija las dos mitades: que el
 * parámetro no mande, y que el camino siga mandando.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { creaEnrutador } = require("./enrutador");

/** Un enrutador de juguete con los dos alias cortos que tenía `/api/user`. */
function elDeJuguete() {
  const atendidas = [];
  const puerta = creaEnrutador({
    rutas: {
      leads: () => async (_req, res) => { atendidas.push("leads"); return res.status(200).json({ ok: true }); },
      error: () => async (_req, res) => { atendidas.push("error"); return res.status(200).json({ ok: true }); },
      saved: () => async (_req, res) => { atendidas.push("saved"); return res.status(200).json({ ok: true }); },
    },
    alias: [
      ["user-saved", "saved"],
      ["leads", "leads"],
      ["error", "error"],
    ],
    noEncontrada: "no está",
  });
  return { puerta, atendidas };
}

/** Un `res` de mentira que apunta el código y el cuerpo. */
function elRes() {
  const r = { code: 0, body: null, cabeceras: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return b; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.cabeceras[k] = v; };
  return r;
}

describe("sin ?route=, la ruta sale del camino y no de la query", () => {
  test("un correo con «error» dentro NO elige la ruta error", async () => {
    const { puerta, atendidas } = elDeJuguete();
    const res = elRes();

    await puerta(
      { method: "POST", url: "/api/user?email=alguien@error.com", query: { email: "alguien@error.com" }, headers: {} },
      res
    );

    assert.deepEqual(atendidas, [], "no debería haber atendido ninguna ruta");
    assert.equal(res.code, 404, "sin camino que encaje, es un 404");
  });

  test("ni un parámetro que diga «leads»", async () => {
    const { puerta, atendidas } = elDeJuguete();
    const res = elRes();

    await puerta(
      { method: "GET", url: "/api/user?q=leads", query: { q: "leads" }, headers: {} },
      res
    );

    assert.deepEqual(atendidas, []);
    assert.equal(res.code, 404);
  });

  test("pero el camino sí manda, que es de lo que vive el servidor local", async () => {
    const { puerta, atendidas } = elDeJuguete();
    const res = elRes();

    await puerta({ method: "POST", url: "/api/leads", query: {}, headers: {} }, res);

    assert.deepEqual(atendidas, ["leads"], "/api/leads tiene que llegar a la ruta leads");
    assert.equal(res.code, 200);
  });

  test("y el ?route= explícito sigue mandando sobre todo", async () => {
    const { puerta, atendidas } = elDeJuguete();
    const res = elRes();

    // El camino dice `leads` y el parámetro dice `saved`: manda el parámetro.
    await puerta(
      { method: "POST", url: "/api/leads?route=saved", query: { route: "saved" }, headers: {} },
      res
    );

    assert.deepEqual(atendidas, ["saved"]);
  });

  test("y un camino con el alias en medio sigue encajando", async () => {
    // Así es como llegan de verdad: /api/user-saved, /api/user?route=saved…
    const { puerta, atendidas } = elDeJuguete();
    const res = elRes();

    await puerta({ method: "GET", url: "/api/user-saved?limit=10", query: { limit: "10" }, headers: {} }, res);

    assert.deepEqual(atendidas, ["saved"]);
  });
});
