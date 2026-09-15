/**
 * Que la ficha del coche salga rellena al abrirla.
 *
 * `catalogoDelCoche.test.js` prueba que la marca guardada se encuentra en el
 * catálogo. Eso puede estar perfecto y la pantalla seguir enseñando «Selecciona
 * marca»: basta con que nadie llame a la función. Es lo mismo que pasó con el
 * correo de la factura —existía y no la llamaba nadie— y aquí lo que se mira es
 * el cable.
 *
 * Se lee el fuente a propósito: montar esta pantalla en un test pide el
 * catálogo, la sesión, el garaje y el informe de estado. Lo que se protege es
 * que la traducción de nombre a id siga enchufada, y eso se ve en el fuente.
 */
const fs = require("fs");
const path = require("path");

const PANTALLA = fs.readFileSync(
  path.join(__dirname, "ServiceIdCarsManagePage.js"),
  "utf8"
);

describe("los desplegables se ponen en el coche que se abre", () => {
  test("la marca guardada se busca en el catálogo", () => {
    /*
     * El desplegable guarda el id («89») y la ficha el nombre («Volkswagen»).
     * Sin esta línea, quien llega desde «lo que te falta» a subir los papeles
     * se encuentra la ficha en blanco y cree haber perdido el coche.
     */
    expect(PANTALLA).toContain("cualEsDelCatalogo(erpBrands, form.brand)");
  });

  test("y el modelo también", () => {
    expect(PANTALLA).toContain("cualEsDelCatalogo(erpModels, form.model)");
  });

  test("con sus versiones, que si no el desplegable no tiene qué enseñar", () => {
    // El valor está puesto, pero sin opciones cargadas el select sale vacío.
    expect(PANTALLA).toMatch(/getErpVersionsJson\(modelo\.id, erpSelectedBrandId\)/);
  });

  test("y al cambiar de coche vuelven a cero", () => {
    /*
     * Guardan el id, no el nombre. Sin limpiarlos, abrir el segundo coche del
     * garaje enseña la marca del primero encima de la ficha del segundo.
     */
    const sinEspacios = PANTALLA.replace(/\s+/g, " ");
    expect(sinEspacios).toMatch(
      /setErpSelectedBrandId\(""\); setErpSelectedModelId\(""\);[^}]*\}, \[editingVehicleId\]\)/
    );
  });
});

describe("y lo que el catálogo no tiene se enseña a mano", () => {
  test("una marca que no está en el catálogo pasa a modo manual", () => {
    /*
     * Un desplegable vacío sobre un coche que sí tiene marca esconde un dato
     * que existe. A mano se ve.
     */
    const sinEspacios = PANTALLA.replace(/\s+/g, " ");
    expect(sinEspacios).toMatch(
      /const marca = cualEsDelCatalogo\(erpBrands, form\.brand\); if \(!marca\) \{ setVehicleCatalogMode\("manual"\)/
    );
    expect(sinEspacios).toMatch(
      /const modelo = cualEsDelCatalogo\(erpModels, form\.model\); if \(!modelo\) \{ setVehicleCatalogMode\("manual"\)/
    );
  });
});
