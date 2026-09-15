"use strict";

/**
 * Que ningún aviso de «no se ha guardado» mire un campo que el servidor no manda.
 *
 * La pantalla de IdCars comprueba, después de guardar, que el coche que devuelve
 * el servidor trae lo que ella envió; si no, avisa. La comprobación del
 * mantenimiento miraba `persistedByServer.maintenanceTitle`, y ese campo **no
 * existe** en la respuesta: el sanitizador del servidor lo agrupa dentro de
 * `initialMaintenance`. Así que saltaba siempre —con todo guardado— en cuanto el
 * formulario tenía un título de mantenimiento, que lo tiene solo con abrir el
 * coche porque el propio servidor le pone «Mantenimiento» por defecto.
 *
 * Un aviso que grita con los datos a salvo enseña a no hacer caso de los avisos,
 * y el día que falle de verdad nadie lo mirará.
 *
 * Por eso esto no prueba el mantenimiento: saca del código de la pantalla
 * **todos** los campos que se comprueban y exige que cada uno exista en lo que
 * el servidor devuelve. El siguiente que se añada mal cae aquí.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sanitizeGarageVehicle } = require("./billingStore");

const PANTALLA = fs.readFileSync(
  path.join(__dirname, "..", "src", "pages", "ServiceIdCarsManagePage.js"),
  "utf8"
);

/** Un coche con todo relleno, tal y como sale del servidor. */
const ELCOCHE = sanitizeGarageVehicle({
  id: "veh-1",
  title: "Volkswagen T-Roc",
  brand: "Volkswagen",
  model: "T-Roc",
  plate: "8888LXR",
  year: "2022",
  policyCompany: "Mapfre",
  policyNumber: "P-1",
  coverageType: "todo riesgo",
  initialMaintenance: { type: "maintenance", title: "Mantenimiento", notes: "", invoices: [] },
});

/** Los caminos que la pantalla lee del coche devuelto: `a?.b?.c` → ["a","b","c"]. */
function loQueComprueba(codigo) {
  const caminos = new Set();
  const patron = /persistedByServer\?\.([A-Za-z0-9_?.]+)/g;
  let m;
  while ((m = patron.exec(codigo)) !== null) {
    caminos.add(m[1].replace(/\?/g, "").replace(/\.$/, ""));
  }
  return [...caminos];
}

/** Sigue un camino como «initialMaintenance.title» dentro del objeto. */
function loQueHayEn(objeto, camino) {
  return camino.split(".").reduce((o, paso) => (o == null ? undefined : o[paso]), objeto);
}

describe("lo que la pantalla da por guardado, el servidor lo manda", () => {
  const caminos = loQueComprueba(PANTALLA);

  test("hay comprobaciones que mirar", () => {
    // Si un día dejan de existir, estos tests pasarían por vacíos y no por buenos.
    assert.ok(caminos.length >= 2, `solo encuentro ${caminos.length}: ${caminos.join(", ")}`);
  });

  for (const camino of caminos) {
    test(`«${camino}» viene en la respuesta`, () => {
      const valor = loQueHayEn(ELCOCHE, camino);
      assert.notEqual(
        valor,
        undefined,
        `la pantalla avisa de que no se ha guardado «${camino}», y el servidor no manda ese campo: ` +
        "el aviso saltaria con los datos a salvo"
      );
    });
  }
});

describe("y el mantenimiento en concreto", () => {
  test("viaja dentro de initialMaintenance, no suelto", () => {
    // Es el que fallaba. Aqui queda escrito dónde está de verdad.
    assert.equal(ELCOCHE.initialMaintenance.title, "Mantenimiento");
    assert.equal(ELCOCHE.maintenanceTitle, undefined);
  });
});
