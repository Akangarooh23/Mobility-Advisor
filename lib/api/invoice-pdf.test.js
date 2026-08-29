/**
 * La factura en PDF: quién puede verla y por dónde sale.
 *
 * El PDF guardado vivía en una dirección pública del almacén, y esta ruta —que
 * sí mira quién pregunta— acababa mandando al cliente allí con un `redirect`.
 * La sesión protegía la consulta y el fichero no: quien tuviera el enlace lo
 * abría sin ser nadie, y las rutas llevan el número de factura dentro, que va
 * seguido.
 *
 * Lo que se comprueba aquí es que el fichero salga por esta ruta y que su
 * dirección no llegue nunca al navegador.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.SUPABASE_SERVICE_KEY = "clave-de-mentira";
// Sin esto la ruta admitiría el correo de la URL y no haría falta sesión.
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const FACTURA = {
  id: "inv-1",
  email: "cliente@example.com",
  number: "SUBS-2026-0001",
  cw_invoice_number: "SUBS-2026-0001",
  amount: 10,
  date: new Date("2026-02-01T00:00:00Z"),
  cw_pdf_url: "",
  pdf_url: "",
};

let guardada = null;
let loQuePidio = [];
const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    return responde(guardada ? [guardada] : []);
  };
  global.fetch = async (url, opciones) => {
    loQuePidio.push({ url: String(url), cabeceras: opciones?.headers || {} });
    return {
      ok: true, status: 200,
      arrayBuffer: async () => Buffer.from("%PDF-1.4 de mentira"),
      json: async () => ({}), text: async () => "",
    };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => {
  guardada = { ...FACTURA };
  loQuePidio = [];
});

const handler = require("./invoice-pdf-handler.js");

/** Pide la factura y devuelve lo que hizo la ruta. */
async function pide() {
  const req = {
    method: "GET",
    headers: {},
    query: { id: FACTURA.id, email: FACTURA.email },
  };
  const salida = { codigo: 200, cabeceras: {}, redirigidoA: null, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader(k, v) { salida.cabeceras[k.toLowerCase()] = v; return res; },
    redirect(c, url) { salida.codigo = c; salida.redirigidoA = url; return res; },
    end(b) { salida.cuerpo = b; return res; },
  };
  await handler(req, res);
  return salida;
}

describe("un PDF nuestro guardado en el almacén", () => {
  const NUESTRA = "https://x.supabase.co/storage/v1/object/public/vehicle-files/cw-invoices/subs/SUBS-2026-0001-ab12.pdf";

  test("sale por esta ruta, no se manda al cliente al almacén", async () => {
    guardada.cw_pdf_url = NUESTRA;
    const r = await pide();
    assert.equal(r.redirigidoA, null, "un redirect deja el fichero abierto a cualquiera que copie el enlace");
    assert.equal(r.cabeceras["content-type"], "application/pdf");
    assert.ok(r.cuerpo && r.cuerpo.length, "y con el PDF dentro");
  });

  test("se pide con la clave del servidor y por la dirección privada", async () => {
    guardada.cw_pdf_url = NUESTRA;
    await pide();
    const pedido = loQuePidio.find((p) => p.url.includes("supabase.co"));
    assert.ok(pedido, "hay que ir a buscarlo");
    assert.ok(!pedido.url.includes("/object/public/"), "por la privada: así sigue valiendo cuando el cubo se cierre");
    assert.match(String(pedido.cabeceras.Authorization || ""), /Bearer /);
  });

  test("no se guarda en la caché del navegador", async () => {
    guardada.cw_pdf_url = NUESTRA;
    const r = await pide();
    assert.match(String(r.cabeceras["cache-control"] || ""), /no-store/);
  });
});

describe("un PDF que no es nuestro", () => {
  test("a Stripe sí se le manda: su enlace ya es la llave", async () => {
    guardada.pdf_url = "https://pay.stripe.com/invoice/acct_1/test_YWNjdF8x/pdf?s=ap";
    const r = await pide();
    assert.equal(r.codigo, 302);
    assert.match(String(r.redirigidoA), /stripe\.com/);
  });
});

describe("sin factura no hay nada que dar", () => {
  test("una factura que no es suya no aparece", async () => {
    guardada = null;
    const r = await pide();
    assert.equal(r.codigo, 404);
  });
});
