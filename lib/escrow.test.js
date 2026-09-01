/**
 * El dinero retenido hasta que alguien nuestro ve el coche.
 *
 * Esto no es una comprobación técnica: es **la promesa entera del producto**. Un
 * particular que compra un coche en Alemania por su cuenta transfiere veinte mil
 * euros a un desconocido de otro país y espera. Lo que vendemos es que aquí eso
 * no pasa: el dinero está en una cuenta de depósito y lo suelta alguien que ha
 * visto el coche con sus ojos.
 *
 * Si esta lógica se rompe en silencio, lo que se rompe es la razón de existir del
 * servicio. Por eso está aparte, sin base de datos ni pantalla, y por eso tiene
 * más pruebas de las que su tamaño sugiere.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  ESTADOS, TRANSICIONES,
  loQuePagaAhora, sePuedeLiberar, PORQUE_NO_SE_LIBERA, transicionValida,
} = require("./escrow.js");

describe("lo que deposita el cliente", () => {
  test("el coche y nuestro fee", () => {
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000 });
    assert.equal(d.coche, 18000);
    assert.equal(d.fee, 3000);
    assert.equal(d.total, 21000);
  });

  test("el coche entero, no un porcentaje", () => {
    // La fianza del 30 % era del modelo anterior, cuando comprábamos nosotros el
    // coche. Ahora se lo compra él al vendedor alemán: ese dinero tiene que estar.
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000 });
    assert.equal(d.coche, 18000, "se estaría depositando una parte del coche");
  });

  test("y la garantía si la ha elegido", () => {
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000, garantia: 590 });
    assert.equal(d.garantia, 590);
    assert.equal(d.total, 21590);
  });

  test("sin garantía, ni línea ni importe", () => {
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000 });
    assert.equal(d.garantia, 0);
    assert.ok(!d.destinos.some((x) => /garant/i.test(x.concepto)));
  });

  test("cada parte dice a quién va", () => {
    // El día que haya que liberar, se libera lo del vendedor. Lo nuestro no
    // viaja a Alemania, y la garantía va a un tercero que no es ninguno de los
    // dos. Sin esto, alguien tendría que decidirlo a mano con el dinero delante.
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000, garantia: 590 });
    assert.deepEqual(d.destinos.map((x) => [x.importe, x.a]), [
      [18000, "vendedor"],
      [3000, "popcar"],
      [590, "proveedor"],
    ]);
  });

  test("las partes suman el total", () => {
    const d = loQuePagaAhora({ precioCoche: 18000, fee: 3000, garantia: 590 });
    assert.equal(d.destinos.reduce((s, x) => s + x.importe, 0), d.total);
  });

  test("con datos que faltan no revienta ni inventa", () => {
    const d = loQuePagaAhora({});
    assert.equal(d.total, 0);
  });
});

/**
 * Cuándo se suelta el dinero. Aquí es donde vive el producto.
 */
describe("liberar el dinero", () => {
  test("solo si alguien nuestro ha visto el coche", () => {
    const r = sePuedeLiberar({ estado: "retenido", verificadoEnAlemania: true });
    assert.equal(r.puede, true);
  });

  test("sin verificar, no", () => {
    // Es la única condición, y es la que sostiene todo lo demás.
    const r = sePuedeLiberar({ estado: "retenido", verificadoEnAlemania: false });
    assert.equal(r.puede, false);
    assert.equal(r.motivo, "sin_verificar");
  });

  test("si no ha pagado, tampoco: no hay nada que soltar", () => {
    const r = sePuedeLiberar({ estado: "pendiente", verificadoEnAlemania: true });
    assert.equal(r.puede, false);
    assert.equal(r.motivo, "sin_pagar");
  });

  test("y no se libera dos veces", () => {
    // Un segundo clic con el dinero ya enviado es un segundo pago al vendedor.
    const r = sePuedeLiberar({ estado: "liberado", verificadoEnAlemania: true });
    assert.equal(r.puede, false);
    assert.equal(r.motivo, "ya_liberado");
  });

  test("ni se libera lo que ya se devolvió", () => {
    const r = sePuedeLiberar({ estado: "devuelto", verificadoEnAlemania: true });
    assert.equal(r.puede, false);
    assert.equal(r.motivo, "ya_devuelto");
  });

  test("cada negativa se puede explicar, no solo apagar un botón", () => {
    // Quien lo intenta tiene que saber qué le falta. Un botón gris no dice nada
    // y acaba en una llamada preguntando por qué.
    for (const motivo of ["sin_pagar", "sin_verificar", "ya_liberado", "ya_devuelto"]) {
      assert.ok(PORQUE_NO_SE_LIBERA[motivo], `falta el motivo ${motivo}`);
    }
    assert.match(PORQUE_NO_SE_LIBERA.sin_verificar, /Alemania/);
  });
});

