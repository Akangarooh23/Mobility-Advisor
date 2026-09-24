/**
 * A quien pide un gasolina no se le promete una etiqueta CERO.
 *
 * ## Lo que salió en pantalla
 *
 * Ana pidió un **gasolina, compacto, de menos de 100.000 km y menos de
 * 10.000 €**. El análisis le contestó:
 *
 *     PROPULSIONES VIABLES   híbrido · PHEV · gasolina eficiente
 *     ETIQUETA DGT           CERO
 *     «Te deja mejor posicionado frente a ZBE con etiqueta CERO»
 *
 * La CERO es la etiqueta de los eléctricos y de los híbridos enchufables con
 * autonomía declarada. Un gasolina de menos de 10.000 € no la tiene ni la
 * puede tener, y no es un matiz de redacción: esa letra decide si puedes
 * entrar en el centro de Madrid. Quien compra por eso acabaría comprando el
 * coche equivocado.
 *
 * ## Las dos causas, que se alimentaban
 *
 * La lista de motorizaciones se deducía del garaje y del entorno de uso **sin
 * mirar lo contestado** —lo del cliente solo se le añadía delante, y solo si
 * le había dado peso a esa pregunta—. Y la etiqueta salía de esa lista: como
 * llevaba PHEV dentro, salía CERO.
 *
 * ## Y por qué «B o C» y no «C»
 *
 * Porque un gasolina de 2007 es C y uno de 2004 es B. Sin la fecha de
 * matriculación no se sabe, y poner la letra que suena mejor es afirmar algo
 * que no se puede sostener.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  laMotorizacionQuePidio,
  laEtiquetaQueLeCorresponde,
  dejaEntrarEnLaZbe,
} = require("../la-motorizacion-que-pidio");

describe("lo que ha elegido es la lista", () => {
  test("quien pide gasolina no recibe hibrido y PHEV por delante", () => {
    assert.deepEqual(
      laMotorizacionQuePidio({ propulsion_preferida: ["gasolina"] }),
      ["gasolina eficiente"]
    );
  });

  test("y quien elige dos, las dos, en su orden", () => {
    assert.deepEqual(
      laMotorizacionQuePidio({ propulsion_preferida: ["hibrido_no_enchufable", "gasolina"] }),
      ["hibrido", "gasolina eficiente"]
    );
  });

  test("«sin preferencia» devuelve nada, para que se deduzca", () => {
    /*
     * `null` y no una lista vacia: vacio seria «no quiere ninguna», y lo que
     * pasa es que no ha elegido. Quien llama tiene que poder distinguirlo.
     */
    assert.equal(laMotorizacionQuePidio({ propulsion_preferida: ["indiferente_motor"] }), null);
    assert.equal(laMotorizacionQuePidio({}), null);
  });

  test("y si la marca junto a «sin preferencia», vale lo elegido", () => {
    assert.deepEqual(
      laMotorizacionQuePidio({ propulsion_preferida: ["indiferente_motor", "diesel"] }),
      ["diesel"]
    );
  });
});

describe("la etiqueta de cada motorizacion", () => {
  test("un gasolina NO es CERO", () => {
    const etiqueta = laEtiquetaQueLeCorresponde(["gasolina eficiente"]);

    assert.notEqual(etiqueta, "CERO");
    assert.equal(etiqueta, "B o C");
  });

  test("ni un diesel", () => {
    assert.equal(laEtiquetaQueLeCorresponde(["diesel"]), "B o C");
  });

  test("un electrico si, y un hibrido es ECO", () => {
    assert.equal(laEtiquetaQueLeCorresponde(["electrico"]), "CERO");
    assert.equal(laEtiquetaQueLeCorresponde(["PHEV"]), "CERO");
    assert.equal(laEtiquetaQueLeCorresponde(["hibrido"]), "ECO");
  });

  test("manda la primera, que es la que se recomienda", () => {
    /*
     * Antes bastaba con que la palabra «PHEV» apareciera en cualquier
     * posicion de la lista para afirmar CERO. Si lo que se recomienda es el
     * gasolina, la etiqueta es la del gasolina.
     */
    assert.equal(laEtiquetaQueLeCorresponde(["gasolina eficiente", "PHEV"]), "B o C");
  });

  test("sin motorizacion no se dice nada", () => {
    assert.equal(laEtiquetaQueLeCorresponde([]), "");
  });
});

describe("y el bulo de la ZBE no se cuela", () => {
  test("solo ECO y CERO dejan entrar", () => {
    assert.equal(dejaEntrarEnLaZbe("CERO"), true);
    assert.equal(dejaEntrarEnLaZbe("ECO"), true);
    assert.equal(dejaEntrarEnLaZbe("B o C"), false);
    assert.equal(dejaEntrarEnLaZbe("C"), false);
  });

  test("asi que a quien pidio gasolina no se le promete la ZBE", () => {
    const suyas = laMotorizacionQuePidio({ propulsion_preferida: ["gasolina"] });
    assert.equal(dejaEntrarEnLaZbe(laEtiquetaQueLeCorresponde(suyas)), false);
  });
});

describe("el analisis usa esto y no lo que diga el modelo", () => {
  test("la etiqueta del modelo no manda sobre la motorizacion", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/analyze.js"), "utf8");

    assert.match(fuente, /etiqueta_dgt: laEtiquetaQueLeCorresponde\(propulsionesViables\)/);
  });

  test("y la lista de motorizaciones empieza por lo que eligio", () => {
    const fs = require("node:fs");
    const fuente = fs.readFileSync(require.resolve("../../api/analyze.js"), "utf8");
    const funcion = fuente.slice(
      fuente.indexOf("function getViablePropulsions"),
      fuente.indexOf("function getPrimaryType")
    );

    assert.match(funcion, /const lasSuyas = laMotorizacionQuePidio\(answers\)/);
    assert.ok(
      funcion.indexOf("lasSuyas") < funcion.indexOf("const propulsions = []"),
      "lo deducido se calcula antes de mirar lo que pidio"
    );
  });
});
