/**
 * «¿Te interesaría financiarlo?» se pregunta a todos, hayan entrado o no.
 *
 * Estaba dentro del bloque de «sin sesión»: al que venía de un portal sin
 * cuenta se le preguntaba, y al cliente que ya conocemos —el que ha entrado—
 * nunca. El servidor la guardaba igual en los dos caminos; faltaba la casilla.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SlotPicker from "./SlotPicker";

const HUECO = { id: "s-1", starts_at: "2026-09-21T08:00:00.000Z", ends_at: "2026-09-21T12:00:00.000Z" };

let peticiones = [];

beforeEach(() => {
  peticiones = [];
  global.fetch = jest.fn(async (url, opciones) => {
    if (!opciones || opciones.method !== "POST") {
      return { json: async () => ({ ok: true, slots: [HUECO] }) };
    }
    peticiones.push(JSON.parse(opciones.body));
    return { json: async () => ({ ok: true, booking: { id: "b-1", ...HUECO } }) };
  });
});

async function llegaAlFormulario(props) {
  render(<SlotPicker offerId="idcar-veh-1" vehicleTitle="T-Roc" {...props} />);
  const hueco = await screen.findByRole("button", { name: /^\d{2}:\d{2}$/ });
  fireEvent.click(hueco);
}

describe("la pregunta de financiarlo", () => {
  test("sale a quien ha entrado", async () => {
    await llegaAlFormulario({ haySesion: true, userEmail: "ana@example.com", userName: "Ana" });
    expect(screen.getByLabelText(/Te interesaría financiarlo/)).toBeInTheDocument();
  });

  test("y lo que contesta llega al servidor al reservar", async () => {
    await llegaAlFormulario({ haySesion: true, userEmail: "ana@example.com", userName: "Ana" });
    fireEvent.click(screen.getByLabelText(/Te interesaría financiarlo/));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar visita/ }));
    await waitFor(() => expect(peticiones.length).toBe(1));
    expect(peticiones[0].route).toBe("book");
    expect(peticiones[0].quiereFinanciar).toBe(true);
  });

  test("y sigue saliendo a quien no ha entrado", async () => {
    await llegaAlFormulario({ haySesion: false });
    expect(screen.getByLabelText(/Te interesaría financiarlo/)).toBeInTheDocument();
  });
});
