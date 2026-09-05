/**
 * Qué IVA lleva nuestra factura, según quién la recibe.
 *
 * Casi siempre el 21 %. La excepción es una empresa de otro país de la UE con
 * NIF-IVA, que va sin IVA porque lo autoliquida ella. Hasta ahora no estaba
 * contemplado y se le repercutía igual: para esa empresa es un 21 % que no
 * puede deducirse aquí y que tiene que pedir por el modelo 360, meses después.
 *
 * Lo que se vigila aquí sobre todo es **el lado por el que se falla**: dejar de
 * repercutir un IVA que luego no se sostiene lo pagamos nosotros, así que sin
 * comprobación no hay exención.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  IVA_GENERAL, paisDelNifIva, vaSinIva, tipoDeIvaDelServicio,
  POR_QUE_SIN_IVA, faltaParaFacturarSinIva,
} = require("./iva-del-servicio.js");

describe("de dónde es un NIF-IVA", () => {
  test("los prefijos de la Unión se reconocen", () => {
    assert.equal(paisDelNifIva("DE811907980"), "DE");
    assert.equal(paisDelNifIva("FR40303265045"), "FR");
    assert.equal(paisDelNifIva("PT501442600"), "PT");
  });

  test("y se leen escritos como los escribe la gente", () => {
    assert.equal(paisDelNifIva(" de 811 907 980 "), "DE");
    assert.equal(paisDelNifIva("de811907980"), "DE");
  });

  test("España no cuenta: a un español se le repercute IVA español", () => {
    // La inversión del sujeto pasivo es entre estados distintos. Una empresa
    // española paga su 21 % y se lo deduce en su 303, sea empresa o no.
    assert.equal(paisDelNifIva("ESB88835145"), null);
    assert.equal(paisDelNifIva("B88835145"), null);
  });

  test("ni el Reino Unido, salvo Irlanda del Norte", () => {
    assert.equal(paisDelNifIva("GB123456789"), null);
    assert.equal(paisDelNifIva("XI123456789"), "XI");
  });

  test("y un prefijo suelto no es un NIF", () => {
    assert.equal(paisDelNifIva("DE"), null);
    assert.equal(paisDelNifIva(""), null);
    assert.equal(paisDelNifIva(null), null);
  });
});

describe("y qué IVA le toca", () => {
  test("a un particular español, el 21 %", () => {
    assert.equal(IVA_GENERAL, 21);
    assert.equal(tipoDeIvaDelServicio({ tax_id: "12345678Z" }), 21);
    assert.equal(tipoDeIvaDelServicio({}), 21);
  });

  test("a una empresa de la UE con el NIF comprobado, ninguno", () => {
    assert.equal(tipoDeIvaDelServicio({ tax_id: "DE811907980", nif_iva_verificado: true }), 0);
    assert.equal(vaSinIva({ tax_id: "DE811907980", nif_iva_verificado: true }), true);
  });

  test("**pero sin comprobar, el 21 %**", () => {
    /*
     * Es la regla que protege la caja. Un número que parece alemán no prueba
     * que ese cliente esté registrado en VIES, y si no lo está, el IVA que
     * dejamos de repercutir lo debemos nosotros. Se falla hacia el lado que se
     * puede devolver.
     */
    assert.equal(tipoDeIvaDelServicio({ tax_id: "DE811907980" }), 21);
    assert.equal(tipoDeIvaDelServicio({ tax_id: "DE811907980", nif_iva_verificado: false }), 21);
  });

  test("y una marca de comprobado sin NIF no exime de nada", () => {
    assert.equal(tipoDeIvaDelServicio({ nif_iva_verificado: true }), 21);
  });

  test("la factura exenta dice por qué lo es", () => {
    // Una factura sin cuota y sin explicación está incompleta: quien la reciba
    // tiene que poder leer en el papel por qué no hay IVA.
    assert.match(POR_QUE_SIN_IVA, /inversión del sujeto pasivo/i);
    assert.match(POR_QUE_SIN_IVA, /84\.Uno\.2/);
  });
});

describe("y qué falta para poder no repercutirlo", () => {
  test("sin NIF, el NIF", () => {
    assert.deepEqual(faltaParaFacturarSinIva({}), ["el NIF-IVA del cliente"]);
  });

  test("con un NIF español, no hay exención que pedir", () => {
    assert.deepEqual(faltaParaFacturarSinIva({ tax_id: "B88835145" }),
      ["un NIF-IVA de otro país de la UE"]);
  });

  test("y con uno de la UE sin comprobar, la comprobación", () => {
    assert.deepEqual(faltaParaFacturarSinIva({ tax_id: "DE811907980" }),
      ["comprobarlo en VIES y dejarlo marcado"]);
  });

  test("comprobado y de la UE: no falta nada", () => {
    assert.deepEqual(
      faltaParaFacturarSinIva({ tax_id: "DE811907980", nif_iva_verificado: true }), []
    );
  });
});

describe("y el generador de facturas lo usa", () => {
  const fs = require("fs");
  const path = require("path");
  const FUENTE = fs.readFileSync(path.join(__dirname, "api/invoice-pdf-handler.js"), "utf8");

  test("el tipo no está escrito a mano en el PDF", () => {
    // Estaba: dividía por 1,21 y ponía «IVA (21%)» pasara lo que pasara.
    assert.ok(!/\/ 1\.21/.test(FUENTE), "el 21 % sigue clavado en el cálculo");
    assert.ok(!/"IVA \(21%\)"/.test(FUENTE), "el 21 % sigue clavado en el texto");
    assert.match(FUENTE, /tipoDeIvaDelServicio\(row\)/);
  });

  test("y la columna de la comprobación se crea sola", () => {
    assert.match(FUENTE, /ADD COLUMN IF NOT EXISTS nif_iva_verificado/);
    assert.match(FUENTE, /u\.nif_iva_verificado/, "hay que traerla para poder mirarla");
  });
});
