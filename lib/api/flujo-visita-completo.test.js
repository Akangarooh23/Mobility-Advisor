/**
 * El flujo entero de una visita, de punta a punta, en el lado del cliente.
 *
 * Aquí va lo que hace él: pedir la visita, elegir una de las horas que le
 * proponemos, cambiarse la hora y cancelar. Lo del ERP —confirmar, proponer,
 * aplicar— tiene su propia prueba allí.
 *
 * Se recorre dos veces, una por sección del marketplace: **concesionario** y
 * **ex-renting**. Es el mismo código, y por eso hay que recorrerlo con los dos:
 * lo que cambia es el identificador de la oferta y quién vende —un nombre de
 * empresa, no una dirección—, y de ahí salen los fallos.
 *
 * Se llama al manejador de verdad. Lo simulado es solo la base y el envío de
 * correo: ni se escribe en Postgres ni sale ningún correo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
// Sin sesión montada, para poder recorrer el camino con el correo en la
// petición. Que en producción haga falta sesión tiene su propia prueba.
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const SECCIONES = [
  { nombre: "concesionario", oferta: "erp-9", vende: "Modrive" },
  { nombre: "ex-renting", oferta: "astara-1c4pjdcwxpp039070", vende: "Astara" },
];

const CLIENTE = "cliente@example.com";
const HUECO_PEDIDO = { id: "s-1", starts_at: "2026-09-15T08:00:00.000Z", ends_at: "2026-09-15T09:00:00.000Z" };
const HUECO_OTRO = { id: "s-2", starts_at: "2026-09-20T08:00:00.000Z", ends_at: "2026-09-20T09:00:00.000Z" };
const PROPUESTAS = ["2026-09-17T08:00:00.000Z", "2026-09-18T14:00:00.000Z"];

let seccion = SECCIONES[0];
let reserva = null;
let pasos = [];
let correos = [];
let hayPropuesta = false;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

function reinicia() {
  reserva = {
    id: "3f1a6f5e-9c2b-4d7a-8e10-5b6c7d8e9f01",
    offer_id: seccion.oferta,
    vehicle_title: "Toyota C-HR",
    starts_at: HUECO_PEDIDO.starts_at,
    ends_at: HUECO_PEDIDO.ends_at,
    buyer_email: CLIENTE,
    buyer_name: "Juan",
    buyer_phone: "600000000",
    seller_email: null,
    status: "pending",
    availability_id: HUECO_PEDIDO.id,
    token_buyer: "t-buena",
    token_seller: "t-vendedor",
    notes: "",
    source: "marketplace",
    meeting_place: "",
    meeting_contact: "",
  };
  pasos = [];
  correos = [];
  hayPropuesta = false;
}

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const p = params || [];
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };

    if (/INSERT INTO visit_booking_events/i.test(t)) {
      const m = t.match(/VALUES\s*\(\$1,'([a-z_]+)','([a-z_]+)'/i);
      pasos.push({ evento: m ? m[1] : "?", actor: m ? m[2] : "?", datos: JSON.parse(String(p[1] || "{}")) });
      return responde([]);
    }
    if (/FROM visit_booking_events/i.test(t)) {
      return responde(hayPropuesta ? [{ datos: { horas: PROPUESTAS } }] : []);
    }
    // ¿Esa hora la tiene otro? Nunca, en esta historia.
    if (/SELECT id FROM vehicle_visit_bookings/i.test(t) && /id != /i.test(t)) return responde([]);

    if (/FROM vehicle_visit_availability/i.test(t) && /FOR UPDATE/i.test(t)) {
      const cual = String(p[0]) === HUECO_OTRO.id ? HUECO_OTRO : HUECO_PEDIDO;
      return responde([{ ...cual, offer_id: seccion.oferta, status: "available", source: "auto" }]);
    }
    if (/SELECT seller FROM/i.test(t)) return responde([{ seller: seccion.vende }]);
    if (/SELECT id FROM vehicle_visit_availability/i.test(t)) return responde([]);
    if (/INSERT INTO vehicle_visit_availability/i.test(t)) return responde([{ id: "s-nueva" }]);

    if (/INSERT INTO vehicle_visit_bookings/i.test(t)) {
      reserva.status = p[13];
      reserva.seller_email = p[8] || null;
      return responde([{ ...reserva }]);
    }
    if (/FROM vehicle_visit_bookings/i.test(t) && /SELECT/i.test(t)) {
      // El testigo se comprueba aquí igual que lo comprueba la base: si no, una
      // prueba pasaría con la consulta pidiendo un testigo que no es el suyo.
      if (/token_buyer = /.test(t) && String(p[1]) !== reserva.token_buyer && String(p[1]) !== reserva.token_seller) return responde([]);
      if (/status = 'confirmed'/i.test(t) && reserva.status !== "confirmed") return responde([]);
      if (/status != 'cancelled'/i.test(t) && reserva.status === "cancelled") return responde([]);
      return responde([{ ...reserva }]);
    }
    if (/UPDATE vehicle_visit_bookings/i.test(t)) {
      if (/status = 'confirmed'/i.test(t)) reserva.status = "confirmed";
      if (/status = 'cancelled'/i.test(t)) reserva.status = "cancelled";
      if (/status = 'pending'/i.test(t)) reserva.status = "pending";
      if (/starts_at = \$2/.test(t)) { reserva.starts_at = p[1]; reserva.ends_at = p[2]; }
      if (/starts_at = \$3/.test(t)) { reserva.starts_at = p[2]; reserva.ends_at = p[3]; }
      return responde([{ ...reserva }]);
    }
    return responde([]);
  };
  Pool.prototype.connect = async function () {
    const q = Pool.prototype.query.bind(this);
    return { query: q, release() {} };
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      const c = JSON.parse(opciones.body);
      correos.push({
        to: String(c.to),
        subject: String(c.subject),
        conCalendario: Array.isArray(c.attachments) && c.attachments.length > 0,
      });
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => reinicia());

const handler = require("./visit-availability-handler.js");

/** Una llamada al manejador, como la hace la pantalla del cliente. */
async function llama(metodo, route, datos = {}) {
  const req = {
    method: metodo,
    headers: {},
    query: metodo === "GET" ? { route, ...datos } : { route },
    body: metodo === "GET" ? {} : { route, ...datos },
  };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; }, redirect() { return res; },
  };
  await handler(req, res);
  await new Promise((r) => setImmediate(r));
  return salida;
}

