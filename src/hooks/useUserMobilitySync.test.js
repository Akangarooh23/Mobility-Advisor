/**
 * Los datos del panel se vuelven a pedir cuando algo ha cambiado.
 *
 * Se pedían una sola vez, al entrar la sesión. Quien reservaba una visita la
 * veía en su panel solo después de recargar la página entera: la había pedido,
 * le había llegado el correo, y en «Solicitudes» no estaba.
 *
 * Lo que se fija aquí es que subir el contador vuelva a pedirlos, y que no se
 * pidan solos por cualquier otro renderizado —eso sería una llamada a la API por
 * cada tecla que toque el usuario.
 */
import { render } from "@testing-library/react";
import { useUserMobilitySync } from "./useUserMobilitySync";
import { getUserMobilityDataJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({
  getUserMobilityDataJson: jest.fn(),
}));

const nada = () => {};

function Sonda({ email, refrescos, otra }) {
  useUserMobilitySync({
    currentUserEmail: email,
    refrescos,
    setSavedComparisons: nada,
    setUserAppointments: nada,
    setUserMaintenances: nada,
    setUserInsurances: nada,
    setUserValuations: nada,
    setUserVehicleStates: nada,
    setUserSolicitudes: nada,
  });
  return <div>{otra}</div>;
}

beforeEach(() => {
  getUserMobilityDataJson.mockReset();
  getUserMobilityDataJson.mockResolvedValue({ response: { ok: true }, data: { solicitudes: [] } });
});

describe("volver a pedir los datos del usuario", () => {
  test("al entrar la sesión se piden una vez", () => {
    render(<Sonda email="cliente@example.com" refrescos={0} />);
    expect(getUserMobilityDataJson).toHaveBeenCalledTimes(1);
  });

  test("subir el contador los vuelve a pedir", () => {
    const { rerender } = render(<Sonda email="cliente@example.com" refrescos={0} />);
    rerender(<Sonda email="cliente@example.com" refrescos={1} />);
    expect(getUserMobilityDataJson).toHaveBeenCalledTimes(2);
  });

  test("un renderizado cualquiera no los pide", () => {
    const { rerender } = render(<Sonda email="cliente@example.com" refrescos={0} otra="a" />);
    rerender(<Sonda email="cliente@example.com" refrescos={0} otra="b" />);
    expect(getUserMobilityDataJson).toHaveBeenCalledTimes(1);
  });

  test("sin sesión no se pide nada", () => {
    render(<Sonda email="" refrescos={3} />);
    expect(getUserMobilityDataJson).not.toHaveBeenCalled();
  });
});
