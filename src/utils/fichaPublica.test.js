/**
 * La ficha de un coche se ve sin sesión, y no caduca.
 *
 * Estuvo abierta con fecha de cierre, y el día que pasó la fecha el comprador
 * que venía de coches.net por `/v/8888LXR` se encontraba el diálogo de iniciar
 * sesión. Nadie se enteró hasta probarlo: el código no había cambiado, había
 * cambiado el calendario.
 */
import fs from "fs";
import path from "path";
import { FICHA_VO_PUBLICA, esFichaDeUnCoche } from "./fichaPublica";

describe("la ficha de un coche, sin sesión", () => {
  test("está abierta", () => {
    expect(FICHA_VO_PUBLICA).toBe(true);
  });

  test("y no depende de la fecha", () => {
    // Lo que la cerró fue una fecha. Que no vuelva ninguna.
    const fuente = fs.readFileSync(path.join(__dirname, "fichaPublica.js"), "utf8");
    expect(fuente).not.toMatch(/new Date\(|Date\.now\(/);
  });

  test("la ficha de un anuncio, sí", () => {
    expect(esFichaDeUnCoche("/marketplace-vo/idcar-veh-1778144236925")).toBe(true);
    expect(esFichaDeUnCoche("/marketplace-vo/idcar-veh-1/")).toBe(true);
  });

  test("y la dirección corta de los portales, también", () => {
    expect(esFichaDeUnCoche("/v/8888LXR")).toBe(true);
    expect(esFichaDeUnCoche("/v/8888lxr")).toBe(true);
  });

  test("pero el listado sigue pidiendo sesión", () => {
    expect(esFichaDeUnCoche("/marketplace-vo")).toBe(false);
    expect(esFichaDeUnCoche("/marketplace-vo/")).toBe(false);
    expect(esFichaDeUnCoche("/v")).toBe(false);
    expect(esFichaDeUnCoche("/mis-coches")).toBe(false);
  });

  test("el arranque la usa para no levantar el diálogo de sesión", () => {
    const arranque = fs.readFileSync(path.join(__dirname, "..", "hooks", "useAppBootstrap.js"), "utf8");
    expect(arranque).toMatch(/esFichaDeUnCoche\(window\.location\.pathname\)/);
  });
});
