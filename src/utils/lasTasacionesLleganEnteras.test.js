/**
 * Que la tasación llegue entera del servidor a la ficha del coche.
 *
 * ## Por qué existe este test
 *
 * La ficha del coche decía «La tasación · sin hacer» con la tasación hecha, el
 * precio a la vista dos pantallas más allá y la puerta del encargo en verde.
 *
 * El dato cruza tres saltos: el servidor lo manda, `buildUserDashboardModel` lo
 * prepara para el panel y la ficha lo busca. Yo probé el primero y el tercero.
 * El que fallaba era el de en medio: el mapeador copiaba el título, el importe
 * y la fecha, y se dejaba `vehicleId`. Sin él no hay manera de saber de qué
 * coche es, así que ninguna ficha lo encontraba nunca.
 *
 * Por eso esto no comprueba `vehicleId` a mano: exige que **todo lo que la
 * ficha mira** sobreviva al viaje.
 */
import { buildUserDashboardModel } from "./userDashboardHelpers";
import { laTasacionDe } from "./loQueSabemosDelCoche";

/** Una tasación tal y como la manda el servidor. */
const DEL_SERVIDOR = {
  id: "valuation-1",
  title: "Volkswagen T-Roc (2022)",
  meta: "Primera tasacion, gratuita",
  status: "Ultima tasacion disponible",
  report: "",
  estimateValue: 20795,
  vehicleId: "veh-1778144236925",
  vehicleTitle: "Volkswagen T-Roc",
  createdAt: "2026-09-15T18:08:00Z",
};

const COCHE = { id: "veh-1778144236925", plate: "8888LXR" };

/** El modelo del panel, con lo mínimo para que se construya. */
const elModelo = (valuations) =>
  buildUserDashboardModel({
    savedComparisons: [],
    userAppointments: [],
    userMaintenances: [],
    userInsurances: [],
    userValuations: valuations,
    userVehicleStates: [],
  });

describe("la tasación sobrevive al viaje", () => {
  test("la ficha del coche la encuentra", () => {
    const { dashboardValuations } = elModelo([DEL_SERVIDOR]);
    const suya = laTasacionDe(dashboardValuations, COCHE);
    expect(suya).not.toBeNull();
    expect(suya.estimateValue).toBe(20795);
  });

  test("y no pierde nada de lo que la ficha mira", () => {
    /*
     * El guardián. Lo que la ficha lee de una tasación —de qué coche es, cuánto
     * y cuándo— tiene que seguir ahí después del mapeador. La que se caiga deja
     * la ficha diciendo «sin hacer» sin ningún error por ninguna parte.
     */
    const { dashboardValuations } = elModelo([DEL_SERVIDOR]);
    const preparada = dashboardValuations[0];
    for (const clave of ["vehicleId", "estimateValue", "createdAt", "meta"]) {
      expect(preparada[clave]).toBeTruthy();
      expect(String(preparada[clave])).toBe(String(DEL_SERVIDOR[clave]));
    }
  });
});

describe("y no se inventa lo que no hay", () => {
  test("sin tasaciones, la ficha dice que no hay", () => {
    const { dashboardValuations } = elModelo([]);
    expect(laTasacionDe(dashboardValuations, COCHE)).toBeNull();
  });

  test("una sin precio no aparece como hecha", () => {
    // Es el estado en que quedaron las filas por el nombre de campo mal escrito.
    const { dashboardValuations } = elModelo([{ ...DEL_SERVIDOR, estimateValue: null }]);
    expect(laTasacionDe(dashboardValuations, COCHE)).toBeNull();
  });

  test("y la de otro coche no se le cuelga a este", () => {
    const { dashboardValuations } = elModelo([{ ...DEL_SERVIDOR, vehicleId: "veh-otro" }]);
    expect(laTasacionDe(dashboardValuations, COCHE)).toBeNull();
  });
});
