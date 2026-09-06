/**
 * El correo de seguimiento pregunta cómo fue, y ahora se puede contestar en un
 * toque.
 *
 * Antes decía «respóndenos a este correo». Contestar escribiendo significa que
 * alguien lea el correo y lo apunte a mano, y lo que no se apunta no existe: la
 * visita se quedaba confirmada para siempre y nadie sabía si el cliente llegó a
 * ir.
 *
 * Se comprueba sobre el correo que sale de verdad —se intercepta el envío y se
 * mira el HTML—, y no sobre la función que lo arma: lo que importa es lo que le
 * llega al cliente, con los enlaces montados.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

process.env.DATABASE_URL = "postgres://nadie@localhost:5432/ninguna";
process.env.RESEND_API_KEY = "clave-de-mentira";
process.env.CRON_SECRET = "secreto-de-mentira";

const queryOriginal = Pool.prototype.query;
const fetchOriginal = global.fetch;

const haceHoras = (h) => new Date(Date.now() - h * 3600000).toISOString();

/** La visita que toca seguir hoy. */
const RESERVA = {
  id: "b-1",
  buyer_email: "cliente@example.com",
  buyer_name: "Juan",
  vehicle_title: "Toyota C-HR",
  starts_at: haceHoras(26),
  token_buyer: "t-buena",
  meeting_place: "Calle Coso 12",
  meeting_contact: "Marta",
};

let correos = [];
/** Si la reserva trae su testigo. Sin él no hay enlace suyo que mandar. */
let conTestigo = true;

beforeEach(() => {
  correos = [];
  conTestigo = true;
  Pool.prototype.query = async (sql) => {
    const t = String(sql || "").replace(/\s+/g, " ");
    // Solo el seguimiento de reservas: lo demás vacío, para que salga un correo
    // y no veinte.
    if (/FROM vehicle_visit_bookings/i.test(t) && /followup_sent_at IS NULL/i.test(t)) {
      return { rows: [{ ...RESERVA, token_buyer: conTestigo ? RESERVA.token_buyer : null }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  global.fetch = async (url, opciones) => {
    if (String(url).includes("resend.com")) correos.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
});

afterEach(() => {
  Pool.prototype.query = queryOriginal;
  global.fetch = fetchOriginal;
});

const handler = require("./cron-appointment-reminders-handler.js");

async function corre() {
  const res = {
    _codigo: 200,
    status(c) { res._codigo = c; return res; },
    json() { return res; }, setHeader() { return res; }, end() { return res; },
  };
  await handler({ method: "GET", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);
  return res._codigo;
}

const elSeguimiento = () => correos.find((c) => /qué tal fue/i.test(c.subject));

describe("el correo de «¿qué tal fue?»", { concurrency: 1 }, () => {
  test("sale, y con las tres respuestas", async () => {
    await corre();
    const c = elSeguimiento();
    assert.ok(c, "no ha salido el correo de seguimiento");
    for (const texto of ["No pude ir", "Lo vi y no me lo quedé", "Me lo quedé"]) {
      assert.ok(c.html.includes(texto), `falta la respuesta «${texto}»`);
    }
  });

  test("cada botón lleva la cita, el testigo y su respuesta", async () => {
    await corre();
    const html = elSeguimiento().html;
    for (const r of ["no_fue", "fue", "compro"]) {
      const re = new RegExp(`/como-fue\\?id=b-1&amp;token=t-buena&amp;r=${r}`);
      assert.match(html, re, `el enlace de «${r}» no está bien montado`);
    }
  });

  test("y llevan a la página de contestar, no a la de la cita", async () => {
    // Con /mi-cita el cliente aterriza en su cita sin que le pregunten nada, y
    // la respuesta se pierde.
    const html = (await corre(), elSeguimiento().html);
    assert.ok(!/\/mi-cita\?id=b-1&amp;token=t-buena&amp;r=/.test(html));
  });

  test("ninguna respuesta va destacada sobre las otras", async () => {
    /*
     * Las tres valen lo mismo. Pintar «Me lo quedé» en amarillo y las otras
     * dos apagadas empuja a la respuesta que nos conviene, y entonces el dato
     * deja de servir para lo que se recoge.
     */
    const html = (await corre(), elSeguimiento().html);
    const trozo = html.slice(html.indexOf("No pude ir") - 400, html.indexOf("Me lo quedé") + 200);
    assert.ok(!/#FFC400|amarillo/i.test(trozo), "una de las tres respuestas va resaltada");
  });

  test("sin testigo no se ofrece: no hay enlace suyo que mandar", async () => {
    // Una cita vieja sin token no puede contestar, y un botón que lleva a un
    // sitio que dirá «no hemos encontrado tu cita» es peor que no ponerlo.
    conTestigo = false;
    await corre();
    const c = elSeguimiento();
    assert.ok(c, "el correo tiene que salir igual");
    assert.ok(!c.html.includes("/como-fue?"), "ha ofrecido contestar sin poder");
    assert.ok(c.html.includes("Hablar con el equipo"), "y sin eso se queda sin salida");
  });
});
