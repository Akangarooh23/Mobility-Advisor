"use strict";

/**
 * Lo que tiene que cumplir el cliente de Postgres compartido.
 *
 * Lo que esto protege de verdad es una cosa: **que el pool no se cree dos
 * veces**. Siete ficheros hacían `return new Pool(...)` sin guardarlo, y
 * `lib/viewingStore.js` llamaba a esa función cinco veces por petición. Cinco
 * pools, cada uno con hasta diez conexiones, para atender a una persona.
 *
 * No hace falta base de datos: `new Pool(...)` no conecta hasta la primera
 * consulta, así que aquí se puede comprobar la identidad del objeto con una
 * cadena inventada.
 */

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const RUTA = require.resolve("./postgres");
const INVENTADA = "postgres://quien:sea@ninguna-parte.invalid:5432/nada";
const OTRA = "postgres://otro:sea@tampoco.invalid:5432/nada";

let guardadas;

/** Cada prueba con su módulo recién cargado: el pool es estado de módulo. */
function deNuevo() {
  delete require.cache[RUTA];
  return require("./postgres");
}

beforeEach(() => {
  guardadas = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    PG_MAX_CONEXIONES: process.env.PG_MAX_CONEXIONES,
  };
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.PG_MAX_CONEXIONES;
});

afterEach(() => {
  for (const [k, v] of Object.entries(guardadas)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  delete require.cache[RUTA];
});

describe("uno, y no uno por llamada", () => {
  test("dos llamadas devuelven el mismo pool", () => {
    process.env.DATABASE_URL = INVENTADA;
    const pg = deNuevo();
    assert.equal(pg.elPool(), pg.elPool(), "esto es el bug entero: un pool por llamada");
  });

  test("y cinco seguidas también, que es lo que hacía viewingStore", () => {
    process.env.DATABASE_URL = INVENTADA;
    const pg = deNuevo();
    const primero = pg.elPool();
    for (let i = 0; i < 4; i += 1) assert.equal(pg.elPool(), primero);
  });
});

describe("cuando no hay configuración", () => {
  test("elPool() devuelve null y no revienta", () => {
    const pg = deNuevo();
    assert.equal(pg.elPool(), null);
    assert.equal(pg.hayBase(), false);
  });

  test("y elPoolObligatorio() dice qué falta", () => {
    // Los sitios que no pueden seguir a medias prefieren pararse con un
    // mensaje que diga el nombre de la variable.
    const pg = deNuevo();
    assert.throws(() => pg.elPoolObligatorio(), /DATABASE_URL/);
  });

  test("una cadena de solo espacios es no tener cadena", () => {
    process.env.DATABASE_URL = "   ";
    const pg = deNuevo();
    assert.equal(pg.elPool(), null);
  });
});

describe("de dónde saca la cadena", () => {
  test("DATABASE_URL manda", () => {
    process.env.DATABASE_URL = INVENTADA;
    process.env.POSTGRES_URL = OTRA;
    const pg = deNuevo();
    assert.equal(pg.elPool().options.connectionString, INVENTADA);
  });

  test("y POSTGRES_URL vale si no está la otra", () => {
    // Las dos se han usado por aquí; quitar cualquiera rompería algo.
    process.env.POSTGRES_URL = OTRA;
    const pg = deNuevo();
    assert.equal(pg.elPool().options.connectionString, OTRA);
  });
});

describe("los ajustes que antes estaban a medias", () => {
  test("el certificado se verifica siempre", () => {
    // Esto estaba puesto en unos ficheros y en otros no. Ahora en ninguno,
    // porque lo pone este.
    process.env.DATABASE_URL = INVENTADA;
    const pg = deNuevo();
    assert.deepEqual(pg.elPool().options.ssl, { rejectUnauthorized: true });
  });

  test("hay un máximo declarado, y es el que tenía la mayoría", () => {
    process.env.DATABASE_URL = INVENTADA;
    const pg = deNuevo();
    assert.equal(pg.elPool().options.max, 10);
  });

  test("y se puede mover desde el entorno, sin tocar código", () => {
    process.env.DATABASE_URL = INVENTADA;
    process.env.PG_MAX_CONEXIONES = "4";
    const pg = deNuevo();
    assert.equal(pg.elPool().options.max, 4);
  });

  test("un valor absurdo se ignora en vez de romper la conexión", () => {
    process.env.DATABASE_URL = INVENTADA;
    process.env.PG_MAX_CONEXIONES = "no soy un número";
    const pg = deNuevo();
    assert.equal(pg.elPool().options.max, 10);
  });
});

describe("si la cadena cambia", () => {
  test("se abre otro pool en vez de seguir con el viejo", async () => {
    /*
     * En producción no pasa. En las pruebas sí: varias cambian DATABASE_URL
     * para apuntar a otro sitio, y un pool cacheado a secas se quedaría
     * hablando con la base anterior sin decir nada.
     */
    process.env.DATABASE_URL = INVENTADA;
    const pg = deNuevo();
    const primero = pg.elPool();

    process.env.DATABASE_URL = OTRA;
    const segundo = pg.elPool();

    assert.notEqual(segundo, primero);
    assert.equal(segundo.options.connectionString, OTRA);
    await pg.cierraElPool();
  });
});
