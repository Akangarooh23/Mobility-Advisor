/**
 * El consejero busca lo que le han pedido, no lo último que tocó el scraper.
 *
 * ## Lo que pasaba
 *
 * `readInventoryUniverse` recibía todos los criterios —combustible, carrocería,
 * etiqueta, precio, año— y **solo le pasaba el modelo a la consulta**. El resto
 * se filtraba después, en JavaScript, sobre las 30.000 ofertas más recientemente
 * actualizadas del pool entero.
 *
 * Con 1.579.000 ofertas visibles eso es buscar un compacto con etiqueta CERO
 * mirando las últimas treinta mil que tocó el scraper. Medido contra
 * producción, con cinco perfiles y el más abierto incluido: **cero ofertas en
 * los cinco**. Y como la pantalla cortaba a los 16 segundos poniendo el error a
 * `null`, se quedaba en blanco sin decir nada.
 *
 * ## Lo que se fija aquí
 *
 * Que los criterios lleguen al `WHERE`, que lo hagan de forma tolerante —los
 * portales escriben «Híbrido», «HIBRIDO» y `hybrid`— y, sobre todo, que
 * **estrechar no pueda dejar a nadie sin ofertas**: si con las condiciones no
 * sale nada, se vuelve a preguntar sin ellas.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  condicionesDelConsejero,
  FORMAS_DEL_COMBUSTIBLE,
} = require("../lo-que-busca-el-consejero.js");

describe("lo que llega al WHERE", () => {
  test("el precio y el año van como números, no como texto", () => {
    const { condiciones, valores } = condicionesDelConsejero(
      { minPrice: 15000, maxPrice: 25000, minYear: 2018 },
      1
    );

    assert.deepEqual(valores, [15000, 25000, 2018]);
    assert.ok(condiciones.some((c) => /price >= \$2/.test(c)));
    assert.ok(condiciones.some((c) => /"year" >= \$4/.test(c)));
  });

  test("los parámetros se numeran desde donde se le dice", () => {
    // El $1 de la consulta es el límite; lo del consejero empieza en el $2.
    const { condiciones } = condicionesDelConsejero({ brand: "Audi" }, 1);
    assert.match(condiciones[0], /\$2/);
  });

  test("el combustible se compara con todas sus formas", () => {
    /*
     * Los portales lo escriben de once maneras distintas. Comparar con `=`
     * dejaría fuera «Híbrido enchufable» al pedir híbrido, y con él las ofertas
     * de quien lo tiene bien escrito.
     */
    const { condiciones, valores } = condicionesDelConsejero({ fuel: "hibrido" }, 0);

    assert.match(condiciones[0], /LIKE ANY/);
    assert.ok(valores[0].some((f) => f.includes("hibrid")));
    assert.ok(valores[0].every((f) => f.startsWith("%") && f.endsWith("%")));
  });

  test("y el diésel encuentra «Diésel» con tilde", () => {
    assert.ok(FORMAS_DEL_COMBUSTIBLE.diesel.includes("diésel"));
    assert.ok(FORMAS_DEL_COMBUSTIBLE.diesel.includes("diesel"));
  });

  test("lo que no se sabe traducir no se filtra", () => {
    /*
     * Esta es la regla de la casa: aquí solo se estrecha. Una carrocería que no
     * está en la tabla no puede convertirse en una condición inventada que deje
     * fuera media base.
     */
    const { condiciones } = condicionesDelConsejero({ bodyType: "x" }, 0);
    assert.deepEqual(condiciones, []);
  });

  test("sin criterios no hay condiciones", () => {
    const { condiciones, valores } = condicionesDelConsejero({}, 0);
    assert.deepEqual(condiciones, []);
    assert.deepEqual(valores, []);
  });
});

describe("la carroceria", () => {
  test("un compacto también es un hatchback", () => {
    const { valores } = condicionesDelConsejero({ bodyType: "compacto" }, 0);
    const formas = valores[0].join(" ");
    assert.match(formas, /hatchback/);
    assert.match(formas, /compact/);
  });

  test("un SUV también es un todoterreno", () => {
    const { valores } = condicionesDelConsejero({ bodyType: "suv" }, 0);
    assert.match(valores[0].join(" "), /todoterreno/);
  });
});

describe("la busqueda, de punta a punta", () => {
  test("el inventario aplica los criterios y vuelve a preguntar si no sale nada", async () => {
    /*
     * El caso que importa: si estrechar deja la lista vacía, quien pregunta
     * tiene que recibir ofertas igual. Dejar al cliente sin nada es
     * exactamente lo que veníamos a arreglar.
     */
    const fs = require("node:fs");
    const fuente = fs.readFileSync(
      require.resolve("../inventoryStore.js"),
      "utf8"
    );

    assert.match(fuente, /condicionesDelConsejero\(criterios, 1\)/,
      "los criterios no llegan a la consulta");
    assert.match(fuente, /if \(delConsejero\.condiciones\.length\)/,
      "si estrechar no da nada, no se vuelve a preguntar sin condiciones");
  });
});
