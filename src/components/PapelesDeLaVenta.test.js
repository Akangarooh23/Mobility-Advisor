import { render, screen } from "@testing-library/react";
import PapelesDeLaVenta from "./PapelesDeLaVenta";

/**
 * Lo que ha firmado, en la ficha de su coche.
 *
 * Y sobre todo: **en las dos fichas**. La de un coche está escrita dos veces en
 * este repositorio —el garaje (`/mis-coches`) y el panel (`/panel/vehiculos`)—,
 * son dos pantallas distintas con las mismas secciones, y la primera versión de
 * esto acabó solo en una: la que yo miraba, no la que mira ella.
 */
const PAPELES = [
  { id: "d1", nombre: "Mandato firmado · 8888LXR.pdf", que_es: "El mandato firmado", cuando: "2026-09-15T15:12:00.000Z" },
  { id: "d2", nombre: "Precio firmado · 8888LXR.pdf", que_es: "El precio de salida firmado", cuando: "2026-09-16T19:20:00.000Z" },
];

describe("los papeles firmados", () => {
  test("dicen qué son, no solo cómo se llama el fichero", () => {
    // «documento (1).pdf» no dice cuál de los dos es.
    render(<PapelesDeLaVenta papeles={PAPELES} />);
    expect(screen.getByText("El mandato firmado")).toBeInTheDocument();
    expect(screen.getByText("El precio de salida firmado")).toBeInTheDocument();
  });

  test("y cada uno se puede descargar", () => {
    render(<PapelesDeLaVenta papeles={PAPELES} />);
    const enlaces = screen.getAllByRole("link", { name: /Descargar/ });
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute("href")).toContain("id=d1");
  });

  test("sin papeles no se pinta nada", () => {
    // Un coche de alguien a quien no le vendemos nada no tiene esta sección.
    const { container } = render(<PapelesDeLaVenta papeles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("y está en las dos fichas", () => {
  /*
   * El fallo de la primera versión, escrito como prueba: el bloque existía, se
   * probaba, y estaba en una sola de las dos pantallas.
   */
  const fs = require("fs");
  const path = require("path");
  const leer = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  const GARAJE = leer("pages/ServiceIdCarsManagePage.js");
  const PANEL = leer("pages/userDashboard/UserDashboardVehicles.js");

  test("en el garaje", () => {
    expect(GARAJE).toContain("<PapelesDeLaVenta");
    expect(GARAJE).toContain("usePapelesDeLaVenta(");
  });

  test("y en el panel", () => {
    expect(PANEL).toContain("<PapelesDeLaVenta");
    expect(PANEL).toContain("usePapelesDeLaVenta(");
  });
});
