/**
 * Lo que la etiqueta de la versión dice del coche.
 *
 * Esto sale del fallo del T-Roc: el cliente eligió «R-Line 1.5 TSI 110kW
 * (150CV) DSG» de la lista, la pantalla pidió los datos de esa versión para
 * rellenarlos solos, y no rellenó nada — de las 16.809 versiones del catálogo,
 * **cero** tienen escritas las columnas de potencia, CO2 o cambio. Así que
 * escribió a mano 110 CV (son kilovatios) y Manual (es un DSG).
 *
 * La etiqueta lo llevaba escrito. Estas pruebas van con nombres de versión
 * reales del catálogo.
 */
import * as V from "./loQueDiceLaVersion";

describe("la potencia", () => {
  test("los caballos, cuando la etiqueta los dice", () => {
    expect(V.losCaballos("R-Line 1.5 TSI 110kW (150CV) DSG")).toBe(150);
    expect(V.losCaballos("1.0 TSI Life 95 CV")).toBe(95);
  });

  test("y cuando solo dice kilovatios, se convierten", () => {
    /*
     * Este es el error exacto: ve «110kW» y escribe 110 en la casilla de CV.
     * Son 150, y cuarenta caballos mueven el precio del anuncio.
     */
    expect(V.losCaballos("Life 1.5 TSI 110kW DSG")).toBe(150);
    expect(V.losKilovatios("Life 1.5 TSI 110kW DSG")).toBe(110);
  });

  test("y si no dice ninguna de las dos, no se inventa", () => {
    expect(V.losCaballos("Advance")).toBe(null);
    expect(V.losKilovatios("Advance")).toBe(null);
  });
});

describe("la cilindrada", () => {
  test("«1.5» son 1.500", () => {
    expect(V.laCilindrada("R-Line 1.5 TSI 110kW (150CV) DSG")).toBe(1500);
    expect(V.laCilindrada("2.0 TDI 150CV")).toBe(2000);
    expect(V.laCilindrada("1,6 HDi")).toBe(1600);
  });

  test("pero no se confunde con otros números", () => {
    expect(V.laCilindrada("Style 2022")).toBe(null);
    expect(V.laCilindrada("e-Golf 35.8 kWh")).toBe(null);
    expect(V.laCilindrada("Advance")).toBe(null);
  });
});

describe("el cambio", () => {
  test("los nombres de caja automática que usan las marcas", () => {
    for (const etiqueta of [
      "R-Line 1.5 TSI 110kW (150CV) DSG",
      "Sport 2.0 TDI 150CV S tronic",
      "Advance 1.4 TSI Tiptronic",
      "GT Line 1.5 BlueHDi EAT8",
      "Zen TCe 140 EDC",
      "Active 1.2 PureTech Automático",
      "2.0 TDI 190CV quattro 7G",
    ]) {
      expect(V.elCambio(etiqueta)).toBe("automatico");
    }
  });

  test("y el manual cuando lo dice", () => {
    expect(V.elCambio("Life 1.0 TSI 110CV Manual")).toBe("manual");
  });

  test("pero callar no es ser manual", () => {
    /*
     * La mayoría de las versiones manuales no escriben «manual» en su nombre.
     * Darlas por manuales seria volver a poner un dato inventado donde habia
     * un hueco — que es exactamente el fallo que esto arregla.
     */
    expect(V.elCambio("R-Line 1.5 TSI 150CV")).toBe("");
    expect(V.elCambio("Advance")).toBe("");
    expect(V.elCambio("")).toBe("");
  });

  test("y no confunde una palabra que contenga otra", () => {
    // «Autobiography» del Range Rover lleva «auto» dentro y no es un cambio.
    expect(V.elCambio("Autobiography 3.0 D300")).toBe("");
  });
});

describe("todo junto, como lo rellena el formulario", () => {
  test("la versión del T-Roc de la prueba", () => {
    const d = V.loQueDiceLaVersion("R-Line 1.5 TSI 110kW (150CV) DSG");
    expect(d).toEqual({
      displacement: "1500",
      cv: "150",
      horsepower: "110",
      transmissionType: "automatico",
    });
  });

  test("y lo que la etiqueta no dice, no sale", () => {
    /*
     * Un vacío en el objeto pisaría lo que el cliente ya hubiera escrito. Lo
     * que no se sabe se deja como estaba.
     */
    expect(V.loQueDiceLaVersion("Advance")).toEqual({});
    expect(V.loQueDiceLaVersion("")).toEqual({});
    expect(V.loQueDiceLaVersion(null)).toEqual({});
  });
});

describe("quedarse con las versiones de su motor", () => {
  const DEL_TROC = [
    "Life 1.0 TSI 81kW (110CV)",
    "Life 1.5 TSI 110kW (150CV) DSG",
    "R-Line 1.5 TSI 110kW (150CV) DSG",
    "Sport 2.0 TDI 110kW (150CV) DSG",
    "Advance",
  ];
  // Lo que dice su ficha técnica: 1.498 cc y 110 kW.
  const suMotor = { cc: 1498, kw: 110 };

  test("se quedan las de su cilindrada y su potencia", () => {
    const quedan = DEL_TROC.filter((x) => V.encajaConElMotor(x, suMotor));
    expect(quedan.includes("R-Line 1.5 TSI 110kW (150CV) DSG")).toBe(true);
    expect(quedan.includes("Life 1.5 TSI 110kW (150CV) DSG")).toBe(true);
  });

  test("y se van las que no pueden ser", () => {
    const quedan = DEL_TROC.filter((x) => V.encajaConElMotor(x, suMotor));
    expect(quedan.includes("Life 1.0 TSI 81kW (110CV)")).toBe(false);
    expect(quedan.includes("Sport 2.0 TDI 110kW (150CV) DSG")).toBe(false);
  });

  test("pero una etiqueta que no dice nada se queda", () => {
    /*
     * Descartar por falta de datos dejaria al cliente sin su version y sin
     * saber por que. Ante la duda, que la vea.
     */
    expect(V.encajaConElMotor("Advance", suMotor)).toBe(true);
  });

  test("y sin ficha técnica no se descarta ninguna", () => {
    for (const x of DEL_TROC) expect(V.encajaConElMotor(x, {})).toBe(true);
  });

  test("el margen deja pasar el redondeo, no otro motor", () => {
    // 1.498 y 1.500 son el mismo motor; 1.0 y 1.5 no.
    expect(V.encajaConElMotor("1.5 TSI 110kW", { cc: 1498, kw: 110 })).toBe(true);
    expect(V.encajaConElMotor("1.5 TSI 111kW", { cc: 1498, kw: 110 })).toBe(true);
    expect(V.encajaConElMotor("1.5 TSI 130kW", { cc: 1498, kw: 110 })).toBe(false);
  });
});
