/**
 * «No hay sesión» tiene que ser una respuesta, no una pregunta sin contestar.
 *
 * Lo que pasaba: al abrir /mis-coches de cero —el enlace de «lo que te falta»
 * de su encargo, que llega por correo— se le pedía la contraseña a alguien que
 * ya la había metido. El guardia de esa página mira `isUserLoggedIn`, que
 * arranca en falso, y corre en la misma pasada que el arranque: veía el falso
 * de partida, no el de la sesión guardada.
 *
 * Por eso el arranque avisa, en cuanto lo sabe, de que ya lo sabe. Y tiene que
 * avisar sin esperar a la red: si esperase, la pantalla ya habría pedido la
 * contraseña mucho antes de que contestara el servidor.
 */
import { render } from "@testing-library/react";
import { useAppBootstrap } from "./useAppBootstrap";
import { getAuthSessionJson } from "../utils/apiClient";
import { readAuthUser } from "../utils/storage";

jest.mock("../utils/apiClient", () => ({
  getAuthSessionJson: jest.fn(),
  getUserAlertsJson: jest.fn(),
  getUserPreferencesJson: jest.fn(),
  getUserSavedComparisonsJson: jest.fn(),
}));

jest.mock("../utils/storage", () => {
  const nada = () => {};
  const lista = () => [];
  return {
    clearAuthUser: nada,
    readAuthUser: jest.fn(() => null),
    readCookieConsent: () => ({ status: "aceptadas", preferences: {} }),
    readMarketAlerts: lista,
    readMarketAlertStatus: () => ({}),
    readQuestionnaireDraft: () => null,
    readSavedComparisons: lista,
    readUserAppointments: lista,
    readUserMaintenances: lista,
    readUserInsurances: lista,
    readUserValuations: lista,
    readUserVehicleStates: lista,
    readUserSolicitudes: lista,
    writeAuthUser: nada,
    writeSavedComparisons: nada,
  };
});

const nada = () => {};

function Sonda({ setSesionComprobada, setIsUserLoggedIn = nada }) {
  useAppBootstrap({
    setSesionComprobada,
    setIsUserLoggedIn,
    themeStorageKey: "tema",
    setThemeMode: nada,
    setSavedComparisons: nada,
    setUserAppointments: nada,
    setUserMaintenances: nada,
    setUserInsurances: nada,
    setUserValuations: nada,
    setUserVehicleStates: nada,
    setUserSolicitudes: nada,
    setMarketAlerts: nada,
    setMarketAlertStatus: nada,
    setQuestionnaireDraft: nada,
    setCurrentUser: nada,
    setCookiePreferences: nada,
    setShowCookieGate: nada,
    setAuthRequired: nada,
    setAuthDialogMode: nada,
    setShowConsentReview: nada,
  });
  return null;
}

beforeEach(() => {
  readAuthUser.mockReset();
  readAuthUser.mockReturnValue(null);
  getAuthSessionJson.mockReset();
  // La red no contesta nunca: lo de aquí abajo tiene que pasar igual.
  getAuthSessionJson.mockReturnValue(new Promise(() => {}));
  window.history.replaceState({}, "", "/mis-coches");
});

describe("el arranque dice cuándo ya se sabe si hay sesión", () => {
  test("con la sesión guardada, se avisa sin esperar a la red", () => {
    readAuthUser.mockReturnValue({ email: "cliente@example.com" });
    const avisa = jest.fn();
    const entra = jest.fn();

    render(<Sonda setSesionComprobada={avisa} setIsUserLoggedIn={entra} />);

    expect(avisa).toHaveBeenCalledWith(true);
    expect(entra).toHaveBeenCalledWith(true);
  });

  test("y sin sesión guardada también: eso también es saberlo", () => {
    const avisa = jest.fn();
    const entra = jest.fn();

    render(<Sonda setSesionComprobada={avisa} setIsUserLoggedIn={entra} />);

    expect(avisa).toHaveBeenCalledWith(true);
    expect(entra).toHaveBeenCalledWith(false);
  });

  test("se avisa después de decir si hay sesión, no antes", () => {
    /*
     * El orden importa: quien mira los dos valores en la misma pasada tiene que
     * ver el de la sesión ya puesto cuando le llega el aviso. Al revés, el
     * guardia se despertaría con el falso de partida y pediría la contraseña.
     */
    readAuthUser.mockReturnValue({ email: "cliente@example.com" });
    const orden = [];

    render(
      <Sonda
        setSesionComprobada={() => orden.push("comprobada")}
        setIsUserLoggedIn={() => orden.push("sesion")}
      />
    );

    expect(orden).toEqual(["sesion", "comprobada"]);
  });
});

describe("y el guardia de /mis-coches lo espera", () => {
  const fs = require("fs");
  const path = require("path");
  const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const GUARDIA = APP.slice(
    APP.indexOf('if (entryMode !== "idCarsManage" || isUserLoggedIn) return;') - 900,
    APP.indexOf('if (entryMode !== "idCarsManage" || isUserLoggedIn) return;') + 400
  );

  test("no pide la contraseña mientras no se sepa", () => {
    expect(GUARDIA).toContain("if (!sesionComprobada) return;");
  });

  test("y se vuelve a mirar en cuanto se sabe", () => {
    // Sin esto en las dependencias, el efecto no se repite al saberse y la
    // página se queda sin pedir nada a quien sí tiene que entrar.
    expect(GUARDIA).toMatch(/\}, \[[^\]]*sesionComprobada[^\]]*\]\)/);
  });
});
