/**
 * Citas y recordatorios viven en la misma lista y no cuentan lo mismo.
 *
 * En el lateral del panel salía un **9** con una sola cita: la del taller, más
 * ocho recordatorios —revisiones que tocan por kilómetros, la renovación del
 * seguro, la sugerencia del asesor—. Quien lo mira busca ocho citas que no
 * existen, y no las encuentra porque no las hay.
 *
 * Lo que se fija aquí es la diferencia: una cita es alguien esperándote a una
 * hora; un recordatorio es un aviso de que convendría pedirla.
 */
import {
  esCitaDeVerdad, esRecordatorio, cuantasCitas, ORIGENES_DE_RECORDATORIO,
} from "./userDashboardHelpers";

const cita = (extra = {}) => ({ id: "cita-1", source: "booking", ...extra });
const recordatorio = (source, extra = {}) => ({ id: "rec-1", source, ...extra });

describe("qué es una cita y qué es un recordatorio", () => {
  test("la del taller es una cita", () => {
    expect(esCitaDeVerdad(cita())).toBe(true);
    expect(esRecordatorio(cita())).toBe(false);
  });

  test("el mantenimiento del calendario y la sugerencia del asesor, no", () => {
    for (const origen of ORIGENES_DE_RECORDATORIO) {
      expect(esRecordatorio(recordatorio(origen))).toBe(true);
      expect(esCitaDeVerdad(recordatorio(origen))).toBe(false);
    }
  });

  test("una sin origen cuenta como cita", () => {
    /*
     * Es lo que traían antes de que hubiera recordatorios en esta lista. Si
     * dejaran de contarse, la cita de alguien desaparecería del número por un
     * campo que se añadió después.
     */
    expect(esCitaDeVerdad({ id: "vieja" })).toBe(true);
    expect(esCitaDeVerdad({ id: "vieja", source: "" })).toBe(true);
  });

  test("y un origen que no conocemos no se cuela como cita", () => {
    // Si mañana aparece uno nuevo, lo seguro es no sumarlo hasta decidirlo: un
    // número de más manda a buscar algo que no está.
    expect(esCitaDeVerdad({ id: "x", source: "loQueSea" })).toBe(false);
    expect(esRecordatorio({ id: "x", source: "loQueSea" })).toBe(false);
  });
});

describe("el número del lateral", () => {
  test("una cita y ocho recordatorios son una cita", () => {
    // El caso exacto que se vio en pantalla.
    const lista = [
      cita(),
      ...Array.from({ length: 8 }, (unused, i) => recordatorio("calendar", { id: `r${i}` })),
    ];
    expect(lista).toHaveLength(9);
    expect(cuantasCitas(lista)).toBe(1);
  });

  test("sin citas, cero, y no se esconde nada raro", () => {
    expect(cuantasCitas([recordatorio("calendar"), recordatorio("suggestion")])).toBe(0);
    expect(cuantasCitas([])).toBe(0);
    expect(cuantasCitas(null)).toBe(0);
    expect(cuantasCitas(undefined)).toBe(0);
  });

  test("y con varias citas las cuenta todas", () => {
    const lista = [cita({ id: "a" }), cita({ id: "b" }), recordatorio("suggestion")];
    expect(cuantasCitas(lista)).toBe(2);
  });
});
