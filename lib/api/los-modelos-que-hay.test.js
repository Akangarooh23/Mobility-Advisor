/**
 * Los modelos recomendados salen de la base, no de una tabla escrita a mano.
 *
 * ## Lo que pasaba
 *
 * Los cinco modelos que proponía el consejero venían de una lista fija que
 * solo miraba el combustible. Contestando el test entero —compacto, marca
 * generalista europea, 15.000-20.000 €, Valencia, automático— contestaba con
 * un Toyota C-HR, un Kia Niro, un Hyundai Kona y un Nissan Qashqai. Cuatro
 * SUV japoneses y coreanos: contradecía la carrocería y la marca.
 *
 * Y no era solo estética. Esos nombres son con los que sale a buscar el motor,
 * así que la búsqueda se iba detrás de coches que el propio filtro de marca
 * tiraba después. Le recomendaba dos coches que no le iba a enseñar.
 *
 * ## Lo que hace ahora
 *
 * Le pregunta a la base qué marcas y modelos tienen coches que cumplen lo que
 * ha pedido. La lista no puede contradecirle porque sale de las mismas
 * condiciones con las que luego se buscan las ofertas.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  losModelosQueHay,
  comoSeLosCuentas,
  esDeLosQueHay,
  comoSeEscribe,
  LOS_MINIMOS,
} = require("../los-modelos-que-hay");
const { elEncargoDeBusqueda } = require("../el-encargo-de-busqueda");

/**
 * Una base de mentira que apunta lo que se le pregunta.
 *
 * Solo cuenta las consultas de modelos: antes de esas se leen los valores de
 * `mmo_facetas` —los que permiten comparar con `=` en vez de con `LIKE`— y esa
 * lectura no es lo que se está comprobando aquí.
 */
function unaBaseQueDevuelve(...respuestas) {
  const consultas = [];
  const pool = {
    query: async (sql, valores) => {
      if (!sql.includes("moveadvisor_market_offers")) return { rows: [] };
      consultas.push({ sql, valores });
      return { rows: respuestas[consultas.length - 1] || [] };
    },
  };
  return { pool, consultas };
}

/** Como vienen de la base: en minusculas. */
const LAS_FILAS = [
  { marca: "renault", modelo: "clio", cuantos: 12, desde: 9500 },
  { marca: "volkswagen", modelo: "polo", cuantos: 7, desde: 8900 },
];

/** Y como salen, ya escritos para enseñarlos. */
const LO_QUE_HAY = [
  { marca: "Renault", modelo: "Clio", cuantos: 12, desde: 9500 },
  { marca: "Volkswagen", modelo: "Polo", cuantos: 7, desde: 8900 },
];

describe("los nombres se escriben como se leen", () => {
  test("de la base salen en minusculas", () => {
    assert.equal(comoSeEscribe("volkswagen golf"), "Volkswagen Golf");
    assert.equal(comoSeEscribe("seat leon"), "Seat Leon");
  });

  test("y las siglas cortas se quedan en mayusculas", () => {
    // «DS 7» no es «Ds 7», y «C3» no se toca.
    assert.equal(comoSeEscribe("ds 7"), "DS 7");
  });
});

describe("se le pregunta a la base", () => {
  test("con las condiciones del cliente", async () => {
    const { pool, consultas } = unaBaseQueDevuelve(LAS_FILAS);

    const salida = await losModelosQueHay(pool, {
      bodyType: "compacto",
      brands: ["volkswagen", "renault"],
      maxPrice: 20000,
    }, 5);

    assert.equal(salida.length, 2);
    assert.equal(salida[0].marca, "Renault");
    assert.equal(salida[0].modelo, "Clio");
    assert.match(consultas[0].sql, /GROUP BY 1, 2/);
    assert.match(consultas[0].sql, /body_type/);
    assert.match(consultas[0].sql, /brand/);
  });

  test("sin condiciones no se pregunta nada", async () => {
    /*
     * Sin criterios la lista serian los modelos mas vendidos de Espana, que no
     * es una recomendacion para nadie.
     */
    const { pool, consultas } = unaBaseQueDevuelve(LAS_FILAS);

    assert.deepEqual(await losModelosQueHay(pool, {}, 5), []);
    assert.equal(consultas.length, 0);
  });

  test("sin base, no revienta", async () => {
    assert.deepEqual(await losModelosQueHay(null, { bodyType: "compacto" }, 5), []);
  });

  test("si la consulta falla, se sigue sin lista", async () => {
    const pool = { query: async () => { throw new Error("se ha caido"); } };
    assert.deepEqual(await losModelosQueHay(pool, { bodyType: "compacto" }, 5), []);
  });
});

