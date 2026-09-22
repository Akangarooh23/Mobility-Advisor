/**
 * Después de la visita, contestar también desde el panel.
 *
 * El correo pregunta «¿te lo quedas?» y la app lo enseña en la cita pasada,
 * pero quien entraba al panel a decírnoslo no tenía dónde: su visita salía como
 * «Cita confirmada» con un «Ver el coche» y un «Anular cita», y de esa
 * respuesta es de donde sale una compra.
 *
 * Se comprueba sobre el fichero, como sus vecinas: lo que importa es que la
 * pregunta esté, que solo se haga cuando se puede contestar y que las tres
 * salidas pesen lo mismo.
 */
import fs from "fs";
import path from "path";

const PANEL = fs
  .readFileSync(path.join(__dirname, "userDashboard", "UserDashboardSolicitudes.js"), "utf8")
  .replace(/\r\n/g, "\n");

const TIENDA = fs
  .readFileSync(path.join(__dirname, "..", "..", "lib", "billingStore.js"), "utf8")
  .replace(/\r\n/g, "\n");

const BLOQUE = PANEL.slice(
  PANEL.indexOf("const puedeContestarLaVisita ="),
  PANEL.indexOf('{item.type === "visita_marketplace" && item.vehicle_id && ('),
);

describe("la pregunta de después de la visita, en el panel", () => {
  test("está, y lleva a la página donde se contesta", () => {
    expect(BLOQUE).toContain("/quiero-comprarlo?id=");
    expect(BLOQUE).toContain("/como-fue?id=");
    for (const respuesta of ["fue", "no_fue"]) {
      expect(BLOQUE).toContain(`"${respuesta}"`);
    }
  });

  test("solo cuando la visita ya pasó, está en plazo y no se ha contestado", () => {
    expect(BLOQUE).toContain("!meta.resultado");
    expect(BLOQUE).toContain("yaPaso");
    expect(BLOQUE).toContain("enPlazo");
    // El mismo plazo que el correo y que «quiero comprarlo»: catorce días.
    expect(PANEL).toContain("const DIAS_PARA_CONTESTAR = 14;");
  });

  test("y no a una que sigue pendiente de aprobación", () => {
    expect(BLOQUE).toContain("item.status !== ESTADO_CITA.pending");
  });

  test("comprar solo se ofrece donde se puede comprar", () => {
    /*
     * En el coche de un concesionario esa página contesta que no puede ser, así
     * que el botón llevaría a un callejón. El servidor dice si se puede.
     */
    expect(BLOQUE).toContain("meta.se_puede_comprar");
    expect(TIENDA).toContain("se_puede_comprar: r.se_puede_comprar === true,");
    expect(TIENDA).toContain("b.offer_id LIKE 'idcar-%'");
  });

  test("ninguna de las tres respuestas va resaltada sobre las otras", () => {
    /*
     * Pintar «quiero comprarlo» en amarillo y las otras dos apagadas empuja a
     * la respuesta que nos conviene, y entonces el dato deja de servir para lo
     * que se recoge. Las otras dos llevan borde y fondo propio, no son texto
     * suelto al lado de un botón.
     */
    const otras = BLOQUE.slice(BLOQUE.indexOf('["fue"'));
    expect(otras).toContain('border: "1px solid var(--borde)"');
    expect(otras).toContain("borderRadius: 8");
  });

  test("y si ya contestó, se le dice en vez de volver a preguntar", () => {
    expect(PANEL).toContain("loQueDijoDeLaVisita");
    expect(PANEL).toContain("Nos dijiste que te lo quedas");
  });

  test("el resultado viaja desde el servidor, que es quien lo sabe", () => {
    expect(TIENDA).toContain("resultado: s(r.resultado),");
  });
});
