/**
 * Al pedir una importación, el correo sale antes de contestar.
 *
 * La pantalla dice «te hemos mandado un correo con los datos» y no llegaba
 * nada. El envío se lanzaba sin esperarlo, con un comentario que decía «en
 * background — no bloqueamos la respuesta»: eso en una función serverless no
 * existe, porque la instancia se apaga en cuanto responde y lo que quede a
 * medias se queda a medias. Encima `fetch` no falla con un 400, así que un
 * rechazo de Resend tampoco se veía en ningún sitio.
 *
 * Lo que se comprueba aquí es el orden: cuando la respuesta sale, el correo ya
 * está pedido. Y que un fallo del correo no tire la solicitud, que ya está
 * guardada.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { precioPuestoAqui } = require("../coste-importacion.js");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "re_de_mentira";
// Fuera de producción vale el correo del cuerpo: así no hay que montar una
// sesión de verdad solo para comprobar el orden de los envíos.
process.env.AUTH_BILLING_REQUIRE_SESSION = "false";

const OFERTA = "of-1";
const CLIENTE = "cliente@ejemplo.es";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

/** Lo que ha ido pasando, en orden. */
let sucesos = [];
/** Qué contesta Resend. */
let resendResponde = { ok: true, status: 200, cuerpo: { id: "correo-1" } };

beforeEach(() => {
  sucesos = [];
  resendResponde = { ok: true, status: 200, cuerpo: { id: "correo-1" } };

  Pool.prototype.query = async (sql) => {
    const t = String(sql || "");
    if (/FROM moveadvisor_market_offers/i.test(t)) {
      return { rows: [{ title: "Kia Picanto 1.0", price: 9000, import_cost: 2800, market_price_es: 13000, year: 2020, mileage: 60000 }], rowCount: 1 };
    }
    if (/INSERT INTO moveadvisor_market_leads/i.test(t)) {
      sucesos.push("solicitud guardada");
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  global.fetch = async (url, opciones) => {
    if (String(url).includes("api.resend.com")) {
      const c = JSON.parse(opciones.body);
      sucesos.push(`correo a ${Array.isArray(c.to) ? c.to[0] : c.to}`);
      return {
        ok: resendResponde.ok,
        status: resendResponde.status,
        json: async () => resendResponde.cuerpo,
        text: async () => JSON.stringify(resendResponde.cuerpo),
      };
    }
    return fetchOriginal(url, opciones);
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./import-lead-handler.js");


/** Pide la importación y devuelve lo que se le contesta al navegador. */
async function pideImportacion(cuerpo = {}) {
  let respuesta = null;
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json(b) { sucesos.push("respuesta al navegador"); respuesta = { codigo: res._codigo, ...b }; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  await handler({
    method: "POST",
    headers: {},
    body: { offer_id: OFERTA, email: CLIENTE, name: "Ana", phone: "600000000", ...cuerpo },
  }, res);
  return respuesta;
}

describe("el correo de la solicitud de importación", { concurrency: 1 }, () => {
  test("sale antes de contestarle al navegador", async () => {
    const r = await pideImportacion();
    assert.equal(r.ok, true);
    const contesta = sucesos.indexOf("respuesta al navegador");
    const correo = sucesos.findIndex((s) => s.startsWith("correo a"));
    assert.ok(correo !== -1, "no se ha mandado ningún correo");
    assert.ok(correo < contesta,
      `el correo tiene que estar pedido antes de responder, y el orden fue: ${sucesos.join(" → ")}`);
  });

  test("le llega al cliente, y también el aviso interno", async () => {
    await pideImportacion();
    assert.ok(sucesos.includes(`correo a ${CLIENTE}`), sucesos.join(" → "));
    assert.equal(sucesos.filter((s) => s.startsWith("correo a")).length, 2,
      "son dos: la confirmación al cliente y el aviso al equipo");
  });

  test("si Resend lo rechaza, la solicitud no se pierde y se dice que el correo no salió", async () => {
    resendResponde = { ok: false, status: 403, cuerpo: { message: "dominio sin verificar" } };
    const r = await pideImportacion();
    assert.equal(r.ok, true, "la solicitud ya estaba guardada: no se tira por un correo");
    assert.equal(r.correoEnviado, false, "y se dice, en vez de dar por bueno un envío que no ha ido");
    assert.ok(sucesos.includes("solicitud guardada"));
  });

  test("sin clave de Resend tampoco se da por mandado", async () => {
    const previa = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const r = await pideImportacion();
      assert.equal(r.correoEnviado, false);
    } finally {
      process.env.RESEND_API_KEY = previa;
    }
  });

  test("cuando todo va bien, se dice que sí", async () => {
    const r = await pideImportacion();
    assert.equal(r.correoEnviado, true);
    // El coche entero, nuestro fee y el impuesto: exactamente lo que se le
    // enseñó en la ficha. No un porcentaje —el coche se lo compra él al vendedor
    // alemán, así que ese dinero tiene que estar— y no sin el impuesto, porque
    // entonces habría que pedírselo después con el coche ya de camino.
    const { precioPuestoAqui } = require("../coste-importacion.js");
    assert.equal(r.deposit, Math.round(precioPuestoAqui(9000, 13000)));
  });
});

