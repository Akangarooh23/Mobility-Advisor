/**
 * Al cliente no se le enseña un coche que ya está vendido.
 *
 * Una oferta alemana tiene dos interruptores y hacen cosas distintas:
 *
 * - `import_published` dice si **el ahorro es bueno**. Lo decide el precio.
 * - `is_active` dice si **el coche existe todavía**. Lo decide el verificador,
 *   que va a AutoScout24 y mira si la ficha sigue en pie.
 *
 * El catálogo público solo miraba el primero. El 1 de septiembre de 2026 había
 * 454 coches publicados de 484 que llevaban vendidos desde julio, y no era una
 * sospecha: ocho comprobados a mano dieron ocho muertos, cuatro de ellos con un
 * HTTP 410 del propio portal.
 *
 * Lo grave no era la lista. Era que se podía **pedir uno de esos coches y pagar
 * la fianza**: miles de euros por un coche vendido hacía seis semanas.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const lee = (f) => fs.readFileSync(path.join(__dirname, f), "utf8").replace(/\r\n/g, "\n");

const VIVA = /COALESCE\(is_active, TRUE\) = TRUE/;

describe("el catálogo público solo enseña coches que existen", () => {
  const OFERTAS = lee("import-offers-handler.js");

  test("el listado no trae los vendidos", () => {
    const cond = OFERTAS.slice(OFERTAS.indexOf("const conditions = ["), OFERTAS.indexOf("const conditions = [") + 300);
    assert.match(cond, VIVA);
  });

  test("ni la ficha de uno solo", () => {
    // Son dos consultas de una ficha: la del detalle y la del enlace que se
    // comparte. Si una se queda fuera, el enlace de WhatsApp abre un coche
    // vendido con su botón de pagar la fianza.
    const cuantas = (OFERTAS.match(new RegExp(VIVA.source, "g")) || []).length;
    assert.ok(cuantas >= 3, `solo ${cuantas} consultas filtran por viva; hacen falta el listado, el detalle y el enlace`);
  });

  test("ni el desplegable de marcas cuenta coches muertos", () => {
    // Si no, el filtro dice «Kia (222)» y al pulsarlo salen tres.
    const marcas = OFERTAS.slice(OFERTAS.indexOf("GROUP BY brand") - 400, OFERTAS.indexOf("GROUP BY brand"));
    assert.match(marcas, VIVA);
  });

  test("con COALESCE: sin revisar no es lo mismo que vendido", () => {
    // Una oferta recién raspada no tiene todavía veredicto del verificador.
    // Tratarla como muerta escondería justo lo más nuevo.
    assert.ok(!/is_active = TRUE(?!\))/.test(OFERTAS.replace(/COALESCE\(is_active, TRUE\) = TRUE/g, "")),
      "hay una comprobación sin COALESCE: las ofertas sin revisar se caerían");
  });
});

describe("no se puede pedir un coche que ya no está", () => {
  const LEAD = lee("import-lead-handler.js");

  test("la solicitud comprueba que la oferta sigue viva", () => {
    // Esto es lo que evita cobrar una fianza de miles de euros por un coche
    // vendido. El precio se recalcula aquí, así que aquí se mira también.
    const consulta = LEAD.slice(LEAD.indexOf("FROM moveadvisor_market_offers"), LEAD.indexOf("FROM moveadvisor_market_offers") + 300);
    assert.match(consulta, VIVA);
  });
});

describe("las alertas tampoco avisan de coches vendidos", () => {
  const CRON = lee("cron-alert-check-handler.js");

  test("el aviso por correo filtra por viva", () => {
    // Un correo que dice «ha bajado de precio un coche que buscabas» con enlace
    // a una ficha muerta es peor que no mandar nada.
    // El de importación, no el de las alertas nacionales: hay dos listas de
    // condiciones en el fichero y la primera es la otra.
    const i = CRON.indexOf(`"country = 'DE'"`);
    assert.ok(i > 0, "no encuentro las condiciones de importación");
    assert.match(CRON.slice(i, i + 200), VIVA);
  });
});

describe("y el catálogo no vuelve a publicar un coche muerto", () => {
  const { sePublica } = require("../coste-importacion.js");
  const bueno = { precioAleman: 5000, precioEspanol: 11000, comparables: 30 };

  test("con la oferta viva, se publica", () => {
    assert.equal(sePublica({ ...bueno, viva: true }), true);
  });

  test("vendida, no se publica por muy bueno que sea el ahorro", () => {
    assert.equal(sePublica({ ...bueno, viva: false }), false);
  });

  test("y si no se dice nada, se supone viva", () => {
    // Quien llame sin ese dato no debe perder ofertas buenas por omisión.
    assert.equal(sePublica(bueno), true);
  });
});
