/**
 * El panel se repasa solo, sin recargar la página.
 *
 * Lo que pasaba: los datos se pedían al entrar en el panel y no se volvían a
 * pedir nunca. El contador de coches sí se movía —ese lo refresca la pestaña de
 * vehículos por su cuenta— y el de tasaciones y el de solicitudes se quedaban en
 * cero hasta recargar la página entera. Se veía «1 coche, 0 tasaciones» con la
 * tasación hecha y el PDF ya en el correo.
 *
 * Aquí se fija cuándo se vuelve a pedir y, lo que importa igual, cuándo no.
 */
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { useRepasoDelPanel } from "./useRepasoDelPanel";

function Sonda({ activo, apartado, recarga, otra }) {
  useRepasoDelPanel({ activo, apartado, recarga, cadaCuanto: 1000 });
  return <div>{otra}</div>;
}

/** Pone la pestaña delante o detrás, sin avisar a nadie. */
function ponPestana(estado) {
  Object.defineProperty(document, "visibilityState", { value: estado, configurable: true });
}

/** Y esto es cambiarla de verdad: el navegador avisa cuando cambia. */
function pestana(estado) {
  ponPestana(estado);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  ponPestana("visible");
});

afterEach(() => {
  jest.useRealTimers();
});

describe("cuándo se vuelven a pedir los datos del panel", () => {
  test("al entrar en el panel", () => {
    const recarga = jest.fn();
    render(<Sonda activo apartado="home" recarga={recarga} />);
    expect(recarga).toHaveBeenCalledTimes(1);
  });

  test("al cambiar de apartado dentro del panel", () => {
    // El caso de Ana: pide la tasación desde «Vehículos» y vuelve al resumen.
    // `entryMode` no cambia en todo el rato, así que sin esto no se pedía nada.
    const recarga = jest.fn();
    const { rerender } = render(<Sonda activo apartado="vehicles" recarga={recarga} />);
    rerender(<Sonda activo apartado="home" recarga={recarga} />);
    expect(recarga).toHaveBeenCalledTimes(2);
  });

  test("al volver a la pestaña", () => {
    const recarga = jest.fn();
    render(<Sonda activo apartado="home" recarga={recarga} />);
    recarga.mockClear();
    pestana("hidden");
    pestana("visible");
    expect(recarga).toHaveBeenCalledTimes(1);
  });

  test("y cada minuto con la pestaña delante", () => {
    const recarga = jest.fn();
    render(<Sonda activo apartado="home" recarga={recarga} />);
    recarga.mockClear();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(recarga).toHaveBeenCalledTimes(3);
  });
});

describe("y cuándo no", () => {
  test("fuera del panel no se pide nada", () => {
    const recarga = jest.fn();
    render(<Sonda activo={false} apartado="home" recarga={recarga} />);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(recarga).not.toHaveBeenCalled();
  });

  test("con la pestaña detrás, el reloj no pide", () => {
    // Un panel olvidado en una pestaña de fondo no debe estar llamando a la API
    // toda la tarde.
    const recarga = jest.fn();
    render(<Sonda activo apartado="home" recarga={recarga} />);
    pestana("hidden");
    recarga.mockClear();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(recarga).not.toHaveBeenCalled();
  });

  test("un renderizado cualquiera no pide", () => {
    const recarga = jest.fn();
    const { rerender } = render(<Sonda activo apartado="home" recarga={recarga} otra="a" />);
    rerender(<Sonda activo apartado="home" recarga={recarga} otra="b" />);
    expect(recarga).toHaveBeenCalledTimes(1);
  });

  test("al salir del panel se recogen los cables", () => {
    const recarga = jest.fn();
    const { unmount } = render(<Sonda activo apartado="home" recarga={recarga} />);
    unmount();
    recarga.mockClear();
    act(() => { jest.advanceTimersByTime(5000); });
    pestana("visible");
    expect(recarga).not.toHaveBeenCalled();
  });
});

describe("y está enchufado en la aplicación", () => {
  /*
   * El hook puede estar perfecto y no servir de nada: basta con llamarlo con el
   * apartado equivocado, o no llamarlo. Esto mira el cable, que es lo que se
   * rompió la última vez.
   */
  const fs = require("fs");
  const path = require("path");
  const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const LLAMADA = APP.slice(APP.indexOf("useRepasoDelPanel({"), APP.indexOf("useRepasoDelPanel({") + 260);

  test("se llama desde App.js", () => {
    expect(APP).toContain("useRepasoDelPanel({");
  });

  test("solo dentro del panel", () => {
    expect(LLAMADA).toMatch(/activo:\s*entryMode === "userDashboard"/);
  });

  test("el apartado que se le pasa es el del panel", () => {
    // Con otra cosa aquí —o sin esta línea— vuelve lo de antes: moverse por el
    // panel no refresca nada, que es justo donde se pide la tasación.
    expect(LLAMADA).toMatch(/apartado:\s*userDashboardPage/);
  });

  test("y lo que recarga es la llamada de movilidad", () => {
    expect(LLAMADA).toMatch(/recarga:\s*recargaMovilidad/);
  });
});
