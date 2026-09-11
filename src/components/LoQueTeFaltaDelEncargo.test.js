import { render, screen } from "@testing-library/react";
import LoQueTeFaltaDelEncargo from "./LoQueTeFaltaDelEncargo";

/**
 * Lo que ve el cliente de su encargo.
 *
 * Lo que se protege: que cada cosa que le falta sea **pulsable y lleve a donde
 * se hace**. Una lista que dice «falta la ITV» y no dice dónde subirla deja el
 * problema donde estaba — y era el motivo entero de enseñarla.
 */
const PUERTAS = [
  { clave: "idcar", nombre: "El coche", abierta: true, falta: "", donde: null },
  {
    clave: "papeles", nombre: "Los papeles", abierta: false,
    falta: "Te falta la ITV",
    donde: { texto: "Subir los documentos", url: "/panel/vehiculos?matricula=8888LXR#documentos" },
  },
  {
    clave: "tasacion", nombre: "La tasación", abierta: false,
    falta: "No te la has hecho todavía",
    donde: { texto: "Hacer la tasación gratuita", url: "/panel/tasaciones?matricula=8888LXR" },
  },
];

const enlaceDe = (nombre) =>
  screen.getAllByRole("link").find((a) => a.getAttribute("aria-label")?.startsWith(nombre));

describe("lo que te falta del encargo", () => {
  test("salen las cinco, también las hechas", () => {
    /*
     * Enseñar solo lo que falta convierte cada avance en una lista que se
     * acorta sin decir hacia dónde.
     */
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} />);
    expect(screen.getByText("El coche")).toBeInTheDocument();
    expect(screen.getByText("Los papeles")).toBeInTheDocument();
    expect(screen.getByText("La tasación")).toBeInTheDocument();
  });

  test("cada una que falta lleva a donde se hace", () => {
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} />);
    expect(enlaceDe("Los papeles")).toHaveAttribute(
      "href", "/panel/vehiculos?matricula=8888LXR#documentos"
    );
    expect(enlaceDe("La tasación")).toHaveAttribute(
      "href", "/panel/tasaciones?matricula=8888LXR"
    );
  });

  test("y la que ya está hecha no es un enlace", () => {
    // Un enlace para algo ya hecho invita a volver a hacerlo.
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} />);
    expect(enlaceDe("El coche")).toBeUndefined();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  test("dice cuántas le quedan, no solo cuáles", () => {
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} />);
    expect(screen.getByText(/Te quedan 2 cosas/)).toBeInTheDocument();
    expect(screen.getByText("1 de 3 hechas")).toBeInTheDocument();
  });

  test("con una sola, se dice en singular", () => {
    const una = PUERTAS.map((p) => (p.clave === "tasacion" ? { ...p, abierta: true, donde: null } : p));
    render(<LoQueTeFaltaDelEncargo puertas={una} />);
    expect(screen.getByText(/Te queda una cosa/)).toBeInTheDocument();
  });

  test("con todo hecho lo dice, y no queda ningún enlace", () => {
    const todas = PUERTAS.map((p) => ({ ...p, abierta: true, donde: null }));
    render(<LoQueTeFaltaDelEncargo puertas={todas} />);
    expect(screen.getByText(/Ya está todo/)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  test("sin puertas no se pinta nada", () => {
    // Una solicitud que no es un encargo no tiene por qué enseñar este bloque.
    const { container } = render(<LoQueTeFaltaDelEncargo puertas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("una que falta y no sabe dónde se hace no finge que sí", () => {
    /*
     * Si el servidor no supiera decir dónde, la fila tiene que seguir saliendo
     * —le falta igual— pero sin enlace: un enlace a ninguna parte es peor que
     * no tenerlo.
     */
    const sinSitio = [{ clave: "informe", nombre: "El informe", abierta: false, falta: "Sin hacer", donde: null }];
    render(<LoQueTeFaltaDelEncargo puertas={sinSitio} />);
    expect(screen.getByText("El informe")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
