/**
 * El desplegable de marca y modelo de Comprar › Buscar coche.
 *
 * Se cambio el <select> nativo por uno propio porque el navegador abria la
 * lista hacia arriba con cientos de opciones. El cambio solo sale a cuenta si
 * lo propio hace todo lo que hacia el nativo, y eso es lo que se comprueba
 * aqui: escribir para filtrar, recorrer con las flechas, Intro, Escape, y que
 * el separador de «Mas marcas» sea un rotulo y no una opcion que se pueda
 * elegir sin querer.
 *
 * Que la lista caiga hacia abajo es cuestion de CSS y no se puede afirmar
 * desde aqui: jsdom no hace maquetacion. Lo que si se afirma es que la lista
 * existe dentro del campo, que es lo que permite anclarla debajo.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Desplegable } from "./BuscarCochePage";

const CON = [
  { nombre: "Audi", n: 37442 },
  { nombre: "BMW", n: 37302 },
  { nombre: "Yudo", n: 5 },
];
const SIN = [{ nombre: "Acura", n: 0 }, { nombre: "Zenos", n: 0 }];

function montar(extra = {}) {
  const onChange = jest.fn();
  const utils = render(
    <Desplegable
      etiqueta="Marca"
      valor=""
      conOfertas={CON}
      sinOfertas={SIN}
      separador="──── Más marcas ────"
      vacio="Todas las marcas"
      filtrarPh="Escribe para filtrar…"
      nadaCoincide="Nada coincide"
      onChange={onChange}
      {...extra}
    />
  );
  return { ...utils, onChange, campo: screen.getByRole("combobox") };
}

function abrir() {
  const t = montar();
  fireEvent.focus(t.campo);
  return t;
}

test("cerrado no ensena la lista", () => {
  montar();
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("al abrir salen las marcas con ofertas y las de «Mas marcas»", () => {
  abrir();
  const lista = screen.getByRole("listbox");
  const opciones = within(lista).getAllByRole("option");
  // 3 con ofertas + 2 sin + la de «todas las marcas».
  expect(opciones).toHaveLength(6);
  expect(opciones[0]).toHaveTextContent("Todas las marcas");
  expect(within(lista).getByText("──── Más marcas ────")).toBeInTheDocument();
});

test("el separador es un rotulo, no una opcion elegible", () => {
  const { onChange } = abrir();
  const rotulo = screen.getByText("──── Más marcas ────");
  expect(rotulo).toHaveAttribute("role", "presentation");
  fireEvent.click(rotulo);
  expect(onChange).not.toHaveBeenCalled();
});

test("la lista vive dentro del campo, que es lo que la ancla debajo", () => {
  const { container } = abrir();
  const campo = container.querySelector(".bc-combo");
  expect(campo).toContainElement(screen.getByRole("listbox"));
});

test("escribir filtra, y el recuento sigue a la vista", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "yud" } });
  const opciones = screen.getAllByRole("option");
  expect(opciones).toHaveLength(1);
  expect(opciones[0]).toHaveTextContent("Yudo");
  expect(opciones[0]).toHaveTextContent("5");
});

test("el filtro no distingue mayusculas ni busca solo por el principio", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "MW" } });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getAllByRole("option")[0]).toHaveTextContent("BMW");
});

test("sin coincidencias lo dice, y no deja una lista vacia", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "zzzz" } });
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  expect(screen.getByText("Nada coincide")).toBeInTheDocument();
});

test("las flechas recorren la lista e Intro elige lo marcado", () => {
  const t = abrir();
  fireEvent.keyDown(t.campo, { key: "ArrowDown" }); // de «todas» a Audi
  fireEvent.keyDown(t.campo, { key: "ArrowDown" }); // a BMW
  fireEvent.keyDown(t.campo, { key: "Enter" });
  expect(t.onChange).toHaveBeenCalledWith("BMW");
});

test("las flechas tambien alcanzan las marcas sin ofertas", () => {
  const t = abrir();
  fireEvent.keyDown(t.campo, { key: "End" });
  fireEvent.keyDown(t.campo, { key: "Enter" });
  expect(t.onChange).toHaveBeenCalledWith("Zenos");
});

test("arriba desde el principio da la vuelta al final", () => {
  const t = abrir();
  fireEvent.keyDown(t.campo, { key: "ArrowUp" });
  fireEvent.keyDown(t.campo, { key: "Enter" });
  expect(t.onChange).toHaveBeenCalledWith("Zenos");
});

test("pulsar una opcion la elige y cierra la lista", () => {
  const t = abrir();
  fireEvent.click(screen.getByText("Audi"));
  expect(t.onChange).toHaveBeenCalledWith("Audi");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("Escape cierra sin elegir nada", () => {
  const t = abrir();
  fireEvent.keyDown(t.campo, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(t.onChange).not.toHaveBeenCalled();
});

test("pulsar fuera cierra la lista", () => {
  abrir();
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("al cerrar se olvida el filtro escrito", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "yud" } });
  fireEvent.keyDown(t.campo, { key: "Escape" });
  fireEvent.focus(t.campo);
  expect(screen.getAllByRole("option")).toHaveLength(6);
});

test("con la marca elegida se ve su nombre y se puede quitar", () => {
  const t = montar({ valor: "Audi" });
  expect(t.campo).toHaveValue("Audi");
  fireEvent.click(screen.getByRole("button", { name: "Todas las marcas" }));
  expect(t.onChange).toHaveBeenCalledWith("");
});

test("deshabilitado ni se abre ni ofrece quitar", () => {
  const t = montar({ deshabilitado: true, vacio: "Elige antes una marca" });
  expect(t.campo).toBeDisabled();
  fireEvent.focus(t.campo);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("quitar la marca cierra la lista de modelos que estuviera abierta", () => {
  // Sin esto se podia elegir un modelo sin marca, que no es un filtro que la
  // pantalla sepa representar.
  const t = abrir();
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  t.rerender(
    <Desplegable
      etiqueta="Marca"
      valor=""
      conOfertas={CON}
      sinOfertas={SIN}
      separador="──── Más marcas ────"
      vacio="Elige antes una marca"
      filtrarPh="Escribe para filtrar…"
      nadaCoincide="Nada coincide"
      deshabilitado
      onChange={t.onChange}
    />
  );
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("lo elegido va marcado para un lector de pantalla", () => {
  montar({ valor: "BMW" });
  fireEvent.focus(screen.getByRole("combobox"));
  const elegida = screen.getAllByRole("option").find((o) => o.textContent.startsWith("BMW"));
  expect(elegida).toHaveAttribute("aria-selected", "true");
});
