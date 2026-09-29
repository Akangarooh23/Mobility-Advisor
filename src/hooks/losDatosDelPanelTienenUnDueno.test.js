/**
 * Los seis datos del panel: quién los siembra y quién los borra.
 *
 * ## Qué había
 *
 * Seis `useState` en `App` —citas, revisiones, seguros, tasaciones, estados de
 * los coches y solicitudes— con tres dueños:
 *
 *   · `useAppBootstrap` los sembraba desde el navegador al arrancar;
 *   · `useUserMobilitySync` los refrescaba desde el servidor;
 *   · y `App` los cambiaba a mano en ocho sitios, al reservar una visita o al
 *     cerrar una revisión.
 *
 * Tres sitios y ninguno donde mirar qué son.
 *
 * ## Qué se fija
 *
 * Las dos cosas que se notarían:
 *
 *   · que al arrancar salga lo de la última visita, en vez de seis listas
 *     vacías mientras llega el servidor — que es lo que hace que el panel no
 *     parpadee;
 *   · y que **al salir se vacíen**. Si no, quien cierra sesión en un ordenador
 *     compartido deja sus citas y sus tasaciones en pantalla.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserMobilitySync } from "./useUserMobilitySync";
import * as almacen from "../utils/storage";
import { getUserMobilityDataJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({
  getUserMobilityDataJson: jest.fn(),
}));

jest.mock("../utils/storage", () => ({
  readUserAppointments: jest.fn(() => []),
  readUserMaintenances: jest.fn(() => []),
  readUserInsurances: jest.fn(() => []),
  readUserValuations: jest.fn(() => []),
  readUserVehicleStates: jest.fn(() => []),
  readUserSolicitudes: jest.fn(() => []),
  readUserBillingState: jest.fn(() => ({})),
  writeSavedComparisons: jest.fn(),
  writeUserAppointments: jest.fn(),
  writeUserMaintenances: jest.fn(),
  writeUserInsurances: jest.fn(),
  writeUserValuations: jest.fn(),
  writeUserVehicleStates: jest.fn(),
  writeUserSolicitudes: jest.fn(),
  writeCachedGarageVehicleCount: jest.fn(),
  writeUserBillingState: jest.fn(),
}));

const OPCIONES = { currentUserEmail: "", setSavedComparisons: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getUserMobilityDataJson.mockResolvedValue({ response: { ok: false, status: 500 }, data: null });
  for (const leer of [
    "readUserAppointments", "readUserMaintenances", "readUserInsurances",
    "readUserValuations", "readUserVehicleStates", "readUserSolicitudes",
  ]) {
    almacen[leer].mockReturnValue([]);
  }
});

describe("al arrancar", () => {
  test("sale lo que quedó de la última visita", async () => {
    /*
     * Sin esto el panel entra con seis listas vacías y se rellena cuando
     * contesta el servidor: un parpadeo en el que parece que no tienes nada.
     */
    almacen.readUserAppointments.mockReturnValue([{ id: "cita-1" }]);
    almacen.readUserSolicitudes.mockReturnValue([{ id: "sol-1" }]);

    const { result } = renderHook(() =>
      useUserMobilitySync({ ...OPCIONES, currentUserEmail: "ana@popcar.es" })
    );

    await waitFor(() => expect(result.current.userAppointments).toHaveLength(1));
    expect(result.current.userAppointments[0].id).toBe("cita-1");
    expect(result.current.userSolicitudes[0].id).toBe("sol-1");
  });

  test("y los seis se piden al navegador, no solo dos", () => {
    // Olvidarse de uno no da error: esa lista sale vacía hasta que conteste el
    // servidor, y solo en esa pantalla.
    renderHook(() => useUserMobilitySync(OPCIONES));

    expect(almacen.readUserAppointments).toHaveBeenCalled();
    expect(almacen.readUserMaintenances).toHaveBeenCalled();
    expect(almacen.readUserInsurances).toHaveBeenCalled();
    expect(almacen.readUserValuations).toHaveBeenCalled();
    expect(almacen.readUserVehicleStates).toHaveBeenCalled();
    expect(almacen.readUserSolicitudes).toHaveBeenCalled();
  });
});

describe("al salir", () => {
  test("se vacían los seis", async () => {
    /*
     * En un ordenador compartido, no vaciarlos deja las citas y las tasaciones
     * de quien acaba de salir en la pantalla del siguiente.
     */
    almacen.readUserAppointments.mockReturnValue([{ id: "cita-1" }]);
    almacen.readUserValuations.mockReturnValue([{ id: "tas-1" }]);

    const { result, rerender } = renderHook(
      (props) => useUserMobilitySync(props),
      { initialProps: { ...OPCIONES, currentUserEmail: "ana@popcar.es" } }
    );

    await waitFor(() => expect(result.current.userAppointments).toHaveLength(1));

    // Cerrar sesión: el correo desaparece.
    act(() => { rerender({ ...OPCIONES, currentUserEmail: "" }); });

    await waitFor(() => expect(result.current.userValuations).toHaveLength(0));
    expect(result.current.userAppointments).toHaveLength(0);
    expect(result.current.userMaintenances).toHaveLength(0);
    expect(result.current.userInsurances).toHaveLength(0);
    expect(result.current.userVehicleStates).toHaveLength(0);
    expect(result.current.userSolicitudes).toHaveLength(0);
  });
});

describe("y App puede seguir tocándolos", () => {
  test("los setters se devuelven, porque hay ocho sitios que los usan", async () => {
    /*
     * Reservar una visita o cerrar una revisión cambian estas listas sin pasar
     * por el servidor. Eso es de `App`, no de este hook, que solo trae lo que
     * hay guardado.
     */
    const { result } = renderHook(() => useUserMobilitySync(OPCIONES));

    act(() => result.current.setUserAppointments([{ id: "cita-nueva" }]));
    await waitFor(() => expect(result.current.userAppointments[0].id).toBe("cita-nueva"));
  });
});
