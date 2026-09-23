/**
 * Sin ficha técnica no se tasa su coche.
 *
 * Una tasación compara su coche con los que son como él, y la versión es lo que
 * dice cuáles son: una gama tiene tres «1.5» que no valen lo mismo. Esa versión
 * la elige el cliente de una lista y de memoria; si elige la que no es, el
 * número no sale mal por poco — sale comparado con **otros coches**, y de ahí
 * sale luego el precio de salida.
 *
 * Se recorre el manejador de verdad. En la pantalla el botón ya sale apagado, y
 * lo que se protege aquí es lo otro: que un botón apagado no es un bloqueo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const ANTES = require("../antes-de-tasar");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

let tieneFicha;
let guardadas;
let revientaLaConsulta;

const queryOriginal = Pool.prototype.query;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "").replace(/\s+/g, " ");
    const r = (rows) => ({ rows, rowCount: rows.length });

    if (/FROM moveadvisor_user_vehicle_documents/.test(t) && /document_type = \$2/.test(t)) {
      if (revientaLaConsulta) throw new Error("la tabla no responde");
      return r(tieneFicha && p[1] === "technical_sheet" ? [{ "?column?": 1 }] : []);
    }
    // El coche es suyo, y la tasación se guarda.
    if (/FROM moveadvisor_user_vehicles WHERE id = \$1/.test(t)) return r([{ id: p[0], title: "Volkswagen T-Roc" }]);
    if (/INSERT INTO moveadvisor_user_valuations/.test(t)) { guardadas.push(p[3]); return r([]); }
    if (/FROM moveadvisor_user_valuations/.test(t)) return r([]);
    if (/FROM moveadvisor_users/.test(t)) return r([{ id: 1, email: "ana@example.com" }]);
    return r([]);
  };
});

after(() => { Pool.prototype.query = queryOriginal; });

beforeEach(() => {
  tieneFicha = false;
  guardadas = [];
  revientaLaConsulta = false;
});

describe("la regla, suelta", () => {
  const conFicha = { query: async () => ({ rows: [{ 1: 1 }] }) };
  const sinFicha = { query: async () => ({ rows: [] }) };

  test("con la ficha subida se puede tasar", async () => {
    assert.equal(await ANTES.porQueNoSePuedeTasar(conFicha, "veh-1"), "");
  });

  test("sin ella no, y se dice para qué hace falta", async () => {
    const falta = await ANTES.porQueNoSePuedeTasar(sinFicha, "veh-1");
    assert.match(falta, /ficha técnica/);
    assert.match(falta, /versión real/);
  });

  test("la tasación suelta de la web no pasa por aquí", async () => {
    /*
     * Quien todavía no tiene el coche dado de alta no tiene IDCar, ni ficha, ni
     * nada que comprobar. Bloquearle sería cerrar la puerta de entrada.
     */
    assert.equal(await ANTES.porQueNoSePuedeTasar(sinFicha, ""), "");
    assert.equal(await ANTES.porQueNoSePuedeTasar(sinFicha, null), "");
  });

  test("y si la base no responde, deja pasar", async () => {
    /*
     * Una tabla caída no puede dejar sin tasar a todo el mundo. El daño de una
     * tasación con la versión sin comprobar es mucho menor que el de tirar la
     * funcionalidad entera.
     */
    const rota = { query: async () => { throw new Error("no responde"); } };
    assert.equal(await ANTES.porQueNoSePuedeTasar(rota, "veh-1"), "");
  });

  test("se busca el papel por el nombre con el que se guarda", () => {
    assert.equal(ANTES.LA_FICHA, "technical_sheet");
    // Vale tanto la que está en el almacén como la que quedó guardada en base.
    assert.match(ANTES.SQL_TIENE_FICHA, /file_url/);
    assert.match(ANTES.SQL_TIENE_FICHA, /file_content_base64/);
  });
});

const handler = require("./billing-account-handler.js");

async function pideTasar(valuation) {
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({
    method: "POST",
    headers: {},
    query: {},
    body: { action: "valuation_add", email: "ana@example.com", valuation },
  }, res);
  return salida;
}

describe("y el manejador no la guarda", () => {
  test("sin la ficha contesta que falta, y no apunta nada", async () => {
    tieneFicha = false;
    const r = await pideTasar({ vehicleId: "veh-1", title: "Volkswagen T-Roc" });
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.error, "falta_la_ficha_tecnica");
    assert.match(r.cuerpo.message, /ficha técnica/);
    assert.equal(guardadas.length, 0, "se ha guardado una tasación sin ficha técnica");
  });

  test("con la ficha subida, sigue su camino", async () => {
    tieneFicha = true;
    const r = await pideTasar({ vehicleId: "veh-1", title: "Volkswagen T-Roc" });
    assert.notEqual(r.codigo, 409);
  });
});
