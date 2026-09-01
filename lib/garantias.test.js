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

  test("cada una con su precio y con lo que le cambia el total", () => {
    // El precio para saber lo que cuesta; la diferencia para saber lo que le
    // cambia el número que está mirando, que ya lleva una puesta.
    const { opciones } = opcionesParaElCoche([basica, ampliada], COCHE);
    const porId = Object.fromEntries(opciones.map((o) => [o.id, o]));
    assert.equal(porId["GAR-basica"].precio, 290);
    assert.equal(porId["GAR-basica"].diferencia, 0, "es la que lleva el precio");
    assert.equal(porId["GAR-ampliada"].precio, 590);
    assert.equal(porId["GAR-ampliada"].diferencia, 300);
  });

  test("la de por defecto es la más barata que se le pueda dar", () => {
    // No sale de una marca en la base: sale del catálogo. Si un día se retira la
    // más barata, la siguiente pasa a serlo sola.
    const { porDefecto } = opcionesParaElCoche([ampliada, basica], COCHE);
    assert.equal(porDefecto.id, "GAR-basica");
    const soloLaCara = opcionesParaElCoche([ampliada], COCHE);
    assert.equal(soloLaCara.porDefecto.id, "GAR-ampliada");
  });

  test("quitarla baja el total, no lo deja igual", () => {
    // El precio publicado lleva una puesta. Un coche que se anuncia sin garantía
    // y luego ofrece una por 290 € parece que sube al final; uno que se anuncia
    // con ella y deja quitarla, baja. Es el mismo dinero y se lee al revés.
    const { opciones } = opcionesParaElCoche([basica, ampliada], COCHE);
    const sin = opciones.find((o) => o.id === null);
    assert.equal(sin.diferencia, -290);
    assert.equal(sin.porDefecto, false, "no coger ninguna no puede ser lo de por defecto");
  });

  test("y sigue sin haber ninguna obligatoria", () => {
    // Una elegida por defecto se puede quitar. Una incluida por obligación, no,
    // y esa era del modelo anterior.
    const { base, opciones } = opcionesParaElCoche([basica, ampliada], COCHE);
    assert.equal(base, null);
    assert.ok(opciones.some((o) => o.id === null), "no se puede quitar");
  });

  test("la primera opción sigue siendo no coger ninguna", () => {
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
    assert.deepEqual(opcionesParaElCoche([], COCHE), { base: null, porDefecto: null, opciones: [] });
  });
});

describe("lo que se le cobra por la que eligió", () => {
  const basica = garantia({ id: "GAR-basica", nivel: 1, precio: 290 });
  const ampliada = garantia({ id: "GAR-ampliada", nivel: 2, precio: 590 });
  const CAT = [basica, ampliada];

  test("lo que cuesta la que ha elegido", () => {
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, "GAR-ampliada"), { id: "GAR-ampliada", precio: 590 });
  });

  test("decir que no quiere ninguna es cero", () => {
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, null), { id: null, precio: 0 });
  });

  test("pero no decir nada es la de por defecto, no cero", () => {
    // El precio publicado la lleva dentro. Caer a cero aquí sería cobrarle menos
    // de lo que se le enseñó, y entregarle un coche sin la garantía que veía.
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, undefined), { id: "GAR-basica", precio: 290 });
  });

  test("una inventada cae a la de por defecto, no la acepta", () => {
    // El navegador dice cuál quiere, no cuánto cuesta. Y caer a cero sería dejar
    // que un identificador inventado le quite 290 € del total.
    assert.deepEqual(precioDeLaElegida(CAT, COCHE, "la-que-me-invento"), { id: "GAR-basica", precio: 290 });
  });

  test("y una que a ese coche no se le puede dar, tampoco", () => {
    const soloNuevos = garantia({ id: "GAR-nuevos", antiguedad_max_anios: 2, precio: 900 });
    assert.deepEqual(precioDeLaElegida([basica, soloNuevos], COCHE, "GAR-nuevos"), { id: "GAR-basica", precio: 290 });
  });
});

