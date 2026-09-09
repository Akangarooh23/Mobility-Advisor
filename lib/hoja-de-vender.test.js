"use strict";

/**
 * La hoja de «Nosotros lo vendemos por ti».
 *
 * Es una página de producción que prometía cosas que ya no son verdad: el
 * informe de estado marcado como opcional cuando es obligatorio, y un botón que
 * decía «cuéntanos qué coche tienes» para llevar a un formulario que no lo
 * preguntaba y que no creaba ningún lead.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const PAGINA = leer("src/pages/SellProfessionalAssistPage.js");
const CSS = leer("src/pages/SellProfessionalAssistPage.css");
const FORM = leer("src/components/FormularioEncargoVenta.js");
const ES = JSON.parse(leer("src/locales/es.json"));
const LEADS = leer("lib/api/leads-handler.js");

describe("el botón lleva a un formulario propio", () => {
  test("y no al formulario de contacto general", () => {
    assert.match(PAGINA, /<FormularioEncargoVenta \/>/);
    assert.ok(!/onStartRequest/.test(PAGINA), "sigue saltando al contacto general");
  });

  test("que pregunta las dos cosas que el botón promete", () => {
    assert.match(FORM, /¿Qué coche quieres vender\?/);
    assert.match(FORM, /¿En cuánto tiempo\?/);
  });

  test("y que crea un lead de verdad", () => {
    // Antes esto acababa en un correo a una bandeja: el cliente no aparecía en
    // ninguna pantalla del ERP.
    assert.match(FORM, /fetch\("\/api\/leads"/);
    assert.match(FORM, /loQueSeManda\(datos\)/);
  });

  test("el tipo nuevo lo acepta el servidor", () => {
    /*
     * Sin esto el lead entraría como «info» y se mezclaría con las consultas
     * del marketplace: nadie sabría cuántos encargos entran por la web.
     */
    assert.match(LEADS, /ALLOWED_TYPES\s*=\s*\[[^\]]*"venta_gestionada"/);
    assert.match(LEADS, /venta_gestionada: "Quiere que le vendamos el coche"/);
  });
});

describe("lo que la página promete", () => {
  test("el informe de estado ya no es opcional", () => {
    // Es la puerta que se decidió exigir, y es lo que diferencia el anuncio de
    // uno de Milanuncios.
    assert.doesNotMatch(ES.sell.professionalStep1Tag, /opcional/i);
    assert.match(ES.sell.professionalStep1Tag, /obligatorio/i);
  });

  test("y tampoco lo parece por el color de su etiqueta", () => {
    // La etiqueta llevaba el estilo de «opcional». Cambiar solo el texto habría
    // dejado la palabra «obligatorio» pintada de gris de opcional.
    assert.ok(
      !/tag-opt">\{t\("sell\.professionalStep1Tag"\)\}/.test(PAGINA),
      "el texto dice obligatorio pero el estilo sigue siendo el de opcional",
    );
  });

  test("los tres números del trato se dicen antes de enviar nada", () => {
    /*
     * «No adelantas un euro» es lo mejor que hay que contar y estaba escondido
     * hasta que alguien cogía el teléfono. Enseñarlo aquí hace que la llamada
     * empiece con un argumento en vez de con una sorpresa.
     */
    assert.match(FORM, /299 €/);
    assert.match(FORM, /30 días/);
    assert.match(FORM, /150 €/);
  });
});

describe("lo visual", () => {
  test("la acción principal es del mismo color que en la pantalla anterior", () => {
    // Eran dos pantallas seguidas con el botón principal de dos colores: negro
    // en «Publicar con IDCar» y ámbar aquí.
    assert.match(CSS, /\.btn-gold \{[\s\S]{0,240}var\(--marca\), var\(--marca-claro\)/);
    assert.ok(!/#ba7517, #c98120/.test(CSS), "sigue el ámbar de esta hoja");
  });

  test("el breadcrumb se lee", () => {
    // Era #ccc sobre blanco: alrededor de 1,6:1 de contraste.
    assert.ok(!/\.breadcrumb \{[\s\S]{0,80}color: #ccc/.test(CSS));
  });

  test("los campos del formulario tienen foco visible", () => {
    // Se rellena con el teclado y desde el móvil.
    assert.match(CSS, /\.fev-campo input:focus[\s\S]{0,160}outline:/);
  });

  test("y en el móvil los dos campos de una línea se apilan", () => {
    assert.match(CSS, /@media \(max-width: 640px\)[\s\S]{0,220}\.fev-dos \{ grid-template-columns: 1fr; \}/);
  });
});
