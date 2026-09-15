"use strict";

/**
 * La firma de subida directa.
 *
 * Lo que se protege: que la llamada a Storage lleve **cuerpo**. Se declaraba
 * `Content-Type: application/json` y no se mandaba nada, y Storage contesta 400
 * —«Body cannot be empty when content-type is set to application/json»— que
 * esta ruta convertía en un 500.
 *
 * Y no lo notaba nadie: quien la llama se traga el fallo y sigue por el camino
 * de respaldo, mandando el fichero entero en base64 a través de la API. Los
 * papeles acababan guardados, así que parecía que funcionaba — pero por el
 * camino lento, el que revienta con un fichero grande.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs.readFileSync(path.join(__dirname, "storage-presign-handler.js"), "utf8");

describe("la llamada a Storage", () => {
  test("manda cuerpo", () => {
    assert.match(FUENTE, /body: "\{\}"/);
  });

  test("y lo manda junto al content-type que lo exige", () => {
    /*
     * El 400 sale de la combinación: `application/json` sin cuerpo. Con uno de
     * los dos solo no pasa nada, así que se comprueban juntos.
     */
    const llamada = FUENTE.slice(
      FUENTE.indexOf("object/upload/sign"),
      FUENTE.indexOf("if (!response.ok)"),
    );
    assert.match(llamada, /"Content-Type": "application\/json"/);
    assert.match(llamada, /body: "\{\}"/);
  });

  test("lleva apikey ademas del Authorization", () => {
    // Sin `apikey` la clave nueva de Supabase no vale: no es un JWT y Storage
    // contesta «Invalid Compact JWS».
    const llamada = FUENTE.slice(
      FUENTE.indexOf("object/upload/sign"),
      FUENTE.indexOf("if (!response.ok)"),
    );
    assert.match(llamada, /apikey: SUPABASE_SERVICE_KEY/);
  });
});

describe("las puertas de la ruta", () => {
  test("sin sesion no se firma nada", () => {
    assert.match(FUENTE, /if \(!email\) return res\.status\(401\)/);
  });

  test("y el vehiculo tiene que ser suyo", () => {
    // El identificador es un UUID y no se adivina, pero eso es un obstaculo,
    // no un permiso.
    assert.match(FUENTE, /esSuyo\(nt\(vehicleId\), email\)/);
    assert.match(FUENTE, /vehiculo_no_encontrado/);
  });
});
