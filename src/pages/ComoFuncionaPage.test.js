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
  // Se busca dentro del bloque: «Seguro» también es uno de los apartados que se
  // rellenan al crear el IdCar, en vender.
  const { container } = montar();
  const gestionar = container.querySelector("#gestionar");
  ["Crea tu garaje", "Recordatorio inteligente", "Cita de mantenimiento", "Seguro"]
    .forEach((nombre) => expect(within(gestionar).getByText(nombre)).toBeInTheDocument());
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

test("vender ofrece el marketplace para particulares", () => {
  /* Ese camino existe y llega hasta el final: el boton de la web lleva a crear
     el IdCar y desde la ficha se publica, lo que da de alta la oferta
     `idcar-<id>` en la base. */
  montar();
  expect(screen.getByText("Marketplace para particulares")).toBeInTheDocument();
});

test("vender empieza por el IdCar, antes de las tres puertas", () => {
  /* Las tres opciones pasan por la ficha: el informe la puede leer, el anuncio
     sale de ella y la venta gestionada empieza mirándola. Si el prólogo
     desaparece, el bloque cuenta el final antes que el principio. */
  const { container } = montar();
  const vender = container.querySelector("#vender");
  expect(within(vender).getByText("Todo empieza por el IdCar")).toBeInTheDocument();
  const actos = vender.querySelectorAll(".cf-acto");
  expect(actos).toHaveLength(4);
  expect(actos[0]).toHaveClass("cf-acto-idcar");
});

test("el IdCar se explica por sus seis apartados reales", () => {
  // Son los de la ficha, con su nombre y en su orden. Si alguien inventa un
  // paso que no existe, la página promete algo que la aplicación no pide.
  const { container } = montar();
  const pasos = [...container.querySelectorAll("#vender .cf-paso-idcar strong")].map((n) => n.textContent);
  expect(pasos).toEqual([
    "Características del vehículo",
    "Documentos del vehículo",
    "Informe de estado",
    "Seguros",
    "Mantenimientos",
    "Notas internas",
  ]);
  // Y la ficha se sella con lo que se acaba de rellenar, uno por apartado.
  expect(container.querySelectorAll("#vender .cf-sello")).toHaveLength(pasos.length);
});

test("publicar pide las tres cosas que pide la aplicación", () => {
  /* No son consejos: sin precio, sin informe terminado o sin una franja
     horaria, el botón de publicar devuelve un error y no publica. */
  const { container } = montar();
  const requisitos = [...container.querySelectorAll("#vender .cf-requisito strong")].map((n) => n.textContent);
  expect(requisitos).toEqual([
    "Un precio de salida",
    "El informe de estado terminado",
    "Al menos una franja horaria",
  ]);
});

