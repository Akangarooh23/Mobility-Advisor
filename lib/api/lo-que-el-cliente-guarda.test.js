"use strict";

/**
 * Las comparaciones guardadas y las preferencias, que no guardaban nada.
 *
 * ## Qué pasaba
 *
 * Las dos rutas iban a `lib/sqlserverMobilityStore.js`, que habla con SQL
 * Server lanzando `sqlcmd.exe` desde dentro de la petición. En Vercel ese
 * binario no existe, así que el camino no podía completarse — y lo que salía
 * de ahí no era un error:
 *
 *     return res.status(200).json({ ok: true, comparisons: [], fallback: true });
 *
 * **200 con la lista vacía.** Un error se ve y se reclama; «no tienes nada
 * guardado» se cree, y el cliente deja de intentarlo. Al guardar era un 503, en
 * la pantalla de preferencias del panel, que tiene un botón que la gente pulsa.
 *
 * Las dos tablas de Postgres ya existían, con la forma exacta y con cero filas.
 *
 * ## Qué se fija aquí
 *
 * Sobre todo una cosa: **que no se vuelva a contestar «no hay nada» cuando lo
 * que pasa es que no se puede leer**. Y que la forma de la respuesta siga
 * siendo la que la web espera, porque arreglar esto rompiendo `useAppBootstrap`
 * no sería arreglarlo.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

/* ── los dobles ─────────────────────────────────────────────────────────── */

let consultas = [];
let respuestas = [];
let sesion = null;

const rutaPostgres = require.resolve("../postgres");
require.cache[rutaPostgres] = {
  id: rutaPostgres,
  filename: rutaPostgres,
  loaded: true,
  exports: {
    elPool: () => ({
      async query(sql, params) {
        consultas.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
        return respuestas.shift() ?? { rows: [], rowCount: 0 };
      },
    }),
    elPoolObligatorio: () => { throw new Error("no se usa aquí"); },
    hayBase: () => true,
    cierraElPool: async () => {},
  },
};

const rutaAuth = require.resolve("../../api/auth");
require.cache[rutaAuth] = {
  id: rutaAuth,
  filename: rutaAuth,
  loaded: true,
  exports: { getSessionUserFromRequest: async () => sesion },
};

const guardados = require("./user-saved-handler");
const preferencias = require("./user-preferences-handler");

function respuesta() {
  const r = {
    codigo: 200,
    cuerpo: null,
    status(c) { r.codigo = c; return r; },
    json(b) { r.cuerpo = b; return r; },
  };
  return r;
}

async function pide(manejador, { method = "GET", query = {}, body = {} } = {}) {
  const res = respuesta();
  await manejador({ method, query, body, headers: {} }, res);
  return res;
}

beforeEach(() => {
  consultas = [];
  respuestas = [];
  sesion = { user: { email: "Ana@popcar.es", id: "usr-1" } };
});

/* ── las comparaciones ──────────────────────────────────────────────────── */

describe("las comparaciones guardadas", () => {
  test("sin sesión no se enseñan, y se dice que es por eso", async () => {
    sesion = null;
    const res = await pide(guardados);
    assert.equal(res.codigo, 401);
  });

  test("con sesión salen las de la base, no una lista vacía de mentira", async () => {
    /*
     * Ésta es la prueba de la avería. Antes, aquí salía `[]` con un 200 y un
     * `fallback: true` que nadie miraba, y eso se leía como «no tienes nada».
     */
    respuestas.push({
      rows: [{ id: "cmp-1", title: "Dos SUV", mode: "buy", comparison_payload: '{"coches":["a","b"]}' }],
      rowCount: 1,
    });
    const res = await pide(guardados);

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo.comparisons, [
      { coches: ["a", "b"], id: "cmp-1", title: "Dos SUV", mode: "buy" },
    ]);
    assert.ok(!("fallback" in res.cuerpo), "ya no hay un camino que finja que no hay nada");
  });

  test("y se buscan por el correo de la sesión, en minúsculas", async () => {
    // La sesión trae "Ana@popcar.es". Buscar con esas mayúsculas no encontraría
    // lo que se guardó en minúsculas.
    await pide(guardados);
    assert.match(consultas[0].sql, /lower\(user_email\) = \$1/);
    assert.deepEqual(consultas[0].params, ["ana@popcar.es"]);
  });

  test("guardar sin id no se hace en silencio", async () => {
    const res = await pide(guardados, { method: "POST", body: { comparison: { title: "sin id" } } });
    assert.equal(res.codigo, 400);
    assert.equal(consultas.length, 0, "no debe tocar la base");
  });

  test("guardar mete el payload entero y devuelve la lista", async () => {
    respuestas.push({ rows: [], rowCount: 1 });                      // el upsert
    respuestas.push({ rows: [{ id: "cmp-9", title: "T", mode: "buy", comparison_payload: "{}" }], rowCount: 1 });

    const res = await pide(guardados, {
      method: "POST",
      body: { comparison: { id: "cmp-9", title: "T", mode: "buy", coches: ["x"] } },
    });

    assert.equal(res.codigo, 200);
    assert.match(consultas[0].sql, /INSERT INTO moveadvisor_user_saved_comparisons/);
    assert.equal(consultas[0].params[0], "cmp-9");
    assert.equal(consultas[0].params[1], "ana@popcar.es");
    assert.equal(consultas[0].params[2], "usr-1", "el identificador se guarda junto al correo");
    assert.match(consultas[0].params[5], /"coches":\["x"\]/);
    assert.equal(res.cuerpo.comparisons.length, 1);
  });

  test("y borrar solo borra la tuya", async () => {
    /*
     * Sin el correo en la condición, quien adivine un identificador borra la
     * comparación de otro. No es teórico: los ids los pone el cliente.
     */
    respuestas.push({ rows: [], rowCount: 1 });
    respuestas.push({ rows: [], rowCount: 0 });

    await pide(guardados, { method: "DELETE", query: { id: "cmp-de-otro" } });

    assert.match(consultas[0].sql, /DELETE FROM moveadvisor_user_saved_comparisons/);
    assert.match(consultas[0].sql, /id = \$1 AND lower\(user_email\) = \$2/);
    assert.deepEqual(consultas[0].params, ["cmp-de-otro", "ana@popcar.es"]);
  });

  test("borrar sin id es un 400, no un borrado de todo", async () => {
    const res = await pide(guardados, { method: "DELETE", query: {} });
    assert.equal(res.codigo, 400);
    assert.equal(consultas.length, 0);
  });
});