const nombres = () => pasos.map((x) => x.evento);
const alCliente = () => correos.filter((c) => c.to.includes(CLIENTE));

for (const s of SECCIONES) {
  describe(`lo que hace el cliente, de principio a fin — ${s.nombre}`, () => {
    before(() => { seccion = s; });

    test("1 · pide la visita y queda pendiente, sin calendario", async () => {
      const r = await llama("POST", "book", {
        slotId: HUECO_PEDIDO.id, offerId: s.oferta, vehicleTitle: "Toyota C-HR",
        buyerEmail: CLIENTE, buyerName: "Juan", source: "marketplace",
      });
      assert.equal(r.codigo, 200);
      assert.equal(reserva.status, "pending", "toda visita se aprueba");
      const suyo = alCliente()[0];
      assert.ok(suyo, "algo tiene que recibir");
      assert.ok(/solicitud/i.test(suyo.subject));
      assert.ok(!suyo.conCalendario, "el calendario sale al confirmar, no al pedir");
      assert.ok(!reserva.seller_email, `«${s.vende}» no es una dirección: no se le escribe`);
    });

    test("2 · ve las horas que le proponemos", async () => {
      hayPropuesta = true;
      const r = await llama("GET", "propuesta", { bookingId: reserva.id, token: "t-buena" });
      assert.equal(r.codigo, 200);
      assert.deepEqual(r.cuerpo.horas, PROPUESTAS);
    });

    test("3 · elige una y su visita queda confirmada, ahora sí con calendario", async () => {
      hayPropuesta = true;
      const r = await llama("POST", "elegir_hora", {
        bookingId: reserva.id, token: "t-buena", startsAt: PROPUESTAS[1],
      });
      assert.equal(r.codigo, 200);
      assert.equal(reserva.status, "confirmed");
      assert.ok(nombres().includes("cliente_respondio"));
      assert.ok(nombres().includes("confirmada"));
      const suyo = alCliente()[0];
      assert.ok(/confirmada/i.test(suyo.subject));
      assert.ok(suyo.conCalendario);
      const interno = correos.find((c) => !c.to.includes(CLIENTE));
      assert.ok(interno, "y el equipo se entera, que a quien vende hay que llamarle a mano");
    });

    test("4 · no puede colar una hora que no se le propuso", async () => {
      hayPropuesta = true;
      const r = await llama("POST", "elegir_hora", {
        bookingId: reserva.id, token: "t-buena", startsAt: "2026-09-25T08:00:00.000Z",
      });
      assert.equal(r.codigo, 409);
      assert.equal(reserva.status, "pending", "no se ha tocado");
    });

    test("5 · ni con un testigo que no es el suyo", async () => {
      hayPropuesta = true;
      const r = await llama("POST", "elegir_hora", {
        bookingId: reserva.id, token: "t-de-otro", startsAt: PROPUESTAS[0],
      });
      assert.ok(r.codigo === 404 || r.codigo === 409, `esperaba que no entrara y contestó ${r.codigo}`);
    });

    test("6 · si se cambia la hora él, vuelve a quedar pendiente", async () => {
      reserva.status = "confirmed";
      const r = await llama("POST", "reschedule", {
        bookingId: reserva.id, token: "t-buena", newSlotId: HUECO_OTRO.id,
      });
      assert.equal(r.codigo, 200);
      assert.equal(reserva.status, "pending", "la hora nueva tampoco la ha acordado nadie");
      assert.ok(nombres().includes("movida"));
      const suyo = alCliente()[0];
      assert.ok(!suyo.conCalendario, "no se le promete una cita que falta por confirmar");
    });

    test("7 · y si cancela, queda dicho quién fue", async () => {
      const r = await llama("POST", "cancel", { bookingId: reserva.id, token: "t-buena" });
      assert.equal(r.codigo, 200);
      assert.equal(reserva.status, "cancelled");
      const cancelada = pasos.find((x) => x.evento === "cancelada");
      assert.ok(cancelada, "sin rastro, desaparece de la Agenda y nadie sabe por qué");
      assert.equal(cancelada.actor, "cliente");
      assert.ok(alCliente().some((c) => /cancelada/i.test(c.subject)));
    });
  });
}
