"use strict";

/**
 * Que el que llega de coches.net pueda ver el informe de estado.
 *
 * El mismo coche se llama de dos maneras según quién lo publicara: `user_<id>`
 * cuando sale del garaje de su dueño y `idcar-<id>` cuando lo publicamos
 * nosotros desde el ERP. Aquí solo se quitaba el primero.
 *
 * Así que en la ficha de un coche que vendemos nosotros —justo los que llevan
 * informe, porque se lo exigimos para publicar— la pregunta se hacía con
 * `idcar-veh-123`, no encontraba nada, y ni el informe ni la vista en 3D se
 * ofrecían. Es el peor sitio donde podía pasar: el informe es lo que separa
 * nuestro anuncio de uno de Milanuncios.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { elCocheDeLaOferta } = require("./vehicle-model-public-handler");

describe("el coche que hay detrás de una oferta", () => {
  test("el del garaje de su dueño", () => {
    assert.equal(elCocheDeLaOferta("user_veh-1778144236925"), "veh-1778144236925");
  });

  test("y el que publicamos nosotros", () => {
    // El que faltaba, y el único que puede tener informe.
    assert.equal(elCocheDeLaOferta("idcar-veh-1778144236925"), "veh-1778144236925");
  });

  test("y si viene pelado, se deja como está", () => {
    assert.equal(elCocheDeLaOferta("veh-1778144236925"), "veh-1778144236925");
  });

  test("lo que no es nada sigue sin ser nada", () => {
    assert.equal(elCocheDeLaOferta(""), "");
    assert.equal(elCocheDeLaOferta(null), "");
    assert.equal(elCocheDeLaOferta(undefined), "");
  });

  test("y no se recorta lo que solo se parece", () => {
    /*
     * Un identificador que empiece por «users» o por «idcares» no lleva
     * prefijo: recortarlo dejaría un coche que no existe, y el informe volvería
     * a no aparecer sin que nadie supiera por qué.
     */
    assert.equal(elCocheDeLaOferta("usuario-1"), "usuario-1");
    assert.equal(elCocheDeLaOferta("idcarro-1"), "idcarro-1");
  });
});
