/**
 * La tarea que avisa de que no entra catálogo, de punta a punta.
 *
 * Lo que se vigila aquí, además de que avise: que **no se pueda disparar desde
 * fuera** y que **no mande nada cuando no hay nada que decir**. Un aviso que
 * llega todos los días diciendo que todo va bien deja de leerse en una semana, y
 * entonces vuelve a pasar lo de agosto.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.INTERNAL_EMAIL = "interno@popcar.tech";

const handler = require("./cron-vigila-scrapers-handler.js");

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

let filas = [];
let correos = [];
let sqlUsado = "";

beforeEach(() => {
  correos = [];
  sqlUsado = "";
  Pool.prototype.query = async (sql) => {
    sqlUsado = String(sql || "");
    return { rows: filas, rowCount: filas.length };
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      correos.push(JSON.parse(opciones.body));
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

/** Llama a la tarea como la llamaría Vercel. */
async function corre({ cabeceras = { "user-agent": "vercel-cron/1.0" } } = {}) {
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    end() { return res; },
  };
  await handler({ method: "GET", headers: cabeceras }, res);
  return salida;
}

const HACE_MUCHO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const AYER = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe("quién puede dispararla", () => {
  test("sin ser Vercel, no", async () => {
    filas = [{ fuente: "autocasion", ultimo: HACE_MUCHO, ofertas: 10 }];
    const r = await corre({ cabeceras: {} });
    assert.equal(r.codigo, 401);
    assert.equal(correos.length, 0);
  });

  test("con el secreto puesto, hace falta el secreto", async () => {
    process.env.CRON_SECRET = "s3cr3t0";
    filas = [{ fuente: "autocasion", ultimo: HACE_MUCHO, ofertas: 10 }];
    const sinEl = await corre({ cabeceras: { "user-agent": "vercel-cron/1.0" } });
    assert.equal(sinEl.codigo, 401, "con secreto configurado, el user-agent no basta");
    const conEl = await corre({ cabeceras: { authorization: "Bearer s3cr3t0" } });
    assert.equal(conEl.codigo, 200);
    delete process.env.CRON_SECRET;
  });
});

describe("cuándo avisa y cuándo se calla", () => {
  test("con todo al día no manda nada", async () => {
    // Es media función: un aviso diario de que todo va bien se ignora.
    filas = [{ fuente: "autocasion", ultimo: AYER, ofertas: 100 }];
    const r = await corre();
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.calladas, 0);
    assert.equal(correos.length, 0);
  });

  test("con una fuente parada, avisa una vez", async () => {
    filas = [
      { fuente: "autocasion", ultimo: AYER, ofertas: 100 },
      { fuente: "autoscout24-de", ultimo: HACE_MUCHO, ofertas: 25498 },
    ];
    const r = await corre();
    assert.equal(r.cuerpo.calladas, 1);
    assert.equal(correos.length, 1);
    assert.equal(correos[0].to, "interno@popcar.tech", "esto no se le manda a ningún cliente");
    assert.match(correos[0].subject, /autoscout24-de/);
    assert.match(correos[0].html, /importación/);
  });
});

describe("la consulta que hace", () => {
  test("separa la importación del AutoScout24 español", async () => {
    // Son el mismo portal y dos flujos distintos. Agrupados, el que corre tapa
    // al que lleva mes y medio parado.
    filas = [];
    await corre();
    assert.match(sqlUsado, /country, 'ES'\) = 'DE' THEN portal \|\| '-de'/);
  });

  test("y no cuenta filas sin portal", async () => {
    filas = [];
    await corre();
    assert.match(sqlUsado, /COALESCE\(portal, ''\) <> ''/);
  });
});

describe("si algo falla", () => {
  test("un fallo de la base no se traga en silencio", async () => {
    Pool.prototype.query = async () => { throw new Error("la base no contesta"); };
    const r = await corre();
    assert.equal(r.codigo, 500);
    assert.equal(r.cuerpo.error, "consulta_fallida");
  });

  test("y si el correo no sale, la tarea no revienta", async () => {
    // Que no se pueda avisar no debe dejar la tarea caída: el registro guarda
    // qué pasaba, y mañana se vuelve a intentar.
    filas = [{ fuente: "autoscout24-de", ultimo: HACE_MUCHO, ofertas: 1 }];
    global.fetch = async () => { throw new Error("Resend caído"); };
    const r = await corre();
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.enviado, false);
    assert.equal(r.cuerpo.calladas, 1);
  });
});
