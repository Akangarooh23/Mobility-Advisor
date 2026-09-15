"use strict";

/**
 * Que lo que el vendedor contesta del mantenimiento llegue hasta la base.
 *
 * Son cuatro datos que cruzan cinco capas: el formulario, lo que se manda, el
 * saneador, el INSERT y la lectura. Cada capa nombra sus campos a mano, así que
 * basta con olvidarse de uno en una de ellas para que la pantalla lo pregunte,
 * el cliente lo conteste y no se guarde — sin ningún error por ninguna parte.
 * Es exactamente lo que pasaba con los papeles y con el correo de la factura.
 *
 * Aquí se sigue el dato por las cinco.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("./lo-que-se-sabe-del-mantenimiento");
const { sanitizeGarageVehicle } = require("./billingStore");

const TIENDA = fs.readFileSync(path.join(__dirname, "billingStore.js"), "utf8");
const PANTALLA = fs.readFileSync(
  path.join(__dirname, "..", "src", "pages", "ServiceIdCarsManagePage.js"), "utf8"
);
const GEMELO = fs.readFileSync(
  path.join(__dirname, "..", "src", "utils", "preguntasDelMantenimiento.js"), "utf8"
);

const LAS_CLAVES = M.LO_QUE_SE_GUARDA.map((c) => c.clave);

describe("las cuatro respuestas cruzan las cinco capas", () => {
  test("hay cuatro cosas que seguir", () => {
    assert.equal(LAS_CLAVES.length, 4, LAS_CLAVES.join(", "));
  });

  for (const { clave, columna } of M.LO_QUE_SE_GUARDA) {
    test(`«${clave}» va del formulario a la base`, () => {
      assert.match(PANTALLA, new RegExp(`${clave}: ""`),
        "no está en el formulario vacío: al crear un coche saldría indefinido");
      assert.match(PANTALLA, new RegExp(`${clave}: normalizeText\\(vehicle\\.${clave}\\)`),
        "no se carga al abrir un coche: el vendedor vería vacío lo que ya contestó");
      assert.match(PANTALLA, new RegExp(`${clave}: normalizeText\\(form\\.${clave}\\)`),
        "no se manda al guardar: se contesta y se pierde");
      assert.ok(TIENDA.includes(`normalizedVehicle.${clave}`),
        `no se escribe: falta en los parámetros del INSERT`);
      assert.ok(TIENDA.includes(`${columna}, official_service`) || TIENDA.includes(columna),
        `la columna ${columna} no aparece en el servidor`);
    });
  }

  test("y vuelven leídas del coche", () => {
    for (const { clave, columna } of M.LO_QUE_SE_GUARDA) {
      assert.match(TIENDA, new RegExp(`${clave}: row\\.${columna}`),
        `${clave} no se lee de la columna ${columna}: se guardaría y no volvería nunca`);
    }
  });

  test("el saneador las devuelve, que es lo que ve la pantalla", () => {
    const coche = sanitizeGarageVehicle({
      id: "veh-1",
      libroMantenimiento: "si",
      revisionesOficiales: "no",
      ultimaRevisionFecha: "2025-12-15",
      ultimaRevisionKm: "90000",
    });
    assert.deepEqual(
      LAS_CLAVES.map((c) => coche[c]),
      ["si", "no", "2025-12-15", "90000"]
    );
  });
});

describe("el esquema se crea de verdad", () => {
  test("el atajo prueba la última columna añadida", () => {
    /*
     * `ensureMobilitySchemaPostgres` se salta todos los ALTER si la columna que
     * prueba ya existe. Probando una vieja, las nuevas no se crean nunca en
     * producción — y eso no se ve al arrancar, se ve al guardar.
     */
    assert.match(TIENDA, /SELECT last_service_km FROM moveadvisor_user_vehicles LIMIT 0/,
      "el atajo del esquema prueba otra columna: las nuevas no se crearían");
  });

  test("y las cuatro columnas se añaden", () => {
    for (const { columna } of M.LO_QUE_SE_GUARDA) {
      assert.ok(
        TIENDA.includes(`ADD COLUMN IF NOT EXISTS ${columna} `),
        `falta el ALTER de ${columna}`
      );
    }
  });
});

describe("las dos copias de las respuestas dicen lo mismo", () => {
  test("la pantalla ofrece justo lo que el servidor acepta", () => {
    /*
     * La pantalla no puede importar de `lib/`, así que la lista está repetida.
     * Con una respuesta de más, el vendedor elegiría algo que el servidor tira
     * a la basura sin decir nada.
     */
    const enLaPantalla = [...GEMELO.matchAll(/\["([a-z_]+)",/g)].map((m) => m[1]);
    assert.deepEqual(enLaPantalla, M.RESPUESTAS);
  });
});
