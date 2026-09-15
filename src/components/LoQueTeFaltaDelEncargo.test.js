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

/**
 * Y el sitio donde sube el mandato firmado.
 *
 * Antes se le pedía que contestara al correo, y entonces el papel se quedaba en
 * una bandeja de entrada mientras el encargo decía «sin firmar» — con el papel
 * firmado ya en nuestro poder.
 */
describe("el mandato es una fila más de la lista", () => {
  const SIN_FIRMAR = { encargo_id: "enc-1", mandato_id: "PC-MAND-2026-001", firmado: false };
  const FIRMADO = { ...SIN_FIRMAR, firmado: true };

  test("sale como una fila, con su botón de subirlo", () => {
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={SIN_FIRMAR} />);
    expect(screen.getByText("El mandato firmado")).toBeInTheDocument();
    expect(screen.getByText(/Subir el mandato firmado/)).toBeInTheDocument();
  });

  test("y va la primera: es lo primero del camino", () => {
    /*
     * Se le manda nada más hablar con él, antes de que traiga papeles ni fotos.
     * Si fuera la última, la leería como el remate y no como el principio.
     */
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={SIN_FIRMAR} />);
    const filas = screen.getAllByText(/El mandato firmado|El coche|Los papeles/);
    expect(filas[0]).toHaveTextContent("El mandato firmado");
  });

  test("CUENTA en el total, que es el motivo de moverlo aquí", () => {
    /*
     * En un recuadro aparte, el contador decía «te quedan 4 cosas» con cinco
     * pendientes — y la que no contaba era la que decide si podemos vender.
     */
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={SIN_FIRMAR} />);
    expect(screen.getByText(/Te quedan 3 cosas/)).toBeInTheDocument();
    expect(screen.getByText("1 de 4 hechas")).toBeInTheDocument();
  });

  test("dice cuál es, por su número", () => {
    // Con dos coches en venta, «tu mandato» no dice cuál.
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={SIN_FIRMAR} />);
    expect(screen.getByText(/PC-MAND-2026-001/)).toBeInTheDocument();
  });

  test("firmado sale como hecho y sin botón", () => {
    // Un botón para algo ya hecho invita a volver a hacerlo.
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={FIRMADO} />);
    expect(screen.getByText("El mandato firmado")).toBeInTheDocument();
    expect(screen.queryByText(/Subir el mandato firmado/)).not.toBeInTheDocument();
    expect(screen.getByText("2 de 4 hechas")).toBeInTheDocument();
  });

  test("sin mandato, la lista es la de siempre", () => {
    render(<LoQueTeFaltaDelEncargo puertas={PUERTAS} mandato={null} />);
    expect(screen.queryByText("El mandato firmado")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 3 hechas")).toBeInTheDocument();
  });

  test("con mandato y sin puertas, se pinta igual", () => {
    // Es quien acaba de recibirlo y todavía no ha dado de alta el coche.
    render(<LoQueTeFaltaDelEncargo puertas={[]} mandato={SIN_FIRMAR} />);
    expect(screen.getByText("El mandato firmado")).toBeInTheDocument();
  });

  test("ni puertas ni mandato: no se pinta nada", () => {
    const { container } = render(<LoQueTeFaltaDelEncargo puertas={[]} mandato={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
