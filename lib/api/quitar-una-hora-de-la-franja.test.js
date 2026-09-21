/**
 * Quitar una hora de una franja, sin llevarse las visitas que tiene dentro.
 *
 * Desde que una franja de 10:00 a 14:00 se ofrece hora a hora, la papelera de
 * la pantalla manda `<franja>@<hora>`, y eso llegaba a un `DELETE ... WHERE id`
 * contra una columna UUID: 500, y la fila seguia ahi al recargar. Y arreglarlo
 * a lo bruto —borrar la franja— seria peor: las visitas apuntan a su fila con
 * `ON DELETE CASCADE`, asi que se borrarian citas confirmadas sin avisar.
 *
 * Se recorre el manejador de verdad con una base simulada que guarda las
 * franjas, para ver las tres cosas: que se quita, que queda y que se ofrece.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const OFERTA = "idcar-veh-1";
const DIA = new Date(Date.now() + 3 * 86400000);
DIA.setUTCHours(8, 0, 0, 0);
const hora = (n) => new Date(DIA.getTime() + n * 3600000).toISOString();

let franjas;
let reservas;
let nuevas;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "");
    const r = (rows) => ({ rows, rowCount: rows.length });

    if (/SELECT \* FROM vehicle_visit_availability/.test(t)) {
      const f = franjas.find((x) => x.id === p[0] && x.offer_id === p[1] && x.status === "available");
      return r(f ? [{ ...f }] : []);
    }
    if (/SELECT id, offer_id, starts_at, ends_at, status, source/.test(t)) {
      return r(franjas.filter((x) => x.status === "available").map((x) => ({ ...x })));
    }
    if (/DELETE FROM vehicle_visit_availability/.test(t)) {
      const antes = franjas.length;
      franjas = franjas.filter((x) => x.id !== p[0]);
      return { rows: [], rowCount: antes - franjas.length };
    }
    if (/UPDATE vehicle_visit_availability SET starts_at/.test(t)) {
      const f = franjas.find((x) => x.id === p[0]);
      if (f) { f.starts_at = p[1]; f.ends_at = p[2]; }
      return r([]);
    }
    if (/INSERT INTO vehicle_visit_availability/.test(t)) {
      const f = { id: `f-${franjas.length + 1}`, offer_id: p[0], starts_at: p[1], ends_at: p[2], status: "available", source: p[3] };
      franjas.push(f);
      nuevas.push(f);
      return r([f]);
    }
    if (/FROM vehicle_visit_bookings/.test(t) && /status IN \('pending','confirmed'\)/.test(t)) {
      return r(reservas.filter((x) => ["pending", "confirmed"].includes(x.status)));
    }
    return r([]);
  };
  Pool.prototype.connect = async function () { return { query: Pool.prototype.query.bind(this), release() {} }; };
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => {
  franjas = [{ id: "f-1", offer_id: OFERTA, starts_at: hora(0), ends_at: hora(4), status: "available", source: "marketplace" }];
  reservas = [];
  nuevas = [];
});

const handler = require("./visit-availability-handler.js");

async function quita(slotId) {
  const req = { method: "DELETE", headers: {}, query: { route: "delete_slot", slotId, offerId: OFERTA }, body: {} };
  const salida = { codigo: 200, cuerpo: null };
  const res = { status(c) { salida.codigo = c; return res; }, json(b) { salida.cuerpo = b; return res; }, setHeader() { return res; } };
  await handler(req, res);
  return salida;
}

async function ofrecidas() {
  const req = { method: "GET", headers: {}, query: { offerId: OFERTA }, body: {} };
  const salida = { cuerpo: null };
  const res = { status() { return res; }, json(b) { salida.cuerpo = b; return res; }, setHeader() { return res; } };
  await handler(req, res);
  return salida.cuerpo.slots.map((h) => h.starts_at);
}

const ratos = () => franjas.map((f) => [f.starts_at, f.ends_at]).sort();

describe("una franja de 10:00 a 14:00, abierta hora a hora", () => {
  test("quitar las 11:00 la deja en dos trozos, y esa hora ya no se ofrece", async () => {
    const r = await quita(`f-1@${hora(1)}`);
    assert.equal(r.codigo, 200);
    assert.deepEqual(ratos(), [[hora(0), hora(1)], [hora(2), hora(4)]].sort());
    assert.deepEqual(await ofrecidas(), [hora(0), hora(2), hora(3)]);
  });

  test("quitar la primera hora no parte nada: solo se recorta", async () => {
    const r = await quita(`f-1@${hora(0)}`);
    assert.equal(r.codigo, 200);
    assert.deepEqual(ratos(), [[hora(1), hora(4)]]);
    assert.equal(nuevas.length, 0, "no hace falta una franja nueva");
    assert.equal(franjas[0].id, "f-1", "sigue siendo la misma fila");
  });

  test("una hora que ya tiene visita no se quita, y se dice por qué", async () => {
    reservas.push({ starts_at: hora(1), ends_at: hora(2), status: "confirmed" });
    const r = await quita(`f-1@${hora(1)}`);
    assert.equal(r.codigo, 409);
    assert.match(r.cuerpo.error, /ya la tiene alguien/);
    assert.deepEqual(ratos(), [[hora(0), hora(4)]], "la franja se queda como estaba");
  });

  test("la fila se queda con el trozo donde está la visita", async () => {
    // Visita a las 13:00, y el vendedor quita las 11:00. Los trozos son
    // 10:00-11:00 y 12:00-14:00; la fila original —la que apunta la visita—
    // tiene que ser la segunda.
    reservas.push({ starts_at: hora(3), ends_at: hora(4), status: "confirmed" });
    assert.equal((await quita(`f-1@${hora(1)}`)).codigo, 200);
    const original = franjas.find((f) => f.id === "f-1");
    assert.deepEqual([original.starts_at, original.ends_at], [hora(2), hora(4)]);
    assert.deepEqual(nuevas.map((f) => [f.starts_at, f.ends_at]), [[hora(0), hora(1)]]);
  });
});

describe("un hueco de una hora, como los que crea la app", () => {
  beforeEach(() => {
    franjas = [{ id: "f-1", offer_id: OFERTA, starts_at: hora(0), ends_at: hora(1), status: "available", source: "marketplace" }];
  });

  test("libre, se borra como siempre", async () => {
    assert.equal((await quita("f-1")).codigo, 200);
    assert.deepEqual(franjas, []);
  });

  test("con una visita dentro, no: borrarlo se la llevaría en cascada", async () => {
    reservas.push({ starts_at: hora(0), ends_at: hora(1), status: "confirmed" });
    const r = await quita("f-1");
    assert.equal(r.codigo, 409);
    assert.match(r.cuerpo.error, /visitas dentro/);
    assert.equal(franjas.length, 1);
  });

  test("y tocar dos veces la papelera no es un error", async () => {
    await quita("f-1");
    assert.equal((await quita("f-1")).codigo, 200);
  });
});
