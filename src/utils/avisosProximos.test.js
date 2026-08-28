import { avisosProximos, cuantosAvisos } from "./avisosProximos";

const AHORA = new Date("2026-08-28T10:00:00");

const visitaMarketplace = (extra = {}) => ({
  id: "cita-1",
  type: "visita_marketplace",
  title: "Kia XCeed",
  status: "Cita confirmada",
  meta: JSON.stringify({ starts_at: "2026-09-01T13:00:00.000Z", booking_id: "b1", token_buyer: "t1", ...extra.meta }),
  ...extra,
});

const leadConCita = (extra = {}) => ({
  id: "lead-1",
  type: "visit",
  title: "Renault Clio",
  status: "Cita confirmada",
  meta: JSON.stringify({ appointment_date: "2026-09-03", appointment_time: "17:30", ...extra.meta }),
  ...extra,
});

describe("qué cuenta la campana", () => {
  test("una visita del marketplace que aún no ha pasado", () => {
    expect(cuantosAvisos([visitaMarketplace()], AHORA)).toBe(1);
  });

  test("y una cita puesta desde el ERP, que es lo mismo para quien la tiene", () => {
    expect(cuantosAvisos([leadConCita()], AHORA)).toBe(1);
  });

  test("las dos juntas, la más próxima primero", () => {
    const r = avisosProximos([leadConCita(), visitaMarketplace()], AHORA);
    expect(r.map((x) => x.titulo)).toEqual(["Kia XCeed", "Renault Clio"]);
  });

  test("una cita pasada ya no avisa: es historial", () => {
    const pasada = visitaMarketplace({ meta: { starts_at: "2026-08-01T10:00:00.000Z" } });
    expect(cuantosAvisos([pasada], AHORA)).toBe(0);
  });

  test("una cancelada tampoco: no hay a dónde ir", () => {
    expect(cuantosAvisos([visitaMarketplace({ status: "Cancelado" })], AHORA)).toBe(0);
  });

  test("una pendiente sí avisa, y se marca como pendiente", () => {
    const r = avisosProximos([visitaMarketplace({ status: "Pendiente de aprobación" })], AHORA);
    expect(r).toHaveLength(1);
    expect(r[0].pendiente).toBe(true);
  });

  test("lo que no tiene fecha se queda fuera", () => {
    const info = { id: "l2", type: "info", title: "Golf", status: "Pendiente", meta: "{}" };
    expect(cuantosAvisos([info], AHORA)).toBe(0);
  });

  test("una cita de hoy más tarde sigue contando", () => {
    const hoy = leadConCita({ meta: { appointment_date: "2026-08-28", appointment_time: "18:00" } });
    expect(cuantosAvisos([hoy], AHORA)).toBe(1);
  });

  test("una cita de hoy sin hora cuenta hasta el final del día", () => {
    const hoy = leadConCita({ meta: { appointment_date: "2026-08-28", appointment_time: "" } });
    expect(cuantosAvisos([hoy], AHORA)).toBe(1);
  });
});

describe("el enlace", () => {
  test("la del marketplace lleva a su cita, con el testigo", () => {
    const r = avisosProximos([visitaMarketplace()], AHORA);
    expect(r[0].enlace).toBe("/mi-cita?id=b1&token=t1");
  });

  test("la del ERP no tiene enlace propio: se ve en Solicitudes", () => {
    expect(avisosProximos([leadConCita()], AHORA)[0].enlace).toBe("");
  });
});

describe("no revienta con lo que llegue", () => {
  test("sin nada", () => {
    expect(cuantosAvisos()).toBe(0);
    expect(cuantosAvisos(null)).toBe(0);
    expect(cuantosAvisos([null, undefined])).toBe(0);
  });

  test("con un meta que no es JSON", () => {
    expect(cuantosAvisos([{ id: "x", status: "Pendiente", meta: "esto no es json" }], AHORA)).toBe(0);
  });

  test("con una fecha imposible", () => {
    const malo = visitaMarketplace({ meta: { starts_at: "el martes" } });
    expect(cuantosAvisos([malo], AHORA)).toBe(0);
  });
});
