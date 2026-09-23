/**
 * El motor que dice la ficha técnica, para ordenarle las versiones.
 *
 * La versión decide con qué coches se compara el suyo al tasarlo, y la elige de
 * una lista de cuarenta, de memoria. De su ficha —que el ERP ya ha leído— salen
 * los dos números que nadie se inventa: cilindrada y kilovatios.
 *
 * Lo que más se protege aquí es que **esto no pueda romper nada**. Es una ayuda
 * para ordenar una lista: si falla, la lista sale como salía. Quedarse sin poder
 * editar el coche por una consulta de apoyo sería mucho peor que el problema
 * que arregla.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./el-motor-de-la-ficha");

/** Los códigos del papel del T-Roc: 1.498 cc y 110 kW. */
const DEL_TROC = { "D.1": "Volkswagen", "D.3": "T-ROC", "P.1": "1498", "P.2": "110" };

describe("lo que se saca del papel", () => {
  test("la cilindrada y los kilovatios", () => {
    assert.deepEqual(M.elMotorQueDice(DEL_TROC), { cc: 1498, kw: 110 });
  });

  test("y lo que el papel no diga se queda a nulo", () => {
    assert.deepEqual(M.elMotorQueDice({ "P.1": "999" }), { cc: 999, kw: null });
    assert.deepEqual(M.elMotorQueDice({}), { cc: null, kw: null });
    assert.deepEqual(M.elMotorQueDice(null), { cc: null, kw: null });
  });

  test("un cero no es «no lo dice»: se descarta igual", () => {
    /*
     * Un motor de cero centímetros cúbicos no existe. Dejándolo pasar, no
     * encajaría ninguna versión y la lista saldría entera en «las demás».
     */
    assert.deepEqual(M.elMotorQueDice({ "P.1": "0", "P.2": "0" }), { cc: null, kw: null });
  });

  test("y se entiende con la unidad pegada o con coma", () => {
    assert.deepEqual(M.elMotorQueDice({ "P.1": "1.498 cm3", "P.2": "110 kW" }), { cc: 1498, kw: 110 });
  });
});

describe("lo que se mira en la base", () => {
  const conFicha = { query: async () => ({ rows: [{ codigos: DEL_TROC }] }) };
  const sinFicha = { query: async () => ({ rows: [] }) };

  test("el motor de su ficha leída", async () => {
    assert.deepEqual(await M.elMotorDeLaFicha(conFicha, "veh-1"), { cc: 1498, kw: 110 });
  });

  test("sin ficha leída, motor vacío y la lista sale como salía", async () => {
    assert.deepEqual(await M.elMotorDeLaFicha(sinFicha, "veh-1"), { cc: null, kw: null });
  });

  test("sin coche no se pregunta nada", async () => {
    assert.deepEqual(await M.elMotorDeLaFicha(conFicha, ""), { cc: null, kw: null });
    assert.deepEqual(await M.elMotorDeLaFicha(conFicha, null), { cc: null, kw: null });
  });

  test("y si la consulta revienta, tampoco pasa nada", async () => {
    /*
     * Esto es una ayuda para ordenar una lista. Que la tabla no exista o no
     * responda no puede dejar al cliente sin poder editar su coche.
     */
    const rota = { query: async () => { throw new Error("no responde"); } };
    assert.deepEqual(await M.elMotorDeLaFicha(rota, "veh-1"), { cc: null, kw: null });
    assert.deepEqual(await M.elMotorDeLaFicha(null, "veh-1"), { cc: null, kw: null });
  });

  test("solo se mira una lectura que fue bien", () => {
    // Una que fallo no trae codigos: ordenar con ella seria ordenar con nada.
    assert.match(M.SQL_EL_MOTOR, /COALESCE\(fallo, ''\) = ''/);
  });
});
