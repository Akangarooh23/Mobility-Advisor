/**
 * Las respuestas se le cuentan al cerebro en cristiano, no en clave.
 *
 * ## Lo que salió en pantalla
 *
 * Al cerebro que elige las ofertas se le pasaban las respuestas **en crudo**,
 * con los códigos internos, y los usaba tal cual:
 *
 *     «Para sus "viajes_ocio" y "7_plazas_maletero_grande", el Audi Q3
 *      Sportback ofrece un espacio interior más adecuado»
 *
 * Eso no lo puede leer un cliente. Y no era culpa del modelo: es lo que se le
 * dio.
 *
 * ## Por qué hay una tabla y no se lee el cuestionario
 *
 * Porque el cuestionario vive en `src/` y `lib/` no puede importar de ahí. La
 * copia está permitida en este proyecto; separarse sin que nadie se entere,
 * no. De eso va esta prueba: lee las opciones de verdad y las compara con la
 * tabla, así que una opción nueva o un texto cambiado falla aquí.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { COMO_SE_LEE, comoSeLee, comoSeLlamaLaPregunta } = require("../como-se-lee-el-test");
const { LO_SUBJETIVO, comoSeCuentaElCliente } = require("../el-cerebro-elige");

/** Las preguntas de verdad, leídas del fichero que usa la web. */
function lasPreguntas() {
  const fuente = fs
    .readFileSync(path.join(__dirname, "..", "..", "src", "data", "questionnaireSteps.js"), "utf8")
    .replace(/export /g, "");
  const { STEPS, ADVANCED_STEPS } = new Function(fuente + "\n return { STEPS, ADVANCED_STEPS };")();
  return [...STEPS, ...(ADVANCED_STEPS || [])];
}

/** Las opciones de una pregunta, esté suelta o dentro de un paso compuesto. */
function lasOpcionesDe(clave) {
  for (const paso of lasPreguntas()) {
    if (paso.id === clave && paso.options) return paso.options;
    const dentro = paso.fields && paso.fields[clave];
    if (dentro && dentro.options) return dentro.options;
  }
  return null;
}

describe("la tabla dice lo mismo que el cuestionario", () => {
  /*
   * `km_anuales` y `horizonte` son los nombres que usa el motor para dos
   * preguntas que en el cuestionario se llaman de otra forma. Ver
   * lib/las-respuestas-del-test.js.
   */
  const CON_OTRO_NOMBRE = ["km_anuales", "horizonte"];

  for (const clave of Object.keys(COMO_SE_LEE)) {
    if (CON_OTRO_NOMBRE.includes(clave)) continue;

    test(clave + ": todas sus opciones estan traducidas", () => {
      const opciones = lasOpcionesDe(clave);
      assert.ok(opciones, "no encuentro la pregunta " + clave + " en el cuestionario");

      for (const opcion of opciones) {
        assert.equal(
          COMO_SE_LEE[clave][opcion.value],
          opcion.label,
          clave + "." + opcion.value + " dice «" + COMO_SE_LEE[clave][opcion.value]
            + "» y el cuestionario dice «" + opcion.label + "»"
        );
      }
    });
  }
});

describe("y lo subjetivo que se le cuenta esta cubierto", () => {
  test("cada pregunta que se le pasa tiene nombre legible", () => {
    for (const clave of LO_SUBJETIVO) {
      assert.notEqual(comoSeLlamaLaPregunta(clave), clave, clave + " se le cuenta con su clave interna");
    }
  });
});

describe("y lo que no se sabe traducir se lee igual", () => {
  test("una respuesta desconocida pierde los guiones bajos", () => {
    /*
     * Feo pero legible. Lo que no puede pasar es que una respuesta nueva que
     * nadie tradujo deje al cliente sin explicacion.
     */
    assert.equal(comoSeLee("uso_principal", "algo_que_no_existe"), "algo que no existe");
  });

  test("y una pregunta desconocida, tambien", () => {
    assert.equal(comoSeLlamaLaPregunta("una_pregunta_nueva"), "una pregunta nueva");
  });

  test("y sin respuesta no se dice nada", () => {
    assert.equal(comoSeLee("uso_principal", ""), "");
    assert.equal(comoSeLee("uso_principal", null), "");
  });
});

describe("asi queda lo que lee el cerebro", () => {
  test("con nombres y respuestas de persona", () => {
    const dicho = comoSeCuentaElCliente({
      perfil: "autonomo",
      uso_principal: "visitas_clientes",
      ocupantes: "5_plazas_maletero_medio",
      horizonte_tenencia: "4_6",
    });

    assert.match(dicho, /- Para quién es: Soy autónomo/);
    assert.match(dicho, /- Uso principal: Visitar clientes \/ reuniones/);
    assert.match(dicho, /- Plazas y maletero: 3-5 plazas \+ maletero medio/);

    // Y ni rastro de los codigos, que es de lo que iba todo esto.
    assert.doesNotMatch(dicho, /visitas_clientes/);
    assert.doesNotMatch(dicho, /5_plazas_maletero_medio/);
  });

  test("y una pregunta de varias respuestas se cuenta entera", () => {
    const dicho = comoSeCuentaElCliente({ uso_principal: ["trabajo_diario", "familia"] });
    assert.match(dicho, /Ir al trabajo cada día, Llevar familia \/ niños/);
  });
});
