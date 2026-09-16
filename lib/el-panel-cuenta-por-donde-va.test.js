"use strict";

/**
 * Lo que el panel del cliente sabe de su encargo, y lo que no.
 *
 * Con las ocho puertas hechas, la pantalla le decía «ya está todo, nos ponemos
 * con la venta» y ahí se acababa: por dentro el coche iba al taller, se
 * preparaba el anuncio y se publicaba, y él no veía moverse nada en días.
 *
 * Y hay algo que **no** puede salir de aquí: el veredicto del taller. Si dijo
 * que así no se puede vender, eso se habla por teléfono —es la única de las seis
 * puertas que se resuelve hablando— y enterarse por una línea del panel antes de
 * esa llamada es la peor manera de enterarse.
 *
 * Se lee el fuente: probarlo de verdad pide la base entera, y lo que se protege
 * aquí es qué se manda y qué no, que se ve en el fuente.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TIENDA = fs.readFileSync(path.join(__dirname, "billingStore.js"), "utf8").replace(/\r\n/g, "\n");
const BLOQUE = TIENDA.slice(
  TIENDA.indexOf("estadoPorLead[s(r.id)] = {"),
  TIENDA.indexOf("estadoPorLead[s(r.id)] = {") + 700,
);

describe("por dónde va su encargo", () => {
  test("se le manda al panel", () => {
    // Calcularlo y no mandarlo es el silencio de siempre: la pantalla no puede
    // enseñar lo que no le llega.
    assert.ok(TIENDA.includes("estado_encargo: estadoPorLead[s(r.id)] || null"),
      "el estado del encargo no llega al panel");
  });

  test("dice si la revisión está hecha y si se publicó", () => {
    assert.match(BLOQUE, /taller_hecho:/);
    assert.match(BLOQUE, /publicado:/);
    assert.match(BLOQUE, /anuncio_url:/);
  });

  test("y el veredicto del taller NO se le manda", () => {
    /*
     * Lo que viaja es `taller_ok`, un sí o un no. El texto del resultado
     * —«no se puede vender así»— se queda en el ERP, donde hay alguien que lo
     * lee antes de llamar.
     */
    assert.ok(!/resultado:\s*s\(rev/.test(BLOQUE),
      "el resultado del taller se está mandando al panel del cliente");
  });

  test("con el taller en contra, taller_ok es falso", () => {
    // Es lo que separa «estamos preparando tu anuncio» —que ya no va a pasar—
    // de «te llamamos».
    assert.match(BLOQUE, /taller_ok:[\s\S]*no_se_puede_vender/);
  });
});

describe("la cita solo cuando es cosa suya", () => {
  test("no se le enseña una revisión ya hecha", () => {
    // Enseñarle la cita con la revisión hecha es pedirle que lleve un coche que
    // ya llevó.
    assert.ok(TIENDA.includes("if (rev && rev.cita_at && !tallerHecho && rev.avisado_at)"),
      "la cita se enseñaría con la revisión hecha o sin habérsela contado");
  });
});
