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

/**
 * Y la puerta de las rutas que mueven dinero.
 *
 * Es la misma idea con dos diferencias, y las dos importan:
 *
 *   · exige sesión **también fuera de producción**. La regla general afloja en
 *     un portátil para poder probar con curl; ésta no, porque lo que hay al
 *     otro lado es un cobro;
 *   · y el correo de reserva del cuerpo se llama `customerEmail`, que es como
 *     lo manda la pantalla de pago desde siempre.
 *
 * Esto estaba escrito tres veces —dos en el checkout y una en el portal— con la
 * misma línea copiada. Cuando una regla de sesión vive en tres sitios, el día
 * que alguien la cambia solo la cambia en uno, y los otros dos no se quejan.
 */
describe("quien paga", () => {
  const { identidadDeQuienPaga, exigeSesionParaPagar } = require("./identidad");
  const pago = (customerEmail) => ({ query: {}, body: {} , cuerpo: { customerEmail } });

  before(() => { delete process.env.NODE_ENV; delete process.env.AUTH_BILLING_REQUIRE_SESSION; });

  test("en un portátil TAMBIEN hace falta sesion", async () => {
    // Aquí está la diferencia con la regla general, que sí aflojaría.
    sesionQueDevuelve = null;
    const quien = await identidadDeQuienPaga({ query: {} }, { cuerpo: { customerEmail: "otro@ejemplo.es" } });
    assert.equal(quien.email, "", "sin sesion no se cobra a nadie, ni en local");
    assert.equal(quien.conSesion, false);
  });

  test("y la general sí afloja, que es justo lo que las distingue", async () => {
    sesionQueDevuelve = null;
    const quien = await identidadDeLaPeticion({ query: { email: "otro@ejemplo.es" } });
    assert.equal(quien.email, "otro@ejemplo.es");
  });

  test("con sesion, manda la sesion y no el cuerpo", async () => {
    sesionQueDevuelve = { user: { id: "u-1", email: "Ana@popcar.es" } };
    const quien = await identidadDeQuienPaga({ query: {} }, { cuerpo: { customerEmail: "otro@ejemplo.es" } });
    assert.equal(quien.email, "ana@popcar.es");
    assert.equal(quien.userId, "u-1");
  });

  test("y trae el usuario entero, que la tasacion necesita", async () => {
    /*
     * `leQuedaLaGratuita` mira si a esta persona le queda la tasación gratis.
     * Mirarlo por el objeto del usuario y no por su correo es lo que hace que
     * cambiar de correo no regale otra.
     */
    sesionQueDevuelve = { user: { id: "u-1", email: "ana@popcar.es", plan: "plus" } };
    const quien = await identidadDeQuienPaga({ query: {} }, { cuerpo: {} });
    assert.deepEqual(quien.usuario, { id: "u-1", email: "ana@popcar.es", plan: "plus" });
  });

  test("sin sesion, el usuario es null y no undefined", async () => {
    sesionQueDevuelve = null;
    assert.equal((await identidadDeQuienPaga({ query: {} })).usuario, null);
  });

  test("se puede apagar a mano, pero hay que escribirlo", () => {
    process.env.AUTH_BILLING_REQUIRE_SESSION = "false";
    assert.equal(exigeSesionParaPagar(), false);
    delete process.env.AUTH_BILLING_REQUIRE_SESSION;
    assert.equal(exigeSesionParaPagar(), true, "por omision, siempre");
  });
});

/**
 * Y que la regla siga viviendo en un solo sitio.
 *
 * Había dos maneras de saber quién llamaba: ésta, y leer la sesión a pelo con
 * `authHandler.getSessionUserFromRequest?.(req)`. La segunda estaba copiada en
 * nueve manejadores, siempre en las mismas dos líneas, y ninguna de las nueve
 * se fiaba del correo de la URL — así que no era un agujero, era peor de
 * mantener: nueve sitios donde acordarse.
 *
 * Y el `?.` de esa llamada la hacía silenciosa. Si ese export desapareciera,
 * no fallaría: devolvería `undefined`, el correo quedaría vacío y la respuesta
 * sería un 401. Cierra en seguro, que es lo correcto, pero un fallo de
 * programación se disfrazaría de sesión caducada y no lo encontraría nadie.
 */
describe("la regla vive en un solo sitio", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const RAIZ = path.join(__dirname, "..", "..");

  /** Quien puede leer la sesión a pelo, y por qué. */
  const PUEDEN = new Map([
    [path.join("lib", "api", "identidad.js"), "es quien envuelve la regla"],
    [path.join("api", "auth.js"), "es quien la implementa"],
  ]);

  function recorre(directorio, encontrados = []) {
    for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
      const completa = path.join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules") continue;
        recorre(completa, encontrados);
        continue;
      }
      if (!entrada.name.endsWith(".js") || entrada.name.endsWith(".test.js")) continue;
      encontrados.push(completa);
    }
    return encontrados;
  }

  test("nadie lee la sesion por su cuenta", () => {
    const ficheros = [...recorre(path.join(RAIZ, "lib")), ...recorre(path.join(RAIZ, "api"))];
    assert.ok(ficheros.length > 100, `solo he visto ${ficheros.length} ficheros`);

    const culpables = ficheros
      .map((f) => path.relative(RAIZ, f))
      .filter((rel) => !PUEDEN.has(rel))
      .filter((rel) => {
        const fuente = fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        return /getSessionUserFromRequest/.test(fuente);
      });

    assert.deepEqual(
      culpables,
      [],
      "usa identidadDeLaPeticion(req), o identidadDeQuienPaga(req) si la ruta cobra. " +
        "Leer la sesion a pelo duplica la regla, y con `?.` delante un fallo de " +
        "programacion se disfraza de sesion caducada."
    );
  });

  test("y los dos que pueden siguen estando", () => {
    for (const [rel, porque] of PUEDEN) {
      assert.ok(fs.existsSync(path.join(RAIZ, rel)), `ya no existe ${rel}`);
      assert.ok(porque.length > 10, `el motivo de ${rel} no explica nada`);
    }
  });
});
