/**
 * Que en los papeles no haya un número encima de otro.
 *
 * Pasó, y en los dos a la vez: el bloque de suplidos empezaba a la misma altura
 * que el recuadro amarillo del total, así que «21500.00 EUR» se imprimía encima
 * de «16890.00 EUR». En la factura y en el justificante. Un cliente mirando
 * dieciocho mil euros suyos con las cifras superpuestas.
 *
 * No se puede comprobar mirando el código: la colisión sale de sumar posiciones
 * y anchos de texto, y eso solo se sabe generando el papel. Así que se genera,
 * se leen las operaciones de dibujo del PDF y se mide.
 *
 * Se miran solo los textos que comparten renglón. Dos cosas a alturas distintas
 * no se pisan, y exigir separación vertical convertiría esto en una prueba de
 * diseño en vez de una de que se lee.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("zlib");

const {
  generateInvoicePdf, generateDepositoPdf,
} = require("./billing-webhook-handler.js");

/**
 * Los bytes que en WinAnsi no son lo que dicen.
 *
 * El PDF guarda el texto en WinAnsi, donde el tramo 0x80-0x9F no coincide con
 * Unicode: la raya larga de «cada uno —factura del vendedor—» es 0x97, que
 * leído a lo bruto sale como un carácter de control que luego no se puede ni
 * medir. Solo hacen falta los que salen en estos dos papeles.
 */
const WINANSI = {
  0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201C", 0x94: "\u201D",
  0x96: "\u2013", 0x97: "\u2014", 0x85: "\u2026", 0x80: "\u20AC",
};

const SUPLIDOS = [
  { concepto: "Precio del coche (vendedor en Alemania)", importe: 16890 },
  { concepto: "Impuesto de matriculacion (a cuenta)", importe: 1420 },
  { concepto: "Garantia mecanica (aseguradora)", importe: 190 },
];

const PERFIL = {
  name: "Ana", apellidos: "Picazo Haase", tax_id: "06609510T", phone: "682791928",
  billing_street: "Calle Mauricio Legendre 45 G2B",
  billing_postal_code: "28046", billing_province: "MADRID",
};

/**
 * Lo que el PDF dibuja, con dónde y de qué ancho.
 *
 * pdf-lib comprime el contenido y escribe el texto en hexadecimal, así que hay
 * que descomprimir y leer `/<fuente> <tamaño> Tf … 1 0 0 1 x y Tm <hex> Tj`. El
 * ancho sale de las métricas de la fuente de verdad, no de una estimación: una
 * estimación generosa esconde justo el solape que se busca.
 */
async function loQuePinta(pdf) {
  const { PDFDocument, StandardFonts } = require("pdf-lib");
  const doc = await PDFDocument.create();
  const fuentes = {
    "Helvetica-Bold": await doc.embedFont(StandardFonts.HelveticaBold),
    Helvetica: await doc.embedFont(StandardFonts.Helvetica),
  };

  const crudo = pdf.toString("latin1");
  let contenido = "";
  const flujos = /stream\r?\n([\s\S]*?)endstream/g;
  let f;
  while ((f = flujos.exec(crudo))) {
    try { contenido += zlib.inflateSync(Buffer.from(f[1], "latin1")).toString("latin1") + "\n"; }
    catch { /* ese flujo no es contenido */ }
  }

  const re = /\/(Helvetica(?:-Bold)?)-\d+ ([\d.]+) Tf[\s\S]{0,120}?1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm[\s\S]{0,80}?<([0-9A-Fa-f]*)> Tj/g;
  const salida = [];
  let m;
  while ((m = re.exec(contenido))) {
    const hex = m[5];
    let texto = "";
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      texto += WINANSI[byte] || String.fromCharCode(byte);
    }
    const size = Number(m[2]);
    const fuente = fuentes[m[1]] || fuentes.Helvetica;
    salida.push({
      texto, size,
      x: Number(m[3]),
      y: Number(m[4]),
      ancho: fuente.widthOfTextAtSize(texto, size),
    });
  }
  return salida;
}

