/**
 * Ensanchar la búsqueda no puede olvidar lo que el cliente ha dicho.
 *
 * ## Lo que pasaba, con el caso real delante
 *
 * Cuando la búsqueda principal no llena las cuatro ofertas, hay varias
 * búsquedas de emergencia que van ensanchando: sin modelo, sin marca, de toda
 * España. Cada una enumeraba sus criterios a mano, y **todas** se dejaban por el
 * camino los kilómetros máximos, la provincia y el «solo lo que se puede
 * enseñar». Las dos últimas ni el precio.
 *
 * A quien pidió un compacto de gasolina en Madrid con 100.000 km como máximo le
 * salió en el primer puesto un **Isuzu Trooper de 1989 con 322.000 km a 3.500 €,
 * de Umbrete (Sevilla)**. No fallaba nada: la búsqueda encontraba coches, solo
 * que no los suyos.
 *
 * ## La distinción que hay que mantener
 *
 * Ensanchar puede soltar **el modelo o la marca** —para eso está— pero no puede
 * soltar lo que el cliente ha dicho que no quiere. Un coche con el triple de
 * kilómetros de los que pidió no es una alternativa: es otro coche.
 *
 * ## Por qué se comprueba sobre el texto del fichero
 *
 * Porque el fallo era precisamente que cada llamada se escribía a mano, y lo que
 * hay que impedir que vuelva es eso. Una llamada nueva que no lleve el objeto
 * común es el mismo fallo otra vez, y no dará ningún error: enseñará coches que
 * nadie quería.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const FUENTE = fs
  .readFileSync(require.resolve("../../api/find-listing.js"), "utf8")
  .replace(/\r\n/g, "\n");

/** Cada llamada a la búsqueda de inventario, con lo que le pasa. */
function lasBusquedas() {
  const trozos = FUENTE.split("await listInventoryOffers({");
  return trozos.slice(1).map((t) => t.slice(0, t.indexOf("});")));
}

describe("lo que no se negocia", () => {
  test("está declarado una sola vez", () => {
    assert.match(FUENTE, /const loQueNoSeNegocia = \{/);
  });

  test("y lleva las cuatro cosas que se perdían", () => {
    const bloque = FUENTE.slice(
      FUENTE.indexOf("const loQueNoSeNegocia = {"),
      FUENTE.indexOf("const loQueNoSeNegocia = {") + 600
    );

    assert.match(bloque, /soloPresentables: true/, "volverian las ofertas sin foto");
    assert.match(bloque, /maxMileage/, "volveria el Isuzu de 322.000 km");
    assert.match(bloque, /maxPrice/, "volverian las ofertas por encima del presupuesto");
    assert.match(bloque, /provinciaFormas/, "volverian las ofertas de otra provincia");
  });
});

describe("todas las busquedas lo llevan", () => {
  test("hay varias, que es de donde viene el problema", () => {
    // Si solo hubiera una, lo de abajo no comprobaria gran cosa.
    assert.ok(lasBusquedas().length >= 2, String(lasBusquedas().length));
  });

  test("la principal lo escribe entero", () => {
    /*
     * La primera no usa el objeto porque enumera todos los criterios del test
     * -carroceria, combustible, ano, potencia...-, pero tiene que llevar estos.
     */
    const principal = lasBusquedas()[0];
    for (const campo of ["soloPresentables", "maxMileage", "maxPrice", "provinciaFormas"]) {
      assert.match(principal, new RegExp(campo), `la busqueda principal no lleva ${campo}`);
    }
  });

  test("y las de emergencia lo heredan", () => {
    const sinEl = lasBusquedas()
      .slice(1)
      .map((b, i) => (b.includes("...loQueNoSeNegocia") ? null : i + 2))
      .filter(Boolean);

    assert.deepEqual(sinEl, [],
      `las busquedas ${sinEl.join(", ")} ensanchan olvidando lo que pidio el cliente`);
  });
});
