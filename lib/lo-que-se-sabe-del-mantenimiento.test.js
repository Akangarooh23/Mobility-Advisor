"use strict";

/**
 * Lo que se sabe del mantenimiento.
 *
 * Lo que se protege: que lo guardado sea lo que dijo el vendedor. Nada más y
 * nada menos — porque esto acaba en el anuncio, y ahí un dato inventado lo
 * firma él sin haberlo dicho.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./lo-que-se-sabe-del-mantenimiento");

describe("las respuestas son tres y cerradas", () => {
  test("sí, no y no lo sé", () => {
    assert.deepEqual(M.RESPUESTAS, ["si", "no", "no_lo_se"]);
  });

  test("«no lo sé» es una respuesta, no un hueco", () => {
    /*
     * Sin ella, «vacío» significaría dos cosas: no ha contestado y no lo sabe.
     * La primera se arregla llamándole y la segunda no, y son llamadas
     * distintas.
     */
    assert.equal(M.laRespuesta("no_lo_se"), "no_lo_se");
    assert.notEqual(M.laRespuesta("no_lo_se"), M.laRespuesta(""));
  });

  test("se aceptan escritas de varias maneras", () => {
    for (const escrito of ["si", "SI", " Si ", "no lo se", "no-lo-se", "NO_LO_SE"]) {
      assert.ok(M.RESPUESTAS.includes(M.laRespuesta(escrito)), escrito);
    }
  });

  test("y lo que no es una de las tres se queda fuera", () => {
    // Un valor inventado en esta columna se cuela en el anuncio como si lo
    // hubiera dicho el vendedor.
    for (const raro of ["quizas", "true", "1", "sí, con facturas", null, undefined, {}]) {
      assert.equal(M.laRespuesta(raro), "", String(raro));
    }
  });
});

describe("los kilómetros de la última revisión", () => {
  test("se quedan en el número", () => {
    assert.equal(M.losKilometros("120.000 km"), "120000");
    assert.equal(M.losKilometros("85000"), "85000");
    assert.equal(M.losKilometros(" 42 500 "), "42500");
  });

  test("y lo absurdo no pasa", () => {
    assert.equal(M.losKilometros("0"), "");
    assert.equal(M.losKilometros("99999999"), "");
    assert.equal(M.losKilometros("no me acuerdo"), "");
    assert.equal(M.losKilometros(""), "");
  });
});

describe("la fecha de la última revisión", () => {
  const HOY = new Date("2026-09-15T12:00:00Z");

  test("una pasada vale", () => {
    assert.equal(M.laFecha("2025-12-15", HOY), "2025-12-15");
  });

  test("una futura no", () => {
    /*
     * Si viene una futura es que ha confundido el campo con la próxima ITV.
     * Guardarla diría que el coche está más al día de lo que está.
     */
    assert.equal(M.laFecha("2027-12-15", HOY), "");
  });

  test("y lo que no es una fecha tampoco", () => {
    for (const malo of ["15/12/2025", "ayer", "2025-13-40", "", null]) {
      assert.equal(M.laFecha(malo, HOY), "", String(malo));
    }
  });
});

describe("lo que se guarda de un coche", () => {
  const HOY = new Date("2026-09-15T12:00:00Z");

  test("las cuatro claves siempre, vacías si no hay nada", () => {
    // Así la pantalla no distingue «no vino» de «vino vacío».
    const nada = M.loQueSeSabe({}, HOY);
    assert.deepEqual(Object.keys(nada).sort(), [
      "libroMantenimiento", "revisionesOficiales", "ultimaRevisionFecha", "ultimaRevisionKm",
    ]);
    for (const v of Object.values(nada)) assert.equal(v, "");
  });

  test("y lo que dijo, tal cual", () => {
    assert.deepEqual(
      M.loQueSeSabe({
        libroMantenimiento: "SI",
        revisionesOficiales: "no lo se",
        ultimaRevisionFecha: "2025-12-15",
        ultimaRevisionKm: "120.000 km",
      }, HOY),
      {
        libroMantenimiento: "si",
        revisionesOficiales: "no_lo_se",
        ultimaRevisionFecha: "2025-12-15",
        ultimaRevisionKm: "120000",
      }
    );
  });
});

describe("saber si ha contestado", () => {
  test("no haber contestado nada no es haber dicho que no", () => {
    /*
     * Es la diferencia entre «este coche no tiene libro» y «no se lo hemos
     * preguntado todavía». Lo primero baja el precio; lo segundo es una llamada.
     */
    assert.equal(M.haContestadoAlgo(M.loQueSeSabe({})), false);
    assert.equal(M.haContestadoAlgo(M.loQueSeSabe({ libroMantenimiento: "no" })), true);
    assert.equal(M.haContestadoAlgo(M.loQueSeSabe({ libroMantenimiento: "no_lo_se" })), true);
    assert.equal(M.haContestadoAlgo(M.loQueSeSabe({ ultimaRevisionKm: "90000" })), true);
  });
});

describe("las preguntas dicen para qué se pregunta", () => {
  test("cada una lleva su porqué", () => {
    // Pedir un dato sin decir para qué es pedirle un favor.
    assert.ok(M.LAS_PREGUNTAS.length >= 2);
    for (const p of M.LAS_PREGUNTAS) {
      assert.ok(p.pregunta.trim().length > 10, p.clave);
      assert.ok(p.porQue.trim().length > 10, `${p.clave} no dice para qué sirve`);
      assert.ok(p.columna.trim(), `${p.clave} no dice dónde se guarda`);
    }
  });

  test("y todo lo que se guarda tiene columna", () => {
    for (const c of M.LO_QUE_SE_GUARDA) {
      assert.ok(c.clave && c.columna, JSON.stringify(c));
    }
  });
});
