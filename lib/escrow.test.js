/**
 * Lo que paga el cliente, y a dónde va cada parte.
 *
 * Esto no es una comprobación técnica: es **la promesa entera del producto**. Un
 * particular que compra un coche en Alemania por su cuenta transfiere veinte mil
 * euros a un desconocido de otro país y espera. Lo que vendemos es que aquí eso
 * no pasa: ese dinero no llega al vendedor hasta que alguien nuestro ha visto el
 * coche con sus ojos.
 *
 * Lo que se puede hacer con el dinero —soltarlo, devolverlo, liquidar el
 * impuesto— vive en el ERP, que es quien lo mueve. Aquí solo la cuenta.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loQuePagaAhora } = require("./escrow.js");

describe("lo que paga el cliente", () => {
  test("el coche, nuestro fee y el impuesto", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420 });
    assert.equal(d.coche, 16890);
    assert.equal(d.fee, 3000);
    assert.equal(d.impuesto, 1420);
    assert.equal(d.total, 21310);
  });

  test("el coche entero, no un porcentaje", () => {
    // La fianza del 30 % era del modelo anterior, cuando comprábamos nosotros el
    // coche. Ahora se lo compra él al vendedor alemán: ese dinero tiene que estar.
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000 });
    assert.equal(d.coche, 16890, "se estaría pagando una parte del coche");
  });

  test("y la garantía si la ha elegido", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420, garantia: 590 });
    assert.equal(d.garantia, 590);
    assert.equal(d.total, 21900);
  });

  test("sin garantía, ni línea ni importe", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000 });
    assert.equal(d.garantia, 0);
    assert.ok(!d.destinos.some((x) => /garant/i.test(x.concepto)));
  });

  test("cada parte dice a quién va", () => {
    // El día que haya que liberar, se libera lo del vendedor. Lo nuestro no
    // viaja a Alemania, el impuesto es de Hacienda y la garantía de un tercero.
    // Sin esto, alguien tendría que decidirlo a mano con el dinero delante.
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420, garantia: 590 });
    assert.deepEqual(d.destinos.map((x) => [x.importe, x.a]), [
      [16890, "vendedor"],
      [3000, "popcar"],
      [1420, "hacienda"],
      [590, "proveedor"],
    ]);
  });

  test("las partes suman el total", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420, garantia: 590 });
    assert.equal(d.destinos.reduce((s, x) => s + x.importe, 0), d.total);
  });

  test("con datos que faltan no revienta ni inventa", () => {
    assert.equal(loQuePagaAhora({}).total, 0);
  });
});

/**
 * El impuesto, y por qué va marcado como no firme.
 *
 * Es una estimación mientras no tengamos el CO₂ de cada coche. Si fuera un
 * precio cerrado y el real saliera por encima —pasa en los de más de 160 g/km,
 * que pagan el doble del tramo que estimamos— esa diferencia saldría del fee de
 * PopCar. Marcarlo a cuenta es lo que hace que la pague quien le toca.
 */
describe("qué es firme y qué va a cuenta", () => {
  const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420, garantia: 590 });
  const porDestino = Object.fromEntries(d.destinos.map((x) => [x.a, x.firme]));

  test("el impuesto va a cuenta", () => {
    assert.equal(porDestino.hacienda, false,
      "sería un precio cerrado y la diferencia la pondríamos nosotros");
  });

  test("y nuestro fee es firme: no se ajusta nunca", () => {
    assert.equal(porDestino.popcar, true);
  });

  test("el coche y la garantía también", () => {
    assert.equal(porDestino.vendedor, true);
    assert.equal(porDestino.proveedor, true);
  });
});
