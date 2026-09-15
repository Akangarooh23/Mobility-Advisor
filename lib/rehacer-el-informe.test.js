"use strict";

/**
 * Rehacer el informe de una tasación ya entregada.
 *
 * Lo que se protege: que el documento **diga el precio que se le dijo**. Las
 * tasaciones de antes de archivar los PDF no tienen fichero y se rehacen al
 * pedirlas; si al rehacerlas se recalculara el precio, el cliente se bajaría un
 * informe que contradice el número de su propia ficha y el del correo que ya
 * tiene. En la prueba real la diferencia eran 759 €.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { conElPrecioGuardado, comoSeBusca } = require("./rehacer-el-informe");

/** Un informe recién calculado, con el precio de hoy. */
const DE_HOY = {
  priceOptimal: 20036,
  priceLow: 18500,
  priceHigh: 21800,
  comparables: 385,
  histogram: [1, 2, 3],
  vehicle: { brand: "Volkswagen" },
};

describe("manda el precio que se le dijo", () => {
  test("el del informe pasa a ser el guardado", () => {
    const r = conElPrecioGuardado(DE_HOY, 20795);
    assert.equal(r.priceOptimal, 20795);
  });

  test("y la banda se mueve con él", () => {
    /*
     * Dejarla como salga del cálculo nuevo podría dejar el precio fijado fuera
     * de su propio rango — una contradicción que se ve a simple vista en la
     * barra del PDF.
     */
    const r = conElPrecioGuardado(DE_HOY, 20795);
    assert.ok(r.priceLow < r.priceOptimal, `${r.priceLow} no es menor que ${r.priceOptimal}`);
    assert.ok(r.priceHigh > r.priceOptimal, `${r.priceHigh} no es mayor que ${r.priceOptimal}`);
  });

  test("en la misma proporción, no a ojo", () => {
    const r = conElPrecioGuardado(DE_HOY, 20795);
    const proporcion = 20795 / 20036;
    assert.equal(r.priceLow, Math.round(18500 * proporcion));
    assert.equal(r.priceHigh, Math.round(21800 * proporcion));
  });

  test("y lo demás del informe se conserva", () => {
    // Los comparables y el histograma son datos de mercado: no se tocan.
    const r = conElPrecioGuardado(DE_HOY, 20795);
    assert.equal(r.comparables, 385);
    assert.deepEqual(r.histogram, [1, 2, 3]);
    assert.deepEqual(r.vehicle, { brand: "Volkswagen" });
  });
});

describe("sin un precio que valga, no se toca nada", () => {
  test("un cero no convierte el informe en un informe a cero euros", () => {
    for (const malo of [0, null, undefined, "", "no sé", -5]) {
      assert.equal(conElPrecioGuardado(DE_HOY, malo).priceOptimal, 20036, String(malo));
    }
  });

  test("ni un informe sin precio calculado se arregla dividiendo por cero", () => {
    const sinPrecio = { ...DE_HOY, priceOptimal: 0 };
    assert.equal(conElPrecioGuardado(sinPrecio, 20795).priceOptimal, 0);
  });

  test("y sin informe no revienta", () => {
    assert.equal(conElPrecioGuardado(null, 20795), null);
  });
});

describe("cómo se le busca mercado al coche", () => {
  test("los números llegan como números", () => {
    // De la base salen como texto —«30000», «2022»— y el mercado espera números.
    const b = comoSeBusca({ brand: "VW", model: "T-Roc", year: "2022", mileage: "30000", cv: "110", powerCv: "110" });
    assert.equal(b.year, 2022);
    assert.equal(b.mileage, 30000);
    assert.equal(b.powerCv, 110);
  });

  test("los kilómetros con puntos se entienden", () => {
    assert.equal(comoSeBusca({ mileage: "120.000" }).mileage, 120000);
  });

  test("y lo que no es un número se queda en nulo, no en cero", () => {
    /*
     * Un cero es un dato: «este coche tiene cero kilómetros». Nulo es «no lo
     * sé», que es lo que hay cuando el campo está vacío.
     */
    const b = comoSeBusca({ year: "", mileage: "no lo sé", powerCv: null });
    assert.equal(b.year, null);
    assert.equal(b.mileage, null);
    assert.equal(b.powerCv, null);
  });
});
