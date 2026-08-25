/**
 * La página de «Cómo funciona».
 *
 * Aquí no se comprueba la animación: jsdom no maqueta ni hace scroll, así que
 * afirmar que una escena se desvanece seria mentir. Lo que sí se puede afirmar
 * —y es lo que más se rompe— es que la arquitectura está entera: los ocho
 * capítulos, sus escenas, el hilo del IdCar y el progreso; que montar y
 * desmontar no deja ScrollTrigger vivos, que es de donde salen las fugas y los
 * disparadores duplicados; y que el contenido no promete funcionalidades que la
 * aplicación no tiene.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ComoFuncionaPage from "./ComoFuncionaPage";
import { CAMPOS_IDCAR, ADJUNTOS_IDCAR } from "../components/historia/IdCarHilo";

const CAPITULOS = [
  "Busca", "Descubre", "Decide", "Compra",
  "Cuéntanos tu coche", "Conoce el mercado", "Vende con PopCar", "Gestiona tu coche",
];

beforeEach(() => {
  ScrollTrigger.getAll().forEach((st) => st.kill());
});

test("monta los ocho capítulos, en orden", () => {
  const { container } = render(<ComoFuncionaPage onGoHome={() => {}} />);
  const secciones = container.querySelectorAll(".cf-capitulo");
  expect(secciones).toHaveLength(8);

  const progreso = screen.getByRole("navigation", { name: "Capítulos" });
  const botones = within(progreso).getAllByRole("button");
  expect(botones.map((b) => b.textContent.replace(/^\d+/, ""))).toEqual(CAPITULOS);
});

test("cada capítulo reserva scroll en proporción a sus escenas", () => {
  // Es lo que hace que el ritmo sea parejo entre capítulos. Si se pierde, unos
  // pasan volando y otros se eternizan.
  const { container } = render(<ComoFuncionaPage onGoHome={() => {}} />);
  container.querySelectorAll(".cf-capitulo").forEach((seccion) => {
    const escenas = seccion.querySelectorAll(".cf-escena").length;
    expect(escenas).toBeGreaterThan(0);
    expect(seccion.style.getPropertyValue("--escenas")).toBe(String(escenas));
  });
});

test("el IdCar empieza vacío y con todos sus campos a la vista", () => {
  const { container } = render(<ComoFuncionaPage onGoHome={() => {}} />);
  const idcar = container.querySelector(".cf-idcar");
  expect(idcar).toBeInTheDocument();
  // Sin capítulo activo todavia, ninguno esta relleno.
  expect(idcar.querySelectorAll(".cf-idcar-campo")).toHaveLength(CAMPOS_IDCAR.length);
  expect(idcar.querySelectorAll(".cf-idcar-campo.es-lleno")).toHaveLength(
    CAMPOS_IDCAR.filter((c) => c.desde === 0).length
  );
  // Los adjuntos son del ultimo capitulo: todavia no.
  expect(idcar.querySelector(".cf-idcar-adjuntos")).toBeNull();
});

test("los campos del IdCar son los que guarda un IdCar de verdad", () => {
  // Si alguien añade aqui un campo inventado, el hilo conductor deja de ser la
  // ficha real y pasa a ser un dibujo.
  const reales = [
    "marca", "modelo", "anio", "km", "combustible", "version",
    "cv", "cambio", "matricula", "color", "etiqueta", "itv",
  ];
  expect(CAMPOS_IDCAR.map((c) => c.clave)).toEqual(reales);
  expect(ADJUNTOS_IDCAR.map((a) => a.clave)).toEqual([
    "fotos", "docs", "itv", "seguro", "facturas",
  ]);
});

test("cada campo aparece en el capítulo donde el usuario lo consigue", () => {
  // La matricula no puede salir antes de «Cuéntanos tu coche»: hasta ese
  // momento PopCar no la tiene, y enseñarla seria prometer que la adivina.
  const porClave = Object.fromEntries(CAMPOS_IDCAR.map((c) => [c.clave, c.desde]));
  expect(porClave.matricula).toBe(4);
  expect(porClave.marca).toBe(0);
  expect(porClave.itv).toBe(7);
});

test("no promete la venta gestionada como un flujo automático", () => {
  // Hoy ese servicio se solicita por contacto y lo lleva una persona.
  // El aviso sale dos veces a proposito: en el texto de la escena y como dato
  // suelto, para que no dependa de que alguien lea el parrafo entero.
  render(<ComoFuncionaPage onGoHome={() => {}} />);
  expect(screen.getAllByText(/se solicita por contacto/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/no es un flujo automático dentro de la web/i)).toBeInTheDocument();
});

test("dice que el informe de mercado no es una tasación", () => {
  render(<ComoFuncionaPage onGoHome={() => {}} />);
  expect(screen.getByText(/No es una tasación ni una oferta de compra/i)).toBeInTheDocument();
});

test("al desmontar no deja ningún ScrollTrigger vivo", () => {
  const { unmount } = render(<ComoFuncionaPage onGoHome={() => {}} />);
  unmount();
  expect(ScrollTrigger.getAll()).toHaveLength(0);
});

test("montar dos veces no duplica disparadores", () => {
  const primera = render(<ComoFuncionaPage onGoHome={() => {}} />);
  const tras1 = ScrollTrigger.getAll().length;
  primera.unmount();
  const segunda = render(<ComoFuncionaPage onGoHome={() => {}} />);
  expect(ScrollTrigger.getAll()).toHaveLength(tras1);
  segunda.unmount();
});
