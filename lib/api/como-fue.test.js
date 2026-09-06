/**
 * El cliente dice cómo acabó su visita, desde el correo de seguimiento.
 *
 * El correo ya le preguntaba «¿qué tal fue?» y le pedía que contestara
 * escribiendo. Contestar escribiendo significa que alguien lea el correo y lo
 * apunte a mano, y lo que no se apunta no existe: la visita se quedaba
 * confirmada para siempre y nadie sabía si llegó a ir.
 *
 * Lo que se comprueba aquí es lo que puede salir caro. De un «me lo quedé» sale
 * una factura de 200 € a un concesionario, así que este enlace no puede pisar
 * lo que dijo un trabajador que habló con él, ni valer un mes después, ni
 * cerrar una visita que todavía no ha sido.
 */
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const haceHoras = (h) => new Date(Date.now() - h * 3600000).toISOString();
const dentroDe = (h) => new Date(Date.now() + h * 3600000).toISOString();

const RESERVA = {
  id: "b-1",
  offer_id: "erp-9",
  vehicle_title: "Toyota C-HR",
  buyer_email: "cliente@example.com",
  buyer_name: "Juan",
  token_buyer: "t-buena",
};

let estado = "confirmed";
let empezo = haceHoras(26);
let yaCerrada = null;
let guardado = null;
let pasos = [];

const queryOriginal = Pool.prototype.query;
const connectOriginal = Pool.prototype.connect;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM vehicle_visit_bookings/i.test(t) && /SELECT/i.test(t)) {
      // La base mira el WHERE, así que aquí también: con el token malo no hay
      // fila, y sin esto la prueba del token pasaría sin comprobar nada.
      if (/token_buyer = \$2/.test(t) && String(params[1]) !== RESERVA.token_buyer) return responde([]);
      return responde([{ ...RESERVA, status: estado, starts_at: empezo, resultado: yaCerrada }]);
    }
    if (/UPDATE vehicle_visit_bookings/i.test(t)) {
      guardado = { resultado: params[1] };
      return responde([{ ...RESERVA, status: estado, starts_at: empezo, resultado: params[1] }]);
    }
    if (/INSERT INTO visit_booking_events/i.test(t)) {
      // El paso y el actor van escritos en la propia consulta, no como
      // parámetros: se leen de ahí.
      const m = t.match(/VALUES\s*\(\$1,'([a-z_]+)','([a-z_]+)'/i);
      pasos.push({ evento: m && m[1], actor: m && m[2], datos: JSON.parse(params[1]) });
      return responde([]);
    }
    return responde([]);
  };
  Pool.prototype.connect = async function () {
    const q = Pool.prototype.query.bind(this);
    return { query: q, release() {} };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  Pool.prototype.connect = connectOriginal;
});

beforeEach(() => {
  estado = "confirmed";
  empezo = haceHoras(26);
  yaCerrada = null;
  guardado = null;
  pasos = [];
});

const handler = require("./visit-availability-handler.js");

async function contesta(resultado, token = "t-buena") {
  const req = {
    method: "POST",
    headers: {},
    query: { route: "como_fue" },
    body: { route: "como_fue", bookingId: RESERVA.id, token, resultado },
  };
  let codigo = 200;
  let cuerpo = null;
  const res = {
    status(c) { codigo = c; return res; },
    json(b) { cuerpo = b; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  await handler(req, res);
  return { codigo, cuerpo };
}

describe("el cliente contesta", () => {
  test("los tres finales se guardan", async () => {
    for (const r of ["no_fue", "fue", "compro"]) {
      guardado = null;
      const resp = await contesta(r);
      assert.equal(resp.codigo, 200, `«${r}» no se ha guardado`);
      assert.equal(guardado.resultado, r);
    }
  });

  test("y queda escrito que lo dijo él, no un trabajador", async () => {
    // Es lo que distingue esto de una llamada, y de ahí sale una factura: quien
    // vaya a emitirla tiene que ver de dónde viene el dato.
    await contesta("compro");
    const cierre = pasos.find((p) => p.evento === "resultado");
    assert.ok(cierre, "no ha quedado nada en el rastro");
    assert.equal(cierre.actor, "cliente");
    assert.equal(cierre.datos.resultado, "compro");
    assert.match(cierre.datos.por, /correo/);
  });
});

describe("lo que no vale", () => {
  test("una respuesta inventada", async () => {
    for (const malo of ["vendido", "COMPRO", "", "no_contesto"]) {
      const r = await contesta(malo);
      assert.ok(r.codigo === 400, `«${malo}» ha colado con ${r.codigo}`);
      assert.equal(guardado, null);
    }
  });

  test("un token que no es el suyo", async () => {
    const r = await contesta("compro", "t-mala");
    assert.equal(r.codigo, 404);
    assert.equal(guardado, null);
  });

  test("una visita que todavía no ha sido", async () => {
    // El correo no sale antes, pero el enlace se puede abrir a mano.
    empezo = dentroDe(48);
    const r = await contesta("no_fue");
    assert.equal(r.codigo, 409);
    assert.equal(guardado, null);
  });

  test("una que no llegó a confirmarse", async () => {
    for (const s of ["pending", "cancelled"]) {
      estado = s;
      const r = await contesta("no_fue");
      assert.equal(r.codigo, 409, `con estado «${s}» se ha guardado`);
      assert.equal(guardado, null);
    }
  });

  test("y una de hace un mes", async () => {
    // Un enlace viejo reabriendo un caso cerrado hace más daño que el dato que
    // trae. El seguimiento sale como mucho tres días después de la visita.
    empezo = haceHoras(24 * 30);
    const r = await contesta("compro");
    assert.equal(r.codigo, 409);
    assert.match(String(r.cuerpo.error), /tiempo/);
    assert.equal(guardado, null);
  });

  test("justo dentro del plazo sí, justo fuera no", async () => {
    empezo = haceHoras(24 * 13);
    assert.equal((await contesta("fue")).codigo, 200);
    guardado = null;
    empezo = haceHoras(24 * 15);
    assert.equal((await contesta("fue")).codigo, 409);
    assert.equal(guardado, null);
  });
});

describe("no pisa lo que ya hay", () => {
  test("si un trabajador la cerró, gana él", async () => {
    // Habló con el concesionario. Eso vale más que el recuerdo del cliente una
    // semana después, y el cliente no tiene por qué saber que ya estaba.
    yaCerrada = "compro";
    const r = await contesta("no_fue");
    assert.equal(r.codigo, 409);
    assert.match(String(r.cuerpo.error), /apuntado/);
    assert.equal(guardado, null);
    assert.equal(pasos.length, 0, "ha dejado rastro de algo que no ha pasado");
  });

  test("y contestar dos veces tampoco cambia nada", async () => {
    const primera = await contesta("fue");
    assert.equal(primera.codigo, 200);
    yaCerrada = "fue";
    guardado = null;
    const segunda = await contesta("compro");
    assert.equal(segunda.codigo, 409);
    assert.equal(guardado, null);
  });
});
