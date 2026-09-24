/**
 * El test le dice al buscador qué coche quiere, no solo qué modalidad.
 *
 * ## Lo que pasaba
 *
 * El cuestionario preguntaba casi todo sobre **la modalidad** —comprar,
 * financiar, renting— y casi nada sobre **el coche**. Cuando llegaba el momento
 * de enseñar ofertas, la búsqueda no tenía con qué filtrar: se traía lo más
 * reciente del pool y confiaba en que algo encajara.
 *
 * Faltaban las dos que cualquiera mira primero en un usado: **hasta cuánto
 * quiere gastarse** y **hasta cuántos kilómetros acepta**. El precio se deducía
 * de la cuota mensual —lo que obliga a inventarse un plazo y un interés— y los
 * kilómetros no se preguntaban en absoluto.
 *
 * Medido contra producción antes y después, con el mismo perfil: sin encargo
 * salían ofertas de hasta 33.990 € y 145.913 km; con él, 19.800 € y 97.500.
 *
 * ## Lo que se fija aquí
 *
 * Que lo contestado llegue al filtro, y —lo que más cuesta ver— que **lo no
 * contestado no se rellene con una suposición**: un tope inventado deja fuera
 * ofertas que el cliente habría mirado, y no hay manera de que se entere.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { elEncargoDeBusqueda, EL_PRECIO, LOS_KILOMETROS } = require("../el-encargo-de-busqueda.js");

describe("lo que el test le encarga al buscador", () => {
  test("el precio y los kilometros llegan como numeros", () => {
    const encargo = elEncargoDeBusqueda({
      presupuesto_total: "15k_20k",
      km_maximos_coche: "hasta_100k",
    });

    assert.deepEqual(encargo, { maxPrice: 20000, maxMileage: 100000 });
  });

  test("lo que no ha contestado no se rellena", () => {
    /*
     * Lo importante de todo el fichero. Un tope de precio inventado deja fuera
     * ofertas que el cliente habría mirado, y no hay forma de que se entere:
     * no ve un error, ve menos coches.
     */
    assert.deepEqual(elEncargoDeBusqueda({}), {});
    assert.deepEqual(elEncargoDeBusqueda(), {});
  });

  test("«me da igual» no es un tope", () => {
    const encargo = elEncargoDeBusqueda({
      presupuesto_total: "mas_45k",
      km_maximos_coche: "sin_limite_km",
    });

    assert.deepEqual(encargo, {},
      "quien puede gastar mas de 45.000 no quiere que le escondan uno de 60.000");
  });

  test("y un valor que no conocemos tampoco", () => {
    // De una respuesta guardada hace meses con otras opciones.
    assert.deepEqual(elEncargoDeBusqueda({ presupuesto_total: "lo_que_sea" }), {});
  });
});

describe("los tramos", () => {
  test("cada uno manda su tope, de menor a mayor", () => {
    const topes = Object.values(EL_PRECIO).filter(Boolean);
    assert.deepEqual(topes, [...topes].sort((a, b) => a - b));
    assert.equal(EL_PRECIO.hasta_10k, 10000);
    assert.equal(EL_PRECIO.mas_45k, null, "el tramo abierto no manda tope");
  });

  test("y los kilometros igual", () => {
    assert.equal(LOS_KILOMETROS.hasta_50k, 50000);
    assert.equal(LOS_KILOMETROS.sin_limite_km, null);
  });

  test("las opciones del cuestionario son exactamente estas", () => {
    /*
     * Si alguien añade un tramo a la pregunta y no lo añade aquí, ese tramo no
     * filtraría nada: el cliente elegiría «de 45.000 a 60.000» y recibiría
     * ofertas sin tope. No fallaría nada, que es lo peligroso.
     */
    const fs = require("node:fs");
    const pasos = fs.readFileSync(
      require.resolve("../../src/data/questionnaireSteps.js"),
      "utf8"
    );

    const opcionesDe = (id) => {
      const desde = pasos.indexOf(`id: "${id}"`);
      const trozo = pasos.slice(desde, pasos.indexOf("},\n  {", desde));
      return [...trozo.matchAll(/value:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
    };

    assert.deepEqual(opcionesDe("presupuesto_total").sort(), Object.keys(EL_PRECIO).sort());
    assert.deepEqual(opcionesDe("km_maximos_coche").sort(), Object.keys(LOS_KILOMETROS).sort());
  });
});
