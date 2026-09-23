/**
 * «Nosotros lo vendemos por ti», montado de verdad, para que no se pida dos veces.
 *
 * Juan lo pidió a las 22:40:06 y otra vez a las 22:40:46, y en el ERP salieron
 * dos solicitudes idénticas. El botón ya se bloqueaba mientras enviaba, así que
 * no fue un doble clic: volvió a la página, la encontró **vacía** como la
 * primera vez y volvió a pedirlo, porque desde donde él estaba no había pasado
 * nada.
 *
 * Esto se monta y se pulsa. Lo que se protege es que la página se acuerde: que
 * diga que ya está pedida, que no deje mandar una segunda, y —lo que es igual
 * de importante— que siga dejando pedir lo que de verdad es nuevo.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FormularioEncargoVenta from "./FormularioEncargoVenta";

/*
 * El garaje llega por `apiClient`, que envuelve el fetch con su propio manejo
 * de errores y de sesión. Se simula el módulo y no la red: lo que se está
 * probando es la pantalla, no cómo se piden las cosas.
 */
jest.mock("../utils/apiClient", () => ({
  rutaApi: (r) => r,
  getGarageVehiclesJson: jest.fn(),
}));
const { getGarageVehiclesJson } = require("../utils/apiClient");

/** Su garaje, que el formulario pide al montarse. */
const GARAJE = [
  { id: "veh-1", title: "Lancia Ypsilon", brand: "Lancia", model: "Ypsilon", year: 2005, plate: "0296DYJ" },
  { id: "veh-2", title: "Seat Ibiza", brand: "Seat", model: "Ibiza", year: 2019, plate: "1234ABC" },
];

/** La solicitud que ya tiene, tal como se la manda su panel. */
const yaPedida = (extra = {}) => ({
  id: "lead-1",
  vehicle_id: "veh-1",
  type: "venta_gestionada",
  title: "Lancia Ypsilon 2005 · 0296DYJ",
  meta: JSON.stringify({ matricula_encargo: "0296DYJ" }),
  status: "Pendiente",
  createdAt: "2026-09-22T20:40:06.676Z",
  ...extra,
});

let pedidas;

beforeEach(() => {
  pedidas = [];
  /*
   * La implementación se pone aquí y no en el `jest.mock`: esta aplicación
   * viene de create-react-app, que trae `resetMocks` puesto, y eso vacía antes
   * de cada prueba lo que la fábrica dejó escrito. Con la fábrica sola, el
   * garaje llegaba vacío y no había ni desplegable que pulsar.
   */
  getGarageVehiclesJson.mockImplementation(async () => ({
    response: { ok: true, status: 200 },
    data: { vehicles: GARAJE },
  }));
  // Lo único que sale a la red desde el componente es mandar la solicitud.
  global.fetch = jest.fn(async (url, opciones) => {
    pedidas.push(JSON.parse(opciones?.body || "{}"));
    return { ok: true, status: 200, json: async () => ({ ok: true, id: "lead-nuevo" }) };
  });
});

const elBoton = () => screen.getByRole("button", { name: /Quiero vender mi coche/i });

async function monta(props = {}) {
  render(<FormularioEncargoVenta userEmail="juan@example.com" {...props} />);
  // El garaje llega por la red: hasta que no está, no hay desplegable.
  await screen.findByRole("option", { name: /Lancia Ypsilon/ });
}

/** Rellena lo que hace falta para que la solicitud sea mandable. */
function rellena({ coche = "veh-1" } = {}) {
  fireEvent.change(screen.getByLabelText(/Qué coche quieres vender/i), { target: { value: coche } });
  fireEvent.change(screen.getByLabelText(/En cuánto tiempo/i), { target: { value: "1mes" } });
  fireEvent.change(screen.getByLabelText(/Tu nombre/i), { target: { value: "Juan" } });
  fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: "679084422" } });
  fireEvent.change(screen.getByLabelText(/Correo/i), { target: { value: "juan@example.com" } });
}

describe("cuando ya lo ha pedido", () => {
  test("la página se acuerda antes de que rellene nada", async () => {
    await monta({ solicitudes: [yaPedida()] });
    expect(screen.getByText(/Ya nos pediste vender tu/i)).toBeInTheDocument();
    // El coche se nombra: sin decir cuál, el aviso no le sirve a quien tiene dos.
    expect(screen.getAllByText(/Lancia Ypsilon 2005 · 0296DYJ/).length).toBeGreaterThan(0);
  });

  test("y al elegir ese coche se lo dice pegado al botón", async () => {
    await monta({ solicitudes: [yaPedida()] });
    rellena({ coche: "veh-1" });
    expect(screen.getByText(/Esto ya nos lo has pedido/i)).toBeInTheDocument();
    expect(screen.getByText(/22 de septiembre/)).toBeInTheDocument();
  });

  test("no deja mandar una segunda", async () => {
    await monta({ solicitudes: [yaPedida()] });
    rellena({ coche: "veh-1" });
    expect(elBoton()).toBeDisabled();
    fireEvent.click(elBoton());
    await waitFor(() => expect(pedidas).toHaveLength(0));
  });

  test("y desde ahí puede ir a ver por dónde va", async () => {
    const irAlPanel = jest.fn();
    await monta({ solicitudes: [yaPedida()], onVerSolicitudes: irAlPanel });
    fireEvent.click(screen.getAllByRole("button", { name: /Ver mis solicitudes/i })[0]);
    expect(irAlPanel).toHaveBeenCalled();
  });
});

describe("pero lo que es nuevo se sigue pudiendo pedir", () => {
  test("otro coche suyo, aunque tenga una viva", async () => {
    await monta({ solicitudes: [yaPedida()] });
    rellena({ coche: "veh-2" });
    expect(screen.queryByText(/Esto ya nos lo has pedido/i)).not.toBeInTheDocument();
    expect(elBoton()).toBeEnabled();
    fireEvent.click(elBoton());
    await waitFor(() => expect(pedidas).toHaveLength(1));
  });

  test("el mismo coche, si aquella ya se atendió y se cerró", async () => {
    /*
     * Volver a escribir cuando lo suyo se cerró hace semanas es una solicitud
     * de verdad. Bloquearla sería dejar fuera al cliente que vuelve.
     */
    await monta({ solicitudes: [yaPedida({ status: "Cerrado" })] });
    rellena({ coche: "veh-1" });
    expect(elBoton()).toBeEnabled();
    fireEvent.click(elBoton());
    await waitFor(() => expect(pedidas).toHaveLength(1));
  });

  test("y quien no ha pedido nada no ve ningún aviso", async () => {
    await monta({ solicitudes: [] });
    expect(screen.queryByText(/ya nos lo has pedido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ya nos pediste/i)).not.toBeInTheDocument();
    rellena({ coche: "veh-1" });
    expect(elBoton()).toBeEnabled();
  });
});
