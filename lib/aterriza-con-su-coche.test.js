"use strict";

/**
 * Llegar a «Mis coches» con una matrícula, desde «lo que te falta».
 *
 * ## El fallo
 *
 * El enlace «Subir los documentos» de su encargo lleva a
 * `/mis-coches?matricula=8888LXR#documentos`. El aterrizaje encontraba el coche
 * y ponía `editingVehicleId`… **y no rellenaba el formulario**.
 *
 * Así que el editor se abría en blanco sobre un coche que ya existe: marca,
 * modelo y versión vacíos. Y como guardar exige marca y modelo, al darle a
 * «Guardar cambios» le decía «Debes introducir al menos la marca y el modelo» —
 * justo cuando venía a subir los papeles y no a tocar la ficha.
 *
 * Se ve en la consola del cliente: `editando: 'veh-…', marca: '', modelo: ''`.
 *
 * Esto se comprueba sobre el código porque la pantalla es un componente de
 * 2.000 líneas con catálogo, mapas y subidas: montarlo entero para mirar dos
 * `set` sería una prueba que se rompe cada vez que alguien toca un estilo.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs
  .readFileSync(path.join(__dirname, "..", "src", "pages", "ServiceIdCarsManagePage.js"), "utf8")
  .replace(/\r\n/g, "\n");

/** El trozo que decide qué hacer cuando la matrícula ya es de un coche suyo. */
const ATERRIZAJE = (() => {
  const i = FUENTE.indexOf("const suyo = (vehicles || []).find");
  assert.ok(i > 0, "no encuentro el aterrizaje por matrícula");
  return FUENTE.slice(i, i + 900);
})();

describe("si la matrícula ya es de un coche suyo", () => {
  test("se abre ese coche, no uno nuevo", () => {
    // Abrirle un formulario de crear para un coche que ya tiene le diría que
    // lo ha perdido, y acabaría con dos fichas del mismo.
    assert.match(ATERRIZAJE, /setEditingVehicleId\(suyo\.id\)/);
    assert.match(ATERRIZAJE, /setIsCreating\(false\)/);
  });

  test("y CON SUS DATOS DENTRO", () => {
    /*
     * Es el fallo entero. Sin esto el editor sale en blanco y guardar se
     * niega por falta de marca y modelo — sobre un coche que las tiene.
     */
    assert.match(ATERRIZAJE, /setForm\(vehicleToForm\(suyo\)\)/);
  });
});

describe("y si no es de ninguno", () => {
  test("entonces sí se crea, con la matrícula puesta", () => {
    /*
     * Se busca dentro del mismo efecto: `setIsCreating(true)` sale también en
     * el de la vista de crear, unas líneas más arriba, y ése rellena con
     * `laMatriculaDeLaUrl()` en vez de con `placa`.
     */
    const i = FUENTE.indexOf("const suyo = (vehicles || []).find");
    const crear = FUENTE.slice(i, i + 1600);
    assert.match(crear, /setForm\(createEmptyForm\(placa\)\)/);
  });
});

describe("lo que guarda exige", () => {
  test("marca y modelo, que es por lo que se notaba", () => {
    /*
     * No se toca esa regla: un IDCar sin marca ni modelo no sirve para nada.
     * Se deja escrita aquí para que se vea por qué el formulario en blanco
     * bloqueaba el guardado.
     */
    assert.match(FUENTE, /if \(!normalizeText\(form\.brand\) \|\| !normalizeText\(form\.model\)\)/);
  });
});
