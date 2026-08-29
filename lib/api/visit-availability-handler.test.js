/**
 * Reservar una visita: qué estado queda y qué se le dice al cliente.
 *
 * Cuando una oferta no tiene horarios publicados, el sistema se los inventa —L a
 * V de 9 a 18— para que se pueda pedir visita igualmente. Eso está bien: sin
 * ellos no habría ni una. Lo que estaba mal era guardar la reserva como
 * «confirmed» y mandarle al cliente el archivo de calendario, porque nadie ha
 * confirmado que el concesionario abra ese día.
 *
 * Aquí se llama al handler de verdad, con la base simulada y el envío
 * interceptado: no se escribe ni se manda nada.
 */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = process.env.CRON_SECRET || "x";
// El handler no crea el pool sin cadena de conexión y se sale antes de llegar a
// nada. Con las consultas simuladas nunca se abre una conexión de verdad.
process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";

const HUECO = {
  id: "s-1",
  offer_id: "erp-9",
  starts_at: "2026-09-15T10:00:00.000Z",
  ends_at: "2026-09-15T11:00:00.000Z",
  status: "available",
};

/** El estado con el que se guardó la reserva, sacado del INSERT interceptado. */
let estadoGuardado = null;
let correos = [];
let correoDelVendedorGuardado;
let origenDelHueco = "auto";
// Quien vende y qué coche es. De un ex-renting el vendedor es un nombre
// —«Astara»— y el identificador empieza por el de la empresa.
let vendedor = "Concesionario Ejemplo";
let ofertaId = "erp-9";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