/* ── las preferencias ───────────────────────────────────────────────────── */

describe("las preferencias", () => {
  test("sin sesión, 401", async () => {
    sesion = null;
    assert.equal((await pide(preferencias)).codigo, 401);
  });

  test("quien no las ha guardado nunca recibe null, no las de por omisión", async () => {
    // `null` y «las de por omisión» no son lo mismo: con null la pantalla
    // enseña el formulario en vez de fingir que ya eligió.
    const res = await pide(preferencias);
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.preferences, null);
  });

  test("y quien sí, las suyas con los nombres que espera la web", async () => {
    respuestas.push({
      rows: [{
        full_name: "Ana", language: "es", region: "es",
        notify_price_alerts: true, notify_appointments: false,
        notify_analysis_ready: true, weekly_digest: false,
      }],
      rowCount: 1,
    });
    const res = await pide(preferencias);
    assert.deepEqual(res.cuerpo.preferences, {
      fullName: "Ana", language: "es", region: "es",
      notifyPriceAlerts: true, notifyAppointments: false,
      notifyAnalysisReady: true, weeklyDigest: false,
    });
  });

  test("guardar contesta 200 y no un 503", async () => {
    // Esto era lo que veía quien pulsaba «guardar» en el panel.
    respuestas.push({ rows: [], rowCount: 0 });  // la lectura de antes
    respuestas.push({ rows: [], rowCount: 1 });  // el upsert
    const res = await pide(preferencias, {
      method: "PUT",
      body: { preferences: { fullName: "Ana", weeklyDigest: false } },
    });

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.message, "Preferencias guardadas correctamente.");
    assert.equal(res.cuerpo.preferences.fullName, "Ana");
    assert.equal(res.cuerpo.preferences.weeklyDigest, false);
  });

  test("y cambiar un campo no borra los otros seis", async () => {
    /*
     * La pantalla manda el formulario entero, pero un cliente que llame con un
     * solo campo no debería perder el resto. Con un upsert a pelo, los que no
     * vienen se escribirían como vacíos.
     */
    respuestas.push({
      rows: [{
        full_name: "Ana", language: "en", region: "pt",
        notify_price_alerts: false, notify_appointments: true,
        notify_analysis_ready: true, weekly_digest: true,
      }],
      rowCount: 1,
    });
    respuestas.push({ rows: [], rowCount: 1 });

    const res = await pide(preferencias, { method: "PUT", body: { weeklyDigest: false } });

    assert.equal(res.cuerpo.preferences.fullName, "Ana", "no se ha perdido el nombre");
    assert.equal(res.cuerpo.preferences.language, "en");
    assert.equal(res.cuerpo.preferences.region, "pt");
    assert.equal(res.cuerpo.preferences.notifyPriceAlerts, false);
    assert.equal(res.cuerpo.preferences.weeklyDigest, false, "y sí ha cambiado lo que se pidió");
  });
});

describe("y nadie vuelve a hablar con SQL Server desde aquí", () => {
  test("los dos manejadores ya no importan el almacén de sqlcmd", () => {
    /*
     * Ese módulo lanza un proceso externo de forma bloqueante desde dentro de
     * una petición. Mientras alguien lo importe, vuelve.
     */
    const fs = require("node:fs");
    for (const f of ["user-saved-handler.js", "user-preferences-handler.js"]) {
      const fuente = fs.readFileSync(require.resolve("./" + f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      assert.ok(
        !/require\(["'][^"']*sqlserverMobilityStore/.test(fuente),
        `${f} vuelve a depender de sqlcmd`
      );
    }
  });
});
