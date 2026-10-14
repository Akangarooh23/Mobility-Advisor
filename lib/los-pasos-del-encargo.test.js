/**
 * Los pasos del encargo: lo que no puede volver a separarse.
 *
 * Esto existe porque el panel y la app contaban lo mismo cada uno por su
 * cuenta, en dos repositorios y dos lenguajes, y se separaban solos. Las
 * pruebas de aquí son las de los dos sitios juntas: si una se cae, se cae para
 * los dos a la vez, que es justo lo que se buscaba.
 */
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  losPasos, laCuenta, faltanAntesDelPrecio, laFase,
} = require("./los-pasos-del-encargo.js");

const PUERTAS = [
  { clave: "idcar", nombre: "El coche", abierta: true, falta: "", opcional: false },
  { clave: "papeles", nombre: "Los papeles", abierta: true, falta: "", opcional: false },
  { clave: "seguro", nombre: "El seguro", abierta: false, falta: "Súbelo", opcional: true },
];
const MANDATO = { encargo_id: "enc-1", mandato_id: "PC-MAND-0003", firmado: true };
const HECHA = { taller_hecho: true, taller_ok: true, tiene_cita: false, publicado: false };
const PRECIO = { encargo_id: "enc-1", aceptada: false, importe: "4.000 €" };

const claves = (p) => p.map((x) => x.clave);

describe("el orden de los pasos", () => {
  test("mandato, lo suyo, peritación y precio", () => {
    /*
     * Es el orden de verdad, no una preferencia: el mandato se manda nada más
     * hablar con él; sin coche y sin papeles no hay nada que peritar; y el
     * precio se fija con lo que diga la peritación.
     */
    const p = losPasos({ puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: PRECIO });
    assert.deepEqual(claves(p), ["mandato", "idcar", "papeles", "seguro", "peritacion", "precio"]);
  });

  test("sin encargo no hay peritación que esperar", () => {
    // Una fila que no puede tocar convierte la lista en un cartel.
    assert.ok(!claves(losPasos({ puertas: PUERTAS })).includes("peritacion"));
  });

  test("y el precio solo cuando se le ha mandado", () => {
    /*
     * Desde el principio, la lista diría «8 de 9» durante semanas por una fila
     * imposible de tocar, y entonces deja de leerse como una lista de cosas
     * que hacer.
     */
    assert.ok(!claves(losPasos({ puertas: PUERTAS, estado: HECHA })).includes("precio"));
  });
});

describe("la cuenta", () => {
  test("no cuenta lo opcional", () => {
    /*
     * El seguro y el historial de revisiones no paran nada: un coche se
     * publica y se vende sin ellos. Contándolos le decíamos que su coche no
     * salía por una factura de hace tres años.
     */
    const p = losPasos({ puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: PRECIO });
    const c = laCuenta(p);
    assert.equal(c.total, 5, "mandato, coche, papeles, peritación y precio");
    assert.equal(c.faltan, 1, "solo el precio");
  });
});

describe("lo que falta ANTES del precio", () => {
  test("el precio no cuenta, aunque falte", () => {
    /*
     * Con el precio dentro de esa cuenta, en cuanto se le mandaba el papel el
     * panel volvía a tratar el encargo como si no hubiera traído nada: le
     * ofrecía elegir una peritación que ya estaba hecha, y esos botones piden
     * otra visita.
     */
    const p = losPasos({ puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: PRECIO });
    assert.equal(faltanAntesDelPrecio(p), 0);
  });

  test("pero lo suyo sin traer, sí", () => {
    const sinPapeles = PUERTAS.map((x) => (x.clave === "papeles" ? { ...x, abierta: false } : x));
    const p = losPasos({ puertas: sinPapeles, mandato: MANDATO, estado: null });
    assert.equal(faltanAntesDelPrecio(p), 1);
  });
});