describe("los estados del depósito", () => {
  test("son cuatro y no hay más", () => {
    assert.deepEqual(ESTADOS, ["pendiente", "retenido", "liberado", "devuelto"]);
  });

  test("se paga antes de retener", () => {
    assert.equal(transicionValida("pendiente", "retenido"), true);
    assert.equal(transicionValida("pendiente", "liberado"), false,
      "se estaría soltando dinero que nadie ha ingresado");
  });

  test("de retenido se sale por los dos lados", () => {
    assert.equal(transicionValida("retenido", "liberado"), true);
    assert.equal(transicionValida("retenido", "devuelto"), true);
  });

  test("liberado y devuelto son finales", () => {
    // El dinero ya se movió. Cambiar el estado después no lo trae de vuelta, y
    // dejarlo cambiar esconde lo que pasó de verdad.
    assert.deepEqual(TRANSICIONES.liberado, []);
    assert.deepEqual(TRANSICIONES.devuelto, []);
  });

  test("un estado inventado no vale", () => {
    assert.equal(transicionValida("retenido", "medio_liberado"), false);
    assert.equal(transicionValida("cualquier_cosa", "liberado"), false);
  });
});

/**
 * El impuesto, y por qué va como provisión.
 *
 * Si fuera un precio cerrado y el real saliera por encima —pasa en los coches de
 * más de 160 g/km, que pagan el doble del tramo que estimamos— la diferencia
 * saldría del fee de PopCar. Con una provisión, el impuesto lo paga siempre el
 * cliente, que es de quien es.
 */
describe("el impuesto dentro del depósito", () => {
  const { liquidacionDelImpuesto } = require("./escrow.js");

  test("entra en lo que paga", () => {
    // Dejarlo fuera obligaba a pedirle mil cuatrocientos euros más con el coche
    // ya pagado al alemán y de camino. Y el coche está a su nombre desde el
    // principio: ese segundo cobro no se puede caer.
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420 });
    assert.equal(d.impuesto, 1420);
    assert.equal(d.total, 21310);
  });

  test("va marcado como no firme, que es lo que dice que hay que liquidarlo", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420 });
    const porConcepto = Object.fromEntries(d.destinos.map((x) => [x.a, x.firme]));
    assert.equal(porConcepto.hacienda, false, "el impuesto es una estimación, no un precio");
    assert.equal(porConcepto.vendedor, true);
    assert.equal(porConcepto.popcar, true, "nuestro fee sí es firme: no se ajusta nunca");
  });

  test("y va a Hacienda, no a nosotros ni al vendedor", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000, impuesto: 1420 });
    const imp = d.destinos.find((x) => /impuesto/i.test(x.concepto));
    assert.equal(imp.a, "hacienda");
  });

  test("sin impuesto no sale la línea", () => {
    const d = loQuePagaAhora({ precioCoche: 16890, fee: 3000 });
    assert.equal(d.impuesto, 0);
    assert.ok(!d.destinos.some((x) => /impuesto/i.test(x.concepto)));
  });
});

describe("liquidar el impuesto cuando se sabe", () => {
  const { liquidacionDelImpuesto } = require("./escrow.js");

  test("si el real sale más, se le cobra la diferencia", () => {
    // Este es el caso que protege el margen: sin liquidación, esos 680 € los
    // pondría PopCar.
    const l = liquidacionDelImpuesto({ provision: 1420, real: 2100 });
    assert.equal(l.diferencia, 680);
    assert.equal(l.quien, "cobrar");
  });

  test("si sale menos, se le devuelve", () => {
    // Lo normal, porque la estimación se equivoca hacia arriba a propósito.
    const l = liquidacionDelImpuesto({ provision: 1420, real: 900 });
    assert.equal(l.diferencia, -520);
    assert.equal(l.quien, "devolver");
  });

  test("y si cuadra, no se mueve nada", () => {
    assert.equal(liquidacionDelImpuesto({ provision: 1420, real: 1420 }).quien, "cuadra");
  });

  test("nuestro fee no entra en esa cuenta", () => {
    // La provisión es del cliente y el ajuste es suyo, en los dos sentidos. Si el
    // fee entrara aquí, un impuesto alto se comería lo que ganamos.
    const l = liquidacionDelImpuesto({ provision: 1420, real: 2100 });
    assert.equal(l.diferencia, 2100 - 1420, "hay algo más metido en la resta");
  });
});
