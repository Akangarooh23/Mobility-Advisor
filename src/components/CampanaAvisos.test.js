import { render, screen } from "@testing-library/react";
import CampanaAvisos from "./CampanaAvisos";

/**
 * La campana de la cabecera.
 *
 * Lo que se protege: que **no se dibuje cuando no hay nada**. Un icono
 * permanentemente encendido deja de mirarse en dos semanas, y entonces no
 * avisa de nada — que es justo lo contrario de para lo que está.
 */
const encargo = (faltan) => ({
  id: "lead-1",
  type: "venta_gestionada",
  title: "Volkswagen T-Roc · 8888LXR",
  meta: JSON.stringify({
    puertas: [
      { clave: "idcar", nombre: "El coche", abierta: faltan < 5, falta: "" },
      { clave: "papeles", nombre: "Los papeles", abierta: faltan < 1, falta: "Te falta la ITV" },
      { clave: "tasacion", nombre: "La tasación", abierta: faltan < 2, falta: "" },
      { clave: "informe", nombre: "El informe", abierta: faltan < 3, falta: "" },
      { clave: "franjas", nombre: "Las franjas", abierta: faltan < 4, falta: "" },
    ],
  }),
});

describe("la campana", () => {
  test("sin nada que avisar no se dibuja", () => {
    const { container } = render(<CampanaAvisos solicitudes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("y con el encargo terminado tampoco", () => {
    /*
     * Es lo que permite que lo del encargo esté aquí: se acaba. El día que
     * dejara de acabarse, habría que sacarlo de la campana.
     */
    const { container } = render(<CampanaAvisos solicitudes={[encargo(0)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("cuenta lo que le falta traernos", () => {
    render(<CampanaAvisos solicitudes={[encargo(2)]} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label", "Tienes 2 cosas que traernos"
    );
  });

  test("con una sola, en singular", () => {
    render(<CampanaAvisos solicitudes={[encargo(1)]} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label", "Tienes una cosa que traernos"
    );
  });

  test("no suma peras con manzanas: las cita y lo del encargo van aparte", () => {
    /*
     * «Tienes 3 avisos» no dice nada. Una cita es un sitio al que ir y un papel
     * que falta es algo que hacer desde el sofá: se nombran las dos cosas.
     */
    const cita = {
      id: "cita-1",
      type: "visita_marketplace",
      title: "Seat Ibiza",
      status: "Cita confirmada",
      meta: JSON.stringify({ starts_at: new Date(Date.now() + 86400000).toISOString() }),
    };
    render(<CampanaAvisos solicitudes={[cita, encargo(1)]} />);
    const etiqueta = screen.getByRole("button").getAttribute("aria-label");
    expect(etiqueta).toMatch(/cita/);
    expect(etiqueta).toMatch(/cosa que traernos/);
  });
});
