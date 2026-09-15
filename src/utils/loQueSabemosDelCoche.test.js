/**
 * La tasación de un coche, vista desde su ficha.
 *
 * Lo que se protege: que no se diga «ya está tasado» sin un número que enseñar,
 * y que la tasación de un coche no se le cuelgue a otro.
 */
import { laTasacionDe, enEuros, elDia, comoSeCompara } from "./loQueSabemosDelCoche";

const COCHE = { id: "veh-1", plate: "8888LXR" };
const OTRO = { id: "veh-2", plate: "5380FBT" };

const LA_SUYA = {
  id: "valuation-1", vehicleId: "veh-1", estimateValue: 20795,
  vehicleTitle: "Volkswagen T-Roc", createdAt: "2026-09-15T18:08:00Z",
};

describe("la tasación de este coche", () => {
  test("se encuentra por su identificador", () => {
    expect(laTasacionDe([LA_SUYA], COCHE)?.estimateValue).toBe(20795);
  });

  test("y la de otro coche no se cuela", () => {
    expect(laTasacionDe([LA_SUYA], OTRO)).toBeNull();
  });

  test("sin tasaciones, null", () => {
    expect(laTasacionDe([], COCHE)).toBeNull();
    expect(laTasacionDe(null, COCHE)).toBeNull();
  });

  test("una sin importe no cuenta como tasación", () => {
    /*
     * Pasó de verdad: por un nombre de campo mal escrito, las filas se
     * guardaban con el precio a nulo. Enseñar eso diría «ya está tasado» y no
     * habría ningún número que enseñar.
     */
    expect(laTasacionDe([{ ...LA_SUYA, estimateValue: null }], COCHE)).toBeNull();
    expect(laTasacionDe([{ ...LA_SUYA, estimateValue: 0 }], COCHE)).toBeNull();
  });

  test("vale la última", () => {
    const vieja = { ...LA_SUYA, id: "v-vieja", estimateValue: 19000, createdAt: "2026-01-01T10:00:00Z" };
    expect(laTasacionDe([vieja, LA_SUYA], COCHE)?.estimateValue).toBe(20795);
    expect(laTasacionDe([LA_SUYA, vieja], COCHE)?.estimateValue).toBe(20795);
  });
});

describe("las de antes del arreglo, que se guardaron sueltas", () => {
  const SUELTA = { id: "v-suelta", vehicleId: null, estimateValue: 18000, vehicleTitle: "T-Roc 8888LXR" };

  test("se reconocen por la matrícula del título", () => {
    expect(laTasacionDe([SUELTA], COCHE)?.estimateValue).toBe(18000);
  });

  test("pero no se le cuelgan a un coche sin matrícula", () => {
    /*
     * Sin esto, la primera tasación suelta aparecería en cualquier coche recién
     * creado —que todavía no tiene matrícula— como si fuera suya.
     */
    expect(laTasacionDe([SUELTA], { id: "veh-nuevo", plate: "" })).toBeNull();
  });

  test("ni a otro coche distinto", () => {
    expect(laTasacionDe([SUELTA], OTRO)).toBeNull();
  });

  test("la matrícula se compara sin espacios ni guiones", () => {
    expect(comoSeCompara("8888 lxr")).toBe("8888LXR");
    expect(laTasacionDe([SUELTA], { id: "x", plate: "8888 LXR" })?.estimateValue).toBe(18000);
  });
});

describe("cómo se escribe", () => {
  test("el importe, con el punto de los miles", () => {
    expect(enEuros(20795)).toBe("20.795 €");
    expect(enEuros("16600")).toBe("16.600 €");
  });

  test("y sin importe no se escribe nada", () => {
    // Un «0 €» en la ficha diría que el coche no vale nada.
    expect(enEuros(0)).toBe("");
    expect(enEuros(null)).toBe("");
    expect(enEuros("no sé")).toBe("");
  });

  test("el día, en castellano", () => {
    expect(elDia("2026-09-15T18:08:00Z")).toMatch(/15 de septiembre de 2026/);
  });

  test("y sin fecha, vacío en vez de «Invalid Date»", () => {
    expect(elDia(null)).toBe("");
    expect(elDia("ayer")).toBe("");
  });
});
