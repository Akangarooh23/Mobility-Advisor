/**
 * De quién es una petición.
 *
 * Lo que se fija aquí es que **manda la sesión y nunca la URL**. Un correo en la
 * barra de direcciones lo escribe cualquiera.
 */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

// El módulo de auth abre conexiones al cargarse; se sustituye por uno de
// mentira antes de que identidad.js lo pida.
const rutaAuth = require.resolve("../../api/auth");
let sesionQueDevuelve = null;
require.cache[rutaAuth] = {
  id: rutaAuth,
  filename: rutaAuth,
  loaded: true,
  exports: { getSessionUserFromRequest: async () => sesionQueDevuelve },
};

const { identidadDeLaPeticion, exigeSesion } = require("./identidad");

const entornoOriginal = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, AUTH: process.env.AUTH_BILLING_REQUIRE_SESSION };

before(() => {
  delete process.env.VERCEL;
  delete process.env.AUTH_BILLING_REQUIRE_SESSION;
});

after(() => {
  process.env.NODE_ENV = entornoOriginal.NODE_ENV;
  if (entornoOriginal.VERCEL) process.env.VERCEL = entornoOriginal.VERCEL;
  if (entornoOriginal.AUTH) process.env.AUTH_BILLING_REQUIRE_SESSION = entornoOriginal.AUTH;
});

const peticion = (email) => ({ query: email ? { email } : {} });

describe("en produccion", () => {
  before(() => { process.env.NODE_ENV = "production"; });

  test("el correo sale de la sesion", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "Ana@Example.com" } };
    const i = await identidadDeLaPeticion(peticion());
    assert.equal(i.email, "ana@example.com", "y en minusculas, que es como se compara");
    assert.equal(i.userId, "u1");
    assert.equal(i.conSesion, true);
  });

  test("el correo de la URL se ignora aunque haya sesion", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
    const i = await identidadDeLaPeticion(peticion("victima@example.com"));
    assert.equal(i.email, "ana@example.com", "pedir los datos de otro no puede funcionar");
  });

  test("sin sesion no hay correo, aunque venga en la URL", async () => {
    sesionQueDevuelve = null;
    const i = await identidadDeLaPeticion(peticion("victima@example.com"));
    assert.equal(i.email, "");
    assert.equal(i.conSesion, false);
  });

  test("si leer la sesion revienta, no se da por buena", async () => {
    const original = require(rutaAuth).getSessionUserFromRequest;
    require(rutaAuth).getSessionUserFromRequest = async () => { throw new Error("base caida"); };
    const i = await identidadDeLaPeticion(peticion("victima@example.com"));
    require(rutaAuth).getSessionUserFromRequest = original;
    assert.equal(i.email, "", "un fallo al leerla no puede parecer una sesion");
  });
});

describe("en desarrollo", () => {
  before(() => { process.env.NODE_ENV = "development"; });

  test("se admite el correo de la peticion, para poder probar con curl", async () => {
    sesionQueDevuelve = null;
    const i = await identidadDeLaPeticion(peticion("yo@example.com"));
    assert.equal(i.email, "yo@example.com");
    assert.equal(i.conSesion, false, "pero se sabe que no venia de una sesion");
  });

  test("la sesion sigue mandando si la hay", async () => {
    sesionQueDevuelve = { user: { id: "u1", email: "ana@example.com" } };
    const i = await identidadDeLaPeticion(peticion("otro@example.com"));
    assert.equal(i.email, "ana@example.com");
  });
});

describe("cuando se exige sesion", () => {
  test("en produccion, si", () => {
    process.env.NODE_ENV = "production";
    assert.equal(exigeSesion({ NODE_ENV: "production" }), true);
  });

  test("en Vercel tambien, aunque no sea production", () => {
    assert.equal(exigeSesion({ VERCEL: "1" }), true);
  });

  test("en local no, para poder trabajar", () => {
    assert.equal(exigeSesion({ NODE_ENV: "development" }), false);
  });

  test("se puede forzar a mano en los dos sentidos", () => {
    assert.equal(exigeSesion({ NODE_ENV: "development", AUTH_BILLING_REQUIRE_SESSION: "true" }), true);
    assert.equal(exigeSesion({ NODE_ENV: "production", AUTH_BILLING_REQUIRE_SESSION: "false" }), false);
  });
});
