/**
 * El aviso de cookies.
 *
 * Lo que se comprueba aquí es lo que no puede cambiar sin querer: que aceptar y
 * rechazar están los dos a la vista y con el mismo peso, que no bloquea la
 * página, y que el detalle por categorías solo aparece si se pide.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AvisoCookies from "./AvisoCookies";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (clave) => clave }),
}));

const PREFERENCIAS = { necessary: true, analytics: false, personalization: false, marketing: false };

const montar = (props = {}) =>
  render(
    <AvisoCookies
      preferencias={PREFERENCIAS}
      onCambiarPreferencia={() => {}}
      mostrarAjustes={false}
      onAlternarAjustes={() => {}}
      onGuardar={() => {}}
      {...props}
    />
  );

test("la barra ofrece aceptar y configurar", () => {
  /* Sin botón de «solo necesarias»: decisión de producto. Rechazar se hace
     desde «configurar cookies», apagando las categorías y guardando.

     Queda dicho aquí también: la guía de la AEPD pide poder rechazar con la
     misma facilidad con la que se acepta, en el mismo nivel del aviso. */
  montar();
  expect(screen.getByRole("button", { name: "cookies.acceptAll" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "cookies.showSettings" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "cookies.necessaryOnly" })).toBeNull();
});

test("no bloquea la página: es una región, no un diálogo", () => {
  // Si vuelve a ser un diálogo modal, la entrada del coche del home se queda
  // otra vez detrás del velo.
  const { container } = montar();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector(".ac-aviso")).toBeInTheDocument();
});

test("el detalle por categorías solo sale si se pide", () => {
  const { container, rerender } = montar();
  expect(container.querySelector(".ac-tipos")).toBeNull();

  rerender(
    <AvisoCookies
      preferencias={PREFERENCIAS}
      onCambiarPreferencia={() => {}}
      mostrarAjustes
      onAlternarAjustes={() => {}}
      onGuardar={() => {}}
    />
  );
  const tipos = container.querySelector(".ac-tipos");
  expect(tipos).toBeInTheDocument();
  // Las cuatro categorías, y las necesarias sin interruptor: no se pueden
  // apagar y ofrecerlo sería mentir.
  expect(tipos.querySelectorAll(".ac-tipo")).toHaveLength(4);
  const necesarias = tipos.querySelectorAll(".ac-tipo")[0];
  expect(within(necesarias).getByText("cookies.alwaysActive")).toBeInTheDocument();
  expect(necesarias.querySelector("button")).toBeNull();
});

test("cada botón guarda lo que dice que guarda", () => {
  const guardado = [];
  const { rerender } = montar({ onGuardar: (modo) => guardado.push(modo) });
  fireEvent.click(screen.getByRole("button", { name: "cookies.acceptAll" }));

  rerender(
    <AvisoCookies
      preferencias={PREFERENCIAS}
      onCambiarPreferencia={() => {}}
      mostrarAjustes
      onAlternarAjustes={() => {}}
      onGuardar={(modo) => guardado.push(modo)}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "cookies.saveSelection" }));
  expect(guardado).toEqual(["all", "custom"]);
});

test("el velo oscurece pero no intercepta los clics", () => {
  // Si empezara a capturar el puntero, la barra volvería a ser un muro.
  const { container } = montar();
  const velo = container.querySelector(".ac-velo");
  expect(velo).toBeInTheDocument();
  expect(velo).toHaveAttribute("aria-hidden", "true");
});
