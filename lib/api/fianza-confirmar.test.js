/**
 * Confirmar la fianza al volver de Stripe.
 *
 * Una fianza cobrada solo se anotaba si Stripe conseguía avisarnos por el
 * webhook: un único punto por el que pasaba todo. Si ese aviso no llegaba —el
 * evento sin suscribir, el secreto que no coincide, el endpoint dado de alta en
 * otro modo— el cliente pagaba, el dinero salía de su tarjeta y su panel seguía
 * enseñándole el botón de pagar.
 *
 * Ahora se confirma también al volver del pago. Lo que se comprueba aquí es lo
 * que hace que esto sea seguro: que solo cuenta lo pagado de verdad, y que la
 * solicitud tiene que ser de quien pregunta —si no, con el identificador de una
 * sesión ajena se daría por pagada la fianza de otro.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Emitir una factura escribe en el almacén de facturación, que es un fichero
// del repositorio. Cada prueba se lleva el suyo: corriendo varias a la vez, el
// apaño de guardarlo y restaurarlo se pisaba entre procesos y acababa dejando
// un cliente inventado dentro del repositorio.
process.env.BILLING_STORE_PATH = path.join(os.tmpdir(), `popcar-fianza-confirmar-${process.pid}.json`);
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.STRIPE_SECRET_KEY = "sk_de_mentira";
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const CLIENTE = "cliente@ejemplo.es";
const OTRO = "otro@ejemplo.es";
const LEAD = "imp-1";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Lo que Stripe contesta sobre la sesión de pago. */
let sesionStripe;
/** De quién es la solicitud, según la base. */
let duenoDelLead;
/** Lo que se ha escrito. */
let marcada;

beforeEach(() => {
  sesionStripe = {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 101900,
    payment_intent: "pi_1",
    customer_details: { email: CLIENTE },
    metadata: { plan_id: "deposito", lead_id: LEAD, importe: "1019", customer_email: CLIENTE },
  };
  duenoDelLead = CLIENTE;
  marcada = null;

  Pool.prototype.query = async (sql, params) => {
    const t = String(sql || "");
    if (/SELECT id FROM moveadvisor_market_leads/i.test(t)) {
      const suya = String(params[1]) === duenoDelLead;
      return { rows: suya ? [{ id: LEAD }] : [], rowCount: suya ? 1 : 0 };
    }
    if (/UPDATE moveadvisor_market_leads/i.test(t)) {
      marcada = { lead: params[0], cobro: params[1] };
      return { rows: [{ vehicle_title: "Volkswagen Golf" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    const u = String(url);
    if (u.includes("api.stripe.com/v1/checkout/sessions/")) {
      return { ok: true, status: 200, json: async () => sesionStripe };
    }
    // Ni Resend ni Supabase: aquí no se prueba la factura.
    if (u.includes("resend.com") || u.includes("supabase")) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./fianza-confirmar-handler.js");

async function confirma({ sessionId = "cs_1", email = CLIENTE } = {}) {
  let salida = null;
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json(b) { salida = { codigo: res._codigo, ...b }; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "POST", headers: {}, body: { sessionId, email } }, res);
  return salida;
}

describe("confirmar la fianza al volver del pago", { concurrency: 1 }, () => {
  test("una sesión pagada queda anotada, sin esperar al webhook", async () => {
    const r = await confirma();
    assert.equal(r.codigo, 200);
    assert.equal(r.pagada, true);
    assert.ok(marcada, "si no se anota, el cliente ha pagado y su panel le sigue pidiendo que pague");
    assert.equal(marcada.lead, LEAD);
    assert.equal(marcada.cobro, "pi_1", "el cobro se guarda: sin él no se puede devolver después");
  });

  test("una sesión abierta y abandonada no cuenta como pagada", async () => {
    sesionStripe.payment_status = "unpaid";
    const r = await confirma();
    assert.equal(r.pagada, false);
    assert.equal(marcada, null);
  });

  test("la solicitud de otro no se puede dar por pagada", async () => {
    duenoDelLead = OTRO;
    const r = await confirma();
    assert.equal(r.codigo, 403);
    assert.equal(marcada, null, "con el identificador de una sesión ajena se pagaría la fianza de otro");
  });

  test("una sesión que no es de un depósito se rechaza", async () => {
    sesionStripe.metadata.plan_id = "valuation";
    const r = await confirma();
    assert.equal(r.codigo, 400);
    assert.equal(marcada, null);
  });

  test("y las sesiones con el nombre viejo se siguen confirmando", async () => {
    // Cuando la fianza del 30 % pasó a ser el depósito del coche entero, la
    // pasarela empezó a etiquetar sus sesiones como «deposito» y esto se quedó
    // exigiendo «fianza»: el cliente pagaba, volvía al panel y su solicitud
    // seguía diciendo «pendiente de depósito» con el botón de pagar delante.
    //
    // Se aceptan los dos nombres porque quien pagó ayer tiene que poder
    // confirmarse hoy.
    sesionStripe.metadata.plan_id = "fianza";
    const r = await confirma();
    assert.equal(r.codigo, 200);
    assert.equal(r.pagada, true);
    assert.equal(marcada.lead, LEAD);
  });

  test("sin haber entrado, no se atiende", async () => {
    const previo = process.env.AUTH_BILLING_REQUIRE_SESSION;
    process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
    try {
      const r = await confirma();
      assert.equal(r.codigo, 401);
    } finally {
      process.env.AUTH_BILLING_REQUIRE_SESSION = previo;
    }
  });

  test("sin sesión de pago no hay nada que confirmar", async () => {
    const r = await confirma({ sessionId: "" });
    assert.equal(r.codigo, 400);
  });
});
