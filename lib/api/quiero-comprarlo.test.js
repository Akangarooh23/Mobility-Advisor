/**
 * «Quiero comprarlo»: el comprador se queda el coche de un particular.
 *
 * Se recorre el manejador de verdad con la base y el correo simulados. Lo que
 * se protege:
 *
 *   · Que empieza la venta: la visita pasa a «compró», el encargo guarda sus
 *     datos para el contrato y la financiación, y el anuncio se reserva.
 *   · Que el DNI se comprueba, letra incluida.
 *   · Que gana el primero: otro comprador del mismo coche ya no puede.
 *   · Que no se compra lo que no es de un particular ni una visita que no fue.
 *   · Que se entera cada uno: comprador, vendedor y equipo.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const C = require("../quiero-comprarlo");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.OPS_EMAIL = "equipo@example.com";

const HACE_UNA_HORA = new Date(Date.now() - 3600000).toISOString();

let visita;
let encargo;
let oferta;
let pasos;
let correos;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "");
    const r = (rows) => ({ rows, rowCount: rows.length });
    if (/ALTER TABLE erp_encargos_venta/.test(t) || /^(BEGIN|COMMIT|ROLLBACK)$/.test(t.trim())) return r([]);
    if (/FROM vehicle_visit_bookings b\s+LEFT JOIN erp_encargos_venta e/.test(t)) {
      if (p[0] !== visita.id || p[1] !== visita.token_buyer) return r([]);
      return r([{
        ...visita,
        encargo_id: encargo ? encargo.id : null,
        cliente_nombre: "Ana", cliente_email: "vendedor@example.com",
        venta_estado: encargo?.venta_estado ?? null,
        venta_booking_id: encargo?.venta_booking_id ?? null,
        precio: encargo ? 17900 : null, precio_anuncio: 17900,
      }]);
    }
    if (/UPDATE vehicle_visit_bookings/.test(t)) { visita.resultado = "compro"; visita.quiere_financiar = p[1]; return r([]); }
    if (/INSERT INTO visit_booking_events/.test(t)) { pasos.push(JSON.parse(p[1])); return r([]); }
    if (/UPDATE erp_encargos_venta/.test(t)) {
      Object.assign(encargo, {
        venta_estado: "en_curso", venta_booking_id: p[1], comprador_nombre: p[2], comprador_dni: p[3],
        comprador_domicilio: p[4], comprador_email: p[5], comprador_telefono: p[6], precio_venta: p[7],
        venta_financia: p[8], financiacion_estado: p[9],
      });
      return r([]);
    }
    if (/UPDATE moveadvisor_marketplace_vo_offers SET is_active = FALSE/.test(t)) { oferta.is_active = false; return r([]); }
    return r([]);
  };
  Pool.prototype.connect = async function () { return { query: Pool.prototype.query.bind(this), release() {} }; };
  global.fetch = async (_u, o) => { const c = JSON.parse(o.body); correos.push({ to: c.to, subject: c.subject, html: c.html }); return { ok: true, json: async () => ({}) }; };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => {
  visita = {
    id: "b-1", token_buyer: "t-comprador", offer_id: "idcar-veh-1", vehicle_title: "Volkswagen T-Roc",
    starts_at: HACE_UNA_HORA, ends_at: HACE_UNA_HORA, status: "confirmed", resultado: null,
    buyer_name: "Sergio", buyer_email: "comprador@example.com", buyer_phone: "600000000",
    seller_email: "vendedor@example.com", quiere_financiar: false,
  };
  encargo = { id: "enc-1", venta_estado: null, venta_booking_id: null };
  oferta = { id: "idcar-veh-1", is_active: true };
  pasos = [];
  correos = [];
});

const handler = require("./visit-availability-handler.js");

async function llama(metodo, datos) {
  const req = { method: metodo, headers: {}, query: metodo === "GET" ? datos : { route: datos.route }, body: metodo === "GET" ? {} : datos };
  const salida = { codigo: 200, cuerpo: null };
  const res = { status(c) { salida.codigo = c; return res; }, json(b) { salida.cuerpo = b; return res; }, setHeader() { return res; } };
  await handler(req, res);
  return salida;
}

const compra = (extra = {}) => llama("POST", {
  route: "quiero_comprarlo", bookingId: "b-1", token: "t-comprador",
  dni: "12345678Z", direccion: "Calle Mayor 1, 2ºA", codigoPostal: "28013", ciudad: "Madrid", financia: false,
  ...extra,
});

describe("el DNI o NIE", () => {
  test("con su letra buena vale, en mayúsculas y sin espacios", () => {
    assert.equal(C.elDocumento("12345678z"), "12345678Z");
    assert.equal(C.elDocumento("1234 5678-Z"), "12345678Z");
    assert.equal(C.elDocumento("X1234567L"), "X1234567L");
  });

  test("con la letra mal, no: Tráfico lo devolvería semanas después", () => {
    assert.equal(C.elDocumento("12345678A"), "");
    assert.equal(C.elDocumento("X1234567A"), "");
    assert.equal(C.elDocumento("1234"), "");
  });
});

describe("quiero comprarlo", () => {
  test("empieza la venta, con los datos para el contrato", async () => {
    const r = await compra();
    assert.equal(r.codigo, 200);
    assert.equal(visita.resultado, "compro");
    assert.equal(encargo.venta_estado, "en_curso");
    assert.equal(encargo.venta_booking_id, "b-1");
    assert.equal(encargo.comprador_dni, "12345678Z");
    assert.equal(encargo.comprador_domicilio, "Calle Mayor 1, 2ºA, 28013 Madrid");
    assert.equal(encargo.comprador_nombre, "Sergio");
    assert.equal(encargo.precio_venta, 17900);
  });

  test("y el anuncio queda reservado", async () => {
    await compra();
    assert.equal(oferta.is_active, false);
  });

  test("si financia, la financiación queda en estudio", async () => {
    await compra({ financia: true });
    assert.equal(encargo.venta_financia, true);
    assert.equal(encargo.financiacion_estado, "en_estudio");
    assert.equal(visita.quiere_financiar, true);
  });

  test("si no financia, no hay nada en estudio", async () => {
    await compra({ financia: false });
    assert.equal(encargo.financiacion_estado, null);
  });

  test("se enteran el comprador, el vendedor y el equipo", async () => {
    await compra({ financia: true });
    const a = (quien) => correos.find((c) => c.to === quien);
    assert.match(a("comprador@example.com").subject, /Nos ponemos con tu compra/);
    assert.match(a("comprador@example.com").html, /Primero, tu financiación/);
    assert.match(a("vendedor@example.com").subject, /Hay un comprador para tu coche/);
    assert.match(a("vendedor@example.com").html, /No lo enseñes a nadie más/);
    assert.ok(!a("vendedor@example.com").html.includes("12345678Z"), "al vendedor le llega el DNI del comprador");
    assert.match(a("equipo@example.com").subject, /Venta en curso/);
  });

  test("con un DNI mal, no se guarda nada", async () => {
    const r = await compra({ dni: "12345678A" });
    assert.equal(r.codigo, 400);
    assert.match(r.cuerpo.error, /DNI o NIE/);
    assert.equal(encargo.venta_estado, null);
  });

  test("gana el primero: otro comprador del mismo coche ya no puede", async () => {
    encargo.venta_estado = "en_curso";
    encargo.venta_booking_id = "b-otra";
    const r = await compra();
    assert.equal(r.codigo, 409);
    assert.match(r.cuerpo.error, /ya tiene una compra en curso/);
  });

  test("volver a enviarlo el mismo comprador no hace nada dos veces", async () => {
    encargo.venta_estado = "en_curso";
    encargo.venta_booking_id = "b-1";
    const r = await compra();
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.ya_estaba, true);
    assert.equal(correos.length, 0);
  });

  test("una visita que todavía no ha sido, no", async () => {
    visita.starts_at = new Date(Date.now() + 86400000).toISOString();
    assert.equal((await compra()).codigo, 409);
  });

  test("el coche de un concesionario no se compra desde aquí", async () => {
    visita.offer_id = "erp-9";
    visita.seller_email = null;
    assert.equal((await compra()).codigo, 409);
  });

  test("si ya dijo que no fue, tampoco", async () => {
    visita.resultado = "no_fue";
    assert.equal((await compra()).codigo, 409);
  });

  test("con el testigo de otro, no se encuentra", async () => {
    const r = await llama("GET", { route: "compra", bookingId: "b-1", token: "otro" });
    assert.equal(r.codigo, 404);
  });
});
