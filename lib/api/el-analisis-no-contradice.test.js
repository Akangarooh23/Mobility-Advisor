/**
 * El análisis no puede contradecir lo que se ha contestado.
 *
 * ## De dónde sale esta prueba
 *
 * De contestar el test entero, como una persona: pareja con un niño en
 * Valencia, sin garaje, **al contado**, compacto, **gasolina o híbrido no
 * enchufable**, automático, de profesional, **marca generalista europea**,
 * para más de siete años.
 *
 * Y de leer lo que contestó:
 *
 *     Compra FINANCIADA de un compacto equilibrado
 *     480 - 750 EUR/mes
 *     ETIQUETA DGT: ECO
 *     PROPULSIONES: hibrido suave · hibrido_no_enchufable · gasolina
 *     MODELOS: Toyota C-HR, Kia Niro, Hyundai Kona, Nissan Qashqai
 *
 * Cuatro contradicciones seguidas: la forma de pago, la etiqueta, una
 * motorización que nadie marcó y cuatro SUV asiáticos a quien pidió un
 * compacto europeo.
 *
 * ## La regla
 *
 * Lo que el cliente ha contestado manda sobre lo que devuelva el modelo. El
 * modelo escribe el consejo; no decide lo que el cliente ya ha decidido.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const FUENTE = fs
  .readFileSync(require.resolve("../../api/analyze.js"), "utf8")
  .replace(/\r\n/g, "\n");

describe("la forma de pago la ha dicho el", () => {
  test("no se copia el tipo que devuelve el modelo sin mirarlo", () => {
    /*
     * Contestando «pagando al contado» y «tengo el capital completo», el
     * analisis decia «Compra FINANCIADA». Y sobre ese tipo se construye el
     * resto: el coste mensual, el comparador y el plan de accion.
     */
    assert.match(FUENTE, /const loQueDijoElModelo = normalizeText\(main\.tipo\)/);
    assert.match(FUENTE, /const loQueSeDeduce = getPrimaryType\(answers/);
  });

  test("y solo se corrige cuando es una compra, que es cuando el lo ha dicho", () => {
    /*
     * En renting o carsharing el cliente no ha contestado «contado o
     * financiado», asi que ahi no hay nada que corregir.
     */
    assert.match(FUENTE, /esCompra\(loQueDijoElModelo\) && loQueSeDeduce !== loQueDijoElModelo/);
  });
});

describe("la motorizacion tambien", () => {
  test("si ha marcado alguna, esa es la lista", () => {
    /*
     * El modelo anadia «hibrido suave» a quien habia marcado gasolina e
     * hibrido no enchufable. Y como la etiqueta se calcula del primero de esa
     * lista, el informe acababa prometiendo una ECO.
     */
    assert.match(FUENTE, /const lasSuyas = laMotorizacionQuePidio\(answers\)/);
    assert.match(FUENTE, /const propulsionesViables = lasSuyas\s*\n?\s*\? lasSuyas/);
  });

  test("y la etiqueta sale de ahi, no de lo que diga el modelo", () => {
    assert.match(FUENTE, /etiqueta_dgt: laEtiquetaQueLeCorresponde\(propulsionesViables\)/);
  });
});

describe("y los modelos salen de la base", () => {
  test("se le pregunta a la base antes de generar nada", () => {
    assert.match(FUENTE, /const losQueExisten = await losModelosQueHaySinPasarse\(/);
    assert.ok(
      FUENTE.indexOf("const losQueExisten = await losModelosQueHaySinPasarse(")
        < FUENTE.indexOf("const generation = await generateContent("),
      "se pregunta despues de generar, que ya no sirve de nada"
    );
  });

  test("y esa consulta no puede llevarse por delante el analisis", () => {
    /*
     * Con un perfil de SUV premium aleman en Madrid tardo 104 segundos. Es una
     * mejora de la recomendacion, no un requisito para darla.
     */
    assert.match(FUENTE, /losModelosQueHaySinPasarse/);
  });

  test("y se le dan al modelo dentro del encargo", () => {
    assert.match(FUENTE, /const elEncargo = conLosModelosDelante\(prompt, losQueExisten\)/);
    assert.match(FUENTE, /LOS MODELOS QUE DE VERDAD HAY PARA ESTE PERFIL/);
  });

  test("con la prohibicion de proponer otros", () => {
    assert.match(FUENTE, /SOLO puede contener modelos de esa lista/);
  });

  test("y esa lista es solo para los modelos, no para el titulo", () => {
    /*
     * Con la primera version el titulo paso a ser «Ford Focus Compacto
     * Automatico Nacional». El titulo describe la MODALIDAD -comprar al
     * contado, financiar, renting- y no un coche.
     */
    assert.match(FUENTE, /El `titulo` y el `resumen` describen la MODALIDAD/);
  });

  test("lo que devuelve se comprueba contra la lista, en los tres caminos", () => {
    /*
     * Los tres: respuesta buena, respuesta reparada y respaldo determinista.
     * El respaldo es el que proponia los cuatro SUV asiaticos.
     */
    const veces = (FUENTE.match(/soloLosQueExisten\(/g) || []).length;
    assert.ok(veces >= 4, "solo aparece " + veces + " veces contando la definicion");
  });

  test("y si no hay lista, no se toca nada", () => {
    // Sin base o sin resultados, la recomendacion se queda como estaba.
    assert.match(FUENTE, /if \(!modelos\.length\) return resultado;/);
    assert.match(FUENTE, /if \(!modelos\.length\) return prompt;/);
  });
});

describe("y la respuesta del modelo cabe entera", () => {
  test("el tope de salida da para el JSON completo", () => {
    /*
     * Con 2.200 se cortaba SIEMPRE: la respuesta buena necesita 2.375 de
     * salida mas 354 de razonamiento. El JSON llegaba partido y el analisis
     * caia al respaldo determinista sin que nadie se enterara.
     */
    const tope = Number(FUENTE.match(/maxOutputTokens: (\d+)/)[1]);
    assert.ok(tope >= 4000, "el tope es " + tope + ", la respuesta necesita casi 2.800");
  });

  test("y si aun asi se usa el respaldo, se dice por que", () => {
    assert.match(FUENTE, /se usa el respaldo determinista: /);
    assert.match(FUENTE, /la respuesta ha llegado cortada por maxOutputTokens/);
  });
});
