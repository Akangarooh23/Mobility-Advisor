"use strict";

/**
 * Una visita es a una hora, no a una franja.
 *
 * El dueño particular pone «de 10:00 a 14:00» como cuándo puede enseñar el
 * coche. Se reservaba entera: quien elegía las 10:00 se quedaba con la cita de
 * 10:00 a 14:00 y nadie más podía ir esa mañana. Ahora se ofrece hora a hora.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./huecos-de-visita");

const AHORA = new Date("2026-09-20T06:00:00Z");
const FRANJA = { id: "f-1", starts_at: "2026-09-21T08:00:00.000Z", ends_at: "2026-09-21T12:00:00.000Z", status: "available" };
const DE_UNA_HORA = { id: "h-1", starts_at: "2026-09-21T08:00:00.000Z", ends_at: "2026-09-21T09:00:00.000Z", status: "available" };

describe("una franja se ofrece hora a hora", () => {
  test("de 10:00 a 14:00 son cuatro visitas posibles", () => {
    const opciones = H.loQueSeOfrece(FRANJA, [], AHORA);
    assert.deepEqual(opciones.map((o) => o.starts_at), [
      "2026-09-21T08:00:00.000Z", "2026-09-21T09:00:00.000Z",
      "2026-09-21T10:00:00.000Z", "2026-09-21T11:00:00.000Z",
    ]);
    // Cada una dura una hora: es una cita, no un rango.
    assert.equal(opciones[0].ends_at, "2026-09-21T09:00:00.000Z");
  });

  test("cada hora lleva su identificador, y de él se saca la franja y la hora", () => {
    const [primera] = H.loQueSeOfrece(FRANJA, [], AHORA);
    assert.deepEqual(H.leeElHueco(primera.id), { franjaId: "f-1", hora: "2026-09-21T08:00:00.000Z" });
  });

  test("la hora ya reservada no se ofrece, y las demás siguen libres", () => {
    const reservas = [{ status: "confirmed", starts_at: "2026-09-21T08:00:00.000Z", ends_at: "2026-09-21T09:00:00.000Z" }];
    const horas = H.loQueSeOfrece(FRANJA, reservas, AHORA).map((o) => o.starts_at);
    assert.ok(!horas.includes("2026-09-21T08:00:00.000Z"));
    assert.equal(horas.length, 3);
  });

  test("una reserva cancelada no ocupa nada", () => {
    const reservas = [{ status: "cancelled", starts_at: "2026-09-21T08:00:00.000Z", ends_at: "2026-09-21T09:00:00.000Z" }];
    assert.equal(H.loQueSeOfrece(FRANJA, reservas, AHORA).length, 4);
  });

  test("una reserva vieja de la franja entera la ocupa entera", () => {
    // Las que se hicieron antes de esto: de 10:00 a 14:00.
    const reservas = [{ status: "pending", starts_at: FRANJA.starts_at, ends_at: FRANJA.ends_at }];
    assert.equal(H.loQueSeOfrece(FRANJA, reservas, AHORA).length, 0);
  });

  test("las horas que ya han pasado no se ofrecen", () => {
    const mediaManana = new Date("2026-09-21T09:30:00Z");
    assert.deepEqual(H.loQueSeOfrece(FRANJA, [], mediaManana).map((o) => o.starts_at), [
      "2026-09-21T10:00:00.000Z", "2026-09-21T11:00:00.000Z",
    ]);
  });
});

describe("un hueco de una hora sigue como estaba", () => {
  test("se ofrece tal cual, con su id", () => {
    const opciones = H.loQueSeOfrece(DE_UNA_HORA, [], AHORA);
    assert.equal(opciones.length, 1);
    assert.equal(opciones[0].id, "h-1");
    assert.deepEqual(H.leeElHueco("h-1"), { franjaId: "h-1", hora: null });
  });
});

describe("qué hora se reserva", () => {
  test("la elegida, si está libre", () => {
    assert.equal(H.laHoraQueSeReserva(FRANJA, "2026-09-21T10:00:00.000Z", [], AHORA), "2026-09-21T10:00:00.000Z");
  });

  test("una ocupada, no", () => {
    const reservas = [{ status: "pending", starts_at: "2026-09-21T10:00:00.000Z", ends_at: "2026-09-21T11:00:00.000Z" }];
    assert.equal(H.laHoraQueSeReserva(FRANJA, "2026-09-21T10:00:00.000Z", reservas, AHORA), null);
  });

  test("una fuera de la franja o que no es en punto, tampoco", () => {
    assert.equal(H.laHoraQueSeReserva(FRANJA, "2026-09-21T12:00:00.000Z", [], AHORA), null, "a las 14:00 ya no cabe una hora");
    assert.equal(H.laHoraQueSeReserva(FRANJA, "2026-09-21T08:30:00.000Z", [], AHORA), null);
  });

  test("sin hora elegida, la primera libre", () => {
    assert.equal(H.laHoraQueSeReserva(FRANJA, null, [], AHORA), "2026-09-21T08:00:00.000Z");
  });
});
