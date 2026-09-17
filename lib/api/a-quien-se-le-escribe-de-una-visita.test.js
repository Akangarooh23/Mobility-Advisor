"use strict";

/**
 * A quién se le escribe cuando alguien pide una visita.
 *
 * Aquí se manda de verdad por la función que manda —con `fetch` cambiado por
 * uno que apunta a quién iba cada correo—, porque lo que se protege es eso: a
 * quién llega. Leer la fuente diría que el código existe, no que acierta.
 *
 * Las dos reglas, y las dos salieron de la misma prueba de una visita:
 *
 *   · Al que pide la visita le llega «hemos recibido tu solicitud». No le
 *     llegaba nada: el correo se lanzaba sin esperarlo y Vercel lo cortaba.
 *   · Si el coche es de un particular, **al vendedor sí** se le escribe al
 *     pedirla: la confirma él o propone otra hora, no nosotros desde el ERP.
 *     Con el nombre de quien viene, sin su teléfono ni su correo.
 *   · Si es de concesionario, renting o importación, al vendedor no: se le
 *     llama y la confirma el equipo desde el ERP.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { sendBookingEmails } = require("./visit-availability-handler");

let enviados = [];
const fetchDeVerdad = global.fetch;

beforeEach(() => {
  enviados = [];
  process.env.RESEND_API_KEY = "re_de_mentira";
  process.env.OPS_EMAIL = "equipo@example.com";
  /*
   * Con su tardanza, como la red.
   *
   * La primera versión apuntaba el correo nada más llamarla, y entonces la
   * prueba de «la función espera a que se mande» pasaba igual quitándole la
   * espera: el correo constaba como enviado antes de que nadie esperara nada.
   * Es exactamente lo que no pasa con Resend, que tarda — y el fallo de Vercel
   * vive en esa tardanza.
   */
  global.fetch = async (_url, opciones) => {
    await new Promise((listo) => setTimeout(listo, 15));
    const cuerpo = JSON.parse(opciones.body);
    enviados.push({ to: cuerpo.to, subject: cuerpo.subject, html: cuerpo.html, adjuntos: (cuerpo.attachments || []).length });
    return { ok: true, json: async () => ({}) };
  };
});

afterEach(() => {
  global.fetch = fetchDeVerdad;
});

const visita = (extra = {}) => ({
  id: "b1",
  offer_id: "idcar-veh-1",
  vehicle_title: "Volkswagen T-Roc",
  starts_at: "2026-09-21T08:00:00.000Z",
  ends_at: "2026-09-21T09:00:00.000Z",
  buyer_email: "comprador@example.com",
  buyer_name: "Sergio",
  buyer_phone: "600000000",
  seller_email: "vendedor@example.com",
  source: "marketplace",
  status: "pending",
  token_buyer: "t1",
  token_seller: "ts1",
  notes: "",
  ...extra,
});

const aQuien = () => enviados.map((e) => e.to);

describe("una visita recién pedida", () => {
  test("al que la pide le llega que la hemos recibido", async () => {
    await sendBookingEmails(visita());
    const suyo = enviados.find((e) => e.to === "comprador@example.com");
    assert.ok(suyo, "al comprador no le llega nada");
    assert.match(suyo.subject, /Hemos recibido tu solicitud/);
  });

  test("sin calendario: todavía no es una cita", async () => {
    // Un .ics en el móvil de alguien es una cita cerrada.
    await sendBookingEmails(visita());
    assert.equal(enviados.find((e) => e.to === "comprador@example.com").adjuntos, 0);
  });

  test("si es de un particular, al vendedor se le escribe para que la confirme", async () => {
    await sendBookingEmails(visita());
    const suyo = enviados.find((e) => e.to === "vendedor@example.com");
    assert.ok(suyo, "al vendedor particular no le llega la solicitud, y es él quien la confirma");
    assert.match(suyo.subject, /Alguien quiere ver tu coche/);
  });

  test("con la franja entera y su enlace, pero sin el teléfono ni el correo del comprador", async () => {
    await sendBookingEmails(visita());
    const html = enviados.find((e) => e.to === "vendedor@example.com").html;
    assert.match(html, /de 10:00 a 11:00/);
    assert.ok(html.includes("/cita-vendedor?id=b1&amp;token=ts1") || html.includes("/cita-vendedor?id=b1&token=ts1"),
      "no lleva el enlace para confirmarla");
    assert.ok(!html.includes("600000000"), "le pasamos el teléfono del comprador");
    assert.ok(!html.includes("comprador@example.com"), "le pasamos el correo del comprador");
  });

  test("si es de concesionario, al vendedor no: la confirma el equipo", async () => {
    await sendBookingEmails(visita({ offer_id: "conc-123", seller_email: null }));
    assert.ok(!aQuien().includes("vendedor@example.com"));
    const equipo = enviados.find((e) => e.to === "equipo@example.com");
    assert.match(equipo.html, /Hay que confirmarla/);
  });

  test("el equipo se entera siempre, y en la de particular sabe que no le toca", async () => {
    await sendBookingEmails(visita());
    const equipo = enviados.find((e) => e.to === "equipo@example.com");
    assert.ok(equipo, "nadie del equipo se entera de la solicitud");
    assert.match(equipo.html, /La confirma el vendedor/);
  });

  test("al comprador, la franja entera: no una hora suelta", async () => {
    await sendBookingEmails(visita());
    assert.match(enviados.find((e) => e.to === "comprador@example.com").html, /de 10:00 a 11:00/);
  });
});

describe("y el correo sale de verdad", () => {
  test("la función espera a que se mande", async () => {
    /*
     * Si devolviera antes de mandar, en Vercel el correo se cortaría. Aquí se
     * comprueba que al terminar la llamada los envíos ya están hechos, que es lo
     * que permite esperarla con `await`.
     */
    await sendBookingEmails(visita());
    assert.ok(enviados.length >= 2, `al terminar solo había salido ${enviados.length}`);
  });

  test("y un fallo del correo no rompe la reserva", async () => {
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: "caído" }) });
    await assert.doesNotReject(() => sendBookingEmails(visita()));
  });
});
