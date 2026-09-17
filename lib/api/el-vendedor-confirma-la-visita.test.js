/**
 * En el coche de un particular, la visita la confirma el vendedor.
 *
 * No el equipo desde el ERP: eso es para concesionario, renting e importación,
 * donde hay que llamar a alguien. El particular es quien enseña el coche, en su
 * casa y a su hora, y quien sabe si esa mañana puede.
 *
 * Se recorre el camino entero sobre el manejador de verdad, con la base y el
 * correo simulados:
 *
 *   1. Alguien pide la visita → al vendedor le llega para contestarla.
 *   2. El vendedor la abre con su enlace → ve el nombre, no el teléfono.
 *   3. La confirma → queda confirmada, con calendario para los dos.
 *   4. O propone otras horas → al comprador le llegan para elegir.
 *   5. O la rechaza → al comprador se le dice que elija otra.
 *
 * Y lo que se cerró de paso: la lista de visitas de un coche no se le da a
 * cualquiera que sepa el id del anuncio.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.OPS_EMAIL = "equipo@example.com";

const OFERTA = "idcar-veh-1";
const VENDEDOR = "vendedor@example.com";
const COMPRADOR = "comprador@example.com";
const MANANA = new Date(Date.now() + 2 * 86400000);
MANANA.setUTCHours(8, 0, 0, 0);
const FIN = new Date(MANANA.getTime() + 4 * 3600000);

let reserva;
let pasos;
let correos;
let propuestas;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

function reinicia() {
  reserva = {
    id: "b-1", offer_id: OFERTA, vehicle_title: "Volkswagen T-Roc",
    starts_at: MANANA.toISOString(), ends_at: FIN.toISOString(),
    buyer_email: COMPRADOR, buyer_name: "Sergio", buyer_phone: "600000000",
    seller_email: VENDEDOR, status: "pending", availability_id: "s-1",
    token_buyer: "t-comprador", token_seller: "t-vendedor", notes: "Voy con mi hermano",
    source: "marketplace", meeting_place: "", meeting_contact: "",
  };
  pasos = [];
  correos = [];
  propuestas = [];
}

before(() => {
  Pool.prototype.query = function (sql, params) {
    const t = String(sql || "");
    const p = params || [];
    const responde = (rows) => Promise.resolve({ rows, rowCount: rows.length });

    if (/INSERT INTO visit_booking_events/i.test(t)) {
      const m = t.match(/VALUES\s*\(\$1,'([a-z_]+)','([a-z_]+)'/i);
      const datos = JSON.parse(String(p[1] || "{}"));
      pasos.push({ evento: m && m[1], actor: m && m[2], datos });
      if (m && m[1] === "horas_propuestas") propuestas = datos.horas;
      return responde([]);
    }
    if (/FROM visit_booking_events/i.test(t)) return responde(propuestas.length ? [{ datos: { horas: propuestas } }] : []);
    if (/FROM moveadvisor_user_vehicles WHERE id = \$1 AND lower\(user_email\)/i.test(t)) {
      return responde(String(p[1]).toLowerCase() === VENDEDOR && p[0] === "veh-1" ? [{ "?column?": 1 }] : []);
    }
    if (/FROM vehicle_visit_bookings b\s+LEFT JOIN moveadvisor_user_vehicles/i.test(t)) {
      if (p[1] !== reserva.token_seller) return responde([]);
      return responde([{ ...reserva, vehicle_location: "Madrid" }]);
    }
    // ¿Esa hora la tiene otro? No, en esta historia.
    if (/SELECT id FROM vehicle_visit_bookings/i.test(t) && /id != /i.test(t)) return responde([]);
    if (/INSERT INTO vehicle_visit_availability/i.test(t)) return responde([{ id: "s-nuevo" }]);
    if (/FROM vehicle_visit_bookings/i.test(t) && /SELECT/i.test(t)) {
      if (/token_seller = \$2/.test(t) && !/token_buyer/.test(t) && p[1] !== reserva.token_seller) return responde([]);
      if (/\(token_buyer = \$2 OR token_seller = \$2\)/.test(t) && p[1] !== reserva.token_buyer && p[1] !== reserva.token_seller) return responde([]);
      return responde([{ ...reserva }]);
    }
    if (/UPDATE vehicle_visit_bookings/i.test(t)) {
      if (/status = 'confirmed'/i.test(t)) { reserva.status = "confirmed"; reserva.meeting_place = p[1]; reserva.meeting_contact = p[2]; }
      if (/status = 'cancelled'/i.test(t)) reserva.status = "cancelled";
      return responde([{ ...reserva }]);
    }
    return responde([]);
  };
  Pool.prototype.connect = async function () {
    return { query: Pool.prototype.query.bind(this), release() {} };
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      const c = JSON.parse(opciones.body);
      correos.push({ to: String(c.to), subject: String(c.subject), html: String(c.html), calendario: (c.attachments || []).length > 0 });
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return fetchOriginal(url, opciones);
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => reinicia());

const handler = require("./visit-availability-handler.js");

async function llama(metodo, route, datos = {}, { sesion = "" } = {}) {
  process.env.AUTH_BILLING_REQUIRE_SESSION = "false";
  const req = {
    method: metodo, headers: {},
    query: metodo === "GET" ? { route, ...datos, ...(sesion ? { email: sesion } : {}) } : { route },
    body: metodo === "GET" ? {} : { route, ...datos },
  };
  const salida = { codigo: 200, cuerpo: null };
  const res = {
    status(c) { salida.codigo = c; return res; },
    json(b) { salida.cuerpo = b; return res; },
    setHeader() { return res; }, end() { return res; },
  };
  await handler(req, res);
  return salida;
}

const a = (quien) => correos.filter((c) => c.to === quien);

describe("el vendedor abre su enlace", () => {
  test("ve la visita con el nombre y lo que escribió, sin teléfono ni correo", async () => {
    const r = await llama("GET", "vendedor", { bookingId: "b-1", token: "t-vendedor" });
    assert.equal(r.codigo, 200);
    const b = r.cuerpo.booking;
    assert.equal(b.buyer_name, "Sergio");
    assert.equal(b.notes, "Voy con mi hermano");
    assert.equal(b.buyer_phone, undefined);
    assert.equal(b.buyer_email, undefined);
    assert.equal(r.cuerpo.donde_sugerido, "Madrid", "lo que ya sabemos de dónde está el coche");
  });

  test("con el testigo del comprador no entra", async () => {
    const r = await llama("GET", "vendedor", { bookingId: "b-1", token: "t-comprador" });
    assert.equal(r.codigo, 404);
  });
});

describe("el vendedor confirma", () => {
  test("queda confirmada, y a los dos les llega con calendario", async () => {
    const r = await llama("POST", "vendedor_confirma", { bookingId: "b-1", token: "t-vendedor", donde: "Calle Mayor 1, Madrid", preguntarPor: "Ana" });
    assert.equal(r.codigo, 200);
    assert.equal(reserva.status, "confirmed");
    assert.equal(reserva.meeting_place, "Calle Mayor 1, Madrid");

    const alComprador = a(COMPRADOR)[0];
    assert.match(alComprador.subject, /confirmada/);
    assert.ok(alComprador.calendario, "el comprador no recibe el calendario");
    assert.match(alComprador.html, /Calle Mayor 1/);
    assert.match(alComprador.html, /de 10:00 a 14:00/);

    const alVendedor = a(VENDEDOR)[0];
    assert.ok(alVendedor && alVendedor.calendario, "el vendedor no recibe su calendario");
    assert.ok(!alVendedor.html.includes("600000000"), "le pasamos el teléfono del comprador");
  });

  test("queda dicho en el rastro que la confirmó él", async () => {
    await llama("POST", "vendedor_confirma", { bookingId: "b-1", token: "t-vendedor", donde: "Madrid" });
    const paso = pasos.find((x) => x.evento === "confirmada");
    assert.equal(paso.actor, "vendedor");
  });

  test("sin decir dónde, no: el comprador tiene que saber llegar", async () => {
    const r = await llama("POST", "vendedor_confirma", { bookingId: "b-1", token: "t-vendedor", donde: "  " });
    assert.equal(r.codigo, 400);
    assert.equal(reserva.status, "pending");
  });

  test("una ya confirmada no se vuelve a confirmar", async () => {
    reserva.status = "confirmed";
    const r = await llama("POST", "vendedor_confirma", { bookingId: "b-1", token: "t-vendedor", donde: "Madrid" });
    assert.equal(r.codigo, 409);
  });

  test("con el testigo del comprador, no", async () => {
    const r = await llama("POST", "vendedor_confirma", { bookingId: "b-1", token: "t-comprador", donde: "Madrid" });
    assert.equal(r.codigo, 404);
    assert.equal(reserva.status, "pending");
  });
});

describe("el vendedor propone otras horas", () => {
  const h1 = new Date(Date.now() + 3 * 86400000).toISOString();
  const h2 = new Date(Date.now() + 4 * 86400000).toISOString();

  test("al comprador le llegan para elegir, con su enlace", async () => {
    const r = await llama("POST", "vendedor_propone", { bookingId: "b-1", token: "t-vendedor", horas: [h1, h2] });
    assert.equal(r.codigo, 200);
    const suyo = a(COMPRADOR)[0];
    assert.match(suyo.subject, /Te proponen otra hora/);
    assert.ok(suyo.html.includes("/elegir-hora?id=b-1&amp;token=t-comprador") || suyo.html.includes("/elegir-hora?id=b-1&token=t-comprador"));
  });

  test("se apuntan como las propone el ERP, para que el comprador elija igual", async () => {
    await llama("POST", "vendedor_propone", { bookingId: "b-1", token: "t-vendedor", horas: [h1] });
    const paso = pasos.find((x) => x.evento === "horas_propuestas");
    assert.equal(paso.actor, "vendedor");
    assert.deepEqual(paso.datos.horas, [h1]);
  });

  test("las que ya han pasado no valen", async () => {
    const r = await llama("POST", "vendedor_propone", { bookingId: "b-1", token: "t-vendedor", horas: ["2020-01-01T10:00:00Z"] });
    assert.equal(r.codigo, 400);
  });

  test("y cuando el comprador elige, se le cuenta al vendedor, no al equipo", async () => {
    await llama("POST", "vendedor_propone", { bookingId: "b-1", token: "t-vendedor", horas: [h1] });
    correos = [];
    const r = await llama("POST", "elegir_hora", { bookingId: "b-1", token: "t-comprador", startsAt: h1 });
    assert.equal(r.codigo, 200);
    assert.ok(a(VENDEDOR).length, "el vendedor no se entera de la hora que ha elegido");
    assert.ok(!a("equipo@example.com").some((c) => /Ha elegido hora/.test(c.subject)), "se le pide al equipo que avise al vendedor");
  });
});

describe("el vendedor la rechaza", () => {
  test("al comprador se le dice que elija otra, y queda en el rastro", async () => {
    const r = await llama("POST", "cancel", { bookingId: "b-1", token: "t-vendedor" });
    assert.equal(r.codigo, 200);
    assert.match(a(COMPRADOR)[0].subject, /no puede ser/);
    assert.equal(pasos.find((x) => x.evento === "cancelada").actor, "vendedor");
  });
});

describe("la lista de visitas de un coche", () => {
  test("sin sesión, no se da", async () => {
    process.env.AUTH_BILLING_REQUIRE_SESSION = "true";
    const req = { method: "GET", headers: {}, query: { route: "bookings", offerId: OFERTA }, body: {} };
    const salida = { codigo: 200 };
    const res = { status(c) { salida.codigo = c; return res; }, json() { return res; }, setHeader() { return res; } };
    await handler(req, res);
    assert.equal(salida.codigo, 401);
  });

  test("a otro que no es el dueño, tampoco", async () => {
    const r = await llama("GET", "bookings", { offerId: OFERTA }, { sesion: "otro@example.com" });
    assert.equal(r.codigo, 403);
  });

  test("al dueño sí, sin el correo ni el teléfono de nadie", async () => {
    const r = await llama("GET", "bookings", { offerId: OFERTA }, { sesion: VENDEDOR });
    assert.equal(r.codigo, 200);
    const b = r.cuerpo.bookings[0];
    assert.equal(b.buyer_name, "Sergio");
    assert.equal(b.buyer_email, undefined);
    assert.equal(b.buyer_phone, undefined);
    assert.equal(b.token_buyer, undefined, "con el testigo del comprador se le cancela la visita");
  });
});
