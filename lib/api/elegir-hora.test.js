/**
 * El cliente elige una de las horas que le propusimos, desde el correo.
 *
 * Es el camino que cierra una cita sin que nadie teclee nada: el concesionario
 * da otras horas, se le mandan pinchables, y la que elige queda confirmada.
 *
 * Lo que se comprueba aquí es lo que puede salir caro: que solo valgan las horas
 * que de verdad se le propusieron —si no, el enlace sería una forma de ponerse
 * la hora que uno quiera—, que quede confirmada de verdad y con calendario, y
 * que el equipo se entere, porque al concesionario hay que llamarle a mano.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const PROPUESTAS = ["2026-09-16T10:00:00.000Z", "2026-09-17T16:00:00.000Z"];

const RESERVA = {
  id: "b-1",
  offer_id: "erp-9",
  vehicle_title: "Toyota C-HR",
  starts_at: "2026-09-15T09:00:00.000Z",
  ends_at: "2026-09-15T10:00:00.000Z",
  buyer_email: "cliente@example.com",
  buyer_name: "Juan",
  buyer_phone: "600000000",
  availability_id: "s-viejo",
  token_buyer: "t-buena",
  status: "pending",
  meeting_place: null,
  meeting_contact: null,
};

let estado = "pending";
let hayPropuesta = true;
let correos = [];
let guardado = null;
let pasos = [];

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM vehicle_visit_bookings/i.test(t) && /SELECT/i.test(t)) {
      return responde([{ ...RESERVA, status: estado }]);
    }
    if (/FROM visit_booking_events/i.test(t)) {
      return responde(hayPropuesta ? [{ datos: { horas: PROPUESTAS } }] : []);
    }
    if (/SELECT id FROM vehicle_visit_availability/i.test(t)) return responde([]);
    if (/INSERT INTO vehicle_visit_availability/i.test(t)) return responde([{ id: "s-nuevo" }]);
    if (/INSERT INTO visit_booking_events/i.test(t)) {
      // El paso y el actor van escritos en la propia consulta, no como
      // parámetros: se leen de ahí.
      const m = t.match(/VALUES\s*\(\$1,'([a-z_]+)','([a-z_]+)'/i);
      pasos.push({ evento: m && m[1], actor: m && m[2], datos: JSON.parse(params[1]) });
      return responde([]);
    }
    if (/UPDATE vehicle_visit_bookings/i.test(t)) {
      guardado = { availability_id: params[0], starts_at: params[1], ends_at: params[2] };
      return responde([{ ...RESERVA, status: "confirmed", availability_id: params[0], starts_at: params[1], ends_at: params[2] }]);
    }
    return responde([]);
  };
  Pool.prototype.connect = async function () {
    const q = Pool.prototype.query.bind(this);
    return { query: q, release() {} };
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) correos.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => {
  estado = "pending";
  hayPropuesta = true;
  correos = [];
  guardado = null;
  pasos = [];
});

const handler = require("./visit-availability-handler.js");

/** Llama al handler y devuelve el código y el cuerpo con los que contestó. */
async function elige(startsAt, token = "t-buena") {
  const req = {
    method: "POST",
    headers: {},
    query: { route: "elegir_hora" },
    body: { route: "elegir_hora", bookingId: RESERVA.id, token, startsAt },
  };
  let codigo = 200;
  let cuerpo = null;
  const res = {
    status(c) { codigo = c; return res; },
    json(b) { cuerpo = b; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  await handler(req, res);
  await new Promise((r) => setImmediate(r));
  return { codigo, cuerpo };
}

describe("elegir una de las horas propuestas", () => {
  test("la visita queda confirmada a esa hora", async () => {
    const { codigo, cuerpo } = await elige(PROPUESTAS[1]);
    assert.equal(codigo, 200);
    assert.equal(cuerpo.ok, true);
    assert.equal(cuerpo.booking.status, "confirmed");
    assert.equal(guardado.starts_at, PROPUESTAS[1]);
  });

  test("el rastro cuenta que contestó él y que por eso queda confirmada", async () => {
    await elige(PROPUESTAS[0]);
    const nombres = pasos.map((p) => p.evento);
    assert.ok(nombres.includes("cliente_respondio"), "sin este paso, mañana nadie sabe por qué se movió");
    assert.ok(nombres.includes("confirmada"));
    assert.ok(pasos.every((p) => p.actor === "cliente"), "lo ha hecho él, no un trabajador");
  });

  test("le llega su confirmación con el calendario", async () => {
    await elige(PROPUESTAS[0]);
    const suyo = correos.find((c) => String(c.to).includes("cliente@example.com"));
    assert.ok(suyo, "sin correo, ha pinchado y no tiene nada");
    assert.ok(/confirmada/i.test(suyo.subject));
    assert.ok(suyo.attachments && suyo.attachments.length, "el calendario va cuando la cita es cierta, y ahora lo es");
  });

  test("el equipo se entera, porque al concesionario hay que llamarle a mano", async () => {
    await elige(PROPUESTAS[0]);
    const interno = correos.find((c) => !String(c.to).includes("cliente@example.com"));
    assert.ok(interno, "si el equipo no se entera, el concesionario no sabe que va nadie");
  });
});

describe("lo que no se deja hacer", () => {
  test("una hora que no se le propuso", async () => {
    const { codigo } = await elige("2026-09-20T08:00:00.000Z");
    assert.equal(codigo, 409, "el enlace no puede servir para ponerse la hora que uno quiera");
    assert.equal(guardado, null);
  });

  test("una hora que no se entiende", async () => {
    const { codigo } = await elige("el jueves por la tarde");
    assert.equal(codigo, 400);
    assert.equal(guardado, null);
  });

  test("si ya la ha confirmado un trabajador, no se pisa", async () => {
    estado = "confirmed";
    const { codigo } = await elige(PROPUESTAS[0]);
    assert.equal(codigo, 409);
    assert.equal(guardado, null, "esa hora ya se acordó por teléfono; moverla sería deshacerlo");
  });

  test("sin propuesta ninguna no vale nada", async () => {
    hayPropuesta = false;
    const { codigo } = await elige(PROPUESTAS[0]);
    assert.equal(codigo, 409);
    assert.equal(guardado, null);
  });
});
