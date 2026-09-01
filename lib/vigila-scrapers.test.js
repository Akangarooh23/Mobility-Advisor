/**
 * Avisar de que ha dejado de entrar catálogo.
 *
 * Había aviso para cuando un flujo de n8n falla. No lo había para lo contrario,
 * que es lo que pasó de verdad: que un flujo **no se ejecuta**. Un fallo grita;
 * una ausencia no hace ruido.
 *
 * El 1 de septiembre de 2026 se descubrió que n8n llevaba quince días parado y
 * el flujo de importación cuarenta y siete. Entre medias, 25.462 de las 25.498
 * ofertas alemanas se vendieron mientras el catálogo las seguía enseñando, con
 * su botón de pagar la fianza. Nadie se enteró hasta que alguien lo miró a mano.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  DIAS_DE_SILENCIO, IMPORTACION,
  fuentesCalladas, asuntoDelAviso, lineasDelAviso,
} = require("./vigila-scrapers.js");

const AHORA = new Date("2026-09-01T10:00:00Z");
const EL_CASO_REAL = [
  { fuente: "autoscout24",    ultimo: "2026-08-17T03:00:00Z", ofertas: 464122 },
  { fuente: "autocasion",     ultimo: "2026-08-17T03:00:00Z", ofertas: 133848 },
  { fuente: "autoscout24-de", ultimo: "2026-07-16T03:00:00Z", ofertas: 25498 },
];

describe("qué fuentes están calladas", () => {
  test("las que llevan más de dos días sin raspar", () => {
    const c = fuentesCalladas(EL_CASO_REAL, AHORA);
    assert.equal(c.length, 3);
  });

  test("una que raspó ayer no está callada", () => {
    // Es la mitad del valor del aviso: si suena siempre, deja de sonar.
    const c = fuentesCalladas([{ fuente: "wallapop", ultimo: "2026-08-31T03:00:00Z" }], AHORA);
    assert.deepEqual(c, []);
  });

  test("ni una que se retrasó unas horas", () => {
    // Un flujo diario que sale tarde, o una noche que falla y se recupera sola,
    // no es una avería. Avisar de eso es fabricar ruido.
    const c = fuentesCalladas([{ fuente: "clicars", ultimo: "2026-08-30T15:00:00Z" }], AHORA);
    assert.deepEqual(c, []);
  });

  test("la peor va primera, que es la que hay que mirar", () => {
    const c = fuentesCalladas(EL_CASO_REAL, AHORA);
    assert.equal(c[0].fuente, IMPORTACION);
    assert.equal(c[0].dias, 47);
  });

  test("una fuente que no ha raspado nunca no cuenta", () => {
    // No está callada: no ha empezado. Avisar el primer día de un portal nuevo
    // sería avisar de que todavía no tiene datos.
    const c = fuentesCalladas([{ fuente: "portal-nuevo", ultimo: null }], AHORA);
    assert.deepEqual(c, []);
  });

  test("y una fecha ilegible tampoco revienta el aviso", () => {
    const c = fuentesCalladas([{ fuente: "raro", ultimo: "el martes" }], AHORA);
    assert.deepEqual(c, []);
  });

  test("el umbral son dos días, no uno", () => {
    assert.equal(DIAS_DE_SILENCIO, 2);
  });
});

describe("el correo lo dice en el asunto", () => {
  test("con una sola, se la nombra", () => {
    const c = fuentesCalladas([EL_CASO_REAL[2]], AHORA);
    assert.equal(asuntoDelAviso(c), "No entra catálogo de autoscout24-de desde hace 47 días");
  });

  test("con varias, cuántas y cuál es la peor", () => {
    // Un asunto que diga «Aviso del sistema» se archiva sin abrirlo. El número
    // tiene que estar antes de que lo abras.
    const c = fuentesCalladas(EL_CASO_REAL, AHORA);
    assert.match(asuntoDelAviso(c), /3 portales/);
    assert.match(asuntoDelAviso(c), /autoscout24-de/);
    assert.match(asuntoDelAviso(c), /47 días/);
  });

  test("sin nada callado no hay asunto: no se manda nada", () => {
    assert.equal(asuntoDelAviso([]), "");
  });
});

describe("el cuerpo del aviso", () => {
  test("dice cuántos días, desde cuándo y cuántas ofertas hay guardadas", () => {
    const l = lineasDelAviso(fuentesCalladas(EL_CASO_REAL, AHORA));
    assert.match(l[0], /47 días/);
    assert.match(l[0], /16 de julio/);
    assert.match(l[0], /25\.498 ofertas/);
  });

  test("y señala cuál es la de importación", () => {
    // Es la que tiene un cliente pagando una fianza al otro lado.
    const l = lineasDelAviso(fuentesCalladas(EL_CASO_REAL, AHORA));
    assert.match(l[0], /importación/);
    assert.ok(!/importación/.test(l[1]));
  });
});

/**
 * El caso que lo motivó, entero.
 */
describe("el 19 de agosto esto habría sonado", () => {
  test("con los datos de aquel día, ya avisaba", () => {
    const aquelDia = new Date("2026-08-19T10:00:00Z");
    const c = fuentesCalladas(EL_CASO_REAL, aquelDia);
    assert.ok(c.length >= 1, "quince días después nadie se había enterado");
    assert.equal(c[0].fuente, IMPORTACION);
  });

  test("y el 18 todavía no, que es lo correcto", () => {
    // Un día de margen: el flujo corre a las 03:00 y puede retrasarse.
    const c = fuentesCalladas(
      [{ fuente: "autocasion", ultimo: "2026-08-17T03:00:00Z" }],
      new Date("2026-08-18T10:00:00Z")
    );
    assert.deepEqual(c, [], "habría avisado por un retraso de unas horas");
  });
});
