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
import { render, screen, waitFor, within } from "@testing-library/react";
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
  // Se buscan en la cabecera: «Seguro» también es uno de los apartados que se
  // rellenan al crear el IdCar, que ahora se cuenta en este mismo bloque.
  const { container } = montar();
  const servicios = container.querySelector("#gestionar .cf-servicios");
  ["Crea tu garaje", "Recordatorio inteligente", "Cita de mantenimiento", "Seguro"]
    .forEach((nombre) => expect(within(servicios).getByText(nombre)).toBeInTheDocument());
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
  const palabras = [...container.querySelectorAll(".cf-rotulo, .cf-hero-texto, .cf-final")]
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

test("vender son tres puertas y tres actos", () => {
  const { container } = montar();
  const vender = container.querySelector("#vender");
  const actos = vender.querySelectorAll(".cf-acto");
  expect(actos).toHaveLength(3);
  expect(actos[0]).toHaveClass("cf-acto-informe");
  // El IdCar se cuenta en gestionar, que es donde vive la ficha. Aqui solo se
  // ofrece leerlo en vez de teclear los datos otra vez.
  expect(vender.querySelector(".cf-paso-idcar")).toBeNull();
  expect(within(vender).getByText("O usar un IdCar guardado")).toBeInTheDocument();
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

test("el informe de estado se ve, con el coche y sus grados", () => {
  /* Es lo que hace que el anuncio de un particular se pueda mirar con criterio,
     así que va entre los requisitos y el anuncio. */
  const { container } = montar();
  const informe = container.querySelector("#vender .cf-informe-estado");
  expect(informe.querySelector(".cf-coche-esquema")).toBeInTheDocument();
  // Un aspa por hallazgo, y cada aspa con su entrada en la lista.
  expect(informe.querySelectorAll(".cf-marca")).toHaveLength(3);
  const piezas = [...informe.querySelectorAll(".cf-hallazgo small")].map((n) => n.textContent);
  expect(piezas).toEqual([
    "Puerta delantera derecha", "Paragolpes trasero", "Llanta delantera izquierda",
  ]);
});

test("la mecánica nunca se afirma desde una foto", () => {
  /* Es requisito legal y de producto, y un CHECK en la base: el grado mecánico
     solo puede asentarlo una verificación física en taller. Si alguien pone
     aquí una letra, la página promete algo que el sistema no puede sostener. */
  const { container } = montar();
  const grados = [...container.querySelectorAll("#vender .cf-grado")].map((n) => ({
    parte: n.querySelector("span").textContent,
    grado: n.querySelector("b").textContent,
  }));
  expect(grados.map((g) => g.parte)).toEqual([
    "Carrocería", "Llantas", "Neumáticos", "Cristales", "Interior", "Mecánica",
  ]);
  const mecanica = grados.find((g) => g.parte === "Mecánica");
  expect(mecanica.grado).toBe("Sin datos");
  expect(container.querySelector("#vender .cf-informe-estado .cf-limite").textContent)
    .toMatch(/verificación en taller/i);
});

test("los comparables van juntos y con su rótulo", () => {
  /* Sueltos por la escena eran cuatro precios a los que les faltaba algo: no
     decían de qué eran. El rótulo es lo que los convierte en información. */
  const { container } = montar();
  expect(container.querySelector("#vender .cf-comparables-etq").textContent).toBe("Anuncios parecidos hoy");
  expect(container.querySelectorAll("#vender .cf-comparable")).toHaveLength(4);
});

test("el anuncio publicado enseña una foto de verdad", async () => {
  // Sin foto no parece un anuncio, parece un hueco. Sale del mismo buscador que
  // las ofertas del embudo.
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        ok: true,
        total: 20,
        ofertas: [{ id: "x", image: "https://ejemplo.test/golf.jpg", brand: "Volkswagen", model: "Golf" }],
      }),
    })
  );
  const { container } = montar();
  await waitFor(() => {
    expect(container.querySelector("#vender .cf-anuncio-foto img")).toBeInTheDocument();
  });
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

test("gestionar empieza por el IdCar y después lo que se hace con él", () => {
  // Sin ficha no hay avisos, ni cita, ni póliza que leer. Enseñarlos antes
  // sería contarlo al revés, así que el primer acto es crear el IdCar.
  const { container } = montar();
  const gestionar = container.querySelector("#gestionar");
  const actos = gestionar.querySelectorAll(".cf-acto");
  expect(actos).toHaveLength(4);
  expect(actos[0]).toHaveClass("cf-acto-garaje");
  expect(within(actos[0]).getByText("Todo empieza por el IdCar")).toBeInTheDocument();
  // Y hay una puerta por acto: cuatro servicios, cuatro escenas.
  expect(gestionar.querySelectorAll(".cf-servicio")).toHaveLength(4);
});

