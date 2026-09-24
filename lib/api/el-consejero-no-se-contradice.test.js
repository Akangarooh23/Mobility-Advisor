/**
 * El consejero no puede recomendar una cosa y puntuar mejor otra.
 *
 * ## Lo que pasaba
 *
 * Las alternativas traían el score escrito a mano —76, 68, 79, 74— y no se
 * calculaba nada. Mientras la principal tuvo suelo de 68 y techo de 92 no se
 * notaba, porque todos los números jugaban en la misma liga. En cuanto la
 * principal pasó a ser la suma real de su desglose, un perfil que saque 55
 * vería «recomendación principal 55 %» y debajo una alternativa con 76: la
 * pantalla diciendo que la mejor es la peor.
 *
 * Y las tablas traían la misma opción dos veces con distinta explicación
 * —«compra financiada» con 76 y con 68—, que con el score calculado sale dos
 * veces con la misma cifra.
 *
 * ## Lo que se fija aquí
 *
 * Que los números salgan de la misma cuenta, que la recomendada sea la que más
 * puntúa, y que ninguna opción se ofrezca dos veces.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const FUENTE = fs.readFileSync(require.resolve("../../api/analyze.js"), "utf8");

describe("los numeros salen de la misma cuenta", () => {
  test("las alternativas ya no llevan el score escrito a mano", () => {
    /*
     * Se mira el texto del fichero porque es justo lo que hay que impedir que
     * vuelva: una tabla de opciones con su nota puesta a dedo.
     */
    const tablas = FUENTE.slice(
      FUENTE.indexOf("function buildAlternatives"),
      FUENTE.indexOf("function buildFallbackAdvisorResult")
    );
    const aDedo = tablas.match(/score:\s*\d+/g) || [];
    assert.deepEqual(aDedo, [], `siguen puestos a mano: ${aDedo.join(", ")}`);
  });

  test("y se calculan con el mismo desglose que la principal", () => {
    const tablas = FUENTE.slice(
      FUENTE.indexOf("function buildAlternatives"),
      FUENTE.indexOf("function buildFallbackAdvisorResult")
    );
    assert.match(tablas, /buildScoreBreakdown\(answers, item\.tipo, propulsions\)/);
  });
});

describe("la recomendada es la que mas puntua", () => {
  test("si una alternativa gana, pasa a ser la principal", () => {
    const bloque = FUENTE.slice(
      FUENTE.indexOf("function buildFallbackAdvisorResult"),
      FUENTE.indexOf("const companies = getCompaniesForType")
    );
    assert.match(bloque, /mejorAlternativa\.score > loQuePuntua\(laDeLaRegla/,
      "no se compara la regla con la mejor alternativa");
    assert.match(bloque, /primaryType = mejorAlternativa/);
  });

  test("y entonces las alternativas se rehacen desde ella", () => {
    // Si no, la que gana saldria arriba y tambien abajo, como alternativa de si
    // misma.
    assert.match(FUENTE, /const alternatives = primaryType === laDeLaRegla/);
  });
});

describe("ninguna opcion se ofrece dos veces", () => {
  test("se quitan las repetidas por tipo", () => {
    const tablas = FUENTE.slice(
      FUENTE.indexOf("function buildAlternatives"),
      FUENTE.indexOf("function buildFallbackAdvisorResult")
    );
    assert.match(tablas, /vistas\.has\(item\.tipo\)/);
  });
});

describe("el porcentaje y las barras", () => {
  test("el titular es la suma del desglose, sin suelo", () => {
    /*
     * `clamp(suma, 68, 92)`: el resultado no podia bajar del 68 % ni subir del
     * 92, contestara lo que contestara el cliente. No era un 68: era el suelo.
     */
    assert.doesNotMatch(FUENTE, /reduce\(\(acc, item\) => acc \+ Number\(item \|\| 0\), 0\),\s*\n\s*68,/,
      "ha vuelto el suelo del 68 %");
    assert.match(FUENTE, /const elPorcentaje = clamp\(Math\.round\(sumaDelDesglose\), 0, 100\)/);
  });

  test("y la solucion principal lleva ese mismo numero", () => {
    assert.match(FUENTE, /score: elPorcentaje,/);
  });
});
