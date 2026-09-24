/**
 * «hibrido_no_enchufable» contiene la palabra «enchufable».
 *
 * ## Lo que pasaba
 *
 * La función que traduce la respuesta del test a un modo de combustible
 * comprobaba el enchufable **antes** que el no enchufable:
 *
 *     if (/(hibrido_enchufable|phev|enchufable|plug-in)/.test(valor)) return "phev";
 *     ...
 *     if (/(hibrido_no_enchufable|hibrido|hybrid|hev)/.test(valor)) return "hibrido";
 *
 * Y «hibrido_no_enchufable» casa con la primera. Así que a quien marcaba
 * **«Híbrido (HEV/MHEV)»** —una de las seis opciones de la pregunta— se le
 * buscaba un híbrido **enchufable**, que es otro coche, otro precio y otra
 * etiqueta.
 *
 * ## Cómo se vio
 *
 * Contestando el test entero. Pidiendo gasolina e híbrido no enchufable, un
 * compacto de menos de 20.000 € en Valencia, la búsqueda se fue a por
 * «gasolina o PHEV» y trajo un Peugeot 3008, un 508 y un 2008 —dos SUV y una
 * berlina grande—, que el colador tiró por carrocería. **Cero ofertas**,
 * teniendo el pool 75 que cumplían.
 *
 * Nada fallaba: la búsqueda encontraba coches, solo que los de otra pregunta.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveStrictFuelMode, inferFuelFilterFromAnswers } = require("../../api/find-listing");
const { condicionesDelConsejero } = require("../lo-que-busca-el-consejero");

describe("cada opcion de la pregunta va a su sitio", () => {
  const COMO_SE_LLAMAN = {
    electrico_puro: "electrico",
    hibrido_no_enchufable: "hibrido",
    hibrido_enchufable: "phev",
    gasolina: "gasolina",
    diesel: "diesel",
    indiferente_motor: "",
  };

  for (const [respuesta, modo] of Object.entries(COMO_SE_LLAMAN)) {
    test(respuesta + " -> " + (modo || "sin filtro"), () => {
      assert.equal(resolveStrictFuelMode(respuesta), modo);
    });
  }

  test("y el no enchufable NO es un enchufable, que es el fallo", () => {
    assert.notEqual(resolveStrictFuelMode("hibrido_no_enchufable"), "phev");
  });

  test("escrito de otras formas, tambien", () => {
    for (const como of ["hibrido no enchufable", "híbrido no-enchufable", "HIBRIDO_NO_ENCHUFABLE"]) {
      assert.equal(resolveStrictFuelMode(como), "hibrido", como);
    }
  });
});

describe("y marcando dos, se buscan los dos", () => {
  test("el filtro suelto se rinde con dos marcados", () => {
    /*
     * Esto es asi a proposito y no se cambia: `inferFuelFilterFromAnswers`
     * devuelve uno solo o nada. Lo que estaba mal era que NADIE recogiera los
     * dos, asi que la base se quedaba sin filtro de combustible.
     */
    assert.equal(
      inferFuelFilterFromAnswers({ propulsion_preferida: ["gasolina", "hibrido_no_enchufable"] }),
      ""
    );
  });

  test("pero la consulta si los lleva los dos", () => {
    const { condiciones, valores } = condicionesDelConsejero({ fuels: ["gasolina", "hibrido"] });

    assert.equal(condiciones.length, 1);
    assert.match(condiciones[0], /fuel/);

    const formas = valores[0].join(" ");
    assert.match(formas, /gasolina/);
    assert.match(formas, /hibrid/);
  });

  test("y un PHEV no se cuela entre ellos", () => {
    /*
     * Las formas del enchufable son «enchufable», «plug» y «phev». Si
     * aparecieran aqui, a quien pidio hibrido normal se le traerian
     * enchufables, que es de donde venia el Peugeot 3008.
     */
    const { valores } = condicionesDelConsejero({ fuels: ["gasolina", "hibrido"] });
    const formas = valores[0].join(" ");

    assert.doesNotMatch(formas, /enchufable/);
    assert.doesNotMatch(formas, /phev/);
  });

  test("y quien pide un enchufable, lo pide de verdad", () => {
    const { valores } = condicionesDelConsejero({ fuels: ["phev"] });
    assert.match(valores[0].join(" "), /enchufable/);
  });
});

describe("la busqueda lleva todos los que marco", () => {
  const fs = require("node:fs");
  const FUENTE = fs.readFileSync(require.resolve("../../api/find-listing.js"), "utf8");

  test("la busqueda principal y lo que no se negocia los llevan", () => {
    const veces = (FUENTE.match(/fuels: requestedFuelModes\.size \? Array\.from\(requestedFuelModes\) : null/g) || []).length;
    assert.ok(veces >= 2, "solo aparece " + veces + " vez");
  });

  test("y se calculan antes de usarse", () => {
    /*
     * Ya paso una vez: el objeto quedo declarado antes de una variable que
     * usa y la busqueda entera reventaba con «Cannot access before
     * initialization». No lo caza ninguna prueba de leer codigo salvo esta.
     */
    assert.ok(
      FUENTE.indexOf("const requestedFuelModes") < FUENTE.indexOf("const loQueNoSeNegocia"),
      "loQueNoSeNegocia usa requestedFuelModes antes de que exista"
    );
  });
});
