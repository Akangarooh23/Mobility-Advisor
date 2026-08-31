/**
 * El coste de traer un coche, y lo que gana PopCar.
 *
 * Lo que se vigila aquí no es una cuenta difícil: son los números que se suman
 * al precio que ve el cliente. Y dos de ellos son aproximaciones deliberadas
 * —el impuesto y el margen—, así que lo que hay que fijar no es solo el
 * resultado, sino **en qué dirección se equivocan**: hacia arriba. En un precio
 * público, pasarse es recuperable y quedarse corto es una promesa incumplible.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  TRANSPORTE, SIN_IDENTIFICAR, IMPUESTO_MATRICULACION, MARGEN, MARGEN_PORCENTAJE,
  margenDePopCar, costeDeTraerlo, precioPuestoAqui, partidasDeTraerlo,
} = require("./coste-importacion.js");

const FLUJO = path.join(__dirname, "..", "n8n-workflows", "importacion-scoring.json");

describe("el coste de traer un coche", () => {
  test("es transporte, lo sin identificar y el impuesto", () => {
    // 1.500 + 600 + 4,75 % de 12.000 = 2.670
    assert.equal(costeDeTraerlo(12000), 2670);
  });

  test("el impuesto va sobre el precio español, no sobre el alemán", () => {
    // Un coche que en Alemania vale 6.000 y aquí 10.000 tributa por los 10.000.
    assert.equal(costeDeTraerlo(10000), TRANSPORTE + SIN_IDENTIFICAR + 475);
  });

  test("sin precio de referencia, quedan los fijos y no un cero", () => {
    assert.equal(costeDeTraerlo(0), TRANSPORTE + SIN_IDENTIFICAR);
    assert.equal(costeDeTraerlo(null), TRANSPORTE + SIN_IDENTIFICAR);
  });

  test("no se le aplica coeficiente de antigüedad: sería depreciar dos veces", () => {
    // El coeficiente convierte precio de nuevo en precio de usado, y la
    // referencia que usamos ya es de usado. Aplicarlo hundiría el impuesto.
    const conCoeficiente = TRANSPORTE + SIN_IDENTIFICAR + IMPUESTO_MATRICULACION * 10000 * 0.17;
    assert.ok(costeDeTraerlo(10000) > conCoeficiente,
      "la aproximación tiene que equivocarse hacia arriba, no hacia abajo");
  });
});

describe("lo que gana PopCar", () => {
  test("por tramos de coste, no por porcentaje", () => {
    assert.equal(margenDePopCar(8000), 1000);
    assert.equal(margenDePopCar(12000), 1200);
    assert.equal(margenDePopCar(18000), 1500);
    assert.equal(margenDePopCar(22000), 1700);
    assert.equal(margenDePopCar(28000), 2000);
    assert.equal(margenDePopCar(35000), 2500);
  });

  test("el límite de cada tramo entra en el tramo", () => {
    assert.equal(margenDePopCar(10000), 1000);
    assert.equal(margenDePopCar(10001), 1200);
  });

  test("por encima de 40.000 pasa a porcentaje", () => {
    assert.equal(margenDePopCar(50000), Math.round(50000 * MARGEN_PORCENTAJE));
  });

  test("nunca se vende al coste", () => {
    for (const coste of [0, 1, 2000, 6000, 9999, 40001, 100000]) {
      assert.ok(margenDePopCar(coste) > 0, `con coste ${coste} PopCar no gana nada`);
    }
  });

  test("el margen no baja al subir el coche", () => {
    let previo = 0;
    for (const coste of [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 80000]) {
      const m = margenDePopCar(coste);
      assert.ok(m >= previo, `en ${coste} el margen baja: ${m} después de ${previo}`);
      previo = m;
    }
  });

  test("los tramos van en orden y sin huecos", () => {
    for (let i = 1; i < MARGEN.length; i += 1) {
      assert.ok(MARGEN[i].hasta > MARGEN[i - 1].hasta, "los topes tienen que subir");
      assert.ok(MARGEN[i].importe >= MARGEN[i - 1].importe, "el margen no puede bajar");
    }
  });
});

describe("el precio puesto aquí", () => {
  test("es el coche, lo que cuesta traerlo y lo que ganamos", () => {
    // 6.000 en Alemania, 10.000 aquí: coste 6.000 + 1.500 + 600 + 475 = 8.575
    // Margen del tramo de hasta 10.000: 1.000. Total 9.575.
    assert.equal(precioPuestoAqui(6000, 10000), 9575);
  });

  test("el margen se calcula sobre el coste, no sobre el precio de venta", () => {
    // Si se calculara sobre el precio final, el margen se mordería la cola.
    const coste = 6000 + costeDeTraerlo(10000);
    assert.equal(precioPuestoAqui(6000, 10000) - coste, margenDePopCar(coste));
  });

  test("las partidas suman el precio", () => {
    const suma = partidasDeTraerlo(6000, 10000).reduce((s, p) => s + p.importe, 0);
    assert.equal(suma, precioPuestoAqui(6000, 10000));
  });

  test("lo que es una estimación va marcado como tal", () => {
    const partidas = partidasDeTraerlo(6000, 10000);
    const porConcepto = Object.fromEntries(partidas.map((p) => [p.concepto, p.firme]));
    assert.equal(porConcepto["Transporte"], false);
    assert.equal(porConcepto["Impuesto de matriculación"], false);
    assert.equal(porConcepto["Sin identificar"], false);
    assert.equal(porConcepto["Precio en Alemania"], true, "eso sí lo sabemos");
  });
});

describe("los mismos números en el flujo que los calcula", () => {
  const sql = fs.readFileSync(FLUJO, "utf8");

  test("el flujo suma el transporte y lo sin identificar de aquí", () => {
    const fijos = `(${TRANSPORTE} + 400 + 200 +`;
    assert.ok(sql.includes(fijos),
      `el flujo de n8n no lleva «${fijos}»: se ha cambiado en un sitio y no en el otro`);
  });

  test("lo sin identificar sigue siendo 600, partido en dos", () => {
    assert.equal(400 + 200, SIN_IDENTIFICAR,
      "si alguien identifica esos dos números, hay que separarlos con su nombre");
  });

  test("el impuesto va sobre el precio español también en el flujo", () => {
    assert.ok(sql.includes(`${IMPUESTO_MATRICULACION}*COALESCE(c.es_median,0)`),
      "el flujo sigue calculando el impuesto sobre el precio alemán");
  });

  test("el transporte viejo ya no está en ningún sitio", () => {
    assert.ok(!sql.includes("(700 + 400 + 200"),
      "quedó una fórmula con los 700 € de antes: unos coches se calcularían con un número y otros con otro");
  });

  test("todos los tramos del margen están en el flujo, con su importe", () => {
    for (const tramo of MARGEN) {
      const linea = `<= ${tramo.hasta} THEN ${tramo.importe}`;
      assert.ok(sql.includes(linea),
        `al flujo le falta el tramo «${linea}»: ese coche se vendería con otro margen`);
    }
  });

  test("y el porcentaje del último tramo", () => {
    assert.ok(sql.includes(`* ${MARGEN_PORCENTAJE})`),
      "el flujo no aplica el porcentaje de los coches de más de 40.000 €");
  });

  test("el coste que se guarda lleva el margen dentro", () => {
    // `import_cost` es todo lo que se le suma al precio del anuncio. Si el
    // margen se quedara fuera, el cliente vería el coche a precio de coste.
    assert.ok(sql.includes("(t.traerlo + m.margen) AS cost"),
      "el margen no está entrando en lo que se le suma al precio");
  });

  test("el ahorro que se enseña se calcula después del margen", () => {
    assert.ok(sql.includes("c.es_median - de.de_price - t.traerlo - m.margen"),
      "el ahorro se estaría calculando sin descontar lo que ganamos: sería mentira");
  });
});
