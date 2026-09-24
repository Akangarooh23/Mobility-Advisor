/**
 * El combustible y la carrocería se comparan con `=`, no con `LIKE`.
 *
 * ## Por qué, con el plan delante
 *
 * Se filtraban con `lower(fuel) LIKE '%gasolina%'`. Un `LIKE` con comodín
 * delante **no puede usar ningún índice**, así que cada búsqueda recorría la
 * tabla entera. Medido con `EXPLAIN` contra producción:
 *
 *     Parallel Seq Scan on moveadvisor_market_offers
 *       Rows Removed by Filter: 784.466
 *       Execution Time: 117.939 ms
 *
 * Y no se arreglaba con más índices: se probaron siete, más `ANALYZE` y
 * `VACUUM`. El problema no era que faltara un índice, era que esa condición no
 * puede usar ninguno.
 *
 * En el pool hay **once** combustibles distintos y **cuarenta y ocho**
 * carrocerías. No hace falta buscar por parecido: se puede saber cuáles son y
 * preguntar por ellos con `=`. El parecido se calcula una vez sobre cuarenta y
 * ocho valores en vez de un millón y medio de veces sobre las ofertas.
 *
 * ## Y la regla que no se puede romper
 *
 * Si no se pueden leer esos valores, se vuelve al `LIKE`. Lento, pero
 * encuentra: cambiar una pantalla lenta por una vacía sería peor.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { losQueEncajan } = require("../los-valores-que-existen.js");
const { condicionesDelConsejero, FORMAS_DEL_COMBUSTIBLE } = require("../lo-que-busca-el-consejero.js");

/** Los once que hay de verdad en la columna, tal cual los escriben. */
const LOS_COMBUSTIBLES = [
  "Gasolina", "Diésel", "Híbrido", "Híbrido enchufable", "Eléctrico",
  "GLP", "GNC", "gasoline", "diesel", "electric", "plug_in_hybrid",
];

describe("elegir de la lista real", () => {
  test("«hibrido» encuentra las tres formas en que se escribe", () => {
    const encajan = losQueEncajan(LOS_COMBUSTIBLES, FORMAS_DEL_COMBUSTIBLE.hibrido);

    assert.ok(encajan.includes("híbrido"));
    assert.ok(encajan.includes("híbrido enchufable"));
    assert.ok(encajan.every((v) => v === v.toLowerCase()),
      "se comparan contra lower(fuel), tienen que ir en minusculas");
  });

  test("y las tildes no despistan", () => {
    /*
     * La columna dice «Diésel» y la forma es «diesel». Comparar sin normalizar
     * dejaria fuera la mitad de las ofertas de gasoil.
     */
    const encajan = losQueEncajan(LOS_COMBUSTIBLES, FORMAS_DEL_COMBUSTIBLE.diesel);

    assert.ok(encajan.includes("diésel"));
    assert.ok(encajan.includes("diesel"));
  });

  test("si no encaja ninguno, no se filtra por esa columna", () => {
    /*
     * Un `= ANY('{}')` no devolveria ni una fila y el cliente se quedaria sin
     * ofertas sin saber por que. Mejor ensenarle coches de mas que ninguno.
     */
    assert.equal(losQueEncajan(LOS_COMBUSTIBLES, ["cohete"]), null);
  });

  test("y sin lista tampoco", () => {
    assert.equal(losQueEncajan(null, FORMAS_DEL_COMBUSTIBLE.gasolina), null);
    assert.equal(losQueEncajan([], FORMAS_DEL_COMBUSTIBLE.gasolina), null);
  });
});

describe("la condicion que sale", () => {
  const conLaLista = new Map([["fuel", LOS_COMBUSTIBLES]]);

  test("con los valores delante, compara con igual", () => {
    const { condiciones } = condicionesDelConsejero({ fuel: "gasolina" }, 0, conLaLista);

    assert.match(condiciones[0], /= ANY\(\$1::text\[\]\)/);
    assert.doesNotMatch(condiciones[0], /LIKE/);
  });

  test("sin ellos, vuelve al LIKE en vez de quedarse sin buscar", () => {
    const { condiciones } = condicionesDelConsejero({ fuel: "gasolina" }, 0, null);

    assert.match(condiciones[0], /LIKE ANY/);
  });

  test("los parametros llevan su dolar", () => {
    /*
     * Esto empezo saliendo como `ANY(2::text[])` —sin el `$`— por un desliz al
     * aplicar un cambio, y Postgres respondia «cannot cast type integer to
     * text[]». La consulta fallaba, se caia al camino de reserva y devolvia
     * ofertas de un fichero local: doce coches plausibles que no estaban en la
     * base.
     */
    const { condiciones } = condicionesDelConsejero(
      { fuel: "gasolina", maxPrice: 20000 }, 1, conLaLista
    );

    for (const c of condiciones.filter((x) => /\$/.test(x))) {
      assert.match(c, /\$\d+/, `«${c}» tiene un parametro sin el dolar`);
    }
    assert.match(condiciones.join(" "), /\$2/);
    assert.match(condiciones.join(" "), /\$3/);
  });
});
