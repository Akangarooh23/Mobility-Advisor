"use strict";

/**
 * Las visitas avisan al móvil de quien toca, y a nadie más.
 *
 * Se manda de verdad por las funciones que mandan, con el correo y el aviso
 * cambiados por unos que apuntan a quién iba cada cosa. Lo que se protege:
 *
 *   · Cada correo a una persona —comprador o vendedor— lleva su aviso al móvil.
 *     Se pidió así: todo por correo y por móvil.
 *   · El buzón del equipo no recibe avisos: no es el móvil de nadie.
 *   · En el coche de un particular, el vendedor sabe de la visita desde que se
 *     pide —la confirma él—, así que se le avisa también al móvil. En el de un
 *     concesionario no: una pendiente no se le cuenta, y su cancelación
 *     tampoco.
 *   · Si la rechaza el vendedor, al comprador se le dice que esa no puede ser y
 *     que elija otra hora.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// El aviso de verdad pide Firebase y la base; aquí solo interesa a quién va.
let avisos = [];
const rutaDeAvisos = require.resolve(path.join(__dirname, "..", "avisos-push"));
require.cache[rutaDeAvisos] = {
  id: rutaDeAvisos, filename: rutaDeAvisos, loaded: true,
  exports: {
    enviaAviso: async (correos, aviso) => { avisos.push({ a: correos, ...aviso }); return { enviados: 1 }; },
  },
};

const { sendBookingEmails, sendCancelEmails } = require("./visit-availability-handler");

let correos = [];
const fetchDeVerdad = global.fetch;

beforeEach(() => {
  correos = [];
  avisos = [];
  process.env.RESEND_API_KEY = "re_de_mentira";
  process.env.OPS_EMAIL = "equipo@example.com";
  global.fetch = async (_url, opciones) => {
    const c = JSON.parse(opciones.body);
    correos.push({ to: c.to, subject: c.subject, html: c.html });
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

const aQuienSeAvisa = () => avisos.flatMap((x) => x.a);

describe("al pedir una visita", () => {
  test("el que la pide recibe el aviso en el móvil", async () => {
    await sendBookingEmails(visita());
    const suyo = avisos.find((x) => x.a.includes("comprador@example.com"));
    assert.ok(suyo);
    assert.match(suyo.titulo, /Hemos recibido tu solicitud/);
  });

  test("y el vendedor particular también, porque la confirma él", async () => {
    await sendBookingEmails(visita());
    const suyo = avisos.find((x) => x.a.includes("vendedor@example.com"));
    assert.ok(suyo, "al vendedor no le llega el aviso de que alguien quiere ver su coche");
    assert.match(suyo.titulo, /Alguien quiere ver tu coche/);
  });

  test("y el buzón del equipo no, aunque le llegue el correo", async () => {
    await sendBookingEmails(visita());
    assert.ok(correos.some((c) => c.to === "equipo@example.com"), "el equipo no recibe el correo");
    assert.ok(!aQuienSeAvisa().includes("equipo@example.com"));
  });
});

describe("al cancelar", () => {
  test("en la de concesionario, una pendiente no se le cuenta al vendedor", async () => {
    await sendCancelEmails(visita({ offer_id: "conc-1", status: "cancelled", estado_anterior: "pending" }));
    assert.ok(!correos.some((c) => c.to === "vendedor@example.com"), "al vendedor le llega la cancelación");
    assert.ok(!aQuienSeAvisa().includes("vendedor@example.com"), "y el aviso al móvil");
    assert.ok(correos.some((c) => c.to === "equipo@example.com"), "y el equipo no se entera");
  });

  test("una confirmada sí, en el correo y en el móvil", async () => {
    await sendCancelEmails(visita({ status: "cancelled", estado_anterior: "confirmed" }));
    assert.ok(correos.some((c) => c.to === "vendedor@example.com"));
    assert.ok(aQuienSeAvisa().includes("vendedor@example.com"));
  });

  test("pero sin el correo del comprador", async () => {
    // Al confirmar se le da el nombre y nada más; cancelar no es motivo para más.
    await sendCancelEmails(visita({ status: "cancelled", estado_anterior: "confirmed" }));
    const suyo = correos.find((c) => c.to === "vendedor@example.com");
    assert.ok(!suyo.html.includes("comprador@example.com"), "el correo del vendedor lleva el del comprador");
  });

  test("en la de particular, sí: sabía de ella desde que se pidió", async () => {
    await sendCancelEmails(visita({ status: "cancelled", estado_anterior: "pending" }));
    assert.ok(correos.some((c) => c.to === "vendedor@example.com"));
  });

  test("si la rechaza el vendedor, al comprador se le dice que elija otra hora", async () => {
    await sendCancelEmails(visita({ status: "cancelled", estado_anterior: "pending", la_cancela: "vendedor" }));
    const suyo = correos.find((c) => c.to === "comprador@example.com");
    assert.match(suyo.subject, /no puede ser/);
    assert.match(suyo.html, /Elegir otra hora/);
    // Y al vendedor no se le cuenta lo que acaba de hacer él.
    assert.ok(!correos.some((c) => c.to === "vendedor@example.com"));
  });

  test("y el comprador recibe el suyo, con aviso", async () => {
    await sendCancelEmails(visita({ status: "cancelled", estado_anterior: "pending" }));
    assert.ok(aQuienSeAvisa().includes("comprador@example.com"));
  });
});
