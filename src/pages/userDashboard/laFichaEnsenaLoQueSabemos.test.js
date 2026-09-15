/**
 * Que la tasación y el informe se vean desde el coche, y que lleven a algo.
 *
 * Las dos cosas existían y no se veían desde su ficha: la tasación vivía en una
 * lista aparte y en un PDF del correo, y el informe solo salía detrás del botón
 * «Gestionar» de la tarjeta.
 *
 * Se lee el fuente: montar esta pantalla en un test pide el catálogo, la
 * sesión, el garaje y la API del informe. Lo que aquí se protege es el cable —
 * que el dato llegue y que el botón vaya por el camino bueno—, y eso se ve.
 */
const fs = require("fs");
const path = require("path");

const PANTALLA = fs.readFileSync(path.join(__dirname, "UserDashboardVehicles.js"), "utf8");
const PADRE = fs.readFileSync(path.join(__dirname, "UserDashboardPage.js"), "utf8");

describe("la tasación se ve en el coche", () => {
  test("el padre le pasa las tasaciones a esta pantalla", () => {
    /*
     * A **esta** y no a cualquiera. Buscar el texto suelto en el fichero no
     * probaba nada: el padre ya se lo pasaba a las pantallas de tasaciones
     * desde antes, así que el test pasaba con el dato cortado — lo saboteé y
     * siguió verde.
     */
    const desde = PADRE.indexOf("<UserDashboardVehicles");
    expect(desde).toBeGreaterThan(-1);
    const bloque = PADRE.slice(desde, PADRE.indexOf("/>", desde));
    expect(bloque).toContain("dashboardValuations={dashboardValuations}");
  });

  test("y la pantalla busca la de ese coche", () => {
    expect(PANTALLA).toContain("laTasacionDe(dashboardValuations,");
  });

  test("se enseña el importe, no solo que existe", () => {
    // «Ya está tasado» sin el número no le dice lo que viene a mirar.
    expect(PANTALLA).toMatch(/enEuros\(laTasacion\.estimateValue\)/);
  });
});

describe("y el informe también", () => {
  test("la ficha pregunta por el informe de ese coche", () => {
    expect(PANTALLA).toMatch(/resumenInforme\(editingVehicleId\)/);
  });

  test("y el botón abre la captura de ese coche", () => {
    expect(PANTALLA).toMatch(/abrirCapturaInforme\(editingVehicleId\)/);
  });
});

describe("los botones van por el camino bueno", () => {
  test("el de tasar usa el ayudante, no la llamada cruda", () => {
    /*
     * `onRequestValuation` no recibe el coche: recibe marca, modelo, año y
     * kilómetros sueltos. Pasarle el coche tal cual abre la tasación con el
     * formulario vacío y sin un solo error por ninguna parte — que es el mismo
     * fallo que dejó las tasaciones guardadas sin precio.
     */
    expect(PANTALLA).toContain("requestValuationForVehicle(editingVehicle || {})");
    expect(PANTALLA).not.toMatch(/onRequestValuation\(editingVehicle/);
  });
});