/** Los pares que comparten renglón y se solapan en horizontal. */
function solapes(cajas) {
  const malos = [];
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      // Mismo renglón: menos de la mitad del tamaño de letra de diferencia.
      if (Math.abs(a.y - b.y) > Math.min(a.size, b.size) / 2) continue;
      if (a.x < b.x + b.ancho && b.x < a.x + a.ancho) malos.push([a.texto, b.texto]);
    }
  }
  return malos;
}

describe("la factura del cliente", () => {
  test("no hay dos textos montados en el mismo renglón", async () => {
    const pdf = await generateInvoicePdf({
      id: "srv-imp-1", number: "SRV-2026-0001", date: "2026-09-01T18:39:37.352Z",
      amount: 3000, status: "Pagada", email: "quien@ejemplo.es",
      description: "Servicio de importación · Kia Sorento 2.4 GDI AWD Automatik Kamera LED",
      suplidos: SUPLIDOS,
    }, PERFIL);
    const malos = solapes(await loQuePinta(pdf));
    assert.deepEqual(malos, [], `se pisan: ${JSON.stringify(malos)}`);
  });

  test("y salen las cuatro cifras que tienen que salir", async () => {
    // Si el extractor dejara de leer el PDF, la prueba de arriba pasaría con
    // una lista vacía y no estaría comprobando nada.
    const pdf = await generateInvoicePdf({
      id: "srv-imp-1", number: "SRV-2026-0001", date: "2026-09-01T18:39:37.352Z",
      amount: 3000, status: "Pagada", email: "quien@ejemplo.es",
      description: "Servicio de importación", suplidos: SUPLIDOS,
    }, PERFIL);
    const textos = (await loQuePinta(pdf)).map((c) => c.texto);
    assert.ok(textos.length > 15, `solo se han leído ${textos.length} textos`);
    for (const cifra of ["3000.00 EUR", "16890.00 EUR", "1420.00 EUR", "190.00 EUR", "21500.00 EUR"]) {
      assert.ok(textos.includes(cifra), `falta ${cifra}`);
    }
  });
});

describe("el justificante de pago", () => {
  test("no hay dos textos montados en el mismo renglón", async () => {
    const pdf = await generateDepositoPdf({
      numeroFactura: "SRV-2026-0001", fecha: "2026-09-01T18:39:37.352Z",
      coche: "Kia Sorento 2.4 GDI AWD Automatik Kamera LED",
      email: "quien@ejemplo.es", fee: 3000, suplidos: SUPLIDOS,
      cobroRef: "pi_3UAwuGQj1tCRE15905yb6aMp",
    }, PERFIL);
    const malos = solapes(await loQuePinta(pdf));
    assert.deepEqual(malos, [], `se pisan: ${JSON.stringify(malos)}`);
  });

  test("y el total recibido cabe al lado de su etiqueta", async () => {
    // Es el que se pisaba: «TOTAL RECIBIDO:» en negrita a 11 puntos no cabía
    // con la cifra al lado dentro del recuadro.
    const pdf = await generateDepositoPdf({
      numeroFactura: "SRV-2026-0001", fee: 3000, suplidos: SUPLIDOS,
    }, PERFIL);
    const cajas = await loQuePinta(pdf);
    const etiqueta = cajas.find((c) => c.texto.startsWith("TOTAL RECIBIDO"));
    const cifra = cajas.find((c) => c.texto === "21500.00 EUR");
    assert.ok(etiqueta && cifra, "no salen la etiqueta y la cifra del total");
    assert.ok(etiqueta.x + etiqueta.ancho < cifra.x,
      `la etiqueta acaba en ${(etiqueta.x + etiqueta.ancho).toFixed(0)} y la cifra empieza en ${cifra.x}`);
  });
});
