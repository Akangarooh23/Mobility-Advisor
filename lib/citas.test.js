/**
 * Las dos copias de la misma lista.
 *
 * `lib/citas.js` lo usa el servidor y `src/utils/citas.js` el navegador. Son la
 * misma forma escrita dos veces porque Create React App no deja importar nada de
 * fuera de `src/`.
 *
 * El navegador decide si una cita está pendiente comparando el texto del estado
 * —`item.status === ESTADO.pending`—, así que si las dos listas dejan de decir
 * lo mismo, una visita pendiente pasa por confirmada: le suena la campana al
 * cliente y le prometemos una cita que nadie ha aprobado. Es la clase de fallo
 * que no da error en ninguna parte, así que se comprueba aquí.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ESTADO, PASO } = require("./citas.js");

/** Lee un mapa `clave: "valor"` del módulo del navegador. */
function delNavegador(nombre) {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "utils", "citas.js"), "utf8");
  // Sin plantilla de texto: dentro de una, `\s` se queda en `s` y la expresión
  // deja de buscar lo que parece que busca.
  const bloque = src.match(new RegExp('export const ' + nombre + ' = \\{([\\s\\S]*?)\\n\\};'));
  if (!bloque) return null;
  const mapa = {};
  for (const linea of bloque[1].split("\n")) {
    const m = linea.match(/(\w+):\s*"(.*)",?\s*$/);
    if (m) mapa[m[1]] = m[2];
  }
  return mapa;
}

describe("el servidor y el navegador cuentan lo mismo", () => {
  test("los estados de una cita dicen exactamente lo mismo", () => {
    assert.deepEqual(delNavegador("ESTADO"), ESTADO);
  });

  test("una pendiente se llama pendiente de aprobación", () => {
    assert.equal(ESTADO.pending, "Pendiente de aprobación");
    assert.notEqual(ESTADO.pending, ESTADO.confirmed);
  });

  test("los pasos del rastro son texto para leer, no nombres de la base", () => {
    for (const [clave, texto] of Object.entries(PASO)) {
      assert.ok(texto && texto !== clave, `el paso ${clave} no está traducido`);
      assert.ok(!texto.includes("_"), `el paso ${clave} enseña el nombre de la base`);
    }
  });
});
