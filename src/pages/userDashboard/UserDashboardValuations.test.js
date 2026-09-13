import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import UserDashboardValuations from "./UserDashboardValuations";
import { USER_DASHBOARD_ROUTE_MAP } from "../../utils/offerHelpers";

/**
 * El botón de «Nueva tasación».
 *
 * Llamaba a `onNavigate("operations")`, y «operations» no es ninguna sección:
 * el mapa de rutas no la conoce, así que caía al inicio del panel. Le decíamos
 * «hazte la tasación, sale de tu panel», pulsaba el único botón que hay y
 * acababa en la portada sin que pasara nada — y el botón parecía funcionar.
 */
const t = (clave, opciones) => i18next.t(clave, opciones);

const COCHES = [
  { id: "veh-1", plate: "8888LXR", title: "Volkswagen T-Roc", brand: "Volkswagen", model: "T-Roc", year: "2022", mileage: "60000", fuel: "gasolina" },
  { id: "veh-2", plate: "1234ABC", title: "Seat Ibiza", brand: "Seat", model: "Ibiza" },
];

const pinta = (props = {}) => {
  const onRequestValuation = jest.fn();
  const onNavigate = jest.fn();
  render(
    <UserDashboardValuations
      dashboardValuations={[]}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      onRequestValuation={onRequestValuation}
      onNavigate={onNavigate}
      misCoches={COCHES}
      {...props}
    />
  );
  return { onRequestValuation, onNavigate };
};

const botonNueva = () => screen.getAllByRole("button")
  .find((b) => b.textContent === t("dashboard.valNewValuation"));

describe("empezar una tasación", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/panel/tasaciones");
  });

  test("el botón empieza una tasación, no navega a ninguna parte", () => {
    const { onRequestValuation, onNavigate } = pinta();
    fireEvent.click(botonNueva());
    expect(onRequestValuation).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test("y con la matrícula en la dirección, la empieza con ese coche", () => {
    /*
     * Se llega aquí desde «lo que te falta» de su encargo. Si no se mira la
     * matrícula, la tasación sale en blanco y tiene que escribir a mano lo que
     * ya tenemos guardado.
     */
    window.history.replaceState({}, "", "/panel/tasaciones?matricula=8888LXR");
    const { onRequestValuation } = pinta();
    fireEvent.click(botonNueva());
    expect(onRequestValuation).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "veh-1", brand: "Volkswagen", model: "T-Roc" })
    );
  });

  test("y sin matrícula la empieza igual, en blanco", () => {
    // Entrar por el menú es tan válido como llegar desde el encargo.
    const { onRequestValuation } = pinta();
    fireEvent.click(botonNueva());
    expect(onRequestValuation).toHaveBeenCalledWith({});
  });

  test("una matrícula que no es suya no abre el coche de otro", () => {
    window.history.replaceState({}, "", "/panel/tasaciones?matricula=0000ZZZ");
    const { onRequestValuation } = pinta();
    fireEvent.click(botonNueva());
    expect(onRequestValuation).toHaveBeenCalledWith({});
  });
});

describe("no se navega a secciones que no existen", () => {
  test("todo onNavigate de esta pantalla usa una clave del mapa de rutas", () => {
    /*
     * Es la regla que se saltó el fallo. `getUserDashboardPath` no lanza con
     * una clave desconocida: devuelve el home, así que el botón «funciona» y
     * te deja en otro sitio sin decir nada.
     */
    const fuente = require("fs").readFileSync(
      require("path").join(__dirname, "UserDashboardValuations.js"), "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const claves = [...fuente.matchAll(/onNavigate\s*&&\s*onNavigate\("([^"]+)"\)|onNavigate\("([^"]+)"\)/g)]
      .map((m) => m[1] || m[2]);
    expect(claves.length).toBeGreaterThan(0);
    for (const clave of claves) {
      expect(Object.keys(USER_DASHBOARD_ROUTE_MAP)).toContain(clave);
    }
  });
});
