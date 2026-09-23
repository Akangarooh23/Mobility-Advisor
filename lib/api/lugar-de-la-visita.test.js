/**
 * Dónde enseña el vendedor su coche: se pone una vez, no en cada visita.
 *
 * Antes la casilla «dónde» solo existía dentro de la confirmación: con tres
 * compradores la escribía tres veces, y si un día la escribía distinta, cada
 * uno recibía una dirección diferente del mismo coche.
 *
 * Se recorre el manejador de verdad con la base y el correo simulados. Lo que
 * se protege: que se guarde, que no se guarde una dirección a la que no se
 * puede ir, que salga sola al confirmar, y —lo que más— que no la pueda leer
 * nadie más que su dueño.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const L = require("../lugar-de-la-visita");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";

const DENTRO_DE_UNA_HORA = new Date(Date.now() + 3600000).toISOString();

let guardado;      // la fila de vehicle_visit_places
let visita;        // la visita pendiente que el vendedor contesta
let esSuyo;        // si el coche es de quien pregunta
let correos;

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = async function (sql, p = []) {
    const t = String(sql || "").replace(/\s+/g, " ");
    const r = (rows) => ({ rows, rowCount: rows.length });
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(t.trim())) return r([]);
    if (/CREATE TABLE IF NOT EXISTS vehicle_visit_places/.test(t)) return r([]);

    /*
     * De quién es el coche: las dos maneras en que el manejador lo pregunta.
     * Se reconoce por el «SELECT 1», porque la consulta que trae la visita para
     * el vendedor también nombra esa tabla en un LEFT JOIN y sin esto se
     * quedaba con esta rama.
     */
    if (/SELECT 1 FROM moveadvisor_user_vehicles/.test(t)) return r(esSuyo ? [{ "?column?": 1 }] : []);

    // La visita tal como la abre el vendedor desde su enlace.
    if (/FROM vehicle_visit_bookings b LEFT JOIN moveadvisor_user_vehicles/.test(t)) {
      return r(p[1] === visita.token_seller ? [{ ...visita, vehicle_location: "Madrid" }] : []);
    }

    if (/SELECT offer_id, direccion.*FROM vehicle_visit_places/.test(t)) {
      return r(guardado && guardado.offer_id === p[0] ? [guardado] : []);
    }
    if (/INSERT INTO vehicle_visit_places/.test(t)) {
      guardado = {
        offer_id: p[0], direccion: p[1], codigo_postal: p[2],
        ciudad: p[3], contacto: p[4], notas: p[5], updated_at: new Date(),
      };
      return r([guardado]);
    }

    // La visita que el vendedor contesta desde su enlace.
    if (/FROM vehicle_visit_bookings WHERE id = \$1 AND token_seller = \$2/.test(t)) {
      return r(p[1] === visita.token_seller ? [visita] : []);
    }
    if (/UPDATE vehicle_visit_bookings SET status = 'confirmed'/.test(t)) {
      Object.assign(visita, { status: "confirmed", meeting_place: p[1], meeting_contact: p[2] });
      return r([visita]);
    }
    if (/INSERT INTO visit_booking_events/.test(t)) return r([]);
    if (/FROM visit_booking_events/.test(t)) return r([]);
    return r([]);
  };
  Pool.prototype.connect = async function () {
    return { query: Pool.prototype.query.bind(this), release() {} };
  };
  global.fetch = async (_u, o) => {
    const c = JSON.parse(o.body);
    correos.push({ to: c.to, subject: c.subject, html: c.html });
    return { ok: true, json: async () => ({}) };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
  global.fetch = fetchOriginal;
});

beforeEach(() => {
  guardado = null;
  esSuyo = true;
  correos = [];
  visita = {
    id: "b-1", offer_id: "idcar-veh-1", token_seller: "t-vendedor", token_buyer: "t-comprador",
    vehicle_title: "Volkswagen T-Roc", starts_at: DENTRO_DE_UNA_HORA, ends_at: DENTRO_DE_UNA_HORA,
    status: "pending", buyer_name: "Sergio", buyer_email: "comprador@example.com",
    seller_email: "vendedor@example.com", meeting_place: null, meeting_contact: null,
  };
});

/*
 * La sesión: el manejador resuelve quién pregunta con `identidad`. Se le da un
 * correo por la cabecera y ya; de quién es el coche lo decide `esSuyo`.
 *
 * El orden importa: el manejador desestructura `identidadDeLaPeticion` al
 * cargarse, así que hay que cambiarla **antes** de pedirlo. Con el `require`
 * por delante, se queda con la de verdad y todo contesta 401.
 */
const IDENT = require("./identidad");
const identidadOriginal = IDENT.identidadDeLaPeticion;
IDENT.identidadDeLaPeticion = async (req) => ({
  email: req?.headers?.["x-prueba-email"] || "",
});
after(() => { IDENT.identidadDeLaPeticion = identidadOriginal; });

const handler = require("./visit-availability-handler.js");

