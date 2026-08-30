/**
 * Las notas del equipo no llegan al cliente.
 *
 * `erp_notes` es el cuaderno del expediente: «no contesta desde el martes», «se
 * lo piensa», «ojo, ya se echó atrás una vez». Desde que cambiar de etapa pide
 * escribir qué ha pasado, ese campo se llena solo, y con lo que uno escribe
 * cuando sabe que no lo lee el cliente.
 *
 * Al lado vive `erp_response`, que es justo lo contrario: el mensaje que **sí**
 * se le manda. Dos columnas parecidas, una al lado de la otra, y una de ellas no
 * puede salir nunca. Hoy no sale porque la consulta del panel lista sus columnas
 * una a una; eso se rompe con un `SELECT *` o añadiendo una línea, y no daría
 * error en ninguna parte: el dato saldría y ya.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs.readFileSync(path.join(__dirname, "billingStore.js"), "utf8");

/** Los trozos de SQL que sacan las solicitudes de alguien para su panel. */
function consultasDelPanel() {
  return FUENTE.split("`")
    .filter((t) => /FROM moveadvisor_market_leads/i.test(t) && /SELECT/i.test(t));
}

describe("el panel del cliente no sirve las notas del equipo", () => {
  test("hay consultas que mirar", () => {
    assert.ok(consultasDelPanel().length > 0,
      "si esto llega a cero, la prueba dejó de mirar nada y no se notaría");
  });

  test("ninguna pide erp_notes", () => {
    for (const sql of consultasDelPanel()) {
      assert.ok(!/\berp_notes\b/.test(sql),
        "una consulta del panel pide las notas internas del expediente");
    }
  });

  test("ninguna trae la fila entera con SELECT *", () => {
    for (const sql of consultasDelPanel()) {
      assert.ok(!/SELECT\s+\*\s+FROM\s+moveadvisor_market_leads/i.test(sql),
        "con la fila entera salen también las notas del equipo");
    }
  });

  test("y sí pide erp_response, que es el mensaje que se le escribe a él", () => {
    const alguna = consultasDelPanel().some((sql) => /\berp_response\b/.test(sql));
    assert.ok(alguna,
      "son dos columnas parecidas: si esta se cayera, el cliente dejaría de ver lo que le escribimos");
  });
});
