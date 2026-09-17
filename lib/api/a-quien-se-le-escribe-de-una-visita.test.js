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
 *   · Al vendedor **no** se le escribe mientras está pendiente. Se le escribía
 *     «alguien ha reservado» con el teléfono del comprador, cuando a ese
 *     vendedor le prometimos filtrar las visitas antes de pasárselas. Se le
 *     escribe desde el ERP al confirmarla.
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
    enviados.push({ to: cuerpo.to, subject: cuerpo.subject, adjuntos: (cuerpo.attachments || []).length });
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

  test("al vendedor no se le escribe todavía", async () => {
    await sendBookingEmails(visita());
    assert.ok(!aQuien().includes("vendedor@example.com"),
      "al vendedor le llega la solicitud pendiente, con los datos del comprador");
  });

  test("se avisa al equipo, que es quien tiene que confirmarla", async () => {
    await sendBookingEmails(visita());
    assert.ok(aQuien().includes("equipo@example.com"), "nadie del equipo se entera de la solicitud");
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
