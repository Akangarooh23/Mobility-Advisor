/**
 * Cobrar la fianza de una importación.
 *
 * Es el paso que abre todo lo demás: hasta que no está cobrada no se pide el
 * coche a Alemania. Y es dinero, así que lo que se comprueba aquí es lo que
 * saldría caro de dos maneras distintas.
 *
 * Al abrir el pago: que solo se pueda pagar una solicitud **suya**, de
 * importación, con fianza calculada y sin pagar ya. Y que se cobre **la cifra
 * que se le dijo**, no una recalculada.
 *
 * Al cobrarse: que pasen las tres cosas a la vez —la solicitud queda pagada, el
 * expediente avanza, y se emite su factura con serie propia—, porque si falta
 * una el dinero ya está cobrado igual.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.STRIPE_SECRET_KEY = "sk_de_mentira";
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";
// El webhook no atiende nada sin firma valida, y hace bien: aqui se firma como
// firma Stripe, con el mismo secreto.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_de_mentira";
const crypto = require("node:crypto");

function firmaDeStripe(cuerpo) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(t + "." + cuerpo, "utf8").digest("hex");
  return "t=" + t + ",v1=" + v1;
}

const CLIENTE = "cliente@example.com";
const LEAD = "imp-1756-abc";
const FIANZA = 4200;

let solicitud;
let perfil;
let sesionCreada = null;
let guardado;

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

function reinicia() {
  solicitud = {
    id: LEAD, vehicle_title: "Volkswagen Golf", deposit_quoted: FIANZA, deposit_paid_at: null,
    status: "Contactado",
  };
  perfil = { tax_id: "12345678Z", billing_street: "Calle de algo 1" };
  sesionCreada = null;
  guardado = { marcada: null, factura: null, serie: null };
}

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const p = params || [];
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM moveadvisor_users/i.test(t)) return responde(perfil ? [perfil] : [{}]);
    if (/FROM moveadvisor_market_leads/i.test(t)) {
      // La consulta pide que sea suya y de importación: si no, no hay fila.
      const suya = String(p[1] || "").toLowerCase() === CLIENTE;
      const esLaSuya = String(p[0]) === LEAD;
      return responde(solicitud && suya && esLaSuya ? [solicitud] : []);
    }
    if (/UPDATE moveadvisor_market_leads/i.test(t)) {
      guardado.marcada = { id: p[0], paga: /deposit_paid_at/.test(t), avanza: /Fianza pagada/.test(t) };
      return responde([{ vehicle_title: solicitud.vehicle_title }]);
    }
    if (/INSERT INTO moveadvisor_invoice_counters/i.test(t)) {
      guardado.serie = p[0];
      return responde([{ last_n: 1 }]);
    }
    if (/INSERT INTO moveadvisor_user_invoices/i.test(t)) {
      guardado.factura = { id: p[0], email: p[1], numero: p[2], importe: p[3], concepto: p[4] };
      return responde([]);
    }
    return responde([]);
  };
  global.fetch = async (url, opciones) => {
    const u = String(url);
    if (u.includes("api.stripe.com/v1/customers")) {
      return { ok: true, status: 200, json: async () => ({ id: "cus_1" }), text: async () => "" };
    }
    if (u.includes("api.stripe.com/v1/checkout/sessions")) {
      sesionCreada = new URLSearchParams(String(opciones.body));
      return { ok: true, status: 200, json: async () => ({ url: "https://checkout.stripe.com/pagar" }), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => reinicia());

const checkout = require("./billing-checkout-handler.js");
const webhook = require("./billing-webhook-handler.js");

async function abrePago(extra = {}) {
  const req = { method: "POST", headers: {}, query: {}, body: { planId: "fianza", leadId: LEAD, customerEmail: CLIENTE, ...extra } };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await checkout(req, res);
  return salida;
}

describe("abrir el pago de la fianza", () => {
  test("se cobra la cifra que se le dijo, ni más ni menos", async () => {
    const r = await abrePago();
    assert.equal(r.codigo, 200);
    assert.ok(String(r.cuerpo.url).includes("checkout.stripe.com"));
    assert.equal(sesionCreada.get("line_items[0][price_data][unit_amount]"), String(FIANZA * 100));
    assert.equal(sesionCreada.get("mode"), "payment");
  });

  test("la sesión lleva de qué solicitud es, que es lo que la ata al expediente", async () => {
    await abrePago();
    assert.equal(sesionCreada.get("metadata[plan_id]"), "fianza");
    assert.equal(sesionCreada.get("metadata[lead_id]"), LEAD);
    assert.equal(sesionCreada.get("metadata[importe]"), String(FIANZA));
  });

  test("una solicitud que no es suya no se puede pagar", async () => {
    const r = await abrePago({ customerEmail: "otro@example.com" });
    assert.equal(r.codigo, 404);
    assert.equal(sesionCreada, null);
  });

  test("una fianza ya pagada no se cobra dos veces", async () => {
    solicitud.deposit_paid_at = new Date().toISOString();
    const r = await abrePago();
    assert.equal(r.codigo, 409);
    assert.equal(sesionCreada, null);
  });

  test("sin fianza calculada no se inventa un importe", async () => {
    solicitud.deposit_quoted = 0;
    const r = await abrePago();
    assert.equal(r.codigo, 409);
    assert.equal(sesionCreada, null);
  });

  test("sin NIF ni dirección no se cobra: la factura sale al pagar", async () => {
    perfil = { tax_id: "", billing_street: "" };
    const r = await abrePago();
    assert.equal(r.codigo, 422);
    assert.equal(r.cuerpo.error, "billing_profile_incomplete");
    assert.equal(sesionCreada, null);
  });
});

describe("cuando Stripe dice que está pagada", () => {
  async function avisaStripe(meta = {}) {
    const evento = {
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_1", customer_email: CLIENTE, amount_total: FIANZA * 100,
        metadata: { plan_id: "fianza", lead_id: LEAD, customer_email: CLIENTE, importe: String(FIANZA), ...meta },
      } },
    };
    const crudo = JSON.stringify(evento);
    const req = {
      method: "POST",
      headers: { "stripe-signature": firmaDeStripe(crudo) },
      query: {}, body: evento, rawBody: crudo,
    };
    const salida = { codigo: 200, cuerpo: null };
    const res = {
      status(c) { salida.codigo = c; return res; },
      json(b) { salida.cuerpo = b; return res; },
      setHeader() { return res; }, end() { return res; }, send() { return res; },
    };
    await webhook(req, res);
    await new Promise((r) => setImmediate(r));
    return salida;
  }

  test("la solicitud queda pagada y el expediente avanza", async () => {
    await avisaStripe();
    assert.ok(guardado.marcada, "hay que dejar constancia de que se cobró");
    assert.equal(guardado.marcada.id, LEAD);
    assert.ok(guardado.marcada.paga);
    assert.ok(guardado.marcada.avanza, "de «Contactado» pasa a «Fianza pagada» solo");
  });

  test("se emite su factura, con serie propia", async () => {
    await avisaStripe();
    assert.equal(guardado.serie, "FIA", "una fianza no es una venta ni una suscripción");
    assert.ok(guardado.factura, "sin factura, ha pagado y no tiene justificante");
    assert.equal(guardado.factura.numero, "FIA-" + new Date().getFullYear() + "-0001");
    assert.equal(Number(guardado.factura.importe), FIANZA);
    assert.equal(guardado.factura.email, CLIENTE);
    assert.match(guardado.factura.concepto, /Fianza de importación/);
  });

  test("sin saber de qué solicitud es, no se toca nada", async () => {
    await avisaStripe({ lead_id: "" });
    assert.equal(guardado.marcada, null);
    assert.equal(guardado.factura, null);
  });
});
