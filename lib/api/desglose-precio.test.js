/**
 * El desglose que se le enseña al cliente, y que las cuentas cuadren.
 *
 * PopCar **no vende el coche**: lo vende el concesionario alemán al cliente
 * español. Nosotros cobramos un fee por encargarnos de todo lo de en medio.
 * Eso hace que el desglose no sea un adorno: cada línea va a un sitio distinto
 * —el coche al vendedor, el fee a nosotros, el impuesto a Hacienda— y el cliente
 * tiene derecho a saber cuál es cuál.
 *
 * Lo que se fija aquí es que **las líneas sumen exactamente el precio de
 * arriba**. Un total que no cuadra con su desglose es peor que no desglosar: le
 * dice al cliente que hay algo que no le estamos contando.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  desgloseParaElCliente, precioPuestoAqui, sqlPrecioPuestoAqui,
  FEE_POPCAR, IMPUESTO_MATRICULACION,
} = require("../coste-importacion.js");

const COCHE = 18000;
const AQUI = 24000;

describe("el precio partido", () => {
  test("las líneas suman el total, y el total es el precio", () => {
    const d = desgloseParaElCliente(COCHE, AQUI);
    const suma = d.lineas.reduce((s, l) => s + l.importe, 0);
    assert.equal(suma, d.total);
    assert.equal(d.total, Math.round(precioPuestoAqui(COCHE, AQUI)));
  });

  test("son tres, y cada una dice a quién va", () => {
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.deepEqual(d.lineas.map((l) => [l.concepto, l.aQuien]), [
      ["Precio del coche", "al vendedor en Alemania"],
      ["Servicio PopCar · IVA incluido", "a nosotros"],
      ["Impuesto de matriculación", "a Hacienda"],
    ]);
  });

  test("el precio del coche es el del anuncio, sin nada encima", () => {
    // Antes llevaba nuestro margen dentro, porque el coche lo comprábamos
    // nosotros. Ya no: el cliente le paga eso al vendedor alemán, y meterle algo
    // dentro sería cobrarle un margen a nombre de otro.
    const d = desgloseParaElCliente(COCHE, AQUI);
    const coche = d.lineas.find((l) => l.concepto === "Precio del coche");
    assert.equal(coche.importe, COCHE);
  });

  test("el fee va suelto y con su nombre", () => {
    // Cuando vendes un coche, lo que ganas no se desglosa. Cuando vendes un
    // servicio, lo que se vende es eso.
    const d = desgloseParaElCliente(COCHE, AQUI);
    const fee = d.lineas.find((l) => /Servicio PopCar/.test(l.concepto));
    assert.equal(fee.importe, FEE_POPCAR);
    assert.match(fee.concepto, /IVA incluido/,
      "a un particular el precio se le dice con el impuesto dentro");
  });

  test("el impuesto va sobre el precio español, no sobre el alemán", () => {
    const d = desgloseParaElCliente(COCHE, AQUI);
    const imp = d.lineas.find((l) => l.concepto === "Impuesto de matriculación");
    assert.equal(imp.importe, Math.round(IMPUESTO_MATRICULACION * AQUI));
  });

  test("no hay ninguna línea de margen ni de comisión", () => {
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.ok(!d.lineas.some((l) => /margen|comisi/i.test(l.concepto)));
  });

  test("cuadra con cualquier precio, no solo con el del ejemplo", () => {
    for (const [al, es] of [[12000, 15000], [25000, 30000], [45000, 52000]]) {
      const d = desgloseParaElCliente(al, es);
      assert.equal(d.lineas.reduce((s, l) => s + l.importe, 0), d.total, `falla con ${al}/${es}`);
    }
  });
});

describe("qué cubre el fee, dicho en el desglose", () => {
  test("se enumera lo que se está pagando", () => {
    // Es lo único que vendemos: si no se dice qué hacemos por ese dinero, son
    // tres mil euros sin explicar.
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.ok(d.cubreElFee.length >= 4);
    assert.ok(d.cubreElFee.some((x) => /allí|persona/i.test(x)), "falta la revisión en Alemania");
    assert.ok(d.cubreElFee.some((x) => /ITV|homologa/i.test(x)), "falta la homologación");
    assert.ok(d.cubreElFee.some((x) => /casa|entrega/i.test(x)), "falta la entrega");
  });

  test("la revisión en Alemania se dice antes que nada", () => {
    // Es lo que justifica pagar por adelantado: nadie libera un euro hasta que
    // alguien nuestro ha visto el coche.
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.match(d.cubreElFee[0], /antes de liberar tu dinero/i);
  });
});

describe("lo que no está dentro", () => {
  test("la garantía se contrata aparte", () => {
    // No la damos nosotros: no somos quien le vende el coche, así que no somos
    // quien se la debe. La pone un tercero y él decide.
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.ok(d.aparte.some((x) => /garant/i.test(x)));
    assert.deepEqual(d.incluido, [], "no hay nada 'incluido': el fee es el servicio, no un extra");
  });

  test("el impuesto sí está dentro del total, aunque no sea nuestro", () => {
    // Es dinero que va a pagar sí o sí. Dejarlo fuera del total sería enseñar un
    // precio que no existe.
    const d = desgloseParaElCliente(COCHE, AQUI);
    assert.ok(d.lineas.some((l) => /impuesto/i.test(l.concepto)));
  });
});

describe("el mismo precio en SQL que en pantalla", () => {
  test("la consulta lleva el fee", () => {
    assert.ok(sqlPrecioPuestoAqui().includes(String(FEE_POPCAR)));
  });

  test("y el impuesto sobre el precio español", () => {
    assert.ok(sqlPrecioPuestoAqui().includes(`${IMPUESTO_MATRICULACION}*COALESCE(market_price_es,0)`));
  });

  test("y no queda ningún tramo de margen", () => {
    // Si el SQL siguiera aplicando margen, ordenar por precio daría un orden que
    // no se corresponde con los números en pantalla, y eso se lee como que el
    // filtro está roto.
    const sql = sqlPrecioPuestoAqui();
    assert.ok(!/CASE/i.test(sql), "el SQL sigue teniendo los tramos de margen dentro");
  });

  test("con alias, para cuando la consulta lo lleva", () => {
    assert.ok(sqlPrecioPuestoAqui("o").includes("o.price"));
    assert.ok(sqlPrecioPuestoAqui("o").includes("o.market_price_es"));
  });
});
