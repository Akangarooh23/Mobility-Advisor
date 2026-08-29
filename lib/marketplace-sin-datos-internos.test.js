/**
 * Lo que es del equipo no sale al marketplace.
 *
 * La oferta guarda ahora el teléfono de quien vende y la persona por la que
 * preguntar. Eso es para llevar una visita desde el ERP: al cliente no se le
 * enseña, ni se le manda al navegador para que lo mire quien sepa abrir la
 * consola.
 *
 * Hoy no sale porque las consultas del marketplace listan sus columnas una por
 * una. Eso se puede romper sin querer con un `SELECT *` o añadiendo la columna a
 * la lista, y no daría error en ninguna parte: el dato saldría y ya. Por eso se
 * comprueba aquí, sobre el fichero que hace las consultas.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FUENTE = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");

/** Los trozos de SQL que sirven al marketplace público. */
function consultasPublicas() {
  // Cada plantilla de consulta que toca la tabla de ofertas.
  return FUENTE.split("`")
    .filter((t) => /FROM moveadvisor_marketplace_vo_offers/i.test(t) && /SELECT/i.test(t));
}

const INTERNOS = ["seller_phone", "seller_contact"];

describe("el marketplace no sirve datos de uso interno", () => {
  test("hay consultas que mirar", () => {
    assert.ok(consultasPublicas().length >= 1, "si no, esta prueba no está comprobando nada");
  });

  test("ninguna pide el teléfono ni la persona de contacto", () => {
    for (const sql of consultasPublicas()) {
      for (const campo of INTERNOS) {
        assert.ok(!new RegExp(`\\b${campo}\\b`).test(sql), `una consulta del marketplace pide ${campo}`);
      }
    }
  });

  test("ninguna trae la fila entera con SELECT *", () => {
    for (const sql of consultasPublicas()) {
      assert.ok(
        !/SELECT\s+\*\s+FROM\s+moveadvisor_marketplace_vo_offers/i.test(sql),
        "con SELECT * entra cualquier columna nueva sin que nadie lo decida"
      );
    }
  });

  test("y lo que se envía tampoco los nombra", () => {
    const mapa = FUENTE.slice(FUENTE.indexOf("function mapMarketplaceVoRow"));
    const hasta = mapa.slice(0, mapa.indexOf("\n}"));
    for (const campo of INTERNOS) {
      assert.ok(!hasta.includes(campo), `la oferta que se manda al navegador lleva ${campo}`);
    }
  });
});