describe("tres si los hay, y si no los que haya", () => {
  test("primero se piden los que tengan tres o mas", async () => {
    const { pool, consultas } = unaBaseQueDevuelve(LAS_FILAS);

    await losModelosQueHay(pool, { bodyType: "compacto" }, 5);

    assert.equal(consultas.length, 1, "ha preguntado dos veces teniendo respuesta");
    assert.ok(consultas[0].valores.includes(LOS_MINIMOS));
  });

  test("y si con tres no hay ninguno, se vuelve a preguntar con uno", async () => {
    /*
     * Con un perfil estrecho -compacto, automatico, de profesional, siete
     * marcas, una provincia- no llega a tres ni uno. Exigirlo devolvia la
     * lista vacia y se volvia a la tabla escrita a mano, que es lo que
     * veniamos a quitar. Un modelo del que hay uno sigue siendo mejor
     * recomendacion que uno que no existe.
     */
    const { pool, consultas } = unaBaseQueDevuelve([], [{ marca: "citroen", modelo: "c3", cuantos: 1, desde: 16690 }]);

    const salida = await losModelosQueHay(pool, { bodyType: "compacto" }, 5);

    assert.equal(consultas.length, 2);
    assert.ok(consultas[1].valores.includes(1));
    assert.equal(salida[0].modelo, "C3");
  });
});

describe("y lo que devuelve el modelo se comprueba", () => {
  test("un modelo de la lista pasa", () => {
    assert.equal(esDeLosQueHay({ marca: "Renault", modelo: "Clio" }, LO_QUE_HAY), true);
  });

  test("con la version pegada, tambien", () => {
    // El modelo escribe «Clio E-TECH» y la base dice «clio».
    assert.equal(esDeLosQueHay({ marca: "Renault", modelo: "Clio E-TECH" }, LO_QUE_HAY), true);
  });

  test("pero otro coche no", () => {
    assert.equal(esDeLosQueHay({ marca: "Toyota", modelo: "C-HR Hybrid" }, LO_QUE_HAY), false);
    assert.equal(esDeLosQueHay({ marca: "Nissan", modelo: "Qashqai" }, LO_QUE_HAY), false);
  });

  test("ni uno vacio", () => {
    assert.equal(esDeLosQueHay({}, LO_QUE_HAY), false);
  });
});

describe("como se le cuentan al modelo", () => {
  test("con cuantos hay y desde que precio", () => {
    const dicho = comoSeLosCuentas(LO_QUE_HAY);

    assert.match(dicho, /Renault Clio: 12 en venta, desde 9500 EUR/);
    assert.match(dicho, /Volkswagen Polo: 7 en venta/);
  });
});

describe("y el encargo lleva la marca y la carroceria", () => {
  test("del test salen las siete marcas generalistas europeas", () => {
    const encargo = elEncargoDeBusqueda({ marca_preferencia: "generalista_europea" });

    assert.ok(encargo.brands.includes("volkswagen"));
    assert.ok(encargo.brands.includes("seat"));
    /*
     * Ford y Opel NO cuentan como generalistas europeas en la lista que ya
     * existia. Es una decision de producto, no tecnica, y se deja como estaba;
     * esta prueba solo fija que la lista es una y la misma para todos.
     */
    assert.equal(encargo.brands.includes("ford"), false);
  });

  test("y «me da igual» en carroceria no pone filtro", () => {
    assert.equal(elEncargoDeBusqueda({ carroceria_preferida: "indiferente_carroceria" }).bodyType, undefined);
    assert.equal(elEncargoDeBusqueda({ carroceria_preferida: "compacto" }).bodyType, "compacto");
  });
});
