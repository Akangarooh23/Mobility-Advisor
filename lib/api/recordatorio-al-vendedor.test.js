/**
 * En el coche de un particular, el recordatorio de la visita le llega también
 * al vendedor.
 *
 * Es quien la confirma y quien abre la puerta y enseña el coche. Recordársela
 * solo al comprador dejaba sin aviso a la otra mitad de la cita. En los de
 * concesionario no: al concesionario se le llama.
 *
 * Se corre la tarea de verdad, con la base y el correo simulados.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = "secreto-de-mentira";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

const MANANA = new Date(Date.now() + 86400000);
MANANA.setUTCHours(8, 0, 0, 0);

let reservas = [];
let correos = [];

const reserva = (extra = {}) => ({
  id: "b-1", buyer_email: "comprador@example.com", buyer_name: "Sergio",
  vehicle_title: "Volkswagen T-Roc", starts_at: MANANA.toISOString(),
  ends_at: new Date(MANANA.getTime() + 4 * 3600000).toISOString(),
  token_buyer: "t-comprador", token_seller: "t-vendedor",
  meeting_place: "Calle Mayor 1", meeting_contact: "Ana",
  offer_id: "idcar-veh-1", seller_email: "vendedor@example.com",
  ...extra,
});

beforeEach(() => {
  correos = [];
  Pool.prototype.query = async (sql) => {
    const t = String(sql || "");
    // Solo la víspera de las reservas trae algo; el resto, vacío.
    if (/FROM vehicle_visit_bookings/.test(t) && /CURRENT_DATE \+ 1/.test(t)) return { rows: reservas, rowCount: reservas.length };
    return { rows: [], rowCount: 0 };
  };
  global.fetch = async (_url, opciones) => {
    const c = JSON.parse(opciones.body);
    correos.push({ to: c.to, subject: c.subject, html: c.html });
    return { ok: true, status: 200, json: async () => ({}) };
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");
const { laFranja } = require("../citas");
// En hora de Madrid, que cambia con el horario de verano: se calcula, no se escribe.
const FRANJA = laFranja(reserva().starts_at, reserva().ends_at);

async function corre() {
  const res = { status() { return res; }, json() { return res; }, setHeader() { return res; } };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);
}

describe("el recordatorio de la víspera", { concurrency: 1 }, () => {
  test("en el coche de un particular, le llega a los dos", async () => {
    reservas = [reserva()];
    await corre();
    assert.ok(correos.some((c) => c.to === "comprador@example.com"), "al comprador no le llega");
    const suyo = correos.find((c) => c.to === "vendedor@example.com");
    assert.ok(suyo, "al vendedor particular no le llega el recordatorio");
    assert.match(suyo.subject, /Mañana vienen a ver tu coche/);
  });

  test("al vendedor, con la franja, dónde y quién viene, sin sus datos", async () => {
    reservas = [reserva()];
    await corre();
    const html = correos.find((c) => c.to === "vendedor@example.com").html;
    assert.ok(html.includes(FRANJA), `sin la franja ${FRANJA}`);
    assert.match(html, /Calle Mayor 1/);
    assert.match(html, /Sergio/);
    assert.ok(!html.includes("comprador@example.com"));
    assert.ok(html.includes("/cita-vendedor?id=b-1"), "sin su enlace, no puede cancelarla si al final no puede");
  });

  test("y al comprador, la franja entera y no la hora suelta", async () => {
    reservas = [reserva()];
    await corre();
    assert.ok(correos.find((c) => c.to === "comprador@example.com").html.includes(FRANJA));
  });

  test("en el de un concesionario, al vendedor no", async () => {
    reservas = [reserva({ offer_id: "erp-9", seller_email: null })];
    await corre();
    assert.ok(correos.some((c) => c.to === "comprador@example.com"));
    assert.equal(correos.filter((c) => c.to !== "comprador@example.com").length, 0);
  });
});
