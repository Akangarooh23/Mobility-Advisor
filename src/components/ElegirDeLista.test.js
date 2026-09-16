/**
 * El desplegable de aseguradora, montado de verdad.
 *
 * Aquí no se lee el fuente: se monta y se pulsa, porque el fallo que tuvo la
 * primera versión no se ve leyendo. Al elegir «Otra» se guardaba cadena vacía,
 * y como «vacío» es también «no has elegido nada», el desplegable volvía solo a
 * «Elige tu aseguradora» y el hueco para escribir desaparecía **antes de poder
 * usarlo**. Compilaba, se leía bien y no servía.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import ElegirDeLista from "./ElegirDeLista";
import { ASEGURADORAS } from "../utils/aseguradoras";

/** Como se usa de verdad: el valor lo guarda la pantalla, no el componente. */
function EnUnFormulario({ inicial = "" }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <ElegirDeLista valor={valor} onCambiar={setValor} opciones={ASEGURADORAS} etiqueta="Aseguradora" />
      <output data-testid="guardado">{valor}</output>
    </>
  );
}

const guardado = () => screen.getByTestId("guardado").textContent;

describe("elegir una de la lista", () => {
  test("están todas", () => {
    render(<EnUnFormulario />);
    for (const nombre of ASEGURADORAS) {
      expect(screen.getByRole("option", { name: nombre })).toBeInTheDocument();
    }
  });

  test("y al elegir una se guarda su nombre", () => {
    render(<EnUnFormulario />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "MAPFRE" } });
    expect(guardado()).toBe("MAPFRE");
  });
});

describe("la que no está en la lista", () => {
  test("al elegir «Otra» aparece dónde escribirla", () => {
    /*
     * El fallo de la primera versión: el hueco se abría y se cerraba solo, así
     * que quien tenía una compañía de fuera no podía decirlo.
     */
    render(<EnUnFormulario />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__otra__" } });
    expect(screen.getByLabelText("¿Cuál?")).toBeInTheDocument();
  });

  test("y lo que escribe es lo que se guarda", () => {
    render(<EnUnFormulario />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__otra__" } });
    fireEvent.change(screen.getByLabelText("¿Cuál?"), {
      target: { value: "Mutua de Propietarios" },
    });
    expect(guardado()).toBe("Mutua de Propietarios");
    // Y nunca el centinela: eso diría que está asegurada en «__otra__».
    expect(guardado()).not.toContain("__otra__");
  });

  test("el hueco no se cierra mientras escribe", () => {
    render(<EnUnFormulario />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__otra__" } });
    fireEvent.change(screen.getByLabelText("¿Cuál?"), { target: { value: "M" } });
    // Una letra sola no puede hacer desaparecer el campo.
    expect(screen.getByLabelText("¿Cuál?")).toBeInTheDocument();
    expect(guardado()).toBe("M");
  });
});

describe("una ficha que ya tenía compañía", () => {
  test("una de la lista sale elegida", () => {
    render(<EnUnFormulario inicial="MAPFRE" />);
    expect(screen.getByRole("combobox")).toHaveValue("MAPFRE");
  });

  test("escrita de otra manera, también", () => {
    // El campo era libre: casi nadie escribió la tilde.
    render(<EnUnFormulario inicial="linea directa" />);
    expect(screen.getByRole("combobox")).toHaveValue("Línea Directa");
  });

  test("y una de fuera sale como «Otra», sin perder el nombre", () => {
    /*
     * Es lo que más importa de todo esto: si saliera vacía, el primer guardado
     * borraría un dato que el cliente ya había dado.
     */
    render(<EnUnFormulario inicial="Seguros del Pueblo" />);
    expect(screen.getByRole("combobox")).toHaveValue("__otra__");
    expect(screen.getByLabelText("¿Cuál?")).toHaveValue("Seguros del Pueblo");
    expect(guardado()).toBe("Seguros del Pueblo");
  });
});

describe("cambiar de idea", () => {
  test("de «Otra» a una de la lista, y el hueco se va", () => {
    render(<EnUnFormulario inicial="Seguros del Pueblo" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "AXA" } });
    expect(guardado()).toBe("AXA");
    expect(screen.queryByLabelText("¿Cuál?")).not.toBeInTheDocument();
  });

  test("y de una de la lista a «Otra» sin arrastrar el nombre anterior", () => {
    // Quien viene de MAPFRE y elige «Otra» quiere escribir la suya, no borrar
    // «MAPFRE» letra a letra.
    render(<EnUnFormulario inicial="MAPFRE" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__otra__" } });
    expect(screen.getByLabelText("¿Cuál?")).toHaveValue("");
    expect(guardado()).toBe("");
  });
});

describe("con opciones que llevan explicación", () => {
  const CON_EXPLICACION = [
    { valor: "Terceros básico", explica: "Responsabilidad civil y daños a terceros." },
    { valor: "Todo riesgo sin franquicia", explica: "Daños propios sin franquicia." },
  ];

  function ConExplicacion({ inicial = "" }) {
    const [valor, setValor] = useState(inicial);
    return (
      <>
        <ElegirDeLista valor={valor} onCambiar={setValor} opciones={CON_EXPLICACION} etiqueta="Cobertura" />
        <output data-testid="guardado">{valor}</output>
      </>
    );
  }

  test("se enseña solo la de la elegida", () => {
    /*
     * Las diecinueve juntas serían un muro, y ninguna sería un campo que se
     * elige a ojo. Solo la elegida.
     */
    render(<ConExplicacion />);
    expect(screen.queryByText(/Responsabilidad civil/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Terceros básico" } });
    expect(screen.getByText(/Responsabilidad civil/)).toBeInTheDocument();
    expect(screen.queryByText(/sin franquicia\./)).not.toBeInTheDocument();
  });

  test("y lo que se guarda es el nombre, no la explicación", () => {
    render(<ConExplicacion />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Terceros básico" } });
    expect(screen.getByTestId("guardado").textContent).toBe("Terceros básico");
  });

  test("con «Otra» no se explica nada", () => {
    // Explicar lo que ha escrito el cliente con la frase de otra cobertura sería
    // ponerle palabras en la boca.
    render(<ConExplicacion />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__otra__" } });
    expect(screen.queryByText(/Responsabilidad civil/)).not.toBeInTheDocument();
  });
});

describe("no descuadra la fila", () => {
  test("la etiqueta no estira sus filas", () => {
    /*
     * Con la explicación debajo, este campo tiene tres filas y los de al lado
     * dos. La rejilla estira a todos al alto del más alto, y una etiqueta
     * estirada reparte ese hueco entre sus filas: el desplegable del campo
     * corto se iba hacia abajo y la fila se veía torcida.
     *
     * Se comprueba el estilo y no el píxel: jsdom no mide, así que medir aquí
     * sería inventarse una comprobación que no comprueba.
     */
    const { container } = render(
      <ElegirDeLista valor="" onCambiar={() => {}} opciones={["A"]} etiqueta="X" />,
    );
    const etiqueta = container.querySelector("label");
    expect(etiqueta).toHaveStyle({ alignContent: "start" });
  });

  test("y quien lo use puede cambiarlo", () => {
    const { container } = render(
      <ElegirDeLista
        valor=""
        onCambiar={() => {}}
        opciones={["A"]}
        etiqueta="X"
        estiloEtiqueta={{ alignContent: "center" }}
      />,
    );
    expect(container.querySelector("label")).toHaveStyle({ alignContent: "center" });
  });
});
