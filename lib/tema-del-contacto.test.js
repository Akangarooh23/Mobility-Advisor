"use strict";

/**
 * El formulario de contacto se abre por donde ha venido el cliente.
 *
 * Quien pulsa «Quiero vender mi coche» en «Nosotros lo vendemos por ti»
 * aterrizaba en un formulario marcado en **Compra de coche**. Con razón se
 * entiende que no le hemos leído — y es la primera cosa que hace con nosotros.
 *
 * Se comprueba sobre la fuente porque lo que se protege es el cableado: que el
 * salto ponga el asunto y que la página lo reciba. Un simulacro del componente
 * diría que sí aunque en `App.js` nadie le pasara nada.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const APP = leer("src/App.js");
const CONTACTO = leer("src/pages/ContactCarswisePage.js");
const ES = JSON.parse(leer("src/locales/es.json"));

describe("el asunto con el que se abre el contacto", () => {
  test("la página lo acepta como prop", () => {
    assert.match(CONTACTO, /function ContactCarswisePage\(\{ tema \}/);
  });

  test("y lo usa para marcar el asunto de salida", () => {
    assert.match(CONTACTO, /useState\(temaValido\(tema\) \? tema : "compra"\)/);
  });

  test("un asunto inventado no deja el formulario en blanco", () => {
    /*
     * Sin la comprobación, abrir con un asunto que no existe no marca ninguno,
     * y entonces el correo que nos llega no dice a qué venía la persona. Eso es
     * peor que equivocarse de asunto.
     */
    const { temaValido, TEMAS } = cargaLosTemas();
    assert.equal(temaValido("venta"), true);
    assert.equal(temaValido("ventas"), false);
    assert.equal(temaValido(""), false);
    assert.equal(temaValido(undefined), false);
    assert.deepEqual(TEMAS, ["compra", "gestion", "venta", "otro"]);
  });

  test("los asuntos son los mismos que enseña la pantalla", () => {
    // Si alguien añade un asunto a los textos y no a la lista, abrir por él
    // dejaría el formulario sin marcar.
    const { TEMAS } = cargaLosTemas();
    assert.deepEqual(TEMAS, ES.contact.topics.map((t) => t.key));
  });
});

describe("el botón de «Nosotros lo vendemos por ti»", () => {
  test("abre el contacto en venta, no en compra", () => {
    assert.match(
      APP,
      /onOpenContact=\{\(\) => \{[\s\S]{0,300}setTemaDeContacto\("venta"\);[\s\S]{0,80}setEntryMode\("contact"\)/,
      "el salto desde vender no dice a qué viene",
    );
  });

  test("y la página lo recibe de verdad", () => {
    // El fallo tonto: poner el estado y no pasárselo al componente.
    assert.match(APP, /<ContactCarswisePage[^>]*tema=\{temaDeContacto\}/);
  });

  test("el resto de entradas siguen abriendo en compra", () => {
    // «Habla con el equipo» no viene de vender: ese no toca el asunto.
    const hablaConElEquipo = APP.slice(APP.indexOf("onTalkToTeam={() => {"));
    const hastaElCierre = hablaConElEquipo.slice(0, hablaConElEquipo.indexOf("}}"));
    assert.ok(
      !/setTemaDeContacto/.test(hastaElCierre),
      "«Habla con el equipo» está forzando un asunto que nadie ha elegido",
    );
    assert.match(APP, /useState\("compra"\)/, "el asunto por defecto ya no es compra");
  });
});

/** Los temas, leídos de la fuente: el módulo es JSX y no se puede requerir aquí. */
function cargaLosTemas() {
  const lista = CONTACTO.match(/export const TEMAS = (\[[^\]]*\]);/);
  assert.ok(lista, "no encuentro la lista de asuntos");
  const TEMAS = JSON.parse(lista[1].replace(/'/g, '"'));
  const temaValido = (tema) => TEMAS.includes(String(tema ?? "").trim());
  return { TEMAS, temaValido };
}
