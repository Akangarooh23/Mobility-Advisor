/**
 * El justificante de lo que ha pagado.
 *
 * La factura que se le manda son 3.000 € y él ha transferido 21.500. Aunque el
 * bloque de suplidos lo explique, ese papel lleva «TOTAL 3.000 €» arriba del
 * todo: no sirve como resguardo de lo que ha pagado.
 *
 * Este segundo documento sí, y lo que hay que poder comprobar es lo que de
 * verdad importa: que la suma cuadra con lo que transfirió y que ningún euro se
 * queda sin dueño. Dieciocho mil quinientos euros en manos de otro se sostienen
 * porque hay un papel que dice de quién son.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  repartoDelDeposito, aQuienVa, generateDepositoPdf,
} = require("./billing-webhook-handler.js");

const CASO = {
  numeroFactura: "SRV-2026-0001",
  fee: 3000,
  suplidos: [
    { concepto: "Precio del coche (vendedor en Alemania)", importe: 16890 },
    { concepto: "Impuesto de matriculacion (a cuenta)", importe: 1420 },
    { concepto: "Garantia mecanica (aseguradora)", importe: 190 },
  ],
};

describe("el reparto del depósito", () => {
  test("la suma es exactamente lo que transfirió", () => {
    // Es la única comprobación que de verdad importa. Un justificante cuyo total
    // no coincide con el cargo de su banco no justifica nada.
    assert.equal(repartoDelDeposito(CASO).total, 21500);
  });

  test("y ningún euro se queda sin dueño", () => {
    for (const l of repartoDelDeposito(CASO).lineas) {
      assert.notEqual(l.aQuien, "-", `sin dueño: ${l.concepto}`);
      assert.ok(l.importe > 0, `sin importe: ${l.concepto}`);
    }
  });

  test("nuestro servicio va primero y con su número de factura", () => {
    // Es lo único de aquí que es ingreso nuestro y lo único que se factura. El
    // número enlaza los dos papeles del mismo correo.
    const [primera] = repartoDelDeposito(CASO).lineas;
    assert.match(primera.concepto, /SRV-2026-0001/);
    assert.equal(primera.facturado, true);
  });

  test("y los suplidos no van marcados como facturados", () => {
    // Facturar el coche sería declarar la venta de un coche que no hemos
    // vendido; facturar el impuesto, cobrar IVA sobre dinero de Hacienda.
    const suplidos = repartoDelDeposito(CASO).lineas.filter((l) => !l.facturado);
    assert.equal(suplidos.length, 3);
    assert.equal(suplidos.reduce((t, l) => t + l.importe, 0), 18500);
  });

  test("sin garantía contratada, la cuenta sigue cuadrando", () => {
    const sinGar = { ...CASO, suplidos: CASO.suplidos.slice(0, 2) };
    assert.equal(repartoDelDeposito(sinGar).total, 21310);
    assert.equal(repartoDelDeposito(sinGar).lineas.length, 3);
  });

  test("una línea a cero no se pinta: no dice nada y ocupa", () => {
    const conCero = { ...CASO, suplidos: [...CASO.suplidos, { concepto: "Lo que sea", importe: 0 }] };
    assert.equal(repartoDelDeposito(conCero).lineas.length, 4);
  });

  test("sin nada, no se inventa un papel", () => {
    assert.deepEqual(repartoDelDeposito({}), { lineas: [], total: 0 });
    assert.deepEqual(repartoDelDeposito(), { lineas: [], total: 0 });
  });
});

describe("de quién es cada parte", () => {
  test("cada suplido tiene su destinatario", () => {
    assert.equal(aQuienVa("Precio del coche (vendedor en Alemania)"), "Vendedor en Alemania");
    assert.equal(aQuienVa("Impuesto de matriculacion (a cuenta)"), "Hacienda (a cuenta)");
    assert.equal(aQuienVa("Garantia mecanica (aseguradora)"), "Aseguradora");
  });

  test("y con acentos o sin ellos, el mismo", () => {
    // Los conceptos se escriben sin acentos porque el PDF usa una fuente
    // estándar, pero eso puede cambiar y el reparto no debería enterarse.
    assert.equal(aQuienVa("Impuesto de matriculación (a cuenta)"), "Hacienda (a cuenta)");
    assert.equal(aQuienVa("Garantía mecánica (aseguradora)"), "Aseguradora");
  });

  test("lo que no se reconoce sale marcado, no adivinado", () => {
    // Inventarse un destinatario es peor que decir que no se sabe: el papel
    // afirmaría de quién es un dinero sin tener ni idea.
    assert.equal(aQuienVa("Un concepto nuevo"), "-");
  });
});

describe("el papel que se genera", () => {
  test("sale un PDF de verdad", async () => {
    const pdf = await generateDepositoPdf(
      { ...CASO, fecha: "2026-09-01T18:39:37.352Z", coche: "Kia Sorento", email: "quien@ejemplo.es" },
      { name: "Ana", apellidos: "Picazo", tax_id: "00000000T" }
    );
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 1000, "un PDF de 1 kB no lleva nada dentro");
  });

  test("y no revienta sin perfil ni suplidos", async () => {
    // Un perfil incompleto no puede dejar al cliente sin justificante.
    const pdf = await generateDepositoPdf({ fee: 3000 });
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  });
});
