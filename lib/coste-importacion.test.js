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
  TRANSPORTE, PAPELEO_ESTIMADO, PERITO_EN_ALEMANIA, sqlTipoDelImpuesto, impuestoDeMatriculacion,
  FEE_POPCAR, FEE_POPCAR_CON_IVA, PRECIO_MINIMO_COCHE,
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
    // 18.000 del coche + 3.000 de servicio + el impuesto que le toque a ese
    // coche. Sin saber cuál es el coche, el tipo más bajo sobre el valor fiscal.
    assert.equal(precioPuestoAqui(18000, 24000), 18000 + FEE_POPCAR_CON_IVA + impuestoDeMatriculacion(18000));
  });

  test("el fee son 3.000 más IVA, y el que se le enseña son 3.630", () => {
    // El IVA va **encima**, no dentro. Durante un tiempo aquí se dividía por
    // 1,21 y de ahí salía que una importación perdiera dinero: 630 € por
    // coche que se contaban como nuestros sin serlo, o al revés.
    assert.equal(FEE_POPCAR, 3000, "la base es lo que ganamos");
    assert.equal(FEE_POPCAR_CON_IVA, 3630, "y esto es lo que paga el cliente");
    assert.ok(FEE_POPCAR_CON_IVA > FEE_POPCAR, "el IVA no se está sumando");
  });

  test("el fee es el mismo para un coche de 12.000 que para uno de 40.000", () => {
    // El trabajo es el mismo: el mismo viaje, la misma ITV, las mismas
    // gestiones. Cobrar más por un coche caro sería cobrar por el coche, y el
    // coche no lo vendemos nosotros.
    const barato = precioPuestoAqui(12000, 12000) - 12000 - impuestoDeMatriculacion(12000);
    const caro = precioPuestoAqui(40000, 40000) - 40000 - impuestoDeMatriculacion(40000);
    assert.equal(Math.round(barato), FEE_POPCAR_CON_IVA);
    assert.equal(Math.round(caro), FEE_POPCAR_CON_IVA);
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
  test("el coste del servicio son el perito, el transporte y el papeleo", () => {
    // El perito no estaba, y el fee tiene que cubrirlo: sin él el margen salía
    // 289 € mejor de lo que es en todos los coches.
    assert.equal(costeDelServicio(), PERITO_EN_ALEMANIA + TRANSPORTE + PAPELEO_ESTIMADO);
    assert.equal(PERITO_EN_ALEMANIA, 289, "lo que factura el perito de Alemania");
  });

  test("el impuesto no es coste nuestro: lo paga él y no pasa por nosotros", () => {
    assert.ok(!String(costeDelServicio()).includes("."), "el coste no depende del precio del coche");
    assert.equal(costeDelServicio(), 1632);
  });

  test("y lo que queda del fee es lo que ganamos, sin el IVA", () => {
    // El IVA no es nuestro: lo cobramos y lo ingresamos. Contarlo aquí sería
    // creerse 630 € de margen que no existen.
    assert.equal(margenDelServicio(), FEE_POPCAR - costeDelServicio());
    assert.ok(margenDelServicio() < FEE_POPCAR_CON_IVA - costeDelServicio(),
      "el margen está contando el IVA como si fuera nuestro");
    assert.ok(margenDelServicio() > 0, "el fee no cubriría ni los costes conocidos");
  });
});

/**
 * Por debajo de doce mil no se importa.
 *
 * Con un fee de 3.000 €, un coche de 5.000 sale por 8.000 antes del impuesto: el
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
    assert.ok(sql.includes(String(FEE_POPCAR_CON_IVA)),
      "el flujo no lleva el fee con IVA: se ha cambiado en un sitio y no en el otro");
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

  test("el impuesto va sobre el precio del coche también en el flujo", () => {
    assert.ok(sql.includes(`)*COALESCE(de.de_price,0)`),
      "el flujo calcula el impuesto sobre otra base que la ficha");
  });

  test("y con la misma banda, letra por letra", () => {
    // El flujo guarda su SQL dentro de un JSON, así que la comparación es con
    // la cadena escapada. Comprobar solo que «hay un CASE» dejaría pasar dos
    // escaleras distintas, que es exactamente lo que pasó la vez anterior: dos
    // fórmulas diciendo cosas distintas y mandando la que nadie miraba.
    const escapada = JSON.stringify(sqlTipoDelImpuesto("de")).slice(1, -1);
    assert.ok(sql.includes(escapada),
      "el flujo estima la banda de otra manera que la ficha");
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
    // El coche tiene que pasar además del mínimo: con el fee de 3.000 €, uno de
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

/**
 * La garantía que lleva el precio publicado entra en la cuenta.
 *
 * El precio que se anuncia la lleva dentro, así que el ahorro que se anuncia
 * sale de ese precio y no de uno más bajo. Decidir a quién se publica sobre un
 * precio sin garantía sacaría coches cuyo ahorro real —el de la ficha— está por
 * debajo del 15 %, y el cliente vería un porcentaje peor que el que nos hizo
 * publicarlo.
 */