before(() => {
  Pool.prototype.query = function (sql, params, cb) {
    const t = String((typeof sql === "string" ? sql : sql && sql.text) || "");
    const responde = (rows) => {
      const r = { rows, rowCount: rows.length };
      return cb ? cb(null, r) : Promise.resolve(r);
    };
    if (/FROM vehicle_visit_availability/i.test(t) && /FOR UPDATE/i.test(t)) {
      return responde([{ ...HUECO, source: origenDelHueco }]);
    }
    if (/SELECT seller FROM/i.test(t)) return responde([{ seller: vendedor }]);
    if (/INSERT INTO vehicle_visit_bookings/i.test(t)) {
      estadoGuardado = params[13];
      // El correo del vendedor lo resuelve el handler y llega en el INSERT: si
      // el vendedor es un nombre y no una dirección, tiene que venir vacío.
      correoDelVendedorGuardado = params[8];
      return responde([{
        id: "b-1", offer_id: ofertaId, vehicle_title: "Toyota C-HR",
        starts_at: HUECO.starts_at, ends_at: HUECO.ends_at,
        buyer_email: "cliente@example.com", buyer_name: "Juan", buyer_phone: "",
        seller_email: correoDelVendedorGuardado || null, status: estadoGuardado, token_buyer: "t", notes: "", source: "marketplace",
      }]);
    }
    if (/^\s*(insert|update|delete|begin|commit|rollback)/i.test(t)) return responde([]);
    return responde([]);
  };
  Pool.prototype.connect = async function () {
    const q = Pool.prototype.query.bind(this);
    return { query: q, release() {} };
  };

  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) {
      correos.push(JSON.parse(opciones.body));
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

after(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./visit-availability-handler.js");

/** Reserva el hueco y devuelve lo que contestó, ya con los correos salidos. */
async function reserva(origen) {
  origenDelHueco = origen;
  estadoGuardado = null;
  correos = [];
  const req = {
    method: "POST",
    headers: {},
    body: {
      route: "book", slotId: HUECO.id, offerId: ofertaId,
      vehicleTitle: "Toyota C-HR", buyerEmail: "cliente@example.com",
      buyerName: "Juan", notes: "", source: "marketplace",
    },
    query: {},
  };
  let cuerpo = null;
  const res = {
    status() { return res; },
    json(b) { cuerpo = b; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  await handler(req, res);
  // Los correos salen sin esperar a la respuesta; se les da un respiro.
  await new Promise((r) => setImmediate(r));
  return cuerpo;
}

describe("reservar sobre un horario que nadie publicó", () => {
  test("la reserva queda pendiente, no confirmada", async () => {
    await reserva("auto");
    assert.equal(estadoGuardado, "pending");
  });

  test("al cliente no se le dice que está confirmada", async () => {
    await reserva("auto");
    const suyo = correos.find((c) => String(c.to).includes("cliente@example.com"));
    assert.ok(suyo, "algún correo tiene que recibir");
    assert.ok(!/confirmada/i.test(suyo.subject), `el asunto la daba por confirmada: ${suyo.subject}`);
    assert.ok(/solicitud/i.test(suyo.subject));
  });

  test("y no se le manda el calendario", async () => {
    await reserva("auto");
    const suyo = correos.find((c) => String(c.to).includes("cliente@example.com"));
    assert.ok(!suyo.attachments || !suyo.attachments.length,
      "un .ics en el móvil de alguien es una cita cerrada, y esta no lo es");
  });
});

describe("reservar sobre un horario publicado por una persona", () => {
  // Tambien queda pendiente. Que una hora este publicada no significa que el
  // concesionario haya dicho que si a *esta* visita: alguien tiene que
  // llamarle. Antes estas nacian confirmadas y esta prueba fijaba lo contrario.
  test("tambien queda pendiente: siempre se aprueba", async () => {
    await reserva("erp");
    assert.equal(estadoGuardado, "pending");
  });

  test("y tampoco lleva calendario todavia", async () => {
    await reserva("erp");
    const suyo = correos.find((c) => String(c.to).includes("cliente@example.com"));
    assert.ok(!/confirmada/i.test(suyo.subject));
    assert.ok(!suyo.attachments || !suyo.attachments.length);
  });
});

describe("pedir visita sin haber entrado", () => {
  // Antes se cogia el correo del cuerpo sin comprobar nada: cualquiera podia
  // reservar a nombre de otro y hacer que le llegaran los correos de su cita.
  // La pantalla ya no enseña el calendario sin sesion, pero eso no es una
  // restriccion: la restriccion es esta.
  test("en produccion se rechaza, aunque mande un correo", async () => {
    const antes = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    estadoGuardado = null;
    const cuerpo = await reserva("auto");
    process.env.NODE_ENV = antes;
    assert.equal(estadoGuardado, null, "no puede llegar a guardarse nada");
    assert.match(String(cuerpo?.error ?? ""), /Inicia sesión/);
  });
});

describe("reservar un coche de ex-renting", () => {
  // Es la seccion Ex-Renting del marketplace: flota devuelta de una empresa de
  // renting —Astara, Leasys—. El camino es el mismo que el de un concesionario,
  // pero eso hay que ejecutarlo, no suponerlo: el identificador de la oferta es
  // otro y el vendedor es el nombre de una empresa, no una direccion de correo.
  before(() => { vendedor = "Astara"; ofertaId = "astara-1c4pjdcwxpp039070"; });
  after(()  => { vendedor = "Concesionario Ejemplo"; ofertaId = "erp-9"; });

  test("la reserva se guarda, y pendiente como todas", async () => {
    const cuerpo = await reserva("auto");
    assert.equal(cuerpo.ok, true);
    assert.equal(estadoGuardado, "pending");
    assert.equal(cuerpo.booking.offer_id, "astara-1c4pjdcwxpp039070");
  });

  test("al cliente se le dice que la hemos recibido, sin calendario", async () => {
    await reserva("auto");
    const suyo = correos.find((c) => String(c.to).includes("cliente@example.com"));
    assert.ok(suyo, "algo tiene que recibir");
    assert.ok(/solicitud/i.test(suyo.subject));
    assert.ok(!suyo.attachments || !suyo.attachments.length);
  });

  test("no se intenta escribir a la empresa: su vendedor es un nombre", async () => {
    await reserva("auto");
    assert.ok(!correoDelVendedorGuardado, "«Astara» no es una direccion; mandar ahi un correo es mandarlo a ninguna parte");
    const aAstara = correos.find((c) => /astara/i.test(String(c.to)));
    assert.ok(!aAstara, "a la empresa no se le escribe nunca: se la llama a mano");
  });

  test("el aviso va al equipo, que es quien va a llamar", async () => {
    await reserva("auto");
    const interno = correos.find((c) => !String(c.to).includes("cliente@example.com"));
    assert.ok(interno, "sin este aviso, nadie sabe que hay una visita que aprobar");
    assert.ok(/confirmar|cita/i.test(interno.subject));
  });
});
