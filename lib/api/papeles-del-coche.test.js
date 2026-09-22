/**
 * Los papeles del coche no se sirven en abierto.
 *
 * El permiso de circulación, la ficha técnica y la ITV iban al mismo cubo que
 * las fotos del anuncio, que es público: con la dirección delante —y la
 * dirección venía en la respuesta del panel y de la app— se abrían sin sesión.
 *
 * Aquí se fijan las dos mitades del arreglo: que las fotos siguen yendo al cubo
 * público y los papeles al privado, y que la puerta por la que se sacan
 * comprueba de quién es el coche.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Los de mentira, antes de que nadie los pida ─────────────────────────────

const rutaAuth = require.resolve("../../api/auth");
let sesionQueDevuelve = null;
require.cache[rutaAuth] = {
  id: rutaAuth,
  filename: rutaAuth,
  loaded: true,
  exports: { getSessionUserFromRequest: async () => sesionQueDevuelve },
};

/** Lo que contesta la base a cada consulta, en orden de llegada. */
let respuestasDeLaBase = [];
const consultasHechas = [];
const rutaPg = require.resolve("pg");
require.cache[rutaPg] = {
  id: rutaPg,
  filename: rutaPg,
  loaded: true,
  exports: {
    Pool: class {
      async query(sql, params) {
        consultasHechas.push({ sql, params });
        return respuestasDeLaBase.shift() ?? { rows: [], rowCount: 0 };
      }
      async end() {}
    },
  },
};

const almacenReal = require("../supabaseStorage");
const rutaAlmacen = require.resolve("../supabaseStorage");
require.cache[rutaAlmacen] = {
  id: rutaAlmacen,
  filename: rutaAlmacen,
  loaded: true,
  exports: {
    ...almacenReal,
    urlFirmada: async (camino) => `https://x.supabase.co/storage/v1/object/sign/erp-documentos/${camino}?token=firmado`,
  },
};

const papelDelCoche = require("./papel-del-coche-handler");
const presign = require("./storage-presign-handler");

// ── Andamio ─────────────────────────────────────────────────────────────────

const entorno = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH: process.env.AUTH_BILLING_REQUIRE_SESSION,
  BASE: process.env.DATABASE_URL,
  URL: process.env.SUPABASE_URL,
  CLAVE: process.env.SUPABASE_SERVICE_KEY,
};
const fetchOriginal = global.fetch;

before(() => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
  process.env.DATABASE_URL = "postgres://de-mentira/base";
  process.env.SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "clave-de-mentira";
  // El firmador de subidas habla con Supabase; aquí contesta lo que contesta él.
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ url: "/object/upload/sign/lo-que-sea?token=abc" }),
  });
});

after(() => {
  global.fetch = fetchOriginal;
  for (const [nombre, valor] of [
    ["NODE_ENV", entorno.NODE_ENV],
    ["AUTH_BILLING_REQUIRE_SESSION", entorno.AUTH],
    ["DATABASE_URL", entorno.BASE],
    ["SUPABASE_URL", entorno.URL],
    ["SUPABASE_SERVICE_KEY", entorno.CLAVE],
  ]) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

beforeEach(() => {
  respuestasDeLaBase = [];
  consultasHechas.length = 0;
  sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
});

function respuesta() {
  const r = { codigo: 200, cuerpo: null, aDonde: "", cabeceras: {} };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (d) => { r.cuerpo = d; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.cabeceras[k] = v; };
  r.redirect = (c, url) => { r.codigo = c; r.aDonde = url; return r; };
  return r;
}

const SUYO = { rows: [{ ok: 1 }], rowCount: 1 };
const NADA = { rows: [], rowCount: 0 };

// ── El firmador de subidas: cada cosa a su cubo ─────────────────────────────

describe("dónde cae lo que se sube", () => {
  const pide = async (fileType, fileName = "papel.pdf") => {
    respuestasDeLaBase = [SUYO];
    const res = respuesta();
    await presign({ method: "POST", headers: {}, query: {}, body: { fileName, vehicleId: "veh-1", fileType } }, res);
    return res;
  };

  test("una foto va al cubo público, como siempre", async () => {
    const res = await pide("photos", "coche.jpg");
    assert.equal(res.codigo, 200);
    assert.match(res.cuerpo.publicUrl, /\/object\/public\/vehicle-files\/vehicles\/veh-1\/photos\//);
  });

  test("la ITV va al cubo privado", async () => {
    const res = await pide("itv");
    assert.ok(!res.cuerpo.publicUrl.includes("/object/public/"), "no puede quedar una dirección que abra sin sesión");
    assert.match(res.cuerpo.publicUrl, /\/object\/erp-documentos\/vehicles\/veh-1\/itv\//);
  });

  test("el permiso de circulación, también", async () => {
    const res = await pide("circulation_permit");
    assert.match(res.cuerpo.publicUrl, /\/object\/erp-documentos\//);
  });

  test("y lo que no diga de qué es, por si acaso, también", async () => {
    const res = await pide("");
    assert.match(res.cuerpo.publicUrl, /\/object\/erp-documentos\//);
  });
});

// ── La puerta por la que se sacan ───────────────────────────────────────────

const CAMINO = "vehicles/veh-1/itv/1789_itv.pdf";
const peticion = (query) => ({ method: "GET", headers: {}, query });

describe("pedir un papel del coche", () => {
  test("sin sesión, no", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: CAMINO }), res);
    assert.equal(res.codigo, 401);
  });

  test("el coche de otro, tampoco", async () => {
    respuestasDeLaBase = [NADA]; // no es suyo
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-de-otro", camino: "vehicles/veh-de-otro/itv/x.pdf" }), res);
    assert.equal(res.codigo, 403);
  });

  test("con un coche propio no se saca el papel de otro", async () => {
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: "vehicles/veh-de-otro/itv/x.pdf" }), res);
    assert.equal(res.codigo, 400, "el camino tiene que estar dentro de la carpeta de su coche");
    assert.equal(consultasHechas.length, 0, "y no hace falta ni preguntar a la base");
  });

  test("ni subiendo de carpeta", async () => {
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: "vehicles/veh-1/../veh-2/itv/x.pdf" }), res);
    assert.equal(res.codigo, 400);
  });

  test("un camino que no está guardado no se firma", async () => {
    respuestasDeLaBase = [SUYO, NADA];
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: "vehicles/veh-1/itv/inventado.pdf" }), res);
    assert.equal(res.codigo, 404, "se sirve lo que hay guardado, no lo que se pida");
  });

  test("el suyo sí, y por una dirección firmada que caduca", async () => {
    respuestasDeLaBase = [SUYO, SUYO];
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: CAMINO }), res);
    assert.equal(res.codigo, 302);
    assert.match(res.aDonde, /\/object\/sign\/erp-documentos\/.*token=firmado/);
    assert.equal(res.cabeceras["Cache-Control"], "private, no-store");
  });

  test("la app la pide en json, porque su sesión no viaja en un enlace", async () => {
    respuestasDeLaBase = [SUYO, SUYO];
    const res = respuesta();
    await papelDelCoche(peticion({ coche: "veh-1", camino: CAMINO, json: "1" }), res);
    assert.equal(res.codigo, 200);
    assert.match(res.cuerpo.url, /token=firmado/);
  });

  test("solo se lee", async () => {
    const res = respuesta();
    await papelDelCoche({ method: "POST", headers: {}, query: {} }, res);
    assert.equal(res.codigo, 405);
  });
});
