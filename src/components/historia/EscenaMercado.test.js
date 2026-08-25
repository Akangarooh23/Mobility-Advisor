/**
 * Escena 01 · el mercado reduciéndose.
 *
 * jsdom no pinta el lienzo, así que aquí no se comprueba el campo de puntos.
 * Lo que sí se comprueba es lo que sostiene la escena: que el contador responde
 * al avance, que va hacia atrás igual que hacia delante, que los filtros son los
 * del buscador de verdad y que las cifras del embudo son las medidas y no unas
 * inventadas para que quedara bonito.
 */
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import EscenaMercado, { EMBUDO } from "./EscenaMercado";

/** Monta la escena y devuelve la función con la que el capítulo la mueve. */
function montar() {
  let avanzar = null;
  const registrar = (i, fn) => { if (fn) avanzar = fn; };
  const utils = render(<EscenaMercado registrar={registrar} indice={0} />);
  return { ...utils, mover: (p) => act(() => { avanzar(p); }) };
}

const cifra = () => document.querySelector(".em-cifra strong").textContent;
const pie = () => document.querySelector(".em-cifra span").textContent;
const puestos = () => document.querySelectorAll(".em-filtro.es-puesto").length;

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ ok: true, total: 20, ofertas: [] }) })
  );
});

test("el embudo son las cifras medidas, en orden decreciente", () => {
  // Si alguien las retoca para que el número quede más redondo, la escena deja
  // de contar lo que pasa de verdad en el mercado.
  expect(EMBUDO[0].ofertas).toBe(568358);
  expect(EMBUDO[EMBUDO.length - 1].ofertas).toBe(20);
  for (let i = 1; i < EMBUDO.length; i += 1) {
    expect(EMBUDO[i].ofertas).toBeLessThan(EMBUDO[i - 1].ofertas);
  }
});

test("los filtros son los que existen en el buscador", () => {
  // Estos son los nombres tal cual salen en Buscar coche.
  expect(EMBUDO.slice(1).map((p) => p.filtro)).toEqual([
    "Marca", "Modelo", "Combustible", "Año",
    "Kilómetros como máximo", "Provincia", "Cambio",
  ]);
});

test("empieza con el mercado entero y ningún filtro puesto", () => {
  montar();
  expect(cifra()).toBe("568.358");
  expect(pie()).toMatch(/a la venta ahora mismo/);
  expect(puestos()).toBe(0);
});

test("el contador baja según avanza el scroll", () => {
  const t = montar();
  const leer = (p) => { t.mover(p); return Number(cifra().replace(/\./g, "")); };

  const inicio = leer(0);
  const medio = leer(0.5);
  const final = leer(1);

  expect(medio).toBeLessThan(inicio);
  expect(final).toBeLessThan(medio);
  expect(final).toBe(20);
});

test("se puede recorrer hacia atrás y vuelve al punto de partida", () => {
  // Es el requisito de que el usuario mande: subir tiene que deshacer.
  const t = montar();
  t.mover(1);
  expect(cifra()).toBe("20");
  t.mover(0);
  expect(cifra()).toBe("568.358");
  expect(puestos()).toBe(0);
});

test("los filtros se van poniendo uno a uno, sin saltos", () => {
  const t = montar();
  let anterior = 0;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    t.mover(Math.min(1, p));
    const ahora = puestos();
    // Nunca retrocede dentro de una bajada, y nunca se salta ninguno.
    expect(ahora - anterior).toBeLessThanOrEqual(1);
    expect(ahora).toBeGreaterThanOrEqual(anterior);
    anterior = ahora;
  }
  expect(anterior).toBe(EMBUDO.length - 1);
});

test("al final el texto cambia de mercado a resultados", () => {
  const t = montar();
  t.mover(1);
  expect(pie()).toBe("coches encontrados");
});

test("las ofertas del final se piden al buscador real, con esos filtros", async () => {
  montar();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const url = global.fetch.mock.calls[0][0];
  expect(url).toContain("brand=Volkswagen");
  expect(url).toContain("model=Golf");
  expect(url).toContain("province=Madrid");
  expect(url).toContain("maxMileage=60000");
});

test("si la llamada falla, la escena sigue funcionando", async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error("sin red")));
  const t = montar();
  t.mover(1);
  // Se queda con el recuento de la cascada en vez de romperse o inventar.
  expect(cifra()).toBe("20");
});
