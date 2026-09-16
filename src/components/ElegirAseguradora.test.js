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
import ElegirAseguradora from "./ElegirAseguradora";
import { ASEGURADORAS } from "../utils/aseguradoras";

/** Como se usa de verdad: el valor lo guarda la pantalla, no el componente. */
function EnUnFormulario({ inicial = "" }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <ElegirAseguradora valor={valor} onCambiar={setValor} />
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
