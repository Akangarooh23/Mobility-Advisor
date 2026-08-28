/**
 * La traducción de una cita, venga de donde venga.
 *
 * Estaba escrita cuatro veces, con tres nombres distintos, y ninguna tenía
 * pruebas propias. Lo que se fija aquí es que los tres orígenes acaben en la
 * misma forma, porque de eso depende que una pantalla nueva se escriba una vez.
 */
import { comoCita, cuandoEs, proximas, enPie, ESTADO } from "./citas";

const AHORA = new Date("2026-08-28T10:00:00");

const delMarketplace = (extra = {}) => ({
  id: "cita-1", title: "Kia XCeed", status: "Cita confirmada",
  meta: JSON.stringify({ starts_at: "2026-09-01T13:00:00.000Z", booking_id: "b1", token_buyer: "t1", ...extra.meta }),
  ...extra,
});
const deLead = (extra = {}) => ({
  id: "lead-1", title: "Renault Clio", status: "Cita confirmada",
  meta: JSON.stringify({ appointment_date: "2026-09-03", appointment_time: "17:30", ...extra.meta }),
  ...extra,
});
const entreParticulares = (extra = {}) => ({
  id: "view-1", title: "Seat León", status: "confirmed",
  meta: JSON.stringify({ confirmed_slot: "2026-09-05T09:00:00.000Z", ...extra.meta }),
  ...extra,
});

describe("los tres orígenes acaban en lo mismo", () => {
  test("la del marketplace, por starts_at", () => {
    expect(cuandoEs(delMarketplace())).toEqual(new Date("2026-09-01T13:00:00.000Z"));
  });

  test("la de un lead, juntando día y hora", () => {
    expect(cuandoEs(deLead()).getHours()).toBe(17);
  });

  test("la de entre particulares, por confirmed_slot", () => {
    expect(cuandoEs(entreParticulares())).toEqual(new Date("2026-09-05T09:00:00.000Z"));
  });

  test("y las tres se ordenan juntas", () => {
    const r = proximas([entreParticulares(), delMarketplace(), deLead()], AHORA);
    expect(r.map((x) => x.titulo)).toEqual(["Kia XCeed", "Renault Clio", "Seat León"]);
  });
});

describe("lo que no es una cita", () => {
  test("una petición de información, que no tiene fecha", () => {
    expect(comoCita({ id: "x", status: "Pendiente", meta: "{}" })).toBeNull();
  });

  test("una cancelada", () => {
    expect(comoCita(delMarketplace({ status: "Cancelado" }))).toBeNull();
    expect(enPie({ status: "cancelled" })).toBe(false);
    expect(enPie({ status: "Descartado" })).toBe(false);
  });

  test("un meta que no es JSON", () => {
    expect(cuandoEs({ meta: "esto no es json" })).toBeNull();
  });

  test("una fecha imposible", () => {
    expect(cuandoEs(delMarketplace({ meta: { starts_at: "el martes" } }))).toBeNull();
  });
});

describe("la hora que falta", () => {
  test("una cita de hoy sin hora vale hasta el final del día", () => {
    const hoy = deLead({ meta: { appointment_date: "2026-08-28", appointment_time: "" } });
    expect(proximas([hoy], AHORA)).toHaveLength(1);
  });

  test("una de ayer sin hora ya pasó", () => {
    const ayer = deLead({ meta: { appointment_date: "2026-08-27", appointment_time: "" } });
    expect(proximas([ayer], AHORA)).toHaveLength(0);
  });
});

describe("el enlace y el estado", () => {
  test("solo las del marketplace se abren con testigo", () => {
    expect(comoCita(delMarketplace()).enlace).toBe("/mi-cita?id=b1&token=t1");
    expect(comoCita(deLead()).enlace).toBe("");
  });

  test("una pendiente se marca como pendiente", () => {
    const c = comoCita(delMarketplace({ status: ESTADO.pending }));
    expect(c.pendiente).toBe(true);
  });

  test("sin título no deja el hueco", () => {
    expect(comoCita(delMarketplace({ title: "" })).titulo).toBe("Vehículo");
  });
});
