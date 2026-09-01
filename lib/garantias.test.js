/**
 * Las garantías que se le ofrecen a un coche.
 *
 * No las damos nosotros: PopCar no vende el coche, así que no debe la garantía.
 * Son productos de un tercero que el cliente añade si quiere, y ninguna va
 * incluida en el precio.
 *
 * Dos cosas que no pueden fallar: que no se ofrezca una garantía que ese coche
 * no puede tener —una promesa que se cae después, cuando el cliente ya ha
 * contado con ella— y que el precio no dependa de lo que llegue en la petición.
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
  const basica = garantia({ id: "GAR-basica", nivel: 1, precio: 290, meses: 12 });
  const ampliada = garantia({ id: "GAR-ampliada", nivel: 2, precio: 590, meses: 24 });

  test("cada una con su precio entero, no con una diferencia", () => {
    // Antes se enseñaban como diferencias porque había una base ya incluida en
    // el precio. Ahora no hay nada incluido: son productos sueltos.
    const { opciones } = opcionesParaElCoche([basica, ampliada], COCHE);
    const porId = Object.fromEntries(opciones.map((o) => [o.id, o.precio]));
    assert.equal(porId["GAR-basica"], 290);
    assert.equal(porId["GAR-ampliada"], 590);
    assert.ok(!opciones.some((o) => "diferencia" in o), "queda el modelo de diferencias");
  });

  test("no hay ninguna incluida", () => {
    // PopCar no vende el coche, así que no debe la garantía. Marcar una como
    // «incluida» sería decir que va en el precio, y no va.
    const { base } = opcionesParaElCoche([basica, ampliada], COCHE);
    assert.equal(base, null);
  });

  test("la primera opción es no coger ninguna", () => {
    // No es un descarte: es lo que pasa si no hace nada. Ponerla primera dice la
    // verdad de la situación, que es que la garantía es opcional.
    const { opciones } = opcionesParaElCoche([basica, ampliada], COCHE);
    assert.equal(opciones[0].id, null);
    assert.equal(opciones[0].precio, 0);
    assert.match(opciones[0].nombre, /sin garant/i);
  });

  test("salen por nivel, de menos a más", () => {
    const { opciones } = opcionesParaElCoche([ampliada, basica], COCHE);
    assert.deepEqual(opciones.map((o) => o.id), [null, "GAR-basica", "GAR-ampliada"]);
  });

  test("no se ofrece una que a ese coche no se le puede dar", () => {
    // Enseñar una opción que luego se cae es peor que no enseñarla: el cliente
    // ya ha contado con ella.
    const soloNuevos = garantia({ id: "GAR-nuevos", antiguedad_max_anios: 2 });
    const { opciones } = opcionesParaElCoche([basica, soloNuevos], COCHE);
    assert.ok(!opciones.some((o) => o.id === "GAR-nuevos"));
  });

  test("con el catálogo vacío no se ofrece nada", () => {
    assert.deepEqual(opcionesParaElCoche([], COCHE), { base: null, opciones: [] });
  });
});

describe("lo que se le cobra por la que eligió", () => {
  const basica = garantia({ id: "GAR-basica", nivel: 1, precio: 290 });
  const ampliada = garantia({ id: "GAR-ampliada", nivel: 2, precio: 590 });
  const CAT = [basica, ampliada];

  test("lo que cuesta la que ha elegido", () => {
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, "GAR-ampliada"), { id: "GAR-ampliada", precio: 590 });
  });

  test("sin elegir ninguna, cero", () => {
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, null), { id: null, precio: 0 });
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, undefined), { id: null, precio: 0 });
  });

  test("una inventada no cuela: sale a cero, no se acepta", () => {
    // El navegador dice cuál quiere, no cuánto cuesta. Aceptar un identificador
    // que no existe sería dejar que el cliente ponga el precio.
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, "la-que-me-invento"), { id: null, precio: 0 });
  });

  test("y una que a ese coche no se le puede dar, tampoco", () => {
    const soloNuevos = garantia({ id: "GAR-nuevos", antiguedad_max_anios: 2, precio: 900 });
    assert.deepEqual(precioDeLaElegida([basica, soloNuevos], COCHE, "GAR-nuevos"), { id: null, precio: 0 });
  });
});

