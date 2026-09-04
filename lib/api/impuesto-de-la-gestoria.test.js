/**
 * El impuesto de matriculación es una partida, no un trámite.
 *
 * Los tres papeleos de una importación —el impuesto, la ITV de homologación y la
 * matrícula— se juntaron en un solo expediente de gestoría, porque los lleva la
 * misma gestoría con una factura. Desde entonces, buscar «el trámite de tipo
 * Impuesto de matriculación» devuelve nulo siempre.
 *
 * Y con nulo, el cliente no ve la liquidación de lo que puso a cuenta. Pagó una
 * provisión —el impuesto no se sabe hasta que se matricula— y la diferencia es
 * suya en los dos sentidos. Callarla es quedarse con dinero que no es nuestro, o
 * pedirle por teléfono unos cientos de euros que podía haber leído antes.
 *
 * Y el importe llega como texto pegado de un Excel: «1.420,00 €» son mil
 * cuatrocientos veinte, no uno con cuatro.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs
  .readFileSync(path.join(__dirname, "..", "billingStore.js"), "utf8")
  .replace(/\r\n/g, "\n");

test("se busca la partida, no el trámite que ya no existe", () => {
  assert.equal(
    (FUENTE.match(/lower\(btrim\(p->>'concepto'\)\) LIKE 'impuesto de matriculaci%'/g) || []).length,
    2,
    "hay dos consultas que leen los leads y las dos tienen que mirarlo"
  );
  assert.doesNotMatch(FUENTE, /t\.tipo = 'Impuesto de matriculación'/);
});

test("y se busca en el coche entero, por sus dos columnas", () => {
  // Un papeleo cuelga del expediente o del pedido según por dónde se abriera.
  assert.match(FUENTE, /OR t\.pedido_id IN \(SELECT pe\.id FROM erp_pedidos pe/);
});

test("una partida sin importe no cuenta como importe", () => {
  // Se apuntan conceptos antes de saber lo que valen. Un vacío leído como cero
  // diría que hay que devolverle los 1.420 € enteros.
  assert.equal(
    (FUENTE.match(/AND COALESCE\(p->>'importe', ''\) <> ''/g) || []).length,
    2
  );
});

test("el importe se entiende con coma decimal y con euro", () => {
  assert.match(FUENTE, /function importeDeLaPartida\(v\) \{/);
  assert.equal(
    (FUENTE.match(/importeDeLaPartida\((row|r)\.impuesto_real\)/g) || []).length,
    2
  );
});

test("y lo que no es un número no se cuela como cero", () => {
  // Un cero falso aquí dice que el impuesto salió gratis y que hay que
  // devolverle la provisión entera.
  const { importeDeLaPartida } = cargaElParser();
  assert.equal(importeDeLaPartida("1.420,00 €"), 1420);
  assert.equal(importeDeLaPartida("6,534"), 6.534);
  assert.equal(importeDeLaPartida("99.77"), 99.77);
  assert.equal(importeDeLaPartida(""), null);
  assert.equal(importeDeLaPartida("lo que sea"), null);
  assert.equal(importeDeLaPartida(null), null);
});

/** Se saca la función del fichero: no se exporta, y montarlo entero pide base. */
function cargaElParser() {
  const desde = FUENTE.indexOf("function importeDeLaPartida(v) {");
  const hasta = FUENTE.indexOf("\n}", desde) + 2;
  const codigo = FUENTE.slice(desde, hasta);
  // eslint-disable-next-line no-new-func
  return { importeDeLaPartida: new Function(`${codigo}; return importeDeLaPartida;`)() };
}
