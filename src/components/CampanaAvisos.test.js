import { fireEvent, render, screen } from "@testing-library/react";
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

/**
 * Y que al pulsarla se despliegue el resumen.
 *
 * Era un botón que llevaba a Solicitudes y nada más. Con un número encima eso
 * se lee como una promesa de enseñar algo — y estando ya en Solicitudes,
 * pulsarla no hacía nada. Un icono con un «5» que al pulsarlo no abre nada es
 * peor que no tener campana.
 */
describe("el desplegable", () => {
  const conMandato = [{
    id: "lead-1",
    type: "venta_gestionada",
    title: "Volkswagen T-Roc · 8888LXR",
    meta: JSON.stringify({
      mandato: { encargo_id: "enc-1", mandato_id: "PC-MAND-2026-001", firmado: false },
      puertas: [
        { clave: "idcar", nombre: "El coche", abierta: true, falta: "" },
        {
          clave: "papeles", nombre: "Los papeles", abierta: false, falta: "Te falta la ITV",
          donde: { texto: "Subir los documentos", url: "/mis-coches?matricula=8888LXR" },
        },
      ],
    }),
  }];

  test("cerrada no enseña el resumen", () => {
    render(<CampanaAvisos solicitudes={conMandato} />);
    expect(screen.queryByText("Los papeles")).not.toBeInTheDocument();
  });

  test("y al pulsarla sale, con una fila por cosa", () => {
    render(<CampanaAvisos solicitudes={conMandato} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    expect(screen.getByText("El mandato firmado")).toBeInTheDocument();
    expect(screen.getByText("Los papeles")).toBeInTheDocument();
  });

  test("cada una lleva a donde se hace", () => {
    /*
     * Es el motivo de que exista: poder resolverlo desde donde estás, sin
     * entrar al panel. Una lista que solo informa obliga a buscar el sitio.
     */
    render(<CampanaAvisos solicitudes={conMandato} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    const papeles = screen.getByText("Los papeles").closest("a");
    expect(papeles).toHaveAttribute("href", "/mis-coches?matricula=8888LXR");
  });

  test("y el mandato, que se sube desde el panel, va al panel", () => {
    // No tiene `donde` a propósito: se resuelve en su solicitud.
    const alPanel = jest.fn();
    render(<CampanaAvisos solicitudes={conMandato} onAbrir={alPanel} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    fireEvent.click(screen.getByText("El mandato firmado"));
    expect(alPanel).toHaveBeenCalled();
  });

  test("el número cuenta el mandato", () => {
    // Una puerta pendiente + el mandato = dos.
    render(<CampanaAvisos solicitudes={conMandato} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("se cierra con Escape", () => {
    // Con el ratón se cierra pulsando fuera; con el teclado no habría forma de
    // salir sin ir a buscar el botón otra vez.
    render(<CampanaAvisos solicitudes={conMandato} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    expect(screen.getByText("Los papeles")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Los papeles")).not.toBeInTheDocument();
  });

  test("y siempre hay una salida a la lista entera", () => {
    render(<CampanaAvisos solicitudes={conMandato} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    expect(screen.getByText("Ver todo en Mis solicitudes")).toBeInTheDocument();
  });
});

describe("la cita del taller en la campana", () => {
  /*
   * Tiene día y hora, que es justo lo que la campana deja entrar. Vivía solo
   * dentro de su solicitud, y a Solicitudes se entra a mirar: a una cita hay
   * que llegar antes del jueves.
   */
  const conTaller = (extra = {}) => ({
    id: "lead-1",
    type: "venta_gestionada",
    title: "Volkswagen T-Roc · 8888LXR",
    meta: JSON.stringify({
      puertas: [],
      taller: {
        taller: "Norauto Alcobendas",
        direccion: "Calle de los Calabozos 13",
        // Un año por delante: la campana solo enseña las que no han pasado.
        cita_at: new Date(Date.now() + 86400000 * 5).toISOString(),
        cliente_pidio: "",
        ...extra,
      },
    }),
  });

  test("sale, y cuenta", () => {
    render(<CampanaAvisos solicitudes={[conTaller()]} />);
    const boton = screen.getByRole("button", { name: /Tienes/ });
    expect(boton).toHaveAccessibleName(/una revisión en el taller/);
    fireEvent.click(boton);
    expect(screen.getByText("Revisión en el taller")).toBeInTheDocument();
    expect(screen.getByText(/Norauto Alcobendas/)).toBeInTheDocument();
  });

  test("no se llama «visita»", () => {
    /*
     * Una visita es alguien que viene a ver su coche; esto es él llevándolo a
     * un sitio. Contarlas juntas le haría prepararse para lo que no es.
     */
    render(<CampanaAvisos solicitudes={[conTaller()]} />);
    expect(screen.getByRole("button", { name: /Tienes/ })).not.toHaveAccessibleName(/cita próxima/);
  });

  test("si ya pidió cambiarla, no se le dice que la lleve", () => {
    render(<CampanaAvisos solicitudes={[conTaller({ cliente_pidio: "cambio" })]} />);
    fireEvent.click(screen.getByRole("button", { name: /Tienes/ }));
    expect(screen.getByText(/Nos has pedido cambiar/)).toBeInTheDocument();
  });

  test("una cita pasada no enciende la campana", () => {
    const pasada = conTaller({ cita_at: new Date(Date.now() - 86400000).toISOString() });
    const { container } = render(<CampanaAvisos solicitudes={[pasada]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
