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

/**
 * Y la dirección que se le devuelve al que sube.
 *
 * Storage la da **relativa a `/storage/v1`**, y se pegaba al dominio a secas:
 * salía `https://…supabase.co/object/upload/sign/…`, que no existe. Contesta
 * 404 y —esto es lo que costaba de ver— sin cabeceras de CORS, así que el
 * navegador no dice «404», dice «Failed to fetch». En la app era un error en
 * pantalla al subir una foto; en la web no se notaba porque el fallo se traga
 * y se sigue por el camino de respaldo en base64.
 *
 * Comprobado contra Storage de verdad el 22 de septiembre de 2026: con la
 * dirección de antes, 404 «requested path is invalid»; con esta, 200.
 */
describe("la dirección de subida que se devuelve", () => {
  /** La misma regla que el manejador, para probarla sin base ni red. */
  const arma = (base, url) => {
    const relativa = String(url || "");
    return /^https?:\/\//i.test(relativa)
      ? relativa
      : `${base}${relativa.startsWith("/storage/v1") ? "" : "/storage/v1"}${relativa}`;
  };
  const BASE = "https://x.supabase.co";

  test("lleva /storage/v1, que es lo que Storage no devuelve", () => {
    assert.equal(
      arma(BASE, "/object/upload/sign/b/x.jpg?token=t"),
      "https://x.supabase.co/storage/v1/object/upload/sign/b/x.jpg?token=t",
    );
  });

  test("y no se lo pone dos veces si algún día viene puesto", () => {
    assert.equal(
      arma(BASE, "/storage/v1/object/upload/sign/b/x.jpg?token=t"),
      "https://x.supabase.co/storage/v1/object/upload/sign/b/x.jpg?token=t",
    );
  });

  test("ni le pone dominio a una dirección que ya lo trae", () => {
    const entera = "https://x.supabase.co/storage/v1/object/upload/sign/b/x.jpg?token=t";
    assert.equal(arma(BASE, entera), entera);
  });

  test("el manejador usa esa regla, no la concatenación de antes", () => {
    assert.match(FUENTE, /relativa\.startsWith\("\/storage\/v1"\)/);
    assert.ok(
      !/const signedUrl = `\$\{SUPABASE_URL\}\$\{data\.url\}`/.test(FUENTE),
      "ha vuelto la concatenación que daba 404",
    );
  });

  test("la dirección pública sí la arma entera, y eso no cambia", () => {
    assert.match(FUENTE, /\/storage\/v1\/object\/public\//);
  });
});
