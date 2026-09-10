"use strict";

/**
 * La tasación gratuita, que es de donde sale el precio del encargo.
 *
 * El cliente tiene que hacérsela: sin ella no hay número del que hablar, y sin
 * número acordado publicar seria poner un precio que no ha dicho nadie.
 *
 * Lo que se protege aquí es que esa tasación quede **atada a su coche**. Se
 * guardaba suelta —con el nombre del coche escrito, pero sin el identificador—
 * asi que no habia forma de saber de cual era.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const APP = leer("src/App.js");

describe("la tasación se ata al coche", () => {
  test("se manda el identificador al guardarla", () => {
    assert.match(APP, /vehicleId: normalizeText\(selectedValuationVehicleSummary\?\.id\) \|\| ""/);
  });

  test("y el identificador llega hasta ahi", () => {
    /*
     * Se perdia en el resumen: quien pide la tasacion desde su IDCar manda el
     * vehiculo entero, pero al resumen solo pasaban matricula y titulo.
     */
    const resumen = APP.slice(APP.indexOf("setSelectedValuationVehicleSummary(\n      hasVehiclePrefill"));
    const hasta = resumen.indexOf(": null");
    assert.match(resumen.slice(0, hasta), /id: normalizeText\(context\?\.id\)/);
  });

  test("quien tasa sin elegir coche no inventa uno", () => {
    // La tasacion generica sigue existiendo y se guarda sin coche: es lo que
    // pasaba siempre, y no hay nada que atar.
    assert.match(APP, /\|\| ""/);
    assert.ok(
      !/vehicleId: [^\n]*\|\| "veh/.test(APP),
      "se esta inventando un identificador cuando no hay coche",
    );
  });
});
