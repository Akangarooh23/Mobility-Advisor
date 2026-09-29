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

/**
 * Un M3 y un 320d no son el mismo coche.
 *
 * ## Lo que pasaba
 *
 * La mediana agrupaba por marca, modelo, año y tramo de kilómetros. Nada más.
 * Así que un BMW M3 se comparaba contra la mediana de **todos** los Serie 3 de
 * su año. Medido sobre el pool, con los de 2020-2022 y 25.000-50.000 km:
 *
 *     todos juntos          33.000 EUR   155 coches
 *     de 150 a 199 CV       28.950 EUR    68
 *     de 500 a 549 CV       82.999 EUR    31   ← el M3
 *
 * A un M3 de 82.999 € se le decía que estaba **50.000 € por encima del
 * mercado** —y se iba al final de la lista— y a un 320d normal que era un
 * chollo. Lo mismo con el Golf: 19.990 el 1.0 TSI contra 37.000 el GTI o el R.
 *
 * ## Por qué la potencia y no la versión
 *
 * La versión es texto libre con miles de escrituras. La potencia está rellena
 * en el 95% de las ofertas, es un número, y separa justo lo que hay que
 * separar: lo que distingue a un GTI es que tiene el doble de caballos.
 */
describe("el acabado separa la mediana", () => {
  /** Una base de mentira que devuelve los grupos que se le digan. */
  const unaBaseCon = (filas) => ({ query: async () => ({ rows: filas }) });

  const unGrupo = (cv, mediana, n) => ({
    marca: "bmw", modelo: "serie 3", anio: 2021, tramo: 1, cv, mediana, n,
  });

  /*
   * Los Serie 3 de 2021 con 25.000-50.000 km, repartidos como en el pool:
   * los normales de 150-199 CV y los M3 de 500-549.
   */
  const EL_MERCADO = [unGrupo(3, 28950, 68), unGrupo(10, 82999, 31)];

  const unCoche = (powerCv, price) => ({
    brand: "BMW", model: "Serie 3", year: 2021, mileage: 30000, powerCv, price,
  });

  test("el M3 se compara con otros M3, no con los 320d", async () => {
    const elM3 = unCoche(510, 82999);
    const medianas = await laMedianaDeCada(unaBaseCon(EL_MERCADO), [elM3]);

    assert.equal(medianas.get(elM3).mediana, 82999);
    assert.equal(medianas.get(elM3).comparables, 31);
  });

  test("y antes se le decia que estaba cincuenta mil por encima", async () => {
    /*
     * La cuenta de la version anterior: 82.999 contra la mediana de todos
     * juntos. No se comprueba el codigo viejo, se comprueba que el nuevo NO
     * da ese numero.
     */
    const elM3 = unCoche(510, 82999);
    const medianas = await laMedianaDeCada(unaBaseCon(EL_MERCADO), [elM3]);

    assert.notEqual(medianas.get(elM3).ahorro, 28950 - 82999);
    assert.equal(medianas.get(elM3).ahorro, 0);
  });

  test("y el 320d normal se compara con los suyos", async () => {
    const el320d = unCoche(190, 26000);
    const medianas = await laMedianaDeCada(unaBaseCon(EL_MERCADO), [el320d]);

    assert.equal(medianas.get(el320d).mediana, 28950);
    assert.equal(medianas.get(el320d).ahorro, 2950);
  });

  test("sin potencia se compara con todo el modelo, como antes", async () => {
    /*
     * El 5% de las ofertas no dice los caballos. Peor comparacion, pero mejor
     * que ninguna: la suma de los dos grupos, pesada por cuantos hay.
     */
    const sinCaballos = unCoche(null, 30000);
    const medianas = await laMedianaDeCada(unaBaseCon(EL_MERCADO), [sinCaballos]);

    assert.equal(medianas.get(sinCaballos).comparables, 99);
    // (28.950 x 68 + 82.999 x 31) / 99
    assert.equal(medianas.get(sinCaballos).mediana, 45874);
  });

  test("y un tramo con pocos coches no se compara con nadie", async () => {
    /*
     * Con menos de ocho comparables no se dice nada. Es preferible no poner la
     * linea del ahorro a ponerla con cuatro coches detras.
     */
    const raro = unCoche(710, 150000);
    const medianas = await laMedianaDeCada(unaBaseCon([...EL_MERCADO, unGrupo(14, 150000, 3)]), [raro]);

    assert.equal(medianas.has(raro), false);
  });
});
