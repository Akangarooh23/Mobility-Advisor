/**
 * Cuatro rutas que se creían de quien las llamaba.
 *
 * Las cuatro decidían de quién era la petición mirando lo que venía escrito en
 * ella. Eso no es autorizar: es preguntarle al que llama quién es y creérselo.
 *
 *   · `erp-appointment` no pedía nada y el dueño de la cita salía del cuerpo.
 *   · `PATCH /api/leads` se autorizaba con el `id` y el `email` del cuerpo.
 *   · Añadir y borrar franjas de visita no pedía nada, y el identificador de la
 *     oferta va en la dirección del anuncio.
 *   · `viewing-request` se queda abierta —es la puerta de entrada de un
 *     comprador sin cuenta— pero ya no deja pedir una visita a nombre de otro.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Los de mentira ──────────────────────────────────────────────────────────

const rutaAuth = require.resolve("../../api/auth");
let sesionQueDevuelve = null;
require.cache[rutaAuth] = {
  id: rutaAuth, filename: rutaAuth, loaded: true,
  exports: { getSessionUserFromRequest: async () => sesionQueDevuelve },
};

/** Lo que contesta la base, por orden. Y lo que se le preguntó. */
let respuestas = [];
const preguntas = [];
const rutaPg = require.resolve("pg");
require.cache[rutaPg] = {
  id: rutaPg, filename: rutaPg, loaded: true,
  exports: {
    Pool: class {
      async query(sql, params) {
        preguntas.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
        return respuestas.shift() ?? { rows: [], rowCount: 0 };
      }
      async connect() { return { query: this.query.bind(this), release() {} }; }
      async end() {}
    },
  },
};

const cita = require("../../api/erp-appointment");
const leads = require("./leads-handler");
const franjas = require("./visit-availability-handler");

// ── Andamio ─────────────────────────────────────────────────────────────────

const entorno = { NODE_ENV: process.env.NODE_ENV, AUTH: process.env.AUTH_BILLING_REQUIRE_SESSION, BASE: process.env.DATABASE_URL };

before(() => {
  process.env.NODE_ENV = "production";
  process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
  process.env.DATABASE_URL = "postgres://de-mentira/base";
});
after(() => {
  for (const [n, v] of [["NODE_ENV", entorno.NODE_ENV], ["AUTH_BILLING_REQUIRE_SESSION", entorno.AUTH], ["DATABASE_URL", entorno.BASE]]) {
    if (v === undefined) delete process.env[n]; else process.env[n] = v;
  }
});
beforeEach(() => {
  respuestas = [];
  preguntas.length = 0;
  sesionQueDevuelve = { user: { id: "u-de-ana", email: "ana@example.com" } };
});

function respuesta() {
  const r = { codigo: 200, cuerpo: null, cabeceras: {} };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (d) => { r.cuerpo = d; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.cabeceras[k] = v; };
  r.redirect = (c, u) => { r.codigo = c; r.aDonde = u; return r; };
  return r;
}

const HAY = { rows: [{ ok: 1 }], rowCount: 1 };
const NADA = { rows: [], rowCount: 0 };

// ── 1 · La cita de taller ───────────────────────────────────────────────────

describe("apuntar una cita de taller", () => {
  const peticion = (body) => ({ method: "POST", headers: {}, query: {}, body });

  test("sin sesión, no", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await cita(peticion({ userId: "victima@example.com", scheduledAt: "2026-10-01T10:00:00Z" }), res);
    assert.equal(res.codigo, 401);
    assert.equal(preguntas.length, 0, "ni se toca la base");
  });

  test("la cita es de quien la pide, no del userId que mande", async () => {
    respuestas = [{ rows: [{ id: "u-de-ana" }], rowCount: 1 }, { rows: [{ id: 1, status: "scheduled" }], rowCount: 1 }];
    const res = respuesta();
    await cita(peticion({ userId: "victima@example.com", scheduledAt: "2026-10-01T10:00:00Z", appointmentType: "Revision ITV" }), res);

    assert.equal(res.codigo, 201);
    const alta = preguntas.find((p) => p.sql.startsWith("INSERT INTO erp_appointments"));
    assert.ok(alta, "no se ha llegado a guardar");
    assert.equal(alta.params[0], "u-de-ana", "se guarda el identificador de quien pide");
    assert.ok(!String(alta.params[0]).includes("@"), "y no un correo: esa columna tiene una relación declarada");
  });
});

// ── 2 · Anular o reprogramar una solicitud ──────────────────────────────────

describe("tocar una solicitud propia", () => {
  const peticion = (body) => ({ method: "PATCH", headers: {}, query: {}, body });

  test("sin sesión, no", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await leads(peticion({ id: "lead-1", email: "victima@example.com", action: "cancel" }), res);
    assert.equal(res.codigo, 401);
  });

  test("el correo del cuerpo se ignora: manda la sesión", async () => {
    // La tabla se prepara sola al arrancar; se contesta a todo lo que pregunte
    // y se mira con qué correo acaba buscando la solicitud.
    respuestas = Array.from({ length: 12 }, () => NADA);
    const res = respuesta();
    await leads(peticion({ id: "lead-1", email: "victima@example.com", action: "cancel" }), res);

    const busca = preguntas.find((p) => /FROM moveadvisor_market_leads WHERE id = \$1 AND user_email = \$2/.test(p.sql));
    assert.ok(busca, "no ha llegado a buscar la solicitud");
    assert.equal(busca.params[1], "ana@example.com", "buscaba con el correo que venía escrito");
  });
});

// ── 3 · Las franjas de visita ───────────────────────────────────────────────

describe("cambiar el calendario de un coche", () => {
  const añadir = (body) => ({ method: "POST", headers: {}, query: { route: "add_slot" }, body });

  test("sin sesión, no", async () => {
    sesionQueDevuelve = null;
    const res = respuesta();
    await franjas(añadir({ offerId: "idcar-de-otro", startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T11:00:00Z" }), res);
    assert.equal(res.codigo, 401);
  });

  test("el coche de otro, tampoco", async () => {
    respuestas = [NADA]; // no es suyo
    const res = respuesta();
    await franjas(añadir({ offerId: "idcar-de-otro", startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T11:00:00Z" }), res);
    assert.equal(res.codigo, 403);
    assert.equal(res.cuerpo.error, "no_es_tu_coche");
  });

  test("una oferta que no es un IDCar no se gestiona desde aquí", async () => {
    const res = respuesta();
    await franjas(añadir({ offerId: "vo-12345", startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T11:00:00Z" }), res);
    assert.equal(res.codigo, 403);
  });

  test("borrar también pregunta de quién es", async () => {
    respuestas = [NADA];
    const res = respuesta();
    await franjas({ method: "DELETE", headers: {}, query: { route: "delete_slot", slotId: "s1", offerId: "idcar-de-otro" }, body: {} }, res);
    assert.equal(res.codigo, 403);
  });

  test("y en bloque, igual", async () => {
    respuestas = [NADA];
    const res = respuesta();
    await franjas({
      method: "POST", headers: {}, query: { route: "add_bulk_slots" },
      body: { offerId: "idcar-de-otro", slots: [{ startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T11:00:00Z" }] },
    }, res);
    assert.equal(res.codigo, 403);
  });

  test("el suyo sí pasa del portero", async () => {
    respuestas = [HAY, NADA, { rows: [{ id: "slot-1" }], rowCount: 1 }];
    const res = respuesta();
    await franjas(añadir({ offerId: "idcar-mio", startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T11:00:00Z" }), res);
    assert.notEqual(res.codigo, 401);
    assert.notEqual(res.codigo, 403);
  });
});
