/**
 * La página de «Cómo funciona».
 *
 * jsdom no maqueta ni hace scroll, así que aquí no se comprueba la animación.
 * Lo que sí se comprueba —y es lo que se rompe— es que la estructura está
 * entera, que lo que se enseña son datos y nombres de la aplicación, que el
 * texto sigue siendo poco, y que el aviso de que esto no es una tasación no
 * desaparece en un retoque de copy.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ComoFuncionaPage from "./ComoFuncionaPage";

beforeEach(() => {
  ScrollTrigger.getAll().forEach((st) => st.kill());
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ ok: true, total: 20, ofertas: [] }) })
  );
});

const montar = () => render(<ComoFuncionaPage onGoHome={() => {}} />);

test("son tres bloques: comprar, vender y gestionar", () => {
  const { container } = montar();
  const bloques = container.querySelectorAll(".cf-bloque");
  expect(bloques).toHaveLength(3);
  expect([...bloques].map((b) => b.id)).toEqual(["comprar", "vender", "gestionar"]);
});

test("cada bloque reserva scroll para que la escena se recorra", () => {
  // Sin altura de sobra no hay recorrido: la escena se resolvería de golpe.
  const { container } = montar();
  container.querySelectorAll(".cf-bloque").forEach((bloque) => {
    expect(bloque.querySelector(".cf-fijo")).toBeInTheDocument();
  });
});

test("comprar enseña el embudo del mercado, no una maqueta", () => {
  const { container } = montar();
  const comprar = container.querySelector("#comprar");
  expect(within(comprar).getByText("568.358")).toBeInTheDocument();
  expect(comprar.querySelectorAll(".em-filtro")).toHaveLength(7);
});

test("vender pide los seis datos que pide el formulario real", () => {
  const { container } = montar();
  const vender = container.querySelector("#vender");
  const etiquetas = [...vender.querySelectorAll(".cf-dato dt")].map((n) => n.textContent);
  expect(etiquetas).toEqual([
    "Matrícula", "Marca", "Modelo", "Versión", "Año", "Kilómetros",
  ]);
});

test("las cifras de mercado son las medidas, no unas redondas", () => {
  // Si alguien las retoca para que queden mas bonitas, la pagina deja de contar
  // lo que pasa de verdad en el mercado.
  const { container } = montar();
  expect(screen.getByText("20.739 €")).toBeInTheDocument();
  /* La cifra y su rótulo son nodos distintos, así que se lee el párrafo entero.
     Y va sin punto de millar a propósito: en español los números de cuatro
     cifras no se agrupan, y `toLocaleString("es-ES")` aplica bien esa regla.
     «2.638» sería el error, no «2638». */
  expect(container.querySelector(".cf-informe-pie").textContent)
    .toMatch(/2638 unidades similares/);
  expect(container.querySelector(".cf-informe-rango").textContent)
    .toMatch(/16\.900.*22\.690/);
});

test("dice que no es una tasación, y eso no es negociable", () => {
  montar();
  expect(screen.getByText(/PopCar no tasa tu coche/i)).toBeInTheDocument();
  expect(screen.getByText(/Precio medio del mercado/i)).toBeInTheDocument();
});

test("gestionar enseña los cuatro servicios con su nombre real", () => {
  montar();
  ["Crea tu garaje", "Recordatorio inteligente", "Cita de mantenimiento", "Seguro"]
    .forEach((nombre) => expect(screen.getByText(nombre)).toBeInTheDocument());
});

test("los iconos van en SVG, no en emoji", () => {
  // En Windows varios emoji salen como un cuadrado vacío; ya paso en el home.
  const { container } = montar();
  expect(container.querySelectorAll(".cf-servicio-icono svg")).toHaveLength(4);
  expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
});

test("el texto se mantiene corto", () => {
  // La regla de la pagina es que se entienda sin leer. Si esto empieza a
  // crecer, es que hemos vuelto a explicar con parrafos.
  const { container } = montar();
  const palabras = [...container.querySelectorAll(".cf-rotulo, .cf-hero-texto, .cf-intro, .cf-final")]
    .map((n) => n.textContent.trim().split(/\s+/).length)
    .reduce((a, b) => a + b, 0);
  expect(palabras).toBeLessThan(90);
});

test("al desmontar no deja ScrollTriggers vivos", () => {
  const { unmount } = montar();
  unmount();
  expect(ScrollTrigger.getAll()).toHaveLength(0);
});

test("montar dos veces no duplica disparadores", () => {
  const primera = montar();
  const tras = ScrollTrigger.getAll().length;
  primera.unmount();
  const segunda = montar();
  expect(ScrollTrigger.getAll()).toHaveLength(tras);
  segunda.unmount();
});

test("cada bloque abre con sus tres puertas de entrada", () => {
  // Es lo primero que ve el usuario: por dónde entrar según dónde esté. Si se
  // pierden, la página vuelve a decidir por él.
  const { container } = montar();
  const comprar = [...container.querySelectorAll("#comprar .cf-camino strong")].map((n) => n.textContent);
  expect(comprar).toEqual([
    "Sé qué modelo quiero", "Dudo entre varios", "No sé qué me conviene",
  ]);
  const vender = [...container.querySelectorAll("#vender .cf-camino strong")].map((n) => n.textContent);
  expect(vender).toEqual([
    "Saber lo que vale hoy", "Venderlo por mi cuenta", "Que lo vendáis vosotros",
  ]);
});

test("no promete publicar el coche en un marketplace", () => {
  /* La tercera tarjeta de la web de vender dice «publica tu coche en nuestro
     Marketplace para particulares», pero ese flujo no existe: su botón lleva a
     crear el IdCar. Aquí se cuenta lo que pasa de verdad. */
  const { container } = montar();
  expect(container.textContent).not.toMatch(/marketplace/i);
  expect(screen.getByText("Documentarlo con IdCar")).toBeInTheDocument();
});

test("gestionar enseña primero el IdCar y después lo que se hace con él", () => {
  // Sin ficha no hay avisos, ni cita, ni historial. Enseñarlos antes sería
  // contarlo al revés.
  const { container } = montar();
  const gestionar = container.querySelector("#gestionar");
  const orden = [...gestionar.querySelectorAll(".cf-idcar-lleno, .cf-servicio")];
  expect(orden[0]).toHaveClass("cf-idcar-lleno");
  expect(orden).toHaveLength(5);
});
