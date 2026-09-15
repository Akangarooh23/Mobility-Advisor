"use strict";

/**
 * Que la tasación entregada quede pegada a su coche y con su precio.
 *
 * ## Lo que pasó
 *
 * Ana se hizo la tasación gratuita, le llegó el correo con «20.795 €» y 385
 * comparables, y en su panel seguía saliendo «La tasación · No te la has hecho
 * todavía». En la base la fila estaba, pero con `vehicle_id` y `estimate_value`
 * a nulo.
 *
 * Dos fallos, los dos callados:
 *
 * 1. El precio se mandaba como `estimate_value` y quien escribe lee
 *    `estimateValue`. Una letra de diferencia, ningún error, el número perdido.
 * 2. Del coche no se mandaba nada, así que la fila no se podía pegar a ninguno
 *    y la puerta del encargo no se abría nunca.
 *
 * ## Por qué se prueba contra el escritor de verdad
 *
 * Un test que compruebe «se llama a `addValuationByEmail` con estas claves» no
 * habría cazado nada: las claves eran las que yo creía, y el que no las
 * entendía era el otro lado. Aquí se mira lo que **acaba en la fila**, que es
 * lo único que importa.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TASACION = fs.readFileSync(path.join(__dirname, "tasacion.js"), "utf8");
const TIENDA = fs.readFileSync(path.join(__dirname, "billingStore.js"), "utf8");

/** Las claves que el escritor lee de lo que se le pasa. */
function loQueEntiendeElEscritor() {
  const desde = TIENDA.indexOf("INSERT INTO moveadvisor_user_valuations");
  assert.ok(desde > 0, "no encuentro dónde se escribe la tasación");
  const trozo = TIENDA.slice(desde - 2500, desde + 2000);
  return new Set([...trozo.matchAll(/valuation\?\.([a-zA-Z_]+)/g)].map((m) => m[1]));
}

/** Las que le manda el flujo al entregar. */
function loQueMandaElFlujo() {
  const desde = TASACION.indexOf("await addValuationByEmail(email, {");
  assert.ok(desde > 0, "no encuentro la llamada que deja constancia");
  const trozo = TASACION.slice(desde, TASACION.indexOf("});", desde));
  return new Set(
    [...trozo.matchAll(/^\s{6}([a-zA-Z_]+):/gm)].map((m) => m[1])
  );
}

describe("el flujo y el escritor hablan el mismo idioma", () => {
  test("cada clave que se manda, el escritor la entiende", () => {
    /*
     * El guardián de verdad. `estimate_value` frente a `estimateValue` no da
     * ningún error: se guarda la fila, con el número a nulo, y nadie se entera
     * hasta que un cliente pregunta por qué le pedimos algo que ya hizo.
     */
    const entiende = loQueEntiendeElEscritor();
    const manda = loQueMandaElFlujo();
    assert.ok(manda.size >= 5, `solo veo ${manda.size} claves: ${[...manda].join(", ")}`);
    for (const clave of manda) {
      assert.ok(
        entiende.has(clave),
        `se manda «${clave}» y el escritor no lo lee: se guardaría a nulo sin decir nada. ` +
        `Lee: ${[...entiende].join(", ")}`
      );
    }
  });
});

describe("lo que no puede faltar", () => {
  test("el precio va con el nombre que el escritor lee", () => {
    assert.match(TASACION, /estimateValue: Number\(reportData\?\.priceOptimal\)/);
    // Y el de antes no se queda de acompañante: dos nombres para lo mismo es
    // volver a tener el fallo escondido a la vista.
    assert.doesNotMatch(TASACION, /estimate_value:/);
  });

  test("y la tasación se cuelga del coche", () => {
    /*
     * Sin esto la fila queda suelta y la puerta de «La tasación» del encargo no
     * se abre nunca, por muchas tasaciones que se haga.
     */
    assert.match(TASACION, /vehicleId: await cualDeSusCoches\(email, vehicle\.plate\)/);
  });

  test("la matrícula se compara sin espacios ni guiones", () => {
    // Él la escribe «8888 LXR» y en su ficha está «8888LXR». Comparar en crudo
    // dejaría la tasación suelta por un espacio.
    const { comoSeCompara } = require("./tasacion");
    assert.equal(comoSeCompara("8888 lxr"), "8888LXR");
    assert.equal(comoSeCompara("8888-LXR"), "8888LXR");
    assert.equal(comoSeCompara(""), "");
    assert.equal(comoSeCompara(null), "");
  });
});

describe("y si no se puede enganchar, no se pierde la fila", () => {
  test("un coche que no es suyo deja la tasación suelta, no la tira", () => {
    /*
     * Esa fila es la que cuenta las gratuitas. Perderla le regalaría tasaciones
     * gratis para siempre, que es mucho peor que quedarse sin el enganche.
     */
    const desde = TASACION.indexOf("async function cualDeSusCoches");
    const trozo = TASACION.slice(desde, TASACION.indexOf("\n}", desde));
    assert.match(trozo, /return null/, "sin coche tiene que devolver nulo, no lanzar");
    assert.match(trozo, /catch/, "un fallo del garaje no puede tumbar el registro");
  });
});
