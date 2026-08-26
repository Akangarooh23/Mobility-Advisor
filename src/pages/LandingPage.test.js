/**
 * La entrada del coche en el home.
 *
 * jsdom no anima, así que aquí no se comprueba el recorrido. Lo que sí se
 * comprueba —y es lo que se rompe— es cuándo arranca: al cargar la página sí, y
 * una sola vez.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import LandingPage from "./LandingPage";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (clave) => clave, i18n: { language: "es" } }),
}));

const montar = (props = {}) => render(<LandingPage uiLanguage="es" {...props} />);
const visual = (container) => container.querySelector(".pc-hero-visual");

beforeEach(() => {
  // La marca dura lo que dura la página; cada prueba parte de una recién
  // cargada.
  delete window.popcarEntradaHecha;
  /* En jsdom las imágenes nunca terminan de cargar y `complete` es false, así
     que se fuerza a true: lo que se prueba es cuándo arranca, no la carga. */
  Object.defineProperty(window.HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => true,
  });
});

test("al cargar la página, el coche entra", async () => {
  const { container } = montar();
  await waitFor(() => expect(visual(container)).toHaveClass("pc-entrada-entra"));
});

test("volver al home desde dentro no repite la entrada", async () => {
  /* El home se vuelve a montar cada vez que se navega a él. La animación es un
     recibimiento, no un peaje: se ve al cargar la página, no cada vez que se
     vuelve al inicio. */
  const primera = montar();
  await waitFor(() => expect(visual(primera.container)).toHaveClass("pc-entrada-entra"));
  primera.unmount();

  const segunda = montar();
  expect(visual(segunda.container)).toHaveClass("pc-entrada-hecha");
  expect(visual(segunda.container)).not.toHaveClass("pc-entrada-entra");
});

test("mientras la foto no está, el coche espera fuera", () => {
  /* Sin la foto cargada lo que entraría es un hueco, y esto se ve una sola vez:
     no hay segunda oportunidad. */
  Object.defineProperty(window.HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => false,
  });
  const { container } = montar();
  expect(visual(container)).toHaveClass("pc-entrada-espera");
});

test("IdCar deja su hueco en la cabecera, pero no un enlace", () => {
  /* El hueco separa los tres apartados de lo que haces con el coche de los tres
     de la casa. Tiene que seguir siendo aire: si vuelve a ser pulsable, lleva a
     una pantalla que ya no se ofrece desde aquí. */
  const { container } = montar();
  const nav = container.querySelector(".pc-nav");
  const botones = [...nav.querySelectorAll("button")].map((n) => n.textContent);
  expect(botones).not.toContain("IdCar");
  const hueco = [...nav.children].find((n) => n.textContent === "IdCar");
  expect(hueco.tagName).toBe("SPAN");
  expect(hueco).toHaveAttribute("aria-hidden", "true");
});

test("cada enlace del pie lleva a un sitio distinto", () => {
  /* Antes eran quince enlaces para seis destinos: «buscar coches» y «asesor de
     vehículo» al mismo, los tres de vender al mismo, y los seis de gestionar e
     IdCar también. Un pie donde todo lleva al mismo sitio no es un pie. */
  const visitados = [];
  const espia = (nombre) => () => visitados.push(nombre);
  const { container } = montar({
    onSelectBuyStart: espia("buscar"),
    onSelectDecision: espia("comparar"),
    onSelectAdvice: espia("test"),
    onSelectPortalVo: espia("marketplace"),
    onSelectSellInfo: espia("informe"),
    onSelectSellManaged: espia("gestionada"),
    onSelectServiceAutogestor: espia("garaje"),
    onSelectServiceMaintenance: espia("recordatorios"),
    onSelectServiceAppointment: espia("cita"),
    onSelectServiceInsurance: espia("seguro"),
    onComoFunciona: espia("como"),
    onOpenPlans: espia("productos"),
    onSelectEmpresas: espia("empresas"),
    onSelectAbout: espia("sobre"),
    onSelectContact: espia("contacto"),
  });

  const enlaces = [...container.querySelectorAll(".pc-pie-rejilla div h4 ~ button")];
  expect(enlaces).toHaveLength(15);
  enlaces.forEach((boton) => boton.click());
  expect(visitados).toHaveLength(15);
  expect(new Set(visitados).size).toBe(15);
});

test("el pie no promete una tasación, que es lo que no hacemos", () => {
  // Estaba en la columna de vender y contradecía todo lo demás.
  const { container } = montar();
  expect(container.querySelector(".pc-pie").textContent).not.toMatch(/tasaci[óo]n/i);
});

test("los enlaces legales del pie abren su documento", () => {
  /* Se pintaban como texto plano, sin nada detrás. El aviso legal, la
     privacidad y las cookies tienen que poder leerse: no es una preferencia. */
  const abiertos = [];
  const { container } = montar({ onOpenLegal: (clave) => abiertos.push(clave) });
  const legales = [...container.querySelectorAll(".pc-pie-legal button")];
  expect(legales.length).toBeGreaterThanOrEqual(3);
  legales.forEach((boton) => boton.click());
  expect(abiertos).toEqual(
    expect.arrayContaining(["legalNotice", "privacyPolicy", "cookiePolicy"])
  );
});

test("la foto del coche sigue teniendo texto alternativo", () => {
  // La animación no puede llevarse por delante lo que ya estaba bien.
  const { container } = montar();
  expect(visual(container).querySelector("img"))
    .toHaveAttribute("alt", expect.stringContaining("Beetle"));
});
