"use strict";

/**
 * El papel del precio que sube el cliente.
 *
 * Dos cosas se protegen aquí. Que el encargo sea **suyo** —el identificador
 * viaja por la red y no prueba nada— y que la casilla `acepto_el_precio` la
 * encienda el documento y no nosotros: marcarla a mano es el mismo dato que el
 * ERP se escribía a sí mismo y que la firma del mandato vino a quitar.
 *
 * Y el orden: primero el fichero, después la marca. Al revés, un fallo al subir
 * dejaría el encargo diciendo que aceptó el precio sin tener el papel.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../clausula-del-precio");
const FUENTE = fs.readFileSync(path.join(__dirname, "clausula-precio-handler.js"), "utf8");

describe("el encargo tiene que ser suyo", () => {
  test("se busca por el correo de la sesión", () => {
    assert.match(C.SQL_SU_ENCARGO, /lower\(e\.cliente_email\) = lower\(\$2\)/);
  });

  test("y no por lo que venga en el cuerpo", () => {
    assert.ok(FUENTE.includes("identidadDeLaPeticion(req"), "la identidad no sale de la sesión");
    assert.ok(!/body\.email/.test(FUENTE), "se está leyendo el correo del cuerpo");
  });

  test("ni de un encargo ya cerrado", () => {
    assert.match(C.SQL_SU_ENCARGO, /e\.cerrado_at IS NULL/);
  });
});

describe("cuándo se acepta la subida", () => {
  test("no antes del taller", () => {
    /*
     * El precio se fija con lo que diga. Si el papel llega antes es que alguien
     * guardó un enlace viejo, y dejarle firmado un precio que no está fijado es
     * dejarle firmado algo que vamos a tener que cambiar.
     */
    assert.match(
      C.porQueNoTocaTodavia({ firmado_at: "2026-09-15", taller_estado: "En el taller", precio_referencia: 13500 }),
      /taller/,
    );
  });

  test("ni sin mandato firmado", () => {
    assert.match(
      C.porQueNoTocaTodavia({ firmado_at: null, taller_estado: "Hecha", precio_referencia: 13500 }),
      /mandato/,
    );
  });

  test("ni sin precio acordado", () => {
    assert.match(
      C.porQueNoTocaTodavia({ firmado_at: "2026-09-15", taller_estado: "Hecha", precio_referencia: null }),
      /precio/,
    );
  });

  test("con las tres, sí", () => {
    assert.equal(
      C.porQueNoTocaTodavia({ firmado_at: "2026-09-15", taller_estado: "Hecha", precio_referencia: 13500 }),
      "",
    );
  });

  test("y el handler lo comprueba de verdad", () => {
    // La regla puede estar perfecta y no llamarse: es el fallo de siempre.
    assert.ok(FUENTE.includes("C.porQueNoTocaTodavia(e)"), "no se comprueba que toque");
  });
});

describe("lo que enciende «aceptó el precio»", () => {
  test("es el documento, no una casilla nuestra", () => {
    assert.match(C.SQL_MARCA_ACEPTADA, /acepto_el_precio = TRUE/);
    assert.match(C.SQL_MARCA_ACEPTADA, /clausula_firmada_at = NOW\(\)/);
  });

  test("y de paso se le pone el plazo para irse gratis", () => {
    /*
     * `libre_desde` sale de la firma del **mandato** más los 30 días, no de
     * esta. Sin recalcularlo, el cliente aceptaría el precio y el ERP seguiría
     * diciendo que no tiene plazo — que es justo lo que gana firmando.
     */
    assert.match(C.SQL_MARCA_ACEPTADA, /libre_desde = CASE WHEN firmado_at IS NOT NULL/);
    assert.match(C.SQL_MARCA_ACEPTADA, /INTERVAL '30 days'/);
  });

  test("firmar dos veces no reescribe la primera fecha", () => {
    assert.match(C.SQL_MARCA_ACEPTADA, /clausula_firmada_at IS NULL/);
  });
});

describe("primero el fichero y después la marca", () => {
  test("ese es el orden en el código", () => {
    const guarda = FUENTE.indexOf("SQL_GUARDA_DOCUMENTO");
    const marca = FUENTE.indexOf("SQL_MARCA_ACEPTADA");
    assert.ok(guarda > 0 && marca > 0, "falta alguno de los dos");
    assert.ok(guarda < marca, "se está marcando el encargo antes de guardar el papel");
  });

  test("y el papel va al cajón privado", () => {
    // Lleva su nombre, su matrícula, el precio de su coche y su firma.
    assert.ok(FUENTE.includes("BUCKET_PRIVADO"), "el papel firmado iría al bucket público");
  });
});
