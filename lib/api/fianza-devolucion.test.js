/**
 * Devolver la fianza de una importación.
 *
 * Es dinero saliendo, así que lo que se fija aquí es el orden y las puertas.
 *
 * El orden: **Stripe primero**. Si se marca antes de que Stripe confirme, queda
 * un expediente que dice «devuelta» con el dinero todavía en la cuenta, y eso no
 * se descubre hasta que el cliente llama preguntando por él.
 *
 * Las puertas: sin el secreto compartido no se atiende a nadie —quien llama no
 * es una persona, es la otra mitad del sistema—, no se devuelve lo que no se
 * cobró, y no se devuelve dos veces.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.STRIPE_SECRET_KEY = "sk_de_mentira";
process.env.INTERNAL_API_SECRET = "secreto-de-mentira";
process.env.RESEND_API_KEY = "clave-de-mentira";

const LEAD = "imp-1756-abc";
const CLIENTE = "cliente@example.com";
const FIANZA = 4200;

let lead;
let stripeAcepta = true;
let pedidoAStripe = null;
let guardado;

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

function reinicia() {
  lead = {
    id: LEAD, user_email: CLIENTE, contact_name: "Juan", vehicle_title: "Volkswagen Golf",
    deposit_quoted: FIANZA, deposit_paid_at: new Date().toISOString(),
    deposit_payment_ref: "pi_123", deposit_refunded_at: null,
  };
  stripeAcepta = true;
  pedidoAStripe = null;
  guardado = { marcada: null, rectificativa: null, serie: null, correo: null };
}

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const p = params || [];
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM moveadvisor_market_leads/i.test(t)) {
      return responde(lead && String(p[0]) === LEAD ? [lead] : []);
    }
    if (/UPDATE moveadvisor_market_leads/i.test(t)) {
      guardado.marcada = { id: p[0], refund: p[1] };
      return responde([]);
    }
    if (/INSERT INTO moveadvisor_invoice_counters/i.test(t)) {
      guardado.serie = p[0];
      return responde([{ last_n: 1 }]);
    }
    if (/INSERT INTO moveadvisor_user_invoices/i.test(t)) {
      guardado.rectificativa = { numero: p[2], importe: p[3], concepto: p[4] };
      return responde([]);
    }
    return responde([]);
  };
  global.fetch = async (url, opciones) => {
    const u = String(url);
    if (u.includes("api.stripe.com/v1/refunds")) {
      pedidoAStripe = new URLSearchParams(String(opciones.body));
      return stripeAcepta
        ? { ok: true, status: 200, json: async () => ({ id: "re_999" }), text: async () => "" }
        : { ok: false, status: 402, json: async () => ({ error: { message: "El cargo ya se devolvió" } }), text: async () => "" };
    }
    if (u.includes("resend.com")) {
      guardado.correo = JSON.parse(opciones.body);
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => reinicia());

const handler = require("./fianza-devolucion-handler.js");

async function devuelve({ secreto = "secreto-de-mentira", leadId = LEAD, motivo = "No hay unidad" } = {}) {
  const req = {
    method: "POST",
    headers: secreto ? { authorization: `Bearer ${secreto}` } : {},
    query: {},
    body: { leadId, motivo },
  };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler(req, res);
  await new Promise((r) => setImmediate(r));
  return salida;
}

describe("devolver la fianza", () => {
  test("se pide a Stripe sobre el cobro guardado", async () => {
    const r = await devuelve();
    assert.equal(r.codigo, 200);
    assert.ok(pedidoAStripe, "hay que devolverlo de verdad, no solo apuntarlo");
    assert.equal(pedidoAStripe.get("payment_intent"), "pi_123");
    assert.equal(pedidoAStripe.get("metadata[lead_id]"), LEAD);
  });

  test("queda escrito, con la devolución de Stripe para poder cuadrarla", async () => {
    await devuelve();
    assert.ok(guardado.marcada);
    assert.equal(guardado.marcada.refund, "re_999");
  });

  test("sale su rectificativa, en negativo y con serie propia", async () => {
    const r = await devuelve();
    assert.equal(guardado.serie, "RECT");
    assert.equal(Number(guardado.rectificativa.importe), -FIANZA);
    assert.match(guardado.rectificativa.numero, /^RECT-\d{4}-0001$/);
    assert.equal(r.cuerpo.rectificativa, guardado.rectificativa.numero);
  });

  test("y se le cuenta al cliente, con el motivo", async () => {
    await devuelve({ motivo: "El coche ya no está" });
    assert.ok(guardado.correo, "se le ha devuelto el dinero: tiene que enterarse");
    assert.equal(guardado.correo.to, CLIENTE);
    assert.match(guardado.correo.html, /El coche ya no está/);
  });
});

describe("lo que no se deja hacer", () => {
  test("sin el secreto compartido no se atiende", async () => {
    const r = await devuelve({ secreto: "" });
    assert.equal(r.codigo, 401);
    assert.equal(pedidoAStripe, null);
  });

  test("con un secreto que no es, tampoco", async () => {
    const r = await devuelve({ secreto: "otro" });
    assert.equal(r.codigo, 401);
    assert.equal(pedidoAStripe, null);
  });

  test("no se devuelve una fianza que no se cobró", async () => {
    lead.deposit_paid_at = null;
    const r = await devuelve();
    assert.equal(r.codigo, 409);
    assert.equal(pedidoAStripe, null);
  });

  test("ni dos veces", async () => {
    lead.deposit_refunded_at = new Date().toISOString();
    const r = await devuelve();
    assert.equal(r.codigo, 409);
    assert.equal(pedidoAStripe, null);
  });

  test("sin cobro guardado se dice qué hacer, en vez de fallar a secas", async () => {
    lead.deposit_payment_ref = "";
    const r = await devuelve();
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.error, "sin_cobro_guardado");
    assert.match(r.cuerpo.detail, /desde Stripe/);
  });

  test("si Stripe no acepta, no se marca nada como devuelto", async () => {
    stripeAcepta = false;
    const r = await devuelve();
    assert.equal(r.codigo, 502);
    assert.equal(guardado.marcada, null, "un expediente que dice «devuelta» con el dinero dentro es peor que un error");
    assert.equal(guardado.rectificativa, null);
    assert.equal(guardado.correo, null, "y no se le dice que se le ha devuelto algo que no se le ha devuelto");
  });
});