async function llama(metodo, datos, { email = "vendedor@example.com" } = {}) {
  const headers = email ? { "x-prueba-email": email } : {};
  const req = {
    method: metodo, headers,
    query: metodo === "GET" ? datos : { route: datos.route },
    body: metodo === "GET" ? {} : datos,
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

const guarda = (extra = {}) => llama("POST", {
  route: "guarda_lugar", offerId: "idcar-veh-1",
  direccion: "Calle de Alcalá 120, 3ºB", codigoPostal: "28009", ciudad: "Madrid",
  contacto: "Ana", ...extra,
});

describe("qué es una dirección a la que se puede ir", () => {
  test("calle con número, código postal de cinco cifras y ciudad", () => {
    assert.equal(L.queLeFaltaAlLugar({ direccion: "Calle de Alcalá 120", codigoPostal: "28009", ciudad: "Madrid" }), "");
  });

  test("una calle sin número no es una dirección", () => {
    assert.match(L.queLeFaltaAlLugar({ direccion: "Calle de Alcalá", codigoPostal: "28009", ciudad: "Madrid" }), /número/);
  });

  test("ni «en mi casa», ni un portal sin ciudad", () => {
    assert.match(L.queLeFaltaAlLugar({ direccion: "", codigoPostal: "28009", ciudad: "Madrid" }), /calle/i);
    assert.match(L.queLeFaltaAlLugar({ direccion: "Alcalá 120", codigoPostal: "28009", ciudad: "" }), /ciudad/i);
  });

  test("y el código postal es español o no vale", () => {
    assert.ok(L.esUnCodigoPostal("28009"));
    assert.ok(L.esUnCodigoPostal("01001"));
    assert.ok(!L.esUnCodigoPostal("2800"));
    assert.ok(!L.esUnCodigoPostal("99999"), "99 no es ninguna provincia");
    assert.ok(!L.esUnCodigoPostal("00999"), "no hay provincia 00");
  });

  test("se lee en una línea, como la del comprador", () => {
    assert.equal(
      L.comoSeLee({ direccion: "Calle de Alcalá 120, 3ºB", codigoPostal: "28009", ciudad: "Madrid" }),
      "Calle de Alcalá 120, 3ºB, 28009 Madrid"
    );
  });
});

describe("guardarla", () => {
  test("se guarda y vuelve completa", async () => {
    const r = await guarda();
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.lugar.completo, true);
    assert.equal(r.cuerpo.lugar.enUnaLinea, "Calle de Alcalá 120, 3ºB, 28009 Madrid");
  });

  test("una a la que no se puede ir no se guarda", async () => {
    const r = await guarda({ direccion: "en mi casa" });
    assert.equal(r.codigo, 400);
    assert.match(r.cuerpo.error, /número/);
    assert.equal(guardado, null);
  });

  test("se puede cambiar: la segunda pisa a la primera", async () => {
    await guarda();
    await guarda({ direccion: "Gran Vía 1", codigoPostal: "28013", ciudad: "Madrid" });
    assert.equal(guardado.direccion, "Gran Vía 1");
    assert.equal(guardado.codigo_postal, "28013");
  });
});

describe("quién puede verla", () => {
  test("su dueño, con su sesión", async () => {
    await guarda();
    const r = await llama("GET", { route: "lugar", offerId: "idcar-veh-1" });
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.lugar.direccion, "Calle de Alcalá 120, 3ºB");
  });

  test("sin sesión, no", async () => {
    await guarda();
    const r = await llama("GET", { route: "lugar", offerId: "idcar-veh-1" }, { email: "" });
    assert.equal(r.codigo, 401);
    assert.equal(r.cuerpo.lugar, undefined);
  });

  test("y otro que ha iniciado sesión, tampoco", async () => {
    /*
     * Esto es el portal de su casa y las horas a las que queda con
     * desconocidos. Con el id del anuncio, que es público, no se llega.
     */
    await guarda();
    esSuyo = false;
    const r = await llama("GET", { route: "lugar", offerId: "idcar-veh-1" }, { email: "otro@example.com" });
    assert.equal(r.codigo, 403);
    assert.equal(r.cuerpo.lugar, undefined);
  });

  test("ni la puede escribir quien no es su dueño", async () => {
    esSuyo = false;
    const r = await guarda();
    assert.equal(r.codigo, 403);
    assert.equal(guardado, null);
  });
});

describe("al confirmar una visita", () => {
  test("sale sola, sin que la escriba otra vez", async () => {
    await guarda();
    const r = await llama("POST", { route: "vendedor_confirma", bookingId: "b-1", token: "t-vendedor" });
    assert.equal(r.codigo, 200);
    assert.equal(visita.meeting_place, "Calle de Alcalá 120, 3ºB, 28009 Madrid");
    assert.equal(visita.meeting_contact, "Ana");
  });

  test("y le llega al comprador en su correo", async () => {
    await guarda();
    await llama("POST", { route: "vendedor_confirma", bookingId: "b-1", token: "t-vendedor" });
    const suyo = correos.find((c) => c.to === "comprador@example.com");
    assert.match(suyo.html, /Alcal(á|&aacute;) 120/);
  });

  test("pero lo que escriba a mano manda: ese día queda en otro sitio", async () => {
    await guarda();
    await llama("POST", {
      route: "vendedor_confirma", bookingId: "b-1", token: "t-vendedor",
      donde: "En el parking de El Corte Inglés de Goya",
    });
    assert.match(visita.meeting_place, /El Corte Ingl/);
  });

  test("y sin dirección guardada sigue haciendo falta decir dónde", async () => {
    const r = await llama("POST", { route: "vendedor_confirma", bookingId: "b-1", token: "t-vendedor" });
    assert.equal(r.codigo, 400);
    assert.match(r.cuerpo.error, /dónde/);
    assert.equal(visita.status, "pending");
  });

  test("y se le sugiere al abrir su enlace, en vez de la ciudad del anuncio", async () => {
    await guarda();
    const r = await llama("GET", { route: "vendedor", bookingId: "b-1", token: "t-vendedor" });
    assert.equal(r.cuerpo.donde_sugerido, "Calle de Alcalá 120, 3ºB, 28009 Madrid");
    assert.equal(r.cuerpo.contacto_sugerido, "Ana");
  });
});
