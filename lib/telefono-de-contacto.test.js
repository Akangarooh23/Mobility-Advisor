"use strict";

/**
 * Que el telefono sea el mismo en todas partes.
 *
 * Estaba escrito a mano en tres pantallas y con dos valores distintos: la ficha
 * del portal llevaba el bueno y la pagina de Contacto seguia enseñando un
 * `600 000 000` de relleno, en produccion, con su enlace de WhatsApp a un
 * numero que no es de nadie. Quien entraba por Contacto no tenia forma de
 * llamarnos.
 *
 * Vive en `lib/marca.js` y en `src/marca.js` porque `src/` no puede importar de
 * `lib/` -CRA lo prohibe con su ModuleScopePlugin-, que es el mismo trato que
 * ya tienen el dominio y el correo. Lo que hay que proteger es que los dos no
 * vuelvan a separarse.
 *
 * Esta prueba lee `src/marca.js` como texto y no lo importa: es un modulo ES y
 * esto es CommonJS, y ademas importarlo desde aqui es justo lo que el bundler
 * no deja.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { MARCA } = require("./marca");

const RAIZ = path.join(__dirname, "..");
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const SRC_MARCA = leer("src/marca.js");

/** El valor de una constante exportada, tal cual esta escrito. */
function valor(fuente, nombre) {
  const m = fuente.match(new RegExp(`export const ${nombre} = "([^"]*)"`));
  return m ? m[1] : null;
}

describe("el telefono es el mismo en los dos lados", () => {
  test("el que se enseña", () => {
    assert.equal(valor(SRC_MARCA, "TELEFONO"), MARCA.telefono);
  });

  test("y el de WhatsApp", () => {
    assert.equal(valor(SRC_MARCA, "TELEFONO_WHATSAPP"), MARCA.telefonoWhatsapp);
  });

  test("y los dos son el mismo numero escrito de dos maneras", () => {
    /*
     * El formato de WhatsApp no se deriva quitando espacios -por si algun dia
     * lleva extension- pero tienen que seguir siendo el mismo numero. Sin esto
     * se podria cambiar uno y dejar el otro apuntando al de antes, que es
     * exactamente lo que habia pasado.
     */
    assert.equal(MARCA.telefono.replace(/\D/g, ""), MARCA.telefonoWhatsapp);
  });

  test("y es un movil español de verdad", () => {
    // Nueve digitos detras del 34, empezando por 6 o 7. No prueba que sea el
    // nuestro, pero si caza el que se deja a medias.
    assert.match(MARCA.telefonoWhatsapp, /^34[67]\d{8}$/);
  });
});

describe("y no queda ninguno de relleno", () => {
  /*
   * El 600 000 000 es el numero que se pone cuando todavia no hay numero. Como
   * `placeholder` de un campo esta bien; como telefono al que llamar o como
   * enlace de WhatsApp, es una pagina que no lleva a nadie.
   */
  const PANTALLAS = [
    "src/pages/ContactCarswisePage.js",
    "src/pages/PortalVoDetailPage.js",
  ];

  for (const p of PANTALLAS) {
    test(`${p} no llama a un numero inventado`, () => {
      // Sin los `placeholder=`, que son texto gris dentro de un campo vacio y
      // no un numero al que se llame.
      const sinPlaceholders = leer(p).replace(/placeholder="[^"]*"/g, "");
      assert.doesNotMatch(sinPlaceholders, /600\s?000\s?000/, "queda un telefono de relleno");
      assert.doesNotMatch(sinPlaceholders, /wa\.me\/34600000000/, "queda un WhatsApp de relleno");
    });
  }

  test("las dos lo sacan de la marca, no escrito a mano", () => {
    // Escrito a mano vuelve a poder separarse en cuanto una de las dos cambie.
    const contacto = leer("src/pages/ContactCarswisePage.js");
    assert.match(contacto, /ENLACE_WHATSAPP/);
    assert.match(contacto, /from "\.\.\/marca"/);

    const portal = leer("src/pages/PortalVoDetailPage.js");
    assert.match(portal, /TELEFONO_WHATSAPP/);
    assert.doesNotMatch(portal, /"34\d{9}"/, "el numero sigue escrito a mano");
  });
});
