/**
 * Que el coche guardado se encuentre en el catálogo.
 *
 * Lo que se protege: que al abrir un coche que ya existe, «Marca» y «Modelo»
 * salgan puestos. Salían vacíos —«Selecciona marca» sobre un Volkswagen
 * T-Roc— porque el desplegable guarda el id del catálogo y la ficha guarda el
 * nombre, y nadie traducía lo uno a lo otro.
 */
import { comoSeCompara, mismoNombre, cualEsDelCatalogo } from "./catalogoDelCoche";

/* Tal y como están escritos en la base: el catálogo y el coche de la prueba. */
const MARCAS = [{ id: "89", name: "Volkswagen" }, { id: "12", name: "Citroën" }];
const MODELOS = [{ id: "488", name: "T-Roc" }, { id: "724", name: "Scirocco" }];

describe("el coche se encuentra en el catálogo", () => {
  test("la marca y el modelo del 8888LXR", () => {
    expect(cualEsDelCatalogo(MARCAS, "Volkswagen")).toEqual({ id: "89", name: "Volkswagen" });
    expect(cualEsDelCatalogo(MODELOS, "T-Roc")).toEqual({ id: "488", name: "T-Roc" });
  });

  test("aunque se escriba de otra manera", () => {
    // El mismo texto escrito por dos sitios: un guion no puede dejar fuera al coche.
    for (const escrito of ["T-Roc", "T ROC", "t-roc", "TRoc"]) {
      expect(cualEsDelCatalogo(MODELOS, escrito)?.id).toBe("488");
    }
    expect(cualEsDelCatalogo(MARCAS, "CITROEN")?.id).toBe("12");
    expect(cualEsDelCatalogo(MARCAS, "citroën")?.id).toBe("12");
  });

  test("y no se confunde con otro que se parece", () => {
    // «Scirocco» acaba en «roc» y no es el mismo coche.
    expect(cualEsDelCatalogo(MODELOS, "Scirocco")?.id).toBe("724");
    expect(cualEsDelCatalogo(MODELOS, "Roc")).toBeNull();
  });

  test("lo que no está, no está", () => {
    expect(cualEsDelCatalogo(MARCAS, "Lada")).toBeNull();
  });
});

describe("la lista vacía no es lo mismo que no encontrarlo", () => {
  test("mientras carga se devuelve null igual, y quien llama tiene que mirarlo", () => {
    /*
     * Si esto dijera «no está» en cuanto la lista viene vacía, la pantalla se
     * pasaría a modo manual por una respuesta lenta del catálogo.
     */
    expect(cualEsDelCatalogo([], "Volkswagen")).toBeNull();
    expect(cualEsDelCatalogo(null, "Volkswagen")).toBeNull();
    expect(cualEsDelCatalogo(undefined, "Volkswagen")).toBeNull();
  });

  test("un nombre vacío no engancha con nada", () => {
    // Un coche sin marca no puede resolverse «a la primera de la lista».
    expect(cualEsDelCatalogo(MARCAS, "")).toBeNull();
    expect(cualEsDelCatalogo(MARCAS, null)).toBeNull();
    expect(mismoNombre("", "")).toBe(false);
  });
});

describe("cómo se compara", () => {
  test("se queda con lo que no cambia al escribirlo", () => {
    expect(comoSeCompara("T-Roc")).toBe("TROC");
    expect(comoSeCompara("Citroën")).toBe("CITROEN");
    expect(comoSeCompara("  Volkswagen ")).toBe("VOLKSWAGEN");
  });
});
