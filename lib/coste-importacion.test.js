/**
 * El coste de traer un coche.
 *
 * Lo que se vigila aquí no es una cuenta difícil: son tres números que van
 * sumados al precio que ve el cliente y que hoy viven en dos sitios —este
 * fichero y el SQL del flujo de n8n—. Mientras estén en dos sitios, lo único
 * que impide que se separen en silencio es esta prueba.
 *
 * Separarse en silencio significaría enseñar un precio calculado con un número
 * y cobrar con otro.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  TRANSPORTE, SIN_IDENTIFICAR, IMPUESTO_MATRICULACION,
  costeDeTraerlo, partidasDeTraerlo,
} = require("./coste-importacion.js");

const FLUJO = path.join(__dirname, "..", "n8n-workflows", "importacion-scoring.json");

describe("el coste de traer un coche", () => {
  test("es transporte, lo sin identificar y el impuesto", () => {
    // 1.500 + 600 + 4,75 % de 12.000 = 2.670
    assert.equal(costeDeTraerlo(12000), 2670);
  });

  test("sin precio, quedan los fijos", () => {
    assert.equal(costeDeTraerlo(0), TRANSPORTE + SIN_IDENTIFICAR);
    assert.equal(costeDeTraerlo(null), TRANSPORTE + SIN_IDENTIFICAR);
  });

  test("las partidas suman el total", () => {
    const partidas = partidasDeTraerlo(12000);
    const suma = partidas.reduce((s, p) => s + p.importe, 0);
    assert.equal(suma, costeDeTraerlo(12000));
  });

  test("ninguna partida se da por firme: todas son estimaciones", () => {
    for (const p of partidasDeTraerlo(12000)) {
      assert.equal(p.firme, false, `${p.concepto} se está dando por cerrado y no lo está`);
    }
  });
});

describe("los mismos números en el flujo que los calcula", () => {
  const sql = fs.readFileSync(FLUJO, "utf8");

  test("el flujo usa exactamente estos tres números", () => {
    const formula = `(${TRANSPORTE} + 400 + 200 + ${IMPUESTO_MATRICULACION}*de.de_price)`;
    assert.ok(
      sql.includes(formula),
      `el flujo de n8n no lleva «${formula}»: se ha cambiado en un sitio y no en el otro`
    );
  });

  test("lo sin identificar sigue siendo 600, partido en dos", () => {
    assert.equal(400 + 200, SIN_IDENTIFICAR,
      "si alguien identifica esos dos números, hay que separarlos con su nombre");
  });

  test("el transporte viejo ya no está en ningún sitio", () => {
    assert.ok(
      !sql.includes("(700 + 400 + 200"),
      "quedó una fórmula con los 700 € de antes: unos coches se calcularían con un número y otros con otro"
    );
  });

  test("la fórmula aparece en los dos sitios del SQL: coste y margen", () => {
    const formula = `(${TRANSPORTE} + 400 + 200 + ${IMPUESTO_MATRICULACION}*de.de_price)`;
    const veces = sql.split(formula).length - 1;
    assert.equal(veces, 2,
      "el coste y el margen se calculan con la misma fórmula: si solo se cambia una, el ahorro que se enseña deja de cuadrar con el precio");
  });
});
