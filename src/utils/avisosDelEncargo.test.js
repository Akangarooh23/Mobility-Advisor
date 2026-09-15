import { loQueLeFaltaDelEncargo, cuantasLeFaltanDelEncargo, laLineaDelEncargo } from "./avisosDelEncargo";

/**
 * Lo que le falta del encargo, resumido para el home y la campana.
 *
 * Lo que se protege: que **desaparezca** cuando lo haya hecho todo. La campana
 * deja fuera a propósito lo que no se acaba nunca, porque una campana con
 * número permanente deja de mirarse en dos semanas. Esto entra porque se vacía;
 * el día que no se vaciara, habría que sacarlo de ahí.
 */
const conPuertas = (puertas, extra = {}) => ({
  id: "lead-1",
  type: "venta_gestionada",
  title: "Volkswagen T-Roc 2022 · 8888LXR",
  meta: JSON.stringify({ puertas }),
  ...extra,
});

const CINCO = [
  { clave: "idcar", nombre: "El coche", abierta: true, falta: "" },
  { clave: "papeles", nombre: "Los papeles", abierta: false, falta: "Te falta la ITV" },
  { clave: "tasacion", nombre: "La tasación", abierta: false, falta: "No te la has hecho" },
  { clave: "informe", nombre: "El informe de estado", abierta: true, falta: "" },
  { clave: "franjas", nombre: "Las franjas de visita", abierta: true, falta: "" },
];

describe("qué le falta", () => {
  test("cuenta solo las cerradas", () => {
    expect(cuantasLeFaltanDelEncargo([conPuertas(CINCO)])).toBe(2);
  });

  test("y con todo hecho no hay nada que decir", () => {
    /*
     * Es la prueba que justifica que esto esté en la campana. Si con todo hecho
     * siguiera devolviendo algo, sería un número permanente y habría que
     * sacarlo de ahí.
     */
    const todas = CINCO.map((p) => ({ ...p, abierta: true, falta: "" }));
    expect(loQueLeFaltaDelEncargo([conPuertas(todas)])).toBeNull();
    expect(cuantasLeFaltanDelEncargo([conPuertas(todas)])).toBe(0);
    expect(laLineaDelEncargo([conPuertas(todas)])).toBeNull();
  });

  test("sin encargo tampoco", () => {
    expect(loQueLeFaltaDelEncargo([{ type: "visit", meta: "{}" }])).toBeNull();
    expect(loQueLeFaltaDelEncargo([])).toBeNull();
  });

  test("un encargo sin puertas calculadas no cuenta", () => {
    // Todavía no ha dado el coche de alta: no hay cinco puertas que mirar, y
    // decirle «te faltan 0 cosas» seria mentirle.
    expect(loQueLeFaltaDelEncargo([conPuertas(null)])).toBeNull();
  });

  test("un meta roto no tumba el panel", () => {
    expect(() => loQueLeFaltaDelEncargo([{ type: "venta_gestionada", meta: "{{{" }])).not.toThrow();
    expect(loQueLeFaltaDelEncargo([{ type: "venta_gestionada", meta: "{{{" }])).toBeNull();
  });

  test("con dos coches suma los dos", () => {
    const otro = conPuertas(CINCO, { id: "lead-2", title: "Seat Ibiza · 1234ABC" });
    expect(cuantasLeFaltanDelEncargo([conPuertas(CINCO), otro])).toBe(4);
  });
});

describe("la línea del resumen", () => {
  test("nombra la primera que le falta, no solo cuenta", () => {
    // Nombrarla es lo que hace que se pueda hacer ahora mismo.
    const linea = laLineaDelEncargo([conPuertas(CINCO)]);
    expect(linea.label).toMatch(/Te quedan 2 cosas/);
    expect(linea.detail).toBe("Los papeles: Te falta la ITV");
    expect(linea.section).toBe("solicitudes");
  });

  test("con una sola, en singular", () => {
    const una = CINCO.map((p) => (p.clave === "tasacion" ? { ...p, abierta: true, falta: "" } : p));
    expect(laLineaDelEncargo([conPuertas(una)]).label).toMatch(/Te queda una cosa/);
  });

  test("y lleva al sitio donde se ven las cinco", () => {
    expect(laLineaDelEncargo([conPuertas(CINCO)]).section).toBe("solicitudes");
  });

  test("con dos coches habla de coches, no de uno", () => {
    const otro = conPuertas(CINCO, { id: "lead-2", title: "Seat Ibiza · 1234ABC" });
    expect(laLineaDelEncargo([conPuertas(CINCO), otro]).label).toMatch(/2 coches/);
  });
});

/**
 * El mandato cuenta como una cosa más.
 *
 * Si no contara, la campana diría «4» mientras la lista del panel dice cinco —
 * y la que faltaría de contar es la única que decide si podemos vender por él.
 * Son tres sitios los que tienen que decir el mismo número: la campana, la
 * línea del resumen y la lista.
 */
describe("el mandato cuenta en la campana", () => {
  const conMandato = (firmado) => ([{
    id: "lead-1",
    type: "venta_gestionada",
    title: "Volkswagen T-Roc",
    meta: JSON.stringify({
      mandato: { encargo_id: "enc-1", mandato_id: "PC-MAND-2026-001", firmado },
      puertas: [
        { clave: "idcar", nombre: "El coche", abierta: true, falta: "" },
        { clave: "papeles", nombre: "Los papeles", abierta: false, falta: "Falta la ITV" },
      ],
    }),
  }]);

  test("sin firmar suma uno", () => {
    // Una puerta pendiente + el mandato = dos.
    expect(cuantasLeFaltanDelEncargo(conMandato(false))).toBe(2);
  });

  test("firmado no suma", () => {
    expect(cuantasLeFaltanDelEncargo(conMandato(true))).toBe(1);
  });

  test("y va el primero, que es lo que se nombra en el resumen", () => {
    /*
     * La línea del home nombra la primera que falta. Si el mandato no fuera el
     * primero, le diría «te faltan los papeles» a alguien que ni siquiera ha
     * firmado todavía.
     */
    const linea = laLineaDelEncargo(conMandato(false));
    expect(linea.detail).toMatch(/El mandato firmado/);
  });

  test("un encargo con mandato y sin puertas también cuenta", () => {
    // Es quien acaba de recibirlo y todavía no ha dado de alta el coche.
    const solo = [{
      id: "lead-2", type: "venta_gestionada", title: "Seat Ibiza",
      meta: JSON.stringify({ mandato: { encargo_id: "e", mandato_id: "M", firmado: false } }),
    }];
    expect(cuantasLeFaltanDelEncargo(solo)).toBe(1);
  });
});
