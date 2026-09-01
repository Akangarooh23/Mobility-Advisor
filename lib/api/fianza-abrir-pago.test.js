/**
 * Abrir el pago de la fianza.
 *
 * Es la puerta: aquí se decide si alguien puede pagar, cuánto, y con qué datos
 * viaja el cobro. Lo que se mande mal aquí no se arregla después — si la sesión
 * de Stripe no lleva de qué solicitud es, el cobro llega y no hay forma de saber
 * a qué expediente pertenece: el cliente paga y nadie se entera.
 *
 * No tenía ninguna prueba.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const CLIENTE = "cliente@ejemplo.es";
const LEAD = "imp-1";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Cómo está la solicitud. Null = no es suya o no existe. */
let solicitud;
/** El perfil de facturación, que hace falta para emitir la factura. */
let perfilCompleto;
/** Lo que se le ha mandado a Stripe. */
let enviadoAStripe;

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_de_mentira";
  solicitud = { id: LEAD, vehicle_title: "Volkswagen Golf", deposit_quoted: "1019.00", deposit_paid_at: null };
  perfilCompleto = true;
  enviadoAStripe = null;

  Pool.prototype.query = async (sql) => {
    const t = String(sql || "");
    if (/FROM moveadvisor_market_leads/i.test(t)) {
      return { rows: solicitud ? [solicitud] : [], rowCount: solicitud ? 1 : 0 };
    }
    // El perfil de facturación: NIF y dirección para poder emitir la factura.
    if (/FROM moveadvisor_users/i.test(t)) {
      return perfilCompleto
        ? { rows: [{ tax_id: "12345678Z", billing_street: "Calle 1" }], rowCount: 1 }
        : { rows: [{ tax_id: "", billing_street: "" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    const u = String(url);
    if (u.includes("api.stripe.com/v1/customers")) {
      return { ok: true, status: 200, json: async () => ({ id: "cus_1" }) };
    }
    if (u.includes("api.stripe.com/v1/checkout/sessions")) {
      enviadoAStripe = String(opciones?.body || "");
      return { ok: true, status: 200, json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }) };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./billing-checkout-handler.js");

async function abrePago(extra = {}) {
  let salida = null;
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json(b) { salida = { codigo: res._codigo, ...b }; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler({
    method: "POST", headers: {},
    body: { planId: "fianza", leadId: LEAD, customerEmail: CLIENTE, origin: "https://www.popcar.tech", ...extra },
  }, res);
  return salida;
}

/** Lo que va dentro del cuerpo que se le manda a Stripe. */
function campo(cuerpo, clave) {
  const p = new URLSearchParams(cuerpo);
  return p.get(clave);
}

describe("abrir el pago de la fianza", { concurrency: 1 }, () => {
  test("devuelve la dirección de pago", async () => {
    const r = await abrePago();
    assert.equal(r.codigo, 200);
    assert.match(r.url, /checkout\.stripe\.com/);
  });

  test("el cobro viaja sabiendo de qué solicitud es", async () => {
    await abrePago();
    assert.equal(campo(enviadoAStripe, "metadata[plan_id]"), "deposito");
    assert.equal(campo(enviadoAStripe, "metadata[lead_id]"), LEAD,
      "sin esto el cobro llega y no hay manera de saber a qué expediente pertenece");
    assert.equal(campo(enviadoAStripe, "metadata[importe]"), "1019");
  });

  test("se cobra la cifra que se le dijo, no una recalculada", async () => {
    await abrePago();
    assert.equal(campo(enviadoAStripe, "line_items[0][price_data][unit_amount]"), "101900");
  });

  test("al volver, la dirección trae la sesión de pago", async () => {
    await abrePago();
    assert.match(campo(enviadoAStripe, "success_url"), /session_id=\{CHECKOUT_SESSION_ID\}/,
      "sin la sesión en la vuelta, confirmar el pago depende solo del aviso de Stripe");
  });

  test("una solicitud que no es suya no abre ningún pago", async () => {
    solicitud = null;
    const r = await abrePago();
    assert.equal(r.codigo, 404);
    assert.equal(enviadoAStripe, null);
  });

  test("una fianza ya pagada no se cobra otra vez", async () => {
    solicitud.deposit_paid_at = "2026-08-29T19:30:00Z";
    const r = await abrePago();
    assert.equal(r.codigo, 409);
    assert.equal(enviadoAStripe, null);
  });

  test("sin fianza calculada no se inventa un importe", async () => {
    solicitud.deposit_quoted = "0";
    const r = await abrePago();
    assert.equal(r.codigo, 409);
    assert.equal(enviadoAStripe, null);
  });

  test("sin la solicitud no se sabe qué se cobra", async () => {
    const r = await abrePago({ leadId: "" });
    assert.equal(r.codigo, 400);
  });

  test("sin Stripe configurado se dice, en vez de fingir que todo va bien", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const r = await abrePago();
    assert.equal(r.codigo, 503,
      "contestar que sí sin dirección deja al cliente con un aviso genérico y a nadie enterado");
    assert.ok(!r.ok);
  });
});

/**
 * Cómo se paga, según la clave que haya puesta.
 *
 * En real, solo transferencia: son veinte mil euros, no pasan por la tarjeta de
 * un particular, llevarían unos 300 € de comisión y una tarjeta se puede
 * disputar meses después, cuando el dinero ya está en Alemania.
 *
 * En pruebas, además tarjeta, porque para recorrer el flujo hace falta poder
 * pagar y teclear la 4242 es más cómodo que simular una transferencia. Ahí no
 * hay riesgo: no se mueve dinero y no hay comisión.
 */
describe("las formas de pago del depósito", () => {
  test("con clave real, solo transferencia", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_deMentira";
    await abrePago();
    assert.equal(campo(enviadoAStripe, "payment_method_types[0]"), "customer_balance");
    assert.equal(campo(enviadoAStripe, "payment_method_types[1]"), null,
      "en real no puede ofrecerse la tarjeta: son 300 € de comisión y un contracargo posible");
  });

  test("con clave de prueba, también tarjeta", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_deMentira";
    await abrePago();
    assert.equal(campo(enviadoAStripe, "payment_method_types[0]"), "card");
    assert.equal(campo(enviadoAStripe, "payment_method_types[1]"), "customer_balance");
  });

  test("la transferencia va configurada en los dos casos", async () => {
    for (const clave of ["sk_live_deMentira", "sk_test_deMentira"]) {
      process.env.STRIPE_SECRET_KEY = clave;
      await abrePago();
      assert.equal(
        campo(enviadoAStripe, "payment_method_options[customer_balance][funding_type]"),
        "bank_transfer", `falta con ${clave}`
      );
    }
  });

  test("y la distinción sale de la clave, no de otra variable", async () => {
    // Una variable aparte se queda mal puesta el día que se cambia la clave, y
    // entonces se ofrecería tarjeta en real sin que nadie lo note.
    const fuente = fs.readFileSync(
      path.join(__dirname, "billing-checkout-handler.js"), "utf8"
    );
    assert.match(fuente, /includes\("_test_"\)/);
  });

  test("y una clave restringida de prueba cuenta como prueba", () => {
    // Empieza por `rk_`, no por `sk_`. Con el prefijo entero, una `rk_test_` se
    // tomaba por real y dejaba la prueba sin ninguna forma de pagar.
    const { formasDePago } = require("./billing-checkout-handler.js");
    assert.equal(formasDePago("rk_test_x")["payment_method_types[0]"], "card");
    assert.equal(formasDePago("rk_live_x")["payment_method_types[0]"], "customer_balance");
  });
});