describe("por dónde va", () => {
  const pasosDe = (d) => losPasos(d);

  test("con cosas suyas por traer no se cuenta el futuro", () => {
    /*
     * Lo que tiene que leer es qué le falta. «Estamos preparando tu anuncio»
     * encima de «te faltan dos cosas» se contradice con ella, y gana la que
     * menos trabajo da.
     */
    const sinPapeles = PUERTAS.map((x) => (x.clave === "papeles" ? { ...x, abierta: false } : x));
    const d = { puertas: sinPapeles, mandato: MANDATO, estado: HECHA };
    assert.equal(laFase({ ...d, pasos: pasosDe(d) }), null);
  });

  test("peritación hecha y sin mandarle el precio: se le dice que viene", () => {
    // No tiene nada que hacer, pero el silencio justo después de la
    // peritación se lee como que se nos ha olvidado, y es cuando más
    // pendiente está.
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: HECHA };
    const f = laFase({ ...d, pasos: pasosDe(d) });
    assert.match(f.titulo, /Peritación hecha/);
    assert.match(f.detalle, /te mandamos el precio de salida/i);
    assert.doesNotMatch(f.detalle, /Ya está todo comprobado\. Estamos preparando/);
  });

  test("mandado y sin firmar: no se dice nada aquí", () => {
    // Esa línea ya está en la lista, con su importe y su botón. Repetirla
    // obliga a decidir cuál de las dos vale.
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: PRECIO };
    assert.equal(laFase({ ...d, pasos: pasosDe(d) }), null);
  });

  test("firmado: entonces sí, ya está todo", () => {
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: { ...PRECIO, aceptada: true } };
    const f = laFase({ ...d, pasos: pasosDe(d) });
    assert.match(f.titulo, /Ya está todo/);
  });

  test("la visita que ya pasó no desaparece", () => {
    /*
     * La tarjeta de la cita solo enseña las futuras, así que sin esto la
     * visita se esfumaba al día siguiente como si no hubiera existido. Y no
     * se dice «hecha»: que pase la hora no prueba que nadie viera el coche.
     */
    const ayer = new Date(Date.now() - 86400000).toISOString();
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: { ...HECHA, taller_hecho: false, taller_ok: false } };
    const f = laFase({ ...d, pasos: pasosDe(d), cita: { cita_at: ayer, modalidad: "a_domicilio" } });
    assert.match(f.titulo, /Ya hemos visto tu coche/);
    assert.match(f.detalle, /Estamos apuntando el resultado/);
  });

  test("y la que está por llegar la cuenta su propia caja", () => {
    const manana = new Date(Date.now() + 86400000).toISOString();
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: { ...HECHA, taller_hecho: false, taller_ok: false, tiene_cita: true } };
    assert.equal(laFase({ ...d, pasos: pasosDe(d), cita: { cita_at: manana } }), null);
  });

  test("si el taller lo tumbó, se dice que llamamos y nada más", () => {
    // Es lo único de todo esto que se resuelve hablando, y enterarse por una
    // línea del panel antes de esa llamada es la peor manera.
    const d = { puertas: PUERTAS, mandato: MANDATO, estado: { ...HECHA, taller_ok: false } };
    const f = laFase({ ...d, pasos: pasosDe(d) });
    assert.match(f.detalle, /Te llamamos/);
    assert.doesNotMatch(f.detalle, /no se puede vender/i);
  });
});

describe("cada paso dice qué se puede hacer, no qué botón pintar", () => {
  test("el mandato y el precio se firman", () => {
    /*
     * El panel enseña el botón de subir dentro de la fila y la app lleva a su
     * pantalla de papeles. Si esto dijera «pinta un botón», uno de los dos
     * tendría que desobedecerlo.
     */
    const p = losPasos({ puertas: PUERTAS, mandato: MANDATO, estado: HECHA, precio: PRECIO });
    assert.equal(p.find((x) => x.clave === "mandato").accion.tipo, "firmar");
    assert.equal(p.find((x) => x.clave === "precio").accion.tipo, "firmar");
  });

  test("y la peritación solo se elige mientras no haya nada en marcha", () => {
    // Con cita puesta, elegir otra vez cambiaría la que ya tiene sin querer.
    const sinCita = losPasos({ puertas: PUERTAS, estado: { taller_hecho: false, taller_ok: false, tiene_cita: false } });
    assert.equal(sinCita.find((x) => x.clave === "peritacion").accion.tipo, "elegir_peritacion");

    const conCita = losPasos({ puertas: PUERTAS, estado: { taller_hecho: false, taller_ok: false, tiene_cita: true } });
    assert.equal(conCita.find((x) => x.clave === "peritacion").accion, null);

    const hecha = losPasos({ puertas: PUERTAS, estado: HECHA });
    assert.equal(hecha.find((x) => x.clave === "peritacion").accion, null);
  });
});
