/**
 * Un cobro, una factura.
 *
 * La fianza se anota por dos caminos: el aviso de Stripe y la vuelta del pago.
 * Están los dos a propósito —si uno falla, el cliente no se queda pagando sin
 * que conste— pero a veces llegan los dos, y entonces el riesgo es el contrario:
 * emitir dos facturas y mandar dos correos por el mismo dinero. En una serie
 * numerada eso además quema un número para nada.
 *
 * Quien marca es exactamente uno: el `UPDATE` solo toca la solicitud si la
 * fianza estaba sin marcar, y el que llega segundo se para ahí.
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
process.env.BILLING_STORE_PATH = path.join(os.tmpdir(), `popcar-fianza-cobro-una-vez-${process.pid}.json`);
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";

const LEAD = "imp-1";
const CLIENTE = "cliente@ejemplo.es";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Cómo está la solicitud en la base. */
let yaPagada;
/** Lo que ha ido pasando. */
let facturasEmitidas;
let correosMandados;
let numerosPedidos;

beforeEach(() => {
  yaPagada = false;
  facturasEmitidas = [];
  correosMandados = [];
  numerosPedidos = 0;

  Pool.prototype.query = async (sql, params) => {
    const t = String(sql || "");
    if (/UPDATE moveadvisor_market_leads/i.test(t) && /deposit_paid_at/.test(t)) {
      // La condición que hace que solo marque uno.
      const marcaAhora = /deposit_paid_at IS NULL/.test(t) ? !yaPagada : true;
      if (marcaAhora) yaPagada = true;
      return marcaAhora
        ? { rows: [{ vehicle_title: "Volkswagen Golf" }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/invoice_counters/i.test(t)) {
      numerosPedidos += 1;
      return { rows: [{ ultimo: numerosPedidos }], rowCount: 1 };
    }
    if (/INSERT INTO moveadvisor_user_invoices/i.test(t)) {
      // $5 es el importe y $8 la descripción, según el INSERT del emisor.
      facturasEmitidas.push({ id: params[0], importe: params[4], descripcion: params[7] });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    const u = String(url);
    if (u.includes("resend.com")) {
      correosMandados.push(JSON.parse(opciones.body).subject || "");
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    if (u.includes("supabase")) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const { depositoRecibido } = require("./billing-webhook-handler.js");

// `fee` es lo único que se factura: el resto del depósito es dinero del
// vendedor alemán que está de paso por nuestra cuenta.
const COBRO = { leadId: LEAD, email: CLIENTE, importe: 20999, fee: 2999, sessionId: "cs_1", cobroRef: "pi_1" };

describe("el depósito se anota una sola vez", { concurrency: 1 }, () => {
  test("el primer aviso la marca y emite su factura", async () => {
    await depositoRecibido(COBRO);
    assert.equal(yaPagada, true);
    assert.equal(facturasEmitidas.length, 1);
  });

  test("el segundo no emite otra factura ni manda otro correo", async () => {
    await depositoRecibido(COBRO);
    const trasElPrimero = { facturas: facturasEmitidas.length, correos: correosMandados.length };

    await depositoRecibido(COBRO);
    assert.equal(facturasEmitidas.length, trasElPrimero.facturas,
      "dos facturas por el mismo dinero, y un número de serie quemado para nada");
    assert.equal(correosMandados.length, trasElPrimero.correos,
      "el cliente recibiría dos veces la factura del mismo servicio");
  });

  test("y tampoco pide otro número de serie", async () => {
    await depositoRecibido(COBRO);
    const tras = numerosPedidos;
    await depositoRecibido(COBRO);
    assert.equal(numerosPedidos, tras);
  });

  test("sin saber de qué solicitud es, no se toca nada", async () => {
    await depositoRecibido({ ...COBRO, leadId: "" });
    assert.equal(yaPagada, false);
    assert.equal(facturasEmitidas.length, 0);
  });
});

/**
 * Se factura el servicio, no el depósito.
 *
 * De los 20.999 € que ingresa, 18.000 son del concesionario alemán y están de
 * paso. Facturarlos sería declarar la venta de un coche que no hemos vendido.
 */
describe("qué se factura de un depósito", { concurrency: 1 }, () => {
  test("solo lo nuestro", async () => {
    await depositoRecibido(COBRO);
    assert.equal(facturasEmitidas.length, 1);
    assert.equal(Number(facturasEmitidas[0].importe), 2999,
      "se estaría facturando el coche del vendedor alemán");
  });

  test("y se dice que es un servicio", async () => {
    await depositoRecibido(COBRO);
    assert.match(String(facturasEmitidas[0].descripcion), /servicio de importaci/i);
  });

  test("sin fee no se emite factura, pero el dinero se marca igual", async () => {
    // Una solicitud vieja, de antes del cambio de modelo, no tiene ese dato.
    // Marcar el dinero es lo que no puede fallar; la factura se arregla luego.
    await depositoRecibido({ ...COBRO, fee: 0 });
    assert.equal(yaPagada, true);
    assert.equal(facturasEmitidas.length, 0);
  });
});
