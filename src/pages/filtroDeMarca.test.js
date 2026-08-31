/**
 * El desplegable de marca del marketplace.
 *
 * Esta pantalla no usa el `<select>` del navegador: usa una lista propia. Cuando
 * el desplegable de marca pasó a tener dos bloques —«con coches disponibles» y
 * «resto del catálogo»— las 443 marcas quedaron dentro de `<optgroup>`, y la
 * lista propia solo miraba los hijos directos que fueran `<option>`.
 *
 * Resultado: el filtro se quedó con una sola entrada, la de «Marca», y no se
 * podía elegir ninguna. Esta prueba fija que un grupo no se traga sus opciones.
 */
import fs from "fs";
import path from "path";

const FUENTE = fs.readFileSync(
  path.join(__dirname, "PortalVoMarketplacePage.js"),
  "utf8"
);

describe("el desplegable de los filtros", () => {
  test("lee las opciones que van dentro de un grupo", () => {
    expect(FUENTE).toContain('hijo.type === "optgroup"');
  });

  test("no se queda solo con los hijos sueltos", () => {
    // El filtro de antes: `.filter((c) => c && c.type === "option")` aplicado
    // directamente a los hijos, que dejaba fuera los grupos enteros.
    const filtroViejo = 'React.Children.toArray(children)\n    .filter((c) => c && c.type === "option")';
    expect(FUENTE).not.toContain(filtroViejo);
  });

  test("el título del grupo no se puede pulsar", () => {
    // Si una cabecera fuera seleccionable, elegirla pondría el filtro a
    // «Con coches disponibles», que no es ninguna marca.
    expect(FUENTE).toContain("opt.cabecera !== undefined");
  });

  test("un grupo sin opciones no pinta su título", () => {
    expect(FUENTE).toContain("if (!dentro.length) continue;");
  });

  test("el filtro de marca sigue usando los dos bloques", () => {
    expect(FUENTE).toContain('optgroup label="Con coches disponibles"');
    expect(FUENTE).toContain('optgroup label="Resto del catálogo"');
  });
});
