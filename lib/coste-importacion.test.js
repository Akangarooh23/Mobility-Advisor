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
  TRANSPORTE, PAPELEO_ESTIMADO, IMPUESTO_MATRICULACION,
  FEE_POPCAR, PRECIO_MINIMO_COCHE,
  costeDelServicio, margenDelServicio,
  precioPuestoAqui, partidasDeTraerlo, AHORRO_MINIMO,
} = require("./coste-importacion.js");

const FLUJO = path.join(__dirname, "..", "n8n-workflows", "importacion-scoring.json");


/**
 * PopCar no compra el coche.
 *
 * Es la decisión que lo cambia todo, y por eso se fija aquí. El coche lo vende
 * el concesionario alemán al cliente español; nosotros cobramos un fee por
 * encargarnos de traerlo. No es un matiz jurídico: cambia quién debe la
 * garantía, a nombre de quién se matricula y qué factura sale.
 *
 * Antes comprábamos el coche y le metíamos un margen dentro del precio, entre
 * 1.000 y 2.500 € según el tramo. Ese modelo ya no existe.
 */
describe("lo que paga el cliente", () => {
  test("son tres cosas, y cada una va a un sitio distinto", () => {
    const partidas = partidasDeTraerlo(18000, 24000);
    assert.deepEqual(partidas.map((x) => x.concepto), [
      "Precio en Alemania",
      "Servicio PopCar",
      "Impuesto de matriculación",
    ]);
  });

  test("el coche, el fee y el impuesto: nada más", () => {
    // 18.000 del coche + 2.999 de fee + 4,75 % de 24.000 = 22.139
    assert.equal(precioPuestoAqui(18000, 24000), 18000 + 2999 + 0.0475 * 24000);
  });

  test("el fee es el mismo para un coche de 12.000 que para uno de 40.000", () => {
    // El trabajo es el mismo: el mismo viaje, la misma ITV, las mismas
    // gestiones. Cobrar más por un coche caro sería cobrar por el coche, y el
    // coche no lo vendemos nosotros.
    const barato = precioPuestoAqui(12000, 12000) - 12000 - 0.0475 * 12000;
    const caro = precioPuestoAqui(40000, 40000) - 40000 - 0.0475 * 40000;
    assert.equal(Math.round(barato), FEE_POPCAR);
    assert.equal(Math.round(caro), FEE_POPCAR);
  });

  test("ya no hay margen escondido dentro del precio del coche", () => {
    // Cuando vendes un coche, lo que ganas no se desglosa. Cuando vendes un
    // servicio, lo que se vende es eso: tiene que verse.
    const partidas = partidasDeTraerlo(18000, 24000);
    const coche = partidas.find((x) => x.concepto === "Precio en Alemania");
    assert.equal(coche.importe, 18000, "el precio del coche es el del anuncio, sin nada encima");
    assert.ok(!partidas.some((x) => /margen/i.test(x.concepto)));
  });

  test("las partidas suman el precio", () => {
    const suma = partidasDeTraerlo(18000, 24000).reduce((s, x) => s + x.importe, 0);
    assert.equal(suma, precioPuestoAqui(18000, 24000));
  });

  test("lo que es una estimación va marcado como tal", () => {
    const por = Object.fromEntries(partidasDeTraerlo(18000, 24000).map((x) => [x.concepto, x.firme]));
    assert.equal(por["Precio en Alemania"], true, "eso lo dice el anuncio");
    assert.equal(por["Servicio PopCar"], true, "y esto lo decidimos nosotros");
    assert.equal(por["Impuesto de matriculación"], false, "esto es una banda supuesta");
  });
});

