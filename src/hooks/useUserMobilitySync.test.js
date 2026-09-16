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
import { act } from "react-dom/test-utils";
import { useUserMobilitySync } from "./useUserMobilitySync";
import { getUserMobilityDataJson } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({
  getUserMobilityDataJson: jest.fn(),
}));

const nada = () => {};

function Sonda({ email, refrescos, otra, alCaducarLaSesion, setUserValuations = nada }) {
  useUserMobilitySync({
    currentUserEmail: email,
    refrescos,
    alCaducarLaSesion,
    setSavedComparisons: nada,
    setUserAppointments: nada,
    setUserMaintenances: nada,
    setUserInsurances: nada,
    setUserValuations,
    setUserVehicleStates: nada,
    setUserSolicitudes: nada,
  });
  return <div>{otra}</div>;
}

/** Deja que la respuesta llegue y que React pinte lo que traiga. */
async function actuaYEspera() {
  await act(async () => {
    await Promise.resolve();
  });
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

describe("cuando el servidor dice que ya no hay sesión", () => {
  /*
   * El 401 se tragaba con el resto de fallos de red.
   *
   * Y como se tragaba, la pantalla se quedaba con los números de la última
   * visita —los que guarda el navegador— y parecía que la sesión seguía
   * abierta. Ella veía «1 tasación, 1 solicitud» en su panel, pinchaba en
   * «sube una factura» y se le pedía la contraseña sin venir a cuento: el
   * servidor llevaba rato diciendo que ahí no había nadie.
   */
  test("se avisa, y no se toca ningún dato", async () => {
    getUserMobilityDataJson.mockResolvedValue({
      response: { ok: false, status: 401 },
      data: { error: "Sesion no valida." },
    });
    const caduca = jest.fn();
    const guarda = jest.fn();

    render(<Sonda email="cliente@example.com" refrescos={0} alCaducarLaSesion={caduca} setUserValuations={guarda} />);
    await actuaYEspera();

    expect(caduca).toHaveBeenCalledTimes(1);
    // Lo de la caché se queda como está: quien avisa decide qué hacer con ello.
    expect(guarda).not.toHaveBeenCalled();
  });

  test("un fallo cualquiera del servidor no cierra la sesión", async () => {
    // Un 500 o un corte de red es «ahora no puedo», no «tú no eres nadie».
    // Echar a la gente por un servidor caído sería peor que no enseñar el dato.
    getUserMobilityDataJson.mockResolvedValue({
      response: { ok: false, status: 500 },
      data: {},
    });
    const caduca = jest.fn();

    render(<Sonda email="cliente@example.com" refrescos={0} alCaducarLaSesion={caduca} />);
    await actuaYEspera();

    expect(caduca).not.toHaveBeenCalled();
  });

  test("y con todo bien tampoco", async () => {
    const caduca = jest.fn();

    render(<Sonda email="cliente@example.com" refrescos={0} alCaducarLaSesion={caduca} />);
    await actuaYEspera();

    expect(caduca).not.toHaveBeenCalled();
  });
});

describe("y en la aplicación está enchufado", () => {
  const fs = require("fs");
  const path = require("path");
  const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

  test("se le pasa el aviso al sincronizador", () => {
    const llamada = APP.slice(APP.indexOf("useUserMobilitySync({"), APP.indexOf("useUserMobilitySync({") + 400);
    expect(llamada).toContain("alCaducarLaSesion");
  });

  test("y lo que hace es olvidar la sesión y pedir entrar", () => {
    const manejador = APP.slice(
      APP.indexOf("const alCaducarLaSesion = useCallback("),
      APP.indexOf("const alCaducarLaSesion = useCallback(") + 400
    );
    // Las cuatro, y las cuatro hacen falta: borrar lo guardado, olvidar al
    // usuario, dejar de creerse dentro y pedir la contraseña.
    expect(manejador).toContain("clearAuthUser()");
    expect(manejador).toContain("setCurrentUser(null)");
    expect(manejador).toContain("setIsUserLoggedIn(false)");
    expect(manejador).toContain('setAuthDialogMode("login")');
  });

  test("el aviso de la ventana dice la verdad, no «marketplace»", () => {
    /*
     * Salía «Necesitas iniciar sesión para acceder al marketplace» en el
     * garaje, en el panel y en la ficha de un coche. Quien lo leía en
     * /mis-coches no entendía qué pintaba ahí el marketplace.
     */
    expect(APP).not.toContain("iniciar sesión para acceder al marketplace");
  });
});
