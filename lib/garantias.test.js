/**
 * Las garantías que se le ofrecen a un coche.
 *
 * Dos cosas que no pueden fallar: que no se ofrezca una garantía que ese coche
 * no puede tener, y que no se ofrezca renunciar a una que no es renunciable.
 * La primera es una promesa que se cae después; la segunda es ofrecer algo que
 * no se puede cumplir.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  seLePuedeOfrecer, opcionesParaElCoche, precioDeLaElegida,
} = require("./garantias.js");

const ESTE_ANIO = new Date().getFullYear();

function garantia(x) {
  return {
    id: "GAR-1", nombre: "Básica 12 meses", nivel: 1, es_base: true,
    renunciable: true, meses: 12, precio: 180, activo: true,
    antiguedad_max_anios: null, km_max_vehiculo: null, coberturas: [],
    ...x,
  };
}

const COCHE = { year: ESTE_ANIO - 5, mileage: 90000 };

describe("a qué coches se les puede ofrecer", () => {
  test("sin límites, a todos", () => {
    assert.equal(seLePuedeOfrecer(garantia({}), COCHE), true);
  });

  test("un coche más viejo que el tope, no", () => {
    const g = garantia({ antiguedad_max_anios: 4 });
    assert.equal(seLePuedeOfrecer(g, COCHE), false);
    assert.equal(seLePuedeOfrecer(g, { year: ESTE_ANIO - 3, mileage: 10000 }), true);
  });

  test("ni uno con más kilómetros de los que cubre", () => {
    const g = garantia({ km_max_vehiculo: 80000 });
    assert.equal(seLePuedeOfrecer(g, COCHE), false);
  });

  test("una dada de baja no se ofrece aunque encaje", () => {
    assert.equal(seLePuedeOfrecer(garantia({ activo: false }), COCHE), false);
  });

  test("un coche sin año no descarta una garantía por antigüedad", () => {
    const g = garantia({ antiguedad_max_anios: 4 });
    assert.equal(seLePuedeOfrecer(g, { mileage: 10000 }), true,
      "no saber la edad no es lo mismo que ser viejo");
  });
});

describe("lo que se le presenta al cliente", () => {
  const base = garantia({ id: "GAR-base", nivel: 1, es_base: true, precio: 180 });
  const premium = garantia({ id: "GAR-premium", nivel: 2, es_base: false, precio: 420, meses: 24 });

  test("la base y las demás como diferencia sobre ella", () => {
    const { opciones } = opcionesParaElCoche([base, premium], COCHE);
    const porId = Object.fromEntries(opciones.map((o) => [o.id, o.diferencia]));
    assert.equal(porId["GAR-base"], 0, "la base no suma: ya está en el precio");
    assert.equal(porId["GAR-premium"], 240);
  });

  test("si la base es renunciable, sale la opción de quitarla, en negativo", () => {
    const { opciones } = opcionesParaElCoche([base], COCHE);
    const sin = opciones.find((o) => o.id === null);
    assert.ok(sin);
    assert.equal(sin.diferencia, -180);
  });

  test("si no es renunciable, esa opción no existe", () => {
    // El mínimo legal no se puede quitar aunque el cliente quiera.
    const { opciones } = opcionesParaElCoche([garantia({ renunciable: false })], COCHE);
    assert.ok(!opciones.some((o) => o.id === null),
      "ofrecer renunciar al mínimo legal es ofrecer algo que no se puede cumplir");
  });

  test("una que ese coche no puede tener no se enseña", () => {
    const noApta = garantia({ id: "GAR-nope", es_base: false, antiguedad_max_anios: 2, precio: 500 });
    const { opciones } = opcionesParaElCoche([base, noApta], COCHE);
    assert.ok(!opciones.some((o) => o.id === "GAR-nope"));
  });

  test("sin catálogo no se ofrece nada, y no revienta", () => {
    assert.deepEqual(opcionesParaElCoche([], COCHE), { base: null, opciones: [] });
    assert.deepEqual(opcionesParaElCoche(null, COCHE), { base: null, opciones: [] });
  });

  test("sin base no hay nada que ofrecer: no hay sobre qué sumar", () => {
    const suelta = garantia({ es_base: false });
    assert.deepEqual(opcionesParaElCoche([suelta], COCHE).opciones, []);
  });

  test("salen por nivel, no por como vengan de la base", () => {
    const { opciones } = opcionesParaElCoche([premium, base], COCHE);
    assert.equal(opciones[0].id, "GAR-base");
  });
});

describe("lo que se le cobra por la que eligió", () => {
  const base = garantia({ id: "GAR-base", precio: 180 });
  const premium = garantia({ id: "GAR-premium", es_base: false, nivel: 2, precio: 420 });

  test("la base, si no elige nada raro", () => {
    assert.deepEqual(precioDeLaElegida([base, premium], COCHE, "GAR-base"),
      { id: "GAR-base", precio: 180 });
  });

  test("la premium, a su precio entero", () => {
    assert.deepEqual(precioDeLaElegida([base, premium], COCHE, "GAR-premium"),
      { id: "GAR-premium", precio: 420 });
  });

  test("sin garantía, cero", () => {
    assert.deepEqual(precioDeLaElegida([base], COCHE, null), { id: null, precio: 0 });
  });

  test("renunciar a la que no es renunciable no cuela", () => {
    const obligatoria = garantia({ renunciable: false, precio: 180 });
    assert.deepEqual(precioDeLaElegida([obligatoria], COCHE, null),
      { id: "GAR-1", precio: 180 });
  });

  test("pedir una que no se le puede dar cae a la base, no la acepta", () => {
    const noApta = garantia({ id: "GAR-nope", es_base: false, antiguedad_max_anios: 1, precio: 900 });
    assert.deepEqual(precioDeLaElegida([base, noApta], COCHE, "GAR-nope"),
      { id: "GAR-base", precio: 180 },
      "el precio no puede depender de lo que llegue en una petición");
  });

  test("pedir una inventada tampoco", () => {
    assert.deepEqual(precioDeLaElegida([base], COCHE, "GAR-de-mentira"),
      { id: "GAR-base", precio: 180 });
  });
});
