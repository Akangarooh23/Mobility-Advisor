/**
 * Las visitas que se quedan a medias, y a quién hay que empujar en cada una.
 *
 * Todos los avisos del cron miraban visitas confirmadas. Una que nadie confirma
 * no recibía nada: el comprador esperaba, el vendedor no se acordaba, y la hora
 * seguía ocupada en el calendario hasta el fin de los tiempos.
 *
 * Son tres situaciones con la misma cara —`status = 'pending'`— y cada una
 * tiene un dueño distinto. Aquí se comprueba que cada correo va a quien toca,
 * que no se manda dos veces, y que la que caduca se cierra de verdad.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const path = require("node:path");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = "secreto-de-mentira";

let avisos = [];
const rutaDeAvisos = require.resolve(path.join(__dirname, "..", "avisos-push"));
require.cache[rutaDeAvisos] = {
  id: rutaDeAvisos, filename: rutaDeAvisos, loaded: true,
  exports: {
    enviaAviso: async (correos, aviso) => { avisos.push({ a: correos, ...aviso }); return { enviados: 1 }; },
  },
};

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

const enHoras = (h) => new Date(Date.now() + h * 3600000).toISOString();

/** La visita pendiente de turno. Cada prueba la retoca a su caso. */
let pendiente;
let correos = [];
/** Lo que se ha escrito en la base, para ver que la caducada se cierra. */
let escrituras = [];

beforeEach(() => {
  correos = [];
  avisos = [];
  escrituras = [];
  pendiente = {
    id: "b-1",
    buyer_email: "comprador@example.com",
    buyer_name: "Marta",
    vehicle_title: "Volkswagen T-Roc",
    starts_at: enHoras(48),
    ends_at: enHoras(49),
    token_buyer: "t-comprador",
    token_seller: "t-vendedor",
    seller_email: "vendedor@example.com",
    offer_id: "idcar-veh-1",
    availability_id: "f-1",
    created_at: enHoras(-30),
    recordatorio_vendedor_at: null,
    recordatorio_horas_at: null,
    propuesta_at: null,
  };

  Pool.prototype.query = async (sql, valores) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    if (/FROM vehicle_visit_bookings b WHERE b\.status = 'pending'/i.test(t)) {
      return { rows: [{ ...pendiente }], rowCount: 1 };
    }
    if (/^(UPDATE|INSERT)/i.test(t.trim())) {
      escrituras.push({ sql: t, valores });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) correos.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");

async function corre() {
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json() { return res; }, setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);
  return res._codigo;
}

const para = (quien) => correos.find((c) => c.to === quien);
const escrito = (trozo) => escrituras.find((e) => e.sql.includes(trozo));

describe("nadie ha contestado al comprador", () => {
  test("a las 24 horas se empuja al vendedor, con su enlace", async () => {
    await corre();
    const c = para("vendedor@example.com");
    assert.ok(c, "no se ha escrito al vendedor");
    assert.match(c.subject, /Te están esperando/);
    assert.match(c.html, /\/cita-vendedor\?id=b-1&amp;token=t-vendedor/);
    assert.ok(!para("comprador@example.com"), "al comprador no le toca nada todavía");
  });

  test("y le suena el móvil", async () => {
    await corre();
    assert.ok(avisos.some((a) => /esperando/i.test(a.titulo) && a.a[0] === "vendedor@example.com"));
  });

  test("queda apuntado, para no repetirlo mañana", async () => {
    await corre();
    assert.ok(escrito("recordatorio_vendedor_at = NOW()"));
  });

  test("si se pidió hace un rato, todavía no", async () => {
    pendiente.created_at = enHoras(-2);
    await corre();
    assert.equal(correos.length, 0);
  });

  test("y si ya se le avisó, tampoco", async () => {
    pendiente.recordatorio_vendedor_at = enHoras(-5);
    await corre();
    assert.equal(correos.length, 0);
  });
});

describe("le propusieron horas y no ha elegido", () => {
  beforeEach(() => { pendiente.propuesta_at = enHoras(-26); });

  test("a las 24 horas se empuja al comprador, no al vendedor", async () => {
    await corre();
    const c = para("comprador@example.com");
    assert.ok(c, "no se ha escrito al comprador");
    assert.match(c.subject, /elijas hora/i);
    assert.match(c.html, /\/elegir-hora\?id=b-1&amp;token=t-comprador/);
    assert.ok(!para("vendedor@example.com"), "el vendedor ya hizo lo suyo: propuso");
  });

  test("queda apuntado", async () => {
    await corre();
    assert.ok(escrito("recordatorio_horas_at = NOW()"));
  });

  test("recién propuestas, se le deja pensar", async () => {
    pendiente.propuesta_at = enHoras(-3);
    await corre();
    assert.equal(correos.length, 0);
  });
});

describe("llegó la hora y nadie la confirmó", () => {
  beforeEach(() => {
    pendiente.starts_at = enHoras(-3);
    pendiente.ends_at = enHoras(-2);
  });

  test("la visita se cierra y el hueco vuelve a estar libre", async () => {
    await corre();
    assert.ok(escrito("SET status = 'cancelled'"), "la visita sigue pendiente");
    assert.ok(escrito("vehicle_visit_availability SET status = 'available'"), "el hueco sigue ocupado");
  });

  test("queda el rastro de por qué", async () => {
    await corre();
    const rastro = escrito("INSERT INTO visit_booking_events");
    assert.ok(rastro);
    assert.match(String(rastro.valores?.[1]), /sin que nadie la confirmara/);
  });

  test("y se le dice al comprador que no se presente", async () => {
    await corre();
    const c = para("comprador@example.com");
    assert.ok(c, "no se le ha dicho nada a quien iba a ir");
    assert.match(c.html, /No te presentes/);
    assert.match(c.html, /\/marketplace-vo\/idcar-veh-1/);
  });

  test("al vendedor no se le empuja: ya no hay nada que contestar", async () => {
    await corre();
    assert.ok(!para("vendedor@example.com"));
  });
});

describe("las visitas de un concesionario", () => {
  test("sin vendedor particular detrás, no se empuja a nadie", async () => {
    // Esas las lleva el equipo, y su aviso es otro.
    pendiente.seller_email = null;
    pendiente.token_seller = null;
    await corre();
    assert.equal(correos.length, 0);
  });
});
