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
const { declaraColumna } = require("./lo-que-declaran-las-migraciones");
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

describe("el esquema existe de verdad", () => {
  /*
   * Aquí había dos pruebas que ya no tienen sentido, y merece la pena saber
   * por qué, porque la que se va era buena para lo que había.
   *
   * `billingStore` creaba su esquema dentro de las peticiones, con un atajo:
   * si existía la última columna añadida, se saltaba los setenta y seis ALTER
   * de abajo. Eso obligaba a una regla incómoda —«las columnas nuevas van al
   * final del bloque»— y a una prueba que la vigilara, porque meter una en
   * medio hacía que no se creara **nunca** en producción, y eso no se veía al
   * arrancar: se veía al guardar.
   *
   * Ese atajo ya no existe: el esquema lo declaran las migraciones. Así que la
   * pregunta deja de ser «¿está bien escrito el atajo?» y pasa a ser la única
   * que de verdad importaba: **¿existen las columnas?**
   */
  test("las cuatro columnas del mantenimiento las declaran las migraciones", () => {
    for (const { columna } of M.LO_QUE_SE_GUARDA) {
      assert.ok(
        declaraColumna("moveadvisor_user_vehicles", columna),
        `falta ${columna} en migrations/: una base nueva no la tendría`
      );
    }
  });

  test("y nadie las vuelve a crear a mano desde el almacén", () => {
    // Mientras el almacén las cree por su cuenta, vuelve a haber dos sitios
    // que describen el mismo esquema y ninguno manda sobre el otro.
    assert.ok(
      !/ADD COLUMN IF NOT EXISTS/.test(TIENDA),
      "billingStore ha vuelto a crear esquema dentro de las peticiones"
    );
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
