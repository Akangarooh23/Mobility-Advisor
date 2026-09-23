/**
 * Las franjas y el sitio donde se enseña el coche tienen pantalla propia.
 *
 * Antes vivían dentro de un botón de la tarjeta del coche, en Vehículos, y ese
 * botón solo salía al ir a publicar en el marketplace. Quien leía en su panel
 * «pendiente: indicar franjas horarias» pinchaba y aterrizaba en la lista de
 * sus coches, sin nada abierto: el enlace llevaba a la página correcta y aun
 * así no llevaba a ninguna parte.
 *
 * Se monta y se pulsa. Lo que se protege: que el coche del encargo salga
 * aunque todavía no esté publicado, que la dirección se pueda poner y guardar,
 * y que no se guarde una a la que no se puede ir.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserDashboardFranjas from "./UserDashboardFranjas";

jest.mock("../../utils/apiClient", () => ({
  rutaApi: (r) => r,
  getLugarDeVisitaJson: jest.fn(),
  postLugarDeVisitaJson: jest.fn(),
}));
const { getLugarDeVisitaJson, postLugarDeVisitaJson } = require("../../utils/apiClient");

/*
 * El editor de franjas se cambia por una marca.
 *
 * Habla con la red por su cuenta y tiene su propio calendario; aquí lo que se
 * mira es la pantalla que lo contiene, no él.
 */
jest.mock("../../components/AvailabilityEditor", () => ({
  __esModule: true,
  default: ({ offerId }) => <div data-testid="editor-franjas">{offerId}</div>,
}));

const DEL_ENCARGO = { id: "veh-1", title: "Lancia Ypsilon", plate: "0296DYJ", marketplaceState: "draft" };
const PUBLICADO = { id: "veh-2", title: "Seat Ibiza", plate: "1234ABC", marketplaceState: "active_sale" };
const SOLO_EN_EL_GARAJE = { id: "veh-3", title: "Renault Clio", plate: "5555ZZZ", marketplaceState: "draft" };

const SECCIONES = [{ items: [DEL_ENCARGO, PUBLICADO, SOLO_EN_EL_GARAJE] }];
const CON_ENCARGO = new Set(["0296DYJ"]);

let guardados;

beforeEach(() => {
  guardados = [];
  // create-react-app trae `resetMocks`, así que la implementación se pone aquí.
  getLugarDeVisitaJson.mockImplementation(async () => ({
    response: { ok: true, status: 200 },
    data: { lugar: null },
  }));
  postLugarDeVisitaJson.mockImplementation(async (payload) => {
    guardados.push(payload);
    return {
      response: { ok: true, status: 200 },
      data: { lugar: { ...payload, completo: true, enUnaLinea: "Calle de Alcalá 120, 28009 Madrid" } },
    };
  });
});

function monta(props = {}) {
  render(
    <UserDashboardFranjas
      themeMode="light"
      panelStyle={{}}
      userVehicleSections={SECCIONES}
      matriculasConEncargo={CON_ENCARGO}
      {...props}
    />
  );
}

describe("qué coches salen", () => {
  test("el del encargo, aunque todavía no esté publicado", async () => {
    /*
     * Éste es el caso entero: al del encargo le pedimos las franjas **antes**
     * de publicar, y era el único que no tenía dónde ponerlas.
     */
    monta();
    expect(await screen.findByText("Lancia Ypsilon")).toBeInTheDocument();
    expect(screen.getByText("Lo vendemos por ti")).toBeInTheDocument();
  });

  test("y el que ya está anunciado", () => {
    monta();
    expect(screen.getByText("Seat Ibiza")).toBeInTheDocument();
  });

  test("pero no uno que solo tiene en el garaje: nadie puede pedirle hora", () => {
    monta();
    expect(screen.queryByText("Renault Clio")).not.toBeInTheDocument();
  });

  test("cada uno con su calendario, y son distintos", () => {
    monta();
    const editores = screen.getAllByTestId("editor-franjas").map((e) => e.textContent);
    expect(editores).toEqual(["idcar-veh-1", "idcar-veh-2"]);
  });

  test("sin ningún coche se explica por qué está vacío", () => {
    monta({ userVehicleSections: [{ items: [SOLO_EN_EL_GARAJE] }], matriculasConEncargo: new Set() });
    expect(screen.getByText(/Todavía no hay ningún coche que enseñar/i)).toBeInTheDocument();
    expect(screen.queryByTestId("editor-franjas")).not.toBeInTheDocument();
  });
});

describe("la dirección donde lo enseña", () => {
  test("se guarda entera", async () => {
    monta();
    const [calle] = screen.getAllByLabelText(/Calle y número/i);
    const [cp] = screen.getAllByLabelText(/Código postal/i);
    const [ciudad] = screen.getAllByLabelText(/Ciudad/i);
    const [quien] = screen.getAllByLabelText(/Pregunta por/i);
    fireEvent.change(calle, { target: { value: "Calle de Alcalá 120, 3ºB" } });
    fireEvent.change(cp, { target: { value: "28009" } });
    fireEvent.change(ciudad, { target: { value: "Madrid" } });
    fireEvent.change(quien, { target: { value: "Ana" } });

    fireEvent.click(screen.getAllByRole("button", { name: /Guardar la dirección/i })[0]);

    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0]).toMatchObject({
      offerId: "idcar-veh-1",
      direccion: "Calle de Alcalá 120, 3ºB",
      codigoPostal: "28009",
      ciudad: "Madrid",
      contacto: "Ana",
    });
    expect(await screen.findByText("Guardada")).toBeInTheDocument();
  });

  test("y si el servidor la rechaza, se le dice por qué y no se queda como guardada", async () => {
    postLugarDeVisitaJson.mockImplementation(async () => ({
      response: { ok: false, status: 400 },
      data: { error: "Falta el número de la calle." },
    }));
    monta();
    fireEvent.change(screen.getAllByLabelText(/Calle y número/i)[0], { target: { value: "en mi casa" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Guardar la dirección/i })[0]);

    expect(await screen.findByText(/Falta el número de la calle/)).toBeInTheDocument();
    expect(screen.queryByText("Guardada")).not.toBeInTheDocument();
  });

  test("se dice que no se publica: es el portal de su casa", () => {
    monta();
    expect(screen.getAllByText(/solo al comprador que ya/i).length).toBeGreaterThan(0);
  });

  test("la que ya tenía puesta aparece rellena", async () => {
    getLugarDeVisitaJson.mockImplementation(async () => ({
      response: { ok: true, status: 200 },
      data: { lugar: { direccion: "Gran Vía 1", codigoPostal: "28013", ciudad: "Madrid", contacto: "", notas: "", completo: true } },
    }));
    monta();
    await waitFor(() => expect(screen.getAllByLabelText(/Calle y número/i)[0]).toHaveValue("Gran Vía 1"));
  });
});
