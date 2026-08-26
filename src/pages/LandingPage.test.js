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

test("la foto del coche sigue teniendo texto alternativo", () => {
  // La animación no puede llevarse por delante lo que ya estaba bien.
  const { container } = montar();
  expect(visual(container).querySelector("img"))
    .toHaveAttribute("alt", expect.stringContaining("Beetle"));
});
