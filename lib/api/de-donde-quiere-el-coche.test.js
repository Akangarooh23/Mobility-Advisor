/**
 * La provincia se pregunta en el test, no se filtra al final.
 *
 * ## Lo que pasaba
 *
 * La pantalla de resultados tenía un desplegable de ubicación y unos botones de
 * rango de precio **encima de las ofertas ya elegidas**. Eso filtra doce coches
 * que la base ya había decidido: si de esos doce ninguno era de Valencia, elegir
 * Valencia dejaba la pantalla vacía. Preguntarlo antes filtra entre 1.579.000.
 *
 * ## El fallo que esto arregla y que no se veía
 *
 * El filtro de provincia comparaba el nombre **sin tildes** contra una columna
 * que **sí las lleva**. Buscar en Málaga no devolvía ni una de las 44.469
 * ofertas malagueñas — devolvía cero y seguía tan tranquilo.
 *
 * Por eso cada provincia guarda sus escrituras, incluidas las de cada lengua:
 * los portales escriben Girona o Gerona, Bizkaia o Vizcaya, y el cliente no
 * tiene por qué saber cuál toca.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { LAS_PROVINCIAS, CUALQUIERA, comoSeBusca, lasOpciones } = require("../de-donde-quiere-el-coche.js");
const { elEncargoDeBusqueda } = require("../el-encargo-de-busqueda.js");
const { condicionesDelConsejero } = require("../lo-que-busca-el-consejero.js");

describe("la lista de provincias", () => {
  test("están las cincuenta y dos", () => {
    assert.equal(LAS_PROVINCIAS.length, 52);
  });

  test("cada una con su nombre y sus escrituras", () => {
    for (const p of LAS_PROVINCIAS) {
      assert.ok(p.valor && p.nombre, JSON.stringify(p));
      assert.ok(Array.isArray(p.formas) && p.formas.length, p.nombre);
      assert.ok(p.formas.every((f) => f === f.toLowerCase()),
        `${p.nombre}: las formas se comparan contra lower(province), tienen que ir en minusculas`);
    }
  });

  test("las que llevan tilde la guardan con y sin ella", () => {
    /*
     * El fallo original: «malaga» contra una columna que dice «Málaga». Cero
     * ofertas y ni un error.
     */
    for (const nombre of ["Málaga", "Cádiz", "Córdoba", "Almería", "Jaén", "León", "A Coruña"]) {
      const p = LAS_PROVINCIAS.find((x) => x.nombre === nombre);
      assert.ok(p, nombre);
      const conTilde = p.formas.some((f) => /[áéíóúñ]/.test(f));
      const sinTilde = p.formas.some((f) => !/[áéíóúñ]/.test(f));
      assert.ok(conTilde && sinTilde, `${nombre} necesita las dos escrituras`);
    }
  });

  test("y los nombres en otra lengua también buscan", () => {
    const girona = LAS_PROVINCIAS.find((x) => x.valor === "girona");
    assert.ok(girona.formas.includes("gerona"));
    const bizkaia = LAS_PROVINCIAS.find((x) => x.valor === "bizkaia");
    assert.ok(bizkaia.formas.includes("vizcaya"));
  });

  test("no hay dos con el mismo valor", () => {
    const valores = LAS_PROVINCIAS.map((p) => p.valor);
    assert.equal(new Set(valores).size, valores.length);
  });
});

describe("«me da igual» no filtra", () => {
  test("ni cuando lo dice, ni cuando no ha contestado", () => {
    assert.equal(comoSeBusca(CUALQUIERA), null);
    assert.equal(comoSeBusca(""), null);
    assert.equal(comoSeBusca(undefined), null);
  });

  test("ni cuando la respuesta no es ninguna de las que conocemos", () => {
    /*
     * Filtrar por una provincia que no sabemos escribir devolveria cero ofertas
     * y el cliente no tendria forma de saber por que.
     */
    assert.equal(comoSeBusca("condado_de_no_se_donde"), null);
  });

  test("y una de verdad devuelve sus formas", () => {
    assert.deepEqual(comoSeBusca("malaga"), ["malaga", "málaga"]);
  });
});

describe("de la respuesta al WHERE", () => {
  test("el encargo lleva las formas, no el nombre", () => {
    const encargo = elEncargoDeBusqueda({ provincia_del_coche: "malaga" });
    assert.deepEqual(encargo.provinciaFormas, ["malaga", "málaga"]);
  });

  test("y la condicion compara contra las dos", () => {
    const { condiciones, valores } = condicionesDelConsejero(
      { provinciaFormas: ["malaga", "málaga"] },
      0
    );

    assert.match(condiciones.join(" "), /lower\(COALESCE\(province,''\)\) LIKE ANY/);
    assert.deepEqual(valores[0], ["%malaga%", "%málaga%"]);
  });

  test("sin provincia elegida, no hay condicion de provincia", () => {
    const { condiciones } = condicionesDelConsejero({ maxPrice: 20000 }, 0);
    assert.doesNotMatch(condiciones.join(" "), /province/);
  });
});

describe("las opciones que ve el cliente", () => {
  test("«me da igual» va la primera", () => {
    const opciones = lasOpciones();
    assert.equal(opciones[0].value, CUALQUIERA);
    assert.equal(opciones.length, LAS_PROVINCIAS.length + 1);
  });

  test("y son las mismas que hay en el cuestionario", () => {
    /*
     * La lista vive aqui y el cuestionario tiene su copia, porque `src` no
     * puede importar de `lib`. Si se separan, el cliente elegiria una provincia
     * que la busqueda no sabe traducir y recibiria cero ofertas sin saber por
     * que.
     */
    const pasos = fs.readFileSync(
      require.resolve("../../src/data/questionnaireSteps.js"),
      "utf8"
    );
    const desde = pasos.indexOf('id: "provincia_del_coche"');
    assert.ok(desde > 0, "la pregunta de la provincia no esta en el cuestionario");
    const trozo = pasos.slice(desde, pasos.indexOf("},\n  {", desde));
    const enElTest = [...trozo.matchAll(/value:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);

    assert.deepEqual(enElTest.sort(), lasOpciones().map((o) => o.value).sort());
  });
});