test("la venta gestionada enseña sus cuatro pasos y los portales", () => {
  const { container } = montar();
  const pasos = container.querySelectorAll("#vender .cf-paso-venta");
  expect(pasos).toHaveLength(4);
  const portales = [...container.querySelectorAll("#vender .cf-portales li")].map((n) => n.textContent);
  expect(portales).toEqual(["Coches.net", "AutoScout24", "Milanuncios", "Wallapop"]);
  // Los portales van dentro del paso en el que se publica, no sueltos al final.
  expect(pasos[2].querySelector(".cf-portales")).toBeInTheDocument();
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

test("comprar explica las tres opciones, no solo una", () => {
  // El fallo anterior era enseñar el embudo y dar por explicadas las otras dos.
  const { container } = montar();
  const actos = container.querySelectorAll("#comprar .cf-acto");
  expect(actos).toHaveLength(3);
  expect(container.querySelectorAll("#comprar .cf-comparado")).toHaveLength(3);
  expect(container.querySelectorAll("#comprar .cf-bloques-test li")).toHaveLength(6);
});

test("el comparador enseña coches distintos, cada uno con su nota", () => {
  /* Tres barras anónimas no explicaban nada. Lo que hace el comparador es poner
     coches que compiten entre sí uno al lado del otro y puntuarlos, así que
     tienen que ser marcas y modelos distintos. */
  const { container } = montar();
  const coches = [...container.querySelectorAll("#comprar .cf-comparado-cab strong")].map((n) => n.textContent);
  expect(coches).toEqual(["Toyota Corolla", "Volkswagen Golf", "Seat León"]);
  expect(new Set(coches).size).toBe(3);
  const notas = [...container.querySelectorAll("#comprar .cf-comparado-nota b")].map((n) => Number(n.textContent));
  expect(notas).toEqual([87, 81, 78]);
  // El primero es el que gana, y se marca.
  expect(container.querySelectorAll("#comprar .cf-comparado")[0]).toHaveClass("es-gana");
});

test("dice que se comparan hasta cinco a la vez", () => {
  // Es el límite real del comparador y no se ve en ningún otro sitio de la
  // página: si se pierde, parece que solo se pueden comparar tres.
  const { container } = montar();
  expect(container.querySelector("#comprar .cf-hueco").textContent).toMatch(/hasta cinco a la vez/i);
  expect(screen.getByText(/Se comparan hasta cinco coches a la vez/i)).toBeInTheDocument();
});

test("cada coche comparado lleva los cinco ejes de la aplicación", () => {
  const { container } = montar();
  const primero = container.querySelector("#comprar .cf-comparado");
  const ejes = [...primero.querySelectorAll(".cf-eje > span")].map((n) => n.textContent);
  expect(ejes).toEqual([
    "Fiabilidad", "Coste de uso", "Equipamiento", "Prestaciones", "Valor de reventa",
  ]);
  expect(container.querySelectorAll("#comprar .cf-eje")).toHaveLength(15);
  const bloques = [...container.querySelectorAll("#comprar .cf-bloques-test li")].map((n) => n.textContent);
  expect(bloques).toEqual([
    "Perfil", "Energía", "Uso real", "Capacidad", "Preferencias", "Prioridades",
  ]);
});

test("el test se dibuja como un análisis: preguntas, cerebro y resultado", () => {
  const { container } = montar();
  const acto = container.querySelector("#comprar .cf-acto-test");
  expect(acto.querySelector(".cf-cerebro-svg")).toBeInTheDocument();
  // El contorno y las vías se trazan con el scroll, y eso solo funciona si
  // llevan pathLength="1": es lo que hace que el recorrido vaya de 1 a 0.
  acto.querySelectorAll(".cf-cerebro-borde, .cf-cerebro-via").forEach((p) => {
    expect(p.getAttribute("pathLength")).toBe("1");
  });
  expect(acto.querySelectorAll(".cf-cerebro-nodo").length).toBeGreaterThan(0);
  expect(acto.querySelectorAll(".cf-mejor")).toHaveLength(2);
});

test("el desglose del test lleva los pesos reales y suman cien", () => {
  /* Son los del análisis: encaje 25, coste 20, flexibilidad 20, viabilidad 20 y
     ajuste 15. Y lo logrado suma la coincidencia que enseña la tarjeta, que por
     eso no es un número puesto a ojo. */
  const { container } = montar();
  const pesos = [...container.querySelectorAll("#comprar .cf-peso > span")].map((n) => n.textContent);
  expect(pesos).toEqual([
    "Encaje con tu uso", "Coste total", "Flexibilidad", "Viabilidad real", "Ajuste contigo",
  ]);
  expect(container.querySelector("#comprar .cf-veredicto-etq").textContent).toMatch(/92% de coincidencia/);
});

test("las tarjetas de comprar no comparten sitio con las escenas", () => {
  /* Era el fallo que se veía en pantalla: tarjetas y embudo en la misma caja,
     los dos a media opacidad y ninguno legible. Ahora las tarjetas van en el
     flujo y las escenas en su propio tablero. */
  const { container } = montar();
  const caminos = container.querySelector("#comprar .cf-caminos");
  const tablero = container.querySelector("#comprar .cf-tablero");
  expect(tablero).toBeInTheDocument();
  expect(caminos.contains(tablero)).toBe(false);
  expect(tablero.contains(caminos)).toBe(false);
});