describe("el fee frente a lo que nos cuesta", () => {
  test("el coste del servicio son el transporte y el papeleo", () => {
    assert.equal(costeDelServicio(), TRANSPORTE + PAPELEO_ESTIMADO);
  });

  test("el impuesto no es coste nuestro: lo paga él y no pasa por nosotros", () => {
    assert.ok(!String(costeDelServicio()).includes("."), "el coste no depende del precio del coche");
    assert.equal(costeDelServicio(), 1343);
  });

  test("y lo que queda del fee es lo que ganamos", () => {
    assert.equal(margenDelServicio(), FEE_POPCAR - costeDelServicio());
    assert.ok(margenDelServicio() > 0, "el fee no cubriría ni los costes conocidos");
  });
});

/**
 * Por debajo de doce mil no se importa.
 *
 * Con un fee de 2.999 €, un coche de 5.000 sale por 8.000 antes del impuesto: el
 * servicio cuesta más de la mitad de la operación. Y está medido: por debajo de
 * 10.000 € la brecha mediana con España es de 2.050 €, y el fee más el impuesto
 * se la comen entera.
 */
describe("el precio mínimo del coche", () => {
  test("son doce mil", () => {
    assert.equal(PRECIO_MINIMO_COCHE, 12000);
  });

  test("un coche por debajo no se publica, aunque el ahorro salga bien", () => {
    const { sePublica } = require("./coste-importacion.js");
    assert.equal(sePublica({ precioAleman: 5000, precioEspanol: 13000, comparables: 30 }), false);
  });

  test("y uno justo por encima sí entra en el cálculo", () => {
    const { ahorroDelCliente } = require("./coste-importacion.js");
    const a = ahorroDelCliente(12000, 20000);
    assert.ok(a.pct > 0, "con esa horquilla el cliente ahorra algo");
  });
});

describe("los mismos números en el flujo que los calcula", () => {
  const sql = fs.readFileSync(FLUJO, "utf8");

  test("el flujo cobra el mismo fee que la ficha", () => {
    assert.ok(sql.includes(String(FEE_POPCAR)),
      "el flujo de n8n no lleva el fee: se ha cambiado en un sitio y no en el otro");
  });

  test("y respeta el precio mínimo del coche", () => {
    assert.ok(sql.includes(`de_price >= ${PRECIO_MINIMO_COCHE}`),
      "el flujo publicaría coches baratos que la ficha no publica");
  });

  test("y el suelo del 15 %", () => {
    assert.ok(sql.includes(String(AHORRO_MINIMO)),
      "el flujo publicaría con un listón distinto del que usa el catálogo");
  });

  test("y no publica coches vendidos", () => {
    assert.ok(sql.includes("COALESCE(m.is_active, TRUE)"));
  });

  test("el impuesto va sobre el precio español también en el flujo", () => {
    assert.ok(sql.includes(`${IMPUESTO_MATRICULACION}*COALESCE(c.es_median,0)`),
      "el flujo sigue calculando el impuesto sobre el precio alemán");
  });

  test("no quedan restos del modelo viejo", () => {
    // Los 700 € de transporte, los tramos de margen y el filtro del 10 %: si
    // alguno sobrevive, el flujo revive un modelo que ya no es el nuestro.
    assert.ok(!sql.includes("(700 + 400 + 200"), "queda la fórmula de los 700 €");
    assert.ok(!sql.includes("m.margen"), "queda el margen por tramos");
    assert.ok(!sql.includes("BETWEEN 0.10"), "queda el filtro del 10 %");
  });
});

/**
 * Qué coches se publican.
 *
 * La decisión vivía en el flujo de n8n y el código no sabía nada. Estaban las
 * dos fórmulas, decían cosas distintas, y la que mandaba era la que nadie
 * miraba: el catálogo llevaba desde el 17 de agosto publicado con los números de
 * un modelo que ya no existía —coste de 1.580 € de media cuando el real era
 * 3.666, y sin descontar lo que gana PopCar.
 *
 * Por eso las 1.568 ofertas pasaban un filtro del 10 %: el listón estaba puesto
 * sobre una vara que medía mal.
 */
