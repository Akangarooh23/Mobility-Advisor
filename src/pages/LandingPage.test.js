/**
 * La entrada del coche en el home.
 *
 * jsdom no anima, así que aquí no se comprueba el recorrido. Lo que sí se
 * comprueba —y es lo que se rompe— es cuándo arranca: con el aviso de cookies
 * abierto no, sin él sí, y una sola vez por carga de página.
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
     que se fuerza a true: lo que se prueba es la espera al aviso de cookies, no
     la carga de la foto. */
  Object.defineProperty(window.HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => true,
  });
});

test("con el aviso de cookies abierto, el coche espera fuera", () => {
  // El aviso tapa la pantalla entera: animar debajo sería animar para nadie.
  const { container } = montar({ avisoCookiesAbierto: true });
  expect(visual(container)).toHaveClass("pc-entrada-espera");
});

test("al cerrarse el aviso, el coche entra", async () => {
  const { container, rerender } = montar({ avisoCookiesAbierto: true });
  expect(visual(container)).toHaveClass("pc-entrada-espera");

  rerender(<LandingPage uiLanguage="es" avisoCookiesAbierto={false} />);
  await waitFor(() => expect(visual(container)).toHaveClass("pc-entrada-entra"));
});

test("sin aviso pendiente entra directamente", async () => {
  // Segunda visita: ya hay consentimiento guardado y no sale ningún aviso.
  const { container } = montar({ avisoCookiesAbierto: false });
  await waitFor(() => expect(visual(container)).toHaveClass("pc-entrada-entra"));
});

test("volver al home desde dentro no repite la entrada", async () => {
  /* El home se vuelve a montar cada vez que se navega a él. La animación es un
     recibimiento, no un peaje: se ve al cargar la página, no cada vez que se
     vuelve al inicio. */
  const primera = montar({ avisoCookiesAbierto: false });
  await waitFor(() => expect(visual(primera.container)).toHaveClass("pc-entrada-entra"));
  primera.unmount();

  const segunda = montar({ avisoCookiesAbierto: false });
  expect(visual(segunda.container)).toHaveClass("pc-entrada-hecha");
  expect(visual(segunda.container)).not.toHaveClass("pc-entrada-entra");
});

test("la foto del coche sigue teniendo texto alternativo", () => {
  // La animación no puede llevarse por delante lo que ya estaba bien.
  const { container } = montar({ avisoCookiesAbierto: false });
  expect(visual(container).querySelector("img")).toHaveAttribute("alt", expect.stringContaining("Beetle"));
});