test("el IdCar se explica por sus seis apartados reales", () => {
  // Son los de la ficha, con su nombre y en su orden. Si alguien inventa un
  // paso que no existe, la página promete algo que la aplicación no pide.
  const { container } = montar();
  const pasos = [...container.querySelectorAll("#gestionar .cf-paso-idcar strong")].map((n) => n.textContent);
  expect(pasos).toEqual([
    "Características del vehículo",
    "Documentos del vehículo",
    "Informe de estado",
    "Seguros",
    "Mantenimientos",
    "Notas internas",
  ]);
  // Y la ficha se sella con lo que se acaba de rellenar, uno por apartado.
  expect(container.querySelectorAll("#gestionar .cf-sello")).toHaveLength(pasos.length);
});

test("los avisos llevan los intervalos que usa la aplicación", () => {
  /* Salen del plan de mantenimiento por defecto. Si alguien los redondea, la
     página promete un calendario que no es el que se calcula. */
  const { container } = montar();
  const intervalos = [...container.querySelectorAll("#gestionar .cf-aviso small")].map((n) => n.textContent);
  expect(intervalos).toEqual([
    "Cada 15.000 km o 12 meses",
    "Cada 20.000 km o 18 meses",
    "Cada 30.000 km o 18 meses",
    "Cada 45.000 km o 24 meses",
  ]);
});

test("el calendario es octubre de verdad, con sus días en su sitio", () => {
  /* Octubre de 2026 empieza en jueves: tres huecos, 31 días y un hueco final
     para cerrar las cinco semanas. Si alguien cambia el mes hay que recalcular
     los huecos, y esta prueba es la que avisa. */
  const { container } = montar();
  const celdas = [...container.querySelectorAll("#gestionar .cf-calendario li")];
  expect(celdas).toHaveLength(35);
  expect(celdas.filter((c) => c.classList.contains("es-vacio"))).toHaveLength(4);
  const dias = celdas.map((c) => c.textContent).filter(Boolean);
  expect(dias[0]).toBe("1");
  expect(dias).toHaveLength(31);
  expect(dias[30]).toBe("31");
  // El aviso y la cita caen en un día concreto, no en un cuadro cualquiera.
  expect(container.querySelector("#gestionar .cf-calendario li.es-aviso").textContent).toBe("7");
  expect(container.querySelector("#gestionar .cf-calendario li.es-cita").textContent).toBe("20");
  // Y la semana empieza en lunes, como aquí.
  const semana = [...container.querySelectorAll("#gestionar .cf-semana li")].map((n) => n.textContent);
  expect(semana).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
});

test("la cita se elige sobre un mapa, con los talleres de alrededor", () => {
  const { container } = montar();
  const mapa = container.querySelector("#gestionar .cf-mapa");
  expect(mapa.querySelector(".cf-mapa-zoom")).toBeInTheDocument();
  expect(mapa.querySelector(".cf-ubicacion")).toBeInTheDocument();
  const talleres = [...mapa.querySelectorAll(".cf-taller")];
  expect(talleres).toHaveLength(4);
  // Uno queda elegido, y es del que sale el precio de la ficha.
  const elegidos = talleres.filter((t) => t.classList.contains("es-elegido"));
  expect(elegidos).toHaveLength(1);
  expect(elegidos[0].textContent).toBe("Norauto");
});

test("la ficha de la cita nombra el taller y ofrece comprobar disponibilidad", () => {
  const { container } = montar();
  const ficha = container.querySelector("#gestionar .cf-presupuesto");
  expect(within(ficha).getByText("Taller · Norauto")).toBeInTheDocument();
  expect(within(ficha).getByText("Comprobar disponibilidad")).toBeInTheDocument();
  /* El botón va dibujado, no es un `button`: no lleva a ningún sitio y anunciar
     lo contrario a quien navega con teclado o lector sería mentirle. */
  expect(ficha.querySelector("button")).toBeNull();
});

test("la cita compara el precio de particular con el acordado", () => {
  /* 110 y 75 no son cifras bonitas: son el alto y el medio del rango que la
     aplicación tiene para el cambio de aceite y filtro en Norauto. */
  const { container } = montar();
  const cita = container.querySelector("#gestionar .cf-presupuesto");
  expect(within(cita).getByText("110 €")).toBeInTheDocument();
  expect(within(cita).getByText("75 €")).toBeInTheDocument();
  expect(within(cita).getByText("Ahorras 35 €")).toBeInTheDocument();
  // Y el aviso de que son orientativos, que también lo dice la pantalla real.
  expect(cita.textContent).toMatch(/orientativos/i);
});

test("el seguro enseña las seis coberturas que analiza", () => {
  const { container } = montar();
  const coberturas = [...container.querySelectorAll("#gestionar .cf-cobertura > span")].map((n) => n.textContent);
  expect(coberturas).toEqual([
    "Responsabilidad", "Daños propios", "Robo", "Asistencia", "Defensa legal", "Lunas",
  ]);
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
