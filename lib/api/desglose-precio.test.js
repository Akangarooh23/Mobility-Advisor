/**
 * El precio partido que ve el cliente.
 *
 * Un coche de importación cuesta más que su anuncio alemán. Sin decir por qué,
 * la diferencia parece un recargo; con las tres líneas delante, es un servicio.
 *
 * Lo que se fija aquí es que **las líneas sumen exactamente el precio de
 * arriba**. Un total que no cuadra con su desglose es peor que no desglosar: le
 * dice al cliente que hay algo que no le estamos contando.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  desgloseParaElCliente, precioPuestoAqui, margenDePopCar, costeDeTraerlo,
  TRANSPORTE, sqlPrecioPuestoAqui, MARGEN,
} = require("../coste-importacion.js");

describe("el precio partido", () => {
  test("las tres líneas suman el precio que se enseña", () => {
    const d = desgloseParaElCliente(6000, 10000);
    const suma = d.lineas.reduce((s, l) => s + l.importe, 0);
    assert.equal(suma, d.total);
    assert.equal(d.total, precioPuestoAqui(6000, 10000));
  });

  test("son tres, y no cinco", () => {
    const d = desgloseParaElCliente(6000, 10000);
    assert.deepEqual(d.lineas.map((l) => l.concepto), [
      "Precio del coche",
      "Transporte desde Alemania",
      "Matriculación y papeleo",
    ]);
  });

  test("el margen va dentro del precio del coche, no suelto", () => {
    const d = desgloseParaElCliente(6000, 10000);
    const coche = d.lineas.find((l) => l.concepto === "Precio del coche");
    const margen = margenDePopCar(6000 + costeDeTraerlo(10000));
    assert.equal(coche.importe, 6000 + margen);
    assert.ok(!d.lineas.some((l) => /margen|popcar|comisi/i.test(l.concepto)),
      "lo que gana el que vende no se desglosa: solo invita a discutirlo");
  });

  test("el precio del coche siempre es mayor que el del anuncio alemán", () => {
    for (const aleman of [2000, 6000, 15000, 45000]) {
      const d = desgloseParaElCliente(aleman, aleman * 1.6);
      const coche = d.lineas.find((l) => l.concepto === "Precio del coche");
      assert.ok(coche.importe > aleman, `con ${aleman} el coche saldría al coste o por debajo`);
    }
  });

  test("el transporte es el mismo número que se usa para el coste", () => {
    const d = desgloseParaElCliente(6000, 10000);
    const transporte = d.lineas.find((l) => l.concepto === "Transporte desde Alemania");
    assert.equal(transporte.importe, TRANSPORTE);
  });

  test("dice lo que se factura aparte, para que la pantalla no se lo invente", () => {
    const d = desgloseParaElCliente(6000, 10000);
    assert.ok(d.aparte.some((x) => /reacondicionad/i.test(x)));
    assert.ok(d.aparte.some((x) => /seguro/i.test(x)));
  });

  test("la garantía no se factura aparte: es obligatoria y va dentro", () => {
    const d = desgloseParaElCliente(6000, 10000);
    assert.ok(!d.aparte.some((x) => /garant/i.test(x)),
      "vendiendo como empresa a un particular la garantía no es un extra que cobrar");
    assert.ok(d.incluido.some((x) => /garant/i.test(x)));
  });

  test("sin precio español de referencia sigue cuadrando", () => {
    const d = desgloseParaElCliente(6000, null);
    assert.equal(d.lineas.reduce((s, l) => s + l.importe, 0), d.total);
  });

  test("los importes van redondeados: nadie enseña céntimos de un impuesto estimado", () => {
    const d = desgloseParaElCliente(6137, 10111);
    for (const l of d.lineas) assert.equal(l.importe, Math.round(l.importe));
  });
});

describe("ordenar por precio y enseñar el precio", () => {
  const sql = sqlPrecioPuestoAqui();

  test("la consulta lleva los mismos tramos de margen que el desglose", () => {
    for (const t of MARGEN) {
      assert.ok(sql.includes(`<= ${t.hasta} THEN ${t.importe}`),
        `al SQL le falta el tramo de ${t.hasta}: ordenar daría un orden distinto al que se ve`);
    }
  });

  test("y el transporte", () => {
    assert.ok(sql.includes(`${TRANSPORTE} +`));
  });

  test("no ordena por la columna que escribe el flujo una vez al día", () => {
    assert.ok(!sql.includes("import_cost"),
      "ordenar por import_cost daría un orden que no se corresponde con los números en pantalla");
  });
});

/**
 * Ordenar por lo que se ahorra.
 *
 * Por euros, un coche de 30.000 € que ahorra 3.000 sale por delante de uno de
 * 8.000 que ahorra 2.000, y el segundo es mejor negocio. Este orden es por
 * proporción, que es lo que dice la tarjeta.
 */
describe("el orden por ahorro", () => {
  const { sqlAhorroPct } = require("../coste-importacion.js");
  const sql = sqlAhorroPct();

  test("compara contra el precio español, que es el que se enseña al lado", () => {
    assert.ok(sql.includes("market_price_es"));
  });

  test("usa el mismo precio puesto aquí que la tarjeta", () => {
    // Si fueran dos cuentas, «mayor ahorro primero» daría un orden que no se
    // corresponde con los porcentajes en pantalla.
    assert.ok(sql.includes(sqlPrecioPuestoAqui()));
  });

  test("no ordena por la columna que escribe el flujo una vez al día", () => {
    assert.ok(!sql.includes("import_margin_pct"),
      "esa columna lleva la fórmula del día que corrió el flujo, no la de ahora");
  });

  test("un coche sin precio de comparables no divide por cero", () => {
    assert.ok(sql.includes("NULLIF(market_price_es,0)"),
      "sin con qué compararse se queda sin porcentaje y cae al final");
  });

  test("con alias, todas las columnas lo llevan", () => {
    const conAlias = sqlAhorroPct("m");
    assert.ok(!/[^.]market_price_es/.test(conAlias.replace(/m\.market_price_es/g, "")),
      "alguna columna se quedó sin el alias y la consulta fallaría con un JOIN");
  });
});