describe("el listón, con la garantía dentro", () => {
  const {
    ahorroDelCliente, sePublica, precioPuestoAqui, AHORRO_MINIMO,
  } = require("./coste-importacion.js");

  test("el precio puesto aquí la suma", () => {
    const sin = precioPuestoAqui(16890, 29899);
    assert.equal(Math.round(precioPuestoAqui(16890, 29899, 190) - sin), 190);
  });

  test("y el ahorro baja justo eso", () => {
    const sin = ahorroDelCliente(16890, 29899);
    const con = ahorroDelCliente(16890, 29899, 190);
    assert.equal(sin.euros - con.euros, 190);
    assert.ok(con.pct < sin.pct);
  });

  test("uno que roza el listón sin ella, con ella se queda fuera", () => {
    // Este es el caso que importa. Sin contarla se publicaría un coche cuyo
    // ahorro, el que el cliente ve, está por debajo del mínimo.
    const es = 30000;
    // Un precio alemán tal que el ahorro sin garantía cae justo encima del 15 %.
    let al = 0;
    for (let p = 5000; p < 30000; p += 1) {
      if (ahorroDelCliente(p, es).pct >= AHORRO_MINIMO) al = p;
    }
    assert.ok(al > 0);
    assert.equal(sePublica({ precioAleman: al, precioEspanol: es, comparables: 30 }), true);
    assert.equal(
      sePublica({ precioAleman: al, precioEspanol: es, comparables: 30, garantia: 690 }),
      false,
      "con la garantía dentro ya no llega al 15 %"
    );
  });

  test("sin garantía que ofrecer, la decisión es la de siempre", () => {
    // Es el estado de hoy: mientras no haya catálogo cargado no se ofrece
    // ninguna, y el precio publicado no lleva nada dentro.
    const caso = { precioAleman: 16000, precioEspanol: 26000, comparables: 30 };
    assert.equal(sePublica({ ...caso, garantia: 0 }), sePublica(caso));
  });
});

/**
 * Un coche «nuevo» para Hacienda no se publica como un usado.
 *
 * Menos de seis meses **o** menos de 6.000 km, y con una de las dos basta. Ese
 * coche se compra sin IVA en Alemania y el cliente liquida aquí el 21 % con el
 * modelo 309: sobre un SEAT Leon de 24.370 € son 5.118 € que el precio
 * publicado no lleva. En el catálogo alemán hay 4.759 así, muchos con cero
 * kilómetros.
 */
describe("los coches que Hacienda considera nuevos", () => {
  const {
    podriaSerMedioDeTransporteNuevo, KM_DE_UN_COCHE_NUEVO, sePublica,
  } = require("./coste-importacion.js");
  const HOY = new Date("2026-09-05");

  test("cero kilómetros es nuevo, aunque el anuncio no diga el año", () => {
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 0, year: null }, HOY), true);
  });

  test("y sin año tampoco se puede descartar, por muchos kilómetros que tenga", () => {
    // 1.557 ofertas alemanas no traen el año. Darlas por usadas sería suponer
    // lo que no se sabe justo donde equivocarse le cuesta un 21 % al cliente.
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 40000, year: null }, HOY), true);
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 40000, year: 0 }, HOY), true);
  });

  test("y por debajo de seis mil también, por viejo que sea", () => {
    // El criterio es «o»: no hacen falta las dos cosas.
    assert.equal(KM_DE_UN_COCHE_NUEVO, 6000);
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 5999, year: 2015 }, HOY), true);
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 6001, year: 2015 }, HOY), false);
  });

  test("un coche de este año puede tener tres meses, y no lo sabemos", () => {
    // Del anuncio llega el año, no la fecha de primera matriculación.
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 20000, year: 2026 }, HOY), true);
  });

  test("pero uno del año pasado tiene por fuerza más de seis meses", () => {
    // Diciembre de 2025 son nueve meses en septiembre de 2026. Descartar el año
    // anterior dejaría fuera cinco mil coches buenos sin motivo.
    assert.equal(podriaSerMedioDeTransporteNuevo({ mileage: 40000, year: 2025 }, HOY), false);
  });

  test("y ninguno de esos se publica", () => {
    const bueno = { precioAleman: 16890, precioEspanol: 29899, comparables: 59 };
    assert.equal(sePublica({ ...bueno, coche: { mileage: 63000, year: 2020 } }), true);
    assert.equal(sePublica({ ...bueno, coche: { mileage: 0, year: null } }), false,
      "publicarlo es prometer un precio al que le faltan cinco mil euros de IVA");
  });
});
