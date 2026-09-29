/**
 * Que el botón de descargar el informe descargue, y que cuando no pueda, hable.
 *
 * ## Qué pasaba
 *
 * Era un enlace: `<a href={url} target="_blank">`. El razonamiento era bueno
 * —el navegador sabe abrir un PDF, y así funcionan el clic derecho y «guardar
 * como»— pero tenía dos agujeros.
 *
 * El primero se vio en producción: cuando la respuesta no es un PDF, una
 * navegación se lleva lo que venga y lo pinta tal cual. El usuario acabó
 * mirando una pestaña en blanco con esto dentro:
 *
 *     {"error": "Sesión no válida"}
 *
 * Sin botón de volver y sin saber si el fallo era suyo.
 *
 * El segundo es de fondo: una navegación **solo** puede llevar la cookie, no
 * puede poner cabeceras. La app de PopCar habla con esta API a través de un
 * relé que reenvía la sesión si viene en `authorization` o `x-popcar-cookie`,
 * y un enlace no puede poner ninguna de las dos.
 *
 * ## Qué se fija
 *
 * Lo que el usuario nota: que se descarga un fichero con su nombre, y que un
 * fallo aparece debajo del botón con el texto que manda el servidor.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConditionReportDownload from "./ConditionReportDownload";

const URL_DEL_INFORME = "/api/market?route=condition-report&vehicleId=idcar-1&descargar=ses-1";

let creadas = [];
let revocadas = [];
let clicados = [];

beforeEach(() => {
  creadas = [];
  revocadas = [];
  clicados = [];

  global.URL.createObjectURL = (blob) => {
    creadas.push(blob);
    return `blob:de-mentira-${creadas.length}`;
  };
  global.URL.revokeObjectURL = (u) => revocadas.push(u);

  // Se apunta el clic sobre el enlace temporal que hace la descarga.
  const clicOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function apuntando() {
    clicados.push({ href: this.href, download: this.download });
  };
  HTMLAnchorElement.prototype._clicOriginal = clicOriginal;
});

afterEach(() => {
  if (HTMLAnchorElement.prototype._clicOriginal) {
    HTMLAnchorElement.prototype.click = HTMLAnchorElement.prototype._clicOriginal;
  }
  delete global.fetch;
});

describe("cuando el informe está", () => {
  test("se descarga un fichero con su nombre", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["%PDF-1.4 de mentira"], { type: "application/pdf" }),
    }));

    render(<ConditionReportDownload url={URL_DEL_INFORME} />);
    await userEvent.click(screen.getByRole("button", { name: /descargar el informe/i }));

    await waitFor(() => expect(clicados).toHaveLength(1));
    expect(clicados[0].download).toBe("informe-de-estado.pdf");
    expect(creadas).toHaveLength(1);
  });

  test("y la sesión viaja con la petición", async () => {
    /*
     * Ésta es la razón de que esto deje de ser un enlace. Sin
     * `credentials: "include"` el servidor no sabe quién pide, y el informe
     * lleva las fotos del coche de un cliente.
     */
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, blob: async () => new Blob(["x"]),
    }));

    render(<ConditionReportDownload url={URL_DEL_INFORME} />);
    await userEvent.click(screen.getByRole("button", { name: /descargar el informe/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [direccion, opciones] = global.fetch.mock.calls[0];
    expect(direccion).toBe(URL_DEL_INFORME);
    expect(opciones).toMatchObject({ credentials: "include" });
  });
});

describe("cuando no se puede", () => {
  test("el fallo se cuenta debajo del botón, no en otra pestaña", async () => {
    // Esto es literalmente lo que la usuaria vio, pero dentro de la página.
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sesión no válida" }),
    }));

    render(<ConditionReportDownload url={URL_DEL_INFORME} />);
    await userEvent.click(screen.getByRole("button", { name: /descargar el informe/i }));

    expect(await screen.findByText(/sesión no válida/i)).toBeInTheDocument();
    expect(clicados).toHaveLength(0);
  });

  test("y si el servidor no explica nada, se dice algo útil igualmente", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error("no es JSON"); },
    }));

    render(<ConditionReportDownload url={URL_DEL_INFORME} />);
    await userEvent.click(screen.getByRole("button", { name: /descargar el informe/i }));

    expect(await screen.findByText(/error 502/i)).toBeInTheDocument();
  });

  test("y sin conexión tampoco se queda mudo", async () => {
    global.fetch = jest.fn(async () => { throw new TypeError("Failed to fetch"); });

    render(<ConditionReportDownload url={URL_DEL_INFORME} />);
    await userEvent.click(screen.getByRole("button", { name: /descargar el informe/i }));

    expect(await screen.findByText(/no hemos podido conectar/i)).toBeInTheDocument();
  });
});

describe("y sin informe no hay botón", () => {
  test("una url vacía no pinta nada", () => {
    // Sin esto, el panel enseñaría un botón que solo sabe dar error.
    const { container } = render(<ConditionReportDownload url="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