describe("qué se publica y qué no", () => {
  const {
    AHORRO_MINIMO, AHORRO_MAXIMO, COMPARABLES_MINIMOS,
    ahorroDelCliente, sePublica,
  } = require("./coste-importacion.js");

  test("el ahorro es el del cliente, con nuestro margen ya descontado", () => {
    const a = ahorroDelCliente(5950, 10111);
    assert.equal(a.euros, Math.round(10111 - precioPuestoAqui(5950, 10111)));
    assert.ok(a.pct > 0 && a.pct < 1);
  });

  test("por debajo del 15 % no se publica", () => {
    // Traer un coche de Alemania, esperar tres semanas y matricularlo para
    // ahorrar lo que cuesta una revisión no es una oferta.
    const justo = { precioAleman: 5950, precioEspanol: 10111, comparables: 30 };
    assert.equal(ahorroDelCliente(justo.precioAleman, justo.precioEspanol).pct < AHORRO_MINIMO, true);
    assert.equal(sePublica(justo), false);
  });

  test("y por encima sí", () => {
    // El coche tiene que pasar además del mínimo: con el fee de 2.999 €, uno de
    // 5.000 no se importa por muy grande que sea la diferencia de precio.
    assert.equal(sePublica({ precioAleman: 16000, precioEspanol: 26000, comparables: 30 }), true);
  });

  test("con pocos comparables no, aunque el ahorro salga enorme", () => {
    // Con cuatro anuncios, la mediana española es el capricho de cuatro
    // vendedores, y sobre eso no se promete un ahorro.
    assert.equal(sePublica({ precioAleman: 5000, precioEspanol: 11000, comparables: COMPARABLES_MINIMOS - 1 }), false);
  });

  test("y un ahorro imposible tampoco: uno de los dos precios está mal", () => {
    const r = ahorroDelCliente(2000, 20000);
    assert.ok(r.pct > AHORRO_MAXIMO, "este caso tiene que pasarse del techo para que la prueba valga");
    assert.equal(sePublica({ precioAleman: 2000, precioEspanol: 20000, comparables: 30 }), false);
  });

  test("sin alguno de los dos precios, no se publica", () => {
    assert.equal(sePublica({ precioAleman: 0, precioEspanol: 11000, comparables: 30 }), false);
    assert.equal(sePublica({ precioAleman: 5000, precioEspanol: 0, comparables: 30 }), false);
  });

  test("el suelo y el techo son los que se dijeron", () => {
    assert.equal(AHORRO_MINIMO, 0.15);
    assert.equal(AHORRO_MAXIMO, 0.50);
    assert.equal(COMPARABLES_MINIMOS, 15);
  });
});

/**
 * Los costes, ahora con factura detrás.
 */
describe("de dónde sale cada euro del coste", () => {
  const {
    TRANSPORTE, TRANSPORTE_A_ZARAGOZA, TRANSPORTE_A_CASA,
    PAPELEO_ESTIMADO, ITV_HOMOLOGACION, GESTORIA_Y_DGT, PLACAS,
  } = require("./coste-importacion.js");

  test("el transporte son los dos tramos, sumados", () => {
    assert.equal(TRANSPORTE_A_ZARAGOZA, 750, "precio real acordado con el transportista");
    assert.equal(TRANSPORTE_A_CASA, 363, "300 € más IVA, fijo para cualquier destino peninsular");
    assert.equal(TRANSPORTE, TRANSPORTE_A_ZARAGOZA + TRANSPORTE_A_CASA);
  });

  test("y el papeleo, sus tres partidas", () => {
    assert.equal(ITV_HOMOLOGACION, 122.2);
    assert.equal(GESTORIA_Y_DGT, 83.6);
    assert.equal(PLACAS, 24);
    assert.equal(PAPELEO_ESTIMADO, Math.round(122.2 + 83.6 + 24));
  });

  test("ya no quedan los números de prueba", () => {
    // 1.500 y 600 eran colchón, no coste: 772 € por coche cobrados al cliente y
    // no ganados por nadie.
    assert.notEqual(TRANSPORTE, 1500);
    assert.notEqual(PAPELEO_ESTIMADO, 600);
  });
});
