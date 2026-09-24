/**
 * Las ofertas salen por lo que valen, no por lo recientes que sean.
 *
 * ## Lo que pasaba
 *
 * El consejero las ordenaba por `updated_at`: por cuándo las tocó el scraper
 * por última vez. Eso no dice nada de si el coche está bien de precio, que es
 * justo lo único que el cliente no puede averiguar solo.
 *
 * ## Lo que hace ahora
 *
 * Compara cada oferta contra **lo que se pide por su mismo coche** —mismo
 * modelo, mismo año, mismo tramo de kilómetros— y ordena por la diferencia.
 * Así se le puede decir «está 1.850 € por debajo de lo que se pide de media por
 * ese coche», que es comprobable.
 *
 * ## Los dos fallos que tuvo esto al nacer, y por eso están las pruebas
 *
 * **Las doce ofertas con la misma mediana.** El mapa se indexaba por `o.id`, y
 * como no siempre viene, las doce colisionaban en la misma entrada. Lo delató
 * un Golf de 2019 con «6.564 coches comparables».
 *
 * **El cruce de marcas con modelos ajenos.** La consulta preguntaba
 * `marca = ANY(...) AND modelo = ANY(...)`, que cruza todo con todo: contaba
 * como comparables de un Golf los Peugeot 208 de las otras ofertas.
 *
 * **Y la mediana ignoraba los kilómetros.** Un Golf de 2022 con 91.000 km
 * salía «3.743 € por debajo» cuando lo que pasaba es que tiene el doble de
 * kilómetros que el Golf de 2022 normal. Los tres se ven en los números y
 * ninguno rompe nada.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  laMedianaDeCada,
  ordenaPorCalidadPrecio,
  COMPARABLES_MINIMOS,
  TRAMO_DE_KM,
} = require("../lo-que-vale-en-el-mercado.js");

/** Una base de mentira que devuelve lo que se le diga y apunta el SQL. */
function unaBase(filas = [], apuntes = []) {
  return {
    query: async (sql, params) => {
      apuntes.push({ sql, params });
      return { rows: filas };
    },
  };
}

const oferta = (brand, model, year, mileage, price) => ({ brand, model, year, mileage, price });

describe("la consulta que pide las medianas", () => {
  test("pide las parejas como parejas, no dos listas sueltas", async () => {
    /*
     * `marca = ANY(...) AND modelo = ANY(...)` cruza todo con todo: los Peugeot
     * 208 contarían como comparables de un Golf.
     */
    const apuntes = [];
    await laMedianaDeCada(unaBase([], apuntes), [
      oferta("Volkswagen", "Golf", 2022, 40000, 18000),
      oferta("Peugeot", "208", 2024, 30000, 13000),
    ]);

    const { sql } = apuntes[0];
    assert.match(sql, /\(lower\(brand\), lower\(model\)\) IN/);
    assert.doesNotMatch(sql, /lower\(brand\) = ANY/);
  });

  test("y separa por tramo de kilometros", async () => {
    const apuntes = [];
    await laMedianaDeCada(unaBase([], apuntes), [oferta("Volkswagen", "Golf", 2022, 40000, 18000)]);

    assert.match(apuntes[0].sql, /mileage \/ \d+/);
    assert.equal(TRAMO_DE_KM, 25000);
  });

  test("una sola consulta para todas las ofertas", async () => {
    const apuntes = [];
    await laMedianaDeCada(unaBase([], apuntes), [
      oferta("Volkswagen", "Golf", 2022, 40000, 18000),
      oferta("Volkswagen", "Polo", 2025, 15000, 19600),
      oferta("Peugeot", "208", 2024, 43000, 12990),
    ]);

    assert.equal(apuntes.length, 1, "una consulta por oferta serian doce viajes a la base");
  });
});

describe("a cada oferta, la suya", () => {
  const golf = oferta("Volkswagen", "Golf", 2022, 40000, 18000);
  const polo = oferta("Volkswagen", "Polo", 2022, 40000, 19000);

  const FILAS = [
    { marca: "volkswagen", modelo: "golf", anio: 2022, tramo: 1, mediana: 26000, n: 500 },
    { marca: "volkswagen", modelo: "polo", anio: 2022, tramo: 1, mediana: 17000, n: 300 },
  ];

  test("no se les pega la mediana de la vecina", async () => {
    // Las doce con la misma cifra fue el primer fallo de esto.
    const medianas = await laMedianaDeCada(unaBase(FILAS), [golf, polo]);

    assert.equal(medianas.get(golf).mediana, 26000);
    assert.equal(medianas.get(polo).mediana, 17000);
  });

  test("y el ahorro es la diferencia con su precio", async () => {
    const medianas = await laMedianaDeCada(unaBase(FILAS), [golf, polo]);

    assert.equal(medianas.get(golf).ahorro, 8000);
    assert.equal(medianas.get(polo).ahorro, -2000, "una cara tiene que salir en negativo");
  });

  test("sin comparables suficientes no se dice nada", async () => {
    /*
     * Con menos de ocho coches parecidos no hay mercado del que hablar. Una
     * mediana de tres es una casualidad con aspecto de dato.
     */
    const pocos = [{ marca: "volkswagen", modelo: "golf", anio: 2022, tramo: 1, mediana: 26000, n: COMPARABLES_MINIMOS - 1 }];
    const medianas = await laMedianaDeCada(unaBase(pocos), [golf]);

    assert.equal(medianas.has(golf), false);
  });

  test("ni cuando la oferta no dice sus kilometros", async () => {
    const sinKm = { ...golf, mileage: null };
    const medianas = await laMedianaDeCada(unaBase(FILAS), [sinKm]);

    assert.equal(medianas.has(sinKm), false,
      "sin kilometros no se sabe con que tramo compararla");
  });
});

describe("el orden", () => {
  test("primero la que mas se ahorra", async () => {
    const cara = oferta("Volkswagen", "Golf", 2022, 40000, 25000);
    const barata = oferta("Volkswagen", "Golf", 2022, 40000, 18000);
    const medianas = await laMedianaDeCada(
      unaBase([{ marca: "volkswagen", modelo: "golf", anio: 2022, tramo: 1, mediana: 26000, n: 500 }]),
      [cara, barata]
    );

    const orden = ordenaPorCalidadPrecio([cara, barata], medianas);
    assert.deepEqual(orden, [barata, cara]);
  });

  test("y las que no tienen con que compararse van detras, no fuera", async () => {
    /*
     * Esconderlas seria peor: puede ser justo el coche que buscaba. Lo que no
     * se puede es ponerlas por delante de una que si sabemos que esta bien.
     */
    const conDato = oferta("Volkswagen", "Golf", 2022, 40000, 18000);
    const sinDato = oferta("Rara", "Cosa", 2022, 40000, 9000);
    const medianas = await laMedianaDeCada(
      unaBase([{ marca: "volkswagen", modelo: "golf", anio: 2022, tramo: 1, mediana: 26000, n: 500 }]),
      [sinDato, conDato]
    );

    const orden = ordenaPorCalidadPrecio([sinDato, conDato], medianas);
    assert.deepEqual(orden, [conDato, sinDato]);
    assert.equal(orden.length, 2, "no se pierde ninguna");
  });

  test("sin ninguna mediana, se queda el orden que venia", () => {
    const a = oferta("A", "A", 2022, 1000, 1000);
    const b = oferta("B", "B", 2022, 1000, 1000);
    assert.deepEqual(ordenaPorCalidadPrecio([a, b], new Map()), [a, b]);
  });
});
