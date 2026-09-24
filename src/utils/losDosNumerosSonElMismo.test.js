/**
 * La misma comprobación está escrita dos veces, y tienen que decir lo mismo.
 *
 * ## Lo que pasó
 *
 * `isCompleteAdvisorResult` existe en `api/analyze.js` y en
 * `src/utils/advisorResults.js`. El servidor la usa para decidir si se queda
 * con lo que devolvió el modelo o cae al respaldo determinista; la pantalla,
 * para decidir si enseña el resultado o un error.
 *
 * Al bajar de cinco modelos recomendados a dos —exigir cinco obligaba a
 * rellenar la lista con coches que contradicen lo contestado— se cambió **solo
 * la del servidor**. Así que el servidor mandaba un análisis correcto con dos
 * modelos y la pantalla lo rechazaba:
 *
 *     Error: La IA ha devuelto un analisis incompleto. Intentalo de nuevo.
 *
 * El test entero, con sus veinte preguntas contestadas y sus dos minutos de
 * espera, terminaba en un recuadro rojo.
 *
 * ## Por qué no se unifican en un fichero
 *
 * Porque `src/` no puede importar de `lib/` ni de `api/` en este proyecto. La
 * copia está permitida; lo que no está permitido es que se separen sin que
 * nadie se entere. De eso va esta prueba.
 */
import fs from "fs";
import path from "path";

const RAIZ = path.join(__dirname, "..", "..");

const laFuncion = (fichero) => {
  const fuente = fs.readFileSync(path.join(RAIZ, fichero), "utf8").replace(/\r\n/g, "\n");
  const desde = fuente.indexOf("function isCompleteAdvisorResult");
  expect(desde).toBeGreaterThan(-1);
  return fuente.slice(desde, fuente.indexOf("\n}", desde));
};

/** Los mínimos que exige cada copia, por el campo que comprueban. */
const losMinimos = (codigo) => {
  const encontrados = {};
  const regex = /normalized\.(\w+)(?:\?)?\.length >= (\d+)|main\.(\w+)\.length >= (\d+)/g;
  let m = regex.exec(codigo);
  while (m) {
    encontrados[m[1] || m[3]] = Number(m[2] || m[4]);
    m = regex.exec(codigo);
  }
  return encontrados;
};

describe("las dos copias exigen lo mismo", () => {
  const delServidor = losMinimos(laFuncion("api/analyze.js"));
  const deLaPantalla = losMinimos(laFuncion("src/utils/advisorResults.js"));

  test("las dos comprueban los mismos campos", () => {
    expect(Object.keys(deLaPantalla).sort()).toEqual(Object.keys(delServidor).sort());
  });

  test("y con los mismos minimos", () => {
    expect(deLaPantalla).toEqual(delServidor);
  });

  test("y los modelos recomendados no los exige ninguna", () => {
    /*
     * Este es el que se separo: cinco en la pantalla y dos en el servidor. Y
     * al mirarlo de cerca no deberia estar en ninguna de las dos: con premium
     * alemana, escandinava o nueva china la lista de repuesto se queda vacia
     * al filtrarla por marca, y el analisis entero acababa en un recuadro
     * rojo. Un consejo sin sugerencias de modelo sigue siendo un consejo.
     */
    expect(deLaPantalla.vehiculos_recomendados).toBeUndefined();
    expect(delServidor.vehiculos_recomendados).toBeUndefined();
  });
});
