/**
 * Pedir visita a las 10:00 en una franja de 10:00 a 14:00 reserva las 10:00.
 *
 * Se reservaba la franja entera: la cita quedaba «de 10:00 a 14:00» y nadie
 * más podía ir esa mañana. Se recorre el manejador de verdad, con una base
 * simulada que guarda las reservas, para ver las tres cosas juntas: qué se
 * ofrece, qué se guarda y qué queda libre.
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

let franja;
let reservas;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "");
    const r = (rows) => ({ rows, rowCount: rows.length });
    if (/FROM vehicle_visit_availability/.test(t) && /SELECT/.test(t)) {
      if (/WHERE id = \$1/.test(t)) return r(p[0] === franja.id && franja.status === "available" ? [{ ...franja }] : []);
      return r(franja.status === "available" ? [{ ...franja }] : []);
    }
    if (/UPDATE vehicle_visit_availability SET status = 'booked'/.test(t)) { franja.status = "booked"; return r([]); }
    if (/FROM vehicle_visit_bookings/.test(t) && /status IN \('pending','confirmed'\)/.test(t)) {
      return r(reservas.filter((x) => ["pending", "confirmed"].includes(x.status)));
    }
    if (/SELECT seller FROM/.test(t)) return r([{ seller: "vendedor@example.com" }]);
    if (/INSERT INTO vehicle_visit_bookings/.test(t)) {
      const nueva = { id: `b-${reservas.length + 1}`, availability_id: p[0], offer_id: p[1], starts_at: p[3], ends_at: p[4], buyer_email: p[5], seller_email: p[8], status: p[13], token_buyer: p[9], token_seller: p[10] };
      reservas.push(nueva);
      return r([nueva]);
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
  franja = { id: "f-1", offer_id: OFERTA, starts_at: hora(0), ends_at: hora(4), status: "available", source: "marketplace" };
  reservas = [];
});

const handler = require("./visit-availability-handler.js");

async function llama(metodo, datos) {
  const req = { method: metodo, headers: {}, query: metodo === "GET" ? datos : { route: datos.route }, body: metodo === "GET" ? {} : datos };
  const salida = { codigo: 200, cuerpo: null };
  const res = { status(c) { salida.codigo = c; return res; }, json(b) { salida.cuerpo = b; return res; }, setHeader() { return res; } };
  await handler(req, res);
  return salida;
}

const ofrecidas = async () => (await llama("GET", { offerId: OFERTA })).cuerpo.slots;

describe("una franja de 10:00 a 14:00", () => {
  test("se ofrece como cuatro horas", async () => {
    const huecos = await ofrecidas();
    assert.deepEqual(huecos.map((h) => h.starts_at), [hora(0), hora(1), hora(2), hora(3)]);
  });

  test("pedir las 10:00 guarda una visita de una hora, no la franja", async () => {
    const [diez] = await ofrecidas();
    const r = await llama("POST", { route: "book", slotId: diez.id, offerId: OFERTA, buyerEmail: "c@example.com", buyerName: "Sergio" });
    assert.equal(r.codigo, 200);
    assert.equal(reservas[0].starts_at, hora(0));
    assert.equal(reservas[0].ends_at, hora(1));
    assert.equal(reservas[0].availability_id, "f-1", "se guarda de qué franja sale");
  });

  test("y la franja sigue libre para las otras horas", async () => {
    const [diez] = await ofrecidas();
    await llama("POST", { route: "book", slotId: diez.id, offerId: OFERTA, buyerEmail: "c@example.com", buyerName: "Sergio" });
    assert.equal(franja.status, "available");
    assert.deepEqual((await ofrecidas()).map((h) => h.starts_at), [hora(1), hora(2), hora(3)]);
  });

  test("otra persona no puede coger la misma hora", async () => {
    const [diez] = await ofrecidas();
    await llama("POST", { route: "book", slotId: diez.id, offerId: OFERTA, buyerEmail: "c@example.com", buyerName: "Sergio" });
    const r = await llama("POST", { route: "book", slotId: diez.id, offerId: OFERTA, buyerEmail: "otra@example.com", buyerName: "Marta" });
    assert.equal(r.codigo, 409);
    assert.equal(reservas.length, 1);
  });

  test("pero sí la siguiente", async () => {
    const [diez, once] = await ofrecidas();
    await llama("POST", { route: "book", slotId: diez.id, offerId: OFERTA, buyerEmail: "c@example.com", buyerName: "Sergio" });
    const r = await llama("POST", { route: "book", slotId: once.id, offerId: OFERTA, buyerEmail: "otra@example.com", buyerName: "Marta" });
    assert.equal(r.codigo, 200);
    assert.equal(reservas[1].starts_at, hora(1));
  });
});

describe("un hueco de una hora, como los de concesionario", () => {
  test("se reserva entero, como siempre", async () => {
    franja = { ...franja, ends_at: hora(1) };
    const [unico] = await ofrecidas();
    assert.equal(unico.id, "f-1");
    await llama("POST", { route: "book", slotId: "f-1", offerId: OFERTA, buyerEmail: "c@example.com", buyerName: "Sergio" });
    assert.equal(franja.status, "booked");
  });
});
