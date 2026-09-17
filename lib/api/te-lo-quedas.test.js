/**
 * Al acabar la visita al coche de un particular: «¿Te lo quedas?».
 *
 * Sale al terminar la hora de la visita —la tarea pasa cada hora para esto— y
 * no a la mañana siguiente, que es cuando ya se ha enfriado. Con tres botones:
 * «Quiero comprarlo», que empieza la compra; «Lo vi y no me lo quedo» y «No
 * fui», que solo lo apuntan.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = "secreto-de-mentira";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

let consultas = [];
let correos = [];
let reservas = [];

const HACE_MEDIA_HORA = new Date(Date.now() - 30 * 60000).toISOString();

const reserva = (extra = {}) => ({
  id: "b-1", buyer_email: "comprador@example.com", buyer_name: "Sergio",
  vehicle_title: "Volkswagen T-Roc", starts_at: new Date(Date.now() - 90 * 60000).toISOString(), ends_at: HACE_MEDIA_HORA,
  token_buyer: "t-comprador", token_seller: "t-vendedor", meeting_place: "", meeting_contact: "",
  offer_id: "idcar-veh-1", seller_email: "vendedor@example.com",
  ...extra,
});

beforeEach(() => {
  consultas = [];
  correos = [];
  Pool.prototype.query = async (sql) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    consultas.push(t);
    if (/FROM vehicle_visit_bookings/.test(t) && /followup_sent_at IS NULL/.test(t)) return { rows: reservas, rowCount: reservas.length };
    return { rows: [], rowCount: 0 };
  };
  global.fetch = async (_u, o) => { const c = JSON.parse(o.body); correos.push({ to: c.to, subject: c.subject, html: c.html }); return { ok: true, status: 200, json: async () => ({}) }; };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");

async function corre(query = {}) {
  const res = { status() { return res; }, json() { return res; }, setHeader() { return res; } };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query }, res);
}

describe("¿te lo quedas?", { concurrency: 1 }, () => {
  test("al comprador del coche de un particular, con los tres botones", async () => {
    reservas = [reserva()];
    await corre({ solo: "seguimiento" });
    const suyo = correos.find((c) => c.to === "comprador@example.com");
    assert.ok(suyo, "no le llega");
    assert.match(suyo.subject, /¿Te lo quedas\?/);
    assert.ok(suyo.html.includes("/quiero-comprarlo?id=b-1&amp;token=t-comprador") || suyo.html.includes("/quiero-comprarlo?id=b-1&token=t-comprador"));
    assert.match(suyo.html, /Quiero comprarlo/);
    assert.match(suyo.html, /Lo vi y no me lo quedo/);
    assert.match(suyo.html, /No fui/);
  });

  test("en el de un concesionario sigue el «¿qué tal fue?» de siempre", async () => {
    reservas = [reserva({ offer_id: "erp-9", seller_email: null })];
    await corre({ solo: "seguimiento" });
    const suyo = correos.find((c) => c.to === "comprador@example.com");
    assert.match(suyo.subject, /¿Qué tal fue la visita\?/);
    assert.ok(!suyo.html.includes("quiero-comprarlo"));
  });

  test("sale al acabar la visita, no al empezar ni al día siguiente", async () => {
    reservas = [];
    await corre({ solo: "seguimiento" });
    const q = consultas.find((c) => /followup_sent_at IS NULL/.test(c));
    assert.match(q, /ends_at <= NOW\(\)/);
  });

  test("la pasada de cada hora no manda recordatorios ni toca los leads", async () => {
    reservas = [];
    await corre({ solo: "seguimiento" });
    assert.ok(!consultas.some((c) => /moveadvisor_market_leads/.test(c)), "la pasada de cada hora lee los leads");
    assert.ok(!consultas.some((c) => /reminder_sent_at IS NULL/.test(c)), "la pasada de cada hora mira los recordatorios");
  });

  test("y la de las 8:00 sigue haciéndolo todo", async () => {
    reservas = [];
    await corre({});
    assert.ok(consultas.some((c) => /moveadvisor_market_leads/.test(c)));
    assert.ok(consultas.some((c) => /reminder_sent_at IS NULL/.test(c)));
  });

  test("y la tarea está programada cada hora", () => {
    const vercel = require("../../vercel.json");
    assert.ok(vercel.crons.some((c) => c.path === "/api/cron-appointment-reminders?solo=seguimiento" && /^\d+ \* \* \* \*$/.test(c.schedule)));
  });
});
