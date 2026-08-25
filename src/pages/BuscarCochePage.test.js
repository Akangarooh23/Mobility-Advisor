/**
 * El desplegable de marca y modelo de Comprar › Buscar coche.
 *
 * Se cambio el <select> nativo por uno propio porque el navegador abria la
 * lista hacia arriba con cientos de opciones. El cambio solo sale a cuenta si
 * lo propio hace todo lo que hacia el nativo, y eso es lo que se comprueba
 * aqui: escribir para filtrar, recorrer con las flechas, Intro, Escape, y que
 * los rotulos de tramo —«Marcas principales», «Mas marcas»— no sean opciones
 * que se puedan elegir sin querer.
 *
 * Que la lista caiga hacia abajo es cuestion de CSS y no se puede afirmar
 * desde aqui: jsdom no hace maquetacion. Lo que si se afirma es que la lista
 * existe dentro del campo, que es lo que permite anclarla debajo.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Desplegable } from "./BuscarCochePage";

const PRINCIPALES = [{ nombre: "SEAT", n: 28586 }, { nombre: "Toyota", n: 20397 }];
const CON = [
  { nombre: "Audi", n: 37442 },
  { nombre: "BMW", n: 37302 },
  { nombre: "Yudo", n: 5 },
];
const SIN = [{ nombre: "Acura", n: 0 }, { nombre: "Zenos", n: 0 }];

const ROTULO_PRINCIPALES = "──── Marcas principales ────";
const ROTULO_OTRAS = "──── Otras marcas ────";
const ROTULO_MAS = "──── Más marcas ────";

// 1 de «todas las marcas» + 2 principales + 3 otras + 2 sin ofertas.
const TOTAL = 8;

function grupos() {
  return [
    { separador: ROTULO_PRINCIPALES, opciones: PRINCIPALES },
    { separador: ROTULO_OTRAS, opciones: CON },
    { separador: ROTULO_MAS, opciones: SIN },
  ];
}

function pintar(extra, onChange) {
  return (
    <Desplegable
      etiqueta="Marca"
      valor=""
      grupos={grupos()}
      vacio="Todas las marcas"
      filtrarPh="Escribe para filtrar…"
      nadaCoincide="Nada coincide"
      onChange={onChange}
      {...extra}
    />
  );
}

function montar(extra = {}) {
  const onChange = jest.fn();
  const utils = render(pintar(extra, onChange));
  return { ...utils, onChange, campo: screen.getByRole("combobox"), pintar };
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

test("al abrir salen los tres tramos con sus rotulos", () => {
  abrir();
  const lista = screen.getByRole("listbox");
  expect(within(lista).getAllByRole("option")).toHaveLength(TOTAL);
  expect(within(lista).getByText(ROTULO_PRINCIPALES)).toBeInTheDocument();
  expect(within(lista).getByText(ROTULO_OTRAS)).toBeInTheDocument();
  expect(within(lista).getByText(ROTULO_MAS)).toBeInTheDocument();
});

test("las principales van primero y en el orden que se les da", () => {
  abrir();
  const opciones = screen.getAllByRole("option");
  expect(opciones[0]).toHaveTextContent("Todas las marcas");
  expect(opciones[1]).toHaveTextContent("SEAT");
  expect(opciones[2]).toHaveTextContent("Toyota");
  expect(opciones[3]).toHaveTextContent("Audi");
});

test("los rotulos son rotulos, no opciones elegibles", () => {
  const { onChange } = abrir();
  for (const texto of [ROTULO_PRINCIPALES, ROTULO_OTRAS, ROTULO_MAS]) {
    const rotulo = screen.getByText(texto);
    expect(rotulo).toHaveAttribute("role", "presentation");
    fireEvent.click(rotulo);
  }
  expect(onChange).not.toHaveBeenCalled();
});

test("un tramo que el filtro deja vacio se lleva su rotulo", () => {
  // Sin esto quedaria un «Otras marcas» presidiendo la nada.
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "seat" } });
  expect(screen.getByText(ROTULO_PRINCIPALES)).toBeInTheDocument();
  expect(screen.queryByText(ROTULO_OTRAS)).toBeNull();
  expect(screen.queryByText(ROTULO_MAS)).toBeNull();
});

test("la lista vive dentro del campo, que es lo que la ancla debajo", () => {
  const { container } = abrir();
  expect(container.querySelector(".bc-combo")).toContainElement(screen.getByRole("listbox"));
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

test("el filtro atraviesa los tres tramos a la vez", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "a" } });
  const nombres = screen.getAllByRole("option").map((o) => o.textContent);
  expect(nombres.some((n) => n.startsWith("SEAT"))).toBe(true);   // principales
  expect(nombres.some((n) => n.startsWith("Audi"))).toBe(true);   // otras
  expect(nombres.some((n) => n.startsWith("Acura"))).toBe(true);  // sin ofertas
});

test("sin coincidencias lo dice, y no deja una lista vacia", () => {
  const t = abrir();
  fireEvent.change(t.campo, { target: { value: "zzzz" } });
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  expect(screen.getByText("Nada coincide")).toBeInTheDocument();
});

test("las flechas recorren la lista e Intro elige lo marcado", () => {
  const t = abrir();
  fireEvent.keyDown(t.campo, { key: "ArrowDown" }); // de «todas» a SEAT
  fireEvent.keyDown(t.campo, { key: "ArrowDown" }); // a Toyota
  fireEvent.keyDown(t.campo, { key: "Enter" });
  expect(t.onChange).toHaveBeenCalledWith("Toyota");
});

test("las flechas cruzan de un tramo al siguiente sin saltarse nada", () => {
  const t = abrir();
  for (let i = 0; i < 3; i += 1) fireEvent.keyDown(t.campo, { key: "ArrowDown" });
  fireEvent.keyDown(t.campo, { key: "Enter" });
  expect(t.onChange).toHaveBeenCalledWith("Audi"); // la primera del tramo siguiente
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
  expect(screen.getAllByRole("option")).toHaveLength(TOTAL);
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
  t.rerender(pintar({ deshabilitado: true, vacio: "Elige antes una marca" }, t.onChange));
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("lo elegido va marcado para un lector de pantalla", () => {
  montar({ valor: "BMW" });
  fireEvent.focus(screen.getByRole("combobox"));
  const elegida = screen.getAllByRole("option").find((o) => o.textContent.startsWith("BMW"));
  expect(elegida).toHaveAttribute("aria-selected", "true");
});
