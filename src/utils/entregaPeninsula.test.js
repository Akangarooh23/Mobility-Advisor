import fs from "fs";
import path from "path";
import { llevaRecargo, FUERA_DE_PENINSULA } from "./entregaPeninsula";

/**
 * Dónde llega el coche por carretera y dónde hay que meterlo en un barco.
 *
 * Esta lista está en dos sitios: aquí, para avisar en la ficha mientras el
 * cliente mira el precio, y en el servidor, que es quien manda. Si se separan,
 * se avisaría de un recargo que no se aplica —o peor, se cobraría uno del que
 * no se avisó.
 */
describe("el recargo de fuera de la península", () => {
  test("las provincias que no son península lo llevan", () => {
    for (const p of ["Illes Balears", "Islas Baleares", "Las Palmas",
                     "Santa Cruz de Tenerife", "Ceuta", "Melilla"]) {
      expect(llevaRecargo(p)).toBe(true);
    }
  });

  test("las que sí lo son, no", () => {
    for (const p of ["Madrid", "Barcelona", "Almería", "A Coruña", "Cádiz"]) {
      expect(llevaRecargo(p)).toBe(false);
    }
  });

  test("sin provincia no se avisa de nada", () => {
    expect(llevaRecargo("")).toBe(false);
    expect(llevaRecargo(null)).toBe(false);
  });

  test("da igual cómo lo escriba: acentos y mayúsculas", () => {
    expect(llevaRecargo("ILLES BALEARS")).toBe(true);
    expect(llevaRecargo("  las palmas  ")).toBe(true);
  });

  test("la misma lista que el servidor", () => {
    // Si se separan, se avisa de un recargo que no se aplica, o al revés.
    const servidor = fs.readFileSync(
      path.join(__dirname, "..", "..", "lib", "api", "entrega-direccion-handler.js"),
      "utf8"
    );
    const trozo = servidor.slice(servidor.indexOf("FUERA_DE_PENINSULA"));
    for (const provincia of FUERA_DE_PENINSULA) {
      expect(trozo).toContain(`"${provincia}"`);
    }
  });
});
